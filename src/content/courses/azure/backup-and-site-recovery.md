---
publishDate: 2026-10-27T13:00
title: Backup and Site Recovery
slug: backup-and-site-recovery
metadescription: Protect data with Azure Backup and whole systems with Site Recovery, and test restores before you need them.
updateDate: 2026-09-07T13:00
author: ['bishal-biswas']
level: 2
tags: ['reliability', 'backup', 'disaster recovery']
course: azure
---

## Backup and replication are different

```text
Backup       point in time copies, retained. Protects against DELETION and CORRUPTION.
Replication  a continuously updated copy. Protects against LOSING A REGION.
```

Replication copies mistakes immediately. Backup is what lets you go back to before the mistake, which is why geo redundant storage is not a backup and never was.

You need both for anything important.

## Recovery Services vault

```bash
az backup vault create \
  --name rsv-shop --resource-group rg-shop-prod-uks --location uksouth

az backup vault backup-properties set \
  --name rsv-shop --resource-group rg-shop-prod-uks \
  --backup-storage-redundancy GeoRedundant \
  --cross-region-restore-flag true \
  --soft-delete-feature-state AlwaysON
```

`--soft-delete-feature-state AlwaysON` makes deleted backups unrecoverable by an attacker for 14 days. Ransomware that deletes backups before encrypting data is a real pattern, and this is the control against it.

**Cross region restore must be enabled before you need it.** It cannot be turned on after a regional outage has started.

## Virtual machine backup

```bash
az backup protection enable-for-vm \
  --vault-name rsv-shop --resource-group rg-shop-prod-uks \
  --vm vm-shop-01 --policy-name DefaultPolicy

az backup policy create \
  --vault-name rsv-shop --resource-group rg-shop-prod-uks \
  --name shop-daily --backup-management-type AzureIaasVM \
  --policy '{
    "schedulePolicy": {
      "schedulePolicyType": "SimpleSchedulePolicy",
      "scheduleRunFrequency": "Daily",
      "scheduleRunTimes": ["2026-09-08T02:00:00Z"]
    },
    "retentionPolicy": {
      "retentionPolicyType": "LongTermRetentionPolicy",
      "dailySchedule": { "retentionDuration": { "count": 30, "durationType": "Days" } },
      "weeklySchedule": { "retentionDuration": { "count": 12, "durationType": "Weeks" } },
      "monthlySchedule": { "retentionDuration": { "count": 12, "durationType": "Months" } },
      "yearlySchedule": { "retentionDuration": { "count": 7, "durationType": "Years" } }
    }
  }'
```

Backups are application consistent on Windows through VSS, and on Linux through pre and post scripts you provide. Without those scripts, a Linux database backup is crash consistent, which usually recovers and sometimes does not.

```bash
az backup restore restore-disks \
  --vault-name rsv-shop --resource-group rg-shop-prod-uks \
  --container-name vm-shop-01 --item-name vm-shop-01 \
  --rp-name "$RECOVERY_POINT" \
  --storage-account stshoprestore \
  --target-resource-group rg-shop-restore

az backup restore files mount-rp \
  --vault-name rsv-shop --resource-group rg-shop-prod-uks \
  --container-name vm-shop-01 --item-name vm-shop-01 --rp-name "$RECOVERY_POINT"
```

File level recovery mounts the recovery point so individual files can be copied, which is usually what is actually needed rather than a whole machine.

## Database backups

```bash
# Azure SQL: automatic, and this extends retention
az sql db ltr-policy set --name shop --server sql-shop-prod \
  --resource-group rg-shop-prod-uks \
  --weekly-retention P4W --monthly-retention P12M --yearly-retention P7Y --week-of-year 1

az sql db ltr-backup list --location uksouth --server sql-shop-prod --database shop -o table

az sql db ltr-backup restore \
  --dest-database shop-restored --dest-server sql-shop-prod \
  --dest-resource-group rg-shop-prod-uks \
  --backup-id "$BACKUP_ID"
```

Azure SQL, PostgreSQL, MySQL and Cosmos DB all back up automatically. The configuration is retention, not whether it happens.

**A restore creates a new database.** That is the safe behaviour: restore, verify, then repoint the application.

## Blob backup

```bash
az dataprotection backup-vault create \
  --vault-name bv-shop --resource-group rg-shop-prod-uks --location uksouth \
  --storage-settings datastore-type="VaultStore" type="GeoRedundant"

az dataprotection backup-instance create \
  --vault-name bv-shop --resource-group rg-shop-prod-uks \
  --backup-instance backup-instance.json
```

