---
publishDate: 2026-10-21T11:25
title: GitHub Actions for Azure
slug: github-actions-for-azure
metadescription: Deploy to Azure from GitHub Actions using workload identity federation, environments and reusable workflows.
updateDate: 2026-09-07T11:25
author: ['bishal-biswas']
level: 2
tags: ['devops', 'github actions', 'cicd']
course: azure
---

## Authenticate without a secret

This is the first thing to get right, and it removes an entire class of risk.

```bash
APP_ID=$(az ad app create --display-name "gh-shop-deploy" --query appId -o tsv)
az ad sp create --id "$APP_ID"
SP_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)

az role assignment create \
  --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
  --role Contributor \
  --scope /subscriptions/0000.../resourceGroups/rg-shop-prod-uks

az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-prod-environment",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:contoso/shop:environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
```

No `client-secret`. Nothing to rotate, nothing to leak.

**`permissions: id-token: write` is required.** Without it the workflow cannot request an OIDC token, and the login step fails with a message that does not obviously say so.

## The subject must match exactly

```text
repo:contoso/shop:ref:refs/heads/main          only the main branch
repo:contoso/shop:environment:production       only the production environment
repo:contoso/shop:pull_request                 pull requests
repo:contoso/shop:ref:refs/tags/v*             tags, with a wildcard credential
```

The subject is what pins the credential. A credential for `environment:production` cannot be used by a pull request from a fork, which is exactly the protection you want.

Create one credential per pattern you need. Being specific is the whole point.

## A complete workflow

```yaml
name: Deploy shop

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  id-token: write
  contents: read

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'

      - run: dotnet restore
      - run: dotnet build --no-restore --configuration Release
      - run: dotnet test --no-build --configuration Release --logger trx
      - run: dotnet publish ./src/Shop.Api -c Release -o ./publish

      - uses: actions/upload-artifact@v4
        with:
          name: app
          path: ./publish

  whatif:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    environment: production-plan
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      - name: Preview infrastructure changes
        run: |
          az deployment group what-if \
            --resource-group rg-shop-prod-uks \
            --template-file infra/main.bicep \
            --parameters infra/prod.bicepparam

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: app
          path: ./publish

      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy infrastructure
        run: |
          az deployment group create \
            --resource-group rg-shop-prod-uks \
            --template-file infra/main.bicep \
            --parameters infra/prod.bicepparam

      - name: Deploy to staging slot
        uses: azure/webapps-deploy@v3
        with:
          app-name: app-shop-prod
          slot-name: staging
          package: ./publish

      - name: Smoke test the slot
        run: |
          for i in $(seq 1 10); do
            code=$(curl -s -o /dev/null -w "%{http_code}" \
              https://app-shop-prod-staging.azurewebsites.net/healthz)
            if [ "$code" = "200" ]; then exit 0; fi
            sleep 10
          done
          echo "Staging slot never became healthy"
          exit 1

      - name: Swap into production
        run: |
          az webapp deployment slot swap \
            --name app-shop-prod --resource-group rg-shop-prod-uks \
            --slot staging --target-slot production
```

The shape that matters: build once, deploy the artefact, verify before swapping, and swap rather than deploy into production directly.

## Environments and approvals

```text
Settings > Environments > production
  Required reviewers      someone must approve before the job runs
  Wait timer              a delay before it starts
  Deployment branches     only main can deploy here
  Environment variables   per environment configuration
  Environment secrets     per environment secrets
```

Approvals are configured on the environment, not in the workflow. A job with `environment: production` waits for approval automatically, and the reviewer sees exactly what will run.

The deployment branch restriction is important. Without it, a workflow on any branch could target production.

## Reusable workflows

```yaml
# .github/workflows/deploy-template.yml
name: Reusable deploy

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      resourceGroup:
        required: true
        type: string
      appName:
        required: true
        type: string

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      - run: |
          az deployment group create \
            --resource-group ${{ inputs.resourceGroup }} \
            --template-file infra/main.bicep \
            --parameters infra/${{ inputs.environment }}.bicepparam
```

```yaml
jobs:
  dev:
    uses: ./.github/workflows/deploy-template.yml
    with:
      environment: dev
      resourceGroup: rg-shop-dev-uks
      appName: app-shop-dev

  prod:
    needs: dev
    uses: ./.github/workflows/deploy-template.yml
    with:
      environment: production
      resourceGroup: rg-shop-prod-uks
      appName: app-shop-prod
```

One deployment definition, several environments, promotion enforced by `needs`. Fixing a deployment problem happens once.

## Containers

```yaml
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      - name: Build and push
        run: |
          az acr login --name acrshop
          docker build -t acrshop.azurecr.io/shop-api:${{ github.sha }} .
          docker push acrshop.azurecr.io/shop-api:${{ github.sha }}

      - name: Deploy to Container Apps
        run: |
          az containerapp update \
            --name shop-api --resource-group rg-shop-prod-uks \
            --image acrshop.azurecr.io/shop-api:${{ github.sha }} \
            --revision-suffix ${{ github.run_number }}
```

