---
publishDate: 2026-10-20T11:05
title: The Azure Developer CLI
slug: azure-developer-cli
metadescription: Use the Azure Developer CLI to provision infrastructure and deploy an application with a single command and a repeatable project layout.
updateDate: 2026-09-07T11:05
author: ['bishal-biswas']
level: 2
tags: ['tooling', 'azd', 'developer experience']
course: azure
---

## What azd is

`az` manages Azure resources. `azd` manages **an application on Azure**: its infrastructure, its code, its environments and its pipeline, from one command.

```bash
az provider register --namespace Microsoft.Web   # az: one resource
azd up                                            # azd: everything
```

`azd up` provisions infrastructure with Bicep or Terraform, builds the application, deploys it, and prints the URLs.

## Starting from a template

```bash
azd auth login
azd init --template todo-csharp-sql
azd up
```

Templates are complete working examples: infrastructure, application code, pipeline definition and monitoring. Browsing the gallery is a fast way to see how a particular architecture is assembled.

```bash
azd template list
azd template list --filter container-apps
```

## Starting from your own code

```bash
cd my-existing-app
azd init
```

It inspects the repository, identifies the services and languages, and generates infrastructure. The result is a starting point rather than a finished design, and it saves the tedious first pass.

## The project file

Everything is driven by `azure.yaml` at the repository root.

```yaml
name: shop
metadata:
  template: shop@1.0.0

services:
  api:
    project: ./src/Shop.Api
    language: csharp
    host: containerapp
    docker:
      path: ./Dockerfile
      context: .

  web:
    project: ./src/shop-web
    language: js
    host: staticwebapp
    dist: dist

hooks:
  preprovision:
    shell: sh
    run: ./scripts/check-prerequisites.sh
  postprovision:
    shell: sh
    run: ./scripts/seed-database.sh
    interactive: false
  postdeploy:
    shell: sh
    run: ./scripts/smoke-test.sh
```

```text
services   what to build and where to deploy it
host       containerapp, appservice, function, aks, staticwebapp, springapp
hooks      scripts at defined points in the lifecycle
```

Hooks are what make azd usable for real projects. Seeding a database after provisioning, running migrations before deployment, or smoke testing afterwards all belong here rather than in a runbook.

## Infrastructure

```text
infra/
  main.bicep
  main.parameters.json
  app/
    api.bicep
    web.bicep
  core/
    ...
azure.yaml
```

`main.parameters.json` is where azd passes its own values in:

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": { "value": "${AZURE_ENV_NAME}" },
    "location": { "value": "${AZURE_LOCATION}" },
    "principalId": { "value": "${AZURE_PRINCIPAL_ID}" }
  }
}
```

Those `${}` values come from the azd environment, so the same template deploys to any environment without editing.

## The service tag

This is the part that makes deployment automatic.

```bicep
resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-api-${resourceToken}'
  location: location
  tags: union(tags, { 'azd-service-name': 'api' })
  properties: { }
}
```

`azd-service-name` matching the service key in `azure.yaml` is how azd knows where to deploy each service. Without it, `azd deploy` cannot find the target and fails with a message that is clearer once you know this.

## Environments

```bash
azd env new dev
azd env new prod

azd env list
azd env select prod

azd env set DATABASE_SKU S1
azd env set ENABLE_CACHE true
azd env get-values
```

Each environment has its own subscription, region, resource group and variables, stored in `.azure/<name>/.env`.

**That directory is git ignored by default and should stay that way**, since it holds environment specific values and resolved outputs.

```bash
azd provision --environment prod
azd deploy --environment prod
azd up --environment prod
```

## The individual commands

```bash
azd provision      # infrastructure only
azd package        # build artefacts, no deploy
azd deploy         # code only, to existing infrastructure
azd deploy api     # one service
azd up             # provision + package + deploy
azd down           # delete everything in the environment
azd down --purge   # also purge soft deleted Key Vaults and API Management
```

`azd deploy` alone is the common one during development: infrastructure rarely changes, and skipping provisioning makes the loop much faster.

`--purge` matters. Key Vault purge protection means a redeployed environment with the same name fails on a soft deleted vault, and this is how you avoid it.

## Outputs become environment variables

```bicep
output AZURE_KEY_VAULT_ENDPOINT string = keyVault.properties.vaultUri
output AZURE_STORAGE_ACCOUNT_NAME string = storage.name
output AZURE_COSMOS_ENDPOINT string = cosmos.properties.documentEndpoint
output SERVICE_API_URI string = 'https://${api.properties.configuration.ingress.fqdn}'
```

Template outputs become environment variables in the azd environment, and azd sets them on the deployed services.

```csharp
var keyVaultUri = Environment.GetEnvironmentVariable("AZURE_KEY_VAULT_ENDPOINT");
var client = new SecretClient(new Uri(keyVaultUri!), new DefaultAzureCredential());
```

The application reads configuration from environment variables with no hard coded resource names and no manual wiring.

```bash
azd env get-values > .env    # for local development
```

## Generating a pipeline

```bash
azd pipeline config
azd pipeline config --provider azdo
```

That command creates the Entra ID application, configures a federated credential for the repository, sets the repository variables and commits a workflow file.

Setting up workload identity federation by hand is several steps that are easy to get subtly wrong. This does it correctly, which is a genuine time saving.

```yaml
- name: Install azd
  uses: Azure/setup-azd@v2

