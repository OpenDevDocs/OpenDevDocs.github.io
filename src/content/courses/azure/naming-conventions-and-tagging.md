---
publishDate: 2026-10-02T06:25
title: Naming Conventions and Tagging
slug: naming-conventions-and-tagging
metadescription: Adopt a naming scheme that survives growth, and use tags so cost, ownership and automation actually work.
updateDate: 2026-09-07T06:25
author: ['bishal-biswas']
level: 1
tags: ['governance', 'naming', 'tags']
course: azure
---

## Why naming matters more in the cloud

On a server you can rename things. In Azure, most resource names are **immutable**. A storage account called `storagetest2final` is called that forever, or until someone migrates the data.

Multiply that by a few hundred resources and a few years, and a bad convention becomes a permanent tax on everyone reading the estate.

## A workable pattern

Microsoft's Cloud Adoption Framework suggests:

```text
<resource-type>-<workload>-<environment>-<region>-<instance>
```

```text
rg-shop-prod-uks
vnet-shop-prod-uks
app-shop-api-prod-uks
sql-shop-prod-uks
kv-shop-prod-uks
st shop prod uks       storage has no hyphens, see below
```

The abbreviations are conventional:

```text
rg    resource group        app   app service
vnet  virtual network       func  function app
snet  subnet                sql   sql server
nsg   network security group  cosmos  cosmos db
kv    key vault             st    storage account
ca    container app         acr   container registry
aks   kubernetes service    log   log analytics workspace
```

The specific scheme matters far less than **having one and applying it consistently.**

## The constraints that break schemes

Every resource type has its own rules, and they differ enough to be annoying.

```text
Storage account    3-24 chars, lowercase letters and numbers ONLY, globally unique
Key Vault          3-24 chars, alphanumeric and hyphens, globally unique
App Service        2-60 chars, alphanumeric and hyphens, globally unique
Resource group     1-90 chars, quite permissive, unique in the subscription
SQL Server         1-63 chars, lowercase, globally unique
Container Registry 5-50 chars, alphanumeric only, globally unique
```

Two things bite repeatedly.

**Global uniqueness.** Anything with a public DNS name competes with every other Azure customer. `stshop` was taken years ago.

**No hyphens in storage accounts or container registries.** Your beautiful hyphenated scheme does not apply, so you need a variant.

```bash
az storage account check-name --name stshopproduks
az webapp list --query "[?name=='shop-api']" --output tsv
```

Check before you script a deployment, not during it.

## Handling uniqueness

For globally unique names, append a deterministic suffix rather than a random one.

```bicep
param workload string = 'shop'
param environment string = 'prod'

var suffix = uniqueString(resourceGroup().id)

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'st${workload}${environment}${suffix}'
  location: resourceGroup().location
  sku: { name: 'Standard_ZRS' }
  kind: 'StorageV2'
}
```

`uniqueString` produces a stable 13 character hash from its inputs. The same resource group always produces the same suffix, so redeploying does not create a second storage account.

Using `newGuid()` or a random number instead means every deployment creates new resources, which is a memorable mistake.

## Environments in the name

```text
dev    development
test   or tst
stg    staging, or uat
prod   production
```

Keep them short and never abbreviate production to `p`. Somebody will misread it, and it will be the day they run a delete.

Some teams put the environment first so sorting groups by environment. Either works. Pick one.

## Tags

Names identify a resource. Tags describe it. Tags are how cost reporting, automation and ownership actually function.

```bash
az group create --name rg-shop-prod-uks --location uksouth \
  --tags environment=production \
         workload=shop \
         owner=platform-team \
         costCentre=CC1234 \
         dataClassification=confidential
```

A tag set worth standardising on:

```text
environment          production, staging, development
workload             which application this belongs to
owner                a team, not a person who will leave
costCentre           for chargeback
dataClassification   public, internal, confidential
managedBy            terraform, bicep, manual
expiresOn            for temporary resources
```

`owner` should be a team or a distribution list. Naming an individual guarantees an orphaned resource within two years.

`managedBy` is underrated. It tells the next person whether editing this in the portal will be silently reverted by the next deployment.

`expiresOn` lets you build automation that finds and reports expired experiments, which is where a surprising amount of cloud spend hides.

## Tags do not inherit

The thing everyone assumes and is wrong about: **resources do not inherit tags from their resource group.**

```bash
az group create --name rg-shop-prod-uks --location uksouth --tags environment=production
az webapp create --name shop-api --resource-group rg-shop-prod-uks --plan plan-shop
az webapp show --name shop-api --resource-group rg-shop-prod-uks --query tags
# null
```

Azure Policy can enforce inheritance, and this is one of the most useful policies to have.

