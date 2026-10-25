---
publishDate: 2026-10-11T08:40
title: AKS Networking, Ingress and Identity
slug: aks-networking-and-identity
metadescription: Choose an AKS network plugin, expose services with ingress, and let pods authenticate to Azure using workload identity.
updateDate: 2026-09-07T08:40
author: ['bishal-biswas']
level: 3
tags: ['kubernetes', 'aks', 'networking', 'identity']
course: azure
---

## Network plugins

The choice affects address planning permanently, so make it deliberately.

```text
Azure CNI Overlay   pods get addresses from a separate overlay range.
                    The node subnet only holds nodes. THE DEFAULT CHOICE.
Azure CNI           every pod gets an address from the vnet subnet.
                    Pods are directly routable, and address space runs out fast.
kubenet             legacy, retired March 2028. Do not start here.
```

```bash
az aks create --name aks-shop --resource-group rg-shop-prod-uks \
  --network-plugin azure --network-plugin-mode overlay \
  --pod-cidr 192.168.0.0/16 \
  --service-cidr 10.100.0.0/16 --dns-service-ip 10.100.0.10 \
  --vnet-subnet-id /subscriptions/.../subnets/snet-aks \
  --network-dataplane cilium
```

The arithmetic that makes people choose overlay:

```text
Traditional Azure CNI, 100 nodes, 30 pods each = 3,000 vnet addresses
Overlay,               100 nodes               = 100 vnet addresses
```

With traditional CNI, address exhaustion arrives long before you expect it, and fixing it means rebuilding the cluster.

Overlay pods are not directly routable from outside the cluster, which is almost always fine. Reach them through a service or ingress like everything else.

## Cilium

```bash
--network-dataplane cilium
```

Azure CNI powered by Cilium uses eBPF instead of iptables for service routing and network policy. Faster at scale, better observability, and the policy engine supports more than the standard Kubernetes policy.

Choose it for new clusters. It must be set at creation.

## Network policy

By default every pod can reach every other pod. Network policy changes that.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: shop
spec:
  podSelector: {}
  policyTypes:
    - Ingress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-to-worker
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: shop-worker
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: shop-api
      ports:
        - protocol: TCP
          port: 8080
```

Start with a default deny in the namespace, then allow what is needed. Doing it the other way round means the deny never actually happens.

**Do not forget DNS.** A default deny egress policy that omits port 53 to `kube-system` breaks every name lookup in the namespace, and the symptom looks like everything is broken at once.

## Ingress

```bash
az aks approuting enable --name aks-shop --resource-group rg-shop-prod-uks
```

The managed NGINX add on gives an ingress controller Azure keeps updated. Previously everyone installed NGINX by Helm and owned its upgrades.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
spec:
  ingressClassName: webapprouting.kubernetes.azure.com
  tls:
    - hosts: [shop.example.com]
      secretName: shop-tls
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: shop-api
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: shop-web
                port:
                  number: 80
```

The alternative is Application Gateway for Containers, which puts a managed Azure layer 7 load balancer in front and supports WAF. Heavier, and the right answer when you need WAF or private backends.

## Internal load balancers

```yaml
apiVersion: v1
kind: Service
metadata:
  name: shop-internal
  annotations:
    service.beta.kubernetes.io/azure-load-balancer-internal: "true"
spec:
  type: LoadBalancer
  selector:
    app: shop-api
  ports:
    - port: 80
      targetPort: 8080
```

A `LoadBalancer` service creates a real Azure load balancer, and the annotation makes it internal so the address comes from the subnet rather than the internet.

Each `LoadBalancer` service creates its own rule, so prefer one ingress controller over many load balancer services.

## Workload identity

The modern way for a pod to authenticate to Azure. No secret exists anywhere.

```bash
az aks update --name aks-shop --resource-group rg-shop-prod-uks \
  --enable-oidc-issuer --enable-workload-identity

OIDC_URL=$(az aks show --name aks-shop --resource-group rg-shop-prod-uks \
  --query oidcIssuerProfile.issuerUrl -o tsv)

az identity create --name id-shop-api --resource-group rg-shop-prod-uks

CLIENT_ID=$(az identity show --name id-shop-api --resource-group rg-shop-prod-uks --query clientId -o tsv)
PRINCIPAL_ID=$(az identity show --name id-shop-api --resource-group rg-shop-prod-uks --query principalId -o tsv)

az identity federated-credential create \
  --name fc-shop-api --identity-name id-shop-api \
  --resource-group rg-shop-prod-uks \
  --issuer "$OIDC_URL" \
  --subject "system:serviceaccount:shop:shop-api" \
  --audience api://AzureADTokenExchange

az role assignment create --assignee-object-id "$PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" \
  --scope /subscriptions/.../vaults/kv-shop-prod
```

The federated credential's `subject` binds one Kubernetes service account, in one namespace, to that identity. Nothing else in the cluster can use it.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: shop-api
  namespace: shop
  annotations:
    azure.workload.identity/client-id: "REPLACE_WITH_CLIENT_ID"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop-api
  namespace: shop
spec:
  template:
    metadata:
      labels:
        app: shop-api
        azure.workload.identity/use: "true"
    spec:
      serviceAccountName: shop-api
      containers:
        - name: shop-api
          image: acrshop.azurecr.io/shop-api:1.4.0
```

The `azure.workload.identity/use: "true"` **label on the pod template** is required, and forgetting it is the usual cause of workload identity not working. The annotation on the service account alone does nothing.

In the application, `DefaultAzureCredential` picks it up with no code change.

**Pod managed identity, the older add on, is retired.** Anything still using it needs moving to workload identity.

## Secrets from Key Vault

```bash
az aks enable-addons --name aks-shop --resource-group rg-shop-prod-uks \
  --addons azure-keyvault-secrets-provider --enable-secret-rotation
