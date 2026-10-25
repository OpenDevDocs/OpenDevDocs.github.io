---
publishDate: 2026-10-14T09:35
title: Azure Database for PostgreSQL and MySQL
slug: postgresql-and-mysql
metadescription: Run PostgreSQL and MySQL on Azure with the flexible server model, and configure networking, high availability and extensions correctly.
updateDate: 2026-09-07T09:35
author: ['bishal-biswas']
level: 2
tags: ['databases', 'postgresql', 'mysql']
course: azure
---

## Flexible Server is the model

```text
Single Server   RETIRED. PostgreSQL ended March 2025, MySQL September 2024.
Flexible Server the current model, and the only one to use.
```

Anything still on Single Server needs migrating. Flexible Server gives zone selection, stop and start, better maintenance control and proper virtual network integration.

```bash
az postgres flexible-server create \
  --name pg-shop-prod --resource-group rg-shop-prod-uks \
  --location uksouth \
  --tier GeneralPurpose --sku-name Standard_D4ds_v5 \
  --version 17 \
  --storage-size 256 --storage-auto-grow Enabled \
  --high-availability ZoneRedundant \
  --zone 1 --standby-zone 2 \
  --vnet vnet-shop-prod-uks --subnet snet-postgres \
  --private-dns-zone pg-shop.private.postgres.database.azure.com \
  --active-directory-auth Enabled --password-auth Disabled \
  --admin-user pgadmin
```

```bash
az mysql flexible-server create \
  --name mysql-shop-prod --resource-group rg-shop-prod-uks \
  --location uksouth --tier GeneralPurpose --sku-name Standard_D4ds_v5 \
  --version 8.0 --storage-size 256 --storage-auto-grow Enabled \
  --high-availability ZoneRedundant
```

## Networking is decided at creation

This is the constraint that catches people.

```text
Public access     firewall rules by IP. Can add a private endpoint later.
Private access    injected into a subnet. CANNOT be changed afterwards.
```

Choosing virtual network integration means it is permanent for that server. Moving to public access means creating a new server and migrating.

Decide deliberately, and prefer private access for production.

```bash
az postgres flexible-server firewall-rule create \
  --name pg-shop-prod --resource-group rg-shop-prod-uks \
  --rule-name office --start-ip-address 203.0.113.10 --end-ip-address 203.0.113.10
```

The delegated subnet needs `Microsoft.DBforPostgreSQL/flexibleServers` and holds nothing else.

## Entra ID authentication

```bash
az postgres flexible-server ad-admin create \
  --server-name pg-shop-prod --resource-group rg-shop-prod-uks \
  --display-name "sg-shop-dba" --object-id "$GROUP_OBJECT_ID" --type Group
```

```csharp
var credential = new DefaultAzureCredential();
var token = await credential.GetTokenAsync(
    new TokenRequestContext(new[] { "https://ossrdbms-aad.database.windows.net/.default" }));

var builder = new NpgsqlConnectionStringBuilder
{
    Host = "pg-shop-prod.postgres.database.azure.com",
    Database = "shop",
    Username = "shop-api",
    Password = token.Token,
    SslMode = SslMode.Require
};
```

**The token is the password**, and it expires after about an hour. Fetch it per connection rather than caching it for the life of the application, or connections start failing after an hour of uptime.

Npgsql supports a periodic password provider that handles the refresh, which is cleaner than doing it by hand.

```sql
SELECT * FROM pgaadauth_create_principal('shop-api', false, false);
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "shop-api";
```

## High availability

```text
Same zone      standby in the same availability zone. Protects against node failure.
Zone redundant standby in a different zone. Protects against zone failure.
```

```bash
az postgres flexible-server update \
  --name pg-shop-prod --resource-group rg-shop-prod-uks \
  --high-availability ZoneRedundant --standby-zone 2
```

The standby is not readable, which surprises people coming from a read replica model. It exists for failover only.

