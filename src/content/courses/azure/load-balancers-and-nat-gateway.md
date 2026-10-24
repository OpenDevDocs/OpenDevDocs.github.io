---
publishDate: 2026-10-06T07:20
title: Public IPs, Load Balancers and NAT Gateway
slug: load-balancers-and-nat-gateway
metadescription: Distribute traffic with Azure Load Balancer, understand public IP SKUs, and control outbound connections with a NAT Gateway.
updateDate: 2026-09-07T07:20
author: ['bishal-biswas']
level: 2
tags: ['networking', 'load balancing', 'outbound']
course: azure
---

## Public IP addresses first

Everything here depends on the public IP, so start there.

```bash
az network public-ip create \
  --name pip-shop-lb --resource-group rg-shop-prod-uks \
  --sku Standard --allocation-method Static --zone 1 2 3
```

```text
Basic     retired. Do not use, and migrate anything still on it.
Standard  static only, zone redundant, secure by default
```

Basic public IPs were retired in September 2025. If you find one in an old estate, it needs migrating, and Microsoft publishes a script for it.

"Secure by default" means a Standard public IP has **no inbound access** unless an NSG allows it. Basic was the opposite, open unless blocked, which surprised people in the wrong direction.

## Azure Load Balancer

A layer 4 load balancer. It distributes TCP and UDP, and it knows nothing about HTTP.

```bash
az network lb create \
  --name lb-shop --resource-group rg-shop-prod-uks \
  --sku Standard \
  --public-ip-address pip-shop-lb \
  --frontend-ip-name frontend --backend-pool-name backend

az network lb probe create \
  --lb-name lb-shop --resource-group rg-shop-prod-uks \
  --name health-probe --protocol Tcp --port 80 \
  --interval 5 --probe-threshold 2

az network lb rule create \
  --lb-name lb-shop --resource-group rg-shop-prod-uks \
  --name http-rule \
  --protocol Tcp --frontend-port 80 --backend-port 80 \
  --frontend-ip-name frontend --backend-pool-name backend \
  --probe-name health-probe
```

Four pieces, always: a frontend IP, a backend pool, a health probe, and a rule tying them together.

**The probe decides everything.** A backend failing the probe receives no traffic. A probe pointed at the wrong port or path takes an entire healthy pool out of service, and this is the most common load balancer incident.

Probes come from `168.63.129.16`, so the NSG must allow the `AzureLoadBalancer` service tag.

## Internal load balancer

```bash
az network lb create \
  --name lb-internal --resource-group rg-shop-prod-uks --sku Standard \
  --vnet-name vnet-shop-prod-uks --subnet snet-app \
  --private-ip-address 10.20.1.100 \
  --frontend-ip-name internal --backend-pool-name backend
```

Same thing with a private frontend. Used between tiers, so a web tier reaches an API tier through a stable address rather than individual machines.

## Layer 4 or layer 7

```text
Load Balancer      layer 4. TCP and UDP. Fast, cheap, protocol agnostic.
Application Gateway layer 7. HTTP. Path routing, TLS termination, WAF.
Front Door          layer 7, global. Edge, caching, multi region.
Traffic Manager     DNS. Directs to regions, does not carry traffic.
```

If it is HTTP, you usually want Application Gateway or Front Door. Load Balancer is for non HTTP protocols, or where you genuinely want raw speed and no inspection.

## Outbound connectivity

This is the part people meet as a production incident, so it deserves attention.

A virtual machine with no public IP still reaches the internet, through **default outbound access**. That is a shared address Azure assigns implicitly, and it has real problems:

```text
The address can change without notice
It is shared, so it cannot be allow listed
It has a small number of SNAT ports
It is being retired for new virtual networks
```

Default outbound access was retired for new virtual networks from 30 September 2025. New deployments must choose an explicit method, which is a good change: implicit outbound was a frequent surprise.

## SNAT port exhaustion

The classic outbound failure. Each outbound connection to the same destination consumes a source port, and the pool is finite.

```text
Symptom   connections time out under load, and recover when load drops
Cause     all SNAT ports to that destination are in use
Worst with  many short lived connections to one endpoint
```

An app calling one external API on every request, without connection reuse, exhausts ports and fails intermittently. It looks like the remote service is flaky, and it is not.

Two fixes, and you want both:

```csharp
// Reuse connections. A new HttpClient per request is the classic cause.
builder.Services.AddHttpClient("payments", client =>
{
    client.BaseAddress = new Uri("https://api.payments.example/");
});
```

And give the subnet its own outbound path.

## NAT Gateway

The right answer for outbound.

```bash
az network public-ip create --name pip-nat --resource-group rg-shop-prod-uks \
  --sku Standard --allocation-method Static

az network nat gateway create \
  --name nat-shop --resource-group rg-shop-prod-uks \
  --public-ip-addresses pip-nat \
  --idle-timeout 10

az network vnet subnet update \
  --name snet-app --vnet-name vnet-shop-prod-uks \
  --resource-group rg-shop-prod-uks --nat-gateway nat-shop
```

What it gives you:

```text
64,000 SNAT ports per public IP, allocated on demand
A predictable address a partner can allow list
More addresses by attaching a prefix, for very high volume
Simple: attach to a subnet and it takes over outbound
```

NAT Gateway takes precedence over other outbound methods on that subnet, so attaching it is the whole configuration. It is inexpensive relative to the incidents it prevents.

```bash
az network nat gateway create \
  --name nat-shop --resource-group rg-shop-prod-uks \
  --public-ip-prefixes /subscriptions/.../publicIPPrefixes/pipp-shop
```

## Choosing an outbound method

```text
NAT Gateway            default choice for a subnet
Public IP on the VM    fine for one machine, does not scale
Load balancer rules    possible, and limited port allocation
Azure Firewall         when you also need FQDN rules and inspection
```

For most workloads, NAT Gateway. For a regulated environment needing egress inspection, Azure Firewall, which also handles NAT.

## Availability zones

```bash
az network public-ip create --name pip-shop-lb \
  --resource-group rg-shop-prod-uks --sku Standard \
  --allocation-method Static --zone 1 2 3
```

Zone redundant survives one zone failing. A zonal resource pinned to a single zone does not, and that includes NAT Gateway, which is zonal rather than zone redundant. In a multi zone design, use one per zone.

## Debugging

```bash
az network lb probe list --lb-name lb-shop --resource-group rg-shop-prod-uks -o table
az network lb address-pool list --lb-name lb-shop --resource-group rg-shop-prod-uks
az network nat gateway show --name nat-shop --resource-group rg-shop-prod-uks
```

For SNAT problems, the metric to watch is `SNATConnectionCount` with a `Failed` state, on the load balancer or NAT Gateway. Any failed count means exhaustion, and it will be intermittent before it is total.

## Quick recap

- Basic public IPs are retired, and Standard is secure by default, meaning closed until an NSG opens it.
- A load balancer is a frontend, a backend pool, a probe and a rule, and the probe decides everything.
- Load Balancer is layer 4, so for HTTP you usually want Application Gateway or Front Door.
- Default outbound access is retired for new virtual networks, so choose an explicit method.
- SNAT port exhaustion looks like a flaky remote service and is caused by not reusing connections.
- NAT Gateway is the default outbound answer, and it takes precedence once attached to a subnet.
- NAT Gateway is zonal, so a multi zone design needs one per zone.

<code id="code-content" class="language-bash">
# PUBLIC IPs. Basic was RETIRED in September 2025. Standard is static, zone
# capable, and SECURE BY DEFAULT: no inbound unless an NSG allows it.
az network public-ip create --name pip-shop-lb --resource-group rg-shop-prod-uks \
  --sku Standard --allocation-method Static --zone 1 2 3
# A LOAD BALANCER IS ALWAYS FOUR THINGS: frontend IP, backend pool, health
# probe, and a rule tying them together.
az network lb create --name lb-shop --resource-group rg-shop-prod-uks \
  --sku Standard --public-ip-address pip-shop-lb \
  --frontend-ip-name frontend --backend-pool-name backend
az network lb probe create --lb-name lb-shop --resource-group rg-shop-prod-uks \
  --name health-probe --protocol Tcp --port 80 --interval 5 --probe-threshold 2
az network lb rule create --lb-name lb-shop --resource-group rg-shop-prod-uks \
  --name http-rule --protocol Tcp --frontend-port 80 --backend-port 80 \
  --frontend-ip-name frontend --backend-pool-name backend --probe-name health-probe
# THE PROBE DECIDES EVERYTHING. Point it at the wrong port and a healthy
# pool goes entirely out of service. Probes come from 168.63.129.16, so the
# NSG must allow the AzureLoadBalancer service tag.
# LAYER 4 vs LAYER 7:
#   Load Balancer       TCP/UDP, fast, knows nothing about HTTP
#   Application Gateway HTTP, path routing, TLS termination, WAF
#   Front Door          HTTP, GLOBAL, edge and caching
#   Traffic Manager     DNS only, does not carry traffic
# OUTBOUND. A VM with no public IP still reaches the internet via DEFAULT
# OUTBOUND ACCESS: a shared address that can change, cannot be allow listed,
# and has few SNAT ports. RETIRED for new vnets from 30 September 2025.
# SNAT PORT EXHAUSTION is the classic failure: connections time out under
# load and recover when it drops. It looks like a flaky remote service. The
# cause is usually a new HttpClient per request instead of connection reuse.
# THE FIX FOR A SUBNET: 64,000 ports per IP, and a predictable address a
# partner can allow list. Attaching it IS the configuration, since it takes
# precedence over other outbound methods.
az network nat gateway create --name nat-shop --resource-group rg-shop-prod-uks \
  --public-ip-addresses pip-nat --idle-timeout 10
az network vnet subnet update --name snet-app --vnet-name vnet-shop-prod-uks \
  --resource-group rg-shop-prod-uks --nat-gateway nat-shop
# NAT Gateway is ZONAL, not zone redundant. Multi zone design: one per zone.
# WATCH SNATConnectionCount with state Failed. Any failures mean exhaustion,
# and it is intermittent long before it is total.
</code></pre>
