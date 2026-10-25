---
publishDate: 2026-10-05T07:15
title: Network Security Groups and Application Security Groups
slug: network-security-groups
metadescription: Filter traffic with network security groups, understand rule priority and the default rules, and use application security groups to keep rules readable.
updateDate: 2026-09-07T07:15
author: ['bishal-biswas']
level: 2
tags: ['networking', 'security', 'nsg']
course: azure
---

## What an NSG does

A network security group is a list of allow and deny rules applied to a subnet or a network interface. It filters traffic by source, destination, port and protocol.

```bash
az network nsg create --name nsg-app --resource-group rg-shop-prod-uks

az network nsg rule create \
  --nsg-name nsg-app --resource-group rg-shop-prod-uks \
  --name allow-https \
  --priority 100 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --source-address-prefixes Internet \
  --destination-port-ranges 443
```

Attach it to a subnet, which is usually the right level:

```bash
az network vnet subnet update \
  --name snet-app --vnet-name vnet-shop-prod-uks \
  --resource-group rg-shop-prod-uks --network-security-group nsg-app
```

## Priority

Rules are evaluated in priority order, lowest number first, and **the first match wins**. Nothing after it is considered.

```text
100  Allow HTTPS from Internet
200  Allow SSH from 10.0.1.0/24
300  Deny all from Internet
4096 the default rules
```

Priority ranges from 100 to 4096. Leave gaps, because inserting a rule between 100 and 101 means renumbering.

A deny at 200 makes an allow at 300 dead code, and that mistake is easy to make and hard to spot in a long list.

## Default rules

Every NSG has rules you cannot delete, at the bottom of the priority order.

```text
Inbound
  65000  AllowVnetInBound              traffic within the vnet
  65001  AllowAzureLoadBalancerInBound health probes
  65500  DenyAllInBound

Outbound
  65000  AllowVnetOutBound
  65001  AllowInternetOutBound
  65500  DenyAllOutBound
```

Two consequences worth internalising:

**Inbound from the internet is denied by default.** You must allow explicitly.

**Outbound to the internet is allowed by default.** Everything can call out. Locking that down is a deliberate act, and it breaks things until you allow what is genuinely needed.

**Do not block AllowAzureLoadBalancerInBound.** Health probes come from `168.63.129.16`, and blocking them makes a load balancer mark every backend unhealthy. This is a genuinely common outage.

## Service tags

Instead of maintaining IP ranges, use a service tag. Microsoft keeps them current.

```bash
az network nsg rule create \
  --nsg-name nsg-data --resource-group rg-shop-prod-uks \
  --name allow-sql-outbound \
  --priority 100 --direction Outbound --access Allow --protocol Tcp \
  --source-address-prefixes VirtualNetwork \
  --destination-address-prefixes Sql.UKSouth \
  --destination-port-ranges 1433
```

```text
Internet              everything outside
VirtualNetwork        this vnet and peered vnets
AzureLoadBalancer     health probes
Storage.UKSouth       storage in one region
Sql.UKSouth           Azure SQL in one region
AzureKeyVault         Key Vault
AzureActiveDirectory  Entra ID endpoints
AzureMonitor          monitoring ingestion
```

Regional tags are narrower than global ones. `Storage` means storage everywhere, `Storage.UKSouth` means one region, and the narrower tag is the better rule.

```bash
az network list-service-tags --location uksouth --query "values[].name" --output tsv
```

## Application security groups

An ASG is a named group of network interfaces. Rules reference the name, not addresses.

```bash
az network asg create --name asg-web --resource-group rg-shop-prod-uks
az network asg create --name asg-data --resource-group rg-shop-prod-uks

az network nic ip-config update \
  --nic-name nic-web-01 --resource-group rg-shop-prod-uks \
  --name ipconfig1 --application-security-groups asg-web

az network nsg rule create \
  --nsg-name nsg-shared --resource-group rg-shop-prod-uks \
  --name web-to-data \
  --priority 100 --direction Inbound --access Allow --protocol Tcp \
  --source-asgs asg-web \
  --destination-asgs asg-data \
  --destination-port-ranges 1433
```

That rule reads as intent: web servers may reach data servers on 1433. Add a new web server to the ASG and it inherits the rule with no edit.

Compare it to the IP based version, which is a list of addresses nobody can interpret in six months.

## Subnet or NIC

```text
Subnet level  applies to everything in the subnet. Usually right.
NIC level     applies to one interface. For exceptions.
```

If both exist, **inbound traffic passes the subnet NSG first, then the NIC NSG, and both must allow it.** Outbound is the reverse order. Two NSGs on one path is a classic source of confusion, so prefer subnet level alone.

## Debugging

```bash
az network nic list-effective-nsg \
  --name nic-web-01 --resource-group rg-shop-prod-uks --output json
```

Effective rules are what is actually applied, combining subnet and NIC rules. Start here rather than reading rule lists.

