---
publishDate: 2026-10-25T14:15
title: 'Installing Docker on Windows, macOS and Linux'
slug: installing-docker
metadescription: 'Install Docker Desktop on Windows with WSL 2 or on macOS, install Docker Engine on Ubuntu from Docker''s apt repository, and check that it works.'
updateDate: 2026-10-25T14:15
author: ['bishal-biswas']
level: 1
tags: ['docker', 'installation', 'wsl', 'linux']
course: docker
---

## Getting Docker on your computer

Before you can run containers, you need Docker installed. The steps are different for each operating system, but the result is the same: a working `docker` command in your terminal.

In this lesson you will:

- learn the difference between **Docker Desktop** and **Docker Engine**
- install Docker Desktop on **Windows** (with WSL 2) or **macOS**
- install Docker Engine on an **Ubuntu Linux** server from Docker's official repository
- run Docker without `sudo` on Linux, and understand the risk
- check that everything works

Pick the section for your system. You do not need to read the others.

## Docker Desktop or Docker Engine?

There are two main ways to get Docker:

| | Docker Desktop | Docker Engine |
|---|---|---|
| Runs on | Windows, macOS, Linux desktops | Linux (servers and desktops) |
| What you get | Engine, CLI, Compose, Buildx, a graphical app, a hidden Linux VM | Engine, CLI and plugins you choose (Compose, Buildx) |
| Best for | Developers on laptops | Servers, CI machines, Linux users |
| Cost | Free for personal use, education, open source and small businesses. Larger companies need a paid plan | Free and open source |

> **Note:** Check Docker's current license terms on docker.com if you use Docker Desktop at work. Docker Engine on Linux has no such limit.

You learned in [Containers vs Virtual Machines](/courses/docker/containers-vs-virtual-machines) that Linux containers need a Linux kernel. Docker Desktop solves this on Windows and macOS by running a small Linux VM for you. On Linux, Docker Engine uses your own kernel directly.

## Installing on Windows

On Windows, Docker Desktop runs its Linux part inside **WSL 2** (Windows Subsystem for Linux, version 2). WSL 2 is a real Linux kernel managed by Windows.

### Step 1: check your Windows version

You need a 64-bit version of Windows 10 or Windows 11 with recent updates. Hardware **virtualization** must be turned on in your computer's BIOS or UEFI settings. On most modern computers it already is.

To check, open **Task Manager**, go to the **Performance** tab, click **CPU**, and look for "Virtualization: Enabled".

### Step 2: install or update WSL 2

Open **PowerShell as Administrator** and run:

```powershell
wsl --install
```

If WSL is already installed, make sure it is up to date:

```powershell
wsl --update
wsl --version
```

```text
WSL version: 2.6.1.0
Kernel version: 6.6.87.2-1
...
```

Restart your computer if Windows asks you to.

### Step 3: install Docker Desktop

1. Download **Docker Desktop for Windows** from docs.docker.com (the "Install Docker Desktop on Windows" page).
2. Run the installer. Keep the option **"Use WSL 2 instead of Hyper-V"** selected.
3. When it finishes, start **Docker Desktop** from the Start menu.
4. Accept the terms, and wait until the status in the bottom left says the Engine is **running**.

### Step 4: test it

Open a new PowerShell or Windows Terminal window:

```powershell
docker version
docker run hello-world
```

