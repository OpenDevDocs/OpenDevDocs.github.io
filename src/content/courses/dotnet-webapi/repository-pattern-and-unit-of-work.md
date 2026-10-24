---
publishDate: 2026-09-12T13:10
title: Repository Pattern and Unit of Work
slug: repository-pattern-and-unit-of-work
metadescription: Build a repository and unit of work over EF Core, see the generic repository trap, and understand the honest argument for skipping the pattern entirely.
updateDate: 2026-09-07T13:10
author: ['bishal-biswas']
level: 3
tags: ['repository', 'architecture', 'ef-core']
course: dotnet-webapi
---

## What a repository is

A **repository** is a class that hides how data is stored. Callers ask for objects. They do not know whether the data came from SQL Server, a file or an HTTP call.

```csharp
public interface IBookRepository
{
    Task<Book?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<IReadOnlyList<Book>> GetByAuthorAsync(int authorId, CancellationToken ct = default);
    Task AddAsync(Book book, CancellationToken ct = default);
    void Remove(Book book);
}
```

Nothing in that interface mentions EF Core, LINQ or SQL. That is the whole idea.

## The honest starting point

Before building one, you should know the argument against it, because it is a good argument.

**`DbContext` is already a unit of work. `DbSet<T>` is already a repository.** That is not an analogy, it is what Microsoft says in the EF Core documentation. `DbSet<T>` is a collection you query and add to. `SaveChanges` commits everything at once.

So a repository over EF Core is a layer over a layer. It can still earn its place, but it has to earn it.

## When it earns its place

**You need to unit test without a database.** A fake repository is a `List<T>` in memory. Testing against a real `DbContext` means the in memory provider, which behaves differently from SQL in ways that hide bugs, or a container, which is slower.

**You want complex queries named and reused.** `GetActiveSubscribersWithOverdueInvoicesAsync()` is a better thing to call from three places than the same twelve line LINQ query copied three times.

**Your domain layer must not reference EF Core.** In a clean architecture, the core project defines `IBookRepository` and the infrastructure project implements it. The dependency points inward.

**You might genuinely swap the data store.** Rare, and usually cited more than it happens. Take it seriously only if there is a real plan.

## When to skip it

**Small or medium API, one data store, no plan to change.** Inject `AppDbContext` into your service and write LINQ. You lose nothing and you keep every EF Core feature.

**You would only write a generic pass through.** More on that below.

**Your team already knows EF Core well.** The abstraction hides tools they know how to use.

## The generic repository trap

Almost everyone writes this first:

```csharp
public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(int id);
    Task<IEnumerable<T>> GetAllAsync();
    Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate);
    Task AddAsync(T entity);
    void Update(T entity);
    void Remove(T entity);
}
```

It looks tidy and it causes three problems.

**It leaks the abstraction.** `FindAsync(Expression<Func<T, bool>>)` is just `Where`. The caller is still writing LINQ against your entities, so you have not hidden the data layer at all. You have renamed it.

**It cannot express what EF Core can.** Where do `Include`, `AsNoTracking`, `AsSplitQuery`, projections, `ExecuteUpdate` and raw SQL go? Either you add methods until the interface mirrors `DbSet<T>`, or callers lose those features and performance suffers.

**`GetAllAsync` invites disaster.** Someone will call it on a table with two million rows.

If you build repositories, make them **specific**. One per aggregate, with methods named after what the application actually needs:

```csharp
public interface IBookRepository
{
    Task<Book?> GetWithReviewsAsync(int id, CancellationToken ct = default);
    Task<IReadOnlyList<BookListItem>> SearchAsync(BookSearchCriteria criteria, CancellationToken ct = default);
    Task<bool> IsbnExistsAsync(string isbn, CancellationToken ct = default);
    Task AddAsync(Book book, CancellationToken ct = default);
}
```

Every method is a sentence about the business. `Include` and `AsNoTracking` live inside the implementation, where they belong.

## Unit of work

A **unit of work** keeps several repository operations in one transaction. Without it, each repository calling its own `SaveChanges` means partial writes are possible.

```csharp
public interface IUnitOfWork
{
    IBookRepository Books { get; }
    IAuthorRepository Authors { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
```

```csharp
await unitOfWork.Books.AddAsync(book);
await unitOfWork.Authors.AddAsync(author);
await unitOfWork.SaveChangesAsync();       // both, or neither
```

The key design rule: **repositories never call `SaveChanges`**. They add, remove and query. Only the unit of work commits. That is what makes the transaction boundary explicit and controllable.

The implementation is thin, because every repository shares the same `DbContext`, and EF Core's change tracker does the actual work:

