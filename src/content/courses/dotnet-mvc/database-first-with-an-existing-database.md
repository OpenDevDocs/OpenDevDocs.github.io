---
publishDate: 2026-08-16T11:05
title: Database First with an Existing Database
slug: database-first-with-an-existing-database
metadescription: "Use the EF Core Database First approach in ASP.NET Core MVC: scaffold entity classes and a DbContext from an existing SQL Server database with dotnet ef dbcontext scaffold, keep the connection string safe, re-scaffold after schema changes and extend the generated partial classes."
updateDate: 2026-09-14T11:05
author: ['bishal-biswas']
level: 2
tags: ['ef-core', 'database-first', 'scaffolding']
course: dotnet-mvc
---

## Two ways to start

So far this course has used **Code First**. You wrote the `Product` and `Category` classes, then [migrations](/courses/dotnet-mvc/migrations-and-seeding-data) created the tables from them. The C# code was the source of truth.

Many real projects start the other way round. The database already exists. Another team owns it, an older app uses it, or a DBA designs every table by hand. You cannot let EF Core create or change the schema. You just need C# classes that match it.

That is **Database First**. EF Core reads the tables, columns, keys and relationships from the database and writes the entity classes and the `DbContext` for you. This step is called **reverse engineering** or **scaffolding**.

| | Code First | Database First |
| --- | --- | --- |
| Source of truth | Your C# classes | The database schema |
| Who changes the schema | You, through migrations | The DBA or another app, with SQL |
| How C# catches up | You edit classes, then add a migration | You run the scaffold command again |
| Good for | New apps you fully own | Existing or shared databases |

Once the classes exist, everything else is the same. Queries, `SaveChangesAsync`, controllers and views all work exactly like in [CRUD Operations with EF Core](/courses/dotnet-mvc/crud-operations-with-ef-core).

> In old ASP.NET MVC 5 with EF 6, Database First meant an `.edmx` file and a visual designer. EF Core has no designer. Database First in EF Core is the scaffold command you will use below, and the result is plain C# files.

## The existing database

Say the shop's database was built by someone else with this SQL:

```sql
CREATE TABLE Categories (
    CategoryId INT IDENTITY(1,1) CONSTRAINT PK_Categories PRIMARY KEY,
    Name       NVARCHAR(60) NOT NULL
);

CREATE TABLE Products (
    ProductId  INT IDENTITY(1,1) CONSTRAINT PK_Products PRIMARY KEY,
    Name       NVARCHAR(100) NOT NULL,
    Price      DECIMAL(10, 2) NOT NULL,
    InStock    BIT NOT NULL,
    CategoryId INT NOT NULL
        CONSTRAINT FK_Products_Categories REFERENCES Categories (CategoryId)
);
```

Notice the key names are `ProductId` and `CategoryId`, not `Id`. That is common in existing databases, and scaffolding handles it.

## What you need

The same packages and tool as [Entity Framework Core Setup](/courses/dotnet-mvc/entity-framework-core-setup):

```bash
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet tool install --global dotnet-ef
```

The `Design` package is what the scaffold command uses. The project must also build, because the tool builds it first.

## Put the connection string in appsettings.json

Add the connection string where the app will read it anyway:

```json
{
  "ConnectionStrings": {
    "Default": "Server=(localdb)\\mssqllocaldb;Database=ShopDb;Trusted_Connection=True;TrustServerCertificate=True"
  }
}
```

## Run the scaffold command

From the folder that contains the `.csproj` file:

```bash
dotnet ef dbcontext scaffold Name=ConnectionStrings:Default Microsoft.EntityFrameworkCore.SqlServer --output-dir Models --context-dir Data --context ShopContext --no-onconfiguring
```

Piece by piece:

- `Name=ConnectionStrings:Default` tells the tool to read the connection string from configuration. You could paste the full string here instead, but then it ends up in your shell history.
- `Microsoft.EntityFrameworkCore.SqlServer` is the provider to use.
- `--output-dir Models` is where the entity classes go.
- `--context-dir Data` and `--context ShopContext` set the folder and name of the `DbContext`.
- `--no-onconfiguring` stops EF Core writing an `OnConfiguring` method into the context. You register the context in `Program.cs` instead, like before.

The result:

```text
Data/
  ShopContext.cs
Models/
  Category.cs
  Product.cs
```

## What gets generated

The entity class follows the columns:

```csharp
public partial class Product
{
    public int ProductId { get; set; }

    public string Name { get; set; } = null!;

    public decimal Price { get; set; }

    public bool InStock { get; set; }

    public int CategoryId { get; set; }

    public virtual Category Category { get; set; } = null!;
}
```

SQL types become C# types: `NVARCHAR` becomes `string`, `DECIMAL` becomes `decimal`, `BIT` becomes `bool`. The foreign key column becomes `CategoryId`, and EF Core adds a `Category` navigation property for it. `Category` gets a `Products` collection in return.

The context holds the details that a class cannot show, such as lengths and column types:

```csharp
public partial class ShopContext : DbContext
{
    public ShopContext(DbContextOptions<ShopContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Category> Categories { get; set; }

    public virtual DbSet<Product> Products { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>(entity =>
        {
            entity.Property(e => e.Name).HasMaxLength(100);
            entity.Property(e => e.Price).HasColumnType("decimal(10, 2)");

            entity.HasOne(d => d.Category).WithMany(p => p.Products)
                .HasForeignKey(d => d.CategoryId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Products_Categories");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
```

Two things to notice. Every class is `partial`, and there is an empty `OnModelCreatingPartial` hook at the end. Both are there so you can add your own code without touching these files. More on that soon.

If you prefer attributes such as `[Key]` and `[StringLength(100)]` on the classes, add `--data-annotations` to the command. Anything that has no attribute still goes in `OnModelCreating`.

## Register the context

This is the same as Code First:

```csharp
builder.Services.AddDbContext<ShopContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
```

Now inject `ShopContext` into a controller and use it:

```csharp
public class ProductsController : Controller
{
    private readonly ShopContext _db;

    public ProductsController(ShopContext db) => _db = db;

    public async Task<IActionResult> Index()
    {
        var products = await _db.Products
            .Include(p => p.Category)
            .OrderBy(p => p.Name)
            .AsNoTracking()
            .ToListAsync();

        return View(products);
    }
}
```

From here, [Scaffolding Controllers and Views](/courses/dotnet-mvc/scaffolding-controllers-and-views) works on these classes too.

## Only some tables

A big database may have hundreds of tables. Pick the ones you need with `--table`, once per table:

```bash
dotnet ef dbcontext scaffold Name=ConnectionStrings:Default Microsoft.EntityFrameworkCore.SqlServer --output-dir Models --context-dir Data --context ShopContext --no-onconfiguring --table Products --table Categories
```

Use `--schema sales` to take every table in one schema.

## When the database changes

Say the DBA adds a `Description` column. Your code does not know about it yet. Run the same command again with `--force` so it can overwrite the files:

```bash
dotnet ef dbcontext scaffold Name=ConnectionStrings:Default Microsoft.EntityFrameworkCore.SqlServer --output-dir Models --context-dir Data --context ShopContext --no-onconfiguring --force
```

This is the Database First loop: **the schema changes in the database, then you re-scaffold**. You do not add migrations, because you are not the one changing the schema.

`--force` replaces the generated files completely. Any edit you made inside them is gone. Put long commands in a script file in the repo, such as `scaffold.ps1` or `scaffold.sh`, so everyone runs exactly the same options.

## Adding your own code safely

Never edit the generated files. Use the `partial` keyword instead. Put your extra code in **another file** with the same class name:

```csharp
// Models/Partials/Product.cs (yours, never overwritten)
namespace Shop.Models;

public partial class Product
{
    public string PriceLabel => Price.ToString("C");
}
```

A property with only a getter, like `PriceLabel`, is not mapped to a column, so EF Core ignores it.

For extra model configuration, fill in the hook from your own partial context file:

```csharp
// Data/ShopContext.Custom.cs (yours, never overwritten)
public partial class ShopContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>()
            .HasQueryFilter(p => p.InStock);
    }
}
```

Both files survive `--force`, because the scaffold command only overwrites the files it generates. It never deletes your other files.

For validation attributes on generated classes, such as `[Required]` or `[Display]`, use a separate view model for the form. That keeps the generated entity clean, and it is better practice anyway, as [Models and ViewModels](/courses/dotnet-mvc/models-and-viewmodels) explains.

## Can I use migrations later?

Yes. Some teams scaffold once to get started and then switch to Code First. To do that, create a first migration and empty its `Up` and `Down` methods, because the tables already exist:

```bash
dotnet ef migrations add InitialCreate
```

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    // Baseline: these tables already exist in the database.
}
```

```bash
dotnet ef database update
```

This only writes a row to `__EFMigrationsHistory`. From then on, change the classes and add migrations as usual, and stop running the scaffold command. Do not mix the two: if a DBA still changes the schema by hand, stay with Database First.

## Common problems

**"Build failed."** The tool builds the project before it reads the database. Fix the compile error first. A half-finished partial class is a common cause.

**"Login failed" or "server was not found".** The connection string is wrong, or the database server is not running. Test it in a database tool first.

**A warning about a sensitive connection string in OnConfiguring.** You passed the connection string directly and left out `--no-onconfiguring`. Delete the generated `OnConfiguring` method and register the context in `Program.cs`.

**A table is missing.** Scaffolding skips tables it cannot map, such as a table with no primary key. The tool prints a warning for each one. Map it as keyless yourself in `OnModelCreatingPartial` with `HasNoKey()` if you only read from it.

**Your changes vanished.** You edited a generated file and then re-scaffolded with `--force`. Move the change into a partial file.

## Quick recap

- Code First makes the database from your classes. Database First makes your classes from the database.
- `dotnet ef dbcontext scaffold` reads the schema and writes the entity classes and the `DbContext`.
- Use `Name=ConnectionStrings:Default` and `--no-onconfiguring` to keep the connection string out of the code.
- `--table` and `--schema` limit what is scaffolded, and `--data-annotations` uses attributes instead of fluent code.
- When the schema changes, re-scaffold with `--force`. Never edit generated files.
- Add your own code in separate `partial` class files and in `OnModelCreatingPartial`.
- You can switch to migrations later with an empty baseline migration.

<code id="code-content" class="language-csharp">
// Terminal: scaffold the existing ShopDb database (rerun with --force after schema changes)
//
//   dotnet ef dbcontext scaffold Name=ConnectionStrings:Default
//     Microsoft.EntityFrameworkCore.SqlServer --output-dir Models --context-dir Data
//     --context ShopContext --no-onconfiguring --force
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
// Program.cs
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
builder.Services.AddDbContext&lt;ShopContext&gt;(options =&gt;
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
var app = builder.Build();
app.UseStaticFiles();
app.UseRouting();
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
app.Run();
// Models/Product.cs (generated, do not edit)
public partial class Product
{
    public int ProductId { get; set; }
    public string Name { get; set; } = null!;
    public decimal Price { get; set; }
    public bool InStock { get; set; }
    public int CategoryId { get; set; }
    public virtual Category Category { get; set; } = null!;
}
// Models/Category.cs (generated, do not edit)
public partial class Category
{
    public int CategoryId { get; set; }
    public string Name { get; set; } = null!;
    public virtual ICollection&lt;Product&gt; Products { get; set; } = new List&lt;Product&gt;();
}
// Data/ShopContext.cs (generated, do not edit)
public partial class ShopContext : DbContext
{
    public ShopContext(DbContextOptions&lt;ShopContext&gt; options) : base(options) { }
    public virtual DbSet&lt;Category&gt; Categories { get; set; }
    public virtual DbSet&lt;Product&gt; Products { get; set; }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity&lt;Category&gt;(entity =&gt;
        {
            entity.Property(e =&gt; e.Name).HasMaxLength(60);
        });
        modelBuilder.Entity&lt;Product&gt;(entity =&gt;
        {
            entity.Property(e =&gt; e.Name).HasMaxLength(100);
            entity.Property(e =&gt; e.Price).HasColumnType("decimal(10, 2)");
            entity.HasOne(d =&gt; d.Category).WithMany(p =&gt; p.Products)
                .HasForeignKey(d =&gt; d.CategoryId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Products_Categories");
        });
        OnModelCreatingPartial(modelBuilder);
    }
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
// Models/Partials/Product.cs (yours, survives re-scaffolding)
public partial class Product
{
    public string PriceLabel =&gt; Price.ToString("C");
}
// Data/ShopContext.Custom.cs (yours, survives re-scaffolding)
public partial class ShopContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity&lt;Product&gt;().HasQueryFilter(p =&gt; p.InStock);
    }
}
// Controllers/ProductsController.cs
public class ProductsController : Controller
{
    private readonly ShopContext _db;
    public ProductsController(ShopContext db) =&gt; _db = db;
    public async Task&lt;IActionResult&gt; Index()
    {
        var products = await _db.Products
            .Include(p =&gt; p.Category)
            .OrderBy(p =&gt; p.Name)
            .AsNoTracking()
            .ToListAsync();
        return View(products);
    }
}
</code></pre>
