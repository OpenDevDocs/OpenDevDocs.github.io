---
publishDate: 2026-10-18T10:35
title: 'ARM Templates: The Original Format'
slug: arm-templates
metadescription: Read and maintain ARM JSON templates, understand what Bicep compiles into, and know when you still need to work with them directly.
updateDate: 2026-09-07T10:35
author: ['bishal-biswas']
level: 2
tags: ['iac', 'arm', 'templates']
course: azure
---

## Why this still matters

Bicep is what you should write. ARM JSON is what it compiles to, and you will meet it anyway:

```text
Existing templates in older repositories
Exported templates from the portal
Azure Policy definitions, which are ARM JSON
Deployment error messages, which reference the compiled JSON
Marketplace and quickstart templates
```

Reading it fluently is worth an hour. Writing it by hand is rarely worth anything.

## The shape of a template

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environment": {
      "type": "string",
      "allowedValues": ["dev", "test", "prod"],
      "metadata": { "description": "Target environment" }
    },
    "location": {
      "type": "string",
      "defaultValue": "[resourceGroup().location]"
    }
  },
  "variables": {
    "storageName": "[concat('stshop', parameters('environment'))]",
    "skuByEnvironment": {
      "dev": "Standard_LRS",
      "test": "Standard_LRS",
      "prod": "Standard_ZRS"
    }
  },
  "resources": [
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2023-05-01",
      "name": "[variables('storageName')]",
      "location": "[parameters('location')]",
      "sku": {
        "name": "[variables('skuByEnvironment')[parameters('environment')]]"
      },
      "kind": "StorageV2",
      "properties": {
        "minimumTlsVersion": "TLS1_2",
        "allowBlobPublicAccess": false,
        "supportsHttpsTrafficOnly": true
      }
    }
  ],
  "outputs": {
    "storageId": {
      "type": "string",
      "value": "[resourceId('Microsoft.Storage/storageAccounts', variables('storageName'))]"
    }
  }
}
```

Six sections, and `resources` is where everything happens. The rest supports it.

## Expressions

Anything in square brackets is evaluated at deployment time.

```json
"[concat('stshop', parameters('environment'))]"
"[resourceGroup().location]"
"[resourceId('Microsoft.Storage/storageAccounts', 'stshopprod')]"
"[reference(resourceId('Microsoft.Web/sites', 'shop-api'), '2023-12-01').defaultHostName]"
"[if(equals(parameters('environment'), 'prod'), 3, 1)]"
"[uniqueString(resourceGroup().id)]"
```

The functions worth knowing:

```text
concat, format, toLower       string building
resourceId                    a full resource identifier
reference                     a property of another resource
listKeys, listSecrets         retrieve keys at deployment time
if, equals, and, or, not      conditionals
copyIndex                     the index in a loop
uniqueString                  a deterministic hash, for globally unique names
union, json                   object manipulation
```

Nesting these produces the expressions that make ARM JSON unpleasant to read, and it is exactly what Bicep exists to avoid:

```json
"[concat('https://', reference(resourceId('Microsoft.Web/sites', concat('shop-', parameters('environment'))), '2023-12-01').defaultHostName, '/api')]"
```

```bicep
// the same thing
'https://${site.properties.defaultHostName}/api'
```

## Dependencies

```json
{
  "type": "Microsoft.Web/sites",
  "apiVersion": "2023-12-01",
  "name": "shop-api",
  "dependsOn": [
    "[resourceId('Microsoft.Web/serverfarms', 'plan-shop')]"
  ],
  "properties": {
    "serverFarmId": "[resourceId('Microsoft.Web/serverfarms', 'plan-shop')]"
  }
}
```

ARM deploys resources in parallel unless told otherwise. `dependsOn` forces an order.

**Bicep infers most of these**, because referencing `plan.id` tells it the dependency exists. That alone removes a large class of intermittent deployment failures caused by a missing `dependsOn`.

## Loops

```json
{
  "copy": {
    "name": "storageLoop",
    "count": "[length(parameters('storageNames'))]"
  },
  "type": "Microsoft.Storage/storageAccounts",
  "apiVersion": "2023-05-01",
  "name": "[parameters('storageNames')[copyIndex()]]",
  "location": "[parameters('location')]",
  "sku": { "name": "Standard_LRS" },
  "kind": "StorageV2"
}
```

```bicep
// Bicep
resource accounts 'Microsoft.Storage/storageAccounts@2023-05-01' = [for name in storageNames: {
  name: name
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
}]
```

The `copy` element also works inside properties, for repeating a block of configuration rather than a whole resource.

## Conditions

```json
{
  "condition": "[equals(parameters('environment'), 'prod')]",
  "type": "Microsoft.Insights/components",
  "apiVersion": "2020-02-02",
  "name": "appi-shop-prod"
}
```

A resource with a false condition is skipped. Anything referencing it must handle its absence, which is a common source of confusing errors.

## Nested and linked templates

```json
{
  "type": "Microsoft.Resources/deployments",
  "apiVersion": "2022-09-01",
  "name": "network-deployment",
  "properties": {
    "mode": "Incremental",
    "templateLink": {
      "uri": "https://raw.githubusercontent.com/contoso/infra/main/network.json",
      "contentVersion": "1.0.0.0"
    },
    "parameters": {
      "addressSpace": { "value": "10.20.0.0/16" }
    }
  }
}
```

Linked templates require a publicly reachable URI, which usually means a storage account with a SAS token, and that is genuinely awkward.

**Bicep modules compile into nested templates with the content inline**, so there is nothing to host. This is one of the larger practical improvements Bicep brought.

## Deployment modes

```bash
az deployment group create \
  --resource-group rg-shop-prod-uks \
  --template-file main.json --parameters @main.parameters.json \
  --mode Incremental
