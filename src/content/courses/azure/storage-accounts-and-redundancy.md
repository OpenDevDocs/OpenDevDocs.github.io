---
publishDate: 2026-10-12T08:55
title: Storage Accounts and Redundancy
slug: storage-accounts-and-redundancy
metadescription: Create Azure storage accounts, choose the right redundancy option, and understand what each one actually protects against.
updateDate: 2026-09-07T08:55
author: ['bishal-biswas']
level: 1
tags: ['storage', 'redundancy', 'fundamentals']
course: azure
---

## One account, several services

```text
Blob    objects: files, images, backups, logs
File    SMB and NFS shares that can be mounted
Queue   simple messages, up to 64 KB
Table   NoSQL key value storage, cheap
```

```bash
az storage account create \
  --name stshopprod --resource-group rg-shop-prod-uks \
  --location uksouth \
  --sku Standard_ZRS \
  --kind StorageV2 \
  --access-tier Hot \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false \
  --allow-shared-key-access false \
  --https-only true
```

The name is globally unique, 3 to 24 characters, lowercase letters and numbers only. No hyphens, which is why storage account names look different from everything else.

## The security flags matter

```text
--allow-blob-public-access false   nobody can make a container anonymous
--allow-shared-key-access false    account keys stop working, forcing Entra ID
--min-tls-version TLS1_2           no old TLS
--https-only true                  no plain HTTP
```

`--allow-shared-key-access false` is the significant one. Account keys are two long lived credentials with full access to everything in the account. Disabling them forces every caller to use Entra ID and RBAC, which means access can be scoped, audited and revoked per identity.

Do it on new accounts from the start. Retrofitting it means finding everything that uses a key first.

## Redundancy

This is the choice people get wrong, so it is worth being precise about what each option protects against.

```text
LRS    3 copies in ONE datacentre.
       Protects against: disk and server failure.
       Does not protect against: losing the datacentre.

ZRS    3 copies across THREE availability zones in one region.
       Protects against: an entire datacentre failing.
       Does not protect against: losing the region.

GRS    LRS locally, plus async replication to the paired region.
       Protects against: losing the region.
       Secondary is NOT readable until a failover.

GZRS   ZRS locally, plus async replication to the paired region.
       The strongest option. Zone and region protection.

RA-GRS / RA-GZRS   as above, plus a readable secondary endpoint.
```

**ZRS is the sensible default in any region that supports zones.** It costs modestly more than LRS and removes the most likely serious failure, which is one datacentre going down.

```bash
az storage account update --name stshopprod --resource-group rg-shop-prod-uks --sku Standard_GZRS
```

## Geo redundancy is not a backup

The point people miss: geo replication copies **everything**, including mistakes.

```text
Delete a blob     the deletion replicates
Encrypt with ransomware   the encryption replicates
Corrupt a file    the corruption replicates
```

Geo redundancy protects against Azure losing a region. It does not protect against you. For that you need soft delete, versioning and, for anything important, actual backups.

```bash
az storage account blob-service-properties update \
  --account-name stshopprod --resource-group rg-shop-prod-uks \
  --enable-delete-retention true --delete-retention-days 30 \
  --enable-container-delete-retention true --container-delete-retention-days 30 \
  --enable-versioning true \
  --enable-change-feed true
```

Soft delete and versioning are cheap and prevent the most common data loss, which is somebody deleting the wrong thing.

## Replication is asynchronous

```bash
az storage account show --name stshopprod --resource-group rg-shop-prod-uks \
  --query "{Last:geoReplicationStats.lastSyncTime, Status:geoReplicationStats.status}" \
  --expand geoReplicationStats
```

`lastSyncTime` tells you what the secondary actually has. Everything written after it is not yet replicated and would be lost in an unplanned failover.

That gap is usually seconds and can grow under heavy write load. Plan for a non zero recovery point objective with geo redundancy, because there is one.

## Failover

```bash
az storage account failover --name stshopprod --resource-group rg-shop-prod-uks
```

Customer initiated failover promotes the secondary. Two things to understand before using it:

**Data after `lastSyncTime` is lost.** Unreplicated writes are gone.

**The account becomes LRS in the new region.** You must reconfigure geo redundancy afterwards, and that re-replication takes time and money.

Failover is a real decision, not a button to press during a brief blip.

## Performance tiers

```text
Standard  magnetic backed. Most workloads. Cheaper.
Premium   SSD backed. Low latency, high transaction rates.
```

Premium comes in specialised account kinds:

```bash
az storage account create --name stshopfast --resource-group rg-shop-prod-uks \
  --sku Premium_LRS --kind BlockBlobStorage --location uksouth
```

```text
Premium BlockBlobStorage  low latency blobs, high transactions, no cool tier
Premium FileStorage       SMB and NFS with low latency
Premium PageBlobStorage   unmanaged disks, rare now
```

Premium blob storage costs more per gigabyte and much less per transaction. For workloads with millions of small operations it can be cheaper overall, which is counterintuitive and occasionally important.

## Access tiers

```bash
az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --access-tier Cool
```

