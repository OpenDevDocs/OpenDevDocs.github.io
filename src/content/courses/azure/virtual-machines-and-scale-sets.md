---
publishDate: 2026-10-08T07:55
title: Virtual Machines and Scale Sets
slug: virtual-machines-and-scale-sets
metadescription: Create and manage Azure virtual machines, choose the right size and disks, and scale automatically with virtual machine scale sets.
updateDate: 2026-09-07T07:55
author: ['bishal-biswas']
level: 2
tags: ['compute', 'vm', 'scale sets']
course: azure
---

## Creating one

```bash
az vm create \
  --name vm-shop-01 --resource-group rg-shop-prod-uks \
  --image Ubuntu2404 \
  --size Standard_D2s_v5 \
  --admin-username azureuser \
  --generate-ssh-keys \
  --vnet-name vnet-shop-prod-uks --subnet snet-app \
  --public-ip-address "" \
  --nsg "" \
  --zone 1
```

Two arguments worth noticing. `--public-ip-address ""` gives no public address, which is what you want in production. `--nsg ""` avoids creating a NIC level NSG, so the subnet's NSG applies alone.

Reach it without a public IP through Bastion:

```bash
az network bastion ssh --name bast-hub --resource-group rg-hub-uks \
  --target-resource-id /subscriptions/.../virtualMachines/vm-shop-01 \
  --auth-type ssh-key --username azureuser --ssh-key ~/.ssh/id_rsa
```

Bastion means no management port is ever exposed. An SSH or RDP port open to the internet is scanned within minutes of existing.

## Sizes

The family letter tells you the intent.

```text
B   burstable. Cheap, accumulates credits when idle. Dev and light workloads.
D   general purpose. The default choice.
E   memory optimised. Databases, caches, in memory work.
F   compute optimised. Higher clock, less memory. Batch, gaming servers.
L   storage optimised. High local disk throughput.
N   GPU. Training, inference, rendering.
M   very large memory. SAP HANA and similar.
```

Suffixes matter too:

```text
s   premium storage capable. You almost always want this.
a   AMD processor, usually cheaper
d   local temporary disk included
v5, v6  generation. Newer is faster per pound.
```

`Standard_D4as_v5` is four vCPUs, general purpose, AMD, premium storage capable, generation 5.

```bash
az vm list-sizes --location uksouth \
  --query "[?numberOfCores==\`4\`].{Name:name, RAM:memoryInMb}" --output table
```

**B series are burstable.** They run at a baseline percentage and use credits to exceed it. Run one at full load continuously and it throttles to baseline, which looks like a mysterious slowdown after a few hours.

## Disks

```bash
az vm create ... \
  --os-disk-size-gb 128 \
  --storage-sku Premium_LRS \
  --data-disk-sizes-gb 256 512
```

```text
Standard HDD   cheapest, slow. Backups, archives.
Standard SSD   light workloads, dev
Premium SSD    production. Consistent performance.
Premium SSD v2  configure IOPS and throughput separately from size
Ultra Disk     highest performance, most expensive, most restrictions
```

Premium SSD v2 is the notable one. With Premium SSD, performance is tied to disk size, so you buy a large disk to get IOPS you need. With v2 you set size, IOPS and throughput independently, which is usually cheaper.

**The temporary disk is temporary.** `/dev/sdb` on Linux or `D:` on Windows is local, fast, and wiped on deallocation or host maintenance. Nothing you care about goes there.

```bash
az disk create --name disk-shop-data --resource-group rg-shop-prod-uks \
  --size-gb 512 --sku PremiumV2_LRS --disk-iops-read-write 8000 --disk-mbps-read-write 300 --zone 1

az vm disk attach --vm-name vm-shop-01 --resource-group rg-shop-prod-uks \
  --name disk-shop-data
```

## Availability

```text
Single VM                 SLA on premium disks only, and one host failure ends it
Availability set          spreads across fault and update domains in one datacentre
Availability zone         spreads across physically separate datacentres
Scale set with zones      the modern answer
```

