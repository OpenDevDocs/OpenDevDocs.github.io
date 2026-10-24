---
publishDate: 2026-10-31T14:00
title: Multi-region and Disaster Recovery
slug: multi-region-and-disaster-recovery
metadescription: Design a multi region architecture on Azure, choose active passive or active active honestly, and handle the data problem.
updateDate: 2026-09-07T14:00
author: ['bishal-biswas']
level: 4
tags: ['architecture', 'disaster recovery', 'multi region']
course: azure
---

## Decide whether you need it

Multi region roughly doubles infrastructure cost, adds substantial complexity, and introduces failure modes that do not exist in one region.

```text
Reasons that justify it
  a regulatory requirement
  an availability target above 99.95 percent
  users on several continents needing low latency
  an hour of downtime costing more than the second region

Reasons that do not
  it sounds more professional
  a competitor mentions it
  nobody costed the alternative
```

**Availability zones first.** Zone redundancy in one region survives a datacentre failure, costs a modest premium, and needs no application change. Full region loss is rare, and most organisations should reach the limits of zone redundancy before considering a second region.

## Three patterns

```text
Backup and restore
  RPO hours, RTO hours to days. Backups in another region, rebuild there.
  Cheapest. Recovery is a project, not a switch.

Active passive
  RPO minutes, RTO minutes to an hour. A warm standby, kept current.
  Doubles infrastructure, and the standby is idle.

Active active
  RPO near zero, RTO near zero. Both regions serving traffic.
  Most expensive, most complex, and the only one with no failover step.
```

Cost roughly doubles at each level, and complexity more than doubles.

A pilot light variation sits between backup and active passive: databases replicating continuously, application infrastructure defined in code but not running. Cheaper than a warm standby, with a recovery measured in tens of minutes rather than days.

## Traffic routing

```bash
az afd origin create \
  --profile-name afd-shop --resource-group rg-shop-global \
  --origin-group-name og-shop --origin-name uks \
  --host-name shop-uks.azurewebsites.net --priority 1 --weight 1000 --https-port 443

az afd origin create \
  --profile-name afd-shop --resource-group rg-shop-global \
  --origin-group-name og-shop --origin-name ne \
  --host-name shop-ne.azurewebsites.net --priority 2 --weight 1000 --https-port 443
```

```text
Different priority  active passive. Priority 2 takes over when 1 fails its probe.
Same priority       active active, routed by latency.
```

Front Door fails over in seconds because it is in the traffic path. Traffic Manager only answers DNS, so failover waits for client caches to expire, which can be far longer than the TTL suggests.

Use Front Door for HTTP. Traffic Manager still fits non HTTP protocols.

**The health probe decides everything.** Point it at an endpoint that checks real dependencies, or a region with a dead database will keep receiving traffic because its web server still returns 200.

## Data is the hard part

Stateless application tiers are straightforward. Data is where multi region designs succeed or fail.

```bash
az sql failover-group create \
  --name fg-shop --server sql-shop-uks --resource-group rg-shop-prod-uks \
  --partner-server sql-shop-ne --failover-policy Automatic --grace-period 1 --add-db shop
```

```text
Azure SQL failover group   asynchronous replication, one writable primary,
                           a readable secondary, a listener that follows the primary
Cosmos DB multi region     synchronous or asynchronous, optional multi region writes
Storage GZRS               asynchronous to the paired region, read access optional
Redis geo replication      Premium, one writable primary
PostgreSQL read replicas   asynchronous, and promotion is manual
```

**Asynchronous replication means an unplanned failover loses recent writes.** That is not a flaw; it is the trade for not paying the latency of synchronous cross region commits.

Know the number. `lastSyncTime` on storage and the replication lag metric on SQL tell you what the secondary actually has.

## Multi region writes

Cosmos DB is the service that makes this straightforward.

```bash
az cosmosdb update --name cosmos-shop --resource-group rg-shop-prod-uks \
  --locations regionName=uksouth failoverPriority=0 isZoneRedundant=true \
  --locations regionName=northeurope failoverPriority=1 isZoneRedundant=true \
  --enable-multiple-write-locations true
```

Writes go to the nearest region, and conflicts are resolved last write wins by default or by a stored procedure you provide.

The cost is conflicts. Two regions updating the same document produce one that has to lose, and if that document is a stock count, someone gets a surprise.

Design so conflicts are rare: partition by region where possible, or make writes commutative.

For relational databases, active active writes are genuinely hard, and most designs keep one writable primary.

## The failover procedure

```text
1. Detect. Automatically, not by a customer telephoning.
2. Decide. Automatic where the criteria are unambiguous, human otherwise.
3. Fail over the data tier.
4. Route traffic.
5. Verify.
6. Communicate.
7. Plan the failback, which is often harder than the failover.
```

**Failback is the step nobody rehearses.** The failed region returns, and it is now behind. Bringing it back means resynchronising data written while it was down, and doing that safely under time pressure is unpleasant.

Write the failback procedure at the same time as the failover procedure.

## Avoid a manual step

An RTO of minutes cannot include waking someone up.

```bash
az sql failover-group update --name fg-shop --resource-group rg-shop-prod-uks \
  --server sql-shop-uks --failover-policy Automatic --grace-period 1
```

```text
Automatic where     the criteria are clear and a false positive is survivable
Manual where        failover loses data, or the decision needs judgement
```

The grace period is the trade: shorter means faster recovery and more risk of failing over during a brief blip, and longer means the opposite.

## Everything must exist in both

The failure that happens on a real failover: something exists only in the primary region.

