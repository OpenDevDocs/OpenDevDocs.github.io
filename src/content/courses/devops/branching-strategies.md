---
publishDate: 2026-10-25T10:45
title: 'Branching Strategies: GitFlow vs Trunk-Based Development'
slug: branching-strategies
metadescription: Compare the main Git branching strategies, GitFlow, GitHub Flow and trunk-based development, learn how feature flags and branch protection support them, and how to choose one for your team.
updateDate: 2026-10-25T10:45
author: ['bishal-biswas']
level: 2
tags: ['devops', 'git', 'branching', 'trunk-based', 'gitflow']
course: devops
---

## Why a team needs a branching strategy

In [Version Control with Git](/courses/devops/version-control-with-git) you learned how to create and merge branches. On your own, that is all you need. On a team of ten, it raises questions fast:

- Where do new features go while they are being built?
- Which branch is deployed to production?
- How long can a branch live before it is merged?
- How do you ship an urgent fix while a big feature is half-done?

A **branching strategy** (or **branching model**) is a team's agreed answer to those questions. The choice matters a lot for DevOps, because it decides how often code is **integrated** (combined with everyone else's) and how quickly it can reach users.

## The problem: long-lived branches

Picture two developers. Each takes a branch and works alone on it for six weeks. Meanwhile, `main` keeps moving as other work is merged.

When they finally try to merge, everything collides at once. Both changed the same files. Some changes contradict each other. Tests that passed on each branch fail together. The team spends days untangling it, an experience often called **merge hell**.

The longer branches live, the bigger and riskier each merge becomes. It is the giant-ship problem from [The Software Delivery Lifecycle](/courses/devops/software-delivery-lifecycle) again: small, frequent merges are safer than big, rare ones.

The three strategies below handle this differently.

## Strategy 1: GitFlow

**GitFlow** was published by Vincent Driessen in 2010 and became very popular. It uses several kinds of long-lived and short-lived branches, each with a strict job:

| Branch | Lives | Purpose |
|---|---|---|
| `main` | Forever | Only released, production-ready code. Every commit is a tagged release. |
| `develop` | Forever | Where finished features are combined, ready for the next release. |
| `feature/*` | Days to weeks | One new feature, branched from `develop` and merged back into it. |
| `release/*` | Days | Preparing a release: final fixes and version numbers, then merged into `main` **and** `develop`. |
| `hotfix/*` | Hours | Urgent production fixes, branched from `main`, merged into `main` **and** `develop`. |

```text
hotfix/1.1.1                            ●
                                       / \
main          v1.0 ●──────────── v1.1 ●───● v1.1.1
                    \                /     \
release/1.1          \          ●───●       \
                      \        /     \       \
develop                ●──●───●───────●───────●
                           \     /
feature/login               ●───●
```

Features flow into `develop`, a release branch carries `develop` into `main`, and hotfixes start from `main` and are merged back into both.

**Strengths:**

- Very clear structure. Everyone knows where everything goes.
- Works well when you ship **numbered versions** on a schedule and must support several at once, such as desktop software, mobile apps or libraries.

**Weaknesses:**

- Lots of branches and lots of merging.
- Features often live on their branches for a long time, so integration is late and painful.
- There is a delay between "feature finished" and "feature released", which slows feedback.

> **Note:** In 2020, Driessen himself added a note to his original article: for software that is **delivered continuously**, like most web apps, he suggested a simpler workflow such as GitHub Flow instead. GitFlow remains a fair choice for software that is released as explicit versions.

## Strategy 2: GitHub Flow

**GitHub Flow** is much simpler. It has one rule at its heart: **`main` is always deployable**.

1. Create a branch from `main` with a descriptive name, such as `fix-login-timeout`.
2. Commit to it.
3. Open a **pull request** early, to start the discussion.
4. The CI pipeline runs; teammates review.
5. Merge into `main`.
6. Deploy `main` (often automatically).

```text
main   ●────●─────────●────────●────●
             \       /  \     /
fix-login     ●──●──●    ●───●  add-search
```

There is no `develop`, no `release` and no `hotfix` branch. A hotfix is just another small branch, merged and deployed like everything else.

**Strengths:** easy to learn, fits continuous deployment, and every merge goes live quickly.

**Weaknesses:** it relies on good automated tests, because there is no separate stage to catch problems before `main`. And it says nothing about how **long** a branch may live, so branches can still grow too big.

## Strategy 3: Trunk-based development

**Trunk-based development** takes GitHub Flow to its logical end. (**Trunk** is an older name for the main branch.)

Everyone integrates their work into `main` **at least once a day**. Branches, if used at all, are tiny and short-lived: hours, a day or two at most.

