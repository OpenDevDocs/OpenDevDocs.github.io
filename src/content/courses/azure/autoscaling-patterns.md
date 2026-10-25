---
publishDate: 2026-10-27T13:05
title: Autoscaling Patterns
slug: autoscaling-patterns
metadescription: Scale Azure workloads on the right signal, at the right speed, and avoid the patterns that make autoscaling worse than none.
updateDate: 2026-09-07T13:05
author: ['bishal-biswas']
level: 3
tags: ['reliability', 'autoscaling', 'performance']
course: azure
---

## Reactive scaling always lags

```text
1. Load increases
2. The metric moves
3. The aggregation window passes
4. The rule evaluates
5. Instances are provisioned
6. They warm up and start serving
```

That is typically three to ten minutes. Users during that window get slow responses regardless of what the rule says.

Accepting the lag is the starting point. Everything else is reducing it or working around it.

## Scale on the right signal

CPU is the default and often the wrong choice.

```text
Web application    HTTP queue length, or requests per instance
Queue worker       queue depth, and not CPU at all
API gateway        request rate
Memory bound work  memory percentage
Batch processing   pending job count
Database bound     rarely helps, since the database is the constraint
```

```bash
az monitor autoscale rule create \
  --resource-group rg-shop-prod-uks --autoscale-name autoscale-shop \
  --condition "HttpQueueLength > 25 avg 5m" --scale out 2 --cooldown 5
```

`HttpQueueLength` means requests are genuinely waiting, whatever the CPU shows. A thread pool starved application can be at 30 percent CPU and completely unresponsive.

## Queue depth for workers

```bash
az monitor autoscale create \
  --resource-group rg-shop-prod-uks --name autoscale-worker \
  --resource vmss-shop-worker \
  --resource-type Microsoft.Compute/virtualMachineScaleSets \
  --min-count 0 --max-count 30 --count 1

az monitor autoscale rule create \
  --resource-group rg-shop-prod-uks --autoscale-name autoscale-worker \
  --condition "ActiveMessages > 500 avg 5m namespace=sb-shop-prod entity=orders" \
  --scale out 3 --cooldown 3
```

For Container Apps and AKS, KEDA does this natively and better:

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
spec:
  minReplicaCount: 0
  maxReplicaCount: 50
  pollingInterval: 15
  cooldownPeriod: 300
  triggers:
    - type: azure-servicebus
      metadata:
        queueName: orders
        messageCount: "20"
```

`messageCount: "20"` means one replica per twenty queued messages. Set it from how long one message takes: a message taking ten seconds and a target latency of two minutes suggests roughly twelve messages per replica.

## Out fast, in slow

```bash
az monitor autoscale rule create \
  --resource-group rg-shop-prod-uks --autoscale-name autoscale-shop \
  --condition "CpuPercentage > 70 avg 5m" --scale out 3 --cooldown 3

az monitor autoscale rule create \
  --resource-group rg-shop-prod-uks --autoscale-name autoscale-shop \
  --condition "CpuPercentage < 30 avg 20m" --scale in 1 --cooldown 15
```

```text
Scale out   short window, several instances, short cooldown
Scale in    long window, one instance, long cooldown
```

Adding capacity too slowly costs user experience. Removing it too quickly causes flapping, which costs more than the instances you saved.

The asymmetry is deliberate and it is the most important tuning decision.

## Cooldown prevents flapping

Without a cooldown, a rule fires, instances start, the metric has not moved yet because they are still warming up, and it fires again. Then load drops and the reverse happens.

```text
Scale out cooldown  3 to 5 minutes
Scale in cooldown   10 to 20 minutes
```

The cooldown must be longer than the time it takes a new instance to affect the metric.

## Schedule what you can predict

```bash
az monitor autoscale profile create \
  --resource-group rg-shop-prod-uks --autoscale-name autoscale-shop \
  --name weekday-business-hours \
  --min-count 6 --max-count 30 --count 8 \
  --recurrence week mon tue wed thu fri --start 07:00 --end 19:00 \
  --timezone "GMT Standard Time"

