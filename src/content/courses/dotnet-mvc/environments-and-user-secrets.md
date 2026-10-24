---
publishDate: 2026-08-19T12:10
title: Environments and User Secrets
slug: environments-and-user-secrets
metadescription: Learn how ASPNETCORE_ENVIRONMENT switches between Development, Staging and Production, how environment specific appsettings files and code branches work, and how the Secret Manager keeps passwords and API keys out of source control.
updateDate: 2026-09-14T12:10
author: ['bishal-biswas']
level: 2
tags: ['environments', 'user-secrets', 'configuration']
course: dotnet-mvc
---

## One app, several places to run

The same code runs on your laptop, on a test server and in production. Each place needs different behaviour. On your laptop you want detailed error pages and a local database. In production you want a friendly error page, HTTPS enforcement and the real database.

ASP.NET Core handles this with a single setting: the **environment name**. Everything else, from which settings file loads to which middleware runs, keys off that name.

## Setting the environment

The environment comes from the `ASPNETCORE_ENVIRONMENT` variable. Three names are built in:

- **Development**: your machine. Detailed errors, hot reload, user secrets.
- **Staging**: a test server that mirrors production.
- **Production**: the real thing. This is the default if the variable is not set.

When you run from Visual Studio or `dotnet run`, `Properties/launchSettings.json` sets it to Development for you:

```json
{
  "profiles": {
    "ShopApp": {
      "commandName": "Project",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}
```

On a server, set the variable in the hosting configuration. Azure App Service has an application settings page for it. In Docker, pass `-e ASPNETCORE_ENVIRONMENT=Production`. From the command line:

```bash
dotnet run --environment Staging
```

You can also invent names such as `QA` or `Demo`. The framework treats them like any other value.

## Environment specific settings files

Configuration loads `appsettings.json` first and then `appsettings.{Environment}.json` on top. Keys in the second file override the first.

```json
// appsettings.json
{
  "Shop": { "Name": "The Keyboard Store", "PageSize": 20 },
  "Logging": { "LogLevel": { "Default": "Warning" } }
}
```

```json
// appsettings.Development.json
{
  "Logging": { "LogLevel": { "Default": "Information", "Microsoft.EntityFrameworkCore.Database.Command": "Information" } }
}
```

In development, logging is chatty and SQL is printed. In production, only warnings and above. `Shop:PageSize` is 20 in both because the development file does not mention it.

Add `appsettings.Staging.json` or `appsettings.Production.json` in the same way for things that differ there. Commit these files if they hold no secrets. They document how each environment is configured.

## Branching in code

`IWebHostEnvironment` tells your code which environment is active. In `Program.cs` it is `app.Environment`:

```csharp
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}
```

`IsDevelopment()`, `IsStaging()` and `IsProduction()` cover the built in names. `IsEnvironment("QA")` checks a custom one.

Inject it anywhere else you need it:

```csharp
public HomeController(IWebHostEnvironment env)
{
    if (env.IsDevelopment()) { /* ... */ }
}
```

Views have the `<environment>` tag helper from the tag helpers topic:

```cshtml
<environment include="Development">
    <script src="~/js/site.js"></script>
</environment>
<environment exclude="Development">
    <script src="~/js/site.min.js" asp-append-version="true"></script>
</environment>
```

## The secrets problem

Sooner or later a setting is a secret: a database password, a payment API key, an SMTP login. If you put it in `appsettings.json` and commit, it is in the repository history forever, visible to everyone who can read the repo. Even a private repo leaks eventually.

The rule is simple: **secrets never go in files that are committed**.

## User secrets for development

The **Secret Manager** stores development secrets in a JSON file under your user profile, outside the project folder, so they can never be committed by accident. Turn it on for a project:

```bash
dotnet user-secrets init
```

This adds a `UserSecretsId` to the project file. Then set values:

```bash
dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost;Database=ShopApp;User Id=dev;Password=devpass"
dotnet user-secrets set "Stripe:SecretKey" "sk_test_123"
```

List them with `dotnet user-secrets list` and remove with `dotnet user-secrets remove "Key"`.

In Visual Studio, right click the project and choose **Manage User Secrets** to edit the file directly.

The file lives at:

```text
Windows:  %APPDATA%\Microsoft\UserSecrets\<UserSecretsId>\secrets.json
macOS/Linux:  ~/.microsoft/usersecrets/<UserSecretsId>/secrets.json
```

## How secrets are read

