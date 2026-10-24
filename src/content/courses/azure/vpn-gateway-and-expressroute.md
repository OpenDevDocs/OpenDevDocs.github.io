---
publishDate: 2026-10-07T07:45
title: VPN Gateway, ExpressRoute and Hybrid Connectivity
slug: vpn-gateway-and-expressroute
metadescription: Connect on premises networks to Azure with VPN Gateway or ExpressRoute, and understand what each costs in money, latency and effort.
updateDate: 2026-09-07T07:45
author: ['bishal-biswas']
level: 3
tags: ['networking', 'hybrid', 'vpn']
course: azure
---

## Three ways in

```text
Point to site   one laptop connects to a virtual network
Site to site    an office or datacentre connects, over the internet, encrypted
ExpressRoute    a private circuit from a provider, not touching the internet
```

Most estates end up with more than one. Point to site for engineers, site to site for a branch office, ExpressRoute for the main datacentre.

## The gateway subnet

Every option except ExpressRoute Direct needs a virtual network gateway, and that needs a subnet with an exact name.

```bash
az network vnet subnet create \
  --name GatewaySubnet \
  --vnet-name vnet-hub-uks --resource-group rg-hub-uks \
  --address-prefixes 10.0.255.0/27
```

**The name must be `GatewaySubnet`.** Not `gateway-subnet`, not `snet-gateway`. Azure looks for that exact string.

A /27 is the practical minimum, and /26 gives room for future features. Put nothing else in it.

## Site to site VPN

```bash
az network public-ip create --name pip-vpngw --resource-group rg-hub-uks \
  --sku Standard --allocation-method Static --zone 1 2 3

az network vnet-gateway create \
  --name vpngw-hub --resource-group rg-hub-uks \
  --vnet vnet-hub-uks --public-ip-address pip-vpngw \
  --gateway-type Vpn --vpn-type RouteBased \
  --sku VpnGw2AZ --no-wait
```

Gateway creation takes **20 to 45 minutes**. That is not a hang. Plan for it, and use `--no-wait` in scripts.

```bash
az network local-gateway create \
  --name lgw-london-office --resource-group rg-hub-uks \
  --gateway-ip-address 203.0.113.50 \
  --local-address-prefixes 192.168.10.0/24

az network vpn-connection create \
  --name conn-london --resource-group rg-hub-uks \
  --vnet-gateway1 vpngw-hub --local-gateway2 lgw-london-office \
  --shared-key 'a-long-random-preshared-key'
```

The local network gateway describes the **other end**: its public IP and the address ranges behind it. Get those ranges wrong and traffic will not route, which is the most common site to site problem after mismatched settings.

## Route based, always

```text
Route based   uses routing to decide what goes over the tunnel. Supports
              point to site, coexistence with ExpressRoute, multiple tunnels.
Policy based  matches traffic against policy. One tunnel, limited, legacy.
```

Choose route based unless a very old on premises device forces otherwise. Policy based exists for compatibility and constrains almost everything.

## Active active

```bash
az network vnet-gateway update \
  --name vpngw-hub --resource-group rg-hub-uks \
  --set activeActive=true
```

A standard gateway has two instances, one active and one standby, and failover takes 30 to 90 seconds during which the tunnel is down. Active active runs both with separate public IPs and separate tunnels, so a failure loses half the capacity rather than all of it.

For anything production, active active is worth the second public IP.

## SKUs

```text
Basic     legacy, no support for modern features. Avoid.
VpnGw1    650 Mbps, 30 tunnels
VpnGw2    1 Gbps, 30 tunnels
VpnGw3    1.25 Gbps, 30 tunnels
VpnGw4/5  higher, and expensive
```

The `AZ` suffix, like `VpnGw2AZ`, gives zone redundancy. Use it in regions that support zones, since it costs little more and removes a single zone failure.

Bandwidth is shared across all tunnels on the gateway, not per tunnel. That surprises people who add a fifth branch office and see everything slow down.

## Point to site

