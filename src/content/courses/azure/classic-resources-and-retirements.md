---
publishDate: 2026-10-30T13:40
title: Classic Resources and What Was Retired
slug: classic-resources-and-retirements
metadescription: Recognise classic Azure resources and retired services in an existing estate, and know what each one needs to become.
updateDate: 2026-09-07T13:40
author: ['bishal-biswas']
level: 4
tags: ['legacy', 'migration', 'retirements']
course: azure
---

## Two deployment models

```text
Classic (ASM)  the original Azure Service Management model. RETIRED.
Resource Manager (ARM)  everything since 2014. What "Azure" means now.
```

Classic resources are gone, and classic virtual machines were retired in September 2023. Anything still described as classic in an old estate is either already migrated or a genuine problem.

You can tell from the resource type:

```bash
az resource list --query "[?contains(type, 'ClassicCompute') || contains(type, 'ClassicNetwork') || contains(type, 'ClassicStorage')].{Name:name, Type:type, RG:resourceGroup}" -o table
```

```text
Microsoft.ClassicCompute/*   classic virtual machines and cloud services
Microsoft.ClassicNetwork/*   classic virtual networks
Microsoft.ClassicStorage/*   classic storage accounts
```

Any result there needs attention.

## Retirements that catch existing estates

**Basic public IP addresses**, retired September 2025. Standard is the replacement, and the migration changes behaviour: Standard is secure by default, so an NSG rule that was not needed before becomes necessary.

```kusto
Resources
| where type =~ 'microsoft.network/publicipaddresses'
| where sku.name == 'Basic'
| project name, resourceGroup, subscriptionId
```

**Basic load balancers**, also retired. Standard adds zone redundancy and requires explicit outbound rules, which is the part that breaks things during migration.

**Default outbound access**, retired for new virtual networks from 30 September 2025. Existing networks continue, and new deployments must choose an explicit outbound method such as a NAT Gateway.

**Azure CDN from Microsoft (classic)**, retired 30 September 2025. Front Door is the replacement. Edgio profiles were retired earlier, in January 2025.

**Azure AD Graph and ADAL**, retired. Microsoft Graph and MSAL are the replacements, and an application still using ADAL will eventually stop authenticating.

**Azure Database Single Server**, retired: PostgreSQL in March 2025 and MySQL in September 2024. Flexible Server is the replacement.

**Application Gateway v1**, retired. Only v2 exists.

**Azure Functions in process .NET model**, retired 10 November 2026. The isolated worker model is the only one now.

**AKS kubenet networking**, retiring March 2028. Azure CNI Overlay is the replacement, and it means rebuilding the cluster.

**Availability sets and older VM series** are not retired but are increasingly the wrong choice against availability zones and newer generations.

## Finding what is affected

```bash
az monitor activity-log list --offset 30d \
  --query "[?contains(properties.title, 'retirement') || contains(properties.title, 'Retirement')].{Time:eventTimestamp, Title:properties.title}" \
  -o table
```

Service Health in the portal has a Health Advisories section listing retirements affecting your subscriptions specifically, which is far more useful than reading general announcements.

**Subscribe to health advisories.** A retirement notice usually arrives twelve months ahead, which is enough time if someone reads it.

```bash
az monitor activity-log alert create \
  --name health-advisories --resource-group rg-shop-prod-uks \
  --scope /subscriptions/0000... \
  --condition category=ServiceHealth and properties.incidentType=Retirement \
  --action-group /subscriptions/.../actionGroups/ag-team
```

## An audit query

```kusto
Resources
| extend legacy = case(
    type startswith 'microsoft.classic', 'Classic deployment model',
    type =~ 'microsoft.network/publicipaddresses' and sku.name == 'Basic', 'Basic public IP (retired)',
    type =~ 'microsoft.network/loadbalancers' and sku.name == 'Basic', 'Basic load balancer (retired)',
    type =~ 'microsoft.dbforpostgresql/servers', 'PostgreSQL Single Server (retired)',
    type =~ 'microsoft.dbformysql/servers', 'MySQL Single Server (retired)',
    type =~ 'microsoft.cdn/profiles' and sku.name contains 'Standard_Microsoft', 'CDN classic (retired)',
    type =~ 'microsoft.network/applicationgateways' and properties.sku.tier == 'Standard', 'App Gateway v1 (retired)',
    '')
| where legacy != ''
| project name, type, legacy, resourceGroup, subscriptionId
| order by legacy asc
```

Running that across every subscription gives the list of things needing attention, which is usually a shorter list than people fear and longer than they hoped.

## Patterns that are legacy without being retired

**Account keys and connection strings.** Still work, and managed identity is the current approach.

**Access policies on Key Vault.** Still work, and RBAC is the current model.

**Service principals with client secrets in pipelines.** Still work, and workload identity federation removes the secret.

**Classic alert rules.** Migrated automatically, and worth checking for anything left behind.

**ARM JSON written by hand.** Still valid, and Bicep is what to write now.

**Availability sets.** Still supported, and zones are better where the region has them.

