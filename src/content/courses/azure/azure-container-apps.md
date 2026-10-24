---
publishDate: 2026-10-10T08:25
title: Azure Container Apps
slug: azure-container-apps
metadescription: Run containerised services on Azure Container Apps with revisions, KEDA scaling and no cluster to manage.
updateDate: 2026-09-07T08:25
author: ['bishal-biswas']
level: 2
tags: ['compute', 'containers', 'container apps']
course: azure
---

## What it is

Kubernetes underneath, hidden. You get scaling, ingress, revisions, service discovery and secrets, and you never see a node, a manifest or a kubectl command.

```bash
az containerapp env create \
  --name cae-shop --resource-group rg-shop-prod-uks --location uksouth \
  --logs-destination log-analytics \
  --logs-workspace-id "$WORKSPACE_ID" --logs-workspace-key "$WORKSPACE_KEY"

az containerapp create \
  --name shop-api --resource-group rg-shop-prod-uks \
  --environment cae-shop \
  --image ghcr.io/contoso/shop-api:1.4.0 \
  --target-port 8080 --ingress external \
  --cpu 0.5 --memory 1.0Gi \
  --min-replicas 1 --max-replicas 10
```

The **environment** is the boundary. Apps in one environment share a virtual network and a Log Analytics workspace, and can reach each other by name.

## Scaling, including to zero

```bash
az containerapp update \
  --name shop-api --resource-group rg-shop-prod-uks \
  --min-replicas 0 --max-replicas 20 \
  --scale-rule-name http-rule \
  --scale-rule-type http \
  --scale-rule-http-concurrency 50
```

`--min-replicas 0` means an idle app costs nothing. A request wakes it, at the cost of a cold start of a few seconds.

```text
min-replicas 0  cheapest, cold starts. Development, internal tools, spiky work.
min-replicas 1  no cold start for the first user, always billing.
min-replicas 3  production, spread across zones.
```

## KEDA scale rules

This is where Container Apps is stronger than App Service. Scaling can be driven by any KEDA scaler, not just CPU.

```bash
# scale on Service Bus queue depth
az containerapp update \
  --name shop-worker --resource-group rg-shop-prod-uks \
  --min-replicas 0 --max-replicas 30 \
  --scale-rule-name servicebus \
  --scale-rule-type azure-servicebus \
  --scale-rule-metadata queueName=orders namespace=sb-shop-prod messageCount=20 \
  --scale-rule-auth "connection=servicebus-connection"

# scale on storage queue length
az containerapp update \
  --name shop-thumbnails --resource-group rg-shop-prod-uks \
  --scale-rule-name queue --scale-rule-type azure-queue \
  --scale-rule-metadata queueName=images queueLength=10 \
  --scale-rule-auth "connection=storage-connection"
```

A worker that scales from zero to thirty on queue depth and back to zero is the pattern Container Apps does best. No instance runs while the queue is empty.

`messageCount=20` means one replica per twenty messages. Tune it to how long one message takes.

## Revisions

Every change that touches the container creates a new revision, and revisions can run side by side.

```bash
az containerapp update \
  --name shop-api --resource-group rg-shop-prod-uks \
  --image ghcr.io/contoso/shop-api:1.5.0 \
  --revision-suffix v150

az containerapp revision list --name shop-api --resource-group rg-shop-prod-uks \
  --query "[].{Name:name, Active:properties.active, Traffic:properties.trafficWeight}" -o table

az containerapp ingress traffic set \
  --name shop-api --resource-group rg-shop-prod-uks \
  --revision-weight shop-api--v140=90 shop-api--v150=10
```

Ten percent of traffic to the new revision. Watch the errors, then shift the rest.

```bash
az containerapp ingress traffic set \
  --name shop-api --resource-group rg-shop-prod-uks \
  --revision-weight shop-api--v150=100

az containerapp revision deactivate \
  --name shop-api --resource-group rg-shop-prod-uks --revision shop-api--v140
```

Rollback is shifting the weight back, which takes seconds.

```text
Single revision mode   the default. New revision replaces the old.
Multiple revision mode required for traffic splitting.
```

