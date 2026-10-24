---
publishDate: 2026-10-13T09:15
title: Managed Disks and Disk Types
slug: azure-disks
metadescription: Attach managed disks to Azure virtual machines, choose a disk type that matches the workload, and avoid the common performance traps.
updateDate: 2026-09-07T09:15
author: ['bishal-biswas']
level: 2
tags: ['storage', 'disks', 'vm']
course: azure
---

## Managed disks

Azure manages the underlying storage account, so you create a disk resource and attach it.

```bash
az disk create \
  --name disk-shop-data --resource-group rg-shop-prod-uks \
  --size-gb 512 --sku Premium_LRS --zone 1

az vm disk attach \
  --vm-name vm-shop-01 --resource-group rg-shop-prod-uks \
  --name disk-shop-data --caching ReadOnly
```

**A zonal disk can only attach to a virtual machine in the same zone.** Getting this wrong means recreating the disk, so match zones when creating both.

## Disk types

```text
Standard HDD (Standard_LRS)   cheapest, high latency. Archives, backups.
Standard SSD (StandardSSD_LRS) light workloads, dev and test
Premium SSD (Premium_LRS)     production. Performance tied to SIZE.
Premium SSD v2 (PremiumV2_LRS) performance set SEPARATELY from size
Ultra Disk (UltraSSD_LRS)     highest performance, most restrictions
```

## The Premium SSD size trap

With Premium SSD, IOPS and throughput come from the disk size tier.

```text
P10   128 GB    500 IOPS    100 MB/s
P20   512 GB    2,300 IOPS  150 MB/s
P30   1 TB      5,000 IOPS  200 MB/s
P40   2 TB      7,500 IOPS  250 MB/s
```

So needing 5,000 IOPS means buying a 1 TB disk even if you store 100 GB. That is the classic overspend in Azure virtual machine estates.

Premium SSD v2 removes it:

```bash
az disk create \
  --name disk-shop-data --resource-group rg-shop-prod-uks \
  --size-gb 128 --sku PremiumV2_LRS \
  --disk-iops-read-write 8000 --disk-mbps-read-write 300 --zone 1
```

128 GB with 8,000 IOPS, which Premium SSD cannot do at any size below 2 TB. For IOPS heavy and space light workloads, v2 is substantially cheaper.

Note v2 disks are zonal only, cannot be used as OS disks in every configuration, and are not available in every region. Check before designing around them.

## The virtual machine is also a limit

This catches everyone. Disk performance is capped by **both** the disk and the virtual machine size.

```bash
az vm list-skus --location uksouth --size Standard_D4s_v5 \
  --query "[0].capabilities[?name=='UncachedDiskIOPS' || name=='UncachedDiskBytesPerSecond']" -o table
```

A `Standard_D2s_v5` caps at a few thousand IOPS regardless of how fast the disks are. Attaching four premium disks to a small virtual machine achieves nothing.

Check the machine's limit before buying disk performance, because the bottleneck is often the machine.

## Caching

```bash
az vm disk attach --vm-name vm-shop-01 --resource-group rg-shop-prod-uks \
  --name disk-shop-data --caching ReadOnly
```

```text
None       write heavy data disks, and required for some database configurations
ReadOnly   read heavy data disks. Default for data disks is None.
ReadWrite  OS disks. Default for OS disks.
```

**Never use ReadWrite caching on a database data disk or a log disk.** The host cache can reorder or lose writes on a host failure, and database engines expect write ordering they are not getting. SQL Server guidance is ReadOnly for data files and None for log files.

## Bursting

```text
Premium SSD up to P20   credit based bursting, on by default, free
Premium SSD P30+        on demand bursting, paid, enable explicitly
```

Credit based bursting lets a small disk reach 3,500 IOPS in short bursts, accumulating credits while idle. That covers spiky workloads without paying for a larger disk.

It also means a benchmark run right after provisioning shows numbers the disk cannot sustain. Test under sustained load, not for thirty seconds.

## Snapshots and images

```bash
az snapshot create \
  --name snap-shop-data-20260907 --resource-group rg-shop-prod-uks \
  --source disk-shop-data --incremental true

az disk create --name disk-restored --resource-group rg-shop-prod-uks \
  --source snap-shop-data-20260907
```

`--incremental true` stores only changes since the last snapshot of that disk, which is far cheaper for a regular snapshot schedule.

A snapshot is a point in time copy of the disk. It is **not** application consistent unless the application was quiesced, so a database snapshot taken while writes are in flight may need recovery on restore. Use Azure Backup for application consistent backups.

## Encryption

Everything is encrypted at rest by default with platform managed keys.

```bash
az disk-encryption-set create \
  --name des-shop --resource-group rg-shop-prod-uks \
  --key-url https://kv-shop-prod.vault.azure.net/keys/disk-key/ \
  --source-vault /subscriptions/.../vaults/kv-shop-prod

az disk create --name disk-shop-data --resource-group rg-shop-prod-uks \
  --size-gb 512 --sku Premium_LRS \
  --disk-encryption-set des-shop
```

```text
Platform managed keys       default, free, nothing to do
Customer managed keys       your key in Key Vault, for compliance
Encryption at host          encrypts temp disk and caches too, free, opt in
Confidential disk encryption  for confidential computing sizes
```

Encryption at host is worth enabling. It covers the temporary disk and host caches, which platform encryption alone does not.

```bash
az vm update --name vm-shop-01 --resource-group rg-shop-prod-uks \
  --set securityProfile.encryptionAtHost=true
```

