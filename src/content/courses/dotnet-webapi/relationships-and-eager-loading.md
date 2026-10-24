---
publishDate: 2026-09-12T13:00
title: Relationships and Eager Loading
slug: relationships-and-eager-loading
metadescription: Model one to many, many to many and one to one relationships in EF Core, then load related data efficiently with Include, ThenInclude, split queries and projections.
updateDate: 2026-09-07T13:00
author: ['bishal-biswas']
level: 3
tags: ['ef-core', 'relationships', 'performance']
course: dotnet-webapi
---

## One to many

The most common relationship. One author has many books.

```csharp
public class Author
{
    public int Id { get; set; }
    public string Name { get; set; } = "";

    public List<Book> Books { get; set; } = new();      // the "many" side
}

public class Book
{
    public int Id { get; set; }
    public string Title { get; set; } = "";

    public int AuthorId { get; set; }                   // foreign key
    public Author Author { get; set; } = null!;         // the "one" side
}
```

EF Core works this out from conventions alone: `AuthorId` matches the `Author` navigation, so it becomes the foreign key.

To be explicit, or to change the delete behaviour, use the Fluent API:

```csharp
modelBuilder.Entity<Book>()
    .HasOne(b => b.Author)
    .WithMany(a => a.Books)
    .HasForeignKey(b => b.AuthorId)
    .OnDelete(DeleteBehavior.Restrict);
```

**Delete behaviour is worth a deliberate choice:**

- `Cascade` deletes the books when the author is deleted. The default for a required relationship, and occasionally a nasty surprise.
- `Restrict` refuses to delete an author who still has books.
- `SetNull` sets `AuthorId` to null, which requires a nullable foreign key.

Make `AuthorId` nullable and the relationship becomes optional:

```csharp
public int? AuthorId { get; set; }
public Author? Author { get; set; }
```

## Many to many

A book has many categories, and a category has many books.

Since EF Core 5 you just declare both sides and the join table is created for you:

```csharp
public class Book
{
    public int Id { get; set; }
    public List<Category> Categories { get; set; } = new();
}

public class Category
{
    public int Id { get; set; }
    public List<Book> Books { get; set; } = new();
}
```

EF Core creates a `BookCategory` table with the two keys. Adding a link is natural:

```csharp
Book book = await db.Books.Include(b => b.Categories).FirstAsync(b => b.Id == 1);
Category category = await db.Categories.FindAsync(3);

book.Categories.Add(category);
await db.SaveChangesAsync();
```

If the join needs its own data, such as when a category was added or who added it, declare the join entity yourself:

```csharp
public class BookCategory
{
    public int BookId { get; set; }
    public Book Book { get; set; } = null!;

    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;

    public DateTime AddedAt { get; set; }          // extra data lives here
}
```

```csharp
modelBuilder.Entity<BookCategory>()
    .HasKey(bc => new { bc.BookId, bc.CategoryId });    // composite key
```

## One to one

A user has one profile.

```csharp
public class User
{
    public int Id { get; set; }
    public UserProfile? Profile { get; set; }
}

public class UserProfile
{
    public int Id { get; set; }
    public int UserId { get; set; }              // also the foreign key
    public User User { get; set; } = null!;
}
```

EF Core cannot guess which side is the dependent, so tell it:

```csharp
modelBuilder.Entity<User>()
    .HasOne(u => u.Profile)
    .WithOne(p => p.User)
    .HasForeignKey<UserProfile>(p => p.UserId);
```

The type argument on `HasForeignKey<T>` is what says "the profile depends on the user".

If the profile is really just a group of fields rather than a thing in its own right, an **owned type** is often better. It stores the columns in the parent's table:

```csharp
modelBuilder.Entity<User>().OwnsOne(u => u.Address);
// gives Address_Street, Address_City, Address_Postcode on the Users table
```

## Loading related data

By default, navigation properties are **empty**. Load a book and `book.Author` is null. This is deliberate: EF Core will not silently fetch things you did not ask for.

There are four ways to get related data.

## Include

Eager loading. One query with a `JOIN`:

```csharp
List<Book> books = await db.Books
    .Include(b => b.Author)
    .ToListAsync();
```

Go deeper with `ThenInclude`:

```csharp
List<Book> books = await db.Books
    .Include(b => b.Author)
        .ThenInclude(a => a.Country)
    .Include(b => b.Reviews)
        .ThenInclude(r => r.User)
    .ToListAsync();
```

Filter what gets included:

```csharp
List<Book> books = await db.Books
    .Include(b => b.Reviews.Where(r => r.Rating >= 4).OrderByDescending(r => r.CreatedAt).Take(5))
    .ToListAsync();
```

