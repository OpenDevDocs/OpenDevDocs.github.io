---
publishDate: 2026-10-25T10:35
title: SSH, Users and Permissions on a Server
slug: ssh-users-and-permissions
metadescription: Learn how to log in to a Linux server securely with SSH keys, manage users, groups and sudo, read and set file permissions with chmod and chown, and lock down a new server.
updateDate: 2026-10-25T10:35
author: ['bishal-biswas']
level: 1
tags: ['devops', 'linux', 'ssh', 'security', 'permissions']
course: devops
---

## Logging in to a server you cannot touch

Your server is in a data centre somewhere, maybe on another continent. It has no screen and no keyboard. So how do you use it?

With **SSH**, the **Secure Shell**. SSH gives you a terminal on the remote machine, over the internet, with everything you type and everything it sends back **encrypted**. Anyone listening in on the network sees only scrambled data.

SSH is how you will:

- log in to servers to look around and fix things;
- copy files to and from them;
- let CI pipelines and tools such as Ansible deploy to them automatically.

This lesson covers SSH, then the two things that decide what you can do once you are logged in: **users** and **permissions**.

## Your first SSH connection

The basic command is:

```bash
ssh deploy@203.0.113.10
```

That means: connect as the user `deploy` to the machine at IP address `203.0.113.10`. SSH uses network **port 22** by default (ports are explained in [IP Addresses, Ports and Protocols](/courses/devops/ip-addresses-ports-and-protocols)).

The very first time you connect to a server, you see something like:

```text
The authenticity of host '203.0.113.10' can't be established.
ED25519 key fingerprint is SHA256:Jx3c9mQ5r8b1pQe0Z1lYyQwXk4b2oZtUuY6rN9vS2fA.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

This is SSH protecting **you**. Every server has its own identity key. SSH is asking: "I have never met this server. Is it really the one you meant?" When you type `yes`, its fingerprint is saved in `~/.ssh/known_hosts`. If that fingerprint ever changes unexpectedly, SSH shows a loud warning, because someone might be pretending to be your server.

> **Tip:** Cloud providers usually show a new server's fingerprint in their console. For important servers, compare it before typing `yes`.

## Passwords vs keys

You can log in with a password, but passwords have problems. People choose weak ones, reuse them, and bots on the internet try millions of guesses against every server with port 22 open. A new server often sees its first guessing attempts within minutes of going online.

The better way is an **SSH key pair**: two matching files that are created together.

- The **private key** stays on your computer. It is secret. Never share it, never email it, never commit it to Git.
- The **public key** can be shared with anyone. You put a copy on every server you want to log in to.

Think of the public key as a **padlock** and the private key as the only **key** that opens it. You can hand out as many padlocks as you like. Servers lock the door with your padlock, and only you can open it.

### Creating a key pair

```bash
ssh-keygen -t ed25519 -C "bishal@laptop"
```

`ed25519` is a modern, fast and secure type of key, and the right default today. `-C` adds a comment so you can tell keys apart later. Press Enter to accept the default location, and choose a **passphrase**: it encrypts the private key on your disk, so a stolen laptop does not mean stolen server access.

This creates two files:

```text
~/.ssh/id_ed25519        <- private key: keep secret
~/.ssh/id_ed25519.pub    <- public key: safe to share
```

### Putting your public key on a server

When you create a cloud server, most providers let you paste in your public key, and they install it for you. To add it to an existing server you can already log in to:

```bash
ssh-copy-id deploy@203.0.113.10
```

That appends your public key to `~/.ssh/authorized_keys` on the server: the list of padlocks that user accepts. From now on, `ssh deploy@203.0.113.10` logs you straight in with no password.

### Saving typing with ~/.ssh/config

Instead of remembering IPs and usernames, give servers short names in `~/.ssh/config` on your computer:

```text
Host web
    HostName 203.0.113.10
    User deploy
    IdentityFile ~/.ssh/id_ed25519
