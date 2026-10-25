---
publishDate: 2026-09-10T12:20
title: Entity Framework Core Setup
slug: entity-framework-core-setup
metadescription: Install EF Core, choose a database provider, register your DbContext with a connection string, and understand the service lifetime and pooling choices that matter.
updateDate: 2026-09-07T12:20
author: ['bishal-biswas']
level: 2
tags: ['ef-core', 'database', 'setup']
course: dotnet-webapi
---

## What EF Core does

**Entity Framework Core** is an ORM, an Object Relational Mapper. It lets you work with database rows as C# objects, and turns your LINQ queries into SQL.

Without it you write this:

```csharp
using var connection = new SqlConnection(connectionString);
using var command = new SqlCommand("SELECT Id, Title, Year FROM Books WHERE Year > @year", connection);
command.Parameters.AddWithValue("@year", 2000);
await connection.OpenAsync();
using var reader = await command.ExecuteReaderAsync();
var books = new List<Book>();
while (await reader.ReadAsync())
{
    books.Add(new Book
    {
        Id = reader.GetInt32(0),
        Title = reader.GetString(1),
        Year = reader.GetInt32(2)
    });
}
```

With it you write this:

```csharp
var books = await db.Books.Where(b => b.Year > 2000).ToListAsync();
```

Both run the same query. The second is the one you want to maintain.

## Installing the packages

You need two things: the EF Core tools and a **provider** for your database.

For SQL Server:

```bash
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet add package Microsoft.EntityFrameworkCore.Design
```

For PostgreSQL:

```bash
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add package Microsoft.EntityFrameworkCore.Design
```

For SQLite, which is perfect while learning because it needs no server at all:

```bash
dotnet add package Microsoft.EntityFrameworkCore.Sqlite
dotnet add package Microsoft.EntityFrameworkCore.Design
```

`Microsoft.EntityFrameworkCore.Design` is what the `dotnet ef` command needs. Without it, migrations fail with a confusing message about a missing design time service.

Install the CLI tool once per machine:

```bash
dotnet tool install --global dotnet-ef
```

## The DbContext

A `DbContext` is your session with the database. Each `DbSet<T>` on it is a table.

```csharp
using Microsoft.EntityFrameworkCore;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Book> Books => Set<Book>();
    public DbSet<Author> Authors => Set<Author>();
}
```

The constructor taking `DbContextOptions` is how dependency injection passes in the connection string and provider. Always include it.

`=> Set<Book>()` is the modern style. The older `public DbSet<Book> Books { get; set; }` works too, but it needs a null forgiving `= null!;` under nullable reference types, so the expression body is cleaner.

## The connection string

Put it in `appsettings.json` under `ConnectionStrings`:

```json
{
  "ConnectionStrings": {
    "Default": "Server=localhost;Database=BookStore;Trusted_Connection=True;TrustServerCertificate=True"
  }
}
```

Some examples for other providers:

```text
SQLite      Data Source=bookstore.db
PostgreSQL  Host=localhost;Database=bookstore;Username=postgres;Password=dev
SQL Server  Server=localhost;Database=BookStore;User Id=sa;Password=dev;TrustServerCertificate=True
```

A connection string with a real password does **not** belong in `appsettings.json`. Locally, use user secrets. In production, use environment variables or a secrets service. There is a whole topic on this, and it is worth reading before you deploy anything.

## Registering the DbContext

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
```

Swap the provider method for your database:

```csharp
options.UseSqlite(builder.Configuration.GetConnectionString("Default"));
options.UseNpgsql(builder.Configuration.GetConnectionString("Default"));
```

Now any controller or service can ask for it:

```csharp
public class BooksController : ControllerBase
{
    private readonly AppDbContext db;
    public BooksController(AppDbContext db) => this.db = db;
}
```

## Why the lifetime is scoped

`AddDbContext` registers the context as **scoped**, meaning one instance per HTTP request. That default is important and you should not change it.

A `DbContext` is **not thread safe** and it holds a change tracker full of entities. One per request means each request gets a clean tracker, and the context is disposed when the request ends.

Two mistakes follow from misunderstanding this.

**Injecting a scoped context into a singleton.** The singleton holds one context forever, so its change tracker grows without limit and it will eventually be used from two threads at once. ASP.NET Core catches this at startup in development and throws.

**Running parallel queries on one context:**

```csharp
// Throws: A second operation started on this context before a previous operation completed
var t1 = db.Books.ToListAsync();
var t2 = db.Authors.ToListAsync();
await Task.WhenAll(t1, t2);
```

Await them one at a time, or create a separate context per parallel operation with `IDbContextFactory`.

## Context pooling

Creating a `DbContext` is cheap but not free. On a high traffic API, pooling reuses instances and resets their state between requests:

```csharp
builder.Services.AddDbContextPool<AppDbContext>(options =>
    options.UseSqlServer(connectionString));
```

The catch: a pooled context must have no per request state of its own. If your context has a constructor parameter such as a current user or a tenant id, pooling will hand you a stale one. Keep pooled contexts plain, and use the normal `AddDbContext` when the context needs request specific data.

Do not reach for pooling until you have measured a need.

## A context factory for background work

Background services are singletons, so they cannot inject a scoped context. Register a factory instead:

```csharp
builder.Services.AddDbContextFactory<AppDbContext>(options =>
    options.UseSqlServer(connectionString));
```

```csharp
public class CleanupService : BackgroundService
{
    private readonly IDbContextFactory<AppDbContext> factory;

    public CleanupService(IDbContextFactory<AppDbContext> factory) => this.factory = factory;

