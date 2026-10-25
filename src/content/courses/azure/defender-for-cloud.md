---
publishDate: 2026-10-24T12:05
title: Microsoft Defender for Cloud
slug: defender-for-cloud
metadescription: Use Microsoft Defender for Cloud to find misconfiguration and threats across your Azure estate, and act on what it reports.
updateDate: 2026-09-07T12:05
author: ['bishal-biswas']
level: 3
tags: ['security', 'defender', 'posture']
course: azure
---

## Two halves

```text
CSPM   posture management: misconfiguration, secure score, recommendations. Free tier available.
CWPP   workload protection: threat detection for specific resource types. Paid per resource.
```

The free tier gives the secure score and recommendations across every subscription, which is worth having on from day one. The paid plans add runtime threat detection.

```bash
az security pricing list --query "value[].{Name:name, Tier:pricingTier}" -o table

az security pricing create --name VirtualMachines --tier Standard
az security pricing create --name StorageAccounts --tier Standard
az security pricing create --name SqlServers --tier Standard
az security pricing create --name KeyVaults --tier Standard
az security pricing create --name Containers --tier Standard
az security pricing create --name AppServices --tier Standard
```

## Secure score

A percentage across recommendations, weighted by severity.

```bash
az security secure-score list --output table
az security secure-score-control list \
  --query "[].{Control:displayName, Score:score.current, Max:score.max}" -o table
```

**The score is a prioritisation tool, not a target.** Chasing 100 percent leads to enabling things that do not fit, and a score of 65 with the right controls beats 90 with the wrong ones.

Look at which controls contribute most, and start there. Multifactor authentication for administrators and management ports closed are usually the two biggest wins.

## Recommendations

```bash
az security assessment list \
  --query "[?status.code=='Unhealthy'].{Name:displayName, Severity:metadata.severity}" \
  --output table
```

```kusto
SecurityResources
| where type =~ 'microsoft.security/assessments'
| where properties.status.code == 'Unhealthy'
| extend severity = tostring(properties.metadata.severity)
| summarize count() by assessment = tostring(properties.displayName), severity
| order by severity asc, count_ desc
```

The Resource Graph query is more useful than the portal for reporting, since it works across every subscription at once and can be scheduled.

The recommendations that matter most, consistently:

```text
Management ports open to the internet
Multifactor authentication not enforced for privileged accounts
Storage accounts allowing public blob access
Secure transfer not required
Databases without auditing
Systems missing security updates
Subscriptions without an owner or security contact
```

## Just in time virtual machine access

```bash
az security jit-policy upsert \
  --name default --resource-group rg-shop-prod-uks --location uksouth \
  --virtual-machines '[{
    "id": "/subscriptions/.../virtualMachines/vm-shop-01",
    "ports": [{"number": 22, "protocol": "TCP", "allowedSourceAddressPrefix": "*", "maxRequestAccessDuration": "PT3H"}]
  }]'
```

Management ports stay closed, and access is requested for a limited window from a specific address. An NSG rule is created for the duration and removed afterwards.

Bastion is a better answer where it fits, since no port is ever opened at all. Just in time access suits estates where Bastion is not deployed.

## Threat detection

Each paid plan watches for behaviour specific to that resource type.

```text
Storage        anonymous access from an unusual location, malware upload, exfiltration patterns
SQL            SQL injection attempts, unusual export volume, brute force
Key Vault      unusual access patterns, access from a Tor exit node
Containers     crypto mining, container escape attempts, exposed Kubernetes dashboards
VMs            fileless attacks, suspicious process execution, reverse shells
App Service    web shell upload, suspicious requests
```

```bash
az security alert list \
  --query "[?properties.status=='Active'].{Name:properties.alertDisplayName, Severity:properties.severity, Resource:properties.compromisedEntity}" \
  --output table
```

**Route alerts somewhere people look.** A high severity alert in a portal nobody opens is not a control.

```bash
az monitor action-group create \
  --name ag-security --resource-group rg-security \
  --short-name secalert \
  --action email soc soc@contoso.com \
  --action webhook siem "https://siem.contoso.com/hook"
```

## Regulatory compliance

```bash
az security regulatory-compliance-standard list --output table
az security regulatory-compliance-control list \
  --standard-name "Azure-CIS-1.4.0" \
  --query "[?state=='Failed'].{Control:name, State:state}" -o table
```

Standards including CIS, PCI DSS, ISO 27001, SOC 2 and NIST are mapped to Azure controls, with a compliance percentage per standard.

Useful for an audit, and worth understanding that it covers the **Azure configuration** portion of a standard, not the whole of it. Passing the CIS view in Defender is not the same as being CIS compliant.

## DevOps security

```bash
az security setting list --output table
```

Connecting GitHub or Azure DevOps brings code scanning results and infrastructure as code misconfiguration into the same view as runtime findings.

That closes a useful gap: a template with a public storage account is found before deployment rather than after.

## Auto provisioning

```bash
az security auto-provisioning-setting update --name default --auto-provision On
```

Automatically installs the required agents and extensions on new resources. Without it, a virtual machine created next month is invisible to Defender until someone notices.

Turning it on is one of the higher value settings, because coverage gaps are usually accidental rather than deliberate.

## Enforcing at scale

Recommendations tell you what is wrong. Azure Policy stops it happening.

```bash
az policy assignment create \
  --name deny-public-blob \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy /providers/Microsoft.Authorization/policyDefinitions/13502221-8df0-4414-9937-de9c5c4e396b \
  --params '{"effect":{"value":"Deny"}}'
```

