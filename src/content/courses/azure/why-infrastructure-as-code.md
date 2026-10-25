---
publishDate: 2026-10-18T10:30
title: Why Infrastructure as Code
slug: why-infrastructure-as-code
metadescription: Understand what infrastructure as code actually solves, and the ideas that apply whichever tool you choose.
updateDate: 2026-09-07T10:30
author: ['bishal-biswas']
level: 1
tags: ['iac', 'fundamentals', 'devops']
course: azure
---

## The problem it solves

Clicking through the portal works once. It does not answer these questions:

```text
What exactly is deployed in production?
Is staging the same as production?
Who changed that setting, and when, and why?
How do I rebuild this after a mistake?
How do I create an identical environment for a new customer?
```

Infrastructure as code answers all of them by making the deployment a file in a repository.

## What you gain

**A record.** The repository says what should exist. Not a wiki page written eight months ago and never updated.

**Repeatability.** The same template deploys dev, test and production, differing only by parameters. Environment drift stops being a mystery.

**Review.** A pull request shows exactly what will change, and someone else reads it before it happens.

**Rollback.** Revert the commit, redeploy. Not "does anyone remember what that setting was?"

**Recovery.** A deleted resource group is a redeploy rather than a week of archaeology.

## Declarative, not imperative

```bash
# imperative: a sequence of steps, and running it twice creates two things
az storage account create --name stshopprod --resource-group rg-shop-prod-uks --sku Standard_ZRS
```

```bicep
// declarative: a description of the end state
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'stshopprod'
  location: location
  sku: { name: 'Standard_ZRS' }
  kind: 'StorageV2'
}
```

The declarative file says what should exist. The engine works out whether to create, update or leave it alone.

That makes deployment **idempotent**: running it ten times gives the same result as running it once. Scripts do not have that property unless you write it in by hand, which is tedious and easy to get wrong.

## The tools

```text
Bicep       Azure native, readable, no state file, free. The default for Azure.
ARM JSON    what Bicep compiles to. Verbose. Rarely written by hand now.
Terraform   multi cloud, mature, large ecosystem, requires state management.
Pulumi      real programming languages. Useful when logic is genuinely complex.
azd         a wrapper around templates for application deployment.
```

**For Azure only work, Bicep.** It is the native language, it needs no state file, and new Azure features appear immediately rather than waiting for a provider release.

**For multi cloud, or an existing Terraform estate, Terraform.** Its module ecosystem is large and its behaviour is well understood.

Both are good. The wrong choice is arguing about it for three weeks and shipping neither.

## State, and Bicep not having one

Terraform keeps a state file mapping configuration to real resources. It is powerful and it is a thing to store, lock, secure and occasionally repair.

Bicep has no state file. It compares your template with what Azure Resource Manager reports and works out the difference. Less to manage, and slightly less control over things like planned deletions.

```bash
# Bicep: preview the change
az deployment group what-if --resource-group rg-shop-prod-uks --template-file main.bicep

# Terraform: the same idea, against state
terraform plan
```

Both give a preview before applying. Use it every time, especially in production.

## Parameterise the differences only

```bicep
@allowed(['dev', 'test', 'prod'])
param environment string

param location string = resourceGroup().location

var config = {
  dev:  { sku: 'B1', instances: 1, retentionDays: 7 }
  test: { sku: 'S1', instances: 1, retentionDays: 14 }
  prod: { sku: 'P1v3', instances: 3, retentionDays: 90 }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'plan-shop-${environment}'
  location: location
  sku: {
    name: config[environment].sku
    capacity: config[environment].instances
  }
}
```

The structure is identical across environments and only the size differs. That is what makes staging a meaningful test of production.

Resist parameterising everything. A template with forty parameters is harder to understand than one with six, and most of them will only ever hold one value.

## Do not mix approaches

The most common failure is deploying with a template and then changing things in the portal.

```text
The template no longer describes reality
The next deployment overwrites the manual change, or fails
Nobody trusts the repository
People stop using the template
```

Pick one. If infrastructure is managed as code, changes go through the code, including urgent ones. An emergency portal change is followed by updating the template the same day, not "when there is time".

Deployment stacks and Azure Policy can enforce this, and the discipline matters more than the tooling.

## What belongs in a template

```text
Yes    resource groups, networks, compute, databases, storage, role assignments,
       diagnostic settings, policy assignments, alerts
No     secret values, application data, anything that changes hourly
```

Secrets are referenced, not stored:

```bicep
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: 'kv-shop-prod'
  scope: resourceGroup('rg-shared')
}

module app 'app.bicep' = {
  name: 'app-deployment'
  params: {
    connectionString: keyVault.getSecret('shop-db-connection')
  }
}
```

`getSecret` retrieves the value during deployment without it appearing in the template, the parameter file or the deployment history.

## Structure that scales

```text
infra/
  main.bicep                  the entry point
  main.parameters.dev.json
  main.parameters.prod.json
  modules/
    network.bicep
    storage.bicep
    app-service.bicep
    monitoring.bicep
```

