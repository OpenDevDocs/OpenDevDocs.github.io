---
publishDate: 2026-10-03T06:40
title: Users, Groups and Administrative Units
slug: users-groups-and-administrative-units
metadescription: Manage identities in Microsoft Entra ID, use groups for access rather than individuals, and scope administration with administrative units.
updateDate: 2026-09-07T06:40
author: ['bishal-biswas']
level: 1
tags: ['identity', 'entra', 'groups']
course: azure
---

## Users

```bash
az ad user create \
  --display-name "Asha Biswas" \
  --user-principal-name asha@contoso.com \
  --password 'GeneratedByYourIdP!' \
  --force-change-password-next-sign-in true

az ad user list --query "[].{Name:displayName, UPN:userPrincipalName, Enabled:accountEnabled}" --output table
az ad user show --id asha@contoso.com
az ad user update --id asha@contoso.com --account-enabled false
```

Three kinds of user account exist in a tenant:

```text
Member    an employee, created in this directory
Guest     an external person, authenticating against their own tenant
Cloud only vs synced   created here, or synced from on premises AD
```

For a synced user, most attributes are **read only in the cloud**. The source of truth is on premises AD, and changes made in Entra ID are overwritten on the next sync. That surprises people who try to fix a name in the portal.

```bash
az ad user show --id asha@contoso.com --query "{Type:userType, Synced:onPremisesSyncEnabled}"
```

## Groups

Groups are how access should be granted. Assigning a role to a person means remembering to remove it when they move team. Assigning to a group means membership changes handle it.

```text
Security group      for access control. What you usually want.
Microsoft 365 group  adds a mailbox, calendar and Teams team.
```

```bash
az ad group create --display-name "Shop Developers" --mail-nickname shop-devs
az ad group member add --group "Shop Developers" --member-id USER_OBJECT_ID
az ad group member list --group "Shop Developers" --query "[].displayName" --output tsv
az ad group show --group "Shop Developers" --query id --output tsv
```

## Assigned versus dynamic membership

```text
Assigned   you add and remove people by hand
Dynamic    membership is a rule evaluated against user attributes
```

Dynamic groups need Entra ID P1, and they are worth it at any scale.

```text
user.department -eq "Engineering"
user.jobTitle -contains "Developer"
(user.department -eq "Sales") and (user.country -eq "GB")
user.accountEnabled -eq true and user.userType -eq "Member"
```

A dynamic group means a new joiner gets the right access on their first day without anyone raising a ticket, and a leaver loses it when HR updates their record.

The catch: the rule is only as good as the attribute data. If `department` is inconsistently populated, the group is unreliable. Fix the data before relying on the rule.

## Nested groups

Groups can contain groups, and support is inconsistent.

```text
Azure RBAC              supports nesting
Some Microsoft 365 features   do not
Group based licensing   does not
Dynamic groups          cannot contain groups
```

Because of that inconsistency, keep nesting shallow. Two levels is manageable, four is a debugging exercise nobody enjoys.

## A workable group structure

```text
By role       sg-shop-developers, sg-shop-readers, sg-platform-admins
By resource   sg-rg-shop-prod-contributors
By function   sg-oncall-primary
```

The pattern that scales: **a group per role per environment**, then assign Azure roles to those groups.

```bash
az ad group create --display-name "sg-shop-prod-readers" --mail-nickname sg-shop-prod-readers

az role assignment create \
  --assignee-object-id $(az ad group show --group "sg-shop-prod-readers" --query id -o tsv) \
  --assignee-principal-type Group \
  --role "Reader" \
  --scope /subscriptions/0000.../resourceGroups/rg-shop-prod-uks
```

`--assignee-principal-type Group` matters. Without it the CLI does a lookup that can fail or be slow, and in automation it sometimes picks the wrong object type.

## Administrative units

An administrative unit scopes a **directory role** to a subset of the directory. Without them, granting someone User Administrator lets them reset any password in the tenant, including yours.

```bash
az rest --method post \
  --url "https://graph.microsoft.com/v1.0/directory/administrativeUnits" \
  --body '{"displayName":"UK Region","description":"Users and groups in the UK"}'
```

Then assign a role scoped to that unit, so a regional helpdesk can manage only their own users.

```text
Without an AU   User Administrator over the whole tenant
With an AU      User Administrator over the UK users only
```

This needs Entra ID P1. It is the directory equivalent of scoping an Azure role to a resource group rather than a subscription, and the same reasoning applies.

Note administrative units scope **Entra ID roles**, not Azure RBAC. Different system, as always.

## Group based licensing

```text
Assign a licence to a group, and every member gets it. Remove them, they lose it.
```

