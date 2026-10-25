---
publishDate: 2026-10-25T10:25
title: 'Linux for DevOps: Why Servers Run Linux'
slug: linux-for-devops
metadescription: Learn what Linux is, why almost every server, container and CI runner uses it, the main distributions, the file system layout, services with systemd and how to get a Linux machine to practise on.
updateDate: 2026-10-25T10:25
author: ['bishal-biswas']
level: 1
tags: ['devops', 'linux', 'servers', 'systemd']
course: devops
---

## Why Linux comes first

Look underneath almost any piece of modern infrastructure and you will find Linux:

- most web servers on the internet run it;
- the default virtual machines on AWS, Azure and Google Cloud are Linux;
- every Docker container you run on a server is, under the hood, using the Linux kernel;
- Kubernetes nodes run Linux;
- when a GitHub Actions file says `runs-on: ubuntu-latest`, your pipeline runs on Linux.

That is why Linux is step one of the [DevOps roadmap](/courses/devops/devops-roadmap-and-toolchain). You do not need to become a Linux expert, but you do need to feel at home on a Linux server: moving around, reading logs, installing software and checking what is running.

> **Note:** This lesson and the next two give you the Linux essentials for DevOps. A full **Linux and Shell** course on OpenDevDocs, which goes much deeper, is coming soon.

## What is Linux?

Strictly speaking, **Linux** is a **kernel**: the core program that sits between the hardware and everything else. The kernel decides which program gets the CPU, hands out memory, talks to disks and network cards, and keeps programs from interfering with each other.

Linus Torvalds, a Finnish student, started writing it in 1991 as a hobby and shared the code for free. Thousands of people and companies have worked on it since.

A kernel on its own is not much use. You also need a shell to type commands into, basic tools such as `ls` and `cp`, a package manager to install software and so on. A complete, ready-to-install bundle of the kernel plus all of these is called a **distribution**, or **distro**.

Think of it as layers:

```text
+-------------------------------------------------+
|  Your applications: nginx, Node.js, PostgreSQL  |
+-------------------------------------------------+
|  User space: shell, ls, cp, apt, systemd ...    |
+-------------------------------------------------+
|  Linux kernel: CPU, memory, disks, network      |
+-------------------------------------------------+
|  Hardware (or a virtual machine)                |
+-------------------------------------------------+
```

## Why servers run Linux

- **It is free and open source.** No licence fee per server. When you run 500 servers, that adds up fast. Anyone can read and fix the code.
- **It is stable.** Linux servers routinely run for months without a restart.
- **It works without a screen.** Servers have no monitor. Linux is designed to be run entirely from a text terminal, often from the other side of the world over [SSH](/courses/devops/ssh-users-and-permissions).
- **Everything can be scripted.** Every setting is a text file and every task is a command, so everything can be automated. That fits the **A** for Automation in [CALMS](/courses/devops/devops-principles) perfectly.
- **Containers are a Linux feature.** Docker builds on two kernel features, **namespaces** (which give each container its own private view of processes, files and network) and **cgroups** (which limit how much CPU and memory it can use). On Windows and macOS, Docker Desktop quietly runs a small Linux virtual machine to make containers work.
- **It is lightweight.** A minimal Linux server can run in a few hundred megabytes of memory, leaving the rest for your app.

## Distributions you will meet

There are hundreds of distros, but in DevOps a handful cover almost everything:

| Distribution | Family | Package manager | Where you will see it |
|---|---|---|---|
| **Ubuntu** | Debian | `apt` | The most common cloud server and CI runner. A great first choice. |
| **Debian** | Debian | `apt` | Very stable servers, and the base of many Docker images. |
| **Red Hat Enterprise Linux** (RHEL) | Red Hat | `dnf` | Large companies that want paid support. |
| **Rocky Linux**, **AlmaLinux** | Red Hat | `dnf` | Free rebuilds of RHEL. |
| **Amazon Linux** | Red Hat-like | `dnf` | AWS's own server distro. |
| **Alpine** | Its own | `apk` | Tiny Docker images (about 5 MB). |