If you see "Hello from Docker!", you are done. Jump to [Check your installation](#check-your-installation).

> **Tip:** You can also use Docker from inside a WSL Linux distribution such as Ubuntu. In Docker Desktop, open **Settings, Resources, WSL integration** and turn it on for your distribution. Keeping your project files inside the WSL file system (for example `~/projects`) makes bind mounts much faster than using files on `C:\`.

## Installing on macOS

Docker Desktop for Mac has two versions. Choose the right one for your chip:

- **Apple silicon** (M1, M2, M3, M4 and newer)
- **Intel chip**

To check, click the Apple menu, then **About This Mac**, and look at "Chip" or "Processor".

### Steps

1. Download the right **Docker Desktop for Mac** from docs.docker.com.
2. Open the `.dmg` file and drag **Docker** into **Applications**.
3. Open Docker from Applications. Give it the permissions it asks for.
4. Wait until the whale icon in the menu bar shows that Docker is running.

If you use Homebrew, you can install it with one command instead:

```bash
brew install --cask docker
```

Then test it in the Terminal app:

```bash
docker version
docker run hello-world
```

> **Note:** On Apple silicon, most popular images are available for `arm64`, so they run natively. Images built only for `amd64` can still run through emulation, but more slowly. You will learn about this in [Multi-Platform Images with Buildx](/courses/docker/multi-platform-builds).

## Installing on Ubuntu Linux

On Linux servers, install **Docker Engine** from **Docker's own apt repository**. This gives you current versions and security updates directly from Docker.

> **Warning:** Do not use `sudo apt install docker.io` or the `snap` package if you want to follow this course exactly. Those packages come from Ubuntu, not Docker, and are often older or packaged differently.

These steps are for Ubuntu 24.04. Docker's docs at docs.docker.com have the same steps for Debian, Fedora, RHEL and others. Always check there for the latest version of the commands.

### Step 1: remove old packages

If an older Docker was installed before, remove it first. It is fine if this says nothing is installed.

```bash
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do
  sudo apt-get remove -y $pkg
done
```

### Step 2: add Docker's apt repository

```bash
# Tools needed to download over HTTPS
sudo apt-get update
sudo apt-get install -y ca-certificates curl

# Download Docker's signing key, so apt can check the packages are real
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository for your Ubuntu version
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
```

The **signing key** is like a seal on a letter. It proves the packages really come from Docker and were not changed on the way.

### Step 3: install Docker Engine and plugins

```bash
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

| Package | What it is |
|---|---|
| `docker-ce` | The Docker Engine (`dockerd`) |
| `docker-ce-cli` | The `docker` command (the client) |
| `containerd.io` | The container manager the Engine uses |
| `docker-buildx-plugin` | Adds `docker buildx`, for advanced builds |
| `docker-compose-plugin` | Adds `docker compose` (Compose v2) |

You met the Engine, containerd and the client in [How Docker Works: Engine, Client, Images and Registries](/courses/docker/docker-architecture).

### Step 4: check the service

The Engine runs as a **systemd** service. It should start automatically:

```bash
sudo systemctl status docker
```

```text
● docker.service - Docker Application Container Engine
     Loaded: loaded (/usr/lib/systemd/system/docker.service; enabled; preset: enabled)
     Active: active (running) since ...
```

If it is not running, start it and make it start on every boot:

```bash
sudo systemctl enable --now docker
```

Test it:

```bash
sudo docker run hello-world
```

### Step 5 (optional): use Docker without sudo

By default only **root** can talk to the Docker Engine. To use `docker` without typing `sudo`, add your user to the `docker` group:

```bash
sudo usermod -aG docker $USER
```

Then **log out and log back in** (or run `newgrp docker` in the current terminal) so the change takes effect. Now this works without sudo:

```bash
docker run hello-world
```

> **Warning:** Membership of the `docker` group is the same as having **root access** to the machine. A user in this group can start a container that mounts the whole host file system and change anything. Only add users you would trust with `sudo`. If users and permissions are new to you, read [SSH, Users and Permissions](/courses/devops/ssh-users-and-permissions).

## Check your installation

Whatever system you use, run these commands. They work the same everywhere.

```bash
docker version           # client and server versions
docker compose version   # Compose v2 plugin
docker buildx version    # Buildx plugin
docker run hello-world   # pull and run a test image
```

```text
Docker Compose version v2.40.0
github.com/docker/buildx v0.29.1 ...
```

The `hello-world` output starts like this:

```text
Unable to find image 'hello-world:latest' locally
latest: Pulling from library/hello-world
...
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

Your version numbers will differ. What matters is that each command works without an error.

> **Note:** Compose is now a plugin, so the command is `docker compose` with a **space**. The old `docker-compose` with a dash is the retired version 1. This course always uses `docker compose`.

## Common problems

### "Cannot connect to the Docker daemon"

The client works but cannot reach the Engine.

- **Windows or macOS:** Docker Desktop is not running. Start it and wait until it says it is running.
- **Linux:** the service is stopped. Run `sudo systemctl start docker`.

### "permission denied while trying to connect to the Docker daemon socket"

On Linux, your user is not allowed to use `/var/run/docker.sock`. Either use `sudo`, or add yourself to the `docker` group as shown above and **log out and in again**. Forgetting to log out is the most common reason it "still does not work".

### WSL 2 errors on Windows

If Docker Desktop says WSL 2 is not installed or is too old, run `wsl --update` in an Administrator PowerShell and restart. If it says virtualization is disabled, turn it on in your BIOS or UEFI settings.

### Docker uses a lot of disk space

Images and containers add up over time. You will learn how to see and clean this in [Cleaning Up: Pruning Containers, Images and Volumes](/courses/docker/cleaning-up-docker). For now, `docker system df` shows how much space Docker uses.

## Quick recap

- **Docker Desktop** is for Windows and macOS (and Linux desktops). It includes a small hidden Linux VM.
- On **Windows**, Docker Desktop uses **WSL 2**. Run `wsl --install` or `wsl --update` first.
- On **macOS**, pick the Apple silicon or Intel version.
- On **Linux servers**, install **Docker Engine** from Docker's apt repository, not the distribution's old package.
- The `docker` group is root-equivalent. Only add users you trust.
- Check with `docker version`, `docker compose version` and `docker run hello-world`.

Next, you will start real containers and look around inside them in [Running Your First Container](/courses/docker/your-first-container).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# Install Docker Engine on Ubuntu 24.04 from Docker's official apt repository.
# Check docs.docker.com for the latest steps for your distribution.
# Run as a normal user with sudo rights.
set -e
#
# 1. Remove old or unofficial packages (errors here are fine)
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do
  sudo apt-get remove -y $pkg || true
done
#
# 2. Install tools needed to download over HTTPS
sudo apt-get update
sudo apt-get install -y ca-certificates curl
#
# 3. Add Docker's signing key so apt can verify the packages
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
#
# 4. Add the Docker repository for this Ubuntu version
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release &amp;&amp; echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list &gt; /dev/null
sudo apt-get update
#
# 5. Install the Engine, the CLI, containerd, Buildx and Compose v2
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
#
# 6. Start Docker now and on every boot
sudo systemctl enable --now docker
#
# 7. Optional: use docker without sudo (root-equivalent, log out and in afterwards)
sudo usermod -aG docker "$USER"
#
# 8. Check that everything works
sudo docker version
sudo docker compose version
sudo docker buildx version
sudo docker run --rm hello-world
</code></pre>
