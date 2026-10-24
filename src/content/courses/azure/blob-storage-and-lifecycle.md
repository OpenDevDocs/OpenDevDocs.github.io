---
publishDate: 2026-10-12T09:00
title: Blob Storage, Tiers and Lifecycle Management
slug: blob-storage-and-lifecycle
metadescription: Store objects in Azure Blob Storage, choose the right access tier, and move data between tiers automatically with lifecycle rules.
updateDate: 2026-09-07T09:00
author: ['bishal-biswas']
level: 2
tags: ['storage', 'blob', 'lifecycle']
course: azure
---

## Containers and blobs

```bash
az storage container create \
  --name uploads --account-name stshopprod --auth-mode login

az storage blob upload \
  --account-name stshopprod --container-name uploads \
  --name invoices/2026/09/inv-1042.pdf --file ./inv-1042.pdf \
  --auth-mode login --overwrite

az storage blob list \
  --account-name stshopprod --container-name uploads \
  --prefix invoices/2026/09/ --auth-mode login \
  --query "[].{Name:name, Size:properties.contentLength, Tier:properties.blobTier}" -o table
```

`--auth-mode login` uses your Entra ID identity rather than an account key. Make it a habit, because the alternative is passing keys around.

**There are no real folders.** `invoices/2026/09/inv-1042.pdf` is one flat blob name containing slashes. The portal renders it as a hierarchy, and listing by prefix is what makes it behave like one.

That matters for performance: listing a container with millions of blobs is slow, and a good prefix scheme is how you avoid it.

## Blob types

```text
Block blob   the normal one. Files, images, documents, backups.
Append blob  optimised for appending. Logs.
Page blob    random access, 512 byte pages. Virtual machine disks.
```

Use block blobs unless you have a specific reason not to.

## Access tiers

```bash
az storage blob set-tier \
  --account-name stshopprod --container-name uploads \
  --name invoices/2024/01/inv-0001.pdf --tier Archive --auth-mode login
```

```text
Hot      frequent access. Highest storage price, lowest access price.
Cool     30 day minimum. Backups, older documents.
Cold     90 day minimum. Rarely touched, still online.
Archive  180 day minimum. OFFLINE. Rehydration takes hours.
```

**Archive is offline.** You cannot read an archived blob at all until it is rehydrated, which takes up to 15 hours at standard priority or about an hour at high priority for smaller blobs.

```bash
az storage blob set-tier \
  --account-name stshopprod --container-name uploads \
  --name invoices/2024/01/inv-0001.pdf --tier Hot \
  --rehydrate-priority High --auth-mode login
```

Archive is right for compliance retention nobody expects to read. It is wrong for anything a user might request, because "your document will be available in several hours" is rarely acceptable.

**Early deletion is charged.** Deleting from Cool at day ten bills all thirty days. Deleting from Archive at day thirty bills all one hundred and eighty. Cleanup jobs that ignore this get expensive.

## Lifecycle management

Doing tier moves by hand does not scale. A lifecycle policy does it automatically.

```json
{
  "rules": [
    {
      "enabled": true,
      "name": "invoices-tiering",
      "type": "Lifecycle",
      "definition": {
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["uploads/invoices/"]
        },
        "actions": {
          "baseBlob": {
            "tierToCool": { "daysAfterModificationGreaterThan": 30 },
            "tierToCold": { "daysAfterModificationGreaterThan": 90 },
            "tierToArchive": { "daysAfterModificationGreaterThan": 365 },
            "delete": { "daysAfterModificationGreaterThan": 2555 }
          },
          "snapshot": {
            "delete": { "daysAfterCreationGreaterThan": 90 }
          },
          "version": {
            "delete": { "daysAfterCreationGreaterThan": 90 }
          }
        }
      }
    }
  ]
}
```

```bash
az storage account management-policy create \
  --account-name stshopprod --resource-group rg-shop-prod-uks \
  --policy @lifecycle.json
```

Seven years of invoices, moving through tiers and deleted at the end, with nobody remembering to do it.

