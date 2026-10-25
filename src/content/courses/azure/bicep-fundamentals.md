---
publishDate: 2026-10-18T10:40
title: Bicep Fundamentals
slug: bicep-fundamentals
metadescription: Write Azure infrastructure in Bicep, with parameters, variables, resources and outputs that stay readable as they grow.
updateDate: 2026-09-07T10:40
author: ['bishal-biswas']
level: 2
tags: ['iac', 'bicep', 'azure']
course: azure
---

## A first template

```bicep
targetScope = 'resourceGroup'

@description('Environment name, used in resource names')
@allowed(['dev', 'test', 'prod'])
param environment string

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Deployment timestamp, used to force certain updates')
param deployedAt string = utcNow('yyyy-MM-dd')

var namePrefix = 'shop-${environment}'
var tags = {
  environment: environment
  application: 'shop'
  managedBy: 'bicep'
  deployedAt: deployedAt
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'plan-${namePrefix}'
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'P1v3' : 'B1'
    capacity: environment == 'prod' ? 3 : 1
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-${namePrefix}'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|8.0'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      alwaysOn: environment == 'prod'
      healthCheckPath: '/healthz'
    }
  }
}

output siteUrl string = 'https://${site.properties.defaultHostName}'
output principalId string = site.identity.principalId
```

```bash
az deployment group create \
  --resource-group rg-shop-prod-uks \
  --template-file main.bicep \
  --parameters environment=prod
```

Note `serverFarmId: plan.id`. That reference creates the dependency automatically, so no `dependsOn` is needed.

## Parameters

```bicep
@description('Shown in the portal and in az deployment what-if')
@minLength(3)
@maxLength(24)
param storageName string

@allowed(['Standard_LRS', 'Standard_ZRS', 'Standard_GZRS'])
param redundancy string = 'Standard_ZRS'

@minValue(1)
@maxValue(20)
param instanceCount int = 2

@secure()
param adminPassword string

param tags object = {}
param subnetIds array = []
```

`@secure()` keeps a value out of deployment history and logs. Use it on any password, key or token, and prefer not passing secrets at all.

`@description` is worth writing. It appears in `what-if` output and in the portal, and it is the difference between a reviewable template and a guessing exercise.

## Variables and expressions

```bicep
var namePrefix = 'shop-${environment}'
var isProduction = environment == 'prod'

var skuMap = {
  dev:  { name: 'B1',   capacity: 1 }
  test: { name: 'S1',   capacity: 1 }
  prod: { name: 'P1v3', capacity: 3 }
}

var selectedSku = skuMap[environment]

// globally unique names, deterministic for the same resource group
var storageName = 'st${uniqueString(resourceGroup().id)}'

// a merged object
var allTags = union(tags, { environment: environment })
```

The map lookup pattern is much clearer than nested ternaries once there are more than two environments.

`uniqueString` produces a deterministic hash, so the same input always gives the same name. That matters: a random name would create a new resource on every deployment.

## Referring to resources

```bicep
// something deployed elsewhere, or earlier
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: 'kv-shop-prod'
  scope: resourceGroup('rg-shared')
}

// a child resource, declared as a nested block
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: { name: redundancy }
  kind: 'StorageV2'

  resource blobService 'blobServices' = {
    name: 'default'
    properties: {
      deleteRetentionPolicy: { enabled: true, days: 30 }
      isVersioningEnabled: true
    }

    resource uploads 'containers' = {
      name: 'uploads'
      properties: { publicAccess: 'None' }
    }
  }
}

// reference a nested resource with ::
output uploadsId string = storage::blobService::uploads.id
```

The `existing` keyword is how you use a resource without managing it. No changes are made to it, and its properties become available.

## Conditions and loops

