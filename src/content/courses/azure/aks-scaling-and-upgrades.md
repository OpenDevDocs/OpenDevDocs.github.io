---
publishDate: 2026-10-11T08:45
title: AKS Scaling, Upgrades and Automatic Mode
slug: aks-scaling-and-upgrades
metadescription: Scale AKS with the cluster autoscaler, node autoprovisioning and KEDA, and keep the cluster upgraded without downtime.
updateDate: 2026-09-07T08:45
author: ['bishal-biswas']
level: 3
tags: ['kubernetes', 'aks', 'scaling', 'upgrades']
course: azure
---

## Three levels of scaling

```text
Horizontal Pod Autoscaler  more pods, based on metrics
Cluster autoscaler         more nodes, when pods cannot be scheduled
Node autoprovisioning      the right node types, chosen automatically
```

They work together. HPA adds pods, and when no node has room the cluster autoscaler adds a node.

## Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: shop-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: shop-api
  minReplicas: 3
  maxReplicas: 30
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30
```

`averageUtilization: 70` is a percentage **of the pod's CPU request**, not of the node. A pod requesting 200m scales when it averages 140m. Without a request, HPA cannot calculate anything and does nothing.

The `behavior` block is worth setting. Scaling up immediately and down slowly, over a five minute stabilisation window, avoids the flapping that default settings produce.

## Cluster autoscaler

```bash
az aks nodepool update \
  --cluster-name aks-shop --resource-group rg-shop-prod-uks \
  --name userpool \
  --enable-cluster-autoscaler --min-count 3 --max-count 20

az aks update --name aks-shop --resource-group rg-shop-prod-uks \
  --cluster-autoscaler-profile \
    scale-down-delay-after-add=10m \
    scale-down-unneeded-time=10m \
    max-graceful-termination-sec=600 \
    skip-nodes-with-local-storage=false
```

It adds a node when a pod is Pending because nothing has room, and removes a node when its pods can fit elsewhere.

**It reacts to pending pods, not to load.** A pod that fits on an existing node never triggers a node addition, however busy that node is. This is why resource requests must be honest: understated requests mean the cluster looks like it has room when it does not.

## Node autoprovisioning

```bash
az aks update --name aks-shop --resource-group rg-shop-prod-uks \
  --node-provisioning-mode Auto
```

Based on Karpenter. Instead of pre defining node pools and sizes, it looks at pending pods and creates nodes matching what they actually need.

A pod needing a GPU gets a GPU node. A batch of small pods gets one large node rather than several small ones, if that is cheaper. It also consolidates: when nodes are underused, workloads are packed onto fewer nodes and the rest are removed.

This is on by default in AKS Automatic, and it removes most node pool sizing decisions.

## KEDA

```bash
az aks update --name aks-shop --resource-group rg-shop-prod-uks --enable-keda
```

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: shop-worker
  namespace: shop
spec:
  scaleTargetRef:
    name: shop-worker
  minReplicaCount: 0
  maxReplicaCount: 50
  pollingInterval: 15
  cooldownPeriod: 300
  triggers:
    - type: azure-servicebus
      metadata:
        queueName: orders
        namespace: sb-shop-prod
        messageCount: "20"
      authenticationRef:
        name: keda-servicebus-auth
```

KEDA scales on external signals: queue depth, event hub lag, a Prometheus query, a cron schedule. `minReplicaCount: 0` means the deployment scales to zero when the queue is empty, which HPA alone cannot do.

For queue based workers this is the right tool. CPU is a poor proxy for "there is work waiting".

## Upgrades

Two separate things, and both matter.

```bash
az aks get-upgrades --name aks-shop --resource-group rg-shop-prod-uks --output table

# control plane first
az aks upgrade --name aks-shop --resource-group rg-shop-prod-uks \
  --kubernetes-version 1.32.1 --control-plane-only

# then each node pool
az aks nodepool upgrade --cluster-name aks-shop --resource-group rg-shop-prod-uks \
  --name userpool --kubernetes-version 1.32.1 --max-surge 33%
```

**You cannot skip minor versions.** Going from 1.30 to 1.32 means going through 1.31. Each hop is a separate upgrade, so falling behind makes catching up slow.

`--max-surge 33%` adds temporary nodes during the upgrade so capacity is maintained while nodes are drained. Without it, capacity drops during the upgrade. Higher surge is faster and costs more briefly.

## Node image upgrades

```bash
az aks nodepool upgrade --cluster-name aks-shop --resource-group rg-shop-prod-uks \
  --name userpool --node-image-only
```

Separate from Kubernetes version upgrades, and this is where OS security patches arrive. Do it regularly, even when not changing Kubernetes version.

## Automatic upgrades

```bash
az aks update --name aks-shop --resource-group rg-shop-prod-uks \
  --auto-upgrade-channel stable \
  --node-os-upgrade-channel NodeImage

az aks maintenanceconfiguration add \
  --cluster-name aks-shop --resource-group rg-shop-prod-uks \
  --name aksManagedAutoUpgradeSchedule \
  --schedule-type Weekly --day-of-week Sunday \
  --start-time 02:00 --duration 4 --utc-offset +00:00
```

```text
none      you upgrade manually, and eventually you will forget
patch     patch versions within the current minor
stable    the second newest supported minor version
rapid     the newest supported minor version
node-image  node images only
```

`stable` with a maintenance window is the setting most production clusters should have. Kubernetes releases three times a year and supports each version for about a year, so manual upgrading becomes a recurring scramble.

The maintenance window means it happens when you choose, not at random.

## Draining safely

```bash
kubectl drain aks-userpool-12345678-vmss000001 \
  --ignore-daemonsets --delete-emptydir-data
```