None of these break tomorrow. All of them are worth moving away from as things are touched anyway.

## How to approach a migration

```text
1. Inventory. Run the audit query across every subscription.
2. Assess impact. What breaks, and what changes behaviour.
3. Test in non production, which usually reveals something.
4. Migrate in order of risk, smallest first.
5. Verify, and keep the old thing until you are certain.
```

Behaviour changes matter more than the migration itself. Basic to Standard public IP is a good example: the migration tool works, and the result is secure by default, so traffic that flowed before is now blocked until an NSG rule allows it.

```bash
az network public-ip update --name pip-shop --resource-group rg-shop-prod-uks --sku Standard
```

Read the migration guidance for the specific service before running anything. Each retirement has documented behaviour differences, and they are the part that causes incidents.

## Preventing the next one

```bash
az policy assignment create \
  --name deny-basic-public-ip \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy "$DENY_BASIC_SKU_POLICY_ID" \
  --params '{"effect":{"value":"Deny"}}'
```

Once something is retired, deny it by policy so nobody creates another. Migrating twice because a template still produced the old thing is a frustrating way to spend a week.

More generally: infrastructure as code with pinned API versions, reviewed regularly, is what stops an estate drifting into a collection of things nobody knew were deprecated.

## Quick recap

- Classic resources use `Microsoft.Classic*` types and are fully retired.
- Basic public IPs and load balancers are retired, and Standard is secure by default, which changes behaviour.
- Default outbound access is retired for new virtual networks, so choose an explicit method.
- Azure CDN classic, Single Server databases, App Gateway v1 and the in process Functions model are all retired.
- Subscribe to health advisories, since notices arrive about twelve months ahead.
- Behaviour differences cause more incidents than the migrations themselves.
- Deny retired options by policy so the same migration does not happen twice.

<code id="code-content" class="language-bash">
# CLASSIC (ASM) IS FULLY RETIRED. You can spot it from the resource type:
az resource list -o table --query "[?contains(type,'Classic')].{Name:name, Type:type, RG:resourceGroup}"
#   Microsoft.ClassicCompute/*  Microsoft.ClassicNetwork/*  Microsoft.ClassicStorage/*
# RETIREMENTS THAT CATCH EXISTING ESTATES:
#   Basic public IPs             September 2025. Standard is SECURE BY
#                                DEFAULT, so traffic that flowed before is
#                                BLOCKED until an NSG rule allows it.
#   Basic load balancers         retired. Standard needs explicit outbound
#                                rules, which is what breaks in migration.
#   Default outbound access      retired for NEW vnets, 30 Sept 2025.
#                                Choose NAT Gateway or another explicit path.
#   Azure CDN classic            30 Sept 2025. Front Door replaces it.
#                                (Edgio profiles went in January 2025.)
#   Azure AD Graph and ADAL      retired. Microsoft Graph and MSAL.
#   PostgreSQL/MySQL Single Server  March 2025 / September 2024. Flexible.
#   Application Gateway v1       retired. Only v2 exists.
#   Functions in process .NET    10 November 2026. Isolated worker only.
#   AKS kubenet                  retiring March 2028. CNI Overlay, and that
#                                means REBUILDING the cluster.
# ONE AUDIT QUERY ACROSS EVERY SUBSCRIPTION:
#   Resources
#   | extend legacy = case(
#       type startswith 'microsoft.classic', 'Classic model',
#       type =~ 'microsoft.network/publicipaddresses' and sku.name == 'Basic',
#         'Basic public IP (retired)',
#       type =~ 'microsoft.dbforpostgresql/servers', 'Single Server (retired)',
#       '')
#   | where legacy != '' | project name, type, legacy, resourceGroup
# SUBSCRIBE TO HEALTH ADVISORIES. A retirement notice usually arrives TWELVE
# MONTHS AHEAD, which is plenty of time IF SOMEONE READS IT:
az monitor activity-log alert create --name health-advisories \
  --resource-group rg-shop-prod-uks --scope /subscriptions/0000... \
  --condition category=ServiceHealth and properties.incidentType=Retirement \
  --action-group /subscriptions/.../actionGroups/ag-team
# LEGACY WITHOUT BEING RETIRED, all worth moving away from as you touch
# things: account keys and connection strings; Key Vault ACCESS POLICIES;
# client secrets in pipelines; hand written ARM JSON; availability sets.
# BEHAVIOUR CHANGES CAUSE MORE INCIDENTS THAN THE MIGRATIONS THEMSELVES.
# READ THE SERVICE SPECIFIC GUIDANCE BEFORE RUNNING ANYTHING.
#   1. inventory  2. assess what CHANGES BEHAVIOUR  3. test in non production
#   4. migrate smallest risk first  5. verify, and keep the old thing a while
# THEN DENY IT, so nobody creates another. Migrating twice because a
# template still produced the old thing is a frustrating week:
az policy assignment create --name deny-basic-public-ip \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy "$DENY_BASIC_SKU_POLICY_ID" --params '{"effect":{"value":"Deny"}}'
</code></pre>
