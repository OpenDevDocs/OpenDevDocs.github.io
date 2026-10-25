---
publishDate: 2026-10-17T10:25
title: API Management
slug: api-management
metadescription: Put Azure API Management in front of your APIs for authentication, rate limiting, transformation and a developer portal.
updateDate: 2026-09-07T10:25
author: ['bishal-biswas']
level: 3
tags: ['integration', 'api management', 'apis']
course: azure
---

## What it does

A gateway in front of one or more backend APIs. It handles the concerns every API needs and none of them should implement individually.

```text
Authentication and authorisation
Rate limiting and quotas
Caching
Request and response transformation
Versioning and revisions
A developer portal with documentation
Analytics and logging
```

The value grows with the number of APIs. For one API it is often overkill; for fifteen across several teams it stops each of them solving the same problems differently.

## Tiers

```text
Consumption  serverless, pay per call, scales to zero. No developer portal,
             no vnet. Good for low volume and for learning.
Basic v2 / Standard v2  faster provisioning, vnet integration, modern platform
Premium      multi region, vnet injection, self hosted gateway, highest scale
Developer    full features, NO SLA. Non production only.
```

```bash
az apim create \
  --name apim-shop --resource-group rg-shop-prod-uks \
  --location uksouth --sku-name StandardV2 \
  --publisher-email api@contoso.com --publisher-name "Contoso"
```

**Classic tier provisioning takes 30 to 45 minutes.** The v2 tiers provision in minutes, which is one of the main reasons to prefer them.

## Importing an API

```bash
az apim api import \
  --resource-group rg-shop-prod-uks --service-name apim-shop \
  --path shop --api-id shop-api \
  --specification-format OpenApi \
  --specification-url https://shop-api.azurewebsites.net/swagger/v1/swagger.json \
  --service-url https://shop-api.azurewebsites.net \
  --subscription-required true
```

```text
--path            the public route segment, so /shop/orders
--service-url     where requests are forwarded
--subscription-required  whether a key is needed
```

Importing from OpenAPI keeps the gateway definition in step with the API, and it can be re-run in a pipeline whenever the specification changes.

## Policies are the real feature

Policies are XML applied at four scopes, and they are where the work happens.

```text
Global      every API
Product     every API in a product
API         one API
Operation   one endpoint
```

```xml
<policies>
  <inbound>
    <base />

    <!-- validate a JWT before the request reaches the backend -->
    <validate-jwt header-name="Authorization"
                  failed-validation-httpcode="401"
                  failed-validation-error-message="Unauthorized">
      <openid-config url="https://login.microsoftonline.com/TENANT_ID/v2.0/.well-known/openid-configuration" />
      <audiences>
        <audience>api://shop</audience>
      </audiences>
      <required-claims>
        <claim name="roles" match="any">
          <value>Orders.Read</value>
        </claim>
      </required-claims>
    </validate-jwt>

    <!-- per subscription rate limit -->
    <rate-limit-by-key calls="100" renewal-period="60"
                       counter-key="@(context.Subscription?.Id ?? context.Request.IpAddress)" />

    <!-- monthly quota -->
    <quota-by-key calls="100000" renewal-period="2592000"
                  counter-key="@(context.Subscription.Id)" />

    <!-- call the backend with a managed identity, no key anywhere -->
    <authentication-managed-identity resource="api://shop-backend" />

    <set-header name="X-Correlation-Id" exists-action="skip">
      <value>@(Guid.NewGuid().ToString())</value>
    </set-header>
  </inbound>

  <backend>
    <forward-request timeout="30" />
  </backend>

  <outbound>
    <base />
    <!-- do not leak backend implementation details -->
    <set-header name="X-Powered-By" exists-action="delete" />
    <set-header name="Server" exists-action="delete" />
  </outbound>

  <on-error>
    <base />
    <set-body>@{
      return new JObject(
        new JProperty("error", context.LastError.Message),
        new JProperty("correlationId", context.RequestId)
      ).ToString();
    }</set-body>
  </on-error>
</policies>
```

