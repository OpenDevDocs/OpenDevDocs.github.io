---
publishDate: 2026-10-25T12:30
title: 'Capstone: From Commit to Production'
slug: capstone-commit-to-production
metadescription: Put the whole DevOps Fundamentals course together, take a Node.js API from a single commit to production with CI, security checks, Docker, Terraform, staging and production environments, automatic rollback, monitoring and an incident drill.
updateDate: 2026-10-25T12:30
author: ['bishal-biswas']
level: 3
tags: ['devops', 'capstone', 'project', 'ci-cd', 'docker', 'terraform']
course: devops
---

## The project

Over thirty lessons you have learned the pieces of DevOps one at a time. In this capstone you put them **all together** and take a real application from a commit on your laptop to a running, monitored production service, with every step automated.

You will use the `recipe-api` app that has grown through the course: the price function from [Your First Pipeline with GitHub Actions](/courses/devops/first-github-actions-pipeline), the web server from [Docker Essentials](/courses/devops/docker-essentials), and the configuration loader from [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets).

When you finish, a `git push` to `main` will automatically:

1. lint, test and security-check the code;
2. build **one** container image and push it to a registry;
3. deploy that image to **staging**, check its health, and roll back by itself if it is unhealthy;
4. wait for your **approval**, then deploy the **same** image to **production**;

and you will be able to **see** it running, **get alerted** when it breaks, and **recover** in minutes.

## The architecture

```text
 You ──git push──> GitHub repository (main is protected: PRs + green checks)
                        │
                        v
              GitHub Actions: Release workflow
    ┌──────────┬───────────────┬──────────────────┬─────────────────────────┐
    │  test    │  image        │  staging         │  production             │
    │  lint    │  docker build │  ssh deploy.sh   │  [approval required]    │
    │  tests   │  push to GHCR │  smoke test      │  ssh deploy.sh          │
    │  audit   │  sha-3ef9d3a  │                  │  smoke test             │
    └──────────┴───────────────┴──────────────────┴─────────────────────────┘
                                       │                     │
                                       v                     v
                        staging VM (Terraform)     production VM (Terraform)
                        ┌──────────────────────┐   ┌──────────────────────┐
     users ──HTTPS──>   │ Caddy  (ports 80/443) │   │ Caddy                 │
                        │   └─> api container   │   │   └─> api container   │
                        │         └─> postgres  │   │         └─> postgres  │
                        └──────────────────────┘   └──────────────────────┘
                                       ^                     ^
                         uptime checks, metrics, alerts ─────┘
```

It is deliberately simple: one virtual machine per environment, running Docker Compose. That keeps the project affordable and lets you see every moving part. The stretch goals at the end show how to grow it towards Kubernetes and canary releases.

## What you need

- A **GitHub account** and a new repository for `recipe-api`.
- A **cloud account** (the examples use AWS, as in [Infrastructure as Code with Terraform](/courses/devops/infrastructure-as-code); any provider with Ubuntu VMs works).
- A **domain name** you control, for `staging.` and production addresses.
- On your machine: Git, Node.js, Docker and Terraform (or OpenTofu).

> **Note:** Two small servers cost a little money while they run. Set a **budget alert** first ([Cloud Computing Basics](/courses/devops/cloud-computing-basics)), and run `terraform destroy` when you finish.

Work through the milestones in order. Each one says which lessons it uses and how you know it is **done**.

## Milestone 1: the repository and its rules

**Uses:** [Version Control with Git](/courses/devops/version-control-with-git), [Branching Strategies](/courses/devops/branching-strategies).

1. Create the repository, push the `recipe-api` project, and add a `.gitignore` for `node_modules/`, `dist/`, `.env`, `*.tfstate*` and `.terraform/`.
2. Turn on **secret scanning** and **push protection** in the repository's security settings.
3. Add a **ruleset** for `main`: require a pull request, require status checks, block force pushes.
4. From now on, every change is a short-lived branch and a pull request, even when you work alone.

**Done when:** pushing directly to `main` is rejected, and a test commit containing a fake-looking key is blocked.

## Milestone 2: an app that is ready for production