```text
main   ●──●──●──●──●──●──●──●──●──●──●──●
          \ /   \ /      \ /   \ /
           ●     ●        ●     ●      (branches live hours, not weeks)
```

Merge conflicts stay tiny because nobody drifts far from everyone else. Problems surface the same day they are made. The DORA research you met in [Measuring DevOps](/courses/devops/dora-metrics) found that trunk-based development, with few active branches that each live for less than a day, is one of the practices that predicts higher delivery performance.

### "But my feature takes three weeks"

This is the obvious question. If you merge every day, half-finished work ends up in `main`, and `main` is deployed. How is that safe?

The main answer is **feature flags**: an on/off switch in the code or config.

```javascript
if (flags.darkMode) {
  showDarkModeToggle();
}
```

You merge the unfinished dark mode code every day with the flag **off**. It is in production, but nobody sees it. When the feature is complete and tested, you flip the flag **on**. If something goes wrong, you flip it **off** again, with no rollback deployment needed.

Feature flags give you two powerful extras:

- **Separating deploy from release**, as you saw in [The Software Delivery Lifecycle](/courses/devops/software-delivery-lifecycle): code goes out whenever it is ready; features are released when the business decides.
- **Gradual rollouts**: turn a feature on for staff first, then 5% of users, then everyone. More in [Deployment Strategies](/courses/devops/deployment-strategies).

> **Tip:** Flags are temporary. Once a feature is fully released and stable, delete the flag and the old code path. Forgotten flags pile up and make code hard to follow.

For bigger internal changes, such as replacing a database library, teams use **branch by abstraction**: put an interface in front of the old code, build the new version behind it step by step on `main`, then switch over and remove the old one.

**Strengths:** fastest feedback, fewest merge conflicts, best fit for continuous delivery.

**Weaknesses:** needs good automated tests, a fast CI pipeline and the discipline of small changes. Teams new to it need time to learn to break work into small, safe steps.

## Side by side

| | GitFlow | GitHub Flow | Trunk-based |
|---|---|---|---|
| Long-lived branches | `main` and `develop` | `main` only | `main` only |
| Typical branch life | Days to weeks | Days | Hours to a day |
| Unfinished work hidden by | Staying on its branch | Staying on its branch | Feature flags |
| Release style | Scheduled versions | Continuous | Continuous |
| Merge pain | Higher | Medium | Lowest |
| Best for | Versioned products: apps, libraries, firmware | Most web apps and small teams | Teams aiming for many deploys a day |

You may also meet **GitLab Flow**, which adds **environment branches** such as `staging` and `production` on top of GitHub Flow. Code moves from `main` to `staging` to `production` by merging. It is a middle ground for teams that need a manual step before production.

## How to choose

- **Building a web app or API that you deploy yourself?** Start with **GitHub Flow**, keep branches short, and move towards **trunk-based** as your tests and pipeline improve.
- **Shipping versioned software that customers install,** and supporting several versions at once? **GitFlow**, or trunk-based development with **release branches** cut for each version, will fit better.
- **Not sure?** Choose the simplest model that works, and measure your [lead time](/courses/devops/dora-metrics). If changes wait a long time on branches, simplify.

Whatever you choose, the one habit that helps every strategy is: **keep branches small and merge them quickly**.

## Merging a pull request: three options

GitHub and GitLab offer three ways to merge a branch. Teams usually pick one and stick to it.

| Method | What happens | History looks like |
|---|---|---|
| **Merge commit** | Keeps every commit and adds a merge commit joining the branches | Full detail, with branch "bubbles" |
| **Squash and merge** | Combines the branch's commits into one commit on `main` | One clean commit per pull request |
| **Rebase and merge** | Replays each commit on top of `main`, with no merge commit | A straight line, every commit kept |

**Squash and merge** is a popular default for short-lived branches: "WIP", "fix typo" and "try again" commits disappear, and each pull request becomes one meaningful commit on `main`.

## Protecting main

A strategy only works if people follow it. Hosting services let you enforce the rules with **branch protection** (GitHub also calls these **rulesets**). Common settings for `main`:

- **Require a pull request** before merging: nobody pushes straight to `main`.
- **Require approvals**, for example at least one reviewer.
- **Require status checks to pass**: the CI pipeline must be green.
- **Block force pushes and deletion**, so history cannot be rewritten.
- **Require the branch to be up to date** with `main` before merging, so the tests ran against the latest code.

You will turn these on for your own repository in [Your First Pipeline with GitHub Actions](/courses/devops/first-github-actions-pipeline).

## Seeing trunk-based development in action

