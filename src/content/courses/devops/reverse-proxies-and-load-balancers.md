---
publishDate: 2026-10-25T11:05
title: Reverse Proxies and Load Balancers
slug: reverse-proxies-and-load-balancers
metadescription: Learn what reverse proxies and load balancers do, how to put nginx in front of an app with HTTPS, load-balancing algorithms, health checks, layer 4 vs layer 7, and what 502, 503 and 504 errors mean.
updateDate: 2026-10-25T11:05
author: ['bishal-biswas']
level: 2
tags: ['devops', 'networking', 'nginx', 'load-balancing', 'reverse-proxy']
course: devops
---

## One front door for your apps

So far, a user's browser has talked straight to "the server". In real deployments there is almost always something standing in between: a **reverse proxy**, and often a **load balancer**. Every request goes through it first.

Think of a hotel reception desk. Guests never wander the corridors looking for the right room. They go to reception, which checks who they are, sends them to the right place, and can open a different room if one is out of service. Your apps sit behind the reception desk.

## Forward proxy vs reverse proxy

The word "proxy" means "acting on someone else's behalf". There are two kinds, and they face in opposite directions:

| | Forward proxy | Reverse proxy |
|---|---|---|
| Acts on behalf of | **Clients** (users) | **Servers** (your apps) |
| Sits | Near the users, e.g. in an office network | In front of your servers |
| Typical job | Filter or cache what employees browse | Protect, route and spread traffic to your apps |
| Who knows it is there | The clients | Nobody: users think they are talking to your site |

In DevOps you will work almost entirely with **reverse proxies**, and that is what the rest of this lesson is about.

## What a reverse proxy does

A reverse proxy receives every request for your site and decides what to do with it. On the way it can take on many jobs your app should not have to worry about:

- **One entry point.** Only the proxy is exposed to the internet, on ports 80 and 443. Your apps listen on private addresses or `127.0.0.1` and are never reached directly.
- **TLS termination.** The proxy holds the [certificates](/courses/devops/http-https-and-tls) and handles HTTPS. Apps behind it receive plain HTTP over the private network, so they need no certificate code.
- **Routing.** Send `/api/` to the API service and everything else to the website, or `shop.example.com` and `blog.example.com` to different apps on the same server.
- **Static files.** Serve images, CSS and JavaScript straight from disk, very fast, without bothering the app.
- **Compression and caching.** Gzip responses, and cache pages that do not change often.
- **Protection.** Rate-limit abusive clients, limit upload sizes, block bad requests and add security headers.
- **Load balancing.** Spread requests across several copies of an app. More on this below.

### Popular reverse proxies

| Tool | Known for |
|---|---|
| **nginx** | Fast, extremely common, the default choice on many servers |
| **Caddy** | Automatic HTTPS with almost no configuration |
| **HAProxy** | High-performance load balancing, very detailed health checks |
| **Traefik** | Discovers Docker and Kubernetes services and configures itself |
| **Envoy** | Powers many service meshes and modern cloud proxies |
| **Cloud load balancers** | AWS ALB and NLB, Azure Application Gateway, Google Cloud Load Balancing: managed for you |

In Kubernetes, the same job is done by an **Ingress controller** or the newer **Gateway API**, which you will meet in [Why Kubernetes?](/courses/devops/why-kubernetes).

## nginx in front of a Node.js app

Here is the most common real-world setup. A Node.js app listens on `127.0.0.1:3000`, and nginx sits in front of it, handling HTTPS for `shop.example.com`. On Ubuntu, save this as `/etc/nginx/sites-available/shop`:

```nginx
# Send all plain HTTP traffic to HTTPS
server {
    listen 80;
    server_name shop.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name shop.example.com;

    # Certificates from Let's Encrypt (certbot puts them here)
    ssl_certificate     /etc/letsencrypt/live/shop.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shop.example.com/privkey.pem;

    # Serve images, CSS and JS straight from disk
    location /static/ {
        root /var/www/shop;
        expires 7d;
    }

    # Everything else goes to the Node.js app
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The `proxy_set_header` lines matter. Without them, the app would think every request came from `127.0.0.1` over plain HTTP, because that is literally who is connecting to it: nginx. These headers pass on the original details:

- `Host` is the domain the user asked for.
- `X-Real-IP` and `X-Forwarded-For` hold the user's real IP address, which you need for logs and rate limiting.
- `X-Forwarded-Proto` says whether the user came in over `https`, so the app builds correct links and secure cookies.

Turn the site on, test the configuration, and reload:

```bash
sudo ln -s /etc/nginx/sites-available/shop /etc/nginx/sites-enabled/
sudo nginx -t                    # test the config: never reload without this
sudo systemctl reload nginx      # apply it with no downtime
```

> **Tip:** `nginx -t` checks your configuration for mistakes before you apply it. A broken config plus a restart means your whole site goes down. A broken config plus `nginx -t` means a helpful error message and no harm done.

## Load balancing

One app server can only handle so much. To handle more traffic, and to survive a server failing, you run **several identical copies** of the app and put a **load balancer** in front to share the work.

```text
                        +--> app server 1  (10.0.2.11:3000)
Users --> Load balancer +--> app server 2  (10.0.2.12:3000)
                        +--> app server 3  (10.0.2.13:3000)
```

This gives you:

- **Scaling out.** Need more capacity? Add another server behind the load balancer. This is called **horizontal scaling**, as opposed to buying a bigger server (**vertical scaling**).
- **High availability.** If one server dies, the others carry on, and users do not notice.
- **Zero-downtime deployments.** Take servers out one at a time, update them and put them back. See [Deployment Strategies](/courses/devops/deployment-strategies).

A reverse proxy and a load balancer are often the **same piece of software**. nginx, HAProxy and the cloud load balancers do both jobs.

### Balancing algorithms

How does the load balancer choose which server gets each request?

| Algorithm | How it chooses | Good for |
|---|---|---|
| **Round robin** | Takes turns: 1, 2, 3, 1, 2, 3... | Servers that are identical and requests that are similar. The usual default. |
| **Least connections** | The server with the fewest active requests | Requests that vary a lot in how long they take |
| **Weighted** | Like round robin, but bigger servers get a bigger share | Mixed server sizes, or sending 5% to a new version |
| **IP hash / sticky sessions** | The same client always goes to the same server | Apps that keep user sessions in memory (see below) |

In nginx, an `upstream` block defines the group of servers:

```nginx
upstream shop_app {
    least_conn;                                       # pick the least busy server
    server 10.0.2.11:3000 max_fails=3 fail_timeout=30s;
    server 10.0.2.12:3000 max_fails=3 fail_timeout=30s;
    server 10.0.2.13:3000 max_fails=3 fail_timeout=30s;
}

