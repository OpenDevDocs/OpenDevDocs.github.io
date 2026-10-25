---
publishDate: 2026-10-09T08:15
title: 'Azure Functions: Hosting Plans and Cold Starts'
slug: azure-functions-hosting-plans
metadescription: Choose an Azure Functions hosting plan, understand cold starts, and know what Flex Consumption changed.
updateDate: 2026-09-07T08:15
author: ['bishal-biswas']
level: 2
tags: ['compute', 'functions', 'hosting']
course: azure
---

## The plans

```text
Flex Consumption  pay per use, scales to zero, vnet support, configurable
                  concurrency and always ready instances. The modern default.
Consumption       the original pay per use plan. Limited networking.
Premium           pre warmed instances, no cold start, vnet, unlimited duration
Dedicated         runs on an App Service plan you already pay for
Container Apps    functions hosted alongside other containers
```

Flex Consumption is where new work should start. It fixed the two things that made the original Consumption plan awkward: poor virtual network support and unpredictable cold starts.

```bash
az functionapp create \
  --name func-shop --resource-group rg-shop-prod-uks \
  --storage-account stshopfunc \
  --flexconsumption-location uksouth \
  --runtime dotnet-isolated --runtime-version 8.0 \
  --instance-memory 2048
```

## What a cold start is

When no instance is running, a request must wait for one to be allocated, the runtime to start, and your code to load.

```text
Warm instance   milliseconds
Cold start      hundreds of milliseconds to several seconds
```

The size varies with runtime, dependency count and package size. A large .NET app with many dependencies is slower to start than a small Node function.

It matters for a user facing HTTP API and matters far less for a queue processor, where a two second delay on the first message is invisible.

## Always ready instances

Flex Consumption keeps a chosen number of instances warm.

```bash
az functionapp scale config always-ready set \
  --name func-shop --resource-group rg-shop-prod-uks \
  --settings http=2
```

Two instances always warm for HTTP triggers, scaling beyond that on demand. You pay for those two continuously and the rest per use.

This is the middle ground people wanted: no cold start for normal traffic, no cost for idle capacity above it.

```bash
az functionapp scale config always-ready set \
  --name func-shop --resource-group rg-shop-prod-uks \
  --settings durable=1 blob=1
```

Per trigger group, so a warm instance can be kept only where latency matters.

## Concurrency

```bash
az functionapp scale config set \
  --name func-shop --resource-group rg-shop-prod-uks \
  --trigger-type http --trigger-settings perInstanceConcurrency=16
```

How many concurrent executions one instance handles. This is the lever people miss.

```text
Too low   more instances than needed, more cold starts, higher cost
Too high  instances run out of memory or CPU, latency rises
```

A function doing IO and waiting can handle high concurrency. A function doing CPU work cannot. Start with the default, look at memory and duration, and adjust.

## Instance memory

```bash
az functionapp create ... --instance-memory 4096
```

Flex Consumption offers 512 MB to 4096 MB per instance. Larger instances get proportionally more CPU, so a slow function is sometimes fixed by more memory rather than more instances.

## Premium plan

```bash
az functionapp plan create \
  --name plan-func-premium --resource-group rg-shop-prod-uks \
  --location uksouth --sku EP1 --min-instances 1 --max-burst 20
```

```text
Pre warmed instances, so no cold start
Unlimited execution duration
Virtual network integration
Predictable pricing, and you pay for the minimum whether used or not
```

Premium made more sense before Flex Consumption existed. Now it fits when you need unlimited execution duration, or when you want the App Service style plan model.

## Execution limits

```text
Consumption      5 minutes default, 10 maximum
Flex Consumption 30 minutes default, configurable
Premium          30 minutes default, unlimited configurable
Dedicated        30 minutes default, unlimited with Always On
```

```json
{
  "version": "2.0",
  "functionTimeout": "00:10:00"
}
```

A function approaching its limit is usually the wrong shape. Split it, or use Durable Functions to break the work into activities that each finish quickly.

## Scaling behaviour

```text
HTTP           scales on request rate and concurrency
Queue          scales on queue length
Service Bus    scales on message count and active connections
Event Hubs     scales with partition count, so partitions cap parallelism
Timer          a single instance, never scales out
```

Event Hubs deserves attention: **you cannot process a hub in parallel beyond its partition count.** A hub with four partitions runs at most four instances of the function, no matter the backlog. Partition count is set at creation and, on most tiers, cannot be increased later.

## The storage account

Every function app needs one. It holds trigger state, timer schedules, Durable Functions history and the deployment package.

```text
Do not delete it
Do not let someone clear its containers
Do not share it with a busy application workload
Restricting its network access breaks the app unless done carefully
```

