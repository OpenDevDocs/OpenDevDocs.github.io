---
title: MongoDB on Kubernetes with the Operator
slug: mongodb-on-kubernetes
metadescription: Learn how to run a MongoDB replica set on Kubernetes using the MongoDB Controllers for Kubernetes operator, with a small, beginner-friendly YAML manifest.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 4
tags: ['mongodb', 'kubernetes', 'operator', 'devops']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- The few **Kubernetes** words you need: pod, StatefulSet, persistent volume and custom resource
- Why databases on Kubernetes need an **operator**
- Which MongoDB operator to use today: **MongoDB Controllers for Kubernetes**
- How to install it and deploy a three-member replica set with one YAML file
- How to connect, scale and upgrade the replica set safely

> **Before you start:** this lesson assumes you've read [Replica Sets and Elections](/courses/mongodb/replica-sets) and [TLS, Authentication and Network Security](/courses/mongodb/tls-and-authentication). To follow along you need a Kubernetes cluster (a local one made with *kind* or *minikube* is fine), plus `kubectl` and `helm`.

## Kubernetes in five words

**Kubernetes** (often written *K8s*) is a system that runs containers on a group of machines and keeps them running. You describe what you want in YAML files, and Kubernetes makes it happen.

Here are the only words you need for this lesson:

| Word | Plain meaning |
| --- | --- |
| **Pod** | One running copy of a container (here, one `mongod`). |
| **StatefulSet** | A group of pods that each keep a fixed name (`my-db-0`, `my-db-1`, ...) and their own disk. Perfect for databases. |
| **Persistent volume (PV/PVC)** | A disk that survives when a pod restarts or moves to another machine. |
| **Secret** | A small object for storing passwords and keys. |
| **Custom resource** | A new kind of YAML object that a plugin teaches Kubernetes to understand. |

## Why an operator?

Kubernetes is great at running **stateless** apps: if a web server pod dies, start another one, done.

A database is different. A MongoDB replica set needs:

- Each member to know the others' addresses
- A replica set to be **initiated** once, and reconfigured when members change
- Users and passwords created inside the database
- **Rolling upgrades**: one member at a time, secondaries first, then the primary
- Disks that never get mixed up between members

Plain Kubernetes doesn't know any of this. An **operator** is a program that runs inside your cluster and does these database chores for you. You tell it "I want a 3-member MongoDB 8.0 replica set", and it keeps reality matching that wish.

> **Think of it like this:** Kubernetes is a building's caretaker. It keeps the lights on and replaces broken bulbs. An operator is a specialist librarian hired for the library on the third floor. It knows how the books must be arranged, how to add a new shelf without losing anything, and how to swap old catalogues for new ones one at a time.

## Which MongoDB operator?

There used to be two separate operators: the **MongoDB Community Operator** and the **MongoDB Enterprise Kubernetes Operator**. They have been replaced by one project:

**MongoDB Controllers for Kubernetes (MCK)**, an open-source operator (version **1.14** at the time of writing).

MCK understands several custom resources. The two you are most likely to meet:

| Kind | What it deploys | Needs |
| --- | --- | --- |
| `MongoDBCommunity` | A MongoDB **Community Edition** replica set | Nothing else, free |
| `MongoDB` | MongoDB **Enterprise** deployments (replica sets, sharded clusters) | Ops Manager or Cloud Manager, and an Enterprise licence for production |

In this lesson we use `MongoDBCommunity`, because anyone can run it.

> **Note:** Don't confuse MCK with the **Atlas Kubernetes Operator**. That one does not run MongoDB inside your cluster. It lets you create and manage **Atlas** clusters, users and projects using Kubernetes YAML.

## Step 1: install the operator

The operator needs its **CRDs** (*Custom Resource Definitions*, which teach Kubernetes the new kinds) and then the operator itself. With Helm, using MongoDB's OCI chart registry:

```bash
# 1. Install the custom resource definitions
kubectl apply -f https://raw.githubusercontent.com/mongodb/mongodb-kubernetes/1.14.0/public/crds.yaml

# 2. Install the operator into its own namespace
helm upgrade --install mongodb-kubernetes-operator \
  oci://quay.io/mongodb/helm-charts/mongodb-kubernetes \
  --namespace mongodb \
  --create-namespace
```

Check that it is running:

```bash
kubectl get pods -n mongodb
```

```text
NAME                                           READY   STATUS    RESTARTS   AGE
mongodb-kubernetes-operator-6b8f7c9d5c-x2lqp   1/1     Running   0          40s
```

