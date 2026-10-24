---
publishDate: 2026-08-15T10:50
title: Entity Framework Core Setup
slug: entity-framework-core-setup
metadescription: Add Entity Framework Core to an MVC project, install the SQL Server or SQLite provider, create a DbContext with DbSet properties, put the connection string in appsettings.json, and register the context in Program.cs.
updateDate: 2026-09-14T10:50
author: ['bishal-biswas']
level: 2
tags: ['ef-core', 'database', 'dbcontext']
course: dotnet-mvc
---

## What Entity Framework Core is

Talking to a database by hand means writing SQL strings, opening connections, reading rows one column at a time and copying values into objects. It works, but it is slow to write and easy to get wrong.

**Entity Framework Core** (EF Core) is an object relational mapper, or ORM. You describe your data as ordinary C# classes. EF Core creates the tables, writes the SQL, and turns rows into objects and objects into rows. You write LINQ, it writes SQL.

```csharp
var cheap = await _db.Products.Where(p => p.Price < 20).ToListAsync();
```

Behind that line, EF Core sends `SELECT ... FROM Products WHERE Price < 20` to the database and builds a list of `Product` objects from the result.

## Installing the packages

EF Core is split into a core package and a **provider** for each database. Pick one provider. For learning, SQLite needs no server and stores everything in a single file. For real projects on Windows or Azure, SQL Server is the usual choice.

```bash
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
```

Or:

```bash
dotnet add package Microsoft.EntityFrameworkCore.Sqlite
```

You also need the design package for migrations, and the command line tool:

```bash
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet tool install --global dotnet-ef
```

Check the tool with `dotnet ef --version`.

## Entity classes

An entity is a plain class with a key. EF Core recognises a property named `Id` or `<ClassName>Id` as the primary key automatically:

```csharp
namespace ShopApp.Models;

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = "";

    public List<Product> Products { get; set; } = new();
}

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public bool InStock { get; set; }

    public int CategoryId { get; set; }
    public Category? Category { get; set; }
}
```

`CategoryId` is a foreign key and `Category` is a navigation property. EF Core spots the pair by name and sets up the relationship. The relationships topic goes deeper.

## The DbContext

A `DbContext` is the class that represents a session with the database. It has one `DbSet<T>` per table:

```csharp
using Microsoft.EntityFrameworkCore;
using ShopApp.Models;

namespace ShopApp.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<Category> Categories => Set<Category>();
}
```

The constructor takes options that say which provider and connection string to use. Those come from `Program.cs` through dependency injection.

Table names default to the `DbSet` property names, so these become `Products` and `Categories`.

## The connection string

Put the connection string in `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "Default": "Server=(localdb)\\mssqllocaldb;Database=ShopApp;Trusted_Connection=True;MultipleActiveResultSets=true"
  }
}
```

`(localdb)\mssqllocaldb` is SQL Server LocalDB, which installs with Visual Studio and is fine for development. For SQLite the string is much shorter:

```json
"Default": "Data Source=shopapp.db"
```

Passwords do not belong in `appsettings.json` if the file is committed. The environments and user secrets topic shows where they go.

## Registering the context

Wire it up in `Program.cs` before `builder.Build()`:

```csharp
using Microsoft.EntityFrameworkCore;
using ShopApp.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

var app = builder.Build();
```

For SQLite, replace `UseSqlServer` with `UseSqlite`.

`AddDbContext` registers the context with a **scoped** lifetime: one instance per HTTP request, disposed when the request ends. That is exactly right for a web app.

## Using the context in a controller

Ask for it in the constructor, like any other service:

```csharp
public class ProductsController : Controller
{
    private readonly AppDbContext _db;

    public ProductsController(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IActionResult> Index()
    {
        var products = await _db.Products
            .Include(p => p.Category)
            .ToListAsync();

        return View(products);
    }
}
```

`Include` tells EF Core to load the related category in the same query. Without it, `product.Category` would be `null`.

