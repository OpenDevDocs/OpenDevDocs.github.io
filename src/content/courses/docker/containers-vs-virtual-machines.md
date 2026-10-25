---
publishDate: 2026-10-25T14:05
title: 'Containers vs Virtual Machines'
slug: containers-vs-virtual-machines
metadescription: 'Understand how containers differ from virtual machines, why containers are lighter and faster, and when a virtual machine is still the better choice.'
updateDate: 2026-10-25T14:05
author: ['bishal-biswas']
level: 1
tags: ['docker', 'containers', 'virtual-machines', 'linux']
course: docker
---

## Two ways to isolate software

In [What is Docker and Why Use It?](/courses/docker/what-is-docker) you learned that a container runs an app in its own separate space. But there is an older way to do this: the **virtual machine** (VM). Both keep apps apart from each other. They do it in very different ways.

In this lesson you will learn:

- what a virtual machine is
- what a container really is, under the hood
- why containers start faster and use less memory
- when to choose a container and when to choose a VM
- why Docker on Windows and macOS still uses a small VM

## What is a virtual machine?

A **virtual machine** is a whole computer made of software. It runs on top of your real computer.

A program called a **hypervisor** (for example VirtualBox, VMware, Hyper-V or KVM) pretends to be hardware. It gives each VM a fake CPU, fake memory, a fake disk and a fake network card. Inside the VM you install a **full operating system**, with its own **kernel** (the core part of the operating system that manages the CPU, memory and devices).

Think of a VM as a **separate house**. It has its own walls, its own plumbing, its own electricity meter. Nothing is shared with the neighbors.

```text
+-----------+ +-----------+ +-----------+
|   App A   | |   App B   | |   App C   |
| Libraries | | Libraries | | Libraries |
| Guest OS  | | Guest OS  | | Guest OS  |
| (kernel)  | | (kernel)  | | (kernel)  |
+-----------+ +-----------+ +-----------+
|               Hypervisor              |
+---------------------------------------+
|           Host operating system       |
+---------------------------------------+
|               Hardware                |
+---------------------------------------+
```

Every VM carries a full operating system. That means gigabytes of disk, hundreds of megabytes of memory, and a boot time of tens of seconds or minutes.

## What is a container?

A **container** is a normal process on your computer that the kernel keeps **isolated**. It does not have its own kernel. All containers on a machine **share the host's kernel**.

Think of containers as **flats in one apartment building**. Each flat has its own door, its own rooms and its own lock. But they share the building's foundation, water pipes and electricity. Building a new flat is much cheaper than building a new house.

```text
+-----------+ +-----------+ +-----------+
|   App A   | |   App B   | |   App C   |
| Libraries | | Libraries | | Libraries |
+-----------+ +-----------+ +-----------+
|      Container engine (Docker)        |
+---------------------------------------+
|   Host operating system (one kernel)  |
+---------------------------------------+
|               Hardware                |
+---------------------------------------+
```

There is no guest operating system. Each container only carries the app and the files it needs.

### How the kernel isolates a container

Linux has two built-in features that make containers possible. You do not need to use them directly, because Docker does it for you, but it helps to know their names.

- **Namespaces** control what a process can **see**. A container gets its own view of process IDs, the network, the file system, the hostname and users. Inside the container, your app thinks it is process number 1 and the only thing running.
- **Control groups** (often called **cgroups**) control what a process can **use**. They limit CPU, memory and other resources, so one container cannot eat all the memory of the machine. You will use them in [Restart Policies and Resource Limits](/courses/docker/restart-policies-and-resource-limits).

A container also gets its own **file system**, built from the layers of an image. You will learn about layers in [Images and Layers Explained](/courses/docker/images-and-layers).

## See it for yourself

You will install Docker in [Installing Docker on Windows, macOS and Linux](/courses/docker/installing-docker). After that, come back and try these commands. They show that a container is just an isolated process.

Start a container that sleeps for one hour:

```bash
docker run -d --name sleeper alpine:3.22 sleep 3600
```

Look at the processes **inside** the container:

```bash
docker exec sleeper ps
```

```text
PID   USER     TIME  COMMAND
    1 root      0:00 sleep 3600
    7 root      0:00 ps
```

Inside, `sleep` is process number 1, and there is nothing else. That is the **PID namespace** at work.

Now check the kernel version inside the container and on the host (on Linux):

```bash
docker exec sleeper uname -r
uname -r
```

```text
6.8.0-45-generic
6.8.0-45-generic
```

Both lines are the same. The container uses the **host's kernel**. A VM would show its own kernel version. (On Windows or macOS you will see the kernel of Docker Desktop's small Linux VM, not your main system.)

Clean up:

```bash
docker rm -f sleeper
```

## Side by side

| | Virtual machine | Container |
|---|---|---|
| What it runs | A full operating system with its own kernel | One app (process) using the host kernel |
| Size on disk | Usually several GB | Often 5 MB to a few hundred MB |
| Start time | Tens of seconds to minutes | Usually under one second |
| Memory overhead | High (a whole OS per VM) | Low (just the app) |
| How many per server | A few to dozens | Dozens to hundreds |
| Isolation strength | Very strong (separate kernel) | Good, but the kernel is shared |
| Run a different OS | Yes (Windows VM on a Linux host) | No, Linux containers need a Linux kernel |
| Typical tools | VirtualBox, VMware, Hyper-V, KVM | Docker, Podman, containerd |