Distros in the same **family** work almost the same way. If you learn Ubuntu, Debian feels like home, and Rocky Linux only needs a few new commands.

> **Tip:** Ubuntu releases a **Long Term Support** (LTS) version every two years, each with five years of free security updates. For servers, always pick an LTS version.

## Installing software: package managers

On Linux you rarely download installers from websites. You ask the **package manager**, which fetches software from the distro's trusted servers, installs everything it depends on and keeps it updated.

The same job on the three main families:

```bash
# Ubuntu and Debian
sudo apt update             # refresh the list of available packages
sudo apt install nginx      # install the nginx web server

# RHEL, Rocky, AlmaLinux, Amazon Linux
sudo dnf install nginx

# Alpine (mostly inside containers)
apk add nginx
```

`sudo` means "run this as the administrator". You will learn about it in [SSH, Users and Permissions on a Server](/courses/devops/ssh-users-and-permissions).

## The file system: where everything lives

Linux has no `C:` or `D:` drive. Everything hangs off one tree that starts at `/`, called the **root**. Disks and USB sticks are attached (**mounted**) somewhere inside that tree.

The folders you will visit most as a DevOps engineer:

| Path | What lives there |
|---|---|
| `/` | The root of everything |
| `/etc` | System-wide **configuration** files, such as `/etc/nginx/nginx.conf` |
| `/var/log` | **Log files**, such as `/var/log/syslog` or `/var/log/nginx/access.log` |
| `/var/lib` | Data that programs store, such as databases and Docker images |
| `/home/<name>` | Each user's personal folder, also written as `~` |
| `/root` | The administrator's personal folder |
| `/usr/bin`, `/usr/local/bin` | Programs you can run |
| `/opt` | Optional, self-contained software |
| `/tmp` | Temporary files, often wiped at reboot |
| `/proc` | Not real files: a live window into the kernel and running processes |

> **Note:** On Linux, "everything is a file". Settings are text files, logs are text files, and even hardware and running processes appear as files under `/dev` and `/proc`. That is a big reason Linux is so easy to automate: reading and changing text is easy.

## Processes and services

Every running program is a **process**, and each has a number called its **PID** (process ID). You can see them with:

```bash
ps aux | head -5      # a snapshot of running processes
top                   # a live, updating view (press q to quit)
```

Programs that should run all the time in the background, such as a web server, a database or SSH itself, are called **services** or **daemons** (that is why many of their names end in `d`, like `sshd`).

On almost every modern distro, services are managed by **systemd**. You talk to it with `systemctl`:

```bash
sudo systemctl status nginx      # is it running? any recent errors?
sudo systemctl start nginx       # start it now
sudo systemctl stop nginx        # stop it now
sudo systemctl restart nginx     # stop then start (after a config change)
sudo systemctl enable nginx      # start it automatically at boot
```

And you read a service's logs with `journalctl`:

```bash
sudo journalctl -u nginx --since "1 hour ago"   # logs from the last hour
sudo journalctl -u nginx -f                     # follow new log lines live
```

These two commands are the first thing to reach for when "the site is down".

## Getting a Linux machine to practise on

You have several easy options, all free or very cheap:

| Option | Good for | How |
|---|---|---|
| **WSL 2** on Windows | Daily practice on your own laptop | Run `wsl --install` in PowerShell as administrator, then restart. You get Ubuntu by default. |
| **Your Mac's terminal** | Most shell commands | macOS is not Linux, but it is Unix-like, so most commands behave the same. Use a VM or container for Linux-only tools. |
| **A virtual machine** | A full Linux desktop or server | Tools such as **Multipass** (`multipass launch`) create an Ubuntu VM in one command. |
| **A Docker container** | A throwaway Linux in seconds | `docker run -it --rm ubuntu bash`, once you have [Docker](/courses/devops/docker-essentials). |
| **A small cloud server** | The real thing, with a public IP | Most providers offer a small server for a few dollars a month, or free credits for new accounts. |

