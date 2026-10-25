---
publishDate: 2026-10-24T12:15
title: Management Groups and Landing Zones
slug: management-groups-and-landing-zones
metadescription: Organise subscriptions with management groups and adopt the Azure landing zone model without over engineering it.
updateDate: 2026-09-07T12:15
author: ['bishal-biswas']
level: 4
tags: ['security', 'governance', 'landing zones']
course: azure
---

## The hierarchy

```text
Tenant root group
  └── Management groups (up to 6 levels deep)
        └── Subscriptions
              └── Resource groups
                    └── Resources
```

Policy and RBAC assigned at a management group apply to everything beneath it, including subscriptions created later. That is the entire point.

```bash
az account management-group create --name mg-contoso --display-name "Contoso"

az account management-group create --name mg-platform \
  --display-name "Platform" --parent mg-contoso

az account management-group create --name mg-landingzones \
  --display-name "Landing Zones" --parent mg-contoso

az account management-group create --name mg-corp \
  --display-name "Corp" --parent mg-landingzones

az account management-group create --name mg-online \
  --display-name "Online" --parent mg-landingzones

az account management-group create --name mg-sandbox \
  --display-name "Sandbox" --parent mg-contoso

az account management-group subscription add \
  --name mg-corp --subscription "$SUBSCRIPTION_ID"

az account management-group show --name mg-contoso --expand --recurse
```

## The Cloud Adoption Framework structure

```text
Tenant Root
  └── Contoso (intermediate root)
        ├── Platform
        │     ├── Identity        domain controllers, Entra Domain Services
        │     ├── Management      Log Analytics, automation, backup vault
        │     └── Connectivity    hub network, firewall, gateways, DNS
        ├── Landing Zones
        │     ├── Corp            workloads needing on premises connectivity
        │     └── Online          internet facing workloads, no hybrid need
        ├── Sandbox               experimentation, loose policy, hard cost caps
        └── Decommissioned        subscriptions being retired
```

Two things make this shape work:

**An intermediate root.** Policy is assigned to `Contoso`, not to the tenant root. The tenant root cannot be deleted or easily changed, and assignments there affect absolutely everything, including subscriptions you did not intend.

**Separating platform from workloads.** The platform team owns shared networking, identity and monitoring. Application teams get landing zone subscriptions with those already wired in.

## Corp against Online

```text
Corp    peered to the hub, on premises connectivity, stricter policy,
        typically no public endpoints
Online  internet facing, no hybrid connectivity, different policy set
```

The distinction is about hybrid connectivity, not sensitivity. A public facing e-commerce site is `Online`; an internal HR system needing domain access is `Corp`.

## What a landing zone provides

A subscription handed to an application team, already configured.

```text
Placed in the right management group, so policy applies
Networking, either a peered spoke or none for Online
Log Analytics diagnostic settings, by policy
Budget and cost alerts
RBAC groups for the team
Naming and tagging policy
A security baseline
```

The team then deploys their application. They do not build networking, choose a Log Analytics workspace, or decide a tagging convention, because those decisions are already made.

## Subscription vending

```bicep
targetScope = 'managementGroup'

param subscriptionAlias string
param billingScope string
param managementGroupId string
param costCentre string
param ownerGroupObjectId string

resource subscription 'Microsoft.Subscription/aliases@2021-10-01' = {
  scope: tenant()
  name: subscriptionAlias
  properties: {
    workload: 'Production'
    displayName: subscriptionAlias
    billingScope: billingScope
    additionalProperties: {
      managementGroupId: '/providers/Microsoft.Management/managementGroups/${managementGroupId}'
      tags: {
        costCentre: costCentre
      }
    }
  }
}
```

Creating subscriptions from code means every one starts in the right place with the right configuration. Creating them by hand means each one is slightly different, and the differences are found during an incident.

The `Microsoft.Subscription/aliases` resource needs an Enterprise Agreement or Microsoft Customer Agreement billing scope.

## Policy at each level

```bash
# everything: naming, tagging, allowed regions, diagnostic settings
az policy assignment create --name org-baseline \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy-set-definition "$BASELINE_INITIATIVE_ID"

# landing zones: no public IPs, private endpoints required
az policy assignment create --name no-public-ip \
  --scope /providers/Microsoft.Management/managementGroups/mg-corp \
  --policy 83a86a26-fd1f-447c-b59d-e51f44264114 \
  --params '{"effect":{"value":"Deny"}}'

# sandbox: relaxed, but capped
az policy assignment create --name sandbox-sku-limits \
  --scope /providers/Microsoft.Management/managementGroups/mg-sandbox \
  --policy cccc23c7-8427-4f53-ad12-b6a63eb452b3 \
  --params '{"listOfAllowedSKUs":{"value":["Standard_B2s","Standard_D2s_v5"]}}'
```

Broad rules high in the hierarchy, specific rules lower down. A rule that needs exceptions everywhere is assigned too high.

## Sandbox needs boundaries

```bash
az consumption budget create \
  --budget-name sandbox-cap --amount 500 --time-grain Monthly \
  --category Cost --start-date 2026-09-01 --end-date 2027-09-01
```

A sandbox with loose policy and no cost control produces a surprising bill. Loose policy is the point; unlimited spend is not.

Deleting and recreating sandbox subscriptions periodically is a practice worth considering, since it prevents anything permanent growing there.

## Do not over engineer this

The full Cloud Adoption Framework landing zone is designed for large enterprises. For a smaller organisation it is significant work with limited return.

