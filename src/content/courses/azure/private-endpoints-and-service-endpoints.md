---
publishDate: 2026-10-07T07:35
title: Private Endpoints and Service Endpoints
slug: private-endpoints-and-service-endpoints
metadescription: Reach Azure PaaS services privately with private endpoints, understand the DNS that makes them work, and know where service endpoints still fit.
updateDate: 2026-09-07T07:35
author: ['bishal-biswas']
level: 3
tags: ['networking', 'security', 'private link']
course: azure
---

## The problem

A storage account has a public endpoint. So does a Key Vault, a SQL database, a Cosmos DB account. Traffic from your virtual network to them leaves by the public path, even though both ends are in Azure.

Firewall rules on the service help, and the endpoint is still public. For many organisations that is not acceptable.

## Two solutions, and they are different

```text
Service endpoint  the traffic stays on the Azure backbone, and the service
                  endpoint remains public. Free.
Private endpoint  the service gets a private IP INSIDE your vnet. The public
                  endpoint can be disabled entirely. Charged hourly plus data.
```

Service endpoints extend your virtual network identity to the service. Private endpoints bring the service into your network.

Private endpoints are the modern answer and what most designs use now. Service endpoints still exist, are free, and are simpler.

## Service endpoints

```bash
az network vnet subnet update \
  --name snet-app --vnet-name vnet-shop-prod-uks \
  --resource-group rg-shop-prod-uks \
  --service-endpoints Microsoft.Storage Microsoft.KeyVault Microsoft.Sql

az storage account network-rule add \
  --account-name stshopprod --resource-group rg-shop-prod-uks \
  --vnet-name vnet-shop-prod-uks --subnet snet-app
```

The service then accepts traffic from that subnet and rejects everything else. No DNS changes, no extra cost, five minutes of work.

Limitations:

```text
The public endpoint still exists
No access from on premises over VPN or ExpressRoute
Regional only
Not supported by every service
```

## Private endpoints

```bash
az network private-endpoint create \
  --name pe-stshopprod --resource-group rg-shop-prod-uks \
  --vnet-name vnet-shop-prod-uks --subnet snet-privatelink \
  --private-connection-resource-id /subscriptions/.../storageAccounts/stshopprod \
  --group-id blob \
  --connection-name pe-stshopprod-conn
```

`--group-id` names the **sub resource**, and one resource often has several. A storage account has `blob`, `file`, `queue`, `table` and `dfs`, each needing its own private endpoint and its own DNS zone.

```text
Storage      blob, file, queue, table, dfs, web
Key Vault    vault
SQL          sqlServer
Cosmos DB    Sql, MongoDB, Cassandra, Gremlin, Table
App Service  sites
```

Then disable public access:

```bash
az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --public-network-access Disabled

az keyvault update --name kv-shop-prod --resource-group rg-shop-prod-uks \
  --public-network-access Disabled
```

That is the point of the exercise. A private endpoint alongside an open public endpoint has closed nothing.

## DNS is the whole thing

This is where private endpoints go wrong, so it is worth understanding rather than copying.

`stshopprod.blob.core.windows.net` resolves publicly to a public IP. Creating a private endpoint does not change that. Without DNS work, your app keeps using the public address and now gets refused, because you disabled public access.

The public name is a CNAME to a private link name:

```text
stshopprod.blob.core.windows.net
  -> CNAME stshopprod.privatelink.blob.core.windows.net
     -> public IP, unless a private DNS zone says otherwise
```

So you create a **private DNS zone** for `privatelink.blob.core.windows.net`, link it to the virtual network, and add an A record pointing at the private endpoint's IP.

```bash
az network private-dns zone create \
  --name privatelink.blob.core.windows.net --resource-group rg-shop-prod-uks

az network private-dns link vnet create \
  --zone-name privatelink.blob.core.windows.net \
  --resource-group rg-shop-prod-uks \
  --name link-vnet-shop --virtual-network vnet-shop-prod-uks \
  --registration-enabled false

az network private-endpoint dns-zone-group create \
  --endpoint-name pe-stshopprod --resource-group rg-shop-prod-uks \
  --name default --zone-name blob \
  --private-dns-zone privatelink.blob.core.windows.net
```

The last command is the one to remember: a **DNS zone group** makes the private endpoint maintain its own A record automatically. Without it you are managing records by hand, and they drift.

Your code does not change. It keeps using `stshopprod.blob.core.windows.net`, which now resolves privately.

## The zone names

They are exact, and a typo produces a confusing failure.

```text
Blob     privatelink.blob.core.windows.net
File     privatelink.file.core.windows.net
Queue    privatelink.queue.core.windows.net
Table    privatelink.table.core.windows.net
Key Vault privatelink.vaultcore.azure.net
SQL      privatelink.database.windows.net
Cosmos   privatelink.documents.azure.com
App Service privatelink.azurewebsites.net
ACR      privatelink.azurecr.io
```

Note Key Vault is `vaultcore.azure.net`, not `vault.azure.net`. That one catches people.

## Centralised DNS

In a hub and spoke design, create the private DNS zones **once in the hub** and link them to every spoke. A zone per spoke means inconsistent resolution and endpoints that work from one network and not another.

```bash
az network private-dns link vnet create \
  --zone-name privatelink.blob.core.windows.net --resource-group rg-hub-uks \
  --name link-spoke-prod --virtual-network vnet-shop-prod-uks \
  --registration-enabled false
```