Deleting or wiping this storage account breaks the function app in ways that are hard to diagnose, because the failure shows up as triggers silently not firing.

## Scale limits

```bash
az functionapp scale config set \
  --name func-shop --resource-group rg-shop-prod-uks \
  --maximum-instance-count 40
```

Set a maximum. A runaway function scaling to hundreds of instances against a database with a connection limit takes the database down, and the bill is unpleasant.

The maximum is a safety valve, not a performance setting.

## Choosing

```text
User facing API, spiky        Flex Consumption with always ready instances
Background queue processing   Flex Consumption, no always ready needed
Long running work             Premium, or Durable Functions
Already have an App Service plan with headroom   Dedicated
Functions alongside containers  Container Apps hosting
Legacy app on Consumption     migrate to Flex Consumption
```

## Watching it

```bash
az monitor metrics list \
  --resource /subscriptions/.../sites/func-shop \
  --metric FunctionExecutionCount FunctionExecutionUnits \
  --interval PT1H --output table
```

```kusto
requests
| where cloud_RoleName == "func-shop"
| summarize count(), avg(duration), percentile(duration, 95) by name
| order by count_ desc
```

`FunctionExecutionUnits` is what billing is based on, combining memory and time. A function using more memory than it needs costs more for the same work, which is worth checking before assuming the plan is the problem.

## Quick recap

- Flex Consumption is the modern default, and fixed the networking and cold start problems.
- Always ready instances remove cold starts for the traffic you expect, without paying for idle capacity above it.
- Per instance concurrency is the lever people miss, and it depends on whether the work is IO or CPU bound.
- Event Hubs parallelism is capped by partition count, which is fixed at creation.
- The function app's storage account holds trigger state, so deleting or wiping it breaks things quietly.
- Always set a maximum instance count, to protect downstream systems and the bill.
- A function near its timeout is usually the wrong shape, so split it or use Durable Functions.

<code id="code-content" class="language-bash">
# THE PLANS:
#   Flex Consumption  pay per use, scales to zero, vnet, always ready
#                     instances, configurable concurrency. THE DEFAULT NOW.
#   Consumption       the original. Limited networking, unpredictable starts.
#   Premium           pre warmed, unlimited duration, pay for the minimum
#   Dedicated         on an App Service plan you already pay for
az functionapp create --name func-shop --resource-group rg-shop-prod-uks \
  --storage-account stshopfunc --flexconsumption-location uksouth \
  --runtime dotnet-isolated --runtime-version 8.0 --instance-memory 2048
# COLD START: with no instance running, a request waits for allocation, the
# runtime and your code. Milliseconds warm, seconds cold. It matters for a
# user facing API and barely at all for a queue processor.
# ALWAYS READY INSTANCES are the middle ground people wanted: no cold start
# for normal traffic, no cost for idle capacity above it.
az functionapp scale config always-ready set --name func-shop \
  --resource-group rg-shop-prod-uks --settings http=2
# CONCURRENCY IS THE LEVER PEOPLE MISS.
#   too low   more instances than needed, more cold starts, higher cost
#   too high  instances run out of memory, latency rises
# IO bound work handles high concurrency. CPU bound work does not.
az functionapp scale config set --name func-shop --resource-group rg-shop-prod-uks \
  --trigger-type http --trigger-settings perInstanceConcurrency=16
# SCALING BEHAVIOUR BY TRIGGER:
#   HTTP        request rate and concurrency
#   Queue       queue length
#   Event Hubs  CAPPED BY PARTITION COUNT
#   Timer       a single instance, never scales out
# Four partitions means at most four instances, whatever the backlog, and
# partition count is fixed at creation on most tiers.
# THE STORAGE ACCOUNT holds trigger state, timer schedules and Durable
# history. Delete or wipe it and triggers SILENTLY STOP FIRING, which is
# very hard to diagnose. Do not share it with a busy workload.
# ALWAYS SET A MAXIMUM. A runaway function scaling to hundreds of instances
# takes down a database with a connection limit, and the bill is unpleasant.
az functionapp scale config set --name func-shop \
  --resource-group rg-shop-prod-uks --maximum-instance-count 40
# TIMEOUTS: Consumption 10 min max. Flex 30 default. Premium unlimited.
# A function NEAR its timeout is usually the wrong shape. Split it, or use
# Durable Functions so each activity finishes quickly.
# FunctionExecutionUnits combines MEMORY AND TIME, and is what you are
# billed on. An oversized function costs more for identical work.
az monitor metrics list --resource /subscriptions/.../sites/func-shop \
  --metric FunctionExecutionCount FunctionExecutionUnits --interval PT1H -o table
</code></pre>
