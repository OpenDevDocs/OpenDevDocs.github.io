---
publishDate: 2026-10-24T12:10
title: Azure Policy and Governance
slug: azure-policy-and-governance
metadescription: Enforce standards across an Azure estate with Azure Policy, using effects that prevent, correct and report.
updateDate: 2026-09-07T12:10
author: ['bishal-biswas']
level: 3
tags: ['security', 'governance', 'policy']
course: azure
---

## What policy does

Azure Policy evaluates resources against rules and takes an action. It is the mechanism that turns "we should always do X" into "X happens".

```text
Deny            block the deployment
Audit           allow, and record non compliance
Modify          change the resource, adding or updating properties
DeployIfNotExists  deploy something alongside it, like diagnostic settings
AuditIfNotExists   record when a related resource is missing
Deny + exemption   the practical shape for most rules
Disabled        turned off, for testing
```

## Assigning a built in policy

There are hundreds of built in definitions, and most requirements are covered.

```bash
az policy definition list --query "[?policyType=='BuiltIn'].displayName" -o tsv | grep -i storage

az policy assignment create \
  --name require-https-storage \
  --display-name "Storage accounts must require secure transfer" \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy 404c3081-a854-4457-ae30-26a93ef643f9 \
  --params '{"effect":{"value":"Deny"}}'
```

Assign at a **management group** so it applies to every subscription beneath it, including ones created later. Assigning per subscription means remembering for each new one.

## Effects that do the work

**Deny** stops the deployment.

```bash
az policy assignment create \
  --name deny-public-ip-on-nic \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso-prod \
  --policy 83a86a26-fd1f-447c-b59d-e51f44264114 \
  --params '{"effect":{"value":"Deny"}}'
```

**Modify** fixes things automatically, which is better than blocking where a sensible default exists.

```json
{
  "if": {
    "field": "type",
    "equals": "Microsoft.Storage/storageAccounts"
  },
  "then": {
    "effect": "modify",
    "details": {
      "roleDefinitionIds": [
        "/providers/Microsoft.Authorization/roleDefinitions/17d1049b-9a84-46fb-8f53-869881c3d3ab"
      ],
      "operations": [
        {
          "operation": "addOrReplace",
          "field": "Microsoft.Storage/storageAccounts/minimumTlsVersion",
          "value": "TLS1_2"
        }
      ]
    }
  }
}
```

A modify policy needs a managed identity with permission to make the change, which is why `roleDefinitionIds` is there.

**DeployIfNotExists** is how diagnostic settings get onto everything:

```bash
az policy assignment create \
  --name diagnostics-to-law \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy /providers/Microsoft.Authorization/policyDefinitions/... \
  --params '{"logAnalytics":{"value":"/subscriptions/.../workspaces/law-central"}}' \
  --location uksouth \
  --mi-system-assigned \
  --role Contributor \
  --identity-scope /providers/Microsoft.Management/managementGroups/mg-contoso
```

Without a policy like this, diagnostic settings are configured by whoever remembers, which is nobody, and then an incident has no logs.

## A custom policy

```json
{
  "properties": {
    "displayName": "Require a costCentre tag on resource groups",
    "policyType": "Custom",
    "mode": "All",
    "parameters": {
      "effect": {
        "type": "String",
        "allowedValues": ["Audit", "Deny", "Disabled"],
        "defaultValue": "Audit"
      }
    },
    "policyRule": {
      "if": {
        "allOf": [
          { "field": "type", "equals": "Microsoft.Resources/subscriptions/resourceGroups" },
          { "field": "tags['costCentre']", "exists": "false" }
        ]
      },
      "then": {
        "effect": "[parameters('effect')]"
      }
    }
  }
}
```

```bash
az policy definition create \
  --name require-cost-centre \
  --management-group mg-contoso \
  --rules policy.json
```

Parameterising the effect matters. The same definition can be audited in development and denied in production, and rolled out gradually.

## Initiatives

An initiative groups policies so they are assigned and reported together.

