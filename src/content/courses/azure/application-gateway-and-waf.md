---
publishDate: 2026-10-06T07:25
title: Application Gateway and Web Application Firewall
slug: application-gateway-and-waf
metadescription: Route HTTP traffic with Application Gateway, terminate TLS, and block common attacks with the Web Application Firewall.
updateDate: 2026-09-07T07:25
author: ['bishal-biswas']
level: 2
tags: ['networking', 'security', 'waf']
course: azure
---

## What it is

Application Gateway is a layer 7 load balancer. It understands HTTP, so it can route on hostname and path, terminate TLS, rewrite headers, and run a Web Application Firewall.

```text
Load Balancer       routes packets
Application Gateway routes requests
```

That difference is why an NSG cannot do what a WAF does. An NSG sees a TCP connection to port 443. Application Gateway sees the URL, the headers and the body.

## The pieces

```text
Frontend IP        public, private, or both
Listener           protocol, port, hostname, certificate
Backend pool       VMs, scale sets, App Service, or IP addresses
Backend setting    protocol, port, timeouts, cookie affinity
Health probe       how backend health is decided
Routing rule       ties listener to backend, with optional path rules
```

More moving parts than a load balancer, and each maps to something in the HTTP conversation.

```bash
az network application-gateway create \
  --name agw-shop --resource-group rg-shop-prod-uks \
  --location uksouth \
  --sku WAF_v2 \
  --capacity 2 \
  --vnet-name vnet-shop-prod-uks --subnet snet-agw \
  --public-ip-address pip-agw \
  --frontend-port 443 \
  --http-settings-port 80 --http-settings-protocol Http \
  --priority 100
```

The gateway needs its **own dedicated subnet**, containing nothing else. A /24 is a safe size.

## v2 only

```text
v1  retired. Migrate.
v2  autoscaling, zone redundancy, faster, supports Key Vault certificates
```

Application Gateway v1 was retired in 2023, so anything new is v2. Within v2, `Standard_v2` is the plain version and `WAF_v2` adds the firewall.

## Path based routing

```bash
az network application-gateway url-path-map create \
  --gateway-name agw-shop --resource-group rg-shop-prod-uks \
  --name paths \
  --paths "/api/*" \
  --address-pool pool-api --http-settings settings-api \
  --default-address-pool pool-web --default-http-settings settings-web

az network application-gateway url-path-map rule create \
  --gateway-name agw-shop --resource-group rg-shop-prod-uks \
  --path-map-name paths --name images \
  --paths "/images/*" \
  --address-pool pool-static --http-settings settings-static
```

One public address, several backends, chosen by path. This is how a single hostname serves a web app and an API from different services.

Multi site listeners do the same by hostname, so `shop.example.com` and `admin.example.com` route to different pools from one gateway.

## TLS

Two decisions, and they are independent.

**Termination.** The gateway holds the certificate and decrypts. Backends receive plain HTTP inside the virtual network. Simplest, and the certificate lives in one place.

**End to end.** The gateway decrypts, inspects, then re-encrypts to the backend. Needed where the backend must also see HTTPS, or where policy demands encryption on every hop.

```bash
az network application-gateway ssl-cert create \
  --gateway-name agw-shop --resource-group rg-shop-prod-uks \
  --name cert-shop \
  --key-vault-secret-id https://kv-shop-prod.vault.azure.net/secrets/shop-cert
```

Referencing Key Vault is the right approach, because renewal then happens in one place and the gateway picks it up. Doing it with an uploaded PFX means remembering to re-upload each year, and someone will forget.

The gateway needs a user assigned managed identity with `Key Vault Secrets User` to read it.

```bash
az network application-gateway ssl-policy set \
  --gateway-name agw-shop --resource-group rg-shop-prod-uks \
  --policy-type Predefined --policy-name AppGwSslPolicy20220101S
```

Set an explicit TLS policy. The strict predefined policies disable old protocols and weak ciphers, and the default is more permissive than most people expect.

## The Web Application Firewall

```bash
az network application-gateway waf-policy create \
  --name waf-shop --resource-group rg-shop-prod-uks

az network application-gateway waf-policy managed-rule rule-set add \
  --policy-name waf-shop --resource-group rg-shop-prod-uks \
  --type OWASP --version 3.2

az network application-gateway waf-policy policy-setting update \
  --policy-name waf-shop --resource-group rg-shop-prod-uks \
  --mode Detection --state Enabled
```

The managed rule set is derived from the OWASP Core Rule Set, and covers SQL injection, cross site scripting, remote file inclusion, protocol violations and more.

```text
Detection   log only. Where every deployment starts.
Prevention  block. Where you move after tuning.
```

**Always start in Detection.** Core Rule Set produces false positives on real applications, and finding out in Prevention mode means blocking real customers.

## Tuning

```kusto
AzureDiagnostics
| where Category == "ApplicationGatewayFirewallLog"
| summarize count() by ruleId_s, Message, requestUri_s
| order by count_ desc
```

Run in Detection for a week, look at what would have been blocked, and exclude the rules that fire on legitimate traffic.

```bash
az network application-gateway waf-policy managed-rule exclusion add \
  --policy-name waf-shop --resource-group rg-shop-prod-uks \
  --match-variable RequestArgNames \
  --selector-match-operator Equals --selector "description"
```

A rich text field triggering the XSS rules is the standard example. Exclude that field, not the rule, so the rule still protects everything else.

Only switch to Prevention once the logs are quiet.

## Custom rules