```bicep
// deploy only in production
resource insights 'Microsoft.Insights/components@2020-02-02' = if (isProduction) {
  name: 'appi-${namePrefix}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
  }
}

// one per item in an array
param subnets array = [
  { name: 'snet-app',  prefix: '10.20.1.0/24' }
  { name: 'snet-data', prefix: '10.20.2.0/24' }
]

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: 'vnet-${namePrefix}'
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.20.0.0/16'] }
    subnets: [for subnet in subnets: {
      name: subnet.name
      properties: { addressPrefix: subnet.prefix }
    }]
  }
}

// a loop producing separate resources, with an index
resource accounts 'Microsoft.Storage/storageAccounts@2023-05-01' = [for (name, i) in storageNames: {
  name: '${name}${i}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
}]

output accountIds array = [for i in range(0, length(storageNames)): accounts[i].id]
```

Note that a conditional resource cannot be referenced unconditionally. Anything using `insights.id` must also be conditional, or the deployment fails in non production.

## Role assignments

The pattern that comes up constantly, and the one with the fiddly bit.

```bicep
var blobDataContributor = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'ba92f5b4-2d11-453d-a403-e96b0029c9fe')

resource storageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, site.id, blobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: blobDataContributor
    principalId: site.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

Three things matter here:

**The name must be a GUID**, and `guid()` of the scope, principal and role produces a deterministic one. Redeploying then updates the same assignment rather than failing on a duplicate.

**`principalType: 'ServicePrincipal'`** avoids a race where a newly created identity is not yet visible to the directory lookup. Without it, deployments fail intermittently.

**Role definition IDs are GUIDs.** Look them up once and keep them in a variables file:

```bicep
var roles = {
  storageBlobDataContributor: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
  storageBlobDataReader: '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'
  keyVaultSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
  acrPull: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
}
```

## Key Vault references

```bicep
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: 'kv-shop-prod'
}

module app './modules/app.bicep' = {
  name: 'app'
  params: {
    stripeKey: keyVault.getSecret('stripe-key')
  }
}
```

`getSecret` only works when passing a parameter to a module, and the target parameter must be marked `@secure()`. The value is fetched at deployment time and never appears in output or history.

## Existing resources across scopes

```bicep
// a different resource group
resource sharedVnet 'Microsoft.Network/virtualNetworks@2023-11-01' existing = {
  name: 'vnet-hub-uks'
  scope: resourceGroup('rg-hub-uks')
}

// a different subscription
resource sharedLaw 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: 'law-central'
  scope: resourceGroup('00000000-0000-0000-0000-000000000000', 'rg-monitoring')
}
```

This is how a spoke deployment peers to a hub owned by a platform team, without managing the hub.

## Target scopes

```bicep
targetScope = 'subscription'

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-shop-prod-uks'
  location: 'uksouth'
}

module workload './modules/workload.bicep' = {
  name: 'workload'
  scope: rg
  params: { location: 'uksouth' }
}
```

```text
resourceGroup     the default
subscription      to create resource groups, or assign policy
managementGroup   policy and role definitions across subscriptions
tenant            management group creation
```

```bash
az deployment sub create --location uksouth --template-file main.bicep
```

Creating the resource group in the template is worth doing. Otherwise the first step of any deployment is a manual command nobody records.

## Linting and formatting

```bash
az bicep lint --file main.bicep
az bicep format --file main.bicep
az bicep build --file main.bicep --stdout
```

```json
{
  "analyzers": {
    "core": {
      "rules": {
        "no-hardcoded-env-urls": { "level": "error" },
        "secure-parameter-default": { "level": "error" },
        "no-unused-params": { "level": "warning" },
        "prefer-interpolation": { "level": "warning" },
        "use-recent-api-versions": { "level": "warning" }
      }
    }
  }
}
```

A `bicepconfig.json` at the repository root applies to every template. Running the linter in the pipeline catches unused parameters, hard coded endpoints and outdated API versions before review.

## What to do next

```bash
# always, before applying
az deployment group what-if --resource-group rg-shop-prod-uks --template-file main.bicep

