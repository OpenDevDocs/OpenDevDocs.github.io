---
publishDate: 2026-10-08T08:00
title: 'App Service: Web Apps and Deployment Slots'
slug: app-service-and-deployment-slots
metadescription: Host web apps and APIs on Azure App Service, and use deployment slots to release without downtime.
updateDate: 2026-09-07T08:00
author: ['bishal-biswas']
level: 1
tags: ['compute', 'app service', 'deployment']
course: azure
---

## Plan and app

Two resources, and the distinction matters for cost.

```text
App Service plan   the compute you pay for. A size and an instance count.
Web app            the application. Several can share one plan.
```

```bash
az appservice plan create \
  --name plan-shop --resource-group rg-shop-prod-uks \
  --sku P1v3 --is-linux --number-of-workers 2

az webapp create \
  --name shop-api --resource-group rg-shop-prod-uks \
  --plan plan-shop --runtime "DOTNETCORE:8.0"
```

**You pay for the plan, not the apps.** Ten small apps on one plan cost the same as one. That is the cheapest way to host several low traffic services, and it means they compete for the same CPU and memory.

## Tiers

```text
Free, Shared   no custom domain SSL, no scaling, quotas. Experiments only.
Basic          custom domains, manual scale, NO deployment slots
Standard       5 slots, autoscale, daily backups
Premium v3     20 slots, better hardware, vnet integration, zone redundancy
Isolated v2    App Service Environment, full network isolation
```

**Basic has no deployment slots**, which is the reason to start at Standard for anything real. Premium v3 is where production usually lands: better price to performance than v2 and the older tiers, plus zone redundancy.

## Deploying

```bash
# from a zip
az webapp deploy --name shop-api --resource-group rg-shop-prod-uks \
  --src-path ./publish.zip --type zip

# from a container
az webapp config container set --name shop-api --resource-group rg-shop-prod-uks \
  --container-image-name ghcr.io/contoso/shop-api:1.4.0

# continuous deployment from GitHub
az webapp deployment github-actions add \
  --name shop-api --resource-group rg-shop-prod-uks \
  --repo contoso/shop --branch main --login-with-github
```

Zip deploy is the standard path. The build output goes up as an archive and the platform restarts the app.

```bash
az webapp config appsettings set --name shop-api --resource-group rg-shop-prod-uks \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

That builds on the server from source. Convenient for simple cases, and slower and less predictable than building in CI. Prefer building in the pipeline and deploying the artefact.

## Deployment slots

The best feature of App Service, and the reason to be on Standard or above.

```bash
az webapp deployment slot create \
  --name shop-api --resource-group rg-shop-prod-uks --slot staging

az webapp deploy --name shop-api --resource-group rg-shop-prod-uks \
  --slot staging --src-path ./publish.zip --type zip

az webapp deployment slot swap \
  --name shop-api --resource-group rg-shop-prod-uks \
  --slot staging --target-slot production
```

A slot is a full copy of the app with its own hostname, sharing the plan. Deploy there, test it properly, then swap.

**The swap is a routing change, not a redeploy.** Before completing it, Azure warms the staging instance by sending requests to it, so the app is already started when it takes production traffic. That eliminates the cold start users would otherwise see on every release.

If something is wrong, swap back:

```bash
az webapp deployment slot swap --name shop-api --resource-group rg-shop-prod-uks \
  --slot staging --target-slot production --action swap
```

The previous version is now in staging, ready to go straight back. Rollback in seconds.

## Sticky settings

Some settings must not travel with the swap. A staging slot pointing at the production database is a bad afternoon.

```bash
az webapp config appsettings set \
  --name shop-api --resource-group rg-shop-prod-uks --slot staging \
  --slot-settings ASPNETCORE_ENVIRONMENT=Staging ConnectionStrings__Db="..."
```

`--slot-settings` marks a setting as **sticky**: it stays with the slot rather than moving with the code. Regular `--settings` swaps across.

Mark as sticky anything that identifies the environment: connection strings, feature flags, external endpoints, telemetry keys.

## Warming up before the swap

```bash
az webapp config appsettings set --name shop-api --resource-group rg-shop-prod-uks \
  --settings WEBSITE_SWAP_WARMUP_PING_PATH=/healthz \
             WEBSITE_SWAP_WARMUP_PING_STATUSES=200
```

By default the swap pings the root. Pointing it at a real health endpoint means the swap waits for the app to be genuinely ready, including whatever it initialises on first request.

## Traffic splitting

```bash
az webapp traffic-routing set \
  --name shop-api --resource-group rg-shop-prod-uks \
  --distribution staging=10
```

Ten percent of traffic to staging, ninety to production. A basic canary release without any extra infrastructure.

Watch error rates, increase gradually, then swap. Reset with `az webapp traffic-routing clear`.

## Custom domains and certificates

```bash
az webapp config hostname add \
  --webapp-name shop-api --resource-group rg-shop-prod-uks \
  --hostname api.example.com

az webapp config ssl create \
  --name shop-api --resource-group rg-shop-prod-uks \
  --hostname api.example.com

az webapp update --name shop-api --resource-group rg-shop-prod-uks \
  --https-only true
```

Managed certificates are free and renew automatically. Set `--https-only` so HTTP requests redirect rather than being served.

## Networking

```bash
# outbound: the app reaches into a virtual network
az webapp vnet-integration add \
  --name shop-api --resource-group rg-shop-prod-uks \
  --vnet vnet-shop-prod-uks --subnet snet-appservice

