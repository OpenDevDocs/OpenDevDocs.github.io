---
publishDate: 2026-10-25T11:00
title: HTTP, HTTPS and TLS Certificates
slug: http-https-and-tls
metadescription: Learn how HTTP requests and responses work, what status codes mean for operations, how HTTPS and TLS keep traffic private, how certificates and the chain of trust work, and how to get free certificates with Let's Encrypt.
updateDate: 2026-10-25T11:00
author: ['bishal-biswas']
level: 1
tags: ['devops', 'networking', 'http', 'https', 'tls']
course: devops
---

## The language of the web

You now know how machines find each other ([IP addresses and ports](/courses/devops/ip-addresses-ports-and-protocols)) and how names become addresses ([DNS](/courses/devops/how-dns-works)). This lesson is about what they actually **say** to each other.

Almost everything you deploy speaks **HTTP**, the **HyperText Transfer Protocol**: websites, APIs, health checks, webhooks, container registries, even the tools that talk to Kubernetes. Being able to read HTTP traffic is one of the most useful debugging skills in DevOps.

## Requests and responses

HTTP is a simple conversation. A **client** (a browser, `curl`, your app) sends a **request**, and a **server** sends back a **response**. One question, one answer.

Here is a real request, as it travels over the network:

```http
GET /recipes/42 HTTP/1.1
Host: shop.example.com
User-Agent: curl/8.5.0
Accept: application/json
```

- The first line has the **method** (`GET`), the **path** (`/recipes/42`) and the protocol version.
- Then come **headers**: `Name: value` lines with extra information.
- Requests that send data, such as `POST`, add a blank line and a **body** after the headers.

And the server's response:

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 61
Cache-Control: max-age=60

{"id":42,"title":"Masala Dosa","minutes":45,"vegetarian":true}
```

- The first line has the **status code** (`200`) and a short reason (`OK`).
- Then headers, a blank line and the **body**: the actual content.

### Methods

| Method | Meaning | Example |
|---|---|---|
| `GET` | Read something | Load a page, fetch a recipe |
| `POST` | Create something, or trigger an action | Submit a form, place an order |
| `PUT` | Replace something completely | Save an edited recipe |
| `PATCH` | Change part of something | Update just the title |
| `DELETE` | Remove something | Delete a comment |
| `HEAD` | Like `GET`, but headers only, no body | Quick checks: "does this exist, how big is it?" |

### Status codes

Status codes are grouped by their first digit. As an operator, these are the ones to know well:

| Code | Meaning | What it tells you |
|---|---|---|
| **2xx** | **Success** | |
| 200 OK | It worked | |
| 201 Created | A new thing was created | Typical reply to a `POST` |
| 204 No Content | It worked; nothing to send back | |
| **3xx** | **Go somewhere else** | |
| 301 / 308 | Moved permanently | Old URL, or `http://` redirecting to `https://` |
| 302 / 307 | Moved temporarily | Login redirects |
| 304 Not Modified | Your cached copy is still good | Caching is working |
| **4xx** | **The client did something wrong** | |
| 400 Bad Request | The request made no sense | Malformed JSON, missing fields |
| 401 Unauthorized | Who are you? Log in first | Missing or expired token |
| 403 Forbidden | I know who you are, but no | Wrong permissions |
| 404 Not Found | Nothing at that path | Typo, or a route was not deployed |
| 429 Too Many Requests | Slow down | Rate limiting kicked in |
| **5xx** | **The server failed** | |
| 500 Internal Server Error | The app crashed while handling it | Check the app's logs |
| 502 Bad Gateway | A proxy could not get a valid answer from the app behind it | App is down or crashing |
| 503 Service Unavailable | Temporarily unable to serve | Overloaded, or in maintenance |
| 504 Gateway Timeout | A proxy waited too long for the app | App is too slow, or stuck |

The simple rule: **4xx means the caller should change something; 5xx means you should**. A sudden rise in 5xx errors after a deployment is one of the clearest signs a release went wrong, and a key thing to watch in [Monitoring, Logging and Alerting](/courses/devops/monitoring-logging-and-alerting). You will see where 502, 503 and 504 come from in [Reverse Proxies and Load Balancers](/courses/devops/reverse-proxies-and-load-balancers).

