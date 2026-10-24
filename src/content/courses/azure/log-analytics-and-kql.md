---
publishDate: 2026-10-25T12:30
title: Log Analytics and KQL
slug: log-analytics-and-kql
metadescription: Query Azure logs with KQL, from first principles to the joins and time series operators that answer real questions.
updateDate: 2026-09-07T12:30
author: ['bishal-biswas']
level: 3
tags: ['observability', 'kql', 'log analytics']
course: azure
---

## The shape of a query

Data flows left to right through pipe separated operators.

```kusto
AppRequests
| where TimeGenerated > ago(1h)
| where Success == false
| project TimeGenerated, Name, ResultCode, DurationMs, OperationId
| order by TimeGenerated desc
| take 100
```

**Filter first, and filter on time first.** Log Analytics partitions by time, so `TimeGenerated > ago(1h)` before anything else means the engine reads far less data.

That single habit makes the difference between a query returning in a second and timing out.

## The operators you need

```kusto
| where          filter rows
| project        choose columns
| project-away   remove columns
| extend         add a computed column
| summarize      aggregate
| order by       sort
| take           limit, unordered
| top 10 by      limit, ordered
| distinct       unique values
| join           combine tables
| union          stack tables
| render         chart the result
```

Ninety percent of queries use `where`, `summarize`, `project` and `order by`.

## Summarising

```kusto
AppRequests
| where TimeGenerated > ago(24h)
| summarize
    total = count(),
    failures = countif(Success == false),
    avgMs = avg(DurationMs),
    p50 = percentile(DurationMs, 50),
    p95 = percentile(DurationMs, 95),
    p99 = percentile(DurationMs, 99)
  by Name
| extend failureRate = round(100.0 * failures / total, 2)
| where total > 100
| order by p95 desc
```

**Percentiles matter more than averages.** An average of 200ms with a p99 of 8 seconds means one request in a hundred is unacceptable, and the average hides it entirely.

`countif` counts conditionally in the same pass, which is much better than running two queries.

## Time series

```kusto
AppRequests
| where TimeGenerated > ago(24h)
| summarize
    requests = count(),
    failures = countif(Success == false)
  by bin(TimeGenerated, 5m)
| render timechart
```

`bin()` groups into intervals. Choose the interval to suit the window: 5 minutes over a day, an hour over a month.

```kusto
AppRequests
| where TimeGenerated > ago(7d)
| summarize p95 = percentile(DurationMs, 95) by bin(TimeGenerated, 1h), Name
| render timechart
```

Adding a second `by` column produces one line per value, which is how you compare endpoints on one chart.

## Joins

```kusto
AppRequests
| where TimeGenerated > ago(1h)
| where Success == false
| project OperationId, Name, ResultCode, TimeGenerated
| join kind=inner (
    AppExceptions
    | where TimeGenerated > ago(1h)
    | project OperationId, ExceptionType, OuterMessage
) on OperationId
| project TimeGenerated, Name, ResultCode, ExceptionType, OuterMessage
```

Joining requests to exceptions on `OperationId` connects "this request failed" to "here is the exception", which is the single most useful join in application monitoring.

```text
inner        matching rows from both
leftouter    all left rows, matching right where present
leftanti     left rows with NO match. Very useful.
rightouter, fullouter, rightanti  the mirrors
```

`leftanti` answers "which requests had no corresponding log entry", which finds gaps rather than problems.

## The correlation chain

```kusto
let operation = "8f2c9a1b4e6d7c3a5b8e1f0d2c4a6b9e";
union AppRequests, AppDependencies, AppExceptions, AppTraces
| where OperationId == operation
| project TimeGenerated, itemType, Name, Message, DurationMs, ResultCode
| order by TimeGenerated asc
```

That reconstructs everything that happened during one request, in order, across every telemetry type. It is the query to run when investigating a specific failure.

## Variables and reuse

```kusto
let window = 24h;
let slowThreshold = 1000;
let busyEndpoints =
    AppRequests
    | where TimeGenerated > ago(window)
    | summarize count() by Name
    | where count_ > 1000
    | project Name;
AppRequests
| where TimeGenerated > ago(window)
| where Name in (busyEndpoints)
| where DurationMs > slowThreshold
| summarize slowRequests = count(), p95 = percentile(DurationMs, 95) by Name
| order by slowRequests desc
```

