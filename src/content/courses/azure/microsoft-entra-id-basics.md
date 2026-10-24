---
publishDate: 2026-10-03T06:35
title: 'Microsoft Entra ID: What Replaced Azure AD'
slug: microsoft-entra-id-basics
metadescription: Understand Microsoft Entra ID, why it was renamed from Azure AD, and how it differs from the Active Directory you may already know.
updateDate: 2026-09-07T06:35
author: ['bishal-biswas']
level: 1
tags: ['identity', 'entra', 'fundamentals']
course: azure
---

## The rename

Azure Active Directory became **Microsoft Entra ID** in 2023. Same service, new name.

The rename matters practically because both names are everywhere. Documentation, blog posts, error messages, PowerShell modules and the CLI all still contain `aad` and `azuread` in places.

```bash
az ad user list          # still `ad`, still works
az ad app create
az ad sp create-for-rbac
```

Treat "Azure AD", "AAD" and "Entra ID" as the same thing when reading. Anything written before 2024 uses the old name.

`Microsoft Entra` is the umbrella brand covering several products. `Microsoft Entra ID` is the directory service specifically.

## It is not Active Directory

This confuses people who know on premises Active Directory. They share a lineage and very little else.

```text
Active Directory (on premises)     Microsoft Entra ID (cloud)
LDAP and Kerberos                  OAuth 2.0, OpenID Connect, SAML
organisational units, forests      flat structure with groups
group policy                       Conditional Access and Intune
domain join                        device registration
designed for a network             designed for the internet
```

Entra ID has **no organisational units**, no group policy and no LDAP. Applications authenticate with modern token based protocols, not Kerberos tickets.

Hybrid setups sync from on premises AD to Entra ID with Entra Connect, so users have one identity in both. That is common in enterprises and does not make them the same system.

## What lives in a tenant

```text
Users            people, and their credentials
Groups           collections of users, used for access
Applications     app registrations and service principals
Devices          registered or joined machines
Roles            directory roles, distinct from Azure RBAC roles
```

```bash
az ad signed-in-user show
az ad user list --query "[].{Name:displayName, UPN:userPrincipalName}" --output table
az ad group list --output table
az ad app list --query "[].{Name:displayName, AppId:appId}" --output table
```

## Two different role systems

The single most confusing thing for newcomers. Azure has two separate permission systems and they do different jobs.

```text
Entra ID roles     manage the DIRECTORY: users, groups, app registrations
Azure RBAC roles   manage RESOURCES: virtual machines, storage, databases
```

Being a **Global Administrator** in Entra ID does not give you access to any Azure resource. Being an **Owner** of a subscription does not let you create users.

```bash
# an Entra ID directory role
az rest --method get \
  --url "https://graph.microsoft.com/v1.0/me/memberOf" \
  --query "value[].displayName"

# Azure RBAC on resources
az role assignment list --assignee me@contoso.com --all --output table
```

A Global Administrator can grant themselves access to all subscriptions through the portal, deliberately, but it is not automatic.

RBAC gets its own topic. The thing to hold onto now is that they are different systems.

## Authentication versus authorisation

```text
Authentication   who are you? Entra ID answers this and issues a token.
Authorisation    what may you do? RBAC, app roles and scopes answer this.
```

Entra ID issues a **token**, which is a signed statement about the caller. Everything downstream trusts it because it can verify the signature.

```bash
az account get-access-token --resource https://management.azure.com/
```

The token contains claims: who the user is, which tenant, when it expires, which scopes were granted. Decoding one at jwt.ms is a genuinely useful way to understand what your application receives.

**A token is not encrypted.** Anyone can read the payload. Only the signature makes it trustworthy, and only the receiving service can verify that.

## Applications in Entra ID

Two objects, and the difference matters.

```text
Application registration   the global definition of an app, in its home tenant
Service principal          the local instance of that app in a tenant
```

Registering an app creates the definition. A service principal is created in each tenant where the app is used, and role assignments attach to the service principal, not the registration.

```bash
az ad app create --display-name "shop-deployment"
az ad sp create --id APP_ID
az ad sp list --display-name "shop-deployment" --output table
```

This has its own topic. The short version: the registration is the blueprint, the service principal is the thing you grant permissions to.

## Licence tiers

```text
Free             included with any Azure subscription. Users, groups, basic SSO.
P1               Conditional Access, group based licensing, self service password reset with writeback
P2               Identity Protection, Privileged Identity Management, access reviews
```

The features people most often want and do not have are **Conditional Access** (P1) and **Privileged Identity Management** (P2). Both are commonly assumed to be included and are not.

