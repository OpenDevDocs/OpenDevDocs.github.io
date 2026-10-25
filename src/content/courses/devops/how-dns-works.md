---
publishDate: 2026-10-25T10:55
title: 'DNS: How Domain Names Become Addresses'
slug: how-dns-works
metadescription: Learn how DNS turns domain names into IP addresses, the journey of a lookup through resolvers and name servers, the main record types, TTLs and propagation, and how to debug DNS with dig.
updateDate: 2026-10-25T10:55
author: ['bishal-biswas']
level: 1
tags: ['devops', 'networking', 'dns', 'domains']
course: devops
---

## The internet's phone book

In the [last lesson](/courses/devops/ip-addresses-ports-and-protocols) you learned that machines find each other by IP address. But nobody types `140.82.112.3` to visit GitHub. You type `github.com`.

**DNS**, the **Domain Name System**, is what turns names into addresses. It is often called the internet's phone book: you look up a name, and it gives you the number.

Names have big advantages over raw addresses:

- they are easy for people to remember;
- you can move a website to a new server, with a new IP address, and only update DNS. Every user keeps typing the same name.

DNS matters a lot in DevOps. Every time you launch a site, move a server, set up email, add a load balancer or get an HTTPS certificate, you will touch DNS. And when it goes wrong, everything that depends on a name fails at once. There is a running joke among engineers: "It's not DNS. There's no way it's DNS. It was DNS."

## How a domain name is built

Domain names are read from **right to left**, from most general to most specific:

```text
api.shop.example.com.
 |   |     |     |  |
 |   |     |     |  +-- root (the final dot, usually hidden)
 |   |     |     +----- top-level domain (TLD): com
 |   |     +----------- domain you register: example
 |   +----------------- subdomain: shop
 +--------------------- subdomain: api
```

- The **root** sits at the very top. It is shown by a trailing dot, which you almost never type.
- **Top-level domains** (TLDs) are the endings: `.com`, `.org`, `.dev`, country codes such as `.in` and `.uk`, and many more.
- The part you **register** and pay for each year, such as `example.com`.
- **Subdomains**, which you create for free once you own the domain: `www`, `api`, `shop`, `staging`.

The full name, such as `api.shop.example.com`, is called a **fully qualified domain name** (FQDN).

## The journey of a DNS lookup

What actually happens when your browser needs the address for `www.example.com`? Several kinds of server work together:

```text
Your browser / OS
      |  1. "What is www.example.com?"
      v
Recursive resolver  (your ISP, or 1.1.1.1, 8.8.8.8)
      |  2. asks a root server:      "Who handles .com?"
      |  3. asks a .com TLD server:  "Who handles example.com?"
      |  4. asks example.com's authoritative name server:
      |                              "What is www.example.com?"
      v
Answer: 104.20.23.154 (cache it for 300 seconds)
```

Step by step:

1. **Local caches first.** Your browser and operating system remember recent answers. The OS also checks the **hosts file** (`/etc/hosts` on Linux and macOS) for manual overrides.
2. **The recursive resolver.** If there is no cached answer, your computer asks a **recursive resolver**. This is usually run by your internet provider, your company or your cloud network, or it is a public one such as Cloudflare's `1.1.1.1` or Google's `8.8.8.8`. It does the legwork for you.
3. **The root servers.** The resolver asks a **root server**, which does not know the answer but knows who runs `.com`. There are 13 named root server identities, each served from hundreds of locations around the world.
4. **The TLD servers.** The `.com` servers do not know the answer either, but they know which **name servers** are in charge of `example.com`.
5. **The authoritative name server.** This server holds the real records for `example.com` and gives the final answer.
6. **Caching on the way back.** The resolver passes the answer to you and **caches** it, so the next person asking gets it instantly.

This all usually takes a few milliseconds to a few hundred, and thanks to caching most lookups never go past step 2.

## Registrars and DNS hosts

Two different services are involved in owning a domain, and they are often confused:

- A **registrar** is where you buy and renew the domain name, such as Namecheap, GoDaddy or Cloudflare Registrar.
- A **DNS host** runs the **authoritative name servers** that answer questions about your domain, such as Cloudflare DNS, AWS Route 53 or Azure DNS.

Often the same company does both, but they do not have to. You can buy a domain from one company and point its **NS records** at another company's name servers.

## DNS record types

A domain's DNS settings are a list of **records**. Each has a **name**, a **type**, a **value** and a **TTL**. The types you will use most:

| Type | Answers | Example value |
|---|---|---|
| **A** | The IPv4 address for this name | `203.0.113.10` |
| **AAAA** | The IPv6 address for this name | `2001:db8::10` |
| **CNAME** | "This name is an alias for another name" | `www` → `example.com` |
| **MX** | Which servers receive email for this domain | `10 mail.example.com` |
| **TXT** | Free text, used for verification and email security | `v=spf1 include:_spf.google.com -all` |
| **NS** | Which name servers are in charge of this domain | `ns1.dnshost.net` |
| **CAA** | Which certificate authorities may issue HTTPS certificates | `0 issue "letsencrypt.org"` |

A few notes:

- **A and AAAA** are the main event: they point a name at a server or load balancer.
- **CNAME** is handy when the target's IP may change. Cloud load balancers, CDNs and hosting platforms often give you a name like `my-app-123.eu-west-1.elb.amazonaws.com` instead of a fixed IP. You create `www CNAME my-app-123...` and let them manage the address.
- A CNAME **cannot** sit at the **apex** (the bare domain, `example.com` itself), because the apex must also hold NS and other records. Many DNS hosts offer a workaround, called **ALIAS**, **ANAME** or **CNAME flattening**, for exactly this case.
- **MX** values have a **priority**: lower numbers are tried first.
- **TXT** records prove you own a domain (Google, GitHub and certificate authorities all ask for one) and hold email anti-spoofing rules such as **SPF**, **DKIM** and **DMARC**.

## TTL and "DNS propagation"

Every record has a **TTL** (Time To Live), in seconds. It tells resolvers how long they may cache the answer. A TTL of `3600` means "you may remember this for an hour before asking again".

This explains the famous "DNS propagation" delay. When you change a record, nothing is actually pushed around the world. Resolvers that cached the **old** answer simply keep using it until their TTL runs out. With a TTL of 86400 (one day), some users may see the old address for up to a day.

> **Tip:** Planning to move a site to a new server? **Lower the TTL a day or two before** the move, for example to 300 seconds. Once the old, long TTL has expired everywhere, make the switch: everyone picks up the new address within five minutes. Raise the TTL again afterwards.

## DNS inside your infrastructure

DNS is not only for public websites. It is also how services find each other inside your systems:

- **Docker Compose** gives each service a name, so your app can connect to `db:5432` instead of an IP. See [Multi-Container Apps with Docker Compose](/courses/devops/docker-compose-basics).
- **Kubernetes** gives every service an internal name such as `orders.shop.svc.cluster.local`. See [Why Kubernetes?](/courses/devops/why-kubernetes).
- **Cloud networks** have private DNS zones, so `db.internal` can point at a private IP that only your servers can reach.

The idea is always the same: connect to **names**, not IP addresses, so the addresses behind them can change freely.

## Debugging DNS

The best tool is **dig**. On Ubuntu it comes in the `dnsutils` package (`sudo apt install dnsutils`).

```bash
dig example.com
```

```text
;; QUESTION SECTION:
;example.com.                   IN      A

;; ANSWER SECTION:
example.com.            274     IN      A       104.20.23.154
example.com.            274     IN      A       172.66.147.243

;; Query time: 18 msec
;; SERVER: 1.1.1.1#53(1.1.1.1) (UDP)
```

Read the answer lines left to right: **name**, **TTL** (274 seconds left in the cache), **class** (`IN` for internet), **type** and **value**. Notice the last line: DNS normally uses **UDP on port 53**.

Useful variations:

```bash
dig +short example.com          # just the answer
dig example.com AAAA            # ask for a specific record type
dig example.com MX +short       # mail servers
dig @8.8.8.8 example.com        # ask a specific resolver (compare answers!)
dig @ns1.dnshost.net example.com   # ask the authoritative server directly: skips all caches
dig +trace example.com          # follow the whole journey from the root servers down
```

On Windows, or when `dig` is not installed, `nslookup example.com` does the basics.

A quick troubleshooting checklist:

1. Does the **authoritative** server have the right record? (`dig @<your-name-server>`.) If not, fix the record.
2. Does a **public resolver** give the same answer? (`dig @1.1.1.1`.) If not, you are waiting for the old TTL to expire.
3. Does **your machine** give the same answer? If not, look for a stale local cache or an entry in `/etc/hosts`.

## Looking up any domain

The code panel for this lesson has a Node.js script that works like a mini `dig`. It asks for the A, AAAA, CNAME, MX, NS and TXT records of any domain, then shows which address your computer would actually connect to:

```bash
node dns-lookup.mjs
```

