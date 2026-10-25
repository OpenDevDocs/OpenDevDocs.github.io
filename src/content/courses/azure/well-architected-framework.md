---
publishDate: 2026-10-31T13:55
title: The Well-Architected Framework
slug: well-architected-framework
metadescription: 'Apply the Azure Well-Architected Framework''s five pillars as a set of trade offs rather than a checklist.'
updateDate: 2026-09-07T13:55
author: ['bishal-biswas']
level: 4
tags: ['architecture', 'best practices', 'design']
course: azure
---

## Five pillars

```text
Reliability             does it keep working when things fail
Security                is it protected, and can you prove it
Cost Optimisation       are you paying for what you need
Operational Excellence  can you run, observe and change it
Performance Efficiency  does it meet its performance goals at a sensible cost
```

The framework is useful because it makes the **trade offs** explicit. Every improvement to one pillar usually costs another, and the value is in choosing deliberately rather than by accident.

```text
Reliability up, cost up          multi region costs roughly twice
Security up, performance down    inspection adds latency
Cost down, reliability down      one instance is cheaper and has no SLA
Operations up, cost up           observability has a real ingestion bill
Performance up, cost up          usually, though not always
```

A design that maximises every pillar does not exist. A design that has chosen its position on each is a good design.

## Reliability

```text
Define RPO and RTO with the business, before designing anything
Eliminate single points of failure
Use availability zones, which is the cheapest meaningful improvement
Design for graceful degradation, not just for uptime
Test failure, because untested recovery does not work
Handle transient faults with retry, backoff and circuit breakers
```

The question that reveals most: **what happens when this dependency is unavailable?** For each dependency in turn.

An application that returns a 500 because a recommendation service is down has taken an optional dependency and made it mandatory. That is a design decision made by accident.

## Security

```text
Assume breach, and design so one compromise is contained
Identity is the perimeter, not the network
Least privilege, with temporary elevation where possible
Managed identities, so no credential exists to steal
Encryption in transit, explicitly configured, since defaults are permissive
Private endpoints where the data justifies it
Log enough to answer questions afterwards
```

The highest value items in practice: **MFA for administrators, blocking legacy authentication, no stored credentials, and management ports closed.** Those four prevent most of what actually happens.

Everything else is real and secondary.

## Cost Optimisation

```text
Right size from measured usage, not from specification
Shut down non production outside working hours
Autoscale, or schedule where traffic is predictable
Commit to a stable baseline with reservations or a savings plan
Use consumption pricing for spiky workloads
Set budgets and anomaly alerts
Attribute cost with enforced tags, and show teams their number
```

Cost optimisation is continuous, not a project. An estate optimised once drifts back within a year.

**Showing each team their own cost changes behaviour more than any policy.** Engineers who see the number make different decisions.

## Operational Excellence

```text
Infrastructure as code, deployed from a pipeline
The same template across environments, differing only by parameters
Automated deployment with a tested rollback
Observability designed in, not added after an incident
Alerts that always warrant action
Runbooks for the things that recur
Blameless review after incidents, with the fix tracked
```

The measure that matters: **how long from noticing a problem to understanding it?** If the answer is hours, that is an observability problem, not a people problem.

## Performance Efficiency

```text
Set targets, since "fast" is not a requirement
Measure percentiles, because averages hide what users complain about
Cache what is expensive and stable
Scale the right dimension: up for one heavy request, out for many
Choose the right data store for the access pattern
Move work off the request path, into a queue
Use a CDN or Front Door for anything global
```

Most performance problems are one of a small set: a missing index, an N+1 query, a synchronous call that should be asynchronous, or no caching. Look there first.

## Where the pillars conflict

**Reliability against cost.** Multi region active passive roughly doubles infrastructure cost for a standby that is idle. Whether that is right depends on what an hour of downtime costs, which is a business number rather than a technical one.

**Security against operations.** A locked down network with private endpoints everywhere is more secure and much harder to debug. Bastion, private DNS and a working diagnostic path are what make it tolerable.

**Performance against cost.** Provisioned throughput removes throttling and costs several times consumption pricing. Right at high steady volume, wrong for intermittent work.

**Cost against operations.** Aggressive log sampling reduces the bill and reduces what you can investigate. The sensible split is sample verbose traces, keep errors and audit complete.

Naming the trade off in a design document is worth more than pretending it does not exist.

## Using it

```text
Run a review at design time, not after building
Review again after significant change
Score each pillar honestly, including the ones you chose to deprioritise
Record the trade offs and why they were made
Revisit annually, because requirements change
```

Microsoft publishes an assessment covering all five pillars with service specific guidance. It takes an hour and produces a prioritised list.

