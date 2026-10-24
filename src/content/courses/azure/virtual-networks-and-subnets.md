---
publishDate: 2026-10-05T07:10
title: Virtual Networks and Subnets
slug: virtual-networks-and-subnets
metadescription: Design Azure virtual networks and subnets, plan address space that will not need renumbering, and connect networks with peering.
updateDate: 2026-09-07T07:10
author: ['bishal-biswas']
level: 2
tags: ['networking', 'vnet', 'subnets']
course: azure
---

## What a virtual network is

A virtual network is a private address space in one region. Resources inside it reach each other privately, and nothing outside reaches in unless you allow it.

```bash
az network vnet create \
  --name vnet-shop-prod-uks \
  --resource-group rg-shop-prod-uks \
  --location uksouth \
  --address-prefixes 10.20.0.0/16
```

Two constraints to remember from the start:

```text
A virtual network lives in exactly one region.
An address space cannot overlap with any network you might peer or connect to.
```

The second is the one that hurts later. Overlapping ranges cannot be peered, and fixing it means renumbering a live environment.

## Planning address space

Decide the whole plan before creating anything, even the parts you will not build for a year.

```text
10.0.0.0/16    hub, shared services
10.10.0.0/16   dev
10.20.0.0/16   production, UK South
10.30.0.0/16   production, North Europe
10.40.0.0/16   future
```

A /16 gives 65,536 addresses. That is generous, and generosity here is cheap: unused address space costs nothing, and running out costs a migration.

Avoid the ranges your office or VPN already uses. `192.168.0.0/16` and `10.0.0.0/24` are common in home and office routers, and a clash means someone cannot reach Azure from home.

## Subnets

```bash
az network vnet subnet create \
  --name snet-app \
  --vnet-name vnet-shop-prod-uks \
  --resource-group rg-shop-prod-uks \
  --address-prefixes 10.20.1.0/24

az network vnet subnet create --name snet-data \
  --vnet-name vnet-shop-prod-uks --resource-group rg-shop-prod-uks \
  --address-prefixes 10.20.2.0/24

az network vnet subnet list --vnet-name vnet-shop-prod-uks \
  --resource-group rg-shop-prod-uks \
  --query "[].{Name:name, Prefix:addressPrefix}" --output table
```

**Azure reserves five addresses in every subnet.** A /24 gives 251 usable, not 256.

```text
x.x.x.0   network address
x.x.x.1   default gateway
x.x.x.2   DNS mapping
x.x.x.3   DNS mapping
x.x.x.255 broadcast
```

Smallest usable subnet is /29, which leaves three addresses. In practice /27 or larger avoids awkward corners.

## Subnets some services demand

Several services require a dedicated, exactly named subnet, and delegate it so nothing else can use it.

```text
GatewaySubnet          VPN or ExpressRoute gateway. /27 minimum, name is fixed.
AzureFirewallSubnet    /26 minimum, name is fixed.
AzureBastionSubnet     /26 minimum, name is fixed.
Delegated subnets      App Service integration, Container Apps, flexible servers
```

The names are literal. `GatewaySubnet` works, `gateway-subnet` does not.

```bash
az network vnet subnet create \
  --name snet-containerapps \
  --vnet-name vnet-shop-prod-uks --resource-group rg-shop-prod-uks \
  --address-prefixes 10.20.16.0/23 \
  --delegations Microsoft.App/environments
```

Container Apps environments want a /23 or larger. AKS wants far more, depending on the networking mode. Size these before creating them, because **growing a subnet requires it to be empty**.

## Peering

Peering connects two virtual networks so resources address each other directly. It works across regions and across subscriptions.

```bash
az network vnet peering create \
  --name hub-to-shop \
  --resource-group rg-hub-uks --vnet-name vnet-hub-uks \
  --remote-vnet /subscriptions/.../virtualNetworks/vnet-shop-prod-uks \
  --allow-vnet-access --allow-forwarded-traffic

az network vnet peering create \
  --name shop-to-hub \
  --resource-group rg-shop-prod-uks --vnet-name vnet-shop-prod-uks \
  --remote-vnet /subscriptions/.../virtualNetworks/vnet-hub-uks \
  --allow-vnet-access --allow-forwarded-traffic
```

**Peering must be created on both sides.** One side alone shows as Initiated and does not carry traffic. This is the most common peering problem, and the fix is to create the other half.

**Peering is not transitive.** A peered to B and B peered to C does not let A reach C. To route through a hub you need a firewall or network virtual appliance in the middle, and user defined routes pointing at it.

## Hub and spoke

The standard topology:

```text
              hub vnet 10.0.0.0/16
              firewall, gateway, DNS, Bastion
                 /            |            \
      spoke dev        spoke prod       spoke data
      10.10.0.0/16    10.20.0.0/16     10.50.0.0/16
```

Shared services live once, in the hub. Spokes peer to the hub, not to each other, and spoke to spoke traffic routes through the firewall where it can be inspected.

Note that peering traffic is charged in both directions, so a chatty spoke to spoke path through a hub costs more than it looks.

## Routing

