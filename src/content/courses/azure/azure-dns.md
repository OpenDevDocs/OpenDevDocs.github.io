---
publishDate: 2026-10-07T07:40
title: DNS in Azure
slug: azure-dns
metadescription: Host public zones in Azure DNS, resolve names privately with private DNS zones, and use alias records where CNAME is not allowed.
updateDate: 2026-09-07T07:40
author: ['bishal-biswas']
level: 2
tags: ['networking', 'dns']
course: azure
---

## Two different things

```text
Public DNS zone   answers queries from the internet for your domain
Private DNS zone  answers queries only from linked virtual networks
```

They look similar and solve unrelated problems. Public zones publish your domain. Private zones give internal names, and make private endpoints work.

## Public zones

```bash
az network dns zone create --name example.com --resource-group rg-shop-dns

az network dns zone show --name example.com --resource-group rg-shop-dns \
  --query nameServers --output tsv
```

Creating the zone does not make it authoritative. You must set those four name servers at your registrar, and until you do the zone answers nobody.

```bash
az network dns record-set a add-record \
  --zone-name example.com --resource-group rg-shop-dns \
  --record-set-name www --ipv4-address 20.1.2.3 --ttl 3600

az network dns record-set cname set-record \
  --zone-name example.com --resource-group rg-shop-dns \
  --record-set-name shop --cname shop-abc.z01.azurefd.net --ttl 3600

az network dns record-set txt add-record \
  --zone-name example.com --resource-group rg-shop-dns \
  --record-set-name @ --value "v=spf1 include:spf.protection.outlook.com -all"

az network dns record-set list --zone-name example.com \
  --resource-group rg-shop-dns \
  --query "[].{Name:name, Type:type, TTL:ttl}" --output table
```

## Alias records

The apex problem: DNS does not allow a CNAME at the zone apex, so `example.com` cannot be a CNAME to `shop.azurefd.net`. An A record with a hard coded IP works until the IP changes.

Alias records solve it.

```bash
az network dns record-set a create \
  --name @ --zone-name example.com --resource-group rg-shop-dns \
  --target-resource /subscriptions/.../publicIPAddresses/pip-shop

az network dns record-set a create \
  --name @ --zone-name example.com --resource-group rg-shop-dns \
  --target-resource /subscriptions/.../Microsoft.Cdn/profiles/afd-shop/afdEndpoints/shop
```

The record points at the **Azure resource**, not an address. Azure keeps it correct, and if the resource is deleted the record stops answering rather than pointing at an address someone else now owns.

That last part matters. A dangling A record pointing at a released public IP is a real subdomain takeover risk, and alias records remove it.

```text
Alias record targets:
  public IP address
  Front Door endpoint
  Traffic Manager profile
  another record set in the same zone
```

## TTL

```text
3600  one hour. Sensible default.
300   five minutes. Before a planned change.
60    one minute. During a migration.
86400 a day. For records that never move.
```

Lower the TTL a day or two **before** a change, not on the day. Clients have already cached the old value at the old TTL, so a last minute reduction does nothing.

## Private DNS zones

```bash
az network private-dns zone create \
  --name shop.internal --resource-group rg-shop-prod-uks

az network private-dns link vnet create \
  --zone-name shop.internal --resource-group rg-shop-prod-uks \
  --name link-prod --virtual-network vnet-shop-prod-uks \
  --registration-enabled true
```

`--registration-enabled true` makes virtual machines in that network register themselves automatically, so a VM named `web-01` becomes `web-01.shop.internal` without anyone creating a record.

**Only one linked network per zone can have registration enabled.** Every other link is resolution only.

```bash
az network private-dns record-set a add-record \
  --zone-name shop.internal --resource-group rg-shop-prod-uks \
  --record-set-name api --ipv4-address 10.20.1.50
```

## Private endpoint zones

The main reason most people meet private DNS zones. The zone name must be exactly the privatelink name for the service:

```text
privatelink.blob.core.windows.net
privatelink.vaultcore.azure.net
privatelink.database.windows.net
privatelink.azurewebsites.net
```

Let the private endpoint's DNS zone group maintain the records, rather than adding them by hand.

Centralise these in the hub and link every spoke, so resolution is identical everywhere.

## Hybrid resolution

Two directions, and they need different things.

**Azure resolving on premises names.** Point the virtual network at custom DNS servers that forward to your on premises servers, or use a conditional forwarder in Azure DNS Private Resolver.

**On premises resolving Azure private names.** On premises DNS cannot query Azure private zones directly. It needs to forward to something inside the virtual network that can reach `168.63.129.16`.

```bash
az dns-resolver create \
  --name dnspr-hub --resource-group rg-hub-uks \
  --location uksouth --id /subscriptions/.../virtualNetworks/vnet-hub-uks

az dns-resolver inbound-endpoint create \
  --dns-resolver-name dnspr-hub --resource-group rg-hub-uks \
  --name inbound --ip-configurations '[{"privateIpAllocationMethod":"Dynamic","id":"/subscriptions/.../subnets/snet-dns-inbound"}]'
```