Two of those are worth emphasising.

**`validate-jwt` moves authentication to the gateway.** Every backend behind it can trust that a request arriving has a valid token with the required claims, so the same validation is not written five times.

**`authentication-managed-identity` calls the backend as the gateway's identity.** No key, no secret, and the backend can restrict access to that identity alone.

## Products and subscriptions

```bash
az apim product create \
  --resource-group rg-shop-prod-uks --service-name apim-shop \
  --product-id partner --product-name "Partner API" \
  --subscription-required true --approval-required true --state published

az apim product api add \
  --resource-group rg-shop-prod-uks --service-name apim-shop \
  --product-id partner --api-id shop-api
```

A product groups APIs with a shared access model. Consumers subscribe to a product and receive a key, and policies at product scope apply to everything in it.

The usual shape is a free tier with low limits and a paid tier with higher ones, which is two products with different rate limit policies.

## Caching

```xml
<inbound>
  <base />
  <cache-lookup vary-by-developer="false"
                vary-by-developer-groups="false"
                downstream-caching-type="none">
    <vary-by-header>Accept</vary-by-header>
    <vary-by-query-parameter>page</vary-by-query-parameter>
  </cache-lookup>
</inbound>
<outbound>
  <base />
  <cache-store duration="300" />
</outbound>
```

Responses cached at the gateway never reach the backend, which is the cheapest possible improvement for a read heavy API.

Be careful with `vary-by`. Missing a parameter that changes the response means serving the wrong data, which is worse than not caching.

For anything user specific, either vary by the relevant claim or do not cache at all.

## Versioning and revisions

```text
Version   a breaking change. Consumers choose when to move.
Revision  a non breaking change. Can be tested, then made current.
```

```bash
az apim api create \
  --resource-group rg-shop-prod-uks --service-name apim-shop \
  --api-id shop-api-v2 --path shop --api-version v2 \
  --api-version-set-id shop-versions --display-name "Shop API v2"
```

Versioning by path segment, header or query parameter. Path is clearest for consumers.

Revisions let you change a live API safely: make the revision, test it on its own URL, then promote it to current. Rolling back is promoting the previous revision.

## Self hosted gateway

```bash
az apim gateway create \
  --resource-group rg-shop-prod-uks --service-name apim-shop \
  --gateway-id onprem --location "{name:'UK South'}"
```

Premium tier only. A container running the gateway wherever the backend is: on premises, in another cloud, in a Kubernetes cluster. Management and policy definitions stay in Azure while traffic stays local.

Useful for hybrid estates where data must not leave a location.

## Watching it

```bash
az monitor diagnostic-settings create \
  --name apim-diag --resource /subscriptions/.../service/apim-shop \
  --workspace /subscriptions/.../workspaces/law-shop \
  --logs '[{"category":"GatewayLogs","enabled":true}]'
```

```kusto
ApiManagementGatewayLogs
| where TimeGenerated > ago(1h)
| summarize
    calls = count(),
    failures = countif(ResponseCode >= 400),
    p95 = percentile(DurationMs, 95),
    backendP95 = percentile(BackendTime, 95)
  by ApiId, OperationId
| order by calls desc
```

Comparing `DurationMs` with `BackendTime` separates gateway overhead from backend latency, which settles the argument about whether API Management is making things slow.

## When it is not worth it

```text
One API, one consumer, no rate limiting needed
A team that will not maintain policies
A budget where the tier cost matters relative to the backend
```

For a single internal API, Application Gateway or Front Door with a WAF covers routing and protection at lower cost. API Management earns its place when there are several APIs, external consumers, or a genuine need for keys, quotas and a portal.

## Quick recap