az monitor autoscale profile create \
  --resource-group rg-shop-prod-uks --autoscale-name autoscale-shop \
  --name overnight \
  --min-count 2 --max-count 10 --count 2 \
  --recurrence week mon tue wed thu fri sat sun --start 19:00 --end 07:00 \
  --timezone "GMT Standard Time"
```

**For predictable traffic, scheduled scaling beats reactive scaling every time**, because capacity is already there when the load arrives rather than arriving five minutes later.

Most business applications have highly predictable daily and weekly patterns. Use them.

Reactive rules within a scheduled profile handle the unexpected on top of the baseline, which is the combination that works.

## Predictive autoscale

```bash
az monitor autoscale update \
  --resource-group rg-shop-prod-uks --name autoscale-shop \
  --predictive-autoscale-mode Enabled \
  --predictive-scale-look-ahead-time 10m
```

Predictive autoscale for scale sets uses machine learning on historical CPU to provision ahead of an expected increase. It needs weeks of history and a genuinely repeating pattern.

Run it in `ForecastOnly` mode first to see whether its predictions match reality before letting it act.

## Do not scale into a bottleneck

Scaling the application tier is easy. It also moves the problem.

```text
Ten more instances -> ten times the database connections
Ten more instances -> ten times the calls to a rate limited API
Ten more instances -> the same single threaded downstream service
```

```csharp
builder.Services.AddDbContext<ShopContext>(options =>
    options.UseSqlServer(connectionString, sql =>
    {
        sql.EnableRetryOnFailure();
        sql.CommandTimeout(30);
    }));
```

**Set a maximum instance count deliberately.** It is a safety valve protecting downstream systems and the bill, not a performance setting.

Before enabling aggressive autoscale, work out what breaks first when instance count multiplies. It is usually the database connection limit.

## Scale up before scaling out

```text
Scale out solves  too many requests
Scale up solves   one request needing more CPU or memory
```

A slow endpoint doing heavy work does not get faster with more instances. Ten instances each taking eight seconds still take eight seconds.

Check which problem you have before adding a scaling rule, since the wrong one adds cost and fixes nothing.

## Handle scale in properly

```csharp
builder.Services.Configure<HostOptions>(options =>
{
    options.ShutdownTimeout = TimeSpan.FromSeconds(30);
});

public class GracefulWorker(IHostApplicationLifetime lifetime) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var message = await _queue.ReceiveAsync(stoppingToken);
            if (message is null) continue;

            // finish this message even if shutdown starts
            await ProcessAsync(message, CancellationToken.None);
            await _queue.CompleteAsync(message);
        }
    }
}
```

Scale in removes instances. An instance handling a request or a message must finish it, and an application that ignores `SIGTERM` drops work on every scale in.

That produces intermittent failures that correlate with load dropping, which is a confusing thing to debug.

## Watch what it does

```bash
az monitor autoscale show --resource-group rg-shop-prod-uks --name autoscale-shop

az monitor activity-log list --offset 7d \
  --query "[?contains(operationName.value, 'autoscale')].{Time:eventTimestamp, Status:status.value, Description:properties.description}" \
  -o table
