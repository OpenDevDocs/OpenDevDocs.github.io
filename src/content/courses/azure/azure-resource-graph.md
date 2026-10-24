---
publishDate: 2026-10-21T11:20
title: Azure Resource Graph
slug: azure-resource-graph
metadescription: Query every resource across every subscription with Azure Resource Graph, using KQL to answer questions the portal cannot.
updateDate: 2026-09-07T11:20
author: ['bishal-biswas']
level: 3
tags: ['tooling', 'resource graph', 'kql']
course: azure
---

## Why it exists

`az resource list` queries one subscription at a time and returns limited properties. Resource Graph indexes everything across every subscription you can read, and queries it with KQL in about a second.

```bash
az graph query -q "Resources | summarize count() by type | order by count_ desc"
```

```bash
az extension add --name resource-graph
```

Answering "how many public IP addresses exist across our forty subscriptions" is one query rather than a script and a coffee.

## The tables

```text
Resources                      almost everything
ResourceContainers             subscriptions, resource groups, management groups
PolicyResources                policy assignments and compliance states
SecurityResources              Defender for Cloud assessments and alerts
AdvisorResources               Advisor recommendations
HealthResources                resource health
AuthorizationResources         role assignments and definitions
```

`Resources` is where most work happens. The others answer governance and compliance questions.

## Basic shape

```kusto
Resources
| where type =~ 'microsoft.compute/virtualmachines'
| where location == 'uksouth'
| project name, resourceGroup, subscriptionId,
          size = properties.hardwareProfile.vmSize,
          osType = properties.storageProfile.osDisk.osType
| order by name asc
```

```text
=~     case insensitive equals. Use it for type, since casing varies.
project  choose columns
extend   add computed columns
summarize aggregate
mv-expand  expand an array into rows
```

Resource types are always lowercase in the index, so `=~` saves a class of empty result sets.

## Genuinely useful queries

**Everything with a public IP:**

```kusto
Resources
| where type =~ 'microsoft.network/publicipaddresses'
| extend attachedTo = tostring(properties.ipConfiguration.id)
| project name, resourceGroup, subscriptionId,
          ip = tostring(properties.ipAddress),
          allocation = tostring(properties.publicIPAllocationMethod),
          attachedTo
| order by subscriptionId asc
```

**Resources with no tags, which is usually a governance problem:**

```kusto
Resources
| where isnull(tags) or array_length(bag_keys(tags)) == 0
| summarize count() by type, subscriptionId
| order by count_ desc
```

**Storage accounts still allowing shared key access:**

```kusto
Resources
| where type =~ 'microsoft.storage/storageaccounts'
| where properties.allowSharedKeyAccess != false
| project name, resourceGroup, subscriptionId,
          sku = sku.name,
          publicAccess = properties.publicNetworkAccess
```

**Unattached disks, which quietly cost money:**

```kusto
Resources
| where type =~ 'microsoft.compute/disks'
| where properties.diskState == 'Unattached'
| extend sizeGb = toint(properties.diskSizeGB)
| project name, resourceGroup, subscriptionId, sizeGb, sku = sku.name
| summarize totalGb = sum(sizeGb), count = count() by subscriptionId
| order by totalGb desc
```

**Virtual machines missing a required tag:**

```kusto
Resources
| where type =~ 'microsoft.compute/virtualmachines'
| where isnull(tags['costCentre'])
| project name, resourceGroup, subscriptionId, tags
```

**Resources created recently, when something appeared and nobody knows what:**

```kusto
Resources
| where todatetime(properties.timeCreated) > ago(7d)
| project name, type, resourceGroup, created = properties.timeCreated
| order by created desc
```

## Joining tables

```kusto
Resources
| where type =~ 'microsoft.compute/virtualmachines'
| project vmId = id, vmName = name, resourceGroup, subscriptionId
| join kind=leftouter (
    ResourceContainers
    | where type =~ 'microsoft.resources/subscriptions'
    | project subscriptionId, subscriptionName = name
) on subscriptionId
| project vmName, resourceGroup, subscriptionName
```

Joining to `ResourceContainers` turns subscription GUIDs into names, which makes any cross subscription report readable.

## Expanding arrays

```kusto
Resources
| where type =~ 'microsoft.network/networksecuritygroups'
| mv-expand rule = properties.securityRules
| where rule.properties.access == 'Allow'
| where rule.properties.direction == 'Inbound'
| where rule.properties.sourceAddressPrefix in ('*', 'Internet', '0.0.0.0/0')
| where rule.properties.destinationPortRange in ('22', '3389')
| project nsg = name, resourceGroup, subscriptionId,
          ruleName = tostring(rule.name),
          port = tostring(rule.properties.destinationPortRange)
```

That query finds every NSG allowing SSH or RDP from the internet, across the entire estate. It is the single most useful security query here, and it takes seconds.

## Compliance and security

```kusto
PolicyResources
| where type =~ 'microsoft.policyinsights/policystates'
| where properties.complianceState == 'NonCompliant'
| summarize count() by
    policy = tostring(properties.policyDefinitionName),
    subscriptionId
| order by count_ desc
```

```kusto
SecurityResources
| where type =~ 'microsoft.security/assessments'
| where properties.status.code == 'Unhealthy'
| project resource = properties.resourceDetails.Id,
          assessment = properties.displayName,
          severity = properties.metadata.severity
| order by severity asc
```

## Cost related queries

```kusto
Resources
| where type =~ 'microsoft.compute/virtualmachines'
| extend size = tostring(properties.hardwareProfile.vmSize)
| summarize count() by size, subscriptionId
| order by count_ desc
```

