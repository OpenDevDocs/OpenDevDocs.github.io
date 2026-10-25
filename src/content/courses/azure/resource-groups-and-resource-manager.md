---
publishDate: 2026-10-01T06:10
title: Resource Groups and Azure Resource Manager
slug: resource-groups-and-resource-manager
metadescription: Learn how Azure Resource Manager deploys everything, what a resource group is really for, and how resource IDs work.
updateDate: 2026-09-07T06:10
author: ['bishal-biswas']
level: 1
tags: ['fundamentals', 'arm', 'resource groups']
course: azure
---

## Everything goes through Resource Manager

Azure Resource Manager, usually just ARM, is the control plane. The portal, the CLI, PowerShell, Terraform and the SDKs all end up calling the same REST API.

```text
Portal, CLI, PowerShell, SDK, Terraform
                 |
        Azure Resource Manager
                 |
        Resource providers
                 |
            Resources
```

That single path is why permissions, policy, locks and activity logs work consistently no matter how you make a change.

## Resource providers

Each family of services is a provider, and a provider must be registered in a subscription before you can use it.

```bash
az provider list --query "[?registrationState=='Registered'].namespace" --output table
az provider show --namespace Microsoft.ContainerService --query registrationState
az provider register --namespace Microsoft.ContainerService
```

A first deployment of an unfamiliar service failing with "the subscription is not registered to use namespace" is common, and this is the fix. Registration is per subscription and takes a minute or two.

## Resource groups

A resource group is a container. It is not a network boundary, not a security boundary by default, and not a billing boundary. It is a **lifecycle and management** boundary.

```bash
az group create --name rg-shop-prod-uks --location uksouth
az group list --output table
az group show --name rg-shop-prod-uks
```

The location of a resource group is where its **metadata** lives, not where its resources run. A resource group in `uksouth` can hold a virtual machine in `westeurope`. Keeping them aligned is tidy but not required.

## What belongs in one

The useful rule: **things that are deployed, updated and deleted together.**

```text
Good     one application's web app, database, storage and Key Vault
Good     a shared networking group with the virtual network and firewall
Bad      everything the company owns
Bad      one resource group per resource
```

Deleting a resource group deletes everything in it. That is either extremely convenient or a disaster, depending on whether you meant it.

```bash
az group delete --name rg-shop-dev-uks --yes --no-wait
```

This is the fastest way to clean up an experiment, and the fastest way to destroy a production environment. Which is why locks exist.

## Locks

```bash
az lock create --name prevent-delete --lock-type CanNotDelete \
  --resource-group rg-shop-prod-uks

az lock create --name read-only --lock-type ReadOnly \
  --resource-group rg-shop-prod-uks
```

`CanNotDelete` allows changes but blocks deletion. `ReadOnly` blocks changes too, which sounds appealing and breaks more than expected: many services need to write to their own configuration to work.

Put a `CanNotDelete` lock on production resource groups. It has stopped more incidents than most controls.

Locks are inherited by child resources, and they apply to everyone including subscription owners. Removing one is deliberate, which is the point.

## Resource IDs

Every resource has a unique path, and you will use these constantly.

```text
/subscriptions/{subscriptionId}
  /resourceGroups/{resourceGroupName}
  /providers/{providerNamespace}/{resourceType}/{resourceName}
```

```text
/subscriptions/0000.../resourceGroups/rg-shop-prod-uks/providers/Microsoft.Web/sites/shop-api
```

```bash
az webapp show --name shop-api --resource-group rg-shop-prod-uks --query id --output tsv
az resource show --ids /subscriptions/.../sites/shop-api
```

Role assignments, policy scopes, diagnostic settings and private endpoint targets all take a resource ID. Getting comfortable reading them pays off quickly.

## Deployments

Every ARM operation is recorded as a deployment against a scope, and the history is genuinely useful when something changed unexpectedly.

```bash
az deployment group list --resource-group rg-shop-prod-uks --output table
az deployment group show --resource-group rg-shop-prod-uks --name main
```

Deployments can target four scopes:

```text
Resource group   the usual case
Subscription     resource groups, policies, role assignments
Management group policy and access across many subscriptions
Tenant           rare, tenant wide settings
```

## Deployment modes