Azure creates system routes automatically. A user defined route overrides them, usually to force traffic through a firewall.

```bash
az network route-table create --name rt-spoke --resource-group rg-shop-prod-uks

az network route-table route create \
  --route-table-name rt-spoke --resource-group rg-shop-prod-uks \
  --name default-via-firewall \
  --address-prefix 0.0.0.0/0 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address 10.0.1.4

az network vnet subnet update \
  --name snet-app --vnet-name vnet-shop-prod-uks \
  --resource-group rg-shop-prod-uks --route-table rt-spoke
```

That sends all outbound traffic through the firewall. Get the firewall's address wrong and everything in the subnet loses connectivity, so check it before applying.

```bash
az network nic show-effective-route-table \
  --name nic-shop-vm --resource-group rg-shop-prod-uks --output table
```

Effective routes are the truth. They combine system routes, user defined routes and anything from a gateway, and this command is where to look when traffic goes somewhere unexpected.

## DNS

By default, resources use Azure provided DNS and resolve each other by hostname within a virtual network.

```bash
az network vnet update \
  --name vnet-shop-prod-uks --resource-group rg-shop-prod-uks \
  --dns-servers 10.0.1.10 10.0.1.11
```

Custom DNS servers are needed for on premises name resolution, and private endpoints need private DNS zones. Both have their own topics, and DNS is the cause of a surprising share of hybrid networking problems.

## Growing later

```text
Adding an address space to a vnet     allowed
Adding a subnet                       allowed
Resizing a subnet with resources in it  not allowed
Changing a vnet's region              not possible, rebuild
```

Because resizing needs an empty subnet, generous sizing at the start is the cheapest decision in Azure networking.

## Quick recap

- A virtual network is one region, and its address space must not overlap anything it may peer with.
- Plan the whole address plan up front, since renumbering later is a migration.
- Azure reserves five addresses per subnet, so a /24 gives 251 usable.
- Some subnets need exact names like `GatewaySubnet`, and some need delegation.
- Peering must be created on both sides, and it is not transitive.
- Hub and spoke puts shared services in one place, with spoke traffic routed through a firewall.
- Check `show-effective-route-table` when traffic goes somewhere you did not expect.

<code id="code-content" class="language-bash">
# A vnet is a private address space in EXACTLY ONE region. Its range must
# not overlap anything you might peer with. Overlapping networks cannot be
# peered, and fixing that means renumbering a live environment.
az network vnet create --name vnet-shop-prod-uks --resource-group rg-shop-prod-uks \
  --location uksouth --address-prefixes 10.20.0.0/16
# PLAN THE WHOLE SPACE UP FRONT, including parts you will not build yet.
#   10.0.0.0/16 hub | 10.10 dev | 10.20 prod UKS | 10.30 prod NE | 10.40 future
# Unused address space costs nothing. Running out costs a migration.
# Avoid 192.168.0.0/16 and 10.0.0.0/24: home and office routers use them,
# and a clash means someone cannot reach Azure from home.
az network vnet subnet create --name snet-app --vnet-name vnet-shop-prod-uks \
  --resource-group rg-shop-prod-uks --address-prefixes 10.20.1.0/24
# AZURE RESERVES FIVE ADDRESSES PER SUBNET. A /24 gives 251 usable, not 256.
#   .0 network  .1 gateway  .2 and .3 DNS  .255 broadcast
# THESE NAMES ARE LITERAL. GatewaySubnet works, gateway-subnet does not.
#   GatewaySubnet /27  AzureFirewallSubnet /26  AzureBastionSubnet /26
# Others need DELEGATION, and want room: Container Apps wants /23 or bigger,
# AKS far more. Size before you build: GROWING A SUBNET REQUIRES IT EMPTY.
az network vnet subnet create --name snet-containerapps \
  --vnet-name vnet-shop-prod-uks --resource-group rg-shop-prod-uks \
  --address-prefixes 10.20.16.0/23 --delegations Microsoft.App/environments
# PEERING MUST BE CREATED ON BOTH SIDES. One side alone shows "Initiated"
# and carries no traffic. This is the most common peering problem.
az network vnet peering create --name hub-to-shop \
  --resource-group rg-hub-uks --vnet-name vnet-hub-uks \
  --remote-vnet /subscriptions/.../virtualNetworks/vnet-shop-prod-uks \
  --allow-vnet-access --allow-forwarded-traffic
# ...then the mirror image, shop-to-hub.
# PEERING IS NOT TRANSITIVE. A-B and B-C does NOT let A reach C. Routing
# through a hub needs a firewall in the middle and user defined routes.
az network route-table route create --route-table-name rt-spoke \
  --resource-group rg-shop-prod-uks --name default-via-firewall \
  --address-prefix 0.0.0.0/0 --next-hop-type VirtualAppliance \
  --next-hop-ip-address 10.0.1.4
# Get that address wrong and the whole subnet loses connectivity.
# EFFECTIVE ROUTES ARE THE TRUTH. Look here when traffic goes somewhere odd:
az network nic show-effective-route-table --name nic-shop-vm \
  --resource-group rg-shop-prod-uks --output table
</code></pre>