Upgrades drain nodes automatically. Three things make that safe:

**Pod disruption budgets**, so not every replica is evicted at once.

**Multiple replicas**, since a single replica deployment always has downtime.

**Graceful shutdown**, so the application handles `SIGTERM` and finishes in flight requests.

```csharp
builder.Services.Configure<HostOptions>(options =>
{
    options.ShutdownTimeout = TimeSpan.FromSeconds(30);
});
```

Kubernetes sends `SIGTERM`, waits for the termination grace period, then sends `SIGKILL`. An application that ignores `SIGTERM` drops requests on every upgrade and every scale in.

## Long term support

```bash
az aks update --name aks-shop --resource-group rg-shop-prod-uks \
  --tier premium --k8s-support-plan AKSLongTermSupport
```

Premium tier extends support for a version to two years. It costs more and it is not a substitute for upgrading, since you eventually face a larger jump.

## Watching it

```bash
kubectl get hpa -A
kubectl describe hpa shop-api
kubectl get nodes -o custom-columns=NAME:.metadata.name,VERSION:.status.nodeInfo.kubeletVersion
kubectl get events --field-selector reason=TriggeredScaleUp
```

```kusto
KubeNodeInventory
| where TimeGenerated > ago(7d)
| summarize NodeCount = dcount(Computer) by bin(TimeGenerated, 1h)
| render timechart
```

If node count never changes, the autoscaler is not doing anything, and that usually means requests are set high enough that nothing is ever pending, or the maximum is already reached.

## Quick recap

- HPA scales pods on a percentage of the pod's request, so without requests it does nothing.
- The cluster autoscaler reacts to pending pods, not to load, so honest requests matter.
- Node autoprovisioning picks node types from what pods actually need, and consolidates.
- KEDA scales on queue depth and can reach zero, which HPA cannot.
- You cannot skip minor versions, so falling behind makes catching up slow.
- Use `--max-surge` so capacity is maintained while nodes drain.
- Set the stable upgrade channel with a maintenance window, and handle SIGTERM properly.

<code id="code-content" class="language-bash">
# THREE LEVELS, WORKING TOGETHER:
#   HPA                  more pods, from metrics
#   cluster autoscaler   more nodes, when pods cannot be scheduled
#   node autoprovisioning  the right node TYPES, chosen automatically
# HPA's averageUtilization is a PERCENTAGE OF THE POD'S REQUEST, not of the
# node. WITHOUT A REQUEST, HPA CANNOT CALCULATE ANYTHING and does nothing.
# Set the behavior block: up immediately, down over a 5 minute window, or
# the defaults flap.
az aks nodepool update --cluster-name aks-shop --resource-group rg-shop-prod-uks \
  --name userpool --enable-cluster-autoscaler --min-count 3 --max-count 20
# THE CLUSTER AUTOSCALER REACTS TO PENDING PODS, NOT TO LOAD. A pod that
# FITS never triggers a node, however busy that node is. So understated
# requests make the cluster look like it has room when it does not.
# NODE AUTOPROVISIONING (Karpenter based) creates nodes matching what
# pending pods actually need, and CONSOLIDATES underused ones. On by
# default in AKS Automatic, and it removes most sizing decisions.
az aks update --name aks-shop --resource-group rg-shop-prod-uks \
  --node-provisioning-mode Auto
# KEDA scales on QUEUE DEPTH, event hub lag, a Prometheus query or a cron,
# and can reach ZERO, which HPA cannot. CPU is a poor proxy for "there is
# work waiting".
az aks update --name aks-shop --resource-group rg-shop-prod-uks --enable-keda
# UPGRADES: CONTROL PLANE FIRST, THEN NODE POOLS. YOU CANNOT SKIP MINOR
# VERSIONS: 1.30 to 1.32 goes through 1.31, as separate upgrades. Falling
# behind makes catching up slow.
az aks upgrade --name aks-shop --resource-group rg-shop-prod-uks \
  --kubernetes-version 1.32.1 --control-plane-only
az aks nodepool upgrade --cluster-name aks-shop --resource-group rg-shop-prod-uks \
  --name userpool --kubernetes-version 1.32.1 --max-surge 33%
# --max-surge adds temporary nodes so CAPACITY IS MAINTAINED while nodes
# drain. Without it, capacity drops during the upgrade.
# NODE IMAGE UPGRADES ARE SEPARATE, and are where OS security patches
# arrive. Do them regularly even when not changing Kubernetes version.
az aks nodepool upgrade --cluster-name aks-shop --resource-group rg-shop-prod-uks \
  --name userpool --node-image-only
# Kubernetes releases three times a year, so manual upgrading becomes a
# recurring scramble. Set a channel AND a maintenance window:
az aks update --name aks-shop --resource-group rg-shop-prod-uks \
  --auto-upgrade-channel stable --node-os-upgrade-channel NodeImage
az aks maintenanceconfiguration add --cluster-name aks-shop \
  --resource-group rg-shop-prod-uks --name aksManagedAutoUpgradeSchedule \
  --schedule-type Weekly --day-of-week Sunday --start-time 02:00 --duration 4
# THREE THINGS MAKE DRAINING SAFE: pod disruption budgets, more than one
# replica, and HANDLING SIGTERM. Kubernetes sends SIGTERM, waits the grace
# period, then SIGKILL. An app that ignores it drops requests on EVERY
# upgrade and every scale in.
kubectl get hpa -A ; kubectl describe hpa shop-api
kubectl get events --field-selector reason=TriggeredScaleUp
# If node count NEVER changes, the autoscaler is doing nothing: requests
# are too high for anything to be pending, or the maximum is reached.
</code></pre>