```kusto
Resources
| where type =~ 'microsoft.sql/servers/databases'
| where name != 'master'
| project name, resourceGroup, subscriptionId,
          tier = sku.tier, capacity = sku.capacity
| order by capacity desc
```

Resource Graph does not hold costs, and it does hold the sizes and tiers that drive them. Combined with the pricing you know, it finds oversized resources quickly.

## From the CLI and PowerShell

```bash
az graph query -q "Resources | where type =~ 'microsoft.storage/storageaccounts' | project name, resourceGroup" --output table

# across specific subscriptions
az graph query -q "Resources | summarize count() by type" \
  --subscriptions 0000... 1111... --output table

# paging, since results are capped per request
az graph query -q "Resources | project name, type" --first 1000 --skip 0
```

```powershell
Search-AzGraph -Query "Resources | where type =~ 'microsoft.compute/disks' | where properties.diskState == 'Unattached'" -First 500
```

**Results are paged**, currently at 1000 per request. A query returning more needs `--first` and `--skip`, and it is easy to think there are only a thousand resources when there are not.

## Building a report

```bash
az graph query -q "
Resources
| where type =~ 'microsoft.compute/disks'
| where properties.diskState == 'Unattached'
| extend sizeGb = toint(properties.diskSizeGB)
| project name, resourceGroup, subscriptionId, sizeGb, sku = sku.name
" --output json > unattached-disks.json

jq -r '.data[] | [.name, .resourceGroup, .sizeGb, .sku] | @csv' unattached-disks.json
```

Running a set of these on a schedule and comparing to last month is a cheap governance practice that finds drift nobody would otherwise notice.

## Limits worth knowing

```text
Read only. It cannot change anything.
Eventually consistent, usually within seconds and occasionally minutes.
Not every property is indexed, and nested ones sometimes need tostring().
1000 results per page.
Scoped to what your identity can read.
```

That last point matters for reporting: a query returns what **you** can see, so a report from an account with narrow access silently under reports.

## Quick recap

- Resource Graph indexes every subscription you can read and queries it in seconds.
- Use `=~` for resource types, since the index stores them lowercase.
- `mv-expand` over NSG rules finds management ports open to the internet across the whole estate.
- Join to `ResourceContainers` to turn subscription GUIDs into names.
- Results are paged at 1000, so a large query needs `--first` and `--skip`.
- It is read only and eventually consistent, so it is for reporting rather than control.
- A query returns only what your identity can read, so narrow access silently under reports.

<code id="code-content" class="language-kusto">
// az resource list queries ONE subscription and returns limited properties.
// RESOURCE GRAPH INDEXES EVERYTHING you can read, ACROSS EVERY
// SUBSCRIPTION, and answers in about a second.
//   az extension add --name resource-graph
//   az graph query -q "Resources | summarize count() by type" --output table
//
// TABLES: Resources, ResourceContainers (subscriptions and groups),
// PolicyResources, SecurityResources, AdvisorResources, HealthResources.
//
// USE =~ FOR TYPES. The index stores them LOWERCASE, and this saves a whole
// class of empty result sets.
Resources
| where type =~ 'microsoft.compute/virtualmachines'
| project name, resourceGroup, subscriptionId,
          size = properties.hardwareProfile.vmSize
//
// THE SINGLE MOST USEFUL SECURITY QUERY HERE. Every NSG allowing SSH or RDP
// from the internet, across the ENTIRE ESTATE, in seconds:
Resources
| where type =~ 'microsoft.network/networksecuritygroups'
| mv-expand rule = properties.securityRules
| where rule.properties.access == 'Allow'
| where rule.properties.direction == 'Inbound'
| where rule.properties.sourceAddressPrefix in ('*', 'Internet', '0.0.0.0/0')
| where rule.properties.destinationPortRange in ('22', '3389')
| project nsg = name, resourceGroup, subscriptionId, ruleName = tostring(rule.name)
//
// UNATTACHED DISKS, which quietly cost money every month:
Resources
| where type =~ 'microsoft.compute/disks'
| where properties.diskState == 'Unattached'
| extend sizeGb = toint(properties.diskSizeGB)
| summarize totalGb = sum(sizeGb), count = count() by subscriptionId
| order by totalGb desc
//
// STORAGE ACCOUNTS STILL ACCEPTING LONG LIVED ACCOUNT KEYS:
Resources
| where type =~ 'microsoft.storage/storageaccounts'
| where properties.allowSharedKeyAccess != false
| project name, resourceGroup, subscriptionId, publicAccess = properties.publicNetworkAccess
//
// UNTAGGED RESOURCES, usually a governance problem:
Resources
| where isnull(tags) or array_length(bag_keys(tags)) == 0
| summarize count() by type, subscriptionId
//
// JOIN TO ResourceContainers TO TURN SUBSCRIPTION GUIDs INTO NAMES, which
// is what makes any cross subscription report readable:
Resources
| where type =~ 'microsoft.compute/virtualmachines'
| project vmName = name, resourceGroup, subscriptionId
| join kind=leftouter (
    ResourceContainers
    | where type =~ 'microsoft.resources/subscriptions'
    | project subscriptionId, subscriptionName = name
) on subscriptionId
//
// LIMITS WORTH KNOWING:
//   READ ONLY. It cannot change anything.
//   EVENTUALLY CONSISTENT, usually seconds, occasionally minutes.
//   1000 RESULTS PER PAGE: use --first and --skip, or you will believe
//   there are a thousand resources when there are forty thousand.
//   SCOPED TO WHAT YOUR IDENTITY CAN READ, so a report from an account with
//   narrow access SILENTLY UNDER REPORTS.
</code></pre>