Availability sets are the older mechanism and protect against rack level failure. Availability zones protect against a whole datacentre failing, and are better where the region supports them.

**Zones must be chosen at creation.** Moving a VM to a zone means recreating it.

## Scale sets

A scale set manages a group of identical virtual machines and adjusts the count.

```bash
az vmss create \
  --name vmss-shop --resource-group rg-shop-prod-uks \
  --image Ubuntu2404 --instance-count 3 \
  --vm-sku Standard_D2s_v5 \
  --zones 1 2 3 \
  --orchestration-mode Flexible \
  --vnet-name vnet-shop-prod-uks --subnet snet-app \
  --admin-username azureuser --generate-ssh-keys
```

**Use Flexible orchestration.** Uniform is the older mode; Flexible gives you real virtual machine objects you can manage individually, mixes sizes and spot instances, and is the recommended default now.

```bash
az monitor autoscale create \
  --resource-group rg-shop-prod-uks --resource vmss-shop \
  --resource-type Microsoft.Compute/virtualMachineScaleSets \
  --name autoscale-shop --min-count 2 --max-count 10 --count 3

az monitor autoscale rule create \
  --resource-group rg-shop-prod-uks --autoscale-name autoscale-shop \
  --condition "Percentage CPU > 70 avg 5m" --scale out 2

az monitor autoscale rule create \
  --resource-group rg-shop-prod-uks --autoscale-name autoscale-shop \
  --condition "Percentage CPU < 30 avg 10m" --scale in 1
```

Scale out faster than you scale in. Adding capacity quickly protects users; removing it slowly avoids thrashing when load fluctuates.

## Images

```bash
az sig create --resource-group rg-shared --gallery-name sigShop

az sig image-definition create \
  --resource-group rg-shared --gallery-name sigShop \
  --gallery-image-definition shop-base \
  --publisher contoso --offer ubuntu --sku 24_04-lts \
  --os-type Linux --hyper-v-generation V2

az sig image-version create \
  --resource-group rg-shared --gallery-name sigShop \
  --gallery-image-definition shop-base --gallery-image-version 1.0.0 \
  --managed-image /subscriptions/.../images/shop-base-image \
  --target-regions uksouth=1 northeurope=1
```

Azure Compute Gallery replicates images across regions and versions them. Building a base image with the agent, monitoring and hardening already applied makes new instances start fast and identically.

## Spot instances

```bash
az vm create --name vm-batch-01 --resource-group rg-batch \
  --image Ubuntu2404 --size Standard_D4s_v5 \
  --priority Spot --max-price -1 --eviction-policy Deallocate \
  --generate-ssh-keys
```

Spot uses spare capacity at up to 90 percent off, and Azure can take it back with 30 seconds notice.

Right for batch, rendering, CI agents and anything restartable. Wrong for anything holding state or serving users. `--max-price -1` means pay up to the standard price rather than being evicted on price.

## Keeping them alive

```bash
az vm auto-shutdown --name vm-dev-01 --resource-group rg-shop-dev-uks --time 1900
az vm deallocate --name vm-dev-01 --resource-group rg-shop-dev-uks
az vm start --name vm-dev-01 --resource-group rg-shop-dev-uks
```

**Stopped is not deallocated.** A stopped VM still bills for compute. Only `deallocate` releases it. This is a common and genuinely annoying bill surprise.

Auto shutdown on development machines is the single easiest saving in most subscriptions.

```bash
az vm update --name vm-shop-01 --resource-group rg-shop-prod-uks \
  --set "osProfile.linuxConfiguration.patchSettings.patchMode=AutomaticByPlatform"
```

Azure Update Manager handles patching across machines, on a schedule, with reporting. Anything else means someone remembering, and eventually they will not.

## Quick recap