```bash
az containerapp revision set-mode --name shop-api \
  --resource-group rg-shop-prod-uks --mode multiple
```

**Changes that create a new revision** are image, environment variables, secrets references, scale rules and resources. Changes that do not include traffic weights and ingress settings.

## Secrets

```bash
az containerapp secret set \
  --name shop-api --resource-group rg-shop-prod-uks \
  --secrets "stripe-key=keyvaultref:https://kv-shop-prod.vault.azure.net/secrets/stripe-key,identityref:/subscriptions/.../userAssignedIdentities/id-shop"

az containerapp update \
  --name shop-api --resource-group rg-shop-prod-uks \
  --set-env-vars "StripeKey=secretref:stripe-key"
```

`keyvaultref` pulls from Key Vault using a managed identity, so the value never sits in the Container Apps resource. `secretref` in an environment variable keeps it out of the environment listing too.

## Service discovery

```bash
az containerapp create \
  --name shop-worker --resource-group rg-shop-prod-uks \
  --environment cae-shop --image ghcr.io/contoso/shop-worker:1.0.0 \
  --ingress internal --target-port 8080
```

Internal ingress gives an address reachable only inside the environment. Other apps call it by name:

```csharp
builder.Services.AddHttpClient("worker", client =>
{
    client.BaseAddress = new Uri("https://shop-worker.internal.cae-shop.uksouth.azurecontainerapps.io");
});
```

No load balancer, no service registry, no configuration.

## Health probes

```bash
az containerapp update --name shop-api --resource-group rg-shop-prod-uks \
  --yaml app.yaml
```

```yaml
properties:
  template:
    containers:
      - name: shop-api
        image: ghcr.io/contoso/shop-api:1.5.0
        probes:
          - type: Liveness
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 10
          - type: Readiness
            httpGet:
              path: /ready
              port: 8080
            periodSeconds: 5
          - type: Startup
            httpGet:
              path: /healthz
              port: 8080
            failureThreshold: 30
            periodSeconds: 5
```

```text
Liveness   failing means restart the container
Readiness  failing means stop sending it traffic
Startup    gives a slow starting app time before liveness applies
```

The startup probe is the one people forget. Without it, an app taking 40 seconds to start is killed by the liveness probe before it ever becomes ready, and restarts forever.

## Jobs

```bash
az containerapp job create \
  --name job-nightly --resource-group rg-shop-prod-uks \
  --environment cae-shop \
  --trigger-type Schedule --cron-expression "0 2 * * *" \
  --image ghcr.io/contoso/reconcile:1.0.0 \
  --cpu 1 --memory 2Gi --replica-timeout 1800

az containerapp job create \
  --name job-import --resource-group rg-shop-prod-uks \
  --environment cae-shop --trigger-type Event \
  --image ghcr.io/contoso/importer:1.0.0 \
  --scale-rule-name queue --scale-rule-type azure-queue \
  --scale-rule-metadata queueName=imports queueLength=1
```

```text
Manual     started on demand
Schedule   a CRON expression, five fields here
Event      started by a KEDA scaler, like a queue message
```

Note the job CRON is the standard five field form, unlike the six field version in Functions.

Jobs replaced most of what people used Container Instances for, in the same environment as your services.

## Dapr

```bash
az containerapp update --name shop-api --resource-group rg-shop-prod-uks \
  --enable-dapr --dapr-app-id shop-api --dapr-app-port 8080
```

Dapr gives service invocation with retries, pub sub, state stores and secret access through a standard HTTP interface, so the application does not reference a specific broker or database SDK.

Optional, and useful for polyglot systems. Skip it if you do not need it, since it is another concept to learn.

## Debugging

```bash
az containerapp logs show --name shop-api --resource-group rg-shop-prod-uks --follow
az containerapp exec --name shop-api --resource-group rg-shop-prod-uks --command /bin/sh
az containerapp revision show --name shop-api --resource-group rg-shop-prod-uks \
  --revision shop-api--v150 --query "properties.provisioningState"
```

**Revision fails to provision.** The image cannot be pulled, or the container exits immediately. Check logs from the failed revision.

