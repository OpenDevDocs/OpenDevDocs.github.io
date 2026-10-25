---
publishDate: 2026-10-25T10:05
title: The Software Delivery Lifecycle
slug: software-delivery-lifecycle
metadescription: Follow one code change through the eight stages of the DevOps lifecycle, from plan and code to deploy and monitor, and learn why small batches beat big releases.
updateDate: 2026-10-25T10:05
author: ['bishal-biswas']
level: 1
tags: ['devops', 'basics', 'lifecycle', 'sdlc']
course: devops
---

## What is the software delivery lifecycle?

The **software delivery lifecycle** is the path every change takes, from someone's idea to a feature that real users can touch.

You may also see the older term **SDLC** (software development lifecycle). DevOps uses the same idea but cares most about one thing: how **quickly and safely** a change can travel the whole path, again and again.

In this lesson you will follow a single, small change all the way through. Our example:

> A user asks for a **dark mode** button on a recipe website.

## The DevOps loop

DevOps usually draws the lifecycle as an **infinity loop** (a figure eight lying on its side). The left half is mostly development work, the right half is mostly operations work, and the loop never stops: what you learn from running the software feeds straight into planning the next change.

There are eight stages:

| # | Stage | The question it answers |
|---|---|---|
| 1 | Plan | What should we build, and why? |
| 2 | Code | How do we build it? |
| 3 | Build | Can we turn the code into something that runs? |
| 4 | Test | Does it work, and did we break anything? |
| 5 | Release | Is this version ready to go out? |
| 6 | Deploy | How do we get it onto the servers? |
| 7 | Operate | How do we keep it running? |
| 8 | Monitor | How is it behaving for real users? |

Let us walk through each one with our dark mode button.

## 1. Plan

The team decides what to build. Someone writes a short ticket:

```text
#42  Add a dark mode toggle
Why: 30% of support emails about "eye strain" in the last month.
Done when: users can switch themes, and their choice is remembered.
```

Good planning in DevOps means **small** pieces of work. "Redesign the whole website" is not a ticket. "Add a dark mode toggle" is.

**Common tools:** GitHub Issues, Jira, Trello, Linear.

## 2. Code

A developer writes the code on their own computer and saves it in **version control**, a system that records every change. They do it on a separate **branch** so the main code is not disturbed while they work.

Another developer then **reviews** the change before it is accepted. A second pair of eyes catches mistakes and spreads knowledge across the team.

**Common tools:** Git, GitHub, GitLab, VS Code. You will learn this in [Version Control with Git](/courses/devops/version-control-with-git).

## 3. Build

Source code usually cannot run as it is. It may need to be compiled, bundled, minified or packed into a **container image**. This stage turns code into a runnable **artifact**: a file or package you can install somewhere.

A key DevOps rule: **build once**. The exact same artifact is tested, released and deployed. You never rebuild it for production, because a rebuild might not be identical.

**Common tools:** npm, Maven, Gradle, `dotnet build`, Docker. See [Build Artifacts and Versioning](/courses/devops/build-artifacts-and-versioning).

## 4. Test

Automated tests check that the new button works and, just as important, that nothing else broke. In DevOps these run automatically, every time code is pushed.

Tests come in layers:

- **Unit tests** check one small piece, such as "does `toggleTheme()` switch light to dark?"
- **Integration tests** check that pieces work together, such as "is the user's choice saved to the database?"
- **End-to-end tests** drive a real browser like a user would: open the site, click the button, check the page went dark.

**Common tools:** Jest, Vitest, pytest, Playwright, Cypress. See [Automated Testing in the Pipeline](/courses/devops/testing-in-the-pipeline).

## 5. Release

The tested artifact gets a **version number**, such as `1.4.0`, and is marked as ready. It may wait in a staging area, or go straight on to deployment.

### Release is not the same as deploy

These words sound alike, but DevOps teams often keep them apart:

- **Deploy** means putting new code on the servers.
- **Release** means letting users actually see the new feature.

With a **feature flag** (an on/off switch in the code), you can deploy the dark mode code on Monday with the flag turned off, then release it on Thursday by flipping the switch, without deploying again. If something goes wrong, you flip it back.

## 6. Deploy

The new version is copied to the servers and started. Good teams make this **automated and repeatable**, so it happens the same way every time.

Here is a real example of why that matters. In August 2012, the trading firm **Knight Capital** deployed new software by hand to eight servers. A technician missed one. That eighth server ran old, forgotten code that started sending wrong orders to the stock market. In about 45 minutes the company lost around 440 million US dollars and nearly went out of business.

An automated deployment would have updated all eight servers the same way, or failed loudly.

**Common tools:** GitHub Actions, GitLab CI, Jenkins, Argo CD, cloud deploy services. See [Deployment Strategies: Rolling, Blue-Green and Canary](/courses/devops/deployment-strategies).

## 7. Operate

The software is now live. Someone has to keep it healthy: apply security updates, add more servers when traffic grows, renew certificates and back up the database.

In DevOps, much of this is also code, so it can be repeated and reviewed. You will see this in [Infrastructure as Code with Terraform](/courses/devops/infrastructure-as-code).

**Common tools:** Linux, Docker, Kubernetes, Terraform, Ansible, cloud providers such as AWS, Azure and Google Cloud.

## 8. Monitor

Finally, the team watches how the change behaves for real people:

- Are pages loading as fast as before?
- Did errors go up after the release?
- How many people are actually using dark mode?

