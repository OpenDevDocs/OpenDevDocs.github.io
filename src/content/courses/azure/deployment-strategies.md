---
publishDate: 2026-10-22T11:40
title: 'Deployment Strategies: Slots, Blue Green and Canary'
slug: deployment-strategies
metadescription: Release safely on Azure with deployment slots, blue green deployment and canary releases, and know what each protects against.
updateDate: 2026-09-07T11:40
author: ['bishal-biswas']
level: 3
tags: ['devops', 'deployment', 'releases']
course: azure
---

## What each strategy protects against

```text
Recreate      nothing. Stop the old, start the new, accept downtime.
Rolling       partial failure. Replace instances gradually.
Blue green    a bad release. Two environments, switch, switch back.
Canary        a bad release affecting everyone. A small share sees it first.
Feature flags a bad feature. Code deployed, behaviour toggled separately.
```

They are not alternatives. A mature setup uses blue green for infrastructure changes, canary for risky releases, and feature flags for behaviour, all at once.

## Deployment slots

The simplest blue green on Azure, and the reason to be on App Service Standard or above.

```bash
az webapp deployment slot create \
  --name app-shop --resource-group rg-shop-prod-uks --slot staging

az webapp deploy --name app-shop --resource-group rg-shop-prod-uks \
  --slot staging --src-path ./publish.zip --type zip

# verify before touching production
curl -f https://app-shop-staging.azurewebsites.net/healthz

az webapp deployment slot swap \
  --name app-shop --resource-group rg-shop-prod-uks \
  --slot staging --target-slot production
```

**The swap warms the staging instance before completing**, so production traffic never hits a cold start. That alone makes it better than deploying directly.

Rollback is another swap, taking seconds, because the previous version is now sitting in staging.

```bash
az webapp config appsettings set --name app-shop --resource-group rg-shop-prod-uks \
  --settings WEBSITE_SWAP_WARMUP_PING_PATH=/healthz \
             WEBSITE_SWAP_WARMUP_PING_STATUSES=200
```

Point the warm up at a real health endpoint, and the swap will not complete until the application is genuinely ready.

## Traffic splitting for a canary

```bash
az webapp traffic-routing set \
  --name app-shop --resource-group rg-shop-prod-uks \
  --distribution staging=10
```

Ten percent to the new version. Watch error rates and latency, increase gradually, then swap.

```bash
az webapp traffic-routing set --name app-shop --resource-group rg-shop-prod-uks \
  --distribution staging=50
az webapp traffic-routing clear --name app-shop --resource-group rg-shop-prod-uks
```

Note App Service uses a cookie to keep a user on the same version, so a person does not flip between old and new between requests.

## Container Apps revisions

```bash
az containerapp revision set-mode --name shop-api \
  --resource-group rg-shop-prod-uks --mode multiple

az containerapp update --name shop-api --resource-group rg-shop-prod-uks \
  --image acrshop.azurecr.io/shop-api:1.5.0 --revision-suffix v150

az containerapp ingress traffic set --name shop-api \
  --resource-group rg-shop-prod-uks \
  --revision-weight shop-api--v140=90 shop-api--v150=10
```

Revisions run side by side and traffic weights are a single command, so canary and rollback are both instant.

```bash
# promote
az containerapp ingress traffic set --name shop-api \
  --resource-group rg-shop-prod-uks --revision-weight shop-api--v150=100

# roll back
az containerapp ingress traffic set --name shop-api \
  --resource-group rg-shop-prod-uks --revision-weight shop-api--v140=100
```

## Kubernetes rolling updates

```yaml
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2
      maxUnavailable: 0
  minReadySeconds: 15
```

```text
maxSurge         extra pods allowed above the desired count
maxUnavailable   pods allowed to be missing. ZERO for production.
minReadySeconds  how long a pod must be ready before it counts
```

`maxUnavailable: 0` with `maxSurge: 2` means capacity never drops during a rollout. New pods start, become ready, then old pods are removed.

```bash
kubectl rollout status deployment/shop-api --timeout=5m
kubectl rollout undo deployment/shop-api
kubectl rollout history deployment/shop-api
```