```bash
az policy assignment create \
  --name inherit-environment-tag \
  --policy "cd3aa116-8754-49c9-a813-ad46512ece54" \
  --resource-group rg-shop-prod-uks \
  --params '{"tagName":{"value":"environment"}}' \
  --mi-system-assigned --location uksouth
```

That built in policy modifies resources to inherit a tag from their resource group. Combined with a policy that **requires** the tag, cost reporting becomes reliable rather than aspirational.

## Enforcing a convention

Three levels, increasing in strength.

**Documentation.** A page nobody reads. Better than nothing, barely.

**Templates.** If everything is deployed from Bicep with names constructed from parameters, the convention is automatic.

```bicep
param workload string
param environment string
param location string = resourceGroup().location

var regionCode = {
  uksouth: 'uks'
  ukwest: 'ukw'
  westeurope: 'weu'
}[location]

var namePrefix = '${workload}-${environment}-${regionCode}'
```

**Policy.** Deny anything that does not match.

```bash
az policy definition create --name require-naming-pattern \
  --rules '{
    "if": {
      "allOf": [
        { "field": "type", "equals": "Microsoft.Web/sites" },
        { "field": "name", "notLike": "app-*-????-???" }
      ]
    },
    "then": { "effect": "deny" }
  }' --mode Indexed
```

Policy is the only one that actually stops a determined person clicking through the portal. Use it for the rules that genuinely matter, and templates for the rest.

## Finding what is untagged

```bash
az graph query -q "
Resources
| where isnull(tags.owner) or tags.owner == ''
| project name, type, resourceGroup, subscriptionId
| order by type asc
" --output table
```

Run this occasionally. Untagged resources are the ones nobody can attribute cost to and nobody is willing to delete, which is how estates accumulate.

## Quick recap

- Most Azure resource names are immutable, so a bad convention is permanent.
- Use a consistent pattern, and accept that storage and registry names break it.
- Anything with a public DNS name must be globally unique across all of Azure.
- Use `uniqueString` for a deterministic suffix, never a random one.
- Tags drive cost reporting, ownership and automation, so standardise a small set.
- Tags do **not** inherit from a resource group, but a policy can make them.
- Set `owner` to a team, and use `managedBy` so people know what is deployed from code.

<code id="code-content" class="language-bash">
# Most Azure resource names are IMMUTABLE. A bad convention is permanent.
#   &lt;type&gt;-&lt;workload&gt;-&lt;environment&gt;-&lt;region&gt;-&lt;instance&gt;
#   rg-shop-prod-uks   vnet-shop-prod-uks   app-shop-api-prod-uks   kv-shop-prod-uks
# THE CONSTRAINTS THAT BREAK SCHEMES:
#   storage account     3-24 chars, LOWERCASE ALPHANUMERIC ONLY, globally unique
#   container registry  5-50 chars, alphanumeric only, globally unique
#   key vault           3-24 chars, globally unique
#   app service         2-60 chars, globally unique (it is a public DNS name)
# So "stshopproduks" has no hyphens, and your scheme needs a variant.
# CHECK before scripting a deployment, not during it
az storage account check-name --name stshopproduks
# For globally unique names use a DETERMINISTIC suffix. In Bicep:
#   var suffix = uniqueString(resourceGroup().id)     stable across deployments
#   name: 'st${workload}${environment}${suffix}'
# Using newGuid() or a random number creates NEW resources on every
# deployment, which is a memorable mistake.
# TAGS drive cost reporting, ownership and automation. Standardise a small set.
az group create --name rg-shop-prod-uks --location uksouth \
  --tags environment=production workload=shop owner=platform-team \
         costCentre=CC1234 dataClassification=confidential \
         managedBy=bicep expiresOn=2027-01-01
# owner should be a TEAM. Naming an individual guarantees an orphaned
# resource within two years.
# managedBy tells the next person whether their portal edit will be
# silently reverted by the next deployment.
# TAGS DO NOT INHERIT from the resource group. Everyone assumes they do.
az webapp show --name shop-api --resource-group rg-shop-prod-uks --query tags
# -&gt; null, even though the resource group is tagged
# Azure Policy can enforce inheritance, and this is one of the most useful
# policies to have. Combine "inherit" with "require" and cost reporting
# becomes reliable rather than aspirational.
az policy assignment create --name inherit-environment-tag \
  --policy "cd3aa116-8754-49c9-a813-ad46512ece54" \
  --resource-group rg-shop-prod-uks \
  --params '{"tagName":{"value":"environment"}}' \
  --mi-system-assigned --location uksouth
# Find what nobody owns. These are the resources nobody can attribute cost
# to and nobody is willing to delete, which is how estates accumulate.
az graph query -q "Resources
| where isnull(tags.owner) or tags.owner == ''
| project name, type, resourceGroup
| order by type asc" --output table
</code></pre>