If errors jump, the team finds out from a dashboard or an alert, not from angry customers. And the answers feed back into **Plan**: maybe users want dark mode to follow their system setting automatically. That becomes the next small ticket, and the loop goes round again.

**Common tools:** Prometheus, Grafana, OpenTelemetry, cloud monitoring services. See [Monitoring, Logging and Alerting](/courses/devops/monitoring-logging-and-alerting).

## Environments: where the code lives along the way

On its journey, a change usually passes through several copies of the system, called **environments**:

| Environment | Who uses it | Purpose |
|---|---|---|
| **Local** (development) | One developer | Writing and trying code on their own computer |
| **Test** or **CI** | Automated tests | A clean, temporary machine for running the tests |
| **Staging** | The team | A close copy of production for a final check |
| **Production** | Real users | The live system |

The closer staging is to production, the fewer surprises you get. A common DevOps goal is "works on my machine" becoming "works the same everywhere". Containers, which you will meet in [Containers vs Virtual Machines](/courses/devops/containers-vs-virtual-machines), help a lot with that.

## Why small batches win

Imagine two shipping companies.

- The first sends **one giant ship a year**, loaded with everything. If the ship sinks, the whole year's cargo is lost. If a customer's parcel is wrong, they wait a year for the fix.
- The second sends **a delivery van every day**. If a van breaks down, one day's parcels are late. A wrong parcel is fixed tomorrow.

Old-style releases are the giant ship. DevOps is the daily van. A small change:

- is easier to review, because a person can actually read all of it;
- is easier to test, because there is less that can interact in strange ways;
- is easier to fix, because if it breaks, you know exactly what changed;
- reaches users sooner, so you learn sooner whether it was the right idea.

The time a change takes to travel from code to production has a name, **lead time**, and it is one of the key numbers you will measure in [Measuring DevOps: The Four DORA Metrics](/courses/devops/dora-metrics).

## The lifecycle as a script

The code panel for this lesson has a small Bash script that walks through all eight stages for our dark mode change. It writes a config file, "builds" it, checks it, packs it into a release archive, "deploys" it to a folder and runs a health check.

It is a toy, but every real pipeline has the same shape: a list of steps, each of which must pass before the next one starts. Run it with:

```bash
bash pipeline.sh
```

```text
=== 1. Plan ===
Ticket #42: add a dark mode toggle (small change, one day of work)

=== 2. Code ===
Wrote src/settings.conf
...
=== 8. Monitor ===
Health check OK: version 1.4.0 is live
```

The line `set -euo pipefail` at the top makes the script stop at the first failing command, exactly like a real pipeline stops at the first failing stage. You will learn more about Bash in [Essential Shell Commands and Bash Scripting](/courses/devops/shell-essentials).

## Common misunderstandings

### "The lifecycle is a straight line"

Older models drew a line that ended at "Deploy". In DevOps it is a loop. Deploying is not the end of the work; it is the start of learning whether the change was any good.

### "Each stage belongs to a different team"

In the old world, testers tested, ops deployed and nobody talked. In DevOps, one team owns the whole loop, and automation does much of the handing over.

### "Automation means skipping stages"

The opposite. Automation makes it cheap to run **every** stage, every time. When testing is a button press, nobody is tempted to skip it on a Friday afternoon.

## Quick recap

- The **software delivery lifecycle** is the path from idea to running feature.
- DevOps draws it as a never-ending loop of eight stages: **Plan, Code, Build, Test, Release, Deploy, Operate, Monitor**.
- **Build once**: the same artifact moves through every stage.
- **Deploying** puts code on servers; **releasing** shows it to users. Feature flags let you separate the two.
- Changes pass through **environments**: local, test, staging and production.
- **Small batches** are safer and faster than big releases.

Next, you will learn the principles that guide how teams run this loop in [DevOps Principles: CALMS and the Three Ways](/courses/devops/devops-principles).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# pipeline.sh: the eight lifecycle stages as one small, runnable script.
# Run it with: bash pipeline.sh
set -euo pipefail                 # stop at the first failing command, like a real pipeline
VERSION="1.4.0"
stage() { printf '\n=== %s ===\n' "$1"; }
stage "1. Plan"
echo "Ticket #42: add a dark mode toggle (small change, one day of work)"
stage "2. Code"
mkdir -p src
echo "theme=dark" &gt; src/settings.conf
echo "Wrote src/settings.conf"
stage "3. Build"
mkdir -p dist
cp src/settings.conf dist/
echo "version=$VERSION" &gt;&gt; dist/settings.conf
echo "Built dist/ for version $VERSION"
stage "4. Test"
grep -q "theme=dark" dist/settings.conf          # if either check fails, set -e stops here
grep -q "version=$VERSION" dist/settings.conf
echo "All checks passed"
stage "5. Release"
tar -czf "app-$VERSION.tar.gz" dist            # build once: this exact archive is what ships
echo "Packaged app-$VERSION.tar.gz"
stage "6. Deploy"
mkdir -p "server/releases/$VERSION"
tar -xzf "app-$VERSION.tar.gz" -C "server/releases/$VERSION"
rm -rf server/current
cp -r "server/releases/$VERSION" server/current
echo "server/current is now version $VERSION"
stage "7. Operate"
echo "Running config:"
cat server/current/dist/settings.conf
stage "8. Monitor"
if grep -q "version=$VERSION" server/current/dist/settings.conf; then
  echo "Health check OK: version $VERSION is live"
else
  echo "Health check FAILED: roll back!" &gt;&amp;2
  exit 1
fi
</code></pre>
