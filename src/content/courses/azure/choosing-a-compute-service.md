---
publishDate: 2026-10-07T07:50
title: Choosing a Compute Service
slug: choosing-a-compute-service
metadescription: Pick the right Azure compute service by matching what you are running to what each service manages for you.
updateDate: 2026-09-07T07:50
author: ['bishal-biswas']
level: 1
tags: ['compute', 'architecture', 'decisions']
course: azure
---

## The real question

Not "which service is best" but "how much do I want to manage, and what does my workload actually need".

```text
Virtual machines    you manage the OS, patching, scaling, everything
AKS                 you manage Kubernetes objects, Azure manages the control plane
Container Apps      you bring a container, Azure manages the rest
App Service         you bring code or a container, Azure manages the platform
Functions           you bring a function, Azure manages invocation and scale
Static Web Apps     you bring static files and an API, Azure manages hosting
```

Going down that list, you give up control and gain time back. The right answer is usually **the highest one on the list that fits**, because everything you manage is something you maintain.

## A decision path

```text
Is it a static site or a single page app?
  -> Static Web Apps. Free tier, global CDN, built in auth.

Is it event driven, or short and bursty?
  -> Functions. Pay per execution, scales to zero.

Is it a web app or API, in a supported runtime?
  -> App Service. Slots, easy scaling, custom domains handled.

Is it containerised, with microservices and eventing?
  -> Container Apps. Kubernetes underneath without the Kubernetes.

Do you need Kubernetes APIs, operators, or service mesh?
  -> AKS. Real Kubernetes, real operational cost.

Do you need a specific OS, kernel modules, or legacy software?
  -> Virtual machines. Sometimes the only option.
```

Most workloads land on App Service or Container Apps, and most teams reach for AKS earlier than they need to.

## App Service

Fits a web app or API in .NET, Java, Node, Python, PHP or a container.

```bash
az appservice plan create --name plan-shop --resource-group rg-shop-prod-uks \
  --sku P1v3 --is-linux

az webapp create --name shop-api --resource-group rg-shop-prod-uks \
  --plan plan-shop --runtime "DOTNETCORE:8.0"
```

```text
Good    deployment slots, easy custom domains and certificates, autoscale,
        mature tooling, straightforward to reason about
Less good  you pay for the plan whether busy or idle, and scaling is per plan
```

Deployment slots are the strongest argument. Deploy to staging, warm it up, swap into production with no downtime, swap back if it goes wrong.

## Container Apps

Fits containerised services, especially several that talk to each other.

```bash
az containerapp create \
  --name shop-api --resource-group rg-shop-prod-uks \
  --environment cae-shop \
  --image ghcr.io/contoso/shop-api:1.4.0 \
  --target-port 8080 --ingress external \
  --min-replicas 0 --max-replicas 10
```

```text
Good    scales to zero, KEDA event driven scaling, Dapr if wanted,
        revisions and traffic splitting, no cluster to run
Less good  less control than AKS, no direct node access
```

`--min-replicas 0` is the interesting part. An idle service costs nothing, and a request wakes it, at the price of a cold start.

Container Apps is where most teams should look before AKS. It runs Kubernetes underneath and hides it.

## Azure Functions

Fits event handlers, scheduled jobs, queue processors and lightweight APIs.

```csharp
[Function("ProcessOrder")]
public async Task Run(
    [ServiceBusTrigger("orders", Connection = "ServiceBusConnection")] string message,
    FunctionContext context)
{
    var order = JsonSerializer.Deserialize<Order>(message);
    await _repository.SaveAsync(order);
}
```

```text
Good    pay per execution, scales to zero, rich trigger and binding set
Less good  cold starts on Consumption, execution time limits, harder to
           reason about at high volume
```

The Flex Consumption plan improved cold starts considerably and supports virtual network integration, which the old Consumption plan handled poorly.

## AKS

Fits teams that genuinely need Kubernetes.

```bash
az aks create --name aks-shop --resource-group rg-shop-prod-uks \
  --node-count 3 --enable-managed-identity --generate-ssh-keys
```

```text
Good    full Kubernetes, portable, huge ecosystem, fine grained control
Less good  you own upgrades, node pools, networking, ingress, certificates,
           monitoring, and the expertise to run all of it
```

Be honest about the cost. A cluster needs someone who understands Kubernetes, and version upgrades are a recurring commitment. Choose it when you need the APIs, not because it is the well known option.

Automatic mode reduces this burden considerably by managing node pools, upgrades and defaults, and is worth using when AKS is the right choice.

## Virtual machines

Fits legacy software, specific OS requirements, and lift and shift.

```text
Good    complete control, run anything, familiar
Less good  you patch it, monitor it, scale it, back it up and secure it
```

