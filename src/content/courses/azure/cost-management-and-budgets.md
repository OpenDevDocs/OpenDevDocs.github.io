---
publishDate: 2026-10-28T13:10
title: Cost Management and Budgets
slug: cost-management-and-budgets
metadescription: Understand where Azure spend goes, set budgets that catch problems early, and find the savings that actually exist.
updateDate: 2026-09-07T13:10
author: ['bishal-biswas']
level: 2
tags: ['cost', 'finops', 'governance']
course: azure
---

## See the actual numbers first

```bash
az consumption usage list \
  --start-date 2026-08-01 --end-date 2026-08-31 \
  --query "[].{Service:meterDetails.meterCategory, Cost:pretaxCost, Currency:currency}" \
  --output table

az costmanagement query \
  --type ActualCost --timeframe MonthToDate \
  --scope /subscriptions/0000... \
  --dataset-aggregation '{"totalCost":{"name":"PreTaxCost","function":"Sum"}}' \
  --dataset-grouping name="ServiceName" type="Dimension"
```

Start with what is actually being spent, grouped by service. The answer is usually surprising, and it is almost never the thing people assumed.

Common patterns in a first look:

```text
Compute is the largest line, and often oversized
Log Analytics ingestion is much larger than expected
Bandwidth between regions is quietly significant
Development environments running at weekends
Orphaned resources nobody remembers
```

## Tags make cost attributable

```bash
az policy assignment create \
  --name require-tags \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy 96670d01-0a4d-4649-9c89-2d3abc0a5025 \
  --params '{"tagName":{"value":"costCentre"}}'

az policy assignment create \
  --name inherit-tag-from-rg \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy cd3aa116-8754-49c9-a813-ad46512ece54 \
  --params '{"tagName":{"value":"costCentre"}}' \
  --location uksouth --mi-system-assigned --role Contributor \
  --identity-scope /providers/Microsoft.Management/managementGroups/mg-contoso
```

The second policy is the useful one: it **inherits a tag from the resource group** onto resources that lack it. Requiring tags without inheritance means every deployment must set them, and eventually one does not.

```bash
az costmanagement query \
  --type ActualCost --timeframe MonthToDate --scope /subscriptions/0000... \
  --dataset-aggregation '{"totalCost":{"name":"PreTaxCost","function":"Sum"}}' \
  --dataset-grouping name="costCentre" type="TagKey"
```

Untagged resources appear as a single large unattributable line, which is where cost conversations stall.

## Budgets

```bash
az consumption budget create \
  --budget-name shop-prod-monthly \
  --amount 5000 --time-grain Monthly \
  --category Cost \
  --start-date 2026-09-01 --end-date 2027-09-01 \
  --resource-group rg-shop-prod-uks

az consumption budget create \
  --budget-name shop-forecast \
  --amount 5000 --time-grain Monthly \
  --category Cost --start-date 2026-09-01 --end-date 2027-09-01
```

**Set both actual and forecast alerts.** An actual alert at 100 percent fires when the money is already spent. A forecast alert at 80 percent fires while there is still time to do something.

```text
Forecast 80%   investigate now
Actual 90%     act today
Actual 100%    it has happened
```

A budget is an alert, not a limit. Azure does not stop resources when it is exceeded, and expecting it to is a costly misunderstanding.

For a hard stop, an alert triggering an Automation runbook that deallocates non production resources is the closest available equivalent.

## Anomaly detection

```bash
az costmanagement alert list --scope /subscriptions/0000...
```

Cost anomaly alerts detect unusual daily spend against the recent pattern, which catches things a monthly budget misses entirely: a test left running, an accidental premium tier, a runaway autoscale.

Enable it on every subscription. Finding an anomaly on day two rather than in next month's invoice is the difference between a small and a large surprise.

## Where the money usually is

**Compute sized for a peak that never came.**

```kusto
InsightsMetrics
| where TimeGenerated > ago(30d)
| where Name == "UtilizationPercentage"
| summarize avgCpu = avg(Val), maxCpu = max(Val) by Computer
| where maxCpu < 40
| order by avgCpu asc
```

