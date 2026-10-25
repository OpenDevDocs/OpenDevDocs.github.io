---
publishDate: 2026-10-13T09:10
title: 'Securing Storage: SAS, Keys and Entra Authorisation'
slug: securing-storage-access
metadescription: Control access to Azure Storage with Entra ID roles, shared access signatures and network rules, and stop using account keys.
updateDate: 2026-09-07T09:10
author: ['bishal-biswas']
level: 2
tags: ['storage', 'security', 'sas']
course: azure
---

## Four ways in, ranked

```text
Entra ID with RBAC     best. Per identity, auditable, revocable, no secret.
User delegation SAS    good. A SAS signed by Entra ID, not by the account key.
Service SAS            acceptable. Signed by the account key, so revocation is blunt.
Account key            worst. Full access to everything, two of them, forever.
```

The goal is to reach a point where account keys are disabled entirely.

## Entra ID and RBAC

```bash
az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/.../storageAccounts/stshopprod

# narrower: one container
az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Reader" \
  --scope /subscriptions/.../storageAccounts/stshopprod/blobServices/default/containers/public-assets
```

```text
Storage Blob Data Reader        read blobs
Storage Blob Data Contributor   read, write, delete blobs
Storage Blob Data Owner         also manage POSIX ACLs in Data Lake
Storage Queue Data Message Processor  receive and delete messages
Storage Queue Data Message Sender     send messages
Storage Table Data Reader / Contributor
```

Remember these are **data plane** roles. Owner or Contributor on the storage account lets you change settings and read the keys, and does not let you read a blob.

```csharp
var client = new BlobServiceClient(
    new Uri("https://stshopprod.blob.core.windows.net"),
    new DefaultAzureCredential());
```

No key anywhere. Locally it uses your `az login`, in Azure the managed identity.

## Disabling account keys

```bash
az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --allow-shared-key-access false
```

Once set, every request signed with an account key fails. That includes some older tools, some SDK code paths and anything using a connection string.

Find them before flipping it:

```kusto
StorageBlobLogs
| where TimeGenerated > ago(7d)
| where AuthenticationType == "AccountKey"
| summarize count() by CallerIpAddress, UserAgentHeader
| order by count_ desc
```

That query is the migration plan. Fix each caller, then disable keys.

## User delegation SAS

When you must hand out a URL, this is the way to do it.

```bash
END=$(date -u -d "1 hour" '+%Y-%m-%dT%H:%MZ')

az storage blob generate-sas \
  --account-name stshopprod --container-name uploads \
  --name invoices/inv-1042.pdf \
  --permissions r --expiry "$END" \
  --auth-mode login --as-user --full-uri
```

`--as-user` makes it a **user delegation SAS**, signed with a key derived from Entra ID rather than the account key.

```text
Signed by an identity, so the audit trail shows who issued it
Revocable by revoking the delegation key, without rotating account keys
Cannot outlive 7 days
Requires the issuer to have data plane permission
```

```csharp
var delegationKey = await blobServiceClient.GetUserDelegationKeyAsync(
    DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddHours(1));

var builder = new BlobSasBuilder
{
    BlobContainerName = "uploads",
    BlobName = blobName,
    Resource = "b",
    ExpiresOn = DateTimeOffset.UtcNow.AddMinutes(15),
    Protocol = SasProtocol.Https
};
builder.SetPermissions(BlobSasPermissions.Read);

var sasUri = new UriBuilder($"https://stshopprod.blob.core.windows.net/uploads/{blobName}")
{
    Query = builder.ToSasQueryParameters(delegationKey, "stshopprod").ToString()
};
```

This is the right pattern for letting a browser download a private file directly, without the file passing through your API.

## Writing rules for a SAS

```text
Shortest expiry that works    15 minutes for a download, not 24 hours
Narrowest permission          r, not rwd
Narrowest scope               one blob, not the container
HTTPS only                    always
IP restriction                where the caller's address is known
```

```bash
az storage blob generate-sas \
  --account-name stshopprod --container-name uploads --name inv-1042.pdf \
  --permissions r --expiry "$END" --https-only \
  --ip 203.0.113.0-203.0.113.255 \
  --auth-mode login --as-user --full-uri
```

**A SAS in a URL is in the browser history, in server logs and in the referrer header.** Treat it as public for its lifetime, which is why the lifetime should be short.

## Stored access policies

For a service SAS, a stored access policy makes revocation possible.

```bash
az storage container policy create \
  --container-name uploads --name partner-read \
  --account-name stshopprod --permissions r \
  --expiry 2026-12-31T23:59Z --auth-mode login

az storage blob generate-sas \
  --account-name stshopprod --container-name uploads --name inv-1042.pdf \
  --policy-name partner-read --auth-mode login --full-uri

# revoke every SAS issued under it
az storage container policy delete \
  --container-name uploads --name partner-read --account-name stshopprod --auth-mode login
```

Without a policy, revoking a service SAS means rotating the account key, which breaks everything else using it. This is the reason stored access policies exist.

## Network rules