**Uses:** [Automated Testing](/courses/devops/testing-in-the-pipeline), [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets), [Docker Essentials](/courses/devops/docker-essentials).

Make sure the app has everything production needs:

- a cheap **`/health`** endpoint;
- **configuration from environment variables**, validated at start-up, with secrets masked in logs;
- **structured JSON logs** to stdout, with a request ID ([Monitoring, Logging and Alerting](/courses/devops/monitoring-logging-and-alerting));
- listening on **`0.0.0.0`** and shutting down cleanly on **`SIGTERM`**;
- **unit and integration tests** that run with `npm test`.

**Done when:** `npm test` passes, and starting the app without `DATABASE_URL` fails immediately with a clear message.

## Milestone 3: continuous integration and security checks

**Uses:** [Continuous Integration](/courses/devops/continuous-integration), [Your First Pipeline with GitHub Actions](/courses/devops/first-github-actions-pipeline), [DevSecOps](/courses/devops/devsecops-basics).

1. Add the **CI workflow** from lesson 16 (lint and tests in parallel, Node version matrix, build artifact).
2. Add the **security workflow** from lesson 30 (dependency audit, CodeQL, image and config scanning, SBOM).
3. Add **Dependabot** for npm, Docker and GitHub Actions.
4. Mark the CI jobs as **required status checks** in your ruleset.

**Done when:** a pull request shows green checks before it can be merged, and one with a lint error cannot be merged.

## Milestone 4: the container image

**Uses:** [Containers vs Virtual Machines](/courses/devops/containers-vs-virtual-machines), [Docker Essentials](/courses/devops/docker-essentials), [Docker Compose](/courses/devops/docker-compose-basics), [Build Artifacts and Versioning](/courses/devops/build-artifacts-and-versioning).

1. Add the two-stage **Dockerfile** from lesson 22, with a non-root user and a `HEALTHCHECK`, plus a `.dockerignore`.
2. Add a development `compose.yaml` (lesson 23) so `docker compose up` runs the API and PostgreSQL locally.
3. Build and run the image locally and check `/health`.

**Done when:** `docker compose up -d --build` gives you a healthy API on `http://localhost:3000`, and `docker images` shows an image far smaller than one built on the full `node:24` base.

## Milestone 5: infrastructure as code

**Uses:** [IP Addresses, Ports and Protocols](/courses/devops/ip-addresses-ports-and-protocols), [DNS](/courses/devops/how-dns-works), [Cloud Computing Basics](/courses/devops/cloud-computing-basics), [Infrastructure as Code with Terraform](/courses/devops/infrastructure-as-code).

1. Start from the Terraform configuration in lesson 26, and keep a separate **state** (and `.tfvars` file) for staging and production.
2. Change the **cloud-init** template so each server is ready to run containers. Replace the `packages` and `runcmd` sections with:

```yaml
packages:
  - docker.io                    # Docker Engine from Ubuntu's own repository
  - docker-compose-v2            # the "docker compose" plugin
  - ufw
  - unattended-upgrades
runcmd:
  - systemctl restart ssh
  - usermod -aG docker deploy    # let the deploy user run docker
  - mkdir -p /srv/recipe-api
  - chown deploy:deploy /srv/recipe-api
  - ufw allow OpenSSH
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw --force enable
```

3. `terraform apply` for each environment, then create **DNS A records**: `staging.example.com` and `recipes.example.com` pointing at the two public IPs (or manage them in Terraform too).

> **Note:** Docker publishes container ports by adding its **own** firewall rules, which take effect **before** ufw's. A port published with `ports:` in Compose is reachable from the internet even if ufw does not allow it. That is why only the proxy publishes ports in this project, and the database publishes none.

**Done when:** `ssh deploy@staging.example.com docker version` works on both servers, and `dig +short staging.example.com` returns the right IP.

## Milestone 6: the servers' runtime setup

**Uses:** [HTTP, HTTPS and TLS](/courses/devops/http-https-and-tls), [Reverse Proxies and Load Balancers](/courses/devops/reverse-proxies-and-load-balancers), [Docker Compose](/courses/devops/docker-compose-basics), [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets).