```text
1 to 3 subscriptions
  management groups are optional. Policy at subscription scope is fine.

3 to 10 subscriptions
  a simple hierarchy: production, non production, sandbox.
  Policy at management group level. A shared Log Analytics workspace.

10 or more, or several teams
  the full structure earns its cost. Platform separation, subscription
  vending, hub and spoke.
```

Starting with three management groups and adding structure as it is needed is much better than building an eight level hierarchy for four subscriptions.

## Getting there from an existing estate

```bash
az account list --query "[].{Name:name, Id:id, State:state}" -o table

az account management-group subscription add \
  --name mg-corp --subscription "$SUBSCRIPTION_ID"
```

Moving a subscription between management groups is instant and non disruptive. Nothing inside it changes, though newly inherited policy applies immediately.

**That last part matters.** Moving a subscription under a management group with a `Deny` policy can break deployments the same afternoon. Check compliance in audit mode before moving.

```bash
az policy state list --subscription "$SUBSCRIPTION_ID" \
  --filter "complianceState eq 'NonCompliant'" -o table
```

## Access at the management group level

```bash
az role assignment create \
  --assignee-object-id "$PLATFORM_TEAM_GROUP" --assignee-principal-type Group \
  --role "Contributor" \
  --scope /providers/Microsoft.Management/managementGroups/mg-platform

az role assignment create \
  --assignee-object-id "$SECURITY_TEAM_GROUP" --assignee-principal-type Group \
  --role "Security Reader" \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso
```

A security team with Reader at the intermediate root sees everything without being able to change anything, which is the right shape and is much easier than granting per subscription.

## Quick recap

- Management group assignments apply to everything beneath, including future subscriptions.
- Use an intermediate root, since the tenant root affects absolutely everything.
- Separate platform from landing zones so application teams inherit shared services.
- Corp against Online is about hybrid connectivity, not sensitivity.
- Vend subscriptions from code, or each one differs in ways found during an incident.
- Give sandbox loose policy and a hard budget.
- Do not build the full structure for four subscriptions, and check compliance before moving one.

<code id="code-content" class="language-bash">
# POLICY AND RBAC AT A MANAGEMENT GROUP APPLY TO EVERYTHING BENEATH,
# INCLUDING SUBSCRIPTIONS CREATED LATER. That is the entire point.
# THE CLOUD ADOPTION FRAMEWORK SHAPE:
#   Tenant Root
#     └── Contoso            &lt;- INTERMEDIATE ROOT. Assign policy HERE.
#           ├── Platform     identity | management | connectivity
#           ├── Landing Zones
#           │     ├── Corp   peered to the hub, on premises connectivity
#           │     └── Online internet facing, no hybrid need
#           ├── Sandbox      loose policy, HARD cost cap
#           └── Decommissioned
# WHY AN INTERMEDIATE ROOT: the tenant root cannot be deleted or easily
# changed, and assignments there affect ABSOLUTELY EVERYTHING, including
# subscriptions you did not intend.
# CORP vs ONLINE IS ABOUT HYBRID CONNECTIVITY, NOT SENSITIVITY. A public
# e-commerce site is Online; an internal HR system needing domain access is Corp.
az account management-group create --name mg-platform --parent mg-contoso
az account management-group subscription add --name mg-corp --subscription "$SUB_ID"
az account management-group show --name mg-contoso --expand --recurse
# BROAD RULES HIGH, SPECIFIC RULES LOW. A rule needing exceptions everywhere
# is assigned too high.
az policy assignment create --name no-public-ip \
  --scope /providers/Microsoft.Management/managementGroups/mg-corp \
  --policy 83a86a26-fd1f-447c-b59d-e51f44264114 --params '{"effect":{"value":"Deny"}}'
# SANDBOX: loose policy is THE POINT. Unlimited spend is not.
az consumption budget create --budget-name sandbox-cap --amount 500 \
  --time-grain Monthly --category Cost --start-date 2026-09-01 --end-date 2027-09-01
# VEND SUBSCRIPTIONS FROM CODE, so every one starts in the right management
# group with the right configuration. By hand, each is slightly different,
# and the differences are found DURING AN INCIDENT.
#   resource subscription 'Microsoft.Subscription/aliases@2021-10-01' = {
#     scope: tenant()
#     properties: { billingScope: ..., additionalProperties: {
#       managementGroupId: '/providers/Microsoft.Management/managementGroups/mg-corp' } }
#   }
# DO NOT OVER ENGINEER THIS:
#   1-3 subscriptions   management groups optional, policy at subscription scope
#   3-10                production / non production / sandbox is enough
#   10+, several teams  the full structure earns its cost
# Three groups now, adding structure as needed, beats an eight level
# hierarchy for four subscriptions.
# MOVING A SUBSCRIPTION IS INSTANT AND NON DISRUPTIVE, BUT INHERITED POLICY
# APPLIES IMMEDIATELY, so a Deny can break deployments the same afternoon.
# CHECK COMPLIANCE IN AUDIT MODE FIRST:
az policy state list --subscription "$SUB_ID" \
  --filter "complianceState eq 'NonCompliant'" -o table
# A security team with Reader at the intermediate root sees EVERYTHING and
# can change NOTHING, which is far easier than granting per subscription:
az role assignment create --assignee-object-id "$SECURITY_GROUP" \
  --assignee-principal-type Group --role "Security Reader" \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso
</code></pre>
