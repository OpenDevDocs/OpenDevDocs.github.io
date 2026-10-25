---
publishDate: 2026-10-14T09:30
title: 'Azure SQL: Tiers, DTUs and vCores'
slug: azure-sql-performance-and-tiers
metadescription: Choose an Azure SQL service tier and size, understand DTUs against vCores, and diagnose throttling before scaling up.
updateDate: 2026-09-07T09:30
author: ['bishal-biswas']
level: 2
tags: ['databases', 'sql', 'performance']
course: azure
---

## Two purchasing models

```text
DTU     a blended unit of CPU, memory and IO. Simple, opaque, legacy.
vCore   CPU and memory sized separately, storage priced separately.
```

**Use vCore for anything new.** DTU still exists and is only worth knowing about because existing databases use it, and because the Basic and Standard DTU tiers are cheap for very small databases.

```bash
az sql db update --name shop --server sql-shop-prod --resource-group rg-shop-prod-uks \
  --edition GeneralPurpose --family Gen5 --capacity 4
```

vCore also unlocks Azure Hybrid Benefit, which applies existing SQL Server licences and reduces cost substantially:

```bash
az sql db update --name shop --server sql-shop-prod \
  --resource-group rg-shop-prod-uks --license-type BasePrice
```

## Service tiers

```text
General Purpose    remote storage, 5 to 10ms latency. Most workloads.
Business Critical  local SSD, sub millisecond latency, a free readable replica.
Hyperscale         storage up to 128 TB, fast restores, many read replicas.
```

The difference between General Purpose and Business Critical is where the data lives. General Purpose uses remote premium storage; Business Critical uses local SSD with an always on availability group of four replicas.

Business Critical costs roughly three times as much and gives an order of magnitude better IO latency, plus a read replica at no extra charge.

```bash
az sql db update --name shop --server sql-shop-prod --resource-group rg-shop-prod-uks \
  --edition BusinessCritical --family Gen5 --capacity 8 --zone-redundant true
```

## Hyperscale

```bash
az sql db update --name shop --server sql-shop-prod --resource-group rg-shop-prod-uks \
  --edition Hyperscale --family Gen5 --capacity 8 --ha-replicas 2
```

Hyperscale separates compute from storage with a distributed log service, which changes the operational characteristics:

```text
Storage grows automatically to 128 TB
Restore time is minutes regardless of size, since it is snapshot based
Up to 4 named read replicas
Scaling compute takes minutes, not hours
```

The tradeoff is that some things behave differently, and moving out of Hyperscale to another tier requires a full export and import. Going in is easy, coming out is not.

For a large or fast growing database, Hyperscale is usually right. For a 50 GB database it is unnecessary.

## Reading actual usage

Do not size by guessing. Measure.

```sql
SELECT TOP 60
    end_time,
    avg_cpu_percent,
    avg_data_io_percent,
    avg_log_write_percent,
    max_worker_percent,
    max_session_percent
FROM sys.dm_db_resource_stats
ORDER BY end_time DESC;
```

That view holds 15 second samples for the last hour. For longer history:

```sql
SELECT
    start_time,
    avg_cpu_percent,
    avg_data_io_percent,
    avg_log_write_percent
FROM sys.resource_stats
WHERE database_name = 'shop'
  AND start_time > DATEADD(day, -14, GETUTCDATE())
ORDER BY start_time DESC;
```

`sys.resource_stats` keeps 14 days at 5 minute granularity, on the `master` database.

```text
avg_cpu_percent consistently above 80    scale up
avg_data_io_percent at 100               IO bound. Business Critical, or fix queries.
avg_log_write_percent at 100             write throughput limit. Batch smaller.
max_worker_percent near 100              too many concurrent requests, often blocking
```

## Throttling looks like slowness

When a database hits its limit, requests queue rather than failing outright. The symptom is uniform slowness, and the cause is a resource ceiling.

```sql
SELECT
    wait_type,
    wait_time_ms / 1000.0 AS wait_seconds,
    waiting_tasks_count
FROM sys.dm_db_wait_stats
ORDER BY wait_time_ms DESC;
```

