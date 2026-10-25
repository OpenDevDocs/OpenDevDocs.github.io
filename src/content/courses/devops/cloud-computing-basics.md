---
publishDate: 2026-10-25T12:00
title: 'Cloud Computing Basics: IaaS, PaaS and SaaS'
slug: cloud-computing-basics
metadescription: Learn what cloud computing is, the IaaS, PaaS, SaaS and serverless service models, regions and availability zones, the core building blocks of AWS, Azure and Google Cloud, shared responsibility, IAM and keeping costs under control.
updateDate: 2026-10-25T12:00
author: ['bishal-biswas']
level: 1
tags: ['devops', 'cloud', 'aws', 'azure', 'iaas']
course: devops
---

## Renting instead of buying

Not long ago, launching a website meant **buying servers**: ordering hardware, waiting weeks for delivery, installing it in a data centre, and guessing how much capacity you would need for the next three years. Guess too low and the site falls over on launch day. Guess too high and expensive machines sit idle.

**Cloud computing** changed that. Instead of buying computers, you **rent** them, along with storage, databases, networks and hundreds of other services, over the internet, from a provider who runs huge data centres. You get them in minutes, pay only for what you use, and hand them back when you are done.

It is like electricity. Hardly anyone runs a power station at home: you plug in and pay for what you use. The cloud does the same for computing.

## What makes it "cloud"

A widely used definition from the US standards body NIST lists five essential characteristics:

| Characteristic | Meaning | Example |
|---|---|---|
| **On-demand self-service** | You create resources yourself, instantly, with no human to ask | Click "create server", or run one command |
| **Broad network access** | Everything is reached over the network | Manage it all from a browser, CLI or code |
| **Resource pooling** | The provider shares huge pools of hardware between many customers | Your VM runs on a machine you never see |
| **Rapid elasticity** | Scale up and down quickly, often automatically | 2 servers at night, 20 during a sale |
| **Measured service** | You pay for what you use, measured precisely | Billed per second of server time and per GB stored |

## Service models: how much do you manage?

Cloud services differ in **how much the provider does for you**. A classic way to picture it is a pizza night:

- **Make it at home:** you buy every ingredient, own the oven and do all the work. That is running your **own data centre**.
- **Take-and-bake:** someone else made the pizza; you bake it in your oven. That is **IaaS**.
- **Delivery:** it arrives cooked; you provide the table and drinks. That is **PaaS**.
- **Eat at a restaurant:** you just turn up and eat. That is **SaaS**.

In computing terms:

| Layer | Own data centre | IaaS | PaaS | SaaS |
|---|---|---|---|---|
| Your application and data | You | You | You | Provider (you manage your data and users) |
| Runtime (Node.js, Java...) | You | You | **Provider** | Provider |
| Operating system | You | You | Provider | Provider |
| Virtual machines | You | **Provider** | Provider | Provider |
| Servers, storage, network | You | Provider | Provider | Provider |
| Buildings, power, cooling | You | Provider | Provider | Provider |

- **IaaS** (Infrastructure as a Service): you rent virtual machines, disks and networks, and manage everything from the operating system up. Most flexible, most work. Examples: Amazon EC2, Azure Virtual Machines, Google Compute Engine, DigitalOcean Droplets.
- **PaaS** (Platform as a Service): you hand over your code or container, and the platform runs it, scales it and patches the servers underneath. Examples: Azure App Service, Google App Engine, Heroku, and managed databases such as Amazon RDS.
- **SaaS** (Software as a Service): finished software you just use. Examples: Gmail, Microsoft 365, Slack, GitHub itself.

Two newer models sit between these:

- **Containers as a Service** runs your [container images](/courses/devops/docker-essentials) without you managing servers: Google Cloud Run, Azure Container Apps, AWS ECS with Fargate, and managed Kubernetes such as EKS, AKS and GKE.
- **Serverless functions** (FaaS) run small pieces of code in response to events, such as an HTTP request or a file upload, and charge per call: AWS Lambda, Azure Functions, Google Cloud Run functions. There are still servers, of course; you just never see them.

> **Tip:** As a rule of thumb, choose the **highest** level that does what you need. Every layer the provider manages is a layer you do not have to patch, monitor and wake up for.

## Deployment models

| Model | Meaning |
|---|---|
| **Public cloud** | Shared provider infrastructure, used by many customers: AWS, Azure, Google Cloud |
| **Private cloud** | Cloud-style self-service on infrastructure used by one organisation only, often in its own data centre |
| **Hybrid cloud** | A mix of the two, connected together: for example, sensitive data on-premises and websites in the public cloud |
| **Multi-cloud** | Using more than one public cloud provider |

## The big providers

| Provider | Launched | Known for |
|---|---|---|
| **Amazon Web Services (AWS)** | 2006 | The largest, with the widest range of services |
| **Microsoft Azure** | 2010 | Strong with companies already using Microsoft products |
| **Google Cloud** | 2008 (App Engine) | Data, analytics and Kubernetes (which began at Google) |