# validate without deploying
az deployment group validate --resource-group rg-shop-prod-uks --template-file main.bicep

# see the failure detail when it goes wrong
az deployment operation group list \
  --resource-group rg-shop-prod-uks --name main \
  --query "[?properties.provisioningState=='Failed'].properties.statusMessage"
```

That last command is the one to remember. The top level error is usually generic, and the operation list holds the actual reason.

## Quick recap

- Referencing a resource property creates the dependency, so `dependsOn` is rarely needed.
- Use `@description` and decorators, since they appear in `what-if` and reviews.
- A map keyed by environment is clearer than nested ternaries.
- `uniqueString` is deterministic, so names stay stable across deployments.
- Role assignment names must be deterministic GUIDs, and `principalType` avoids an intermittent race.
- `getSecret` works only when passing to a `@secure()` module parameter.
- When a deployment fails, the operation list holds the real error, not the summary.

<code id="code-content" class="language-bicep">
targetScope = 'resourceGroup'   // or subscription, managementGroup, tenant
//
@description('Appears in what-if output and in reviews. Worth writing.')
@allowed(['dev', 'test', 'prod'])
param environment string
param location string = resourceGroup().location
//
@secure()                        // keeps it out of deployment history and logs
param adminPassword string
//
// A MAP IS CLEARER THAN NESTED TERNARIES once there are more than two.
var skuMap = {
  dev:  { name: 'B1',   capacity: 1 }
  prod: { name: 'P1v3', capacity: 3 }
}
// uniqueString is DETERMINISTIC: the same input always gives the same name.
// A random name would create a NEW RESOURCE ON EVERY DEPLOYMENT.
var storageName = 'st${uniqueString(resourceGroup().id)}'
//
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'plan-shop-${environment}'
  location: location
  sku: skuMap[environment]
  kind: 'linux'
  properties: { reserved: true }
}
//
resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-shop-${environment}'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    // THIS REFERENCE CREATES THE DEPENDENCY. No dependsOn needed.
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: { linuxFxVersion: 'DOTNETCORE|8.0', healthCheckPath: '/healthz' }
  }
}
//
// USE, DO NOT MANAGE. Works across resource groups and subscriptions, which
// is how a spoke peers to a platform team's hub.
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: 'kv-shop-prod'
  scope: resourceGroup('rg-shared')
}
//
// ROLE ASSIGNMENTS: the pattern that comes up constantly, with two traps.
var blobDataContributor = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
//
resource storageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  // 1. THE NAME MUST BE A GUID. guid() of scope, principal and role is
  //    deterministic, so redeploying UPDATES rather than failing on duplicate.
  name: guid(storage.id, site.id, blobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: blobDataContributor
    principalId: site.identity.principalId
    // 2. WITHOUT principalType, a freshly created identity may not be visible
    //    to the directory lookup yet, and deployments fail INTERMITTENTLY.
    principalType: 'ServicePrincipal'
  }
}
//
// CONDITIONS AND LOOPS. A conditional resource CANNOT be referenced
// unconditionally: anything using insights.id must also be conditional.
resource insights 'Microsoft.Insights/components@2020-02-02' = if (environment == 'prod') {
  name: 'appi-shop-prod'
  location: location
  kind: 'web'
  properties: { Application_Type: 'web' }
}
resource accounts 'Microsoft.Storage/storageAccounts@2023-05-01' = [for (name, i) in names: {
  name: '${name}${i}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
}]
//
output siteUrl string = 'https://${site.properties.defaultHostName}'
//
// ALWAYS: az deployment group what-if --resource-group rg-... --template-file main.bicep
// WHEN IT FAILS, the top level error is generic. THIS holds the real reason:
//   az deployment operation group list --resource-group rg-... --name main \
//     --query "[?properties.provisioningState=='Failed'].properties.statusMessage"
</code></pre>
