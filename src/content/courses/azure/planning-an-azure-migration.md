---
publishDate: 2026-10-30T13:50
title: Planning an Azure Migration
slug: planning-an-azure-migration
metadescription: Plan a migration to Azure using discovery, the migration strategies, and a landing zone that is ready before anything moves.
updateDate: 2026-09-07T13:50
author: ['bishal-biswas']
level: 4
tags: ['migration', 'planning', 'strategy']
course: azure
---

## Discovery first

You cannot plan what you have not measured. Assumptions about an existing estate are consistently wrong, usually in the direction of "there is more of it than anyone thought".

```bash
az migrate project create \
  --name migrate-contoso --resource-group rg-migrate --location uksouth
```

Azure Migrate discovers servers, databases and applications, collects performance data, and maps dependencies.

```text
Appliance discovery  agentless discovery of VMware, Hyper-V and physical servers
Performance data     CPU, memory, disk and network over time, for right sizing
Dependency analysis  what talks to what, which is the part people underestimate
Cost estimates       based on measured usage rather than current specification
```

**Run discovery for at least a month.** A week of data misses month end processing, and month end is exactly when a database needs the capacity you did not provision.

Dependency analysis is the most valuable output. A server nobody can explain, communicating with something nobody knew existed, is a normal finding and it is far better found now.

## The migration strategies

```text
Rehost      lift and shift, unchanged. Fastest, no benefit beyond the datacentre exit.
Replatform  small changes for a managed service. SQL Server to Azure SQL.
Refactor    change the architecture. Monolith to services, VMs to containers.
Rearchitect a substantial redesign for cloud characteristics.
Rebuild     start again.
Replace     buy a SaaS product instead.
Retain      leave it where it is, for now.
Retire      turn it off, because nobody uses it.
```

**Retire is the highest value option and the most overlooked.** Every migration discovers servers nobody uses. Turning them off costs nothing and reduces everything downstream.

The pragmatic distribution for a typical estate:

```text
Retire      10 to 20 percent, once discovery shows what is unused
Rehost      50 to 60 percent, to meet a deadline
Replatform  20 to 30 percent, for databases and web applications
Refactor    a small number, where the return is clear
```

Rehosting everything is often criticised and is frequently correct when there is a datacentre lease ending. Move first, modernise afterwards, with a genuine plan to do so.

## Replatform where it is cheap

Some replatforms are barely more work than a rehost and remove ongoing effort permanently.

```text
SQL Server on a VM        -> Azure SQL Managed Instance. High compatibility.
IIS web application       -> App Service. Often just a publish.
Windows scheduled tasks   -> Azure Functions timer triggers
File server               -> Azure Files with File Sync
Active Directory          -> stays, plus Entra Connect for sync
SQL Server Reporting      -> Power BI, which is a bigger change
```

The Data Migration Assistant reports compatibility issues before you commit, which turns "will this work on Managed Instance" into a list rather than a hope.

## Build the landing zone first

Migrating into an unprepared subscription creates a mess that has to be unpicked later.

```text
Before anything moves
  management group hierarchy
  subscriptions per environment
  hub network, with connectivity to on premises
  Entra ID, and Entra Connect if hybrid
  Log Analytics workspace and diagnostic settings by policy
  naming and tagging conventions, enforced
  RBAC groups
  a security baseline
  budgets and cost alerts
```

This is the step that gets compressed when a deadline is close, and it is the step that causes eighteen months of remediation afterwards.

Two weeks building a landing zone saves considerably more than two weeks later.

## Waves

```text
Wave 1  low risk, low dependency. Development and test. Prove the process.
Wave 2  moderate: internal applications with contained dependencies.
Wave 3  business applications, with a planned window.
Wave 4  the critical and difficult ones, with everything learned so far.
```

Group by **dependency cluster**, not by team or by application. Servers that talk to each other move together, or you create a chatty link across a VPN and everything is slow.

The dependency map from discovery is what defines the waves. That is why it matters.

## Networking is the constraint

```text
Bandwidth        how long does the initial copy take, realistically
Latency          what breaks when the database is 20ms away
Address space    does the on premises range overlap the Azure plan
DNS              can both sides resolve each other
Firewall rules   what needs opening, and who approves it
```

**Latency during a partial migration is the classic problem.** An application in Azure with its database still on premises adds latency to every query, and a chatty application becomes unusable.

Move an application and its database together, or accept the interim performance deliberately.

For large initial transfers, Azure Data Box ships physical devices, which is faster than a network link for tens of terabytes.

## Tools

```bash
az migrate project create --name migrate-contoso --resource-group rg-migrate --location uksouth
```

```text
Azure Migrate            discovery, assessment, and server migration
Database Migration Service  minimal downtime database migration
Data Migration Assistant compatibility assessment before committing
Azure Site Recovery      replication, also usable for migration
AzCopy and Data Box      bulk data transfer
```

The pattern for a server is replication first, then a short cutover: data is copied while the source runs, and only the final delta requires downtime.

## Test the cutover

```text
1. Replicate
2. Run a TEST failover into an isolated network
3. Verify the application actually works there
4. Measure how long the cutover took
5. Fix what was missing
6. Repeat until it is boring
7. Then do it for real
```