Azure DNS Private Resolver replaced the old pattern of running two DNS forwarder virtual machines. It is a managed service, it needs its own delegated subnets, and it removes two VMs nobody wanted to patch.

```text
Inbound endpoint   on premises forwards here to resolve Azure private names
Outbound endpoint  Azure forwards from here to on premises
Forwarding ruleset attached to a vnet, saying which domains go where
```

## Debugging

```bash
nslookup api.shop.internal
nslookup stshopprod.blob.core.windows.net
dig +short shop.example.com
```

From inside the virtual network, a private name must resolve to a private address. If it does not, check in this order:

```text
1. Is the zone linked to THIS virtual network?
2. Does the record exist in the zone?
3. Is the vnet using custom DNS servers that do not know about the zone?
4. Is something caching the old answer?
```

Point three is the common one. Setting custom DNS servers on a virtual network **overrides Azure provided DNS entirely**, so private zones stop resolving unless those servers forward to `168.63.129.16`.

```bash
az network vnet show --name vnet-shop-prod-uks --resource-group rg-shop-prod-uks \
  --query "dhcpOptions.dnsServers"

az network private-dns link vnet list --zone-name privatelink.blob.core.windows.net \
  --resource-group rg-hub-uks --query "[].{Name:name, Vnet:virtualNetwork.id}" -o table
```

## Quick recap

- A public zone is not authoritative until the name servers are set at the registrar.
- Alias records solve the apex CNAME problem and prevent dangling records after a resource is deleted.
- Lower TTLs a day or two before a change, since clients already cached the old value.
- Only one linked network per private zone can auto register virtual machines.
- Private endpoint zones must use the exact privatelink name, maintained by a DNS zone group.
- Custom DNS servers override Azure provided DNS, which breaks private zones unless they forward to 168.63.129.16.
- Azure DNS Private Resolver replaces DNS forwarder virtual machines for hybrid resolution.

<code id="code-content" class="language-bash">
# TWO DIFFERENT THINGS. Public zones publish your domain to the internet.
# Private zones answer only from LINKED virtual networks, and are what make
# private endpoints work.
az network dns zone create --name example.com --resource-group rg-shop-dns
# CREATING THE ZONE DOES NOT MAKE IT AUTHORITATIVE. Set these four name
# servers at your REGISTRAR, or the zone answers nobody.
az network dns zone show --name example.com --resource-group rg-shop-dns \
  --query nameServers -o tsv
# ALIAS RECORDS solve the apex problem: DNS forbids a CNAME at the zone
# apex, so example.com cannot CNAME to shop.azurefd.net, and a hard coded A
# record breaks when the address changes.
az network dns record-set a create --name @ --zone-name example.com \
  --resource-group rg-shop-dns \
  --target-resource /subscriptions/.../publicIPAddresses/pip-shop
# It points at the RESOURCE. If that resource is deleted the record stops
# answering, instead of pointing at an address someone else now owns.
# THAT IS A REAL SUBDOMAIN TAKEOVER RISK, and alias records remove it.
# TTL: lower it a day or two BEFORE a change, not on the day. Clients have
# already cached the old value at the OLD TTL.
# PRIVATE ZONES. registration-enabled makes VMs register themselves, so
# web-01 becomes web-01.shop.internal with no record created by hand.
# ONLY ONE LINKED NETWORK PER ZONE may have registration enabled.
az network private-dns link vnet create --zone-name shop.internal \
  --resource-group rg-shop-prod-uks --name link-prod \
  --virtual-network vnet-shop-prod-uks --registration-enabled true
# HYBRID, both directions:
#   Azure -&gt; on premises   custom DNS, or an OUTBOUND endpoint and ruleset
#   on premises -&gt; Azure   forward to an INBOUND endpoint inside the vnet
# Azure DNS Private Resolver is the managed replacement for running two DNS
# forwarder VMs nobody wanted to patch.
az dns-resolver create --name dnspr-hub --resource-group rg-hub-uks \
  --location uksouth --id /subscriptions/.../virtualNetworks/vnet-hub-uks
# DEBUG IN THIS ORDER when a private name resolves to a public address:
#   1. is the zone LINKED to THIS vnet?
#   2. does the record exist?
#   3. does the vnet use CUSTOM DNS servers?   &lt;- the common one
#   4. is something caching the old answer?
# Setting custom DNS OVERRIDES Azure provided DNS entirely, so private zones
# stop resolving unless those servers forward to 168.63.129.16.
az network vnet show --name vnet-shop-prod-uks \
  --resource-group rg-shop-prod-uks --query "dhcpOptions.dnsServers"
</code></pre>
