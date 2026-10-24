---
publishDate: 2026-09-14T13:50
title: Environments and User Secrets
slug: environments-and-user-secrets
metadescription: Use ASPNETCORE_ENVIRONMENT to change behaviour per environment, keep secrets out of source control with the user secrets tool, and learn the production alternatives.
updateDate: 2026-09-07T13:50
author: ['bishal-biswas']
level: 2
tags: ['environments', 'secrets', 'security']
course: dotnet-webapi
---

## What an environment is

An **environment** is a named mode your app runs in. ASP.NET Core reads it from one environment variable:

```bash
ASPNETCORE_ENVIRONMENT=Development
```

Three names are built in: `Development`, `Staging` and `Production`. If the variable is not set at all, the app assumes **Production**, which is the safe default.

The environment does two things. It selects which `appsettings.{Environment}.json` file is layered on top of the base file, and it lets your code branch.

## Checking the environment in code

```csharp
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
}
```

The helpers are `IsDevelopment()`, `IsStaging()`, `IsProduction()`, and `IsEnvironment("QA")` for custom names.

Use the environment for things that are genuinely about the environment: showing detailed errors, enabling Swagger, seeding test data. Do not use it for business rules. `if (env.IsProduction())` around a pricing decision means your production behaviour is never tested anywhere else.

## Environment specific settings files

```text
appsettings.json                  base values, always loaded
appsettings.Development.json      layered on top in Development
appsettings.Staging.json          layered on top in Staging
appsettings.Production.json       layered on top in Production
```

Only the base file and the current environment's file are read. They **merge** key by key, so the environment file only needs the values that differ:

```json
// appsettings.json
{
  "Logging": { "LogLevel": { "Default": "Warning" } },
  "Api": { "MaxPageSize": 100, "BaseUrl": "https://api.example.com" }
}
```

```json
// appsettings.Development.json
{
  "Logging": { "LogLevel": { "Default": "Debug" } },
  "Api": { "BaseUrl": "https://localhost:7139" }
}
```

In development the log level is `Debug` and the base URL is localhost. `MaxPageSize` stays `100`, because the development file does not mention it.

One trap: arrays do not merge, they replace. If the base file has three allowed origins and the environment file has one, you get one.

## Setting the environment

**Locally**, `launchSettings.json` sets it:

```json
{
  "profiles": {
    "https": {
      "commandName": "Project",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}
```

**From the terminal:**

```bash
export ASPNETCORE_ENVIRONMENT=Staging
dotnet run
```

**In Docker:**

```bash
docker run -e ASPNETCORE_ENVIRONMENT=Production myapi
```

Remember that `launchSettings.json` is not deployed. In production the hosting platform sets the variable, or nothing does and you get Production by default.

## Why secrets cannot live in appsettings.json

`appsettings.json` is committed to git. A password in it is a password in your repository history, visible to everyone with access, forever, even after you delete the line.

This is the single most common way credentials leak. It is worth being strict about.

## User secrets, for development

The .NET SDK has a tool that stores development secrets **outside** your project folder, so they cannot be committed by accident.

Enable it once per project:

```bash
dotnet user-secrets init
```

This adds a `UserSecretsId` to your `.csproj`:

```xml
<PropertyGroup>
  <UserSecretsId>a1b2c3d4-5678-90ab-cdef-1234567890ab</UserSecretsId>
</PropertyGroup>
```

Then set values:

```bash
dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost;Database=Shop;User Id=sa;Password=RealPassword123"
dotnet user-secrets set "Jwt:Key" "a-development-signing-key-at-least-32-chars"
dotnet user-secrets set "Smtp:Password" "dev-mail-password"
```

List, remove and clear:

```bash
dotnet user-secrets list
dotnet user-secrets remove "Smtp:Password"
dotnet user-secrets clear
```

The values land in a JSON file in your user profile:

```text
Windows   %APPDATA%\Microsoft\UserSecrets\<UserSecretsId>\secrets.json
Linux     ~/.microsoft/usersecrets/<UserSecretsId>/secrets.json
macOS     ~/.microsoft/usersecrets/<UserSecretsId>/secrets.json
```

Two things to understand. The file is **not encrypted**, it is just outside the repository, so this protects against accidental commits, not against someone with access to your machine. And it is loaded **only in Development**, so it can never accidentally supply a value in production.

Reading them needs no code change. They are just another configuration layer:

```csharp
string? cs = builder.Configuration.GetConnectionString("Default");
```

## Keeping the shape visible

If secrets are invisible, a new teammate does not know what to set. Keep the **keys** in `appsettings.json` with empty values:

```json
{
  "ConnectionStrings": {
    "Default": ""
  },
  "Jwt": {
    "Issuer": "BookStoreApi",
    "Audience": "BookStoreClients",
    "Key": ""
  }
}
```

The structure is documented, no secret is committed, and validation with `ValidateOnStart` fails loudly if someone forgets to fill one in.

## Production secrets

User secrets are development only. Production has better options, in rough order of preference.

**A managed secret store.** Azure Key Vault, AWS Secrets Manager, HashiCorp Vault. Secrets are versioned, access is audited, and rotation is possible. Azure Key Vault plugs straight into configuration:

```bash
dotnet add package Azure.Extensions.AspNetCore.Configuration.Secrets
dotnet add package Azure.Identity
```

```csharp
if (builder.Environment.IsProduction())
{
    builder.Configuration.AddAzureKeyVault(
        new Uri($"https://{builder.Configuration["KeyVault:Name"]}.vault.azure.net/"),
        new DefaultAzureCredential());
}
```

