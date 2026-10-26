---
publishDate: 2026-10-25T20:51
title: 'SQLite with Entity Framework Core'
slug: sqlite-with-ef-core
metadescription: 'Store CoinJar expenses in a local SQLite database with EF Core: a DbContext factory registered in the host, a SqliteExpenseStore, and EnsureCreated versus migrations with dotnet ef.'
updateDate: 2026-10-25T20:51
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'sqlite', 'ef-core', 'database']
course: wpf
---

## Why a database

In [Saving Data to JSON Files](/courses/wpf/saving-data-to-json-files) CoinJar saved every expense to one file, rewriting the whole file after each change. That is fine for a few hundred items. A database is better when:

- you have thousands of expenses and only want to load some of them, like "this month"
- you want to filter, sort and sum without loading everything into memory
- you want to change one expense without rewriting all of them

**SQLite** is a small database engine that keeps the whole database in a single file on disk. There is no server to install or run. It ships inside your app as a library, which makes it perfect for desktop apps.

**Entity Framework Core** (EF Core) is Microsoft's **ORM**, an object relational mapper. It translates between C# objects and database tables, so you write [LINQ](/courses/c-sharp/linq-fundamentals) instead of SQL:

```csharp
var thisMonth = db.Expenses
    .Where(e => e.Date >= firstOfMonth)
    .OrderByDescending(e => e.Date)
    .ToList();
```

EF Core turns that into SQL, runs it on SQLite and gives you back `Expense` objects.

## Install the packages

```bash
dotnet add package Microsoft.EntityFrameworkCore.Sqlite
dotnet add package Microsoft.EntityFrameworkCore.Design
```

- `Microsoft.EntityFrameworkCore.Sqlite` is EF Core plus the SQLite provider. It also brings the native SQLite library, so nothing else is needed on the user's PC.
- `Microsoft.EntityFrameworkCore.Design` is only needed for the `dotnet ef` command line tool used for migrations, later in this lesson. It is not shipped with your app.

At the time of writing both are version 10.0.14, matching .NET 10.

## The DbContext

A **DbContext** is the class that represents a session with the database. It has one `DbSet<T>` property per table. Think of it as a shopping basket: you put changes in it, then `SaveChanges` sends them all to the database in one go.

Create a `Data` folder and add `CoinJarDbContext.cs`:

```csharp
using CoinJar.Models;
using Microsoft.EntityFrameworkCore;

namespace CoinJar.Data;

public class CoinJarDbContext : DbContext
{
    public CoinJarDbContext(DbContextOptions<CoinJarDbContext> options)
        : base(options)
    {
    }

    public DbSet<Expense> Expenses => Set<Expense>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Expense>(entity =>
        {
            entity.Property(e => e.Title).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Category).HasMaxLength(20).IsRequired();
            entity.HasIndex(e => e.Date);
        });
    }
}
```

The constructor takes `DbContextOptions`, which is how the host will tell it which database to use. `OnModelCreating` describes the table in more detail than the class alone can.

### How the Expense class maps

EF Core uses **conventions**, sensible default rules:

- The `Expense` class becomes a table called `Expenses` (the name of the `DbSet`).
- Each public property with a getter and setter becomes a column.
- A property called `Id` becomes the **primary key**, the unique number for each row. For an `int` key, SQLite fills it in automatically when you insert.

Your `Expense` class, an `ObservableObject` with partial properties, works as it is. EF Core reads and writes the properties, and change notifications keep working for the UI.

SQLite has no real decimal column type, so EF Core stores `decimal` values as text and converts them back for you. Sorting, filtering and summing amounts in LINQ still work.

## Register it in the host

A `DbContext` is meant to be **short lived**: create one, do a unit of work, dispose it. In a web app each request gets its own. A desktop app has no requests, and a single context kept alive for hours slowly fills up with tracked objects and stale data.

The recommended pattern for desktop apps is a **DbContext factory**. You register the factory once, and services create a fresh context whenever they need one. In the `App` constructor, where you build the host:

```csharp
using Microsoft.EntityFrameworkCore;

string dbPath = CoinJarDbContext.DefaultDatabasePath;

builder.Services.AddDbContextFactory<CoinJarDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));
```

`Data Source=...` is the **connection string**, the address of the database. For SQLite it is just a file path. Put the file under `LocalApplicationData`, because a database file should stay on this PC and not roam:

```csharp
public static string DefaultDatabasePath
{
    get
    {
        string folder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "CoinJar");
        Directory.CreateDirectory(folder);
        return Path.Combine(folder, "coinjar.db");
    }
}
```

