---
publishDate: 2026-10-25T10:10
title: 'DevOps Principles: CALMS and the Three Ways'
slug: devops-principles
metadescription: Learn the core DevOps principles, the CALMS model (Culture, Automation, Lean, Measurement, Sharing) and the Three Ways of flow, feedback and continual learning, with everyday examples.
updateDate: 2026-10-25T10:10
author: ['bishal-biswas']
level: 1
tags: ['devops', 'basics', 'principles', 'culture']
course: devops
---

## Why learn principles before tools?

Tools change all the time. Ten years ago, many DevOps jobs asked for Puppet and Chef. Today they ask for Terraform and Kubernetes. In ten more years, the list will be different again.

The **principles** behind those tools have hardly changed at all. If you understand **why** teams automate, measure and share, you can pick up any new tool quickly, and you will know when a tool is helping and when it is just adding work.

This lesson covers the two most popular ways of describing DevOps principles:

- **CALMS**, a checklist of five things a DevOps team cares about.
- **The Three Ways**, three ideas about how work should move through a team.

They overlap a lot. Think of them as two maps of the same country.

## CALMS

**CALMS** is an acronym. It grew out of **CAMS**, coined by John Willis and Damon Edwards in 2010. Jez Humble, co-author of the book *Continuous Delivery*, later added the **L** for Lean.

| Letter | Stands for | In one sentence |
|---|---|---|
| **C** | Culture | People share goals and responsibility, and learn without blame. |
| **A** | Automation | Machines do the repetitive, error-prone work. |
| **L** | Lean | Work flows in small batches with as little waste as possible. |
| **M** | Measurement | Decisions are based on data, not guesses. |
| **S** | Sharing | Knowledge, tools and lessons spread across teams. |

### C is for Culture

Culture comes first for a reason. You can automate everything and still fail if people do not trust each other.

A DevOps culture looks like this:

- **Shared goals.** Developers and operations people are measured on the same outcomes, such as "the site is fast and reliable for users", not "I shipped my feature" versus "I kept the servers up".
- **"You build it, you run it."** Werner Vogels, Amazon's CTO, made this phrase famous in 2006. The team that writes a service also looks after it in production. If your code wakes someone at 3 a.m., that someone is you, so you write code that does not.
- **Blameless learning.** When something breaks, the team asks "what about our process allowed this?" instead of "who did it?" People who fear blame hide mistakes. People who feel safe report them early, while they are still small. See [Incident Response and Blameless Postmortems](/courses/devops/incident-response-and-postmortems).

**You are doing it when:** a junior developer can say "I think I broke the login page" in the team chat without being afraid.

### A is for Automation

If a person has to do the same thing again and again, sooner or later they will do it wrong, especially when tired or rushed. Machines do not get tired.

DevOps teams automate:

- building and testing code ([Continuous Integration Explained](/courses/devops/continuous-integration));
- deploying it ([Continuous Delivery vs Continuous Deployment](/courses/devops/continuous-delivery-vs-deployment));
- creating servers and networks ([Infrastructure as Code with Terraform](/courses/devops/infrastructure-as-code));
- checking for security problems ([DevSecOps: Security in the Pipeline](/courses/devops/devsecops-basics)).

A good rule of thumb: **automate the second time**. The first time you do a task by hand, you learn how it works. The second time, you write a script.

> **Tip:** Automation is also documentation. A deploy script shows exactly how deployment works. A wiki page describing the steps is often out of date the day after someone writes it.

**You are doing it when:** a new team member can deploy on their first day by running one command.

### L is for Lean

**Lean** comes from the Toyota car factories of the 1950s. Its big idea is to remove **waste**: anything that takes time but gives the customer nothing.

In software, waste looks like:

- code that is finished but sitting around waiting to be released;
- waiting days for someone to approve a change;
- half-done work, because people started too many things at once;
- handing work between teams, where each handover loses information;
- features nobody uses.

Lean teams fight waste with **small batches** (see [The Software Delivery Lifecycle](/courses/devops/software-delivery-lifecycle)) and by limiting **work in progress**: finishing one thing before starting the next.

**You are doing it when:** most changes reach users within a day or two of being written.

### M is for Measurement

You cannot improve what you do not measure. Without numbers, every discussion becomes "I feel like deploys are slower lately".

DevOps teams measure two kinds of things:

- **How the delivery process is doing**, such as how often you deploy and how often deploys fail. The best-known set of these are the [DORA metrics](/courses/devops/dora-metrics).
- **How the software is doing**, such as response times, error rates and how many people use each feature. See [Monitoring, Logging and Alerting](/courses/devops/monitoring-logging-and-alerting).

**You are doing it when:** someone says "deploys feel slow" and someone else can open a chart and check.

### S is for Sharing

Sharing breaks down the walls between people:

- teams publish their scripts, pipelines and templates so others can reuse them;
- after an incident, the write-up is shared widely so other teams learn from it too;
- developers and operations people pair up, so each learns the other's world.

**You are doing it when:** you fix a tricky problem and your first thought is "I should write this down for the next person".

## The Three Ways

The **Three Ways** come from Gene Kim, who described them in the novel *The Phoenix Project* (2013) and then in more detail in *The DevOps Handbook* (2016). Each "way" builds on the one before.