`let` holds scalars, and it holds whole result sets used as subqueries. That is how a complex question stays readable.

## Parsing

```kusto
AppTraces
| where Message has "OrderProcessed"
| parse Message with * "orderId=" orderId:string " total=" total:decimal *
| summarize sum(total) by bin(TimeGenerated, 1h)
```

```kusto
AppTraces
| extend parsed = parse_json(Properties)
| extend customerId = tostring(parsed.customerId), amount = todouble(parsed.amount)
| where amount > 1000
```

`parse` extracts from a string with a pattern. `parse_json` handles structured properties, and casting with `tostring` or `todouble` is necessary because dynamic values do not compare or aggregate reliably.

## Operators that keep queries fast

```kusto
| where Message has "timeout"           // indexed term search. FAST.
| where Message contains "timeout"      // substring scan. Slower.
| where Message == "timeout"            // exact. Fastest.
| where Message matches regex "time.*"  // slowest. Avoid at scale.
```

`has` searches indexed terms and is dramatically faster than `contains` on a large table. Use `has` unless you genuinely need a partial word match.

```kusto
| where TimeGenerated > ago(1h)         // always first
| where ResourceId == "..."             // then the most selective filter
| where Message has "error"             // then the rest
```

## Detecting anomalies

```kusto
AppRequests
| where TimeGenerated > ago(14d)
| summarize count() by bin(TimeGenerated, 1h)
| make-series requests = count() default=0 on TimeGenerated from ago(14d) to now() step 1h
| extend (anomalies, score, baseline) = series_decompose_anomalies(requests, 2.5, -1, 'linefit')
| render anomalychart with(anomalycolumns=anomalies)
```

`series_decompose_anomalies` accounts for seasonality, so a quiet Sunday is not flagged as an anomaly. This is the same machinery behind dynamic threshold alerts, available directly in a query.

## Comparing time windows

```kusto
let current = AppRequests
    | where TimeGenerated between (ago(1h) .. now())
    | summarize now_p95 = percentile(DurationMs, 95) by Name;
let previous = AppRequests
    | where TimeGenerated between (ago(25h) .. ago(24h))
    | summarize then_p95 = percentile(DurationMs, 95) by Name;
current
| join kind=inner previous on Name
| extend change = round(100.0 * (now_p95 - then_p95) / then_p95, 1)
| where abs(change) > 20
| project Name, then_p95, now_p95, changePercent = change
| order by change desc
```

Comparing the same hour yesterday against today controls for daily patterns, which a simple threshold does not.

## Cross workspace and cross resource

```kusto
union
    workspace("law-shop-prod").AppRequests,
    workspace("law-shop-eu").AppRequests
| where TimeGenerated > ago(1h)
| summarize count() by Name, workspace = strcat(split(TenantId, "-")[0])
```

```kusto
app("appi-shop").requests
| union app("appi-checkout").requests
| where timestamp > ago(1h)
| summarize count() by cloud_RoleName
```

Querying several workspaces or Application Insights resources in one query is how you see a system spanning regions or components.

## Saving useful queries

```bash
az monitor log-analytics workspace saved-search create \
  --workspace-name law-shop --resource-group rg-shop-prod-uks \
  --name failed-requests-by-endpoint \
  --category "Shop" --display-name "Failed requests by endpoint" \
  --saved-query "AppRequests | where TimeGenerated > ago(1h) | where Success == false | summarize count() by Name | order by count_ desc"
```

A shared library of saved queries means the person on call at 3am does not have to write one, and that is worth more than it sounds.

## Common mistakes

**No time filter first.** Slow, and sometimes a timeout.

**`contains` where `has` would work.** Slower on large tables by a wide margin.

**Comparing dynamic values without casting.** `parsed.amount > 1000` may not behave as expected until cast.

**`take` expecting the first rows.** `take` is unordered and returns arbitrary rows. Use `top ... by` for a meaningful sample.

**Joining large tables without filtering both sides.** Filter each side before joining.