### Headers worth knowing

| Header | What it does |
|---|---|
| `Host` | Which website the request is for. One server can host many sites on the same IP; this header tells it which one. |
| `Content-Type` | The format of the body: `text/html`, `application/json` and so on. |
| `Cache-Control` | Whether, and for how long, browsers and CDNs may cache the response. |
| `Authorization` | Credentials, such as a token: `Bearer eyJhbGci...` |
| `Cookie` / `Set-Cookie` | Small pieces of data the browser stores and sends back, such as a login session. |
| `Location` | Where to go next, sent with 3xx redirects. |
| `X-Forwarded-For` | The original client's IP, added by proxies. |

### HTTP versions

- **HTTP/1.1** (1997) is the plain-text version shown above, still everywhere.
- **HTTP/2** (2015) sends many requests at once over one connection, in a compact binary format. Much faster for pages with lots of files.
- **HTTP/3** (2022) runs over **QUIC**, which is built on UDP instead of TCP, so connections start faster and cope better with patchy mobile networks.

The meaning (methods, status codes, headers) is the same in all three. Your app usually does not need to care which one the browser used.

## Talking HTTP with curl

`curl` lets you send any HTTP request from the terminal. It is the DevOps engineer's Swiss Army knife:

```bash
curl https://example.com                 # GET a page and print the body
curl -I https://example.com              # HEAD: show only the status and headers
curl -v https://example.com              # verbose: show the whole conversation, TLS included
curl -L http://github.com                # follow redirects
curl -X POST https://api.example.com/orders \
     -H "Content-Type: application/json" \
     -d '{"recipeId": 42}'               # send JSON
curl -o /dev/null -s -w "%{http_code} %{time_total}s\n" https://example.com   # status and timing only
```

That last line is a handy one-line health check: it prints only the status code and how long the request took.

## Why HTTP is not enough: HTTPS

Plain HTTP sends everything as readable text. Anyone between you and the server, on the same café Wi-Fi, at your internet provider, on any network along the way, could:

- **read** it: passwords, cookies, personal data;
- **change** it: inject adverts or malware into a page;
- **pretend to be** the server you meant to reach.

**HTTPS** is HTTP sent through an encrypted tunnel built with **TLS** (**Transport Layer Security**). It gives you three guarantees:

| Guarantee | Meaning |
|---|---|
| **Privacy** | Nobody in between can read the traffic |
| **Integrity** | Nobody in between can change it without being detected |
| **Authentication** | You really are talking to the site you asked for |

Today HTTPS is simply the default. Browsers mark plain HTTP pages as "Not secure", many browser features only work over HTTPS, and certificates are free. Every site you deploy should use it.

> **Note:** You will still hear people say **SSL** and "SSL certificate". SSL was TLS's older predecessor and is long retired, along with TLS 1.0 and 1.1. Today you should use **TLS 1.2** or **TLS 1.3**. The name "SSL certificate" has just stuck.

## How TLS works, simply

When your browser connects to `https://example.com`, the two sides do a quick **TLS handshake** before any HTTP is sent:

1. **Hello.** The browser says which TLS versions and encryption methods it supports, and which site it wants (this name is called **SNI**, Server Name Indication).
2. **Certificate.** The server picks the best options and sends its **certificate**: a file that says "I am `example.com`", signed by someone the browser trusts.
3. **Check.** The browser checks the certificate: is it for this exact name? Is it still valid? Is it signed by a trusted authority?
4. **Shared key.** Both sides use clever mathematics to agree on a secret **session key**, without ever sending the key itself over the network.
5. **Encrypted HTTP.** All HTTP traffic from now on is encrypted with that key.

TLS 1.3 does all of this in a single round trip, so HTTPS adds very little delay.

## Certificates and the chain of trust

A **TLS certificate** contains:

- the **domain names** it is valid for, such as `example.com` and `www.example.com` (or a **wildcard**, `*.example.com`);
- the server's **public key**;
- **valid from** and **valid to** dates;
- who **issued** it, and their digital signature.

Why should your browser believe a certificate? Because it was signed by a **Certificate Authority** (CA), an organisation whose job is to check that whoever asks for a certificate really controls the domain.

