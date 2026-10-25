---
publishDate: 2026-10-15T09:55
title: Choosing an Azure Data Store
slug: choosing-a-data-store
metadescription: Pick the right Azure data store by matching the access pattern, consistency needs and budget rather than by familiarity.
updateDate: 2026-09-07T09:55
author: ['bishal-biswas']
level: 2
tags: ['databases', 'architecture', 'decisions']
course: azure
---

## Start with the access pattern

Not "SQL or NoSQL" but "how is this data written, and how is it read".

```text
Read by primary key, mostly            key value store
Complex joins across entities          relational
Full text search and ranking           a search engine
Time ordered append only               time series or event store
Graph traversal                        graph database
Aggregations over huge volumes         analytical store
```

Most applications need more than one, and that is normal. A relational database for orders, Redis for sessions, blobs for documents and a search index for the catalogue is an ordinary shape.

## The options

```text
Azure SQL Database    relational, transactions, joins, mature tooling
PostgreSQL / MySQL    relational, open source, extensions, portability
Cosmos DB             global, guaranteed latency, key based access, expensive
Table Storage         cheap key value, one region, no indexes
Blob Storage          objects and files. Not a database.
Data Lake Gen2        analytics files, queried in place
Azure Cache for Redis in memory, sub millisecond, not durable
Azure AI Search       full text, vector and hybrid search
Fabric / Synapse      analytics over large volumes
```

## Relational is still the default

For most applications, start with a relational database.

```text
Transactions across entities
Joins without duplicating data
A schema the database enforces
Ad hoc queries nobody planned for
Forty years of tooling and expertise
```

The reasons to move away are specific: a scale a single database genuinely cannot serve, a shape relational modelling handles badly, or a latency guarantee across regions.

"We might need scale later" is not one of them. A well indexed Azure SQL database handles far more than most applications will ever see, and a relational schema is easier to change than a distributed one.

## Azure SQL or PostgreSQL

```text
Azure SQL       .NET estates, existing SQL Server skills, Hyperscale, Hybrid Benefit
PostgreSQL      open source, extensions like pgvector and PostGIS, portability
MySQL           existing MySQL applications, common PHP and WordPress stacks
```

Both are excellent. The decision is usually about existing skills and licensing rather than capability.

PostgreSQL has an edge for anything using extensions: vector search with `pgvector`, geospatial with PostGIS, or time series with TimescaleDB.

## When Cosmos DB is right

```text
Right when
  multi region writes with low latency everywhere
  a guaranteed single digit millisecond read
  access is genuinely key based
  the schema varies per document
  scale is beyond a single relational instance

Wrong when
  you need joins or transactions across partitions
  the access pattern is unclear, since the partition key is permanent
  budget is tight, because it is expensive at low utilisation
  the team has no NoSQL modelling experience
```

The failure mode is a team choosing Cosmos DB for a relational workload, then writing joins in application code and wondering why it is slow and expensive.

## When Table Storage is right

```text
Key based access, one region, no secondary indexes needed, budget matters
```

It is very cheap and genuinely fast within its access pattern. For configuration, audit records or simple lookups it beats everything else on cost.

Move to Cosmos DB when you need indexing, global distribution or richer queries. The Table API makes that migration relatively painless.

## Where files belong

```text
Blob Storage    documents, images, exports, backups
Data Lake Gen2  the same, plus directory semantics and analytics access
Azure Files     when an application needs a file path
```

**Do not store files in a database.** A relational database holding image blobs is expensive per gigabyte, slow to back up and awkward to serve.

Store the file in Blob Storage and the metadata and path in the database. That is the pattern, and it is almost always right.

## Polyglot persistence, carefully

Using several stores is normal. Using seven for a small application is not.

```text
Each store adds
  a client library and its failure modes
  a backup and restore procedure
  a security model and access control
  monitoring and alerting
  someone who understands it
```

Add a store when the access pattern genuinely does not fit what you have. Not because it is interesting.

A realistic split for a typical application:

```text
Azure SQL        orders, customers, inventory. The source of truth.
Redis            sessions, hot lookups, rate limiting
Blob Storage     invoices, images, exports
AI Search        the product catalogue
```

Four stores, each with a clear job, and nothing duplicated without reason.

## Consistency

```text
Strong within one database        a relational transaction
Eventual across stores            anything involving two systems
```

The moment data lives in two places, they can disagree. A search index built from the database is stale for as long as indexing takes.

Decide explicitly how stale is acceptable, and design the refresh path deliberately. The change feed, an outbox table or a message queue are the usual mechanisms.

Distributed transactions across cloud services do not exist in any practical form. Compensating actions and idempotency are how this is handled.

