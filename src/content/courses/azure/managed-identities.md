---
publishDate: 2026-10-04T07:00
title: Managed Identities
slug: managed-identities
metadescription: Use managed identities so Azure code authenticates without storing any credential, and know when system assigned or user assigned fits.
updateDate: 2026-09-07T07:00
author: ['bishal-biswas']
level: 2
tags: ['identity', 'security', 'managed identity']
course: azure
---

## The problem they solve

An app needs to read a secret from Key Vault. Traditionally that means a client ID and a client secret, stored somewhere, rotated by someone, and eventually committed to git by accident.

A managed identity removes the credential entirely. Azure creates a service principal for your resource, and the platform handles the tokens.

```text
No secret to store
No secret to rotate
No secret to leak
```

## Two kinds

```text
System assigned   tied to one resource. Created with it, deleted with it.
User assigned     a standalone resource. Shared by many, outlives any of them.
```

### System assigned

```bash
az webapp identity assign --name shop-api --resource-group rg-shop-prod-uks
az webapp identity show --name shop-api --resource-group rg-shop-prod-uks
az webapp identity remove --name shop-api --resource-group rg-shop-prod-uks
```

Simple, and the lifecycle is automatic. Delete the web app and the identity goes with it, along with its role assignments.

The drawback: the identity does not exist until the resource does, so infrastructure code cannot grant it permissions in the same pass without ordering care.

### User assigned

```bash
az identity create --name id-shop-prod --resource-group rg-shop-prod-uks

CLIENT_ID=$(az identity show --name id-shop-prod --resource-group rg-shop-prod-uks --query clientId -o tsv)
PRINCIPAL_ID=$(az identity show --name id-shop-prod --resource-group rg-shop-prod-uks --query principalId -o tsv)

az webapp identity assign --name shop-api --resource-group rg-shop-prod-uks \
  --identities /subscriptions/.../userAssignedIdentities/id-shop-prod
```

Create it first, grant it permissions, then attach it to whatever needs it. Several apps can share one, and replacing an app does not mean redoing role assignments.

This is usually the better choice for anything managed by infrastructure code, because the ordering problem disappears.

## Granting access

```bash
az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" \
  --scope /subscriptions/.../vaults/kv-shop-prod

az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/.../storageAccounts/stshopprod
```

Always `--assignee-object-id` with `--assignee-principal-type ServicePrincipal`. Plain `--assignee` does a directory lookup that a freshly created identity may not satisfy yet, which is the cause of deployment scripts that fail once in five runs.

Remember the **principal ID** is for role assignments and the **client ID** is what your code passes when selecting a user assigned identity. Mixing them up is the most common mistake here.

## Using it in code

```csharp
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;

var credential = new DefaultAzureCredential();

var client = new SecretClient(
    new Uri("https://kv-shop-prod.vault.azure.net/"),
    credential);

KeyVaultSecret secret = await client.GetSecretAsync("StripeApiKey");
```

`DefaultAzureCredential` tries a chain of options in order: environment variables, workload identity, managed identity, then developer credentials like the Azure CLI login.

That is why the same code works on your laptop and in production. Locally it uses your `az login`, in Azure it uses the managed identity, and no branch is needed.

For a user assigned identity you must say which one:

```csharp
var credential = new DefaultAzureCredential(
    new DefaultAzureCredentialOptions
    {
        ManagedIdentityClientId = Environment.GetEnvironmentVariable("AZURE_CLIENT_ID")
    });
```

A resource can carry several user assigned identities, so the platform cannot guess. Omitting the client ID when more than one is attached produces a confusing failure.

In production, prefer the explicit form:

```csharp
var credential = new ManagedIdentityCredential(
    clientId: Environment.GetEnvironmentVariable("AZURE_CLIENT_ID"));
```

`DefaultAzureCredential` is convenient for development and slow to fail in production, because it walks the whole chain before giving up. Being explicit gives faster, clearer errors.

## Where they work

```text
App Service and Functions       yes
Container Apps                  yes
Virtual machines and scale sets yes
AKS                             via workload identity, which is the modern way
Logic Apps, Data Factory, APIM  yes
Azure DevOps and GitHub Actions no, use workload identity federation instead
```

The pattern outside Azure is federation rather than a managed identity, and it achieves the same thing: no stored secret.

## Connecting to a database

```csharp
var connection = new SqlConnection(
    "Server=sql-shop-prod.database.windows.net;" +
    "Database=shop;" +
    "Authentication=Active Directory Default;" +
    "Encrypt=True;");
```

