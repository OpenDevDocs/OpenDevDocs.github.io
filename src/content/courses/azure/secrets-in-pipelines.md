---
publishDate: 2026-10-23T11:55
title: Handling Secrets in Pipelines
slug: secrets-in-pipelines
metadescription: Handle secrets in CI/CD without leaking them, using federation, Key Vault, masking and scanning.
updateDate: 2026-09-07T11:55
author: ['bishal-biswas']
level: 3
tags: ['devops', 'security', 'secrets']
course: azure
---

## The best secret is no secret

Before storing anything, check whether it is needed at all.

```text
Deploying to Azure         workload identity federation. No secret.
Pulling from a registry    the pipeline's federated identity. No secret.
Reading a database         a managed identity on the deployed app. No secret.
Calling a partner API      a secret, and it belongs in Key Vault.
Signing a package          a certificate in Key Vault, or a signing service.
```

Most pipeline secrets exist because federation was not set up, not because a secret is genuinely required.

## Pipeline secrets, done properly

```bash
gh secret set STRIPE_KEY --env production --body "$VALUE"
gh variable set AZURE_CLIENT_ID --body "$CLIENT_ID"
```

```text
Secrets   masked in logs, write only once set, scoped to repo or environment
Variables identifiers and configuration. Not masked, and that is fine.
```

A client ID, tenant ID and subscription ID are **identifiers, not secrets**. Storing them as secrets makes logs harder to read for no benefit.

**Environment scoped secrets are stronger than repository secrets**, because a job must reach that environment, and therefore pass its approvals and branch restrictions, to use them.

## Pulling from Key Vault

Better than storing values in the pipeline at all.

```yaml
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      - name: Fetch secrets
        run: |
          value=$(az keyvault secret show \
            --vault-name kv-shop-prod --name stripe-key \
            --query value -o tsv)
          echo "::add-mask::$value"
          echo "STRIPE_KEY=$value" >> "$GITHUB_ENV"
```

```yaml
# Azure Pipelines
      - task: AzureKeyVault@2
        inputs:
          azureSubscription: sc-shop-prod
          KeyVaultName: kv-shop-prod
          SecretsFilter: 'stripe-key,partner-token'
          RunAsPreJob: true
```

One place holds the secret, with proper access control, rotation and an audit trail. The pipeline reads it at run time and never stores it.

**`::add-mask::` before putting a value into the environment.** Without it, GitHub masks only secrets it already knows about, and a value fetched at run time appears in later logs.

## Never echo, and what still leaks

```yaml
      # obviously wrong
      - run: echo "Key is $STRIPE_KEY"

      # also leaks, and is less obvious
      - run: curl -v -H "Authorization: Bearer $TOKEN" https://api.example.com
      - run: set -x; ./deploy.sh
      - run: cat appsettings.Production.json
      - run: env
```

`curl -v` prints request headers. `set -x` prints every command with its arguments expanded. Both leak secrets into logs that people can read, and both are common in debugging steps that were never removed.

```yaml
      - run: |
          set +x
          curl -sS -H "Authorization: Bearer $TOKEN" https://api.example.com/deploy
```

Masking helps and is not complete. A secret split across lines, base64 encoded, or included in an error message from a tool may not be masked.

## Secrets in build artefacts

```bash
# do not do this
dotnet publish -c Release /p:ApiKey="$STRIPE_KEY"
docker build --build-arg API_KEY="$STRIPE_KEY" -t app .
```

A Docker build argument is **visible in the image history** to anyone who pulls the image.

```bash
docker history app --no-trunc | grep -i key
```

If a build genuinely needs a secret, use BuildKit secret mounts, which do not persist:

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=nuget_token \
    dotnet restore --source "https://nuget.pkg.github.com/contoso/index.json"
```

```bash
docker build --secret id=nuget_token,env=NUGET_TOKEN -t app .
```

Better still, inject configuration at run time rather than build time. A container image should be identical across environments.

## Fork pull requests

```text
A pull request from a fork does NOT receive repository secrets, by design.
pull_request_target DOES have secrets, and runs the BASE repository's workflow.
```

`pull_request_target` is dangerous when used carelessly. Checking out the pull request head and running its code gives an attacker your secrets.

```yaml
# dangerous: runs untrusted code with secrets available
on: pull_request_target
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}   # attacker's code
      - run: npm install && npm run build                  # with your secrets
```

If you need secrets for a fork pull request, use an environment with required reviewers so a person approves before the job runs.

## Scanning

```bash
gh api repos/contoso/shop/secret-scanning/alerts --jq '.[] | {secret_type, state, html_url}'
```

```text
Secret scanning        finds committed secrets, and partners revoke them automatically
Push protection        BLOCKS the push before the secret enters history
```

Push protection is the valuable one. Once a secret is in git history, removing it means rewriting history and rotating the secret anyway, so preventing the commit is worth far more than detecting it.

```yaml
      - name: Scan for secrets
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Scan in the pipeline as well, since not every secret format is recognised by the platform scanner.

## When a secret leaks

```text
1. Rotate it. Immediately. Before anything else.
2. Check whether it was used, in the target system's logs.
3. Remove it from history if practical, and accept that it was public.
4. Work out how it got there.
5. Add the control that would have prevented it.
```

**Rotation comes first.** Removing a secret from git history without rotating achieves nothing, because anyone who cloned the repository still has it.

```bash
az keyvault secret set --vault-name kv-shop-prod --name stripe-key --value "$NEW_VALUE"
az ad app credential reset --id "$APP_ID" --years 1
az storage account keys renew --account-name stshopprod --key key1
```

## Rotating without downtime

