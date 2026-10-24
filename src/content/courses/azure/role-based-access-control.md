---
publishDate: 2026-10-03T06:45
title: Role Based Access Control
slug: role-based-access-control
metadescription: Grant access to Azure resources with RBAC, understand scope inheritance, and use the built in roles correctly.
updateDate: 2026-09-07T06:45
author: ['bishal-biswas']
level: 2
tags: ['security', 'rbac', 'permissions']
course: azure
---

## Three parts to every assignment

```text
Security principal   who: a user, group, service principal or managed identity
Role definition      what: a set of allowed operations
Scope                where: management group, subscription, resource group or resource
```

An assignment binds all three.

```bash
az role assignment create \
  --assignee asha@contoso.com \
  --role "Contributor" \
  --scope /subscriptions/0000.../resourceGroups/rg-shop-dev-uks
```

## Scope inherits downward

```text
Management group
  └── Subscription
        └── Resource group
              └── Resource
```

A role assigned at a higher scope applies to everything beneath it. Contributor on a subscription means Contributor on every resource group and every resource in it.

That is convenient and it is why over broad assignments are so common. Grant at the **narrowest scope that works**, which is usually a resource group.

```bash
# too broad for most people
az role assignment create --assignee asha@contoso.com --role Contributor \
  --scope /subscriptions/0000...

# usually right
az role assignment create --assignee asha@contoso.com --role Contributor \
  --scope /subscriptions/0000.../resourceGroups/rg-shop-dev-uks

# narrower still
az role assignment create --assignee asha@contoso.com --role "Storage Blob Data Contributor" \
  --scope /subscriptions/.../storageAccounts/stshopdev/blobServices/default/containers/uploads
```

## The roles you will use most

```text
Owner                    full access, including granting access to others
Contributor              full access, EXCEPT granting access
Reader                   view everything, change nothing
User Access Administrator  manage access only, not resources
```

The distinction between Owner and Contributor is the one that matters. **Contributor cannot grant permissions.** That is deliberate: it stops someone escalating their own access.

Owner should be rare. Most people who think they need Owner actually need Contributor.

## Data plane roles

The mistake that catches everyone: **management plane access does not give data plane access.**

```text
Contributor on a storage account   can change its settings, delete it, read its keys
Storage Blob Data Reader           can actually read blobs
```

Being Owner of a Key Vault does not let you read a secret. Being Contributor on a storage account does not let you list blobs, unless you use the account keys, which is exactly what you should not be doing.

```bash
az role assignment create --assignee APP_ID \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/.../storageAccounts/stshopprod

az role assignment create --assignee APP_ID \
  --role "Key Vault Secrets User" \
  --scope /subscriptions/.../vaults/kv-shop-prod
```

The data plane roles worth memorising:

```text
Storage Blob Data Reader / Contributor / Owner
Storage Queue Data Reader / Contributor
Key Vault Secrets User / Secrets Officer
Key Vault Certificates Officer, Crypto User
Cosmos DB Built-in Data Reader / Contributor
Azure Service Bus Data Sender / Receiver
Event Hubs Data Sender / Receiver
AcrPull / AcrPush
```

Notice they are separate from the management roles, and they exist precisely so an application can read data without being able to change infrastructure.

## Finding the right role

```bash
az role definition list --query "[?contains(roleName, 'Storage')].roleName" --output tsv
az role definition list --name "Storage Blob Data Contributor" --query "[0].permissions"
az role definition list --custom-role-only true --output table
```

There are hundreds of built in roles, and there is usually one that fits. Check before writing a custom role.

## Seeing who has access

```bash
# everything at and above this scope
az role assignment list --scope /subscriptions/.../resourceGroups/rg-shop-prod-uks \
  --include-inherited --output table

# what one person can do, everywhere
az role assignment list --assignee asha@contoso.com --all --output table

# every Owner in the subscription, which is worth checking regularly
az role assignment list --role Owner --scope /subscriptions/0000... \
  --query "[].{Principal:principalName, Type:principalType, Scope:scope}" --output table
```

`--include-inherited` is important. Without it you see only assignments made directly at that scope and miss everything inherited from above, which is usually where the over broad grant is.

## Deny assignments

```bash
az role assignment list --scope /subscriptions/... --include-inherited \
  --query "[?principalType=='User']" --output table
```

Deny assignments exist and **you cannot create them directly**. They are created by Azure Blueprints and by managed applications, and they override allow assignments.

If someone has Owner and still cannot do something, a deny assignment is a likely cause and it is easy to miss.