**Rules run once a day and can take up to 48 hours to take effect** after being created. They are not immediate, and testing them requires patience.

Note `daysAfterLastAccessTimeGreaterThan` is available when access time tracking is enabled, which is a better signal than modification time for read heavy data:

```bash
az storage account management-policy ... # with access tracking enabled first
az storage account blob-service-properties update \
  --account-name stshopprod --resource-group rg-shop-prod-uks \
  --enable-last-access-tracking true
```

## Soft delete and versioning

```bash
az storage account blob-service-properties update \
  --account-name stshopprod --resource-group rg-shop-prod-uks \
  --enable-delete-retention true --delete-retention-days 30 \
  --enable-versioning true
```

```text
Soft delete   a deleted blob is recoverable for N days
Versioning    every overwrite keeps the previous version
```

Both are cheap and both have saved people. Versioning does mean overwrites accumulate, so pair it with a lifecycle rule deleting old versions, as in the policy above.

```bash
az storage blob list --account-name stshopprod --container-name uploads \
  --include vd --auth-mode login \
  --query "[].{Name:name, Version:versionId, Deleted:deleted}" -o table

az storage blob undelete --account-name stshopprod \
  --container-name uploads --name invoices/2026/09/inv-1042.pdf --auth-mode login
```

## Uploading from code

```csharp
var client = new BlobServiceClient(
    new Uri("https://stshopprod.blob.core.windows.net"),
    new DefaultAzureCredential());

var container = client.GetBlobContainerClient("uploads");
await container.CreateIfNotExistsAsync();

var blob = container.GetBlobClient($"invoices/{year}/{month}/{fileName}");

await blob.UploadAsync(stream, new BlobUploadOptions
{
    HttpHeaders = new BlobHttpHeaders
    {
        ContentType = "application/pdf",
        CacheControl = "public, max-age=31536000, immutable"
    },
    Metadata = new Dictionary<string, string>
    {
        ["customerId"] = customerId,
        ["uploadedBy"] = userId
    },
    AccessTier = AccessTier.Hot
});
```

Set `ContentType`, or browsers download the file instead of displaying it. Set `CacheControl` for anything served publicly, since a CDN respects it.

Metadata is key value pairs stored with the blob, useful for filtering without a separate database.

## Large uploads

```csharp
await blob.UploadAsync(stream, new BlobUploadOptions
{
    TransferOptions = new StorageTransferOptions
    {
        MaximumConcurrency = 8,
        InitialTransferSize = 4 * 1024 * 1024,
        MaximumTransferSize = 8 * 1024 * 1024
    }
});
```

The SDK splits large uploads into blocks and uploads them in parallel. Raising concurrency helps considerably on fast connections.

```bash
azcopy copy "./backups/*" \
  "https://stshopprod.blob.core.windows.net/backups?<SAS>" \
  --recursive --block-size-mb 16
```

For bulk transfer, `azcopy` is far faster than the CLI and handles resume.

## Static websites

```bash
az storage blob service-properties update \
  --account-name stshopweb --static-website \
  --index-document index.html --404-document 404.html

az storage blob upload-batch \
  --account-name stshopweb --source ./dist --destination '$web' --auth-mode login
```

Cheap static hosting from the `$web` container. Static Web Apps is usually the better option because it adds a CDN, authentication and preview environments, but this is available and costs almost nothing.

## Immutability

```bash
az storage container immutability-policy create \
  --account-name stshopprod --container-name audit-logs \
  --resource-group rg-shop-prod-uks --period 2555

az storage container immutability-policy lock \
  --account-name stshopprod --container-name audit-logs \
  --resource-group rg-shop-prod-uks --if-match '*'
```

A time based retention policy makes blobs write once read many. Once **locked**, nobody can delete or modify them until the period expires, including a subscription owner.

That is the point for regulatory retention, and it is also the risk: a locked policy of seven years cannot be shortened. Test the unlocked version first.

## Costs