The virtual machine must be deallocated to change it, and the feature must be registered on the subscription first.

## Resizing

```bash
az vm deallocate --name vm-shop-01 --resource-group rg-shop-prod-uks
az disk update --name disk-shop-data --resource-group rg-shop-prod-uks --size-gb 1024
az vm start --name vm-shop-01 --resource-group rg-shop-prod-uks
```

**Disks can grow and never shrink.** Growing usually needs the virtual machine deallocated, though Premium SSD v2 and some configurations support live expansion.

After growing the disk, the file system inside still needs extending:

```bash
sudo growpart /dev/sdc 1
sudo resize2fs /dev/sdc1
```

Forgetting that step is why "I resized the disk and nothing changed" is a common question.

## Shared disks

```bash
az disk create --name disk-cluster --resource-group rg-shop-prod-uks \
  --size-gb 1024 --sku Premium_LRS --max-shares 2 --zone 1
```

A disk attached to more than one virtual machine, for clustered applications like SQL Server failover clusters. It requires a cluster aware file system, since two machines writing to an ordinary file system will corrupt it.

## Costs

```text
Billed on PROVISIONED size, not used size
A 1 TB disk storing 10 GB costs 1 TB
Snapshots are billed for the data they hold, and incremental ones for changes
An unattached disk still bills
```

```bash
az disk list --query "[?diskState=='Unattached'].{Name:name, Size:diskSizeGb, Sku:sku.name, RG:resourceGroup}" -o table
```

Unattached disks left behind by deleted virtual machines are one of the most common sources of quiet waste. That command is worth running monthly.

## Quick recap

- A zonal disk only attaches to a virtual machine in the same zone.
- Premium SSD ties performance to size, and Premium SSD v2 separates them.
- The virtual machine size caps disk performance too, and is often the real bottleneck.
- Never use ReadWrite host caching on database data or log disks.
- Bursting means a short benchmark shows numbers the disk cannot sustain.
- Disks grow and never shrink, and the file system inside needs extending separately.
- Billing is on provisioned size, and unattached disks keep billing.

<code id="code-content" class="language-bash">
# A ZONAL DISK ONLY ATTACHES TO A VM IN THE SAME ZONE. Getting this wrong
# means recreating the disk.
az disk create --name disk-shop-data --resource-group rg-shop-prod-uks \
  --size-gb 512 --sku Premium_LRS --zone 1
az vm disk attach --vm-name vm-shop-01 --resource-group rg-shop-prod-uks \
  --name disk-shop-data --caching ReadOnly
# THE PREMIUM SSD SIZE TRAP: IOPS come from the SIZE TIER.
#   P10 128GB 500 IOPS | P20 512GB 2,300 | P30 1TB 5,000 | P40 2TB 7,500
# Needing 5,000 IOPS means buying 1 TB even to store 100 GB. The classic
# overspend in Azure VM estates.
# PREMIUM SSD v2 SETS PERFORMANCE SEPARATELY FROM SIZE:
az disk create --name disk-shop-data --resource-group rg-shop-prod-uks \
  --size-gb 128 --sku PremiumV2_LRS --disk-iops-read-write 8000 \
  --disk-mbps-read-write 300 --zone 1
# 128 GB at 8,000 IOPS, which Premium SSD cannot do below 2 TB.
# THE VM IS ALSO A LIMIT, and this catches everyone. A Standard_D2s_v5 caps
# at a few thousand IOPS however fast the disks are. CHECK THE MACHINE
# BEFORE BUYING DISK PERFORMANCE, because it is often the real bottleneck.
az vm list-skus --location uksouth --size Standard_D4s_v5 \
  --query "[0].capabilities[?name=='UncachedDiskIOPS']" -o table
# CACHING. NEVER ReadWrite ON A DATABASE DATA OR LOG DISK: the host cache
# can reorder or lose writes on a host failure, and the engine expects
# write ordering it is not getting.
#   None (write heavy, DB logs) | ReadOnly (read heavy, DB data) | ReadWrite (OS)
# BURSTING means a benchmark right after provisioning shows numbers the
# disk CANNOT SUSTAIN. Test under sustained load, not for thirty seconds.
# SNAPSHOTS: --incremental stores only changes since the last one, far
# cheaper on a schedule. A snapshot is NOT application consistent unless the
# app was quiesced, so a database may need recovery on restore.
az snapshot create --name snap-shop-data-20260907 --resource-group rg-shop-prod-uks \
  --source disk-shop-data --incremental true
# ENCRYPTION AT HOST covers the TEMP DISK AND HOST CACHES, which platform
# encryption alone does not. Free, opt in, needs the VM deallocated.
az vm update --name vm-shop-01 --resource-group rg-shop-prod-uks \
  --set securityProfile.encryptionAtHost=true
# DISKS GROW AND NEVER SHRINK, usually with the VM deallocated. THEN THE
# FILE SYSTEM INSIDE STILL NEEDS EXTENDING, which is why "I resized it and
# nothing changed" is such a common question:
az disk update --name disk-shop-data --resource-group rg-shop-prod-uks --size-gb 1024
sudo growpart /dev/sdc 1 &amp;&amp; sudo resize2fs /dev/sdc1
# BILLED ON PROVISIONED SIZE, NOT USED. A 1 TB disk holding 10 GB costs
# 1 TB, and an UNATTACHED disk KEEPS BILLING. Run this monthly:
az disk list -o table \
  --query "[?diskState=='Unattached'].{Name:name, Size:diskSizeGb, Sku:sku.name}"
</code></pre>
