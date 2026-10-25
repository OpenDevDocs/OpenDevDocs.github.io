---
publishDate: 2026-08-29T15:40
title: Deploying to Azure App Service
slug: deploying-to-azure-app-service
metadescription: Deploy an MVC app to Azure App Service with Azure SQL, create the resources with the Azure CLI, configure application settings and connection strings, publish from the command line, Visual Studio or GitHub Actions, and use deployment slots for zero downtime releases.
updateDate: 2026-09-14T15:40
author: ['bishal-biswas']
level: 4
tags: ['azure', 'app-service', 'deployment']
course: dotnet-mvc
---

## Hosting without a server

Azure App Service runs your app without you managing a machine. You give it a published package, it gives you a URL with HTTPS, scaling, logs, backups and a place to set environment variables. For an MVC app it is the shortest path from working locally to running on the internet.

This topic deploys the shop app with an Azure SQL database. You need an Azure account and the Azure CLI installed.

## The resources

An App Service deployment involves four things:

- A **resource group**: a folder for everything related to this app.
- An **App Service plan**: the compute the app runs on, priced by tier.
- A **web app**: your app, inside the plan.
- An **Azure SQL database**: the data, with a server that holds it.

## Creating them with the CLI

```bash
az login

az group create --name shopapp-rg --location westeurope

az appservice plan create --name shopapp-plan --resource-group shopapp-rg --sku B1 --is-linux

az webapp create --name shopapp-demo --resource-group shopapp-rg --plan shopapp-plan --runtime "DOTNETCORE:8.0"
```

`B1` is the Basic tier, cheap and fine for testing. `F1` is free but has limits. `--is-linux` picks Linux hosting, which is usually cheaper than Windows and works the same for ASP.NET Core. The web app name must be unique across Azure because it becomes `shopapp-demo.azurewebsites.net`.

Now the database:

```bash
az sql server create --name shopapp-sql --resource-group shopapp-rg --location westeurope --admin-user shopadmin --admin-password "<strong password>"

az sql db create --name ShopApp --server shopapp-sql --resource-group shopapp-rg --service-objective Basic

az sql server firewall-rule create --server shopapp-sql --resource-group shopapp-rg --name AllowAzure --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

The firewall rule with `0.0.0.0` means "allow Azure services", which lets the web app reach the database. To run migrations from your machine, add a rule for your own IP address too.

## Configuring the app

Settings in App Service are environment variables, which means your `IConfiguration` picks them up with no code changes. Connection strings have their own section:

```bash
az webapp config connection-string set --name shopapp-demo --resource-group shopapp-rg --connection-string-type SQLAzure --settings Default="Server=tcp:shopapp-sql.database.windows.net,1433;Database=ShopApp;User ID=shopadmin;Password=<strong password>;Encrypt=True;"

az webapp config appsettings set --name shopapp-demo --resource-group shopapp-rg --settings ASPNETCORE_ENVIRONMENT=Production Shop__PageSize=25
```

The connection string appears to the app as `ConnectionStrings:Default`. The double underscore in `Shop__PageSize` maps to `Shop:PageSize`.

Never put the password in `appsettings.json`. It lives here, in the portal, encrypted at rest.

## Publishing from the command line

Publish to a zip and push it:

```bash
dotnet publish -c Release -o ./publish
cd publish
zip -r ../app.zip .
cd ..

az webapp deploy --name shopapp-demo --resource-group shopapp-rg --src-path app.zip --type zip
```

A minute later the app is live at `https://shopapp-demo.azurewebsites.net`. HTTPS is already on with a valid certificate.

On Windows, use `Compress-Archive` instead of `zip`.

## Publishing from Visual Studio

Right click the project, choose **Publish**, then **Azure**, then **Azure App Service**. Sign in, pick the web app, and click Publish. Visual Studio stores a publish profile so the next deploy is one click. It can also create the resources for you if they do not exist yet.

## Migrations

The database is empty. Two ways to apply migrations:

**From your machine**, after adding your IP to the firewall:

```bash
dotnet ef database update --connection "Server=tcp:shopapp-sql.database.windows.net,1433;Database=ShopApp;User ID=shopadmin;Password=...;Encrypt=True;"
```

**At startup**, with `Database.Migrate()` in `Program.cs` as the migrations topic showed. Convenient, and fine for a single instance. For several instances, prefer a deployment step.

## Deploying with GitHub Actions

Continuous deployment means every push to `main` publishes automatically. Get a publish profile:

```bash
az webapp deployment list-publishing-profiles --name shopapp-demo --resource-group shopapp-rg --xml
```

Save the XML output as a repository secret called `AZURE_PUBLISH_PROFILE`, then add a workflow:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: 8.0.x
      - run: dotnet test
      - run: dotnet publish ShopApp/ShopApp.csproj -c Release -o ./publish
      - uses: azure/webapps-deploy@v3
        with:
          app-name: shopapp-demo
          publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE }}
          package: ./publish
