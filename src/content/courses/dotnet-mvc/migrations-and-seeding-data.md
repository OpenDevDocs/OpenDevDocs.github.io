---
publishDate: 2026-08-16T11:00
title: Migrations and Seeding Data
slug: migrations-and-seeding-data
metadescription: Create and apply Entity Framework Core migrations to build and evolve your database schema, understand what a migration file contains, roll back changes, and seed starter data with HasData or a seeder class.
updateDate: 2026-09-14T11:00
author: ['bishal-biswas']
level: 2
tags: ['ef-core', 'migrations', 'seeding']
course: dotnet-mvc
---

## Keeping the database in step with the code

Your entity classes describe what the tables should look like. But the database does not read C#. Something has to translate "I added a `Description` property to `Product`" into `ALTER TABLE Products ADD Description ...`.

That something is a **migration**. A migration is a C# file that records one change to the schema. You create one each time the model changes, and apply it to move the database forward. The chain of migrations is the full history of your schema, checked into source control alongside the code.

## Creating the first migration

With the context and entities from the previous topic in place, run this in the project folder:

```bash
dotnet ef migrations add InitialCreate
```

The name is up to you. EF Core compares the current model to the last known state (nothing, this time) and writes a `Migrations` folder with three files:

```text
Migrations/
  20260914110000_InitialCreate.cs
  20260914110000_InitialCreate.Designer.cs
  AppDbContextModelSnapshot.cs
```

The first file is the migration. The snapshot records the model shape so the next migration can be calculated as a diff. The designer file is metadata. You only ever read the first one.

## What a migration looks like

```csharp
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Categories",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                Name = table.Column<string>(maxLength: 60, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Categories", x => x.Id);
            });

        // CreateTable for Products, foreign key, indexes ...
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "Products");
        migrationBuilder.DropTable(name: "Categories");
    }
}
```

`Up` applies the change. `Down` undoes it. EF Core writes both. It is worth reading `Up` before applying, especially later on, to check it does what you expected.

## Applying it

```bash
dotnet ef database update
```

EF Core connects using the connection string from `appsettings.json`, creates the database if needed, runs every migration that has not been applied yet, and records each one in a table called `__EFMigrationsHistory`. Run it again and nothing happens, because everything is already applied.

## Changing the model

Add a property:

```csharp
public class Product
{
    // existing properties
    public string? Description { get; set; }
}
```

Create and apply a new migration:

```bash
dotnet ef migrations add AddProductDescription
dotnet ef database update
```

The generated `Up` contains a single `AddColumn`. This is the everyday loop: change the classes, add a migration, update the database.

## Rolling back

To undo the last migration on the database, update to the one before it:

```bash
dotnet ef database update InitialCreate
```

Then, if the migration was a mistake, remove the file:

```bash
dotnet ef migrations remove
```

Never delete a migration file by hand once it has been applied somewhere you do not control, such as production. Add a new migration that reverses the change instead.

## Applying migrations on startup

Running `dotnet ef database update` by hand is fine on a dev machine. In hosting environments, many apps apply pending migrations when they start:

```csharp
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}
```

This is convenient for small apps. For larger ones with several server instances, it is safer to run migrations as a separate deployment step, so two instances do not try to migrate at the same time.

## Seeding with HasData