> **Tip:** Replace `1.14.0` with the latest MCK release when you read this, and keep the CRD version and the chart version the same.

## Step 2: create a password Secret

The replica set will have an admin user. Its password lives in a Kubernetes Secret, not in the main YAML file:

```yaml
# admin-password.yaml
apiVersion: v1
kind: Secret
metadata:
  name: mdb-admin-user-password
  namespace: mongodb
type: Opaque
stringData:
  password: change-me-to-something-long
```

```bash
kubectl apply -f admin-password.yaml
# → secret/mdb-admin-user-password created
```

> **Warning:** Never commit real passwords to Git. In real projects, create Secrets from a secret manager (or a tool such as Sealed Secrets or External Secrets) instead of a plain file.

## Step 3: describe the replica set

Now the main manifest. This is the smallest useful `MongoDBCommunity` resource:

```yaml
# shop-mongodb.yaml
apiVersion: mongodbcommunity.mongodb.com/v1
kind: MongoDBCommunity
metadata:
  name: shop-mongodb
  namespace: mongodb
spec:
  type: ReplicaSet
  members: 3
  version: "8.0.0"
  security:
    authentication:
      modes: ["SCRAM"]
  users:
    - name: mdb-admin
      db: admin
      passwordSecretRef:
        name: mdb-admin-user-password
      scramCredentialsSecretName: mdb-admin-user
      roles:
        - name: root
          db: admin
  statefulSet:
    spec:
      template:
        spec:
          containers:
            - name: mongod
              resources:
                requests:
                  cpu: "500m"
                  memory: 1Gi
                limits:
                  cpu: "1"
                  memory: 2Gi
```

Let's read it top to bottom:

- `apiVersion` and `kind` tell Kubernetes this is a MongoDB Community resource, handled by the operator.
- `type: ReplicaSet` and `members: 3` ask for a three-member replica set.
- `version` is the MongoDB server version. Use the latest **8.0** patch release.
- `security.authentication.modes: ["SCRAM"]` turns on username and password login.
- `users` creates `mdb-admin` with the `root` role. The password comes from our Secret. The operator stores the generated login credentials in a Secret called `mdb-admin-user` (you don't create that one).
- `statefulSet` lets you add normal Kubernetes settings. Here we set CPU and memory for the `mongod` container.

> **Note:** For self-managed and Kubernetes deployments, stick to **major releases** like 8.0 (this course targets the 8.x line). MongoDB says minor releases such as 8.2 and 8.3 are offered outside Atlas only for specific use cases (like Search and Vector Search). See [Upgrading to MongoDB 8.3](/courses/mongodb/upgrading-to-mongodb-8-3).

## Step 4: deploy it

```bash
kubectl apply -f shop-mongodb.yaml
# → mongodbcommunity.mongodbcommunity.mongodb.com/shop-mongodb created
```

The operator now creates a StatefulSet, three pods with their own disks, initiates the replica set and creates the user. Watch it:

```bash
kubectl get mongodbcommunity -n mongodb --watch
```

```text
NAME           PHASE     VERSION
shop-mongodb   Pending
shop-mongodb   Running   8.0.0
```

```bash
kubectl get pods -n mongodb
```

```text
NAME                                           READY   STATUS    AGE
mongodb-kubernetes-operator-6b8f7c9d5c-x2lqp   1/1     Running   6m
shop-mongodb-0                                 2/2     Running   3m
shop-mongodb-1                                 2/2     Running   2m
shop-mongodb-2                                 2/2     Running   1m
```

Each pod shows `2/2` because it runs two containers: `mongod` and a small **agent** that the operator uses to configure it.

## Step 5: connect

The operator writes ready-made connection strings into a Secret named `<resource>-<auth-db>-<user>`. For us that is `shop-mongodb-admin-mdb-admin`:

```bash
kubectl get secret shop-mongodb-admin-mdb-admin -n mongodb \
  -o jsonpath="{.data.connectionString\.standardSrv}" | base64 -d
```

```text
mongodb+srv://mdb-admin:...@shop-mongodb-svc.mongodb.svc.cluster.local/admin?replicaSet=shop-mongodb...
```

> **Tip:** If you can't find the Secret, list them with `kubectl get secrets -n mongodb`. You can also choose your own name by adding `connectionStringSecretName` to the user entry.

That address only works **inside** the Kubernetes cluster. Your app pods can use it directly. In your app's Deployment, read it from the Secret as an environment variable:

```yaml
env:
  - name: MONGODB_URI
    valueFrom:
      secretKeyRef:
        name: shop-mongodb-admin-mdb-admin
        key: connectionString.standardSrv
```

To poke around from your laptop, open a shell inside a member:

```bash
kubectl exec -it shop-mongodb-0 -n mongodb -c mongod -- mongosh -u mdb-admin -p --authenticationDatabase admin
```

```javascript
rs.status().members.map((m) => `${m.name} ${m.stateStr}`)
// → [ 'shop-mongodb-0.shop-mongodb-svc...:27017 PRIMARY',
//     'shop-mongodb-1.shop-mongodb-svc...:27017 SECONDARY',
//     'shop-mongodb-2.shop-mongodb-svc...:27017 SECONDARY' ]
```

> **Tip:** In real apps, create a separate user with only the roles your app needs (for example `readWrite` on `shop`), instead of using `root`. Add it as another entry under `users`.

## Day-two operations

"Day two" means everything after the first install. This is where the operator really pays off.

### Scale up

Change `members: 3` to `members: 5` and apply again:

```bash
kubectl apply -f shop-mongodb.yaml
```

The operator adds two pods and reconfigures the replica set. You don't run `rs.add()` yourself.

### Upgrade a patch version

Change `version: "8.0.0"` to a newer 8.0 patch and apply. The operator does a **rolling upgrade**: it restarts the secondaries one by one with the new version, then steps down the primary and upgrades it last. Your app sees, at most, a short election.

> **Warning:** Before a big version jump, read the upgrade notes for that version and test in a staging namespace first. The [Upgrading to MongoDB 8.3](/courses/mongodb/upgrading-to-mongodb-8-3) lesson walks through the general steps.

### Storage and backups

- Each member gets a **PersistentVolumeClaim**. Deleting the `MongoDBCommunity` resource does **not** delete those disks by default, which protects your data from accidents.
- The Community resource **does not do backups** for you. Plan them yourself, for example with scheduled `mongodump` jobs or volume snapshots (see [Backups, Snapshots and Point-in-Time Restore](/courses/mongodb/backups-and-restore)). The Enterprise `MongoDB` resource can use Ops Manager or Cloud Manager for backups.

## Common mistakes

- **Running a database on Kubernetes without persistent volumes.** If pods store data on their temporary filesystem, a restart wipes it. Make sure your cluster has a working storage class.
- **Mixing up operators.** Old blog posts use the retired Community Operator chart. Use MongoDB Controllers for Kubernetes (`mongodb-kubernetes`) for new installs.
- **No resource requests or limits.** MongoDB may be squeezed by other pods or killed for using too much memory. Set `requests` and `limits` for the `mongod` container.
- **Using the `root` user in the app.** Create a least-privilege user for each app.
- **Assuming backups are included.** The Community resource doesn't back up your data. Set backups up on day one.

## Practice

1. Change the manifest so the replica set has 5 members and the `mongod` container may use up to 4 GiB of memory.
2. Add a second user `shop-app` with the `readWrite` role on the `shop` database. Its password lives in a Secret called `shop-app-password`.
3. What is the name of the Secret that will hold `shop-app`'s connection string?

<details>
<summary>Show a possible answer</summary>

```yaml
# 1 + 2. Only the changed parts of spec are shown
spec:
  members: 5
  users:
    - name: mdb-admin
      db: admin
      passwordSecretRef:
        name: mdb-admin-user-password
      scramCredentialsSecretName: mdb-admin-user
      roles:
        - name: root
          db: admin
    - name: shop-app
      db: admin
      passwordSecretRef:
        name: shop-app-password
      scramCredentialsSecretName: shop-app-scram
      roles:
        - name: readWrite
          db: shop
  statefulSet:
    spec:
      template:
        spec:
          containers:
            - name: mongod
              resources:
                limits:
                  memory: 4Gi

# 3. <resource>-<auth-db>-<user> → shop-mongodb-admin-shop-app
```

</details>

## Key takeaways

- An **operator** teaches Kubernetes how to run MongoDB: initiating replica sets, creating users, scaling and rolling upgrades.
- The current MongoDB operator is **MongoDB Controllers for Kubernetes (MCK)**. It replaces the old Community and Enterprise operators.
- A `MongoDBCommunity` resource (`apiVersion: mongodbcommunity.mongodb.com/v1`) describes a Community replica set in one small YAML file.
- Passwords live in **Secrets**. The operator writes connection strings into a Secret named `<resource>-<auth-db>-<user>`.
- Change `members` or `version` and re-apply to scale or upgrade. Set resource limits, use persistent volumes, and plan your own backups.

**Next lesson:** [Upgrading to MongoDB 8.3](/courses/mongodb/upgrading-to-mongodb-8-3)