server {
    # ...listen, server_name and ssl lines as before...
    location / {
        proxy_pass http://shop_app;
    }
}
```

### Health checks

A load balancer must stop sending traffic to a broken server. It finds out with **health checks**:

- **Active checks:** the load balancer regularly calls a URL such as `/health` on every server. If a server fails a few times in a row, it is taken out of rotation; when it recovers, it is put back. Cloud load balancers and HAProxy work this way.
- **Passive checks:** the load balancer watches real traffic. If requests to a server keep failing, it backs off for a while. The `max_fails` and `fail_timeout` settings above do this in open-source nginx.

Give every app a cheap `/health` endpoint that returns `200` when the app is ready to serve, and check its important dependencies, such as the database connection.

### Keep your apps stateless

Load balancing works best when **any** server can handle **any** request. That means the app should not keep important data in its own memory or on its own disk:

- store **sessions** in a shared store such as Redis or a database, or in signed cookies;
- store **uploaded files** in shared object storage (such as Amazon S3), not on the server's disk.

If an app does keep sessions in memory, you are forced to use **sticky sessions**, and every user on a server that dies is logged out. Being **stateless** is one of the most important properties of an app that runs well in the cloud.

## Layer 4 vs layer 7

You will hear load balancers described by the networking layer they work at:

| | Layer 4 (transport) | Layer 7 (application) |
|---|---|---|
| Looks at | IP addresses and ports only | The full HTTP request: host, path, headers, cookies |
| Can route by | Port | Domain, URL path, header, cookie |
| Handles TLS | Usually passes it through | Usually terminates it |
| Speed | Fastest | Slightly more work per request |
| Examples | AWS NLB, Azure Load Balancer, HAProxy in TCP mode | nginx, AWS ALB, Azure Application Gateway, Traefik |
| Use for | Databases, non-HTTP protocols, raw speed | Websites and APIs |

For web apps you will almost always want a **layer 7** load balancer.

## 502, 503 and 504: errors from the middle

When there is a proxy in the path, some errors come from the **proxy**, not from your app. Knowing which is which points you straight at the problem:

| Status | The proxy is saying | Look at |
|---|---|---|
| **502 Bad Gateway** | "I reached the app, but got no valid response" or "connection refused" | Is the app running? Did it crash? Is it on the port in `proxy_pass`? |
| **503 Service Unavailable** | "There is no healthy server to send this to" | Health checks: are all backends failing? |
| **504 Gateway Timeout** | "The app took too long to answer" | Slow database queries, stuck requests, timeouts set too low |

The proxy's own error log (for nginx, `/var/log/nginx/error.log`) usually says exactly what went wrong, for example `connect() failed (111: Connection refused) while connecting to upstream`.

## A working load balancer in under 80 lines

The code panel for this lesson builds a tiny load balancer in Node.js, using only built-in modules, so you can watch the ideas in action. It:

1. starts three identical backend servers on ports 3001 to 3003;
2. starts a reverse proxy on port 8080 that sends requests to them in **round-robin** order and adds `X-Forwarded-For`;
3. runs an **active health check** against `/health` every second;
4. crashes backend 3002, then restarts it.

```bash
node load-balancer.mjs
```

```text
All three backends up: requests take turns
  200 hello from backend :3001 (real client: 127.0.0.1)
  200 hello from backend :3002 (real client: 127.0.0.1)
  200 hello from backend :3003 (real client: 127.0.0.1)
  200 hello from backend :3001 (real client: 127.0.0.1)
  ...

Backend :3002 crashes...
  [health] :3002 is now DOWN
  200 hello from backend :3001 (real client: 127.0.0.1)
  200 hello from backend :3003 (real client: 127.0.0.1)
  200 hello from backend :3001 (real client: 127.0.0.1)
  200 hello from backend :3003 (real client: 127.0.0.1)

Backend :3002 is fixed and restarted...
  [health] :3002 is now UP
  200 hello from backend :3002 (real client: 127.0.0.1)
  ...
