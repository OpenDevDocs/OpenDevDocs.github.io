---
publishDate: 2026-10-08T08:05
title: App Service Configuration and Scaling
slug: app-service-configuration-and-scaling
metadescription: Configure App Service settings and connection strings correctly, and scale up or out with rules that match real traffic.
updateDate: 2026-09-07T08:05
author: ['bishal-biswas']
level: 2
tags: ['compute', 'app service', 'scaling']
course: azure
---

## App settings are environment variables

```bash
az webapp config appsettings set \
  --name shop-api --resource-group rg-shop-prod-uks \
  --settings ASPNETCORE_ENVIRONMENT=Production \
             Features__NewCheckout=true \
             Payments__TimeoutSeconds=30
```

They arrive in the process as environment variables and override anything in `appsettings.json`. Double underscore maps to nesting, so `Payments__TimeoutSeconds` becomes `Payments:TimeoutSeconds` in .NET configuration.

```bash
az webapp config appsettings list --name shop-api --resource-group rg-shop-prod-uks \
  --query "[].{Name:name, Slot:slotSetting}" --output table

az webapp config appsettings delete --name shop-api \
  --resource-group rg-shop-prod-uks --setting-names OldFlag
```

**Changing a setting restarts the app.** Several changes in one command means one restart, so batch them.

## Reference Key Vault, do not paste secrets

```bash
az webapp config appsettings set \
  --name shop-api --resource-group rg-shop-prod-uks \
  --settings "StripeKey=@Microsoft.KeyVault(SecretUri=https://kv-shop-prod.vault.azure.net/secrets/stripe-key/)"
```

The app reads it as an ordinary environment variable, and the actual value never appears in App Service configuration, in a template, or in anyone's terminal history.

The app needs a managed identity with `Key Vault Secrets User`:

```bash
PRINCIPAL_ID=$(az webapp identity assign --name shop-api \
  --resource-group rg-shop-prod-uks --query principalId -o tsv)

az role assignment create --assignee-object-id "$PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" \
  --scope /subscriptions/.../vaults/kv-shop-prod
```

Omit the version at the end of the URI and the app picks up rotations without a redeploy, at the next restart.

```bash
az webapp config appsettings list --name shop-api --resource-group rg-shop-prod-uks \
  --query "[?contains(value, 'KeyVault')].name" --output tsv
```

If a Key Vault reference fails to resolve, the setting arrives as the literal string. That produces a confusing failure deep in the app, so check the resolution status in the portal when a secret looks wrong.

## Connection strings

```bash
az webapp config connection-string set \
  --name shop-api --resource-group rg-shop-prod-uks \
  --connection-string-type SQLAzure \
  --settings Db="Server=sql-shop.database.windows.net;Database=shop;Authentication=Active Directory Default;"
```

A separate section from app settings, with a type. In .NET they appear prefixed, so `Db` becomes `SQLAZURECONNSTR_Db`, and the configuration system maps it back to `ConnectionStrings:Db`.

Better still, use a managed identity as above and store no credential at all.

## General configuration

```bash
az webapp config set --name shop-api --resource-group rg-shop-prod-uks \
  --always-on true \
  --http20-enabled true \
  --min-tls-version 1.2 \
  --ftps-state Disabled \
  --web-sockets-enabled false \
  --health-check-path /healthz
```

```text
always-on          keeps the app warm. Off means it unloads after 20 minutes idle.
health-check-path  unhealthy instances are removed from rotation
ftps-state         disable it, nothing should be using FTP
min-tls-version    1.2 minimum, and 1.3 where supported
```

The health check path is more useful than it looks. With several instances, App Service stops routing to one that fails the check and eventually replaces it.

## Scale up and scale out

```text
Scale up   a bigger plan. More CPU and memory per instance.
Scale out  more instances of the same size.
```

```bash
az appservice plan update --name plan-shop --resource-group rg-shop-prod-uks --sku P2v3
az appservice plan update --name plan-shop --resource-group rg-shop-prod-uks --number-of-workers 4
```

Scale out for throughput, scale up for a single request that needs more memory or CPU. A slow endpoint doing heavy work is a scale up problem; too many requests is a scale out problem.

## Autoscale rules

```bash
az monitor autoscale create \
  --resource-group rg-shop-prod-uks --name autoscale-shop \
  --resource plan-shop --resource-type Microsoft.Web/serverfarms \
  --min-count 2 --max-count 10 --count 2

az monitor autoscale rule create \
  --resource-group rg-shop-prod-uks --autoscale-name autoscale-shop \
  --condition "CpuPercentage > 70 avg 5m" --scale out 2 --cooldown 5

az monitor autoscale rule create \
  --resource-group rg-shop-prod-uks --autoscale-name autoscale-shop \
  --condition "CpuPercentage < 30 avg 10m" --scale in 1 --cooldown 10
```

Four things make autoscale rules work:

**Minimum of two.** One instance means a restart is an outage, and no SLA.

**Out faster than in.** Add two, remove one. Long windows for scale in.

**Cooldown.** Without it, rules fire repeatedly while metrics catch up and instances flap.

**Right metric.** CPU is the default and often wrong. A queue backed worker should scale on queue length, and a memory bound app on memory.

```bash
az monitor autoscale rule create \
  --resource-group rg-shop-prod-uks --autoscale-name autoscale-shop \
  --condition "HttpQueueLength > 25 avg 5m" --scale out 2
```

