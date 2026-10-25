---
publishDate: 2026-10-01T06:15
title: The Portal, Azure CLI and PowerShell
slug: portal-cli-and-powershell
metadescription: Choose between the portal, Azure CLI, Azure PowerShell and the Cloud Shell, and learn the query syntax that makes the CLI usable.
updateDate: 2026-09-07T06:15
author: ['bishal-biswas']
level: 1
tags: ['tooling', 'cli', 'powershell']
course: azure
---

## Four ways to talk to Azure

```text
Portal        a web UI. Best for exploring and one off investigation.
Azure CLI     cross platform, bash friendly. Best for scripts and CI.
Azure PowerShell  object oriented. Best if your team already lives in PowerShell.
Cloud Shell   either CLI in the browser, pre authenticated.
```

They all call the same Resource Manager API, so anything one can do the others can too. The choice is about which fits your habits and your pipeline.

## The portal

Good for learning what a service offers, reading diagnostics and doing something once.

Bad as a way of managing infrastructure. Changes made by hand are invisible to your templates, undocumented, and impossible to reproduce. The phrase for this is **click ops**, and it is how environments drift apart.

A reasonable position: use the portal to look, use code to change.

Two portal features worth knowing:

**Resource Graph Explorer** queries every resource across all your subscriptions at once. Far faster than clicking through blades.

**The JSON view** on any resource shows exactly what ARM sees, which is the quickest way to work out what a property is really called.

## Azure CLI

```bash
az login
az login --use-device-code          # for a machine with no browser
az login --service-principal --username APP_ID --password SECRET --tenant TENANT_ID

az account set --subscription "Production"
az configure --defaults group=rg-shop-dev-uks location=uksouth
```

Setting defaults removes a lot of repetition. After that, `az webapp create --name shop-api` needs no resource group or location.

The command structure is consistent: `az <group> <subgroup> <command>`.

```bash
az webapp list
az webapp create
az webapp deployment source config
az storage account keys list
```

When you cannot remember a command, the group name plus `--help` is quicker than searching.

```bash
az webapp --help
az webapp create --help
```

## Output formats

```bash
az group list --output table      # readable
az group list --output json       # the default, and what to parse
az group list --output tsv        # for shell variables, no quotes
az group list --output yaml
az group list --output jsonc      # coloured JSON
```

`tsv` is the one for scripting, because it emits bare values:

```bash
APP_ID=$(az webapp show --name shop-api --query id --output tsv)
```

Without `--output tsv` that variable would contain quotes.

## JMESPath queries

This is the skill that turns the CLI from tolerable into genuinely good. `--query` takes a JMESPath expression.

```bash
# one property
az webapp show --name shop-api --query defaultHostName --output tsv

# pick several, and rename them
az webapp list --query "[].{Name:name, State:state, Host:defaultHostName}" --output table

# filter
az vm list --query "[?powerState=='VM running'].name" --output tsv
az group list --query "[?tags.environment=='production'].name" --output tsv

# filter on a number, note the escaped backticks
az vm list-sizes --location uksouth \
  --query "[?numberOfCores>=\`4\` && memoryInMb>=\`8192\`].name" --output tsv

# sort and take
az vm list-sizes --location uksouth --query "sort_by([], &memoryInMb)[-5:].name"

# count
az webapp list --query "length([])"

# contains
az resource list --query "[?contains(name, 'shop')].{Name:name, Type:type}" --output table
```

Two things to remember: numbers need backticks, and string comparison uses single quotes.

## Azure PowerShell

```powershell
Connect-AzAccount
Set-AzContext -Subscription "Production"

Get-AzResourceGroup | Format-Table
New-AzResourceGroup -Name rg-shop-dev-uks -Location uksouth

Get-AzWebApp | Where-Object { $_.State -eq 'Running' } | Select-Object Name, DefaultHostName
```

The advantage is that everything is a real object, so filtering and formatting use PowerShell's own pipeline rather than a query language.

```powershell
$apps = Get-AzWebApp -ResourceGroupName rg-shop-prod-uks
$apps | Where-Object { $_.Kind -like '*linux*' } | ForEach-Object {
    Restart-AzWebApp -ResourceGroupName $_.ResourceGroup -Name $_.Name
}
```

If your team writes PowerShell already, this is the more comfortable tool. If not, the CLI has a gentler learning curve and better examples online.

Note the older `AzureRM` module is retired. Anything using `Get-AzureRmResourceGroup` is old and should be moved to `Az`.

## Cloud Shell

