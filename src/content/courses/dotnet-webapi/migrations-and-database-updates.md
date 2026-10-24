---
publishDate: 2026-09-11T12:40
title: Migrations and Database Updates
slug: migrations-and-database-updates
metadescription: Create, apply, inspect and revert EF Core migrations, understand what the generated files contain, and learn how to apply schema changes safely in production.
updateDate: 2026-09-07T12:40
author: ['bishal-biswas']
level: 2
tags: ['ef-core', 'migrations', 'database']
course: dotnet-webapi
---

## What a migration is

Your entity classes describe the shape you want. The database has the shape it currently has. A **migration** is the set of steps that gets from one to the other.

Migrations are files in your repository, so schema changes are reviewed, versioned and deployed like any other code.

## Your first migration

With your context and entities in place:

```bash
dotnet ef migrations add InitialCreate
```

Three files appear under a `Migrations` folder:

```text
Migrations/
├── 20260907124000_InitialCreate.cs             the Up and Down steps
├── 20260907124000_InitialCreate.Designer.cs    a model snapshot for this migration
└── AppDbContextModelSnapshot.cs                the current model, used to diff the next one
```

The timestamp prefix keeps them in order. Never rename these files.

## What is inside

```csharp
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Books",
            columns: table => new
            {
                Id = table.Column<int>(nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                Title = table.Column<string>(maxLength: 200, nullable: false),
                Year = table.Column<int>(nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_Books", x => x.Id));

        migrationBuilder.CreateIndex(
            name: "IX_Books_Isbn",
            table: "Books",
            column: "Isbn",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "Books");
    }
}
```

`Up` applies the change. `Down` reverses it. Both are generated, and both are ordinary C# you can edit.

The **model snapshot** is the important file people miss. EF Core generates the next migration by comparing your entities against the snapshot, not against the real database. That is why deleting or hand editing the snapshot causes strange, duplicated migrations.

## Applying it

```bash
dotnet ef database update
```

This runs every pending migration in order and records each one in a table called `__EFMigrationsHistory`. That table is how EF Core knows what has already run, so applying twice is safe.

## The commands you will use

```bash
# Create a migration
dotnet ef migrations add AddPublisherTable

# Apply everything pending
dotnet ef database update

# Apply up to a specific migration
dotnet ef database update AddPublisherTable

# List migrations and whether they are applied
dotnet ef migrations list

# Delete the most recent migration (only if it is not applied yet)
dotnet ef migrations remove

# Preview the SQL without running it
dotnet ef migrations script

# Script only the range you are deploying
dotnet ef migrations script AddPublisherTable AddIsbnIndex

# Script safely for any starting point
dotnet ef migrations script --idempotent --output migrate.sql

# Drop the whole database
dotnet ef database drop
```

If your context lives in a different project from the startup project, point the tool at both:

```bash
dotnet ef migrations add Init --project ../Shop.Data --startup-project .
```

## Reverting

To undo the last migration in your **development** database, update to the one before it, then remove the file:

```bash
dotnet ef database update PreviousMigrationName
dotnet ef migrations remove
```

To undo everything:

```bash
dotnet ef database update 0
```

`migrations remove` refuses to delete a migration that has been applied, which is a helpful safety net.

## Name migrations like commits

`Migration1` tells nobody anything. Six months later you will be reading these names in a deployment log:

```bash
dotnet ef migrations add AddIsbnUniqueIndex
dotnet ef migrations add AddSoftDeleteToBooks
dotnet ef migrations add SplitCustomerNameIntoFirstAndLast
```

## Applying migrations in production

You have three options, and the difference matters.

**`Database.Migrate()` at startup.** Convenient and tempting:

```csharp
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}
```

Fine for a demo or a single instance internal tool. Bad for real production: your app needs schema altering database permissions, and if you run several instances they will all try to migrate at once during a rolling deploy.

**A generated SQL script.** The safest and most common approach:

```bash
dotnet ef migrations script --idempotent --output migrate.sql
```

`--idempotent` wraps every step in a check, so the script is safe to run whatever state the database is in. A DBA can read it before it runs, and it fits into any deployment pipeline.

**A separate migration step in your pipeline.** Run `dotnet ef database update` as its own job before the new application version starts. This keeps the permissions and the timing under your control.

Use `EnsureCreated()` for nothing except throwaway test databases. It creates the schema without migrations, and the two cannot be mixed afterwards.

## Making changes safely

A migration that works on an empty development database can lock a production table for minutes or drop data. Some rules that prevent the common accidents.

**Adding a non nullable column to a table with rows will fail** unless you supply a default:

```csharp
migrationBuilder.AddColumn<bool>(
    name: "IsActive",
    table: "Books",
    nullable: false,
    defaultValue: true);
```

**Renaming a property generates a drop and an add**, which throws the data away. Check the generated migration and replace it with a rename:

```csharp
// What EF Core may generate
migrationBuilder.DropColumn(name: "Name", table: "Customers");
migrationBuilder.AddColumn<string>(name: "FullName", table: "Customers");

// What you want instead
migrationBuilder.RenameColumn(
    name: "Name", table: "Customers", newName: "FullName");
```

Always read the generated migration before applying it. This is the single habit that prevents most data loss.

**Splitting a column needs three deployments.** Add the new columns, deploy code that writes both, backfill the data, then drop the old column in a later migration. Trying to do it in one step breaks whichever version of the app is running at the wrong moment.