No username, no password. The database side needs the identity created as a user:

```sql
CREATE USER [shop-api] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [shop-api];
ALTER ROLE db_datawriter ADD MEMBER [shop-api];
```

The name is the identity's display name. This works for Azure SQL, PostgreSQL and MySQL flexible servers, and it removes the last common reason to keep a password in configuration.

## Bicep

```bicep
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-shop-prod'
  location: location
}

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: 'shop-api'
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
        {
          name: 'AZURE_CLIENT_ID'
          value: identity.properties.clientId
        }
      ]
    }
  }
}
```

Creating the identity as its own resource makes the dependency explicit, which is exactly why user assigned is easier in infrastructure code.

## Debugging

**Token acquisition fails locally.** Managed identities only work inside Azure. Locally `DefaultAzureCredential` falls back to your CLI login, so run `az login` first.

**Works in one app, not another.** Role assignments are per identity. A new app means a new system assigned identity with no permissions.

**Intermittent failure right after deployment.** Role assignments are eventually consistent. Give it a minute, or retry.

**Multiple identities attached.** Set `AZURE_CLIENT_ID` so the right one is chosen.

```bash
az webapp identity show --name shop-api --resource-group rg-shop-prod-uks
az role assignment list --assignee "$PRINCIPAL_ID" --all --output table
```

## Quick recap

- A managed identity removes the stored credential entirely, which is the whole point.
- System assigned is tied to one resource, user assigned is standalone and shareable.
- User assigned is usually better in infrastructure code because ordering is simpler.
- Principal ID is for role assignments, client ID is what your code passes.
- `DefaultAzureCredential` makes the same code work locally and in Azure.
- Prefer an explicit `ManagedIdentityCredential` in production for faster, clearer errors.
- Databases support them too, so no password needs to live in configuration.

<code id="code-content" class="language-csharp">
// THE PROBLEM: an app needs a Key Vault secret. Traditionally that means a
// client secret, stored somewhere, rotated by someone, and eventually
// committed to git. A managed identity removes the credential ENTIRELY.
//
// TWO KINDS:
//   System assigned  tied to one resource, created and deleted with it
//   User assigned    a standalone resource, shared, outlives any of them
// User assigned is usually better in infrastructure code: create it, grant
// it permissions, THEN attach it. The ordering problem disappears.
//
//   az identity create --name id-shop-prod --resource-group rg-shop-prod-uks
//   az webapp identity assign --name shop-api --resource-group rg-... \
//     --identities /subscriptions/.../userAssignedIdentities/id-shop-prod
//
// PRINCIPAL ID is for role assignments. CLIENT ID is what your CODE passes.
// Mixing them up is the most common mistake here.
//   az role assignment create --assignee-object-id "$PRINCIPAL_ID" \
//     --assignee-principal-type ServicePrincipal \
//     --role "Key Vault Secrets User" --scope /subscriptions/.../vaults/kv-shop-prod
//
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
//
// DefaultAzureCredential walks a chain: environment, workload identity,
// managed identity, then your `az login`. That is why the SAME CODE works
// on your laptop and in production, with no branch.
var credential = new DefaultAzureCredential();
//
var client = new SecretClient(
    new Uri("https://kv-shop-prod.vault.azure.net/"), credential);
KeyVaultSecret secret = await client.GetSecretAsync("StripeApiKey");
//
// A resource can carry SEVERAL user assigned identities, so the platform
// cannot guess. Omitting the client ID gives a confusing failure.
var explicitCredential = new ManagedIdentityCredential(
    clientId: Environment.GetEnvironmentVariable("AZURE_CLIENT_ID"));
// Prefer this in production: DefaultAzureCredential walks the whole chain
// before failing, so errors are slow and vague.
//
// DATABASES TOO. No username, no password in configuration:
var connection = new SqlConnection(
    "Server=sql-shop-prod.database.windows.net;Database=shop;" +
    "Authentication=Active Directory Default;Encrypt=True;");
// On the database side, create the identity as a user:
//   CREATE USER [shop-api] FROM EXTERNAL PROVIDER;
//   ALTER ROLE db_datawriter ADD MEMBER [shop-api];
//
// DEBUGGING:
//   Fails locally          managed identities only work INSIDE Azure. az login.
//   Works in one app only  role assignments are PER IDENTITY.
//   Fails right after deploy  assignments are eventually consistent. Retry.
//   Several attached       set AZURE_CLIENT_ID to pick one.
</code></pre>
