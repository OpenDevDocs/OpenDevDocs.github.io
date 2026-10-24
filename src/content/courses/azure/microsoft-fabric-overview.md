---
publishDate: 2026-10-29T13:35
title: Microsoft Fabric Overview
slug: microsoft-fabric-overview
metadescription: Understand what Microsoft Fabric is, how it relates to Synapse and Power BI, and when it fits.
updateDate: 2026-09-07T13:35
author: ['bishal-biswas']
level: 3
tags: ['data', 'fabric', 'analytics']
course: azure
---

## What Fabric is

One SaaS analytics platform combining what were separate services, with a single storage layer underneath.

```text
Data Factory      ingestion and orchestration
Data Engineering  Spark notebooks and lakehouses
Data Warehouse    T-SQL warehousing
Data Science      model training and management
Real-Time Intelligence  streaming and KQL databases
Power BI          reporting and semantic models
Data Activator    triggers and alerts on data
```

The unifying idea is **OneLake**: one storage layer, one copy of the data, in Delta Parquet, that every engine reads directly.

```text
Traditionally  data lands in a lake, is copied into a warehouse, then copied
               again into a Power BI model. Three copies, three schedules,
               three chances to diverge.
Fabric         one copy in OneLake. Every engine reads it in place.
```

That is the actual point, and it is what makes Fabric different from bundling the previous services together.

## Capacity, not per service billing

```bash
az fabric capacity create \
  --resource-group rg-shop-data-uks \
  --capacity-name fabshop --location uksouth \
  --sku '{"name":"F8","tier":"Fabric"}' \
  --administration '{"members":["admin@contoso.com"]}'
```

```text
F2 to F2048   capacity units, shared across everything running on them
Pay as you go, or reserved for a discount
Pausable, and a paused capacity costs nothing
```

Everything draws from one capacity: notebooks, warehouse queries, pipelines, reports. That is simpler than sizing each service and it means one workload can starve another.

**Pause development capacity outside working hours.** It is one command and roughly a two thirds saving.

```bash
az fabric capacity suspend --resource-group rg-shop-data-uks --capacity-name fabshop
az fabric capacity resume --resource-group rg-shop-data-uks --capacity-name fabshop
```

## Lakehouse or warehouse

The choice people find confusing, because both hold tables and both are queryable with SQL.

```text
Lakehouse
  files and tables, Delta format
  Spark for transformation, plus a read only SQL endpoint
  schema on read, flexible
  for data engineering, semi structured data, and ML

Warehouse
  tables only, Delta underneath
  full T-SQL including INSERT, UPDATE, DELETE and multi table transactions
  schema on write, enforced
  for SQL teams, star schemas and BI serving
```

The practical divide is **who is doing the work**. A Spark team wants a lakehouse. A T-SQL team wants a warehouse. Both store Delta in OneLake, so either can read the other.

A common shape: land raw data in a lakehouse, transform with Spark or SQL, and serve curated star schemas from a warehouse.

## Shortcuts avoid copying

```text
A shortcut is a reference to data elsewhere, appearing as if it were local.
  Another lakehouse or warehouse in Fabric
  ADLS Gen2
  Amazon S3
  Google Cloud Storage
  Dataverse
```

Data stays where it is and is queried in place. No pipeline, no copy, no schedule to fail.

That is genuinely useful for an existing data lake: a shortcut makes it visible in Fabric without migrating anything, which lowers the cost of trying Fabric considerably.

## Direct Lake

The Power BI mode that only exists in Fabric.

```text
Import      data copied into the model. Fast queries, refresh schedules, memory limits.
DirectQuery Every visual queries the source. Always current, slower.
Direct Lake Reads Delta files in OneLake directly. Import speed, no refresh.
```

Direct Lake removes the refresh schedule entirely. The report reflects the table because it reads the same files, so there is no window where the report is stale and no refresh to fail overnight.

It falls back to DirectQuery when a model exceeds capacity limits or uses unsupported features, and that fallback is silent and slower. Watch for it when a report suddenly feels sluggish.

## Fabric, Synapse and Databricks

```text
Synapse Analytics  the previous generation. Still supported, no longer where
                   investment goes. New work should start on Fabric.
Databricks         a mature, powerful Spark platform, strong for ML and
                   engineering, and it also reads and writes Delta in ADLS.
Fabric             SaaS, integrated, strongest where Power BI is central.
```

Fabric and Databricks coexist reasonably: both use Delta, so Databricks can write to ADLS and Fabric can shortcut to it. That is a common arrangement in organisations with an existing Databricks investment.

The honest comparison: Databricks is more capable for heavy engineering and ML, and Fabric is more integrated and much easier for a BI centred organisation.

## Real-Time Intelligence

```kusto
Telemetry
| where Timestamp > ago(1h)
| summarize avg(Temperature) by DeviceId, bin(Timestamp, 1m)
| where avg_Temperature > 80
```

An eventhouse is a KQL database, the same engine as Log Analytics and Data Explorer, with eventstreams feeding it from Event Hubs, IoT Hub or elsewhere.