- name: Log in with federated credentials
  run: |
    azd auth login \
      --client-id "$AZURE_CLIENT_ID" \
      --federated-credential-provider "github" \
      --tenant-id "$AZURE_TENANT_ID"

- name: Provision
  run: azd provision --no-prompt

- name: Deploy
  run: azd deploy --no-prompt
```

## Monitoring shortcuts

```bash
azd monitor --overview
azd monitor --live
azd monitor --logs
azd show
```

`azd show` prints the endpoints and resources for the current environment, which saves finding them in the portal.

## Where azd fits

```text
Good for
  a project with a clear application and infrastructure boundary
  getting a new service running quickly
  a consistent deployment story across several repositories
  onboarding, since one command produces a running environment

Less good for
  a shared platform estate with no single application
  infrastructure managed by a different team on a different cadence
  a complex existing pipeline it would have to fit around
```

The clean case is one repository, one application, several environments. A platform team's networking and governance estate is better served by Bicep and pipelines directly.

## Working with an existing pipeline

You do not have to adopt everything. `azd provision` and `azd deploy` are usable from any pipeline, and the templates underneath are ordinary Bicep.

That makes adoption incremental: start by using azd locally for the inner loop, keep the existing pipeline, and move more over if it earns its place.

## Quick recap

- `azd` manages an application, where `az` manages resources.
- `azure.yaml` maps services to hosts, and hooks run scripts at lifecycle points.
- The `azd-service-name` tag is how azd finds where to deploy each service.
- Environments hold their own variables in `.azure/<name>/.env`, which stays git ignored.
- `azd deploy` alone skips provisioning and makes the development loop much faster.
- Template outputs become environment variables, so applications need no hard coded names.
- `azd pipeline config` sets up workload identity federation correctly in one command.

<code id="code-content" class="language-bash">
# az manages RESOURCES. azd manages AN APPLICATION ON AZURE: infrastructure,
# code, environments and pipeline, from one command.
azd auth login
azd init --template todo-csharp-sql   # or `azd init` in an existing repository
azd up                                # provision + build + deploy + print URLs
# azure.yaml AT THE REPOSITORY ROOT DRIVES EVERYTHING:
#   services:
#     api:
#       project: ./src/Shop.Api
#       language: csharp
#       host: containerapp        # or appservice, function, aks, staticwebapp
#   hooks:
#     postprovision: { run: ./scripts/seed-database.sh }
#     postdeploy:    { run: ./scripts/smoke-test.sh }
# HOOKS ARE WHAT MAKE azd USABLE FOR REAL PROJECTS. Seeding, migrations and
# smoke tests belong here rather than in a runbook.
# THE TAG THAT MAKES DEPLOYMENT AUTOMATIC. It must match the service key in
# azure.yaml, or azd deploy cannot find the target:
#   tags: union(tags, { 'azd-service-name': 'api' })
# ENVIRONMENTS each have their own subscription, region and variables, in
# .azure/&lt;name&gt;/.env. THAT DIRECTORY IS GIT IGNORED AND SHOULD STAY THAT WAY.
azd env new prod ; azd env select prod
azd env set DATABASE_SKU S1
azd env get-values &gt; .env      # for local development
# THE INDIVIDUAL COMMANDS:
azd provision       # infrastructure only
azd deploy api      # ONE service, no provisioning. The fast development loop.
azd down --purge    # delete everything, AND purge soft deleted Key Vaults
# --purge matters: purge protection means redeploying an environment with
# the same name fails on a soft deleted vault.
# TEMPLATE OUTPUTS BECOME ENVIRONMENT VARIABLES on the deployed services, so
# the application has NO HARD CODED RESOURCE NAMES:
#   output AZURE_KEY_VAULT_ENDPOINT string = keyVault.properties.vaultUri
#   ...then, in code: Environment.GetEnvironmentVariable("AZURE_KEY_VAULT_ENDPOINT")
# ONE COMMAND SETS UP WORKLOAD IDENTITY FEDERATION CORRECTLY: it creates the
# Entra ID application, configures the federated credential for the
# repository, sets variables and commits a workflow. Doing that by hand is
# several steps that are easy to get subtly wrong.
azd pipeline config              # or --provider azdo
azd monitor --live ; azd show    # endpoints and resources, without the portal
# WHERE IT FITS: one repository, one application, several environments.
# LESS GOOD for a shared platform estate with no single application, or
# infrastructure owned by another team on a different cadence.
# ADOPTION IS INCREMENTAL: the templates are ordinary Bicep, and azd
# provision and azd deploy work from ANY pipeline.
</code></pre>
