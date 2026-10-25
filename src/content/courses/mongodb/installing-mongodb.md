---
title: Installing MongoDB Community 8
slug: installing-mongodb
metadescription: Install MongoDB Community 8 on Windows, macOS or Linux, or run it in Docker. Then install mongosh and check that everything works.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'installation', 'setup', 'docker']
course: mongodb
---
## What you will learn

By the end of this lesson you will have:

- A MongoDB 8 server running on your own computer
- The MongoDB Shell (**mongosh**) installed and connected to it
- A simple way to start and stop the server
- An idea of where MongoDB keeps your data

Pick **one** install method below. You do not need all of them.

> **Tip:** Don't want to install anything? Skip to the next lesson, [MongoDB Atlas: Free Cluster Setup](/courses/mongodb/mongodb-atlas-setup), and use a free cloud database instead. Everything in this course works on Atlas too.

## What exactly are we installing?

"Installing MongoDB" really means installing a few separate programs:

| Program | What it does |
| --- | --- |
| **mongod** | The database **server**. It runs in the background, stores data and answers requests. The "d" stands for *daemon*, an old word for a background program. |
| **mongosh** | The MongoDB **Shell**. A command-line app where you type commands to talk to the server. |
| **MongoDB Compass** | An optional **graphical app** to browse your data with a mouse. |
| **Database Tools** | Optional helpers like `mongoimport` and `mongodump` for importing and backing up data. |

> **Think of it like this:** `mongod` is the kitchen in a restaurant. `mongosh` is the waiter who takes your order to the kitchen and brings back the food. You need both to get a meal.

The free version of MongoDB you run yourself is called **MongoDB Community Edition**. That's what we'll install.

### Which version should I pick?

This course uses **MongoDB 8.x**. The 8.x family has a few release lines you can install yourself:

- **8.0** is the main MongoDB 8 release. It gets the longest support and is the safest choice for learning.
- **8.3** is the latest 8.x *minor* release, with extra features. Starting with 8.2, minor releases can also be downloaded for self-managed use.

Both work for every beginner lesson in this course. The commands below use **8.0**. Where it matters, a tip shows how to get 8.3 instead.

> **Note:** MongoDB 9.0 has also been released. It reaches Atlas first, and Community downloads follow later. If a download page or package manager offers 9.0, the lessons in this course work the same way. For installing, the steps stay the same; you only change the version number.

## Choose your install method

| Your situation | Best option |
| --- | --- |
| You already use Docker, or want the quickest clean setup | Option 1: Docker |
| Windows 11 | Option 2: Windows |
| macOS | Option 3: macOS with Homebrew |
| Ubuntu Linux | Option 4: Ubuntu Linux with apt |

## Option 1: Docker (the quickest way)

**Docker** runs programs inside *containers*: small, isolated boxes that already contain everything the program needs. Nothing is installed directly on your system, and you can delete it all in one command.

> **Think of it like this:** A container is like a lunchbox. The food (MongoDB) is packed inside with everything it needs, and it doesn't spill into your bag.

### Step 1: Install Docker

Install **Docker Desktop** (Windows/macOS) or **Docker Engine** (Linux) from the official Docker website. Then check it works:

```bash
docker --version
```

### Step 2: Start a MongoDB 8 container

MongoDB publishes an official image called `mongodb/mongodb-community-server`. This command downloads it and starts it:

```bash
docker run --name mongodb -p 127.0.0.1:27017:27017 -v mongodb-data:/data/db -d mongodb/mongodb-community-server:8.0-ubuntu2204
```

Let's break that down:

| Part | Meaning |
| --- | --- |
| `--name mongodb` | Give the container a friendly name. |
| `-p 127.0.0.1:27017:27017` | Make MongoDB's port `27017` reachable from your computer only. |
| `-v mongodb-data:/data/db` | Keep your data in a Docker *volume* so it survives restarts. |
| `-d` | Run in the background ("detached"). |
| `...:8.0-ubuntu2204` | The image and version tag. Use `8.3-ubuntu2204` for MongoDB 8.3. |

The same command works in Windows PowerShell.

### Step 3: Check it is running

```bash
docker ps
```

You should see a line with the name `mongodb` and a status like `Up 10 seconds`.

### Everyday Docker commands

```bash
docker stop mongodb    # stop the server
docker start mongodb   # start it again (your data is still there)
docker logs mongodb    # see the server's log messages
```

> **Warning:** If you write `-p 27017:27017` without `127.0.0.1:`, Docker may expose MongoDB to your whole network. A fresh MongoDB has no password, so keep it on `127.0.0.1` while learning.

Now jump to the **Install mongosh** section below. Docker gives you the server, but you still want the shell on your computer.

## Option 2: Windows

MongoDB 8 Community supports **64-bit Windows 11** and Windows Server 2022.

> **Note:** MongoDB does not support running inside **WSL** (Windows Subsystem for Linux). Install the Windows version, or use Docker.

### Method A: The MSI installer (point and click)

