---
publishDate: 2026-10-26T12:50
title: Dashboards and Workbooks
slug: dashboards-and-workbooks
metadescription: Build Azure dashboards and workbooks that answer questions, and know which tool fits which audience.
updateDate: 2026-09-07T12:50
author: ['bishal-biswas']
level: 2
tags: ['observability', 'dashboards', 'workbooks']
course: azure
---

## Which tool

```text
Azure dashboard  pinned tiles, quick, limited interactivity. A status board.
Workbook         parameterised, interactive, mixes text, queries and charts.
                 The investigation tool.
Grafana          the best visualisation, and another thing to run.
Power BI         business reporting, for people outside the team.
```

Dashboards answer "is everything alright". Workbooks answer "what is going on, and why". Most teams need both and use workbooks more than they expect.

## Dashboards

```bash
az portal dashboard create \
  --name shop-overview --resource-group rg-shop-prod-uks \
  --location uksouth --input-path dashboard.json

az portal dashboard list --resource-group rg-shop-prod-uks -o table
```

Building one in the portal and exporting the JSON is easier than writing it by hand. Then keep the JSON in the repository and deploy it, so the dashboard exists in every environment and survives someone deleting it.

```text
A dashboard that works
  fits on one screen, with no scrolling
  shows the four or five things that indicate health
  is readable from across the room
  is understood by someone who did not build it
```

The golden signals are a good starting set:

```text
Latency      p95 response time
Traffic      requests per minute
Errors       failure rate
Saturation   CPU, memory, queue depth
```

## Workbooks

Workbooks are where the real work happens: parameters, several data sources, conditional sections and narrative text alongside the charts.

```json
{
  "version": "Notebook/1.0",
  "items": [
    {
      "type": 9,
      "content": {
        "version": "KqlParameterItem/1.0",
        "parameters": [
          {
            "id": "timeRange",
            "name": "TimeRange",
            "type": 4,
            "value": { "durationMs": 3600000 }
          },
          {
            "id": "environment",
            "name": "Environment",
            "type": 2,
            "query": "AppRequests | distinct Environment = tostring(Properties.Environment)",
            "typeSettings": { "additionalResourceOptions": [] }
          }
        ]
      }
    },
    {
      "type": 3,
      "content": {
        "version": "KqlItem/1.0",
        "query": "AppRequests\n| where TimeGenerated {TimeRange}\n| where Properties.Environment == '{Environment}'\n| summarize requests = count(), failures = countif(Success == false) by bin(TimeGenerated, 5m)\n| render timechart",
        "size": 0,
        "visualization": "timechart"
      }
    }
  ]
}
```

`{TimeRange}` and `{Environment}` are substituted into every query. One workbook then serves every environment and any time window, rather than being rebuilt per environment.

```bash
az resource create \
  --resource-group rg-shop-prod-uks \
  --resource-type Microsoft.Insights/workbooks \
  --name "$(uuidgen)" --location uksouth \
  --properties "@workbook.json" --api-version 2022-04-01
```

## An incident workbook

The most valuable workbook is the one someone opens at 3am.

```text
Section 1  Is it us or Azure? Service health, then error rate by service.
Section 2  What changed? Deployments and configuration changes in the last 24 hours.
Section 3  Where is the time going? Dependency duration by target.
Section 4  What is failing? Exceptions grouped, with an example.
Section 5  Infrastructure. CPU, memory, connections, queue depth.
Section 6  Runbook links and escalation contacts.
```

Written in advance and linked from every alert, that turns an incident from "where do I start" into "work down the sections".

```kusto
// section 2: what changed
AzureActivity
| where TimeGenerated {TimeRange}
| where OperationNameValue has_any ("write", "delete", "action")
| where ActivityStatusValue == "Success"
| project TimeGenerated, Caller, OperationNameValue, ResourceGroup, _ResourceId
| order by TimeGenerated desc
```

"What changed" is the highest value section, because the answer is a recent change far more often than anything else.

## Conditional visibility

```json
{
  "conditionalVisibility": {
    "parameterName": "ShowDetail",
    "comparison": "isEqualTo",
    "value": "true"
  }
}
```

Sections that appear only when relevant keep a workbook readable. A summary by default, with detail available, is much better than forty charts on one page.

## Grouping and drill down

```json
{
  "type": 3,
  "content": {
    "query": "AppRequests | summarize count(), avg(DurationMs) by Name",
    "visualization": "table",
    "gridSettings": {
      "formatters": [
        {
          "columnMatch": "avg_DurationMs",
          "formatter": 8,
          "formatOptions": {
            "palette": "redGreen",
            "thresholdsGrid": [
              { "operator": ">", "thresholdValue": "1000", "representation": "red" },
              { "operator": ">", "thresholdValue": "500", "representation": "yellow" },
              { "operator": "Default", "representation": "green" }
            ]
          }
        }
      ]
    }
  }
}
```

Colour thresholds on a table make the problem visible without reading numbers, which is the point of a visualisation.

## Azure Managed Grafana

```bash
az grafana create --name grafana-shop --resource-group rg-shop-prod-uks --location uksouth

az grafana data-source create --name grafana-shop \
  --definition '{
    "name": "Azure Monitor",
    "type": "grafana-azure-monitor-datasource",
    "access": "proxy",
    "jsonData": { "azureAuthType": "msi", "subscriptionId": "0000..." }
  }'
```

