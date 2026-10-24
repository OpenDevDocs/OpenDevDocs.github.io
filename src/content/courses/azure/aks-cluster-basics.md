---
publishDate: 2026-10-10T08:35
title: 'Azure Kubernetes Service: Cluster Basics'
slug: aks-cluster-basics
metadescription: Create an AKS cluster with sensible defaults, understand node pools and the control plane, and deploy a first workload.
updateDate: 2026-09-07T08:35
author: ['bishal-biswas']
level: 3
tags: ['kubernetes', 'aks', 'containers']
course: azure
---

## What Azure manages

```text
Control plane   API server, scheduler, etcd. Azure runs it, free on the Free tier.
Nodes           virtual machines running your pods. You pay for these.
```

The control plane being managed is the whole value. You do not run etcd, you do not upgrade the API server by hand, and you do not lose the cluster when a control plane node dies.

```text
Free tier      no SLA on the API server. Development.
Standard tier  99.95 percent SLA, and a per cluster charge. Production.
Premium tier   longer support windows for older Kubernetes versions.
```

## Creating a cluster

```bash
az aks create \
  --name aks-shop --resource-group rg-shop-prod-uks \
  --location uksouth \
  --tier standard \
  --kubernetes-version 1.31.3 \
  --node-count 3 \
  --node-vm-size Standard_D4s_v5 \
  --zones 1 2 3 \
  --enable-managed-identity \
  --network-plugin azure --network-plugin-mode overlay \
  --network-dataplane cilium \
  --enable-oidc-issuer --enable-workload-identity \
  --enable-addons monitoring \
  --generate-ssh-keys
```

That command has a lot in it, and every flag earns its place:

```text
--tier standard          an SLA on the API server
--zones 1 2 3            nodes spread across datacentres
--enable-managed-identity no service principal credential to rotate
--network-plugin-mode overlay  pods get addresses from an overlay, not the subnet
--network-dataplane cilium     eBPF networking, better performance and policy
--enable-workload-identity     pods authenticate to Azure with no secret
--enable-oidc-issuer     required for workload identity
```

## Automatic mode

```bash
az aks create \
  --name aks-shop --resource-group rg-shop-prod-uks \
  --sku automatic --location uksouth
```

AKS Automatic makes the operational decisions for you: node pools, autoscaling, upgrades, monitoring, network policy and security defaults are all managed.

It is the right starting point unless you have a specific reason to configure things yourself. Most of the difficulty in running AKS is the day two work, and Automatic removes most of it.

## Connecting

```bash
az aks get-credentials --name aks-shop --resource-group rg-shop-prod-uks
kubectl get nodes -o wide
kubectl get pods --all-namespaces
```

`get-credentials` writes to `~/.kube/config`. With Entra ID integration, the first `kubectl` command triggers a browser sign in and the token is cached.

```bash
az aks get-credentials --name aks-shop --resource-group rg-shop-prod-uks --admin
```

The `--admin` flag gets a certificate that bypasses Entra ID entirely. Convenient, and it bypasses your access controls, so disable it in production:

```bash
az aks update --name aks-shop --resource-group rg-shop-prod-uks --disable-local-accounts
```

## Node pools

```bash
az aks nodepool add \
  --cluster-name aks-shop --resource-group rg-shop-prod-uks \
  --name memory \
  --node-vm-size Standard_E8s_v5 \
  --node-count 2 --zones 1 2 3 \
  --labels workload=memory-intensive \
  --node-taints workload=memory-intensive:NoSchedule

az aks nodepool add \
  --cluster-name aks-shop --resource-group rg-shop-prod-uks \
  --name spot \
  --priority Spot --eviction-policy Delete --spot-max-price -1 \
  --node-count 0 --min-count 0 --max-count 10 --enable-cluster-autoscaler \
  --node-taints "kubernetes.azure.com/scalesetpriority=spot:NoSchedule"
```

```text
System pool  runs cluster components. Keep it separate, and at least three nodes.
User pools   run your workloads. Sized for what they run.
Spot pool    cheap, interruptible. For batch and anything restartable.
```

The taint and toleration pattern is what keeps workloads on the right nodes. A taint repels pods, and only pods with a matching toleration land there.

```yaml
spec:
  tolerations:
    - key: workload
      operator: Equal
      value: memory-intensive
      effect: NoSchedule
  nodeSelector:
    workload: memory-intensive
```

## Deploying something

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: shop-api
  template:
    metadata:
      labels:
        app: shop-api
    spec:
      containers:
        - name: shop-api
          image: acrshop.azurecr.io/shop-api:1.4.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              memory: 512Mi
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: shop-api
spec:
  selector:
    app: shop-api
  ports:
    - port: 80
      targetPort: 8080
```

```bash
kubectl apply -f deployment.yaml
kubectl rollout status deployment/shop-api
kubectl get pods -l app=shop-api
```

**Set resource requests on everything.** The scheduler places pods based on requests, and a pod with none can land anywhere and starve its neighbours. This is the single most common cause of unexplained cluster problems.

Note the memory limit with no CPU limit. That combination is deliberate and widely recommended: memory is incompressible so a limit prevents one pod exhausting the node, while a CPU limit only throttles a pod that could otherwise use spare capacity.

## Pod disruption budgets

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: shop-api
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: shop-api
```

During a node upgrade, Kubernetes drains nodes one at a time. Without a disruption budget it can evict every replica of a service at once.

Add one for anything that matters, or upgrades cause outages you will blame on something else.

## Namespaces and quotas

