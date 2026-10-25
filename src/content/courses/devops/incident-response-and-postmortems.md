---
publishDate: 2026-10-25T12:20
title: Incident Response and Blameless Postmortems
slug: incident-response-and-postmortems
metadescription: Learn how DevOps teams handle production incidents, severity levels, on-call, incident roles, mitigating before fixing, communicating during an outage, writing blameless postmortems with useful action items, and practising for bad days.
updateDate: 2026-10-25T12:20
author: ['bishal-biswas']
level: 2
tags: ['devops', 'incident-response', 'postmortems', 'on-call', 'sre']
course: devops
---

## When things go wrong

However good your tests, pipelines and deployment strategies, something will eventually break in production. A release with a hidden bug, a cloud region having a bad day, a certificate nobody renewed, a sudden flood of traffic.

An **incident** is any unplanned event that hurts, or seriously threatens, the service your users rely on. Teams that handle incidents well do not avoid them entirely. They **notice quickly**, **restore service fast**, **communicate clearly** and **learn** so the same thing does not happen again.

In the [DORA metrics](/courses/devops/dora-metrics), this is **time to restore service**. In this lesson you will learn the practices that shrink it.

## Severity levels

Not every problem deserves the same response. Teams agree on **severity levels** in advance, so nobody has to debate during a crisis whether to wake people up:

| Severity | Meaning | Example | Response |
|---|---|---|---|
| **SEV-1** | Critical: the main service is down or data is at risk | Nobody can log in or pay; customer data exposed | Page everyone needed, now; all hands until resolved |
| **SEV-2** | Major: an important feature is broken for many users | Checkout fails for 13% of orders | Page the on-call engineer; incident commander assigned |
| **SEV-3** | Minor: limited impact, or a workaround exists | Search is slow; one report export fails | Fix during working hours |
| **SEV-4** | Cosmetic or very low impact | A typo on the help page | Normal ticket |

The exact definitions matter less than having them **written down** and **agreed**. When in doubt, declare the **higher** severity: it is easy to downgrade an incident, and embarrassing to discover an hour later that it was bigger than you thought.

## On-call

Someone has to respond when an alert fires at 3 a.m. Most teams share that job through an **on-call rotation**: each person is on call for a week at a time, carrying a phone that receives pages from tools such as PagerDuty, routed by the alerting setup you met in [Monitoring, Logging and Alerting](/courses/devops/monitoring-logging-and-alerting).

Healthy on-call has a few ingredients:

- **Few, actionable pages.** If on-call means being woken every night by noisy alerts, fix the alerts. A common goal is no more than a couple of pages per shift.
- **A clear escalation path.** If the on-call engineer does not acknowledge within a few minutes, the page goes to a backup, then a manager.
- **Runbooks** for known alerts: what it means, how to check, what to try first.
- **Handovers** at the end of each shift: what happened, what is still open.
- **Fairness**: rotations shared across the team, time off after a bad night, and recognition (often pay) for being on call.

With "you build it, you run it" ([DevOps Principles](/courses/devops/devops-principles)), the developers who build a service join its rotation. That is a powerful incentive to build things that do not page.

## The incident lifecycle

```text
 Detect  ->  Respond  ->  Mitigate  ->  Resolve  ->  Learn
 alert or    acknowledge,  stop the      confirm       blameless
 user report assess,       user pain     stable,       postmortem,
             declare       (roll back!)  close         action items
```

The time between these steps gives you the measures that matter, all counted from when users were first affected:

| Measure | From → to |
|---|---|
| **Time to detect** | Impact begins → someone knows |
| **Time to acknowledge** | Alert fires → a human responds |
| **Time to mitigate** | Impact begins → users are no longer affected |
| **Time to resolve** | Impact begins → incident closed |

## Roles during an incident

For anything beyond a small, one-person problem, give people clear **roles**. The idea comes from the **Incident Command System** used by fire and emergency services, where it was learned the hard way that a crisis with nobody in charge becomes chaos.

