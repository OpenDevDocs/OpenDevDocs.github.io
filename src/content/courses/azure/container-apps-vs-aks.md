---
publishDate: 2026-10-11T08:50
title: Choosing Between Container Apps and AKS
slug: container-apps-vs-aks
metadescription: Decide between Azure Container Apps and AKS honestly, based on what you need rather than what sounds impressive.
updateDate: 2026-09-07T08:50
author: ['bishal-biswas']
level: 3
tags: ['kubernetes', 'containers', 'architecture', 'decisions']
course: azure
---

## They are the same underneath

Container Apps runs on AKS. Microsoft manages the cluster, and you never see it.

```text
Container Apps  the platform makes the decisions, you deploy containers
AKS             you make the decisions, and you own the consequences
```

The question is not which is more capable. AKS is more capable. The question is whether you need that capability enough to pay for it in engineering time.

## What Container Apps does not have

Be specific about this, because it is the whole decision.

```text
No kubectl, no manifests, no operators, no CRDs
No service mesh, so no Istio or Linkerd
No DaemonSets, StatefulSets or PersistentVolumeClaims in the Kubernetes sense
No node access, so no privileged workloads or kernel modules
No Helm charts
Limited to HTTP, TCP and scale rules the platform supports
```

If any of those is genuinely required, the decision is made. Most applications require none of them.

## What Container Apps gives you for free

```text
Ingress with managed TLS certificates
Scale to zero
KEDA scaling on any supported source
Revisions with traffic splitting
Service discovery by name
Managed identity integration
Dapr, if wanted
Log Analytics wiring
No upgrades to run, ever
```

Building the equivalent on AKS means an ingress controller, cert-manager, KEDA, a progressive delivery tool, monitoring, and then keeping all of it upgraded.

That is real work, and it recurs.

## The operational cost of AKS

Honestly stated:

```text
Kubernetes upgrades three times a year, and you cannot skip versions
Node image patching
Ingress controller upgrades and their breaking changes
Certificate management
RBAC, network policy and pod security
Cluster monitoring, separate from application monitoring
Someone who understands all of it, and a second person for when they are away
```

A team of four shipping a web application will spend a meaningful share of its time on this. A platform team of eight supporting twenty services will spend proportionally less, and get more back.

## Choose Container Apps when

```text
You are running web services, APIs and background workers
You want scale to zero
Your team is small, or has no Kubernetes expertise
You do not need Kubernetes APIs or ecosystem tools
You want to ship rather than operate
You are moving off App Service and want containers
```

This describes most applications.

## Choose AKS when

```text
You need Kubernetes APIs, operators or custom resources
You need a service mesh for mTLS, traffic policy or fine grained observability
You need StatefulSets, DaemonSets or specific storage semantics
You need GPUs, privileged containers or particular node configuration
You are running someone else's Helm chart that expects a cluster
You need portability across clouds or on premises
You already have a platform team running Kubernetes well
Your scale genuinely justifies the control
```

The portability argument is often overstated. A Kubernetes application still depends on cloud specific storage classes, load balancers, identity and ingress, so moving it is not free. But it is more portable than a platform specific service, and for some organisations that matters.

## A cost comparison

```text
Container Apps  per vCPU second and GiB second of actual use.
                Scale to zero means zero.
AKS             per node hour, whether busy or idle, plus the control plane
                on Standard tier, plus disks and load balancers.
```

For spiky or low traffic, Container Apps is dramatically cheaper. Ten services averaging light use cost almost nothing at zero and scale on demand.

For steady high load, AKS with reserved instances and good bin packing wins on raw compute. A cluster at 70 percent utilisation is efficient.

Then add engineering time. Two days a month maintaining a cluster is a real cost that does not appear on the Azure bill.

## Running both

Common, and sensible.

```text
AKS             the stateful platform, service mesh workloads, GPU jobs
Container Apps  new services, background workers, anything that scales to zero
```

They share Container Registry, Key Vault, Log Analytics, private endpoints and managed identity. Nothing forces one choice across an organisation.

