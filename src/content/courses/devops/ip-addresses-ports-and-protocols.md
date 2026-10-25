---
publishDate: 2026-10-25T10:50
title: IP Addresses, Ports and Protocols
slug: ip-addresses-ports-and-protocols
metadescription: Learn the networking basics every DevOps engineer needs, IPv4 and IPv6 addresses, public and private ranges, CIDR subnets, ports, TCP vs UDP, and how to debug connection problems.
updateDate: 2026-10-25T10:50
author: ['bishal-biswas']
level: 1
tags: ['devops', 'networking', 'ip', 'tcp', 'subnets']
course: devops
---

## Why DevOps engineers need networking

Every deployment is a networking problem in disguise. Your app has to listen on the right **port**, the server needs the right **IP address**, the firewall has to let traffic in, and the database must be reachable from the app but **not** from the internet.

When something breaks, the error is often a networking one: `connection refused`, `connection timed out`, `no route to host`. Knowing what those mean saves hours.

You do not need to be a network engineer. This section gives you the practical basics, starting with three ideas:

- an **IP address** says **which machine**;
- a **port** says **which program** on that machine;
- a **protocol** says **how** they talk.

Think of a large apartment building. The IP address is the street address of the building, the port is the flat number, and the protocol is the language you speak when someone opens the door.

## IP addresses

Every device on a network has an **IP address** (IP stands for **Internet Protocol**). Data sent across a network is chopped into small **packets**, and each packet carries the address it came from and the address it is going to, just like an envelope.

### IPv4

The classic format is **IPv4**: four numbers from 0 to 255, separated by dots.

```text
203.0.113.10
```

Under the hood it is one 32-bit number, which allows about 4.3 billion addresses. That sounded like plenty in the 1980s. It is not enough for today's billions of phones, laptops, servers and smart fridges, and the free supply of new IPv4 addresses has run out. Public IPv4 addresses are now bought, sold and rented, which is why cloud providers charge for them.

### IPv6

The fix is **IPv6**, which uses 128 bits: enough for an almost unimaginable number of addresses. It is written as eight groups of hexadecimal digits:

```text
2001:0db8:0000:0000:0000:0000:0000:0001
2001:db8::1          <- the same address, shortened
```

Leading zeros in a group can be dropped, and one run of all-zero groups can be replaced by `::`.

Most of the internet now runs both side by side. You will mostly type IPv4 addresses day to day, but expect to see IPv6 in DNS records and cloud consoles.

### Public and private addresses

Not every IP address is reachable from the internet. Three ranges are reserved as **private**, for use inside homes, offices and cloud networks:

| Private range | Written as | Typical use |
|---|---|---|
| 10.0.0.0 to 10.255.255.255 | `10.0.0.0/8` | Cloud networks, large companies |
| 172.16.0.0 to 172.31.255.255 | `172.16.0.0/12` | Docker's default networks, some clouds |
| 192.168.0.0 to 192.168.255.255 | `192.168.0.0/16` | Home and small office routers |

Your laptop at home probably has an address like `192.168.1.23`. Thousands of other homes use exactly the same address, and that is fine, because private addresses never travel on the public internet.

So how does your laptop reach a website? Your home router has one **public** address and translates between it and your private ones. This trick is called **NAT** (Network Address Translation). Cloud servers work the same way: a server often has a private IP inside the cloud network, plus a public IP that the provider maps to it.

> **Tip:** This is a key security idea. Put databases and internal services on **private** addresses only. They can talk to your app, but nobody on the internet can even try to reach them.

### Special addresses

| Address | Meaning |
|---|---|
| `127.0.0.1` (and `::1` in IPv6) | **Loopback**, also called `localhost`: "this same machine". Traffic never leaves the computer. |
| `0.0.0.0` | When a server **listens** on it: "accept connections on every network interface". |
| `203.0.113.0/24`, `198.51.100.0/24`, `192.0.2.0/24` | Reserved for **documentation**. Safe to use in examples, like this course does. |

The difference between `127.0.0.1` and `0.0.0.0` catches out a lot of people. An app that listens on `127.0.0.1:3000` can only be reached from the same machine. The same app listening on `0.0.0.0:3000` can be reached from other machines too (if the firewall allows it). You will meet this again when an app works inside a [Docker container](/courses/devops/docker-essentials) but cannot be reached from outside it.

