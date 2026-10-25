---
publishDate: 2026-10-29T13:30
title: Data Factory and Pipelines
slug: data-factory-and-pipelines
metadescription: Move and transform data with Azure Data Factory, using pipelines, triggers and integration runtimes that behave predictably.
updateDate: 2026-09-07T13:30
author: ['bishal-biswas']
level: 3
tags: ['data', 'data factory', 'etl']
course: azure
---

## What it is

A managed orchestration service for data movement and transformation. It connects to roughly a hundred sources, moves data at scale, and runs transformations either by pushing work to a compute engine or with its own Spark based data flows.

```text
Pipeline            a container of activities
Activity            a step: copy, transform, call something, control flow
Dataset             the shape and location of data
Linked service      a connection to a system
Integration runtime the compute that does the work
Trigger             what starts a pipeline
```

```bash
az datafactory create \
  --name adf-shop --resource-group rg-shop-data-uks \
  --location uksouth --identity-type SystemAssigned
```

## Integration runtimes

The concept that determines what a factory can reach.

```text
Azure IR             managed, serverless, for cloud sources. The default.
Self hosted IR       an agent you install, for on premises and private networks.
Azure SSIS IR        runs existing SSIS packages, for migration.
```

```bash
az datafactory integration-runtime self-hosted create \
  --factory-name adf-shop --resource-group rg-shop-data-uks \
  --name shir-onprem --description "On premises data access"

az datafactory integration-runtime list-auth-key \
  --factory-name adf-shop --resource-group rg-shop-data-uks --name shir-onprem
```

**A self hosted runtime makes outbound connections only.** No inbound firewall rule is needed, which is usually the reason it is acceptable to a network team.

Install it on at least two machines. A single node self hosted runtime is a single point of failure for every pipeline that uses it, and it needs patching.

## Copy activity

```json
{
  "name": "CopyOrdersToLake",
  "type": "Copy",
  "inputs": [{ "referenceName": "SqlOrders", "type": "DatasetReference" }],
  "outputs": [{ "referenceName": "LakeOrders", "type": "DatasetReference" }],
  "typeProperties": {
    "source": {
      "type": "AzureSqlSource",
      "sqlReaderQuery": "SELECT * FROM Orders WHERE ModifiedAt > '@{formatDateTime(pipeline().parameters.watermark, 'yyyy-MM-dd HH:mm:ss')}'",
      "queryTimeout": "02:00:00",
      "partitionOption": "DynamicRange",
      "partitionSettings": {
        "partitionColumnName": "OrderId",
        "partitionUpperBound": "@pipeline().parameters.maxId",
        "partitionLowerBound": "@pipeline().parameters.minId"
      }
    },
    "sink": {
      "type": "ParquetSink",
      "storeSettings": { "type": "AzureBlobFSWriteSettings" }
    },
    "enableStaging": false,
    "parallelCopies": 8,
    "dataIntegrationUnits": 16
  }
}
```

Three settings that change throughput dramatically:

```text
partitionOption      splits the source read into parallel ranges
parallelCopies       how many concurrent copies
dataIntegrationUnits the compute allocated, which you pay for
```

Copying a large table without partitioning is a single threaded read, and it will be slow no matter how many integration units you allocate.

## Incremental loading

Copying everything every night stops working as data grows. Watermarking copies only what changed.

```json
{
  "activities": [
    {
      "name": "GetLastWatermark",
      "type": "Lookup",
      "typeProperties": {
        "source": { "type": "AzureSqlSource",
          "sqlReaderQuery": "SELECT WatermarkValue FROM Watermarks WHERE TableName = 'Orders'" }
      }
    },
    {
      "name": "GetCurrentWatermark",
      "type": "Lookup",
      "typeProperties": {
        "source": { "type": "AzureSqlSource",
          "sqlReaderQuery": "SELECT MAX(ModifiedAt) AS NewWatermark FROM Orders" }
      }
    },
    {
      "name": "CopyChangedRows",
      "type": "Copy",
      "dependsOn": [
        { "activity": "GetLastWatermark", "dependencyConditions": ["Succeeded"] },
        { "activity": "GetCurrentWatermark", "dependencyConditions": ["Succeeded"] }
      ]
    },
    {
      "name": "UpdateWatermark",
      "type": "SqlServerStoredProcedure",
      "dependsOn": [{ "activity": "CopyChangedRows", "dependencyConditions": ["Succeeded"] }]
    }
  ]
}
```

