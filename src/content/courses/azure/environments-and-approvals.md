---
publishDate: 2026-10-22T11:45
title: Environments, Approvals and Promotion
slug: environments-and-approvals
metadescription: Structure Azure environments and promotion so changes reach production predictably, with approvals that add safety rather than delay.
updateDate: 2026-09-07T11:45
author: ['bishal-biswas']
level: 3
tags: ['devops', 'environments', 'governance']
course: azure
---

## How many environments

```text
dev         continuous deployment, broken sometimes, nobody minds
test        integration testing, seeded data, stable enough to test against
staging     production configuration and scale, the final check
production  the real one
```

Four is common and often two too many. The question for each: **what does this catch that the next one down does not?**

An environment nobody tests in is a cost with no return. A staging environment sized at a tenth of production catches functional problems and no performance ones, so be honest about what it is for.

For many teams `dev` and `production`, with feature flags and good monitoring, is genuinely enough.

## Isolation

```text
Separate subscriptions   strongest. Separate quotas, billing, policy, blast radius.
Separate resource groups acceptable. Shared quota and subscription policy.
Shared resources         no. A dev load test should not affect production.
```

Separate subscriptions per environment is the recommended shape. Quota exhaustion in dev cannot affect production, cost is attributable without tag discipline, and a policy applied to production does not have to be applied everywhere.

```bash
az account management-group create --name mg-shop
az account management-group subscription add --name mg-shop --subscription "$PROD_SUB"

az account management-group create --name mg-shop-nonprod --parent mg-shop
az account management-group subscription add --name mg-shop-nonprod --subscription "$DEV_SUB"
```

Management groups then let production policy differ from non production policy without configuring each subscription.

## Configuration per environment

```bicep
@allowed(['dev', 'test', 'prod'])
param environment string

var config = {
  dev: {
    appSku: 'B1'
    instances: 1
    sqlSku: 'Basic'
    zoneRedundant: false
    backupRetention: 7
    logRetention: 30
  }
  prod: {
    appSku: 'P1v3'
    instances: 3
    sqlSku: 'S2'
    zoneRedundant: true
    backupRetention: 35
    logRetention: 90
  }
}
```

**The same template, different parameters.** When the structure differs between environments, staging stops predicting production and the whole exercise loses its value.

Size and redundancy can differ. Topology, security settings and service choices should not.

## Promotion

```text
1. Build once, producing one artefact
2. Deploy that artefact to dev
3. Promote the SAME artefact to test
4. Promote the SAME artefact to production
```

**Never rebuild per environment.** A rebuild can produce a different artefact, from a different dependency version or a different toolchain, and then production runs something that was never tested.

```yaml
  build:
    steps:
      - run: dotnet publish -c Release -o ./publish
      - uses: actions/upload-artifact@v4
        with: { name: app, path: ./publish }

  deploy-dev:
    needs: build
    environment: dev
    steps:
      - uses: actions/download-artifact@v4
        with: { name: app }

  deploy-prod:
    needs: deploy-dev
    environment: production
    steps:
      - uses: actions/download-artifact@v4
        with: { name: app }
```

`needs: deploy-dev` enforces the order. Production cannot be deployed unless dev succeeded.

## Approvals

```text
GitHub environments
  Required reviewers, wait timer, deployment branches, environment secrets

Azure DevOps environments
  Approvals, branch control, business hours, exclusive lock, required template
```

Configure approvals **on the environment**, so the pipeline definition cannot bypass them. A pipeline author changing a YAML file should not be able to remove the production approval.

## Approvals that work

An approval is only useful if the approver can actually judge the change.

```text
Give them
  what changed, as a commit range or release notes
  the infrastructure diff, from what-if or plan
  test and scan results
  a rollback plan

Do not
  ask for approval on every dev deployment
  make one person the only approver
  approve at 6pm on a Friday out of habit
```

An approval that is always granted without reading is theatre, and worse than none because it creates false confidence.

```yaml
      - name: Preview infrastructure changes
        run: |
          az deployment group what-if \
            --resource-group rg-shop-prod-uks \
            --template-file infra/main.bicep \
            --parameters infra/prod.bicepparam \
            > whatif.txt
          cat whatif.txt >> "$GITHUB_STEP_SUMMARY"
```

Putting the `what-if` output in the job summary means the approver sees the actual effect without leaving the page. That single change makes approvals meaningfully better.

## Automated gates

Better than human approval where a machine can judge it.

```yaml
      - name: Quality gate
        run: |
          dotnet test --logger trx
          dotnet list package --vulnerable --include-transitive | tee vuln.txt
          if grep -q "has the following vulnerable packages" vuln.txt; then
            echo "Vulnerable dependencies found"
            exit 1
          fi

      - name: Verify the deployed environment
        run: |
          curl -f "$URL/healthz"
          curl -f "$URL/api/version" | grep -q "$EXPECTED_SHA"
```

```text
Automate    tests, coverage, vulnerability scans, policy compliance, smoke tests
Ask a human whether this business change should go out now
```

Humans are bad at checking whether a test passed and good at judging whether a risky change should happen on the day of a big campaign. Use each accordingly.

## Ephemeral environments

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, closed]

jobs:
  preview:
    if: github.event.action != 'closed'
    steps:
      - run: |
          az group create --name "rg-shop-pr-${{ github.event.number }}" --location uksouth
          az deployment group create \
            --resource-group "rg-shop-pr-${{ github.event.number }}" \
            --template-file infra/main.bicep \
            --parameters environment=preview \
                         resourceSuffix=pr${{ github.event.number }}

  cleanup:
    if: github.event.action == 'closed'
    steps:
      - run: az group delete --name "rg-shop-pr-${{ github.event.number }}" --yes --no-wait