```text
Storage       per GB per month, by tier
Transactions  per 10,000 operations, and Cool and Archive cost more per operation
Egress        data leaving the region
Early deletion  as described above
```

Cool storage is roughly half the price of Hot and its transactions cost several times more. Moving frequently read data to Cool to save money often costs more.

Tier by access pattern, not by age alone. That is what access time tracking is for.

## Quick recap

- There are no folders, only blob names with slashes, so a good prefix scheme keeps listings fast.
- Archive is offline and rehydration takes hours, so it is wrong for anything a user might request.
- Early deletion charges apply, and cleanup jobs discover this expensively.
- Lifecycle rules run once a day and can take 48 hours to take effect.
- Enable soft delete and versioning, and add a rule to delete old versions.
- Set `ContentType` on upload, or browsers download instead of displaying.
- Cool costs less to store and more per transaction, so tier by access pattern rather than age.

<code id="code-content" class="language-bash">
# --auth-mode login uses YOUR Entra ID identity, not an account key. Habit.
az storage container create --name uploads --account-name stshopprod --auth-mode login
az storage blob upload --account-name stshopprod --container-name uploads \
  --name invoices/2026/09/inv-1042.pdf --file ./inv-1042.pdf --auth-mode login
# THERE ARE NO FOLDERS. That is ONE FLAT BLOB NAME containing slashes. The
# portal renders a hierarchy; listing BY PREFIX is what makes it behave like
# one, and a good prefix scheme is how you avoid slow listings on millions.
# TIERS. ARCHIVE IS OFFLINE: you cannot read the blob AT ALL until it is
# rehydrated, up to 15 hours at standard priority.
#   Hot | Cool 30 day min | Cold 90 day min | Archive 180 day min, OFFLINE
# Right for compliance retention nobody expects to read. WRONG for anything
# a user might request.
# EARLY DELETION IS CHARGED: deleting from Cool at day ten bills thirty;
# from Archive at day thirty bills one hundred and eighty.
# LIFECYCLE RULES do the tiering for you. Seven years of invoices moving
# through tiers and deleted at the end, with nobody remembering.
az storage account management-policy create --account-name stshopprod \
  --resource-group rg-shop-prod-uks --policy @lifecycle.json
#   filters:  { blobTypes: [blockBlob], prefixMatch: ["uploads/invoices/"] }
#   baseBlob: tierToCool 30, tierToCold 90, tierToArchive 365, delete 2555
#   version:  delete 90        &lt;- pair this with versioning, or copies pile up
# RULES RUN ONCE A DAY and can take UP TO 48 HOURS to take effect. Testing
# them requires patience.
# Enable access time tracking and use daysAfterLastAccessTimeGreaterThan,
# which is a better signal than modification time for read heavy data:
az storage account blob-service-properties update --account-name stshopprod \
  --resource-group rg-shop-prod-uks --enable-last-access-tracking true \
  --enable-delete-retention true --delete-retention-days 30 --enable-versioning true
az storage blob undelete --account-name stshopprod --container-name uploads \
  --name invoices/2026/09/inv-1042.pdf --auth-mode login
# SET ContentType ON UPLOAD, or browsers DOWNLOAD the file instead of
# displaying it. Set CacheControl for anything a CDN will serve.
# For bulk transfer azcopy is far faster than the CLI and resumes:
azcopy copy "./backups/*" "https://stshopprod.blob.core.windows.net/backups?&lt;SAS&gt;" \
  --recursive --block-size-mb 16
# IMMUTABILITY: once LOCKED, nobody can delete or modify until the period
# expires, INCLUDING a subscription owner. That is the point, and the risk:
# a locked seven year policy CANNOT BE SHORTENED. Test unlocked first.
az storage container immutability-policy create --account-name stshopprod \
  --container-name audit-logs --resource-group rg-shop-prod-uks --period 2555
# COST TRAP: Cool is about half the storage price and SEVERAL TIMES the
# transaction price. Moving frequently read data to Cool often costs MORE.
# Tier by ACCESS PATTERN, not by age alone.
</code></pre>
