---
publishDate: 2026-10-25T10:15
title: 'Measuring DevOps: The Four DORA Metrics'
slug: dora-metrics
metadescription: Learn the four DORA metrics, deployment frequency, lead time for changes, change failure rate and time to restore, how to measure them and how to avoid common traps.
updateDate: 2026-10-25T10:15
author: ['bishal-biswas']
level: 1
tags: ['devops', 'basics', 'dora', 'metrics']
course: devops
---

## Why measure at all?

Ask a team "are we getting better at delivering software?" and you will usually get opinions: "deploys feel slower", "I think we break things less now". Opinions are hard to act on and easy to argue about.

The **M** in [CALMS](/courses/devops/devops-principles) stands for **Measurement**. But measure what? Lines of code? Hours worked? Number of tickets closed? Those are easy to count and say very little about whether users are getting good software quickly.

The most widely used answer comes from **DORA**.

## What is DORA?

**DORA** stands for **DevOps Research and Assessment**. It is a research programme, led for years by Dr Nicole Forsgren with Jez Humble and Gene Kim, that has surveyed tens of thousands of software professionals for more than a decade. Its findings were published in the yearly **State of DevOps** reports and in the 2018 book *Accelerate*. Today DORA is part of Google Cloud and still publishes a report every year.

The research asked a simple question: **what separates teams that deliver software well from teams that struggle?** It found that just four measurements predict a team's performance remarkably well. These are the **DORA metrics**, sometimes called the **four key metrics**.

## The four metrics at a glance

| Metric | Question | Measures |
|---|---|---|
| **Deployment frequency** | How often do we ship to production? | Speed |
| **Lead time for changes** | How long from commit to production? | Speed |
| **Change failure rate** | What share of deployments cause a problem? | Stability |
| **Time to restore service** | When something breaks, how fast do we fix it? | Stability |

Two measure **speed** (also called **throughput**) and two measure **stability**. That balance is the whole point. Any team can look fast by skipping tests, or look stable by never shipping anything. The DORA metrics catch both tricks.

Let us look at each one.

## 1. Deployment frequency

**How often does the team successfully deploy to production?**

Count the deployments in a period and divide. A team that deployed 12 times in October deployed about 2.7 times a week.

Why it matters: frequent deployments mean **small batches**. As you saw in [The Software Delivery Lifecycle](/courses/devops/software-delivery-lifecycle), small changes are easier to test, review and fix.

> **Note:** Count deployments to **production** only. Deploying to a test environment 50 times a day is good practice, but it is not what this metric measures.

## 2. Lead time for changes

**How long does it take a committed change to reach production?**

Start the clock when the code is committed. Stop it when that code is running for real users. If a fix was committed at 9:00 and was live at 15:00, its lead time is 6 hours.

Teams usually report the **median**: line all the lead times up from shortest to longest and take the one in the middle. Unlike the average, the median is not dragged around by one unusual change that sat waiting for three weeks.

Why it matters: lead time shows how long a change spends **waiting**. Waiting for a reviewer, for a test environment, for the Thursday release window, for a manager to sign off. Long lead times mean slow feedback and slow fixes.

> **Tip:** Some people measure from when work **started**, or when the ticket was written. DORA measures from **commit**, because that part of the journey is mostly under the delivery team's control and is easy to track automatically.

## 3. Change failure rate

**What percentage of deployments cause a failure in production?**

A "failure" is any deployment that needs fixing straight away: a rollback, an urgent hotfix, an outage or a serious bug users can see. If 2 of 12 deployments caused trouble, the change failure rate is about 17%.

Why it matters: this is the quality check on speed. Deploying ten times a day is only useful if most of those deployments work.

## 4. Time to restore service

**When a deployment causes a failure, how long does it take to recover?**

Start the clock when users are affected. Stop it when service is back to normal, whether by a fix, a rollback or switching a feature flag off.

Why it matters: failures **will** happen, to every team. Strong teams accept this and get very good at recovering. Recent DORA reports call this metric **failed deployment recovery time**, which makes clearer that it is about failures caused by changes, not, say, a data centre losing power.

## Speed and stability go together

Here is the most surprising result from the research. You might expect a trade-off: teams that go fast break more things, and careful teams go slowly.

