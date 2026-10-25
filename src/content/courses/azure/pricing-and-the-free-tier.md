---
publishDate: 2026-10-02T06:30
title: Reading Azure Pricing and the Free Tier
slug: pricing-and-the-free-tier
metadescription: Read Azure pricing without being surprised, understand what the free tier really includes, and spot the costs people forget.
updateDate: 2026-09-07T06:30
author: ['bishal-biswas']
level: 1
tags: ['cost', 'pricing', 'fundamentals']
course: azure
---

## How Azure charges

Almost everything is one of these:

```text
Per hour        a VM, an App Service plan, a gateway. Charged while it exists.
Per execution   a Function call, a Logic App action.
Per GB          storage, egress, log ingestion.
Per operation   storage transactions, Cosmos DB request units.
Per unit        a provisioned throughput unit, a search unit.
```

The one that surprises people most is **per hour while it exists**. A stopped virtual machine still costs money for its disks and its public IP. A deallocated one does not cost for compute, but a stopped one does.

```bash
az vm stop --name vm-test --resource-group rg-test        # still billed for compute
az vm deallocate --name vm-test --resource-group rg-test  # not billed for compute
```

That distinction has cost people real money.

## The free tier

Two different things get called free.

**The free trial.** A credit for a limited period on a new account. It expires whether you use it or not, and when it runs out the subscription is disabled rather than charging you.

**Always free services.** A set of services with a permanent free allowance:

```text
App Service          a small number of F1 instances
Azure Functions      a monthly grant of executions and GB seconds
Cosmos DB            a free tier account with limited RU/s and storage
Azure SQL            one small serverless database, limited hours
Blob storage         a modest amount of LRS storage and operations
Container Apps       a monthly grant of vCPU seconds and requests
Static Web Apps      a genuinely useful free tier
Entra ID             the free tier covers most basic identity needs
```

The free tiers are real and useful for learning. They are also deliberately limited: F1 App Service has no custom domain SSL, no scaling and a daily CPU quota.

```bash
az appservice plan create --name plan-learn --resource-group rg-learn --sku F1
az cosmosdb create --name cosmos-learn --resource-group rg-learn --enable-free-tier true
```

Note the Cosmos DB free tier is **one per subscription**, and you must ask for it at creation. It cannot be enabled afterwards.

## The costs people forget

**Egress.** Data leaving Azure is charged. Data in is free. Moving data between regions is charged. Moving between availability zones in the same region can be charged.

This catches people building anything that serves large files. A CDN is often cheaper than serving directly from storage, because CDN egress is priced lower.

**Public IP addresses.** Standard SKU public IPs are charged per hour whether attached to anything or not. Orphaned ones from deleted VMs are a classic small leak.

```bash
az network public-ip list --query "[?ipConfiguration==null].{Name:name, RG:resourceGroup}" --output table
```

**Managed disks.** A stopped VM's disks are billed at full price. A VM you keep for three months "just in case" costs money the whole time.

```bash
az disk list --query "[?diskState=='Unattached'].{Name:name, Size:diskSizeGb, RG:resourceGroup}" --output table
```

**Log ingestion.** Application Insights and Log Analytics charge per GB ingested. Turning on verbose logging across a busy application can cost more than the application.

**Backups and snapshots.** Retained backups accumulate. A seven year retention policy is a seven year bill.

**Bandwidth between services.** Two services in the same region talking to each other is usually free. Across regions is not.

## Reading a price

The pricing calculator is the real tool, and the CLI can confirm what SKUs exist.

```bash
az vm list-sizes --location uksouth --output table
az appservice list-locations --sku P1V3 --output table
az sql db list-editions --location uksouth --edition GeneralPurpose --output table
```

The Retail Prices API gives actual numbers without signing in:

```bash
curl -s "https://prices.azure.com/api/retail/prices?\$filter=serviceName eq 'Virtual Machines' and armRegionName eq 'uksouth' and skuName eq 'D2s v5' and priceType eq 'Consumption'" \
  | python -m json.tool
```

Useful for scripting a comparison across regions, which is how you discover a 20 percent difference for the same thing.

## Consumption versus provisioned

The single biggest cost decision for most applications.

```text
Consumption   pay per use, scales to zero, unpredictable bill, cold starts
Provisioned   fixed cost, always warm, predictable bill, pays for idle
```

A quiet internal API on a consumption Function plan might cost under a pound a month. The same API on a P1V3 App Service plan costs the same whether it serves ten requests or ten million.

The crossover is real. Above a certain steady load, provisioned is cheaper. Below it, consumption is much cheaper.