Your operating system and browser come with a built-in list of trusted **root CAs**. Root CAs rarely sign server certificates directly. Instead there is a **chain**:

```text
Root CA            (built into your OS / browser: trusted)
   └── signs ──> Intermediate CA
                    └── signs ──> example.com certificate  (sent by the server)
```

The browser follows the chain from the site's certificate up to a root it trusts. If any link is missing or wrong, the connection is refused.

A **self-signed** certificate is one that signed itself, with no CA involved. It still encrypts traffic, but nobody can check that it is genuine, so browsers show a big warning. It is fine for testing on your own machine and never for a public site.

## Free certificates with Let's Encrypt

Certificates used to cost money and need manual renewal every year. **Let's Encrypt**, a free, non-profit CA launched in 2015, changed that. It issues certificates automatically, using a protocol called **ACME**:

1. A tool on your server asks Let's Encrypt for a certificate for `example.com`.
2. Let's Encrypt replies: "prove you control it", for example by placing a special file at `http://example.com/.well-known/acme-challenge/...` or by adding a DNS TXT record.
3. Let's Encrypt checks, then issues the certificate.
4. The tool installs it and **renews it automatically** before it expires.

On an Ubuntu server running nginx, the most common tool is **certbot**:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
```

Certbot gets the certificate, updates the nginx configuration and installs a timer that renews it automatically. Many modern tools do all this with no extra steps at all: the **Caddy** web server, Kubernetes' **cert-manager**, and most hosting platforms and cloud load balancers.

> **Note:** Certificate lifetimes are getting shorter. Let's Encrypt certificates last 90 days, and in 2025 the browser and CA industry agreed to cut the maximum lifetime of any public certificate from 398 days to 200 days in March 2026, then step by step down to 47 days by 2029. Manual renewal is no longer realistic: **automate it**.

## HTTPS in practice

A few habits for every site you run:

- **Redirect HTTP to HTTPS.** Keep port 80 open only to send a `301` redirect to the `https://` address (and for ACME challenges).
- **Send HSTS.** The `Strict-Transport-Security` header tells browsers "only ever use HTTPS for this site", so they never even try plain HTTP again.
- **Monitor expiry.** Even with automation, alert if a certificate has fewer than 14 days left. Expired certificates are one of the most common causes of very public outages.
- **Terminate TLS in one place.** Usually a reverse proxy or load balancer handles HTTPS, and talks to your app behind it over the private network. See [Reverse Proxies and Load Balancers](/courses/devops/reverse-proxies-and-load-balancers).

To check a certificate by hand:

```bash
openssl s_client -connect example.com:443 -servername example.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

```text
subject=CN=example.com
issuer=C=US, O=SSL Corporation, CN=Cloudflare TLS Issuing ECC CA 3
notBefore=Sep 26 22:49:11 2026 GMT
notAfter=Dec 25 22:56:35 2026 GMT
```

### Common HTTPS errors

| Browser or curl error | Meaning | Fix |
|---|---|---|
| Certificate expired | `notAfter` is in the past | Renew it, then fix the automation that should have |
| Name mismatch | The certificate does not list this domain | Include every name (`www` too) when requesting it |
| Unknown issuer / incomplete chain | The server sent its certificate without the intermediate | Serve the **full chain** file (certbot's `fullchain.pem`) |
| Self-signed certificate | No trusted CA signed it | Use a real certificate from a CA such as Let's Encrypt |
| Mixed content | An HTTPS page loads images or scripts over `http://` | Load every resource over HTTPS |

## Checking any site's HTTPS

The code panel has a Node.js script that connects to a site the way a browser does. It reports the TLS version, whether the certificate is trusted, who it was issued to and by, and how many days are left, and then shows the HTTP response headers:

```bash
node tls-check.mjs
```

```text
TLS connection to github.com:443
  protocol     TLSv1.3
  cipher       TLS_AES_128_GCM_SHA256
  trusted      yes
Certificate
  issued to    github.com
  also valid   github.com, www.github.com
  issued by    Sectigo Limited (Sectigo Public Server Authentication CA DV E36)
  expires      2026-11-29 (35 days left)
HTTP response
  status       200 OK
  content-type               text/html; charset=utf-8
  cache-control              max-age=0, private, must-revalidate
  strict-transport-security  max-age=31536000; includeSubdomains; preload
  server                     github.com
```

