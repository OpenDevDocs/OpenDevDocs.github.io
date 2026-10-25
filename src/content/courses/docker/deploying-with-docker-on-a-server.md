---
publishDate: 2026-10-25T18:25
title: 'Deploying a Compose App to a Linux Server'
slug: deploying-with-docker-on-a-server
metadescription: 'Deploy a Docker Compose app to a Linux server: install Docker Engine, copy your compose file, pull images, add HTTPS, update, roll back and back up.'
updateDate: 2026-10-25T18:25
author: ['bishal-biswas']
level: 3
tags: ['docker', 'deployment', 'linux', 'production']
course: docker
---

## From your laptop to the internet

Your `notes-api` app runs with `docker compose up` on your computer. Now you want other people to use it. The simplest real way is one Linux server (often called a **VPS**, a virtual private server, rented from a cloud provider) running Docker and the same compose file.

This is a great setup for small and medium apps. It is cheap, easy to understand, and uses exactly the skills you already have. In this lesson you will:

- prepare an Ubuntu 24.04 server and install Docker Engine,
- write a production compose file that **pulls** images instead of building them,
- keep secrets in a `.env` file on the server,
- put a reverse proxy with HTTPS in front,
- deploy updates, roll back, and back up the database.

You need a server you can reach with SSH. If SSH is new to you, read [SSH, Users and Permissions](/courses/devops/ssh-users-and-permissions) first.

## The plan

```text
  Internet
     |
     |  https://notes.example.com  (ports 80 and 443)
     v
+------------------- Linux server -------------------+
|  nginx on the host (HTTPS with Let's Encrypt)      |
|     |                                              |
|     |  http://127.0.0.1:3000                       |
|     v                                              |
|  [ api container ] ---- [ db container ] - volume  |
|        Docker Compose project in /opt/notes        |
+----------------------------------------------------+
```

The images are built by CI and stored in a registry, as you set up in [Building and Pushing Images in GitHub Actions](/courses/docker/docker-in-ci-github-actions). The server never builds anything. It only pulls and runs.

## Step 1: prepare the server

Log in and update the system:

```bash
ssh root@203.0.113.10          # use your server's IP address
apt-get update && apt-get upgrade -y
```

Create a normal user for deployments, so you do not work as root every day:

```bash
adduser deploy
usermod -aG sudo deploy
```

### Install Docker Engine

On a server, install **Docker Engine** (not Docker Desktop) from **Docker's own apt repository**. The version in Ubuntu's default repository is often old and may not include the Compose plugin. Follow the current steps on docs.docker.com for Ubuntu. At the time of writing they look like this:

```bash
# Add Docker's signing key
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine, Buildx and the Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Check it:

```bash
sudo docker version
docker compose version
```

Both commands should print a version number. You learned the details in [Installing Docker on Windows, macOS and Linux](/courses/docker/installing-docker).

> **Warning:** Adding `deploy` to the `docker` group (`sudo usermod -aG docker deploy`) lets it run Docker without `sudo`. This is convenient, but anyone who can log in as `deploy` effectively has **root** on the server. Protect that account with SSH keys only, no passwords.

### Set up a firewall

Allow only SSH and web traffic:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

> **Warning:** Docker writes its own firewall rules for published ports, and these rules are applied **before** ufw's rules. So `ports: - "3000:3000"` is open to the whole internet **even if ufw blocks port 3000**. The safe habit: publish ports only on localhost, like `"127.0.0.1:3000:3000"`, and let the reverse proxy be the only door from outside.

## Step 2: the production compose file

On the server, create a folder for the app:

```bash
sudo mkdir -p /opt/notes
sudo chown deploy:deploy /opt/notes
cd /opt/notes
```

Your development compose file probably has `build:`, bind mounts for live code and maybe `develop.watch`. The production file is different:

| Development | Production |
|---|---|
| `build: .` | `image: ghcr.io/your-name/notes-api:${API_TAG}` |
| Bind mount of source code | No source code on the server at all |
| Ports open on all interfaces | `127.0.0.1` only, behind a proxy |
| No restart policy | `restart: unless-stopped` |
| Default logging | Log rotation |

The full file is in the code panel. Copy it to `/opt/notes/compose.yaml` on the server, for example with `scp`:

```bash
# Run this on your own computer
scp compose.prod.yaml deploy@203.0.113.10:/opt/notes/compose.yaml
```

You learned how to keep development and production settings apart in [Compose Profiles, Override Files and Multiple Environments](/courses/docker/compose-profiles-and-overrides).

### Secrets in a .env file

Compose reads a file called `.env` in the same folder and uses it to fill in `${VARIABLES}`. Create it on the server only:

```bash
nano /opt/notes/.env
chmod 600 /opt/notes/.env      # only the owner can read it
```

```text
API_TAG=1.4.2
POSTGRES_PASSWORD=change-me-to-a-long-random-string
```

Generate a strong password with:

```bash
openssl rand -base64 24
```

This file never goes into Git and never into an image. See [Environment Variables and Secrets in Compose](/courses/docker/compose-environment-and-secrets).

### Log in to the registry (private images only)

If your image is private on GHCR, log in once on the server with a token that only has the `read:packages` permission:

```bash
docker login ghcr.io -u your-name
```

## Step 3: start it

```bash
cd /opt/notes
docker compose pull          # download the images named in compose.yaml
docker compose up -d         # start everything in the background
docker compose ps
```

```text
NAME           IMAGE                               STATUS                    PORTS
notes-api-1    ghcr.io/your-name/notes-api:1.4.2   Up 20 seconds (healthy)   127.0.0.1:3000->3000/tcp
notes-db-1     postgres:17-alpine                  Up 31 seconds (healthy)   5432/tcp
```

Test it from the server itself:

```bash
curl http://127.0.0.1:3000/health
```

```text
ok
```

Because of `restart: unless-stopped`, these containers start again automatically after a server reboot. Docker Engine itself starts at boot through systemd.

## Step 4: a reverse proxy with HTTPS

Your app should not face the internet directly. A **reverse proxy** receives all web traffic, handles **HTTPS** (encryption), and forwards requests to your app. You learned why in [Reverse Proxies and Load Balancers](/courses/devops/reverse-proxies-and-load-balancers).

A simple, common choice is nginx installed on the host, plus **certbot** to get a free certificate from **Let's Encrypt**. First, point your domain's DNS **A record** to the server's IP address (see [How DNS Works](/courses/devops/how-dns-works)). Then:

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/notes
```

```nginx
server {
    listen 80;
    server_name notes.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;            # the published port of the api container
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Turn it on and get the certificate:

```bash
sudo ln -s /etc/nginx/sites-available/notes /etc/nginx/sites-enabled/
sudo nginx -t                                  # check the config for errors
sudo systemctl reload nginx
sudo certbot --nginx -d notes.example.com      # adds HTTPS to the config for you
```

Certbot also sets up automatic renewal. Now open `https://notes.example.com/health` in your browser.

> **Note:** You can also run the reverse proxy as a container in the same compose project. The capstone, [Capstone: Containerize a Full-Stack App](/courses/docker/capstone-full-stack-app), uses an nginx container this way. Tools like Caddy or Traefik can also get certificates automatically. All of these are good choices; pick one and learn it well.

## Step 5: deploying an update

CI builds and pushes `1.4.3`. To deploy it, change one line and run two commands:

```bash
cd /opt/notes
sed -i 's/^API_TAG=.*/API_TAG=1.4.3/' .env    # or edit .env by hand
docker compose pull api
docker compose up -d
```

`up -d` compares the running containers with the file. Only `api` changed, so only `api` is recreated. The database keeps running.

Watch it come up:

```bash
docker compose ps
docker compose logs -f --tail 50 api
```

Clean up old images now and then so the disk does not fill:

```bash
docker image prune -f
```

> **Note:** During `up -d`, the old api container stops before the new one starts, so there are a few seconds of downtime. For most small apps that is fine. Zero-downtime deployments need more than one copy of the app and a proxy that switches between them. See [Deployment Strategies](/courses/devops/deployment-strategies).

### Rolling back

Because every release has its own tag, going back is the same as going forward:

```bash
sed -i 's/^API_TAG=.*/API_TAG=1.4.2/' .env
docker compose up -d
```

The old image is probably still on the server, so this takes seconds. This is why you never deploy `latest`: with `latest`, there is no "previous version" to go back to.

### Deploying from your computer or from CI

You do not have to log in to the server for every deploy. One SSH command can do it:

```bash
ssh deploy@203.0.113.10 'cd /opt/notes && docker compose pull && docker compose up -d'
```

A CI job can run the same command after the image is pushed, which gives you **continuous deployment**. See [Continuous Delivery vs Continuous Deployment](/courses/devops/continuous-delivery-vs-deployment).

Docker also supports **contexts**, which point your local `docker` command at a remote server over SSH:

```bash
docker context create prod --docker "host=ssh://deploy@203.0.113.10"
docker --context prod ps
```