## Quick recap

- Filter on time first, since the data is partitioned by time.
- Use percentiles, because an average hides the requests users actually complain about.
- Joining requests to exceptions on `OperationId` is the most useful join here.
- `let` holds result sets, which is how a complex query stays readable.
- `has` searches indexed terms and is far faster than `contains`.
- `series_decompose_anomalies` accounts for seasonality, so quiet periods are not flagged.
- `take` is unordered, so use `top ... by` when the order matters.

<code id="code-content" class="language-kusto">
// FILTER ON TIME FIRST. Log Analytics partitions by time, so this single
// habit is the difference between a query returning in a second and timing
// out. Then the most selective filter, then the rest.
AppRequests
| where TimeGenerated &gt; ago(1h)
| where Success == false
| project TimeGenerated, Name, ResultCode, DurationMs, OperationId
| order by TimeGenerated desc
//
// PERCENTILES MATTER MORE THAN AVERAGES. An average of 200ms with a p99 of
// 8 seconds means one request in a hundred is unacceptable, and the average
// hides it entirely. countif aggregates conditionally IN THE SAME PASS.
AppRequests
| where TimeGenerated &gt; ago(24h)
| summarize total = count(), failures = countif(Success == false),
            p50 = percentile(DurationMs, 50), p95 = percentile(DurationMs, 95),
            p99 = percentile(DurationMs, 99)
  by Name
| extend failureRate = round(100.0 * failures / total, 2)
| where total &gt; 100
| order by p95 desc
//
// THE MOST USEFUL JOIN IN APPLICATION MONITORING: connect "this request
// failed" to "here is the exception".
AppRequests
| where TimeGenerated &gt; ago(1h) and Success == false
| project OperationId, Name, ResultCode
| join kind=inner (
    AppExceptions | where TimeGenerated &gt; ago(1h)
    | project OperationId, ExceptionType, OuterMessage
) on OperationId
// kind: inner | leftouter | LEFTANTI (rows with NO match, for finding gaps)
//
// EVERYTHING THAT HAPPENED DURING ONE REQUEST, in order, across every
// telemetry type. The query to run when investigating a specific failure.
let operation = "8f2c9a1b4e6d7c3a5b8e1f0d2c4a6b9e";
union AppRequests, AppDependencies, AppExceptions, AppTraces
| where OperationId == operation
| project TimeGenerated, itemType, Name, Message, DurationMs
| order by TimeGenerated asc
//
// `let` HOLDS RESULT SETS, not just scalars. That is how a complex question
// stays readable.
let busyEndpoints = AppRequests
    | where TimeGenerated &gt; ago(24h)
    | summarize count() by Name | where count_ &gt; 1000 | project Name;
AppRequests | where Name in (busyEndpoints) | where DurationMs &gt; 1000
//
// SPEED. `has` searches INDEXED TERMS and is dramatically faster than
// `contains` on a large table:
//   == exact (fastest) | has (indexed term) | contains (scan) | matches regex (slowest)
//
// CAST DYNAMIC VALUES, or comparisons and aggregations misbehave:
AppTraces
| extend p = parse_json(Properties)
| extend customerId = tostring(p.customerId), amount = todouble(p.amount)
| where amount &gt; 1000
//
// ANOMALY DETECTION THAT ACCOUNTS FOR SEASONALITY, so a quiet Sunday is not
// flagged. Same machinery as dynamic threshold alerts.
AppRequests
| make-series requests = count() default=0 on TimeGenerated
    from ago(14d) to now() step 1h
| extend (anomalies, score, baseline) =
    series_decompose_anomalies(requests, 2.5, -1, 'linefit')
| render anomalychart with(anomalycolumns=anomalies)
//
// COMPARE THE SAME HOUR YESTERDAY, which controls for daily patterns in a
// way a fixed threshold does not:
//   between (ago(1h) .. now())  vs  between (ago(25h) .. ago(24h))
//
// MISTAKES: no time filter first; contains where has would do; comparing
// dynamic values without casting; expecting `take` to return the FIRST rows
// (it is UNORDERED, use `top N by`); joining large tables without filtering
// BOTH sides first.
</code></pre>
