---
publishDate: 2026-10-13T09:20
title: Data Lake Storage Gen2
slug: data-lake-storage
metadescription: Use Azure Data Lake Storage Gen2 for analytics data, with hierarchical namespaces, POSIX ACLs and a folder layout that queries well.
updateDate: 2026-09-07T09:20
author: ['bishal-biswas']
level: 3
tags: ['storage', 'data lake', 'analytics']
course: azure
---

## What Gen2 adds

Data Lake Storage Gen2 is a storage account with the **hierarchical namespace** enabled. That one flag changes the behaviour substantially.

```bash
az storage account create \
  --name stshoplake --resource-group rg-shop-data-uks \
  --location uksouth --sku Standard_ZRS --kind StorageV2 \
  --enable-hierarchical-namespace true \
  --allow-shared-key-access false
```

```text
Without HNS   flat names with slashes. Renaming a "folder" copies every blob.
With HNS      real directories. Renaming is an atomic metadata operation.
```

Renaming a directory with a million files under a flat namespace means a million copy and delete operations. With a hierarchical namespace it is one operation, instantly.

That is why analytics engines care: they write to temporary directories and rename them on commit.

```text
Also gained:  POSIX ACLs per file and directory
              directory level operations
              better performance for analytics access patterns
Also lost:    a few blob features, and it CANNOT BE TURNED ON LATER
```

**The hierarchical namespace must be set at creation.** Migrating an existing account means creating a new one and copying data.

## Filesystems and paths

```bash
az storage fs create --name raw --account-name stshoplake --auth-mode login

az storage fs directory create --name "sales/2026/09/07" \
  --file-system raw --account-name stshoplake --auth-mode login

az storage fs file upload \
  --source ./sales-20260907.parquet \
  --path "sales/2026/09/07/sales.parquet" \
  --file-system raw --account-name stshoplake --auth-mode login

az storage fs file list --file-system raw --path "sales/2026/09" \
  --account-name stshoplake --auth-mode login --recursive \
  --query "[].{Name:name, Size:contentLength}" -o table
```

A filesystem is what a container is called here. The API surface is `az storage fs` rather than `az storage blob`, though blob APIs still work on the same data.

## The medallion layout

The convention most data platforms follow:

```text
raw       (bronze)  exactly as it arrived, never modified
curated   (silver)  cleaned, typed, deduplicated
serving   (gold)    aggregated, modelled for consumption
```

Separate filesystems, separate permissions. Raw is append only and nobody queries it directly. Serving is what analysts and reports use.

Keeping raw untouched means you can rebuild everything downstream when a transformation turns out to be wrong, and it will.

## Partitioning

The single most important design decision, because it determines how much data a query has to read.

```text
raw/sales/year=2026/month=09/day=07/hour=14/part-0001.parquet
```

The `key=value` form is Hive style partitioning, and query engines understand it. A query filtered to September reads only that directory.

```sql
SELECT SUM(total)
FROM sales
WHERE year = 2026 AND month = 9;
```

That reads one month rather than the whole dataset, purely from the folder layout.

```text
Too coarse   year only, so every query scans a year
Too fine     one directory per minute, and the file count becomes the problem
About right  daily for most, hourly for high volume
```

## The small file problem

```text
1,000 files of 100 MB    good
1,000,000 files of 100 KB  bad, and much slower
```

Each file has overhead: a listing entry, a metadata read, a connection. Millions of small files make queries slow regardless of total size.

The fix is compaction: a scheduled job that rewrites many small files into fewer large ones. Target 100 MB to 1 GB per file.

Streaming ingestion produces small files by nature, so compaction is not optional when you have streaming sources.

## File formats

```text
CSV      readable, no schema, slow, large
JSON     flexible, verbose, slow to scan
Parquet  columnar, compressed, typed. The default choice.
Delta    Parquet plus a transaction log: ACID, time travel, updates
Iceberg  similar goals, growing support
```

Parquet is columnar, so a query reading two columns from a fifty column table reads two columns' worth of data. Combined with compression that is often a tenfold reduction over CSV.

Delta Lake adds a transaction log on top, which brings updates, deletes, concurrent writers and time travel to files that otherwise have none of it.

Land raw data in whatever form it arrives, and convert to Parquet or Delta in the curated layer.

## Access control

Two systems, working together.

```bash
# RBAC: coarse, at container or account level
az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/.../storageAccounts/stshoplake/blobServices/default/containers/curated

# ACLs: fine grained, per directory and file
az storage fs access set \
  --acl "user::rwx,group::r-x,other::---,user:$PRINCIPAL_ID:r-x" \
  --path "sales/2026" --file-system raw \
  --account-name stshoplake --auth-mode login

# default ACLs are inherited by NEW children only
az storage fs access set \
  --acl "default:user:$PRINCIPAL_ID:r-x" \
  --path "sales" --file-system raw --account-name stshoplake --auth-mode login
```

```text
RBAC applies first. A data plane role grants access regardless of ACLs.
ACLs apply where RBAC does not grant it.
Default ACLs are inherited by NEW children, not applied retroactively.
```

That last point catches people. Setting a default ACL does nothing to existing files, so it must be applied recursively as well:

```bash
az storage fs access update-recursive \
  --acl "user:$PRINCIPAL_ID:r-x" --path "sales" \
  --file-system raw --account-name stshoplake --auth-mode login
```

Assign ACLs to **groups**, never to individuals. Recursive ACL updates over millions of files are slow, and doing them per person becomes unmanageable quickly.

## Lifecycle for a lake

```json
{
  "rules": [{
    "enabled": true,
    "name": "raw-tiering",
    "type": "Lifecycle",
    "definition": {
      "filters": { "blobTypes": ["blockBlob"], "prefixMatch": ["raw/"] },
      "actions": {
        "baseBlob": {
          "tierToCool": { "daysAfterModificationGreaterThan": 30 },
          "tierToArchive": { "daysAfterModificationGreaterThan": 365 }
        }
      }
    }
  }]
}
```

Raw data is written once and read rarely, which is exactly what Cool and Archive are for. Curated and serving data stays Hot because it is queried.

Lakes grow indefinitely without a policy, and the bill grows with them.

## Querying without moving data

```sql
SELECT TOP 100 *
FROM OPENROWSET(
    BULK 'https://stshoplake.dfs.core.windows.net/curated/sales/year=2026/month=09/*.parquet',
    FORMAT = 'PARQUET'
) AS rows;
```

Synapse serverless SQL, Databricks and Microsoft Fabric all read directly from the lake. There is no load step, and you pay per query rather than for a running warehouse.

Note the `dfs.core.windows.net` endpoint, which is the Data Lake endpoint. `blob.core.windows.net` also works on the same data but does not support directory semantics, and mixing them causes confusing behaviour.

## Quick recap

- The hierarchical namespace makes directory rename atomic, and must be set at creation.
- Use the medallion layout, keeping raw untouched so downstream work can be rebuilt.
- Hive style `key=value` partitioning is what lets a query read one month instead of everything.
- Millions of small files are slow whatever the total size, so compact to 100 MB or larger.
- Parquet is the default format, and Delta adds transactions and time travel.
- RBAC applies before ACLs, and default ACLs affect only new children.
- Use the `dfs` endpoint for directory semantics, and assign ACLs to groups.

<code id="code-content" class="language-bash">
# Gen2 is a storage account with the HIERARCHICAL NAMESPACE enabled, and
# that one flag changes everything.
az storage account create --name stshoplake --resource-group rg-shop-data-uks \
  --sku Standard_ZRS --kind StorageV2 --enable-hierarchical-namespace true \
  --allow-shared-key-access false
# WITHOUT HNS renaming a "folder" of a million files is a MILLION copy and
# delete operations. WITH HNS it is ONE ATOMIC METADATA OPERATION. That is
# why analytics engines care: they write to temp directories and rename on
# commit. IT CANNOT BE ENABLED LATER. New account, copy the data.
az storage fs create --name raw --account-name stshoplake --auth-mode login
# THE MEDALLION LAYOUT: raw (bronze, never modified), curated (silver,
# cleaned), serving (gold, aggregated). Keeping raw UNTOUCHED means you can
# rebuild everything downstream when a transformation turns out to be
# wrong, and it will.
# PARTITIONING IS THE MOST IMPORTANT DECISION. Hive style key=value is
# understood by every engine, so a filtered query reads ONE DIRECTORY:
#   raw/sales/year=2026/month=09/day=07/part-0001.parquet
#   too coarse: year only, every query scans a year
#   too fine:   per minute, and file COUNT becomes the problem
#   about right: daily, or hourly for high volume
# THE SMALL FILE PROBLEM: 1,000 x 100 MB is good. 1,000,000 x 100 KB is bad
# and MUCH slower, whatever the total size. Compact to 100 MB - 1 GB files.
# Streaming ingestion produces small files by nature, so this is not optional.
# FORMATS: Parquet is columnar, so reading 2 of 50 columns reads 2 columns
# of data. Often tenfold smaller than CSV. Delta adds a transaction log:
# ACID, updates, concurrent writers, time travel.
# TWO ACCESS SYSTEMS. RBAC applies FIRST and grants regardless of ACLs.
# ACLs are per directory and file, for what RBAC does not grant.
az storage fs access set --acl "user::rwx,group::r-x,other::---" \
  --path "sales/2026" --file-system raw --account-name stshoplake --auth-mode login
# DEFAULT ACLs APPLY TO NEW CHILDREN ONLY, never retroactively. This
# catches people. For existing data you must go recursive:
az storage fs access update-recursive --acl "user:$PRINCIPAL_ID:r-x" \
  --path "sales" --file-system raw --account-name stshoplake --auth-mode login
# ASSIGN ACLs TO GROUPS. Recursive updates over millions of files are slow,
# and doing them per person becomes unmanageable fast.
# LAKES GROW FOREVER. Raw is written once and read rarely, which is exactly
# what Cool and Archive are for. Curated and serving stay Hot.
# QUERY IN PLACE, no load step, paying per query:
#   SELECT TOP 100 * FROM OPENROWSET(
#     BULK 'https://stshoplake.dfs.core.windows.net/curated/sales/*.parquet',
#     FORMAT='PARQUET') AS rows;
# NOTE dfs.core.windows.net, the Data Lake endpoint. blob.core.windows.net
# reads the same data WITHOUT directory semantics, and mixing them is confusing.
</code></pre>