The trap is choosing consumption for something with constant high traffic, or provisioned for something used twice a day.

## Setting a budget before you start

```bash
az consumption budget create \
  --budget-name monthly-limit \
  --amount 100 \
  --category Cost \
  --time-grain Monthly \
  --start-date 2026-09-01 \
  --end-date 2027-09-01 \
  --resource-group rg-learn
```

A budget does not stop spending. It sends an alert. Nothing in Azure automatically caps a subscription's spend, which surprises people coming from services with a hard limit.

For a learning subscription, the practical protection is a budget alert plus the habit of deleting resource groups when you finish.

```bash
az group delete --name rg-learn --yes --no-wait
```

## Checking what you spent

```bash
az consumption usage list --start-date 2026-09-01 --end-date 2026-09-30 \
  --query "[].{Name:instanceName, Cost:pretaxCost, Service:meterDetails.meterCategory}" \
  --output table
```

Cost Analysis in the portal is better for exploring, and grouping by tag is where a good tagging scheme pays off.

## Practical advice

**Delete what you are not using.** The most effective cost control there is.

**Use development SKUs in development.** B series VMs, Basic App Service plans, serverless databases that pause.

**Set a budget alert on every subscription**, including personal learning ones.

**Check for orphans monthly.** Unattached disks, unused public IPs, empty App Service plans, old snapshots.

**Watch log ingestion** after enabling verbose diagnostics, because it is easy to forget.

## Quick recap

- A stopped VM still costs for compute, a deallocated one does not.
- The free trial credit expires whether spent or not, and always free services are separate.
- Cosmos DB free tier is one per subscription and must be set at creation.
- Egress, orphaned public IPs, unattached disks and log ingestion are the forgotten costs.
- Consumption suits low or spiky load, provisioned suits steady high load.
- Nothing caps a subscription's spend automatically, so set a budget alert.
- Deleting unused resource groups is the most effective cost control available.

<code id="code-content" class="language-bash">
# THE DISTINCTION THAT COSTS PEOPLE MONEY
az vm stop --name vm-test --resource-group rg-test        # STILL billed for compute
az vm deallocate --name vm-test --resource-group rg-test  # not billed for compute
# Either way you are still billed for the disks and any public IP.
# ALWAYS FREE tiers are real and useful for learning, and deliberately limited.
az appservice plan create --name plan-learn --resource-group rg-learn --sku F1
# Cosmos DB free tier is ONE PER SUBSCRIPTION and must be set AT CREATION.
# It cannot be enabled afterwards.
az cosmosdb create --name cosmos-learn --resource-group rg-learn --enable-free-tier true
# THE COSTS PEOPLE FORGET
# Orphaned public IPs. Standard SKU is billed per hour whether attached or not.
az network public-ip list \
  --query "[?ipConfiguration==null].{Name:name, RG:resourceGroup}" -o table
# Unattached disks from VMs deleted months ago, billed at full price.
az disk list --query "[?diskState=='Unattached'].{Name:name, GB:diskSizeGb}" -o table
# Also: egress (data OUT is charged, data in is free), cross region traffic,
# log ingestion per GB, and retained backups. A seven year retention policy
# is a seven year bill.
# Real prices without signing in, useful for comparing regions:
curl -s "https://prices.azure.com/api/retail/prices?\$filter=serviceName eq 'Virtual Machines' and armRegionName eq 'uksouth' and priceType eq 'Consumption'"
# What SKUs exist where
az vm list-sizes --location uksouth --output table
az appservice list-locations --sku P1V3 --output table
# THE BIGGEST COST DECISION: consumption vs provisioned.
#   consumption   pay per use, scales to zero, cold starts, unpredictable
#   provisioned   fixed cost, always warm, predictable, pays for idle
# The trap is consumption for constant high traffic, or provisioned for
# something used twice a day.
# A BUDGET DOES NOT STOP SPENDING, it sends an alert. NOTHING in Azure
# automatically caps a subscription, which surprises people.
az consumption budget create --budget-name monthly-limit --amount 100 \
  --category Cost --time-grain Monthly \
  --start-date 2026-09-01 --end-date 2027-09-01 --resource-group rg-learn
# What did I actually spend?
az consumption usage list --start-date 2026-09-01 --end-date 2026-09-30 \
  --query "[].{Name:instanceName, Cost:pretaxCost}" -o table
# THE MOST EFFECTIVE COST CONTROL THERE IS:
az group delete --name rg-learn --yes --no-wait
</code></pre>
