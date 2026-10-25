---
publishDate: 2026-10-25T10:02
title: Reverse Proxies and Trusting Proxy Headers
slug: reverse-proxies-and-trust-proxy
metadescription: Learn what a reverse proxy does, how X-Forwarded headers work, and how to configure Express 5's trust proxy setting safely so req.ip, req.protocol and req.secure are correct.
updateDate: 2026-10-25T10:02
author: ['bishal-biswas']
level: 4
tags: ['express', 'nginx', 'deployment', 'security']
course: expressjs
---

## What you will learn

- What a **reverse proxy** is and why almost every production Express app sits behind one
- How the `X-Forwarded-For` and `X-Forwarded-Proto` headers work
- How to set Express's **`trust proxy`** setting correctly, and why `true` is usually wrong
- How proxy settings affect rate limiting, secure cookies and HTTPS redirects
- How to configure Nginx and Caddy in front of an Express app

## What is a reverse proxy?

A **reverse proxy** is a server that sits in front of your app, receives requests from the internet, and passes them on to your app. Your app's answer travels back through the proxy to the client.

Think of a hotel receptionist. Guests never walk straight to the kitchen or the laundry. They talk to the front desk, which passes requests to the right department and hands back the result.

```text
  Client (browser)
       |
       |  HTTPS  (public internet)
       v
 +------------------+
 |  Reverse proxy   |   Nginx, Caddy, a cloud load balancer, Cloudflare...
 +------------------+
       |
       |  plain HTTP  (private network)
       v
 +------------------+
 |  Express app     |   listening on port 3000
 +------------------+
```

Common reverse proxies are **Nginx**, **Caddy**, **Traefik**, cloud **load balancers** (AWS ALB, Google Cloud Load Balancing) and CDNs such as **Cloudflare**. Hosting platforms like Render, Railway, Fly.io and Heroku put one in front of your app for you, whether you notice or not.

### Why use one?

| Job | What the proxy does |
| --- | --- |
| **TLS termination** | Handles HTTPS certificates, so Express can speak plain HTTP |
| **Load balancing** | Spreads requests across several copies of your app |
| **Static files and compression** | Serves and gzips assets faster than Node |
| **Protection** | Limits request size, blocks bad traffic, hides your app's real address |
| **One address, many apps** | Routes `api.example.com` and `www.example.com` to different apps |

## The problem: Express sees the proxy, not the client

Once a proxy is in front, every request your app receives comes *from the proxy*. Without extra configuration, Express sees:

- `req.ip` is the proxy's address (like `127.0.0.1` or `10.0.0.5`), not the user's.
- `req.protocol` is `'http'`, even though the user connected with HTTPS.
- `req.secure` is `false`.

That breaks real features. Rate limiting by IP now limits *everyone* together, because everyone shares the proxy's IP. Secure cookies are never sent. Redirect URLs use `http://`.

### The X-Forwarded headers

To fix this, proxies add headers describing the original request:

| Header | Meaning | Example |
| --- | --- | --- |
| `X-Forwarded-For` | The chain of client IP addresses | `203.0.113.7, 10.0.0.2` |
| `X-Forwarded-Proto` | The protocol the client used | `https` |
| `X-Forwarded-Host` | The host the client asked for | `api.example.com` |

```http
GET /api/notes HTTP/1.1
Host: 127.0.0.1:3000
X-Forwarded-For: 203.0.113.7
X-Forwarded-Proto: https
X-Forwarded-Host: api.example.com
```

`X-Forwarded-For` is a **list**. Each proxy *appends* the address it received the request from. Read it left to right as "client first, then each hop".

But here's the catch: **anyone can send these headers**. A user can type `curl -H "X-Forwarded-For: 1.2.3.4"`. So Express ignores them by default. You have to tell Express *which* proxies to believe.

## The trust proxy setting

The `trust proxy` setting tells Express how many of the X-Forwarded values come from proxies you control.

```js
// app.js
import express from 'express';

const app = express();
app.set('trust proxy', 1); // exactly one proxy (e.g. Nginx) sits in front of us
```

With trust proxy set, Express updates these properties:

