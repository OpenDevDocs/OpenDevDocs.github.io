---
publishDate: 2026-10-04T06:55
title: Service Principals and App Registrations
slug: service-principals-and-app-registrations
metadescription: Understand app registrations, service principals and the credentials they use, and know why federation beats a stored secret.
updateDate: 2026-09-07T06:55
author: ['bishal-biswas']
level: 2
tags: ['identity', 'service principals', 'authentication']
course: azure
---

## Two objects, one application

```text
Application registration   the definition, in the tenant that owns the app
Service principal          the local identity, in each tenant where the app is used
```

Registering an app creates a definition: its name, its redirect URIs, the permissions it requests. That definition does not have access to anything.

A service principal is created in a tenant when the app is used there, and **role assignments attach to the service principal**.

```bash
az ad app create --display-name "shop-deployment"
APP_ID=$(az ad app list --display-name "shop-deployment" --query "[0].appId" -o tsv)
az ad sp create --id "$APP_ID"

az ad app show --id "$APP_ID" --query "{Name:displayName, AppId:appId, ObjectId:id}"
az ad sp show --id "$APP_ID" --query "{Name:displayName, ObjectId:id}"
```

The confusing part is the identifiers. An app has an **application (client) ID**, and both the app object and the service principal have their own **object IDs**. Role assignments use the service principal's object ID.

```bash
SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)

az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role Contributor \
  --scope /subscriptions/.../resourceGroups/rg-shop-dev-uks
```

## The shortcut

```bash
az ad sp create-for-rbac \
  --name "shop-deployment" \
  --role Contributor \
  --scopes /subscriptions/.../resourceGroups/rg-shop-dev-uks
```

That creates the registration, the service principal, a client secret and the role assignment in one command, and prints the secret **once**.

Convenient, and it produces exactly the thing you should be moving away from: a long lived secret in a variable somewhere.

## Credentials, worst to best

```text
Client secret       a password. Expires, leaks, gets committed to git.
Certificate         better. Still a file to distribute and rotate.
Federated credential  no secret at all. The best option where it works.
Managed identity    no credential and no registration. Best of all, inside Azure.
```

### Client secret

```bash
az ad app credential reset --id "$APP_ID" --years 1 --query password -o tsv
az ad app credential list --id "$APP_ID" --output table
```

Secrets have a maximum lifetime, and tenants increasingly enforce a short one by policy. Expiry is the most common cause of a pipeline that worked yesterday and does not today.

```bash
# find secrets expiring soon, which is worth automating
az ad app list --query "[].{App:displayName, Expires:passwordCredentials[].endDateTime}" --output json
```

### Certificate

```bash
az ad app credential reset --id "$APP_ID" --create-cert
```

Better than a secret because the private key can live in a hardware module or a key vault. Still something to distribute, store and rotate.

### Federated credential

The one to use for CI/CD. No secret exists at all: the pipeline presents a token from its own identity provider, and Entra ID trusts it based on a configured subject.

```bash
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:contoso/shop:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: azure/login@v2
    with:
      client-id: ${{ vars.AZURE_CLIENT_ID }}
      tenant-id: ${{ vars.AZURE_TENANT_ID }}
      subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
```

No `client-secret`. Nothing to rotate, nothing to leak, and the `subject` pins it to one repository and branch so a fork cannot use it.

This has its own topic. If you take one thing from this article, it is that stored secrets in pipelines are avoidable.

## API permissions

Two kinds, and they behave very differently.

```text
Delegated      the app acts as the signed in user, limited to what that user can do
Application    the app acts as itself, with no user, and needs admin consent
```

```bash
# Microsoft Graph, User.Read.All as an application permission
az ad app permission add --id "$APP_ID" \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions df021288-bdef-4463-88db-98f22de89214=Role

az ad app permission admin-consent --id "$APP_ID"
az ad app permission list --id "$APP_ID" --output table
```

Application permissions are powerful. `User.Read.All` as an application permission reads every user in the tenant with no user context and no Conditional Access applied.

Grant the delegated version where the app acts for a user, and application permissions only where genuinely needed.

Note that adding a permission is not the same as granting it. Admin consent is a separate step, and forgetting it produces a confusing "insufficient privileges" error at runtime.

## Multi tenant applications

```bash
az ad app update --id "$APP_ID" --sign-in-audience AzureADMultipleOrgs
```

