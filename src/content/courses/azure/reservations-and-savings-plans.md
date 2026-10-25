---
publishDate: 2026-10-28T13:15
title: Reservations, Savings Plans and Spot
slug: reservations-and-savings-plans
metadescription: Cut Azure compute cost with reservations, savings plans and spot instances, and know which commitment fits which workload.
updateDate: 2026-09-07T13:15
author: ['bishal-biswas']
level: 2
tags: ['cost', 'reservations', 'finops']
course: azure
---

## The three options

```text
Reservation    commit to a SPECIFIC resource type in a region. Up to 72% off.
Savings plan   commit to an HOURLY SPEND on compute. Up to 65% off. Flexible.
Spot           surplus capacity, evictable with 30 seconds notice. Up to 90% off.
```

They combine. A reservation for a stable database, a savings plan for variable compute, and spot for batch work is a normal shape.

## Reservations

```bash
az reservations catalog show \
  --reserved-resource-type VirtualMachines \
  --location uksouth --subscription-id 0000...

az reservations reservation-order calculate \
  --applied-scope-type Shared \
  --billing-scope /subscriptions/0000... \
  --display-name "shop-prod-d4s" \
  --quantity 5 --sku Standard_D4s_v5 \
  --term P3Y --billing-plan Monthly \
  --reserved-resource-type VirtualMachines --location uksouth
```

```text
1 year   a smaller discount, less commitment
3 years  the largest discount, and three years is a long time in cloud
```

Available for virtual machines, SQL Database, Cosmos DB, App Service, Redis, Storage, Databricks and more. Coverage is wider than most people assume.

**A reservation is a billing construct, not a capacity guarantee.** It does not reserve hardware in the ordinary sense; it applies a discount to matching usage.

## Instance size flexibility

```bash
az reservations reservation update \
  --reservation-order-id "$ORDER_ID" --reservation-id "$RESERVATION_ID" \
  --instance-flexibility On
```

With flexibility on, a reservation for a `Standard_D4s_v5` also applies to other sizes in the same family, scaled by ratio. One D4s reservation covers two D2s instances.

That removes most of the risk of committing to a specific size, because resizing within the family keeps the discount.

It does not cross families or regions, which are the commitments that matter.

## Savings plans

```bash
az billing savings-plan-order list
```

A savings plan commits to an hourly spend on compute rather than to a specific resource. Any eligible compute usage draws down against it.

```text
Reservation    a specific SKU in a specific region. Bigger discount, less flexible.
Savings plan   any compute, any region, any size. Smaller discount, very flexible.
```

```text
Choose a reservation when
  the workload is stable and unlikely to change shape
  it is a database, which rarely moves
  the extra discount matters

Choose a savings plan when
  you are migrating between services or regions
  the estate changes shape regularly
  you want one commitment covering several services
```

For a team still evolving its architecture, a savings plan avoids being locked into a size and region that are wrong in six months.

## Commit to the baseline, not the peak

Both are use it or lose it, hour by hour. Unused commitment in an hour is wasted.

```kusto
// find the sustained baseline over a quarter
InsightsMetrics
| where TimeGenerated > ago(90d)
| where Name == "UtilizationPercentage"
| summarize hourly = avg(Val) by bin(TimeGenerated, 1h)
| summarize p10 = percentile(hourly, 10), p50 = percentile(hourly, 50)
```

```bash
az consumption usage list --start-date 2026-06-01 --end-date 2026-08-31 \
  --query "[?contains(meterDetails.meterCategory, 'Virtual Machines')].{Date:usageStart, Quantity:usageQuantity, Cost:pretaxCost}" \
  -o table
```

Commit to the **tenth percentile** of usage, not the average and certainly not the peak. Anything above the commitment is billed at the ordinary rate, which is fine. Anything below it is money burned.

Over committing is worse than under committing, and it is the common mistake.

## Scope

```text
Shared            applies across all subscriptions in the billing account
Single subscription  applies to one
Single resource group  applies to one
Management group  applies to a group
```