Notice GitHub's **HSTS** header, asking browsers to use HTTPS for a full year. To see a broken certificate safely, try the test site `expired.badssl.com`:

```bash
node tls-check.mjs expired.badssl.com
```

```text
  trusted      NO (CERT_HAS_EXPIRED)
...
  expires      2015-04-12 (EXPIRED)
Browsers and fetch() would refuse this connection, so stopping here.
```

## Common misunderstandings

### "HTTPS makes my site secure"

HTTPS protects data **while it travels**. It does nothing about bugs in your app, weak passwords or an unpatched server. It is necessary, but it is only one layer.

### "A padlock means the site is trustworthy"

The padlock only means the connection is encrypted and the certificate matches the name. A scam site can have a perfectly valid certificate for its own scam domain.

### "Internal traffic does not need encryption"

Traffic inside a private network used to be trusted by default. Modern security practice, often called **zero trust**, encrypts internal traffic too, especially between services that handle personal data. Start with HTTPS at the edge, and add internal encryption as your system grows.

## Quick recap

- **HTTP** is a request/response conversation: method, path, headers, body; status code, headers, body.
- **4xx** codes mean the client should change something; **5xx** codes mean the server failed.
- `curl -I`, `curl -v` and `curl -w` are your everyday HTTP tools.
- **HTTPS** is HTTP inside **TLS**, which gives privacy, integrity and authentication.
- **Certificates** prove a server's identity through a **chain of trust** up to a root CA.
- **Let's Encrypt** and ACME make certificates free and automatic. Automate renewal, and monitor expiry.

Next, you will put a single front door in front of your apps in [Reverse Proxies and Load Balancers](/courses/devops/reverse-proxies-and-load-balancers).

<code id="code-content" class="language-javascript">
// tls-check.mjs: inspect a site's HTTPS connection and certificate, then its HTTP response.
// Run it with: node tls-check.mjs                (checks github.com)
//          or: node tls-check.mjs example.com
import tls from 'node:tls';
const host = process.argv[2] ?? 'github.com';
const DAY = 24 * 60 * 60 * 1000;
// 1. The TLS handshake: agree on encryption and check the certificate
// rejectUnauthorized: false lets us inspect a bad certificate instead of failing at once
const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false });
await new Promise((resolve, reject) =&gt; socket.once('secureConnect', resolve).once('error', reject));
const cert = socket.getPeerCertificate();
const daysLeft = Math.floor((new Date(cert.valid_to) - Date.now()) / DAY);
const names = (cert.subjectaltname ?? '').replaceAll('DNS:', '').split(', ');
console.log(`TLS connection to ${host}:443`);
console.log(`  protocol     ${socket.getProtocol()}`);
console.log(`  cipher       ${socket.getCipher().name}`);
console.log(`  trusted      ${socket.authorized ? 'yes' : `NO (${socket.authorizationError})`}`);
console.log('Certificate');
console.log(`  issued to    ${cert.subject?.CN}`);
console.log(`  also valid   ${names.slice(0, 4).join(', ')}${names.length &gt; 4 ? ', ...' : ''}`);
console.log(`  issued by    ${cert.issuer?.O} (${cert.issuer?.CN})`);
console.log(`  expires      ${new Date(cert.valid_to).toISOString().slice(0, 10)} (${daysLeft &lt; 0 ? 'EXPIRED' : `${daysLeft} days left`})`);
if (daysLeft &gt;= 0 &amp;&amp; daysLeft &lt; 14) console.log('  WARNING: renew this certificate soon!');
socket.end();
if (!socket.authorized) {
  console.log('Browsers and fetch() would refuse this connection, so stopping here.');
  process.exit(1);
}
// 2. The HTTP request that travels inside that encrypted tunnel
const res = await fetch(`https://${host}/`, { method: 'HEAD', redirect: 'manual' });
console.log('HTTP response');
console.log(`  status       ${res.status} ${res.statusText}`);
for (const name of ['content-type', 'location', 'cache-control', 'strict-transport-security', 'server']) {
  if (res.headers.has(name)) console.log(`  ${name.padEnd(26)} ${res.headers.get(name)}`);
}
</code></pre>