A key vault secret named `ConnectionStrings--Default` becomes `ConnectionStrings:Default` in configuration. Double dash, because a colon is not allowed in a secret name.

**Environment variables**, set by the hosting platform. Every platform supports them, and they never touch your source:

```bash
ConnectionStrings__Default="Server=prod;..."
Jwt__Key="the-production-signing-key"
```

Simple and universal. The weakness is that they are visible to anything that can read the process environment, and rotating them means a restart.

**Managed identity**, which is better than a secret because there is no secret at all. Your app authenticates to the database or storage account as itself, with no password anywhere:

```text
Server=tcp:myserver.database.windows.net;Database=Shop;Authentication=Active Directory Default;
```

If your platform supports it, this is the strongest option available.

Never bake secrets into a Docker image. Image layers are readable by anyone who can pull the image.

## What to do if a secret leaks

Assume it is compromised the moment it is pushed. Removing the line and committing again does nothing, because it is still in the history.

Rotate the credential first. That is the only step that actually protects you. Then clean the history with a tool such as `git filter-repo` if the repository is private, and force push. If the repository is public, treat the secret as public regardless.

## A quick checklist

Before the first deployment:

- No real password appears in any committed file.
- `dotnet user-secrets list` shows every secret needed locally.
- Empty placeholder keys exist in `appsettings.json` so the shape is documented.
- Options are validated with `ValidateOnStart`, so a missing secret fails the deploy.
- `ASPNETCORE_ENVIRONMENT` is set correctly on every environment.
- Swagger and detailed errors are behind an `IsDevelopment()` check.

## Quick recap

- `ASPNETCORE_ENVIRONMENT` names the environment. Unset means Production, which is the safe default.
- The environment selects which `appsettings.{Environment}.json` layers on top of the base file, merging key by key.
- Arrays replace rather than merge across those files.
- Use the environment for diagnostics and tooling, not for business rules.
- `dotnet user-secrets` stores development secrets outside the project so they cannot be committed.
- User secrets are unencrypted and load only in Development. They prevent accidents, not intrusion.
- Keep empty placeholder keys in `appsettings.json` so teammates know what to set.
- In production use a managed secret store, or environment variables, or best of all a managed identity with no secret at all.
- A leaked secret must be rotated. Deleting the line does not remove it from git history.

<code id="code-content" class="language-csharp">
// Program.cs - environments, secrets, and behaviour that changes per environment.
using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Options;
var builder = WebApplication.CreateBuilder(args);
// Development:
//   dotnet user-secrets init
//   dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost;..."
//   dotnet user-secrets set "Jwt:Key" "a-development-signing-key-at-least-32-chars"
//   Stored outside the project, loaded only in Development.
//
// Production: environment variables set by the host, a key vault, or a managed identity.
//   ConnectionStrings__Default="Server=prod;..."     (colon becomes double underscore)
if (builder.Environment.IsProduction())
{
    // Secrets named ConnectionStrings--Default become ConnectionStrings:Default
    // builder.Configuration.AddAzureKeyVault(
    //     new Uri($"https://{builder.Configuration["KeyVault:Name"]}.vault.azure.net/"),
    //     new DefaultAzureCredential());
}
// Validated at startup, so a missing secret fails the deploy instead of the
// first request that needs it.
builder.Services.AddOptions&lt;JwtOptions&gt;()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
string connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException(
        "ConnectionStrings:Default is missing. In development run: dotnet user-secrets set ...");
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
var app = builder.Build();
// ---------- Behaviour that genuinely belongs to the environment
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();     // full stack traces: never in production
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseExceptionHandler("/error");   // a safe, generic error response
    app.UseHsts();                       // tells browsers to stick to HTTPS
}
if (app.Environment.IsStaging())
{
    // Staging often wants Swagger but with production style error handling
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseHttpsRedirection();
app.MapControllers();
// Useful after a deploy: confirms which environment the process actually thinks it is in
app.MapGet("/api/environment", (IWebHostEnvironment env, IOptions&lt;JwtOptions&gt; jwt) =&gt; Results.Ok(new
{
    Environment  = env.EnvironmentName,
    IsProduction = env.IsProduction(),
    JwtIssuer    = jwt.Value.Issuer,
    // Report only that the secret is present, never the value itself
    JwtKeyLoaded = !string.IsNullOrEmpty(jwt.Value.Key)
}));
app.Run();
public class JwtOptions
{
    public const string SectionName = "Jwt";
    [Required] public string Issuer { get; set; } = "";
    [Required] public string Audience { get; set; } = "";
    // Committed as "" in appsettings.json so the shape is documented.
    // The real value comes from user secrets locally and from the host in production.
    [Required(AllowEmptyStrings = false, ErrorMessage = "Jwt:Key is not configured.")]
    [MinLength(32, ErrorMessage = "Jwt:Key must be at least 32 characters.")]
    public string Key { get; set; } = "";
}
/* appsettings.json  - committed. Structure documented, no secrets.
{
  "ConnectionStrings": { "Default": "" },
  "Jwt": { "Issuer": "BookStoreApi", "Audience": "BookStoreClients", "Key": "" },
  "Logging": { "LogLevel": { "Default": "Warning" } }
}
   appsettings.Development.json - committed. Only what differs locally.
{
  "Logging": { "LogLevel": { "Default": "Debug", "Microsoft.AspNetCore": "Information" } }
}
   secrets.json (user secrets, NOT in the repository, Development only)
{
  "ConnectionStrings:Default": "Server=localhost;Database=Shop;User Id=sa;Password=Local123",
  "Jwt:Key": "a-development-signing-key-at-least-32-chars"
}
*/
</code></pre>