A browser terminal with both tools installed and already authenticated, backed by a storage account for persistence.

Useful when you are on someone else's machine, on a tablet, or want to run something without installing anything. It times out after inactivity and is not a place to run long jobs.

## Scripting sensibly

```bash
#!/usr/bin/env bash
set -euo pipefail

RESOURCE_GROUP="rg-shop-dev-uks"
LOCATION="uksouth"
APP_NAME="shop-api-$RANDOM"

az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

az appservice plan create \
  --name "plan-$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --sku B1 --is-linux \
  --output none

az webapp create \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --plan "plan-$APP_NAME" \
  --runtime "DOTNETCORE:9.0" \
  --output none

echo "https://$(az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --query defaultHostName --output tsv)"
```

`set -euo pipefail` is worth the habit: it stops the script on the first failure rather than continuing with a half built environment.

`--output none` keeps the log readable. `--no-wait` returns immediately for long operations, which is useful when creating several things in parallel.

## When to use what

```text
Exploring a new service          portal
One off investigation            portal or Resource Graph
Repeatable environment setup     Bicep or Terraform, not scripts
Glue and automation              CLI in bash, or PowerShell
CI/CD                            CLI, or the dedicated Azure actions and tasks
Bulk changes across resources     PowerShell or a CLI loop
```

The important distinction: **scripts are for actions, templates are for state.** Creating a resource group in a script is fine. Defining your whole environment in a 400 line bash script is a mistake that Bicep exists to fix.

## Quick recap

- The portal, CLI and PowerShell all call the same API, so pick by preference.
- Use the portal to look and code to change, or environments drift.
- `az configure --defaults` removes repetition from every command.
- `--output tsv` is the one for shell variables, since it emits bare values.
- Learn `--query` with JMESPath, and remember backticks for numbers.
- The `AzureRM` PowerShell module is retired, use `Az`.
- Scripts are for actions, templates are for state.

<code id="code-content" class="language-bash">
# Sign in, then stop repeating yourself
az login
az login --use-device-code                 # a machine with no browser
az account set --subscription "Production"
az configure --defaults group=rg-shop-dev-uks location=uksouth
# OUTPUT FORMATS. tsv is the one for shell variables: it emits BARE values,
# so no stray quotes end up in your string.
APP_HOST=$(az webapp show --name shop-api --query defaultHostName --output tsv)
az group list --output table                # readable
az group list --output json                 # the default, for parsing
# --query is the skill that makes the CLI genuinely good. It is JMESPath.
# Pick one property
az webapp show --name shop-api --query defaultHostName -o tsv
# Pick several and RENAME them for a table
az webapp list --query "[].{Name:name, State:state, Host:defaultHostName}" -o table
# Filter. String comparison uses SINGLE quotes.
az vm list --query "[?powerState=='VM running'].name" -o tsv
az group list --query "[?tags.environment=='production'].name" -o tsv
# Numbers need BACKTICKS, escaped in bash
az vm list-sizes --location uksouth \
  --query "[?numberOfCores&gt;=\`4\` &amp;&amp; memoryInMb&gt;=\`8192\`].name" -o tsv
# sort, slice, count, contains
az vm list-sizes --location uksouth --query "sort_by([], &amp;memoryInMb)[-5:].name"
az webapp list --query "length([])"
az resource list --query "[?contains(name,'shop')].{Name:name,Type:type}" -o table
# A sensible script. set -euo pipefail stops on the FIRST failure instead
# of continuing with a half built environment.
set -euo pipefail
RESOURCE_GROUP="rg-shop-dev-uks"
az group create --name "$RESOURCE_GROUP" --location uksouth --output none
az appservice plan create --name plan-shop --resource-group "$RESOURCE_GROUP" \
  --sku B1 --is-linux --output none
az webapp create --name shop-api-$RANDOM --resource-group "$RESOURCE_GROUP" \
  --plan plan-shop --runtime "DOTNETCORE:9.0" --output none
# --output none keeps logs readable, --no-wait returns immediately for
# long operations so you can start several at once.
# THE IMPORTANT DISTINCTION: scripts are for ACTIONS, templates are for
# STATE. A 400 line bash script defining your whole environment is the
# mistake Bicep exists to fix.
# PowerShell is the better tool if your team already writes it, because
# everything is a real object:
#   Get-AzWebApp | Where-Object { $_.State -eq 'Running' } | Select-Object Name
# The old AzureRM module is RETIRED. Get-AzureRmResourceGroup means old code.
</code></pre>