Combined with dynamic membership this is how licensing stops being manual. A rule puts everyone in Engineering into a group, and the group carries the licence.

Needs P1, and watch for licence conflicts: two groups granting overlapping service plans produce errors that are awkward to diagnose.

## Access reviews

```text
Periodically ask an owner to confirm who still needs access.
```

Needs P2. It is the answer to permissions that accumulate: someone joins a project group for three months and stays in it for four years.

Without P2, the manual equivalent is a scheduled query and a person who actually chases it.

```bash
az ad group member list --group "sg-shop-prod-contributors" \
  --query "[].{Name:displayName, UPN:userPrincipalName}" --output table
```

## Service accounts

Avoid creating user accounts for applications. It is common, and it is the wrong tool.

```text
An application   should use a managed identity, or a service principal
A shared mailbox should be a shared mailbox, not a user with a password
An automation    should use workload identity federation, not a stored password
```

A user account for an application means an interactive credential that cannot use MFA, never expires in practice, and is invisible to Conditional Access policies aimed at humans. Managed identities exist precisely to avoid this.

## Finding problems

```bash
# accounts that have never signed in
az rest --method get \
  --url "https://graph.microsoft.com/v1.0/users?\$select=displayName,userPrincipalName,signInActivity" \
  --query "value[?signInActivity==null].userPrincipalName" --output tsv

# guests, who accumulate
az ad user list --filter "userType eq 'Guest'" \
  --query "[].{Name:displayName, Mail:mail, Created:createdDateTime}" --output table

# groups nobody owns
az ad group list --query "[].{Name:displayName, Id:id}" --output table
```

Dormant accounts and stale guests are the two things that quietly grow. A quarterly look at both is cheap insurance.

## Quick recap

- Synced users are read only in the cloud, since on premises AD is the source of truth.
- Grant access to groups, never to individuals, so joiners and leavers are handled by membership.
- Dynamic groups automate membership, need P1, and depend on clean attribute data.
- Keep group nesting shallow, because support for it is inconsistent.
- Pass `--assignee-principal-type Group` when assigning roles in automation.
- Administrative units scope Entra ID roles, not Azure RBAC.
- Never create a user account for an application, use a managed identity.

<code id="code-content" class="language-bash">
# USERS. Member, guest, and cloud only versus synced from on premises AD.
az ad user create --display-name "Asha Biswas" \
  --user-principal-name asha@contoso.com --password 'FromYourIdP!' \
  --force-change-password-next-sign-in true
# For a SYNCED user most attributes are READ ONLY in the cloud. On premises
# AD is the source of truth, and portal edits are overwritten at next sync.
az ad user show --id asha@contoso.com \
  --query "{Type:userType, Synced:onPremisesSyncEnabled}"
# GROUPS are how access should be granted. Assign a role to a person and
# you must remember to remove it when they move team. Assign to a group
# and membership handles it.
az ad group create --display-name "sg-shop-prod-readers" --mail-nickname sg-shop-prod-readers
az ad group member add --group "sg-shop-prod-readers" --member-id USER_OBJECT_ID
# --assignee-principal-type matters in automation: without it the CLI does
# a lookup that can be slow or resolve the wrong object type.
GROUP_ID=$(az ad group show --group "sg-shop-prod-readers" --query id -o tsv)
az role assignment create --assignee-object-id "$GROUP_ID" \
  --assignee-principal-type Group --role "Reader" \
  --scope /subscriptions/0000.../resourceGroups/rg-shop-prod-uks
# DYNAMIC membership (needs P1) means a joiner has the right access on day
# one and a leaver loses it when HR updates the record. Example rules:
#   user.department -eq "Engineering"
#   (user.department -eq "Sales") and (user.country -eq "GB")
# The catch: the rule is only as good as the attribute data. Fix the data first.
# ADMINISTRATIVE UNITS scope a DIRECTORY role to part of the directory.
# Without one, User Administrator can reset ANY password in the tenant.
az rest --method post \
  --url "https://graph.microsoft.com/v1.0/directory/administrativeUnits" \
  --body '{"displayName":"UK Region"}'
# They scope Entra ID roles, NOT Azure RBAC. Different system, as always.
# NEVER create a user account for an application. It means an interactive
# credential that cannot use MFA, never really expires, and is invisible to
# Conditional Access aimed at humans. Use a managed identity.
# THE TWO THINGS THAT QUIETLY GROW. Look quarterly.
az ad user list --filter "userType eq 'Guest'" \
  --query "[].{Name:displayName, Created:createdDateTime}" -o table
az rest --method get \
  --url "https://graph.microsoft.com/v1.0/users?\$select=userPrincipalName,signInActivity" \
  --query "value[?signInActivity==null].userPrincipalName" -o tsv
</code></pre>