**Record the deliberate decisions.** A design that scores poorly on cost because reliability was chosen is fine. A design that scores poorly because nobody thought about it is not, and six months later nobody can tell the two apart without a note.

## A short review

```text
Reliability
  What is the RPO and RTO, and has recovery been tested this quarter?
  What happens when each dependency fails?
  Is anything a single instance?

Security
  Are there stored credentials anywhere?
  Is MFA enforced for administrators?
  Would you know if data were exfiltrated?

Cost
  What are the top five resources by cost, and are they right sized?
  Does non production run at weekends?
  Is spend attributable to teams?

Operations
  Can the whole environment be rebuilt from the repository?
  How long from problem to understanding?
  Does every alert warrant action?

Performance
  What are the targets, and are they measured?
  What is the p95, not the average?
  Where does time actually go, per request?
```

Answering those honestly takes an hour and finds more than most formal reviews.

## Quick recap

- The framework's value is making trade offs explicit, since no design maximises every pillar.
- Ask what happens when each dependency fails, one at a time.
- MFA for administrators, no legacy authentication, no stored credentials and closed management ports prevent most incidents.
- Cost optimisation is continuous, and showing teams their number changes behaviour.
- Time from noticing a problem to understanding it is the operational measure that matters.
- Most performance problems are a missing index, an N+1 query, a synchronous call or no caching.
- Record deliberate trade offs, or nobody can distinguish a choice from an oversight later.

<code id="code-content" class="language-bash">
# FIVE PILLARS, AND THE VALUE IS MAKING THE TRADE OFFS EXPLICIT:
#   RELIABILITY  does it keep working when things fail
#   SECURITY     is it protected, and can you prove it
#   COST         are you paying for what you need
#   OPERATIONS   can you run, observe and change it
#   PERFORMANCE  does it meet its goals at a sensible cost
# EVERY IMPROVEMENT TO ONE USUALLY COSTS ANOTHER:
#   reliability up, cost up        multi region costs roughly twice
#   security up, performance down  inspection adds latency
#   cost down, reliability down    one instance is cheaper and has no SLA
#   operations up, cost up         observability has a real ingestion bill
# A design maximising every pillar DOES NOT EXIST. A design that has CHOSEN
# its position on each is a good design.
# RELIABILITY. The question that reveals most, asked of EACH dependency in
# turn: WHAT HAPPENS WHEN THIS IS UNAVAILABLE? An app returning 500 because
# recommendations are down has made an OPTIONAL dependency MANDATORY, and
# that is a design decision made by accident.
# SECURITY. Four things prevent most of what actually happens:
#   MFA for administrators | block legacy authentication
#   no stored credentials  | management ports closed
# Everything else is real and secondary.
# COST is CONTINUOUS, not a project: an estate optimised once drifts back
# within a year. SHOWING EACH TEAM THEIR OWN NUMBER CHANGES BEHAVIOUR MORE
# THAN ANY POLICY.
# OPERATIONS. The measure that matters: HOW LONG FROM NOTICING A PROBLEM TO
# UNDERSTANDING IT? If the answer is hours, that is an OBSERVABILITY
# problem, not a people problem.
# PERFORMANCE. Most problems are one of a small set: a missing index, an
# N+1 query, a synchronous call that should be asynchronous, or no caching.
# Look there first. And measure PERCENTILES: averages hide what users
# actually complain about.
# WHERE THEY CONFLICT, name it in the design document:
#   multi region doubles cost for an idle standby. Whether that is right
#   depends on WHAT AN HOUR OF DOWNTIME COSTS, a business number.
#   private endpoints everywhere are more secure AND MUCH HARDER TO DEBUG.
#   aggressive log sampling cuts the bill and cuts what you can investigate.
#   The sensible split: sample verbose traces, keep errors and audit whole.
# RECORD THE DELIBERATE DECISIONS. A design scoring poorly on cost BECAUSE
# reliability was chosen is fine. One scoring poorly because nobody thought
# about it is not, AND SIX MONTHS LATER NOBODY CAN TELL THEM APART.
# A ONE HOUR REVIEW THAT FINDS MORE THAN MOST FORMAL ONES:
#   RPO and RTO, and has recovery been tested THIS QUARTER?
#   what happens when each dependency fails? is anything a single instance?
#   stored credentials anywhere? MFA for admins? would you notice exfiltration?
#   top five resources by cost, right sized? does non production run at weekends?
#   can the whole environment be rebuilt from the repository?
#   does EVERY alert warrant action?
#   what are the performance targets, and what is the p95?
</code></pre>