Shared scope maximises utilisation, since unused capacity in one subscription applies to another. Use it unless there is a chargeback reason not to.

```bash
az reservations reservation update \
  --reservation-order-id "$ORDER_ID" --reservation-id "$RESERVATION_ID" \
  --applied-scope-type Shared
```

## Azure Hybrid Benefit

Applies existing Windows Server and SQL Server licences with Software Assurance, and it stacks with reservations.

```bash
az vm update --name vm-shop-01 --resource-group rg-shop-prod-uks \
  --license-type Windows_Server

az sql db update --name shop --server sql-shop-prod \
  --resource-group rg-shop-prod-uks --license-type BasePrice
```

The saving is substantial, up to around 40 percent on Windows virtual machines and more on SQL. It is also frequently forgotten, so it is worth auditing:

```kusto
Resources
| where type =~ 'microsoft.compute/virtualmachines'
| where properties.storageProfile.osDisk.osType == 'Windows'
| where isnull(properties.licenseType)
| project name, resourceGroup, subscriptionId
```

Every row in that result is potential saving that requires only a configuration change, assuming the licences exist.

## Spot

```bash
az vm create --name vm-batch-01 --resource-group rg-batch \
  --image Ubuntu2404 --size Standard_D8s_v5 \
  --priority Spot --max-price -1 --eviction-policy Delete \
  --generate-ssh-keys

az aks nodepool add --cluster-name aks-shop --resource-group rg-shop-prod-uks \
  --name spot --priority Spot --eviction-policy Delete --spot-max-price -1 \
  --enable-cluster-autoscaler --min-count 0 --max-count 20 \
  --node-taints "kubernetes.azure.com/scalesetpriority=spot:NoSchedule"
```

```text
Right for   batch, CI agents, rendering, training, anything restartable
Wrong for   user facing services, stateful work, anything with a deadline
```

`--max-price -1` means pay up to the standard price rather than being evicted on price, so eviction only happens when Azure needs the capacity.

Thirty seconds notice arrives through the scheduled events endpoint, which is enough to checkpoint and exit cleanly if the application listens for it.

## Dev/Test pricing

```text
Enterprise Dev/Test or Pay-As-You-Go Dev/Test subscriptions
No Windows or SQL licence charge on virtual machines
Discounted rates on several services
Not for production. That is a licensing term, not a suggestion.
```

For an organisation with several non production environments this is a substantial saving that requires only putting them in the right subscription type.

## Reviewing what you bought

```bash
az consumption reservation summary list \
  --reservation-order-id "$ORDER_ID" --grain daily \
  --start-date 2026-08-01 --end-date 2026-08-31

az reservations reservation list --reservation-order-id "$ORDER_ID" -o table
```

Utilisation below 100 percent is wasted commitment. Consistently low utilisation means the reservation is scoped wrongly, or the workload moved.

```text
Utilisation above 95%   working as intended
80 to 95%               acceptable, worth checking the scope
Below 80%               something changed. Exchange or adjust.
```

Reservations can be exchanged for a different size or region, and refunded up to an annual limit. Neither is unlimited, so buying carefully matters more than being able to correct it.

## An order to work in

```text
1. Right size first. Committing to oversized resources locks in the waste.
2. Shut down what is not needed.
3. Apply Hybrid Benefit, which is free money if the licences exist.
4. Move interruptible work to spot.
5. Then commit to the remaining stable baseline.
```

**Right sizing before committing is the important ordering.** A three year reservation on a machine twice the size it needs locks in the mistake for three years.

## Quick recap

- Reservations commit to a resource type, savings plans commit to hourly compute spend.
- Instance size flexibility removes most of the risk of committing to a specific size.
- Commit to the tenth percentile of usage, since unused commitment is burned hourly.
- Use shared scope unless chargeback requires otherwise.
- Hybrid Benefit stacks with reservations and is frequently forgotten.
- Spot is for restartable work, and `--max-price -1` avoids price based eviction.
- Right size before committing, or a three year reservation locks in the waste.