```text
Incremental  add and update what the template says, leave everything else. The default.
Complete     make the resource group match the template exactly, DELETING anything not in it
```

`Complete` mode is powerful and dangerous. It is how you guarantee no drift, and it is also how people delete a database that was created by hand and never added to the template.

Use `--what-if` before either, and always before `Complete`.

```bash
az deployment group what-if \
  --resource-group rg-shop-prod-uks \
  --template-file main.bicep \
  --parameters main.bicepparam
```

## Tags

```bash
az group create --name rg-shop-prod-uks --location uksouth \
  --tags environment=production owner=platform-team costCentre=CC1234

az resource tag --tags environment=production \
  --ids /subscriptions/.../sites/shop-api
```

Tags are how you attribute cost, find things and drive automation. Resources do **not** inherit tags from their resource group automatically, which surprises people. Azure Policy can enforce inheritance, and that has its own topic.

## Activity log

```bash
az monitor activity-log list \
  --resource-group rg-shop-prod-uks \
  --start-time 2026-09-01T00:00:00Z \
  --query "[].{Time:eventTimestamp, Op:operationName.value, By:caller, Status:status.value}" \
  --output table
```

Every control plane operation is logged for 90 days: who did what, when, and whether it succeeded. This is the first place to look when something changed and nobody admits to changing it.

Note it records **control plane** operations. Reading a blob or querying a database is data plane, and needs diagnostic settings to capture.

## Quick recap

- Every tool goes through Resource Manager, so permissions and logging are consistent.
- A resource provider must be registered before its first use in a subscription.
- A resource group is a lifecycle boundary: things deployed and deleted together.
- A resource group's location is where its metadata lives, not its resources.
- Put a `CanNotDelete` lock on production resource groups.
- `Complete` deployment mode deletes anything not in the template, so use `--what-if`.
- The activity log answers "who changed this" for the last 90 days.

<code id="code-content" class="language-bash">
# Every tool (portal, CLI, PowerShell, SDK, Terraform) goes through Azure
# Resource Manager, which is why permissions, policy, locks and the
# activity log behave consistently whatever you use.
# A RESOURCE PROVIDER must be registered before its first use. "The
# subscription is not registered to use namespace..." is fixed here.
az provider show --namespace Microsoft.ContainerService --query registrationState -o tsv
az provider register --namespace Microsoft.ContainerService
# A resource group is a LIFECYCLE boundary: things deployed, updated and
# deleted together. Its location is where the METADATA lives, not the
# resources, so a uksouth group can hold a westeurope VM.
az group create --name rg-shop-prod-uks --location uksouth \
  --tags environment=production owner=platform-team costCentre=CC1234
# Deleting a group deletes EVERYTHING in it. Fastest cleanup, and fastest
# way to destroy production. Which is why locks exist.
az lock create --name prevent-delete --lock-type CanNotDelete \
  --resource-group rg-shop-prod-uks
# CanNotDelete allows changes, blocks deletion. ReadOnly also blocks
# changes and breaks more than expected: many services write to their own
# configuration to function. Locks apply to owners too, by design.
# RESOURCE IDS are used by role assignments, policy scopes, diagnostic
# settings and private endpoints. Get comfortable reading them.
#   /subscriptions/{id}/resourceGroups/{rg}/providers/{ns}/{type}/{name}
az webapp show --name shop-api --resource-group rg-shop-prod-uks --query id -o tsv
# ALWAYS what-if before deploying, and especially before Complete mode.
#   Incremental (default): add and update, leave everything else alone
#   Complete: make the group MATCH the template, DELETING anything not in it
az deployment group what-if --resource-group rg-shop-prod-uks \
  --template-file main.bicep --parameters main.bicepparam
az deployment group list --resource-group rg-shop-prod-uks --output table
# "Who changed this?" for the last 90 days. Control plane only: reading a
# blob is data plane and needs diagnostic settings.
az monitor activity-log list --resource-group rg-shop-prod-uks \
  --start-time 2026-09-01T00:00:00Z \
  --query "[].{Time:eventTimestamp, Op:operationName.value, By:caller}" -o table
# Resources do NOT inherit tags from their resource group. Azure Policy
# can enforce that, and usually should.
</code></pre>