```

```kusto
AutoscaleEvaluationsLog
| where TimeGenerated > ago(7d)
| summarize count() by ProfileEvaluationResult, bin(TimeGenerated, 1h)
| render timechart
```

```text
Never scales      the threshold is never reached, or the maximum is already hit
Scales constantly the cooldown is too short, or the window too narrow
Scales and helps nothing  the bottleneck is elsewhere
Scales too late   reactive lag. Schedule it instead.
```

Setting up autoscale and never checking what it did is common, and the rules are usually wrong the first time.

## Quick recap

- Reactive scaling always lags by three to ten minutes, and that is the starting assumption.
- CPU is the default signal and often wrong, since queue length and request queue depth are better.
- Scale out fast with short windows, and scale in slowly with long ones.
- Cooldowns must be longer than the time a new instance takes to affect the metric.
- Scheduled profiles beat reactive rules for predictable traffic, with reactive rules on top.
- Set a maximum deliberately, because scaling out multiplies pressure on downstream systems.
- Handle `SIGTERM`, or scale in drops work and produces confusing intermittent failures.

<code id="code-content" class="language-bash">
# REACTIVE SCALING ALWAYS LAGS: load rises, the metric moves, the window
# passes, the rule evaluates, instances provision, they warm up. Three to
# TEN MINUTES, during which users get slow responses whatever the rule says.
# CPU IS THE DEFAULT SIGNAL AND OFTEN THE WRONG ONE:
#   web app        HTTP queue length, or requests per instance
#   queue worker   QUEUE DEPTH, and not CPU at all
#   memory bound   memory percentage
#   database bound scaling rarely helps: the database is the constraint
# HttpQueueLength means requests ARE WAITING, whatever the CPU shows. A
# thread pool starved app can be at 30% CPU and completely unresponsive.
az monitor autoscale rule create --resource-group rg-shop-prod-uks \
  --autoscale-name autoscale-shop --condition "HttpQueueLength &gt; 25 avg 5m" \
  --scale out 2 --cooldown 5
# OUT FAST, IN SLOW. This asymmetry is the most important tuning decision:
# adding capacity too slowly costs user experience, and removing it too
# quickly causes FLAPPING, which costs more than the instances saved.
az monitor autoscale rule create --resource-group rg-shop-prod-uks \
  --autoscale-name autoscale-shop --condition "CpuPercentage &gt; 70 avg 5m" \
  --scale out 3 --cooldown 3
az monitor autoscale rule create --resource-group rg-shop-prod-uks \
  --autoscale-name autoscale-shop --condition "CpuPercentage &lt; 30 avg 20m" \
  --scale in 1 --cooldown 15
# THE COOLDOWN MUST BE LONGER THAN THE TIME A NEW INSTANCE TAKES TO AFFECT
# THE METRIC, or the rule fires again while instances are still warming up.
# FOR PREDICTABLE TRAFFIC, SCHEDULED SCALING BEATS REACTIVE EVERY TIME:
# capacity is ALREADY THERE when load arrives, not five minutes later. Most
# business applications have highly predictable daily and weekly patterns.
az monitor autoscale profile create --resource-group rg-shop-prod-uks \
  --autoscale-name autoscale-shop --name weekday-business-hours \
  --min-count 6 --max-count 30 --count 8 \
  --recurrence week mon tue wed thu fri --start 07:00 --end 19:00 \
  --timezone "GMT Standard Time"
# Reactive rules ON TOP of a scheduled baseline handle the unexpected. That
# combination is what works.
# DO NOT SCALE INTO A BOTTLENECK. Ten more instances means ten times the
# database connections and ten times the calls to a rate limited API.
# Work out WHAT BREAKS FIRST when instance count multiplies. It is usually
# the database connection limit. SET A MAXIMUM DELIBERATELY: it is a safety
# valve for downstream systems and the bill, not a performance setting.
# SCALE UP vs SCALE OUT solve DIFFERENT PROBLEMS. Ten instances each taking
# eight seconds STILL TAKE EIGHT SECONDS. Check which problem you have.
# HANDLE SIGTERM, or scale in DROPS WORK, producing intermittent failures
# that correlate with load DROPPING. A confusing thing to debug.
# WATCH WHAT IT ACTUALLY DID. The rules are usually wrong the first time:
az monitor activity-log list --offset 7d -o table \
  --query "[?contains(operationName.value,'autoscale')].{Time:eventTimestamp, Desc:properties.description}"
#   never scales       threshold never reached, or maximum already hit
#   scales constantly  cooldown too short, window too narrow
#   scales, no help    the bottleneck is elsewhere
#   scales too late    reactive lag. Schedule it instead.
</code></pre>
