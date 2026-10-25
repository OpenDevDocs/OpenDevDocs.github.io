---
publishDate: 2026-09-30T19:10
title: Deploying to Azure App Service
slug: deploying-to-azure-app-service
metadescription: Deploy an ASP.NET Core Web API to Azure App Service with the CLI, configure secrets and connection strings, set up a managed identity, use deployment slots, and automate it with GitHub Actions.
updateDate: 2026-09-07T19:10
author: ['bishal-biswas']
level: 4
tags: ['azure', 'deployment', 'ci-cd']
course: dotnet-webapi
---

## What App Service gives you

Azure App Service is a managed platform. You hand it your application and it handles the operating system, patching, TLS certificates, load balancing, autoscaling and logging.

It is the least work of any Azure option for a Web API. Container Apps and AKS offer more control at more cost in complexity.

## Creating the resources

```bash
az login

az group create --name rg-bookstore --location uksouth

# The App Service plan: the machines your app runs on
az appservice plan create \
  --name plan-bookstore \
  --resource-group rg-bookstore \
  --sku B1 \
  --is-linux

# The web app itself
az webapp create \
  --name bookstore-api \
  --resource-group rg-bookstore \
  --plan plan-bookstore \
  --runtime "DOTNETCORE:8.0"
```

The name must be globally unique, because it becomes `bookstore-api.azurewebsites.net`.

**Pick the tier deliberately.** `F1` is free and has no custom domain, no always on and a daily CPU quota. `B1` is the cheapest usable tier. `S1` and above add deployment slots and autoscaling. Production wants at least `S1` for the slots alone.

## Deploying

The simplest path publishes a zip:

```bash
dotnet publish -c Release -o ./publish

cd publish
zip -r ../deploy.zip .
cd ..

az webapp deploy \
  --name bookstore-api \
  --resource-group rg-bookstore \
  --src-path deploy.zip \
  --type zip
```

Your API is now live at `https://bookstore-api.azurewebsites.net`. TLS is already configured.

Other options: `az webapp up` for a one command deploy while experimenting, container deployment from a registry, or GitHub Actions for anything real.

## Configuration and secrets

App settings become environment variables, so your existing configuration code works with no change:

```bash
az webapp config appsettings set \
  --name bookstore-api \
  --resource-group rg-bookstore \
  --settings \
    ASPNETCORE_ENVIRONMENT=Production \
    Jwt__Issuer=BookStoreApi \
    Api__MaxPageSize=50
```

The double underscore is the nested key separator, exactly as in any environment variable.

Connection strings have their own section:

```bash
az webapp config connection-string set \
  --name bookstore-api \
  --resource-group rg-bookstore \
  --connection-string-type SQLAzure \
  --settings Default="Server=tcp:...;Database=BookStore;..."
```

`GetConnectionString("Default")` reads it unchanged.

**These values are visible to anyone with portal access.** For real secrets, use Key Vault.

## Key Vault with a managed identity

The proper way. Your app authenticates as itself, so there is no secret anywhere to leak:

```bash
# Give the web app an identity
az webapp identity assign --name bookstore-api --resource-group rg-bookstore

# Create the vault
az keyvault create --name kv-bookstore --resource-group rg-bookstore --location uksouth

# Store a secret. A double dash becomes a colon in configuration.
az keyvault secret set --vault-name kv-bookstore --name "Jwt--Key" --value "the-real-key"

# Let the app read secrets
principalId=$(az webapp identity show --name bookstore-api \
  --resource-group rg-bookstore --query principalId -o tsv)

az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee $principalId \
  --scope $(az keyvault show --name kv-bookstore --query id -o tsv)
```

```csharp
if (builder.Environment.IsProduction())
{
    builder.Configuration.AddAzureKeyVault(
        new Uri($"https://kv-bookstore.vault.azure.net/"),
        new DefaultAzureCredential());
}
```

`DefaultAzureCredential` uses the managed identity in Azure and your `az login` locally, so the same code works in both places.

The secret name `Jwt--Key` becomes the configuration key `Jwt:Key`. A colon is not allowed in a secret name, hence the double dash.

## Passwordless database access

The same idea for SQL. No password in the connection string at all:

```bash
az sql server ad-admin create \
  --resource-group rg-bookstore \
  --server sql-bookstore \
  --display-name "SQL Admin" \
  --object-id $(az ad signed-in-user show --query id -o tsv)
```

Then in the database, create a user for the app's identity:

```sql
CREATE USER [bookstore-api] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [bookstore-api];
ALTER ROLE db_datawriter ADD MEMBER [bookstore-api];
```

```text
Server=tcp:sql-bookstore.database.windows.net,1433;
Database=BookStore;
Authentication=Active Directory Default;
Encrypt=True;
```

There is no password to rotate, leak or commit. If your platform supports this, it is the strongest option available.

## Settings worth changing

**Always On** stops the app being unloaded when idle. Without it, the first request after a quiet period takes many seconds:

```bash
az webapp config set --name bookstore-api --resource-group rg-bookstore --always-on true
```

Not available on the Free tier, which is a reason to avoid it for anything real.

**HTTPS only** redirects any HTTP request:

```bash
az webapp update --name bookstore-api --resource-group rg-bookstore --https-only true
```

Once this is on, do **not** also call `app.UseHttpsRedirection()` in a way that fights it. App Service terminates TLS and forwards over HTTP internally, so your app sees HTTP and could redirect in a loop. Configure forwarded headers so the app sees the original scheme:

```csharp
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();      // App Service proxies are not a fixed range
    options.KnownProxies.Clear();
});

app.UseForwardedHeaders();
```

Clearing the known lists is specific to App Service, where the platform sits in front and the proxy addresses are not predictable. It is safe there because the platform controls the ingress.

**Health check** tells App Service to remove an unhealthy instance:

```bash
az webapp config set --name bookstore-api --resource-group rg-bookstore \
  --generic-configurations '{"healthCheckPath": "/health/ready"}'
```

## Deployment slots

The feature that makes App Service worth the tier upgrade. A slot is a full copy of your app at a different URL:

```bash
az webapp deployment slot create \
  --name bookstore-api \
  --resource-group rg-bookstore \
  --slot staging

# Deploy to staging, not production
az webapp deploy \
  --name bookstore-api \
  --resource-group rg-bookstore \
  --slot staging \
  --src-path deploy.zip --type zip

# Test it at bookstore-api-staging.azurewebsites.net, then swap
az webapp deployment slot swap \
  --name bookstore-api \
  --resource-group rg-bookstore \
  --slot staging \
  --target-slot production
```

The swap is a **routing change**, not a redeploy. The staging instance is already warm, so there is no cold start and no downtime. If something is wrong, swap back immediately.

Mark settings that should not follow the swap as **slot settings**, so staging keeps pointing at the staging database:

```bash
az webapp config appsettings set \
  --name bookstore-api --resource-group rg-bookstore --slot staging \
  --slot-settings ASPNETCORE_ENVIRONMENT=Staging
```

Forgetting this is how a staging deploy ends up writing to the production database.

## Migrations

Do not run `Database.Migrate()` at startup here. With several instances, or a slot swap, more than one process tries to migrate at once.

Generate an idempotent script in CI and run it as its own step:

```bash
dotnet ef migrations script --idempotent --output migrate.sql
sqlcmd -S sql-bookstore.database.windows.net -d BookStore -G -i migrate.sql
```

Run migrations **before** swapping the slot, and keep them backward compatible so the old version still works during the swap.

## GitHub Actions

```yaml
name: Deploy to Azure

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write            # for passwordless login
      contents: read

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'

      - run: dotnet restore
      - run: dotnet build -c Release --no-restore
      - run: dotnet test -c Release --no-build --verbosity normal
      - run: dotnet publish BookStore.Api -c Release -o ./publish --no-build

      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - uses: azure/webapps-deploy@v3
        with:
          app-name: bookstore-api
          slot-name: staging
          package: ./publish

      - name: Swap to production
        run: |
          az webapp deployment slot swap \
            --name bookstore-api \
            --resource-group rg-bookstore \
            --slot staging --target-slot production
```

`id-token: write` with `azure/login` uses OpenID Connect, so there is no publish profile or service principal secret stored in GitHub. Set that up rather than storing credentials.

Note `dotnet test` before the deploy. A pipeline that deploys without running tests is not a pipeline, it is an upload.

## Watching it run

```bash
# Live log stream
az webapp log tail --name bookstore-api --resource-group rg-bookstore

# Turn on file logging
az webapp log config \
  --name bookstore-api --resource-group rg-bookstore \
  --application-logging filesystem --level information
```

For anything real, add **Application Insights**. It gives you request traces, dependency timings, exception details and live metrics:

```bash
dotnet add package Microsoft.ApplicationInsights.AspNetCore
```

```csharp
builder.Services.AddApplicationInsightsTelemetry();
```

The **Kudu** console at `https://bookstore-api.scm.azurewebsites.net` lets you browse files and check what actually got deployed. It is the first place to look when a deployment behaves unexpectedly.

## Common problems

**502 or 503 after deploying.** The app failed to start. Check `az webapp log tail`, usually a missing configuration value or a connection string.

**The first request is very slow.** Always On is off, or you are on the Free tier.

**Infinite redirect loop.** HTTPS Only plus `UseHttpsRedirection` without forwarded headers configured.

**Cannot reach the database.** Azure SQL blocks everything by default. Allow Azure services, or add a private endpoint.

**Configuration is not picked up.** Check the double underscore, and remember that a slot setting stays with the slot.

## Quick recap

- App Service is the least work path for a Web API on Azure. Use at least `S1` in production for slots.
- Deploy a published zip with `az webapp deploy`, or a container, or GitHub Actions.
- App settings become environment variables, with a double underscore for nested keys.
- Use Key Vault with a managed identity for secrets, and `Jwt--Key` becomes `Jwt:Key`.
- Passwordless SQL with `Authentication=Active Directory Default` removes the secret entirely.
- Turn on Always On and HTTPS Only, and configure forwarded headers with the known lists cleared.
- Deployment slots give zero downtime releases and an instant rollback by swapping back.
- Mark environment specific values as slot settings, or staging writes to production.
- Run migrations as a pipeline step before the swap, never at startup.
- Use OpenID Connect in GitHub Actions rather than storing a publish profile.
- Add Application Insights, and check Kudu when a deployment misbehaves.

