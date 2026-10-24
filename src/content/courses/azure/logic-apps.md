---
publishDate: 2026-10-17T10:20
title: Logic Apps
slug: logic-apps
metadescription: Automate workflows and integrate systems with Azure Logic Apps, choosing between the Consumption and Standard models.
updateDate: 2026-09-07T10:20
author: ['bishal-biswas']
level: 2
tags: ['integration', 'logic apps', 'automation']
course: azure
---

## What it is

A workflow engine with hundreds of prebuilt connectors. Instead of writing code to call an API, handle authentication, retry and paginate, you configure a step.

```text
Trigger   what starts the workflow
Actions   the steps that follow
Connector a prebuilt integration with a service
```

It fits integration and automation: move a file when it arrives, post to Teams when a ticket is raised, call three APIs and combine the results, run a nightly reconciliation.

## Two hosting models

```text
Consumption  multi tenant, pay per action executed, one workflow per resource
Standard     single tenant, runs on App Service, MANY workflows per resource,
             vnet integration, local development, predictable cost
```

**Standard is the better default for anything serious.** It gives virtual network access, deterministic pricing, several workflows in one app, and the ability to develop and test locally in Visual Studio Code.

Consumption is right for a simple workflow that runs occasionally, where per action pricing means near zero cost.

```bash
az logicapp create \
  --name logic-shop --resource-group rg-shop-prod-uks \
  --storage-account stshoplogic \
  --plan plan-logic --functions-version 4
```

## A workflow definition

Workflows are JSON, and the designer edits that JSON.

```json
{
  "definition": {
    "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
    "triggers": {
      "When_a_blob_is_added": {
        "type": "ApiConnection",
        "inputs": {
          "host": { "connection": { "name": "@parameters('$connections')['azureblob']['connectionId']" } },
          "method": "get",
          "path": "/v2/datasets/@{encodeURIComponent('stshopprod')}/triggers/batch/onupdatedfile"
        },
        "recurrence": { "frequency": "Minute", "interval": 5 }
      }
    },
    "actions": {
      "Parse_the_file": {
        "type": "ParseJson",
        "inputs": {
          "content": "@triggerBody()",
          "schema": { "type": "object", "properties": { "orderId": { "type": "string" } } }
        }
      },
      "Call_the_API": {
        "type": "Http",
        "runAfter": { "Parse_the_file": ["Succeeded"] },
        "inputs": {
          "method": "POST",
          "uri": "https://shop-api.azurewebsites.net/orders/import",
          "authentication": { "type": "ManagedServiceIdentity" },
          "body": "@body('Parse_the_file')"
        },
        "retryPolicy": { "type": "exponential", "count": 4, "interval": "PT10S" }
      },
      "Notify_on_failure": {
        "type": "ApiConnection",
        "runAfter": { "Call_the_API": ["Failed", "TimedOut"] },
        "inputs": { "body": { "text": "Order import failed" } }
      }
    }
  }
}
```

Three things worth noticing:

**`runAfter` is the control flow.** It says which action must finish, and in which state. `["Failed", "TimedOut"]` is how you build error handling.

**`authentication: ManagedServiceIdentity`** calls your own APIs with the Logic App's managed identity, so no key is stored.

**`retryPolicy`** is per action. The default is four retries with exponential backoff, and it can be disabled where retrying is unsafe.

## Connectors

```text
Built in     HTTP, schedule, Service Bus, Storage, SQL, Functions. Fast, no extra cost.
Managed      Office 365, Salesforce, SAP, ServiceNow, Slack, hundreds more.
Custom       your own OpenAPI definition
```

On Standard, built in connectors run in the same process and are noticeably faster and cheaper than managed ones. Prefer them where both exist: the built in Service Bus connector rather than the managed one.

## Error handling

```json
{
  "Scope_try": {
    "type": "Scope",
    "actions": {
      "Call_the_API": { "type": "Http", "inputs": { "method": "POST", "uri": "..." } }
    }
  },
  "Scope_catch": {
    "type": "Scope",
    "runAfter": { "Scope_try": ["Failed", "TimedOut", "Skipped"] },
    "actions": {
      "Log_the_failure": { "type": "Compose", "inputs": "@result('Scope_try')" },
      "Send_alert": { "type": "ApiConnection", "inputs": { } }
    }
  }
}
```

Scopes plus `runAfter` give the equivalent of try and catch. `@result()` returns the outcome of every action in the scope, including error details.

Without this, a failed action leaves the run marked failed and nobody is told. Workflow failures are silent unless you make them noisy.

## Stateful or stateless

```text
Stateful   every run and every action input and output is recorded.
           Full history, replayable, slower, storage cost.
Stateless  nothing recorded, much faster, no history unless enabled for debugging.
```

Stateless suits short synchronous request and response workflows. Stateful is right for anything long running, anything needing an audit trail, and anything you will need to debug.

The run history in stateful mode is genuinely the best debugging experience: every action shows exactly what went in and what came out.

## Handling collections

```json
{
  "For_each_order": {
    "type": "Foreach",
    "foreach": "@body('Get_orders')",
    "actions": {
      "Process_one": { "type": "Http", "inputs": { } }
    },
    "runtimeConfiguration": {
      "concurrency": { "repetitions": 10 }
    }
  }
}
```

`Foreach` runs in parallel by default with a concurrency of 20, which will hammer a downstream API. Set `repetitions` deliberately, or set it to 1 when order matters.

For large collections, `Until` with paging or the `SplitOn` trigger property is better than loading everything into memory.

## Long running approvals