```bash
az network watcher test-ip-flow \
  --vm shop-vm-01 --resource-group rg-shop-prod-uks \
  --direction Inbound --protocol TCP \
  --local 10.20.1.4:443 --remote 203.0.113.10:51234
```

This answers "would this packet be allowed" and names the rule that decides. It is the fastest way to settle an argument about why something is blocked.

NSG flow logs record what actually happened, going to a storage account and readable in Traffic Analytics. Enable them in production, because they answer questions after the fact that nothing else can.

## What NSGs cannot do

```text
No FQDN filtering        addresses and service tags only
No deep inspection       no TLS inspection, no threat detection
No application awareness  it is a port and address filter
```

For FQDN rules, TLS inspection or threat intelligence, use Azure Firewall. For HTTP layer filtering, use Application Gateway with WAF. NSGs are the cheap, fast first layer, and they sit alongside those rather than replacing them.

## Common mistakes

**Allowing SSH or RDP from Internet.** A management port open to the world is scanned within minutes. Use Bastion, or restrict to known addresses.

**Blocking the load balancer.** Every backend goes unhealthy.

**A broad deny above a needed allow.** First match wins, so the allow never runs.

**Forgetting outbound is open by default.** Assuming otherwise leads to unpleasant surprises.

**Both subnet and NIC NSGs.** Both must allow, and it doubles the debugging.

## Quick recap

- Rules evaluate in priority order and the first match wins, so a broad deny can hide later allows.
- Inbound from the internet is denied by default, outbound to it is allowed.
- Never block AllowAzureLoadBalancerInBound, or every backend goes unhealthy.
- Service tags replace IP lists, and regional tags are narrower than global ones.
- Application security groups make rules read as intent instead of addresses.
- Prefer subnet level NSGs, because two on one path must both allow the traffic.
- Use effective NSG rules and `test-ip-flow` to debug, not the rule list.

<code id="code-content" class="language-bash">
# An NSG filters by source, destination, port and protocol, on a SUBNET
# (usually right) or a NIC (for exceptions).
az network nsg rule create --nsg-name nsg-app --resource-group rg-shop-prod-uks \
  --name allow-https --priority 100 --direction Inbound --access Allow \
  --protocol Tcp --source-address-prefixes Internet --destination-port-ranges 443
# PRIORITY: lowest number first, and THE FIRST MATCH WINS. Nothing after it
# is considered, so a broad deny at 200 makes an allow at 300 dead code.
# Leave gaps: inserting between 100 and 101 means renumbering.
# DEFAULT RULES you cannot delete, at the bottom:
#   65000 AllowVnetInBound   65001 AllowAzureLoadBalancerInBound
#   65500 DenyAllInBound     65001 AllowInternetOutBound (!)
# So: INBOUND from the internet is DENIED by default. OUTBOUND to it is
# ALLOWED. Everything can call out until you deliberately stop it.
# NEVER BLOCK AllowAzureLoadBalancerInBound. Probes come from 168.63.129.16
# and blocking them marks EVERY backend unhealthy. A common real outage.
# SERVICE TAGS replace IP lists, and Microsoft keeps them current. Regional
# tags are narrower than global ones, so prefer Storage.UKSouth to Storage.
az network nsg rule create --nsg-name nsg-data --resource-group rg-shop-prod-uks \
  --name allow-sql-out --priority 100 --direction Outbound --access Allow \
  --protocol Tcp --source-address-prefixes VirtualNetwork \
  --destination-address-prefixes Sql.UKSouth --destination-port-ranges 1433
az network list-service-tags --location uksouth --query "values[].name" -o tsv
# APPLICATION SECURITY GROUPS make a rule read as INTENT rather than as a
# list of addresses nobody can interpret in six months.
az network nsg rule create --nsg-name nsg-shared --resource-group rg-shop-prod-uks \
  --name web-to-data --priority 100 --direction Inbound --access Allow \
  --protocol Tcp --source-asgs asg-web --destination-asgs asg-data \
  --destination-port-ranges 1433
# Add a new web server to asg-web and it inherits the rule, no edit needed.
# If BOTH a subnet and a NIC NSG exist, BOTH must allow the traffic
# (inbound: subnet then NIC, outbound the reverse). Prefer subnet alone.
# DEBUG WITH EFFECTIVE RULES, not the rule list:
az network nic list-effective-nsg --name nic-web-01 --resource-group rg-shop-prod-uks
# And ask directly "would this packet be allowed", naming the deciding rule:
az network watcher test-ip-flow --vm shop-vm-01 --resource-group rg-shop-prod-uks \
  --direction Inbound --protocol TCP --local 10.20.1.4:443 --remote 203.0.113.10:51234
# NSGs CANNOT do FQDN filtering, TLS inspection or threat detection. For
# those use Azure Firewall, or Application Gateway with WAF for HTTP.
</code></pre>
