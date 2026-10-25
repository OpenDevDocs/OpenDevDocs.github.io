---
title: "MongoDB Atlas: Free Cluster Setup"
slug: mongodb-atlas-setup
metadescription: Create a free MongoDB Atlas cluster step by step. Add a database user, allow your IP address, copy the connection string and connect with mongosh.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'atlas', 'cloud', 'setup']
course: mongodb
---
## What you will learn

By the end of this lesson you will have:

- A free MongoDB database running in the cloud on **MongoDB Atlas**
- A **database user** with a username and password
- Your computer's IP address on the **IP access list**
- A **connection string** you can use from mongosh, Compass and your apps

You don't need a credit card for the free cluster. All you need is a web browser and about 10 minutes.

## What is MongoDB Atlas?

**MongoDB Atlas** is MongoDB's own cloud service. Instead of installing MongoDB on your computer, Atlas runs it for you on a cloud provider: Amazon Web Services (AWS), Google Cloud or Microsoft Azure. You just connect to it over the internet.

> **Think of it like this:** Installing MongoDB yourself is like cooking at home: you buy the stove, the pans and you clean up. Atlas is like ordering from a good restaurant: the kitchen is someone else's job, and you just enjoy the meal.

Atlas takes care of the boring but important jobs:

- Keeping the server running and up to date
- Keeping **3 copies** of your data on different machines, so one failure doesn't lose anything
- Turning on security features like passwords and encrypted connections
- Optional backups, monitoring charts, Atlas Search and Vector Search

### Local install or Atlas?

| | Local install | Atlas free cluster |
| --- | --- | --- |
| Cost | Free | Free |
| Needs internet | No | Yes |
| Setup effort | Install software | Click through a website |
| Accessible from other devices | Not by default | Yes, from any allowed IP address |
| Atlas-only features (Atlas Search, Vector Search) | Not included | Included (with free-tier limits) |

You can use both. Many developers learn on a local install and deploy their apps on Atlas.

> **Note:** The Atlas website changes its look from time to time. This lesson describes each step in words. If a button has moved, look for the same words nearby, such as **Create**, **Database Access** or **Network Access**.

## Some words you'll see in Atlas

- **Organization:** the top level, usually your company or just you.
- **Project:** a folder inside an organization that holds clusters. You might have one project per app.
- **Cluster:** your actual MongoDB database server (really a group of servers holding copies of the data).
- **Database user:** a username and password that apps use to log in to the cluster. This is **different** from your Atlas website login.
- **IP access list:** a list of internet addresses that are allowed to connect to your cluster. Everyone else is blocked.

> **Think of it like this:** The cluster is a building. The database user is a door key. The IP access list is the guard at the gate who checks you're on the guest list. You need *both* the key and a place on the list to get in.

## Step 1: Create an Atlas account

1. Go to `mongodb.com/cloud/atlas` and choose to try it free or sign up.
2. Sign up with an email address and password, or use a Google or GitHub account.
3. Confirm your email if asked.
4. Atlas may ask a few welcome questions (your goal, your preferred language). Answer them or skip them. They don't change anything important.

Atlas creates a first **organization** and **project** for you automatically.

## Step 2: Create a free cluster

1. On your project's overview page, click **Create** (sometimes shown as **Build a Cluster** or **Create a cluster**).
2. Choose the **Free** option. In older screens and articles this tier is called **M0**. It is the same thing.
3. Pick a **provider** (AWS, Google Cloud or Azure). Any of them is fine for learning.
4. Pick a **region** close to you, for example Mumbai, Singapore or Frankfurt. Closer means faster. Atlas only lists regions that support free clusters.
5. Give the cluster a **name**, or keep the default `Cluster0`. You can't rename a cluster later, so choose something you like. Letters, numbers and hyphens only.
6. You may see an option to **preload a sample dataset**. Leaving it on is useful: it gives you real data to play with.
7. Click **Create** (or **Create Deployment**).

> **Note:** Some accounts are also asked to choose a "database edition". For a free cluster the choice makes no difference to how it runs, so the default is fine.

> **Note:** This course uses MongoDB 8.x. Atlas may run your cluster on MongoDB 9.0 or offer 9.0 in a version picker, because new versions reach Atlas first. That's fine: every lesson in this course works the same way on 9.0.