## Subnets and CIDR notation

Networks are divided into smaller blocks called **subnets**. You describe a block with **CIDR notation**: an address, a slash, and a number.

```text
10.0.1.0/24
```

The number after the slash says how many bits, counting from the left, are **fixed** for the network. The rest are free for individual machines. An IPv4 address has 32 bits, so:

- `/24` fixes the first 24 bits (the first three numbers), leaving 8 bits: **256 addresses**, `10.0.1.0` to `10.0.1.255`.
- `/16` fixes the first two numbers, leaving 16 bits: **65,536 addresses**, `10.0.0.0` to `10.0.255.255`.

**A smaller number after the slash means a bigger network.**

| CIDR | Addresses | Example range | Typical use |
|---|---|---|---|
| `/32` | 1 | `203.0.113.10` only | One exact machine, e.g. a firewall rule |
| `/28` | 16 | `10.0.1.0` - `10.0.1.15` | A tiny subnet |
| `/24` | 256 | `10.0.1.0` - `10.0.1.255` | A typical subnet |
| `/16` | 65,536 | `10.0.0.0` - `10.0.255.255` | A whole cloud network (VPC) |
| `/0` | All of them | Everything | "Anywhere on the internet" in firewall rules |

In each subnet, the first address names the network itself and the last is the **broadcast** address, so neither is given to a machine. Cloud providers reserve a few more (AWS keeps five per subnet).

You will use CIDR all the time in DevOps:

- **Cloud networks:** a VPC of `10.0.0.0/16`, split into a public subnet `10.0.1.0/24` for load balancers and a private subnet `10.0.2.0/24` for app servers and databases. More in [Cloud Computing Basics](/courses/devops/cloud-computing-basics).
- **Firewall rules:** "allow SSH only from `198.51.100.7/32`" (your office) or "allow HTTPS from `0.0.0.0/0`" (everyone).

The code panel for this lesson has a small CIDR calculator so you can see exactly what any block contains.

## Ports

One server runs many programs at once: a web server, SSH, maybe a database. When a packet arrives, how does the machine know which program it is for? By the **port**: a number from 0 to 65535.

A program **listens** on a port. A connection is always to an **IP address plus a port**, written like this:

```text
203.0.113.10:443
```

Some ports are standard, so everyone knows where to knock:

| Port | Used by |
|---|---|
| 22 | SSH |
| 25 | SMTP (sending email between servers) |
| 53 | DNS |
| 80 | HTTP |
| 443 | HTTPS |
| 3306 | MySQL |
| 5432 | PostgreSQL |
| 6379 | Redis |
| 27017 | MongoDB |
| 3000, 5173, 8080 | Common choices for apps in development |

When you type `https://example.com` into a browser, it quietly uses port 443. `http://` uses port 80. You only see a port in the URL when it is not the default, such as `http://localhost:3000`.

A few things worth knowing:

- Only **one** program can listen on a given IP and port at a time. Start a second one and you get `address already in use` (Node calls it `EADDRINUSE`).
- On Linux, ports **below 1024** need root privileges to listen on. That is one reason apps usually run on a high port such as 3000 behind a [reverse proxy](/courses/devops/reverse-proxies-and-load-balancers) that listens on 80 and 443.
- The **client** side of a connection uses a random, temporary high port, called an **ephemeral port**. You rarely have to think about it.

## Protocols: TCP and UDP

A **protocol** is an agreed set of rules for talking. Networking uses layers of protocols, each building on the one below:

| Layer | Job | Examples |
|---|---|---|
| Application | What the programs are saying | HTTP, DNS, SSH, SMTP |
| Transport | Getting data between two **programs** | TCP, UDP |
| Internet | Getting packets between two **machines** | IP |
| Link | Getting bits across one physical link | Ethernet, Wi-Fi |

At the transport layer there are two main choices:

| | TCP | UDP |
|---|---|---|
| Connection | Sets one up first, with a "handshake" | None: just sends |
| Delivery | Guaranteed, in order; lost packets are re-sent | Best effort: packets may be lost or arrive out of order |
| Speed | A little slower | Faster, less overhead |
| Like | A phone call | Shouting across a room, or sending postcards |
| Used by | HTTP/1.1 and HTTP/2, SSH, databases, email | DNS lookups, video calls, online games, HTTP/3 |

