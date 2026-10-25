---
title: TLS, Authentication and Network Security
slug: tls-and-authentication
metadescription: Learn to secure MongoDB connections. Limit network access with bindIp, encrypt traffic with TLS, choose an authentication mechanism and secure replica set members.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'security', 'tls', 'authentication']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [Role-Based Access Control and Users](/courses/mongodb/rbac-and-users) and [Replica Sets and Elections](/courses/mongodb/replica-sets).

## What you will learn

By the end of this lesson you will know:

- The **layers** of MongoDB security, and which one each setting protects
- How to control who can reach your server with `bindIp`, firewalls and Atlas IP access lists
- What **TLS** is and how to turn it on for `mongod`, mongosh and Node.js
- The main **authentication mechanisms** (SCRAM, x.509, LDAP, Kerberos, OIDC) and which edition offers each
- How replica set members prove who they are to each other (**internal authentication**)

You can do the TLS and keyfile parts on your own machine with MongoDB Community and `openssl`. LDAP, Kerberos and OIDC need MongoDB Enterprise or Atlas.

## Security comes in layers

No single setting makes a database safe. Good security stacks several layers, so if one fails the others still protect you.

| Layer | Question it answers | MongoDB tools |
| --- | --- | --- |
| **Network** | Who can even reach the server? | `bindIp`, firewalls, Atlas IP access list, private endpoints |
| **Transport** | Can anyone read or change data on the wire? | **TLS** |
| **Authentication** | Who are you? | SCRAM, x.509, LDAP, Kerberos, OIDC |
| **Authorization** | What may you do? | Roles (previous lesson) |
| **Data protection** | What if someone steals the disk or a backup? | Encryption at rest, field-level encryption (next lessons) |
| **Auditing** | Who did what, and when? | Audit log (Enterprise and Atlas) |

> **Think of it like this:** A bank has a fence and a guarded gate (network), armoured vans between branches (TLS), ID checks at the door (authentication), different keys for tellers and managers (authorization), locked safes (encryption) and security cameras (auditing). Taking away any one of them makes the bank weaker.

## Layer 1: network access

### bindIp: which addresses MongoDB listens on

By default, `mongod` only listens on `localhost` (`127.0.0.1`). Programs on other machines can't connect at all. That's a safe default.

When an app server needs access, add the server's **own private address** that the app will connect to, in `mongod.conf`:

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1,10.0.0.5
```

> **Warning:** Avoid `bindIp: 0.0.0.0` (or `bindIpAll: true`), which listens on every network interface, including public ones. If you must, combine it with a firewall, access control **and** TLS. Thousands of databases have been leaked by exposing port 27017 to the internet with no password.

### Firewalls

Even with the right `bindIp`, use the operating system or cloud firewall to allow port 27017 **only** from your app servers. For example, on Ubuntu with `ufw`:

```bash
sudo ufw allow from 10.0.0.20 to any port 27017 proto tcp
sudo ufw deny 27017
```

### On Atlas

Atlas blocks all connections by default. You allow them through:

- the **IP Access List** (specific addresses or ranges), or
- **private endpoints / VPC peering**, so traffic never crosses the public internet.

Avoid adding `0.0.0.0/0` ("allow from anywhere") except for a quick, short-lived test.

## Layer 2: TLS (encryption in transit)

**TLS** (Transport Layer Security, the "S" in HTTPS) encrypts data travelling between your app and MongoDB. Without it, anyone on the network path can read queries, results and even passwords.

TLS relies on **certificates**:

- The server has a **certificate** and a **private key**. The certificate says "I am db.shop.internal".
- A **Certificate Authority (CA)** signs that certificate. Clients trust the CA, so they trust the server.

> **Think of it like this:** A certificate is a passport. The CA is the government that issued it. You trust the passport because you trust the government that stamped it.

### Making test certificates

In production you'd get certificates from your company's CA or a service like Let's Encrypt. For learning, create your own CA and server certificate with `openssl`:

```bash
# 1. A test Certificate Authority
openssl req -x509 -newkey rsa:4096 -nodes -days 365 \
  -keyout ca.key -out ca.pem -subj "/CN=Shop Test CA"

# 2. A key and signing request for the server
openssl req -newkey rsa:4096 -nodes \
  -keyout server.key -out server.csr -subj "/CN=localhost"

# 3. Sign the server certificate with the CA (valid for localhost)
printf "subjectAltName=DNS:localhost,IP:127.0.0.1" > san.ext
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key -CAcreateserial \
  -days 365 -out server.crt -extfile san.ext