1. Open the **MongoDB Community Server download page** at `mongodb.com/try/download/community`.
2. Choose the **Version** (for example 8.0.x), **Platform** = Windows, **Package** = msi. Click **Download**.
3. Double-click the downloaded `.msi` file.
4. Choose the **Complete** setup type.
5. On the service screen, keep **Install MongoD as a Service** ticked. Leave **Run service as Network Service user** selected. The default service name is `MongoDB`.
6. Leave the data and log folders as they are, unless you have a reason to change them.
7. Keep **Install MongoDB Compass** ticked if you want the graphical app (you'll use it in a later lesson).
8. Click **Install** and wait.

When it finishes, the MongoDB service starts automatically. The server programs live in:

```text
C:\Program Files\MongoDB\Server\8.0\bin
```

> **Tip:** To make `mongod` work from any terminal, add that `bin` folder to your **PATH** environment variable. This is optional because the service runs on its own.

### Method B: winget in PowerShell

**winget** is the package manager built into Windows 11. Open PowerShell and run:

```powershell
winget install --id MongoDB.Server --exact
```

winget installs the newest MongoDB Server version it knows about, which may not be 8.x. If you want a specific version like 8.0, use the MSI method instead.

### Start and stop the service on Windows

The service normally starts by itself when Windows boots. To control it manually, open **PowerShell as Administrator**:

```powershell
Get-Service MongoDB      # check the status
Stop-Service MongoDB     # stop the server
Start-Service MongoDB    # start the server
```

You can also use the classic commands `net stop MongoDB` and `net start MongoDB`, or the **Services** app (search "Services" in the Start menu).

> **Important:** The Windows installer does **not** include mongosh. Continue with the **Install mongosh** section below.

## Option 3: macOS with Homebrew

MongoDB 8 supports **macOS 14 or later**. On macOS, the official way is **Homebrew**, the popular package manager.

### Step 1: Install the tools Homebrew needs

```bash
xcode-select --install
```

If Homebrew itself is missing, install it from `brew.sh` first.

### Step 2: Add MongoDB's Homebrew "tap"

A **tap** is an extra list of packages. MongoDB keeps its own:

```bash
brew tap mongodb/brew
brew trust mongodb/brew
brew update
```

The `brew trust` line marks MongoDB's tap as a trusted source, as the official docs recommend.

### Step 3: Install MongoDB 8

```bash
brew install mongodb-community@8.0
```

For MongoDB 8.3, use `mongodb-community@8.3` instead.

Good news: on macOS this one command installs `mongod`, **mongosh** and the Database Tools together.

### Step 4: Start MongoDB as a background service

```bash
brew services start mongodb-community@8.0
```

Check that it is running:

```bash
brew services list
```

You should see `mongodb-community` with the status `started`. To stop it later:

```bash
brew services stop mongodb-community@8.0
```

### Where are my files on a Mac?

| | Apple Silicon (M1, M2...) | Intel |
| --- | --- | --- |
| Config file | `/opt/homebrew/etc/mongod.conf` | `/usr/local/etc/mongod.conf` |
| Data folder | `/opt/homebrew/var/mongodb` | `/usr/local/var/mongodb` |
| Log folder | `/opt/homebrew/var/log/mongodb` | `/usr/local/var/log/mongodb` |

> **Tip:** If macOS blocks `mongod` with a "developer cannot be verified" message, open **System Settings → Privacy & Security** and click **Open Anyway** next to the message about `mongod`.

## Option 4: Ubuntu Linux with apt

MongoDB 8.0 supports the 64-bit LTS releases of Ubuntu: **24.04 (Noble)**, **22.04 (Jammy)** and **20.04 (Focal)**. Check yours with:

```bash
cat /etc/lsb-release
```

> **Warning:** Ubuntu has its own package called `mongodb`. It is **not** made by MongoDB Inc. and it clashes with the official one. If you installed it before, remove it first. We will use the official package, `mongodb-org`.

### Step 1: Import MongoDB's signing key

This lets `apt` check that the packages really come from MongoDB.

```bash
sudo apt-get install gnupg curl
curl -fsSL https://pgp.mongodb.com/server-8.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg \
   --dearmor
```

### Step 2: Add the MongoDB package list

This line is for **Ubuntu 24.04 (Noble)**:

```bash
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
```

On **Ubuntu 22.04**, replace `noble` with `jammy`. For MongoDB 8.3, the official docs use `noble/mongodb-org/8.3` and the file name `mongodb-org-8.3.list` (the 8.0 key stays the same).

### Step 3: Install

```bash
sudo apt-get update
sudo apt-get install -y mongodb-org
```

The `mongodb-org` package is a bundle. It installs the server, **mongosh** and the Database Tools in one go.

### Step 4: Start the server

Modern Ubuntu uses **systemd**, which is controlled with `systemctl`:

```bash
sudo systemctl start mongod
sudo systemctl status mongod
```

Look for `active (running)` in green. Press `q` to leave the status screen.

If you get `Unit mongod.service not found`, run this once and try again:

```bash
sudo systemctl daemon-reload
```

Optional: start MongoDB automatically every time the computer boots.

```bash
sudo systemctl enable mongod
```

Other everyday commands:

```bash
sudo systemctl stop mongod
sudo systemctl restart mongod
```

On Linux, data lives in `/var/lib/mongodb`, logs in `/var/log/mongodb`, and the config file is `/etc/mongod.conf`.

## Install mongosh (the shell)

Check whether you already have it:

```bash
mongosh --version
```

If you see a version like `2.x.x`, skip ahead. You **already have mongosh** if you used Homebrew (macOS) or `mongodb-org` (Linux). You **still need it** if you used the Windows MSI or Docker.

### mongosh on Windows

Option A, the installer: open the **MongoDB Shell download page** at `mongodb.com/try/download/shell`, choose **Windows 64-bit (10+) (MSI)**, download and double-click it. Let the installer add mongosh to your **PATH**.

Option B, winget in PowerShell:

```powershell
winget install --id MongoDB.Shell --exact
```

Close and reopen your terminal afterwards so the new PATH takes effect.

### mongosh on macOS (if you used Docker)

```bash
brew install mongosh
```

### mongosh on Ubuntu (if you used Docker)

Follow Steps 1 and 2 of the Ubuntu section above, then install just the shell:

```bash
sudo apt-get update
sudo apt-get install -y mongodb-mongosh
```

> **Note:** The old shell was called `mongo`. It was removed years ago. Always use `mongosh`. If a tutorial tells you to type `mongo`, it is out of date.

## Check that everything works

Open a **new** terminal and type:

```bash
mongosh
```

With no extra options, mongosh connects to a server on your own computer at the default port **27017**. You should see something like this:

```text
Current Mongosh Log ID: 6718c0ffee...
Connecting to:          mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.x.x
Using MongoDB:          8.0.x
Using Mongosh:          2.x.x

test>
```

The `test>` prompt means you are connected. Now ask the server if it is alive:

```javascript
db.runCommand({ ping: 1 })
// → { ok: 1 }
```

And check its version:

```javascript
db.version()
// → 8.0.x
```

Type `exit` to leave the shell.

That's it. You have a working MongoDB server.

### If it doesn't connect

| Error you see | Most likely reason | Fix |
| --- | --- | --- |
| `ECONNREFUSED 127.0.0.1:27017` | The server isn't running. | Start it (service, `brew services`, `systemctl` or `docker start`). |
| `mongosh: command not found` / "not recognized" | mongosh isn't installed or not on PATH. | Install mongosh, then open a new terminal. |
| `Address already in use` in the server log | Another MongoDB is already using port 27017. | Stop the other one, or use only one install method. |

## Two safety facts about a local install

1. **It only listens on your own computer.** By default MongoDB binds to `127.0.0.1` (localhost). Other machines can't connect, which is exactly what you want while learning.
2. **It has no password by default.** That's fine on localhost. Before you ever open it to a network, turn on authentication. You'll learn how in [Role-Based Access Control and Users](/courses/mongodb/rbac-and-users).

## Common mistakes

- **Installing Ubuntu's `mongodb` package** instead of the official `mongodb-org`. Remove the old one and follow the official steps.
- **Forgetting that the server must be running.** mongosh is only the client. If `mongod` isn't started, you'll get "connection refused".
- **Installing the server on Windows and expecting mongosh to be there.** The MSI doesn't include it. Install mongosh separately.
- **Using the old `mongo` command** from outdated tutorials. Use `mongosh`.
- **Running two MongoDB servers at once** (for example a Windows service *and* a Docker container) on the same port 27017. Pick one.

## Practice

1. Install MongoDB with any method and connect with `mongosh`.
2. Run the commands that show the server version and check that the server answers a ping.
3. Stop the server, then try `mongosh` again. What error do you get? Start the server again.

<details>
<summary>Show a possible answer</summary>

```javascript
// Inside mongosh:
db.version()
// → 8.0.x

db.runCommand({ ping: 1 })
// → { ok: 1 }

// After stopping the server, running mongosh fails with an error like:
// MongoNetworkError: connect ECONNREFUSED 127.0.0.1:27017
// Start the server again (for example: brew services start mongodb-community@8.0,
// sudo systemctl start mongod, Start-Service MongoDB, or docker start mongodb)
```

</details>

## Key takeaways

- MongoDB is made of separate programs: the **mongod** server, the **mongosh** shell, plus optional **Compass** and **Database Tools**.
- Use **Docker** for the quickest setup, the **MSI** or winget on Windows, **Homebrew** on macOS, and **apt** with `mongodb-org` on Ubuntu.
- The Windows MSI and Docker don't include mongosh. Install it separately.
- The default address is `mongodb://127.0.0.1:27017`, and a local install only accepts connections from your own computer.
- Test your setup with `mongosh`, then `db.runCommand({ ping: 1 })`.

**Next lesson:** [MongoDB Atlas: Free Cluster Setup](/courses/mongodb/mongodb-atlas-setup)