```

Every request succeeded, even while a backend was down: the health check noticed within a second, and the proxy simply skipped it. That is high availability in miniature. Real load balancers add much more (connection reuse, timeouts, retries, TLS), but the core idea is exactly this.

## Common misunderstandings

### "A load balancer makes my system highly available"

Only if the load balancer itself cannot fail. One nginx server in front of three app servers is still a **single point of failure**. Cloud load balancers are run redundantly for you; if you run your own, you need at least two, with a way to fail over between them.

### "The app should handle HTTPS itself"

It can, but it is usually simpler and safer to terminate TLS at the proxy: one place to install and renew certificates, and one place to keep TLS settings up to date.

### "Users' IP addresses are in the request automatically"

Behind a proxy, the app's connection comes **from the proxy**. You must pass the real address in headers such as `X-Forwarded-For`, and configure the app to trust those headers **only** when they come from your own proxy. Otherwise anyone could fake their IP by sending the header themselves.

## Quick recap

- A **reverse proxy** is the single front door for your apps: TLS termination, routing, static files, caching and protection.
- **nginx** is the most common; `proxy_pass` forwards requests, `proxy_set_header` passes on the real client details; always run `nginx -t` before reloading.
- A **load balancer** spreads requests across identical servers for scale, availability and zero-downtime deploys.
- Algorithms include **round robin**, **least connections**, **weighted** and **sticky sessions**.
- **Health checks** remove broken servers automatically. Keep apps **stateless** so any server can serve any request.
- **Layer 7** balancers understand HTTP; **layer 4** balancers only see IPs and ports.
- **502** = bad answer or refused, **503** = no healthy backend, **504** = too slow.

That completes **Networking Basics**. Next, you will start automating everything you have learned in [Continuous Integration Explained](/courses/devops/continuous-integration).

<code id="code-content" class="language-javascript">
// load-balancer.mjs: a tiny reverse proxy and round-robin load balancer with health checks.
// It starts three backend servers, puts a proxy in front of them, then breaks one.
// Run it with: node load-balancer.mjs   (uses ports 3001-3003 and 8080)
import http from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
// --- Three identical app servers ("backends")
function startBackend(port) {
  const server = http.createServer((req, res) =&gt; {
    if (req.url === '/health') return res.end('ok');
    res.end(`hello from backend :${port} (real client: ${req.headers['x-forwarded-for']})`);
  });
  return server.listen(port);
}
const backends = [3001, 3002, 3003].map((port) =&gt; ({ port, server: startBackend(port), healthy: true }));
// --- Health checks: ask every backend "are you OK?" once a second
async function checkHealth() {
  for (const b of backends) {
    const wasHealthy = b.healthy;
    try {
      const res = await fetch(`http://127.0.0.1:${b.port}/health`, { signal: AbortSignal.timeout(500) });
      b.healthy = res.ok;
    } catch {
      b.healthy = false;
    }
    if (wasHealthy !== b.healthy) console.log(`  [health] :${b.port} is now ${b.healthy ? 'UP' : 'DOWN'}`);
  }
}
const healthTimer = setInterval(checkHealth, 1000);
// --- The proxy: pick the next healthy backend in turn and forward the request
let next = 0;
const proxy = http.createServer((req, res) =&gt; {
  const healthy = backends.filter((b) =&gt; b.healthy);
  if (healthy.length === 0) {
    res.writeHead(503);
    return res.end('no healthy backends');
  }
  const target = healthy[next++ % healthy.length];
  const upstream = http.request({
    host: '127.0.0.1',
    port: target.port,
    path: req.url,
    method: req.method,
    // Tell the backend who the real client is, since it only sees the proxy
    headers: { ...req.headers, 'x-forwarded-for': req.socket.remoteAddress.replace('::ffff:', '') },
  }, (backendRes) =&gt; {
    res.writeHead(backendRes.statusCode, backendRes.headers);
    backendRes.pipe(res);
  });
  upstream.on('error', () =&gt; {
    res.writeHead(502);
    res.end('bad gateway');
  });
  req.pipe(upstream);
});
proxy.listen(8080);
// --- Try it out
async function send(count) {
  for (let i = 0; i &lt; count; i++) {
    const res = await fetch('http://127.0.0.1:8080/');
    console.log(`  ${res.status} ${await res.text()}`);
  }
}
console.log('All three backends up: requests take turns');
await send(6);
console.log('\nBackend :3002 crashes...');
backends[1].server.close();
backends[1].server.closeAllConnections();
await sleep(1200);                                  // give the health check time to notice
await send(4);
console.log('\nBackend :3002 is fixed and restarted...');
backends[1].server = startBackend(3002);
await sleep(1200);
await send(3);
// --- Clean up
clearInterval(healthTimer);
proxy.close();
backends.forEach((b) =&gt; b.server.close());
</code></pre>
