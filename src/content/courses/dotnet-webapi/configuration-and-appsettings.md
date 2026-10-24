---
publishDate: 2026-09-14T13:40
title: Configuration and appsettings.json
slug: configuration-and-appsettings
metadescription: Read settings from appsettings.json, environment variables and the command line, understand how the layers override each other, and bind values to typed options classes.
updateDate: 2026-09-07T13:40
author: ['bishal-biswas']
level: 2
tags: ['configuration', 'options', 'appsettings']
course: dotnet-webapi
---

## Configuration is layered

ASP.NET Core does not read one file. It reads several **sources** in order, and each one overrides the one before it.

`WebApplication.CreateBuilder(args)` sets up this chain:

1. `appsettings.json`
2. `appsettings.{Environment}.json`
3. User secrets, in development only
4. Environment variables
5. Command line arguments

Later wins. So a value in `appsettings.json` can be replaced by `appsettings.Production.json`, which can be replaced by an environment variable, which can be replaced by a command line switch.

This ordering is the whole design. Safe defaults live in source control, and each deployment overrides what it needs to.

## Reading values

The simplest form uses a colon to walk into nested sections:

```json
{
  "Api": {
    "Title": "BookStore API",
    "MaxPageSize": 100,
    "Features": {
      "EnableExport": true
    }
  }
}
```

```csharp
string? title = builder.Configuration["Api:Title"];
int maxPage = builder.Configuration.GetValue<int>("Api:MaxPageSize");
bool export = builder.Configuration.GetValue("Api:Features:EnableExport", false);
```

`GetValue<T>` converts the string for you and takes an optional default.

Connection strings have a shortcut, because they are so common:

```csharp
string? cs = builder.Configuration.GetConnectionString("Default");
// the same as builder.Configuration["ConnectionStrings:Default"]
```

## Do not do this everywhere

Reading magic strings around your codebase is the thing to avoid:

```csharp
public class ExportService
{
    private readonly IConfiguration config;

    public void Export()
    {
        int max = config.GetValue<int>("Api:MaxPageSize");   // typo here fails silently
    }
}
```

A typo gives you `0` and no error. There is no way to see what settings the class needs without reading its body. Bind to a class instead.

## The options pattern

Define a class that mirrors the section:

```csharp
public class ApiOptions
{
    public const string SectionName = "Api";

    public string Title { get; set; } = "";
    public int MaxPageSize { get; set; } = 20;
    public FeatureOptions Features { get; set; } = new();
}

public class FeatureOptions
{
    public bool EnableExport { get; set; }
}
```

Bind it once at startup:

```csharp
builder.Services.Configure<ApiOptions>(
    builder.Configuration.GetSection(ApiOptions.SectionName));
```

Then inject it anywhere:

```csharp
public class ExportService
{
    private readonly ApiOptions options;

    public ExportService(IOptions<ApiOptions> options) => this.options = options.Value;

    public void Export()
    {
        int max = options.MaxPageSize;      // typed, discoverable, no magic strings
    }
}
```

Binding is case insensitive and matches on property names. Nested classes bind to nested sections automatically.

## The three options interfaces

The one you inject changes the behaviour, so choose deliberately.

**`IOptions<T>`** is a singleton, read once when the app starts. Values never change afterwards. Use for anything that is fixed for the life of the process, which is most settings.

**`IOptionsSnapshot<T>`** is scoped, recomputed once per request. If `appsettings.json` changes on disk, the next request sees the new value. Cannot be injected into a singleton.

**`IOptionsMonitor<T>`** is a singleton that always exposes the current value and can notify you when it changes:

```csharp
public class FeatureService
{
    private readonly IOptionsMonitor<ApiOptions> monitor;

    public FeatureService(IOptionsMonitor<ApiOptions> monitor)
    {
        this.monitor = monitor;

        monitor.OnChange(updated =>
            Console.WriteLine($"Config reloaded, MaxPageSize is now {updated.MaxPageSize}"));
    }

    public bool ExportEnabled => monitor.CurrentValue.Features.EnableExport;
}
```

Use `IOptionsMonitor` for a singleton that needs live values, such as a feature flag read on every request.

## Validate at startup

A missing or nonsensical setting should stop the app immediately, not fail on the first request that needs it:

```csharp
public class SmtpOptions
{
    public const string SectionName = "Smtp";

    [Required(AllowEmptyStrings = false)]
    public string Host { get; set; } = "";

    [Range(1, 65535)]
    public int Port { get; set; }

    [Required, EmailAddress]
    public string FromAddress { get; set; } = "";
}
```