The free cluster is usually ready within seconds to a few minutes.

### What does "free" give you?

The free cluster is meant for learning and small experiments. Its main limits are:

| Limit | Free cluster |
| --- | --- |
| Storage | 0.5 GB (512 MB) of data plus indexes |
| Number per project | 1 free cluster per project |
| Speed | About 100 operations per second |
| Connections | Up to 500 at once |
| MongoDB version | Atlas picks it for you, and you can't change it |
| Idle pausing | Paused automatically after 30 days with zero connections (you can resume it) |

Half a gigabyte sounds small, but it is a lot of text documents. All the shop examples in this course use only a tiny part of it.

> **Tip:** When you outgrow the free cluster, you can scale up to a paid **Flex** or **Dedicated** cluster without changing your code.

## Step 3: Create a database user

Right after creating the cluster, Atlas usually opens a **security quickstart**. If it doesn't, find **Database Access** in the left sidebar (often grouped under **Security**) and choose to add a new database user.

1. Choose **password** authentication.
2. Enter a **username**, for example `asha`.
3. Enter a **password**, or click the button to let Atlas generate a strong one. **Copy it somewhere safe now.**
4. For the user's privileges, the default "read and write to any database" is fine for learning.
5. Click **Create Database User** (or **Add User**).

> **Warning:** This username and password are what your apps use to log in. Never commit them to GitHub or paste them into public chats. If you leak one, delete the user in Atlas and create a new one.

> **Tip:** To keep things simple, use a password made of letters and numbers only. Characters like `@`, `:`, `/` or `%` must be specially encoded inside a connection string, which confuses many beginners.

## Step 4: Allow your IP address

By default, Atlas blocks **every** connection. You must add your computer's internet address to the **IP access list**.

In the security quickstart, click **Add My Current IP Address**. Then click **Finish and Close**.

If you skipped the quickstart:

1. Find **Network Access** in the left sidebar (often under **Security**).
2. Click **Add IP Address**.
3. Click **Add Current IP Address**, then **Confirm**.

### What about "Allow access from anywhere"?

Atlas also offers an option that adds `0.0.0.0/0`, which means "any IP address on the internet".

- It is handy when your IP changes often (home internet, mobile hotspot) or for some hosting platforms.
- But it means your **password is the only thing** protecting the database.

For learning, adding your current IP is the safer habit. If your internet provider changes your IP and you suddenly can't connect, just add the new IP the same way.

> **Note:** Changes to the IP access list can take a minute to apply.

## Step 5: Get your connection string

A **connection string** is like a full postal address for your database. It tells a program where the cluster is and how to log in.

1. Go to your cluster on the **Clusters** (or **Database**) page.
2. Click **Connect**.
3. Choose how you want to connect. Atlas shows options such as **Drivers** (for apps), **Compass**, **Shell** (mongosh) and **MongoDB for VS Code**.
4. Copy the string Atlas shows you.

It looks something like this:

```text
mongodb+srv://asha:<db_password>@cluster0.abcd123.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
```

Let's read it piece by piece:

| Part | Meaning |
| --- | --- |
| `mongodb+srv://` | The format. `+srv` means "look up the list of servers automatically". |
| `asha` | Your database username. |
| `<db_password>` | A placeholder. Replace it (including the `<` and `>`) with your real password. |
| `cluster0.abcd123.mongodb.net` | Your cluster's address. Yours will be different. |
| `retryWrites=true&w=majority` | Safe default options for writes. |
| `appName=Cluster0` | A label that helps Atlas show where connections come from. |

You can also add a database name right after the `/`, before the `?`:

```text
mongodb+srv://asha:MyPass123@cluster0.abcd123.mongodb.net/shop?retryWrites=true&w=majority
```

Now programs using this string start in the `shop` database.

## Step 6: Connect with mongosh

If you have mongosh installed (see [Installing MongoDB Community 8](/courses/mongodb/installing-mongodb)), connect like this. Put the address in quotes and let mongosh ask for the password, so it never appears in your terminal history:

```bash
mongosh "mongodb+srv://cluster0.abcd123.mongodb.net/" --username asha
```

