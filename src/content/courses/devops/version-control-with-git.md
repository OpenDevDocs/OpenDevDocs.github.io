---
publishDate: 2026-10-25T10:40
title: Version Control with Git
slug: version-control-with-git
metadescription: Learn why version control is the foundation of DevOps, how Git's working tree, staging area and commits work, and the everyday commands for branching, merging, tagging and undoing changes.
updateDate: 2026-10-25T10:40
author: ['bishal-biswas']
level: 1
tags: ['devops', 'git', 'version-control', 'github']
course: devops
---

## What is version control?

**Version control** is a system that records every change to a set of files: what changed, who changed it, when, and why. You can look back at any earlier version, compare versions, and undo mistakes.

Without it, people end up with folders like this:

```text
website-final.zip
website-final-v2.zip
website-final-v2-REALLY-final.zip
website-final-v2-REALLY-final-fixed-by-sam.zip
```

Nobody knows which one is live, what changed between them, or how to combine Sam's fix with yours.

**Git** solves this. Linus Torvalds, the creator of Linux, wrote it in 2005 to manage the Linux kernel's code, and it is now used by almost every software team in the world.

> **Note:** This lesson covers the Git you need for DevOps. A full **Git and GitHub** course on OpenDevDocs, going much deeper into history editing, conflicts and collaboration, is coming soon.

## Why Git is the foundation of DevOps

In DevOps, Git holds far more than application code. The rule is: **if it matters, it goes in Git**. That includes:

- the application code;
- the **pipeline** files that build and deploy it ([Continuous Integration](/courses/devops/continuous-integration));
- the **Dockerfiles** that package it ([Docker Essentials](/courses/devops/docker-essentials));
- the **infrastructure** code that creates servers and networks ([Infrastructure as Code](/courses/devops/infrastructure-as-code));
- configuration (but **never** secrets such as passwords and keys).

Putting everything in Git gives you:

- **A single source of truth.** What is in the main branch is what should be running. No more "which zip file is live?"
- **A full audit trail.** For every line you can see who changed it, when and why.
- **Easy rollback.** Bad change? Go back to the last good version.
- **Automation triggers.** Pushing to Git is what starts the pipeline that tests and deploys your code.
- **Review.** Every change can be checked by a teammate before it goes live.

Some teams go one step further and let Git be the **only** way to change production: a tool watches the repository and makes the live system match it. This is called **GitOps**.

## The key ideas

### Repository

A **repository** (or **repo**) is a project folder that Git is tracking. All of Git's history lives in a hidden `.git` folder inside it.

### Commit

A **commit** is a saved snapshot of your project at one moment, with a message explaining the change. Each commit has a unique ID (a long **hash** like `3ef9d3a...`, usually shortened to 7 characters) and points to the commit before it, forming a chain of history.

Think of commits as save points in a video game. You can always go back to one.

### The three areas

This is the idea that confuses most beginners. Your files can be in three places:

```text
 Working tree   --git add-->   Staging area   --git commit-->   Repository
 (your files,                  (changes you                     (saved history
  as you edit them)             picked for the                   of commits)
                                next commit)
```

- The **working tree** is the files on your disk, as you are editing them.
- The **staging area** (also called the **index**) is where you collect the changes you want in your next commit.
- The **repository** is the permanent history of commits.

Why the middle step? Because it lets you commit **only some** of your changes. If you fixed a bug and also started a new feature, you can stage and commit just the bug fix, with its own clear message.

### Branch

A **branch** is a separate line of work. You create a branch, make commits on it without disturbing anyone else, and **merge** it back when it is ready. The main line is usually called **`main`**. How teams organise branches is the topic of [Branching Strategies](/courses/devops/branching-strategies).

### Remote

A **remote** is a copy of the repository on another computer, usually a hosting service such as **GitHub** or **GitLab**. You **push** your commits to it and **pull** other people's commits from it. Git is **distributed**: every clone has the full history, so you can work offline and nothing is lost if one machine dies.

## Everyday Git commands

### One-time setup

```bash
git config --global user.name "Bishal Biswas"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
```

Your name and email are stamped on every commit you make.

### Starting a repository

```bash
git init                                              # turn the current folder into a repo
git clone https://github.com/your-name/your-repo.git  # or copy an existing one
```

### The daily loop

```bash
git status                 # what has changed?
git diff                   # show the exact line changes not yet staged
git add app.conf           # stage one file
git add .                  # stage everything that changed
git commit -m "Change port to 8080"   # save a snapshot
git log --oneline          # list commits, one per line
```

`git status` is the command you will type most. When in doubt, run it: it tells you where you are and often suggests what to do next.

### Branches

```bash
git switch -c feature/dark-mode   # create a new branch and move to it
git switch main                   # move back to main
git branch                        # list branches (* marks the current one)
git merge feature/dark-mode       # bring that branch's commits into the current one
git branch -d feature/dark-mode   # delete the branch once merged
```

### Working with a remote

```bash
git push -u origin feature/dark-mode   # upload a branch (the first time)
git push                               # upload new commits afterwards
git pull                               # download and merge others' commits
git fetch                              # download only; look before you merge
```

`origin` is the default name for the remote you cloned from.

## Writing good commit messages

Future you, debugging at midnight, will read these. A good message says **what** changed and **why**:

```text
Bad:   fix
Bad:   updated stuff
Good:  Fix login timeout when the session cookie expires
Good:  Raise upload limit to 25 MB for recipe photos
```

A common style: a short summary line (around 50 characters, written as a command, "Add", "Fix", "Remove"), then an optional blank line and a longer explanation.

## .gitignore: what never goes in Git

Some files must stay out of the repository:

- **Secrets**: `.env` files, private keys, passwords, API tokens.
- **Things you can rebuild**: `node_modules/`, build output such as `dist/`.
- **Personal clutter**: editor settings, `.DS_Store`, log files.

List them in a file called `.gitignore` at the top of the repo:

```text
node_modules/
dist/
.env
*.log
```

> **Note:** If you ever commit a secret by accident, **deleting it in the next commit is not enough**. It is still in the history, and anyone with a copy of the repo can find it. Treat it as leaked: **change the password or revoke the key straight away**, then clean up. Bots scan public GitHub repos for leaked keys within minutes.

## Tags: marking releases

A **tag** is a permanent, human-friendly name for one commit. Teams tag every release:

```bash
git tag -a v1.4.0 -m "Dark mode release"
git push origin v1.4.0
```

Pipelines often deploy when a new tag is pushed, and the tag name becomes the version number. You will use this in [Build Artifacts and Versioning](/courses/devops/build-artifacts-and-versioning).

## Undoing things

| Situation | Command | Safe on shared branches? |
|---|---|---|
| Throw away unsaved edits to a file | `git restore app.conf` | Yes (only touches your disk) |
| Unstage a file you added by mistake | `git restore --staged app.conf` | Yes |
| Undo a commit that is already pushed | `git revert <commit>` | **Yes**: adds a new commit that reverses it |
| Rewrite your own recent, unpushed commits | `git reset` | Only if nobody else has them |

On shared branches, always prefer **`git revert`**. It does not erase history; it adds a new commit that undoes the bad one, so everyone's copy stays consistent. Rewriting shared history with `git reset` and a forced push causes real pain for your teammates.

## Pull requests: Git plus review

On GitHub and GitLab, you rarely merge into `main` yourself. Instead you push your branch and open a **pull request** (GitLab calls it a **merge request**): a page that says "please review these commits and merge them into `main`".

A pull request is where DevOps habits come together:

- teammates **review** the changes and leave comments;
- the **CI pipeline** runs automatically and shows a green tick or a red cross;
- **branch protection** rules can block the merge until the review is approved and the tests pass.

You will set this up in [Your First Pipeline with GitHub Actions](/courses/devops/first-github-actions-pipeline).

## A complete Git tour

The code panel for this lesson has a script that creates a throwaway repository in a new `git-tour` folder and walks through the whole workflow: first commit with a `.gitignore`, a feature branch, a merge, a release tag and a safe `revert`. It ends by printing the history as a graph:

```bash
bash git-tour.sh
```

```text
--- 7. The history tells the whole story
* af63aec (HEAD -> main) Revert "Break the port"
* 93b2e10 Break the port
*   3ef9d3a (tag: v1.0.0) Merge feature/port-8080
|\
| * 56b35dd Change port to 8080
|/
* f442485 Add server and config
```

Your commit IDs will be different. Notice that `.env` never appears: `git status` in step 2 lists only the three files that were not ignored.

## Common misunderstandings

### "Git and GitHub are the same thing"

**Git** is the version control program that runs on your computer. **GitHub** is a website that hosts Git repositories and adds pull requests, issues and Actions on top. GitLab and Bitbucket are alternatives to GitHub. Git works fine without any of them.

### "Committing means it is saved on the server"

A commit is saved only in your **local** repository. Until you `git push`, nobody else can see it, and it is lost if your laptop dies.

### "I should commit only when the feature is finished"

Commit early and often, in small, logical steps. Small commits are easier to review, easier to understand later and easier to revert.

## Quick recap

- **Version control** records every change; **Git** is the standard tool.
- In DevOps, **everything that matters goes in Git**: code, pipelines, Dockerfiles, infrastructure and config (never secrets).
- Changes move from the **working tree** to the **staging area** (`git add`) to the **repository** (`git commit`).
- **Branches** separate work; **merging** brings it together; **remotes** such as GitHub share it.
- Use **`.gitignore`** for secrets and build output, **tags** for releases and **`git revert`** to undo pushed changes.
- **Pull requests** combine review and automated tests before anything reaches `main`.

Next, you will learn how teams organise their branches in [Branching Strategies: GitFlow vs Trunk-Based Development](/courses/devops/branching-strategies).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# git-tour.sh: the everyday Git workflow in one safe, throwaway repository.
# Run it with: bash git-tour.sh   (it works in a new folder called git-tour)
set -euo pipefail
step() { printf '\n--- %s\n' "$1"; }
rm -rf git-tour &amp;&amp; mkdir git-tour &amp;&amp; cd git-tour
step "1. Create a repository"
git init --quiet --initial-branch=main
git config user.name "Demo User"           # only for this repo
git config user.email "demo@example.com"
step "2. First commit: the app and its config, plus a .gitignore"
echo "PORT=3000" &gt; app.conf
echo "console.log('hello');" &gt; server.js
printf 'node_modules/\n.env\n' &gt; .gitignore
echo "API_KEY=super-secret" &gt; .env          # ignored: it will never be committed
git add .
git status --short
git commit --quiet -m "Add server and config"
step "3. Work on a branch"
git switch --quiet -c feature/port-8080
sed -i.bak 's/3000/8080/' app.conf &amp;&amp; rm app.conf.bak
git diff
git commit --quiet -am "Change port to 8080"
step "4. Merge the branch back into main"
git switch --quiet main
git merge --quiet --no-ff -m "Merge feature/port-8080" feature/port-8080
git branch --quiet -d feature/port-8080
step "5. Tag the release"
git tag -a v1.0.0 -m "First release"
step "6. Oops: undo a bad change safely with revert"
echo "PORT=oops" &gt; app.conf
git commit --quiet -am "Break the port"
git revert --no-edit HEAD
cat app.conf
step "7. The history tells the whole story"
git log --oneline --graph --decorate
</code></pre>