```csharp
public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext db;

    public UnitOfWork(AppDbContext db)
    {
        this.db = db;
        Books = new BookRepository(db);
        Authors = new AuthorRepository(db);
    }

    public IBookRepository Books { get; }
    public IAuthorRepository Authors { get; }

    public Task<int> SaveChangesAsync(CancellationToken ct = default)
        => db.SaveChangesAsync(ct);
}
```

## Registering them

```csharp
builder.Services.AddScoped<IBookRepository, BookRepository>();
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
```

**Scoped**, matching the `DbContext` lifetime. A singleton repository would capture a scoped context, which is the captive dependency bug.

## Do not return IQueryable

A repository that returns `IQueryable<T>` has abstracted nothing:

```csharp
// The caller can still write any LINQ, and the query runs outside the repository
IQueryable<Book> GetAll();
```

Now the calling code decides tracking, includes and when the query executes. Worse, the query might run after the `DbContext` is disposed. Return `IReadOnlyList<T>`, a single entity, or a DTO. Something already materialised.

## Testing, which is the main payoff

With a specific repository interface, a test needs no database and no mocking framework:

```csharp
public class FakeBookRepository : IBookRepository
{
    public List<Book> Items { get; } = new();

    public Task<Book?> GetWithReviewsAsync(int id, CancellationToken ct = default)
        => Task.FromResult(Items.FirstOrDefault(b => b.Id == id));

    public Task<bool> IsbnExistsAsync(string isbn, CancellationToken ct = default)
        => Task.FromResult(Items.Any(b => b.Isbn == isbn));

    public Task AddAsync(Book book, CancellationToken ct = default)
    {
        book.Id = Items.Count + 1;
        Items.Add(book);
        return Task.CompletedTask;
    }
    // ...
}
```

```csharp
[Fact]
public async Task Create_rejects_a_duplicate_isbn()
{
    var repo = new FakeBookRepository();
    repo.Items.Add(new Book { Isbn = "9780132350884" });

    var service = new BookService(repo, new FakeUnitOfWork());

    Result result = await service.CreateAsync(new CreateBookRequest("x", "9780132350884"));

    Assert.False(result.Success);
}
```

Milliseconds, no container, no in memory provider quirks. That is the payoff, and it is a real one.

## The pragmatic middle ground

Many teams land here, and it is a sensible place to stop.

**Inject `AppDbContext` into services directly.** Write LINQ where it reads well.

**Extract a specific repository only when it earns it:** the query is complex, it is reused in several places, or the service around it is worth unit testing without a database.

**Never write a generic repository over EF Core.** If a repository does nothing except forward to `DbSet<T>`, delete it.

The point of the pattern is not to have a `Repositories` folder. It is to name the queries your application actually needs, in one place, and to make the code around them testable. When it does that, keep it. When it does not, it is ceremony.

## Quick recap

- A repository hides the data store behind an interface expressed in your own vocabulary.
- `DbContext` is already a unit of work and `DbSet<T>` is already a repository, so a layer on top must justify itself.
- The strongest reasons are unit testing without a database, naming reused queries, and keeping EF Core out of a domain project.
- A generic `IRepository<T>` leaks LINQ, cannot express `Include` or projections, and invites `GetAllAsync` on huge tables.
- Prefer specific repositories with methods named after what the application does.
- Repositories never call `SaveChanges`. Only the unit of work commits, so the transaction boundary is explicit.
- Register both as **scoped**, matching the `DbContext`.
- Never return `IQueryable`. Return materialised results.
- If a repository only forwards to `DbSet<T>`, it is ceremony. Delete it and inject the context.