| Role | Job |
|---|---|
| **Incident commander** (IC) | Runs the response: decides priorities, assigns tasks, decides when to escalate and when the incident is over. The IC **coordinates and does not debug**. |
| **Operations lead** / subject-matter experts | Investigate and make changes to the systems |
| **Communications lead** | Updates stakeholders, support teams and the public status page, so the people fixing things are not interrupted |
| **Scribe** | Records the timeline: what was seen, decided and done, and when |

In a small team, one person may hold several roles, but someone must always be **the** incident commander. It is a role, not a job title: anyone trained can take it, and it can be handed over explicitly ("I'm handing IC to Ravi").

## Mitigate first, fix later

The single most important habit in incident response:

> **Stop the bleeding first. Find the root cause afterwards.**

During an incident, the goal is to **restore service**, not to understand the bug. If the problems started with a release, **roll back** first and investigate later, with users happy and no pressure. Common mitigations:

- **Roll back** the last deployment ([Continuous Delivery vs Continuous Deployment](/courses/devops/continuous-delivery-vs-deployment));
- **turn off a feature flag** ([Branching Strategies](/courses/devops/branching-strategies));
- **scale up**, if the problem is load;
- **fail over** to another region or a standby database;
- **block** abusive traffic at the load balancer.

Many outages last far longer than necessary because smart engineers are debugging a fascinating problem live while users wait. Fast rollback is not giving up; it is doing the job.

## Communicating during an incident

Bad communication can hurt more than the outage itself. Good practice:

- **One place to coordinate.** Open a dedicated chat channel per incident, such as `#inc-2026-10-23-checkout`, and keep side conversations out of it.
- **Regular updates**, even when nothing has changed, for example every 30 minutes for a SEV-2. Silence makes people assume the worst.
- **A status page** for customers, in plain language: what is affected, what you are doing, when the next update will come.
- **Facts, not guesses.** "We are investigating elevated checkout errors" is better than "the database crashed" if you do not know that yet.

A simple update format:

```text
[SEV-2] Checkout errors - update 14:35 UTC
Impact:  About 13% of checkout attempts failed between 14:06 and 14:31.
Status:  MITIGATED. Release v1.6.0 was rolled back; error rate is back to normal.
Next:    Monitoring for 15 minutes before closing. Next update 14:50 UTC.
```

## Blameless postmortems

After a significant incident, the team writes a **postmortem** (also called an **incident review** or **post-incident report**): a short document explaining what happened and what will change.

The key word is **blameless**. A blameless postmortem assumes that everyone involved acted reasonably, given what they knew at the time, and asks:

- **What** in our systems, tools and processes made this possible?
- **Why** did it make sense to the people involved to do what they did?
- **How** do we make the right action easier and the wrong one harder next time?

Why go to this trouble? Because if people are blamed for mistakes, they hide them. Problems are reported late or not at all, near-misses are never discussed, and the same failure happens again to someone else. John Allspaw's 2012 article about Etsy's "blameless postmortems" made this idea widely known: you can only fix what people feel safe telling you.

"The engineer ran the wrong command" is never the end of the analysis. Why was it possible to run that command against production? Why did it look so similar to the right one? Why was there no confirmation?

### What a postmortem contains

1. **Summary**: what happened and the impact, in two or three sentences.
2. **Impact**: who was affected, for how long, how badly (users, orders, revenue).
3. **Timeline**: what happened when, from the first sign to the end, in a consistent time zone.
4. **Contributing factors**: usually several, not one "root cause". Complex failures rarely have a single cause.
5. **What went well, what went badly and where we got lucky**. "Lucky" is important: luck is not a plan.
6. **Action items**: specific, small, each with an **owner** and a **due date**, tracked like any other work.

> **Tip:** The **five whys** technique (keep asking "why?") is a useful starting point for finding contributing factors, but do not stop at the first chain of answers. Real incidents usually come from several conditions lining up, like holes in slices of Swiss cheese.

### Good action items

