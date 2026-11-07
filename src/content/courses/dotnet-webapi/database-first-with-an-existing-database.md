---
publishDate: 2026-09-11T12:45
title: Database First with an Existing Database
slug: database-first-with-an-existing-database
metadescription: "Use the EF Core Database First approach in ASP.NET Core Web API: scaffold entities and a DbContext from an existing database with dotnet ef dbcontext scaffold, return DTOs instead of generated entities, re-scaffold after schema changes and extend partial classes safely."
updateDate: 2026-09-07T12:45
author: ['bishal-biswas']
level: 2
tags: ['ef-core', 'database-first', 'scaffolding']
course: dotnet-webapi
---

## Code First or Database First

Up to now this course has used **Code First**. You wrote `Book` and `Author` in C#, and [migrations](/courses/dotnet-webapi/migrations-and-database-updates) built the tables from them.

APIs are often built on top of a database that already exists. A company database that other apps share, a schema a DBA owns, or a legacy system you are putting an API in front of. You are not allowed to change those tables from your code. You need C# classes that match them.

That is **Database First**. EF Core connects to the database, reads its tables, columns, keys and foreign keys, and writes the entity classes and the `DbContext` for you. This is called **scaffolding** or **reverse engineering**.

| | Code First | Database First |
| --- | --- | --- |
| Source of truth | Your C# classes | The database schema |
| Schema changes come from | Your migrations | SQL run by someone else |
| Keeping C# in sync | Edit classes, add a migration | Run the scaffold command again |
| Typical use | New services you own | Existing or shared databases |

After scaffolding, nothing else changes. [CRUD Operations with EF Core](/courses/dotnet-webapi/crud-operations-with-ef-core), LINQ, the change tracker and `SaveChangesAsync` all work the same way.

## The existing database

Here is the schema the library team already runs in SQL Server:

```sql
CREATE TABLE Authors (
    AuthorId INT IDENTITY(1,1) CONSTRAINT PK_Authors PRIMARY KEY,
    FullName NVARCHAR(120) NOT NULL
);

CREATE TABLE Books (
    BookId    INT IDENTITY(1,1) CONSTRAINT PK_Books PRIMARY KEY,
    Title     NVARCHAR(200) NOT NULL,
    Isbn      NCHAR(13) NULL,
    Price     DECIMAL(10, 2) NOT NULL,
    Published DATE NULL,
    AuthorId  INT NOT NULL
        CONSTRAINT FK_Books_Authors REFERENCES Authors (AuthorId)
);
```

## Tools and packages

The same ones from [Entity Framework Core Setup](/courses/dotnet-webapi/entity-framework-core-setup):

```bash
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet tool install --global dotnet-ef
```

Then put the connection string in `appsettings.json` (or in [user secrets](/courses/dotnet-webapi/configuration-and-appsettings) if it has a password):

```json
{
  "ConnectionStrings": {
    "Default": "Server=(localdb)\\mssqllocaldb;Database=LibraryDb;Trusted_Connection=True;TrustServerCertificate=True"
  }
}
```

## Scaffold it

Run this in the API project folder:

```bash
dotnet ef dbcontext scaffold Name=ConnectionStrings:Default Microsoft.EntityFrameworkCore.SqlServer --output-dir Entities --context-dir Data --context LibraryContext --no-onconfiguring
```

What each part does:

- `Name=ConnectionStrings:Default` reads the connection string from configuration, so it never appears in the command or the code.
- `Microsoft.EntityFrameworkCore.SqlServer` is the provider. Use `Npgsql.EntityFrameworkCore.PostgreSQL` or `Microsoft.EntityFrameworkCore.Sqlite` for those databases.
- `--output-dir Entities` puts the entity classes in their own folder, away from your DTOs.
- `--context-dir Data --context LibraryContext` names the context and its folder.
- `--no-onconfiguring` skips the `OnConfiguring` method. You register the context in `Program.cs`, so it is not needed.

You get:

```text
Data/
  LibraryContext.cs
Entities/
  Author.cs
  Book.cs
```

## The generated code

```csharp
public partial class Book
{
    public int BookId { get; set; }

    public string Title { get; set; } = null!;

    public string? Isbn { get; set; }

    public decimal Price { get; set; }

    public DateOnly? Published { get; set; }

    public int AuthorId { get; set; }

    public virtual Author Author { get; set; } = null!;
}
```

Nullable columns become nullable types (`string?`, `DateOnly?`). `DATE` maps to `DateOnly`. The foreign key gets an `Author` navigation, and `Author` gets a `Books` collection.

The context keeps the column details:

```csharp
public partial class LibraryContext : DbContext
{
    public LibraryContext(DbContextOptions<LibraryContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Author> Authors { get; set; }

    public virtual DbSet<Book> Books { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Book>(entity =>
        {
            entity.Property(e => e.Isbn)
                .HasMaxLength(13)
                .IsFixedLength();
            entity.Property(e => e.Price).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.Title).HasMaxLength(200);

            entity.HasOne(d => d.Author).WithMany(p => p.Books)
                .HasForeignKey(d => d.AuthorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Books_Authors");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
```

Add `--data-annotations` to the command if you want `[Key]`, `[StringLength]` and similar attributes on the classes instead. Settings that have no attribute stay in `OnModelCreating`.

## Register it and return DTOs

Registration is the same as Code First:

```csharp
builder.Services.AddDbContext<LibraryContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
```

In an API there is one extra rule that matters a lot with scaffolded classes: **do not return the entities directly**. `Book` points to `Author`, and `Author` has a list of `Book`. If you load both and return them, `System.Text.Json` follows the loop and throws "A possible object cycle was detected". It would also expose every column the DBA ever adds.

Project into a [DTO](/courses/dotnet-webapi/dtos-and-why-you-need-them) instead:

```csharp
public record BookDto(int Id, string Title, decimal Price, string Author);

[ApiController]
[Route("api/books")]
public class BooksController : ControllerBase
{
    private readonly LibraryContext _db;

    public BooksController(LibraryContext db) => _db = db;

    [HttpGet]
    public async Task<IEnumerable<BookDto>> GetAll() =>
        await _db.Books
            .AsNoTracking()
            .OrderBy(b => b.Title)
            .Select(b => new BookDto(b.BookId, b.Title, b.Price, b.Author.FullName))
            .ToListAsync();
}
```

`Select` turns into a SQL query that reads only those four columns, with the join done in the database. Your API contract now stays the same even when the table grows.

## Only the tables you need

Use `--table` once per table, or `--schema` for a whole schema:

```bash
dotnet ef dbcontext scaffold Name=ConnectionStrings:Default Microsoft.EntityFrameworkCore.SqlServer --output-dir Entities --context-dir Data --context LibraryContext --no-onconfiguring --table Books --table Authors
```

This keeps the context small when the database is shared with many other systems.

## When the schema changes

The DBA adds a `PageCount` column. Run the same command again with `--force`:

```bash
dotnet ef dbcontext scaffold Name=ConnectionStrings:Default Microsoft.EntityFrameworkCore.SqlServer --output-dir Entities --context-dir Data --context LibraryContext --no-onconfiguring --force
```

That is the whole Database First loop: **the database changes first, then you re-scaffold**. There are no migrations, because your code never changes the schema.

`--force` overwrites the generated files completely, so any edit inside them is lost. Save the full command as a script in the repo, such as `scaffold.ps1`, so the whole team uses the same options every time.

## Extending generated classes

The generated classes are `partial`. Add your own members in a separate file with the same class name and namespace:

```csharp
// Entities/Partials/Book.cs (yours, never overwritten)
public partial class Book
{
    public bool IsClassic => Published is { } date && date.Year < 1950;
}
```

A property with only a getter is not mapped, so EF Core ignores it.

Extra model configuration goes in the `OnModelCreatingPartial` hook, written in your own partial context file:

```csharp
// Data/LibraryContext.Custom.cs (yours, never overwritten)
public partial class LibraryContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Book>()
            .HasIndex(b => b.Isbn)
            .HasDatabaseName("IX_Books_Isbn");
    }
}
```

Re-scaffolding only overwrites the files it generates, so both of these survive.

## The context in another project

In a larger solution, the context often lives in a class library such as `Library.Data`. Point the tool at both projects. The startup project is where the configuration and connection string live:

```bash
dotnet ef dbcontext scaffold Name=ConnectionStrings:Default Microsoft.EntityFrameworkCore.SqlServer --project ../Library.Data --startup-project . --output-dir Entities --context-dir . --context LibraryContext --no-onconfiguring
```

The `Design` package must be installed in the startup project.

## Moving to migrations later

If your team takes over the schema for good, you can switch to Code First. Create a first migration and empty it, because the tables already exist:

```bash
dotnet ef migrations add InitialCreate
```

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    // Baseline: these tables already exist in the database.
}