Check before designing a security model around them.

## Domains

```bash
az rest --method get --url "https://graph.microsoft.com/v1.0/domains" \
  --query "value[].{Domain:id, Verified:isVerified, Default:isDefault}" --output table
```

Every tenant gets `something.onmicrosoft.com`. Adding a custom domain means proving ownership with a DNS record.

The default domain never goes away, and it is worth knowing because break glass accounts usually use it rather than a custom domain that might have DNS problems.

## Guests and external identities

```bash
az ad user invite \
  --invited-user-email-address contractor@partner.com \
  --invite-redirect-url https://portal.azure.com
```

A guest authenticates against their own tenant but exists as an object in yours. That is how you give a partner or contractor access without creating and managing credentials for them.

Guest access defaults are quite permissive: by default a guest can enumerate other users and groups. Tightening external collaboration settings is one of the first things to check in a new tenant.

## What to do first in a new tenant

```text
verify a custom domain
create break glass accounts, excluded from Conditional Access, with long stored passwords
enable multifactor authentication for administrators
restrict who can register applications
restrict what guests can see
review who holds Global Administrator
```

That last one matters. Global Administrator should be a small number of people, ideally activated just in time rather than held permanently.

```bash
az rest --method get \
  --url "https://graph.microsoft.com/v1.0/directoryRoles" \
  --query "value[?displayName=='Global Administrator'].id" --output tsv
```

## Quick recap

- Azure AD was renamed Microsoft Entra ID, and both names appear everywhere.
- It is not on premises Active Directory: no LDAP, no OUs, no group policy.
- Entra ID roles manage the directory, Azure RBAC roles manage resources, and they are separate.
- Entra ID authenticates and issues a token, which is signed but not encrypted.
- An app registration is the definition, a service principal is the instance you grant access to.
- Conditional Access needs P1 and Privileged Identity Management needs P2.
- Create break glass accounts and keep Global Administrator to very few people.

<code id="code-content" class="language-bash">
# Azure AD was renamed MICROSOFT ENTRA ID in 2023. Same service. Both names
# are everywhere, and the CLI still says `ad`.
az ad signed-in-user show
az ad user list --query "[].{Name:displayName, UPN:userPrincipalName}" -o table
az ad group list --output table
# IT IS NOT on premises Active Directory. No LDAP, no organisational units,
# no group policy. Applications use OAuth 2.0 and OpenID Connect, not Kerberos.
# TWO SEPARATE ROLE SYSTEMS, and this confuses everyone at first:
#   Entra ID roles   manage the DIRECTORY: users, groups, app registrations
#   Azure RBAC       manage RESOURCES: VMs, storage, databases
# A Global Administrator has NO access to Azure resources by default.
# A subscription Owner CANNOT create users.
az rest --method get --url "https://graph.microsoft.com/v1.0/me/memberOf" \
  --query "value[].displayName" -o tsv                  # directory roles
az role assignment list --assignee me@contoso.com --all -o table   # resource RBAC
# Entra ID AUTHENTICATES and issues a signed token. Everything downstream
# trusts it because it can verify the signature.
az account get-access-token --resource https://management.azure.com/ --query accessToken -o tsv
# A TOKEN IS NOT ENCRYPTED. Anyone can read the payload (paste one into
# jwt.ms). Only the signature makes it trustworthy.
# APP REGISTRATION vs SERVICE PRINCIPAL:
#   registration      the global definition, in its home tenant
#   service principal the local instance, and what you grant ROLES to
az ad app create --display-name "shop-deployment"
az ad sp create --id APP_ID
az ad sp list --display-name "shop-deployment" -o table
# LICENCE TIERS. The two features people assume they have and do not:
#   Conditional Access              needs P1
#   Privileged Identity Management  needs P2
# Check before designing a security model around them.
# Domains. The onmicrosoft.com default never goes away, which is why break
# glass accounts use it rather than a custom domain with DNS to go wrong.
az rest --method get --url "https://graph.microsoft.com/v1.0/domains" \
  --query "value[].{Domain:id, Verified:isVerified}" -o table
# External people should be GUESTS: they authenticate against their own
# tenant. Guest defaults are permissive, so tighten external collaboration.
az ad user invite --invited-user-email-address contractor@partner.com \
  --invite-redirect-url https://portal.azure.com
# FIRST THINGS IN A NEW TENANT: verify a domain, create break glass accounts
# excluded from Conditional Access, require MFA for admins, restrict app
# registration and guest visibility, and review who holds Global Administrator.
</code></pre>
