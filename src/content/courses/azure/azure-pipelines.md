---
publishDate: 2026-10-21T11:30
title: Azure Pipelines
slug: azure-pipelines
metadescription: Build and deploy to Azure with Azure Pipelines, using stages, templates and service connections that use no stored secret.
updateDate: 2026-09-07T11:30
author: ['bishal-biswas']
level: 2
tags: ['devops', 'azure pipelines', 'cicd']
course: azure
---

## Service connections

The pipeline's identity. Create it with workload identity federation, not a secret.

```text
Project settings > Service connections > New > Azure Resource Manager
  > Workload Identity federation (automatic)
```

The automatic option creates the Entra ID application, the federated credential and the role assignment in one step. The manual option exists for when you need to control the application yourself.

**A service connection with a client secret expires**, usually at the least convenient moment. Federation has nothing to expire.

Scope it to a resource group rather than a subscription, and use a different connection per environment so a development pipeline cannot reach production.

## Pipeline structure

```yaml
trigger:
  branches:
    include: [main]
  paths:
    exclude: [docs/*, README.md]

pr:
  branches:
    include: [main]

variables:
  - name: buildConfiguration
    value: Release
  - group: shop-common          # a variable group from the library

stages:
  - stage: Build
    jobs:
      - job: BuildAndTest
        pool:
          vmImage: ubuntu-latest
        steps:
          - task: UseDotNet@2
            inputs:
              version: '8.0.x'

          - script: dotnet restore
            displayName: Restore

          - script: dotnet build --no-restore -c $(buildConfiguration)
            displayName: Build

          - script: dotnet test --no-build -c $(buildConfiguration) --logger trx --collect:"XPlat Code Coverage"
            displayName: Test

          - task: PublishTestResults@2
            condition: succeededOrFailed()
            inputs:
              testResultsFormat: VSTest
              testResultsFiles: '**/*.trx'

          - script: dotnet publish ./src/Shop.Api -c $(buildConfiguration) -o $(Build.ArtifactStagingDirectory)
            displayName: Publish

          - publish: $(Build.ArtifactStagingDirectory)
            artifact: app

  - stage: DeployDev
    dependsOn: Build
    condition: succeeded()
    jobs:
      - deployment: Dev
        environment: shop-dev
        pool:
          vmImage: ubuntu-latest
        strategy:
          runOnce:
            deploy:
              steps:
                - download: current
                  artifact: app

                - task: AzureCLI@2
                  displayName: Deploy infrastructure
                  inputs:
                    azureSubscription: sc-shop-dev
                    scriptType: bash
                    scriptLocation: inlineScript
                    inlineScript: |
                      az deployment group create \
                        --resource-group rg-shop-dev-uks \
                        --template-file $(Pipeline.Workspace)/s/infra/main.bicep \
                        --parameters $(Pipeline.Workspace)/s/infra/dev.bicepparam

                - task: AzureWebApp@1
                  inputs:
                    azureSubscription: sc-shop-dev
                    appName: app-shop-dev
                    package: $(Pipeline.Workspace)/app

  - stage: DeployProd
    dependsOn: DeployDev
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: Prod
        environment: shop-production
        pool:
          vmImage: ubuntu-latest
        strategy:
          runOnce:
            deploy:
              steps:
                - download: current
                  artifact: app

                - task: AzureWebApp@1
                  inputs:
                    azureSubscription: sc-shop-prod
                    appName: app-shop-prod
                    deployToSlotOrASE: true
                    slotName: staging
                    package: $(Pipeline.Workspace)/app

                - task: AzureCLI@2
                  displayName: Swap slots
                  inputs:
                    azureSubscription: sc-shop-prod
                    scriptType: bash
                    scriptLocation: inlineScript
                    inlineScript: |
                      az webapp deployment slot swap \
                        --name app-shop-prod --resource-group rg-shop-prod-uks \
                        --slot staging --target-slot production
```

## Deployment jobs and environments

```yaml
      - deployment: Prod
        environment: shop-production
```

A `deployment` job is different from a `job`. It records deployment history against an environment, supports deployment strategies, and is where approvals attach.

```text
Environments in Azure DevOps hold
  approval checks
  branch control
  business hours restrictions
  Azure Resource Manager checks, like requiring specific tags
  exclusive lock, so two deployments cannot run at once
```

Approvals are configured on the environment, which means the pipeline file cannot bypass them. That separation is deliberate.

## Deployment strategies

