---
publishDate: 2026-10-26T12:45
title: Alerts, Action Groups and On Call
slug: alerts-and-action-groups
metadescription: Build Azure alerts people actually respond to, with action groups, severities and the discipline to keep the noise down.
updateDate: 2026-09-07T12:45
author: ['bishal-biswas']
level: 2
tags: ['observability', 'alerting', 'on call']
course: azure
---

## Alert types

```text
Metric alert    a numeric threshold. Cheap, fast, near real time.
Log alert       a KQL query. Flexible, slower, charged per rule.
Activity log    a control plane event, like a resource being deleted.
Service health  Azure telling you about an outage or planned maintenance.
Smart detection Application Insights spotting anomalies automatically.
```

Prefer a metric alert whenever a metric exists. Log alerts run on a schedule with a delay, and they cost more.

## Action groups

Where an alert goes, defined once and reused.

```bash
az monitor action-group create \
  --name ag-oncall --resource-group rg-shop-prod-uks \
  --short-name oncall \
  --action email primary asha@contoso.com \
  --action sms uk 44 7700900123 \
  --action webhook pagerduty "https://events.pagerduty.com/integration/abc/enqueue" \
  --action logicapp remediate "/subscriptions/.../workflows/restart-app" \
      "https://prod-00.uksouth.logic.azure.com/workflows/..."
```

```text
Email, SMS, voice, push
Webhook, and secure webhook with Entra ID authentication
Logic App, Function, Automation Runbook, Event Hub
ITSM connector for ServiceNow and similar
```

**Have a small number of action groups, not one per alert.** Three is usually right:

```text
ag-oncall     wakes someone. Severity 0 and 1.
ag-team       a channel message during working hours. Severity 2.
ag-ticket     raises a ticket. Severity 3 and 4.
```

Changing who is on call then means changing one action group rather than forty alert rules.

## Severity, meant literally

```text
Sev 0  Critical    users cannot use the service. Wake someone up.
Sev 1  Error       significant degradation. Respond within the hour.
Sev 2  Warning     something needs attention today.
Sev 3  Informational  worth knowing, no action expected.
Sev 4  Verbose     rarely useful as an alert.
```

The discipline that matters: **if a severity 1 alert does not warrant an immediate response, it is not severity 1.** Inflated severity is the fastest way to make on call ignore alerts entirely.

## Alerts worth having

```bash
# users are seeing errors
az monitor metrics alert create \
  --name error-rate-high --resource-group rg-shop-prod-uks \
  --scopes /subscriptions/.../sites/app-shop \
  --condition "total Http5xx > 20" \
  --window-size 5m --evaluation-frequency 1m --severity 1 \
  --action /subscriptions/.../actionGroups/ag-oncall \
  --description "More than 20 server errors in 5 minutes"

# the site is unreachable from outside
az monitor metrics alert create \
  --name availability-drop --resource-group rg-shop-prod-uks \
  --scopes /subscriptions/.../components/appi-shop \
  --condition "avg availabilityResults/availabilityPercentage < 90" \
  --window-size 5m --evaluation-frequency 1m --severity 0 \
  --action /subscriptions/.../actionGroups/ag-oncall

# a queue is backing up, which means workers are not keeping up
az monitor metrics alert create \
  --name queue-backlog --resource-group rg-shop-prod-uks \
  --scopes /subscriptions/.../namespaces/sb-shop-prod \
  --condition "avg ActiveMessages > 5000" \
  --window-size 15m --evaluation-frequency 5m --severity 2 \
  --action /subscriptions/.../actionGroups/ag-team

# work is being lost silently
az monitor metrics alert create \
  --name dead-letter-messages --resource-group rg-shop-prod-uks \
  --scopes /subscriptions/.../namespaces/sb-shop-prod \
  --condition "total DeadletteredMessages > 0" \
  --window-size 15m --evaluation-frequency 5m --severity 2 \
  --action /subscriptions/.../actionGroups/ag-team
```

The dead letter alert is one of the highest value alerts most systems are missing.

## Log alerts

```bash
az monitor scheduled-query create \
  --name slow-checkout --resource-group rg-shop-prod-uks \
  --scopes /subscriptions/.../components/appi-shop \
  --condition "count 'query' > 0" \
  --condition-query query="requests
    | where timestamp > ago(15m)
    | where name contains 'Checkout'
    | summarize p95 = percentile(duration, 95)
    | where p95 > 3000" \
  --evaluation-frequency 5m --window-size 15m --severity 2 \
  --action-groups /subscriptions/.../actionGroups/ag-team
```