Many others serve particular needs well: **DigitalOcean**, **Hetzner**, **Linode (Akamai)** and **Vultr** for simple, affordable servers; **Oracle Cloud**; **Cloudflare** for edge services; and regional providers for data that must stay in one country.

The good news: the **concepts** are the same everywhere. Learn them once on one provider and the others are mostly new names for familiar things.

## Regions and availability zones

Cloud providers run data centres all over the world, organised in two levels:

- A **region** is a geographic area, such as Mumbai, Frankfurt or Virginia. Each region is independent.
- Each region contains several **availability zones** (AZs): separate data centres a few kilometres apart, with their own power, cooling and networking, linked by very fast connections.

```text
Region: ap-south-1 (Mumbai)
 ├── AZ ap-south-1a   [data centre(s)]
 ├── AZ ap-south-1b   [data centre(s)]
 └── AZ ap-south-1c   [data centre(s)]
```

How to use them:

- **Pick a region** close to your users (lower [latency](/courses/devops/ip-addresses-ports-and-protocols)), where the law allows your data to be stored (**data residency**), and with the services and prices you need.
- **Spread across zones** for high availability: put your servers behind a [load balancer](/courses/devops/reverse-proxies-and-load-balancers) in two or three AZs, so a fire or power cut in one data centre does not take you offline.

Providers also have hundreds of smaller **edge locations** for content delivery networks (CDNs), which cache files close to users.

## The building blocks

Every major cloud offers the same core services under different names:

| Building block | AWS | Azure | Google Cloud |
|---|---|---|---|
| Virtual machines | EC2 | Virtual Machines | Compute Engine |
| Managed Kubernetes | EKS | AKS | GKE |
| Serverless containers | ECS on Fargate | Container Apps | Cloud Run |
| Functions | Lambda | Functions | Cloud Run functions |
| Object storage (files, backups) | S3 | Blob Storage | Cloud Storage |
| Block storage (VM disks) | EBS | Managed Disks | Persistent Disk |
| Managed relational databases | RDS | Azure Database for PostgreSQL / Azure SQL | Cloud SQL |
| Private networks | VPC | Virtual Network (VNet) | VPC |
| DNS | Route 53 | Azure DNS | Cloud DNS |
| Identity and access | IAM | Microsoft Entra ID + RBAC | IAM |
| Monitoring | CloudWatch | Azure Monitor | Cloud Monitoring |

### Private networks

When you create resources, they live inside a **virtual private network**: a VPC on AWS and Google Cloud, a VNet on Azure. You choose its address range with [CIDR notation](/courses/devops/ip-addresses-ports-and-protocols), such as `10.0.0.0/16`, and divide it into subnets:

```text
VPC 10.0.0.0/16
 ├── Public subnet   10.0.1.0/24   load balancers (reachable from the internet)
 └── Private subnet  10.0.2.0/24   app servers, databases (no direct internet access)
```

**Security groups** (AWS) or **network security groups** (Azure) are firewalls attached to resources: "allow port 443 from anywhere, port 5432 only from the app servers". Private resources reach the internet for updates through a **NAT gateway**, without being reachable from it.

## Shared responsibility

Security in the cloud is split between you and the provider. The provider is responsible for security **of** the cloud; you are responsible for security **in** the cloud:

| Provider secures | You secure |
|---|---|
| Data centre buildings and staff access | Who can log in to your account |
| Physical servers, storage and network | Your firewall rules and network design |
| The virtualisation layer | Your operating systems and patches (on IaaS) |
| Managed service internals | Your application, its data and its secrets |

Most cloud security incidents are not providers being hacked. They are customers leaving a storage bucket public, a database open to the internet, or an access key in a public Git repository.

## Identity and access (IAM)

**IAM** (Identity and Access Management) decides who can do what in your cloud account. A few rules to follow from day one:

- **Lock away the root account.** The email address you signed up with can do anything, including closing the account. Turn on **multi-factor authentication** (MFA) and use it only for rare account-level tasks.
- **Give each person their own login** with MFA, never a shared one.
- **Least privilege.** Grant only the permissions a person or program needs, as in [SSH, Users and Permissions](/courses/devops/ssh-users-and-permissions).
- **Prefer roles over long-lived keys.** Servers, functions and CI pipelines should get **temporary** credentials through roles, not access keys pasted into config files. You will see how in [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets).

## Costs: the cloud bill

Pay-as-you-go cuts both ways: you pay for what you use, and also for what you **forget**. A test server left running, an unattached disk, or a big database nobody turned off keeps billing every hour.

How cloud pricing usually works:

- **On-demand:** pay by the second or hour, no commitment. Most flexible, highest price.
- **Commitments** (reserved instances, savings plans): promise to use a certain amount for one or three years in exchange for a large discount.
- **Spot** or **preemptible** capacity: spare capacity at a deep discount, which the provider can take back at short notice. Great for batch jobs and CI runners, not for your main database.
- **Data transfer:** data coming **in** is usually free, but data going **out** to the internet, or between regions, is often charged. It surprises many people.