```

```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: kv-shop
  namespace: shop
spec:
  provider: azure
  parameters:
    clientID: "REPLACE_WITH_CLIENT_ID"
    keyvaultName: kv-shop-prod
    tenantId: "REPLACE_WITH_TENANT_ID"
    objects: |
      array:
        - |
          objectName: stripe-key
          objectType: secret
```

Secrets are mounted as files rather than living in Kubernetes secrets, which are only base64 encoded in etcd. With rotation enabled, updating the secret in Key Vault updates the mounted file.

## Private clusters

```bash
az aks create --name aks-shop --resource-group rg-shop-prod-uks \
  --enable-private-cluster \
  --private-dns-zone system \
  --enable-managed-identity --generate-ssh-keys
```

The API server has no public endpoint, so `kubectl` only works from inside the network or over VPN. It also means your CI agent must be inside the network, which is worth planning before enabling it.

## Debugging

```bash
kubectl get svc -o wide
kubectl describe ingress shop
kubectl get networkpolicy -A
kubectl logs -n app-routing-system -l app=nginx

kubectl run debug --rm -it --image=nicolaka/netshoot -- /bin/bash
```

A netshoot pod gives `dig`, `curl`, `tcpdump` and `nslookup` inside the cluster network, which is the fastest way to answer "can this pod actually reach that".

## Quick recap

- Azure CNI Overlay is the default choice, because traditional CNI exhausts vnet addresses quickly.
- Cilium must be chosen at creation, and is the better dataplane for new clusters.
- Start network policy with a default deny, and remember to allow DNS on port 53.
- The managed NGINX add on removes the burden of owning an ingress controller.
- Workload identity binds one service account in one namespace to one Azure identity.
- The `azure.workload.identity/use` label on the pod template is required, and forgetting it is the usual failure.
- Pod managed identity is retired, so migrate anything still using it.

<code id="code-content" class="language-bash">
# NETWORK PLUGIN AFFECTS ADDRESS PLANNING PERMANENTLY. The arithmetic:
#   traditional Azure CNI, 100 nodes x 30 pods = 3,000 VNET ADDRESSES
#   overlay,               100 nodes           = 100 vnet addresses
# Exhaustion arrives long before you expect it, and fixing it means
# REBUILDING THE CLUSTER. Overlay is the default choice. kubenet is legacy,
# retired March 2028.
az aks create --name aks-shop --resource-group rg-shop-prod-uks \
  --network-plugin azure --network-plugin-mode overlay \
  --pod-cidr 192.168.0.0/16 --service-cidr 10.100.0.0/16 \
  --dns-service-ip 10.100.0.10 --network-dataplane cilium
# Cilium uses eBPF instead of iptables. Faster at scale, better policy and
# observability. MUST BE SET AT CREATION.
# NETWORK POLICY: by default EVERY pod can reach every other pod. Start
# with a default deny in the namespace, then allow. The other order means
# the deny never actually happens.
#   kind: NetworkPolicy, podSelector: {}, policyTypes: [Ingress]
# DO NOT FORGET DNS. A default deny egress that omits port 53 to kube-system
# breaks every name lookup, and it looks like everything broke at once.
# MANAGED INGRESS, so you do not own NGINX upgrades:
az aks approuting enable --name aks-shop --resource-group rg-shop-prod-uks
# Each LoadBalancer service creates its own Azure rule, so prefer ONE
# ingress controller over many LoadBalancer services.
# WORKLOAD IDENTITY: a pod authenticates to Azure with NO SECRET ANYWHERE.
az aks update --name aks-shop --resource-group rg-shop-prod-uks \
  --enable-oidc-issuer --enable-workload-identity
OIDC_URL=$(az aks show --name aks-shop --resource-group rg-shop-prod-uks \
  --query oidcIssuerProfile.issuerUrl -o tsv)
az identity create --name id-shop-api --resource-group rg-shop-prod-uks
# The SUBJECT binds ONE service account in ONE namespace to this identity.
# Nothing else in the cluster can use it.
az identity federated-credential create --name fc-shop-api \
  --identity-name id-shop-api --resource-group rg-shop-prod-uks \
  --issuer "$OIDC_URL" --subject "system:serviceaccount:shop:shop-api" \
  --audience api://AzureADTokenExchange
# THEN, IN THE MANIFEST, TWO THINGS ARE REQUIRED:
#   ServiceAccount annotation:  azure.workload.identity/client-id: &lt;CLIENT_ID&gt;
#   POD TEMPLATE LABEL:         azure.workload.identity/use: "true"
# FORGETTING THE LABEL IS THE USUAL CAUSE OF THIS NOT WORKING. The
# annotation alone does nothing. In code, DefaultAzureCredential just works.
# POD MANAGED IDENTITY (the older add on) IS RETIRED. Migrate off it.
# SECRETS AS MOUNTED FILES, rather than Kubernetes secrets which are only
# base64 encoded in etcd. With rotation, the file updates automatically.
az aks enable-addons --name aks-shop --resource-group rg-shop-prod-uks \
  --addons azure-keyvault-secrets-provider --enable-secret-rotation
# PRIVATE CLUSTER: no public API endpoint, so kubectl works only from
# inside the network. YOUR CI AGENT MUST BE INSIDE IT TOO. Plan that first.
az aks create --name aks-shop --resource-group rg-shop-prod-uks \
  --enable-private-cluster --private-dns-zone system
# The fastest way to answer "can this pod actually reach that":
kubectl run debug --rm -it --image=nicolaka/netshoot -- /bin/bash
</code></pre>