**Update the watermark only after the copy succeeds.** Updating it first means a failed copy skips those rows permanently, and the gap is discovered weeks later when a report is wrong.

## Triggers

```text
Schedule    a fixed time or recurrence
Tumbling window  fixed non overlapping intervals, with dependency and backfill
Storage event    a blob being created or deleted
Custom event     an Event Grid event
```

```bash
az datafactory trigger create \
  --factory-name adf-shop --resource-group rg-shop-data-uks \
  --name daily-load --properties @trigger.json

az datafactory trigger start \
  --factory-name adf-shop --resource-group rg-shop-data-uks --name daily-load
```

**A trigger must be started after being created.** A created but stopped trigger silently does nothing, and this catches people on every first deployment.

Tumbling window triggers are the better choice for scheduled data loads: they can depend on each other, they backfill missed windows automatically, and each window is a discrete unit that can be rerun.

## Data flows against pushdown

```text
Mapping data flow  visual transformation, runs on managed Spark. Costs cluster time.
Pushdown           the transformation runs in the source or target system.
```

A copy activity followed by a stored procedure or a SQL script is often faster and much cheaper than a data flow, because the database does the work with no Spark cluster to start.

Data flows suit complex transformation across sources that no single system can do. For "load this and aggregate it", pushdown wins.

Note that a data flow's Spark cluster takes several minutes to start unless a time to live is configured on the integration runtime.

## Error handling

```json
{
  "name": "CopyWithFallback",
  "type": "Copy",
  "policy": {
    "timeout": "02:00:00",
    "retry": 3,
    "retryIntervalInSeconds": 60
  },
  "typeProperties": {
    "enableSkipIncompatibleRow": true,
    "logSettings": {
      "enableCopyActivityLog": true,
      "copyActivityLogSettings": { "logLevel": "Warning" },
      "logLocationSettings": { "path": "logs/copy" }
    }
  }
}
```

`enableSkipIncompatibleRow` continues past rows that fail conversion and logs them, which is usually better than failing an entire load because of three malformed records.

Dependency conditions build the failure path:

```text
Succeeded  the normal flow
Failed     the error path
Skipped    the upstream activity did not run
Completed  either succeeded or failed
```

A `Failed` dependency leading to a notification activity is how a pipeline tells someone rather than failing silently in a portal.

## Parameterise everything

```json
{
  "parameters": {
    "sourceTable": { "type": "string" },
    "targetPath": { "type": "string" },
    "watermarkColumn": { "type": "string", "defaultValue": "ModifiedAt" }
  }
}
```

```json
{
  "name": "ForEachTable",
  "type": "ForEach",
  "typeProperties": {
    "items": "@pipeline().parameters.tableList",
    "isSequential": false,
    "batchCount": 8,
    "activities": [
      { "name": "CopyOneTable", "type": "ExecutePipeline",
        "typeProperties": {
          "pipeline": { "referenceName": "CopyTableGeneric" },
          "parameters": { "sourceTable": "@item().name", "targetPath": "@item().path" }
        } }
    ]
  }
}
```

One parameterised pipeline copying fifty tables from a metadata list is far better than fifty pipelines. Changing the pattern then changes one thing.

`batchCount` controls parallelism. Leaving it unset runs up to twenty at once, which will overwhelm most source databases.

## Deployment

```bash
az datafactory configure-factory-repo \
  --factory-resource-id /subscriptions/.../factories/adf-shop \
  --factory-git-hub-configuration repository-name=data-platform \
    collaboration-branch=main root-folder=/adf account-name=contoso
```

Connect the factory to git. Development happens on branches, publishing generates ARM templates in an `adf_publish` branch, and those are deployed to test and production by pipeline.

**Only the development factory should be connected to git.** Test and production factories receive deployments and are never edited directly.

## Monitoring

```kusto
ADFActivityRun
| where TimeGenerated > ago(7d)
| where Status == "Failed"
| summarize failures = count() by PipelineName, ActivityName, tostring(Error)
| order by failures desc

ADFActivityRun
| where ActivityType == "Copy"
| extend rows = toint(Output.rowsCopied), duration = toint(Output.copyDuration)
| summarize avgRows = avg(rows), avgSeconds = avg(duration) by PipelineName
| order by avgSeconds desc
```

Alert on pipeline failures, and also on **pipelines that stopped running**. A trigger accidentally stopped produces no failures at all, and the absence is only noticed when someone questions a report.