# 4. MongoDB wants the certificate and key in one file
cat server.crt server.key > server.pem
```

### Turning on TLS in mongod

Add a `tls` section to `mongod.conf`:

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1
  tls:
    mode: requireTLS
    certificateKeyFile: /etc/mongodb/tls/server.pem
    CAFile: /etc/mongodb/tls/ca.pem
```

Restart `mongod`. The `mode` setting has four values:

| `mode` | Server accepts | Use when |
| --- | --- | --- |
| `disabled` | Plain connections only | Never in production |
| `allowTLS` | Both; doesn't use TLS to other members | First step of a rolling upgrade |
| `preferTLS` | Both; uses TLS to other members | Middle step of a rolling upgrade |
| `requireTLS` | TLS only | The goal |

> **Tip:** To add TLS to a running replica set with no downtime, move every member through `allowTLS`, then `preferTLS`, then `requireTLS`, one member at a time, updating clients in between.

### Connecting with TLS

From mongosh, add `tls=true` and tell it which CA to trust:

```bash
mongosh "mongodb://localhost:27017/?tls=true&tlsCAFile=ca.pem"
```

Without TLS, the connection is now refused. With a wrong CA you'll see an error like `certificate signature failure` or `unable to verify the first certificate`.

From Node.js:

```javascript
const { MongoClient } = require("mongodb");

const client = new MongoClient("mongodb://localhost:27017", {
  tls: true,
  tlsCAFile: "./ca.pem"
});
await client.connect();
```

> **Warning:** `tlsAllowInvalidCertificates=true` and `tlsAllowInvalidHostnames=true` turn off the safety checks. They make TLS "work" with bad certificates, but also let an attacker pretend to be your server. Only use them in throwaway tests.

### TLS versions

MongoDB uses the operating system's TLS library (OpenSSL on Linux, Secure Channel on Windows, Secure Transport on macOS). Old, weak versions like TLS 1.0 are disabled by default when newer ones are available. You can disable more with `net.tls.disabledProtocols`. MongoDB 8.3 also added TLS 1.3 support on Windows.

## Layer 3: authentication mechanisms

An **authentication mechanism** is the method used to prove identity.

| Mechanism | How you prove identity | Available in |
| --- | --- | --- |
| **SCRAM-SHA-256** | Username and password (the default) | Community, Enterprise, Atlas |
| **x.509** | A client TLS certificate | Community, Enterprise, Atlas |
| **LDAP** | Your company directory login (like Active Directory) | Enterprise, Atlas |
| **Kerberos** | Company single sign-on tickets | Enterprise |
| **OIDC** (`MONGODB-OIDC`) | An identity provider token (Okta, Microsoft Entra ID, ...) | Enterprise, Atlas |
| **AWS IAM** (`MONGODB-AWS`) | Your AWS role | Atlas |

### SCRAM: passwords done safely

**SCRAM** is what you used in the previous lesson. The password itself is never sent over the network. Client and server exchange a "challenge and response" proving both sides know it. MongoDB stores only a salted hash.

You rarely need to name it, but you can:

```bash
mongosh "mongodb://shopApp@localhost:27017/shop?authSource=shop&authMechanism=SCRAM-SHA-256&tls=true&tlsCAFile=ca.pem"
```

### x.509: certificates instead of passwords

With **x.509**, a client presents its own certificate, and the certificate's subject (its "name") is the username. No password to leak or rotate.

Users for x.509 live in the special `$external` database, named exactly like the certificate subject:

```javascript
db.getSiblingDB("$external").runCommand({
  createUser: "CN=reportApp,OU=apps,O=Shop",
  roles: [ { role: "read", db: "shop" } ]
})
```

The client connects with its certificate file:

```bash
mongosh "mongodb://localhost:27017/?tls=true&tlsCAFile=ca.pem&tlsCertificateKeyFile=reportApp.pem&authMechanism=MONGODB-X509&authSource=\$external"
```

### OIDC and LDAP: company logins

In larger companies, people already have a login. **OIDC** (workforce and workload identity federation) and **LDAP** let MongoDB accept those logins, so people don't need yet another password, and leavers lose access automatically when their company account is closed. These need Enterprise or Atlas and are usually set up by an admin team.

## Internal authentication: members trusting each other

In a replica set or sharded cluster, members talk to each other constantly. They must prove they belong to the cluster too, or an attacker could join a fake member and receive a copy of your data.

