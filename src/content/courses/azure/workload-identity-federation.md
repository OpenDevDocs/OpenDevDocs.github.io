---
publishDate: 2026-10-22T11:35
title: Workload Identity Federation for CI/CD
slug: workload-identity-federation
metadescription: Remove stored secrets from CI/CD entirely with workload identity federation, and understand exactly how the trust works.
updateDate: 2026-09-07T11:35
author: ['bishal-biswas']
level: 3
tags: ['devops', 'security', 'identity']
course: azure
---

## The problem

A pipeline needs to deploy to Azure, so it has a client secret in a variable. That secret:

```text
Expires, usually during an incident
Can be read by anyone who can edit the pipeline
Ends up in a screenshot, a support ticket, or a log
Is the same credential for every run
Is rarely rotated, because rotating it breaks things
```

Federation removes it. There is no secret, so none of that applies.

## How it works

```text
1. The pipeline requests a short lived token from its own identity provider
   (GitHub Actions, Azure DevOps, a Kubernetes cluster)
2. It presents that token to Entra ID
3. Entra ID checks the ISSUER and the SUBJECT against a federated credential
4. If they match, it issues an Azure access token
5. That token expires in about an hour
```

Nothing is stored anywhere. The pipeline's own identity is the credential, and Entra ID trusts it because you configured that trust explicitly.

## Setting it up