```yaml
        strategy:
          runOnce:
            preDeploy:
              steps: [ ]
            deploy:
              steps: [ ]
            routeTraffic:
              steps: [ ]
            postRouteTraffic:
              steps: [ ]
            on:
              failure:
                steps: [ ]
              success:
                steps: [ ]
```

```text
runOnce   the usual one
rolling   update a percentage of targets at a time
canary    route a share of traffic, verify, increase
```

The `on: failure` hook is worth using. A failed deployment that automatically swaps back or raises an alert is much better than one that stops halfway and waits for someone to notice.

## Templates

```yaml
# templates/deploy.yml
parameters:
  - name: environment
    type: string
  - name: serviceConnection
    type: string
  - name: resourceGroup
    type: string
  - name: appName
    type: string
  - name: useSlot
    type: boolean
    default: false

jobs:
  - deployment: Deploy${{ parameters.environment }}
    environment: shop-${{ parameters.environment }}
    pool:
      vmImage: ubuntu-latest
    strategy:
      runOnce:
        deploy:
          steps:
            - download: current
              artifact: app

            - task: AzureCLI@2
              inputs:
                azureSubscription: ${{ parameters.serviceConnection }}
                scriptType: bash
                scriptLocation: inlineScript
                inlineScript: |
                  az deployment group create \
                    --resource-group ${{ parameters.resourceGroup }} \
                    --template-file infra/main.bicep \
                    --parameters infra/${{ parameters.environment }}.bicepparam

            - task: AzureWebApp@1
              inputs:
                azureSubscription: ${{ parameters.serviceConnection }}
                appName: ${{ parameters.appName }}
                deployToSlotOrASE: ${{ parameters.useSlot }}
                slotName: staging
                package: $(Pipeline.Workspace)/app
```

```yaml
stages:
  - stage: DeployDev
    jobs:
      - template: templates/deploy.yml
        parameters:
          environment: dev
          serviceConnection: sc-shop-dev
          resourceGroup: rg-shop-dev-uks
          appName: app-shop-dev

  - stage: DeployProd
    dependsOn: DeployDev
    jobs:
      - template: templates/deploy.yml
        parameters:
          environment: production
          serviceConnection: sc-shop-prod
          resourceGroup: rg-shop-prod-uks
          appName: app-shop-prod
          useSlot: true
```

**Note `${{ }}` against `$( )`.** Template expressions with `${{ }}` are evaluated at compile time, before the pipeline runs, so they can control structure. Runtime variables with `$( )` are evaluated during execution and cannot.

That distinction confuses everyone once, and it explains why a parameter works in some positions and not others.

## Variables and secrets

```yaml
variables:
  - group: shop-production        # a variable group, optionally Key Vault linked
  - name: buildConfiguration
    value: Release
```

```yaml
      - task: AzureKeyVault@2
        inputs:
          azureSubscription: sc-shop-prod
          KeyVaultName: kv-shop-prod
          SecretsFilter: 'stripe-key,connection-string'
          RunAsPreJob: true
```

Linking a variable group to Key Vault, or using the Key Vault task, means secrets live in one place with proper access control and rotation, rather than being typed into pipeline variables.

Secret variables are masked in logs automatically, and they are not passed to scripts as environment variables unless mapped explicitly:

```yaml
      - script: ./deploy.sh
        env:
          STRIPE_KEY: $(stripe-key)
```

That explicit mapping is deliberate. It stops every script seeing every secret.

## Multi repository checkout

```yaml
resources:
  repositories:
    - repository: templates
      type: git
      name: platform/pipeline-templates
      ref: refs/tags/v2.1.0

stages:
  - template: azure/webapp-deploy.yml@templates
    parameters:
      environment: production
```

A platform team publishes templates in one repository, and every project references them at a pinned tag. Improving the deployment process improves it everywhere, and pinning means it does not change under teams without warning.

## Approval and other checks

```text
On the environment or service connection:
  Approvals            a person must approve
  Branch control       only from named branches
  Business hours       deploy only during a window
  Required template    the pipeline must extend an approved template
  Evaluate artifact    policy checks on container images
  Exclusive lock       only one deployment at a time
```

**Required template** is the strong one for regulated environments. It means a pipeline cannot deploy to that environment unless it extends a template the platform team controls, which is enforced governance rather than a convention.

## Self hosted agents

```yaml
pool:
  name: shop-private-agents
  demands:
    - agent.os -equals Linux
```