For on premises resolution over VPN or ExpressRoute, a DNS forwarder in the hub, or Azure DNS Private Resolver, forwards queries to `168.63.129.16`. On premises DNS cannot see Azure private zones directly.

## Verifying

```bash
nslookup stshopprod.blob.core.windows.net
```

From inside the virtual network, that must return a **10.x address**. A public address means DNS is not resolving privately, and nothing else matters until it does.

```bash
az network private-endpoint show --name pe-stshopprod \
  --resource-group rg-shop-prod-uks \
  --query "customDnsConfigs[].{Fqdn:fqdn, Ip:ipAddresses}"

az network private-endpoint-connection list \
  --id /subscriptions/.../storageAccounts/stshopprod \
  --query "[].{Name:name, State:properties.privateLinkServiceConnectionState.status}"
```

The connection state must be `Approved`. Cross subscription endpoints start as `Pending` and need approving by an owner of the target resource.

## Costs and limits

```text
Charged per endpoint per hour, plus data processed
One endpoint per sub resource, so storage with blob and file needs two
Consumes an IP from the subnet
NSGs apply to private endpoint subnets, and did not always
```

Costs add up. A hundred private endpoints is a noticeable line on the bill, though usually a justified one.

## When each fits

```text
Private endpoint  regulated data, on premises access needed, public access must be off
Service endpoint  simple, free, Azure only access is enough, no on premises
Firewall rules    smallest estates, or a starting point
```

Many estates use service endpoints for development and private endpoints for production, which balances cost against strictness.

## Quick recap

- A service endpoint keeps traffic on the backbone, a private endpoint puts the service in your virtual network.
- Disable public network access afterwards, or nothing has been closed.
- DNS is where private endpoints fail, and a DNS zone group keeps the record correct automatically.
- Zone names are exact, and Key Vault uses `vaultcore.azure.net`.
- One private endpoint per sub resource, so blob and file need two.
- Centralise private DNS zones in the hub and link every spoke.
- From inside the network, the name must resolve to a 10.x address.

<code id="code-content" class="language-bash">
# THE PROBLEM: storage, Key Vault and SQL all have PUBLIC endpoints, and
# traffic from your vnet leaves by the public path even though both ends
# are in Azure.
# SERVICE ENDPOINT   traffic stays on the backbone, endpoint STAYS PUBLIC. Free.
# PRIVATE ENDPOINT   the service gets a PRIVATE IP INSIDE your vnet, and the
#                    public endpoint can be turned off. Charged hourly.
az network vnet subnet update --name snet-app --vnet-name vnet-shop-prod-uks \
  --resource-group rg-shop-prod-uks --service-endpoints Microsoft.Storage
az network private-endpoint create --name pe-stshopprod \
  --resource-group rg-shop-prod-uks --vnet-name vnet-shop-prod-uks \
  --subnet snet-privatelink --group-id blob \
  --private-connection-resource-id /subscriptions/.../storageAccounts/stshopprod \
  --connection-name pe-stshopprod-conn
# --group-id names the SUB RESOURCE, and one resource has several. Storage
# has blob, file, queue, table, dfs. EACH needs its own endpoint and zone.
# THEN ACTUALLY CLOSE IT, or you have closed nothing:
az storage account update --name stshopprod --resource-group rg-shop-prod-uks \
  --public-network-access Disabled
# DNS IS THE WHOLE THING, and where this goes wrong. The public name is a
# CNAME to a privatelink name, which resolves PUBLICLY unless a private zone
# says otherwise. Without the DNS work your app keeps using the public
# address and now gets refused, because you just disabled public access.
az network private-dns zone create --name privatelink.blob.core.windows.net \
  --resource-group rg-shop-prod-uks
az network private-dns link vnet create --zone-name privatelink.blob.core.windows.net \
  --resource-group rg-shop-prod-uks --name link-vnet-shop \
  --virtual-network vnet-shop-prod-uks --registration-enabled false
# THE COMMAND TO REMEMBER. A DNS ZONE GROUP makes the endpoint maintain its
# own A record. Without it you manage records by hand and they drift.
az network private-endpoint dns-zone-group create --endpoint-name pe-stshopprod \
  --resource-group rg-shop-prod-uks --name default --zone-name blob \
  --private-dns-zone privatelink.blob.core.windows.net
# Your CODE does not change. It still uses stshopprod.blob.core.windows.net.
# ZONE NAMES ARE EXACT. Key Vault is vaultcore.azure.net, NOT vault.azure.net.
#   privatelink.blob.core.windows.net    privatelink.vaultcore.azure.net
#   privatelink.database.windows.net     privatelink.documents.azure.com
#   privatelink.azurewebsites.net        privatelink.azurecr.io
# In hub and spoke, create zones ONCE IN THE HUB and link every spoke.
# VERIFY FROM INSIDE THE VNET. This MUST return a 10.x address:
nslookup stshopprod.blob.core.windows.net
# And the connection state must be Approved. Cross subscription endpoints
# start Pending and need approving by an owner of the target resource.
az network private-endpoint-connection list \
  --id /subscriptions/.../storageAccounts/stshopprod \
  --query "[].{Name:name, State:properties.privateLinkServiceConnectionState.status}"
</code></pre>
