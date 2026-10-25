---
title: Role-Based Access Control and Users
slug: rbac-and-users
metadescription: Learn to turn on MongoDB authentication, create users, use built-in roles, write custom roles and follow least privilege with role-based access control.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['mongodb', 'security', 'rbac', 'users']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [mongosh: The MongoDB Shell](/courses/mongodb/mongosh-basics) and [Installing MongoDB Community 8](/courses/mongodb/installing-mongodb).

## What you will learn

By the end of this lesson you will know:

- The difference between **authentication** and **authorization**
- How to turn on access control on a local MongoDB server, safely
- How to create users and give them **built-in roles**
- How to write a **custom role** with exactly the permissions you need
- How to grant, revoke, inspect and remove users, and how this works on Atlas

Everything here works on a local MongoDB Community server. On Atlas, you manage users in the web UI instead (we'll cover that at the end).

## Two questions every database asks

When someone connects, a secure database asks two questions:

1. **Authentication:** "Who are you?" You prove it with a username and password (or a certificate).
2. **Authorization:** "What are you allowed to do?" Read? Write? Drop collections? Create users?

**Role-Based Access Control (RBAC)** is how MongoDB answers the second question. You don't give permissions to users one by one. You put permissions into **roles**, and give roles to users.

> **Think of it like this:** In an office building, your ID card proves who you are (authentication). The card's access level decides which doors open for you (authorization). The office doesn't program each door for each person. It says "all Accountants can open the finance room" and gives you the Accountant level. That's a role.

## Out of the box: no access control

A freshly installed local `mongod` has access control **off**. Anyone who can reach the port can do anything. That's fine on your laptop when MongoDB only listens on `localhost`, but dangerous anywhere else.

Many real data leaks happened because a database was exposed to the internet with access control off. So let's turn it on.

## Step 1: create the first admin user

With access control still off, connect with mongosh and create an administrator in the `admin` database:

```javascript
use admin
db.createUser({
  user: "asha",
  pwd: passwordPrompt(),   // mongosh asks for the password, so it's not saved in your history
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" }
  ]
})
// → { ok: 1 }
```

`userAdminAnyDatabase` lets Asha create and manage users everywhere. `readWriteAnyDatabase` lets her read and write data in all databases.

> **Tip:** `passwordPrompt()` is a mongosh helper that asks for the password without showing it. Never type real passwords directly into commands.

## Step 2: turn on authorization

Edit `mongod.conf` and add:

```yaml
security:
  authorization: enabled
```

Then restart MongoDB. On Windows, restart the MongoDB service. On Linux:

```bash
sudo systemctl restart mongod
```

> **Note:** If you start access control **before** creating any user, MongoDB has a **localhost exception**: a connection from the same machine can create the first user in the `admin` database. As soon as one user exists, the exception closes.

## Step 3: log in

Now connections without credentials can't do much:

```javascript
// Connected without logging in
db.getSiblingDB("shop").products.find()
// → MongoServerError: Command find requires authentication
```

Connect with a username. The `authSource` is the database where the user was created:

```bash
mongosh "mongodb://asha@localhost:27017/?authSource=admin"
```

mongosh asks for the password. You can also log in from inside mongosh:

```javascript
use admin
db.auth("asha", passwordPrompt())
// → { ok: 1 }
```

## Users live in a database

Every user is created in one database, called its **authentication database**. It's simply where the user's record is stored. It does **not** limit which databases the user can access; the roles decide that.

A common pattern:

- Admin humans in `admin`
- Each app's user in the app's own database (like `shop`)

## Built-in roles

MongoDB ships with roles for common jobs. The ones you'll use most:

| Role | Scope | Can do |
| --- | --- | --- |
| `read` | One database | Read all non-system collections |
| `readWrite` | One database | Read and write, create collections and indexes |
| `dbAdmin` | One database | Indexes, stats, profiler. **Not** read or write data |
| `userAdmin` | One database | Create and manage users and roles in that database |
| `dbOwner` | One database | `readWrite` + `dbAdmin` + `userAdmin` combined |
| `readAnyDatabase` | All databases | `read` everywhere |
| `readWriteAnyDatabase` | All databases | `readWrite` everywhere |
| `userAdminAnyDatabase` | All databases | Manage users everywhere |
| `clusterMonitor` | Cluster | Read-only monitoring (`serverStatus`, `currentOp`, ...) |
| `clusterManager` | Cluster | Manage replica sets and sharding |
| `backup` / `restore` | Cluster | For `mongodump` and `mongorestore` |
| `root` | Everything | Full superuser. Use rarely |

## Creating an app user

Our shop app needs to read and write the `shop` database, and nothing else:

```javascript
use shop
db.createUser({
  user: "shopApp",
  pwd: passwordPrompt(),
  roles: [ { role: "readWrite", db: "shop" } ]
})
```

The app connects with:

```text
mongodb://shopApp:<password>@localhost:27017/shop?authSource=shop
```

And a read-only user for the analytics team:

```javascript
use shop
db.createUser({
  user: "priyaAnalytics",
  pwd: passwordPrompt(),
  roles: [ { role: "read", db: "shop" } ]
})
```

If Priya tries to write, MongoDB refuses:

```javascript
db.products.insertOne({ name: "Stapler", price: 120 })
// → MongoServerError: not authorized on shop to execute command { insert: "products", ... }
```

## The principle of least privilege

**Least privilege** means every user gets **only** the permissions needed for their job. Nothing extra "just in case".

- The web app needs `readWrite` on `shop`, not `root`.
- A dashboard needs `read`, not `readWrite`.
- A monitoring agent needs `clusterMonitor`, not admin rights.

If a password leaks, least privilege limits the damage.

## Custom roles

Sometimes built-in roles are too broad. Say the support team should **read orders and update their status**, but never delete orders or touch products.

A role is a list of **privileges**. Each privilege is a **resource** (which database and collection) plus **actions** (what you may do):

```javascript
use shop
db.createRole({
  role: "orderSupport",
  privileges: [
    {
      resource: { db: "shop", collection: "orders" },
      actions: [ "find", "update" ]
    },
    {
      resource: { db: "shop", collection: "customers" },
      actions: [ "find" ]
    }
  ],
  roles: []
})
// → { ok: 1 }
```

The `roles: []` array can list other roles to **inherit** from. For example, `roles: [ { role: "read", db: "shop" } ]` would add read access to everything in `shop`.

Now create a user with it:

```javascript
db.createUser({
  user: "kenSupport",
  pwd: passwordPrompt(),
  roles: [ { role: "orderSupport", db: "shop" } ]
})
```

Ken can find and update orders, and look up customers. He can't delete orders, read products, or create indexes.

Some common actions:

| Action | Allows |
| --- | --- |
| `find` | Reading documents |
| `insert` | Inserting documents |
| `update` | Updating documents |
| `remove` | Deleting documents |
| `createIndex` | Creating indexes |
| `dropCollection` | Dropping a collection |
| `changeStream` | Opening a change stream |

> **Tip:** Need to hide some **fields**, like customer phone numbers? Roles work at the collection level. Create a **view** that leaves those fields out, and give the role `find` on the view instead of the real collection.

## Managing users and roles

Give a user an extra role:

```javascript
use shop
db.grantRolesToUser("kenSupport", [ { role: "read", db: "shop" } ])
```

Take a role away:

```javascript
db.revokeRolesFromUser("kenSupport", [ { role: "read", db: "shop" } ])
```

Change a password:

```javascript
db.changeUserPassword("shopApp", passwordPrompt())
```

List users in the current database:

```javascript
db.getUsers()
// → { users: [ { _id: 'shop.shopApp', user: 'shopApp', db: 'shop',
//                roles: [ { role: 'readWrite', db: 'shop' } ], mechanisms: [ 'SCRAM-SHA-1', 'SCRAM-SHA-256' ] }, ... ], ok: 1 }
```

See a single role's details, including its privileges:

```javascript
db.getRole("orderSupport", { showPrivileges: true })
```

Check who **you** are logged in as, and your roles:

```javascript
db.runCommand({ connectionStatus: 1 }).authInfo
// → { authenticatedUsers: [ { user: 'kenSupport', db: 'shop' } ],
//     authenticatedUserRoles: [ { role: 'orderSupport', db: 'shop' } ] }
```

Remove a user who has left:

```javascript
db.dropUser("priyaAnalytics")
```

## Users and roles on MongoDB Atlas

On Atlas, access control is **always on** and you can't turn it off. You don't usually run `createUser`. Instead:

- Go to **Database Access** in the Atlas UI (or use the Atlas CLI or Admin API).
- Add a database user with a password, certificate or cloud identity.
- Pick built-in roles, or define **custom roles** in the same screen.

Atlas also has separate **organization and project roles** for people who manage the Atlas account itself. Those control who can change the cluster, not who can read data.

## Common mistakes

- **Turning on authorization before creating an admin, from a remote machine.** The localhost exception only works from the server itself. Create the admin user first.
- **Using `root` for the application.** If the app is hacked, the attacker owns everything. Give apps `readWrite` on their own database only.
- **Wrong `authSource`.** If the user was created in `shop`, connect with `authSource=shop`. "Authentication failed" often just means the wrong auth database.
- **Typing passwords into commands.** They end up in shell history. Use `passwordPrompt()` and environment variables.
- **Sharing one user for everybody.** You can't tell who did what, and you can't remove one person's access. Create one user per person and per app.

## Practice

1. Create a user `mariaReports` in `shop` that can only read the `shop` database.
2. Write a custom role `inventoryEditor` that can `find` and `update` documents in `shop.products` only, then create the user `rahulStock` with it.
3. Give `rahulStock` the extra ability to read `shop.orders`, without editing the role.

<details>
<summary>Show a possible answer</summary>

```javascript
use shop

// 1. Read-only user
db.createUser({
  user: "mariaReports",
  pwd: passwordPrompt(),
  roles: [ { role: "read", db: "shop" } ]
})

// 2. Custom role and user
db.createRole({
  role: "inventoryEditor",
  privileges: [
    { resource: { db: "shop", collection: "products" }, actions: [ "find", "update" ] }
  ],
  roles: []
})
db.createUser({
  user: "rahulStock",
  pwd: passwordPrompt(),
  roles: [ { role: "inventoryEditor", db: "shop" } ]
})

// 3. Add a second role that only reads orders
db.createRole({
  role: "ordersReader",
  privileges: [ { resource: { db: "shop", collection: "orders" }, actions: [ "find" ] } ],
  roles: []
})
db.grantRolesToUser("rahulStock", [ { role: "ordersReader", db: "shop" } ])
```

</details>

## Key takeaways

- **Authentication** proves who you are. **Authorization** decides what you can do. RBAC handles authorization through **roles**.
- Create an admin user first, then set `security.authorization: enabled` and restart.
- Use **built-in roles** like `read`, `readWrite` and `dbAdmin` for common jobs, and **custom roles** for precise collection-level permissions.
- Follow **least privilege**: one user per person or app, with only the roles they need.
- Atlas always has access control on. Manage database users in **Database Access** instead of `createUser`.

**Next lesson:** [TLS, Authentication and Network Security](/courses/mongodb/tls-and-authentication)