Most of what you deploy uses **TCP**. Before any data is sent, the two sides do a quick **three-way handshake**:

```text
Client  --- SYN ------->  Server     "Can we talk?"
Client  <-- SYN-ACK ----  Server     "Yes, can you hear me?"
Client  --- ACK ------->  Server     "Yes. Here comes the data."
```

That handshake is what makes the most useful debugging trick in this lesson possible.

## Debugging connections: refused vs timed out

When a connection fails, **how** it fails tells you a lot:

| Error | What happened | Usual causes |
|---|---|---|
| `Connection refused` | The machine was reached and replied: "nothing is listening on that port" | The app is not running, crashed, or listens on a different port or on `127.0.0.1` only |
| `Connection timed out` | No reply at all; the packets vanished | A firewall or security group is silently dropping them, the IP is wrong, or the machine is off |
| `No route to host` | The network cannot find a path to that address | Wrong IP or subnet, network misconfiguration |
| `Name or service not known` | The name could not be turned into an IP address | A DNS problem: see [DNS: How Domain Names Become Addresses](/courses/devops/how-dns-works) |

So: **refused** means "check the app"; **timed out** means "check the firewall".

## Commands you will use

```bash
ip addr                        # this machine's network interfaces and IP addresses (short: ip a)
hostname -I                    # just the IP addresses
curl -s https://ifconfig.me    # your PUBLIC IP, as the internet sees it

ping -c 3 203.0.113.10         # is the machine reachable at all? (some block ping)
ss -tlnp                       # which programs are listening on which TCP ports
nc -zv 203.0.113.10 5432       # can I open a TCP connection to this port?
traceroute example.com         # the path packets take, hop by hop
```

`ss -tlnp` (show **T**CP sockets that are **l**istening, with **n**umeric ports and the **p**rocess) is the first thing to run when you suspect an app is not listening where you think:

```text
State   Recv-Q  Send-Q  Local Address:Port  Peer Address:Port  Process
LISTEN  0       511           0.0.0.0:80         0.0.0.0:*      users:(("nginx",pid=655,fd=6))
LISTEN  0       4096          0.0.0.0:22         0.0.0.0:*      users:(("sshd",pid=541,fd=3))
LISTEN  0       511         127.0.0.1:3000       0.0.0.0:*      users:(("node",pid=812,fd=21))
```

Here nginx and SSH accept connections from anywhere, while the Node app on port 3000 only accepts connections from the same machine, which is exactly right if nginx forwards traffic to it.

## The CIDR calculator

The code panel's script works out everything about a CIDR block: its mask, first and last usable address, broadcast address and size. It also checks whether an address is inside a block, and whether it is private or public. Run it with no arguments for a tour:

```bash
node subnet.mjs
```

```text
10.0.1.0/24
  mask       255.255.255.0
  network    10.0.1.0
  hosts      10.0.1.1 - 10.0.1.254
  broadcast  10.0.1.255
  addresses  256 (254 usable)
...
Which network is it in?
  10.0.1.57    in 10.0.1.0/24? true
  10.0.2.5     in 10.0.1.0/24? false

Private or public?
  192.168.1.20 private (only reachable inside a network)
  8.8.8.8      public
```

Or check your own block and address:

```bash
node subnet.mjs 192.168.1.0/26 192.168.1.70
```

```text
192.168.1.0/26
  mask       255.255.255.192
  network    192.168.1.0
  hosts      192.168.1.1 - 192.168.1.62
  broadcast  192.168.1.63
  addresses  64 (62 usable)
  192.168.1.70 is outside this network
```

## Common misunderstandings

### "It works on localhost, so the server is fine"

