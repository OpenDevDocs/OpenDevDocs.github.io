---
publishDate: 2026-10-25T12:25
title: 'Azure Monitor: Metrics and Logs'
slug: azure-monitor-metrics-and-logs
metadescription: Understand the difference between metrics and logs in Azure Monitor, and wire diagnostic settings so the data you need exists.
updateDate: 2026-09-07T12:25
author: ['bishal-biswas']
level: 2
tags: ['observability', 'monitoring', 'azure monitor']
course: azure
---

## Two different data types

```text
Metrics   numeric, time series, pre aggregated, cheap, retained 93 days,
          near real time. What you alert on.
Logs      structured records, queryable with KQL, retained as configured,
          a few minutes behind. What you investigate with.
```

Both come from the same platform and behave completely differently. Confusing them is why people find Azure Monitor confusing.

```text
"CPU is above 80 percent"       a metric
"Which requests failed and why" logs
```

## Platform metrics are free and automatic

```bash
az monitor metrics list \
  --resource /subscriptions/.../sites/app-shop \
  --metric CpuPercentage MemoryPercentage Http5xx Requests \
  --start-time 2026-09-08T00:00:00Z --interval PT5M \
  --aggregation Average Total --output table

az monitor metrics list-definitions \
  --resource /subscriptions/.../sites/app-shop \
  --query "[].{Name:name.value, Unit:unit}" -o table
```

Every resource emits platform metrics with no configuration and no cost. `list-definitions` is how you discover what a service actually exposes, which is faster than searching documentation.

## Logs need diagnostic settings

**This is the step people miss.** Platform logs are not collected unless you say so, and a resource with no diagnostic setting produces nothing you can query later.

```bash
az monitor diagnostic-settings create \
  --name to-law \
  --resource /subscriptions/.../sites/app-shop \
  --workspace /subscriptions/.../workspaces/law-shop \
  --logs '[{"categoryGroup":"allLogs","enabled":true}]' \
  --metrics '[{"category":"AllMetrics","enabled":true}]'

az monitor diagnostic-settings categories list \
  --resource /subscriptions/.../sites/app-shop -o table
```

Discovering during an incident that the logs were never collected is a bad moment, and it is entirely avoidable.

Enforce it with policy so every resource gets one automatically:

```bash
az policy assignment create \
  --name diagnostics-everywhere \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy-set-definition "$DIAGNOSTICS_INITIATIVE_ID" \
  --params '{"logAnalytics":{"value":"/subscriptions/.../workspaces/law-central"}}' \
  --location uksouth --mi-system-assigned --role Contributor \
  --identity-scope /providers/Microsoft.Management/managementGroups/mg-contoso
```

## The workspace

```bash
az monitor log-analytics workspace create \
  --name law-shop --resource-group rg-shop-prod-uks \
  --location uksouth \
  --retention-time 90 \
  --sku PerGB2018
```

```text
One workspace per region and environment is a reasonable default.
Too many   cross resource queries become awkward
Too few    access control becomes coarse, and one team sees another's data
```

Data must generally be in one workspace to join cleanly, so a single workspace per environment is usually better than one per application.

## Retention and cost

```bash
az monitor log-analytics workspace update \
  --name law-shop --resource-group rg-shop-prod-uks \
  --retention-time 30

az monitor log-analytics workspace table update \
  --workspace-name law-shop --resource-group rg-shop-prod-uks \
  --name AppTraces --retention-time 30 --total-retention-time 365
```

```text
Interactive retention  queryable normally. Charged per GB per month.
Total retention        archived, cheaper, needs a search job to query.
```

Per table retention is the important lever. Audit logs might need seven years while verbose traces need thirty days, and setting one retention for everything means paying archive prices for noise or losing what you needed.

## Table plans

```bash
az monitor log-analytics workspace table update \
  --workspace-name law-shop --resource-group rg-shop-prod-uks \
  --name ContainerLogV2 --plan Basic
```

```text
Analytics  full KQL, alerting, joins. The normal plan.
Basic      much cheaper ingestion, limited KQL, no alerting, 30 day retention.
Auxiliary  cheapest, for high volume low value logs.
```

Basic logs suit high volume verbose data you search occasionally and never alert on. Moving container stdout or network flow logs to Basic can cut a bill substantially.

