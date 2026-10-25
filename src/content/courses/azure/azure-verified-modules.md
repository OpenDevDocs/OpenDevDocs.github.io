---
publishDate: 2026-10-19T11:00
title: Azure Verified Modules and Deployment Stacks
slug: azure-verified-modules
metadescription: Use Azure Verified Modules for maintained infrastructure building blocks, and deployment stacks to manage resources as one unit.
updateDate: 2026-09-07T11:00
author: ['bishal-biswas']
level: 3
tags: ['iac', 'bicep', 'modules', 'governance']
course: azure
---

## What Azure Verified Modules are

Microsoft maintained modules for Bicep and Terraform, covering most Azure resource types, with security defaults, diagnostic settings and role assignment support built in.

```text
Maintained by Microsoft, with a published support commitment
Secure by default, following Well-Architected guidance
Consistent interface across every module
Versioned, and published to a public registry
Available for both Bicep and Terraform
```

The alternative is every organisation writing the same storage account module slightly differently, and each one missing a different security setting.

## Two kinds

```text
Resource modules  one resource type. avm/res/storage/storage-account
Pattern modules   a working architecture. avm/ptn/...
```

Resource modules are the building blocks. Pattern modules assemble several into something complete, like a landing zone or a hub and spoke network.

## Using one

```bicep
module storage 'br/public:avm/res/storage/storage-account:0.14.3' = {
  name: 'storage-deployment'
  params: {
    name: 'stshopprod'
    location: location
    skuName: 'Standard_ZRS'
    kind: 'StorageV2'

    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    publicNetworkAccess: 'Disabled'
    minimumTlsVersion: 'TLS1_2'

    blobServices: {
      deleteRetentionPolicyEnabled: true
      deleteRetentionPolicyDays: 30
      containerDeleteRetentionPolicyEnabled: true
      containers: [
        { name: 'uploads', publicAccess: 'None' }
        { name: 'exports', publicAccess: 'None' }
      ]
    }

    privateEndpoints: [
      {
        subnetResourceId: subnetId
        service: 'blob'
        privateDnsZoneGroup: {
          privateDnsZoneGroupConfigs: [ { privateDnsZoneResourceId: blobZoneId } ]
        }
      }
    ]

    roleAssignments: [
      {
        principalId: identity.properties.principalId
        roleDefinitionIdOrName: 'Storage Blob Data Contributor'
        principalType: 'ServicePrincipal'
      }
    ]

    diagnosticSettings: [
      {
        workspaceResourceId: workspaceId
        logCategoriesAndGroups: [ { categoryGroup: 'allLogs' } ]
        metricCategories: [ { category: 'AllMetrics' } ]
      }
    ]

    tags: tags
  }
}

output blobEndpoint string = storage.outputs.primaryBlobEndpoint
```

That single module call creates the account, its containers, a private endpoint with DNS wiring, a role assignment and diagnostic settings. Writing the equivalent by hand is roughly a hundred and fifty lines, and easy to get subtly wrong.

**Pin the version.** `:0.14.3` is reproducible. Omitting it means a later deployment may behave differently.

## The consistent interface

Every module supports the same optional parameters, which is most of the value.

```text
roleAssignments      the same shape everywhere
diagnosticSettings   the same shape everywhere
privateEndpoints     the same shape everywhere
lock                 CanNotDelete or ReadOnly
managedIdentities    systemAssigned and userAssignedResourceIds
tags                 everywhere
enableTelemetry      set false to opt out of usage telemetry
```

Learn the shape once and it applies to every module. Adding diagnostic settings to a Key Vault uses the same block as adding them to a storage account.

## Finding modules

```bash
az rest --method get \
  --url "https://mcr.microsoft.com/v2/bicep/avm/res/storage/storage-account/tags/list" \
  --query "tags[-5:]"
```

The index is published at the Azure Verified Modules site, listing every module, its status and its owner. Modules move through proposed, orphaned and available states, so check the status before depending on one.