# inbound: restrict who can reach the app
az webapp config access-restriction add \
  --name shop-api --resource-group rg-shop-prod-uks \
  --rule-name allow-front-door --priority 100 --action Allow \
  --service-tag AzureFrontDoor.Backend
```

Two separate things, and they are often confused. Integration is **outbound**, letting the app reach a database on a private endpoint. Access restrictions are **inbound**, limiting who can call the app.

The integration subnet must be delegated to `Microsoft.Web/serverFarms` and holds nothing else.

## Diagnostics

```bash
az webapp log config --name shop-api --resource-group rg-shop-prod-uks \
  --application-logging filesystem --level information --detailed-error-messages true

az webapp log tail --name shop-api --resource-group rg-shop-prod-uks
az webapp ssh --name shop-api --resource-group rg-shop-prod-uks
```

The Kudu console at `https://shop-api.scm.azurewebsites.net` gives a file browser, a process explorer and an environment listing. It is the first place to look when the app runs locally and not in Azure.

## Common problems

**App works locally, 500 in Azure.** Usually a missing app setting or connection string. Check the environment in Kudu.

**Slow first request after deploy.** Enable Always On, or use slots so the swap warms the instance.

```bash
az webapp config set --name shop-api --resource-group rg-shop-prod-uks --always-on true
```

**Files disappear after restart.** The file system is not durable for application writes. Use Blob Storage.

**Swap fails.** Warm up path returning a non 200 status. Check the health endpoint.

**Plan is at 100 percent CPU.** Several apps share it. Scale up, scale out, or move a busy app to its own plan.

## Quick recap

- You pay for the plan, not the apps, so several small apps can share one.
- Basic has no deployment slots, so start at Standard for anything real.
- A swap is a routing change with a warm up, not a redeploy, so releases have no cold start.
- Mark environment specific settings as sticky, or staging will point at production.
- Point the warm up path at a real health endpoint.
- Vnet integration is outbound, access restrictions are inbound.
- The file system is not durable, so application writes belong in storage.

<code id="code-content" class="language-bash">
# TWO RESOURCES: the PLAN is the compute you pay for, the WEB APP is the
# application. YOU PAY FOR THE PLAN, NOT THE APPS, so ten small apps on one
# plan cost the same as one, and compete for the same CPU.
az appservice plan create --name plan-shop --resource-group rg-shop-prod-uks \
  --sku P1v3 --is-linux --number-of-workers 2
az webapp create --name shop-api --resource-group rg-shop-prod-uks \
  --plan plan-shop --runtime "DOTNETCORE:8.0"
# BASIC HAS NO DEPLOYMENT SLOTS. That is the reason to start at Standard.
# Premium v3 is where production usually lands.
# DEPLOYMENT SLOTS are the best feature here. A slot is a full copy of the
# app with its own hostname, sharing the plan.
az webapp deployment slot create --name shop-api \
  --resource-group rg-shop-prod-uks --slot staging
az webapp deploy --name shop-api --resource-group rg-shop-prod-uks \
  --slot staging --src-path ./publish.zip --type zip
az webapp deployment slot swap --name shop-api \
  --resource-group rg-shop-prod-uks --slot staging --target-slot production
# THE SWAP IS A ROUTING CHANGE, NOT A REDEPLOY. Azure WARMS the staging
# instance first, so users never see a cold start on release. And the old
# version is now in staging, so rollback is another swap: seconds.
# STICKY SETTINGS. --slot-settings STAYS WITH THE SLOT. Plain --settings
# SWAPS ACROSS, which is how staging ends up on the production database.
az webapp config appsettings set --name shop-api \
  --resource-group rg-shop-prod-uks --slot staging \
  --slot-settings ASPNETCORE_ENVIRONMENT=Staging ConnectionStrings__Db="..."
# Point the warm up at a REAL health endpoint, not the default root ping:
az webapp config appsettings set --name shop-api --resource-group rg-shop-prod-uks \
  --settings WEBSITE_SWAP_WARMUP_PING_PATH=/healthz \
             WEBSITE_SWAP_WARMUP_PING_STATUSES=200
# CANARY with no extra infrastructure: 10% to staging, watch errors, swap.
az webapp traffic-routing set --name shop-api \
  --resource-group rg-shop-prod-uks --distribution staging=10
# TWO DIFFERENT NETWORK THINGS, often confused:
#   vnet-integration     OUTBOUND. The app reaches a private endpoint.
#   access-restriction   INBOUND. Who may call the app.
az webapp vnet-integration add --name shop-api --resource-group rg-shop-prod-uks \
  --vnet vnet-shop-prod-uks --subnet snet-appservice
# The integration subnet must be delegated to Microsoft.Web/serverFarms.
# WHEN IT WORKS LOCALLY AND NOT IN AZURE, it is usually a missing app
# setting. Kudu at https://&lt;app&gt;.scm.azurewebsites.net shows the truth.
az webapp log tail --name shop-api --resource-group rg-shop-prod-uks
# Slow first request: Always On, or use slots. Files vanishing after a
# restart: the file system is NOT durable, write to Blob Storage.
az webapp config set --name shop-api --resource-group rg-shop-prod-uks --always-on true
</code></pre>