```bash
az network vnet-gateway update \
  --name vpngw-hub --resource-group rg-hub-uks \
  --address-prefixes 172.16.100.0/24 \
  --client-protocol OpenVPN \
  --vpn-auth-type AAD \
  --aad-tenant https://login.microsoftonline.com/TENANT_ID/ \
  --aad-audience c632b3df-fb67-4d84-bdcf-b95ad541b5c8 \
  --aad-issuer https://sts.windows.net/TENANT_ID/
```

Entra ID authentication is the option to use, because access is then governed by Conditional Access and MFA rather than a shared certificate.

The client address pool must not overlap the virtual network or anything on premises. It is a separate range, used only for VPN clients.

```text
OpenVPN     Entra ID auth, works everywhere. The default choice.
IKEv2       native OS clients, certificate auth
SSTP        Windows only, legacy
```

## ExpressRoute

A private circuit from a connectivity provider. Traffic never touches the public internet.

```bash
az network express-route create \
  --name er-london --resource-group rg-hub-uks \
  --location uksouth \
  --provider "Equinix" --peering-location "London" \
  --bandwidth 1000 --sku-family MeteredData --sku-tier Standard

az network express-route show --name er-london --resource-group rg-hub-uks \
  --query "{Key:serviceKey, State:circuitProvisioningState}"
```

The service key goes to your provider, who provisions their side. This is a **procurement exercise**, not a five minute deployment: expect weeks, contracts and a monthly cost measured in hundreds or thousands.

What you get:

```text
Predictable latency and bandwidth
No public internet in the path
An SLA on the connection
Access to Microsoft 365 and public services over the circuit, with Premium
Higher bandwidth than a VPN can reach
```

## Peering types

```text
Private peering    reach virtual networks over private addresses
Microsoft peering  reach public Microsoft services over the circuit
```

Private peering is what connects your datacentre to your virtual networks. Microsoft peering is optional and mostly used for Microsoft 365.

## ExpressRoute with VPN failover

ExpressRoute circuits do fail, usually because someone cuts a cable. A site to site VPN as backup is standard practice and inexpensive.

```text
ExpressRoute active, VPN standby
Both terminate on the same virtual network gateway arrangement
BGP prefers ExpressRoute, and falls back automatically
```

Test the failover. A backup path nobody has exercised is not a backup path.

## Virtual WAN

For more than a handful of sites, Virtual WAN replaces hand built hub and spoke.

```bash
az network vwan create --name vwan-global --resource-group rg-hub-global \
  --type Standard --location uksouth

az network vhub create --name vhub-uks --resource-group rg-hub-global \
  --vwan vwan-global --address-prefix 10.100.0.0/23 --location uksouth
```

Microsoft manages the routing between hubs. Branches connect to the nearest hub, hubs interconnect automatically, and spokes attach without manual peering meshes.

Worth it beyond roughly five sites or two regions. Below that, hand built hub and spoke is simpler and cheaper.

## Debugging

```bash
az network vpn-connection show --name conn-london --resource-group rg-hub-uks \
  --query "{Status:connectionStatus, In:ingressBytesTransferred, Out:egressBytesTransferred}"

az network vnet-gateway list-bgp-peer-status --name vpngw-hub --resource-group rg-hub-uks -o table
az network vnet-gateway list-learned-routes --name vpngw-hub --resource-group rg-hub-uks -o table
```

**Connected but no traffic.** Almost always address ranges. Check the local network gateway prefixes and any NSG or route table in the path.

**Connects then drops.** Usually mismatched IPsec settings or a rekey interval difference between the two devices.

**Overlapping ranges.** Cannot be fixed by configuration. One side has to renumber.

**Cannot reach a peered spoke.** The spoke peering needs `--allow-gateway-transit` on the hub side and `--use-remote-gateways` on the spoke side. This is the most common hub and spoke hybrid problem.

```bash
az network vnet peering update \
  --name hub-to-spoke --resource-group rg-hub-uks --vnet-name vnet-hub-uks \
  --set allowGatewayTransit=true

az network vnet peering update \
  --name spoke-to-hub --resource-group rg-shop-prod-uks --vnet-name vnet-shop-prod-uks \
  --set useRemoteGateways=true
```

## Quick recap