Operational backup uses point in time restore with the change feed, and vaulted backup keeps copies in a separate vault, which survives the storage account being deleted.

For anything critical, vaulted. Operational backup lives in the same account as the data, so it does not protect against losing the account.

## Immutable backups

```bash
az backup vault update \
  --name rsv-shop --resource-group rg-shop-prod-uks \
  --immutability-state Locked
```

```text
Disabled  the default
Unlocked  immutable, and can be reverted. For testing.
Locked    IRREVERSIBLE. Nobody can shorten retention or delete a recovery point.
```

`Locked` protects against an attacker with administrative access deleting backups. It also means you cannot reduce retention, which affects cost.

Test with `Unlocked` first, then lock production once the policy is right.

## Site Recovery

Replicates whole machines to another region, with an orchestrated failover.

```bash
az site-recovery vault create --name rsv-dr --resource-group rg-dr --location northeurope

az site-recovery protection-container mapping create \
  --fabric-name uksouth --protection-container uksouth-container \
  --vault-name rsv-dr --resource-group rg-dr \
  --name uks-to-ne --policy-name replication-policy \
  --target-container ne-container
```

```text
Azure to Azure       between regions
On premises to Azure VMware, Hyper-V, physical servers
Continuous replication, with a recovery point every few minutes
```

## Recovery plans

The valuable part is the ordering, not the replication.

```json
{
  "groups": [
    {
      "groupType": "Boot",
      "replicationProtectedItems": [{ "id": "vm-shop-db-01" }],
      "endGroupActions": [{
        "actionDetailTypes": "AutomationRunbookActionDetails",
        "runbookId": "/subscriptions/.../runbooks/VerifyDatabase"
      }]
    },
    {
      "groupType": "Boot",
      "replicationProtectedItems": [{ "id": "vm-shop-app-01" }, { "id": "vm-shop-app-02" }],
      "endGroupActions": [{
        "actionDetailTypes": "AutomationRunbookActionDetails",
        "runbookId": "/subscriptions/.../runbooks/UpdateDnsAndWarmUp"
      }]
    }
  ]
}
```

Database first, verify it, then application servers, then update DNS. A recovery plan encodes the order and the steps so failover is one action rather than a document someone follows under pressure.

## Test failover, which is the point

```bash
az site-recovery recovery-plan test-failover \
  --resource-group rg-dr --vault-name rsv-dr --recovery-plan-name rp-shop \
  --failover-direction PrimaryToRecovery \
  --network-id /subscriptions/.../virtualNetworks/vnet-dr-test

az site-recovery recovery-plan test-failover-cleanup \
  --resource-group rg-dr --vault-name rsv-dr --recovery-plan-name rp-shop
```

Test failover creates the machines in an **isolated network**, so production is untouched. There is no reason not to do it quarterly.

**A recovery plan that has never been tested does not work.** Something will be missing: a firewall rule, a DNS entry, a licence, a dependency in another region.

## Recovery objectives

```text
RPO  how much data can be lost. Recovery Point Objective.
RTO  how long recovery may take. Recovery Time Objective.
```

```text
RPO 24h, RTO 8h    daily backup, manual restore. Cheap.
RPO 1h, RTO 4h     frequent backup, tested runbook.
RPO 5m, RTO 1h     Site Recovery with a recovery plan.
RPO ~0, RTO minutes  active passive multi region with automatic failover.
RPO 0, RTO 0       active active. Expensive, and genuinely hard.
```

Agreeing these numbers with the business before designing anything is the step that gets skipped. Without them, you are guessing at how much to spend.

## Testing restores

```text
Restore to an isolated environment
Verify the data is complete and current, not just that files exist
Measure how long it took, against the RTO
Record what was missing, and fix it
Repeat quarterly
```

**A backup that has never been restored is not a backup.** The failure modes found on a first restore are consistent: missing credentials, a dependency in the failed region, an out of date runbook, or the backup silently failing for months.

```bash
az backup job list --vault-name rsv-shop --resource-group rg-shop-prod-uks \
  --status Failed --output table

az monitor metrics alert create \
  --name backup-failed --resource-group rg-shop-prod-uks \
  --scopes /subscriptions/.../vaults/rsv-shop \
  --condition "total BackupHealthEvent > 0" \
  --severity 2 --action /subscriptions/.../actionGroups/ag-team
```

Alert on backup failures. Silent backup failure for months, discovered during a restore, is a common and entirely preventable disaster.

## Quick recap

