---
publishDate: 2026-10-04T06:50
title: Custom Roles and Least Privilege
slug: custom-roles-and-least-privilege
metadescription: Write a custom Azure role when the built in ones do not fit, and apply least privilege without making the estate unusable.
updateDate: 2026-09-07T06:50
author: ['bishal-biswas']
level: 2
tags: ['security', 'rbac', 'least privilege']
course: azure
---

## Check the built in roles first

There are hundreds, and one usually fits. Writing a custom role is a maintenance commitment.

```bash
az role definition list --query "[].roleName" --output tsv | sort
az role definition list --query "[?contains(roleName, 'Virtual Machine')].roleName" --output tsv
az role definition list --name "Virtual Machine Contributor" --query "[0].permissions[0].actions"
```

A custom role is right when you need something genuinely narrower: read metrics but not data, restart a service but not reconfigure it, manage one resource type only.

## Anatomy of a role definition

```json
{
  "Name": "Shop App Restarter",
  "Description": "Restart the shop web apps and read their configuration",
  "Actions": [
    "Microsoft.Web/sites/read",
    "Microsoft.Web/sites/restart/action",
    "Microsoft.Web/sites/config/read",
    "Microsoft.Insights/metrics/read"
  ],
  "NotActions": [],
  "DataActions": [],
  "NotDataActions": [],
  "AssignableScopes": [
    "/subscriptions/00000000-0000-0000-0000-000000000000"
  ]
}
```

```bash
az role definition create --role-definition role.json
az role definition update --role-definition role.json
az role definition delete --name "Shop App Restarter"
```

## The four permission lists

```text
Actions         management plane operations allowed
NotActions      subtracted from Actions
DataActions     data plane operations allowed
NotDataActions  subtracted from DataActions
```

`NotActions` is a subtraction, **not a deny**. If another assignment grants the operation, the user still has it. This is the most misunderstood part of custom roles.

```json
{
  "Actions": ["Microsoft.Storage/*"],
  "NotActions": ["Microsoft.Storage/storageAccounts/delete"]
}
```

That allows everything about storage except delete, **unless** the person is also Contributor somewhere above, in which case they can still delete. `NotActions` narrows one role, it does not block anything.

Azure has no deny at the RBAC level. Use Azure Policy when you need to actually prevent something.

## Finding operation names

```bash
az provider operation list --query "[].namespace" --output tsv
az provider operation show --namespace Microsoft.Web \
  --query "resourceTypes[?name=='sites'].operations[].{Op:name, Display:displayName}" --output table
az provider operation show --namespace Microsoft.Storage \
  --query "resourceTypes[?name=='storageAccounts/blobServices/containers/blobs'].operations[].name" --output tsv
```

This is the tedious part of writing a custom role, and there is no shortcut. Work out exactly which operations the task needs, and test.

## Wildcards

```json
"Actions": [
  "Microsoft.Web/sites/*/read",
  "Microsoft.Insights/*/read",
  "Microsoft.Support/*"
]
```

Wildcards keep a definition readable and are broader than they look. `Microsoft.Web/*` includes deleting every web app. Use them where the whole family is genuinely intended, and enumerate otherwise.

## Assignable scopes

```json
"AssignableScopes": [
  "/subscriptions/00000000-0000-0000-0000-000000000000",
  "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg-shop-prod-uks"
]
```

This limits **where the role can be assigned**, not what it grants. A role assignable only in one subscription cannot be used elsewhere.

Defining custom roles at a management group scope makes them available across every subscription beneath it, which is usually what a platform team wants.

Note that a role can only be assigned within its assignable scopes, so adding a new subscription later means updating the definition.

## Data actions

```json
{
  "Name": "Shop Blob Reader",
  "Actions": [
    "Microsoft.Storage/storageAccounts/read"
  ],
  "DataActions": [
    "Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read"
  ],
  "AssignableScopes": ["/subscriptions/0000..."]
}
```

Data actions are what let an application read or write the contents of a service rather than manage the service. A role with only `Actions` can see that a container exists and not what is in it.

Not every service supports data actions. Those that do include Storage, Key Vault, Cosmos DB, Service Bus, Event Hubs and Container Registry.

## A practical example

An on call engineer who can diagnose and restart, but not change configuration or delete anything.

```json
{
  "Name": "Shop On Call",
  "Description": "Diagnose and restart shop services without changing configuration",
  "Actions": [
    "Microsoft.Web/sites/read",
    "Microsoft.Web/sites/restart/action",
    "Microsoft.Web/sites/slots/read",
    "Microsoft.Web/sites/slotsswap/action",
    "Microsoft.Web/sites/config/list/action",
    "Microsoft.ContainerService/managedClusters/read",
    "Microsoft.App/containerApps/read",
    "Microsoft.App/containerApps/restart/action",
    "Microsoft.Insights/*/read",
    "Microsoft.OperationalInsights/workspaces/query/read",
    "Microsoft.Resources/subscriptions/resourceGroups/read"
  ],
  "NotActions": [],
  "AssignableScopes": ["/subscriptions/0000..."]
}
```