- The gateway subnet must be named `GatewaySubnet` exactly, and hold nothing else.
- Gateway creation takes 20 to 45 minutes, so use `--no-wait` and plan around it.
- Choose route based VPN unless an old device forces policy based.
- Active active avoids a 30 to 90 second outage during failover.
- Gateway bandwidth is shared across all tunnels, not per tunnel.
- ExpressRoute is a procurement exercise with weeks of lead time, and should have VPN backup.
- For hub and spoke, gateway transit and use remote gateways must both be set.

<code id="code-content" class="language-bash">
# THREE WAYS IN: point to site (one laptop), site to site (an office, over
# the internet, encrypted), ExpressRoute (a private circuit from a provider).
# THE NAME MUST BE EXACTLY GatewaySubnet. Not gateway-subnet. /27 minimum,
# /26 for room, and nothing else in it.
az network vnet subnet create --name GatewaySubnet --vnet-name vnet-hub-uks \
  --resource-group rg-hub-uks --address-prefixes 10.0.255.0/27
# GATEWAY CREATION TAKES 20 TO 45 MINUTES. That is not a hang. Use --no-wait.
az network vnet-gateway create --name vpngw-hub --resource-group rg-hub-uks \
  --vnet vnet-hub-uks --public-ip-address pip-vpngw \
  --gateway-type Vpn --vpn-type RouteBased --sku VpnGw2AZ --no-wait
# ROUTE BASED, ALWAYS, unless an old device forces policy based. Policy
# based is one tunnel and constrains almost everything.
# The AZ suffix gives zone redundancy for very little extra.
# BANDWIDTH IS SHARED ACROSS ALL TUNNELS, not per tunnel. Adding a fifth
# branch office slows everything down, and people are surprised.
# The LOCAL network gateway describes THE OTHER END: its public IP and the
# ranges behind it. Wrong ranges is the most common site to site problem.
az network local-gateway create --name lgw-london-office --resource-group rg-hub-uks \
  --gateway-ip-address 203.0.113.50 --local-address-prefixes 192.168.10.0/24
az network vpn-connection create --name conn-london --resource-group rg-hub-uks \
  --vnet-gateway1 vpngw-hub --local-gateway2 lgw-london-office \
  --shared-key 'a-long-random-preshared-key'
# ACTIVE ACTIVE: a standard gateway fails over in 30 to 90 seconds, during
# which the tunnel is DOWN. Active active loses half the capacity instead.
az network vnet-gateway update --name vpngw-hub --resource-group rg-hub-uks \
  --set activeActive=true
# POINT TO SITE: use Entra ID auth, so access is governed by Conditional
# Access and MFA rather than a shared certificate. The client pool must NOT
# overlap the vnet or anything on premises.
# EXPRESSROUTE is a PROCUREMENT EXERCISE: weeks, contracts, and hundreds or
# thousands per month. The service key goes to your provider.
az network express-route create --name er-london --resource-group rg-hub-uks \
  --location uksouth --provider "Equinix" --peering-location "London" \
  --bandwidth 1000 --sku-family MeteredData --sku-tier Standard
# Circuits DO fail, usually a cut cable. A site to site VPN as backup is
# standard and cheap. TEST THE FAILOVER: an unexercised backup is not one.
# DEBUGGING:
az network vpn-connection show --name conn-london --resource-group rg-hub-uks \
  --query "{Status:connectionStatus, In:ingressBytesTransferred}"
az network vnet-gateway list-learned-routes --name vpngw-hub --resource-group rg-hub-uks -o table
# Connected but no traffic: almost always address ranges.
# Connects then drops: mismatched IPsec or rekey settings.
# CANNOT REACH A PEERED SPOKE. The classic hub and spoke hybrid problem,
# and it needs BOTH of these:
az network vnet peering update --name hub-to-spoke --resource-group rg-hub-uks \
  --vnet-name vnet-hub-uks --set allowGatewayTransit=true
az network vnet peering update --name spoke-to-hub --resource-group rg-shop-prod-uks \
  --vnet-name vnet-shop-prod-uks --set useRemoteGateways=true
</code></pre>