The data says the opposite. Year after year, the best performers are **better at all four**: they deploy more often, with shorter lead times, **and** fail less, **and** recover faster. The worst performers are worse at all four.

Why? Because the same practices drive both. Small batches, automated tests and automated deployment make changes faster **and** safer at the same time.

## What "good" looks like

DORA groups teams by their results. The exact cut-offs change a little each year, so treat these as a rough guide:

| Metric | Strong teams | Struggling teams |
|---|---|---|
| Deployment frequency | On demand, often several times a day | Once a month or less |
| Lead time for changes | Less than a day | Weeks to months |
| Change failure rate | Around 5% | Very high, sometimes over half |
| Time to restore | Less than an hour | A week or more |

Do not panic if your team is far from the left column. Almost everyone starts on the right. The goal is to **improve against yourself**, month after month.

## A fifth metric: rework rate

The four metrics are still the core, but DORA keeps refining them. Its 2024 report added a fifth, **rework rate**: the share of deployments that were not planned, but made only to fix a problem users ran into.

The report now groups the metrics into two families:

- **Throughput:** deployment frequency, lead time for changes and failed deployment recovery time.
- **Instability:** change failure rate and rework rate.

You will mostly see the classic four in articles and tools, and they are the best place to start.

## How to measure them in practice

You do not need special software to begin. The data already lives in tools you use:

| Metric | Where the data comes from |
|---|---|
| Deployment frequency | Your CI/CD system's list of production deployments |
| Lead time for changes | Commit times from Git, plus deployment times from CI/CD |
| Change failure rate | Deployments, plus rollbacks, hotfixes or incident tickets linked to them |
| Time to restore | Your incident tracker or alerting tool: when it started and when it was resolved |

The code panel for this lesson has a small Node.js script that calculates all four metrics from a month of deployment records. Running it gives:

```bash
node dora.mjs
```

```text
Period: 31 days, 12 deployments

1. Deployment frequency : 2.7 per week
2. Lead time for changes: 7.0 hours (median)
3. Change failure rate  : 17%
4. Time to restore      : 1.6 hours (median)

- Fewer than daily deploys: look for manual steps or big batches.
- Changes reach users within a day.
- Many deployments fail: strengthen automated tests.
- Recovery takes over an hour: practise rollbacks.
```

Reading the result: this team gets changes out quickly once they are committed, but 2 of 12 deployments failed. Better automated tests ([Automated Testing in the Pipeline](/courses/devops/testing-in-the-pipeline)) and safer rollouts ([Deployment Strategies](/courses/devops/deployment-strategies)) would be good next steps.

Once you have a pipeline, many tools can track these numbers for you automatically, including GitLab, Azure DevOps, Datadog and many dedicated engineering-metrics products.

## Common traps

### Measuring people instead of systems

The DORA metrics describe how well a **team and its systems** deliver software. They are not a way to rank individual developers. The moment people feel judged by a number, they start bending the number instead of improving the work.

### Gaming the numbers

There is an old saying, known as **Goodhart's law**: when a measure becomes a target, it stops being a good measure. Tell a team "deploy more often!" and they can split one change into ten meaningless deployments. Always look at all four metrics together, and always ask whether users are actually better off.

### Comparing teams against each other

A team running a 20-year-old banking system and a team building a new mobile app face very different challenges. Compare each team with its own past, not with the team next door.

### Measuring without acting

A dashboard nobody looks at changes nothing. Pick the weakest metric, try one improvement, and check the numbers again a month later. That is the [Third Way](/courses/devops/devops-principles) of continual learning in action.

## Quick recap

- **DORA** (DevOps Research and Assessment) found four metrics that predict software delivery performance.
- **Speed:** deployment frequency and lead time for changes.
- **Stability:** change failure rate and time to restore service (now called failed deployment recovery time).
- The best teams are faster **and** more stable, because the same practices improve both.
- Newer reports add **rework rate** and group the metrics into throughput and instability.
- Measure teams and systems, not individuals, and compare a team with its own past.

Next, you will see the full map of skills and tools you will learn in [The DevOps Roadmap and Toolchain](/courses/devops/devops-roadmap-and-toolchain).