<code id="code-content" class="language-csharp">
// A specific repository and unit of work over EF Core, done the way that pays off.
using Microsoft.EntityFrameworkCore;
// ---------- Interfaces. No EF Core here, so a domain project can own these.
public interface IBookRepository
{
    Task&lt;Book?&gt; GetWithReviewsAsync(int id, CancellationToken ct = default);
    Task&lt;IReadOnlyList&lt;BookListItem&gt;&gt; SearchAsync(string? title, int page, int size, CancellationToken ct = default);
    Task&lt;bool&gt; IsbnExistsAsync(string isbn, CancellationToken ct = default);
    Task AddAsync(Book book, CancellationToken ct = default);
    void Remove(Book book);
    // Note what is NOT here: no GetAllAsync, no IQueryable, no Expression&lt;Func&lt;&gt;&gt;.
    // Every method is a sentence about what the application needs.
}
public interface IUnitOfWork
{
    IBookRepository Books { get; }
    IAuthorRepository Authors { get; }
    Task&lt;int&gt; SaveChangesAsync(CancellationToken ct = default);
}
public interface IAuthorRepository
{
    Task&lt;Author?&gt; GetByIdAsync(int id, CancellationToken ct = default);
    Task AddAsync(Author author, CancellationToken ct = default);
}
// ---------- Implementation. All the EF Core detail lives in here.
public class BookRepository : IBookRepository
{
    private readonly AppDbContext db;
    public BookRepository(AppDbContext db) =&gt; this.db = db;
    // Include lives inside the repository, where it belongs
    public Task&lt;Book?&gt; GetWithReviewsAsync(int id, CancellationToken ct = default) =&gt;
        db.Books
          .Include(b =&gt; b.Reviews)
          .FirstOrDefaultAsync(b =&gt; b.Id == id, ct);
    // Returns a materialised list, never IQueryable. The caller cannot change the query.
    public async Task&lt;IReadOnlyList&lt;BookListItem&gt;&gt; SearchAsync(
        string? title, int page, int size, CancellationToken ct = default)
    {
        IQueryable&lt;Book&gt; query = db.Books.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(title))
            query = query.Where(b =&gt; b.Title.Contains(title));
        return await query
            .OrderBy(b =&gt; b.Title)
            .Skip((page - 1) * size).Take(size)
            .Select(b =&gt; new BookListItem(b.Id, b.Title, b.Price))
            .ToListAsync(ct);
    }
    public Task&lt;bool&gt; IsbnExistsAsync(string isbn, CancellationToken ct = default) =&gt;
        db.Books.AnyAsync(b =&gt; b.Isbn == isbn, ct);
    // Add and Remove only. NO SaveChanges: the unit of work owns the transaction.
    public async Task AddAsync(Book book, CancellationToken ct = default) =&gt;
        await db.Books.AddAsync(book, ct);
    public void Remove(Book book) =&gt; db.Books.Remove(book);
}
public class AuthorRepository : IAuthorRepository
{
    private readonly AppDbContext db;
    public AuthorRepository(AppDbContext db) =&gt; this.db = db;
    public Task&lt;Author?&gt; GetByIdAsync(int id, CancellationToken ct = default) =&gt;
        db.Authors.FirstOrDefaultAsync(a =&gt; a.Id == id, ct);
    public async Task AddAsync(Author author, CancellationToken ct = default) =&gt;
        await db.Authors.AddAsync(author, ct);
}
// Thin, because every repository shares one DbContext and its change tracker
public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext db;
    public UnitOfWork(AppDbContext db)
    {
        this.db  = db;
        Books    = new BookRepository(db);
        Authors  = new AuthorRepository(db);
    }
    public IBookRepository Books { get; }
    public IAuthorRepository Authors { get; }
    public Task&lt;int&gt; SaveChangesAsync(CancellationToken ct = default) =&gt; db.SaveChangesAsync(ct);
}
// ---------- The service: pure business logic, no EF Core, easy to unit test
public class BookService
{
    private readonly IUnitOfWork uow;
    public BookService(IUnitOfWork uow) =&gt; this.uow = uow;
    public async Task&lt;(bool Success, string? Error, int Id)&gt; CreateAsync(
        string title, string isbn, int authorId, CancellationToken ct = default)
    {
        if (await uow.Books.IsbnExistsAsync(isbn, ct))
            return (false, $"ISBN {isbn} already exists.", 0);
        if (await uow.Authors.GetByIdAsync(authorId, ct) is null)
            return (false, $"Author {authorId} does not exist.", 0);
        var book = new Book { Title = title, Isbn = isbn, AuthorId = authorId };
        await uow.Books.AddAsync(book, ct);
        // One commit for everything above. Both repositories, one transaction.
        await uow.SaveChangesAsync(ct);
        return (true, null, book.Id);
    }
}
// ---------- Registration: scoped, matching the DbContext lifetime.
// A singleton here would capture a scoped DbContext, which is the captive dependency bug.
// builder.Services.AddScoped&lt;IBookRepository, BookRepository&gt;();
// builder.Services.AddScoped&lt;IUnitOfWork, UnitOfWork&gt;();
// builder.Services.AddScoped&lt;BookService&gt;();
public class Book
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Isbn { get; set; } = "";
    public decimal Price { get; set; }
    public int AuthorId { get; set; }
    public List&lt;Review&gt; Reviews { get; set; } = new();
}
public class Author { public int Id { get; set; } public string Name { get; set; } = ""; }
public class Review { public int Id { get; set; } public int Rating { get; set; } }
public record BookListItem(int Id, string Title, decimal Price);
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;Book&gt; Books =&gt; Set&lt;Book&gt;();
    public DbSet&lt;Author&gt; Authors =&gt; Set&lt;Author&gt;();
}
</code></pre>