## Terraform

```hcl
module "storage" {
  source  = "Azure/avm-res-storage-storageaccount/azurerm"
  version = "0.6.4"

  name                          = "stshopprod"
  resource_group_name           = azurerm_resource_group.shop.name
  location                      = var.location
  account_replication_type      = "ZRS"
  shared_access_key_enabled     = false
  public_network_access_enabled = false

  containers = {
    uploads = { name = "uploads" }
    exports = { name = "exports" }
  }

  role_assignments = {
    blob_contributor = {
      role_definition_id_or_name = "Storage Blob Data Contributor"
      principal_id               = azurerm_user_assigned_identity.shop.principal_id
      principal_type             = "ServicePrincipal"
    }
  }
}
```

Same programme, published to the Terraform registry, with the same consistent interface.

## When to write your own

```text
Use AVM when          the module covers what you need
Wrap AVM when         you have organisational conventions to apply
Write your own when   the resource is unsupported, or your needs differ substantially
```

Wrapping is often the right answer:

```bicep
// modules/org-storage.bicep
param name string
param location string
param environment string

module storage 'br/public:avm/res/storage/storage-account:0.14.3' = {
  name: 'avm-storage'
  params: {
    name: name
    location: location
    skuName: environment == 'prod' ? 'Standard_GZRS' : 'Standard_LRS'

    // organisational policy, applied to every account
    allowSharedKeyAccess: false
    publicNetworkAccess: 'Disabled'
    minimumTlsVersion: 'TLS1_2'

    diagnosticSettings: [ { workspaceResourceId: centralWorkspaceId } ]
    tags: union(commonTags, { environment: environment })
  }
}

output id string = storage.outputs.resourceId
```

Your team calls one module with three parameters, and organisational decisions are applied without anyone remembering them.

## Deployment stacks

A related idea: managing a set of resources as one unit with a defined deletion behaviour.

```bash
az stack group create \
  --name shop-prod \
  --resource-group rg-shop-prod-uks \
  --template-file main.bicep \
  --parameters prod.bicepparam \
  --action-on-unmanage deleteResources \
  --deny-settings-mode denyWriteAndDelete \
  --deny-settings-excluded-principals "$PIPELINE_PRINCIPAL_ID"
```

Two capabilities that ordinary deployments do not have:

**`--action-on-unmanage`** decides what happens to a resource removed from the template. `deleteResources` deletes it, `detachAll` leaves it. That solves the problem where removing a resource from a Bicep file leaves it running and billing forever.

**`--deny-settings-mode`** blocks changes outside the stack. `denyWriteAndDelete` means nobody can modify or delete a managed resource, including through the portal, except the excluded principals.

That directly addresses the biggest discipline problem in infrastructure as code: people changing things in the portal.

```bash
az stack group show --name shop-prod --resource-group rg-shop-prod-uks \
  --query "resources[].{Id:id, Status:status, DenyStatus:denyStatus}" -o table

az stack group delete --name shop-prod --resource-group rg-shop-prod-uks \
  --action-on-unmanage deleteAll --yes
```

Deleting the stack with `deleteAll` removes every managed resource, which makes cleaning up an environment one command instead of a careful list.

## Stacks at other scopes

```bash
az stack sub create \
  --name platform --location uksouth \
  --template-file platform.bicep \
  --action-on-unmanage deleteResources \
  --deny-settings-mode denyDelete

az stack mg create \
  --name governance --management-group-id mg-contoso --location uksouth \
  --template-file policy.bicep --action-on-unmanage detachAll \
  --deny-settings-mode none
```

Subscription and management group stacks manage resource groups and policy assignments, which is how a platform team applies governance as one unit.

## Practical advice

```text
Start with AVM modules rather than writing your own
Pin versions, and update deliberately
Wrap them where organisational conventions apply
Use deployment stacks for environments with a clear lifecycle
Use deny settings to stop portal drift
Test action-on-unmanage in a non production stack first
```