```

```text
Incremental  the default. Adds and updates, LEAVES anything not in the template.
Complete     DELETES resources in the group that are not in the template.
```

**Complete mode deletes things.** It is a legitimate way to guarantee the group matches the template, and it has removed production resources for people who did not read carefully.

Always run `what-if` first, and read the deletions section.

```bash
az deployment group what-if \
  --resource-group rg-shop-prod-uks \
  --template-file main.json --parameters @main.parameters.json \
  --mode Complete
```

## Working between the two

```bash
# JSON to Bicep, for adopting an existing template
az bicep decompile --file main.json

# Bicep to JSON, to see what is actually deployed
az bicep build --file main.bicep

# export what already exists, as a starting point
az group export --name rg-shop-prod-uks > exported.json
```

Decompilation is a good starting point and not a finished result. It produces valid Bicep that usually needs tidying, since generated names and structures follow the JSON rather than good Bicep style.

Exported templates are worse: they include runtime properties, hard coded identifiers and settings you did not set. Treat them as documentation of what exists, not as a template to deploy.

## Where ARM JSON is still required

```text
Azure Policy definitions and initiatives
Some marketplace and partner templates
Deployment error messages, which reference compiled line numbers
Template specs, though these can be built from Bicep
```

Policy definitions in particular are ARM JSON with their own expression language, so this knowledge transfers directly.

## Quick recap

- Write Bicep, and read ARM JSON, because you will meet it in policies, exports and error messages.
- Everything in square brackets is a deployment time expression.
- ARM deploys in parallel, and Bicep infers most dependencies that JSON needs stated.
- `copy` gives loops, and `condition` skips a resource entirely.
- Linked templates need a hosted URI, while Bicep modules inline the content.
- Complete mode deletes resources not in the template, so always run `what-if` first.
- Decompiled and exported templates are starting points, not finished work.

<code id="code-content" class="language-json">
{
  "COMMENT": "WRITE BICEP. READ ARM JSON, because you will meet it: existing repositories, portal exports, AZURE POLICY DEFINITIONS, marketplace templates, and deployment error messages that reference the compiled JSON.",
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environment": { "type": "string", "allowedValues": ["dev", "test", "prod"] },
    "location": { "type": "string", "defaultValue": "[resourceGroup().location]" }
  },
  "COMMENT_expressions": "ANYTHING IN SQUARE BRACKETS IS EVALUATED AT DEPLOYMENT TIME. concat, resourceId, reference, listKeys, if, copyIndex, uniqueString, union.",
  "variables": {
    "storageName": "[concat('stshop', parameters('environment'))]",
    "skuByEnvironment": { "dev": "Standard_LRS", "prod": "Standard_ZRS" }
  },
  "resources": [
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2023-05-01",
      "name": "[variables('storageName')]",
      "sku": { "name": "[variables('skuByEnvironment')[parameters('environment')]]" },
      "kind": "StorageV2",
      "COMMENT_condition": "A resource with a FALSE condition is SKIPPED. Anything referencing it must handle its absence.",
      "condition": "[equals(parameters('environment'), 'prod')]",
      "COMMENT_copy": "copy is the loop. It also works INSIDE properties, to repeat a block rather than a whole resource.",
      "copy": { "name": "storageLoop", "count": "[length(parameters('names'))]" }
    },
    {
      "type": "Microsoft.Web/sites",
      "apiVersion": "2023-12-01",
      "name": "shop-api",
      "COMMENT_dependsOn": "ARM DEPLOYS IN PARALLEL unless told otherwise. BICEP INFERS MOST OF THESE from references like plan.id, which removes a whole class of intermittent failures caused by a missing dependsOn.",
      "dependsOn": ["[resourceId('Microsoft.Web/serverfarms', 'plan-shop')]"]
    }
  ],
  "NOTES": [
    "NESTED EXPRESSIONS ARE WHY BICEP EXISTS. This, in ARM JSON:",
    "  [concat('https://', reference(resourceId('Microsoft.Web/sites', 'shop-api'), '2023-12-01').defaultHostName, '/api')]",
    "is just this, in Bicep:  'https://${site.properties.defaultHostName}/api'",
    "LINKED TEMPLATES need a PUBLICLY REACHABLE URI, usually a storage account with a SAS token, which is genuinely awkward. BICEP MODULES COMPILE TO NESTED TEMPLATES WITH THE CONTENT INLINE, so there is nothing to host.",
    "DEPLOYMENT MODES. Incremental (default) adds and updates and LEAVES anything not in the template. COMPLETE DELETES RESOURCES IN THE GROUP THAT ARE NOT IN THE TEMPLATE, and it has removed production resources for people who did not read carefully. ALWAYS RUN what-if FIRST AND READ THE DELETIONS SECTION.",
    "MOVING BETWEEN THEM:",
    "  az bicep decompile --file main.json    JSON -&gt; Bicep, a STARTING POINT",
    "  az bicep build --file main.bicep       see what is actually deployed",
    "  az group export --name rg-...          WORSE: includes runtime properties and hard coded ids. Documentation, not a template.",
    "STILL REQUIRED AS JSON: Azure Policy definitions and initiatives, which use the same expression language, so this knowledge transfers directly."
  ]
}
</code></pre>