**A cutover that has not been rehearsed will overrun.** Something is always missing: a firewall rule, a certificate, a licence tied to hardware, a hard coded server name, a scheduled task nobody documented.

Test failover into an isolated network costs a few hours and removes most of that risk.

## Plan the rollback

```text
Keep the source running until the target is proven
Know how to switch back, and how long it takes
Set a decision point during the cutover window
Understand which changes cannot be reversed
```

Data written to the new system after cutover is the difficulty. Rolling back after two days of transactions is not a rollback; it is a second migration.

Define the point of no return explicitly, before the window rather than during it.

## After the move

```text
Right size, using two weeks of actual Azure metrics
Buy reservations, once usage is stable
Remove the temporary things built for the migration
Update runbooks, because they all reference the old environment
Decommission the source, deliberately and on a date
Then modernise, if that was the plan
```

**Decommission on a date.** Source environments kept "just in case" run for years, and the cost of a migration that never removes the old estate is both of them.

Right sizing after migration is where most of the financial benefit is. Machines are usually sized to match on premises specification, which was itself sized for a peak years ago.

## Where migrations go wrong

**No discovery.** Surprises during cutover, every time.

**No landing zone.** Everything in one subscription with no tags, unpicked for the next year.

**Ignoring dependencies.** Half an application in each place, with latency nobody predicted.

**Rehost everything and never modernise.** The same estate, in a more expensive place.

**No rollback plan.** A problem at 2am with no way back.

**Never decommissioning.** Paying for both indefinitely.

## Quick recap

- Run discovery for at least a month, since a week misses month end.
- Dependency analysis is the most valuable output and defines the waves.
- Retire is the highest value strategy and the most overlooked.
- Build the landing zone before anything moves, or spend eighteen months unpicking it.
- Move an application and its database together, or accept the latency deliberately.
- Rehearse the cutover until it is boring, because an unrehearsed one overruns.
- Right size after migration, and decommission the source on a fixed date.

<code id="code-content" class="language-bash">
# DISCOVERY FIRST. Assumptions about an existing estate are consistently
# wrong, usually toward "there is more of it than anyone thought".
az migrate project create --name migrate-contoso --resource-group rg-migrate \
  --location uksouth
# RUN DISCOVERY FOR AT LEAST A MONTH. A week misses MONTH END processing,
# and month end is exactly when a database needs capacity you did not
# provision.
# DEPENDENCY ANALYSIS IS THE MOST VALUABLE OUTPUT. A server nobody can
# explain, talking to something nobody knew existed, is a NORMAL finding.
# THE STRATEGIES:
#   RETIRE      turn it off. THE HIGHEST VALUE OPTION AND THE MOST
#               OVERLOOKED. Every migration finds unused servers.
#   REHOST      lift and shift. Fast, and correct when a lease is ending.
#   REPLATFORM  small change for a managed service. Often barely more work.
#   REFACTOR    change the architecture, where the return is clear.
# A typical distribution: retire 10-20%, rehost 50-60%, replatform 20-30%,
# refactor a few. Move first and modernise after, with a REAL plan to do so.
# CHEAP REPLATFORMS that remove ongoing effort permanently:
#   SQL Server on a VM  -&gt; Azure SQL Managed Instance (high compatibility)
#   IIS application     -&gt; App Service, often just a publish
#   scheduled tasks     -&gt; Functions timer triggers
#   file server         -&gt; Azure Files with File Sync
# The Data Migration Assistant turns "will this work" into A LIST.
# BUILD THE LANDING ZONE BEFORE ANYTHING MOVES: management groups,
# subscriptions, hub network, identity, Log Analytics and diagnostics by
# policy, naming and tagging, RBAC groups, security baseline, budgets.
# THIS IS THE STEP COMPRESSED WHEN A DEADLINE IS CLOSE, AND THE STEP THAT
# CAUSES EIGHTEEN MONTHS OF REMEDIATION.
# GROUP WAVES BY DEPENDENCY CLUSTER, not by team or application. Servers
# that talk to each other MOVE TOGETHER, or you create a chatty link across
# a VPN and everything is slow. That is why the dependency map matters.
# LATENCY DURING A PARTIAL MIGRATION IS THE CLASSIC PROBLEM: an application
# in Azure with its database still on premises adds latency to EVERY query.
# Move them together, or accept it deliberately.
# For tens of terabytes, Data Box ships physical devices faster than a link.
# REHEARSE THE CUTOVER UNTIL IT IS BORING. An unrehearsed one WILL OVERRUN:
# a firewall rule, a certificate, a licence tied to hardware, a hard coded
# server name, a scheduled task nobody documented.
#   replicate -&gt; TEST failover into an ISOLATED network -&gt; verify -&gt; MEASURE
#   -&gt; fix what was missing -&gt; repeat -&gt; then do it for real
# PLAN THE ROLLBACK, AND DEFINE THE POINT OF NO RETURN BEFORE THE WINDOW.
# Rolling back after two days of transactions is not a rollback, it is a
# second migration.
# AFTER THE MOVE: RIGHT SIZE using two weeks of ACTUAL Azure metrics, which
# is where most of the financial benefit is. Machines are usually sized to
# match on premises specification, itself sized for a peak years ago.
# THEN DECOMMISSION ON A DATE. Source environments kept "just in case" run
# for years, and a migration that never removes the old estate costs BOTH.
</code></pre>