`AddDbContext<T>` also exists, and you will see it in web tutorials such as [DbContext and entity models](/courses/dotnet-webapi/dbcontext-and-entity-models). It registers the context as a **scoped** service. In a WPF app without scopes, that easily turns into one context for the whole app's life, which is exactly the problem above. Prefer the factory.

## A store that uses the factory

CoinJar's view models talk to `IExpenseStore` (`GetAll`, `Add`, `Remove`), first with `InMemoryExpenseStore` and then with the `JsonExpenseStore` from the last lesson. The SQLite version implements the **same interface**, so nothing else in the app changes.

Each method creates its own context with `CreateDbContext` and disposes it with `using`:

```csharp
public IReadOnlyList<Expense> GetAll()
{
    using CoinJarDbContext db = _factory.CreateDbContext();

    List<Expense> expenses = db.Expenses
        .AsNoTracking()
        .OrderByDescending(e => e.Date)
        .ToList();

    foreach (Expense expense in expenses) Watch(expense);
    return expenses;
}

public void Add(Expense expense)
{
    using CoinJarDbContext db = _factory.CreateDbContext();
    db.Expenses.Add(expense);
    db.SaveChanges();     // the INSERT runs here
    Watch(expense);
}
```

`AsNoTracking()` tells EF Core not to keep watching the loaded objects for changes. You are going to throw the context away anyway, so tracking would be wasted work.

`Remove` uses `ExecuteDelete`, which deletes straight in the database without loading the row first:

```csharp
db.Expenses.Where(e => e.Id == expense.Id).ExecuteDelete();
```

About the key: `ExpenseListViewModel` already gives each new expense an `Id`, and EF Core inserts that value. If you ever add an expense with `Id = 0`, SQLite picks the next free number and EF Core copies it back into `expense.Id` after `SaveChanges`.

### Saving edits

Just like the JSON store, this store listens to `PropertyChanged` on each expense it hands out. When the edit dialog changes an expense, the store saves that one row:

```csharp
private void OnExpenseChanged(object? sender, PropertyChangedEventArgs e)
{
    using CoinJarDbContext db = _factory.CreateDbContext();
    db.Expenses.Update((Expense)sender!);   // marks all columns as changed
    db.SaveChanges();
}
```

### Swap it in the host

Register the store as a singleton. That is safe, because it holds only the factory and never a context:

```csharp
// before
builder.Services.AddSingleton<IExpenseStore, JsonExpenseStore>();

// after
builder.Services.AddSingleton<IExpenseStore, SqliteExpenseStore>();
```

### Sync or async?

EF Core has async versions of everything: `ToListAsync`, `SaveChangesAsync`, `ExecuteDeleteAsync`. CoinJar's store keeps the simple synchronous interface because a local SQLite file answers in a millisecond or two. If you later move to a slow or remote database, add async methods to `IExpenseStore` (for example `Task<IReadOnlyList<Expense>> GetAllAsync()`) and await them from async commands, as you learned in [Async, Await and a Responsive UI](/courses/wpf/async-await-and-a-responsive-ui).

## Creating the database: EnsureCreated

The database file does not exist on first run. The quickest way to create it is `EnsureCreated`, called once in `OnStartup` before the first window opens:

```csharp
var factory = _host.Services.GetRequiredService<IDbContextFactory<CoinJarDbContext>>();
using (CoinJarDbContext db = factory.CreateDbContext())
{
    db.Database.EnsureCreated();
}
```

It checks whether the database exists. If not, it creates the file and all tables from your model. If it already exists, it does nothing at all.

That last part is the catch. Imagine version 2 of CoinJar adds a `Note` property to `Expense`. Users who already have a database from version 1 will **not** get the new column, because `EnsureCreated` sees an existing database and stops. The app then crashes when it queries `Note`.

So `EnsureCreated` is fine for prototypes, demos and tests. For an app that real people install and update, use migrations.

## Migrations

A **migration** is a small generated C# class that describes one change to the database: "create the Expenses table", "add a Note column". EF Core keeps a list of applied migrations inside the database itself, in a table called `__EFMigrationsHistory`. At startup it applies only the ones that are missing. Every user's database gets upgraded step by step, whatever version they come from.

### Install the tool

Migrations are created with the `dotnet ef` command line tool. It is a separate .NET tool, installed once per PC:

```bash
dotnet tool install --global dotnet-ef
```

It needs the `Microsoft.EntityFrameworkCore.Design` package in your project, which you installed at the start.