## Assigning to a managed identity

```bash
IDENTITY_ID=$(az webapp identity assign \
  --name shop-api --resource-group rg-shop-prod-uks \
  --query principalId --output tsv)

az role assignment create \
  --assignee-object-id "$IDENTITY_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/.../storageAccounts/stshopprod
```

`--assignee-object-id` with `--assignee-principal-type` avoids a race. A freshly created identity may not be visible to the directory lookup that plain `--assignee` performs, producing an intermittent failure in deployment scripts.

That intermittent failure is a classic, and this is the fix.

## Common problems

**"Authorization failed" despite having Owner.** Almost always a data plane operation needing a data plane role, or a deny assignment.

**Changes take a few minutes.** Role assignments are eventually consistent. Cached tokens carry old claims until they expire.

**Assignment fails for a new identity.** The race described above. Use the object id, or retry.

**Too many assignments.** There is a limit per subscription, in the low thousands. Assign to groups rather than individuals and you will never approach it.

## Principle to follow

```text
Grant to groups, not people
Grant the narrowest role that works
Grant at the narrowest scope that works
Grant temporarily where possible
Review Owner assignments regularly
```

Privileged Identity Management makes the fourth practical, activating a role for a few hours rather than holding it permanently. It needs Entra ID P2.

## Quick recap

- An assignment is a principal, a role and a scope, and scope inherits downward.
- Contributor cannot grant access, which is what separates it from Owner.
- Management plane access does not give data plane access, and this catches everyone.
- Use data plane roles like Storage Blob Data Contributor for applications.
- Use `--include-inherited` or you miss the assignment causing the problem.
- Use `--assignee-object-id` with the principal type for freshly created identities.
- Assign to groups, at the narrowest scope, and review Owners regularly.

<code id="code-content" class="language-bash">
# Every assignment is three things: WHO, WHAT and WHERE.
az role assignment create --assignee asha@contoso.com --role "Contributor" \
  --scope /subscriptions/0000.../resourceGroups/rg-shop-dev-uks
# SCOPE INHERITS DOWNWARD:
#   management group -&gt; subscription -&gt; resource group -&gt; resource
# Contributor on a subscription is Contributor on everything in it, which
# is why over broad grants are so common. Use the NARROWEST scope that works.
# THE DISTINCTION THAT MATTERS: Contributor CANNOT grant access. That is
# deliberate, and it stops someone escalating their own permissions.
#   Owner        full access INCLUDING granting access
#   Contributor  full access EXCEPT granting access
#   Reader       view only
# THE MISTAKE THAT CATCHES EVERYONE: management plane access does NOT give
# data plane access. Owner of a Key Vault cannot read a secret.
# Contributor on a storage account cannot list blobs.
az role assignment create --assignee APP_ID \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/.../storageAccounts/stshopprod
az role assignment create --assignee APP_ID --role "Key Vault Secrets User" \
  --scope /subscriptions/.../vaults/kv-shop-prod
# Data plane roles worth knowing: Storage Blob Data Reader/Contributor,
# Key Vault Secrets User, Cosmos DB Built-in Data Reader, Service Bus Data
# Sender/Receiver, Event Hubs Data Sender/Receiver, AcrPull, AcrPush.
# Find one before writing a custom role. There are hundreds.
az role definition list --query "[?contains(roleName,'Storage')].roleName" -o tsv
# --include-inherited or you miss the over broad grant from above, which is
# usually the one causing the problem.
az role assignment list --scope /subscriptions/.../resourceGroups/rg-shop-prod-uks \
  --include-inherited --output table
az role assignment list --assignee asha@contoso.com --all --output table
# Worth running regularly:
az role assignment list --role Owner --scope /subscriptions/0000... \
  --query "[].{Principal:principalName, Type:principalType, Scope:scope}" -o table
# ASSIGNING TO A FRESH MANAGED IDENTITY. Plain --assignee does a directory
# lookup that a just created identity may not satisfy yet, giving an
# INTERMITTENT deployment failure. This is the fix:
IDENTITY_ID=$(az webapp identity assign --name shop-api \
  --resource-group rg-shop-prod-uks --query principalId -o tsv)
az role assignment create --assignee-object-id "$IDENTITY_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/.../storageAccounts/stshopprod
# "Authorization failed" despite having Owner is almost always a data plane
# operation needing a data plane role, or a DENY assignment (created by
# Blueprints or managed apps, and you cannot make them directly).
</code></pre>
