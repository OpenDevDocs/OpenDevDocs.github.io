---
publishDate: 2026-10-19T10:45
title: Bicep Modules and Parameter Files
slug: bicep-modules-and-parameters
metadescription: Structure Bicep with modules and parameter files so a growing estate stays maintainable across environments.
updateDate: 2026-09-07T10:45
author: ['bishal-biswas']
level: 3
tags: ['iac', 'bicep', 'modules']
course: azure
---

## When to split

Start with one file. Split when it stops fitting in your head, usually somewhere past two hundred lines or when the same block appears twice.

```text
infra/
  main.bicep
  main.bicepparam
  dev.bicepparam
  prod.bicepparam
  modules/
    network.bicep
    storage.bicep
    app-service.bicep
    sql.bicep
    monitoring.bicep
  shared/
    roles.bicep
    naming.bicep
```

Premature modularisation makes a small deployment harder to follow. Splitting a file nobody can read makes it easier.

## A module

A module is just a Bicep file with parameters and outputs.

```bicep
// modules/storage.bicep
@description('Storage account name, globally unique')
@minLength(3)
@maxLength(24)
param name string

param location string
param tags object = {}

@allowed(['Standard_LRS', 'Standard_ZRS', 'Standard_GZRS'])
param redundancy string = 'Standard_ZRS'

param containers array = []

@description('Principals granted Storage Blob Data Contributor')
param contributorPrincipalIds array = []

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: name
  location: location
  tags: tags
  sku: { name: redundancy }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    supportsHttpsTrafficOnly: true
    publicNetworkAccess: 'Disabled'
  }

  resource blobService 'blobServices' = {
    name: 'default'
    properties: {
      deleteRetentionPolicy: { enabled: true, days: 30 }
      isVersioningEnabled: true
    }
  }
}

resource containerResources 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = [for container in containers: {
  parent: storage::blobService
  name: container
  properties: { publicAccess: 'None' }
}]

var blobDataContributor = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'ba92f5b4-2d11-453d-a403-e96b0029c9fe')

resource roleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for principalId in contributorPrincipalIds: {
  name: guid(storage.id, principalId, blobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: blobDataContributor
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}]

output id string = storage.id
output name string = storage.name
output blobEndpoint string = storage.properties.primaryEndpoints.blob
```

Notice the module bakes in the security defaults. Every storage account deployed through it has shared key access disabled and public access off, and nobody has to remember.

That is the real value of modules: **encoding decisions once**.

## Using it

```bicep
// main.bicep
module storage './modules/storage.bicep' = {
  name: 'storage-deployment'
  params: {
    name: 'st${uniqueString(resourceGroup().id)}'
    location: location
    tags: tags
    redundancy: environment == 'prod' ? 'Standard_GZRS' : 'Standard_LRS'
    containers: ['uploads', 'exports']
    contributorPrincipalIds: [app.outputs.principalId]
  }
}

output blobEndpoint string = storage.outputs.blobEndpoint
```

The `name` on the module is the **deployment name**, visible in deployment history, and it must be unique within the deployment. In a loop it needs an index:

```bicep
module tenantStorage './modules/storage.bicep' = [for (tenant, i) in tenants: {
  name: 'storage-${tenant.name}-${i}'
  params: {
    name: 'st${tenant.name}${uniqueString(resourceGroup().id)}'
    location: location
  }
}]
```

## Modules at other scopes

```bicep
targetScope = 'subscription'

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-shop-${environment}-uks'
  location: location
}

module network './modules/network.bicep' = {
  name: 'network'
  scope: rg
  params: { location: location }
}

module hubPeering './modules/peering.bicep' = {
  name: 'hub-peering'
  scope: resourceGroup('rg-hub-uks')
  params: {
    spokeVnetId: network.outputs.vnetId
  }
}
```

A module can deploy into a different resource group or subscription than the parent template. That is how a spoke deployment creates its half of a peering in the hub's resource group.

## Bicep parameter files

`.bicepparam` replaced JSON parameter files and is much better.