## Quick recap

- The integration runtime determines what a factory can reach, and self hosted makes outbound connections only.
- Partition large source reads, or the copy is single threaded regardless of allocated compute.
- Update the watermark only after a successful copy, or rows are skipped permanently.
- A trigger must be started after creation, and a stopped trigger fails silently.
- Pushdown to the database is often faster and cheaper than a mapping data flow.
- Parameterise one pipeline over a metadata list rather than building fifty.
- Alert on pipelines that stopped running, not just on failures.

<code id="code-content" class="language-json">
{
  "COMMENT": "THE INTEGRATION RUNTIME DETERMINES WHAT A FACTORY CAN REACH. Azure IR for cloud sources. SELF HOSTED for on premises, and it makes OUTBOUND CONNECTIONS ONLY, which is usually why a network team accepts it. Install it on AT LEAST TWO machines: a single node is a single point of failure for every pipeline using it.",
  "name": "CopyOrdersToLake",
  "activities": [
    {
      "name": "CopyChangedRows",
      "type": "Copy",
      "COMMENT_throughput": "THREE SETTINGS CHANGE THROUGHPUT DRAMATICALLY. Copying a large table WITHOUT partitioning is a SINGLE THREADED READ, and no amount of dataIntegrationUnits fixes that.",
      "typeProperties": {
        "source": {
          "type": "AzureSqlSource",
          "partitionOption": "DynamicRange",
          "partitionSettings": { "partitionColumnName": "OrderId" }
        },
        "sink": { "type": "ParquetSink" },
        "parallelCopies": 8,
        "dataIntegrationUnits": 16,
        "COMMENT_skip": "Continues past rows that fail conversion and LOGS them, which beats failing an entire load because of three malformed records.",
        "enableSkipIncompatibleRow": true,
        "logSettings": { "enableCopyActivityLog": true }
      },
      "policy": { "timeout": "02:00:00", "retry": 3, "retryIntervalInSeconds": 60 }
    },
    {
      "COMMENT_watermark": "UPDATE THE WATERMARK ONLY AFTER THE COPY SUCCEEDS. Updating it first means a failed copy SKIPS THOSE ROWS PERMANENTLY, and the gap is found weeks later when a report is wrong.",
      "name": "UpdateWatermark",
      "type": "SqlServerStoredProcedure",
      "dependsOn": [{ "activity": "CopyChangedRows", "dependencyConditions": ["Succeeded"] }]
    },
    {
      "COMMENT_foreach": "ONE PARAMETERISED PIPELINE OVER A METADATA LIST beats fifty pipelines: changing the pattern then changes one thing. batchCount UNSET runs up to TWENTY AT ONCE, which will overwhelm most source databases.",
      "name": "ForEachTable",
      "type": "ForEach",
      "typeProperties": {
        "items": "@pipeline().parameters.tableList",
        "isSequential": false,
        "batchCount": 8
      }
    }
  ],
  "NOTES": [
    "A TRIGGER MUST BE STARTED AFTER CREATION. A created but stopped trigger SILENTLY DOES NOTHING, and this catches everyone on a first deployment.",
    "  az datafactory trigger start --factory-name adf-shop --name daily-load",
    "TUMBLING WINDOW triggers beat schedules for data loads: they can depend on each other, BACKFILL missed windows, and each window is a rerunnable unit.",
    "DATA FLOW vs PUSHDOWN: a copy followed by a stored procedure is often faster AND MUCH CHEAPER than a mapping data flow, because the database does the work with NO SPARK CLUSTER TO START. Data flows suit complex transformation ACROSS sources. For 'load this and aggregate it', pushdown wins.",
    "DEPENDENCY CONDITIONS build the failure path: Succeeded | Failed | Skipped | Completed. A Failed dependency leading to a notification is how a pipeline TELLS SOMEONE rather than failing silently in a portal.",
    "ONLY THE DEVELOPMENT FACTORY IS CONNECTED TO GIT. Publishing generates ARM templates in adf_publish, deployed to test and production by pipeline. Those factories are NEVER edited directly.",
    "ALERT ON PIPELINES THAT STOPPED RUNNING, not just on failures. A trigger accidentally stopped produces NO FAILURES AT ALL, and the absence is noticed only when someone questions a report.",
    "  ADFActivityRun | where Status == 'Failed'",
    "  | summarize count() by PipelineName, ActivityName, tostring(Error)"
  ]
}
</code></pre>