For high volume time series and telemetry this is genuinely strong, and the KQL knowledge transfers directly from Azure Monitor.

## Governance

```text
OneLake catalogue with lineage across items
Sensitivity labels from Microsoft Purview, flowing through to reports
Workspace roles: Admin, Member, Contributor, Viewer
Row level and object level security in warehouses and semantic models
Domains, for organising items by business area
```

Sensitivity labels carrying through from source to report is the strongest governance argument. A confidential label on a table applies to a report built from it, without anyone applying it again.

## When Fabric fits

```text
Good fit
  Power BI is already central
  a team of mixed SQL and Spark skills
  wanting one platform rather than assembling several
  small to medium data volumes with a clear BI purpose
  reducing the number of copies of data

Less good fit
  a heavy Databricks investment that works
  very large scale engineering with specific Spark requirements
  a need for fine grained per service cost control
  workloads needing capabilities Fabric does not yet have
```

Fabric is still maturing. Features arrive frequently, and some have rough edges that a mature platform would not.

Evaluating it with a shortcut to existing data is the low risk way to find out, because nothing has to move.

## Quick recap

- OneLake is the point: one copy of the data in Delta, read in place by every engine.
- Everything draws from one capacity, which is simpler and lets one workload starve another.
- Pause development capacity outside hours, which is one command and a large saving.
- Lakehouse against warehouse is mostly about whether the team writes Spark or T-SQL.
- Shortcuts let Fabric read existing data without migrating it, which makes evaluation cheap.
- Direct Lake removes the refresh schedule, and its silent DirectQuery fallback is worth watching.
- Synapse is the previous generation, and new analytics work should start on Fabric.

<code id="code-content" class="language-bash">
# FABRIC IS ONE SaaS PLATFORM combining Data Factory, Spark engineering,
# T-SQL warehousing, data science, real time intelligence and Power BI.
# THE UNIFYING IDEA IS ONELAKE: ONE COPY of the data in Delta Parquet, read
# IN PLACE by every engine.
#   traditionally: lake -&gt; copied to warehouse -&gt; copied to a Power BI model
#                  THREE copies, THREE schedules, THREE chances to diverge
#   Fabric:        one copy. That is the actual point.
# CAPACITY, NOT PER SERVICE BILLING. Notebooks, warehouse queries, pipelines
# and reports all draw from one pool: simpler to size, and ONE WORKLOAD CAN
# STARVE ANOTHER.
az fabric capacity create --resource-group rg-shop-data-uks \
  --capacity-name fabshop --location uksouth --sku '{"name":"F8","tier":"Fabric"}'
# PAUSE DEVELOPMENT CAPACITY OUTSIDE HOURS. One command, roughly a two
# thirds saving, and a paused capacity costs nothing:
az fabric capacity suspend --resource-group rg-shop-data-uks --capacity-name fabshop
# LAKEHOUSE vs WAREHOUSE is mostly about WHO IS DOING THE WORK:
#   LAKEHOUSE  files and tables, Spark, schema on read, SQL endpoint is
#              READ ONLY. For engineering and semi structured data.
#   WAREHOUSE  tables only, FULL T-SQL with INSERT/UPDATE/DELETE and
#              multi table transactions, schema on write. For SQL teams.
# Both store Delta in OneLake, so EITHER CAN READ THE OTHER. A common shape
# is raw in a lakehouse, curated star schemas served from a warehouse.
# SHORTCUTS REFERENCE DATA ELSEWHERE and query it IN PLACE: another Fabric
# item, ADLS Gen2, S3, GCS or Dataverse. No pipeline, no copy, no schedule
# to fail. THAT MAKES EVALUATING FABRIC CHEAP, because nothing has to move.
# DIRECT LAKE only exists here and REMOVES THE REFRESH SCHEDULE: the report
# reads the same Delta files, so it is never stale and there is no overnight
# refresh to fail.
#   Import      copied into the model, fast, needs refresh, memory limits
#   DirectQuery every visual queries the source, current but slower
#   Direct Lake reads OneLake directly. Import speed, no refresh.
# IT FALLS BACK TO DirectQuery SILENTLY when limits or unsupported features
# are hit, and it is slower. Watch for a report that suddenly feels sluggish.
# REAL-TIME INTELLIGENCE uses a KQL database, the SAME ENGINE as Log
# Analytics, so KQL knowledge transfers directly from Azure Monitor.
# SYNAPSE IS THE PREVIOUS GENERATION: supported, but no longer where
# investment goes. New analytics work should start on Fabric.
# DATABRICKS COEXISTS REASONABLY, since both use Delta: Databricks writes to
# ADLS, Fabric shortcuts to it. Honestly: Databricks is more capable for
# heavy engineering and ML; Fabric is more integrated and much easier for a
# BI centred organisation.
# SENSITIVITY LABELS FLOWING FROM SOURCE TO REPORT is the strongest
# governance argument: a confidential label on a table applies to a report
# built from it, with nobody applying it again.
</code></pre>