```text
1. Create the new credential alongside the old one
2. Update Key Vault with the new value
3. Restart or redeploy consumers so they pick it up
4. Confirm nothing is still using the old one
5. Delete the old credential
```

Both credentials being valid during the transition is what makes rotation possible without a maintenance window. Storage accounts have two keys precisely for this.

```bash
# check nothing is still using the old key before deleting it
az monitor diagnostic-settings list --resource /subscriptions/.../storageAccounts/stshopprod
```

## Secrets that reach the application

```bicep
resource site 'Microsoft.Web/sites@2023-12-01' = {
  properties: {
    siteConfig: {
      appSettings: [
        {
          name: 'StripeKey'
          value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/stripe-key/)'
        }
      ]
    }
  }
}
```

The pipeline never sees this value. It deploys a reference, and App Service resolves it at run time using the app's managed identity.

That is the target state: the pipeline deploys infrastructure and code, and the application fetches its own secrets.

## A checklist

```text
Federation for Azure, so no deployment credential exists
Key Vault for everything else, read at run time
Environment scoped rather than repository scoped
::add-mask:: on anything fetched during a run
No secrets in build arguments or images
Push protection enabled
Scanning in the pipeline as well
A rotation runbook that has actually been used
Applications resolving their own secrets, not receiving them from the pipeline
```

## Quick recap

- Most pipeline secrets exist because federation was not set up, not because one is needed.
- Client, tenant and subscription IDs are identifiers, so use variables rather than secrets.
- Environment scoped secrets require passing that environment's approvals to use.
- Call `::add-mask::` on anything fetched at run time, or it appears in later logs.
- `curl -v` and `set -x` leak secrets into logs, and are common in forgotten debug steps.
- Docker build arguments persist in image history, so use BuildKit secret mounts.
- On a leak, rotate first, since removing it from history alone achieves nothing.

<code id="code-content" class="language-yaml">
# THE BEST SECRET IS NO SECRET. Most pipeline secrets exist because
# federation was not set up, not because one is genuinely required.
#   deploying to Azure     -&gt; workload identity federation. NONE.
#   pulling from a registry -&gt; the pipeline's federated identity. NONE.
#   reading a database     -&gt; a managed identity on the app. NONE.
#   a partner API          -&gt; a secret, and it belongs in KEY VAULT.
#
# A client ID, tenant ID and subscription ID are IDENTIFIERS. Storing them
# as secrets makes logs harder to read for no benefit.
#   ${{ vars.AZURE_CLIENT_ID }}      not secrets.AZURE_CLIENT_ID
# ENVIRONMENT SCOPED SECRETS ARE STRONGER than repository secrets: a job
# must reach that environment, passing its approvals, to use them.
#
steps:
  - uses: azure/login@v2
    with:
      client-id: ${{ vars.AZURE_CLIENT_ID }}
      tenant-id: ${{ vars.AZURE_TENANT_ID }}
#
  - name: Fetch at run time from Key Vault
    run: |
      value=$(az keyvault secret show --vault-name kv-shop-prod \
        --name stripe-key --query value -o tsv)
      # ::add-mask:: BEFORE putting it anywhere. GitHub masks only secrets
      # it ALREADY KNOWS, so a value fetched during the run appears in
      # later logs without this.
      echo "::add-mask::$value"
      echo "STRIPE_KEY=$value" &gt;&gt; "$GITHUB_ENV"
#
  # THESE LEAK, AND ARE LESS OBVIOUS THAN echo. Both are common in
  # debugging steps nobody removed:
  #   curl -v      prints request HEADERS, including Authorization
  #   set -x       prints every command with arguments EXPANDED
  - run: |
      set +x
      curl -sS -H "Authorization: Bearer $TOKEN" https://api.example.com/deploy
#
# DOCKER BUILD ARGS PERSIST IN IMAGE HISTORY, visible to anyone who pulls:
#   docker history app --no-trunc | grep -i key
# If a build genuinely needs one, BuildKit secret mounts do not persist:
#   RUN --mount=type=secret,id=nuget_token dotnet restore ...
#   docker build --secret id=nuget_token,env=NUGET_TOKEN -t app .
# Better: inject configuration at RUN TIME. An image should be identical
# across environments.
#
# FORK PULL REQUESTS DO NOT GET SECRETS, BY DESIGN. pull_request_target DOES,
# and runs the BASE workflow. Checking out the PR head there runs UNTRUSTED
# CODE WITH YOUR SECRETS. If a fork PR genuinely needs them, use an
# environment with REQUIRED REVIEWERS.
#
# PUSH PROTECTION IS THE VALUABLE CONTROL. Once a secret is in git history,
# removing it means rewriting history AND rotating anyway, so blocking the
# push is worth far more than detecting it afterwards.
  - uses: gitleaks/gitleaks-action@v2      # platform scanners miss some formats
#
# WHEN A SECRET LEAKS: ROTATE FIRST, before anything else. Removing it from
# history achieves NOTHING, because anyone who cloned still has it. Then
# check the target system's logs for use, then fix how it got there.
#   az keyvault secret set --vault-name kv-shop-prod --name stripe-key --value "$NEW"
#   az ad app credential reset --id "$APP_ID" --years 1
# ROTATE WITHOUT DOWNTIME by having BOTH valid during the transition. That
# is why storage accounts have two keys.
#
# THE TARGET STATE: the pipeline NEVER SEES THE VALUE. It deploys a
# reference, and the app resolves it with its own managed identity:
#   value: '@Microsoft.KeyVault(SecretUri=${vault.properties.vaultUri}secrets/stripe-key/)'
</code></pre>