    protected override async Task ExecuteAsync(CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            await using AppDbContext db = await factory.CreateDbContextAsync(token);
            // work with db, then it is disposed at the end of this block
            await Task.Delay(TimeSpan.FromHours(1), token);
        }
    }
}
```

## Development helpers

While building, two options save real time:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);

    if (builder.Environment.IsDevelopment())
    {
        options.EnableSensitiveDataLogging();   // shows parameter values in logs
        options.EnableDetailedErrors();         // clearer messages on mapping failures
    }
});
```

`EnableSensitiveDataLogging` prints the actual parameter values into your logs, which is exactly what you want while debugging and exactly what you must never do in production. Guard it with the environment check as shown.

To see the SQL EF Core generates, set the log level:

```json
{
  "Logging": {
    "LogLevel": {
      "Microsoft.EntityFrameworkCore.Database.Command": "Information"
    }
  }
}
```

## Retrying on transient failures

Cloud databases drop connections occasionally. One line handles it:

```csharp
options.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure(
    maxRetryCount: 5,
    maxRetryDelay: TimeSpan.FromSeconds(10),
    errorNumbersToAdd: null));
```

Turn this on for any deployed API. Npgsql has the same option.

## Creating the database

Once your context and models exist, create the first migration and apply it:

```bash
dotnet ef migrations add InitialCreate
dotnet ef database update
```

The next topics cover models and migrations properly. For now, know that these two commands are what turn your C# classes into real tables.

## Checking it works

A quick endpoint that proves the connection:

```csharp
app.MapGet("/api/db-check", async (AppDbContext db) =>
{
    bool canConnect = await db.Database.CanConnectAsync();
    return canConnect
        ? Results.Ok(new { database = db.Database.GetDbConnection().Database, status = "connected" })
        : Results.Problem("Cannot reach the database.", statusCode: 503);
});
```

## Quick recap

- EF Core maps C# classes to tables and turns LINQ into SQL.
- Install a provider package plus `Microsoft.EntityFrameworkCore.Design`, and the `dotnet-ef` global tool.
- A `DbContext` needs a constructor taking `DbContextOptions<T>` so DI can configure it.
- Connection strings live under `ConnectionStrings` in configuration, never with a real password in source control.
- `AddDbContext` registers a **scoped** context, one per request. Never inject it into a singleton.
- A context is not thread safe, so await queries one at a time.
- `AddDbContextPool` helps under load but forbids per request state. `AddDbContextFactory` is for background services.
- Guard `EnableSensitiveDataLogging` behind a development check, and turn on `EnableRetryOnFailure` in the cloud.

<code id="code-content" class="language-csharp">
// Program.cs - a complete EF Core registration with the options that matter.
using Microsoft.EntityFrameworkCore;
var builder = WebApplication.CreateBuilder(args);
string connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Connection string 'Default' is missing.");
builder.Services.AddDbContext&lt;AppDbContext&gt;(options =&gt;
{
    // Swap for UseSqlite / UseNpgsql to change database
    options.UseSqlServer(connectionString, sql =&gt;
    {
        // Cloud databases drop connections. Retry the transient ones.
        sql.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorNumbersToAdd: null);
        sql.CommandTimeout(30);
    });
    if (builder.Environment.IsDevelopment())
    {
        options.EnableSensitiveDataLogging();   // parameter values in the log. Never in production.
        options.EnableDetailedErrors();
    }
});
// Background services are singletons, so they cannot take a scoped DbContext.
// A factory lets them create and dispose their own.
builder.Services.AddDbContextFactory&lt;AppDbContext&gt;(options =&gt; options.UseSqlServer(connectionString));
builder.Services.AddHostedService&lt;NightlyCleanupService&gt;();
builder.Services.AddControllers();
var app = builder.Build();
app.MapControllers();
// A quick connectivity check you can call after deploying
app.MapGet("/api/db-check", async (AppDbContext db) =&gt;
    await db.Database.CanConnectAsync()
        ? Results.Ok(new { database = db.Database.GetDbConnection().Database, status = "connected" })
        : Results.Problem("Cannot reach the database.", statusCode: 503));
app.Run();
// ---------- The DbContext: one DbSet per table
public class AppDbContext : DbContext
{
    // DI passes the provider and connection string through these options
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; options) : base(options) { }
    public DbSet&lt;Book&gt;   Books   =&gt; Set&lt;Book&gt;();
    public DbSet&lt;Author&gt; Authors =&gt; Set&lt;Author&gt;();
}
public class Book
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public int Year { get; set; }
    public int AuthorId { get; set; }
    public Author Author { get; set; } = null!;
}
public class Author
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public List&lt;Book&gt; Books { get; set; } = new();
}
// ---------- A background service using the factory, not an injected context
public class NightlyCleanupService : BackgroundService
{
    private readonly IDbContextFactory&lt;AppDbContext&gt; factory;
    private readonly ILogger&lt;NightlyCleanupService&gt; logger;
    public NightlyCleanupService(IDbContextFactory&lt;AppDbContext&gt; factory,
                                 ILogger&lt;NightlyCleanupService&gt; logger)
        =&gt; (this.factory, this.logger) = (factory, logger);
    protected override async Task ExecuteAsync(CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            // Its own context, created and disposed inside the loop
            await using AppDbContext db = await factory.CreateDbContextAsync(token);
            int count = await db.Books.CountAsync(token);
            logger.LogInformation("Nightly check: {Count} books", count);
            // Never do this: a DbContext handles one operation at a time.
            // var t1 = db.Books.ToListAsync();
            // var t2 = db.Authors.ToListAsync();
            // await Task.WhenAll(t1, t2);   ->  throws
            await Task.Delay(TimeSpan.FromHours(24), token);
        }
    }
}
</code></pre>