## Custom SQL in a migration

For a data backfill or something EF Core cannot express:

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.AddColumn<string>(
        name: "Slug", table: "Books", nullable: true);

    migrationBuilder.Sql(@"
        UPDATE Books
        SET Slug = LOWER(REPLACE(Title, ' ', '-'))
        WHERE Slug IS NULL;");
}
```

## Fixing a broken migration state

Two problems come up often.

**You created a migration you have not applied and no longer want.** Run `dotnet ef migrations remove`.

**You applied a migration and need to undo it.** Update to the previous migration first, then remove.

**Someone deleted the snapshot, or two branches both added migrations.** The reliable fix on a feature branch is to delete the unapplied migration files, reset your development database, and regenerate. Never do this to migrations that are already applied in a shared environment.

## Team workflow

Two people adding migrations on separate branches will conflict in the snapshot file. That conflict is not resolvable by merging text.

The workflow that works: whoever merges second deletes their own migration, pulls the merged main branch, and regenerates it. Because the snapshot is now up to date, the regenerated migration contains only their change.

## Quick recap

- A migration is versioned C# describing how to move the schema forward and back.
- `dotnet ef migrations add Name` then `dotnet ef database update` is the everyday loop.
- The model snapshot is what EF Core diffs against. Do not hand edit or delete it.
- `__EFMigrationsHistory` records what has run, so updates are safe to repeat.
- Name migrations descriptively. You will read them in deployment logs.
- Prefer `--idempotent` scripts or a dedicated pipeline step over `Database.Migrate()` at startup.
- Always read the generated migration. A rename can appear as a drop and an add, which destroys data.
- Adding a non nullable column to a populated table needs a default value.
- Snapshot conflicts between branches are fixed by regenerating, not by merging.

<code id="code-content" class="language-csharp">
// Migrations: what the files look like, and how to apply them safely.
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
// ---------- 20260907124000_AddIsbnAndSlug.cs (generated, then reviewed by you)
public partial class AddIsbnAndSlug : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Adding a non nullable column to a table with rows REQUIRES a default,
        // otherwise the migration fails on any non empty database.
        migrationBuilder.AddColumn&lt;string&gt;(
            name: "Isbn", table: "Books",
            type: "nchar(13)", nullable: false, defaultValue: "");
        migrationBuilder.AddColumn&lt;string&gt;(
            name: "Slug", table: "Books",
            type: "nvarchar(220)", nullable: true);
        // EF Core generated a DropColumn + AddColumn for this rename, which would
        // have thrown the data away. Replaced by hand with a real rename.
        migrationBuilder.RenameColumn(
            name: "Name", table: "Authors", newName: "FullName");
        // Backfill the new column for existing rows
        migrationBuilder.Sql(@"
            UPDATE Books
            SET Slug = LOWER(REPLACE(Title, ' ', '-'))
            WHERE Slug IS NULL;");
        migrationBuilder.CreateIndex(
            name: "IX_Books_Isbn", table: "Books",
            column: "Isbn", unique: true,
            filter: "[Isbn] &lt;&gt; ''");     // skip the placeholder rows in the unique check
    }
    // Down must genuinely reverse Up, or "database update PreviousName" will fail
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_Books_Isbn", table: "Books");
        migrationBuilder.RenameColumn(name: "FullName", table: "Authors", newName: "Name");
        migrationBuilder.DropColumn(name: "Slug", table: "Books");
        migrationBuilder.DropColumn(name: "Isbn", table: "Books");
    }
}
// ---------- Program.cs: applying migrations, with the caveats made explicit
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt;
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
var app = builder.Build();
// Migrate at startup ONLY in development. In production this needs schema
// altering permissions, and several instances would race during a rolling deploy.
// Production should run:  dotnet ef migrations script --idempotent --output migrate.sql
if (app.Environment.IsDevelopment())
{
    using IServiceScope scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService&lt;AppDbContext&gt;();
    // Migrate() applies pending migrations. EnsureCreated() does NOT use migrations
    // at all, and the two cannot be mixed. Use EnsureCreated only for throwaway tests.
    await db.Database.MigrateAsync();
    var pending = await db.Database.GetPendingMigrationsAsync();
    var applied = await db.Database.GetAppliedMigrationsAsync();
    app.Logger.LogInformation("Migrations applied: {Applied}, pending: {Pending}",
        applied.Count(), pending.Count());
}
// A readiness endpoint that refuses traffic while the schema is behind
app.MapGet("/ready", async (AppDbContext db) =&gt;
{
    var pending = await db.Database.GetPendingMigrationsAsync();
    return pending.Any()
        ? Results.Problem($"{pending.Count()} migration(s) pending.", statusCode: 503)
        : Results.Ok(new { status = "ready" });
});
app.Run();
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; options) : base(options) { }
    public DbSet&lt;Book&gt;   Books   =&gt; Set&lt;Book&gt;();
    public DbSet&lt;Author&gt; Authors =&gt; Set&lt;Author&gt;();
}
public class Book   { public int Id { get; set; } public string Title { get; set; } = "";
                      public string Isbn { get; set; } = ""; public string? Slug { get; set; } }
public class Author { public int Id { get; set; } public string FullName { get; set; } = ""; }
</code></pre>