- Backup protects against deletion and corruption; replication protects against losing a region.
- Enable soft delete and cross region restore before you need them.
- Linux application consistent backups need pre and post scripts you provide.
- Vaulted blob backup survives the storage account being deleted; operational backup does not.
- Immutable vaults with `Locked` cannot be reverted, so test with `Unlocked` first.
- The recovery plan's value is the ordering, and test failover uses an isolated network.
- Alert on backup failures, and restore regularly, because an untested backup is not a backup.

<code id="code-content" class="language-bash">
# BACKUP AND REPLICATION ARE DIFFERENT THINGS:
#   BACKUP       point in time copies. Protects against DELETION and CORRUPTION.
#   REPLICATION  a continuously updated copy. Protects against LOSING A REGION.
# Replication COPIES MISTAKES IMMEDIATELY, which is why geo redundant
# storage is not a backup and never was. You need both.
az backup vault backup-properties set --name rsv-shop \
  --resource-group rg-shop-prod-uks --backup-storage-redundancy GeoRedundant \
  --cross-region-restore-flag true --soft-delete-feature-state AlwaysON
# SOFT DELETE makes deleted backups unrecoverable BY AN ATTACKER for 14
# days. Ransomware that deletes backups before encrypting data is a real
# pattern, and this is the control against it.
# CROSS REGION RESTORE MUST BE ENABLED BEFORE YOU NEED IT. It cannot be
# turned on after a regional outage has started.
az backup protection enable-for-vm --vault-name rsv-shop \
  --resource-group rg-shop-prod-uks --vm vm-shop-01 --policy-name shop-daily
# Windows backups are application consistent via VSS. LINUX NEEDS PRE AND
# POST SCRIPTS YOU PROVIDE, or a database backup is only crash consistent,
# which usually recovers and sometimes does not.
# FILE LEVEL RECOVERY is usually what is actually needed, not a whole machine:
az backup restore files mount-rp --vault-name rsv-shop \
  --resource-group rg-shop-prod-uks --container-name vm-shop-01 \
  --item-name vm-shop-01 --rp-name "$RECOVERY_POINT"
# DATABASES BACK UP AUTOMATICALLY. The configuration is RETENTION, not
# whether it happens. A RESTORE CREATES A NEW DATABASE, which is the safe
# behaviour: restore, verify, then repoint.
az sql db ltr-policy set --name shop --server sql-shop-prod \
  --resource-group rg-shop-prod-uks --weekly-retention P4W --yearly-retention P7Y
# FOR BLOBS, USE VAULTED BACKUP for anything critical: OPERATIONAL backup
# lives in the SAME ACCOUNT as the data, so it does not survive losing it.
# IMMUTABILITY: Locked is IRREVERSIBLE. Nobody, including an attacker with
# admin access, can shorten retention or delete a recovery point. It also
# means YOU cannot reduce retention. Test with Unlocked first.
az backup vault update --name rsv-shop --resource-group rg-shop-prod-uks \
  --immutability-state Locked
# SITE RECOVERY replicates whole machines. THE VALUABLE PART IS THE RECOVERY
# PLAN'S ORDERING: database first, VERIFY IT, then application servers, then
# DNS. That makes failover ONE ACTION rather than a document someone follows
# under pressure.
# TEST FAILOVER USES AN ISOLATED NETWORK, so production is untouched. There
# is no reason not to do it quarterly.
az site-recovery recovery-plan test-failover --resource-group rg-dr \
  --vault-name rsv-dr --recovery-plan-name rp-shop \
  --failover-direction PrimaryToRecovery \
  --network-id /subscriptions/.../virtualNetworks/vnet-dr-test
# AGREE RPO AND RTO WITH THE BUSINESS BEFORE DESIGNING. Without them you are
# guessing at how much to spend.
#   RPO 24h / RTO 8h  daily backup, manual restore. Cheap.
#   RPO 5m  / RTO 1h  Site Recovery with a recovery plan.
#   RPO 0   / RTO 0   active active. Expensive and genuinely hard.
# A BACKUP THAT HAS NEVER BEEN RESTORED IS NOT A BACKUP. The failure modes
# found on a first restore are consistent: missing credentials, a dependency
# in the failed region, a stale runbook, or MONTHS OF SILENT FAILURE.
az backup job list --vault-name rsv-shop --resource-group rg-shop-prod-uks \
  --status Failed --output table
# ALERT ON BACKUP FAILURES. Discovering months of silence during a restore
# is common and entirely preventable.
</code></pre>