Microsoft hosted agents cannot reach a private endpoint. For deploying into a locked down network you need either a self hosted agent inside the virtual network, or a managed DevOps pool.

That is the usual reason a pipeline that works for public resources fails once private endpoints are enabled.

## Azure Pipelines or GitHub Actions

```text
Azure Pipelines  richer approval and check model, environments, self hosted
                 agent management, better for regulated and complex estates
GitHub Actions   simpler, larger marketplace, tighter integration with the
                 repository, better where the code already lives in GitHub
```

Both deploy to Azure equally well. Where the code lives usually decides it, and running both for different projects is common and fine.

## Quick recap

- Use workload identity federation for service connections, since a secret based one expires.
- A `deployment` job records history against an environment and is where approvals attach.
- Approvals live on the environment, so the pipeline file cannot bypass them.
- `${{ }}` is compile time and can control structure, `$( )` is runtime and cannot.
- Secrets must be mapped explicitly into scripts, which stops every script seeing everything.
- Reference templates from a platform repository at a pinned tag.
- Microsoft hosted agents cannot reach private endpoints, so a self hosted agent is needed.

<code id="code-content" class="language-yaml">
trigger:
  branches: { include: [main] }
  paths:    { exclude: [docs/*, README.md] }
#
stages:
  - stage: Build
    jobs:
      - job: BuildAndTest
        pool: { vmImage: ubuntu-latest }
        steps:
          - script: dotnet test --no-build -c Release --logger trx
          - publish: $(Build.ArtifactStagingDirectory)
            artifact: app        # BUILD ONCE, deploy the same artefact
#
  - stage: DeployProd
    dependsOn: Build
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      # A `deployment` JOB IS DIFFERENT FROM A `job`: it records history
      # against an environment, supports strategies, and IS WHERE APPROVALS
      # ATTACH. Approvals live ON THE ENVIRONMENT, so this file cannot
      # bypass them. That separation is deliberate.
      - deployment: Prod
        environment: shop-production
        pool: { vmImage: ubuntu-latest }
        strategy:
          runOnce:
            deploy:
              steps:
                - download: current
                  artifact: app
#
                # THE SERVICE CONNECTION IS THE PIPELINE'S IDENTITY. Create
                # it with WORKLOAD IDENTITY FEDERATION: a secret based one
                # EXPIRES, always at the least convenient moment. Scope it
                # to a RESOURCE GROUP, and use a different connection per
                # environment so dev cannot reach production.
                - task: AzureCLI@2
                  inputs:
                    azureSubscription: sc-shop-prod
                    scriptType: bash
                    scriptLocation: inlineScript
                    inlineScript: |
                      az deployment group create \
                        --resource-group rg-shop-prod-uks \
                        --template-file infra/main.bicep \
                        --parameters infra/prod.bicepparam
#
                - task: AzureWebApp@1
                  inputs:
                    azureSubscription: sc-shop-prod
                    appName: app-shop-prod
                    deployToSlotOrASE: true
                    slotName: staging
                    package: $(Pipeline.Workspace)/app
#
# ${{ }} IS COMPILE TIME, evaluated BEFORE the pipeline runs, so it can
# control STRUCTURE. $( ) IS RUNTIME and cannot. That distinction confuses
# everyone once, and explains why a parameter works in some positions only.
#   - template: templates/deploy.yml
#     parameters: { environment: production, serviceConnection: sc-shop-prod }
#
# SECRETS: link a variable group to Key Vault, or use the AzureKeyVault
# task, so they live in one place with access control and rotation.
# THEY ARE NOT PASSED TO SCRIPTS UNLESS MAPPED EXPLICITLY, which stops
# every script seeing every secret:
#   - script: ./deploy.sh
#     env: { STRIPE_KEY: $(stripe-key) }
#
# A PLATFORM TEAM'S TEMPLATES, PINNED TO A TAG so they cannot change under
# teams without warning:
#   resources:
#     repositories:
#       - repository: templates
#         type: git
#         name: platform/pipeline-templates
#         ref: refs/tags/v2.1.0
#
# CHECKS on an environment or service connection: approvals, branch
# control, business hours, exclusive lock, and REQUIRED TEMPLATE, which
# means a pipeline CANNOT deploy unless it extends a template the platform
# team controls. That is enforced governance, not a convention.
#
# MICROSOFT HOSTED AGENTS CANNOT REACH A PRIVATE ENDPOINT. That is the
# usual reason a pipeline stops working once private endpoints are enabled.
#   pool: { name: shop-private-agents }
</code></pre>