`localhost` only proves the app works on the same machine. Other machines also need the app to listen on `0.0.0.0` (or the server's IP), the firewall to allow the port, and the right public address.

### "A private IP is secure, so I do not need a firewall"

Private addresses keep the internet out, but anything inside the same network can still reach them. If one server is broken into, an open database next door is an easy next step. Use firewall rules inside the network too.

### "Ping failed, so the server is down"

Many servers and clouds block ping (it uses a protocol called **ICMP**) on purpose. Try connecting to the actual port with `nc -zv` or `curl` before deciding.

## Quick recap

- An **IP address** identifies a machine; **IPv4** looks like `203.0.113.10`, **IPv6** like `2001:db8::1`.
- **Private** ranges (`10/8`, `172.16/12`, `192.168/16`) are not reachable from the internet; **NAT** shares a public address.
- `127.0.0.1` is this machine only; listening on `0.0.0.0` accepts connections on every interface.
- **CIDR** such as `10.0.1.0/24` describes a block of addresses: a smaller number means a bigger block.
- A **port** identifies a program; HTTPS is 443, HTTP 80, SSH 22.
- **TCP** is reliable and connection-based; **UDP** is fast and fire-and-forget.
- **Refused** means nothing is listening; **timed out** usually means a firewall.

Next, you will see how names like `github.com` turn into IP addresses in [DNS: How Domain Names Become Addresses](/courses/devops/how-dns-works).

<code id="code-content" class="language-javascript">
// subnet.mjs: a tiny CIDR calculator. See what "10.0.1.0/24" really means.
// Run it with: node subnet.mjs                          (uses the examples below)
//          or: node subnet.mjs 192.168.1.0/26 192.168.1.70
// An IPv4 address is really one 32-bit number, written as four 8-bit parts.
const toInt = (ip) =&gt; ip.split('.').reduce((n, part) =&gt; n * 256 + Number(part), 0);
const toIp = (n) =&gt; [24, 16, 8, 0].map((shift) =&gt; (n &gt;&gt;&gt; shift) &amp; 255).join('.');
function parse(cidr) {
  const [ip, bits] = cidr.split('/');
  const prefix = Number(bits);
  // The mask has `prefix` ones on the left: /24 = 255.255.255.0
  const mask = prefix === 0 ? 0 : (0xffffffff &lt;&lt; (32 - prefix)) &gt;&gt;&gt; 0;
  const network = (toInt(ip) &amp; mask) &gt;&gt;&gt; 0;
  const broadcast = (network | ~mask) &gt;&gt;&gt; 0;
  return { prefix, mask, network, broadcast, size: 2 ** (32 - prefix) };
}
function describe(cidr) {
  const { prefix, mask, network, broadcast, size } = parse(cidr);
  // The first address names the network and the last is broadcast, so neither is
  // given to a machine. (Clouds such as AWS also reserve a few more.)
  const usable = prefix &gt;= 31 ? size : size - 2;
  console.log(`${cidr}`);
  console.log(`  mask       ${toIp(mask)}`);
  console.log(`  network    ${toIp(network)}`);
  console.log(`  hosts      ${toIp(network + 1)} - ${toIp(broadcast - 1)}`);
  console.log(`  broadcast  ${toIp(broadcast)}`);
  console.log(`  addresses  ${size.toLocaleString('en-US')} (${usable.toLocaleString('en-US')} usable)`);
}
const contains = (cidr, ip) =&gt; {
  const { mask, network } = parse(cidr);
  return ((toInt(ip) &amp; mask) &gt;&gt;&gt; 0) === network;
};
const PRIVATE = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
const isPrivate = (ip) =&gt; PRIVATE.some((range) =&gt; contains(range, ip));
const [cidrArg, ipArg] = process.argv.slice(2);
if (cidrArg) {
  describe(cidrArg);
  if (ipArg) console.log(`  ${ipArg} is ${contains(cidrArg, ipArg) ? 'inside' : 'outside'} this network`);
} else {
  ['10.0.0.0/16', '10.0.1.0/24', '192.168.1.64/26'].forEach(describe);
  console.log('\nWhich network is it in?');
  for (const ip of ['10.0.1.57', '10.0.2.5']) {
    console.log(`  ${ip.padEnd(12)} in 10.0.1.0/24? ${contains('10.0.1.0/24', ip)}`);
  }
  console.log('\nPrivate or public?');
  for (const ip of ['192.168.1.20', '172.20.3.4', '10.8.0.1', '8.8.8.8', '203.0.113.10']) {
    console.log(`  ${ip.padEnd(12)} ${isPrivate(ip) ? 'private (only reachable inside a network)' : 'public'}`);
  }
}
</code></pre>