`HttpQueueLength` is a good signal for a web app: requests are waiting, whatever the CPU says.

## Scheduled scaling

```bash
az monitor autoscale profile create \
  --resource-group rg-shop-prod-uks --autoscale-name autoscale-shop \
  --name business-hours --min-count 4 --max-count 20 --count 4 \
  --recurrence week mon tue wed thu fri --start 07:00 --end 19:00 --timezone "GMT Standard Time"
```

If traffic is predictable, scheduled profiles beat reactive rules. Reactive scaling always lags, because it waits for the metric to move before adding capacity, and by then some users have already waited.

A known Monday morning peak should be met with capacity already in place.

## Zone redundancy

```bash
az appservice plan create --name plan-shop --resource-group rg-shop-prod-uks \
  --sku P1v3 --is-linux --zone-redundant --number-of-workers 3
```

Premium v3 supports zone redundancy, spreading instances across availability zones. A minimum of three instances is required, and it must be set at creation.

## Watching cost

```text
The plan bills whether traffic exists or not
Scaling out multiplies that
Slots share the plan, so they add load but not a separate bill
Dev and test plans should be small, or on a schedule
```

```bash
az monitor metrics list --resource /subscriptions/.../serverfarms/plan-shop \
  --metric CpuPercentage MemoryPercentage \
  --start-time 2026-09-01T00:00:00Z --interval PT1H --output table
```

A plan sitting at 15 percent CPU is oversized. Look at a week of data before choosing a size, since a single day misleads.

## Quick recap

- App settings are environment variables and override the config file, and changing one restarts the app.
- Reference Key Vault rather than storing secrets, and omit the version to pick up rotations.
- Scale out for throughput, scale up for a single heavy request.
- Keep a minimum of two instances, or a restart is an outage.
- Scale out faster than you scale in, and always set a cooldown.
- CPU is often the wrong metric, and `HttpQueueLength` is a better web signal.
- Scheduled profiles beat reactive rules for predictable traffic, since reactive scaling always lags.

<code id="code-content" class="language-bash">
# APP SETTINGS ARE ENVIRONMENT VARIABLES and override appsettings.json.
# Double underscore maps to nesting: Payments__TimeoutSeconds becomes
# Payments:TimeoutSeconds in .NET.
az webapp config appsettings set --name shop-api --resource-group rg-shop-prod-uks \
  --settings ASPNETCORE_ENVIRONMENT=Production Features__NewCheckout=true
# CHANGING A SETTING RESTARTS THE APP. Batch them into one command.
# NEVER PASTE A SECRET. Reference Key Vault, and the real value never
# appears in configuration, a template, or anyone's terminal history.
az webapp config appsettings set --name shop-api --resource-group rg-shop-prod-uks \
  --settings "StripeKey=@Microsoft.KeyVault(SecretUri=https://kv-shop-prod.vault.azure.net/secrets/stripe-key/)"
# OMIT THE VERSION at the end and rotations are picked up on restart.
# The app needs a managed identity with Key Vault Secrets User. If the
# reference FAILS to resolve, the setting arrives as the LITERAL STRING,
# which fails confusingly deep inside the app.
az webapp config set --name shop-api --resource-group rg-shop-prod-uks \
  --always-on true --http20-enabled true --min-tls-version 1.2 \
  --ftps-state Disabled --health-check-path /healthz
# health-check-path does real work: a failing instance is removed from
# rotation and eventually replaced.
# SCALE UP = a bigger plan (one heavy request). SCALE OUT = more instances
# (too many requests). Different problems.
az appservice plan update --name plan-shop --resource-group rg-shop-prod-uks --sku P2v3
az appservice plan update --name plan-shop --resource-group rg-shop-prod-uks --number-of-workers 4
# FOUR THINGS MAKE AUTOSCALE WORK:
#   1. MINIMUM OF TWO. One instance means a restart is an outage.
#   2. OUT FASTER THAN IN. Add two, remove one.
#   3. COOLDOWN, or rules fire repeatedly and instances flap.
#   4. THE RIGHT METRIC. CPU is the default and often wrong.
az monitor autoscale rule create --resource-group rg-shop-prod-uks \
  --autoscale-name autoscale-shop --condition "CpuPercentage &gt; 70 avg 5m" \
  --scale out 2 --cooldown 5
# HttpQueueLength is a better web signal: requests ARE waiting, whatever
# the CPU says.
az monitor autoscale rule create --resource-group rg-shop-prod-uks \
  --autoscale-name autoscale-shop --condition "HttpQueueLength &gt; 25 avg 5m" --scale out 2
# FOR PREDICTABLE TRAFFIC, SCHEDULE IT. Reactive scaling always LAGS: it
# waits for the metric to move, and by then users have already waited.
az monitor autoscale profile create --resource-group rg-shop-prod-uks \
  --autoscale-name autoscale-shop --name business-hours \
  --min-count 4 --max-count 20 --count 4 \
  --recurrence week mon tue wed thu fri --start 07:00 --end 19:00 \
  --timezone "GMT Standard Time"
# Look at a WEEK of data before sizing. A plan at 15% CPU is oversized.
az monitor metrics list --resource /subscriptions/.../serverfarms/plan-shop \
  --metric CpuPercentage MemoryPercentage --interval PT1H --output table
</code></pre>