protected override void Down(MigrationBuilder migrationBuilder)
{
}
```

```bash
dotnet ef database update
```

This only records `InitialCreate` in `__EFMigrationsHistory`. From then on, change the classes and add migrations, and stop scaffolding. Never do both at once. If anyone still changes the schema by hand, stay with Database First.

## Common problems

**"Build failed."** The tool compiles the project before scaffolding. Fix any compile error, including in your partial files.

**"A possible object cycle was detected."** You returned scaffolded entities with their navigation properties loaded. Return DTOs.

**"Unable to find provider assembly."** The provider package is not installed in the startup project.

**Some tables are missing.** Tables without a primary key are skipped with a warning. If you only read from such a table or view, map it with `HasNoKey()` in `OnModelCreatingPartial`.

**Edits disappeared after re-scaffolding.** They were inside a generated file. Move them into a partial file.

## Quick recap

- Database First generates C# from the database. Code First generates the database from C#.
- `dotnet ef dbcontext scaffold` writes the entity classes and the `DbContext`.
- Use `Name=ConnectionStrings:Default` and `--no-onconfiguring` to keep connection strings out of code.
- In an API, return DTOs, never the scaffolded entities.
- Re-scaffold with `--force` when the schema changes, and keep a script for the command.
- Put your own code in separate `partial` files and in `OnModelCreatingPartial`.
- Use `--project` and `--startup-project` when the context lives in a class library.
- You can switch to migrations later with an empty baseline migration.

<code id="code-content" class="language-csharp">
// Terminal: scaffold the existing LibraryDb database (rerun with --force after schema changes)
//
//   dotnet ef dbcontext scaffold Name=ConnectionStrings:Default
//     Microsoft.EntityFrameworkCore.SqlServer --output-dir Entities --context-dir Data
//     --context LibraryContext --no-onconfiguring --force
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
// ---------- Program.cs
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddDbContext&lt;LibraryContext&gt;(options =&gt;
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
var app = builder.Build();
app.MapControllers();
app.Run();
// ---------- Entities/Book.cs and Entities/Author.cs (generated, do not edit)
public partial class Book
{
    public int BookId { get; set; }
    public string Title { get; set; } = null!;
    public string? Isbn { get; set; }
    public decimal Price { get; set; }
    public DateOnly? Published { get; set; }
    public int AuthorId { get; set; }
    public virtual Author Author { get; set; } = null!;
}
public partial class Author
{
    public int AuthorId { get; set; }
    public string FullName { get; set; } = null!;
    public virtual ICollection&lt;Book&gt; Books { get; set; } = new List&lt;Book&gt;();
}
// ---------- Data/LibraryContext.cs (generated, do not edit)
public partial class LibraryContext : DbContext
{
    public LibraryContext(DbContextOptions&lt;LibraryContext&gt; options) : base(options) { }
    public virtual DbSet&lt;Author&gt; Authors { get; set; }
    public virtual DbSet&lt;Book&gt; Books { get; set; }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity&lt;Author&gt;(entity =&gt;
        {
            entity.Property(e =&gt; e.FullName).HasMaxLength(120);
        });
        modelBuilder.Entity&lt;Book&gt;(entity =&gt;
        {
            entity.Property(e =&gt; e.Isbn).HasMaxLength(13).IsFixedLength();
            entity.Property(e =&gt; e.Price).HasColumnType("decimal(10, 2)");
            entity.Property(e =&gt; e.Title).HasMaxLength(200);
            entity.HasOne(d =&gt; d.Author).WithMany(p =&gt; p.Books)
                .HasForeignKey(d =&gt; d.AuthorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Books_Authors");
        });
        OnModelCreatingPartial(modelBuilder);
    }
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
// ---------- Entities/Partials/Book.cs (yours, survives re-scaffolding)
public partial class Book
{
    public bool IsClassic =&gt; Published is { } date &amp;&amp; date.Year &lt; 1950;
}
// ---------- Data/LibraryContext.Custom.cs (yours, survives re-scaffolding)
public partial class LibraryContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity&lt;Book&gt;().HasIndex(b =&gt; b.Isbn).HasDatabaseName("IX_Books_Isbn");
    }
}
// ---------- Dtos/BookDto.cs: never return scaffolded entities from the API
public record BookDto(int Id, string Title, decimal Price, string Author);
// ---------- Controllers/BooksController.cs
[ApiController]
[Route("api/books")]
public class BooksController : ControllerBase
{
    private readonly LibraryContext _db;
    public BooksController(LibraryContext db) =&gt; _db = db;
    [HttpGet]
    public async Task&lt;IEnumerable&lt;BookDto&gt;&gt; GetAll() =&gt;
        await _db.Books
            .AsNoTracking()
            .OrderBy(b =&gt; b.Title)
            .Select(b =&gt; new BookDto(b.BookId, b.Title, b.Price, b.Author.FullName))
            .ToListAsync();
    [HttpGet("{id:int}")]
    public async Task&lt;ActionResult&lt;BookDto&gt;&gt; GetById(int id)
    {
        var book = await _db.Books
            .AsNoTracking()
            .Where(b =&gt; b.BookId == id)
            .Select(b =&gt; new BookDto(b.BookId, b.Title, b.Price, b.Author.FullName))
            .FirstOrDefaultAsync();
        return book is null ? NotFound() : book;
    }
}
</code></pre>
