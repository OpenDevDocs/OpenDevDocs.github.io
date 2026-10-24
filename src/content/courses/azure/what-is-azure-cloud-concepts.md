---
publishDate: 2026-10-01T06:00
title: What is Azure? Cloud Concepts and the Global Footprint
slug: what-is-azure-cloud-concepts
metadescription: Understand what Azure actually is, the service models, how the global infrastructure is arranged, and where the shared responsibility line sits.
updateDate: 2026-09-07T06:00
author: ['bishal-biswas']
level: 1
tags: ['fundamentals', 'cloud', 'introduction']
course: azure
---

## What Azure is

Azure is Microsoft's cloud platform: a large set of services you rent rather than own, running in Microsoft's data centres around the world.

The practical difference from a server in a cupboard is not really the hardware. It is that capacity is a setting rather than a purchase, and someone else handles the parts below your application.

## The three service models

Every cloud service sits somewhere on a scale of how much you manage.

```text
                        You manage              Azure manages
Infrastructure (IaaS)   OS, runtime, app        hardware, network, hypervisor
Platform (PaaS)         app and data            everything below the app
Software (SaaS)         your data only          the entire product
```

In Azure terms:

```text
IaaS    Virtual Machines, Virtual Networks, Managed Disks
PaaS    App Service, Azure Functions, Container Apps, Azure SQL Database
SaaS    Microsoft 365, Dynamics 365
```

The rule that saves the most trouble: **use the highest level service that fits.** A virtual machine gives you total control and total responsibility, including patching, hardening and scaling. App Service gives you less control and removes most of that work.

Teams reach for virtual machines out of habit far more often than they need to.

## Shared responsibility

Security in the cloud is split, and the split moves depending on the service model.

```text
Always yours          data, identities, access management, how you configure things
Depends on the model  operating system, network controls, application code
Always Microsoft's    physical hosts, physical network, physical data centre
```

The part people get wrong: **Azure secures the platform, you secure what you put on it.** A storage account left open to the internet is not an Azure failure. Neither is a virtual machine you never patched.

Most real cloud incidents are misconfiguration, not a breach of the platform.

## The global footprint

```text
Geography          a country or region boundary, for data residency
Region             a set of data centres within a latency envelope
Availability Zone  a physically separate data centre inside a region
Region pair        a second region for platform managed replication
```

A region is not one building. A region with availability zones has at least three, each with independent power, cooling and networking.

Deploying across zones survives one data centre failing. Deploying across regions survives a whole region failing. They cost differently and are covered properly later.

Not every region has zones, and not every service supports them. Check before designing around it.

## How resources are organised

```text
Management group    groups subscriptions, for policy and access at scale
Subscription        a billing and quota boundary
Resource group      a lifecycle and permissions container
Resource            an individual thing: a VM, a database, a storage account
```

Everything you create lives in a resource group, which lives in a subscription. Getting that hierarchy right early saves a painful reorganisation later, and it has its own topic.

## What the platform actually gives you

**Elasticity.** Capacity changes in minutes, and you pay for what you use rather than peak.

**Managed services.** Someone else patches the database, handles failover and takes the backups.

**Global reach.** Deploying to another continent is a configuration change, not a procurement project.

**Identity built in.** Microsoft Entra ID underpins authentication and authorisation across every service.

**A large catalogue.** Over two hundred services, which is both the strength and the difficulty.

## What it does not give you

**Automatic cost control.** The cloud is cheaper than a data centre only if you manage it. It is very easy to spend more, and the platform will happily let you.

**Automatic reliability.** A single virtual machine in the cloud is no more reliable than a single server anywhere else. Availability comes from how you design, not from where you run.

**Automatic security.** Defaults are reasonable but not strict. Public access, weak network rules and over broad permissions are all possible and all common.

**Escape from complexity.** You trade physical complexity for configuration complexity. Different problem, not no problem.

## Cost model

The three shapes you will meet:

```text
Consumption   pay per execution or per request, scales to zero
Provisioned   pay for reserved capacity whether used or not
Hybrid        a baseline of provisioned capacity plus overflow
```

A quiet API on a consumption plan can cost pence. The same API on a provisioned plan costs the same whether it serves one request or a million.

Choosing wrongly in either direction is the most common source of a surprising bill.

## Where to start

You do not need to know two hundred services. A working knowledge of about fifteen covers the great majority of what teams build:

```text
Entra ID, RBAC              who can do what
Resource groups, ARM        how things are organised and deployed
Virtual Network, NSG        how things talk to each other
App Service or Container Apps  where the code runs
Azure Functions             event driven work
Storage accounts            files and blobs
Azure SQL or Cosmos DB      the data
Key Vault                   secrets
Service Bus or Event Grid   messaging
Azure Monitor, App Insights when it breaks
```

This course works through those first, then the rest.

## Quick recap

- Azure is rented infrastructure and managed services, organised into regions and zones.
- Use the highest level service that fits the problem, not a virtual machine by reflex.
- Security is shared, and misconfiguration causes far more incidents than platform breaches.
- Availability zones survive a data centre failure, region pairs survive a region failure.
- Everything lives in a resource group inside a subscription inside a management group.
- The cloud is not automatically cheaper, more reliable or more secure.
- About fifteen services cover most of what teams actually build.

<code id="code-content" class="language-bash">
# Sign in and see what you have access to
az login
az account list --output table
az account set --subscription "My Subscription"
# The hierarchy: management group -&gt; subscription -&gt; resource group -&gt; resource
az account management-group list --output table
az group list --output table
# Where can you deploy? Not every region has availability zones, and not
# every service supports them. Check before designing around them.
az account list-locations --query "[?metadata.regionType=='Physical'].{Name:name, Display:displayName, Zones:availabilityZoneMappings}" --output table
# A region PAIR is Microsoft's replication partner for that region
az account list-locations --query "[?name=='uksouth'].metadata.pairedRegion[].name" --output tsv
# Create the container everything else lives in
az group create --name rg-shop-prod-uks --location uksouth
# See what a service costs before committing. The portal pricing calculator
# is the real tool, but the CLI tells you what SKUs exist and where.
az appservice list-locations --sku P1V3 --output table
az vm list-sizes --location uksouth --query "[?numberOfCores==\`2\`].{Size:name, RAM:memoryInMb}" --output table
# THE RULE THAT SAVES THE MOST TROUBLE: use the highest level service that
# fits. A VM gives you total control AND total responsibility: patching,
# hardening, scaling, backups. App Service removes most of that work.
#   IaaS  Virtual Machines        you manage the OS upwards
#   PaaS  App Service, Functions, Container Apps, Azure SQL
#   SaaS  Microsoft 365
# SHARED RESPONSIBILITY. Azure secures the platform, you secure what you
# put on it. A storage account left open to the internet is not an Azure
# failure. Most real incidents are misconfiguration, not a platform breach.
# Always yours: data, identities, access, and how you configure things.
az group delete --name rg-shop-prod-uks --yes --no-wait
</code></pre>