The restriction matters: **you cannot alert on Basic tables**, so anything driving an alert stays on Analytics.

## Controlling ingestion

Ingestion volume is what drives cost, so filtering at source is the most effective lever.

```bash
az monitor data-collection rule create \
  --name dcr-vm-logs --resource-group rg-shop-prod-uks --location uksouth \
  --rule-file dcr.json
```

```json
{
  "dataSources": {
    "performanceCounters": [{
      "name": "perf",
      "streams": ["Microsoft-Perf"],
      "samplingFrequencyInSeconds": 60,
      "counterSpecifiers": [
        "\\Processor(_Total)\\% Processor Time",
        "\\Memory\\Available Bytes",
        "\\LogicalDisk(_Total)\\% Free Space"
      ]
    }],
    "syslog": [{
      "name": "syslog",
      "streams": ["Microsoft-Syslog"],
      "facilityNames": ["auth", "authpriv", "daemon"],
      "logLevels": ["Warning", "Error", "Critical", "Alert", "Emergency"]
    }]
  }
}
```

Data collection rules replaced the older agent configuration and are far more precise: choose exactly which counters and which syslog levels are collected, per machine group.

Collecting `Info` level syslog from a hundred machines is expensive and rarely useful.

## Transformations

```kusto
source
| where Level != "Verbose"
| project-away UserAgent, RawHeaders
| extend Environment = "production"
```

An ingestion time transformation filters and reshapes data **before** it is stored and billed. Dropping verbose entries and removing large unused columns at ingestion is cheaper than storing them and filtering at query time.

It also lets you remove sensitive fields before they land, which is sometimes a compliance requirement rather than a cost one.

## Commitment tiers

```bash
az monitor log-analytics workspace update \
  --name law-shop --resource-group rg-shop-prod-uks \
  --sku CapacityReservation --level 200
```

Committing to a daily volume gives a discount that grows with the commitment. Above roughly 100 GB per day the saving is meaningful.

Check actual ingestion first:

```kusto
Usage
| where TimeGenerated > ago(30d)
| where IsBillable
| summarize GB = sum(Quantity) / 1000 by bin(TimeGenerated, 1d)
| render timechart
```

```kusto
Usage
| where TimeGenerated > ago(7d)
| where IsBillable
| summarize GB = sum(Quantity) / 1000 by DataType
| order by GB desc
```

That second query names the tables costing the most, which is where any cost reduction starts.

## Metric alerts

```bash
az monitor metrics alert create \
  --name high-error-rate --resource-group rg-shop-prod-uks \
  --scopes /subscriptions/.../sites/app-shop \
  --condition "total Http5xx > 10" \
  --window-size 5m --evaluation-frequency 1m \
  --severity 1 \
  --action /subscriptions/.../actionGroups/ag-oncall
```

Metric alerts are cheaper and faster than log alerts, so use a metric where one exists. Log alerts are for conditions no metric expresses.

## Dynamic thresholds

```bash
az monitor metrics alert create \
  --name unusual-traffic --resource-group rg-shop-prod-uks \
  --scopes /subscriptions/.../sites/app-shop \
  --condition "avg Requests > dynamic medium 4 of 5 since 2026-09-01T00:00:00Z" \
  --window-size 5m --evaluation-frequency 5m \
  --action /subscriptions/.../actionGroups/ag-oncall
```

Dynamic thresholds learn the normal pattern including daily and weekly seasonality. For a metric with a strong business rhythm, that is far better than a fixed number which is either too noisy at night or too loose at peak.

## Multi resource alerts

```bash
az monitor metrics alert create \
  --name vm-cpu-high --resource-group rg-shop-prod-uks \
  --scopes /subscriptions/.../resourceGroups/rg-shop-prod-uks \
  --target-resource-type Microsoft.Compute/virtualMachines \
  --target-resource-region uksouth \
  --condition "avg Percentage CPU > 85" \
  --window-size 15m --action /subscriptions/.../actionGroups/ag-oncall
```

One alert rule covering every virtual machine in a resource group, including ones created later. Much better than one rule per machine that somebody has to remember to create.

## Quick recap

