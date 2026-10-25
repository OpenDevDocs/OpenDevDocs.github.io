---
publishDate: 2026-10-13T09:25
title: Azure SQL Database and Managed Instance
slug: azure-sql-database
metadescription: Run SQL Server on Azure as a managed database, choose between single database and managed instance, and connect without passwords.
updateDate: 2026-09-07T09:25
author: ['bishal-biswas']
level: 2
tags: ['databases', 'sql', 'paas']
course: azure
---

## Three ways to run SQL Server

```text
Azure SQL Database          a single database. Most managed, most restrictions.
Azure SQL Managed Instance  near full SQL Server compatibility, in a vnet.
SQL Server on a VM          you install and manage it. Full control, full work.
```

Most new work belongs on Azure SQL Database. Managed Instance exists for lifting an existing SQL Server estate that uses features the single database model does not have.

## Creating one

```bash
az sql server create \
  --name sql-shop-prod --resource-group rg-shop-prod-uks \
  --location uksouth \
  --enable-ad-only-auth \
  --external-admin-principal-type Group \
  --external-admin-name "sg-shop-dba" \
  --external-admin-sid "$(az ad group show --group sg-shop-dba --query id -o tsv)"

az sql db create \
  --name shop --server sql-shop-prod --resource-group rg-shop-prod-uks \
  --edition GeneralPurpose --family Gen5 --capacity 2 \
  --compute-model Serverless --auto-pause-delay 60 \
  --backup-storage-redundancy Zone \
  --zone-redundant false
```

`--enable-ad-only-auth` is worth doing at creation. It disables SQL authentication entirely, so no username and password combination exists to leak, and access is governed by Entra ID.

Note the server is a logical container, not a machine. It provides an endpoint, a firewall and an administrator, and databases underneath have their own compute.

## Connecting without a password

```csharp
var connectionString =
    "Server=sql-shop-prod.database.windows.net;" +
    "Database=shop;" +
    "Authentication=Active Directory Default;" +
    "Encrypt=True;TrustServerCertificate=False;";

await using var connection = new SqlConnection(connectionString);
await connection.OpenAsync();
```

`Authentication=Active Directory Default` uses `DefaultAzureCredential` behaviour: your `az login` locally, the managed identity in Azure.

The database side needs the identity as a user:

```sql
CREATE USER [shop-api] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [shop-api];
ALTER ROLE db_datawriter ADD MEMBER [shop-api];
GRANT EXECUTE ON SCHEMA::dbo TO [shop-api];
```

The name is the managed identity's display name. Run this connected as an Entra ID administrator, since a SQL authenticated login cannot create external users.

## Firewall and networking

```bash
az sql server firewall-rule create \
  --server sql-shop-prod --resource-group rg-shop-prod-uks \
  --name allow-office --start-ip-address 203.0.113.10 --end-ip-address 203.0.113.10

az sql server update --name sql-shop-prod --resource-group rg-shop-prod-uks \
  --enable-public-network false
```

There is a rule called "Allow Azure services" with the range `0.0.0.0` to `0.0.0.0`. **It allows every Azure subscription in the world**, not just yours. Avoid it, and use a private endpoint or a virtual network rule instead.

```bash
az network private-endpoint create \
  --name pe-sql-shop --resource-group rg-shop-prod-uks \
  --vnet-name vnet-shop-prod-uks --subnet snet-privatelink \
  --private-connection-resource-id /subscriptions/.../servers/sql-shop-prod \
  --group-id sqlServer --connection-name pe-sql-shop-conn
```

The private DNS zone is `privatelink.database.windows.net`.

## Backups happen automatically

```text
Full backup      weekly
Differential     every 12 to 24 hours
Transaction log  every 5 to 10 minutes
Retention        7 days by default, up to 35 days
```

Point in time restore to any moment within the retention window, with no configuration.

```bash
az sql db restore \
  --name shop --dest-name shop-restored \
  --server sql-shop-prod --resource-group rg-shop-prod-uks \
  --time "2026-09-07T09:30:00Z"

az sql db update --name shop --server sql-shop-prod \
  --resource-group rg-shop-prod-uks --backup-storage-redundancy Zone
```

**A restore creates a new database.** It does not overwrite the original, which is the safe behaviour: you restore, verify, then rename or repoint.

For longer retention:

```bash
az sql db ltr-policy set \
  --name shop --server sql-shop-prod --resource-group rg-shop-prod-uks \
  --weekly-retention P4W --monthly-retention P12M --yearly-retention P7Y --week-of-year 1
```

## Serverless compute

```bash
az sql db create \
  --name shop-dev --server sql-shop-dev --resource-group rg-shop-dev-uks \
  --edition GeneralPurpose --family Gen5 --compute-model Serverless \
  --min-capacity 0.5 --capacity 4 --auto-pause-delay 60
```

Compute scales between a minimum and maximum and pauses entirely after the idle delay, at which point you pay only for storage.

Excellent for development and intermittent workloads. The catch is that a paused database takes up to a minute to resume, and the first connection fails or times out while it does.

```text
auto-pause-delay 60     pause after an hour idle
auto-pause-delay -1     never pause
```

For production, set `-1` or use provisioned compute. A user waiting a minute for the first page of the day is not acceptable.

## Elastic pools

```bash
az sql elastic-pool create \
  --name pool-shop --server sql-shop-prod --resource-group rg-shop-prod-uks \
  --edition GeneralPurpose --family Gen5 --capacity 8 \
  --db-max-capacity 4 --db-min-capacity 0

az sql db update --name tenant-042 --server sql-shop-prod \
  --resource-group rg-shop-prod-uks --elastic-pool pool-shop
```

A pool shares compute across many databases. For a multi tenant application with a database per customer, where each is busy at different times, this is dramatically cheaper than provisioning each separately.

The economics work when peaks do not coincide. If every tenant is busy at 9am, a pool sized for that is no cheaper.

## Failover groups

```bash
az sql failover-group create \
  --name fg-shop --server sql-shop-prod --resource-group rg-shop-prod-uks \
  --partner-server sql-shop-prod-ne \
  --failover-policy Automatic --grace-period 1 \
  --add-db shop
```

A failover group gives a single listener endpoint that follows the primary. Applications connect to `fg-shop.database.windows.net` and keep working after a failover with no connection string change.

```text
Read write listener  always points at the primary
Read only listener   points at the secondary, for read scale out
```

Replication is asynchronous, so an unplanned failover can lose recent transactions. The grace period is how long Azure waits before failing over automatically, trading data loss against availability.

## Resilient connections

```csharp
builder.Services.AddDbContext<ShopContext>(options =>
    options.UseSqlServer(connectionString, sql =>
    {
        sql.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorNumbersToAdd: null);
        sql.CommandTimeout(30);
    }));
```

**Transient failures are normal in a managed database.** Failovers, maintenance and throttling all produce brief errors. An application without retry logic reports them as outages.

`EnableRetryOnFailure` knows which SQL error numbers are transient. Add it to every Entity Framework configuration.

## Security features worth enabling

```bash
az sql db threat-policy update --name shop --server sql-shop-prod \
  --resource-group rg-shop-prod-uks --state Enabled \
  --storage-account stshopaudit

az sql db audit-policy update --name shop --server sql-shop-prod \
  --resource-group rg-shop-prod-uks --state Enabled \
  --log-analytics-target-state Enabled \
  --log-analytics-workspace-resource-id /subscriptions/.../workspaces/law-shop
```

Transparent Data Encryption is on by default and encrypts data at rest. Auditing to Log Analytics is what lets you answer questions about access afterwards.

```sql
-- dynamic data masking, so support staff see masked values
ALTER TABLE Customers
ALTER COLUMN Email ADD MASKED WITH (FUNCTION = 'email()');

ALTER TABLE Customers
ALTER COLUMN CardLast4 ADD MASKED WITH (FUNCTION = 'partial(0, "****", 0)');
```

Masking applies to users without the `UNMASK` permission, so an application account can be granted it while a support account is not.

## Watching it

```sql
-- what is slow, from the query store
SELECT TOP 20
    q.query_id,
    SUBSTRING(t.query_sql_text, 1, 100) AS query_text,
    rs.avg_duration / 1000.0 AS avg_ms,
    rs.count_executions
FROM sys.query_store_query q
JOIN sys.query_store_query_text t ON q.query_text_id = t.query_text_id
JOIN sys.query_store_plan p ON q.query_id = p.query_id
JOIN sys.query_store_runtime_stats rs ON p.plan_id = rs.plan_id
ORDER BY rs.avg_duration DESC;

-- what is blocking what, right now
SELECT session_id, blocking_session_id, wait_type, wait_time, last_wait_type
FROM sys.dm_exec_requests
WHERE blocking_session_id <> 0;
```