### Help the tool create your DbContext

To generate a migration, `dotnet ef` must create a `CoinJarDbContext` at design time. Its usual trick is to start your app's entry point and catch the moment the host is built. In a WPF app the host is built inside the `App` class, as part of starting a WPF application, so this works or fails depending on what your startup code does. When it fails you get an error saying it was unable to create the DbContext.

The reliable fix is a **design time factory**: a class implementing `IDesignTimeDbContextFactory<T>`. The tool looks for it first and uses it instead of starting your app.

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CoinJar.Data;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<CoinJarDbContext>
{
    public CoinJarDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<CoinJarDbContext>()
            .UseSqlite($"Data Source={CoinJarDbContext.DefaultDatabasePath}")
            .Options;

        return new CoinJarDbContext(options);
    }
}
```

### Add a migration

Run this in the project folder:

```bash
dotnet ef migrations add InitialCreate
```

It creates a `Migrations` folder with the migration and a snapshot of the current model. Commit these files with your code. Whenever you change the model later, add another one:

```bash
dotnet ef migrations add AddExpenseNote
```

You can apply migrations to your own database from the command line with `dotnet ef database update`. For users, the app applies them itself.

### Apply migrations at startup

Replace `EnsureCreated` with `Migrate`:

```csharp
using (CoinJarDbContext db = factory.CreateDbContext())
{
    db.Database.Migrate();
}
```

`Migrate` creates the database if it is missing and applies any migrations it has not applied yet. Do not mix the two methods: a database created by `EnsureCreated` has no migration history, so `Migrate` cannot upgrade it later.

## Seeing what EF Core does

EF Core can log every SQL statement. While developing, add this to the `UseSqlite` options to see the queries in Visual Studio's Output window:

```csharp
options.UseSqlite($"Data Source={dbPath}")
       .LogTo(message => System.Diagnostics.Debug.WriteLine(message),
              Microsoft.Extensions.Logging.LogLevel.Information);