| Weak | Strong |
|---|---|
| "Be more careful with database queries" | "Add a CI check that runs `EXPLAIN` on new queries against production-sized data" |
| "Improve monitoring" | "Alert when the checkout p95 latency is above 500 ms for 5 minutes" |
| "Engineers should test more" | "Load staging with anonymised, production-sized data every night" |

A good action item changes the **system**, so the next person, on their worst day, still cannot make the same mistake.

Finally, **share** postmortems widely, beyond the team. Other teams learn from your incidents for free, which is the **S** for Sharing in [CALMS](/courses/devops/devops-principles).

## Practising for bad days

Teams that respond well to incidents have usually **practised**:

- **Game days**: planned exercises where the team simulates a failure, such as "the primary database is gone", and works through the response.
- **Chaos engineering**: deliberately injecting failures into real systems, carefully and with limits, to prove the system survives them. Netflix's **Chaos Monkey** (2011), which randomly shut down production servers, made the idea famous.
- **Restore tests**: a backup you have never restored is a hope, not a backup. Restore it regularly, on a schedule.
- **Runbook reviews**: walk through each runbook; delete any that are out of date.

## From timeline to postmortem draft

The code panel for this lesson has a Node.js script that takes an incident's timeline, calculates the key durations, and writes a blameless postmortem **draft** in Markdown, ready for the team to fill in. The incident is a release that caused checkout errors until it was rolled back:

```bash
node postmortem.mjs
```

```text
Key durations:
  Time to detect         5 min
  Time to acknowledge    3 min
  Time to mitigate      25 min
  Time to resolve       44 min

Wrote postmortem-2026-10-23.md:

# Postmortem: Checkout errors after release v1.6.0

**Date:** 2026-10-23 | **Severity:** SEV-2 | **Incident commander:** Asha | **Status:** Draft

> Blameless: we look for what in our systems and processes allowed this, not for who to blame.
...
## Action items

| Action | Type | Owner | Due |
|---|---|---|---|
| Add the missing index through an expand-and-contract migration | Fix | _name_ | _date_ |
| Load staging with production-sized (anonymised) data | Prevent | _name_ | _date_ |
| Roll out checkout releases as a canary with automatic rollback | Mitigate faster | _name_ | _date_ |
```

Notice where the time went: detection took 5 minutes and acknowledging 3, but **mitigation took 25**. That points the action items at faster rollback, such as a [canary release](/courses/devops/deployment-strategies) that would have rolled back on its own within the first few minutes. The draft's contributing-factors section is written as questions for the team to answer, not conclusions.

## Common misunderstandings

### "The root cause was human error"

Human error is where the investigation **starts**, not where it ends. People make mistakes all the time; good systems make mistakes hard to make and cheap to recover from.

### "Our best engineer always fixes it, so we are fine"

Relying on a hero is a risk, not a strategy. Heroes burn out, go on holiday and leave. Runbooks, clear roles, automation and shared on-call spread the knowledge.

### "Postmortems are paperwork"

A postmortem nobody reads and whose action items are never done is paperwork. One that is shared, discussed and leads to real changes is the cheapest reliability improvement you will ever get: you already paid for the incident.

## Quick recap

- An **incident** is an unplanned event that hurts the service; aim to detect fast, mitigate fast, communicate and learn.
- Agree **severity levels** in advance; when unsure, go higher.
- Healthy **on-call** has few actionable pages, escalation, runbooks and fair rotations.
- Use clear **roles**: an **incident commander** who coordinates, experts who fix, someone who communicates, someone who records.
- **Mitigate first** (roll back, flip a flag), find the root cause later.
- Write **blameless postmortems** with a timeline, contributing factors and owned, specific **action items**, and share them.
- **Practise**: game days, chaos engineering and restore tests.

Next, you will build security into every stage of the pipeline in [DevSecOps: Security in the Pipeline](/courses/devops/devsecops-basics).