## Migration is not symmetric

**Container Apps to AKS** is straightforward. The container is unchanged, and you write manifests for what the platform was doing.

**AKS to Container Apps** is harder, because anything using Kubernetes APIs, operators or a mesh has to be replaced.

Given that, starting on Container Apps is the lower risk choice when you are unsure. Moving up later costs less than moving down.

## The honest test

Three questions:

**Do you need a Kubernetes API that Container Apps does not expose?** If yes, AKS.

**Do you have someone who will own cluster operations, indefinitely?** If no, Container Apps.

**Would you rather spend the next quarter shipping features or building a platform?** Answer honestly.

Most teams choosing AKS do so because it is the well known answer, not because they need it. That is understandable, and it is worth checking against the questions above.

## Quick recap

- Container Apps runs on AKS, so the question is capability against engineering time.
- Container Apps has no kubectl, operators, service mesh or node access.
- It gives you ingress, TLS, scale to zero, KEDA, revisions and service discovery with no assembly.
- The operational cost of AKS is upgrades three times a year, patching, ingress, RBAC and expertise.
- Container Apps is dramatically cheaper for spiky traffic, AKS wins on steady high load.
- Running both is normal, since they share registry, identity and monitoring.
- Container Apps to AKS is easy, AKS to Container Apps is not, so start higher when unsure.

<code id="code-content" class="language-bash">
# THEY ARE THE SAME UNDERNEATH. Container Apps RUNS ON AKS, managed by
# Microsoft. The question is not which is more capable (AKS is), but
# whether you need that capability enough to pay for it in ENGINEERING TIME.
# WHAT CONTAINER APPS DOES NOT HAVE. This is the whole decision:
#   no kubectl, manifests, operators or CRDs
#   no service mesh (no Istio, no Linkerd)
#   no DaemonSets, StatefulSets or PersistentVolumeClaims
#   no node access, so no privileged workloads or kernel modules
#   no Helm charts
# If any of those is GENUINELY required, the decision is made. Most
# applications require none of them.
# WHAT YOU GET WITHOUT ASSEMBLING IT:
#   ingress with managed TLS | scale to zero | KEDA scaling
#   revisions and traffic splitting | service discovery by name
#   managed identity | Log Analytics wiring | NO UPGRADES TO RUN, EVER
# The AKS equivalent is an ingress controller, cert-manager, KEDA, a
# progressive delivery tool and monitoring, ALL KEPT UPGRADED. Recurring work.
# THE OPERATIONAL COST OF AKS, HONESTLY:
#   Kubernetes upgrades 3x a year, and you cannot skip versions
#   node image patching | ingress controller breaking changes
#   certificates | RBAC, network policy, pod security | cluster monitoring
#   someone who understands all of it, and a SECOND person for holidays
# COST SHAPE:
#   Container Apps  per vCPU second and GiB second of ACTUAL USE.
#                   Scale to zero means zero.
#   AKS             per NODE HOUR busy or idle, plus control plane, disks
#                   and load balancers.
# Spiky or low traffic: Container Apps, dramatically. Steady high load with
# reservations and good bin packing: AKS. Then add engineering time, which
# does not appear on the Azure bill.
# RUNNING BOTH IS NORMAL. They share Container Registry, Key Vault, Log
# Analytics, private endpoints and managed identity.
# MIGRATION IS NOT SYMMETRIC:
#   Container Apps -&gt; AKS  straightforward. Same container, write manifests.
#   AKS -&gt; Container Apps  hard. Operators, meshes and CRDs must be replaced.
# So START ON CONTAINER APPS WHEN UNSURE. Moving up costs less than down.
# THE HONEST TEST:
#   1. Need a Kubernetes API Container Apps does not expose?  -&gt; AKS
#   2. Have someone who will own cluster operations forever?  -&gt; if no, ACA
#   3. Ship features next quarter, or build a platform?       -&gt; answer honestly
# Most teams choosing AKS do so because it is the WELL KNOWN answer.
</code></pre>