## Why containers are so fast

When you start a VM, the hypervisor must create virtual hardware, load a kernel, boot an operating system and start its services. Only then does your app start.

When you start a container, Docker asks the kernel to create a few namespaces and cgroups, prepares the file system, and runs your program. There is nothing to boot. This is why `docker run` feels almost instant.

The same is true for size. An `alpine:3.22` image is around 8 MB. A minimal Ubuntu Server VM disk is several gigabytes.

## When a virtual machine is the better choice

Containers are not always the answer. Choose a VM when:

- **You need a different operating system kernel.** For example, running a Windows app on a Linux server, or testing a different Linux kernel version.
- **You need very strong isolation.** If you run code from people you do not trust (for example, a hosting company running customer workloads), a VM boundary is much stronger than a shared kernel.
- **You need a full machine.** Some software expects to manage the whole system, load kernel modules or run many system services.

> **Note:** In practice, containers and VMs are used **together**. Most cloud servers are VMs, and Docker runs containers inside those VMs. You get the strong isolation of a VM between customers and the speed of containers inside it.

## Docker on Windows and macOS

Linux containers need a Linux kernel. Windows and macOS do not have one. So how does Docker Desktop work there?

Docker Desktop quietly runs a **small, lightweight Linux VM** for you:

- On **Windows**, it uses **WSL 2** (Windows Subsystem for Linux, version 2), which is a real Linux kernel managed by Windows.
- On **macOS**, it uses Apple's built-in virtualization framework.

All your containers run inside that one hidden VM. You do not manage it yourself. From your terminal, `docker` commands feel exactly like on Linux.

```text
Your Windows or macOS computer
+------------------------------------------+
|  Terminal: docker run ...                |
|        |                                 |
|        v                                 |
|  +------------------------------------+  |
|  | Small Linux VM (WSL 2 / Apple VM)  |  |
|  |   Docker Engine                    |  |
|  |   [container] [container] [ ... ]  |  |
|  +------------------------------------+  |
+------------------------------------------+
```

> **Tip:** This is why file sharing between Windows or macOS and a container can be slower than on Linux. Files must cross from your main system into the Linux VM. You will see how to handle this in [Bind Mounts: Sharing Folders with a Container](/courses/docker/bind-mounts).

## Containers and security

Because all containers share one kernel, a serious bug in the kernel could, in theory, let a process escape its container. This is rare, but it is the reason security matters:

- keep the host and Docker updated
- do not run apps as **root** inside containers when you can avoid it
- do not give containers more permissions than they need

You will learn these habits in [Running Containers as a Non-Root User](/courses/docker/running-as-non-root) and [Container Security Best Practices](/courses/docker/container-security-best-practices).

## Common mistakes

### "A container is a small VM, so I should install SSH in it"

You do not need SSH to get into a container. Use `docker exec` to run a command inside it, as you did above. Treat a container like a process, not like a server.

### "I can run a Windows app in a Linux container"

No. A Linux container needs a Linux kernel and runs Linux programs. (Windows containers do exist, but they need a Windows host and are a separate topic.)

### "Containers replace VMs completely"

They solve different problems. Many teams run containers on top of VMs in the cloud. Use the right tool for each job.

## Quick recap

- A **VM** is a full computer in software, with its own kernel, managed by a **hypervisor**.
- A **container** is an isolated process that **shares the host kernel**.
- Linux **namespaces** control what a container can see; **cgroups** control what it can use.
- Containers are smaller and start much faster; VMs give stronger isolation and can run any OS.
- Docker Desktop on Windows (WSL 2) and macOS runs containers inside a small hidden Linux VM.
- In the real world, containers often run inside VMs.

Next, you will look at the parts that make Docker work in [How Docker Works: Engine, Client, Images and Registries](/courses/docker/docker-architecture).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# Containers vs VMs: commands that show a container is just an isolated process.
# Run them after you install Docker.
#
# 1. Start a small Alpine container that sleeps for one hour, in the background
docker run -d --name sleeper alpine:3.22 sleep 3600
#
# 2. List processes INSIDE the container: sleep is PID 1 (PID namespace)
docker exec sleeper ps
#
# 3. The hostname inside is the container ID, not your computer's name (UTS namespace)
docker exec sleeper hostname
#
# 4. Compare kernel versions: on Linux both lines match (shared kernel)
docker exec sleeper uname -r
uname -r
#
# 5. See the same sleep process from the host side, with a different PID
docker top sleeper
#
# 6. Show live CPU and memory use (cgroups measure this). Press Ctrl+C to exit
docker stats sleeper
#
# 7. Start a container with a 64 MB memory limit (cgroups enforce this)
docker run --rm --memory 64m alpine:3.22 cat /sys/fs/cgroup/memory.max
#
# 8. Clean up: stop and remove the container in one step
docker rm -f sleeper
</code></pre>