```

Tests run first. If they fail, nothing deploys. The portal's Deployment Center can generate this workflow for you and commit it to the repo.

## Deployment slots

On the Standard tier and above, a **slot** is a second copy of the app with its own URL. Deploy to a `staging` slot, check it, then **swap** it with production. The swap is a routing change, so there is no downtime, and swapping back is an instant rollback:

```bash
az webapp deployment slot create --name shopapp-demo --resource-group shopapp-rg --slot staging

az webapp deploy --name shopapp-demo --resource-group shopapp-rg --slot staging --src-path app.zip --type zip

az webapp deployment slot swap --name shopapp-demo --resource-group shopapp-rg --slot staging --target-slot production
```

Mark settings that must stay with the slot, such as a staging database connection string, as "deployment slot settings" in the portal so they do not swap.

## Logs and diagnostics

Turn on application logging and stream it:

```bash
az webapp log config --name shopapp-demo --resource-group shopapp-rg --application-logging filesystem --level information

az webapp log tail --name shopapp-demo --resource-group shopapp-rg
```

Your `ILogger` output appears here. For anything serious, add **Application Insights**, which collects requests, exceptions, dependencies and performance in one place:

```bash
dotnet add package Microsoft.ApplicationInsights.AspNetCore
```

```csharp
builder.Services.AddApplicationInsightsTelemetry();
```

Set the connection string in app settings as `APPLICATIONINSIGHTS_CONNECTION_STRING`.

## Data protection on App Service

App Service already persists data protection keys in a shared location for your app, so cookies survive restarts and work across scaled out instances without extra code. If you run in containers on App Service, check that this applies to your setup, and configure explicit key storage if not.

## Custom domains

Add your own domain in the portal under Custom domains, create the DNS records it shows you, and turn on the free managed certificate. The `azurewebsites.net` URL keeps working alongside it.

## Cleaning up

Everything in a resource group is deleted together, so a test deployment is cheap to remove:

```bash
az group delete --name shopapp-rg --yes
```

## Quick recap

- App Service runs your app with HTTPS, scaling and logs and no server to manage.
- Create a resource group, plan, web app and Azure SQL database with the CLI, and open the firewall to Azure services.
- Connection strings and settings are environment variables set with the CLI or in the portal.
- Deploy a zip with `az webapp deploy`, one click from Visual Studio, or automatically with GitHub Actions.
- Deployment slots give zero downtime releases and instant rollback with a swap.
- Stream logs with `az webapp log tail` and add Application Insights for full monitoring.

<code id="code-content" class="language-csharp">
// Program.cs (App Service ready)
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt;
    o.UseSqlServer(
        builder.Configuration.GetConnectionString("Default"),
        sql =&gt; sql.EnableRetryOnFailure()));          // Azure SQL can have brief interruptions

builder.Services.AddApplicationInsightsTelemetry();  // reads APPLICATIONINSIGHTS_CONNECTION_STRING
builder.Services.AddHealthChecks().AddDbContextCheck&lt;AppDbContext&gt;();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapHealthChecks("/health");
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");

using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService&lt;AppDbContext&gt;().Database.Migrate();
}

app.Run();

// Azure CLI: create everything
//
//   az login
//   az group create --name shopapp-rg --location westeurope
//   az appservice plan create --name shopapp-plan --resource-group shopapp-rg --sku B1 --is-linux
//   az webapp create --name shopapp-demo --resource-group shopapp-rg --plan shopapp-plan --runtime "DOTNETCORE:8.0"
//   az sql server create --name shopapp-sql --resource-group shopapp-rg --location westeurope \
//       --admin-user shopadmin --admin-password "&lt;strong password&gt;"
//   az sql db create --name ShopApp --server shopapp-sql --resource-group shopapp-rg --service-objective Basic
//   az sql server firewall-rule create --server shopapp-sql --resource-group shopapp-rg \
//       --name AllowAzure --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0

// Azure CLI: configure
//
//   az webapp config connection-string set --name shopapp-demo --resource-group shopapp-rg \
//       --connection-string-type SQLAzure \
//       --settings Default="Server=tcp:shopapp-sql.database.windows.net,1433;Database=ShopApp;User ID=shopadmin;Password=...;Encrypt=True;"
//   az webapp config appsettings set --name shopapp-demo --resource-group shopapp-rg \
//       --settings ASPNETCORE_ENVIRONMENT=Production Shop__PageSize=25

// Azure CLI: deploy and watch
//
//   dotnet publish -c Release -o ./publish
//   (zip the publish folder as app.zip)
//   az webapp deploy --name shopapp-demo --resource-group shopapp-rg --src-path app.zip --type zip
//   az webapp log tail --name shopapp-demo --resource-group shopapp-rg

// .github/workflows/deploy.yml
//
//   name: Deploy to Azure
//   on:
//     push:
//       branches: [main]
//   jobs:
//     deploy:
//       runs-on: ubuntu-latest
//       steps:
//         - uses: actions/checkout@v4
//         - uses: actions/setup-dotnet@v4
//           with:
//             dotnet-version: 8.0.x
//         - run: dotnet test
//         - run: dotnet publish ShopApp/ShopApp.csproj -c Release -o ./publish
//         - uses: azure/webapps-deploy@v3
//           with:
//             app-name: shopapp-demo
//             slot-name: staging
//             publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE }}
//             package: ./publish
</code></pre>
