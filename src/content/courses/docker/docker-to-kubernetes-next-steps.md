---
publishDate: 2026-10-25T18:30
title: 'From Docker to Kubernetes: What Comes Next'
slug: docker-to-kubernetes-next-steps
metadescription: 'See how your Docker and Compose skills map to Kubernetes, when you actually need it, and how to run notes-api on a local cluster as a first step.'
updateDate: 2026-10-25T18:30
author: ['bishal-biswas']
level: 2
tags: ['docker', 'kubernetes', 'orchestration']
course: docker
---

## When one server is not enough

With Docker and Compose you can build images, run multi-container apps, and deploy them to a server. For many projects, that is all you will ever need.

But some day you may need more:

- your app must keep running even if a whole server dies,
- traffic grows and you need ten copies of the API on five servers,
- you want updates with **zero downtime**, automatically,
- many teams deploy many services to the same machines.

Doing this by hand with Compose on many servers gets hard fast. A tool that runs containers across **many machines** and keeps them in the right state is called a **container orchestrator**. The most popular one by far is **Kubernetes** (often written **K8s**: K, then 8 letters, then s).

In this lesson you will see how your Docker knowledge maps to Kubernetes, when it is worth learning, and how to run `notes-api` on a small local cluster. It is a map for the road ahead, not a full course. A full Kubernetes course on OpenDevDocs is coming soon.

## The big idea: desired state

With Docker, you give **commands**: "run this container", "stop that one". With Kubernetes, you write down the **desired state**: "I want 3 copies of notes-api, version 1.4.2, always". Kubernetes then works all the time to make reality match that description.

Think of a thermostat. You do not turn the heater on and off yourself. You set 21 degrees, and the thermostat does whatever it takes to keep the room at 21 degrees. If a container crashes, or a whole server goes away, Kubernetes notices that reality no longer matches and starts new containers somewhere else.

You already know a small version of this idea: a `compose.yaml` file also describes desired state, and `docker compose up -d` makes it real. Kubernetes does the same thing, but continuously and across many machines.

For the bigger picture of why teams adopt it, read [Why Kubernetes?](/courses/devops/why-kubernetes).

## Your images already work

Here is the best news: **you do not need to change your images**. A Docker image follows a standard format called **OCI** (Open Container Initiative). Kubernetes runs OCI images, so the `ghcr.io/your-name/notes-api:1.4.2` image you pushed in [Building and Pushing Images in GitHub Actions](/courses/docker/docker-in-ci-github-actions) runs on Kubernetes as it is.

> **Note:** Kubernetes does not use Docker Engine to run containers. It talks to a **container runtime** such as **containerd** (which Docker Engine also uses inside). This changed years ago and confused many people, but it does not matter for you: images built with Docker run fine.

Everything you learned about good images matters even more on Kubernetes: small images start faster, health endpoints tell Kubernetes when your app is ready, handling `SIGTERM` lets updates happen without dropped requests, and running as non-root is often required by cluster security rules.

## Mapping Docker words to Kubernetes words

Most Kubernetes ideas have a Docker or Compose idea you already know:

| You know (Docker / Compose) | Kubernetes word | What it is |
|---|---|---|
| Container | Container | The same thing |
| One service's container(s) | **Pod** | One or more containers that always run together on the same machine |
| A service with `deploy.replicas` and updates | **Deployment** | Keeps N copies of a Pod running and handles rolling updates |
| Service name DNS (`db`, `api`) | **Service** | A stable name and address in front of a group of Pods |
| `ports: "8080:80"` | **Service** (type LoadBalancer or NodePort) or **Ingress** | How traffic from outside reaches Pods |
| `environment:` | **ConfigMap** | Non-secret settings |
| `secrets:` | **Secret** | Passwords and keys |
| Named volume | **PersistentVolumeClaim** | A request for storage that survives Pods |
| `HEALTHCHECK` | **liveness** and **readiness probes** | "Is it alive?" and "Can it take traffic?" |
| `restart: unless-stopped` | Built in | Kubernetes always restarts failed containers |
| `compose.yaml` | **Manifests** (YAML files) | The description of desired state |
| `docker compose up -d` | `kubectl apply -f` | Make it so |
| `docker compose logs api` | `kubectl logs` | Read the output |
| `docker compose exec api sh` | `kubectl exec -it ... -- sh` | Run a command inside |
| One server | **Node** | One machine in the cluster |
| Many servers together | **Cluster** | All the nodes, managed as one |