## Creating the database

The tables do not exist yet. The next topic on migrations creates them properly. For a very first look, you can let EF Core create the schema straight from the model:

```csharp
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}
```

`EnsureCreated` is fine for a throwaway demo but it cannot update an existing database when the model changes. Use migrations for anything you plan to keep.

## Configuring the model

Sometimes the defaults need adjusting. You can use attributes on the entity:

```csharp
[MaxLength(100)]
public string Name { get; set; } = "";

[Column(TypeName = "decimal(10,2)")]
public decimal Price { get; set; }
```

Or override `OnModelCreating` in the context, which keeps entities clean:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<Product>(entity =>
    {
        entity.Property(p => p.Name).HasMaxLength(100).IsRequired();
        entity.Property(p => p.Price).HasPrecision(10, 2);
        entity.HasIndex(p => p.Name);
    });
}
```

Setting the precision on `decimal` columns matters. Without it, SQL Server warns that values may be truncated.

## Logging the SQL

In development it helps to see what EF Core sends to the database. Add this to `appsettings.Development.json`:

```json
"Logging": {
  "LogLevel": {
    "Microsoft.EntityFrameworkCore.Database.Command": "Information"
  }
}
```

Every query now appears in the console. This is the quickest way to spot a query that runs in a loop.

## Quick recap

- EF Core maps C# classes to tables and turns LINQ into SQL.
- Install a provider package (SQL Server or SQLite), the design package, and the `dotnet-ef` tool.
- Entities are plain classes with an `Id` key. A `DbContext` exposes one `DbSet<T>` per table.
- The connection string lives in `appsettings.json` and the context is registered with `AddDbContext` in `Program.cs`.
- Inject the context into controllers and use async LINQ methods to query.
- Configure column details with attributes or `OnModelCreating`, and log SQL in development.

<code id="code-content" class="language-csharp">
// Models/Category.cs
namespace ShopApp.Models;

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public List&lt;Product&gt; Products { get; set; } = new();
}

// Models/Product.cs
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public bool InStock { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int CategoryId { get; set; }
    public Category? Category { get; set; }
}

// Data/AppDbContext.cs
using Microsoft.EntityFrameworkCore;
using ShopApp.Models;

namespace ShopApp.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; options) : base(options) { }

    public DbSet&lt;Product&gt; Products =&gt; Set&lt;Product&gt;();
    public DbSet&lt;Category&gt; Categories =&gt; Set&lt;Category&gt;();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity&lt;Product&gt;(entity =&gt;
        {
            entity.Property(p =&gt; p.Name).HasMaxLength(100).IsRequired();
            entity.Property(p =&gt; p.Price).HasPrecision(10, 2);
            entity.HasIndex(p =&gt; p.Name);
        });

        modelBuilder.Entity&lt;Category&gt;(entity =&gt;
        {
            entity.Property(c =&gt; c.Name).HasMaxLength(60).IsRequired();
            entity.HasIndex(c =&gt; c.Name).IsUnique();
        });
    }
}

// appsettings.json
//
//   {
//     "ConnectionStrings": {
//       "Default": "Server=(localdb)\\mssqllocaldb;Database=ShopApp;Trusted_Connection=True;MultipleActiveResultSets=true"
//     }
//   }

// Program.cs
using Microsoft.EntityFrameworkCore;
using ShopApp.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddDbContext&lt;AppDbContext&gt;(options =&gt;
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();

// Controllers/ProductsController.cs
public class ProductsController : Controller
{
    private readonly AppDbContext _db;
    public ProductsController(AppDbContext db) =&gt; _db = db;

    public async Task&lt;IActionResult&gt; Index()
    {
        var products = await _db.Products
            .Include(p =&gt; p.Category)
            .OrderBy(p =&gt; p.Name)
            .ToListAsync();
        return View(products);
    }
}
</code></pre>