<code id="code-content" class="language-javascript">
// dora.mjs: calculate the four DORA metrics from one month of delivery data.
// Run it with: node dora.mjs
// Each deployment records when its change was first committed, when it reached
// production, whether it caused a failure, and (if so) when service was restored.
const deployments = [
  { version: '1.3.0', committedAt: '2026-10-01T09:00', deployedAt: '2026-10-01T15:00' },
  { version: '1.3.1', committedAt: '2026-10-02T10:00', deployedAt: '2026-10-03T11:00' },
  { version: '1.4.0', committedAt: '2026-10-06T13:00', deployedAt: '2026-10-06T17:30' },
  { version: '1.4.1', committedAt: '2026-10-07T09:30', deployedAt: '2026-10-08T10:30',
    failed: true, restoredAt: '2026-10-08T11:15' },
  { version: '1.4.2', committedAt: '2026-10-09T14:00', deployedAt: '2026-10-09T16:00' },
  { version: '1.5.0', committedAt: '2026-10-13T09:00', deployedAt: '2026-10-14T09:00' },
  { version: '1.5.1', committedAt: '2026-10-15T11:00', deployedAt: '2026-10-15T15:00' },
  { version: '1.6.0', committedAt: '2026-10-16T10:00', deployedAt: '2026-10-17T12:00',
    failed: true, restoredAt: '2026-10-17T14:30' },
  { version: '1.6.1', committedAt: '2026-10-20T09:00', deployedAt: '2026-10-20T13:00' },
  { version: '1.7.0', committedAt: '2026-10-22T15:00', deployedAt: '2026-10-23T10:00' },
  { version: '1.7.1', committedAt: '2026-10-27T09:00', deployedAt: '2026-10-27T12:00' },
  { version: '1.8.0', committedAt: '2026-10-29T10:00', deployedAt: '2026-10-29T18:00' },
];
const DAYS_IN_PERIOD = 31;                       // October
const HOUR = 60 * 60 * 1000;
const hoursBetween = (from, to) =&gt; (new Date(to) - new Date(from)) / HOUR;
// The median is the middle value. Unlike the average, one very slow change
// cannot drag it far, so it shows what a "normal" change looks like.
const median = (values) =&gt; {
  const sorted = [...values].sort((a, b) =&gt; a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
// --- Speed (throughput)
// 1. Deployment frequency: how often we ship to production
const perWeek = deployments.length / (DAYS_IN_PERIOD / 7);
// 2. Lead time for changes: commit to running in production
const leadTime = median(deployments.map((d) =&gt; hoursBetween(d.committedAt, d.deployedAt)));
// --- Stability
// 3. Change failure rate: share of deployments that caused a failure
const failures = deployments.filter((d) =&gt; d.failed);
const failureRate = (failures.length / deployments.length) * 100;
// 4. Time to restore service: failure to fixed
const restoreTime = median(failures.map((d) =&gt; hoursBetween(d.deployedAt, d.restoredAt)));
console.log(`Period: ${DAYS_IN_PERIOD} days, ${deployments.length} deployments`);
console.log('');
console.log(`1. Deployment frequency : ${perWeek.toFixed(1)} per week`);
console.log(`2. Lead time for changes: ${leadTime.toFixed(1)} hours (median)`);
console.log(`3. Change failure rate  : ${failureRate.toFixed(0)}%`);
console.log(`4. Time to restore      : ${restoreTime.toFixed(1)} hours (median)`);
// --- A rough verdict. Real DORA cut-offs change a little every year.
const verdict = [
  perWeek &gt;= 7 ? 'Deploying daily or more: great flow.' : 'Fewer than daily deploys: look for manual steps or big batches.',
  leadTime &lt;= 24 ? 'Changes reach users within a day.' : 'Changes wait more than a day: where do they queue?',
  failureRate &lt;= 15 ? 'Few deployments cause trouble.' : 'Many deployments fail: strengthen automated tests.',
  restoreTime &lt;= 1 ? 'Recovery in under an hour.' : 'Recovery takes over an hour: practise rollbacks.',
];
console.log('');
verdict.forEach((line) =&gt; console.log(`- ${line}`));
</code></pre>