If you understand the left column, you already understand most of the right column. The new parts are mostly about running across many machines.

## Trying it locally

You do not need a cloud account to start. Several tools run a small cluster on your computer:

| Tool | What it is |
|---|---|
| Docker Desktop | Has a built-in Kubernetes. Turn it on in Settings, Kubernetes. |
| **kind** | "Kubernetes in Docker": each node is a Docker container |
| **minikube** | A local cluster in a VM or container, with many add-ons |
| **k3s** | A small, light Kubernetes, also good for real small servers |

All of them give you **kubectl**, the command line tool for Kubernetes. It is to Kubernetes what the `docker` command is to Docker. After enabling Kubernetes in Docker Desktop:

```bash
kubectl get nodes
```

```text
NAME             STATUS   ROLES           AGE   VERSION
docker-desktop   Ready    control-plane   2m    v1.34.1
```

One node, ready to run things.

## notes-api on Kubernetes

Let us run the API only (without the database, to keep it short). You write two objects: a **Deployment** (run 2 copies of the container) and a **Service** (give them one stable address). Both go in one file, `notes-api.yaml`, separated by `---`. The full file is in the code panel. Here is the important part of the Deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notes-api
spec:
  replicas: 2                        # like running 2 copies of the container
  selector:
    matchLabels:
      app: notes-api
  template:                          # the Pod template: what each copy looks like
    metadata:
      labels:
        app: notes-api
    spec:
      containers:
        - name: api
          image: ghcr.io/your-name/notes-api:1.4.2   # the same image as before
          ports:
            - containerPort: 3000
          readinessProbe:            # like HEALTHCHECK: only send traffic when /health works
            httpGet:
              path: /health
              port: 3000
