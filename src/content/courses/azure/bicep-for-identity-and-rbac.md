---
publishDate: 2026-10-19T10:50
title: Bicep for Identity and RBAC
slug: bicep-for-identity-and-rbac
metadescription: Create managed identities, assign roles and wire Key Vault access entirely in Bicep, avoiding the ordering problems that cause intermittent failures.
updateDate: 2026-09-07T10:50
author: ['bishal-biswas']
level: 3
tags: ['iac', 'bicep', 'rbac', 'identity']
course: azure
---

## The ordering problem

A system assigned identity does not exist until its resource is deployed. That makes granting it permissions in the same template awkward, and it is the source of most intermittent deployment failures.

```bicep
// works, but the dependency is implicit and the identity must exist first
resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-shop'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: { serverFarmId: plan.id }
}

resource role 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, site.id, blobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: blobDataContributor
    principalId: site.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

That does work, because `site.identity.principalId` creates the dependency. The failure mode is different: the identity exists in Azure Resource Manager before it is fully replicated in Entra ID, so the role assignment occasionally fails with "principal does not exist".

`principalType: 'ServicePrincipal'` is the fix. It tells Azure not to perform the directory lookup that would fail.

## User assigned identities remove the problem

```bicep
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-shop-${environment}'
  location: location
}

// grant permissions to the identity BEFORE anything uses it
resource storageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, identity.id, roles.storageBlobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions', roles.storageBlobDataContributor)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// then attach it
resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-shop-${environment}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    serverFarmId: plan.id
    siteConfig: {
      appSettings: [
        { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
      ]
    }
  }
}
```

The identity is a first class resource with its own lifecycle. Permissions are granted before anything uses it, replacing a resource does not mean redoing role assignments, and several resources can share one.

For infrastructure code, this is almost always the better choice.

Note `AZURE_CLIENT_ID` in app settings. A resource can carry several user assigned identities, so the SDK needs to be told which one, and this is how.

## A role definitions file

```bicep
// shared/roles.bicep
@export()
var roles = {
  owner: '8e3af657-a8ff-443c-a75c-2fe8c4bcb635'
  contributor: 'b24988ac-6180-42a0-ab88-20f7382dd24c'
  reader: 'acdd72a7-3385-48ef-bd42-f606fba81ae7'

  storageBlobDataOwner: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
  storageBlobDataContributor: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
  storageBlobDataReader: '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'
  storageQueueDataContributor: '974c5e8b-45b9-4653-ba55-5f855dd0fb88'

  keyVaultAdministrator: '00482a5a-887f-4fb3-b363-3b7fe8e74483'
  keyVaultSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
  keyVaultSecretsOfficer: 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'
  keyVaultCertificatesOfficer: 'a4417e6f-fecd-4de8-b567-7b0420556985'

  acrPull: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
  acrPush: '8311e382-0749-4cb8-b61a-304f252e45ec'

  serviceBusDataSender: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
  serviceBusDataReceiver: '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0'
  eventHubsDataSender: '2b629674-e913-4c01-ae53-ef4638d8f975'

  cosmosDbDataContributor: '00000000-0000-0000-0000-000000000002'
  monitoringMetricsPublisher: '3913510d-42f4-4e42-8a64-420c390055eb'
}
```

Look each one up once. Scattering GUIDs through templates makes them unreadable and means the same lookup happens repeatedly.

## A reusable role assignment module

```bicep
// modules/role-assignment.bicep
@description('Resource ID of the scope for the assignment')
param scopeResourceId string

param principalId string
param roleDefinitionId string

@allowed(['ServicePrincipal', 'User', 'Group', 'ForeignGroup', 'Device'])
param principalType string = 'ServicePrincipal'

resource assignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(scopeResourceId, principalId, roleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: principalId
    principalType: principalType
  }
}
```

Because `scope` on a module cannot be an arbitrary resource ID, the usual pattern is a module per resource type, or assignments declared inline with `scope:` pointing at the resource symbol.

Inline is often clearer:

```bicep
resource kvRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, identity.id, roles.keyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}
```

## Key Vault with RBAC

```bicep
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-shop-${environment}'
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }

    // RBAC, not access policies
    enableRbacAuthorization: true

    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true

    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}
```

**Use `enableRbacAuthorization: true`.** Access policies are the older model, are per vault rather than per secret, and do not integrate with the rest of Azure RBAC.

**`enablePurgeProtection` cannot be turned off.** That is the point, and it means a vault deployed with it cannot be fully deleted for the retention period, including in development. Leave it off in short lived environments.

## Granting access to secrets

```bicep
resource secretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, identity.id, roles.keyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// scoped to ONE secret, which is narrower still
resource secret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'stripe-key'
  properties: { value: stripeKey }
}