`az acr login` after `azure/login` uses the federated identity, so no registry credential is needed. Tagging with the commit SHA means every deployment is traceable to exactly one commit.

## Practical details

```yaml
concurrency:
  group: deploy-production
  cancel-in-progress: false
```

Without this, two merges in quick succession deploy simultaneously and race. `cancel-in-progress: false` matters for deployment: cancelling a half finished deployment is worse than queuing.

```yaml
      - uses: actions/checkout@v4        # pin to a major version at minimum
      - uses: azure/login@v2
```

Pin actions. For anything security sensitive, pin to a commit SHA rather than a tag, since tags can be moved.

```yaml
      - name: Get secret for a later step
        run: |
          value=$(az keyvault secret show --vault-name kv-shop-prod \
            --name api-key --query value -o tsv)
          echo "::add-mask::$value"
          echo "API_KEY=$value" >> "$GITHUB_ENV"
```

`::add-mask::` before putting a secret into the environment, or it can appear in later log output.

## Quick recap

- Workload identity federation removes the stored secret entirely, and needs `id-token: write`.
- The federated credential subject pins access to a branch, environment or tag pattern.
- Build once and deploy the artefact, rather than rebuilding per environment.
- Deploy to a slot, verify it, then swap, so production is never mid deployment.
- Approvals and branch restrictions live on the GitHub environment, not in the workflow.
- Reusable workflows mean one deployment definition for every environment.
- Set `concurrency` with `cancel-in-progress: false`, since cancelling a deployment is worse than queuing.

<code id="code-content" class="language-yaml">
name: Deploy shop
on:
  push: { branches: [main] }
#
# REQUIRED FOR FEDERATED LOGIN. Without id-token: write the workflow cannot
# request an OIDC token, and azure/login fails with a message that does not
# obviously say so.
permissions:
  id-token: write
  contents: read
#
# Without this, two merges in quick succession deploy SIMULTANEOUSLY and
# race. cancel-in-progress: false because CANCELLING A HALF FINISHED
# DEPLOYMENT IS WORSE THAN QUEUING.
concurrency:
  group: deploy-production
  cancel-in-progress: false
#
jobs:
  deploy:
    runs-on: ubuntu-latest
    # APPROVALS AND BRANCH RESTRICTIONS LIVE ON THE GITHUB ENVIRONMENT, not
    # in this file. A job with `environment:` waits for approval
    # automatically, and the reviewer sees exactly what will run.
    environment: production
    steps:
      - uses: actions/checkout@v4      # pin actions; SHA for anything sensitive
#
      # NO client-secret. Nothing to rotate, nothing to leak. The federated
      # credential's SUBJECT pins this:
      #   repo:contoso/shop:environment:production
      #   repo:contoso/shop:ref:refs/heads/main
      # A credential for environment:production CANNOT be used by a pull
      # request from a fork, which is exactly the protection you want.
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
#
      - name: Deploy infrastructure
        run: |
          az deployment group create \
            --resource-group rg-shop-prod-uks \
            --template-file infra/main.bicep \
            --parameters infra/prod.bicepparam
#
      # DEPLOY TO A SLOT, VERIFY, THEN SWAP. Production is never mid
      # deployment, and rollback is another swap.
      - uses: azure/webapps-deploy@v3
        with:
          app-name: app-shop-prod
          slot-name: staging
          package: ./publish
#
      - name: Smoke test the slot before swapping
        run: |
          for i in $(seq 1 10); do
            code=$(curl -s -o /dev/null -w "%{http_code}" \
              https://app-shop-prod-staging.azurewebsites.net/healthz)
            if [ "$code" = "200" ]; then exit 0; fi
            sleep 10
          done
          echo "Staging slot never became healthy" &amp;&amp; exit 1
#
      - name: Swap into production
        run: |
          az webapp deployment slot swap --name app-shop-prod \
            --resource-group rg-shop-prod-uks --slot staging --target-slot production
#
      # az acr login AFTER azure/login uses the FEDERATED IDENTITY, so no
      # registry credential is needed. Tag with the SHA so every deployment
      # is traceable to exactly one commit.
      - name: Containers
        run: |
          az acr login --name acrshop
          docker build -t acrshop.azurecr.io/shop-api:${{ github.sha }} .
          docker push acrshop.azurecr.io/shop-api:${{ github.sha }}
#
      # ::add-mask:: BEFORE putting a secret into the environment, or it can
      # appear in later log output.
      - name: A secret for a later step
        run: |
          value=$(az keyvault secret show --vault-name kv-shop-prod \
            --name api-key --query value -o tsv)
          echo "::add-mask::$value"
          echo "API_KEY=$value" &gt;&gt; "$GITHUB_ENV"
#
# REUSABLE WORKFLOWS (on: workflow_call) give ONE deployment definition for
# every environment, with promotion enforced by `needs`. Fixing a
# deployment problem then happens ONCE.
</code></pre>