- Create production virtual machines with no public IP and reach them through Bastion.
- The size family letter tells you the intent, and the `s` suffix gives premium storage.
- B series throttle to baseline once credits run out, which looks like a mystery slowdown.
- The temporary disk is wiped on deallocation, so nothing important goes there.
- Premium SSD v2 sets IOPS separately from size, and is usually cheaper than oversizing.
- Use Flexible orchestration for scale sets, and scale out faster than you scale in.
- Stopped still bills, only deallocated does not.

<code id="code-content" class="language-bash">
# PRODUCTION VMs GET NO PUBLIC IP. --nsg "" avoids a NIC level NSG too, so
# the subnet NSG applies alone.
az vm create --name vm-shop-01 --resource-group rg-shop-prod-uks \
  --image Ubuntu2404 --size Standard_D2s_v5 --admin-username azureuser \
  --generate-ssh-keys --vnet-name vnet-shop-prod-uks --subnet snet-app \
  --public-ip-address "" --nsg "" --zone 1
# Reach it through BASTION, so no management port is ever exposed. An open
# SSH or RDP port is scanned within minutes of existing.
az network bastion ssh --name bast-hub --resource-group rg-hub-uks \
  --target-resource-id /subscriptions/.../virtualMachines/vm-shop-01 \
  --auth-type ssh-key --username azureuser --ssh-key ~/.ssh/id_rsa
# SIZES. The family letter is the intent, the suffixes matter:
#   B burstable  D general  E memory  F compute  L storage  N GPU  M huge memory
#   s premium storage capable (you want this)   a AMD   d local temp disk
# Standard_D4as_v5 = 4 vCPU, general, AMD, premium capable, generation 5.
# B SERIES THROTTLE to baseline once credits run out. It looks like a
# mysterious slowdown a few hours in.
# DISKS. Premium SSD ties performance to SIZE, so you buy a big disk for
# IOPS. Premium SSD v2 sets size, IOPS and throughput SEPARATELY, and is
# usually cheaper.
az disk create --name disk-shop-data --resource-group rg-shop-prod-uks \
  --size-gb 512 --sku PremiumV2_LRS --disk-iops-read-write 8000 \
  --disk-mbps-read-write 300 --zone 1
# THE TEMPORARY DISK IS TEMPORARY. /dev/sdb or D: is wiped on deallocation
# and host maintenance. Nothing you care about goes there.
# SCALE SETS: USE FLEXIBLE ORCHESTRATION. Uniform is the older mode.
# Flexible gives real VM objects, mixed sizes and spot, and is the default now.
az vmss create --name vmss-shop --resource-group rg-shop-prod-uks \
  --image Ubuntu2404 --instance-count 3 --vm-sku Standard_D2s_v5 \
  --zones 1 2 3 --orchestration-mode Flexible \
  --vnet-name vnet-shop-prod-uks --subnet snet-app --generate-ssh-keys
# SCALE OUT FAST, SCALE IN SLOWLY. Adding capacity protects users, removing
# it slowly avoids thrashing when load fluctuates.
az monitor autoscale rule create --resource-group rg-shop-prod-uks \
  --autoscale-name autoscale-shop --condition "Percentage CPU &gt; 70 avg 5m" --scale out 2
az monitor autoscale rule create --resource-group rg-shop-prod-uks \
  --autoscale-name autoscale-shop --condition "Percentage CPU &lt; 30 avg 10m" --scale in 1
# SPOT: up to 90% off spare capacity, taken back with 30 seconds notice.
# Right for batch, CI agents and rendering. Wrong for anything with state.
az vm create --name vm-batch-01 --resource-group rg-batch --image Ubuntu2404 \
  --priority Spot --max-price -1 --eviction-policy Deallocate --generate-ssh-keys
# STOPPED IS NOT DEALLOCATED. A stopped VM STILL BILLS FOR COMPUTE. Only
# deallocate releases it, and this surprises people every month.
az vm deallocate --name vm-dev-01 --resource-group rg-shop-dev-uks
az vm auto-shutdown --name vm-dev-01 --resource-group rg-shop-dev-uks --time 1900
</code></pre>