Sometimes there is no alternative. A vendor application that wants a specific Windows build is a virtual machine, and that is fine.

## Static Web Apps

Fits React, Angular, Vue, Svelte, Astro and static site generators.

```bash
az staticwebapp create --name shop-web --resource-group rg-shop-prod-uks \
  --source https://github.com/contoso/shop-web --branch main \
  --app-location "/" --output-location "dist" --login-with-github
```

```text
Good    free tier, global distribution, staging environments per pull request,
        built in authentication, managed certificates
Less good  the API side is Functions, so backend options are limited
```

For a front end with a small API, this is the cheapest and simplest option by a wide margin.

## Cost shapes

```text
Functions Consumption  per execution. Free at zero traffic.
Container Apps         per second of use. Free at zero with min-replicas 0.
App Service            per plan, per hour. Same idle or busy.
AKS                    per node, per hour, plus the control plane on paid tiers.
VMs                    per hour, and reservations cut it substantially.
```

The pattern: consumption pricing wins for spiky and low traffic, provisioned pricing wins for steady high traffic.

An App Service plan running at 70 percent all day is cheaper than the equivalent consumption. A service used twice an hour is far cheaper on consumption.

## What actually decides it

**Team skills.** A team that knows Kubernetes runs AKS well. A team that does not will run it badly, whatever the architecture diagram says.

**Existing estate.** Consistency has value. A tenth service on App Service is easier than a first service on something new.

**Traffic shape.** Spiky suits consumption, steady suits provisioned.

**Time to first deploy.** Static Web Apps in minutes, App Service in an hour, AKS in days.

## Quick recap

- Choose the highest level service that fits, because anything you manage is something you maintain.
- App Service and Container Apps cover most web workloads.
- Container Apps runs Kubernetes underneath and hides it, so look there before AKS.
- Functions suit event driven and bursty work, and Flex Consumption fixed the old cold start problem.
- AKS is right when you need Kubernetes APIs, and it costs real operational effort.
- Consumption pricing wins for spiky traffic, provisioned wins for steady traffic.
- Team skills and existing estate decide this more often than technical fit.

<code id="code-content" class="language-bash">
# THE REAL QUESTION is not "which is best" but "how much do I want to
# manage". Going down this list you give up control and gain time back:
#   Virtual machines  you manage the OS, patching, scaling, everything
#   AKS               you manage Kubernetes, Azure manages the control plane
#   Container Apps    you bring a container, Azure manages the rest
#   App Service       you bring code, Azure manages the platform
#   Functions         you bring a function, Azure manages invocation and scale
#   Static Web Apps   you bring files, Azure manages hosting
# PICK THE HIGHEST ONE THAT FITS. Everything you manage is something you
# maintain. Most teams reach for AKS earlier than they need to.
# THE DECISION PATH:
#   static site or SPA?             -&gt; Static Web Apps
#   event driven or bursty?         -&gt; Functions
#   web app or API, known runtime?  -&gt; App Service
#   containers and microservices?   -&gt; Container Apps
#   need Kubernetes APIs, operators, service mesh? -&gt; AKS
#   specific OS, kernel modules, legacy software?  -&gt; Virtual machines
az webapp create --name shop-api --resource-group rg-shop-prod-uks \
  --plan plan-shop --runtime "DOTNETCORE:8.0"
# App Service's strongest argument is DEPLOYMENT SLOTS: deploy to staging,
# warm it, swap with no downtime, swap back if it goes wrong.
az containerapp create --name shop-api --resource-group rg-shop-prod-uks \
  --environment cae-shop --image ghcr.io/contoso/shop-api:1.4.0 \
  --target-port 8080 --ingress external --min-replicas 0 --max-replicas 10
# --min-replicas 0 means an idle service costs NOTHING, at the price of a
# cold start. Container Apps runs Kubernetes underneath and HIDES it, which
# is why most teams should look here before AKS.
az aks create --name aks-shop --resource-group rg-shop-prod-uks \
  --node-count 3 --enable-managed-identity --generate-ssh-keys
# BE HONEST ABOUT AKS. You own upgrades, node pools, networking, ingress,
# certificates and monitoring, plus the expertise to run all of it. Choose
# it because you need the APIs, not because it is the well known option.
# COST SHAPES:
#   Functions Consumption  per execution, free at zero traffic
#   Container Apps         per second, free at zero with min-replicas 0
#   App Service            per PLAN per hour, same idle or busy
#   AKS                    per node per hour, plus control plane on paid tiers
#   VMs                    per hour, and reservations cut it substantially
# Consumption wins for SPIKY and low traffic. Provisioned wins for STEADY.
# WHAT ACTUALLY DECIDES IT: team skills, the existing estate, traffic shape,
# and time to first deploy. Rarely the architecture diagram.
</code></pre>
