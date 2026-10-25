---
publishDate: 2026-10-09T08:20
title: Azure Container Instances
slug: azure-container-instances
metadescription: Run a single container without any orchestrator using Azure Container Instances, and know exactly where it fits.
updateDate: 2026-09-07T08:20
author: ['bishal-biswas']
level: 2
tags: ['compute', 'containers', 'aci']
course: azure
---

## What it is

The simplest way to run a container in Azure. No cluster, no plan, no orchestrator. Give it an image and it runs.

```bash
az container create \
  --name aci-report --resource-group rg-shop-prod-uks \
  --image ghcr.io/contoso/report-generator:1.2.0 \
  --cpu 2 --memory 4 \
  --restart-policy Never \
  --environment-variables RUN_DATE=2026-09-07 \
  --os-type Linux
```

Billing is per second, for the CPU and memory you requested, while the container runs.

```bash
az container logs --name aci-report --resource-group rg-shop-prod-uks
az container show --name aci-report --resource-group rg-shop-prod-uks \
  --query "instanceView.state"
az container delete --name aci-report --resource-group rg-shop-prod-uks --yes
```

## Restart policy decides the shape

```text
Always     the default. A long running service.
OnFailure  retry until it succeeds, then stop. Batch work.
Never      run once, then stop, whatever happens.
```

`OnFailure` and `Never` are what make ACI useful for jobs. A container group with one of those runs to completion and stops billing, which is exactly what a nightly report or a data import wants.

## Where it fits

```text
Good for
  scheduled batch jobs
  build agents that appear and disappear
  one off data processing
  a burst of parallel work
  simple isolated tasks with no service discovery

Not good for
  a web application, since there is no scaling or load balancing
  anything needing zero downtime deployment
  microservices that talk to each other
  anything you would describe as production traffic
```

The honest summary: **ACI is for jobs, not services.** For a service, Container Apps does everything ACI does plus scaling, ingress, revisions and health probes, usually for less effort.

## Pulling from a private registry

```bash
az container create \
  --name aci-report --resource-group rg-shop-prod-uks \
  --image acrshop.azurecr.io/report-generator:1.2.0 \
  --acr-identity /subscriptions/.../userAssignedIdentities/id-shop-aci \
  --assign-identity /subscriptions/.../userAssignedIdentities/id-shop-aci \
  --cpu 2 --memory 4 --restart-policy Never
```

The identity needs `AcrPull` on the registry. Using a managed identity avoids the older pattern of passing registry username and password on the command line, where they end up in shell history and deployment logs.

## Networking

```bash
# public, with a DNS name
az container create ... \
  --ip-address Public --ports 80 --dns-name-label shop-report-abc123

# private, inside a delegated subnet
az container create ... \
  --vnet vnet-shop-prod-uks --subnet snet-aci
```

The subnet must be delegated to `Microsoft.ContainerInstance/containerGroups`.

**A public container instance has no WAF, no TLS termination and no load balancing.** Anything public facing wants Container Apps or App Service instead.

## Mounting storage

```bash
az container create \
  --name aci-import --resource-group rg-shop-prod-uks \
  --image ghcr.io/contoso/importer:2.0.0 \
  --azure-file-volume-account-name stshopprod \
  --azure-file-volume-share-name imports \
  --azure-file-volume-mount-path /data \
  --restart-policy Never --cpu 1 --memory 2
```

An Azure Files share mounted into the container. The container's own file system is ephemeral and disappears with it.

## Multi container groups

```yaml
apiVersion: 2021-10-01
location: uksouth
name: aci-shop-worker
properties:
  containers:
    - name: worker
      properties:
        image: ghcr.io/contoso/worker:1.0.0
        resources:
          requests:
            cpu: 1
            memoryInGB: 2
    - name: log-forwarder
      properties:
        image: ghcr.io/contoso/fluent:1.0.0
        resources:
          requests:
            cpu: 0.5
            memoryInGB: 0.5
  osType: Linux
  restartPolicy: OnFailure
type: Microsoft.ContainerInstance/containerGroups
```

```bash
az container create --resource-group rg-shop-prod-uks --file group.yaml
```

Containers in a group share a lifecycle, a network namespace and mounted volumes, so they reach each other on `localhost`. It is the sidecar pattern without Kubernetes.

## Running it on a schedule

ACI has no scheduler of its own. Use Logic Apps, a timer triggered Function, or an Azure DevOps or GitHub Actions schedule to start it.

```bash
az container start --name aci-report --resource-group rg-shop-prod-uks
```

