---
publishDate: 2026-10-25T10:20
title: The DevOps Roadmap and Toolchain
slug: devops-roadmap-and-toolchain
metadescription: See the DevOps learning roadmap from Linux and Git to CI/CD, containers, Kubernetes and Infrastructure as Code, the main tool in each category and what to install for this course.
updateDate: 2026-10-25T10:20
author: ['bishal-biswas']
level: 1
tags: ['devops', 'basics', 'roadmap', 'tools']
course: devops
---

## Why you need a map

Search for "DevOps tools" and you will find charts with hundreds of logos. It is easy to feel you must learn all of them before you can start. You do not.

DevOps tools fall into a small number of **categories**, and each category solves one problem in the [delivery lifecycle](/courses/devops/software-delivery-lifecycle). Learn what each category is for, get comfortable with one popular tool in it, and you can pick up the others when a job needs them.

This lesson gives you two things:

- a **roadmap**: a sensible order to learn things in, so each step builds on the last;
- a **toolchain**: the main categories of tools, with the most common choices in each.

## The roadmap

Here is the order this course follows. Each step uses skills from the steps before it.

| Step | Skill | Why it comes here | In this course |
|---|---|---|---|
| 1 | **Linux and the shell** | Almost every server, container and pipeline runs Linux. | [Linux for DevOps](/courses/devops/linux-for-devops) |
| 2 | **Git** | Everything in DevOps, even servers, lives in version control. | [Version Control with Git](/courses/devops/version-control-with-git) |
| 3 | **Networking** | Every deployment involves IPs, ports, DNS and HTTPS. | [IP Addresses, Ports and Protocols](/courses/devops/ip-addresses-ports-and-protocols) |
| 4 | **CI/CD** | Automates build, test and deploy. The heart of DevOps. | [Continuous Integration Explained](/courses/devops/continuous-integration) |
| 5 | **Containers** | Package an app so it runs the same everywhere. | [Containers vs Virtual Machines](/courses/devops/containers-vs-virtual-machines) |
| 6 | **Kubernetes** | Runs many containers across many machines. | [Why Kubernetes?](/courses/devops/why-kubernetes) |
| 7 | **Cloud and Infrastructure as Code** | Create servers and networks from code, not by clicking. | [Cloud Computing Basics](/courses/devops/cloud-computing-basics) |
| 8 | **Observability** | See what your running system is doing. | [Monitoring, Logging and Alerting](/courses/devops/monitoring-logging-and-alerting) |
| 9 | **Security** | Build safety into every step above. | [DevSecOps](/courses/devops/devsecops-basics) |

The course ends with a [capstone project](/courses/devops/capstone-commit-to-production) that ties every step together: you take an app from a single commit all the way to production.

> **Note:** This is a **fundamentals** course. Each topic gets one or a few lessons that teach the core ideas and get you hands-on. Four of the biggest topics, **Linux and Shell**, **Git and GitHub**, **Docker** and **Kubernetes**, will each get their own full OpenDevDocs course that goes much deeper. They are coming soon, and the lessons here will point to them as they arrive.

### What about programming?

You do not need to be an expert programmer for DevOps, but you do need to be comfortable reading and writing **scripts**. This course uses mostly **Bash** (the Linux shell language) and **YAML** (the format most pipeline and Kubernetes files use), plus a little JavaScript.

Many DevOps engineers also learn **Python** or **Go** for bigger automation jobs. That can wait until after this course.

## The toolchain, category by category

For each category, the first tool listed is a good one to learn first. You will use most of them in this course.

### Version control and collaboration

Stores every change to code and configuration, and lets the team review each other's work.

- **Git**, the version control system almost everyone uses.
- **GitHub**, **GitLab** and **Bitbucket**, websites that host Git projects and add reviews, issues and automation.

### CI/CD (continuous integration and delivery)

Builds, tests and deploys code automatically whenever it changes.

- **GitHub Actions**, built into GitHub and used in this course.
- **GitLab CI/CD**, built into GitLab.
- **Jenkins**, the long-standing, self-hosted option you will still find in many companies.
- **Azure Pipelines**, **CircleCI** and others.

### Containers

Package an application with everything it needs to run, so it behaves the same on a laptop, a test server and production.

- **Docker**, by far the most common way to build and run containers.
- **Podman**, a popular Docker-compatible alternative.
- **Container registries** such as **Docker Hub** and **GitHub Container Registry**, which store the images you build.

### Container orchestration

Runs, scales and heals many containers across a group of machines.

- **Kubernetes** (often written **K8s**), the industry standard.
- Managed Kubernetes from cloud providers: **Amazon EKS**, **Azure AKS** and **Google GKE**.
- **Helm**, which packages Kubernetes apps so they are easy to install.

### Cloud platforms

Rent servers, databases, storage and networks by the hour instead of buying hardware.

- **AWS** (Amazon Web Services), **Microsoft Azure** and **Google Cloud** are the big three.
- **DigitalOcean**, **Hetzner** and similar providers offer simpler, cheaper servers, great for learning.

### Infrastructure as Code (IaC)

Describe servers, networks and cloud resources in files, then let a tool create them.

- **Terraform**, the most widely used IaC tool. Its open-source fork, **OpenTofu**, works almost the same way.
- **Pulumi**, which lets you write infrastructure in normal programming languages.
- Cloud-specific tools such as **AWS CloudFormation** and **Azure Bicep**.

### Configuration management

Installs software and applies settings on existing servers, the same way every time.

- **Ansible**, simple and agentless (it connects over SSH, so nothing needs installing on the servers).
- **Chef** and **Puppet**, older tools still found in larger companies.

### Observability: monitoring, logging and tracing

Shows what your system is doing and warns you when something goes wrong.