```text
LOG_RATE_GOVERNOR    hitting the log write limit
SOS_SCHEDULER_YIELD  CPU pressure
PAGEIOLATCH_*        reading from storage, so IO bound
LCK_M_*              blocking, which is a query problem not a size problem
RESOURCE_SEMAPHORE   memory pressure on query workspace
```

`LCK_M_*` waits are worth calling out. Blocking is a concurrency and indexing problem, and scaling up a database to fix blocking wastes money without fixing anything.

## Fix queries before scaling

Scaling up is the easy answer and often the wrong one.

```sql
-- missing indexes the engine wishes existed
SELECT TOP 10
    ROUND(s.avg_total_user_cost * s.avg_user_impact * (s.user_seeks + s.user_scans), 0) AS improvement,
    d.statement,
    d.equality_columns,
    d.inequality_columns,
    d.included_columns
FROM sys.dm_db_missing_index_group_stats s
JOIN sys.dm_db_missing_index_groups g ON s.group_handle = g.index_group_handle
JOIN sys.dm_db_missing_index_details d ON g.index_handle = d.index_handle
ORDER BY improvement DESC;
```

Treat these as suggestions, not instructions. The engine does not consider write cost, and it will happily recommend twelve overlapping indexes.

```sql
-- most expensive queries by total CPU
SELECT TOP 20
    SUBSTRING(t.query_sql_text, 1, 120) AS query_text,
    SUM(rs.count_executions) AS executions,
    SUM(rs.avg_cpu_time * rs.count_executions) / 1000.0 AS total_cpu_ms,
    AVG(rs.avg_duration) / 1000.0 AS avg_ms
FROM sys.query_store_runtime_stats rs
JOIN sys.query_store_plan p ON rs.plan_id = p.plan_id
JOIN sys.query_store_query q ON p.query_id = q.query_id
JOIN sys.query_store_query_text t ON q.query_text_id = t.query_text_id
GROUP BY SUBSTRING(t.query_sql_text, 1, 120)
ORDER BY total_cpu_ms DESC;
```

A query running 200,000 times at 30ms costs more than one running twice at ten seconds. Sort by total cost, not by average duration.

## Read scale out

```bash
az sql db update --name shop --server sql-shop-prod \
  --resource-group rg-shop-prod-uks --read-scale Enabled
```

```csharp
var readOnly = new SqlConnection(
    "Server=sql-shop-prod.database.windows.net;Database=shop;" +
    "ApplicationIntent=ReadOnly;Authentication=Active Directory Default;Encrypt=True;");
```

Business Critical and Hyperscale include readable replicas. `ApplicationIntent=ReadOnly` routes the connection there, taking reporting and analytics load off the primary at no extra cost.

The replica is asynchronous, so reads can be slightly stale. Fine for reports, wrong for read your own writes.

## Automatic tuning

```bash
az sql db update --name shop --server sql-shop-prod --resource-group rg-shop-prod-uks \
  --auto-tuning-server-inherit
```

```sql
ALTER DATABASE shop SET AUTOMATIC_TUNING (
    CREATE_INDEX = ON,
    DROP_INDEX = ON,
    FORCE_LAST_GOOD_PLAN = ON);
```

`FORCE_LAST_GOOD_PLAN` is the one to enable everywhere. When a query regresses because the optimiser chose a worse plan, it reverts to the previous plan automatically and verifies the improvement.

Plan regressions after a statistics update are a classic overnight failure, and this handles them without anyone being paged.

Automatic index creation is more debatable. It works, and some teams prefer to review index changes rather than have them appear.

## Cost control

```bash
az sql db list --server sql-shop-prod --resource-group rg-shop-prod-uks \
  --query "[].{Name:name, Edition:currentSku.name, Capacity:currentSku.capacity, MaxGB:maxSizeBytes}" -o table

az sql db update --name shop --server sql-shop-prod --resource-group rg-shop-prod-uks \
  --capacity 2
```

```text
Reserved capacity     up to 55 percent off for a one or three year commitment
Azure Hybrid Benefit  applies existing SQL Server licences
Serverless            for intermittent workloads
Elastic pools         for many databases with uncorrelated peaks
Dev and test pricing  substantially cheaper for non production
```

Scaling down is as easy as scaling up, and it is worth reviewing quarterly. Databases sized for a launch that never came are common.

## Quick recap