Failover takes 60 to 120 seconds and the connection string does not change, since the endpoint follows the primary.

For readable copies, use read replicas:

```bash
az postgres flexible-server replica create \
  --replica-name pg-shop-read-1 --source-server pg-shop-prod \
  --resource-group rg-shop-prod-uks
```

## Extensions

```bash
az postgres flexible-server parameter set \
  --server-name pg-shop-prod --resource-group rg-shop-prod-uks \
  --name azure.extensions --value "pg_stat_statements,uuid-ossp,pgcrypto,vector,postgis"
```

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS vector;
```

**Extensions must be allow listed at the server level before `CREATE EXTENSION` works.** Forgetting that produces a permission error that looks like an access problem and is not.

`pgvector` matters for anything doing embeddings and similarity search, and it is available on Flexible Server.

## Configuration parameters

```bash
az postgres flexible-server parameter set \
  --server-name pg-shop-prod --resource-group rg-shop-prod-uks \
  --name max_connections --value 200

az postgres flexible-server parameter list \
  --server-name pg-shop-prod --resource-group rg-shop-prod-uks \
  --query "[?value!=defaultValue].{Name:name, Value:value, Default:defaultValue}" -o table
```

Some parameters need a restart, and the CLI says which. That last query shows everything changed from default, which is the first thing to check when a server behaves unlike another.

## Connection pooling

PostgreSQL creates a process per connection, which is expensive. An application opening hundreds of connections exhausts `max_connections` and memory.

```bash
az postgres flexible-server parameter set \
  --server-name pg-shop-prod --resource-group rg-shop-prod-uks \
  --name pgbouncer.enabled --value true
```

Built in PgBouncer listens on port 6432 and multiplexes many client connections onto few server connections.

```text
Port 5432   direct to PostgreSQL
Port 6432   through PgBouncer
```

For serverless workloads that scale out, this is close to essential. A hundred function instances each holding connections will exhaust the server without it.

Note that transaction pooling mode does not support session level features like prepared statements in some drivers, so test the application against it.

## Backups and restore

```bash
az postgres flexible-server update \
  --name pg-shop-prod --resource-group rg-shop-prod-uks \
  --backup-retention 35 --geo-redundant-backup Enabled

az postgres flexible-server restore \
  --name pg-shop-restored --resource-group rg-shop-prod-uks \
  --source-server pg-shop-prod --restore-time "2026-09-07T09:30:00Z"
```

Automatic, 7 to 35 days, point in time restore. Geo redundant backup must be chosen at creation and cannot be enabled later.

As with SQL, restore creates a new server rather than overwriting.

## Stopping a server

```bash
az postgres flexible-server stop --name pg-shop-dev --resource-group rg-shop-dev-uks
az postgres flexible-server start --name pg-shop-dev --resource-group rg-shop-dev-uks
```

Stops compute charges while keeping storage. Development servers stopped overnight and at weekends cost a fraction.

A stopped server restarts automatically after seven days, so this is not indefinite.

## Watching it

```sql
SELECT query, calls, total_exec_time, mean_exec_time, rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

SELECT pid, state, wait_event_type, wait_event, query_start, LEFT(query, 80)
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY query_start;

SELECT schemaname, relname, seq_scan, idx_scan, n_live_tup
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan AND n_live_tup > 10000
ORDER BY seq_scan DESC;
```

That last query finds tables being scanned sequentially despite being large, which is usually a missing index.

```bash
az postgres flexible-server parameter set \
  --server-name pg-shop-prod --resource-group rg-shop-prod-uks \
  --name log_min_duration_statement --value 1000