**`minReadySeconds` is underused.** Without it, a pod that passes its readiness probe and crashes two seconds later still counts as successful, and the rollout continues replacing healthy pods with broken ones.

## Front Door for regional blue green

```bash
az afd origin update \
  --profile-name afd-shop --resource-group rg-shop-global \
  --origin-group-name og-shop --origin-name blue --weight 900

az afd origin update \
  --profile-name afd-shop --resource-group rg-shop-global \
  --origin-group-name og-shop --origin-name green --weight 100
```

Weights across origins give a canary at the global edge, which is how you shift traffic between whole regions or whole deployments rather than between instances.

## Database changes are the hard part

Application rollback is easy. Database rollback usually is not, and this is where most deployment strategies actually fail.

The technique is **expand and contract**:

```sql
-- release 1: expand. Add the new column, nullable, and keep writing the old one.
ALTER TABLE Customers ADD FullName NVARCHAR(200) NULL;

-- release 2: backfill and dual write in the application
UPDATE Customers SET FullName = FirstName + ' ' + LastName WHERE FullName IS NULL;

-- release 3: read from the new column only

-- release 4: contract. Remove the old columns, once nothing reads them.
ALTER TABLE Customers DROP COLUMN FirstName, LastName;
```

Each step is backward compatible, so the previous application version keeps working. That is what makes a rollback possible at all.

```text
Safe in one release      adding a nullable column, adding a table, adding an index
Needs several releases   renaming, changing a type, dropping anything
Never in a deployment    a migration that locks a large table during peak hours
```

**Deploy the migration before the code that needs it**, never with it. If the code deploys first and the migration fails, the application is broken with no clean way back.

## Feature flags

```bash
az appconfig create --name appcs-shop --resource-group rg-shop-prod-uks \
  --location uksouth --sku Standard

az appconfig feature set --name appcs-shop \
  --feature NewCheckout --label production

az appconfig feature filter add --name appcs-shop \
  --feature NewCheckout --filter-name Microsoft.Percentage \
  --filter-parameters Value=10
```

```csharp
builder.Configuration.AddAzureAppConfiguration(options =>
{
    options.Connect(new Uri(endpoint), new DefaultAzureCredential())
           .UseFeatureFlags(flags =>
           {
               flags.SetRefreshInterval(TimeSpan.FromSeconds(30));
           });
});

builder.Services.AddFeatureManagement();
```

```csharp
if (await _features.IsEnabledAsync("NewCheckout"))
{
    return await _newCheckout.ProcessAsync(basket);
}

return await _legacyCheckout.ProcessAsync(basket);
```

Feature flags separate **deployment from release**. Code goes to production disabled, and is turned on when ready, for a percentage of users, without another deployment.

Turning a feature off is faster than any rollback, because nothing is redeployed.

The cost is complexity: two code paths, and flags that are never removed. Treat a flag as temporary, with a date, and delete it once the feature is established.

## Verifying automatically

```bash
- name: Smoke test
  run: |
    for i in $(seq 1 20); do
      code=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_URL/healthz")
      if [ "$code" = "200" ]; then break; fi
      sleep 10
    done
    [ "$code" = "200" ] || { echo "Never became healthy"; exit 1; }

    curl -f "$STAGING_URL/api/products?take=1" > /dev/null
    curl -f "$STAGING_URL/api/version" | grep -q "$EXPECTED_VERSION"
```

```kusto
requests
| where timestamp > ago(15m)
| extend version = tostring(customDimensions.Version)
| summarize
    total = count(),
    failures = countif(success == false),
    p95 = percentile(duration, 95)
  by version
```

Comparing the new version against the old in the same query is how you decide whether to continue a canary. A failure rate or latency noticeably worse than the previous version is the signal to stop.

## An automatic rollback

```yaml
      - name: Deploy and swap
        id: swap
        run: |
          az webapp deployment slot swap --name app-shop \
            --resource-group rg-shop-prod-uks --slot staging --target-slot production

      - name: Verify production
        id: verify
        run: ./scripts/verify-production.sh

      - name: Roll back on failure
        if: failure() && steps.swap.outcome == 'success'
        run: |
          az webapp deployment slot swap --name app-shop \
            --resource-group rg-shop-prod-uks --slot staging --target-slot production
          echo "Rolled back automatically"
```