- API Management centralises authentication, rate limiting, caching and transformation for several APIs.
- The v2 tiers provision in minutes, where classic tiers take 30 to 45.
- Policies at four scopes are the real feature, and XML is where the work happens.
- `validate-jwt` means backends can trust that requests are already authenticated.
- `authentication-managed-identity` calls backends with no key anywhere.
- Missing a `vary-by` on a cache serves the wrong data, which is worse than not caching.
- Compare `DurationMs` with `BackendTime` to separate gateway overhead from backend latency.

<code id="code-content" class="language-http">
POST /shop/orders HTTP/1.1
Host: apim-shop.azure-api.net
Ocp-Apim-Subscription-Key: 8f2c...        # from the PRODUCT the caller subscribed to
Authorization: Bearer eyJhbGciOiJSUzI1...
Content-Type: application/json
#
# THE GATEWAY APPLIES POLICIES AT FOUR SCOPES: global, product, API,
# operation. Policies are the real feature. In the inbound section:
#
#   &lt;validate-jwt header-name="Authorization" failed-validation-httpcode="401"&gt;
#     &lt;openid-config url="https://login.microsoftonline.com/TENANT/v2.0/
#                         .well-known/openid-configuration" /&gt;
#     &lt;audiences&gt;&lt;audience&gt;api://shop&lt;/audience&gt;&lt;/audiences&gt;
#     &lt;required-claims&gt;
#       &lt;claim name="roles" match="any"&gt;&lt;value&gt;Orders.Read&lt;/value&gt;&lt;/claim&gt;
#     &lt;/required-claims&gt;
#   &lt;/validate-jwt&gt;
#
# THAT MOVES AUTHENTICATION TO THE GATEWAY, so every backend behind it can
# trust the request, and the same validation is not written five times.
#
#   &lt;rate-limit-by-key calls="100" renewal-period="60"
#     counter-key="@(context.Subscription?.Id ?? context.Request.IpAddress)" /&gt;
#   &lt;quota-by-key calls="100000" renewal-period="2592000"
#     counter-key="@(context.Subscription.Id)" /&gt;
#
#   &lt;authentication-managed-identity resource="api://shop-backend" /&gt;
# CALLS THE BACKEND AS THE GATEWAY'S IDENTITY. No key, no secret, and the
# backend can restrict access to that identity alone.
#
# outbound: do not leak implementation details
#   &lt;set-header name="X-Powered-By" exists-action="delete" /&gt;
#   &lt;set-header name="Server" exists-action="delete" /&gt;
#
HTTP/1.1 200 OK
X-Correlation-Id: 5f1a9c22-7c4e-4a1b-9f3e-2b6d8c0a1e77
Cache-Control: max-age=300
#
# CACHING at the gateway means the request NEVER REACHES THE BACKEND, the
# cheapest possible improvement for a read heavy API. BUT: missing a
# vary-by parameter that changes the response SERVES THE WRONG DATA, which
# is worse than not caching. For user specific responses, vary by the claim
# or do not cache.
#
# VERSIONS are breaking changes consumers opt into. REVISIONS are non
# breaking: test on their own URL, promote to current, and roll back by
# promoting the previous one.
#
# TIERS: classic provisioning takes 30 TO 45 MINUTES; v2 tiers take minutes.
# Developer tier has every feature and NO SLA, so non production only.
#
# WATCHING IT. Comparing DurationMs with BackendTime separates GATEWAY
# OVERHEAD from BACKEND LATENCY, which settles the argument about whether
# API Management is making things slow:
#   ApiManagementGatewayLogs
#   | summarize calls=count(), failures=countif(ResponseCode &gt;= 400),
#               p95=percentile(DurationMs, 95),
#               backendP95=percentile(BackendTime, 95) by ApiId, OperationId
#
# WHEN IT IS NOT WORTH IT: one API, one consumer, no rate limiting. Front
# Door or Application Gateway with WAF covers routing and protection for
# less. API Management earns its place with SEVERAL APIs, EXTERNAL
# consumers, or a real need for keys, quotas and a portal.
</code></pre>