## The cartesian explosion

`Include` is easy to overuse. Every `Include` of a collection multiplies the rows the database returns.

One book with 10 reviews and 5 categories does not return 16 rows. It returns 10 times 5, which is 50 rows, each repeating the whole book. Add a third collection and it multiplies again.

EF Core deduplicates in memory, so the result is correct. The cost is on the wire, and it grows fast.

**Split queries** fix it. EF Core runs one query per collection and stitches the results together:

```csharp
List<Book> books = await db.Books
    .Include(b => b.Reviews)
    .Include(b => b.Categories)
    .AsSplitQuery()
    .ToListAsync();
```

Three small queries instead of one enormous result set. The tradeoff is that they are not in a single transaction, so data could change between them. For a typical read that is fine.

You can make it the default:

```csharp
options.UseSqlServer(cs, o => o.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery));
```

Rule of thumb: one collection include is fine as a single query. Two or more, use `AsSplitQuery`.

## Projection beats Include

For an API, this is usually the right answer. You are returning a DTO anyway, so ask the database for exactly those columns:

```csharp
var items = await db.Books
    .Select(b => new BookDetail(
        b.Id,
        b.Title,
        b.Author.Name,                                        // join, no Include needed
        b.Reviews.Count,                                      // aggregate in SQL
        b.Reviews.Average(r => (double?)r.Rating) ?? 0,
        b.Categories.Select(c => c.Name).ToList(),            // one small subquery
        b.Reviews.OrderByDescending(r => r.CreatedAt)
                 .Take(3)
                 .Select(r => new ReviewSummary(r.Rating, r.Comment))
                 .ToList()))
    .ToListAsync();
```

No `Include`, no cartesian explosion, no tracking, and the database does the counting and averaging. This one query replaces what would otherwise be several `Include` calls plus in memory work.

## Explicit loading

When you have the entity and decide later that you need a navigation:

```csharp
Book book = await db.Books.FindAsync(1);

await db.Entry(book).Reference(b => b.Author).LoadAsync();
await db.Entry(book).Collection(b => b.Reviews).LoadAsync();

// You can filter before loading
int count = await db.Entry(book).Collection(b => b.Reviews)
    .Query()
    .CountAsync(r => r.Rating >= 4);
```

Useful in a branch where you only sometimes need the data.

## Lazy loading, and why to avoid it

EF Core can fetch a navigation automatically the moment you touch it. It needs a package and `virtual` navigations:

```csharp
options.UseLazyLoadingProxies();
```

```csharp
public virtual Author Author { get; set; } = null!;
```

Then `book.Author.Name` silently issues a query.

**Do not turn this on in a web API.** It is the fastest route to the N plus 1 problem, because a harmless looking `foreach` becomes hundreds of queries. Worse, it fires whenever the property is touched, including during JSON serialization, which can pull half your database into one response. Being explicit with `Include` or a projection is better in every way.

## Circular references in JSON

Return entities with two way navigations and the serializer loops: book has author, author has books, each of which has an author.

The real fix is a DTO. If you must serialize entities, tell the serializer to break cycles:

```csharp
builder.Services.AddControllers().AddJsonOptions(o =>
    o.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles);
```

Treat that as a stopgap. Unpredictable output is a poor API contract.

## Quick recap

- One to many needs a foreign key and a navigation on each side. Conventions find them by name.
- Choose the delete behaviour deliberately: `Cascade`, `Restrict` or `SetNull`.
- Many to many needs only the two collections, unless the join carries extra data.
- One to one needs `HasForeignKey<T>` to say which side depends on the other.
- Navigations are empty until you load them, by design.
- `Include` and `ThenInclude` eager load in one query. Filtered includes are allowed.
- Two or more collection includes cause a cartesian explosion. Use `AsSplitQuery`.
- A projection is usually better than `Include` in an API: fewer columns, no tracking, aggregates done in SQL.
- Avoid lazy loading proxies in a web API. They cause N plus 1 problems silently.