```

A full environment per pull request, deleted on merge. Reviewers see the change running rather than reading a diff.

**The cleanup job is not optional.** Without it, abandoned preview environments accumulate and bill indefinitely. Add a scheduled sweep as well, since a closed event can be missed:

```bash
az group list --query "[?starts_with(name, 'rg-shop-pr-')].name" -o tsv | \
  while read -r group; do
    created=$(az group show --name "$group" --query tags.created -o tsv)
    # delete groups older than 7 days
  done
```

Static Web Apps and Container Apps both make this cheap, since preview environments there cost almost nothing when idle.

## Drift

```bash
az deployment group what-if \
  --resource-group rg-shop-prod-uks \
  --template-file infra/main.bicep \
  --parameters infra/prod.bicepparam
```

Running `what-if` on a schedule against production, with no intention of deploying, detects manual changes. A non empty result means someone changed something outside the pipeline.

Deployment stacks with deny settings prevent it outright:

```bash
az stack group create --name shop-prod --resource-group rg-shop-prod-uks \
  --template-file infra/main.bicep --parameters infra/prod.bicepparam \
  --action-on-unmanage deleteResources \
  --deny-settings-mode denyWriteAndDelete \
  --deny-settings-excluded-principals "$PIPELINE_PRINCIPAL_ID"
```

## Break glass

Emergencies happen, and a process with no emergency path gets bypassed entirely.

```text
A defined break glass path
  a named account or elevated role, used only for emergencies
  every use alerted on immediately
  a review the next working day
  the change reflected back into the template the same day
```

The failure is not having an emergency path. It is having one used routinely, or one whose changes never make it back into the code.

## Quick recap

- Ask what each environment catches that the next one down does not.
- Separate subscriptions give the strongest isolation and the clearest cost attribution.
- Use the same template with different parameters, so structure never diverges.
- Build once and promote the same artefact, since a rebuild may differ from what was tested.
- Configure approvals on the environment so a pipeline change cannot bypass them.
- Put `what-if` output in the job summary, so approvers see the actual effect.
- Ephemeral environments need a cleanup job and a scheduled sweep, or they bill forever.

<code id="code-content" class="language-yaml">
# HOW MANY ENVIRONMENTS? Ask of each: WHAT DOES THIS CATCH THAT THE NEXT
# ONE DOWN DOES NOT? A staging environment at a tenth of production's scale
# catches functional problems and NO performance ones. For many teams, dev
# and production with feature flags and good monitoring is genuinely enough.
#
# ISOLATION: SEPARATE SUBSCRIPTIONS are strongest. Dev quota exhaustion
# cannot touch production, cost is attributable without tag discipline, and
# production policy need not apply everywhere.
#
# BUILD ONCE, PROMOTE THE SAME ARTEFACT. NEVER REBUILD PER ENVIRONMENT: a
# rebuild can differ (dependency version, toolchain), and then production
# runs something that WAS NEVER TESTED.
jobs:
  build:
    steps:
      - run: dotnet publish -c Release -o ./publish
      - uses: actions/upload-artifact@v4
        with: { name: app, path: ./publish }
#
  deploy-dev:
    needs: build
    environment: dev              # approvals live HERE, not in this file
    steps:
      - uses: actions/download-artifact@v4
        with: { name: app }
#
  deploy-prod:
    needs: deploy-dev             # production cannot deploy unless dev passed
    environment: production
    steps:
      - uses: actions/download-artifact@v4
        with: { name: app }
#
      # THIS ONE CHANGE MAKES APPROVALS MEANINGFULLY BETTER: the approver
      # sees THE ACTUAL EFFECT without leaving the page.
      - name: Preview infrastructure changes
        run: |
          az deployment group what-if \
            --resource-group rg-shop-prod-uks \
            --template-file infra/main.bicep \
            --parameters infra/prod.bicepparam &gt;&gt; "$GITHUB_STEP_SUMMARY"
#
# AN APPROVAL ALWAYS GRANTED WITHOUT READING IS THEATRE, and worse than
# none because it creates false confidence. Give approvers the commit
# range, the infrastructure diff, scan results and a rollback plan.
#   AUTOMATE: tests, coverage, vulnerability scans, policy, smoke tests
#   ASK A HUMAN: should this business change go out NOW?
# Humans are bad at checking whether a test passed and good at judging
# whether a risky change should land on the day of a big campaign.
#
# EPHEMERAL ENVIRONMENTS: a full environment per pull request, so reviewers
# see the change RUNNING rather than reading a diff.
#   az group create --name "rg-shop-pr-${{ github.event.number }}"
# THE CLEANUP JOB IS NOT OPTIONAL. Without it, abandoned previews bill
# indefinitely. Add a SCHEDULED SWEEP too, because a closed event can be missed.
#   if: github.event.action == 'closed'
#   run: az group delete --name "rg-shop-pr-${{ github.event.number }}" --yes --no-wait
#
# DRIFT: run what-if on a SCHEDULE against production with no intention of
# deploying. A non empty result means someone changed something outside the
# pipeline. Deployment stacks with deny settings PREVENT it outright:
#   az stack group create --name shop-prod --deny-settings-mode denyWriteAndDelete \
#     --deny-settings-excluded-principals "$PIPELINE_PRINCIPAL_ID"
#
# BREAK GLASS: a process with NO emergency path gets bypassed entirely. Have
# one, alert on every use, review the next working day, and REFLECT THE
# CHANGE BACK INTO THE TEMPLATE THE SAME DAY. The failure is not having the
# path; it is using it routinely, or never updating the code afterwards.
</code></pre>