Modules are the unit of reuse. A network module used by four projects means one place to fix a mistake.

Start simple. One file is fine until it is not, and premature modularisation makes a small deployment hard to follow.

## Deploy from a pipeline

```yaml
- uses: azure/login@v2
  with:
    client-id: ${{ vars.AZURE_CLIENT_ID }}
    tenant-id: ${{ vars.AZURE_TENANT_ID }}
    subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

- run: |
    az deployment group what-if \
      --resource-group rg-shop-prod-uks \
      --template-file infra/main.bicep \
      --parameters infra/main.parameters.prod.json

- run: |
    az deployment group create \
      --resource-group rg-shop-prod-uks \
      --template-file infra/main.bicep \
      --parameters infra/main.parameters.prod.json
```

Deploying from a pipeline rather than a laptop means every change is recorded, reviewed and reproducible. The pipeline authenticates with workload identity federation, so no credential exists to leak.

Run `what-if` in the pull request. Reviewers then see the actual effect, not just the template diff.

## Where it gets hard

**Existing resources.** An estate built by hand takes real effort to bring under management. Start with new work, and adopt existing resources gradually.

**Ordering.** Most dependencies are inferred, and some must be declared. Role assignments on freshly created identities are the classic case.

**Things templates cannot do.** Some configuration has no Resource Manager surface. Deployment scripts fill the gap and are the least pleasant part of any template.

**Discipline.** The tooling is the easy part. Not clicking in the portal when something is urgent is the hard part.

## Quick recap

- Infrastructure as code answers what is deployed, what changed and how to rebuild it.
- Declarative templates are idempotent, so running them repeatedly is safe.
- Use Bicep for Azure only work and Terraform for multi cloud or an existing estate.
- Preview with `what-if` or `plan` before every production apply.
- Parameterise only what genuinely differs between environments.
- Never mix template deployment with portal changes, or nobody trusts the repository.
- Reference secrets with `getSecret` rather than putting values in files.

<code id="code-content" class="language-bicep">
// THE PROBLEM IT SOLVES. Clicking through the portal works once, and does
// not answer: what exactly is in production? Is staging the same? Who
// changed that, when and why? How do I rebuild after a mistake?
//
// IMPERATIVE is a sequence of steps, and running it twice creates two things:
//   az storage account create --name stshopprod --sku Standard_ZRS
// DECLARATIVE describes the END STATE, and the engine works out whether to
// create, update or leave alone. That makes it IDEMPOTENT: ten runs give
// the same result as one.
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'stshopprod'
  location: location
  sku: { name: 'Standard_ZRS' }
  kind: 'StorageV2'
}
//
// TOOLS: BICEP for Azure only (native, NO STATE FILE, new features appear
// immediately). TERRAFORM for multi cloud or an existing estate (mature,
// large ecosystem, a state file to store, lock, secure and sometimes
// repair). Both are good. The wrong choice is arguing for three weeks.
//
// PARAMETERISE ONLY WHAT GENUINELY DIFFERS. Identical structure across
// environments is what makes staging a meaningful test of production.
@allowed(['dev', 'test', 'prod'])
param environment string
//
var config = {
  dev:  { sku: 'B1',    instances: 1, retentionDays: 7 }
  prod: { sku: 'P1v3',  instances: 3, retentionDays: 90 }
}
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'plan-shop-${environment}'
  location: location
  sku: { name: config[environment].sku, capacity: config[environment].instances }
}
// Resist parameterising everything: forty parameters is harder to
// understand than six, and most will only ever hold one value.
//
// SECRETS ARE REFERENCED, NOT STORED. getSecret retrieves the value DURING
// DEPLOYMENT without it appearing in the template, the parameter file or
// the deployment history.
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: 'kv-shop-prod'
  scope: resourceGroup('rg-shared')
}
module app 'modules/app.bicep' = {
  name: 'app-deployment'
  params: { connectionString: keyVault.getSecret('shop-db-connection') }
}
//
// PREVIEW BEFORE EVERY PRODUCTION APPLY, and run it in the pull request so
// reviewers see the ACTUAL EFFECT, not just the template diff:
//   az deployment group what-if --resource-group rg-shop-prod-uks \
//     --template-file main.bicep --parameters main.parameters.prod.json
//   (terraform plan is the same idea, against state)
//
// THE MOST COMMON FAILURE: deploying with a template AND changing things
// in the portal. The template stops describing reality, the next
// deployment overwrites or fails, and NOBODY TRUSTS THE REPOSITORY.
// PICK ONE. An emergency portal change is followed by updating the
// template THE SAME DAY, not "when there is time".
//
// WHERE IT GETS HARD: adopting an estate built by hand; declaring the
// dependencies that are not inferred (role assignments on fresh identities
// are the classic); configuration with no Resource Manager surface; and
// DISCIPLINE, which is harder than any of the tooling.
</code></pre>