```csharp
builder.Services.AddOptions<SmtpOptions>()
    .Bind(builder.Configuration.GetSection(SmtpOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
```

`ValidateOnStart` is the important part. Without it, validation runs the first time the options are resolved, which might be hours after deployment.

For rules attributes cannot express:

```csharp
builder.Services.AddOptions<SmtpOptions>()
    .Bind(builder.Configuration.GetSection(SmtpOptions.SectionName))
    .Validate(o => o.Port != 25 || o.Host == "localhost",
              "Port 25 is only allowed for localhost.")
    .ValidateOnStart();
```

## Environment variables

Environment variables are how production configuration usually arrives, because they work in every hosting platform and keep secrets out of files.

The colon in a configuration key becomes a **double underscore** in an environment variable name:

```bash
export ConnectionStrings__Default="Server=prod;Database=BookStore;..."
export Api__MaxPageSize=50
export Api__Features__EnableExport=true
```

On Windows PowerShell:

```bash
$env:Api__MaxPageSize = "50"
```

Double underscore works on every platform. A single colon works on Windows but not on Linux, so always use the double underscore.

## Command line arguments

Useful for one off overrides and for containers:

```bash
dotnet run --Api:MaxPageSize=200 --urls "http://localhost:5001"
```

These override everything else, which is what you want for a temporary change.

## Adding your own sources

The builder exposes the source list, so you can add to it:

```csharp
builder.Configuration
    .AddJsonFile("features.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables(prefix: "BOOKSTORE_");
```

The prefix option is handy on a shared machine. With it, `BOOKSTORE_Api__MaxPageSize` is read and the prefix is stripped.

Order matters here too. Anything added later wins.

## Reading a whole section as a list

Arrays bind naturally:

```json
{
  "Cors": {
    "AllowedOrigins": [
      "https://app.example.com",
      "https://admin.example.com"
    ]
  }
}
```

```csharp
string[] origins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? Array.Empty<string>();
```

In an environment variable, an array index is part of the key:

```bash
export Cors__AllowedOrigins__0="https://app.example.com"
export Cors__AllowedOrigins__1="https://admin.example.com"
```

## What not to put in appsettings.json

Anything secret. Database passwords, API keys, JWT signing keys, connection strings with credentials.

These files are committed to source control, and once a secret is in git history it is effectively public. The next topic covers user secrets and the production alternatives properly. Until then, the rule is simple: if leaking it would be bad, it does not go in `appsettings.json`.

## Debugging configuration

When a value is not what you expect, print the whole resolved tree. `IConfigurationRoot` has a debug view:

```csharp
if (app.Environment.IsDevelopment())
{
    app.MapGet("/debug/config", (IConfiguration config) =>
        ((IConfigurationRoot)config).GetDebugView());
}
```

It shows every key, its value and **which provider supplied it**, which is exactly the information you need when a layer is overriding something unexpectedly.

Guard it behind a development check. It prints secrets.

## Quick recap

- Configuration is layered: JSON, environment specific JSON, user secrets, environment variables, command line. Later wins.
- `Configuration["Section:Key"]` reads a value, and `GetConnectionString` is a shortcut for connection strings.
- Avoid magic strings in your services. Bind a typed options class instead.
- `IOptions<T>` is fixed at startup, `IOptionsSnapshot<T>` is per request, `IOptionsMonitor<T>` gives a singleton live values.
- Validate options with `ValidateDataAnnotations().ValidateOnStart()` so bad configuration fails immediately.
- In environment variables, a colon becomes a double underscore, which works on every platform.
- Arrays bind by index, both in JSON and in environment variables.
- Never put secrets in `appsettings.json`.
- `GetDebugView()` shows every key and which provider supplied it.

