---
publishDate: 2026-10-02T06:20
title: Regions, Availability Zones and Paired Regions
slug: regions-and-availability-zones
metadescription: Choose where to run things, understand what an availability zone actually protects against, and know when a second region is worth it.
updateDate: 2026-09-07T06:20
author: ['bishal-biswas']
level: 1
tags: ['regions', 'availability', 'architecture']
course: azure
---

## The hierarchy

```text
Geography         a country or compliance boundary, e.g. United Kingdom
Region            a set of data centres, e.g. uksouth
Availability zone a physically separate data centre inside a region
Region pair       a partner region Microsoft uses for platform replication
```

A region is not a building. `uksouth` is several data centres near London, and one with zones has at least three that are independently powered, cooled and connected.

## Choosing a region

Four things decide it, in this order.

**Data residency.** If regulation says the data stays in the country, that is the whole decision. Everything else is secondary.

**Latency to users.** Round trip time to the nearest region dominates perceived speed for chatty applications. Test rather than assume.

**Service availability.** Not every service exists in every region. New services appear in a handful first.

```bash
az provider show --namespace Microsoft.App \
  --query "resourceTypes[?resourceType=='containerApps'].locations" --output tsv
```

**Price.** The same resource costs different amounts in different regions, sometimes by 20 percent or more. `westeurope` and `uksouth` are not the same price.

```bash
az account list-locations --query "[?metadata.regionType=='Physical'].{Name:name, Display:displayName, Geo:metadata.geography}" --output table
```

## Availability zones

A zone is a separate physical data centre. Spreading across zones means one data centre failing does not take you down.

```bash
az vm list-skus --location uksouth --size Standard_D2s_v5 \
  --query "[].locationInfo[].zones" --output tsv
```

Three ways a service can relate to zones:

```text
Zonal            you pin a resource to a specific zone
Zone redundant   the platform spreads it across zones for you
Non zonal        the service does not support zones in that region
```

Zone redundant is what you usually want. A zone redundant Azure SQL database or App Service plan handles a zone failure with no action from you.

```bash
az sql db create --resource-group rg-shop-prod-uks --server sql-shop-prod \
  --name shopdb --edition GeneralPurpose --family Gen5 --capacity 2 \
  --zone-redundant true

az storage account create --name stshopproduks --resource-group rg-shop-prod-uks \
  --location uksouth --sku Standard_ZRS
```

`ZRS` on a storage account is zone redundant storage. `LRS` is a single zone, and is the default.

Two caveats. Not every region has zones, and zone redundancy usually costs more. For a development environment it is rarely worth it. For production it usually is.

## What a zone does not protect against

**A regional outage.** A configuration problem or a platform issue affecting the whole region takes every zone with it. Rare, and it happens.

**Your own mistakes.** A bad deployment goes to every zone simultaneously.

**Data loss.** Zone redundancy replicates, and a deletion replicates too. You still need backups.

Zones protect against a data centre failing. That is genuinely useful and it is not disaster recovery.

## Region pairs

Microsoft pairs most regions within a geography: `uksouth` with `ukwest`, `westeurope` with `northeurope`.

```bash
az account list-locations \
  --query "[?name=='uksouth'].metadata.pairedRegion[].name" --output tsv
```

The pairing matters for three things. Geo redundant storage replicates to the pair automatically. Platform updates are staged so a pair is not updated at the same time. And in a large outage, recovery is prioritised for one region in a pair.

Note that not every newer region has a pair, and Microsoft has moved towards availability zones as the primary resilience story for new regions.

## When to use two regions

Multi region is a significant step up in cost and complexity: duplicated resources, data replication, traffic routing and a failover process somebody has to test.

Worth it when:

```text
downtime has a direct and large financial cost
regulation or a contract requires it
users are genuinely global and latency matters
the recovery time objective is minutes rather than hours
```

Not worth it when:

```text
an internal tool with a few hundred users
the recovery objective is "same day"
nobody will actually test the failover
the team is small enough that the complexity itself becomes the risk
```

The honest position: a well designed single region deployment across availability zones, with tested backups, covers most applications. Multi region is for when that is genuinely not enough.