```text
Send an email or Teams message with approve and reject options
The workflow WAITS, without consuming compute
It resumes when someone responds, or times out
```

This is where Logic Apps is genuinely hard to replicate cheaply. A workflow can wait days for a human, and the platform handles the state.

Durable Functions can do it in code; Logic Apps does it with no code at all.

## Logic Apps or Functions or Durable Functions

```text
Logic Apps        integration, connectors, human approvals, visual workflow,
                  handed to people who are not developers
Functions         code, custom logic, performance sensitive work
Durable Functions long running orchestration written in code, version controlled,
                  unit testable
```

The honest trade off: Logic Apps is faster to build and harder to version, test and review. A workflow edited in a portal designer has no pull request.

Keeping the JSON in source control and deploying with Bicep restores most of that, and is worth doing from the start.

## Deploying properly

```bash
az deployment group create \
  --resource-group rg-shop-prod-uks \
  --template-file logicapp.bicep \
  --parameters workflowName=order-import
```

Treat the workflow JSON as code: in the repository, parameterised for each environment, deployed by pipeline. Portal editing is for exploration, not for production changes.

Connections are separate resources and often need authorising interactively once per environment, which is the awkward part of automating Logic App deployment.

## Monitoring

```bash
az monitor diagnostic-settings create \
  --name logic-diag \
  --resource /subscriptions/.../sites/logic-shop \
  --workspace /subscriptions/.../workspaces/law-shop \
  --logs '[{"category":"WorkflowRuntime","enabled":true}]'
```

```kusto
LogicAppWorkflowRuntime
| where Status == "Failed"
| summarize count() by WorkflowName, Error = tostring(Error.message)
| order by count_ desc
```

Alert on failed runs. A workflow that stopped working three weeks ago and nobody noticed is the standard Logic Apps failure, and it is entirely preventable.

## Quick recap

- Standard hosting is the better default, giving vnet access, local development and predictable cost.
- `runAfter` is the control flow, and failure states are how error handling is built.
- Use `ManagedServiceIdentity` authentication so no key is stored in the workflow.
- Prefer built in connectors over managed ones where both exist.
- Scopes with `runAfter` on failure states give try and catch.
- `Foreach` defaults to concurrency 20, which will overload a downstream API.
- Keep workflow JSON in source control, since portal editing has no review path.

<code id="code-content" class="language-json">
{
  "COMMENT": "TWO MODELS. Consumption is multi tenant, per action pricing, one workflow per resource. STANDARD is single tenant on App Service: MANY workflows, vnet integration, LOCAL DEVELOPMENT, predictable cost. Standard is the better default for anything serious.",
  "definition": {
    "triggers": {
      "When_a_blob_is_added": {
        "type": "ApiConnection",
        "recurrence": { "frequency": "Minute", "interval": 5 }
      }
    },
    "actions": {
      "Call_the_API": {
        "type": "Http",
        "COMMENT_runAfter": "runAfter IS THE CONTROL FLOW: which action must finish, and IN WHICH STATE. Listing Failed and TimedOut is how error handling is built.",
        "runAfter": { "Parse_the_file": ["Succeeded"] },
        "inputs": {
          "method": "POST",
          "uri": "https://shop-api.azurewebsites.net/orders/import",
          "COMMENT_auth": "Calls your own API as the Logic App's MANAGED IDENTITY, so NO KEY IS STORED in the workflow.",
          "authentication": { "type": "ManagedServiceIdentity" },
          "body": "@body('Parse_the_file')"
        },
        "COMMENT_retry": "PER ACTION. Default is 4 exponential retries. Disable it where retrying is unsafe.",
        "retryPolicy": { "type": "exponential", "count": 4, "interval": "PT10S" }
      },
      "COMMENT_trycatch": "SCOPES PLUS runAfter GIVE TRY AND CATCH. @result('Scope_try') returns every action's outcome INCLUDING error details. WITHOUT THIS, A FAILED RUN IS SILENT and nobody is told.",
      "Scope_catch": {
        "type": "Scope",
        "runAfter": { "Scope_try": ["Failed", "TimedOut", "Skipped"] },
        "actions": { "Log": { "type": "Compose", "inputs": "@result('Scope_try')" } }
      },
      "COMMENT_foreach": "Foreach RUNS IN PARALLEL BY DEFAULT WITH CONCURRENCY 20, which will hammer a downstream API. Set it deliberately, or 1 when order matters.",
      "For_each_order": {
        "type": "Foreach",
        "foreach": "@body('Get_orders')",
        "runtimeConfiguration": { "concurrency": { "repetitions": 10 } },
        "actions": { "Process_one": { "type": "Http" } }
      }
    }
  },
  "NOTES": [
    "CONNECTORS: prefer BUILT IN (HTTP, Service Bus, Storage, SQL) over MANAGED where both exist. On Standard they run in process, faster and cheaper.",
    "STATEFUL records every action input and output, which is the best debugging experience available. STATELESS is much faster with no history.",
    "LONG RUNNING APPROVALS are where Logic Apps is hard to replicate: a workflow WAITS DAYS for a human WITHOUT CONSUMING COMPUTE.",
    "THE HONEST TRADE OFF: faster to build, harder to version, test and review. A workflow edited in the portal designer HAS NO PULL REQUEST. Keep the JSON in source control and deploy with Bicep from the start.",
    "ALERT ON FAILED RUNS. A workflow that stopped working three weeks ago and nobody noticed is the standard Logic Apps failure, and it is entirely preventable.",
    "  LogicAppWorkflowRuntime | where Status == 'Failed' | summarize count() by WorkflowName"
  ]
}
</code></pre>