```text
Key Vault              a vault per region, or one with a private endpoint in both
Container registry     geo replicated, or the secondary cannot pull images
Configuration          replicated, or the secondary starts with the wrong settings
Certificates           present in both
Managed identities     role assignments in both
Log Analytics          the secondary must be able to write logs
DNS                    private zones linked to both networks
```

```bash
az acr replication create --registry acrshop --location northeurope
az appconfig replica create --name appcs-shop --location northeurope --replica-name ne
```

Deploying both regions from the same template is what prevents this. A secondary built by hand a year ago has drifted, and the drift is discovered during the incident.

## Test it

```bash
az sql failover-group set-primary --name fg-shop \
  --resource-group rg-shop-prod-uks --server sql-shop-ne

az afd origin update --profile-name afd-shop --resource-group rg-shop-global \
  --origin-group-name og-shop --origin-name uks --enabled-state Disabled
```

```text
Quarterly, at minimum
During business hours, so people are available
With a rollback ready
Measuring actual RTO against the target
Recording what was missing
```

**An untested failover does not work.** That is the consistent experience: a missing certificate, a firewall rule, a configuration value, a licence, a dependency still pointing at the failed region.

Some organisations run continuous failover, alternating the active region monthly, which guarantees both work because both are always used.

## Quick recap

- Reach the limits of zone redundancy before considering a second region.
- Cost roughly doubles at each level of protection, and complexity more than doubles.
- Front Door fails over in seconds; Traffic Manager waits for DNS caches.
- The health probe must check real dependencies, or traffic goes to a dead region.
- Asynchronous replication means an unplanned failover loses recent writes, so know the number.
- Failback is harder than failover and is the step nobody rehearses.
- Deploy both regions from one template, since a hand built secondary has drifted.

<code id="code-content" class="language-bash">
# DECIDE WHETHER YOU NEED IT. Multi region roughly DOUBLES cost, adds
# substantial complexity, and introduces failure modes that do not exist in
# one region.
# AVAILABILITY ZONES FIRST: zone redundancy survives a DATACENTRE failure,
# costs a modest premium, and needs no application change. Most
# organisations should reach its limits before considering a second region.
# THREE PATTERNS, cost roughly doubling at each level:
#   backup and restore  RPO hours, RTO hours to days. Recovery is a PROJECT.
#   pilot light         data replicating, infrastructure in code but not
#                       running. Tens of minutes.
#   active passive      RPO minutes, RTO minutes. A warm, IDLE standby.
#   active active       RPO/RTO near zero. No failover step, and the most
#                       expensive and complex.
# PRIORITY DECIDES THE BEHAVIOUR. Front Door fails over IN SECONDS because
# it is in the traffic path; Traffic Manager only answers DNS, so failover
# waits for client caches.
az afd origin create --profile-name afd-shop --resource-group rg-shop-global \
  --origin-group-name og-shop --origin-name ne \
  --host-name shop-ne.azurewebsites.net --priority 2 --weight 1000
# THE HEALTH PROBE DECIDES EVERYTHING. Point it at REAL DEPENDENCIES, or a
# region with a dead database keeps receiving traffic because its web
# server still returns 200.
# DATA IS THE HARD PART. ASYNCHRONOUS REPLICATION MEANS AN UNPLANNED
# FAILOVER LOSES RECENT WRITES. That is the trade for not paying the
# latency of synchronous cross region commits. KNOW THE NUMBER:
# lastSyncTime on storage, replication lag on SQL.
az sql failover-group create --name fg-shop --server sql-shop-uks \
  --resource-group rg-shop-prod-uks --partner-server sql-shop-ne \
  --failover-policy Automatic --grace-period 1 --add-db shop
# The grace period is the trade: shorter recovers faster and risks failing
# over during a blip; longer is the opposite.
# MULTI REGION WRITES are straightforward only in Cosmos DB, and THE COST IS
# CONFLICTS: two regions updating one document means one has to lose, and if
# that document is a stock count, someone gets a surprise. Design so
# conflicts are rare. For relational databases, keep ONE writable primary.
az cosmosdb update --name cosmos-shop --resource-group rg-shop-prod-uks \
  --enable-multiple-write-locations true
# AN RTO OF MINUTES CANNOT INCLUDE WAKING SOMEONE UP. Automate where the
# criteria are unambiguous; keep it manual where failover LOSES DATA.
# EVERYTHING MUST EXIST IN BOTH REGIONS, and this is what fails on a real
# failover: Key Vault, the container REGISTRY (or the secondary cannot pull
# images), configuration, certificates, role assignments, DNS zone links.
az acr replication create --registry acrshop --location northeurope
az appconfig replica create --name appcs-shop --location northeurope --replica-name ne
# DEPLOY BOTH REGIONS FROM ONE TEMPLATE. A secondary built by hand a year
# ago HAS DRIFTED, and the drift is discovered during the incident.
# FAILBACK IS THE STEP NOBODY REHEARSES, and it is often harder: the failed
# region returns BEHIND, and resynchronising under time pressure is
# unpleasant. Write the failback procedure WITH the failover procedure.
# TEST QUARTERLY, IN BUSINESS HOURS, WITH A ROLLBACK READY, MEASURING
# ACTUAL RTO. An untested failover does not work: a missing certificate, a
# firewall rule, a licence, a dependency still pointing at the failed region.
az sql failover-group set-primary --name fg-shop \
  --resource-group rg-shop-prod-uks --server sql-shop-ne
# Some organisations ALTERNATE THE ACTIVE REGION MONTHLY, which guarantees
# both work because both are always used.
</code></pre>
