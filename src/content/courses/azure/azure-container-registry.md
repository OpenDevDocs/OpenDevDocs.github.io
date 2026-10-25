---
publishDate: 2026-10-10T08:30
title: Azure Container Registry
slug: azure-container-registry
metadescription: Store and secure container images in Azure Container Registry, authenticate without passwords, and keep the registry from growing forever.
updateDate: 2026-09-07T08:30
author: ['bishal-biswas']
level: 2
tags: ['containers', 'registry', 'acr']
course: azure
---

## Creating one

```bash
az acr create \
  --name acrshop --resource-group rg-shop-prod-uks \
  --sku Standard --location uksouth
```

The name is globally unique and becomes `acrshop.azurecr.io`. Alphanumeric only, no hyphens.

```text
Basic     10 GB, low throughput. Development.
Standard  100 GB, more throughput. Most production.
Premium   500 GB, geo-replication, private endpoints, content trust, tokens
```

Premium is needed for private endpoints and geo-replication, which is what pushes most production estates to it.

## Building images

```bash
# build in Azure, no local Docker needed
az acr build \
  --registry acrshop \
  --image shop-api:1.4.0 \
  --image shop-api:latest \
  --file Dockerfile .

# or push from a local build
az acr login --name acrshop
docker build -t acrshop.azurecr.io/shop-api:1.4.0 .
docker push acrshop.azurecr.io/shop-api:1.4.0
```

`az acr build` sends the context to Azure and builds there. Useful on a machine without Docker, and on a CI agent it avoids installing a Docker daemon.

## Authentication without passwords

```bash
# the app pulls with its managed identity
az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role AcrPull \
  --scope /subscriptions/.../registries/acrshop

# AKS attaches a registry directly
az aks update --name aks-shop --resource-group rg-shop-prod-uks --attach-acr acrshop
```

```text
AcrPull    pull images. What a running application needs.
AcrPush    push and pull. What a build pipeline needs.
AcrDelete  delete images. For cleanup automation.
```

**Disable the admin account.** It is a username and password pair with full access, enabled for convenience and shared as a result.

```bash
az acr update --name acrshop --admin-enabled false
az acr show --name acrshop --query adminUserEnabled
```

If something genuinely needs a credential, use a scoped token instead, which is Premium only but limited to specific repositories and actions.

## Tagging

```text
Do        semantic versions, a git SHA, or both
Do not    rely on `latest` for anything deployed
```

`latest` is a mutable pointer. Two deployments of `latest` can be different images, which makes rollbacks and incident investigation unnecessarily hard.

```bash
az acr build --registry acrshop \
  --image shop-api:1.4.0 \
  --image "shop-api:$(git rev-parse --short HEAD)" .
```

Deploy the specific tag. Keep `latest` for local convenience if you like, and never reference it from a manifest.

```bash
az acr repository list --name acrshop --output table
az acr repository show-tags --name acrshop --repository shop-api \
  --orderby time_desc --output table
az acr manifest list-metadata --registry acrshop --name shop-api \
  --query "[].{Digest:digest, Tags:tags, Size:imageSize, Created:createdTime}" -o table
```

## Cleaning up

Registries grow forever unless something removes old images, and storage above the tier's included amount is charged.

```bash
# delete untagged manifests older than a week, as a dry run first
az acr run --registry acrshop --cmd \
  "acr purge --filter 'shop-api:.*' --untagged --ago 7d --dry-run" /dev/null

# then for real, on a schedule
az acr task create --name purge-old --registry acrshop \
  --cmd "acr purge --filter 'shop-api:.*' --untagged --ago 30d --keep 10" \
  --schedule "0 3 * * *" --context /dev/null
```

`--keep 10` retains the most recent ten regardless of age, which stops an aggressive purge removing everything you might need to roll back to.

**Always dry run first.** Deleted images are gone, and a bad filter removes production images that are still deployed.

```bash
az acr repository delete --name acrshop --image shop-api:0.9.0 --yes
```

## Enabling soft delete

```bash
az acr config soft-delete update --registry acrshop --status enabled --days 7
az acr repository list-deleted --name acrshop
```

Soft delete keeps removed images recoverable for a retention period. Worth enabling before running any purge task, because it turns an irreversible mistake into a recoverable one.

## Security scanning

```bash
az acr task create \
  --name build-and-scan --registry acrshop \
  --image shop-api:{{.Run.ID}} \
  --context https://github.com/contoso/shop.git#main \
  --file Dockerfile \
  --git-access-token "$GITHUB_TOKEN"
```

Microsoft Defender for Cloud scans registry images for vulnerabilities when the container plan is enabled, at push time and periodically afterwards.

Periodic rescanning matters. An image clean at push becomes vulnerable when a new CVE is published against a package it already contains, and nothing about the image changed.

## Geo-replication

```bash
az acr replication create --registry acrshop --location northeurope
az acr replication list --registry acrshop --output table
```