```text
AzureADMyOrg                    this tenant only
AzureADMultipleOrgs             any Entra ID tenant
AzureADandPersonalMicrosoftAccount  also personal Microsoft accounts
PersonalMicrosoftAccount        personal accounts only
```

A multi tenant app has one registration in its home tenant and a service principal created in every customer tenant that consents to it. Permissions are then granted per tenant.

## Housekeeping

Service principals accumulate, and orphaned ones with valid secrets are a genuine risk.

```bash
# apps with credentials, and when they expire
az ad app list --all --query "[?length(passwordCredentials) > \`0\`].{Name:displayName, AppId:appId}" --output table

# service principals with role assignments they may no longer need
az role assignment list --all \
  --query "[?principalType=='ServicePrincipal'].{Principal:principalName, Role:roleDefinitionName, Scope:scope}" \
  --output table

az ad sp delete --id "$APP_ID"
az ad app delete --id "$APP_ID"
```

Deleting the service principal removes the access. Deleting the registration removes the definition. Do both, in that order.

## When to use what

```text
Code running in Azure          managed identity, always
CI/CD pipeline                 federated credential, no secret
An external system calling in  service principal with a certificate
A daemon on a server           managed identity if it is an Azure VM, else certificate
A user facing application      delegated permissions, the user signs in
```

The rule: **a client secret should be your last choice, not your first.** Most places people use one have a better option available.

## Quick recap

- An app registration is the definition, a service principal is what you grant roles to.
- Role assignments use the service principal's object ID, not the application ID.
- `az ad sp create-for-rbac` is convenient and produces a secret you should avoid.
- Credential preference: managed identity, then federation, then certificate, then secret.
- Federated credentials remove secrets from CI/CD entirely and pin access to a repo and branch.
- Application permissions have no user context and no Conditional Access, so use delegated where possible.
- Adding a permission is not granting it, admin consent is a separate step.

<code id="code-content" class="language-bash">
# TWO OBJECTS: the registration is the DEFINITION, the service principal is
# the local identity. ROLE ASSIGNMENTS ATTACH TO THE SERVICE PRINCIPAL.
az ad app create --display-name "shop-deployment"
APP_ID=$(az ad app list --display-name "shop-deployment" --query "[0].appId" -o tsv)
az ad sp create --id "$APP_ID"
# The identifiers confuse everyone: the app has an application (client) ID,
# and the app object AND the service principal each have their own object ID.
SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)
az role assignment create --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal --role Contributor \
  --scope /subscriptions/.../resourceGroups/rg-shop-dev-uks
# The shortcut does all of that AND creates a client secret, printed once.
# Convenient, and it produces exactly what you should be moving away from.
az ad sp create-for-rbac --name "shop-deployment" --role Contributor \
  --scopes /subscriptions/.../resourceGroups/rg-shop-dev-uks
# CREDENTIALS, WORST TO BEST:
#   client secret        a password: expires, leaks, gets committed
#   certificate          better, still a file to distribute and rotate
#   federated credential NO SECRET AT ALL
#   managed identity     no credential and no registration. Best, inside Azure.
az ad app credential reset --id "$APP_ID" --years 1 --query password -o tsv
az ad app credential reset --id "$APP_ID" --create-cert
# FEDERATED CREDENTIALS remove secrets from CI/CD entirely. The `subject`
# pins it to one repo and branch, so a fork cannot use it.
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:contoso/shop:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'
# The workflow then needs NO client-secret, only id-token: write permission.
# API PERMISSIONS. Delegated acts AS THE USER and is limited to what they
# can do. Application acts as ITSELF with no user context and no Conditional
# Access, so User.Read.All reads every user in the tenant.
az ad app permission add --id "$APP_ID" \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions df021288-bdef-4463-88db-98f22de89214=Role
# ADDING a permission is not GRANTING it. Forgetting consent gives a
# confusing "insufficient privileges" error at runtime.
az ad app permission admin-consent --id "$APP_ID"
# HOUSEKEEPING. Orphaned principals with valid secrets are a real risk.
az role assignment list --all \
  --query "[?principalType=='ServicePrincipal'].{Who:principalName, Role:roleDefinitionName}" -o table
az ad sp delete --id "$APP_ID" &amp;&amp; az ad app delete --id "$APP_ID"
# THE RULE: a client secret is your LAST choice, not your first.
</code></pre>