<code id="code-content" class="language-javascript">
// postmortem.mjs: turn an incident timeline into key durations and a blameless postmortem draft.
// Run it with: node postmortem.mjs     (writes postmortem-2026-10-23.md and prints it)
import { writeFileSync } from 'node:fs';
const incident = {
  title: 'Checkout errors after release v1.6.0',
  severity: 'SEV-2',
  date: '2026-10-23',
  commander: 'Asha',
  impact: 'About 13% of checkout requests failed for 25 minutes; roughly 340 orders could not be placed.',
};
// Times are UTC. "kind" marks the moments the key durations are measured from.
const timeline = [
  { at: '14:02', what: 'Pipeline starts deploying v1.6.0 to production' },
  { at: '14:06', what: 'Deployment finishes; checkout errors begin', kind: 'impactStart' },
  { at: '14:11', what: 'Alert fires: checkout error rate 13% (threshold 5%)', kind: 'detected' },
  { at: '14:14', what: 'On-call engineer acknowledges the page', kind: 'acknowledged' },
  { at: '14:17', what: 'SEV-2 declared, Asha takes incident commander, status page updated' },
  { at: '14:24', what: 'Logs show database timeouts from a new order-history query' },
  { at: '14:27', what: 'Decision: roll back to v1.5.3 instead of debugging live' },
  { at: '14:31', what: 'Rollback complete; error rate back to 0.4%', kind: 'mitigated' },
  { at: '14:50', what: 'Stable for 15+ minutes; incident resolved', kind: 'resolved' },
];
const minutes = (t) =&gt; { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const when = (kind) =&gt; minutes(timeline.find((e) =&gt; e.kind === kind).at);
const start = when('impactStart');
const durations = [
  ['Time to detect', when('detected') - start, 'impact began -&gt; alert fired'],
  ['Time to acknowledge', when('acknowledged') - when('detected'), 'alert -&gt; a human responded'],
  ['Time to mitigate', when('mitigated') - start, 'impact began -&gt; users no longer affected'],
  ['Time to resolve', when('resolved') - start, 'impact began -&gt; incident closed'],
];
const md = [
  `# Postmortem: ${incident.title}`,
  '',
  `**Date:** ${incident.date} | **Severity:** ${incident.severity} | **Incident commander:** ${incident.commander} | **Status:** Draft`,
  '',
  '&gt; Blameless: we look for what in our systems and processes allowed this, not for who to blame.',
  '',
  '## Summary',
  '',
  `${incident.impact} The release was rolled back and service recovered.`,
  '',
  '## Key durations',
  '',
  '| Measure | Minutes | From -&gt; to |',
  '|---|---|---|',
  ...durations.map(([name, mins, span]) =&gt; `| ${name} | ${mins} | ${span} |`),
  '',
  '## Timeline (UTC)',
  '',
  ...timeline.map((e) =&gt; `- **${e.at}** ${e.what}`),
  '',
  '## Root cause and contributing factors',
  '',
  '- _Why did the new query time out in production but not in staging? (data volume? missing index?)_',
  '- _Why did no test or check catch it before release?_',
  '- _Why did it take 5 minutes to detect, and could the canary have stopped it earlier?_',
  '',
  '## What went well / what went badly / where we got lucky',
  '',
  '- _Well:_ the alert fired within minutes; rollback took 4 minutes.',
  '- _Badly:_ _..._',
  '- _Lucky:_ _..._',
  '',
  '## Action items',
  '',
  '| Action | Type | Owner | Due |',
  '|---|---|---|---|',
  '| Add the missing index through an expand-and-contract migration | Fix | _name_ | _date_ |',
  '| Load staging with production-sized (anonymised) data | Prevent | _name_ | _date_ |',
  '| Roll out checkout releases as a canary with automatic rollback | Mitigate faster | _name_ | _date_ |',
].join('\n');
const file = `postmortem-${incident.date}.md`;
writeFileSync(file, md + '\n');
console.log('Key durations:');
durations.forEach(([name, mins]) =&gt; console.log(`  ${name.padEnd(20)} ${String(mins).padStart(3)} min`));
console.log(`\nWrote ${file}:\n`);
console.log(md);
</code></pre>