```text
Hot      frequent access. Highest storage cost, lowest access cost.
Cool     30 days minimum. Cheaper storage, more per read.
Cold     90 days minimum. Cheaper again.
Archive  180 days minimum. Cheapest, and rehydration takes HOURS.
```

The account tier is the default for new blobs. Individual blobs can be set differently, and lifecycle management moves them automatically.

**Early deletion charges apply.** Deleting from Cool after ten days bills as though it had been there thirty. That surprises people running cleanup jobs.

## Encryption

Everything is encrypted at rest with Microsoft managed keys, always, at no cost. Customer managed keys are for compliance requirements:

```bash
az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --encryption-key-source Microsoft.Keyvault \
  --encryption-key-vault https://kv-shop-prod.vault.azure.net \
  --encryption-key-name storage-cmk --encryption-key-version "" \
  --identity-type SystemAssigned
```

An empty key version means automatic rotation is followed. Note that losing the key means losing the data, which is the point and also the risk.

## Watching it

```bash
az storage account show-usage --location uksouth

az monitor metrics list \
  --resource /subscriptions/.../storageAccounts/stshopprod \
  --metric UsedCapacity Transactions Availability \
  --interval PT1H --output table

az storage account list \
  --query "[].{Name:name, Sku:sku.name, Tier:accessTier, Https:enableHttpsTrafficOnly, SharedKey:allowSharedKeyAccess}" \
  --output table
```

That last command is a useful audit. Any account with `SharedKey: true` is one where long lived keys still work.

## Quick recap

- Storage account names are globally unique, lowercase and numbers only.
- Disable shared key access on new accounts so everything uses Entra ID and RBAC.
- ZRS is the sensible default, since it survives one datacentre failing.
- Geo redundancy replicates mistakes too, so it is not a backup.
- Enable soft delete and versioning, which prevent the most common data loss cheaply.
- Check `lastSyncTime` to know what the secondary actually has, since replication is asynchronous.
- Failover loses unreplicated data and leaves the account as LRS in the new region.

<code id="code-content" class="language-bash">
# One account, four services: blob, file, queue and table. The name is
# GLOBALLY UNIQUE, 3 to 24 chars, lowercase and numbers only, no hyphens.
az storage account create --name stshopprod --resource-group rg-shop-prod-uks \
  --location uksouth --sku Standard_ZRS --kind StorageV2 --access-tier Hot \
  --min-tls-version TLS1_2 --allow-blob-public-access false \
  --allow-shared-key-access false --https-only true
# --allow-shared-key-access false IS THE SIGNIFICANT ONE. Account keys are
# two long lived credentials with FULL ACCESS to everything. Disabling them
# forces Entra ID and RBAC, so access is scoped, audited and revocable.
# Do it on NEW accounts: retrofitting means finding every key user first.
# REDUNDANCY, precisely:
#   LRS   3 copies in ONE datacentre. Survives disk and server failure.
#   ZRS   3 copies across THREE ZONES. Survives a datacentre failing.
#   GRS   LRS + async copy to the paired region. Secondary NOT readable.
#   GZRS  ZRS + async copy to the paired region. The strongest.
#   RA-*  adds a readable secondary endpoint.
# ZRS IS THE SENSIBLE DEFAULT wherever zones exist: modestly more than LRS,
# and it removes the most likely serious failure.
# GEO REDUNDANCY IS NOT A BACKUP. It replicates EVERYTHING, INCLUDING YOUR
# MISTAKES: a deletion replicates, ransomware encryption replicates,
# corruption replicates. It protects against AZURE losing a region, not you.
az storage account blob-service-properties update --account-name stshopprod \
  --resource-group rg-shop-prod-uks --enable-delete-retention true \
  --delete-retention-days 30 --enable-versioning true --enable-change-feed true
# REPLICATION IS ASYNCHRONOUS. lastSyncTime is what the secondary ACTUALLY
# has. Everything after it would be LOST in an unplanned failover.
az storage account show --name stshopprod --resource-group rg-shop-prod-uks \
  --expand geoReplicationStats \
  --query "{Last:geoReplicationStats.lastSyncTime, Status:geoReplicationStats.status}"
# FAILOVER IS A REAL DECISION, not a button for a brief blip. Data after
# lastSyncTime is LOST, and the account becomes LRS in the new region, so
# you must reconfigure geo redundancy afterwards at cost and time.
az storage account failover --name stshopprod --resource-group rg-shop-prod-uks
# ACCESS TIERS. EARLY DELETION IS CHARGED: removing from Cool after ten days
# bills as thirty. Cleanup jobs discover this the expensive way.
#   Hot | Cool 30 days | Cold 90 days | Archive 180 days, HOURS to rehydrate
# Premium costs more per GB and MUCH LESS PER TRANSACTION, so millions of
# small operations can be cheaper on Premium. Counterintuitive, occasionally
# important.
# A USEFUL AUDIT. Any account with SharedKey true still accepts long lived keys:
az storage account list --output table \
  --query "[].{Name:name, Sku:sku.name, Tier:accessTier, SharedKey:allowSharedKeyAccess}"
</code></pre>