```bash
az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --default-action Deny --bypass AzureServices

az storage account network-rule add --account-name stshopprod \
  --resource-group rg-shop-prod-uks \
  --vnet-name vnet-shop-prod-uks --subnet snet-app

az storage account network-rule add --account-name stshopprod \
  --resource-group rg-shop-prod-uks --ip-address 203.0.113.10
```

`--default-action Deny` is the important part. Without it the account accepts traffic from anywhere, whatever else you configure.

`--bypass AzureServices` allows trusted Microsoft services through, which several features need. Removing it breaks things like diagnostic settings and some backup paths.

Better still, use a private endpoint and turn public access off entirely.

## Preventing anonymous containers

```bash
az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --allow-blob-public-access false
```

This stops anyone setting a container to anonymous access. Publicly readable storage containers are a recurring cause of data exposure, and this one flag removes the possibility.

Enforce it across the estate with Azure Policy rather than per account.

## Auditing

```bash
az monitor diagnostic-settings create \
  --name storage-logs \
  --resource /subscriptions/.../storageAccounts/stshopprod/blobServices/default \
  --workspace /subscriptions/.../workspaces/law-shop \
  --logs '[{"category":"StorageRead","enabled":true},{"category":"StorageWrite","enabled":true},{"category":"StorageDelete","enabled":true}]'
```

```kusto
StorageBlobLogs
| where TimeGenerated > ago(24h)
| where StatusCode >= 400
| summarize count() by OperationName, StatusText, CallerIpAddress
| order by count_ desc

StorageBlobLogs
| where OperationName == "DeleteBlob"
| project TimeGenerated, Uri, RequesterObjectId, CallerIpAddress
```

Deletion logging is worth having before you need it. Answering "who deleted this and when" without logs is not possible.

## Quick recap

- Prefer Entra ID with data plane roles, then user delegation SAS, then service SAS, then never account keys.
- Query `StorageBlobLogs` for `AccountKey` authentication to find what to fix before disabling keys.
- `--as-user` gives a user delegation SAS signed by Entra ID, revocable without rotating keys.
- A SAS in a URL appears in history, logs and referrer headers, so keep expiry short.
- Stored access policies are what make a service SAS revocable.
- `--default-action Deny` is what actually closes the account, and bypass keeps trusted services working.
- Disable public blob access account wide, and enforce it with policy.

<code id="code-content" class="language-bash">
# FOUR WAYS IN, RANKED:
#   Entra ID + RBAC      best. Per identity, auditable, revocable, no secret.
#   user delegation SAS  good. Signed by Entra ID, not the account key.
#   service SAS          acceptable. Key signed, so revocation is blunt.
#   account key          worst. Full access to everything, forever.
# The goal is to reach a point where ACCOUNT KEYS ARE DISABLED.
az role assignment create --assignee-object-id "$PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" \
  --scope /subscriptions/.../storageAccounts/stshopprod
# These are DATA PLANE roles. Owner on the account lets you change settings
# and read the keys, and does NOT let you read a blob.
az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --allow-shared-key-access false
# FIND THE CALLERS FIRST. This query IS the migration plan:
#   StorageBlobLogs | where AuthenticationType == "AccountKey"
#   | summarize count() by CallerIpAddress, UserAgentHeader | order by count_ desc
# WHEN YOU MUST HAND OUT A URL: --as-user makes it a USER DELEGATION SAS,
# signed by Entra ID. Revocable without rotating account keys, max 7 days.
az storage blob generate-sas --account-name stshopprod --container-name uploads \
  --name invoices/inv-1042.pdf --permissions r --expiry "$END" \
  --https-only --auth-mode login --as-user --full-uri
# A SAS IN A URL IS IN BROWSER HISTORY, SERVER LOGS AND THE REFERRER HEADER.
# Treat it as public for its lifetime, which is why the lifetime is short.
#   shortest expiry that works | narrowest permission (r, not rwd)
#   narrowest scope (one blob) | HTTPS only | IP restrict where you can
# STORED ACCESS POLICIES are what make a SERVICE SAS revocable. Without one,
# revoking means ROTATING THE ACCOUNT KEY, breaking everything else.
az storage container policy create --container-name uploads --name partner-read \
  --account-name stshopprod --permissions r --expiry 2026-12-31T23:59Z --auth-mode login
az storage container policy delete --container-name uploads --name partner-read \
  --account-name stshopprod --auth-mode login   # revokes every SAS under it
# --default-action Deny IS THE IMPORTANT PART. Without it the account
# accepts traffic from anywhere, whatever else you configure. Keep the
# AzureServices bypass or diagnostics and some backups break.
az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --default-action Deny --bypass AzureServices
az storage account network-rule add --account-name stshopprod \
  --resource-group rg-shop-prod-uks --vnet-name vnet-shop-prod-uks --subnet snet-app
# ONE FLAG REMOVES A WHOLE CLASS OF DATA EXPOSURE. Enforce it with Policy:
az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --allow-blob-public-access false
# LOG DELETIONS BEFORE YOU NEED TO. "Who deleted this and when" is not
# answerable afterwards without them.
#   StorageBlobLogs | where OperationName == "DeleteBlob"
#   | project TimeGenerated, Uri, RequesterObjectId, CallerIpAddress
</code></pre>