Managed Grafana handles the hosting, and it uses a managed identity to query Azure Monitor rather than a stored credential.

```text
Better than Azure dashboards at   visual quality, alerting on panels,
                                  mixing Azure with Prometheus and other sources
Worse at                          being free, and being one less thing to run
```

Choose it when visualisation quality matters, when the team already knows Grafana, or when Azure Monitor is one of several data sources.

## Sharing beyond the team

```kusto
customEvents
| where timestamp > ago(30d)
| where name == "OrderPlaced"
| extend total = todouble(customMeasurements.Total)
| summarize orders = count(), revenue = sum(total) by bin(timestamp, 1d)
| render columnchart
```

For a business audience, export to Power BI rather than sharing a workbook. The Log Analytics connector reads directly, and the audience gets a tool they already use.

Do not send a KQL query to a marketing team, and do not build an operations dashboard in Power BI.

## Practical advice

```text
Build the incident workbook before the incident
Keep dashboards to one screen
Parameterise workbooks by environment and time
Store both as code, and deploy them
Link the workbook from every alert
Delete what nobody opens
```

**Link the workbook from the alert.** An alert that includes a link to the relevant investigation is dramatically more useful than one that says a threshold was exceeded.

```bash
az monitor metrics alert update \
  --name error-rate-high --resource-group rg-shop-prod-uks \
  --description "Error rate above threshold. Investigation: https://portal.azure.com/#view/...workbook"
```

## Quick recap

- Dashboards answer whether things are alright, and workbooks answer what is going on.
- Keep a dashboard to one screen showing latency, traffic, errors and saturation.
- Parameterise workbooks so one serves every environment and time range.
- Build the incident workbook in advance, with "what changed" as the highest value section.
- Use conditional visibility so a workbook stays readable.
- Managed Grafana suits mixed data sources and better visuals, at the cost of another thing to run.
- Link the workbook from every alert, and export to Power BI for a business audience.

<code id="code-content" class="language-json">
{
  "COMMENT": "WHICH TOOL: Azure dashboards answer 'is everything alright'. WORKBOOKS answer 'what is going on, and why', and most teams use them more than expected. Grafana for visual quality and mixed sources. Power BI for people outside the team.",
  "version": "Notebook/1.0",
  "items": [
    {
      "COMMENT": "PARAMETERS ARE THE POINT. {TimeRange} and {Environment} substitute into EVERY query below, so ONE workbook serves every environment and any window, instead of being rebuilt per environment.",
      "type": 9,
      "content": {
        "parameters": [
          { "id": "timeRange", "name": "TimeRange", "type": 4,
            "value": { "durationMs": 3600000 } },
          { "id": "environment", "name": "Environment", "type": 2,
            "query": "AppRequests | distinct tostring(Properties.Environment)" }
        ]
      }
    },
    {
      "type": 3,
      "content": {
        "query": "AppRequests | where TimeGenerated {TimeRange} | summarize requests = count(), failures = countif(Success == false) by bin(TimeGenerated, 5m) | render timechart",
        "visualization": "timechart"
      },
      "COMMENT_conditional": "Sections that appear only when relevant keep a workbook readable. A summary by default with detail available beats forty charts on one page.",
      "conditionalVisibility": { "parameterName": "ShowDetail", "comparison": "isEqualTo", "value": "true" }
    }
  ],
  "THE_INCIDENT_WORKBOOK": [
    "The most valuable workbook is the one someone opens at 3am. Write it BEFORE the incident and LINK IT FROM EVERY ALERT.",
    "1. Is it us or Azure?   service health, then error rate by service",
    "2. WHAT CHANGED?       deployments and config changes in 24h  &lt;- HIGHEST VALUE:",
    "     AzureActivity | where OperationNameValue has_any ('write','delete','action')",
    "     | where ActivityStatusValue == 'Success'",
    "     | project TimeGenerated, Caller, OperationNameValue, ResourceGroup",
    "   The answer is A RECENT CHANGE far more often than anything else.",
    "3. Where is the time going?  dependency duration by target",
    "4. What is failing?     exceptions grouped, with an example",
    "5. Infrastructure       CPU, memory, connections, queue depth",
    "6. Runbook links and escalation contacts"
  ],
  "A_DASHBOARD_THAT_WORKS": [
    "fits ONE SCREEN with no scrolling, readable from across the room,",
    "understood by someone who did not build it, showing the golden signals:",
    "  LATENCY p95 | TRAFFIC requests per minute | ERRORS failure rate |",
    "  SATURATION cpu, memory, queue depth",
    "Build it in the portal, EXPORT THE JSON, keep it in the repository and",
    "deploy it, so it exists in every environment and survives deletion."
  ],
  "PRACTICAL": [
    "LINK THE WORKBOOK FROM THE ALERT. An alert carrying a link to the",
    "relevant investigation is dramatically more useful than one saying a",
    "threshold was exceeded:",
    "  az monitor metrics alert update --name error-rate-high \\",
    "    --description 'Investigation: https://portal.azure.com/#view/...workbook'",
    "Do NOT send a KQL query to a marketing team, and do NOT build an",
    "operations dashboard in Power BI. Export to Power BI for a business",
    "audience, using the Log Analytics connector.",
    "Delete what nobody opens."
  ]
}
</code></pre>