- Metrics are numeric, cheap and near real time, and logs are queryable records for investigation.
- Platform metrics are automatic, and platform logs need a diagnostic setting.
- Enforce diagnostic settings with policy, or you discover the gap during an incident.
- Set retention per table, since audit logs and verbose traces have different needs.
- Basic table plans cut cost and cannot be alerted on.
- Filter at ingestion with data collection rules and transformations, since volume drives cost.
- Prefer metric alerts where a metric exists, and use dynamic thresholds for seasonal traffic.

<code id="code-content" class="language-bash">
# TWO DIFFERENT DATA TYPES, and confusing them is why Azure Monitor feels
# confusing.
#   METRICS  numeric, pre aggregated, cheap, 93 days, near real time.
#            WHAT YOU ALERT ON.  ("CPU is above 80 percent")
#   LOGS     structured records, KQL, configurable retention, minutes behind.
#            WHAT YOU INVESTIGATE WITH.  ("which requests failed and why")
# PLATFORM METRICS ARE AUTOMATIC AND FREE. This is how to discover what a
# service exposes, faster than searching documentation:
az monitor metrics list-definitions --resource /subscriptions/.../sites/app-shop \
  --query "[].{Name:name.value, Unit:unit}" -o table
# LOGS NEED A DIAGNOSTIC SETTING, AND THIS IS THE STEP PEOPLE MISS. A
# resource without one produces NOTHING you can query later, and finding
# that out during an incident is entirely avoidable.
az monitor diagnostic-settings create --name to-law \
  --resource /subscriptions/.../sites/app-shop \
  --workspace /subscriptions/.../workspaces/law-shop \
  --logs '[{"categoryGroup":"allLogs","enabled":true}]' \
  --metrics '[{"category":"AllMetrics","enabled":true}]'
# ENFORCE IT WITH POLICY so every resource gets one automatically, including
# resources created later.
# RETENTION PER TABLE IS THE IMPORTANT LEVER: audit logs may need seven
# years while verbose traces need thirty days. One setting for everything
# means paying archive prices for noise, or losing what you needed.
az monitor log-analytics workspace table update --workspace-name law-shop \
  --resource-group rg-shop-prod-uks --name AppTraces \
  --retention-time 30 --total-retention-time 365
# TABLE PLANS. Basic is much cheaper for high volume data you search
# occasionally. THE RESTRICTION THAT MATTERS: YOU CANNOT ALERT ON BASIC.
az monitor log-analytics workspace table update --workspace-name law-shop \
  --resource-group rg-shop-prod-uks --name ContainerLogV2 --plan Basic
# INGESTION VOLUME DRIVES COST, so filtering AT SOURCE is the best lever.
# Data collection rules pick exactly which counters and which syslog levels
# are collected. Info level syslog from a hundred machines is expensive and
# rarely useful.
az monitor data-collection rule create --name dcr-vm-logs \
  --resource-group rg-shop-prod-uks --location uksouth --rule-file dcr.json
# Ingestion TRANSFORMATIONS filter and reshape BEFORE storage and billing,
# and can strip sensitive fields before they land:
#   source | where Level != "Verbose" | project-away UserAgent, RawHeaders
# FIND WHAT IS ACTUALLY COSTING MONEY. Any reduction starts here:
#   Usage | where IsBillable
#   | summarize GB = sum(Quantity) / 1000 by DataType | order by GB desc
# PREFER METRIC ALERTS: cheaper and faster than log alerts. Log alerts are
# for conditions no metric expresses.
az monitor metrics alert create --name high-error-rate \
  --resource-group rg-shop-prod-uks --scopes /subscriptions/.../sites/app-shop \
  --condition "total Http5xx &gt; 10" --window-size 5m --evaluation-frequency 1m \
  --severity 1 --action /subscriptions/.../actionGroups/ag-oncall
# DYNAMIC THRESHOLDS learn daily and weekly seasonality, which beats a fixed
# number that is too noisy at night or too loose at peak.
#   --condition "avg Requests &gt; dynamic medium 4 of 5 since 2026-09-01T00:00:00Z"
# ONE RULE FOR EVERY VM IN A RESOURCE GROUP, including ones created later,
# instead of a rule per machine somebody must remember to create:
az monitor metrics alert create --name vm-cpu-high --resource-group rg-shop-prod-uks \
  --scopes /subscriptions/.../resourceGroups/rg-shop-prod-uks \
  --target-resource-type Microsoft.Compute/virtualMachines \
  --target-resource-region uksouth --condition "avg Percentage CPU &gt; 85"
</code></pre>