```

Now `ssh web` does the same as the long command.

### Copying files

```bash
scp app.tar.gz web:/tmp/                  # copy a file to the server
scp web:/var/log/nginx/error.log .        # copy a file from the server
rsync -avz ./dist/ web:/var/www/app/      # sync a folder (only sends what changed)
```

`rsync` is the workhorse for simple deployments: it only transfers the parts of files that changed, so repeat uploads are fast.

## Users and groups

Linux is a **multi-user** system. Every process runs as some user, and every file belongs to some user. This is what stops one program from reading another's secrets.

```bash
whoami            # which user am I?
id                # my user ID and the groups I belong to
```

```text
deploy
uid=1001(deploy) gid=1001(deploy) groups=1001(deploy),27(sudo)
```

There are three kinds of user you will meet:

| User | What it is | Example |
|---|---|---|
| **root** | The all-powerful administrator (user ID 0). Can read, change or delete anything. | `root` |
| **Normal users** | Real people who log in. | `deploy`, `bishal` |
| **Service users** | Accounts that exist only to run one program, with no login. | `www-data` (nginx), `postgres` |

A **group** is a named set of users. Giving a group access to something gives all its members access. For example, members of the `sudo` group on Ubuntu (called `wheel` on RHEL-family distros) may run commands as root.

### sudo: borrowing root, briefly

Logging in as root all day is dangerous: one typo can wreck the system, and every program you start has full power. Instead, log in as a normal user and put `sudo` in front of only the commands that need it:

```bash
apt update                # fails: permission denied
sudo apt update           # runs as root, after asking for YOUR password
```

`sudo` also writes a log entry for every command, so there is a record of who did what.

### Managing users

```bash
sudo useradd --create-home --shell /bin/bash alice   # create a user with a home folder
sudo passwd alice                                    # set their password
sudo usermod -aG sudo alice                          # add them to the sudo group
sudo userdel --remove alice                          # delete the user and their home folder
```

> **Note:** In `usermod -aG`, the `-a` means **append**. Without it, `-G` **replaces** all of the user's groups with the one you name, which can quietly remove their sudo rights.

## File permissions

Run `ls -l` and every line starts with a string like `-rwxr-xr--`. That string says exactly who may do what with the file.

```bash
ls -l deploy.sh
```

```text
-rwxr-xr-- 1 deploy developers 512 Oct 25 10:00 deploy.sh
```

Break it into pieces:

```text
-    rwx    r-x    r--      deploy   developers
|     |      |      |         |          |
type owner  group  others   owner      group
```

- The first character is the **type**: `-` for a file, `d` for a directory, `l` for a link.
- Then three sets of three letters, for the **owner** (user `deploy`), the **group** (`developers`) and **everyone else**.
- In each set: `r` = **read**, `w` = **write**, `x` = **execute** (run it as a program, or for a folder, go into it). A `-` means "not allowed".

So `deploy.sh` can be read, changed and run by `deploy`, read and run by anyone in `developers`, and only read by everyone else.

### Numeric permissions

Each permission has a number: **r = 4**, **w = 2**, **x = 1**. Add them up for each set:

| Letters | Sum | Meaning |
|---|---|---|
| `rwx` | 4+2+1 = **7** | everything |
| `rw-` | 4+2 = **6** | read and write |
| `r-x` | 4+1 = **5** | read and run |
| `r--` | **4** | read only |
| `---` | **0** | nothing |

Three digits, one per set, give the whole picture. The ones you will use most:

| Number | Letters | Typical use |
|---|---|---|
| `755` | `rwxr-xr-x` | Scripts, programs and folders that others may use |
| `644` | `rw-r--r--` | Normal files, such as web pages and most config |
| `700` | `rwx------` | Private folders, such as `~/.ssh` |
| `600` | `rw-------` | Secrets: private keys, `.env` files, `authorized_keys` |

### chmod and chown

```bash
chmod 755 deploy.sh        # set permissions with numbers
chmod +x deploy.sh         # or with letters: add execute for everyone
chmod u+x,go-w deploy.sh   # add execute for the user, remove write for group and others
chmod 600 ~/.ssh/id_ed25519