```

Logging statements slower than a second gives a slow query log without the overhead of logging everything.

## Quick recap

- Single Server is retired, so Flexible Server is the only model to use.
- Public or private networking is decided at creation, and private cannot be changed later.
- The Entra ID token is the password and expires hourly, so fetch it per connection.
- The high availability standby is not readable, and read replicas are separate.
- Extensions must be allow listed at server level before `CREATE EXTENSION` works.
- Enable PgBouncer for anything that scales out, since PostgreSQL uses a process per connection.
- Geo redundant backup must be chosen at creation.

<code id="code-content" class="language-bash">
# SINGLE SERVER IS RETIRED (PostgreSQL March 2025, MySQL September 2024).
# Flexible Server is the only model to use.
az postgres flexible-server create --name pg-shop-prod \
  --resource-group rg-shop-prod-uks --tier GeneralPurpose \
  --sku-name Standard_D4ds_v5 --version 17 --storage-size 256 \
  --storage-auto-grow Enabled --high-availability ZoneRedundant \
  --zone 1 --standby-zone 2 --vnet vnet-shop-prod-uks --subnet snet-postgres \
  --active-directory-auth Enabled --password-auth Disabled
# NETWORKING IS DECIDED AT CREATION AND PRIVATE ACCESS CANNOT BE CHANGED.
# Moving to public means a NEW SERVER AND A MIGRATION. Decide deliberately.
#   public access   firewall rules by IP, can add a private endpoint later
#   private access  injected into a delegated subnet, PERMANENT
# ENTRA ID: THE TOKEN IS THE PASSWORD, and it EXPIRES AFTER ABOUT AN HOUR.
# Fetch it PER CONNECTION, or connections start failing after an hour of
# uptime. Npgsql has a periodic password provider that handles this.
#   scope: https://ossrdbms-aad.database.windows.net/.default
#   SELECT * FROM pgaadauth_create_principal('shop-api', false, false);
# THE HA STANDBY IS NOT READABLE. It exists for failover only, taking 60 to
# 120 seconds, with no connection string change. For readable copies:
az postgres flexible-server replica create --replica-name pg-shop-read-1 \
  --source-server pg-shop-prod --resource-group rg-shop-prod-uks
# EXTENSIONS MUST BE ALLOW LISTED AT SERVER LEVEL FIRST. Forgetting gives a
# permission error that looks like an access problem and is not.
az postgres flexible-server parameter set --server-name pg-shop-prod \
  --resource-group rg-shop-prod-uks --name azure.extensions \
  --value "pg_stat_statements,uuid-ossp,pgcrypto,vector,postgis"
#   ...then, in the database: CREATE EXTENSION IF NOT EXISTS vector;
# CONNECTION POOLING. PostgreSQL creates a PROCESS PER CONNECTION. A
# hundred function instances holding connections will exhaust the server.
# Built in PgBouncer listens on 6432 and multiplexes them:
az postgres flexible-server parameter set --server-name pg-shop-prod \
  --resource-group rg-shop-prod-uks --name pgbouncer.enabled --value true
#   5432 direct   |   6432 through PgBouncer
# GEO REDUNDANT BACKUP MUST BE CHOSEN AT CREATION. Restore creates a NEW
# server rather than overwriting.
az postgres flexible-server restore --name pg-shop-restored \
  --resource-group rg-shop-prod-uks --source-server pg-shop-prod \
  --restore-time "2026-09-07T09:30:00Z"
# Stopping dev servers overnight stops compute charges. They restart
# automatically after seven days, so it is not indefinite.
az postgres flexible-server stop --name pg-shop-dev --resource-group rg-shop-dev-uks
# WATCHING IT:
#   SELECT query, calls, total_exec_time FROM pg_stat_statements
#   ORDER BY total_exec_time DESC LIMIT 20;
#   -- large tables being SCANNED, usually a missing index:
#   SELECT relname, seq_scan, idx_scan, n_live_tup FROM pg_stat_user_tables
#   WHERE seq_scan &gt; idx_scan AND n_live_tup &gt; 10000 ORDER BY seq_scan DESC;
# A slow query log without logging everything:
az postgres flexible-server parameter set --server-name pg-shop-prod \
  --resource-group rg-shop-prod-uks --name log_min_duration_statement --value 1000
</code></pre>