```bash
APP_ID=$(az ad app create --display-name "gh-shop-deploy" --query appId -o tsv)
az ad sp create --id "$APP_ID"
SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)

az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role Contributor \
  --scope /subscriptions/0000.../resourceGroups/rg-shop-prod-uks

az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-main-branch",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:contoso/shop:ref:refs/heads/main",
  "description": "Deploys from the main branch",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

Three values define the trust:

```text
issuer     who signs the incoming token
subject    exactly which workload is trusted
audiences  always api://AzureADTokenExchange for Azure
```

## Subjects, precisely

The subject string is the whole security boundary, so it is worth getting exactly right.

**GitHub Actions:**

```text
repo:contoso/shop:ref:refs/heads/main         the main branch
repo:contoso/shop:ref:refs/tags/v1.0.0        a specific tag
repo:contoso/shop:environment:production      a GitHub environment
repo:contoso/shop:pull_request                any pull request
repo:contoso/shop:ref:refs/heads/feature/*    needs a wildcard credential
```

**Environment is the strongest of these**, because a GitHub environment carries approvals and branch restrictions of its own. A credential scoped to `environment:production` cannot be used by anything that has not passed those checks.

**Azure DevOps:**

```text
sc://contoso/shop-project/sc-shop-prod
```

The service connection identifier, so the credential works only for that connection in that project.

**Kubernetes and AKS:**

```text
system:serviceaccount:shop:shop-api
```

One service account in one namespace, which is what makes AKS workload identity safe.

## Using it

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
```

Note those are `vars`, not `secrets`. A client ID and tenant ID are identifiers, not credentials, and there is no benefit in treating them as secret.

**`permissions: id-token: write` is required.** Without it GitHub does not issue an OIDC token and the login fails. This is the most common setup mistake.

## Terraform

```yaml
env:
  ARM_USE_OIDC: true
  ARM_CLIENT_ID: ${{ vars.AZURE_CLIENT_ID }}
  ARM_TENANT_ID: ${{ vars.AZURE_TENANT_ID }}
  ARM_SUBSCRIPTION_ID: ${{ vars.AZURE_SUBSCRIPTION_ID }}
```

No `ARM_CLIENT_SECRET`. The AzureRM provider requests the token itself.

## AKS workload identity

The same mechanism, for pods.

```bash
az aks update --name aks-shop --resource-group rg-shop-prod-uks \
  --enable-oidc-issuer --enable-workload-identity

OIDC_URL=$(az aks show --name aks-shop --resource-group rg-shop-prod-uks \
  --query oidcIssuerProfile.issuerUrl -o tsv)

az identity create --name id-shop-api --resource-group rg-shop-prod-uks

az identity federated-credential create \
  --name aks-shop-api --identity-name id-shop-api \
  --resource-group rg-shop-prod-uks \
  --issuer "$OIDC_URL" \
  --subject "system:serviceaccount:shop:shop-api" \
  --audience api://AzureADTokenExchange
```

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: shop-api
  namespace: shop
  annotations:
    azure.workload.identity/client-id: "CLIENT_ID"
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    metadata:
      labels:
        azure.workload.identity/use: "true"
    spec:
      serviceAccountName: shop-api
```

Note `az identity federated-credential` for a user assigned identity, against `az ad app federated-credential` for an app registration. Two commands, same idea, and using the wrong one produces a confusing error.

## Federating other providers

```bash
# GitLab
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "gitlab-main",
  "issuer": "https://gitlab.com",
  "subject": "project_path:contoso/shop:ref_type:branch:ref:main",
  "audiences": ["api://AzureADTokenExchange"]
}'

# a generic OIDC provider
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "external-system",
  "issuer": "https://oidc.example.com",
  "subject": "system:deployer",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

Any OIDC compliant provider works. That includes other clouds, so an AWS or Google workload can authenticate to Azure with no stored secret either.

## Limits

```text
20 federated credentials per application or user assigned identity
Wildcards need a flexible federated identity credential, configured differently
The issuer must be reachable by Entra ID over HTTPS
Tokens are short lived by design, which is the point
```

Twenty is a real limit for an organisation federating many branches. The usual answer is fewer, broader credentials scoped to environments rather than one per branch.

## Verifying and debugging

```bash
az ad app federated-credential list --id "$APP_ID" \
  --query "[].{Name:name, Issuer:issuer, Subject:subject}" --output table

az role assignment list --assignee "$APP_ID" --all --output table
```

**"AADSTS70021: No matching federated identity record found."** The subject does not match. Compare exactly, character by character, including the branch reference format.

**"No OIDC token available."** Missing `permissions: id-token: write`.

**Login works, deployment fails.** Authentication succeeded and authorisation did not. The service principal needs a role assignment.

**Works on main, fails on a pull request.** Correct behaviour, and usually what you wanted. A pull request has a different subject, so it needs its own credential if it genuinely needs access.

## Migrating from secrets

```text
1. Create the federated credential alongside the existing secret
2. Change the workflow to use federation
3. Confirm several successful runs
4. Delete the client secret
5. Check nothing else was using it
```

Step five matters. A service principal used by a pipeline is often also used by a script on someone's machine, and deleting the secret breaks that quietly.

```bash
az ad app credential list --id "$APP_ID" --output table
az ad app credential delete --id "$APP_ID" --key-id "$KEY_ID"
```

## Quick recap

- Federation replaces a stored secret with a short lived token from the workload's own provider.
- Issuer, subject and audience define the trust, and the subject is the security boundary.
- Scoping to a GitHub environment is strongest, since the environment carries its own checks.
- Client ID and tenant ID are identifiers, not secrets, so use variables.
- `id-token: write` is required, and missing it is the most common setup mistake.
- Use `az identity federated-credential` for managed identities and `az ad app` for registrations.
- Before deleting the old secret, check what else was using it.

<code id="code-content" class="language-bash">
# THE PROBLEM: a client secret in a pipeline variable EXPIRES during an
# incident, can be read by anyone who can edit the pipeline, ends up in a
# screenshot, is the same credential for every run, and is rarely rotated
# BECAUSE ROTATING IT BREAKS THINGS.
# HOW FEDERATION WORKS:
#   1. the pipeline gets a SHORT LIVED token from ITS OWN provider
#   2. it presents that to Entra ID
#   3. Entra ID checks the ISSUER and SUBJECT against a federated credential
#   4. if they match, it issues an Azure token, valid about an hour
# NOTHING IS STORED ANYWHERE.
APP_ID=$(az ad app create --display-name "gh-shop-deploy" --query appId -o tsv)
az ad sp create --id "$APP_ID"
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-prod",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:contoso/shop:environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}'
# THE SUBJECT IS THE WHOLE SECURITY BOUNDARY. Get it exactly right:
#   GitHub  repo:contoso/shop:ref:refs/heads/main
#           repo:contoso/shop:environment:production   &lt;- STRONGEST: the
#             environment carries its own approvals and branch restrictions
#           repo:contoso/shop:pull_request
#   Azure DevOps  sc://contoso/shop-project/sc-shop-prod
#   Kubernetes    system:serviceaccount:shop:shop-api
# IN THE WORKFLOW. Note vars, NOT secrets: a client ID and tenant ID are
# IDENTIFIERS, not credentials.
#   permissions:
#     id-token: write     &lt;- REQUIRED. Missing it is the most common mistake.
#     contents: read
#   - uses: azure/login@v2
#     with:
#       client-id: ${{ vars.AZURE_CLIENT_ID }}
#       tenant-id: ${{ vars.AZURE_TENANT_ID }}
# TERRAFORM needs no ARM_CLIENT_SECRET, only:  ARM_USE_OIDC=true
# AKS WORKLOAD IDENTITY IS THE SAME MECHANISM FOR PODS. NOTE THE DIFFERENT
# COMMAND: `az identity federated-credential` for a MANAGED IDENTITY,
# `az ad app federated-credential` for an APP REGISTRATION. Using the wrong
# one gives a confusing error.
az aks update --name aks-shop --resource-group rg-shop-prod-uks \
  --enable-oidc-issuer --enable-workload-identity
OIDC_URL=$(az aks show --name aks-shop --resource-group rg-shop-prod-uks \
  --query oidcIssuerProfile.issuerUrl -o tsv)
az identity federated-credential create --name aks-shop-api \
  --identity-name id-shop-api --resource-group rg-shop-prod-uks \
  --issuer "$OIDC_URL" --subject "system:serviceaccount:shop:shop-api" \
  --audience api://AzureADTokenExchange
# ANY OIDC PROVIDER WORKS, including other clouds. An AWS or Google
# workload can authenticate to Azure with no stored secret either.
# LIMIT: 20 federated credentials per application. For many branches, use
# FEWER BROADER credentials scoped to ENVIRONMENTS, not one per branch.
# DEBUGGING:
az ad app federated-credential list --id "$APP_ID" \
  --query "[].{Name:name, Issuer:issuer, Subject:subject}" -o table
#   AADSTS70021 no matching record   the SUBJECT does not match. Compare
#                                    character by character.
#   No OIDC token available          missing permissions: id-token: write
#   login works, deploy fails        authenticated but NOT AUTHORISED: the
#                                    principal needs a role assignment
#   works on main, fails on a PR     CORRECT. A PR has a different subject.
# MIGRATING: add federation ALONGSIDE the secret, switch, confirm several
# runs, THEN delete the secret. AND CHECK WHAT ELSE WAS USING IT: a pipeline
# principal is often also used by a script on someone's machine.
az ad app credential list --id "$APP_ID" --output table
</code></pre>