<code id="code-content" class="language-csharp">
// Relationships and the four ways to load them, with the tradeoffs marked.
using Microsoft.EntityFrameworkCore;
// ---------- Entities
public class Author
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int? CountryId { get; set; }
    public Country? Country { get; set; }
    public List&lt;Book&gt; Books { get; set; } = new();          // one to many
}
public class Country { public int Id { get; set; } public string Name { get; set; } = ""; }
public class Book
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public decimal Price { get; set; }
    public int AuthorId { get; set; }                        // FK, found by convention
    public Author Author { get; set; } = null!;
    public List&lt;Review&gt; Reviews { get; set; } = new();
    public List&lt;BookCategory&gt; BookCategories { get; set; } = new();   // explicit join entity
}
public class Review
{
    public int Id { get; set; }
    public int Rating { get; set; }
    public string Comment { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public int BookId { get; set; }
    public Book Book { get; set; } = null!;
}
public class Category { public int Id { get; set; } public string Name { get; set; } = "";
                        public List&lt;BookCategory&gt; BookCategories { get; set; } = new(); }
// A join entity, needed because the link carries its own data (AddedAt)
public class BookCategory
{
    public int BookId { get; set; }         public Book Book { get; set; } = null!;
    public int CategoryId { get; set; }     public Category Category { get; set; } = null!;
    public DateTime AddedAt { get; set; }
}
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;Book&gt; Books =&gt; Set&lt;Book&gt;();
    public DbSet&lt;Author&gt; Authors =&gt; Set&lt;Author&gt;();
    public DbSet&lt;Category&gt; Categories =&gt; Set&lt;Category&gt;();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity&lt;Book&gt;()
            .HasOne(x =&gt; x.Author).WithMany(a =&gt; a.Books)
            .HasForeignKey(x =&gt; x.AuthorId)
            .OnDelete(DeleteBehavior.Restrict);   // refuse to delete an author who has books
        b.Entity&lt;BookCategory&gt;().HasKey(bc =&gt; new { bc.BookId, bc.CategoryId });
    }
}
public static class LoadingExamples
{
    // 1. Include: eager, one query with joins. Fine for a single collection.
    public static Task&lt;List&lt;Book&gt;&gt; WithInclude(AppDbContext db) =&gt;
        db.Books
          .Include(b =&gt; b.Author).ThenInclude(a =&gt; a!.Country)
          .Include(b =&gt; b.Reviews.Where(r =&gt; r.Rating &gt;= 4).Take(5))   // filtered include
          .AsNoTracking()
          .ToListAsync();
    // 2. AsSplitQuery: two or more collection includes would multiply rows
    //    (10 reviews x 5 categories = 50 rows per book). Split into separate queries.
    public static Task&lt;List&lt;Book&gt;&gt; WithSplitQuery(AppDbContext db) =&gt;
        db.Books
          .Include(b =&gt; b.Reviews)
          .Include(b =&gt; b.BookCategories).ThenInclude(bc =&gt; bc.Category)
          .AsSplitQuery()
          .AsNoTracking()
          .ToListAsync();
    // 3. Projection: usually the best choice for an API. No Include, no explosion,
    //    never tracked, and the counting and averaging happen in SQL.
    public static Task&lt;List&lt;BookDetail&gt;&gt; WithProjection(AppDbContext db) =&gt;
        db.Books
          .Select(b =&gt; new BookDetail(
              b.Id,
              b.Title,
              b.Author.Name,                                      // join, no Include needed
              b.Reviews.Count,                                    // COUNT in SQL
              b.Reviews.Average(r =&gt; (double?)r.Rating) ?? 0,     // AVG in SQL
              b.BookCategories.Select(bc =&gt; bc.Category.Name).ToList(),
              b.Reviews.OrderByDescending(r =&gt; r.CreatedAt).Take(3)
                       .Select(r =&gt; new ReviewSummary(r.Rating, r.Comment)).ToList()))
          .ToListAsync();
    // 4. Explicit loading: you have the entity and decide later that you need more
    public static async Task&lt;int&gt; WithExplicitLoad(AppDbContext db, int id)
    {
        Book? book = await db.Books.FindAsync(id);
        if (book is null) return 0;
        await db.Entry(book).Reference(b =&gt; b.Author).LoadAsync();
        return await db.Entry(book).Collection(b =&gt; b.Reviews)
                       .Query().CountAsync(r =&gt; r.Rating &gt;= 4);   // filter before loading
    }
    // The N plus 1 trap: 1 query for the books, then 1 more for EVERY book.
    // Lazy loading proxies make this happen without any visible query at all,
    // which is exactly why you should not enable them in a web API.
    public static async Task NPlusOne(AppDbContext db)
    {
        List&lt;Book&gt; books = await db.Books.ToListAsync();          // 1 query
        foreach (Book book in books)
            Console.WriteLine(book.Author?.Name);                 // null here, or 1 query each
    }
}
public record ReviewSummary(int Rating, string Comment);
public record BookDetail(int Id, string Title, string AuthorName, int ReviewCount,
                         double AverageRating, List&lt;string&gt; Categories,
                         List&lt;ReviewSummary&gt; RecentReviews);
</code></pre>
