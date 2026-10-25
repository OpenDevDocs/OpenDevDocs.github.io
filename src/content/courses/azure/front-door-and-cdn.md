---
publishDate: 2026-10-06T07:30
title: Azure Front Door and Content Delivery
slug: front-door-and-cdn
metadescription: Serve global traffic from the Azure edge with Front Door, cache static content, and route users to the nearest healthy region.
updateDate: 2026-09-07T07:30
author: ['bishal-biswas']
level: 2
tags: ['networking', 'cdn', 'global']
course: azure
---

## What Front Door is

Front Door is a global entry point. A request from anywhere in the world hits the nearest Microsoft edge location, and travels to your origin over Microsoft's backbone rather than the public internet.

```text
Without   user in Sydney -> public internet -> your app in London
With      user in Sydney -> Sydney edge -> Microsoft backbone -> London
```

That alone reduces latency noticeably, because the backbone is faster and more consistent than the open internet.

It also does caching, TLS termination at the edge, WAF, and failover between regions.

## Azure CDN is gone

Azure CDN Standard from Microsoft (classic) was retired on 30 September 2025, and the Edgio profiles were retired earlier in January 2025 after Edgio's bankruptcy.

**Front Door is the replacement.** Anything still on a classic CDN profile needs migrating, and Microsoft provides a migration path in the portal.

Front Door Standard and Premium include CDN capability, so there is no separate product to choose any more.

## Standard or Premium

```text
Standard  routing, caching, custom domains, basic rules
Premium   adds managed WAF rule sets, bot protection, Private Link to origins
```

Premium's Private Link support matters: it lets Front Door reach an origin that has no public endpoint at all, which is the cleanest way to make an origin unreachable except through the edge.

```bash
az afd profile create \
  --profile-name afd-shop --resource-group rg-shop-global \
  --sku Premium_AzureFrontDoor
```

## The pieces

```text
Profile        the top level resource
Endpoint       a hostname, like shop-abc123.z01.azurefd.net
Origin group   a set of origins with health probes and load balancing
Origin         one backend: App Service, Storage, a public IP, anything
Route          maps patterns on an endpoint to an origin group
Rule set       transformations applied per request
```

```bash
az afd endpoint create \
  --profile-name afd-shop --resource-group rg-shop-global \
  --endpoint-name shop --enabled-state Enabled

az afd origin-group create \
  --profile-name afd-shop --resource-group rg-shop-global \
  --origin-group-name og-shop \
  --probe-request-type GET --probe-protocol Https \
  --probe-path /healthz --probe-interval-in-seconds 30 \
  --sample-size 4 --successful-samples-required 3 \
  --additional-latency-in-milliseconds 50

az afd origin create \
  --profile-name afd-shop --resource-group rg-shop-global \
  --origin-group-name og-shop --origin-name uks \
  --host-name shop-uks.azurewebsites.net \
  --origin-host-header shop-uks.azurewebsites.net \
  --priority 1 --weight 1000 --enabled-state Enabled --https-port 443

az afd route create \
  --profile-name afd-shop --resource-group rg-shop-global \
  --endpoint-name shop --route-name default \
  --origin-group og-shop --supported-protocols Https \
  --patterns-to-match "/*" --forwarding-protocol HttpsOnly \
  --https-redirect Enabled
```

## Multi region routing

Add a second origin, and priority decides the behaviour.

```bash
az afd origin create \
  --profile-name afd-shop --resource-group rg-shop-global \
  --origin-group-name og-shop --origin-name ne \
  --host-name shop-ne.azurewebsites.net \
  --priority 2 --weight 1000 --enabled-state Enabled --https-port 443
```

```text
Same priority       traffic goes to the lowest latency healthy origin
Different priority  priority 1 is active, priority 2 is standby
```

Same priority gives active active with latency based routing. Different priorities give active passive failover, where the second region takes over only when the first fails its probe.

`--additional-latency-in-milliseconds` sets how much slower an origin may be and still be considered equivalent. Set to 50, origins within 50ms of the fastest all receive traffic.

## Health probes

```text
--probe-path                    point at a real health endpoint, not /
--probe-interval-in-seconds     how often
--sample-size                   how many samples are considered
--successful-samples-required   how many must pass
```

A probe on `/` often returns 200 from a web server whose database is down. A `/healthz` that actually checks dependencies gives failover that works.

Do not make the health endpoint expensive. Probes come from every edge location, so a heavy check runs constantly.

## Caching

```bash
az afd route update \
  --profile-name afd-shop --resource-group rg-shop-global \
  --endpoint-name shop --route-name static \
  --enable-caching true \
  --query-string-caching-behavior IgnoreQueryString \
  --content-types-to-compress text/html text/css application/javascript application/json
```

```text
IgnoreQueryString        one cached copy regardless of query. Fast, and wrong for search.
UseQueryString           each distinct query is cached separately
IgnoreSpecifiedQueryStrings  ignore tracking parameters only
```

The last one is usually right. Tracking parameters like `utm_source` should not fragment the cache, but a real parameter like `?page=2` should.

Origin `Cache-Control` headers are respected, and that is the better place to control caching because the rule lives with the content.

```bash
az afd endpoint purge \
  --profile-name afd-shop --resource-group rg-shop-global \
  --endpoint-name shop --content-paths "/index.html" "/css/*"
```

Purging is for emergencies. Content addressed file names, like `app.a3f9c2.js`, make purging unnecessary, and that is the pattern to aim for.

## Custom domains