```bicep
// prod.bicepparam
using './main.bicep'

param environment = 'prod'
param location = 'uksouth'
param addressSpace = '10.20.0.0/16'
param enableGeoReplication = true

param subnets = [
  { name: 'snet-app',         prefix: '10.20.1.0/24' }
  { name: 'snet-data',        prefix: '10.20.2.0/24' }
  { name: 'snet-privatelink', prefix: '10.20.3.0/24' }
]

// read from the environment at compile time, for pipeline supplied values
param adminObjectId = readEnvironmentVariable('ADMIN_OBJECT_ID')
```

```bash
az deployment group create \
  --resource-group rg-shop-prod-uks \
  --parameters prod.bicepparam
```

`using` binds the file to a template, so the tooling type checks parameters and completes names. A typo is an error before deployment rather than after.

The template path comes from the file, so `--template-file` is not needed.

## Sharing values between environments

```bicep
// shared/naming.bicep
param environment string
param workload string
param region string

var regionShort = {
  uksouth: 'uks'
  northeurope: 'neu'
  westeurope: 'weu'
}[region]

output resourceGroup string = 'rg-${workload}-${environment}-${regionShort}'
output appService string = 'app-${workload}-${environment}-${regionShort}'
output keyVault string = 'kv-${workload}-${environment}-${regionShort}'
output storage string = 'st${workload}${environment}${regionShort}'
```

A naming module means the convention lives in one place. When it changes, it changes once.

## User defined types

```bicep
@export()
type subnetConfig = {
  @description('Subnet name')
  name: string

  @description('CIDR prefix')
  prefix: string

  @description('Optional service delegation')
  delegation: string?

  @description('Whether a route table is attached')
  routeTable: bool
}

param subnets subnetConfig[]
```

```bicep
// import from another file
import { subnetConfig } from './shared/types.bicep'

param subnets subnetConfig[]
```

Typed parameters catch mistakes at compile time rather than halfway through a deployment. For anything shaped like a list of objects, they are worth the few extra lines.

## User defined functions

```bicep
@export()
func buildResourceName(prefix string, workload string, environment string, region string) string =>
  toLower('${prefix}-${workload}-${environment}-${region}')

@export()
func isProduction(environment string) bool => environment == 'prod'
```

```bicep
import { buildResourceName, isProduction } from './shared/naming.bicep'

var appName = buildResourceName('app', 'shop', environment, 'uks')
```

## Azure Verified Modules

```bicep
module storage 'br/public:avm/res/storage/storage-account:0.14.3' = {
  name: 'storage'
  params: {
    name: 'stshopprod'
    location: location
    skuName: 'Standard_ZRS'
    allowBlobPublicAccess: false
    publicNetworkAccess: 'Disabled'
    roleAssignments: [
      {
        principalId: app.outputs.principalId
        roleDefinitionIdOrName: 'Storage Blob Data Contributor'
        principalType: 'ServicePrincipal'
      }
    ]
  }
}
```

Microsoft publishes maintained modules covering most resource types, with security defaults, diagnostic settings and role assignment support already built in.

Pin the version. `br/public:avm/res/storage/storage-account:0.14.3` is reproducible; omitting the version is not.

Using them means less code to maintain and less chance of missing a security setting. Writing your own makes sense when you need conventions the public modules do not encode.

## A private registry

```bash
az acr create --name acrbicep --resource-group rg-shared --sku Basic

az bicep publish \
  --file modules/storage.bicep \
  --target br:acrbicep.azurecr.io/bicep/modules/storage:1.2.0
```

```bicep
module storage 'br:acrbicep.azurecr.io/bicep/modules/storage:1.2.0' = {
  name: 'storage'
  params: { name: storageName, location: location }
}
```

For an organisation with several repositories, a registry means modules are versioned and shared rather than copied. Copied modules diverge, and then a fix has to be applied in six places.

## Structure that works

```text
main.bicep         orchestration only: modules, wiring, outputs
modules/           one resource type or one logical grouping each
shared/            naming, types, functions, role IDs
*.bicepparam       one per environment
bicepconfig.json   linter rules
```

**Keep `main.bicep` free of individual resources.** When it only calls modules and passes outputs between them, the shape of the deployment is readable at a glance.

## Quick recap