```bash
az policy set-definition create \
  --name shop-baseline \
  --management-group mg-contoso \
  --definitions '[
    {"policyDefinitionId": "/providers/Microsoft.Authorization/policyDefinitions/404c3081-...", "parameters": {"effect": {"value": "Deny"}}},
    {"policyDefinitionId": "/providers/Microsoft.Authorization/policyDefinitions/13502221-...", "parameters": {"effect": {"value": "Deny"}}},
    {"policyDefinitionId": "/subscriptions/.../policyDefinitions/require-cost-centre", "parameters": {"effect": {"value": "Audit"}}}
  ]'

az policy assignment create \
  --name shop-baseline \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy-set-definition shop-baseline
```

Built in initiatives cover CIS, NIST, PCI DSS, ISO 27001 and the Azure Security Benchmark, so a compliance baseline is one assignment rather than forty.

## Roll out gradually

Assigning a `Deny` policy across production immediately will break deployments that were working an hour ago.

```text
1. Assign with effect Audit, at the widest scope
2. Look at what is non compliant, and why
3. Fix or exempt each case
4. Switch to Deny
5. Watch for deployments that start failing
```

```bash
az policy state summarize \
  --management-group mg-contoso \
  --query "value[0].results.{NonCompliant:nonCompliantResources, Total:resourceDetails}"

az policy state list \
  --management-group mg-contoso --filter "complianceState eq 'NonCompliant'" \
  --query "[].{Resource:resourceId, Policy:policyDefinitionName}" -o table
```

## Remediating existing resources

A `Deny` policy affects new deployments. Existing resources stay non compliant until remediated.

```bash
az policy remediation create \
  --name remediate-diagnostics \
  --management-group mg-contoso \
  --policy-assignment diagnostics-to-law \
  --resource-discovery-mode ReEvaluateCompliance

az policy remediation list --management-group mg-contoso -o table
```

Remediation applies `Modify` and `DeployIfNotExists` policies to resources that already exist. It is how a new standard reaches an existing estate.

## Exemptions

```bash
az policy exemption create \
  --name legacy-app-tls \
  --scope /subscriptions/.../resourceGroups/rg-legacy \
  --policy-assignment "$ASSIGNMENT_ID" \
  --exemption-category Waiver \
  --description "Vendor appliance does not support TLS 1.2. Replacement scheduled Q3 2027." \
  --expires-on 2027-09-30
```

```text
Waiver     accepted, and not going to be fixed now
Mitigated  handled by another control
```

**Always set an expiry.** An exemption without one becomes permanent, and the estate accumulates accepted risk nobody revisits.

The description should say why and what happens next. "Legacy" is not a reason.

## Policy against RBAC against locks

```text
RBAC     who can do things
Policy   what may exist and how it is configured
Locks    a specific resource cannot be deleted or changed
```

They solve different problems and are often confused. RBAC cannot say "storage accounts must use TLS 1.2", and policy cannot say "Asha may deploy here".

```bash
az lock create --name protect-prod-db \
  --lock-type CanNotDelete \
  --resource-group rg-shop-prod-uks \
  --resource-name sql-shop-prod \
  --resource-type Microsoft.Sql/servers
```

A `CanNotDelete` lock on production databases and state storage accounts is cheap insurance against a mistaken script.

Note that locks apply to everyone, including the pipeline, so a `ReadOnly` lock can break legitimate deployments in confusing ways.

## Policy as code

```bicep
resource definition 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'require-cost-centre'
  properties: {
    displayName: 'Require a costCentre tag'
    policyType: 'Custom'
    mode: 'All'
    parameters: {
      effect: {
        type: 'String'
        allowedValues: ['Audit', 'Deny', 'Disabled']
        defaultValue: 'Audit'
      }
    }
    policyRule: {
      if: {
        allOf: [
          { field: 'type', equals: 'Microsoft.Resources/subscriptions/resourceGroups' }
          { field: 'tags[\'costCentre\']', exists: 'false' }
        ]
      }
      then: { effect: '[parameters(\'effect\')]' }
    }
  }
}
```

Policies deployed from a repository are reviewable and reversible, like any other infrastructure. Policies created in the portal are neither, and nobody knows why they exist a year later.

## Quick recap