Each server gets a small folder, `/srv/recipe-api`, with four kinds of file. The first is a `compose.yaml` that runs the **Caddy** reverse proxy (which gets and renews HTTPS certificates from Let's Encrypt automatically), the API and PostgreSQL:

```yaml
services:
  caddy:                                   # reverse proxy with automatic HTTPS
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data                   # certificates survive restarts
    restart: unless-stopped
  api:
    image: ${APP_IMAGE:?APP_IMAGE is not set}   # written to .env by deploy.sh
    env_file: api.env                      # DATABASE_URL and other settings, never in Git
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
  db:
    image: postgres:17-alpine
    env_file: db.env                       # POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped
volumes:
  caddy-data:
  db-data:
```

(`$$` tells Compose to leave the `$` for the container's shell, which fills in the variables from `db.env`.)

A `Caddyfile` with one site per server, here for staging:

```text
staging.example.com {
    reverse_proxy api:3000
}
```

The **configuration** files `api.env` and `db.env`, created by hand on each server with strong, different passwords per environment, readable only by the `deploy` user (`chmod 600`). They never go in Git.

And `deploy.sh`, which switches to a new image and **rolls back automatically** if the new version does not become healthy:

```bash
#!/usr/bin/env bash
# /srv/recipe-api/deploy.sh: switch to a new image, and roll back if it is not healthy.
# Usage (the pipeline runs this over SSH):  APP_IMAGE=ghcr.io/your-name/recipe-api:sha-3ef9d3a ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
NEW="${APP_IMAGE:?Set APP_IMAGE to the image to deploy}"
OLD="$(grep -s '^APP_IMAGE=' .env | cut -d= -f2- || true)"
echo "Deploying $NEW (currently: ${OLD:-nothing})"
echo "APP_IMAGE=$NEW" > .env              # Compose reads the image name from .env
docker compose pull api
# --wait blocks until the container's HEALTHCHECK passes, or fails after the timeout
if docker compose up -d --wait --wait-timeout 90 api; then
  echo "Healthy: $NEW is live"
else
  echo "NOT healthy: rolling back to ${OLD:-nothing}" >&2
  if [ -n "$OLD" ]; then
    echo "APP_IMAGE=$OLD" > .env
    docker compose up -d --wait --wait-timeout 90 api
  fi
  exit 1
fi
```

Notice the last line: after rolling back, the script still **exits with an error**, so the pipeline run turns red and nobody mistakes a rollback for a successful release. Here is what the three cases look like:

```text
Deploying ghcr.io/your-name/recipe-api:sha-2222222 (currently: ghcr.io/your-name/recipe-api:sha-1111111)
Healthy: ghcr.io/your-name/recipe-api:sha-2222222 is live

Deploying ghcr.io/your-name/recipe-api:sha-3333333 (currently: ghcr.io/your-name/recipe-api:sha-2222222)
NOT healthy: rolling back to ghcr.io/your-name/recipe-api:sha-2222222
```

Finally, let the servers pull your image. Either make the package **public** in GitHub's package settings, or log in once on each server with a token that can only **read** packages:

```bash
docker login ghcr.io -u your-name      # paste a read-only (read:packages) token when asked
```

**Done when:** on each server, `APP_IMAGE=<an image you pushed by hand> ./deploy.sh` reports healthy, and `https://staging.example.com/health` returns `ok` with a valid certificate.

## Milestone 7: the release pipeline

**Uses:** [Continuous Delivery vs Continuous Deployment](/courses/devops/continuous-delivery-vs-deployment), [Build Artifacts and Versioning](/courses/devops/build-artifacts-and-versioning), [SSH, Users and Permissions](/courses/devops/ssh-users-and-permissions).

The code panel for this lesson has the **release workflow** that joins everything together. On every push to `main` it:

1. **tests** the code again, including `npm audit`;
2. builds **one image**, tagged with the commit (`sha-3ef9d3a`), and pushes it to GitHub Container Registry;
3. **deploys to staging** by running `deploy.sh` over SSH, then runs a **smoke test** through the real DNS name, HTTPS and the proxy;
4. **waits for approval**, then deploys the **same image tag** to production and smoke-tests it.

Set up two GitHub **environments**, exactly as in lesson 19:

| Setting | `staging` | `production` |
|---|---|---|
| Secret `DEPLOY_SSH_KEY` | Private key for the staging `deploy` user | Private key for the production `deploy` user |
| Variable `DEPLOY_HOST` | `staging.example.com` | `recipes.example.com` |
| Variable `DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan staging.example.com`, checked by hand | The same, for production |
| Required reviewers | None | You |

**Done when:** merging a pull request deploys to staging automatically, the run waits for your approval, and approving it updates production. Check the `sha-...` tag on both servers with `cat /srv/recipe-api/.env`.

## Milestone 8: seeing it run

**Uses:** [Monitoring, Logging and Alerting](/courses/devops/monitoring-logging-and-alerting).

1. Set up an **external uptime check** (many monitoring services have a free tier) that requests `https://recipes.example.com/health` every minute and alerts you by email or phone.
2. Check **logs** on the server: `docker compose logs -f api` should show one JSON line per request.
3. Add a **certificate expiry** check, alerting if fewer than 14 days are left.
4. Define one **SLO**, for example "99.5% of requests to `/total` succeed over 30 days", and decide how you will measure it.

**Done when:** stopping the API on production (`docker compose stop api`) triggers an alert within a few minutes. Start it again afterwards.

## Milestone 9: break it on purpose

**Uses:** [Deployment Strategies](/courses/devops/deployment-strategies), [Incident Response and Blameless Postmortems](/courses/devops/incident-response-and-postmortems).

Now practise for a bad day, the way real teams run a **game day**.

1. **An unhealthy release.** On a branch, make `/health` return status `500`. Merge it. Watch `deploy.sh` on staging fail its health check and **roll back on its own**, and the pipeline stop before production. Revert the change.
2. **A healthy but wrong release.** Make `/total` return the wrong sum, but leave `/health` alone. This one passes the health check, so it reaches production (after your approval). Treat it as a real incident: declare a severity, roll back by running `deploy.sh` on production with the previous image tag (it is in the last successful run's logs), and write a **blameless postmortem** with a timeline and action items.
3. Ask yourself which check **should** have caught the second bug, and add it: an integration test, a smoke test of `/total` in the pipeline, or both.

**Done when:** you have a short postmortem in your repository, and the action item it produced has been merged.

## Milestone 10: measure and improve

**Uses:** [Measuring DevOps: The Four DORA Metrics](/courses/devops/dora-metrics), [DevOps Principles](/courses/devops/devops-principles).

Keep working on the project for a couple of weeks, shipping small changes. Then collect your **DORA metrics** from GitHub: deployments to production, commit-to-production lead times, failed deployments and recovery times. Feed them into the script from lesson 4. Pick the weakest metric and try one improvement.

**Done when:** you can state all four numbers for your project, and what you changed because of them.

## Definition of done

Your capstone is complete when **all** of these are true:

- [ ] `main` is protected; every change arrives through a pull request with green checks.
- [ ] CI lints and tests on every pull request; security checks run on pull requests and weekly.
- [ ] One image per commit, tagged with the commit ID, is the only thing ever deployed.
- [ ] Both servers are created by Terraform, with state stored safely outside Git.
- [ ] HTTPS works on both addresses, with automatically renewed certificates.
- [ ] Staging deploys automatically; production deploys the same image after approval.
- [ ] An unhealthy release rolls back by itself, and the pipeline goes red.
- [ ] No secret exists in the repository, the image, the workflow files or the logs.
- [ ] An outage triggers an alert within minutes.
- [ ] You have written at least one blameless postmortem, and acted on it.
- [ ] You can rebuild everything from scratch with `terraform apply` and the pipeline.

That last point is the real test. If a cloud region disappeared tomorrow, could you be running again in an hour? If yes, you have built something genuinely DevOps.

## Stretch goals

Ready for more? Each of these builds on a lesson you have done:

- **Kubernetes:** run the app on a local **kind** cluster, or a managed one, using the manifest from [Why Kubernetes?](/courses/devops/why-kubernetes), and deploy it from the pipeline.
- **Canary releases:** send 10% of traffic to the new version first and roll back automatically on errors, as in [Deployment Strategies](/courses/devops/deployment-strategies).
- **OIDC everywhere:** replace stored cloud keys with OIDC in the pipeline, and run `terraform plan` on pull requests ([Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets)).
- **Metrics and dashboards:** expose `/metrics`, scrape it with Prometheus and build a Grafana dashboard of the golden signals, with alerts on your SLO.
- **Tracing:** add OpenTelemetry and follow one request from Caddy through the API to PostgreSQL.
- **Signed images:** sign every image with cosign, and verify the signature in `deploy.sh` before switching.
- **Database migrations:** add a schema change using **expand and contract**, and run migrations as a pipeline step.

## Where to go next

You now know the shape of the whole DevOps toolchain and have built a working delivery system end to end. The best next step is to go **deeper** into the tools you will use most. The full [Docker course](/courses/docker/what-is-docker) is ready now and picks up where the Docker lessons here stopped. Full courses on **Linux and Shell**, **Git and GitHub** and **Kubernetes** are coming soon.

And keep the habits that matter more than any tool: **small changes**, **automate the second time**, **measure**, **learn without blame** and **share what you learn**.

Congratulations on finishing **DevOps Fundamentals**!

<code id="code-content" class="language-yaml">
# .github/workflows/release.yml: the capstone pipeline, from commit to production.
# test -&gt; build and push one image -&gt; deploy it to staging -&gt; approval -&gt; same image to production
name: Release
on:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: release
  cancel-in-progress: false                 # never stop a deployment half-way
env:
  IMAGE: ghcr.io/your-name/recipe-api       # must be lowercase
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm audit --audit-level=high
  image:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write                       # push to GitHub Container Registry
    outputs:
      tag: ${{ steps.tag.outputs.tag }}
    steps:
      - uses: actions/checkout@v5
      - id: tag
        run: echo "tag=sha-${GITHUB_SHA::7}" &gt;&gt; "$GITHUB_OUTPUT"
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ env.IMAGE }}:${{ steps.tag.outputs.tag }}
  staging:
    needs: image
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.example.com
    steps:
      - name: Deploy over SSH (deploy.sh rolls back by itself if unhealthy)
        env:
          SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          HOST: ${{ vars.DEPLOY_HOST }}
          KNOWN_HOSTS: ${{ vars.DEPLOY_KNOWN_HOSTS }}
          APP_IMAGE: ${{ env.IMAGE }}:${{ needs.image.outputs.tag }}
        run: |
          mkdir -p ~/.ssh &amp;&amp; chmod 700 ~/.ssh
          echo "$SSH_KEY" &gt; ~/.ssh/id_ed25519 &amp;&amp; chmod 600 ~/.ssh/id_ed25519
          echo "$KNOWN_HOSTS" &gt; ~/.ssh/known_hosts
          ssh "deploy@$HOST" "APP_IMAGE=$APP_IMAGE /srv/recipe-api/deploy.sh"
      - name: Smoke test through HTTPS, DNS and the proxy
        run: curl -fsS --retry 10 --retry-delay 3 https://staging.example.com/health
  production:
    needs: [image, staging]
    runs-on: ubuntu-latest
    environment:                            # "production" has required reviewers: the run waits here
      name: production
      url: https://recipes.example.com
    steps:
      - name: Deploy over SSH (deploy.sh rolls back by itself if unhealthy)
        env:
          SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          HOST: ${{ vars.DEPLOY_HOST }}
          KNOWN_HOSTS: ${{ vars.DEPLOY_KNOWN_HOSTS }}
          APP_IMAGE: ${{ env.IMAGE }}:${{ needs.image.outputs.tag }}
        run: |
          mkdir -p ~/.ssh &amp;&amp; chmod 700 ~/.ssh
          echo "$SSH_KEY" &gt; ~/.ssh/id_ed25519 &amp;&amp; chmod 600 ~/.ssh/id_ed25519
          echo "$KNOWN_HOSTS" &gt; ~/.ssh/known_hosts
          ssh "deploy@$HOST" "APP_IMAGE=$APP_IMAGE /srv/recipe-api/deploy.sh"
      - name: Smoke test through HTTPS, DNS and the proxy
        run: curl -fsS --retry 10 --retry-delay 3 https://recipes.example.com/health
</code></pre>