```

To look inside the database file, use a free tool such as DB Browser for SQLite.

## Common mistakes

- **One long lived DbContext.** Use `AddDbContextFactory` and a new context per operation.
- **Forgetting `SaveChanges`.** `Add`, `Update` and `Remove` only change the basket. Nothing reaches the database until you save.
- **Using `EnsureCreated` in a shipped app.** Existing databases never get new columns. Use migrations.
- **`dotnet ef` cannot create the context.** Add an `IDesignTimeDbContextFactory` and make sure the Design package is installed.
- **Database file next to the exe.** Same problem as JSON files in Program Files. Use `LocalApplicationData`.
- **Slow queries on the UI thread.** Sync calls are fine for a small local file. For big queries or a remote database, use the `Async` versions.

## Quick recap

- SQLite is a file based database with no server. EF Core maps C# classes to its tables and lets you query with LINQ.
- Install `Microsoft.EntityFrameworkCore.Sqlite`, plus `Microsoft.EntityFrameworkCore.Design` for migrations.
- A `DbContext` has a `DbSet<T>` per table. Configure details in `OnModelCreating`.
- In WPF, register `AddDbContextFactory` in the host and create a short lived context per operation with `using`.
- `SqliteExpenseStore` implements the same `IExpenseStore` as the in-memory and JSON stores, so swapping it in is one line.
- `EnsureCreated` is quick but cannot upgrade an existing database. Migrations can.
- Install `dotnet-ef`, add an `IDesignTimeDbContextFactory`, run `dotnet ef migrations add`, and call `Database.Migrate()` at startup.

<code id="code-content" class="language-csharp">
// Data/CoinJarDbContext.cs
using System.IO;
using CoinJar.Models;
using Microsoft.EntityFrameworkCore;
namespace CoinJar.Data;
public class CoinJarDbContext : DbContext
{
    // The host (or the design time factory) passes the options in.
    public CoinJarDbContext(DbContextOptions&lt;CoinJarDbContext&gt; options)
        : base(options)
    {
    }
    // One DbSet per table.
    public DbSet&lt;Expense&gt; Expenses =&gt; Set&lt;Expense&gt;();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity&lt;Expense&gt;(entity =&gt;
        {
            entity.Property(e =&gt; e.Title).HasMaxLength(100).IsRequired();
            entity.Property(e =&gt; e.Category).HasMaxLength(20).IsRequired();
            entity.HasIndex(e =&gt; e.Date);   // faster "this month" queries
        });
    }
    // %LocalAppData%\CoinJar\coinjar.db  (a database should not roam)
    public static string DefaultDatabasePath
    {
        get
        {
            string folder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "CoinJar");
            Directory.CreateDirectory(folder);
            return Path.Combine(folder, "coinjar.db");
        }
    }
}
// Data/DesignTimeDbContextFactory.cs
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace CoinJar.Data;
// Used only by "dotnet ef migrations add", so it never has to start the WPF app.
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory&lt;CoinJarDbContext&gt;
{
    public CoinJarDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder&lt;CoinJarDbContext&gt;()
            .UseSqlite($"Data Source={CoinJarDbContext.DefaultDatabasePath}")
            .Options;
        return new CoinJarDbContext(options);
    }
}
// Services/SqliteExpenseStore.cs
using System.ComponentModel;
using CoinJar.Data;
using CoinJar.Models;
using Microsoft.EntityFrameworkCore;
namespace CoinJar.Services;
// Same IExpenseStore as InMemoryExpenseStore and JsonExpenseStore.
// A singleton that holds the factory, never a DbContext.
public class SqliteExpenseStore : IExpenseStore
{
    private readonly IDbContextFactory&lt;CoinJarDbContext&gt; _factory;
    public SqliteExpenseStore(IDbContextFactory&lt;CoinJarDbContext&gt; factory)
    {
        _factory = factory;
    }
    public IReadOnlyList&lt;Expense&gt; GetAll()
    {
        // A fresh, short lived context for each operation.
        using CoinJarDbContext db = _factory.CreateDbContext();
        List&lt;Expense&gt; expenses = db.Expenses
            .AsNoTracking()                    // read only, no change tracking
            .OrderByDescending(e =&gt; e.Date)
            .ToList();
        foreach (Expense expense in expenses)
        {
            Watch(expense);
        }
        return expenses;
    }
    public void Add(Expense expense)
    {
        using CoinJarDbContext db = _factory.CreateDbContext();
        db.Expenses.Add(expense);
        db.SaveChanges();                      // INSERT. With Id = 0, SQLite picks one.
        Watch(expense);
    }
    public void Remove(Expense expense)
    {
        expense.PropertyChanged -= OnExpenseChanged;
        using CoinJarDbContext db = _factory.CreateDbContext();
        // Deletes in the database without loading the row first.
        db.Expenses.Where(e =&gt; e.Id == expense.Id).ExecuteDelete();
    }
    // Edits (for example from the edit dialog) raise PropertyChanged: save that row.
    private void Watch(Expense expense) =&gt; expense.PropertyChanged += OnExpenseChanged;
    private void OnExpenseChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (sender is not Expense expense) return;
        using CoinJarDbContext db = _factory.CreateDbContext();
        db.Expenses.Update(expense);           // marks all columns as changed
        db.SaveChanges();
    }
}
// App.xaml.cs
// No StartupUri in App.xaml: OnStartup shows the window.
using System.Windows;
using CoinJar.Data;
using CoinJar.Services;
using CoinJar.ViewModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
namespace CoinJar;
public partial class App : Application
{
    private readonly IHost _host;
    public App()
    {
        HostApplicationBuilder builder = Host.CreateApplicationBuilder();
        // A factory, so every operation gets its own short lived DbContext.
        builder.Services.AddDbContextFactory&lt;CoinJarDbContext&gt;(options =&gt;
            options.UseSqlite($"Data Source={CoinJarDbContext.DefaultDatabasePath}"));
        // The only line that changes: SQLite instead of JSON or in-memory.
        builder.Services.AddSingleton&lt;IExpenseStore, SqliteExpenseStore&gt;();
        builder.Services.AddSingleton&lt;ExpenseListViewModel&gt;();
        builder.Services.AddSingleton&lt;MainWindow&gt;();
        _host = builder.Build();
    }
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        _host.Start();
        // Create the database or upgrade it to the latest migration,
        // before any view model reads from it.
        // (Quick prototype without migrations: db.Database.EnsureCreated().)
        var factory = _host.Services.GetRequiredService&lt;IDbContextFactory&lt;CoinJarDbContext&gt;&gt;();
        using (CoinJarDbContext db = factory.CreateDbContext())
        {
            db.Database.Migrate();
        }
        _host.Services.GetRequiredService&lt;MainWindow&gt;().Show();
    }
    protected override void OnExit(ExitEventArgs e)
    {
        _host.StopAsync(TimeSpan.FromSeconds(5)).GetAwaiter().GetResult();
        _host.Dispose();
        base.OnExit(e);
    }
}
</code></pre>