- Split when a file stops fitting in your head, not before.
- Modules encode decisions once, which is their real value beyond reuse.
- The module `name` is the deployment name, and it needs an index inside a loop.
- A module can target a different resource group or subscription than its parent.
- `.bicepparam` files are type checked against the template, so typos fail early.
- Pin Azure Verified Module versions, and use them where they fit.
- Keep `main.bicep` to orchestration so the deployment shape is readable.

<code id="code-content" class="language-bicep">
// START WITH ONE FILE. Split when it stops fitting in your head, usually
// past 200 lines or when the same block appears twice. Premature
// modularisation makes a small deployment harder to follow.
//   infra/main.bicep  modules/  shared/  *.bicepparam  bicepconfig.json
//
// A MODULE IS JUST A BICEP FILE WITH PARAMETERS AND OUTPUTS. Its real
// value is ENCODING DECISIONS ONCE: every storage account deployed through
// this one has shared key access off and public access disabled, and
// nobody has to remember.
//   modules/storage.bicep:
//     properties: {
//       allowSharedKeyAccess: false
//       publicNetworkAccess: 'Disabled'
//       allowBlobPublicAccess: false
//     }
//     output blobEndpoint string = storage.properties.primaryEndpoints.blob
//
module storage './modules/storage.bicep' = {
  // THIS IS THE DEPLOYMENT NAME, visible in history, and it must be unique
  // within the deployment. In a loop it needs an index.
  name: 'storage-deployment'
  params: {
    name: 'st${uniqueString(resourceGroup().id)}'
    location: location
    redundancy: environment == 'prod' ? 'Standard_GZRS' : 'Standard_LRS'
    contributorPrincipalIds: [app.outputs.principalId]
  }
}
//
// A MODULE CAN TARGET A DIFFERENT RESOURCE GROUP OR SUBSCRIPTION than its
// parent. That is how a spoke creates its half of a peering in the hub.
module hubPeering './modules/peering.bicep' = {
  name: 'hub-peering'
  scope: resourceGroup('rg-hub-uks')
  params: { spokeVnetId: network.outputs.vnetId }
}
//
// .bicepparam REPLACED JSON PARAMETER FILES AND IS MUCH BETTER. `using`
// binds it to the template, so parameters are TYPE CHECKED and a typo
// fails BEFORE deployment. --template-file is not needed.
//   using './main.bicep'
//   param environment = 'prod'
//   param subnets = [ { name: 'snet-app', prefix: '10.20.1.0/24' } ]
//   param adminObjectId = readEnvironmentVariable('ADMIN_OBJECT_ID')
//   az deployment group create --resource-group rg-... --parameters prod.bicepparam
//
// USER DEFINED TYPES catch mistakes at COMPILE TIME rather than halfway
// through a deployment. Worth it for anything shaped like a list of objects.
@export()
type subnetConfig = {
  name: string
  prefix: string
  delegation: string?        // optional
  routeTable: bool
}
import { subnetConfig } from './shared/types.bicep'
param subnets subnetConfig[]
//
@export()
func buildResourceName(prefix string, workload string, env string) string =&gt;
  toLower('${prefix}-${workload}-${env}')
//
// AZURE VERIFIED MODULES are maintained by Microsoft with security
// defaults, diagnostics and role assignments already built in. PIN THE
// VERSION: omitting it is not reproducible.
module avmStorage 'br/public:avm/res/storage/storage-account:0.14.3' = {
  name: 'storage'
  params: {
    name: 'stshopprod'
    location: location
    publicNetworkAccess: 'Disabled'
    roleAssignments: [{
      principalId: app.outputs.principalId
      roleDefinitionIdOrName: 'Storage Blob Data Contributor'
      principalType: 'ServicePrincipal'
    }]
  }
}
//
// A PRIVATE REGISTRY versions and shares modules across repositories.
// COPIED MODULES DIVERGE, and then a fix must be applied in six places.
//   az bicep publish --file modules/storage.bicep \
//     --target br:acrbicep.azurecr.io/bicep/modules/storage:1.2.0
//   module storage 'br:acrbicep.azurecr.io/bicep/modules/storage:1.2.0' = { }
//
// KEEP main.bicep FREE OF INDIVIDUAL RESOURCES. When it only calls modules
// and wires outputs together, the shape of the deployment reads at a glance.
</code></pre>