Note `Microsoft.Web/sites/config/list/action` is a **write style** operation despite reading configuration, because it can return secrets. Several read looking operations are classified this way, which is why testing matters.

## Least privilege in practice

The principle is easy and the practice is not. A model that works:

**Start from a built in role.** Reader for most people, most of the time.

**Add narrowly for specific tasks.** A data plane role for an application, a custom role for an operational task.

**Use groups.** A custom role assigned to twelve people individually is twelve things to remember.

**Make elevation temporary.** Privileged Identity Management activates a role for a few hours with an approval and a justification. It needs Entra ID P2, and it is the single most effective control on standing privilege.

**Review.** Assignments accumulate. A quarterly look at Owners and custom role holders is cheap.

```bash
az role assignment list --all \
  --query "[?roleDefinitionName=='Owner'].{Who:principalName, Scope:scope}" --output table
```

## Where least privilege goes wrong

**Too narrow to work.** An engineer who cannot diagnose an incident because the role omits log access will get Contributor granted at 3am, permanently.

**Too many custom roles.** Twenty near identical roles nobody can distinguish is worse than three broader ones.

**No path to more access.** If the only way to get permission is a three day ticket, people will share credentials. A fast, audited elevation path is safer than a slow, correct one.

The goal is the least privilege that lets people do their job without routine friction. Security that gets routed around is not security.

## Quick recap

- Check the built in roles first, since one usually fits.
- `NotActions` subtracts from one role, it does not deny across assignments.
- Azure RBAC has no deny, so use Azure Policy when you must actually prevent something.
- `AssignableScopes` limits where a role can be assigned, not what it grants.
- Data actions are what let an application read contents rather than manage a service.
- Some read looking operations, like listing config, count as write because they return secrets.
- Temporary elevation beats permanent narrow roles, and friction drives people around controls.

<code id="code-content" class="language-bash">
# CHECK THE BUILT IN ROLES FIRST. There are hundreds and one usually fits.
# A custom role is a maintenance commitment.
az role definition list --query "[].roleName" -o tsv | sort
az role definition list --name "Virtual Machine Contributor" \
  --query "[0].permissions[0].actions" -o tsv
# Finding operation names is the tedious part, and there is no shortcut.
az provider operation show --namespace Microsoft.Web \
  --query "resourceTypes[?name=='sites'].operations[].name" -o tsv
# A custom role definition:
cat &gt; role.json &lt;&lt;'JSON'
{
  "Name": "Shop On Call",
  "Description": "Diagnose and restart, without changing configuration",
  "Actions": [
    "Microsoft.Web/sites/read",
    "Microsoft.Web/sites/restart/action",
    "Microsoft.App/containerApps/restart/action",
    "Microsoft.Insights/*/read",
    "Microsoft.OperationalInsights/workspaces/query/read",
    "Microsoft.Resources/subscriptions/resourceGroups/read"
  ],
  "NotActions": [],
  "DataActions": [],
  "AssignableScopes": ["/subscriptions/00000000-0000-0000-0000-000000000000"]
}
JSON
az role definition create --role-definition role.json
# THE MOST MISUNDERSTOOD PART: NotActions is a SUBTRACTION from this role,
# NOT a deny. If another assignment grants the operation, the user still
# has it. Azure RBAC has no deny at all.
#   "Actions":    ["Microsoft.Storage/*"]
#   "NotActions": ["Microsoft.Storage/storageAccounts/delete"]
# ...still deletable if they are Contributor somewhere above.
# Use AZURE POLICY when you must actually PREVENT something.
# AssignableScopes limits WHERE the role can be assigned, not what it grants.
# Define it at a management group to make it available across subscriptions.
# DATA ACTIONS let an application read CONTENTS rather than manage a service.
# A role with only Actions can see a container exists, not what is in it.
#   "DataActions": ["Microsoft.Storage/.../containers/blobs/read"]
# WATCH OUT: some read looking operations count as WRITE because they can
# return secrets, e.g. Microsoft.Web/sites/config/list/action. Test.
# Review what accumulates:
az role assignment list --all \
  --query "[?roleDefinitionName=='Owner'].{Who:principalName, Scope:scope}" -o table
az role definition list --custom-role-only true --output table
# WHERE LEAST PRIVILEGE GOES WRONG: a role too narrow to diagnose an
# incident gets Contributor granted at 3am, permanently. A three day ticket
# for access gets credentials shared. A fast AUDITED elevation path
# (Privileged Identity Management, needs P2) is safer than a slow correct one.
</code></pre>