- Assign at management group scope so new subscriptions are covered automatically.
- `Modify` fixes things quietly where a sensible default exists, which beats blocking.
- `DeployIfNotExists` is how diagnostic settings reach everything, and it needs an identity.
- Parameterise the effect so one definition can audit in dev and deny in production.
- Always roll out in Audit first, since Deny breaks deployments that worked an hour ago.
- Remediation is how a new standard reaches existing resources.
- Give every exemption a reason and an expiry, or it becomes permanent.

<code id="code-content" class="language-bash">
# POLICY TURNS "we should always do X" INTO "X HAPPENS".
#   Deny               block the deployment
#   Audit              allow, and record non compliance
#   Modify             CHANGE the resource, adding or fixing properties
#   DeployIfNotExists  deploy something alongside it (diagnostic settings)
#   Disabled           for testing
# ASSIGN AT A MANAGEMENT GROUP so it covers every subscription beneath it,
# INCLUDING ONES CREATED LATER. Per subscription means remembering each time.
az policy assignment create --name require-https-storage \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy 404c3081-a854-4457-ae30-26a93ef643f9 \
  --params '{"effect":{"value":"Deny"}}'
# MODIFY BEATS BLOCKING where a sensible default exists: it fixes the
# resource quietly instead of failing the deployment. It needs a MANAGED
# IDENTITY with permission to make the change (roleDefinitionIds).
# DeployIfNotExists IS HOW DIAGNOSTIC SETTINGS REACH EVERYTHING. Without a
# policy like this they are configured by whoever remembers, which is
# nobody, and then an incident has no logs.
az policy assignment create --name diagnostics-to-law \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy /providers/Microsoft.Authorization/policyDefinitions/... \
  --params '{"logAnalytics":{"value":"/subscriptions/.../workspaces/law-central"}}' \
  --location uksouth --mi-system-assigned --role Contributor \
  --identity-scope /providers/Microsoft.Management/managementGroups/mg-contoso
# PARAMETERISE THE EFFECT, so one definition audits in dev and denies in
# production, and can be rolled out gradually:
#   "parameters": { "effect": { "type": "String",
#     "allowedValues": ["Audit","Deny","Disabled"], "defaultValue": "Audit" } }
#   "then": { "effect": "[parameters('effect')]" }
# ROLL OUT IN AUDIT FIRST. Assigning Deny across production immediately
# BREAKS DEPLOYMENTS THAT WORKED AN HOUR AGO.
az policy state list --management-group mg-contoso \
  --filter "complianceState eq 'NonCompliant'" \
  --query "[].{Resource:resourceId, Policy:policyDefinitionName}" -o table
# Deny AFFECTS NEW DEPLOYMENTS ONLY. Existing resources stay non compliant
# until REMEDIATED, which is how a new standard reaches an existing estate:
az policy remediation create --name remediate-diagnostics \
  --management-group mg-contoso --policy-assignment diagnostics-to-law \
  --resource-discovery-mode ReEvaluateCompliance
# ALWAYS SET AN EXPIRY ON AN EXEMPTION, or the estate accumulates accepted
# risk nobody revisits. The description should say WHY and WHAT NEXT.
# "Legacy" is not a reason.
az policy exemption create --name legacy-app-tls \
  --scope /subscriptions/.../resourceGroups/rg-legacy \
  --policy-assignment "$ASSIGNMENT_ID" --exemption-category Waiver \
  --description "Vendor appliance lacks TLS 1.2. Replacement Q3 2027." \
  --expires-on 2027-09-30
# THREE DIFFERENT THINGS, OFTEN CONFUSED:
#   RBAC    WHO can do things
#   POLICY  WHAT may exist, and how it is configured
#   LOCKS   this SPECIFIC resource cannot be deleted or changed
az lock create --name protect-prod-db --lock-type CanNotDelete \
  --resource-group rg-shop-prod-uks --resource-name sql-shop-prod \
  --resource-type Microsoft.Sql/servers
# Locks apply to EVERYONE, including the pipeline, so a ReadOnly lock breaks
# legitimate deployments in confusing ways.
# DEPLOY POLICIES FROM A REPOSITORY. Portal created policies are neither
# reviewable nor reversible, and nobody knows why they exist a year later.
</code></pre>