## Step 6: backups

Your images can always be pulled again. Your **data** cannot. Back up the database regularly with `pg_dump`, run inside the db container:

```bash
cd /opt/notes
docker compose exec -T db pg_dump -U notes notes > backup-$(date +%F).sql
```

- `-T` turns off the terminal, which is needed when you redirect output to a file.
- The file is written on the **host**, because the `>` is handled by your shell on the server.

To restore into a fresh database:

```bash
docker compose exec -T db psql -U notes notes < backup-2026-10-25.sql
```

Copy backups **off** the server too (to another machine or to object storage). A backup on the same disk is lost if the server is lost. For more ways to back up volumes, see [tmpfs Mounts and Backing Up Volumes](/courses/docker/tmpfs-and-volume-backups).

> **Tip:** Run the backup command every night with a cron job (`crontab -e`). Test a restore at least once, so you know your backups actually work.

## Keeping it healthy

A short list of habits for a single Docker server:

- **Log rotation** is set (see [Logging Drivers and Log Rotation](/courses/docker/logging-drivers)).
- **Disk space**: check with `df -h` and `docker system df`.
- **Updates**: run `sudo apt-get update && sudo apt-get upgrade` regularly, which also updates Docker Engine.
- **Base images**: rebuild your images in CI with fresh bases, and redeploy.
- **Monitoring**: at least an outside check that calls `https://notes.example.com/health` and alerts you when it fails.

## Common mistakes

### Publishing the database port

`ports: - "5432:5432"` on a server puts your database on the internet, and ufw will not stop it. Remove the `ports` entry for the database. The api reaches it through the compose network by the name `db`.

### Building on the server

Running `docker compose build` on the server means your source code lives there, builds use the server's CPU, and you cannot be sure what is running. Build once in CI, then pull the exact same image everywhere.

### Forgetting the volume

Without a named volume for `/var/lib/postgresql/data`, your data is inside the container and is gone when the container is recreated. Check that `docker volume ls` shows your volume.

### Running `docker compose down -v`

`down` is fine. `down -v` also **deletes the volumes**, including your database. Never use `-v` on a production server unless you mean it.

## Quick recap

- A single Linux server with **Docker Engine** and **Compose** is a simple, solid way to run small apps.
- Install Docker from **Docker's apt repository**; the `docker` group is root-equivalent.
- Docker's published ports **bypass ufw**, so publish app ports on `127.0.0.1` and put a reverse proxy in front.
- The production compose file uses `image:` with a **tag variable**, `restart: unless-stopped`, health checks and log rotation.
- Keep secrets in a `.env` file with `chmod 600`, never in Git.
- Update by changing the tag and running `docker compose pull` and `docker compose up -d`; roll back the same way.
- Back up the database with `pg_dump` and store copies somewhere else.

Next, you will see how all of this maps to Kubernetes in [From Docker to Kubernetes: What Comes Next](/courses/docker/docker-to-kubernetes-next-steps).

<code id="code-content" class="language-yaml">
# /opt/notes/compose.yaml: production compose file for notes-api on a Linux server
# Values like ${API_TAG} come from /opt/notes/.env (chmod 600, never in git):
#   API_TAG=1.4.2
#   POSTGRES_PASSWORD=change-me-to-a-long-random-string
# Deploy or update:  docker compose pull &amp;&amp; docker compose up -d
# Roll back:         set API_TAG to the old version, then docker compose up -d
name: notes
# Log rotation for every service, so logs never fill the disk
x-logging: &amp;default-logging
  driver: local
  options:
    max-size: "10m"
    max-file: "3"
services:
  api:
    # Built and pushed by CI; the server only pulls, never builds
    image: ghcr.io/your-name/notes-api:${API_TAG:?set API_TAG in .env}
    environment:
      NODE_ENV: production
      PORT: "3000"
      DATABASE_URL: postgres://notes:${POSTGRES_PASSWORD}@db:5432/notes
    # Only the reverse proxy on this server can reach it (Docker ports bypass ufw)
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    logging: *default-logging
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notes
      POSTGRES_DB: notes
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
    # The data lives in a named volume and survives container updates
    volumes:
      - pgdata:/var/lib/postgresql/data
    # No ports: the database is never reachable from outside
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U notes -d notes"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s
    restart: unless-stopped
    logging: *default-logging
volumes:
  pgdata:
#
# Backup:  docker compose exec -T db pg_dump -U notes notes &gt; backup-$(date +%F).sql
# Restore: docker compose exec -T db psql -U notes notes &lt; backup.sql
</code></pre>
