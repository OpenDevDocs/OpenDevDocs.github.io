---
publishDate: 2026-10-25T11:40
title: Containers vs Virtual Machines
slug: containers-vs-virtual-machines
metadescription: Learn what virtual machines and containers are, how containers share the host kernel using namespaces and cgroups, images vs containers, and when to use each, with a hands-on comparison script.
updateDate: 2026-10-25T11:40
author: ['bishal-biswas']
level: 1
tags: ['devops', 'containers', 'virtual-machines', 'docker']
course: devops
---

## "It works on my machine"

Every developer has said it. The app runs perfectly on your laptop and crashes on the server. The usual reasons:

- the server has a different version of Node.js, Python or Java;
- a system library is missing, or a different version;
- an environment variable or config file exists on your laptop but not on the server;
- the operating system is different altogether.

The fix is to ship not just your code, but **the environment it needs to run**, packed together so it behaves the same everywhere. There are two main ways to do that: **virtual machines** and **containers**. This lesson explains both, and why containers have become the standard way to package applications.

## Virtual machines

A **virtual machine** (VM) is a complete computer simulated in software. It has its own virtual CPU, memory, disk and network card, and runs its own **full operating system**, kernel and all.

The software that creates and runs VMs is called a **hypervisor**:

- **Type 1** hypervisors run directly on the hardware. Cloud providers use these: when you rent a server on AWS, Azure or Google Cloud, you get a VM. Examples are KVM, Xen, VMware ESXi and Microsoft Hyper-V.
- **Type 2** hypervisors run as an app on your normal operating system, such as VirtualBox or VMware Workstation.

```text
+----------------+ +----------------+ +----------------+
|  App A         | |  App B         | |  App C         |
|  Libraries     | |  Libraries     | |  Libraries     |
|  Guest OS      | |  Guest OS      | |  Guest OS      |
|  (own kernel)  | |  (own kernel)  | |  (own kernel)  |
+----------------+ +----------------+ +----------------+
|                     Hypervisor                       |
+------------------------------------------------------+
|                     Hardware                         |
+------------------------------------------------------+
```

VMs give **strong isolation**: each one is a separate computer as far as the software inside can tell. But every VM carries a whole operating system, so each one is gigabytes in size, takes up to a minute or more to boot, and uses memory just to run its own kernel and services.

## Containers

A **container** is a much lighter idea. Instead of simulating a whole computer, it runs your app as a normal process on the host, but gives that process its **own private view** of the system: its own files, its own network, its own list of processes. Every container on a machine **shares the host's kernel**.

```text
+----------------+ +----------------+ +----------------+
|  App A         | |  App B         | |  App C         |
|  Libraries     | |  Libraries     | |  Libraries     |
+----------------+ +----------------+ +----------------+
|            Container runtime (e.g. Docker)           |
+------------------------------------------------------+
|        Host operating system  (ONE shared kernel)    |
+------------------------------------------------------+
|                     Hardware                         |
+------------------------------------------------------+
```

Because there is no separate operating system to boot, a container starts in **well under a second**, its image is often **tens of megabytes**, and one server can run dozens or hundreds of them.

Think of the difference like housing. VMs are **separate houses**, each with its own foundations, plumbing and electricity. Containers are **flats in one building**: each has its own front door and private rooms, but they share the foundations and the main water and power supply.

### How containers work: namespaces and cgroups

Containers are not magic. They are built from two features of the **Linux kernel** you met in [Linux for DevOps](/courses/devops/linux-for-devops):

| Feature | What it does | Example |
|---|---|---|
| **Namespaces** | Control what a process can **see** | The container has its own process list (its app is PID 1), its own hostname, its own network interfaces and its own file system |
| **cgroups** (control groups) | Control what a process can **use** | "This container may use at most 256 MB of memory and half a CPU" |

A container is simply a process (or a few) running inside its own set of namespaces, limited by cgroups, with a file system that comes from an **image**.