A container group with `restartPolicy: Never` can be started again after it completes, so the pattern is to create it once and start it on a schedule.

## Cost

```text
Billed per second, for requested CPU and memory, while running
A stopped container group costs nothing
Requesting more than you need costs proportionally more
```

A job needing four seconds costs almost nothing. A container group left running with `restartPolicy: Always` and nothing to do bills continuously, and that is where ACI surprises people.

```bash
az container list --query "[].{Name:name, State:instanceView.state, Cpu:containers[0].resources.requests.cpu}" -o table
```

Worth listing occasionally. Forgotten container groups from a test are a common source of small, persistent spend.

## ACI or Container Apps

```text
ACI             one container, one job, no orchestration, per second billing
Container Apps  services, scaling, ingress, revisions, KEDA, Dapr
```

Container Apps also has a jobs feature, which handles scheduled and event driven runs with the same model as its services. That has narrowed ACI's niche considerably.

Use ACI when you want the absolute simplest thing that runs a container and nothing else. Use Container Apps for anything that resembles an application.

## Quick recap

- ACI runs a container with no cluster and no plan, billed per second while running.
- Restart policy decides the shape, and `Never` or `OnFailure` are what make it useful for jobs.
- It is for jobs, not services, since there is no scaling, ingress or load balancing.
- Use a managed identity with `AcrPull` rather than registry credentials on the command line.
- The container file system is ephemeral, so mount Azure Files for anything durable.
- Containers in a group share a network namespace and reach each other on localhost.
- Container Apps jobs cover most of what ACI was used for, with more capability.

<code id="code-content" class="language-bash">
# THE SIMPLEST WAY TO RUN A CONTAINER IN AZURE. No cluster, no plan, no
# orchestrator. Billed PER SECOND for requested CPU and memory while running.
az container create --name aci-report --resource-group rg-shop-prod-uks \
  --image ghcr.io/contoso/report-generator:1.2.0 --cpu 2 --memory 4 \
  --restart-policy Never --environment-variables RUN_DATE=2026-09-07
# RESTART POLICY DECIDES THE SHAPE:
#   Always     the default. A long running service.
#   OnFailure  retry until it succeeds, then stop. Batch work.
#   Never      run once and stop, whatever happens.
# OnFailure and Never are what make ACI useful: the job completes and
# BILLING STOPS. That is what a nightly report wants.
# THE HONEST SUMMARY: ACI IS FOR JOBS, NOT SERVICES. There is no scaling,
# no load balancing, no ingress, no zero downtime deployment. For a service
# Container Apps does all of that for less effort.
# PRIVATE REGISTRY: use a managed identity with AcrPull, not a username and
# password that end up in shell history and deployment logs.
az container create --name aci-report --resource-group rg-shop-prod-uks \
  --image acrshop.azurecr.io/report-generator:1.2.0 \
  --acr-identity /subscriptions/.../userAssignedIdentities/id-shop-aci \
  --assign-identity /subscriptions/.../userAssignedIdentities/id-shop-aci
# A PUBLIC container instance has NO WAF, NO TLS TERMINATION and NO LOAD
# BALANCING. Anything public facing wants Container Apps or App Service.
# Private needs a subnet delegated to Microsoft.ContainerInstance/containerGroups.
# THE CONTAINER FILE SYSTEM IS EPHEMERAL. Mount Azure Files for anything
# that must survive:
az container create --name aci-import --resource-group rg-shop-prod-uks \
  --image ghcr.io/contoso/importer:2.0.0 --restart-policy Never \
  --azure-file-volume-account-name stshopprod \
  --azure-file-volume-share-name imports --azure-file-volume-mount-path /data
# MULTI CONTAINER GROUPS share a lifecycle, a network namespace and volumes,
# so they reach each other on LOCALHOST. Sidecars without Kubernetes.
az container create --resource-group rg-shop-prod-uks --file group.yaml
# ACI HAS NO SCHEDULER. Start it from Logic Apps, a timer Function, or a
# pipeline schedule. A "Never" group can be started again after completing.
az container start --name aci-report --resource-group rg-shop-prod-uks
az container logs --name aci-report --resource-group rg-shop-prod-uks
# WHERE IT SURPRISES PEOPLE: a group left on restartPolicy Always with
# nothing to do bills CONTINUOUSLY. Worth listing occasionally:
az container list --query "[].{Name:name, State:instanceView.state}" -o table
# Container Apps now has a JOBS feature covering scheduled and event driven
# runs, which has narrowed ACI's niche considerably.
</code></pre>