```bash
az afd custom-domain create \
  --profile-name afd-shop --resource-group rg-shop-global \
  --custom-domain-name shop-example-com \
  --host-name shop.example.com \
  --minimum-tls-version TLS12 \
  --certificate-type ManagedCertificate
```

Managed certificates are issued and renewed by Azure at no cost. Use them unless you need a specific certificate authority.

Validation needs a DNS TXT record, then the domain itself points at the endpoint with CNAME. For an apex domain, Azure DNS alias records work where CNAME is not allowed.

## Locking the origin down

Front Door in front of a publicly reachable origin means the origin can still be hit directly, bypassing WAF and caching. Close that.

Every Front Door request carries `X-Azure-FDID` with your profile's identifier. Restrict the origin to the `AzureFrontDoor.Backend` service tag and check that header:

```bash
az webapp config access-restriction add \
  --name shop-uks --resource-group rg-shop-prod-uks \
  --rule-name allow-front-door --priority 100 --action Allow \
  --service-tag AzureFrontDoor.Backend \
  --http-header x-azure-fdid=YOUR_FRONT_DOOR_ID
```

The service tag alone is not enough, because it covers **everyone's** Front Door. The header is what makes it yours. This is a real and commonly missed exposure.

With Premium and Private Link, the origin needs no public endpoint at all, which is better still.

## Rules engine

```text
Redirect http to https
Add security headers
Rewrite a path before forwarding
Route mobile user agents differently
Override cache duration for one path
```

Rules run at the edge, so they cost nothing at the origin. Security headers applied here cover every origin at once.

## Front Door or Traffic Manager

```text
Front Door       carries traffic, HTTP only, caches, WAF, fast failover
Traffic Manager  DNS only, any protocol, failover limited by DNS TTL
```

Traffic Manager only answers DNS queries, so failover waits for client caches to expire. Front Door fails over in seconds because it is in the path.

Traffic Manager still fits non HTTP protocols, and it is cheap.

## Quick recap

- Front Door puts your app on Microsoft's backbone from the nearest edge.
- Azure CDN classic profiles were retired in 2025, and Front Door is the replacement.
- Equal origin priorities give latency based active active, different priorities give failover.
- Point health probes at a real dependency check, and keep it cheap.
- Ignore tracking query parameters rather than all of them, or search breaks.
- Restrict the origin with both the service tag and the `X-Azure-FDID` header, since the tag alone covers everyone's Front Door.
- Traffic Manager is DNS only, so its failover is as slow as the TTL.

<code id="code-content" class="language-bash">
# Front Door is a GLOBAL entry point: the request hits the nearest Microsoft
# edge and travels to your origin over MICROSOFT'S BACKBONE, not the public
# internet. Lower and far more consistent latency.
# AZURE CDN CLASSIC WAS RETIRED 30 September 2025 (Edgio profiles earlier,
# in January 2025). FRONT DOOR IS THE REPLACEMENT, and includes CDN.
#   Standard  routing, caching, custom domains, rules
#   Premium   adds managed WAF, bot protection, PRIVATE LINK to origins
az afd profile create --profile-name afd-shop --resource-group rg-shop-global \
  --sku Premium_AzureFrontDoor
# PIECES: profile -&gt; endpoint -&gt; origin group -&gt; origins, joined by a route.
az afd origin-group create --profile-name afd-shop --resource-group rg-shop-global \
  --origin-group-name og-shop --probe-request-type GET --probe-protocol Https \
  --probe-path /healthz --probe-interval-in-seconds 30 \
  --sample-size 4 --successful-samples-required 3 \
  --additional-latency-in-milliseconds 50
az afd origin create --profile-name afd-shop --resource-group rg-shop-global \
  --origin-group-name og-shop --origin-name uks \
  --host-name shop-uks.azurewebsites.net --priority 1 --weight 1000 --https-port 443
# PRIORITY DECIDES THE BEHAVIOUR:
#   same priority       active active, lowest latency healthy origin wins
#   different priority  active passive, 2 takes over when 1 fails its probe
# PROBE A REAL HEALTH ENDPOINT, not /. A web server whose database is down
# still returns 200 from /. Keep it cheap: every edge probes constantly.
# CACHING. Ignore TRACKING parameters, not all of them, or search breaks:
#   IgnoreQueryString  one copy regardless of query. Wrong for search.
#   UseQueryString     each query cached separately
#   IgnoreSpecifiedQueryStrings  ignore utm_source and friends only  &lt;- usually right
az afd route update --profile-name afd-shop --resource-group rg-shop-global \
  --endpoint-name shop --route-name static --enable-caching true \
  --query-string-caching-behavior IgnoreQueryString
# Purging is for emergencies. Content addressed names (app.a3f9c2.js) make
# it unnecessary, and that is the pattern to aim for.
# LOCK THE ORIGIN DOWN, or it can be hit directly, bypassing WAF and cache.
# THE SERVICE TAG ALONE IS NOT ENOUGH: it covers EVERYONE'S Front Door.
# The X-Azure-FDID header is what makes it yours. Commonly missed.
az webapp config access-restriction add --name shop-uks \
  --resource-group rg-shop-prod-uks --rule-name allow-front-door \
  --priority 100 --action Allow --service-tag AzureFrontDoor.Backend \
  --http-header x-azure-fdid=YOUR_FRONT_DOOR_ID
# FRONT DOOR vs TRAFFIC MANAGER: Traffic Manager only answers DNS, so
# failover waits for client caches to expire. Front Door is IN THE PATH and
# fails over in seconds. Traffic Manager still fits non HTTP protocols.
</code></pre>