> **Note:** Because containers share the host's Linux kernel, Linux containers need a Linux kernel. On Windows and macOS, **Docker Desktop** quietly runs a small Linux virtual machine and runs your containers inside it. That is why containers "just work" on your laptop even though it is not running Linux.

## Images and containers

Two words you must not mix up:

- An **image** is a read-only **template**: a packaged file system containing your app, its runtime, its libraries and some settings such as "run `node dist/server.js` on start". You build it once and store it in a registry.
- A **container** is a **running instance** of an image. You can start many containers from one image, just as you can bake many cakes from one recipe.

| | Image | Container |
|---|---|---|
| What it is | A template on disk | A running (or stopped) process |
| Changes? | Never: images are immutable | Has its own thin writable layer, thrown away when the container is removed |
| Like | A recipe, or a class in programming | A dish, or an object created from the class |

Images are built in **layers**. Each step of the build adds a layer on top of the previous ones, and identical layers are shared between images and cached. If ten images all start from the same `node:24-alpine` base, the base is downloaded and stored only once. You will see how this makes builds fast in [Docker Essentials](/courses/devops/docker-essentials).

That immutability ties straight back to [Build Artifacts and Versioning](/courses/devops/build-artifacts-and-versioning): a container image is the perfect **build-once** artifact. The exact image that passed your tests is the one that runs in staging and production.

## Side by side

| | Virtual machine | Container |
|---|---|---|
| Contains | A full operating system plus the app | The app plus its libraries only |
| Kernel | Its own | Shares the host's |
| Typical size | Gigabytes | Megabytes to a few hundred MB |
| Start-up time | Tens of seconds to minutes | Milliseconds to seconds |
| How many per server | A handful to dozens | Dozens to hundreds |
| Isolation | Strong: separate kernels | Good, but weaker: one shared kernel |
| Can run a different OS | Yes: Windows on a Linux host, for example | No: Linux containers need a Linux kernel |
| Best for | Different operating systems, strong isolation, whole servers | Packaging and running apps, microservices, CI jobs |

## They work together

It is not really "containers **or** VMs". In practice you almost always use **both**: your cloud provider gives you **VMs**, and you run **containers** on those VMs. Kubernetes nodes are usually VMs full of containers. GitHub Actions runs each job in a fresh VM, and that job often starts containers for databases, as you saw in [Automated Testing in the Pipeline](/courses/devops/testing-in-the-pipeline).

When the isolation of a shared kernel is not enough, for example when running untrusted code from many customers, there are in-between options: **microVMs** such as Firecracker (which powers AWS Lambda) give each workload its own tiny kernel while starting almost as fast as a container.

## A short history

| Year | Milestone |
|---|---|
| 1979 | Unix `chroot` gives a process its own view of the file system: the earliest seed |
| 2000 | FreeBSD **jails** isolate processes much more fully |
| 2006–2008 | **cgroups** and namespaces arrive in Linux; **LXC** combines them into Linux containers |
| 2013 | **Docker** makes containers easy: a simple command line, images and a public registry |
| 2014 | Google announces **Kubernetes**, to run containers across many machines |
| 2015 | The **Open Container Initiative** (OCI) sets open standards for images and runtimes |

Thanks to the OCI standards, an image built with Docker runs on Podman, containerd, Kubernetes and every major cloud. Under the hood, Docker itself uses **containerd** and **runc**, the same low-level runtime pieces Kubernetes uses.

## Seeing the difference yourself

The code panel for this lesson has a small Bash script that reports what a process can see: hostname, operating system files, kernel, PID 1, number of processes, memory limit, and whether it thinks it is in a container. Run it on a Linux machine (or in WSL 2), then run the **same script** inside a Debian container with a 256 MB memory limit:

```bash
bash where-am-i.sh
docker run --rm --memory 256m -v "$PWD:/demo" debian:13 bash /demo/where-am-i.sh
```