A machine peaking at 40 percent over a month is at least one size too large.

**Stopped virtual machines that are not deallocated.**

```bash
az vm list -d --query "[?powerState=='VM stopped'].{Name:name, RG:resourceGroup}" -o table
```

Stopped still bills for compute. Only deallocated does not.

**Unattached disks and orphaned public IPs.**

```kusto
Resources
| where type =~ 'microsoft.compute/disks' and properties.diskState == 'Unattached'
| extend sizeGb = toint(properties.diskSizeGB)
| summarize disks = count(), totalGb = sum(sizeGb) by subscriptionId

Resources
| where type =~ 'microsoft.network/publicipaddresses'
| where isnull(properties.ipConfiguration)
| project name, resourceGroup, subscriptionId
```

**Log Analytics ingestion.**

```kusto
Usage
| where TimeGenerated > ago(30d) and IsBillable
| summarize GB = sum(Quantity) / 1000 by DataType
| order by GB desc
```

Frequently one of the largest lines and rarely reviewed. Verbose application logs and container stdout are the usual culprits, and both can move to a Basic table plan.

**Development environments running at weekends.**

```bash
az vm auto-shutdown --name vm-dev-01 --resource-group rg-shop-dev-uks --time 1900
az sql db update --name shop-dev --server sql-shop-dev \
  --resource-group rg-shop-dev-uks --compute-model Serverless --auto-pause-delay 60
az aks stop --name aks-dev --resource-group rg-shop-dev-uks
```

Non production running only during working hours is roughly a 70 percent saving on those resources, and it is the easiest win available.

## Advisor recommendations

```bash
az advisor recommendation list --category Cost \
  --query "[].{Resource:impactedValue, Problem:shortDescription.problem, Saving:extendedProperties.annualSavingsAmount}" \
  --output table
```

Advisor identifies idle resources, right sizing opportunities and reservation candidates with estimated savings.

Treat the recommendations as a starting list to verify, not instructions. It sometimes suggests downsizing something that is idle because it is a standby.

## Making cost visible

```bash
az costmanagement export create \
  --name monthly-costs --type ActualCost --scope /subscriptions/0000... \
  --storage-account-id /subscriptions/.../storageAccounts/stshopcosts \
  --storage-container costs --storage-directory monthly \
  --timeframe MonthToDate --recurrence Daily \
  --recurrence-period from="2026-09-01T00:00:00Z" to="2027-09-01T00:00:00Z"
```

A daily export to storage feeds Power BI or any analysis tool, and the detail is far richer than the portal shows.

The practice that changes behaviour: **show each team their own cost, monthly, with the trend.** Engineers who see the number make different decisions, and no amount of policy substitutes for that.

## Structural savings

```text
Reservations and savings plans   up to 65 percent, for a commitment
Azure Hybrid Benefit             existing Windows and SQL licences
Spot instances                   up to 90 percent for interruptible work
Dev/Test pricing                 substantially cheaper for non production
Right sizing                     usually the largest single saving
Autoscale and schedules          pay for what you use
Lifecycle policies on storage    tier and delete automatically
```

Right sizing usually beats all the purchasing options combined, and it is the one people do last because it requires looking at each workload.

## A monthly routine

```text
1. Review the top ten resources by cost
2. Check budget and anomaly alerts that fired
3. Run the orphaned resource queries
4. Look at Log Analytics ingestion by table
5. Check Advisor's cost recommendations
6. Send each team their number
```

Half an hour a month, and it consistently finds more than any one off exercise.

## Quick recap

- Start by looking at actual spend by service, since the answer is usually surprising.
- Use a tag inheritance policy, not just a tag requirement, or attribution has gaps.
- Set forecast alerts as well as actual, because an actual alert fires too late.
- A budget is an alert, not a limit, and Azure does not stop anything.
- Enable anomaly detection, which catches what a monthly budget misses.
- Stopped virtual machines still bill, and only deallocated ones do not.
- Right sizing usually saves more than every purchasing option combined.

