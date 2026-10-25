---
publishDate: 2026-08-19T12:00
title: Configuration and appsettings.json
slug: configuration-and-appsettings
metadescription: Read settings from appsettings.json with IConfiguration, understand the layered sources that override each other, bind sections to strongly typed classes with the options pattern, and validate settings at startup.
updateDate: 2026-09-14T12:00
author: ['bishal-biswas']
level: 2
tags: ['configuration', 'appsettings', 'options-pattern']
course: dotnet-mvc
---

## Settings live outside the code

A connection string, an API key, the name of the mail server, how many items to show per page. These are all things that change between your laptop, the test server and production. Putting them in C# means recompiling to change them. Putting them in a configuration file means editing a file or setting an environment variable.

ASP.NET Core has one system for this, called **configuration**, and `appsettings.json` is its most visible part.

## The file

```json
{
  "ConnectionStrings": {
    "Default": "Server=(localdb)\\mssqllocaldb;Database=ShopApp;Trusted_Connection=True"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  },
  "Shop": {
    "Name": "The Keyboard Store",
    "PageSize": 20,
    "SupportEmail": "help@shop.com"
  },
  "Smtp": {
    "Host": "smtp.example.com",
    "Port": 587
  }
}
```

It is plain JSON. Nested objects create sections. There is nothing special about `Shop` or `Smtp`; you can add any section you like.

## Reading a value

`IConfiguration` is available everywhere through dependency injection. Keys use a colon to walk into sections:

```csharp
public class HomeController : Controller
{
    private readonly IConfiguration _config;

    public HomeController(IConfiguration config)
    {
        _config = config;
    }

    public IActionResult Index()
    {
        var name = _config["Shop:Name"];
        var pageSize = _config.GetValue<int>("Shop:PageSize");
        var connection = _config.GetConnectionString("Default");

        return Content($"{name} shows {pageSize} items");
    }
}
```

`_config["key"]` always returns a string, or `null` if missing. `GetValue<T>` converts to a type. `GetConnectionString` is a shortcut for `ConnectionStrings:Name`.

In `Program.cs` the same object is `builder.Configuration`.

## Where values come from

`appsettings.json` is only one source. The default setup reads from several, and **later sources override earlier ones**:

1. `appsettings.json`
2. `appsettings.{Environment}.json`, such as `appsettings.Development.json`
3. User secrets, in development only
4. Environment variables
5. Command line arguments

This layering is the whole point. `appsettings.json` holds defaults that are safe to commit. `appsettings.Production.json` holds production differences. Environment variables on the server hold secrets. Each layer only needs the keys it changes.

An environment variable overrides `Shop:PageSize` with a double underscore in place of the colon, because some shells do not allow colons in variable names:

```bash
Shop__PageSize=50
```

## Strongly typed settings

Reading strings by key works, but a typo in `"Shop:PgeSize"` is only found at runtime. The **options pattern** binds a section to a class so you get properties and compile time checks:

```csharp
public class ShopSettings
{
    public string Name { get; set; } = "";
    public int PageSize { get; set; } = 10;
    public string SupportEmail { get; set; } = "";
}
```

Register the binding in `Program.cs`:

```csharp
builder.Services.Configure<ShopSettings>(builder.Configuration.GetSection("Shop"));
```

Then ask for `IOptions<ShopSettings>` wherever you need it:

```csharp
public class ProductsController : Controller
{
    private readonly ShopSettings _shop;

    public ProductsController(IOptions<ShopSettings> options)
    {
        _shop = options.Value;
    }
}
```

Property names must match the JSON keys, case insensitive. Numbers and booleans convert automatically. A key that is missing leaves the property at its default.

## IOptions, IOptionsSnapshot and IOptionsMonitor

There are three flavours:

| Interface | When it reads the settings | Lifetime |
| --- | --- | --- |
| `IOptions<T>` | Once, at first use | Singleton |
| `IOptionsSnapshot<T>` | Once per request | Scoped |
| `IOptionsMonitor<T>` | Live, with change notifications | Singleton |

`IOptions<T>` is right most of the time. Use `IOptionsSnapshot<T>` if you edit `appsettings.json` while the app is running and want the next request to see the change, which the default file source supports through `reloadOnChange`. `IOptionsMonitor<T>` is for singletons that need the latest values.

## Validating settings at startup

A wrong setting is best discovered when the app starts, not when the first user hits the feature. Add data annotations to the class and ask for validation:

```csharp
public class SmtpSettings
{
    [Required]
    public string Host { get; set; } = "";

    [Range(1, 65535)]
    public int Port { get; set; }
}
```

```csharp
builder.Services.AddOptions<SmtpSettings>()
    .Bind(builder.Configuration.GetSection("Smtp"))
    .ValidateDataAnnotations()
    .ValidateOnStart();
```

With `ValidateOnStart`, a missing `Host` stops the app from starting with a clear error rather than failing during the first email.

## Binding directly

For code in `Program.cs` that needs a settings object right away, bind without DI:

```csharp
var shop = builder.Configuration.GetSection("Shop").Get<ShopSettings>();
```

Or bind into an existing instance with `Bind`.

## Adding your own source

The default sources cover nearly everything. If you need another, such as a JSON file in a custom location or Azure Key Vault, add it to the builder:

```csharp
builder.Configuration.AddJsonFile("features.json", optional: true, reloadOnChange: true);
```

Order matters. Sources added later override sources added earlier.

## What not to put in appsettings.json

Anything secret. The file is committed to source control and readable by everyone with access to the repository. API keys, passwords and production connection strings belong in user secrets during development and in environment variables or a secret store in production. The next topic covers exactly this.

## Quick recap

- `appsettings.json` holds settings as nested JSON, read through `IConfiguration` with colon separated keys.
- Sources layer on top of each other: base file, environment file, user secrets, environment variables, command line.
- Bind a section to a class with `Configure<T>` and inject `IOptions<T>` for typed, checked access.
- Use `IOptionsSnapshot<T>` for per request reloads and `IOptionsMonitor<T>` for live updates in singletons.
- Validate settings with data annotations and `ValidateOnStart` so bad configuration fails fast.
- Never commit secrets in `appsettings.json`.

<code id="code-content" class="language-csharp">
// appsettings.json
//
//   {
//     "ConnectionStrings": { "Default": "Server=(localdb)\\mssqllocaldb;Database=ShopApp;Trusted_Connection=True" },
//     "Shop": { "Name": "The Keyboard Store", "PageSize": 20, "SupportEmail": "help@shop.com" },
//     "Smtp": { "Host": "smtp.example.com", "Port": 587, "UseSsl": true }
//   }

// Settings/ShopSettings.cs
using System.ComponentModel.DataAnnotations;

public class ShopSettings
{
    [Required]
    public string Name { get; set; } = "";

    [Range(5, 100)]
    public int PageSize { get; set; } = 10;

    [EmailAddress]
    public string SupportEmail { get; set; } = "";
}

// Settings/SmtpSettings.cs
public class SmtpSettings
{
    [Required]
    public string Host { get; set; } = "";

    [Range(1, 65535)]
    public int Port { get; set; } = 25;

    public bool UseSsl { get; set; }
}

// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();

builder.Services.AddOptions&lt;ShopSettings&gt;()
    .Bind(builder.Configuration.GetSection("Shop"))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddOptions&lt;SmtpSettings&gt;()
    .Bind(builder.Configuration.GetSection("Smtp"))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt;
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

var app = builder.Build();
app.UseStaticFiles();
app.UseRouting();
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
app.Run();

// Controllers/ProductsController.cs
public class ProductsController : Controller
{
    private readonly AppDbContext _db;
    private readonly ShopSettings _shop;

    public ProductsController(AppDbContext db, IOptions&lt;ShopSettings&gt; shopOptions)
    {
        _db = db;
        _shop = shopOptions.Value;
    }

    public async Task&lt;IActionResult&gt; Index(int page = 1)
    {
        var products = await _db.Products
            .OrderBy(p =&gt; p.Name)
            .Skip((page - 1) * _shop.PageSize)
            .Take(_shop.PageSize)
            .ToListAsync();

        ViewData["Title"] = _shop.Name;
        return View(products);
    }
}

// Views/Shared/_Layout.cshtml (reading settings in a view)
//
//   @inject IOptions&lt;ShopSettings&gt; ShopOptions
//   &lt;footer&gt;
//       @ShopOptions.Value.Name. Need help? &lt;a href="mailto:@ShopOptions.Value.SupportEmail"&gt;Email us&lt;/a&gt;
//   &lt;/footer&gt;

// Overriding a value with an environment variable (double underscore for nesting)
//
//   Shop__PageSize=50
//   ConnectionStrings__Default="Server=prod-sql;Database=ShopApp;User Id=app;Password=..."
</code></pre>