mongosh asks for your password. Type it (nothing shows on screen while typing, that's normal) and press Enter. You'll see a prompt like:

```text
Atlas atlas-xyz-shard-0 [primary] test>
```

Try a quick command:

```javascript
db.runCommand({ ping: 1 })
// → { ok: 1, ... }
```

If you loaded the sample dataset, list the databases:

```javascript
show dbs
// → sample_mflix   ...
//   sample_airbnb  ...
//   admin          ...
//   local          ...
```

Now create the course's `shop` database with one product:

```javascript
use shop
db.products.insertOne({ name: "Notebook", category: "stationery", price: 49, stock: 120, tags: ["paper", "school"] })
// → { acknowledged: true, insertedId: ObjectId("...") }
```

If you see `acknowledged: true`, your cloud database is working.

### Seeing your data in the Atlas website

On your cluster, open **Browse Collections** (or **Data Explorer**). You'll find the `shop` database and the `products` collection with the notebook inside. You can view, edit and delete documents right there.

## Step 7 (optional): Use the connection string in an app

Apps read the connection string from an **environment variable** so the password stays out of the code. In a Node.js project you'd keep it in a `.env` file:

```bash
MONGODB_URI="mongodb+srv://asha:MyPass123@cluster0.abcd123.mongodb.net/shop?retryWrites=true&w=majority"
```

And your code reads it:

```javascript
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
console.log("Connected to Atlas!");
```

> **Warning:** Add `.env` to your `.gitignore` file so it never gets pushed to GitHub.

You'll build a full app in [Connecting MongoDB to Your First App](/courses/mongodb/connecting-from-an-app).

## Bonus: the Atlas CLI

If you prefer the terminal, the **Atlas CLI** can do all of the steps above with one command, `atlas setup`. It creates a free cluster, a database user and an IP access entry for you. The website is easier the first time, so we won't need the CLI in this course.

## Troubleshooting connections

| Problem | Likely cause | Fix |
| --- | --- | --- |
| Connection times out | Your IP isn't on the access list | Add your current IP under **Network Access** |
| `bad auth : authentication failed` | Wrong username or password | Check the *database user*, not your website login. Reset the password if needed. |
| Error about the password or URL format | Special characters in the password | Use a letters-and-numbers password, or URL-encode it (for example `@` becomes `%40`) |
| Works at home, fails at the office or college | The network blocks port 27017 | Try another network, or ask the network admin |
| Cluster shows as paused | No connections for 30 days | Click **Resume** on the cluster |

## Common mistakes

- **Using your Atlas website password in the connection string.** The connection string needs the **database user** password you created in Step 3.
- **Leaving `<db_password>` in the string.** Replace the whole placeholder, including the angle brackets.
- **Forgetting the IP access list.** Without it, every connection is silently blocked and simply times out.
- **Committing the connection string to GitHub.** Keep it in an environment variable or `.env` file that is ignored by Git.
- **Expecting a second free cluster in the same project.** Only one free cluster is allowed per project. Create a new project if you need another.

## Practice

1. Create a free Atlas cluster and a database user called `learner`.
2. Add your current IP address and connect with mongosh.
3. In the `shop` database, insert the Gel Pen product, then check it is there.

<details>
<summary>Show a possible answer</summary>

```javascript
// In your terminal (replace the address with your own cluster's):
// mongosh "mongodb+srv://cluster0.abcd123.mongodb.net/" --username learner

use shop

db.products.insertOne({
  name: "Gel Pen",
  category: "stationery",
  price: 15,
  stock: 500,
  tags: ["pen", "school"]
})
// → { acknowledged: true, insertedId: ObjectId("...") }

db.products.find({ name: "Gel Pen" })
// → [ { _id: ObjectId("..."), name: "Gel Pen", category: "stationery", price: 15, ... } ]
```

</details>

## Key takeaways

- **MongoDB Atlas** runs MongoDB for you in the cloud. The **Free** cluster (formerly M0) costs nothing and never expires.
- To connect you need **two things**: a **database user** (key) and your IP on the **IP access list** (guest list).
- The **connection string** (`mongodb+srv://...`) tells programs where the cluster is and who is logging in.
- Keep passwords out of code and Git. Use environment variables.
- The free tier has limits (0.5 GB storage, one per project, pauses after 30 idle days) that are fine for learning.

**Next lesson:** [mongosh: The MongoDB Shell](/courses/mongodb/mongosh-basics)