`-v "$PWD:/demo"` shares your current folder with the container, so it can see the script. On an Ubuntu server you will see something like:

```text
Hostname:      web-01
OS files:      Ubuntu 24.04.3 LTS
Kernel:        6.8.0-85-generic
PID 1:         systemd
Processes:     184
Memory limit:  none
Verdict:       not in a container (as far as we can tell)
```

And inside the container:

```text
Hostname:      3f9c2a7d1b4e
OS files:      Debian GNU/Linux 13 (trixie)
Kernel:        6.8.0-85-generic
PID 1:         bash
Processes:     3
Memory limit:  256 MB
Verdict:       inside a container
```

Every line tells part of the story:

- **Hostname** and **PID 1** are different: the container has its own UTS and PID **namespaces**. Its first process is our `bash`, not the host's `systemd`, and it can only see a handful of processes.
- **OS files** say Debian, because the file system comes from the `debian:13` **image**.
- **Kernel** is **identical**: the container is using the host's kernel. This is the line that proves a container is not a virtual machine.
- **Memory limit** is 256 MB, enforced by a **cgroup**.

## Common misunderstandings

### "A container is a lightweight VM"

It is a convenient way to explain it, but it is not true. A container is an isolated **process** on the host's kernel. That is why it starts instantly, and also why its isolation is weaker than a VM's.

### "Containers are completely secure boxes"

They are a good isolation layer, not a perfect one. A kernel vulnerability can affect every container on a host. Run containers as a **non-root** user, keep hosts patched, and do not run untrusted code next to sensitive workloads. More in [DevSecOps](/courses/devops/devsecops-basics).

### "Docker and containers are the same thing"

Docker is the tool that made containers popular, and it is still the most common way to build and run them on a laptop. But containers are a Linux feature plus open OCI standards. Podman, containerd and Kubernetes all run the same images without Docker.

## Quick recap

- **Virtual machines** simulate a whole computer and run a full OS with its own kernel, using a **hypervisor**.
- **Containers** are isolated processes that **share the host's kernel**, using **namespaces** (what they see) and **cgroups** (what they use).
- An **image** is an immutable, layered template; a **container** is a running instance of it.
- Containers are smaller and faster; VMs isolate more strongly and can run other operating systems.
- In practice you use both: **containers running on cloud VMs**.
- OCI standards mean images run anywhere: Docker, Podman, containerd, Kubernetes.

Next, you will build and run your own image in [Docker Essentials: Images, Containers and Dockerfiles](/courses/devops/docker-essentials).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# where-am-i.sh: am I on a normal machine, or inside a container?
# Run it on a Linux machine, then inside a container, and compare the answers:
#   bash where-am-i.sh
#   docker run --rm --memory 256m -v "$PWD:/demo" debian:13 bash /demo/where-am-i.sh
os=$(. /etc/os-release 2&gt;/dev/null &amp;&amp; echo "$PRETTY_NAME")
mem=$(cat /sys/fs/cgroup/memory.max 2&gt;/dev/null)          # cgroup v2 memory limit
case "$mem" in
  ''|max) mem="none" ;;
  *)      mem="$((mem / 1024 / 1024)) MB" ;;
esac
echo "Hostname:      $(hostname)"
echo "OS files:      ${os:-unknown}"                       # from the image (or the host)
echo "Kernel:        $(uname -r)"                          # always the HOST's kernel
echo "PID 1:         $(cat /proc/1/comm 2&gt;/dev/null || echo unknown)"
echo "Processes:     $(ls -d /proc/[0-9]* 2&gt;/dev/null | wc -l)"
echo "Memory limit:  $mem"
if [ -f /.dockerenv ] || [ -f /run/.containerenv ]; then
  echo "Verdict:       inside a container"
else
  echo "Verdict:       not in a container (as far as we can tell)"
fi
</code></pre>