```text
DNS records for github.com

A     IPv4 addresses
        20.207.73.82  (cache for 34s)
AAAA  IPv6 addresses
        (none: ENODATA)
CNAME alias for www.github.com
        github.com
MX    mail servers
        github-com.mail.protection.outlook.com  (priority 0)
NS    name servers in charge
        dns1.p08.nsone.net
        dns2.p08.nsone.net
        ...
TXT   text notes (verification, email rules)
        MS=ms44452932
        ...and 19 more

Your computer would connect to 20.207.73.82 (IPv4)
```

Your results will differ: big sites return different addresses depending on where you are, and the TTL counts down while the answer sits in a cache. Notice a few real-world details:

- `www.github.com` is a **CNAME** pointing at `github.com`.
- GitHub's email is handled by Microsoft (the MX record), while its DNS is spread across **two different DNS providers** (the NS records), so one provider's outage cannot take it offline.
- There is a long list of **TXT** records, mostly proving domain ownership to various services.

Try `node dns-lookup.mjs example.com` too, and a domain that does not exist, to see `ENOTFOUND`.

## Common misunderstandings

### "DNS changes take 48 hours to propagate"

They take as long as the old record's TTL, which is often minutes. The "48 hours" advice comes from the days of very long TTLs, and from changes to NS records at the registrar, which can be cached for longer.

### "The domain registrar and the DNS host are the same thing"

They are two separate jobs that one company may happen to do both of. Knowing which one you are looking at saves a lot of confusion when records seem to be "ignored".

### "If the website is down, it is the server"

Check DNS first. `dig +short yoursite.com` takes one second and rules out a whole class of problems, such as an expired domain or a mistyped record.

## Quick recap

- **DNS** turns names like `github.com` into IP addresses.
- Names are read right to left: root, **TLD**, registered **domain**, **subdomains**.
- A lookup goes from local caches to a **recursive resolver**, then root, TLD and **authoritative** name servers.
- Key records: **A**, **AAAA**, **CNAME**, **MX**, **TXT**, **NS** and **CAA**.
- **TTL** controls caching; "propagation" is just caches expiring. Lower the TTL before a move.
- Inside your infrastructure, connect to **names**, not IPs.
- Debug with `dig`, `dig +short` and `dig @server`.

Next, you will see what travels over those connections, and how it is kept private, in [HTTP, HTTPS and TLS Certificates](/courses/devops/http-https-and-tls).

<code id="code-content" class="language-javascript">
// dns-lookup.mjs: ask DNS everything it knows about a domain, like a mini `dig`.
// Run it with: node dns-lookup.mjs              (looks up github.com)
//          or: node dns-lookup.mjs example.com
import { promises as dns } from 'node:dns';
const domain = process.argv[2] ?? 'github.com';
const short = (text, max = 70) =&gt; (text.length &gt; max ? `${text.slice(0, max - 3)}...` : text);
// Each record type answers a different question about the domain.
const lookups = [
  ['A', 'IPv4 addresses', async () =&gt; (await dns.resolve4(domain, { ttl: true }))
    .map((r) =&gt; `${r.address}  (cache for ${r.ttl}s)`)],
  ['AAAA', 'IPv6 addresses', async () =&gt; dns.resolve6(domain)],
  ['CNAME', `alias for www.${domain}`, async () =&gt; dns.resolveCname(`www.${domain}`)],
  ['MX', 'mail servers', async () =&gt; (await dns.resolveMx(domain))
    .sort((a, b) =&gt; a.priority - b.priority)
    .map((r) =&gt; (r.exchange ? `${r.exchange}  (priority ${r.priority})` : '(this domain accepts no email)'))],
  ['NS', 'name servers in charge', async () =&gt; dns.resolveNs(domain)],
  ['TXT', 'text notes (verification, email rules)', async () =&gt; (await dns.resolveTxt(domain))
    .map((parts) =&gt; short(parts.join('')))],
];
console.log(`DNS records for ${domain}\n`);
for (const [type, meaning, lookup] of lookups) {
  console.log(`${type.padEnd(6)}${meaning}`);
  try {
    const answers = await lookup();
    answers.slice(0, 5).forEach((answer) =&gt; console.log(`        ${answer}`));
    if (answers.length &gt; 5) console.log(`        ...and ${answers.length - 5} more`);
  } catch (err) {
    // ENODATA: the name exists but has no record of this type. ENOTFOUND: no such name.
    console.log(`        (none: ${err.code})`);
  }
}
// The same lookup the operating system does for every program (uses /etc/hosts too)
try {
  const { address, family } = await dns.lookup(domain);
  console.log(`\nYour computer would connect to ${address} (IPv${family})`);
} catch (err) {
  console.log(`\nYour computer cannot find ${domain} (${err.code})`);
}
</code></pre>