The code panel for this lesson has a script that builds a tiny project in a throwaway `trunk-demo` repository and works the trunk-based way: half-finished dark mode code is merged into `main` on day one behind a flag that is **off**, the rest follows on day two, and the release is just a one-line flag change. Rolling back is flipping it off again.

```bash
bash trunk-based.sh
```

```text
--- Day 1: half-built dark mode, merged behind a flag that is OFF
  $ ./app.sh
  Recipes home page
  Theme: light
...
--- Release: flip the flag. No big merge, no new branch
  $ ./app.sh
  Recipes home page
  Theme: dark
...
--- History: one straight line, every commit releasable
b775e16 Revert "Turn on dark mode"
aee8d8d Turn on dark mode
c8e8bc0 Add dark mode stylesheet
0277c98 Add dark mode behind a feature flag (off)
edcf365 Add home page
```

Notice that users kept seeing the light theme while unfinished code was already in `main`, and that every commit in the history was safe to deploy.

## Common misunderstandings

### "Trunk-based means no branches and no code review"

Most trunk-based teams still use short-lived branches and pull requests. The difference is that those branches live for hours, not weeks, and reviews happen quickly because each change is small.

### "GitFlow is outdated, so it is wrong"

It is a poor fit for continuously deployed web apps, but it still suits products released as versions. Choose by how you ship, not by fashion.

### "Feature flags are only for big companies"

A flag can be as simple as a line in a config file or an environment variable, like the one in this lesson's script. Dedicated flag services add dashboards and gradual rollouts, but you can start without one.

## Quick recap

- A **branching strategy** decides where work goes and how often it is integrated.
- **Long-lived branches** cause painful, risky merges.
- **GitFlow** uses `main`, `develop`, feature, release and hotfix branches; it suits versioned products.
- **GitHub Flow** keeps `main` always deployable, with short branches and pull requests.
- **Trunk-based development** integrates into `main` at least daily and hides unfinished work behind **feature flags**.
- **Squash and merge** keeps history clean; **branch protection** enforces reviews and green pipelines.

That completes **Linux and Git Foundations**. Next, you will learn how computers find and talk to each other in [IP Addresses, Ports and Protocols](/courses/devops/ip-addresses-ports-and-protocols).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# trunk-based.sh: trunk-based development with a feature flag, in a throwaway repo.
# Half-finished work is merged into main every day, but stays hidden behind a flag
# until it is ready. Run it with: bash trunk-based.sh
set -euo pipefail
step() { printf '\n--- %s\n' "$1"; }
run_app() { echo "  \$ ./app.sh"; bash app.sh | sed 's/^/  /'; }
# Merge a short-lived branch back into main as one tidy commit, like a squash-merged PR
ship() {
  git switch --quiet main
  git merge --quiet --squash "$1" &gt; /dev/null    # stage the branch as one change
  git commit --quiet -m "$2"
  git branch --quiet -D "$1"
}
rm -rf trunk-demo &amp;&amp; mkdir trunk-demo &amp;&amp; cd trunk-demo
git init --quiet --initial-branch=main
git config user.name "Demo User"
git config user.email "demo@example.com"
step "Start: main is always releasable"
cat &gt; app.sh &lt;&lt;'EOF'
echo "Recipes home page"
echo "Theme: light"
EOF
git add . &amp;&amp; git commit --quiet -m "Add home page"
run_app
step "Day 1: half-built dark mode, merged behind a flag that is OFF"
git switch --quiet -c dark-mode-flag
echo "dark_mode=off" &gt; flags.conf
cat &gt; app.sh &lt;&lt;'EOF'
. ./flags.conf
echo "Recipes home page"
if [ "$dark_mode" = "on" ]; then echo "Theme: dark"; else echo "Theme: light"; fi
EOF
git add . &amp;&amp; git commit --quiet -m "WIP dark mode"
ship dark-mode-flag "Add dark mode behind a feature flag (off)"
run_app
step "Day 2: finish the styles, merged the same day"
git switch --quiet -c dark-mode-styles
echo "body { background: #111; color: #eee; }" &gt; dark.css
git add . &amp;&amp; git commit --quiet -m "WIP styles"
ship dark-mode-styles "Add dark mode stylesheet"
run_app
step "Release: flip the flag. No big merge, no new branch"
sed -i.bak 's/dark_mode=off/dark_mode=on/' flags.conf &amp;&amp; rm flags.conf.bak
git commit --quiet -am "Turn on dark mode"
run_app
step "Problem? Roll back by flipping it off again"
git revert --no-edit HEAD &gt; /dev/null
run_app
step "History: one straight line, every commit releasable"
git log --oneline
</code></pre>