| Property | Without trust proxy | With trust proxy (correct setting) |
| --- | --- | --- |
| `req.ip` | Proxy's IP | The real client IP |
| `req.ips` | `[]` | All addresses in the chain |
| `req.protocol` | `'http'` | `'https'` (from `X-Forwarded-Proto`) |
| `req.secure` | `false` | `true` when the client used HTTPS |
| `req.hostname` | From `Host` | From `X-Forwarded-Host` if present |

### Choosing the right value

| Value | Meaning | Use when |
| --- | --- | --- |
| `false` (default) | Trust nothing; use the socket's address | The app is directly on the internet |
| `1`, `2`, ... | Trust this many proxies (**hops**) in front of the app | You know your setup, for example Nginx only (`1`), or Cloudflare then Nginx (`2`) |
| `'loopback'` | Trust proxies on `127.0.0.1` / `::1` | Nginx on the same machine |
| `'10.0.0.0/8'` or a list of IPs | Trust only proxies with these addresses (**CIDR** ranges) | Your load balancer has known private IPs |
| `true` | Trust **everything**; take the leftmost address | Almost never |

### How the hop count works

Imagine a user at `203.0.113.7` behind your Nginx at `10.0.0.2`. Nginx appends the address it saw, so the app receives:

```text
X-Forwarded-For: 203.0.113.7
socket address : 10.0.0.2        (Nginx)
```

With `trust proxy` set to `1`, Express trusts one hop (the socket, Nginx) and takes the next address from the right as the client: `203.0.113.7`. Correct.

Now an attacker sends a fake header through the same Nginx:

```text
X-Forwarded-For: 1.2.3.4, 198.51.100.9     (1.2.3.4 is fake, 198.51.100.9 is the attacker's real IP)
socket address : 10.0.0.2
```

With `1`, Express still counts from the right and picks `198.51.100.9`, the address Nginx really saw. The fake value is ignored.

With `true`, Express trusts everything and picks the leftmost address: `1.2.3.4`. The attacker chooses their own IP. That's why `true` is dangerous.

> **Warning:** With `trust proxy` set to `true`, any client can pick their own `req.ip`. That lets them dodge IP-based rate limits and pollute your logs. `express-rate-limit` even prints a warning if it detects this setting. Count your hops and use a number or an IP list.

### Check it with a debug route

When you're unsure, look at what Express actually sees. Add a temporary route:

```js
// app.js (temporary, remove after checking!)
app.get('/debug/whoami', (req, res) => {
  res.json({
    ip: req.ip,
    ips: req.ips,
    protocol: req.protocol,
    secure: req.secure,
    hostname: req.hostname,
    forwardedFor: req.get('X-Forwarded-For') ?? null,
  });
});
```

Deploy, open `https://your-domain/debug/whoami` from your phone, and compare `ip` to what a "what is my IP" website shows. If they match, your setting is right. Then remove the route.

You can also simulate a proxy locally with curl:

```bash
curl -H "X-Forwarded-For: 203.0.113.7" -H "X-Forwarded-Proto: https" http://localhost:3000/debug/whoami
```

```text
{"ip":"203.0.113.7","ips":["203.0.113.7"],"protocol":"https","secure":true,"hostname":"localhost","forwardedFor":"203.0.113.7"}
```

(This is with `trust proxy` set to `1` or `'loopback'`, since curl connects from `127.0.0.1`.)

## Features that depend on trust proxy

### Rate limiting

`express-rate-limit` uses `req.ip` as the key by default. Set trust proxy *before* the limiter, otherwise every user shares one limit:

```js
// app.js
import express from 'express';
import { rateLimit } from 'express-rate-limit';

const app = express();
app.set('trust proxy', 1);

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}));
```

### Secure cookies and sessions

A cookie marked `secure: true` is only sent over HTTPS. `express-session` checks `req.secure` before setting it. Behind a TLS-terminating proxy without trust proxy, `req.secure` is `false`, so the session cookie is **silently never set** and users can't stay logged in.

```js
// app.js
import session from 'express-session';

app.set('trust proxy', 1); // makes req.secure true for HTTPS visitors

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: true, sameSite: 'lax' },
}));
```

This exact bug ("login works locally but not in production") is one of the most common Express deployment problems.

### Redirecting HTTP to HTTPS

Usually your proxy should do this redirect. If you must do it in Express, use `req.secure`, which only works with trust proxy:

```js
// middleware/force-https.js
export const forceHttps = (req, res, next) => {
  if (req.secure || process.env.NODE_ENV !== 'production') return next();
  res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
};
```

Remember from Express 5: `req.host` includes the port, `req.hostname` doesn't.

## Configuring Nginx

Here is a typical Nginx config for an Express app on the same server. (Nginx uses its own config language; the block below is shown as plain text.)

```text
# /etc/nginx/sites-available/notes-api
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;

        # Needed for WebSockets
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        client_max_body_size 1m;
    }
}
```

- `$proxy_add_x_forwarded_for` appends the client address to any existing list.
- The `Upgrade` and `Connection` lines let [WebSockets](/courses/expressjs/websockets-and-sse) pass through.
- `client_max_body_size` rejects huge bodies before they reach Node.

Add HTTPS with a free certificate from Let's Encrypt (for example with `certbot --nginx`). Nginx runs on the same machine, so `'loopback'` or `1` both work for trust proxy.

> **Tip:** Bind Express to `127.0.0.1` when Nginx is on the same machine (`app.listen(3000, '127.0.0.1', callback)`). Then nobody can bypass Nginx by hitting port 3000 directly. In Docker, use the Compose network instead and don't publish the app's port.

## Configuring Caddy

**Caddy** is a newer proxy that gets HTTPS certificates automatically. The whole config can be three lines:

```text
# Caddyfile
api.example.com {
    reverse_proxy localhost:3000
}
```

Caddy sets `X-Forwarded-For`, `X-Forwarded-Proto` and `X-Forwarded-Host` for you.

## Load balancing several app instances

A proxy can spread traffic across several copies of your app, for example from [Clustering and Worker Threads](/courses/expressjs/clustering-and-worker-threads) or several containers:

```text
upstream notes_api {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://notes_api;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

When several instances share traffic, in-memory state (sessions in memory, in-memory rate limit counters) is no longer shared. Use Redis-backed stores, as covered in the sessions and rate limiting lessons.

## Hosting platforms

Managed platforms put their own proxy in front of your app. How many hops there are depends on the platform, and it can change if you add a CDN like Cloudflare on top.

> **Note:** Always check your platform's documentation for the recommended `trust proxy` value, then confirm it with the `/debug/whoami` route. Many platforms use exactly one proxy, so `1` is a common answer, but verify rather than guess.

## Common mistakes

> **Common mistake:** Setting `app.set('trust proxy', true)` "to make it work". It works, but it lets clients fake their IP. Use the hop count or IP list.

> **Common mistake:** Forgetting trust proxy entirely. Symptoms: every request has the same `req.ip`, rate limits hit all users at once, and `secure` session cookies never arrive.

> **Common mistake:** Reading `req.get('X-Forwarded-For')` yourself and splitting it. Let Express do it with `req.ip`, which applies your trust rules.

> **Common mistake:** Leaving the app's port open to the internet. Clients can then connect directly with any headers they like, skipping the proxy.

## Key takeaways

- A **reverse proxy** sits in front of Express to handle HTTPS, load balancing, compression and protection.
- Behind a proxy, Express sees the proxy's address unless you configure **`trust proxy`**.
- `X-Forwarded-For` is a list that any client can fake; trust only the hops you control.
- Use a **number of hops** or an **IP list**, not `true`.
- `req.ip`, `req.protocol`, `req.secure` and `req.hostname` all depend on this setting, and so do rate limiting and secure cookies.
- Verify your setting with a temporary debug route instead of guessing.

## Practice

1. Add the `/debug/whoami` route to your app and call it with curl, with and without `X-Forwarded-*` headers, for `trust proxy` values of `false`, `1` and `true`. Write down the differences.
2. Run Nginx in Docker in front of your Express container using the config above, and confirm `req.ip` is your real address.
3. Set up a session with `cookie.secure: true` behind a proxy, first without trust proxy (watch the cookie never arrive) and then with it.
4. Work out the right `trust proxy` value for this setup: Cloudflare, then a cloud load balancer, then your app.

## What's next

Your app is containerised and ready to sit behind a proxy. Next, automate testing and deployment so every change ships safely: [CI/CD Pipelines for Node APIs](/courses/expressjs/ci-cd-for-node-apis).