## A decision path

```text
Is it a file or blob?
  -> Blob Storage, with metadata in a database

Does it need transactions across entities, or joins?
  -> Azure SQL, or PostgreSQL

Is access purely by key, cheap, one region?
  -> Table Storage

Does it need global writes or guaranteed low latency worldwide?
  -> Cosmos DB

Is it a cache or session state?
  -> Redis

Is it full text or vector search?
  -> Azure AI Search

Is it analytics over large volumes?
  -> Data Lake with Fabric or Synapse
```

## Cost at low scale

Worth knowing, because early cost shapes decisions.

```text
Table Storage         pennies
Azure SQL serverless  pennies when paused
PostgreSQL burstable  a few pounds a month
Cosmos DB serverless  cheap at low use
Cosmos DB provisioned expensive even when idle
Redis Basic           cheap, and no SLA
```

Cosmos DB with provisioned throughput has a meaningful floor cost, which surprises small projects. Serverless removes that, at the cost of lower limits.

## The honest advice

Most applications should start with a relational database and add stores as specific needs appear.

Starting with a distributed NoSQL database "for scale" usually means solving a problem you do not have, while giving up joins, transactions and ad hoc queries that you do need.

Change is easier in the direction of more specialised stores than back toward general ones.

## Quick recap

- Choose by access pattern, not by the SQL against NoSQL framing.
- Relational is the right default, and "we might need scale" is not a reason to leave it.
- Cosmos DB fits key based access, global writes and guaranteed latency, and punishes relational workloads.
- Table Storage is very cheap within its access pattern, and the Table API eases migration to Cosmos DB.
- Never store files in a database, and keep metadata alongside the path instead.
- Every additional store adds backups, security, monitoring and expertise, so add them deliberately.
- Anything spanning two stores is eventually consistent, so design the refresh path explicitly.

<code id="code-content" class="language-bash">
# START WITH THE ACCESS PATTERN, not "SQL or NoSQL".
#   read by primary key       key value store
#   joins across entities     relational
#   full text and ranking     search engine
#   time ordered append only  time series or event store
#   aggregations over huge volumes  analytical store
# MOST APPLICATIONS NEED MORE THAN ONE, AND THAT IS NORMAL.
# RELATIONAL IS STILL THE DEFAULT: transactions, joins without duplication,
# an enforced schema, AD HOC QUERIES NOBODY PLANNED FOR, and forty years of
# tooling. "We might need scale later" IS NOT A REASON TO LEAVE IT. A well
# indexed Azure SQL database handles far more than most applications see,
# and a relational schema is EASIER to change than a distributed one.
# AZURE SQL vs POSTGRESQL is usually about SKILLS AND LICENSING, not
# capability. PostgreSQL has an edge for extensions: pgvector, PostGIS,
# TimescaleDB.
# COSMOS DB IS RIGHT WHEN: multi region writes, a guaranteed single digit
# millisecond read, GENUINELY key based access, varying schema, scale
# beyond one relational instance.
# WRONG WHEN: you need joins or cross partition transactions; the access
# pattern is unclear (THE PARTITION KEY IS PERMANENT); budget is tight; or
# nobody has NoSQL modelling experience. The failure mode is choosing it for
# a relational workload, then writing joins in application code.
# TABLE STORAGE is very cheap and genuinely fast WITHIN its access pattern.
# The Table API makes moving to Cosmos DB later relatively painless.
# DO NOT STORE FILES IN A DATABASE. Expensive per GB, slow to back up,
# awkward to serve. Store the FILE in Blob Storage and the PATH and
# METADATA in the database.
# EACH ADDITIONAL STORE ADDS: a client library and its failure modes, a
# backup and restore procedure, a security model, monitoring, and someone
# who understands it. A realistic split for a typical application:
#   Azure SQL   orders, customers, inventory. The source of truth.
#   Redis       sessions, hot lookups, rate limiting
#   Blob        invoices, images, exports
#   AI Search   the product catalogue
# CONSISTENCY: the moment data lives in TWO places they can disagree.
# Distributed transactions across cloud services do not practically exist.
# Decide how stale is acceptable, then pick the refresh path deliberately:
# a change feed, an outbox table, or a message queue. Compensating actions
# and idempotency are how the rest is handled.
# COST AT LOW SCALE, which shapes early decisions:
#   Table Storage / SQL serverless paused / PostgreSQL burstable   pennies
#   Cosmos DB serverless   cheap at low use
#   Cosmos DB provisioned  EXPENSIVE EVEN WHEN IDLE
# THE HONEST ADVICE: start relational, add specialised stores as specific
# needs appear. Change is easier toward specialised stores than back.
</code></pre>