Nothing changes in your code. User secrets are just another configuration source, loaded after the environment file and **only in Development**. `_config["Stripe:SecretKey"]` and `IOptions<StripeSettings>` work exactly as before. The value simply comes from the secrets file instead of `appsettings.json`.

Keep the non secret parts of a section in `appsettings.json` and only the secret keys in user secrets. The two merge into one section.

## Secrets in production

User secrets are for development only. They are not encrypted and they do not exist on a server. In production, use one of these:

- **Environment variables** on the host. `ConnectionStrings__Default` overrides the connection string. Every hosting platform supports this and it is the most common choice.
- **Azure Key Vault** or an equivalent secret store, added as a configuration source. Secrets are encrypted, access is audited, and rotation does not need a redeploy.
- **Platform settings pages** such as Azure App Service application settings, which are environment variables under the hood.

Your code still reads `IConfiguration`. Only the source changes.

## A checklist for a new project

1. Run `dotnet user-secrets init`.
2. Add a `.gitignore` entry for `appsettings.*.local.json` if your team uses local override files.
3. Keep `appsettings.json` full of safe defaults and placeholder values such as `"Password": ""`.
4. Put real development secrets in user secrets.
5. Document which keys production must supply, so whoever deploys knows what to set.

## Quick recap

- `ASPNETCORE_ENVIRONMENT` names the environment, and `launchSettings.json` sets it to Development locally.
- `appsettings.{Environment}.json` overrides `appsettings.json` for that environment only.
- Use `app.Environment.IsDevelopment()` in `Program.cs` and the `<environment>` tag helper in views to branch.
- Secrets never go in committed files.
- `dotnet user-secrets` stores development secrets outside the project and merges them into configuration automatically.
- In production, supply secrets through environment variables or a secret store such as Azure Key Vault.

<code id="code-content" class="language-csharp">
// Properties/launchSettings.json
//
//   {
//     "profiles": {
//       "ShopApp": {
//         "commandName": "Project",
//         "launchBrowser": true,
//         "applicationUrl": "https://localhost:7001;http://localhost:5001",
//         "environmentVariables": { "ASPNETCORE_ENVIRONMENT": "Development" }
//       }
//     }
//   }

// appsettings.json (safe to commit: no secrets, placeholder values)
//
//   {
//     "ConnectionStrings": { "Default": "" },
//     "Stripe": { "PublishableKey": "pk_test_public", "SecretKey": "" },
//     "Logging": { "LogLevel": { "Default": "Warning" } }
//   }

// appsettings.Development.json (safe to commit)
//
//   {
//     "Logging": {
//       "LogLevel": {
//         "Default": "Information",
//         "Microsoft.EntityFrameworkCore.Database.Command": "Information"
//       }
//     }
//   }

// Terminal: development secrets (stored outside the repo)
//
//   dotnet user-secrets init
//   dotnet user-secrets set "ConnectionStrings:Default" "Server=(localdb)\\mssqllocaldb;Database=ShopApp;Trusted_Connection=True"
//   dotnet user-secrets set "Stripe:SecretKey" "sk_test_51Hxxxxx"
//   dotnet user-secrets list

// Production: environment variables on the server
//
//   ASPNETCORE_ENVIRONMENT=Production
//   ConnectionStrings__Default="Server=prod-sql;Database=ShopApp;User Id=app;Password=..."
//   Stripe__SecretKey="sk_live_..."

// Settings/StripeSettings.cs
public class StripeSettings
{
    public string PublishableKey { get; set; } = "";
    public string SecretKey { get; set; } = "";
}

// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt;
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

// Stripe:SecretKey comes from user secrets in Development and from an
// environment variable in Production. The code does not care which.
builder.Services.Configure&lt;StripeSettings&gt;(builder.Configuration.GetSection("Stripe"));

if (builder.Environment.IsEnvironment("QA"))
{
    builder.Services.AddSingleton&lt;IPaymentGateway, FakePaymentGateway&gt;();
}
else
{
    builder.Services.AddSingleton&lt;IPaymentGateway, StripePaymentGateway&gt;();
}

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
app.Run();

// Controllers/HomeController.cs
public class HomeController : Controller
{
    private readonly IWebHostEnvironment _env;
    public HomeController(IWebHostEnvironment env) =&gt; _env = env;

    public IActionResult Index()
    {
        ViewData["Banner"] = _env.IsProduction() ? null : $"Running in {_env.EnvironmentName}";
        return View();
    }
}
</code></pre>