The pattern that works:

```text
1. Defender finds a class of misconfiguration
2. Fix the existing instances
3. Assign a policy to prevent new ones
4. The recommendation stops recurring
```

Without step three, the same recommendation reappears every month with new resources, and the list never gets shorter.

## Making it manageable

```text
Assign an owner per recommendation type, not per finding
Set a due date, which Defender supports
Exempt what genuinely does not apply, WITH a reason
Review weekly rather than in bursts
Track the trend, not the absolute number
```

Exemptions matter. A permanent list of accepted findings with no recorded reason is indistinguishable from neglect, and a documented exemption is a decision.

```bash
az policy exemption create \
  --name exempt-legacy-storage \
  --policy-assignment "$ASSIGNMENT_ID" \
  --exemption-category Waiver \
  --description "Legacy public container required by partner until Q2 migration" \
  --expires-on 2027-06-30
```

An expiry date on the exemption is what stops it becoming permanent.

## Quick recap

- The free posture tier is worth enabling everywhere, and paid plans add runtime threat detection.
- Secure score is a prioritisation tool, and chasing 100 percent is the wrong goal.
- Query assessments with Resource Graph for reporting across every subscription.
- Route alerts to somewhere people actually look, or they are not a control.
- Compliance standards cover the Azure configuration part, not the whole standard.
- Enable auto provisioning, since coverage gaps are usually accidental.
- Follow each fix with a policy, or the same recommendation returns every month.

<code id="code-content" class="language-bash">
# TWO HALVES: CSPM (posture, secure score, recommendations, with a FREE
# tier worth enabling everywhere) and CWPP (runtime threat detection, paid
# per resource type).
az security pricing create --name StorageAccounts --tier Standard
az security pricing create --name KeyVaults --tier Standard
az security pricing list --query "value[].{Name:name, Tier:pricingTier}" -o table
# SECURE SCORE IS A PRIORITISATION TOOL, NOT A TARGET. Chasing 100 percent
# leads to enabling things that do not fit. 65 with the RIGHT controls beats
# 90 with the wrong ones. Look at which controls contribute most:
az security secure-score-control list \
  --query "[].{Control:displayName, Score:score.current, Max:score.max}" -o table
# RESOURCE GRAPH BEATS THE PORTAL FOR REPORTING: every subscription at once,
# and it can be scheduled.
#   SecurityResources
#   | where type =~ 'microsoft.security/assessments'
#   | where properties.status.code == 'Unhealthy'
#   | summarize count() by tostring(properties.displayName),
#                          tostring(properties.metadata.severity)
# THE ONES THAT MATTER MOST, CONSISTENTLY: management ports open to the
# internet, MFA not enforced for privileged accounts, public blob access,
# secure transfer not required, databases without auditing, missing updates.
# JUST IN TIME ACCESS keeps management ports CLOSED and opens one for a
# limited window from a specific address. Bastion is better where it fits,
# because no port is ever opened at all.
az security jit-policy upsert --name default --resource-group rg-shop-prod-uks \
  --location uksouth --virtual-machines '[{"id":"/subscriptions/.../vm-shop-01",
    "ports":[{"number":22,"protocol":"TCP","maxRequestAccessDuration":"PT3H"}]}]'
# ROUTE ALERTS SOMEWHERE PEOPLE LOOK. A high severity alert in a portal
# nobody opens IS NOT A CONTROL.
az security alert list --output table \
  --query "[?properties.status=='Active'].{Name:properties.alertDisplayName,
            Severity:properties.severity, Resource:properties.compromisedEntity}"
az monitor action-group create --name ag-security --resource-group rg-security \
  --short-name secalert --action email soc soc@contoso.com
# AUTO PROVISIONING is one of the higher value settings, because coverage
# gaps are usually ACCIDENTAL. Without it, a VM created next month is
# invisible to Defender until someone notices.
az security auto-provisioning-setting update --name default --auto-provision On
# COMPLIANCE STANDARDS (CIS, PCI DSS, ISO 27001, SOC 2, NIST) cover the
# AZURE CONFIGURATION part of a standard, NOT the whole of it. Passing the
# CIS view here is not the same as being CIS compliant.
az security regulatory-compliance-control list --standard-name "Azure-CIS-1.4.0" \
  --query "[?state=='Failed'].{Control:name}" -o table
# RECOMMENDATIONS TELL YOU WHAT IS WRONG. POLICY STOPS IT HAPPENING:
#   1. Defender finds a class of misconfiguration
#   2. fix the existing instances
#   3. ASSIGN A POLICY TO PREVENT NEW ONES     &lt;- without this, the same
#   4. the recommendation stops recurring         finding returns monthly
az policy assignment create --name deny-public-blob \
  --scope /providers/Microsoft.Management/managementGroups/mg-contoso \
  --policy 13502221-8df0-4414-9937-de9c5c4e396b --params '{"effect":{"value":"Deny"}}'
# EXEMPT WHAT GENUINELY DOES NOT APPLY, WITH A REASON AND AN EXPIRY. A
# permanent list of accepted findings with no recorded reason is
# indistinguishable from neglect.
az policy exemption create --name exempt-legacy-storage \
  --policy-assignment "$ASSIGNMENT_ID" --exemption-category Waiver \
  --description "Partner requirement until Q2 migration" --expires-on 2027-06-30
</code></pre>