The simplest way is a shared **keyfile**, a secret every member has:

```bash
openssl rand -base64 756 > /etc/mongodb/keyfile
chmod 400 /etc/mongodb/keyfile
sudo chown mongodb:mongodb /etc/mongodb/keyfile
```

Copy the same file to every member, then add it to each `mongod.conf`:

```yaml
security:
  keyFile: /etc/mongodb/keyfile
  authorization: enabled
replication:
  replSetName: rs0
```

Setting `keyFile` also turns on access control for clients.

For larger production systems, use **x.509 certificates for members** instead (`security.clusterAuthMode: x509`), so each member has its own certificate rather than one shared secret.

## Keep secrets out of your code

The best TLS and passwords don't help if your connection string is in a public Git repository.

```javascript
// Read the connection string from the environment, not from the source code
const client = new MongoClient(process.env.MONGODB_URI);
```

- Keep `.env` files out of Git (add them to `.gitignore`).
- In production, use a secrets manager from your cloud provider.
- Rotate passwords when people leave or a leak is suspected.

## Security on Atlas

Atlas does a lot of this for you:

- **TLS is always on** and can't be disabled. `mongodb+srv://` connection strings use it automatically.
- **Access control is always on.** You create database users in **Database Access**.
- **Network access is closed by default.** You open it with the IP Access List or private endpoints.
- **Encryption at rest** is on for all clusters.

Your job on Atlas is mostly: strong users with least privilege, a tight IP access list, and safe handling of the connection string.

## A quick security checklist

| Check | Done? |
| --- | --- |
| `bindIp` limited to needed addresses, firewall in place | |
| `security.authorization: enabled` (or Atlas) | |
| `net.tls.mode: requireTLS` with real certificates | |
| Replica set members use a keyfile or x.509 | |
| Apps use their own least-privilege users | |
| Connection strings stored as secrets, not in code | |

## Common mistakes

- **Exposing port 27017 to the internet.** Keep `bindIp` narrow and firewall the port, even with passwords on.
- **Turning on TLS but allowing invalid certificates.** `tlsAllowInvalidCertificates` defeats the point. Fix the certificate chain instead.
- **Certificate name doesn't match the host.** If clients connect to `db.shop.internal`, the certificate's subject alternative name must include it.
- **Different keyfiles on different members.** Members can't authenticate to each other and the replica set fails. Copy the exact same file, with strict permissions.
- **Committing `.env` files.** Treat connection strings like passwords.

## Practice

1. Write a `mongod.conf` `net` section that listens on `127.0.0.1` and `10.0.0.7`, and requires TLS using `/etc/mongodb/tls/server.pem` and `/etc/mongodb/tls/ca.pem`.
2. Write the mongosh connection string to connect as `shopApp` (auth database `shop`) over TLS, trusting `ca.pem`.
3. Write the commands to create a keyfile for a replica set and the matching `security` section.

<details>
<summary>Show a possible answer</summary>

```yaml
# 1. Network and TLS
net:
  port: 27017
  bindIp: 127.0.0.1,10.0.0.7
  tls:
    mode: requireTLS
    certificateKeyFile: /etc/mongodb/tls/server.pem
    CAFile: /etc/mongodb/tls/ca.pem
```

```bash
# 2. Connect over TLS as shopApp
mongosh "mongodb://shopApp@localhost:27017/shop?authSource=shop&tls=true&tlsCAFile=ca.pem"

# 3. Keyfile (same file on every member)
openssl rand -base64 756 > /etc/mongodb/keyfile
chmod 400 /etc/mongodb/keyfile
```

```yaml
# 3. In each member's mongod.conf
security:
  keyFile: /etc/mongodb/keyfile
  authorization: enabled
```

</details>

## Key takeaways

- Security is **layered**: network, transport (TLS), authentication, authorization, data protection and auditing.
- Keep `bindIp` narrow, firewall port 27017, and use the Atlas IP Access List or private endpoints.
- Turn on TLS with `net.tls.mode: requireTLS`, a server certificate and a CA file. Never disable certificate checks in production.
- **SCRAM-SHA-256** (passwords) and **x.509** (certificates) work everywhere. LDAP, Kerberos and OIDC need Enterprise or Atlas.
- Replica set members authenticate each other with a shared **keyfile** or x.509 certificates.

**Next lesson:** [Client-Side Field Level Encryption](/courses/mongodb/client-side-field-level-encryption)