An automatic rollback on a failed verification means a bad release lasts a minute rather than until someone notices. This is worth building once.

## Quick recap

- Slots give blue green with a warm up, so releases have no cold start and rollback is a swap.
- Traffic routing on App Service and revision weights on Container Apps both give instant canaries.
- Use `maxUnavailable: 0` and set `minReadySeconds`, or a crashing pod still counts as successful.
- Database changes are the hard part, and expand and contract is what makes rollback possible.
- Deploy migrations before the code that needs them, never together.
- Feature flags separate deployment from release, and turning one off beats any rollback.
- Automate verification and automatic rollback, so a bad release lasts a minute.

<code id="code-content" class="language-bash">
# WHAT EACH ONE PROTECTS AGAINST:
#   recreate      nothing. Downtime.
#   rolling       partial failure, by replacing gradually
#   blue green    a bad release: two environments, switch, switch back
#   canary        a bad release reaching EVERYONE
#   feature flags a bad FEATURE, toggled without redeploying
# They are NOT alternatives. A mature setup uses all of them.
# SLOTS ARE BLUE GREEN, and THE SWAP WARMS THE INSTANCE FIRST, so
# production traffic never hits a cold start. Rollback is another swap.
az webapp deploy --name app-shop --resource-group rg-shop-prod-uks \
  --slot staging --src-path ./publish.zip --type zip
curl -f https://app-shop-staging.azurewebsites.net/healthz   # verify FIRST
az webapp deployment slot swap --name app-shop \
  --resource-group rg-shop-prod-uks --slot staging --target-slot production
# CANARY, two ways, both a single command:
az webapp traffic-routing set --name app-shop \
  --resource-group rg-shop-prod-uks --distribution staging=10
az containerapp ingress traffic set --name shop-api \
  --resource-group rg-shop-prod-uks \
  --revision-weight shop-api--v140=90 shop-api--v150=10
# KUBERNETES: maxUnavailable 0 with maxSurge 2 means CAPACITY NEVER DROPS.
# minReadySeconds IS UNDERUSED: without it, a pod that passes readiness and
# CRASHES TWO SECONDS LATER still counts as successful, and the rollout
# keeps replacing healthy pods with broken ones.
#   strategy: { rollingUpdate: { maxSurge: 2, maxUnavailable: 0 } }
#   minReadySeconds: 15
kubectl rollout status deployment/shop-api --timeout=5m
kubectl rollout undo deployment/shop-api
# DATABASE CHANGES ARE THE HARD PART, and where most strategies actually
# fail. EXPAND AND CONTRACT keeps every step backward compatible, which is
# what makes rollback possible at all:
#   1. ALTER TABLE Customers ADD FullName NVARCHAR(200) NULL;   (expand)
#   2. backfill, and dual write from the application
#   3. read from the new column only
#   4. ALTER TABLE Customers DROP COLUMN FirstName, LastName;   (contract)
# DEPLOY THE MIGRATION BEFORE THE CODE THAT NEEDS IT, never together. Code
# first plus a failed migration is a broken application with no way back.
# FEATURE FLAGS SEPARATE DEPLOYMENT FROM RELEASE. Code ships disabled and is
# turned on for a percentage of users WITHOUT ANOTHER DEPLOYMENT. Turning
# one off is FASTER THAN ANY ROLLBACK, because nothing is redeployed.
az appconfig feature filter add --name appcs-shop --feature NewCheckout \
  --filter-name Microsoft.Percentage --filter-parameters Value=10
# The cost is two code paths and flags nobody removes. Give each one a date.
# DECIDE WHETHER TO CONTINUE A CANARY BY COMPARING VERSIONS IN ONE QUERY:
#   requests | extend version = tostring(customDimensions.Version)
#   | summarize total=count(), failures=countif(success==false),
#               p95=percentile(duration, 95) by version
# AUTOMATIC ROLLBACK ON FAILED VERIFICATION means a bad release lasts a
# MINUTE rather than until someone notices. Worth building once:
#   - if: failure() &amp;&amp; steps.swap.outcome == 'success'
#     run: az webapp deployment slot swap ...   # swap straight back
</code></pre>