Log alerts express conditions no metric can: a specific endpoint, a specific customer, a correlation between two signals.

```bash
az monitor scheduled-query create \
  --name no-orders --resource-group rg-shop-prod-uks \
  --scopes /subscriptions/.../components/appi-shop \
  --condition "count 'query' > 0" \
  --condition-query query="customEvents
    | where timestamp > ago(30m)
    | where name == 'OrderPlaced'
    | summarize orders = count()
    | where orders == 0" \
  --evaluation-frequency 10m --window-size 30m --severity 1 \
  --action-groups /subscriptions/.../actionGroups/ag-oncall
```

**Alerting on the absence of something is underused and valuable.** No orders for thirty minutes on a shop that normally takes one a minute is a real incident, and no infrastructure metric will show it.

## Activity log alerts

```bash
az monitor activity-log alert create \
  --name production-resource-deleted --resource-group rg-shop-prod-uks \
  --scope /subscriptions/.../resourceGroups/rg-shop-prod-uks \
  --condition category=Administrative and operationName=Microsoft.Resources/subscriptions/resourceGroups/delete \
  --action-group /subscriptions/.../actionGroups/ag-oncall

az monitor activity-log alert create \
  --name service-health --resource-group rg-shop-prod-uks \
  --scope /subscriptions/0000... \
  --condition category=ServiceHealth \
  --action-group /subscriptions/.../actionGroups/ag-team
```

Service health alerts tell you when Azure has a problem in a region you use. Without one, you find out by investigating your own application first, which wastes the early part of an incident.

## Suppressing noise

```bash
az monitor action-rule create \
  --name maintenance-window --resource-group rg-shop-prod-uks \
  --rule-type Suppression \
  --scope /subscriptions/.../resourceGroups/rg-shop-prod-uks \
  --suppression-recurrence-type Weekly \
  --suppression-start-time "02:00:00" --suppression-end-time "04:00:00" \
  --suppression-start-date "2026-09-13" --suppression-end-date "2027-09-13"
```

Alert processing rules suppress or reroute without touching the rules themselves. Useful for planned maintenance, and for muting a known issue while it is being fixed.

Give every suppression an end date. A permanent suppression is a deleted alert with extra steps.

## Automatic remediation

```bash
az monitor action-group create \
  --name ag-auto-remediate --resource-group rg-shop-prod-uks \
  --short-name autoremed \
  --action automationrunbook restart \
      "/subscriptions/.../automationAccounts/aa-shop" \
      "https://uksouth.webhook.azure-automation.net/webhooks?token=..." \
      RestartAppService "" true
```

Some alerts have an obvious response, and automating it is better than paging someone. A disk filling up, a service needing a restart, a scale out that autoscale did not handle.

Automate the obvious ones and page for the rest. Log every automated action, or you will have a system that fixes itself in ways nobody understands.

## Keeping alerts useful

The hard part is not creating alerts. It is keeping the set small enough that people read them.

```text
Every alert must have an action. If nobody does anything, delete it.
Every alert needs a runbook link. What do I do at 3am?
Review alerts that fired and were ignored. That is noise.
Review alerts that never fire. They may be broken.
Alert on symptoms, not causes.
```

**Symptoms over causes** is the important one. Alert on "checkout is failing", not "CPU is at 90 percent". High CPU may be fine. Failing checkouts never are.

```bash
az monitor metrics alert list --resource-group rg-shop-prod-uks \
  --query "[].{Name:name, Severity:severity, Enabled:enabled}" -o table

az monitor activity-log list --offset 30d \
  --query "[?category.value=='Alert'].{Time:eventTimestamp, Alert:properties.alertName}" -o table
```

Reviewing which alerts fired in the last month, and what happened as a result, is a half hour exercise that usually removes a third of them.

## Alert rule as code

```bicep
resource errorRate 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'error-rate-high'
  location: 'global'
  properties: {
    severity: 1
    enabled: true
    scopes: [ site.id ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'Http5xx'
          metricName: 'Http5xx'
          operator: 'GreaterThan'
          threshold: 20
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [ { actionGroupId: onCall.id } ]
  }
}
```

Alerts defined in code are reviewable and consistent across environments. Alerts created in the portal during an incident are neither, and they accumulate.

## Quick recap