For this course, **WSL 2** (on Windows) or a **small cloud server** are the best choices. You will connect to a cloud server in [SSH, Users and Permissions on a Server](/courses/devops/ssh-users-and-permissions).

## A quick server health check

The code panel for this lesson has a Bash script that prints a one-screen summary of a Linux machine: which distro and kernel it runs, how long it has been up, how busy it is, and how much memory and disk is left. It is the kind of thing you run the moment you log in to a server you do not know.

```bash
bash server-info.sh
```

On a small Ubuntu cloud server you might see:

```text
=== Server summary ===
Host:     web-01
OS:       Ubuntu 24.04.3 LTS
Kernel:   6.8.0-85-generic
Uptime:   up 12 days, 4 hours, 9 minutes
Load:     0.08 0.05 0.01  (on 2 CPUs)

=== Memory ===
               total        used        free      shared  buff/cache   available
Mem:           3.8Gi       612Mi       2.1Gi       1.0Mi       1.3Gi       3.2Gi

=== Disk (/) ===
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        77G  4.1G   73G   6% /

=== Top 5 processes by memory ===
    PID COMMAND         %MEM
    812 node             3.9
    655 nginx            0.4
    ...
```

The **load** numbers are the average number of processes wanting CPU time over the last 1, 5 and 15 minutes. As a rough rule, a load higher than the number of CPUs means the server is busier than it can comfortably handle.

## Common misunderstandings

### "Linux is hard and only for experts"

Using a Linux server well comes down to a few dozen commands, which you will learn in the next lesson. You do not need to know how the kernel works inside.

### "I need Linux on my laptop to do DevOps"

It helps, but it is not required. WSL 2 gives Windows users a real Linux environment, and macOS shares most of Linux's commands. What matters is being comfortable in the terminal.

### "All distros are completely different"

They share the same kernel, the same shell and almost all the same commands. The main differences are the package manager and where a few config files live.

## Quick recap

- **Linux** is a kernel. A **distribution** bundles it with tools, a package manager and more.
- It dominates servers, the cloud, containers and CI because it is free, stable, scriptable and runs without a screen.
- The distros you will meet most are **Ubuntu**, **Debian**, the **RHEL family** and **Alpine**.
- Install software with the package manager: `apt`, `dnf` or `apk`.
- Config lives in `/etc`, logs in `/var/log`, and everything is a file.
- Services are managed with `systemctl` and their logs are read with `journalctl`.
- Practise on **WSL 2** or a small cloud server.

Next, you will learn the commands you will type every day in [Essential Shell Commands and Bash Scripting](/courses/devops/shell-essentials).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# server-info.sh: a one-screen health check for any Linux machine.
# Run it with: bash server-info.sh
section() { printf '\n=== %s ===\n' "$1"; }
section "Server summary"
# /etc/os-release is a small text file every modern distro provides
if [ -r /etc/os-release ]; then
  . /etc/os-release                      # loads PRETTY_NAME and friends as variables
  os="$PRETTY_NAME"
else
  os="unknown"
fi
echo "Host:     $(hostname)"
echo "OS:       $os"
echo "Kernel:   $(uname -r)"
echo "Uptime:   $(uptime -p 2&gt;/dev/null || echo 'n/a')"
# The first three numbers in /proc/loadavg are the 1, 5 and 15 minute load averages
if [ -r /proc/loadavg ]; then
  read -r load1 load5 load15 _ &lt; /proc/loadavg
  echo "Load:     $load1 $load5 $load15  (on $(nproc) CPUs)"
fi
section "Memory"
free -h 2&gt;/dev/null || echo "free is not available here"
section "Disk (/)"
df -h /
section "Top 5 processes by memory"
ps -eo pid,comm,%mem --sort=-%mem | head -n 6      # header line + 5 processes
</code></pre>