<code id="code-content" class="language-bash">
# START WITH WHAT IS ACTUALLY BEING SPENT, BY SERVICE. The answer is usually
# surprising and almost never what people assumed.
az costmanagement query --type ActualCost --timeframe MonthToDate \
  --scope /subscriptions/0000... \
  --dataset-aggregation '{"totalCost":{"name":"PreTaxCost","function":"Sum"}}' \
  --dataset-grouping name="ServiceName" type="Dimension"
# TAG INHERITANCE IS THE USEFUL POLICY, not just tag requirement. Requiring
# tags without inheritance means EVERY deployment must set them, and
# eventually one does not. Untagged resources become one large
# unattributable line, and that is where cost conversations stall.
az policy assignment create --name inherit-tag-from-rg \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy cd3aa116-8754-49c9-a813-ad46512ece54 \
  --params '{"tagName":{"value":"costCentre"}}' \
  --location uksouth --mi-system-assigned --role Contributor
# SET FORECAST ALERTS AS WELL AS ACTUAL. An actual alert at 100% fires when
# THE MONEY IS ALREADY SPENT. A forecast alert at 80% fires while there is
# still time to act.
az consumption budget create --budget-name shop-prod-monthly --amount 5000 \
  --time-grain Monthly --category Cost --start-date 2026-09-01 \
  --end-date 2027-09-01 --resource-group rg-shop-prod-uks
# A BUDGET IS AN ALERT, NOT A LIMIT. Azure does NOT stop resources when it
# is exceeded, and expecting it to is a costly misunderstanding.
# ANOMALY DETECTION catches what a monthly budget misses entirely: a test
# left running, an accidental premium tier, a runaway autoscale. Day two
# rather than next month's invoice.
# WHERE THE MONEY USUALLY IS:
#   1. COMPUTE SIZED FOR A PEAK THAT NEVER CAME. A machine peaking at 40%
#      over a month is at least one size too large.
#   2. STOPPED VMs THAT ARE NOT DEALLOCATED. Stopped STILL BILLS.
az vm list -d --query "[?powerState=='VM stopped'].{Name:name, RG:resourceGroup}" -o table
#   3. UNATTACHED DISKS AND ORPHANED PUBLIC IPs:
#      Resources | where type =~ 'microsoft.compute/disks'
#      | where properties.diskState == 'Unattached'
#   4. LOG ANALYTICS INGESTION, frequently one of the largest lines and
#      rarely reviewed. Verbose app logs and container stdout are the
#      culprits, and both can move to a Basic table plan:
#      Usage | where IsBillable | summarize GB = sum(Quantity)/1000 by DataType
#   5. DEV ENVIRONMENTS RUNNING AT WEEKENDS. Roughly a 70% saving, and the
#      easiest win available:
az vm auto-shutdown --name vm-dev-01 --resource-group rg-shop-dev-uks --time 1900
az aks stop --name aks-dev --resource-group rg-shop-dev-uks
# ADVISOR IS A LIST TO VERIFY, NOT INSTRUCTIONS. It sometimes suggests
# downsizing something idle BECAUSE IT IS A STANDBY.
az advisor recommendation list --category Cost -o table \
  --query "[].{Resource:impactedValue, Saving:extendedProperties.annualSavingsAmount}"
# THE PRACTICE THAT CHANGES BEHAVIOUR: SHOW EACH TEAM THEIR OWN COST,
# MONTHLY, WITH THE TREND. Engineers who see the number make different
# decisions, and no amount of policy substitutes for that.
az costmanagement export create --name monthly-costs --type ActualCost \
  --scope /subscriptions/0000... --recurrence Daily \
  --storage-account-id /subscriptions/.../storageAccounts/stshopcosts \
  --storage-container costs --timeframe MonthToDate
# RIGHT SIZING USUALLY BEATS ALL THE PURCHASING OPTIONS COMBINED, and it is
# what people do last because it means looking at each workload.
# A MONTHLY HALF HOUR: top ten by cost, alerts that fired, orphan queries,
# ingestion by table, Advisor, then send each team their number.
</code></pre>