Query Store is on by default and records query performance over time. It is the first place to look when the database was fine yesterday.

## Quick recap

- Use Azure SQL Database for new work, and Managed Instance for lifting an existing estate.
- Enable Entra ID only authentication at creation, so no password exists to leak.
- The "Allow Azure services" firewall rule allows every Azure subscription, not just yours.
- Backups are automatic, and a restore creates a new database rather than overwriting.
- Serverless auto pause is excellent for development and unacceptable for production.
- Elastic pools save money only when tenant peaks do not coincide.
- Transient failures are normal, so enable retry on failure in every application.

<code id="code-content" class="language-bash">
# THREE WAYS: Azure SQL Database (new work), Managed Instance (lifting an
# existing estate needing full compatibility), SQL Server on a VM (control
# and all the work).
# --enable-ad-only-auth AT CREATION disables SQL authentication entirely, so
# NO USERNAME AND PASSWORD EXISTS TO LEAK.
az sql server create --name sql-shop-prod --resource-group rg-shop-prod-uks \
  --enable-ad-only-auth --external-admin-principal-type Group \
  --external-admin-name "sg-shop-dba" --external-admin-sid "$GROUP_ID"
az sql db create --name shop --server sql-shop-prod --resource-group rg-shop-prod-uks \
  --edition GeneralPurpose --family Gen5 --capacity 2 --backup-storage-redundancy Zone
# CONNECT WITH NO PASSWORD. Locally your az login, in Azure the managed
# identity, same connection string:
#   "Server=sql-shop-prod.database.windows.net;Database=shop;
#    Authentication=Active Directory Default;Encrypt=True;"
# On the database side, as an Entra ID admin (a SQL login cannot do this):
#   CREATE USER [shop-api] FROM EXTERNAL PROVIDER;
#   ALTER ROLE db_datawriter ADD MEMBER [shop-api];
# THE "ALLOW AZURE SERVICES" RULE (0.0.0.0 to 0.0.0.0) ALLOWS EVERY AZURE
# SUBSCRIPTION IN THE WORLD, not just yours. Use a private endpoint instead.
az sql server update --name sql-shop-prod --resource-group rg-shop-prod-uks \
  --enable-public-network false
# BACKUPS ARE AUTOMATIC: weekly full, differential every 12-24h, log every
# 5-10 minutes, 7 to 35 day retention. A RESTORE CREATES A NEW DATABASE
# rather than overwriting, which is the safe behaviour.
az sql db restore --name shop --dest-name shop-restored --server sql-shop-prod \
  --resource-group rg-shop-prod-uks --time "2026-09-07T09:30:00Z"
az sql db ltr-policy set --name shop --server sql-shop-prod \
  --resource-group rg-shop-prod-uks --weekly-retention P4W --yearly-retention P7Y
# SERVERLESS auto pause is excellent for DEV and unacceptable for
# PRODUCTION: resuming takes up to a minute and the first connection times
# out. Use --auto-pause-delay -1 or provisioned compute for production.
# ELASTIC POOLS share compute across many databases, and only save money
# when TENANT PEAKS DO NOT COINCIDE. If everyone is busy at 9am, no saving.
# FAILOVER GROUPS give ONE listener endpoint that follows the primary, so
# the connection string never changes. Replication is ASYNCHRONOUS, so an
# unplanned failover can lose recent transactions.
az sql failover-group create --name fg-shop --server sql-shop-prod \
  --resource-group rg-shop-prod-uks --partner-server sql-shop-prod-ne \
  --failover-policy Automatic --grace-period 1 --add-db shop
# TRANSIENT FAILURES ARE NORMAL in a managed database: failovers,
# maintenance and throttling all produce brief errors. Without retry logic
# your application reports them as outages.
#   sql.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: 10s);
# QUERY STORE is on by default and is the first place to look when the
# database was fine yesterday:
#   SELECT TOP 20 ... FROM sys.query_store_runtime_stats ORDER BY avg_duration DESC
#   SELECT session_id, blocking_session_id, wait_type FROM sys.dm_exec_requests
#   WHERE blocking_session_id &lt;&gt; 0;
</code></pre>