Multi region designs get their own topic later.

## Latency between regions

```bash
az network watcher show-topology --resource-group rg-shop-prod-uks
```

Round trip between regions is tens of milliseconds within a continent and well over a hundred across oceans. That matters enormously for a chatty application.

The practical rule: **keep the application and its database in the same region.** A web app in `uksouth` talking to a database in `eastus` will feel slow no matter how well written it is, because every query pays the round trip.

## Moving between regions

There is no button for this. Moving a workload means redeploying it and migrating the data.

```bash
az resource move --destination-group rg-target --ids ...   # this moves resource GROUPS, not regions
```

`az resource move` moves between resource groups and subscriptions, not between regions. Region moves are a migration project: deploy the new environment from your templates, replicate the data, cut over traffic, decommission.

This is another argument for infrastructure as code. Redeploying to a different region from a template is a parameter change. Recreating a hand built environment is weeks.

## Sovereign clouds

```text
Azure Government   United States government workloads
Azure China        operated by 21Vianet, a separate cloud
```

These are separate clouds with separate portals, endpoints and service catalogues. Code targeting them needs different endpoints, and not every service exists.

```bash
az cloud list --output table
az cloud set --name AzureUSGovernment
```

Most teams never touch these, and if you need one you will know.

## Quick recap

- Choose a region by data residency, then latency, then service availability, then price.
- A region has multiple data centres, and availability zones are physically separate ones.
- Prefer zone redundant over zonal, since the platform handles placement.
- Zones protect against a data centre failure, not a regional outage or your own mistakes.
- Region pairs matter for geo redundant storage and staged platform updates.
- Keep the application and its database in the same region.
- There is no region move button, which is a strong argument for infrastructure as code.

<code id="code-content" class="language-bash">
# CHOOSING A REGION, in priority order:
#   1. data residency   if regulation says it stays in country, that is the decision
#   2. latency to users
#   3. service availability   new services appear in a handful of regions first
#   4. price   the same resource differs by 20% or more between regions
az account list-locations \
  --query "[?metadata.regionType=='Physical'].{Name:name, Geo:metadata.geography}" -o table
# Does the service I need exist here?
az provider show --namespace Microsoft.App \
  --query "resourceTypes[?resourceType=='containerApps'].locations" -o tsv
# AVAILABILITY ZONES are physically separate data centres inside one region,
# with independent power, cooling and networking. Not every region has them.
az vm list-skus --location uksouth --size Standard_D2s_v5 \
  --query "[].locationInfo[].zones" -o tsv
# ZONE REDUNDANT is what you usually want: the platform spreads it for you,
# rather than you pinning a resource to one zone.
az sql db create --resource-group rg-shop-prod-uks --server sql-shop-prod \
  --name shopdb --edition GeneralPurpose --family Gen5 --capacity 2 \
  --zone-redundant true
# ZRS = zone redundant storage. LRS is a single zone, and is the DEFAULT.
az storage account create --name stshopproduks --resource-group rg-shop-prod-uks \
  --location uksouth --sku Standard_ZRS
# WHAT ZONES DO NOT PROTECT AGAINST:
#   a whole region outage      every zone goes with it
#   your own bad deployment    it reaches every zone simultaneously
#   deletion                   zone redundancy replicates deletes too
# Zones are not disaster recovery. You still need backups.
# REGION PAIRS matter for geo redundant storage, staged platform updates,
# and recovery prioritisation. Newer regions may not have one.
az account list-locations --query "[?name=='uksouth'].metadata.pairedRegion[].name" -o tsv
# KEEP THE APP AND ITS DATABASE IN THE SAME REGION. A web app in uksouth
# querying a database in eastus pays a round trip on every query and will
# feel slow however well written it is.
# THERE IS NO REGION MOVE BUTTON. az resource move changes resource GROUP
# or subscription, not region. Moving region means redeploy plus data
# migration, which is a strong argument for infrastructure as code:
# from a template it is a parameter change, by hand it is weeks.
# Sovereign clouds are entirely separate, with their own endpoints:
az cloud list --output table
</code></pre>