```bash
az network application-gateway waf-policy custom-rule create \
  --policy-name waf-shop --resource-group rg-shop-prod-uks \
  --name RateLimitLogin \
  --priority 10 --rule-type RateLimitRule --action Block \
  --rate-limit-threshold 100 --rate-limit-duration OneMin \
  --group-by-user-session ClientAddr
```

Custom rules evaluate before managed rules, in priority order. Rate limiting a login endpoint is the most useful one, and geo blocking is next.

## Header rewriting

```bash
az network application-gateway rewrite-rule set create \
  --gateway-name agw-shop --resource-group rg-shop-prod-uks --name security-headers
```

Adding `Strict-Transport-Security`, `X-Content-Type-Options` and a `Content-Security-Policy` at the gateway applies them to every backend at once, which is easier than changing several applications.

Removing headers matters too. `Server` and `X-Powered-By` tell an attacker what you are running.

## Application Gateway or Front Door

```text
Application Gateway  regional, inside your vnet, can reach private backends
Front Door           global, at the edge, caching, multi region failover
```

They are commonly used together: Front Door at the edge for global routing and caching, Application Gateway in each region for private backends and regional WAF.

For a single region application, Application Gateway alone is usually enough.

## Debugging

**502 Bad Gateway.** Almost always the health probe or the backend. Check probe status first.

```bash
az network application-gateway show-backend-health \
  --name agw-shop --resource-group rg-shop-prod-uks \
  --query "backendAddressPools[].backendHttpSettingsCollection[].servers[]" --output table
```

**Legitimate requests blocked.** A WAF rule. Look in the firewall log for the rule ID.

**Certificate errors on end to end TLS.** The backend certificate must be trusted, and for a self signed one the root must be uploaded to the gateway.

**Slow provisioning.** Changes take minutes, and the subnet must have room.

## Quick recap

- Application Gateway routes requests rather than packets, which is why it can run a WAF.
- It needs a dedicated subnet, and only v2 exists now.
- Reference certificates from Key Vault so renewal happens in one place.
- Set an explicit TLS policy, since the default is permissive.
- Always start the WAF in Detection mode, tune the false positives, then move to Prevention.
- Exclude the specific field, not the whole rule, so protection stays in place elsewhere.
- A 502 is almost always the health probe, so check backend health first.

<code id="code-content" class="language-bash">
# Load Balancer routes PACKETS. Application Gateway routes REQUESTS. That is
# why an NSG cannot do what a WAF does: the NSG sees a TCP connection to
# 443, the gateway sees the URL, the headers and the body.
# It needs its OWN DEDICATED SUBNET. A /24 is safe. Only v2 exists now:
# Standard_v2, or WAF_v2 to add the firewall.
az network application-gateway create --name agw-shop \
  --resource-group rg-shop-prod-uks --sku WAF_v2 --capacity 2 \
  --vnet-name vnet-shop-prod-uks --subnet snet-agw \
  --public-ip-address pip-agw --frontend-port 443 --priority 100
# THE PIECES: frontend IP, listener (protocol, port, host, certificate),
# backend pool, backend setting, health probe, routing rule.
# PATH BASED ROUTING: one address, several backends, chosen by path.
az network application-gateway url-path-map create --gateway-name agw-shop \
  --resource-group rg-shop-prod-uks --name paths --paths "/api/*" \
  --address-pool pool-api --http-settings settings-api \
  --default-address-pool pool-web --default-http-settings settings-web
# TLS: reference the certificate from KEY VAULT, so renewal happens in one
# place. An uploaded PFX means remembering to re-upload each year.
az network application-gateway ssl-cert create --gateway-name agw-shop \
  --resource-group rg-shop-prod-uks --name cert-shop \
  --key-vault-secret-id https://kv-shop-prod.vault.azure.net/secrets/shop-cert
# Set an EXPLICIT TLS policy. The default is more permissive than expected.
az network application-gateway ssl-policy set --gateway-name agw-shop \
  --resource-group rg-shop-prod-uks --policy-type Predefined \
  --policy-name AppGwSslPolicy20220101S
# THE WAF. ALWAYS START IN DETECTION. Core Rule Set produces false
# positives on real applications, and discovering that in Prevention mode
# means blocking real customers.
az network application-gateway waf-policy managed-rule rule-set add \
  --policy-name waf-shop --resource-group rg-shop-prod-uks --type OWASP --version 3.2
az network application-gateway waf-policy policy-setting update \
  --policy-name waf-shop --resource-group rg-shop-prod-uks --mode Detection --state Enabled
# Run a week, then read what WOULD have been blocked:
#   AzureDiagnostics
#   | where Category == "ApplicationGatewayFirewallLog"
#   | summarize count() by ruleId_s, requestUri_s | order by count_ desc
# EXCLUDE THE FIELD, NOT THE RULE, so it still protects everything else.
# A rich text field triggering XSS rules is the standard example.
az network application-gateway waf-policy managed-rule exclusion add \
  --policy-name waf-shop --resource-group rg-shop-prod-uks \
  --match-variable RequestArgNames --selector-match-operator Equals --selector "description"
# Custom rules run BEFORE managed rules. Rate limiting login is the most
# useful one:
az network application-gateway waf-policy custom-rule create \
  --policy-name waf-shop --resource-group rg-shop-prod-uks --name RateLimitLogin \
  --priority 10 --rule-type RateLimitRule --action Block \
  --rate-limit-threshold 100 --rate-limit-duration OneMin --group-by-user-session ClientAddr
# A 502 IS ALMOST ALWAYS THE PROBE OR THE BACKEND. Check health first:
az network application-gateway show-backend-health --name agw-shop \
  --resource-group rg-shop-prod-uks
</code></pre>