**App scales to zero and never wakes.** With `min-replicas 0` and no HTTP scale rule, nothing triggers a wake for non HTTP traffic.

**Cannot reach another app.** Internal ingress must be enabled on the target, and both must be in the same environment.

## Quick recap

- Container Apps is Kubernetes with the Kubernetes hidden, and the environment is the boundary.
- `min-replicas 0` makes an idle app free, at the cost of a cold start.
- KEDA scale rules let a worker scale on queue depth rather than CPU, which is the strongest feature.
- Revisions run side by side, so canary releases and instant rollbacks are traffic weight changes.
- Use `keyvaultref` and `secretref` so secrets never sit in the app resource.
- Internal ingress gives service discovery by name with no configuration.
- Add a startup probe, or a slow starting app is killed before it is ready.

<code id="code-content" class="language-bash">
# KUBERNETES UNDERNEATH, HIDDEN. Scaling, ingress, revisions, service
# discovery and secrets, with no node, manifest or kubectl. The ENVIRONMENT
# is the boundary: apps in one share a vnet and a workspace and can reach
# each other by name.
az containerapp create --name shop-api --resource-group rg-shop-prod-uks \
  --environment cae-shop --image ghcr.io/contoso/shop-api:1.4.0 \
  --target-port 8080 --ingress external --cpu 0.5 --memory 1.0Gi \
  --min-replicas 1 --max-replicas 10
# --min-replicas 0 means an IDLE APP COSTS NOTHING. A request wakes it, at
# the price of a few seconds of cold start.
# KEDA SCALE RULES ARE THE STRONGEST FEATURE. Scale on what actually
# matters, not CPU. A worker going zero -&gt; thirty on queue depth and back:
az containerapp update --name shop-worker --resource-group rg-shop-prod-uks \
  --min-replicas 0 --max-replicas 30 --scale-rule-name servicebus \
  --scale-rule-type azure-servicebus \
  --scale-rule-metadata queueName=orders namespace=sb-shop-prod messageCount=20 \
  --scale-rule-auth "connection=servicebus-connection"
# messageCount=20 means one replica per twenty messages. Tune to how long
# one message takes.
# REVISIONS RUN SIDE BY SIDE. Canary and rollback are TRAFFIC WEIGHT
# CHANGES, which take seconds. Needs multiple revision mode.
az containerapp revision set-mode --name shop-api \
  --resource-group rg-shop-prod-uks --mode multiple
az containerapp ingress traffic set --name shop-api --resource-group rg-shop-prod-uks \
  --revision-weight shop-api--v140=90 shop-api--v150=10
# SECRETS: keyvaultref pulls from Key Vault with a managed identity, so the
# value never sits in the Container Apps resource. secretref keeps it out
# of the environment listing too.
az containerapp secret set --name shop-api --resource-group rg-shop-prod-uks \
  --secrets "stripe-key=keyvaultref:https://kv-shop-prod.vault.azure.net/secrets/stripe-key,identityref:/subscriptions/.../id-shop"
az containerapp update --name shop-api --resource-group rg-shop-prod-uks \
  --set-env-vars "StripeKey=secretref:stripe-key"
# SERVICE DISCOVERY: internal ingress, then call it BY NAME. No load
# balancer, no service registry, no configuration.
#   https://shop-worker.internal.cae-shop.uksouth.azurecontainerapps.io
# PROBES: Liveness restarts, Readiness stops traffic, STARTUP gives a slow
# app time before liveness applies. THE STARTUP PROBE IS THE ONE PEOPLE
# FORGET: without it, an app taking 40 seconds is killed and restarts forever.
# JOBS replaced most of what Container Instances was used for. NOTE the job
# CRON is the standard FIVE field form, unlike Functions' six.
az containerapp job create --name job-nightly --resource-group rg-shop-prod-uks \
  --environment cae-shop --trigger-type Schedule --cron-expression "0 2 * * *" \
  --image ghcr.io/contoso/reconcile:1.0.0 --replica-timeout 1800
az containerapp logs show --name shop-api --resource-group rg-shop-prod-uks --follow
az containerapp exec --name shop-api --resource-group rg-shop-prod-uks --command /bin/sh
</code></pre>