<code id="code-content" class="language-csharp">
// Configuration and the options pattern, set up the way a real API does it.
using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Options;
var builder = WebApplication.CreateBuilder(args);
// CreateBuilder already added: appsettings.json, appsettings.{Environment}.json,
// user secrets (development), environment variables, command line. Later wins.
// Add your own sources on top if you need them.
builder.Configuration
    .AddJsonFile("features.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables(prefix: "BOOKSTORE_");
// Bind and validate. ValidateOnStart means bad config fails the deploy, not the
// first request that happens to need it three hours later.
builder.Services.AddOptions&lt;ApiOptions&gt;()
    .Bind(builder.Configuration.GetSection(ApiOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddOptions&lt;SmtpOptions&gt;()
    .Bind(builder.Configuration.GetSection(SmtpOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(o =&gt; o.Port != 25 || o.Host == "localhost",   // a rule attributes cannot express
              "Port 25 is only allowed for localhost.")
    .ValidateOnStart();
string connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured.");
string[] allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins").Get&lt;string[]&gt;() ?? Array.Empty&lt;string&gt;();
builder.Services.AddCors(o =&gt; o.AddDefaultPolicy(p =&gt; p.WithOrigins(allowedOrigins)));
builder.Services.AddSingleton&lt;FeatureService&gt;();
var app = builder.Build();
app.UseCors();
// Every key, its value, and which provider supplied it. Prints secrets, so
// development only.
if (app.Environment.IsDevelopment())
{
    app.MapGet("/debug/config", (IConfiguration config) =&gt;
        Results.Text(((IConfigurationRoot)config).GetDebugView(), "text/plain"));
}
// IOptions&lt;T&gt;: read once at startup. Right for settings that never change.
app.MapGet("/api/info", (IOptions&lt;ApiOptions&gt; options) =&gt; Results.Ok(new
{
    options.Value.Title,
    options.Value.MaxPageSize,
    options.Value.Features.EnableExport
}));
// IOptionsSnapshot&lt;T&gt;: recomputed per request, so an edit to appsettings.json
// takes effect on the next call with no restart. Scoped, so not usable in a singleton.
app.MapGet("/api/page-size", (IOptionsSnapshot&lt;ApiOptions&gt; snapshot) =&gt;
    Results.Ok(new { current = snapshot.Value.MaxPageSize }));
// IOptionsMonitor&lt;T&gt;, injected into a singleton below
app.MapGet("/api/features", (FeatureService features) =&gt;
    Results.Ok(new { export = features.ExportEnabled }));
app.Run();
// ---------- Typed options: discoverable, validated, no magic strings
public class ApiOptions
{
    public const string SectionName = "Api";
    [Required(AllowEmptyStrings = false)]
    public string Title { get; set; } = "";
    [Range(1, 500)]
    public int MaxPageSize { get; set; } = 20;
    public FeatureOptions Features { get; set; } = new();   // binds the nested section
}
public class FeatureOptions
{
    public bool EnableExport { get; set; }
    public bool EnableBetaSearch { get; set; }
}
public class SmtpOptions
{
    public const string SectionName = "Smtp";
    [Required(AllowEmptyStrings = false)] public string Host { get; set; } = "";
    [Range(1, 65535)]                     public int Port { get; set; } = 587;
    [Required, EmailAddress]              public string FromAddress { get; set; } = "";
    // The password does NOT belong in appsettings.json. It arrives from user secrets
    // in development and from an environment variable or a vault in production.
    public string Password { get; set; } = "";
}
// A singleton that needs live values uses IOptionsMonitor, never IOptionsSnapshot
public class FeatureService
{
    private readonly IOptionsMonitor&lt;ApiOptions&gt; monitor;
    public FeatureService(IOptionsMonitor&lt;ApiOptions&gt; monitor, ILogger&lt;FeatureService&gt; logger)
    {
        this.monitor = monitor;
        monitor.OnChange(updated =&gt;
            logger.LogInformation("Configuration reloaded. Export is now {Enabled}",
                                  updated.Features.EnableExport));
    }
    public bool ExportEnabled =&gt; monitor.CurrentValue.Features.EnableExport;
}
/* appsettings.json
{
  "ConnectionStrings": { "Default": "Server=localhost;Database=BookStore;Trusted_Connection=True" },
  "Api": {
    "Title": "BookStore API",
    "MaxPageSize": 100,
    "Features": { "EnableExport": true, "EnableBetaSearch": false }
  },
  "Smtp": { "Host": "smtp.example.com", "Port": 587, "FromAddress": "noreply@example.com" },
  "Cors": { "AllowedOrigins": [ "https://app.example.com", "https://admin.example.com" ] }
}
   Overriding in production, where a colon becomes a double underscore:
     ConnectionStrings__Default="Server=prod;..."
     Api__MaxPageSize=50
     Api__Features__EnableExport=false
     Cors__AllowedOrigins__0="https://app.example.com"
*/
</code></pre>