- Prefer metric alerts, and use log alerts for conditions no metric expresses.
- Keep a small number of action groups, so changing on call is one change.
- Take severity literally, since inflated severity makes people ignore alerts.
- Alert on the absence of expected activity, which no infrastructure metric shows.
- Enable service health alerts, or you investigate your own system during an Azure outage.
- Alert on symptoms rather than causes, because high CPU may be fine and failing checkouts never are.
- Review what fired and was ignored, and delete alerts nobody acts on.

<code id="code-content" class="language-bash">
# PREFER METRIC ALERTS: cheap, fast, near real time. Log alerts run on a
# schedule with a delay and cost per rule, so use them only for conditions
# no metric expresses.
# HAVE A SMALL NUMBER OF ACTION GROUPS, NOT ONE PER ALERT. Three is usually
# right, and changing who is on call is then ONE change, not forty:
#   ag-oncall  wakes someone       sev 0 and 1
#   ag-team    a channel message   sev 2
#   ag-ticket  raises a ticket     sev 3 and 4
az monitor action-group create --name ag-oncall --resource-group rg-shop-prod-uks \
  --short-name oncall --action email primary asha@contoso.com \
  --action webhook pagerduty "https://events.pagerduty.com/integration/abc/enqueue"
# TAKE SEVERITY LITERALLY. IF A SEV 1 DOES NOT WARRANT AN IMMEDIATE
# RESPONSE, IT IS NOT SEV 1. Inflated severity is the fastest way to make
# on call ignore alerts entirely.
az monitor metrics alert create --name error-rate-high \
  --resource-group rg-shop-prod-uks --scopes /subscriptions/.../sites/app-shop \
  --condition "total Http5xx &gt; 20" --window-size 5m --evaluation-frequency 1m \
  --severity 1 --action /subscriptions/.../actionGroups/ag-oncall
# ONE OF THE HIGHEST VALUE ALERTS MOST SYSTEMS ARE MISSING. Dead lettered
# messages are work being lost SILENTLY:
az monitor metrics alert create --name dead-letter-messages \
  --resource-group rg-shop-prod-uks \
  --scopes /subscriptions/.../namespaces/sb-shop-prod \
  --condition "total DeadletteredMessages &gt; 0" --window-size 15m --severity 2 \
  --action /subscriptions/.../actionGroups/ag-team
# ALERTING ON THE ABSENCE OF SOMETHING IS UNDERUSED AND VALUABLE. No orders
# for thirty minutes on a shop that takes one a minute is a real incident,
# and NO INFRASTRUCTURE METRIC WILL SHOW IT:
#   customEvents | where timestamp &gt; ago(30m) | where name == 'OrderPlaced'
#   | summarize orders = count() | where orders == 0
# SERVICE HEALTH ALERTS tell you when AZURE has the problem. Without one you
# investigate your own application first and waste the early part of an
# incident:
az monitor activity-log alert create --name service-health \
  --resource-group rg-shop-prod-uks --scope /subscriptions/0000... \
  --condition category=ServiceHealth \
  --action-group /subscriptions/.../actionGroups/ag-team
# SUPPRESS NOISE WITHOUT TOUCHING THE RULES, and GIVE EVERY SUPPRESSION AN
# END DATE. A permanent suppression is a deleted alert with extra steps.
az monitor action-rule create --name maintenance-window \
  --resource-group rg-shop-prod-uks --rule-type Suppression \
  --scope /subscriptions/.../resourceGroups/rg-shop-prod-uks \
  --suppression-recurrence-type Weekly \
  --suppression-start-time "02:00:00" --suppression-end-time "04:00:00"
# ALERT ON SYMPTOMS, NOT CAUSES. "Checkout is failing", not "CPU is at 90
# percent". High CPU may be fine. Failing checkouts never are.
# KEEPING THE SET USEFUL IS THE HARD PART:
#   every alert must have an ACTION. If nobody does anything, DELETE IT.
#   every alert needs a RUNBOOK LINK. What do I do at 3am?
#   alerts that fired and were IGNORED are noise.
#   alerts that NEVER fire may be broken.
# Reviewing a month of fired alerts takes half an hour and usually removes a
# third of them:
az monitor activity-log list --offset 30d -o table \
  --query "[?category.value=='Alert'].{Time:eventTimestamp, Alert:properties.alertName}"
# DEFINE ALERTS IN CODE. Portal alerts created during an incident are
# neither reviewable nor consistent, and they accumulate.
</code></pre>