- Use vCore for anything new, since it also unlocks Hybrid Benefit and reserved capacity.
- Business Critical is local SSD with a free readable replica, at roughly three times the cost.
- Hyperscale is easy to move into and requires export and import to leave.
- Size from `sys.dm_db_resource_stats` and `sys.resource_stats`, not from guessing.
- Throttling looks like uniform slowness, and wait statistics say which resource is the ceiling.
- Blocking waits are a query problem, and scaling up does not fix them.
- Enable `FORCE_LAST_GOOD_PLAN`, which handles overnight plan regressions automatically.

<code id="code-content" class="language-sql">
-- TWO PURCHASING MODELS. Use vCORE for anything new: it sizes CPU and
-- memory separately and unlocks Azure Hybrid Benefit and reservations.
-- DTU is a blended, opaque, legacy unit.
--   az sql db update --name shop --server sql-shop-prod \
--     --edition GeneralPurpose --family Gen5 --capacity 4
-- TIERS differ in WHERE THE DATA LIVES:
--   General Purpose    remote storage, 5-10ms. Most workloads.
--   Business Critical  LOCAL SSD, sub millisecond, FREE readable replica.
--                      ~3x the cost.
--   Hyperscale         to 128 TB, restores in MINUTES regardless of size,
--                      up to 4 read replicas. Easy to enter, EXPORT AND
--                      IMPORT TO LEAVE.
-- DO NOT SIZE BY GUESSING. 15 second samples for the last hour:
SELECT TOP 60 end_time, avg_cpu_percent, avg_data_io_percent,
       avg_log_write_percent, max_worker_percent
FROM sys.dm_db_resource_stats ORDER BY end_time DESC;
-- 14 days at 5 minute granularity, on master:
SELECT start_time, avg_cpu_percent, avg_data_io_percent
FROM sys.resource_stats WHERE database_name = 'shop'
  AND start_time &gt; DATEADD(day, -14, GETUTCDATE());
--   cpu &gt; 80 sustained          scale up
--   data_io at 100              IO bound: Business Critical, or fix queries
--   log_write at 100            write limit: batch smaller
--   max_worker near 100         too many concurrent requests, often blocking
-- THROTTLING LOOKS LIKE UNIFORM SLOWNESS: requests QUEUE rather than fail.
-- Wait statistics say which ceiling you hit:
SELECT wait_type, wait_time_ms / 1000.0 AS wait_seconds, waiting_tasks_count
FROM sys.dm_db_wait_stats ORDER BY wait_time_ms DESC;
--   LOG_RATE_GOVERNOR   log write limit      SOS_SCHEDULER_YIELD  CPU
--   PAGEIOLATCH_*       IO bound             RESOURCE_SEMAPHORE   memory
--   LCK_M_*             BLOCKING: a QUERY problem. SCALING UP DOES NOT FIX IT.
-- FIX QUERIES BEFORE SCALING. Sort by TOTAL cost, not average duration: a
-- query running 200,000 times at 30ms costs more than one taking 10s twice.
SELECT TOP 20 SUBSTRING(t.query_sql_text, 1, 120) AS query_text,
       SUM(rs.avg_cpu_time * rs.count_executions) / 1000.0 AS total_cpu_ms
FROM sys.query_store_runtime_stats rs
JOIN sys.query_store_plan p ON rs.plan_id = p.plan_id
JOIN sys.query_store_query q ON p.query_id = q.query_id
JOIN sys.query_store_query_text t ON q.query_text_id = t.query_text_id
GROUP BY SUBSTRING(t.query_sql_text, 1, 120) ORDER BY total_cpu_ms DESC;
-- Missing index suggestions are SUGGESTIONS: the engine ignores write cost
-- and will recommend twelve overlapping indexes.
-- READ SCALE OUT is free on Business Critical and Hyperscale. Add
-- ApplicationIntent=ReadOnly to route reporting to a replica. It is
-- ASYNCHRONOUS, so fine for reports, wrong for read your own writes.
-- ENABLE THIS EVERYWHERE. A plan regression after a statistics update is a
-- classic overnight failure, and this reverts it automatically:
ALTER DATABASE shop SET AUTOMATIC_TUNING (
    FORCE_LAST_GOOD_PLAN = ON, CREATE_INDEX = ON, DROP_INDEX = ON);
</code></pre>