```

Notice how familiar it is: an image, a port, a health check, environment variables. The Docker ideas are all there, in a different shape.

Apply it and look:

```bash
kubectl apply -f notes-api.yaml
kubectl get pods
```

```text
NAME                         READY   STATUS    RESTARTS   AGE
notes-api-7d9c5b8f6d-4xk2p   1/1     Running   0          12s
notes-api-7d9c5b8f6d-qm8rt   1/1     Running   0          12s
```

Two Pods, two copies of your container. Reach the Service from your computer with a temporary tunnel:

```bash
kubectl port-forward service/notes-api 8080:80
curl http://localhost:8080/health
```

```text
ok
```

### See desired state in action

Delete one Pod on purpose:

```bash
kubectl delete pod notes-api-7d9c5b8f6d-4xk2p
kubectl get pods
```

```text
NAME                         READY   STATUS    RESTARTS   AGE
notes-api-7d9c5b8f6d-qm8rt   1/1     Running   0          2m
notes-api-7d9c5b8f6d-zt5wn   1/1     Running   0          3s
```

You asked for 2, so Kubernetes made a new one in seconds. Now change the version and apply again:

```bash
kubectl set image deployment/notes-api api=ghcr.io/your-name/notes-api:1.4.3
kubectl rollout status deployment/notes-api
```

Kubernetes starts new Pods, waits until their readiness probe passes, and only then removes old ones. That is a **rolling update** with no downtime, something you had to plan carefully with Compose in [Deploying a Compose App to a Linux Server](/courses/docker/deploying-with-docker-on-a-server). Going back is one command: `kubectl rollout undo deployment/notes-api`.

Clean up when you are done:

```bash
kubectl delete -f notes-api.yaml
```

## Converting a compose file

A tool called **Kompose** can turn a `compose.yaml` into Kubernetes manifests:

```bash
kompose convert -f compose.yaml
```

It is a helpful way to see how your services translate. But treat the output as a **first draft**: you will still want to add probes, resource limits and proper secrets yourself.

## Do you actually need Kubernetes?

Kubernetes is powerful, but it is also a lot to learn and to run. Be honest about your needs:

| Situation | Good fit |
|---|---|
| A side project, a small business app, one team | Compose on one server |
| You need a bit more, but want to stay simple | Compose on a server, plus good backups and monitoring |
| Several servers, high availability, many services | Kubernetes, ideally a managed one |
| You just want to run a container, no servers | A managed container service from your cloud provider |

A **managed Kubernetes** service (such as the ones from the big cloud providers) runs the hard parts of the cluster for you. Most teams that adopt Kubernetes use one.

> **Tip:** Docker also has its own simpler orchestrator called **Swarm mode** (`docker swarm init`, `docker stack deploy`). It can run compose-style files across several servers. It is far less popular than Kubernetes today, but it is still an option for small clusters.

## What to learn next

If you decide to go further, here is a sensible order:

1. **Core objects:** Pods, Deployments, Services, ConfigMaps, Secrets.
2. **kubectl** everyday commands: `get`, `describe`, `logs`, `exec`, `apply`, `delete`.
3. **Probes and resources:** readiness, liveness, CPU and memory requests and limits.
4. **Ingress** for HTTP routing and TLS.
5. **Storage:** PersistentVolumeClaims, and why databases are often run outside the cluster.
6. **Packaging:** Helm charts or Kustomize for managing many YAML files.
7. **CI/CD to Kubernetes**, building on [Continuous Delivery vs Continuous Deployment](/courses/devops/continuous-delivery-vs-deployment).

The Docker skills from this course (good images, health checks, graceful shutdown, non-root users, small bases, secrets at run time) are exactly what makes apps run well on Kubernetes.

## Common mistakes

### Moving to Kubernetes too early

Kubernetes solves problems of scale and teams. If you have one small app, it adds work without adding much value. Start with Compose, and move when you feel real pain.

### Thinking you must rebuild your images

You do not. The same OCI image runs on Docker and on Kubernetes.

### Skipping health endpoints and graceful shutdown

Kubernetes relies on probes and on `SIGTERM` handling for safe updates. An app without `/health` and without a shutdown handler will drop requests during every update. Your `notes-api` already has both, thanks to [Health Checks](/courses/docker/healthchecks) and [Graceful Shutdown](/courses/nodejs/graceful-shutdown).

## Quick recap

- A **container orchestrator** runs containers across many machines; **Kubernetes** is the most popular.
- Kubernetes works from **desired state**: you describe what you want, and it keeps reality matching.
- Your Docker images are **OCI images** and run on Kubernetes unchanged.
- Most Kubernetes objects map to Compose ideas: **Pod**, **Deployment**, **Service**, **ConfigMap**, **Secret**, **PersistentVolumeClaim**, **probes**.
- Try it locally with Docker Desktop's Kubernetes, kind, minikube or k3s, using **kubectl**.
- Use Kubernetes when you need it, not by default.

Next, you will put the whole course together in [Capstone: Containerize a Full-Stack App](/courses/docker/capstone-full-stack-app).

<code id="code-content" class="language-yaml">
# notes-api.yaml: notes-api on Kubernetes (a Deployment plus a Service)
# Apply:   kubectl apply -f notes-api.yaml
# Check:   kubectl get pods
# Try it:  kubectl port-forward service/notes-api 8080:80, then curl http://localhost:8080/health
# Remove:  kubectl delete -f notes-api.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notes-api
spec:
  # Desired state: always keep 2 copies running
  replicas: 2
  selector:
    matchLabels:
      app: notes-api
  template:
    metadata:
      labels:
        app: notes-api
    spec:
      containers:
        - name: api
          # The exact same image you built and pushed with Docker
          image: ghcr.io/your-name/notes-api:1.4.2
          ports:
            - containerPort: 3000
          env:
            - name: PORT
              value: "3000"
          # Like a Docker HEALTHCHECK: send traffic only when /health answers
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 3
            periodSeconds: 10
          # Restart the container if /health stops answering
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 20
          # Like --memory and --cpus in docker run
          resources:
            requests:
              cpu: 100m
              memory: 64Mi
            limits:
              memory: 256Mi
          # Like USER node and --security-opt no-new-privileges
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            allowPrivilegeEscalation: false
---
# A Service gives the Pods one stable name and address, like a Compose service name
apiVersion: v1
kind: Service
metadata:
  name: notes-api
spec:
  selector:
    app: notes-api
  ports:
    # Port 80 on the Service forwards to port 3000 in the containers
    - port: 80
      targetPort: 3000
</code></pre>