### The First Way: Flow

Make work move **smoothly from left to right**: from development, through operations, to the customer.

Picture a water pipe. Water flows best when the pipe is short, wide and has no blockages. In software, the "blockages" are big batches, manual steps and long queues waiting for approval.

To improve flow:

- make changes small;
- automate the build, test and deploy steps;
- make the work **visible**, for example on a board where everyone can see what is in progress and what is stuck;
- never pass a known problem further down the line.

### The Second Way: Feedback

Make information flow **back from right to left**, as quickly as possible.

The sooner you find a problem, the cheaper it is to fix:

| When the bug is found | Cost to fix |
|---|---|
| While you are typing, by your editor | Seconds |
| When you commit, by a quick check | Minutes |
| In the pipeline, by automated tests | Under an hour |
| In production, by a customer | Hours or days, plus unhappy users |

Moving checks earlier like this is called **shifting left**, because on the lifecycle diagram "earlier" is on the left. The code panel for this lesson shows one way to do it: a small script Git runs on your own computer before every commit.

### The Third Way: Continual learning and experimentation

Build a team that **keeps getting better**. This means:

- running small experiments ("does this cache make the page faster?") and keeping what works;
- treating failures as lessons, written up without blame;
- setting aside time to improve the system, not just add features to it;
- practising for bad days, for example by testing that backups really can be restored.

> **Note:** A team that only ever has time for new features, and never for improving how it works, slowly gets slower. The Third Way says improving daily work matters as much as doing it.

## How the two models fit together

| Three Ways | Closest CALMS letters |
|---|---|
| Flow | Automation, Lean |
| Feedback | Measurement, Automation |
| Continual learning | Culture, Sharing |

Use whichever one helps you think. CALMS is handy as a checklist ("are we weak on Measurement?"). The Three Ways are handy for spotting where work gets stuck.

## A first taste of shifting left

The code panel has a **Git pre-commit hook**: a script Git runs automatically every time you type `git commit`. If the script fails, the commit is stopped. This one does three quick checks:

1. It blocks commits that look like they contain a password or API key (**Culture** and **Automation**: protect each other from easy mistakes).
2. It warns when a commit is very large (**Lean**: small batches).
3. It runs the project's lint and tests (**Feedback**: find problems in seconds, not days).

To try it, save the file as `.git/hooks/pre-commit` inside any Git project and make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

Now a commit with a leaked password is refused:

```text
pre-commit: checking staged files...
+DB_PASSWORD=hunter2
Blocked: this commit looks like it contains a secret.
Move it to an environment variable or a secrets manager.
```

You will learn better, team-wide versions of these checks in [DevSecOps: Security in the Pipeline](/courses/devops/devsecops-basics).

## Common misunderstandings

### "Principles are just theory"

Every practice in the rest of this course traces back to these ideas. Pipelines exist because of Flow. Tests and monitoring exist because of Feedback. Postmortems exist because of Continual learning.

### "We need to do all of CALMS at once"

You do not. Most teams start with one painful problem, such as slow, scary deployments, and fix that. Each improvement makes the next one easier.

### "Blameless means nobody is responsible"

Blameless does not mean careless. People are still responsible for their work. It means the team focuses on fixing the **system** that let a mistake through, because the next person could easily make the same mistake.

## Quick recap

- Learn principles first: tools change, principles last.
- **CALMS**: **Culture**, **Automation**, **Lean**, **Measurement** and **Sharing**.
- **The Three Ways**: **Flow** (left to right), **Feedback** (right to left, fast) and **Continual learning**.
- **Shifting left** means finding problems earlier, when they are cheapest to fix.
- "You build it, you run it" and blameless learning are at the heart of DevOps culture.

Next, you will see how to put real numbers on all of this in [Measuring DevOps: The Four DORA Metrics](/courses/devops/dora-metrics).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# .git/hooks/pre-commit: "shift left" in practice.
# Git runs this before every commit. If it exits with an error, the commit
# is blocked, so problems are caught on your laptop, seconds after you made them.
# Install: save as .git/hooks/pre-commit, then run: chmod +x .git/hooks/pre-commit
set -euo pipefail
echo "pre-commit: checking staged files..."
# 1. Never commit secrets (Culture + Automation)
#    Look only at lines being added (they start with +) in the staged changes.
if git diff --cached -U0 | grep -E '^\+' | grep -Ei '(api[_-]?key|secret|password)[[:space:]]*='; then
  echo "Blocked: this commit looks like it contains a secret." &gt;&amp;2
  echo "Move it to an environment variable or a secrets manager." &gt;&amp;2
  exit 1
fi
# 2. Keep changes small (Lean: small batches)
changed=$(git diff --cached --numstat | awk '{ total += $1 + $2 } END { print total + 0 }')
if [ "$changed" -gt 400 ]; then
  echo "Warning: $changed lines changed. Smaller commits are easier to review and undo."
fi
# 3. Fast feedback: run the quick checks if this is a Node.js project
if [ -f package.json ]; then
  npm run --silent --if-present lint     # --if-present: skip if the script does not exist
  npm run --silent --if-present test
fi
echo "pre-commit: all checks passed"
</code></pre>