```bash
kubectl create namespace shop
kubectl config set-context --current --namespace=shop
```

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: shop-quota
  namespace: shop
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    limits.memory: 80Gi
    pods: "50"
```

A quota stops one team's misconfigured deployment consuming the whole cluster. On a shared cluster this is not optional.

## Cost control

```bash
az aks nodepool update \
  --cluster-name aks-shop --resource-group rg-shop-prod-uks \
  --name userpool --enable-cluster-autoscaler --min-count 2 --max-count 10

az aks stop --name aks-dev --resource-group rg-shop-dev-uks
az aks start --name aks-dev --resource-group rg-shop-dev-uks
```

Stopping a development cluster overnight stops the node charges entirely, and the cluster state is preserved.

```text
You pay for nodes, disks, load balancers and egress
The control plane is free on Free tier, charged on Standard and Premium
An idle cluster with three nodes still costs a full month
```

## Debugging

```bash
kubectl describe pod shop-api-7d4f8b6c9-x2klm
kubectl logs shop-api-7d4f8b6c9-x2klm --previous
kubectl get events --sort-by=.lastTimestamp
kubectl top nodes
kubectl top pods
```

**Pod stuck Pending.** No node has room for its requests, or a taint has no matching toleration. `describe` says which.

**CrashLoopBackOff.** The container starts and exits. `logs --previous` shows the last attempt.

**ImagePullBackOff.** The registry cannot be reached or the identity lacks `AcrPull`.

**OOMKilled.** The container exceeded its memory limit. Raise the limit, or fix the leak.

```bash
az aks check-acr --name aks-shop --resource-group rg-shop-prod-uks --acr acrshop.azurecr.io
```

## Quick recap

- Azure manages the control plane, and you manage and pay for the nodes.
- Use Standard tier in production, since Free has no API server SLA.
- AKS Automatic makes the day two decisions for you and is the right default.
- Disable local accounts so nobody bypasses Entra ID with an admin certificate.
- Taints and tolerations keep workloads on the node pools intended for them.
- Set resource requests on everything, since the scheduler places pods by request.
- Add pod disruption budgets, or node upgrades take services down.

<code id="code-content" class="language-bash">
# AZURE MANAGES THE CONTROL PLANE (API server, scheduler, etcd). You manage
# and pay for the NODES. Use --tier standard in production: Free has NO SLA
# on the API server.
az aks create --name aks-shop --resource-group rg-shop-prod-uks --tier standard \
  --node-count 3 --node-vm-size Standard_D4s_v5 --zones 1 2 3 \
  --enable-managed-identity --network-plugin azure --network-plugin-mode overlay \
  --network-dataplane cilium --enable-oidc-issuer --enable-workload-identity \
  --enable-addons monitoring --generate-ssh-keys
# AKS AUTOMATIC makes the day two decisions for you: node pools, scaling,
# upgrades, monitoring, network policy, security defaults. Most of the
# difficulty in running AKS is day two work, and this removes it.
az aks create --name aks-shop --resource-group rg-shop-prod-uks --sku automatic
az aks get-credentials --name aks-shop --resource-group rg-shop-prod-uks
# --admin gets a certificate that BYPASSES ENTRA ID, and therefore bypasses
# your access controls. Turn it off in production:
az aks update --name aks-shop --resource-group rg-shop-prod-uks --disable-local-accounts
# NODE POOLS. Keep the SYSTEM pool separate and at least three nodes.
# TAINTS repel pods; only pods with a matching TOLERATION land there.
az aks nodepool add --cluster-name aks-shop --resource-group rg-shop-prod-uks \
  --name memory --node-vm-size Standard_E8s_v5 --node-count 2 --zones 1 2 3 \
  --labels workload=memory-intensive \
  --node-taints workload=memory-intensive:NoSchedule
# A SPOT pool for batch and anything restartable, scaling from zero:
az aks nodepool add --cluster-name aks-shop --resource-group rg-shop-prod-uks \
  --name spot --priority Spot --eviction-policy Delete --spot-max-price -1 \
  --node-count 0 --min-count 0 --max-count 10 --enable-cluster-autoscaler
# SET RESOURCE REQUESTS ON EVERYTHING. The scheduler places pods BY REQUEST,
# and a pod with none lands anywhere and starves its neighbours. This is the
# most common cause of unexplained cluster problems.
#   requests: cpu 200m, memory 256Mi   limits: memory 512Mi (and NO cpu limit)
# Memory is incompressible so a limit protects the node. A CPU limit only
# throttles a pod that could otherwise use spare capacity.
# ADD POD DISRUPTION BUDGETS, or a node upgrade drains every replica at once
# and you blame the outage on something else.
#   kind: PodDisruptionBudget  spec: { minAvailable: 2 }
kubectl apply -f deployment.yaml
kubectl rollout status deployment/shop-api
# DEBUGGING, in the order you will need it:
kubectl describe pod shop-api-7d4f8b6c9-x2klm   # Pending: no room, or a taint
kubectl logs shop-api-7d4f8b6c9-x2klm --previous # CrashLoopBackOff
kubectl get events --sort-by=.lastTimestamp
kubectl top nodes ; kubectl top pods
# ImagePullBackOff is usually a missing AcrPull role:
az aks check-acr --name aks-shop --resource-group rg-shop-prod-uks --acr acrshop.azurecr.io
# OOMKilled means it exceeded the memory limit. Raise it, or fix the leak.
# Stopping a dev cluster overnight stops node charges and preserves state:
az aks stop --name aks-dev --resource-group rg-shop-dev-uks
</code></pre>
