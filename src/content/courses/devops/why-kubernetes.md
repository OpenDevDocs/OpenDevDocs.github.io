---
publishDate: 2026-10-25T11:55
title: 'Why Kubernetes? Container Orchestration Concepts'
slug: why-kubernetes
metadescription: Learn what container orchestration solves, how Kubernetes works with desired state and reconciliation, its architecture, pods, deployments, services, probes and resources, and when Kubernetes is or is not the right choice.
updateDate: 2026-10-25T11:55
author: ['bishal-biswas']
level: 2
tags: ['devops', 'kubernetes', 'containers', 'orchestration']
course: devops
---

## From one server to many

With [Docker Compose](/courses/devops/docker-compose-basics), running a few containers on one server is easy. Now imagine your product grows: 30 services, each needing several copies, spread across 20 servers. Suddenly there are a lot of questions nobody wants to answer by hand, at 3 a.m.:

- **Placement:** which server has enough free CPU and memory for this container?
- **Self-healing:** a container crashed. Who restarts it? A whole **server** died. Who moves its containers elsewhere?
- **Scaling:** traffic tripled. Who starts more copies, and who removes them later?
- **Updates:** how do we roll out a new version with no downtime, and roll back if it is bad?
- **Discovery and load balancing:** containers come and go with new IP addresses. How do the others find them?
- **Configuration and secrets:** how does each container get the right settings for its environment?

A **container orchestrator** answers all of these automatically. The one that won, by a long way, is **Kubernetes**.

> **Note:** This lesson explains the concepts and gives you a first hands-on taste. A full **Kubernetes** course on OpenDevDocs, covering everything from your first pod to Helm and GitOps, is coming soon.

## What is Kubernetes?

**Kubernetes** (from the Greek for "helmsman" or "pilot", and often shortened to **K8s**, because there are eight letters between the K and the s) is an open-source system for running containers across a group of machines.

It grew out of **Borg**, the system Google used internally for over a decade to run its own services. Google announced Kubernetes in 2014, released version 1.0 in 2015, and gave it to the newly formed **Cloud Native Computing Foundation** (CNCF), which looks after it today. Every major cloud now offers it as a managed service.

## The big idea: desired state

The most important idea in Kubernetes is not a feature. It is a way of working.

With Docker you give **commands**: "run this container", "stop that one". With Kubernetes you describe the **desired state**: "there should always be 3 copies of `recipe-api:1.0.0` running, each with 128 MB of memory reserved". You hand that description to Kubernetes, and it is Kubernetes' job to make reality match, and **keep** it matching.

Think of a **thermostat**. You do not tell the heater "turn on for 20 minutes". You set the desired temperature, 21°C, and the thermostat keeps checking and adjusting, forever. Open a window and it compensates. That is exactly how Kubernetes works.

Inside Kubernetes, small programs called **controllers** each run a **reconciliation loop**:

```text
forever:
    desired = what the YAML says        (3 copies of recipe-api)
    actual  = what is really running    (2 copies: one just crashed)
    if actual != desired:
        take action to close the gap    (start 1 more copy)
```

This is why Kubernetes **self-heals**. A crashed container, a deleted pod, a dead server: all of them are just "actual no longer matches desired", and the controllers fix it without anyone being paged.

It also fits DevOps perfectly. The desired state is a YAML file, so it lives in **Git**, is reviewed in pull requests and can be applied automatically by a pipeline or a GitOps tool, as you saw in [Continuous Delivery vs Continuous Deployment](/courses/devops/continuous-delivery-vs-deployment).

## Architecture

A Kubernetes **cluster** is a group of machines, called **nodes**, split into two roles:

```text
                 CONTROL PLANE  (the brain)
   +-----------------------------------------------------+
   |  API server  <-- kubectl, pipelines, other tools    |
   |  etcd        the database of desired + actual state |
   |  scheduler   decides which node runs each pod       |
   |  controllers reconciliation loops                   |
   +-----------------------------------------------------+
            |                 |                 |
     WORKER NODE 1     WORKER NODE 2     WORKER NODE 3   (the muscle)
     kubelet           kubelet           kubelet
     container runtime container runtime container runtime
     kube-proxy        kube-proxy        kube-proxy
     [pod] [pod]       [pod] [pod]       [pod]
```

- The **API server** is the front door. Everything, including `kubectl` on your laptop, talks to Kubernetes through it.
- **etcd** is a reliable key-value database storing the whole cluster's state.
- The **scheduler** picks a node for each new pod, based on the resources it asks for and what is free.
- **Controllers** run the reconciliation loops.
- On every worker node, the **kubelet** makes sure the containers that should run there are running, using a **container runtime** such as containerd; **kube-proxy** handles the networking for services.

With a **managed** Kubernetes service (Amazon EKS, Azure AKS, Google GKE and others), the cloud provider runs the control plane for you. You mostly care about your workloads.

## The core objects

You describe the desired state using Kubernetes **objects**, each written as YAML. These are the ones to know first:

| Object | What it is | Compose equivalent |
|---|---|---|
| **Pod** | The smallest unit: one container (sometimes a few tightly coupled ones) sharing a network address | A running container |
| **Deployment** | "Keep N identical pods of this template running, and roll out changes gradually" | A service with replicas |
| **Service** | A stable name and virtual IP that load-balances across matching pods | Service-name DNS |
| **Ingress** / **Gateway** | HTTP routing from outside the cluster: hosts, paths, TLS | A reverse proxy in front |
| **ConfigMap** | Non-secret configuration, as environment variables or files | `environment:` |
| **Secret** | Sensitive configuration, such as passwords and keys | `.env` values |
| **Namespace** | A named area inside a cluster, to separate teams or environments | A separate project |
| **PersistentVolumeClaim** | A request for storage that outlives pods | A named volume |

You rarely create pods directly. You create a **Deployment**, and it creates and replaces pods for you. Objects find each other by **labels**: a Deployment labels its pods `app: recipe-api`, and a Service sends traffic to "every pod with the label `app: recipe-api`", however many there are and wherever they run.

## Your first deployment

The code panel for this lesson has a manifest that runs the `recipe-api` image you built in [Docker Essentials](/courses/devops/docker-essentials) on Kubernetes: a **Deployment** with three replicas, and a **Service** in front of them.

To try it, you need a cluster. On your laptop, the easiest options are **kind** (Kubernetes in Docker), **minikube**, **k3d**, or the Kubernetes switch in Docker Desktop's settings. You also need **kubectl**, the command-line tool. Then:

```bash
kubectl apply -f recipe-api.yaml
kubectl get pods
```

```text
NAME                          READY   STATUS    RESTARTS   AGE
recipe-api-6d9f7c8b5d-4xk2p   1/1     Running   0          20s
recipe-api-6d9f7c8b5d-9hq7m   1/1     Running   0          20s
recipe-api-6d9f7c8b5d-tz5wn   1/1     Running   0          20s
```

> **Tip:** The manifest uses the image name `ghcr.io/your-name/recipe-api:1.0.0`. Replace it with the image you pushed. On a local **kind** cluster you can instead load your local image with `kind load docker-image recipe-api:1.0.0` and use that name.

Reach the service from your laptop with a temporary tunnel:

```bash
kubectl port-forward service/recipe-api 8080:80
curl "http://localhost:8080/total?prices=100,250"
```

```text
{"total":350}
```

### Watch it self-heal

Delete a pod, as if it had crashed, and look again straight away:

```bash
kubectl delete pod recipe-api-6d9f7c8b5d-4xk2p
kubectl get pods
```

```text
NAME                          READY   STATUS    RESTARTS   AGE
recipe-api-6d9f7c8b5d-9hq7m   1/1     Running   0          3m
recipe-api-6d9f7c8b5d-tz5wn   1/1     Running   0          3m
recipe-api-6d9f7c8b5d-w8r2c   1/1     Running   0          4s
```

The Deployment's controller noticed there were two pods instead of three and created a replacement within seconds. Nobody had to do anything.

### Scale, update and roll back

```bash
kubectl scale deployment recipe-api --replicas=5        # more copies, right now

kubectl set image deployment/recipe-api api=ghcr.io/your-name/recipe-api:1.1.0
kubectl rollout status deployment/recipe-api            # watch the rolling update
kubectl rollout undo deployment/recipe-api              # something wrong? go back
```

The update is a **rolling deployment**, the default strategy from [Deployment Strategies](/courses/devops/deployment-strategies): with `maxSurge: 1` and `maxUnavailable: 0`, Kubernetes starts one new pod, waits until it is **ready**, removes one old pod, and repeats. In a real project, you would change the image tag in the YAML file in Git and apply it from your pipeline, rather than typing `set image`.

## Probes: is it alive, is it ready?

Kubernetes needs to know whether your app is working, not just whether its process exists. The manifest defines two **probes**, both calling the `/health` endpoint:

| Probe | Question | If it fails |
|---|---|---|
| **Readiness** | "Can this pod handle traffic **right now**?" | The pod is taken out of the Service's load balancing, but left running |
| **Liveness** | "Is this pod still working **at all**?" | Kubernetes restarts the container |

Readiness probes are what make rolling updates safe: a new pod receives no traffic until it says it is ready. There is also a **startup** probe for apps that take a long time to boot.

## Resources: requests and limits

```yaml
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              memory: 256Mi
```

- **Requests** are what the scheduler **reserves** for the container when it chooses a node. `100m` means 100 "millicores", a tenth of one CPU core.
- **Limits** are the most it may use. A container that goes over its **memory** limit is killed and restarted (you will see `OOMKilled`, out of memory). CPU over the limit is slowed down instead.

Always set requests, so the scheduler can place pods sensibly. Without them, one hungry app can starve everything else on its node.

## Getting traffic in from outside

A Service's default type, **ClusterIP**, is only reachable inside the cluster. To let users in:

- **LoadBalancer** Services ask your cloud provider for a real [load balancer](/courses/devops/reverse-proxies-and-load-balancers) with a public IP.
- **Ingress** (and its newer, more flexible successor, the **Gateway API**) routes HTTP traffic by host name and path to different Services, and terminates TLS, usually with certificates managed automatically by **cert-manager** and Let's Encrypt.

## The ecosystem

Kubernetes is the centre of a large ecosystem, much of it also run by the CNCF:

- **Helm** packages applications as reusable, configurable "charts".
- **Argo CD** and **Flux** do **GitOps**: they keep the cluster in sync with a Git repository.
- **Prometheus** and **Grafana** monitor clusters and apps ([Monitoring, Logging and Alerting](/courses/devops/monitoring-logging-and-alerting)).
- **Argo Rollouts** and **Flagger** add automated canary releases.

## When not to use Kubernetes

Kubernetes is powerful, but it is also **complex**. It adds many new concepts, needs ongoing upgrades and security patching, and takes real skill to run well. For many teams it is the wrong first choice:

| Situation | Often a better fit |
|---|---|
| One app, modest traffic, small team | Docker Compose on one VM, with backups and a reverse proxy |
| You want to run containers without managing servers | A managed container platform: Google Cloud Run, Azure Container Apps, AWS ECS with Fargate, Fly.io, Render |
| A website or simple API | A Platform-as-a-Service such as Azure App Service, Heroku or Vercel |

Kubernetes earns its complexity when you have **many services**, **several teams**, real needs for **scaling and resilience**, or you want **one consistent platform** across clouds and environments. Many companies reach that point; many never do. Both are fine. Choose by the problems you actually have, as you learned in [The DevOps Roadmap and Toolchain](/courses/devops/devops-roadmap-and-toolchain).

## Common misunderstandings

### "Kubernetes replaces Docker"

Kubernetes runs **containers**; it does not build them. You still build images with Docker (or another OCI tool) and push them to a registry. Kubernetes then pulls and runs them, using a runtime such as containerd under the hood.

### "Kubernetes Secrets are encrypted"

By default, Secret values are only **base64-encoded**, which is not encryption: anyone who can read the object can decode them. Restrict who can read Secrets, turn on encryption at rest, or use an external secrets manager. More in [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets).

### "If it runs on Kubernetes, it is automatically highly available"

Only if you give it what it needs: several replicas, readiness probes, enough nodes, and an app that is **stateless** (as you learned with load balancers). One replica on one node is no more available than a single server.

## Quick recap

- A **container orchestrator** handles placement, self-healing, scaling, updates, discovery and config across many machines.
- **Kubernetes** (K8s) works by **desired state**: controllers run **reconciliation loops** to make reality match your YAML.
- A cluster has a **control plane** (API server, etcd, scheduler, controllers) and **worker nodes** (kubelet, container runtime).
- Key objects: **Pod**, **Deployment**, **Service**, **Ingress/Gateway**, **ConfigMap**, **Secret**, **Namespace**.
- **Readiness** and **liveness probes** and **resource requests and limits** make apps safe to schedule and update.
- Kubernetes is powerful but complex: simpler platforms are often a better start.

That completes **Containers and Orchestration**. Next, you will learn where all these servers come from in [Cloud Computing Basics: IaaS, PaaS and SaaS](/courses/devops/cloud-computing-basics).

<code id="code-content" class="language-yaml">
# recipe-api.yaml: run recipe-api on Kubernetes.
# Apply:  kubectl apply -f recipe-api.yaml
# Check:  kubectl get deployments,pods,services
# ---------- Deployment: "keep 3 copies running, and update them gradually" ----------
apiVersion: apps/v1
kind: Deployment
metadata:
  name: recipe-api
  labels:
    app: recipe-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: recipe-api                    # this Deployment manages pods with this label
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1                        # at most 1 extra pod during an update
      maxUnavailable: 0                  # never fewer than 3 ready pods
  template:                              # the blueprint for every pod
    metadata:
      labels:
        app: recipe-api
    spec:
      containers:
        - name: api
          image: ghcr.io/your-name/recipe-api:1.0.0   # a specific tag, never "latest"
          ports:
            - containerPort: 3000
          env:
            - name: PORT
              value: "3000"
          resources:
            requests:                    # what the scheduler reserves on a node
              cpu: 100m                  # a tenth of a CPU core
              memory: 128Mi
            limits:
              memory: 256Mi              # above this, the container is restarted
          readinessProbe:                # "ready for traffic?" Not ready = no requests sent
            httpGet:
              path: /health
              port: 3000
            periodSeconds: 5
          livenessProbe:                 # "still alive?" Keeps failing = restarted
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000              # the "node" user; needed because USER is a name
            allowPrivilegeEscalation: false
---
# ---------- Service: one stable name and address in front of all the pods ----------
apiVersion: v1
kind: Service
metadata:
  name: recipe-api
spec:
  selector:
    app: recipe-api                      # send traffic to pods with this label
  ports:
    - port: 80                           # other pods call http://recipe-api
      targetPort: 3000                   # ...which reaches port 3000 in a pod
</code></pre>