Seed data is the starter rows an app needs to be useful: a list of categories, a default admin role, a set of countries. `HasData` puts them in the model so they become part of a migration:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<Category>().HasData(
        new Category { Id = 1, Name = "Keyboards" },
        new Category { Id = 2, Name = "Mice" },
        new Category { Id = 3, Name = "Monitors" }
    );
}
```

Two rules with `HasData`:

- You must supply the primary key values yourself, because EF Core needs them to tell rows apart in later migrations.
- It is for static reference data. Changing a seeded row means changing the code and creating a migration.

After adding `HasData`, create a migration as usual and the `Up` method will contain `InsertData` calls.

## Seeding with a seeder class

For data that depends on the environment, needs services, or is only for development, write a seeder that runs at startup:

```csharp
public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
        if (await db.Products.AnyAsync())
        {
            return;
        }

        var keyboards = await db.Categories.FirstAsync(c => c.Name == "Keyboards");

        db.Products.AddRange(
            new Product { Name = "Mechanical keyboard", Price = 89.99m, InStock = true, CategoryId = keyboards.Id },
            new Product { Name = "Compact keyboard", Price = 49.99m, InStock = true, CategoryId = keyboards.Id }
        );

        await db.SaveChangesAsync();
    }
}
```

```csharp
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();

    if (app.Environment.IsDevelopment())
    {
        await DbSeeder.SeedAsync(db);
    }
}
```

The `AnyAsync` check makes the seeder safe to run every time the app starts. It only inserts when the table is empty.

## Which approach when

| Need | Use |
| --- | --- |
| Reference data every environment needs | `HasData` |
| Sample data for development only | Seeder class, guarded by environment |
| Data that needs hashing or services, such as an admin user | Seeder class |
| Large data sets | A script or import tool, not migrations |

## Common problems

**"Build failed."** The migration tool builds the project first. Fix the compile error and retry.

**"No DbContext was found."** Run the command from the folder that contains the project file, or pass `--project`.

**"The migration has already been applied."** You edited a migration file after applying it. Roll back, then edit, then update.

**Pending model changes warning.** You changed an entity and forgot to add a migration. Add one.

## Quick recap

- A migration is a C# file describing one schema change, with `Up` to apply and `Down` to undo.
- `dotnet ef migrations add Name` creates one and `dotnet ef database update` applies all pending ones.
- Update to an earlier migration to roll back, and only remove migrations that have not been shared.
- `Database.Migrate()` at startup applies migrations automatically, which suits small apps.
- `HasData` seeds static reference data through migrations, with explicit keys.
- A seeder class with an `AnyAsync` guard handles development data and rows that need services.

<code id="code-content" class="language-csharp">
// Data/AppDbContext.cs (seed reference data with HasData)
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; options) : base(options) { }

    public DbSet&lt;Product&gt; Products =&gt; Set&lt;Product&gt;();
    public DbSet&lt;Category&gt; Categories =&gt; Set&lt;Category&gt;();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity&lt;Product&gt;().Property(p =&gt; p.Price).HasPrecision(10, 2);

        modelBuilder.Entity&lt;Category&gt;().HasData(
            new Category { Id = 1, Name = "Keyboards" },
            new Category { Id = 2, Name = "Mice" },
            new Category { Id = 3, Name = "Monitors" });
    }
}

// Data/DbSeeder.cs (development sample data)
public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
        if (await db.Products.AnyAsync()) return;

        db.Products.AddRange(
            new Product { Name = "Mechanical keyboard", Price = 89.99m, InStock = true, CategoryId = 1 },
            new Product { Name = "Compact keyboard", Price = 49.99m, InStock = true, CategoryId = 1 },
            new Product { Name = "Wireless mouse", Price = 29.99m, InStock = true, CategoryId = 2 },
            new Product { Name = "27 inch monitor", Price = 249.00m, InStock = false, CategoryId = 3 });

        await db.SaveChangesAsync();
    }
}

// Program.cs (apply migrations, then seed in development)
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt;
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService&lt;AppDbContext&gt;();
    await db.Database.MigrateAsync();

    if (app.Environment.IsDevelopment())
    {
        await DbSeeder.SeedAsync(db);
    }
}

app.UseStaticFiles();
app.UseRouting();
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
app.Run();

// Terminal commands
//
//   dotnet ef migrations add InitialCreate
//   dotnet ef database update
//   dotnet ef migrations add AddProductDescription
//   dotnet ef database update
//   dotnet ef database update InitialCreate     (roll back)
//   dotnet ef migrations remove                 (delete the last unapplied migration)
//   dotnet ef migrations list                   (see what is applied)
</code></pre>