sudo chown deploy:developers deploy.sh      # change owner and group
sudo chown -R www-data:www-data /var/www    # ...for a whole folder (-R = recursive)
```

> **Tip:** SSH is strict about permissions. If your `~/.ssh` folder or private key can be read by other users, SSH refuses to use the key, with a message like `UNPROTECTED PRIVATE KEY FILE!`. Fix it with `chmod 700 ~/.ssh` and `chmod 600 ~/.ssh/id_ed25519`.

### Least privilege

All of this serves one rule, the **principle of least privilege**: every user and every program gets the permissions it needs to do its job, and nothing more. The nginx web server can read your website's files but cannot change them. Your app can read its own `.env` file, but other users cannot. If something is ever broken into, least privilege limits how much damage it can do.

## Locking down a new server

The first thing to do on any new internet-facing server is close the most common doors. The usual checklist:

1. **Create a normal user** with `sudo` rights, so you stop using root.
2. **Use SSH keys only**: turn off password logins, so password-guessing bots get nowhere.
3. **Turn off root login over SSH**, so attackers must also guess a username.
4. **Turn on a firewall** that allows SSH (and later your web ports) and blocks everything else.
5. **Keep it updated**: `sudo apt update && sudo apt upgrade`, and turn on automatic security updates.

The code panel for this lesson has a script that does steps 1 to 4 on a fresh Ubuntu server. It is careful in two ways:

- it refuses to run if root has no SSH key yet, so it cannot lock you out;
- it runs `sshd -t` to test the new SSH settings before restarting SSH.

```bash
sudo bash harden-server.sh deploy
```

> **Note:** When you change SSH or firewall settings on a remote server, **keep your current session open** and test logging in from a **second** terminal. If something is wrong, you can still fix it from the first one. Close the old session only after the new login works.

On Ubuntu, the firewall tool in the script is **ufw** (Uncomplicated Firewall). `ufw allow OpenSSH` opens port 22, and `ufw --force enable` blocks all other incoming connections. When you add a web server later, you will open ports 80 and 443 the same way:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Common misunderstandings

### "SSH keys are just a fancier password"

A password is sent to the server (encrypted) every time you log in. With keys, your private key **never leaves your computer**. The server sends a challenge only your private key can answer. Even a fake server learns nothing it can reuse.

### "chmod 777 fixes permission errors"

It does make the error go away, by letting **every user on the machine** read, change and run the file. That is a security hole, not a fix. Work out which user needs access and give exactly that, usually with `chown` plus `644` or `755`.

### "If I use sudo, I do not need to understand permissions"

Running everything with `sudo` creates files owned by root that your app then cannot read, and hides the real problem. Use `sudo` for system tasks only, and let apps run as their own users.

## Quick recap

- **SSH** gives you an encrypted terminal on a remote server, usually on port 22.
- Use an **ed25519 key pair**: the private key stays with you, the public key goes in the server's `authorized_keys`.
- `~/.ssh/config` gives servers short names; `scp` and `rsync` copy files.
- Log in as a **normal user** and use **sudo** for admin tasks. Service users run programs.
- Permissions are **read, write, execute** for **owner, group, others**; set them with `chmod` (for example `644`, `755`, `600`) and `chown`.
- Lock down new servers: normal user, keys only, no root login, firewall, updates.

Next, you will learn how to track every change to your code and configuration in [Version Control with Git](/courses/devops/version-control-with-git).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# harden-server.sh: the first five minutes on a fresh Ubuntu server.
# Creates a normal admin user, switches SSH to keys only and turns on the firewall.
# Run ONCE as root, from a session you keep open:  sudo bash harden-server.sh deploy
set -euo pipefail
NEW_USER="${1:-deploy}"
if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root: sudo bash $0 $NEW_USER" &gt;&amp;2
  exit 1
fi
# Safety check: never lock yourself out. Root must already log in with a key.
if [ ! -s /root/.ssh/authorized_keys ]; then
  echo "No SSH key found in /root/.ssh/authorized_keys. Add your key first." &gt;&amp;2
  exit 1
fi
# 1. A normal user for daily work, with sudo rights
if ! id "$NEW_USER" &gt;/dev/null 2&gt;&amp;1; then
  useradd --create-home --shell /bin/bash "$NEW_USER"
  echo "Choose a password for $NEW_USER (needed for sudo, not for SSH):"
  passwd "$NEW_USER"
fi
usermod -aG sudo "$NEW_USER"
# 2. Let the new user log in with the same key as root
install -d -m 700 -o "$NEW_USER" -g "$NEW_USER" "/home/$NEW_USER/.ssh"
install -m 600 -o "$NEW_USER" -g "$NEW_USER" /root/.ssh/authorized_keys "/home/$NEW_USER/.ssh/authorized_keys"
# 3. SSH: keys only, no root login. Files in sshd_config.d are read in name
#    order and the first value wins, so "00-" beats any cloud provider default.
cat &gt; /etc/ssh/sshd_config.d/00-hardening.conf &lt;&lt;'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
sshd -t                                  # test the config; set -e stops here if it is broken
systemctl restart ssh
# 4. Firewall: allow SSH in, block every other incoming connection
ufw allow OpenSSH
ufw --force enable
ufw status verbose
echo
echo "Done. KEEP THIS SESSION OPEN and test in a new terminal:"
echo "  ssh $NEW_USER@&lt;server-ip&gt;"
echo "  sudo whoami      # should print: root"
</code></pre>