That last one matters. `deleteResources` does exactly what it says, and discovering that on production is not the way to learn it.

## Quick recap

- Azure Verified Modules are maintained by Microsoft with security defaults already applied.
- Every module shares the same interface for roles, diagnostics, private endpoints and locks.
- Pin module versions, since omitting one makes deployments non reproducible.
- Wrapping an AVM module is how you apply organisational conventions in one place.
- Deployment stacks decide what happens to resources removed from a template.
- Deny settings block portal changes to managed resources, which addresses drift directly.
- Test `action-on-unmanage` outside production, because `deleteResources` means it.

<code id="code-content" class="language-bicep">
// AZURE VERIFIED MODULES are Microsoft maintained, secure by default, and
// share ONE CONSISTENT INTERFACE across every resource type. The
// alternative is every organisation writing the same storage module
// slightly differently, each missing a different security setting.
//   avm/res/...  one resource type      avm/ptn/...  a working architecture
//
module storage 'br/public:avm/res/storage/storage-account:0.14.3' = {
  //                                                       ^^^^^^ PIN IT.
  // Omitting the version means a later deployment may behave differently.
  name: 'storage-deployment'
  params: {
    name: 'stshopprod'
    location: location
    skuName: 'Standard_ZRS'
    allowSharedKeyAccess: false
    publicNetworkAccess: 'Disabled'
//
    // THE SAME SHAPES APPEAR IN EVERY MODULE. Learn them once.
    roleAssignments: [{
      principalId: identity.properties.principalId
      roleDefinitionIdOrName: 'Storage Blob Data Contributor'
      principalType: 'ServicePrincipal'
    }]
    diagnosticSettings: [{
      workspaceResourceId: workspaceId
      logCategoriesAndGroups: [{ categoryGroup: 'allLogs' }]
    }]
    privateEndpoints: [{
      subnetResourceId: subnetId
      service: 'blob'
      privateDnsZoneGroup: {
        privateDnsZoneGroupConfigs: [{ privateDnsZoneResourceId: blobZoneId }]
      }
    }]
    lock: { kind: 'CanNotDelete' }
  }
}
// That one call creates the account, containers, a private endpoint WITH
// DNS wiring, a role assignment and diagnostics. By hand it is roughly 150
// lines and easy to get subtly wrong.
//
// WRAPPING IS OFTEN THE RIGHT ANSWER: your team calls one module with three
// parameters, and organisational decisions apply without anyone
// remembering them.
//   module storage 'br/public:avm/res/storage/storage-account:0.14.3' = {
//     params: { allowSharedKeyAccess: false, publicNetworkAccess: 'Disabled',
//               diagnosticSettings: [{ workspaceResourceId: centralWorkspaceId }] }
//   }
//
// DEPLOYMENT STACKS manage a set of resources AS ONE UNIT, with two things
// ordinary deployments do not have:
//
//   --action-on-unmanage  what happens to a resource REMOVED FROM THE
//     TEMPLATE. deleteResources deletes it; detachAll leaves it. This
//     solves resources that keep running and billing forever after
//     someone deletes them from the Bicep file.
//
//   --deny-settings-mode  BLOCKS CHANGES OUTSIDE THE STACK, including
//     through the portal, except for excluded principals. That directly
//     addresses the biggest discipline problem in infrastructure as code.
//
//   az stack group create --name shop-prod --resource-group rg-shop-prod-uks \
//     --template-file main.bicep --parameters prod.bicepparam \
//     --action-on-unmanage deleteResources \
//     --deny-settings-mode denyWriteAndDelete \
//     --deny-settings-excluded-principals "$PIPELINE_PRINCIPAL_ID"
//
//   az stack group delete --name shop-prod --resource-group rg-shop-prod-uks \
//     --action-on-unmanage deleteAll --yes    # cleanup in ONE command
//
// TEST action-on-unmanage OUTSIDE PRODUCTION FIRST. deleteResources does
// exactly what it says, and production is not the place to learn that.
</code></pre>