<code id="code-content" class="language-bash">
# THREE OPTIONS THAT COMBINE:
#   RESERVATION   a SPECIFIC resource type in a region. Up to 72% off.
#   SAVINGS PLAN  an HOURLY SPEND on compute. Up to 65%. Flexible.
#   SPOT          surplus capacity, evictable. Up to 90%.
# A reservation for a stable database, a savings plan for variable compute,
# and spot for batch is a normal shape.
# A RESERVATION IS A BILLING CONSTRUCT, NOT A CAPACITY GUARANTEE. It applies
# a discount to matching usage; it does not hold hardware for you.
az reservations reservation-order calculate --applied-scope-type Shared \
  --billing-scope /subscriptions/0000... --display-name "shop-prod-d4s" \
  --quantity 5 --sku Standard_D4s_v5 --term P3Y --billing-plan Monthly \
  --reserved-resource-type VirtualMachines --location uksouth
# INSTANCE SIZE FLEXIBILITY removes most of the risk: a D4s reservation also
# covers two D2s instances in the same family, scaled by ratio. It does NOT
# cross FAMILIES or REGIONS, which are the commitments that matter.
az reservations reservation update --reservation-order-id "$ORDER_ID" \
  --reservation-id "$RESERVATION_ID" --instance-flexibility On
# RESERVATION vs SAVINGS PLAN:
#   reservation   stable workload, a database, the bigger discount
#   savings plan  migrating between services or regions, changing estate,
#                 one commitment covering several services
# COMMIT TO THE BASELINE, NOT THE PEAK. Both are USE IT OR LOSE IT, HOUR BY
# HOUR. Commit to roughly the TENTH PERCENTILE of usage: anything above is
# billed at the ordinary rate, which is fine. Anything below is BURNED.
# OVER COMMITTING IS WORSE THAN UNDER COMMITTING, and it is the common mistake.
az consumption usage list --start-date 2026-06-01 --end-date 2026-08-31 -o table \
  --query "[?contains(meterDetails.meterCategory,'Virtual Machines')].{Date:usageStart, Cost:pretaxCost}"
# SHARED SCOPE maximises utilisation, since unused capacity in one
# subscription applies to another. Use it unless chargeback prevents it.
# AZURE HYBRID BENEFIT STACKS WITH RESERVATIONS and is FREQUENTLY FORGOTTEN.
# Up to about 40% on Windows VMs and more on SQL. Worth auditing:
az vm update --name vm-shop-01 --resource-group rg-shop-prod-uks \
  --license-type Windows_Server
#   Resources | where type =~ 'microsoft.compute/virtualmachines'
#   | where properties.storageProfile.osDisk.osType == 'Windows'
#   | where isnull(properties.licenseType)     &lt;- every row is a saving
# SPOT: right for batch, CI agents, rendering and training. WRONG for user
# facing, stateful, or anything with a deadline. --max-price -1 pays up to
# the standard price, so eviction only happens when AZURE needs capacity.
# Thirty seconds notice arrives via scheduled events, enough to checkpoint.
az aks nodepool add --cluster-name aks-shop --resource-group rg-shop-prod-uks \
  --name spot --priority Spot --eviction-policy Delete --spot-max-price -1 \
  --enable-cluster-autoscaler --min-count 0 --max-count 20
# CHECK UTILISATION. Below 80% means the scope is wrong or the workload moved:
az consumption reservation summary list --reservation-order-id "$ORDER_ID" \
  --grain daily --start-date 2026-08-01 --end-date 2026-08-31
# THE ORDER MATTERS:
#   1. RIGHT SIZE FIRST. A three year reservation on a machine twice the
#      size it needs LOCKS IN THE MISTAKE FOR THREE YEARS.
#   2. shut down what is not needed
#   3. apply Hybrid Benefit
#   4. move interruptible work to spot
#   5. THEN commit to the remaining stable baseline
</code></pre>