<code id="code-content" class="language-csharp">
// Program.cs configured for Azure App Service.
using Azure.Identity;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
var builder = WebApplication.CreateBuilder(args);
// Key Vault via managed identity: no secret exists anywhere to leak.
// DefaultAzureCredential uses the managed identity in Azure and your
// az login locally, so the same code works in both places.
if (builder.Environment.IsProduction())
{
    string vaultName = builder.Configuration["KeyVault:Name"] ?? "kv-bookstore";
    builder.Configuration.AddAzureKeyVault(
        new Uri($"https://{vaultName}.vault.azure.net/"),
        new DefaultAzureCredential());
    // A secret named "Jwt--Key" becomes the configuration key "Jwt:Key",
    // because a colon is not allowed in a Key Vault secret name.
}
// App Service terminates TLS and forwards over HTTP, so without this the app
// thinks every request is insecure and generates http:// redirect URLs.
builder.Services.Configure&lt;ForwardedHeadersOptions&gt;(options =&gt;
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Specific to App Service: the platform proxies are not a fixed range, and
    // the platform controls the ingress, so clearing these is safe here.
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});
builder.Services.AddDbContext&lt;AppDbContext&gt;(options =&gt;
    options.UseSqlServer(
        // Passwordless: Authentication=Active Directory Default in the connection
        // string, no password to rotate, leak or commit.
        builder.Configuration.GetConnectionString("Default"),
        sql =&gt; sql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null)));
builder.Services.AddApplicationInsightsTelemetry();
builder.Services.AddControllers();
builder.Services.AddHealthChecks()
    .AddCheck("self", () =&gt; Microsoft.Extensions.Diagnostics.HealthChecks
        .HealthCheckResult.Healthy(), tags: new[] { "live" })
    .AddDbContextCheck&lt;AppDbContext&gt;("database", tags: new[] { "ready" });
var app = builder.Build();
app.UseForwardedHeaders();      // FIRST, before anything reads the scheme or IP
if (!app.Environment.IsDevelopment())
    app.UseExceptionHandler("/error");
// HTTPS Only is set on the App Service itself with --https-only true.
// Combining that with UseHttpsRedirection and NO forwarded headers gives an
// infinite redirect loop, which is the classic first Azure deployment failure.
app.MapControllers();
// App Service polls this and removes an unhealthy instance from rotation:
//   az webapp config set --generic-configurations '{"healthCheckPath": "/health/ready"}'
app.MapHealthChecks("/health/ready",
    new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
    { Predicate = c =&gt; c.Tags.Contains("ready") });
app.MapHealthChecks("/health/live",
    new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
    { Predicate = c =&gt; c.Tags.Contains("live") });
// NOT db.Database.Migrate() here. With several instances or a slot swap, more
// than one process would migrate at once. Run this in the pipeline instead:
//   dotnet ef migrations script --idempotent --output migrate.sql
app.Run();
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
}
/* ---------------- Provisioning ----------------
az group create --name rg-bookstore --location uksouth
az appservice plan create --name plan-bookstore -g rg-bookstore --sku S1 --is-linux
az webapp create --name bookstore-api -g rg-bookstore --plan plan-bookstore --runtime "DOTNETCORE:8.0"
az webapp config set --name bookstore-api -g rg-bookstore --always-on true
az webapp update --name bookstore-api -g rg-bookstore --https-only true
   ---------------- Managed identity plus Key Vault ----------------
az webapp identity assign --name bookstore-api -g rg-bookstore
az keyvault secret set --vault-name kv-bookstore --name "Jwt--Key" --value "the-real-key"
az role assignment create --role "Key Vault Secrets User" \
  --assignee $(az webapp identity show --name bookstore-api -g rg-bookstore --query principalId -o tsv) \
  --scope $(az keyvault show --name kv-bookstore --query id -o tsv)
   ---------------- Zero downtime release ----------------
az webapp deployment slot create --name bookstore-api -g rg-bookstore --slot staging
# Slot settings do NOT follow the swap. Without this, staging writes to production.
az webapp config appsettings set --name bookstore-api -g rg-bookstore --slot staging \
  --slot-settings ASPNETCORE_ENVIRONMENT=Staging
az webapp deploy --name bookstore-api -g rg-bookstore --slot staging --src-path deploy.zip --type zip
# Run migrations BEFORE the swap, and keep them backward compatible
sqlcmd -S sql-bookstore.database.windows.net -d BookStore -G -i migrate.sql
# A routing change, not a redeploy: the instance is already warm, so no cold start.
# Swap back instantly if anything is wrong.
az webapp deployment slot swap --name bookstore-api -g rg-bookstore \
  --slot staging --target-slot production
   ---------------- Diagnosing ----------------
az webapp log tail --name bookstore-api -g rg-bookstore
# Browse what actually got deployed: https://bookstore-api.scm.azurewebsites.net
*/
</code></pre>