Premium only. Pulls come from the nearest replica, which speeds up deployments in other regions and removes a cross region dependency during an incident.

One registry, one name, several physical copies kept in sync.

## Private access

```bash
az acr update --name acrshop --public-network-enabled false

az network private-endpoint create \
  --name pe-acrshop --resource-group rg-shop-prod-uks \
  --vnet-name vnet-shop-prod-uks --subnet snet-privatelink \
  --private-connection-resource-id /subscriptions/.../registries/acrshop \
  --group-id registry --connection-name pe-acrshop-conn
```

Premium only. The private DNS zone is `privatelink.azurecr.io`, and geo-replicated registries need a data endpoint record per region.

Turning off public access breaks CI unless the build agent is inside the network, which is worth planning before you flip it.

## Base image updates

```bash
az acr task create \
  --name rebuild-on-base-update --registry acrshop \
  --image shop-api:latest \
  --context https://github.com/contoso/shop.git#main \
  --file Dockerfile \
  --base-image-trigger-enabled true \
  --git-access-token "$GITHUB_TOKEN"
```

When the base image changes, the task rebuilds. That is how a security fix in the base image reaches your application without anyone noticing the announcement.

## Quick recap

- The registry name is globally unique, alphanumeric only, and becomes `<name>.azurecr.io`.
- `az acr build` builds in Azure, so no local Docker daemon is needed.
- Disable the admin account and use `AcrPull` with a managed identity.
- Never deploy `latest`, since it is mutable and makes rollbacks unclear.
- Registries grow forever, so schedule a purge task with `--keep` and always dry run first.
- Enable soft delete before purging, so a mistake is recoverable.
- Rescanning matters, because an image becomes vulnerable when a new CVE is published, not when it changes.

<code id="code-content" class="language-bash">
# The name is GLOBALLY UNIQUE, alphanumeric only, and becomes
# acrshop.azurecr.io. Premium is what you need for private endpoints,
# geo-replication and scoped tokens.
az acr create --name acrshop --resource-group rg-shop-prod-uks --sku Standard
# BUILD IN AZURE, no local Docker daemon required:
az acr build --registry acrshop --image shop-api:1.4.0 --file Dockerfile .
# AUTHENTICATE WITHOUT PASSWORDS:
#   AcrPull    a running application       AcrPush  a build pipeline
#   AcrDelete  cleanup automation
az role assignment create --assignee-object-id "$PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal --role AcrPull \
  --scope /subscriptions/.../registries/acrshop
az aks update --name aks-shop --resource-group rg-shop-prod-uks --attach-acr acrshop
# DISABLE THE ADMIN ACCOUNT. It is a username and password with full access,
# enabled for convenience and shared as a result.
az acr update --name acrshop --admin-enabled false
# NEVER DEPLOY `latest`. It is a MUTABLE POINTER, so two deployments of it
# can be different images, which makes rollback and incident work harder.
az acr build --registry acrshop --image shop-api:1.4.0 \
  --image "shop-api:$(git rev-parse --short HEAD)" .
az acr repository show-tags --name acrshop --repository shop-api \
  --orderby time_desc --output table
# REGISTRIES GROW FOREVER. Enable SOFT DELETE FIRST, so a bad filter is
# recoverable rather than permanent:
az acr config soft-delete update --registry acrshop --status enabled --days 7
# ALWAYS DRY RUN A PURGE. A bad filter deletes images that are DEPLOYED.
az acr run --registry acrshop --cmd \
  "acr purge --filter 'shop-api:.*' --untagged --ago 7d --dry-run" /dev/null
# --keep 10 retains the most recent ten regardless of age, so an aggressive
# purge cannot remove everything you might roll back to.
az acr task create --name purge-old --registry acrshop \
  --cmd "acr purge --filter 'shop-api:.*' --untagged --ago 30d --keep 10" \
  --schedule "0 3 * * *" --context /dev/null
# RESCANNING MATTERS: an image clean at push becomes vulnerable when a NEW
# CVE is published against a package it already contains. Nothing changed
# about the image. Defender for Cloud rescans periodically.
# GEO-REPLICATION (Premium): one name, several physical copies, pulls come
# from the nearest. Faster deployments, no cross region dependency.
az acr replication create --registry acrshop --location northeurope
# PRIVATE ACCESS (Premium). Zone is privatelink.azurecr.io, and geo
# replicated registries need a data endpoint record PER REGION. Turning off
# public access BREAKS CI unless the agent is inside the network.
az acr update --name acrshop --public-network-enabled false
# REBUILD WHEN THE BASE IMAGE CHANGES, so a security fix reaches your app
# without anyone reading the announcement:
az acr task create --name rebuild-on-base-update --registry acrshop \
  --image shop-api:latest --context https://github.com/contoso/shop.git#main \
  --file Dockerfile --base-image-trigger-enabled true
</code></pre>
