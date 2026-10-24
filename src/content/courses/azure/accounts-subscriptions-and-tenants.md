---
publishDate: 2026-10-01T06:05
title: Accounts, Subscriptions and Tenants
slug: accounts-subscriptions-and-tenants
metadescription: Understand the difference between a tenant, a subscription and an account, and how to structure them without painting yourself into a corner.
updateDate: 2026-09-07T06:05
author: ['bishal-biswas']
level: 1
tags: ['fundamentals', 'subscriptions', 'tenants']
course: azure
---

## Three words people use interchangeably

They are not the same thing, and confusing them causes real problems.

```text
Tenant         an identity boundary. One Microsoft Entra ID directory.
Subscription   a billing and quota boundary. Resources live here.
Account        a user identity. A person who signs in.
```

A tenant can contain many subscriptions. A subscription belongs to exactly one tenant. An account can have access to many subscriptions across many tenants.

## The tenant

A tenant is your organisation's directory: users, groups, application registrations and the policies over them. It has a default domain like `contoso.onmicrosoft.com` and usually a verified custom domain like `contoso.com`.

```bash
az account show --query "{tenantId:tenantId, name:name}" --output table
```

Most organisations have exactly one, and that is the right number. Multiple tenants means duplicated identities, no single sign on between them and guest invitations everywhere.

The legitimate reasons for more than one: genuinely separate legal entities, an acquisition not yet merged, or a strict isolation requirement for a test directory.

## The subscription

A subscription is where resources live and where the bill lands. It also carries quotas, so it is a scaling boundary as well as a financial one.

```bash
az account list --output table
az account show
az account set --subscription "Production"
```

Quotas matter more than people expect. A subscription has limits on cores per region, public IP addresses, storage accounts and much else. Hitting one during a deployment is a common and confusing failure.

```bash
az vm list-usage --location uksouth --output table
az network list-usages --location uksouth --output table
```

Check before a large deployment rather than during it.

## How many subscriptions

The common structures:

**By environment.** Production, staging, development. The most popular, and a good default. It isolates blast radius and makes cost per environment obvious.

**By business unit.** Each department owns a subscription and its budget. Suits organisations where teams control their own spend.

**By workload.** Each significant application gets one. Suits large estates where a single application would otherwise dominate a shared subscription's quotas.

Most organisations end up combining them: a subscription per environment per business unit.

The mistake to avoid is **one subscription for everything.** It works until it does not: quotas collide, cost attribution becomes guesswork, and a mistake in development can affect production.

The opposite mistake is a subscription per team per project per environment, producing hundreds nobody can govern.

## Moving resources between subscriptions

Possible, and not always pleasant.

```bash
az resource move \
  --destination-group rg-target \
  --destination-subscription-id 00000000-0000-0000-0000-000000000000 \
  --ids /subscriptions/.../resourceGroups/rg-source/providers/Microsoft.Web/sites/my-app
```

Many resource types cannot move. Those that can often need to be stopped, and dependencies must move together. Treat a move as a small project rather than a command.

This is why the initial structure matters. Getting it roughly right is much cheaper than fixing it later.

## Billing structures

```text
Pay as you go        a card, no commitment. Fine for learning.
Microsoft Customer Agreement   the current standard commercial agreement
Enterprise Agreement  large organisations with a negotiated commitment
CSP                  bought through a partner who handles billing
Free account         a credit for a limited period plus some always free services
```

The agreement type affects which portal features you see and how billing is structured, which is why documentation sometimes describes screens you do not have.

## Access across subscriptions

An account is granted access with role assignments, and those can be at any scope.

```bash
# everything in a subscription
az role assignment create \
  --assignee alice@contoso.com \
  --role Reader \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000

# just one resource group
az role assignment create \
  --assignee alice@contoso.com \
  --role Contributor \
  --scope /subscriptions/.../resourceGroups/rg-shop-dev
```

An account with access to several subscriptions switches between them rather than logging in again, as long as they are in the same tenant. Across tenants, you sign in separately.

## Guests and external users

```bash
az ad user invite --invited-user-email-address contractor@partner.com \
  --invite-redirect-url https://portal.azure.com
```

A guest exists in your tenant but authenticates against their own. That is the right way to give a contractor or partner access, rather than creating an account for them in your directory.

Guests are easy to forget about. Review them periodically, because access granted for a three month project tends to outlive it.

## Trial and free tier

A new account gets a credit for a limited period, plus a set of services that stay free within limits: a small App Service plan, a small database, a quantity of blob storage and functions executions.

Two things worth knowing. The free credit expires whether spent or not. And when it ends, the subscription is disabled rather than silently charging you, which is a sensible default but surprises people whose demo stops working.

## Quick recap

- A tenant is identity, a subscription is billing and quota, an account is a person.
- One tenant is the right number for most organisations.
- Subscriptions carry quotas, so they are a scaling boundary as well as a financial one.
- A subscription per environment is a good default structure.
- Moving resources between subscriptions is limited and awkward, so structure early.
- Invite external people as guests rather than creating accounts for them.
- Review guest access periodically, because it outlives the projects it was for.

<code id="code-content" class="language-bash">
# TENANT       an identity boundary, one Entra ID directory
# SUBSCRIPTION a billing AND QUOTA boundary, where resources live
# ACCOUNT      a person who signs in
# A tenant has many subscriptions. A subscription has exactly one tenant.
az login
az account list --output table
az account show --query "{sub:name, subId:id, tenant:tenantId}" --output table
az account set --subscription "Production"
# QUOTAS matter more than people expect, and they are PER SUBSCRIPTION
# PER REGION. Hitting one mid deployment is a common, confusing failure.
# Check BEFORE a large deployment, not during it.
az vm list-usage --location uksouth --output table
az network list-usages --location uksouth --output table
# Grant access at whatever scope is appropriate. Narrower is better.
az role assignment create --assignee alice@contoso.com --role Reader \
  --scope /subscriptions/00000000-0000-0000-0000-000000000000
az role assignment create --assignee alice@contoso.com --role Contributor \
  --scope /subscriptions/0000.../resourceGroups/rg-shop-dev
# See what someone can actually do
az role assignment list --assignee alice@contoso.com --all --output table
# External people should be GUESTS: they exist in your tenant but
# authenticate against their own directory. Do not create accounts for them.
az ad user invite --invited-user-email-address contractor@partner.com \
  --invite-redirect-url https://portal.azure.com
# Review guests periodically. Access granted for a three month project
# reliably outlives the project.
az ad user list --filter "userType eq 'Guest'" \
  --query "[].{Name:displayName, Mail:mail, Created:createdDateTime}" --output table
# MOVING resources between subscriptions is limited and awkward: many types
# cannot move, dependencies must move together, and some need stopping.
# Treat it as a small project. This is why the initial structure matters.
az resource move --destination-subscription-id 0000... \
  --destination-group rg-target --ids /subscriptions/.../sites/my-app
# STRUCTURE: a subscription per environment is a good default. Avoid one
# subscription for everything (quotas collide, cost attribution is guesswork)
# and avoid hundreds nobody can govern.
</code></pre>