Habits that keep bills sane:

- Set a **budget with alerts** on day one.
- **Tag** every resource with its project and owner (the Terraform example in the next lesson does this automatically), so you can see what costs what.
- **Delete** test resources when you are done. Infrastructure as Code makes this one command.
- Right-size: most servers are bigger than they need to be.

The practice of managing cloud costs as a team sport between engineering and finance is called **FinOps**.

## Ways to work with the cloud

| Method | Good for | Problem |
|---|---|---|
| **Web console** (clicking) | Exploring, learning, looking at things | Not repeatable, not reviewed, easy to forget what you did |
| **Command-line tools**: `aws`, `az`, `gcloud` | Quick tasks and scripts | Scripts must handle "already exists" and partial failures |
| **Infrastructure as Code** | Everything that matters | A new tool to learn: the subject of the next lesson |

Creating production infrastructure by clicking is common enough to have a nickname, **ClickOps**, and it is what Infrastructure as Code replaces.

## Setting up a server automatically: cloud-init

When you create a cloud VM, it starts as a bare operating system. Almost every provider supports **cloud-init**, the standard tool that configures a Linux server on its **first boot** from a file you supply as **user data**.

The code panel for this lesson has a cloud-init file that does, automatically, what you did by hand in [SSH, Users and Permissions on a Server](/courses/devops/ssh-users-and-permissions):

- creates a `deploy` user with your SSH key and sudo rights;
- installs all updates, plus nginx, ufw and automatic security updates;
- writes the SSH hardening settings (no root login, keys only);
- opens SSH and web ports in the firewall and starts nginx.

To use it, replace the example key with the contents of your own `~/.ssh/id_ed25519.pub`, then paste the file into the **User data** (or **cloud-init**) box when creating an Ubuntu server in your provider's console. A minute after the server boots, you can log in:

```bash
ssh deploy@<server-ip>
curl -I http://<server-ip>        # nginx's welcome page
```

If something did not work, cloud-init keeps a log on the server at `/var/log/cloud-init-output.log`, and `cloud-init status --long` shows whether it finished.

> **Note:** The first line, `#cloud-config`, is required: it is how cloud-init recognises the file. And because user data is visible to anyone who can view the server's settings, never put passwords or private keys in it.

## Common misunderstandings

### "The cloud is just someone else's computer"

There is some truth in it, but it misses the point. The value is not the computer; it is the **self-service, elasticity and managed services** around it: a replicated database in five minutes, or capacity doubled in thirty seconds.

### "The cloud is always cheaper"

For spiky, growing or experimental workloads it often is. For large, steady, predictable workloads, owned hardware can be cheaper. Measure, and watch the bill.

### "The provider handles security"

Only its half. Open firewall rules, public storage, weak IAM and unpatched servers on IaaS are your responsibility.

## Quick recap

- **Cloud computing** means renting computing resources on demand and paying for what you use.
- Service models: **IaaS** (you manage the OS and up), **PaaS** (you manage the app), **SaaS** (you just use it), plus **containers as a service** and **serverless**.
- Providers are organised in **regions** and **availability zones**; spread across zones for availability.
- AWS, Azure and Google Cloud offer the same building blocks under different names: compute, storage, databases, networking, IAM.
- **Shared responsibility:** the provider secures the cloud; you secure what you put in it.
- Use **IAM** with MFA and least privilege, set **budgets**, **tag** everything, and delete what you do not use.
- **cloud-init** configures servers automatically on first boot.

Next, you will create cloud infrastructure from code in [Infrastructure as Code with Terraform](/courses/devops/infrastructure-as-code).

<code id="code-content" class="language-yaml">
#cloud-config
# cloud-init.yaml: set up a fresh Ubuntu cloud server automatically on its first boot.
# Paste it into the "user data" box when you create a server (AWS, Azure, Google Cloud,
# DigitalOcean, Hetzner and most others support it), or pass it from Terraform.
# It does what the SSH lesson's hardening script did, with no one logging in by hand.
users:
  - name: deploy
    groups: [sudo]
    shell: /bin/bash
    sudo: "ALL=(ALL) NOPASSWD:ALL"      # the account has no password, so sudo must not ask for one
    ssh_authorized_keys:
      - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIReplaceThisWithYourOwnPublicKey you@laptop
package_update: true                     # apt update
package_upgrade: true                    # apt upgrade: start fully patched
packages:
  - nginx
  - ufw
  - unattended-upgrades                  # keep installing security updates automatically
write_files:
  - path: /etc/ssh/sshd_config.d/00-hardening.conf
    content: |
      PermitRootLogin no
      PasswordAuthentication no
      KbdInteractiveAuthentication no
runcmd:                                  # runs last, after the packages are installed
  - systemctl restart ssh
  - ufw allow OpenSSH
  - ufw allow "Nginx Full"               # ports 80 and 443
  - ufw --force enable
  - systemctl enable --now nginx
</code></pre>