- **Prometheus** collects **metrics** (numbers over time, such as requests per second).
- **Grafana** turns them into dashboards.
- **Loki** or the **Elastic Stack** (Elasticsearch and Kibana) store and search **logs**.
- **OpenTelemetry** is the open standard for collecting all of this, including **traces** that follow one request through many services.

### Security (DevSecOps)

Finds problems in code, dependencies and images before attackers do.

- **Dependabot** or **Renovate** keep dependencies up to date.
- **Trivy** scans container images and code for known vulnerabilities.
- **Secrets managers** such as **HashiCorp Vault**, **AWS Secrets Manager** and **Azure Key Vault** keep passwords and keys out of your code.

## How to choose tools

When you start a real project, these rules of thumb help:

- **Learn the idea, not just the tool.** If you understand what CI does, moving from GitHub Actions to GitLab CI takes an afternoon.
- **Prefer what your team already uses.** A good-enough tool everyone knows beats a perfect tool nobody knows.
- **Prefer open standards.** Containers (the OCI standard), Kubernetes and OpenTelemetry work across many vendors, so you are less locked in.
- **Choose boring technology.** Popular, mature tools have better documentation, more answers online and fewer surprises.
- **Add tools only for real problems.** A three-person team with one website probably does not need Kubernetes yet. You will learn when it does in [Why Kubernetes?](/courses/devops/why-kubernetes).

## Setting up for this course

You will need the following. Each lesson that uses a tool explains how to install it, so you do not need everything today.

| What | Why | Notes |
|---|---|---|
| A **terminal** with Bash | Running commands and scripts | Built into Linux and macOS. On Windows, install **WSL 2** (Windows Subsystem for Linux) to get a real Ubuntu terminal. |
| **Git** | Version control | Comes with most Linux distributions and macOS developer tools. |
| A **GitHub account** | Hosting code and running GitHub Actions | The free plan is enough for the whole course. |
| A **code editor** | Writing code and config | **VS Code** is free and has good extensions for YAML, Docker and Terraform. |
| **Docker** | Containers | **Docker Desktop** on Windows and macOS, **Docker Engine** on Linux. Needed from the Containers section. |
| **Node.js** | Running the small JavaScript examples | The current LTS version. Optional until the CI/CD section. |

> **Tip:** If you are on Windows, do the whole course inside WSL 2. Servers run Linux, so learning on Linux from day one saves you from translating every command later.

## Check your toolchain

The code panel for this lesson has a Bash script that checks which of these tools are already installed and prints their versions. Save it as `check-toolchain.sh` and run:

```bash
bash check-toolchain.sh
```

On a fresh laptop with only Git and Node.js installed, you might see:

```text
DevOps toolchain check

  [ok]      git        git version 2.51.0
  [ok]      bash       GNU bash, version 5.2.21(1)-release (x86_64-pc-linux-gnu)
  [ok]      ssh        OpenSSH_9.6p1 Ubuntu-3ubuntu13, OpenSSL 3.0.13 30 Jan 2024
  [ok]      curl       curl 8.5.0 (x86_64-pc-linux-gnu) libcurl/8.5.0
  [missing] docker
  [missing] kubectl
  [missing] terraform
  [ok]      node       v24.12.0

3 tools missing. That is fine: each lesson shows you how to install what it needs.
```

Run it again at the end of the course. Every line should say `[ok]`.

## Common misunderstandings

### "I need to learn every tool on the chart"

Nobody knows them all. Employers look for strong fundamentals plus hands-on experience with one tool per category. The rest you learn on the job.

### "Kubernetes is the first thing to learn"

Kubernetes is built on top of Linux, networking and containers. Jumping straight to it is like learning to fly before you can drive. That is why it comes after those steps in the roadmap.

### "DevOps means learning tools instead of coding"

DevOps work is full of code: shell scripts, pipeline files, Dockerfiles, Terraform files. It is a different kind of code from application features, but you will write a lot of it.

## Quick recap

- DevOps tools fall into a handful of **categories**; learn one main tool in each.
- The roadmap: **Linux, Git, networking, CI/CD, containers, Kubernetes, cloud and IaC, observability, security**.
- Good first picks: **Git and GitHub**, **GitHub Actions**, **Docker**, **Kubernetes**, **Terraform**, **Prometheus and Grafana**.
- Choose tools by the problem, the team and open standards, not by hype.
- For this course you need a Bash terminal (WSL 2 on Windows), Git, a GitHub account and an editor, plus Docker later on.

That completes **Getting Started**. In the next section you will start on the ground floor of the roadmap with [Linux for DevOps: Why Servers Run Linux](/courses/devops/linux-for-devops).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# check-toolchain.sh: which DevOps tools are installed on this machine?
# Run it with: bash check-toolchain.sh
tools=(git bash ssh curl docker kubectl terraform node)
# Most tools print their version with --version, but a few are different.
version_of() {
  case "$1" in
    ssh)     ssh -V 2&gt;&amp;1 ;;                          # ssh prints its version to stderr
    kubectl) kubectl version --client 2&gt;/dev/null ;;
    *)       "$1" --version 2&gt;/dev/null ;;
  esac | head -n 1
}
echo "DevOps toolchain check"
echo
missing=0
for tool in "${tools[@]}"; do
  if command -v "$tool" &gt;/dev/null 2&gt;&amp;1; then        # is it on the PATH?
    printf '  [ok]      %-10s %s\n' "$tool" "$(version_of "$tool")"
  else
    printf '  [missing] %s\n' "$tool"
    missing=$((missing + 1))
  fi
done
echo
if [ "$missing" -eq 0 ]; then
  echo "Everything is installed. You are ready for the whole course."
else
  echo "$missing tools missing. That is fine: each lesson shows you how to install what it needs."
fi
</code></pre>