resource oneSecretOnly 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(secret.id, identity.id, roles.keyVaultSecretsUser)
  scope: secret
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}
```

Role assignments can be scoped to an individual secret, which is genuinely least privilege and rarely used.

## Referencing secrets in app settings

```bicep
resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-shop-${environment}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  properties: {
    serverFarmId: plan.id
    keyVaultReferenceIdentity: identity.id
    siteConfig: {
      appSettings: [
        {
          name: 'StripeKey'
          value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/stripe-key/)'
        }
        { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
      ]
    }
  }
  dependsOn: [ secretsUser ]
}
```

`keyVaultReferenceIdentity` tells App Service which identity to use when resolving the reference. Without it, the platform uses the system assigned identity, which may not exist or may not have access.

The explicit `dependsOn` on the role assignment matters here: the app must not start resolving references before it has permission, or the setting arrives as a literal string.

## Assigning at other scopes

```bicep
targetScope = 'subscription'

resource readerAtSubscription 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().id, principalId, roles.reader)
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions', roles.reader)
    principalId: principalId
    principalType: 'Group'
  }
}
```

At subscription scope the assignment has no `scope` property, since the target scope is the subscription itself.

## A complete pattern

```bicep
// identity first
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-shop-${environment}'
  location: location
}

// permissions second
module permissions './modules/permissions.bicep' = {
  name: 'permissions'
  params: {
    principalId: identity.properties.principalId
    keyVaultName: keyVault.name
    storageName: storage.name
    registryName: registry.name
  }
}

// the workload last, depending on both
module app './modules/app.bicep' = {
  name: 'app'
  params: {
    identityResourceId: identity.id
    identityClientId: identity.properties.clientId
    keyVaultUri: keyVault.properties.vaultUri
  }
  dependsOn: [ permissions ]
}
```

Identity, then permissions, then workload. That ordering removes the whole class of "it failed the first time and worked on retry" deployments.

## Quick recap

- `principalType: 'ServicePrincipal'` prevents the intermittent "principal does not exist" failure.
- User assigned identities remove the ordering problem entirely, and are better for infrastructure code.
- Set `AZURE_CLIENT_ID` so the SDK knows which identity to use.
- Keep role definition GUIDs in one exported variable rather than scattered through templates.
- Use `enableRbacAuthorization` on Key Vault, since access policies are the older model.
- Purge protection cannot be turned off, so leave it off in short lived environments.
- Deploy identity, then permissions, then workload, with an explicit dependency.

<code id="code-content" class="language-bicep">
// THE ORDERING PROBLEM: a SYSTEM assigned identity does not exist until its
// resource is deployed, and it exists in Resource Manager before it is
// fully replicated in Entra ID. So the role assignment OCCASIONALLY fails
// with "principal does not exist". principalType is the fix: it tells
// Azure not to do the directory lookup that would fail.
//
// USER ASSIGNED IDENTITIES REMOVE THE PROBLEM ENTIRELY, which is why they
// are almost always better in infrastructure code. IDENTITY FIRST:
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-shop-${environment}'
  location: location
}
//
// PERMISSIONS SECOND, before anything uses it:
resource storageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, identity.id, roles.storageBlobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions', roles.storageBlobDataContributor)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'      // &lt;- the fix
  }
}
//
// KEEP ROLE GUIDs IN ONE PLACE. Look each up once. Scattering them through
// templates makes everything unreadable.
//   @export() var roles = {
//     storageBlobDataContributor: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
//     keyVaultSecretsUser:        '4633458b-17de-408a-b874-0445c86b69e6'
//     acrPull:                    '7f951dda-4ed3-4680-a7ca-43fe172d538d'
//   }
//
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-shop-${environment}'
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    // RBAC, NOT ACCESS POLICIES. Policies are the older model, are per
    // vault rather than per secret, and ignore the rest of Azure RBAC.
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    // CANNOT BE TURNED OFF. That is the point, and it means the vault
    // cannot be fully deleted for the retention period. Leave it OFF in
    // short lived environments.
    enablePurgeProtection: true
    publicNetworkAccess: 'Disabled'
    networkAcls: { defaultAction: 'Deny', bypass: 'AzureServices' }
  }
}
//
// THE WORKLOAD LAST, depending on the permissions:
resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-shop-${environment}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  properties: {
    serverFarmId: plan.id
    // WITHOUT THIS, App Service resolves Key Vault references with the
    // SYSTEM assigned identity, which may not exist or have access.
    keyVaultReferenceIdentity: identity.id
    siteConfig: {
      appSettings: [
        {
          name: 'StripeKey'
          value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/stripe-key/)'
        }
        // A resource can carry SEVERAL user assigned identities, so the SDK
        // must be told which one:
        { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
      ]
    }
  }
  // EXPLICIT: the app must not resolve references before it has permission,
  // or the setting arrives as a LITERAL STRING and fails deep inside.
  dependsOn: [ secretsUser ]
}
//
// IDENTITY, THEN PERMISSIONS, THEN WORKLOAD. That ordering removes the
// whole class of "it failed the first time and worked on retry".
</code></pre>
