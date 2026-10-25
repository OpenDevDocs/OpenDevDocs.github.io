---
publishDate: 2026-09-10T12:10
title: Object Mapping with AutoMapper
slug: object-mapping-with-automapper
metadescription: Stop writing repetitive entity to DTO copying. Configure AutoMapper profiles, customise members, project queries with ProjectTo, and know when hand written mapping is the better choice.
updateDate: 2026-09-07T12:10
author: ['bishal-biswas']
level: 2
tags: ['automapper', 'dto', 'mapping']
course: dotnet-webapi
---

## The repetition problem

Once you have DTOs, you have mapping code. Lots of it:

```csharp
var response = new BookResponse
{
    Id = book.Id,
    Title = book.Title,
    Author = book.Author,
    Year = book.Year,
    Price = book.Price,
    CreatedAt = book.CreatedAt
};
```

Multiply that by five DTOs per resource and ten resources, and a real share of your codebase is copying fields from one object to another. AutoMapper does the copying for you when the names match, and lets you describe the exceptions.

## Installing and registering

```bash
dotnet add package AutoMapper.Extensions.Microsoft.DependencyInjection
```

```csharp
builder.Services.AddAutoMapper(typeof(Program).Assembly);
```

That scans the assembly for **profiles**, which is where your mapping rules live.

## Your first profile

```csharp
using AutoMapper;

public class BookProfile : Profile
{
    public BookProfile()
    {
        CreateMap<Book, BookResponse>();
        CreateMap<CreateBookRequest, Book>();
    }
}
```

That is genuinely all you need when the property names match. AutoMapper matches by name, case insensitively.

## Using it in a controller

Inject `IMapper` and call `Map`:

```csharp
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private readonly AppDbContext db;
    private readonly IMapper mapper;

    public BooksController(AppDbContext db, IMapper mapper)
    {
        this.db = db;
        this.mapper = mapper;
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<BookResponse>> GetById(int id)
    {
        Book? book = await db.Books.FindAsync(id);
        if (book is null) return NotFound();

        return mapper.Map<BookResponse>(book);
    }

    [HttpPost]
    public async Task<ActionResult<BookResponse>> Create(CreateBookRequest request)
    {
        Book book = mapper.Map<Book>(request);
        book.CreatedAt = DateTime.UtcNow;

        db.Books.Add(book);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = book.Id },
                               mapper.Map<BookResponse>(book));
    }
}
```

## Customising members

Names rarely match perfectly. `ForMember` handles the exceptions:

```csharp
public class BookProfile : Profile
{
    public BookProfile()
    {
        CreateMap<Book, BookResponse>()
            // Combine two source properties into one
            .ForMember(dest => dest.AuthorName,
                       opt => opt.MapFrom(src => $"{src.FirstName} {src.LastName}"))

            // Pull a value from a nested object
            .ForMember(dest => dest.PublisherName,
                       opt => opt.MapFrom(src => src.Publisher.Name))

            // Compute something
            .ForMember(dest => dest.ReviewCount,
                       opt => opt.MapFrom(src => src.Reviews.Count))

            // Format a value
            .ForMember(dest => dest.PriceLabel,
                       opt => opt.MapFrom(src => src.Price.ToString("C")))

            // Leave a destination property alone
            .ForMember(dest => dest.DownloadUrl, opt => opt.Ignore());
    }
}
```

## Updating an existing object

For a `PUT`, you do not want a new entity. You want to copy values onto the one EF Core is already tracking. The three argument overload does that:

```csharp
[HttpPut("{id:int}")]
public async Task<IActionResult> Update(int id, UpdateBookRequest request)
{
    Book? book = await db.Books.FindAsync(id);
    if (book is null) return NotFound();

    mapper.Map(request, book);          // copies onto the tracked entity
    await db.SaveChangesAsync();

    return NoContent();
}
```

For a `PATCH`, tell AutoMapper to skip nulls so absent fields are left alone:

```csharp
CreateMap<PatchBookRequest, Book>()
    .ForAllMembers(opt => opt.Condition((src, dest, value) => value is not null));
```

## ProjectTo, the feature that matters most

`Map` runs in memory. If you load entities and then map them, the database still sent every column.

`ProjectTo` translates the mapping into the SQL `SELECT`:

```csharp
using AutoMapper.QueryableExtensions;

// SELECT Id, Title, Price FROM Books WHERE Year > 2000
var items = await db.Books
    .Where(b => b.Year > 2000)
    .ProjectTo<BookListItem>(mapper.ConfigurationProvider)
    .ToListAsync();
```

Compare that with the naive version:

```csharp
// SELECT * FROM Books, then discard most of it
var books = await db.Books.Where(b => b.Year > 2000).ToListAsync();
var items = mapper.Map<List<BookListItem>>(books);
```

`ProjectTo` also removes the need for `Include`, because the projection tells EF Core exactly which related columns it needs. Use it for every read that goes to a database.

The one restriction: `ProjectTo` only understands mappings that translate to SQL. A `MapFrom` calling a C# method will fail, because the database cannot run your method.

## Validating your configuration

The biggest risk with AutoMapper is a silent mistake. Rename a DTO property and the mapping quietly leaves it at its default. No error, just a null in production.

Guard against it with a configuration test:

```csharp
[Fact]
public void Mapping_configuration_is_valid()
{
    var config = new MapperConfiguration(cfg => cfg.AddMaps(typeof(BookProfile).Assembly));
    config.AssertConfigurationIsValid();
}
```

This fails the build when any destination property is unmapped and unignored. If you use AutoMapper, this test is not optional. It is the thing that makes the library safe.

You can also assert at startup:

```csharp
app.Services.GetRequiredService<IMapper>()
   .ConfigurationProvider.AssertConfigurationIsValid();
```

## When not to use AutoMapper

Being honest about this matters, because AutoMapper is genuinely controversial and both sides have a point.

**Skip it when:**

- The API is small. Ten hand written mappers are less trouble than a dependency and a configuration test.
- The mapping is complicated. A profile full of `ForMember` calls is harder to read than a plain method.
- You want the compiler to catch mistakes. Hand written mapping fails at build time. AutoMapper fails at runtime, or silently.
- Debugging matters. Stepping through a mapping method is easy. Stepping into AutoMapper's expression trees is not.

**Use it when:**

- You have many similar DTOs and the mapping really is mechanical.
- You want `ProjectTo`, which is a real benefit that hand written mapping does not give you for free.

A middle path worth knowing: **Mapperly** is a source generator that writes the mapping code at compile time. You get the brevity of a declaration and the safety of generated C# that you can read and step through:

```csharp
[Mapper]
public partial class BookMapper
{
    public partial BookResponse ToResponse(Book book);
}
```

## Rules if you do use it

**Keep profiles next to the feature.** `Features/Books/BookProfile.cs`, not one giant `MappingProfile.cs`.

**Never map inside a loop.** Map the collection in one call, or use `ProjectTo`.

**Do not map entity to entity.** AutoMapper is for crossing the boundary between your model and your contract. Copying one entity onto another usually means the design needs a look.

**Keep `MapFrom` simple.** Anything beyond a small expression belongs in a service, and complex logic breaks `ProjectTo` anyway.

## Quick recap

- AutoMapper copies matching properties automatically and lets you describe the exceptions with `ForMember`.
- Register with `AddAutoMapper` and put rules in `Profile` classes, one per feature.
- `mapper.Map<T>(source)` creates a new object. `mapper.Map(source, destination)` updates an existing one.
- For `PATCH`, add a `Condition` that skips null values so absent fields are untouched.
- `ProjectTo` pushes the mapping into SQL, so the database only reads the columns the DTO needs.
- Always add a test that calls `AssertConfigurationIsValid`. Without it, renames fail silently.
- Hand written mapping is a perfectly good choice for small APIs, and Mapperly gives brevity with compile time safety.

<code id="code-content" class="language-csharp">
// AutoMapper set up properly: profile, controller, ProjectTo, and the config test.
// dotnet add package AutoMapper.Extensions.Microsoft.DependencyInjection
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt; o.UseInMemoryDatabase("books"));
builder.Services.AddAutoMapper(typeof(Program).Assembly);   // finds every Profile
builder.Services.AddControllers();
var app = builder.Build();
// Fail fast at startup rather than silently producing nulls in production
app.Services.GetRequiredService&lt;IMapper&gt;().ConfigurationProvider.AssertConfigurationIsValid();
app.MapControllers();
app.Run();
// ---------- Features/Books/BookProfile.cs
public class BookProfile : Profile
{
    public BookProfile()
    {
        // Names match, so nothing else to say
        CreateMap&lt;CreateBookRequest, Book&gt;();
        CreateMap&lt;Book, BookListItem&gt;();
        CreateMap&lt;Book, BookResponse&gt;()
            // Combine two source properties
            .ForMember(d =&gt; d.AuthorName, o =&gt; o.MapFrom(s =&gt; s.FirstName + " " + s.LastName))
            // Reach into a related entity. ProjectTo turns this into a SQL join.
            .ForMember(d =&gt; d.PublisherName, o =&gt; o.MapFrom(s =&gt; s.Publisher.Name))
            // Aggregate. Also translates to SQL.
            .ForMember(d =&gt; d.ReviewCount, o =&gt; o.MapFrom(s =&gt; s.Reviews.Count))
            // A destination property nothing feeds. Ignore it, or the config test fails.
            .ForMember(d =&gt; d.DownloadUrl, o =&gt; o.Ignore());
        // PUT: copy every field onto the tracked entity
        CreateMap&lt;UpdateBookRequest, Book&gt;();
        // PATCH: skip nulls so an absent field means "leave it alone"
        CreateMap&lt;PatchBookRequest, Book&gt;()
            .ForAllMembers(o =&gt; o.Condition((src, dest, value) =&gt; value is not null));
    }
}
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private readonly AppDbContext db;
    private readonly IMapper mapper;
    public BooksController(AppDbContext db, IMapper mapper) =&gt; (this.db, this.mapper) = (db, mapper);
    // ProjectTo: the mapping becomes part of the SQL SELECT.
    // No Include needed, and only the DTO's columns are read.
    [HttpGet]
    public async Task&lt;ActionResult&lt;List&lt;BookListItem&gt;&gt;&gt; GetAll() =&gt;
        await db.Books
            .OrderBy(b =&gt; b.Title)
            .ProjectTo&lt;BookListItem&gt;(mapper.ConfigurationProvider)
            .ToListAsync();
    [HttpGet("{id:int}")]
    public async Task&lt;ActionResult&lt;BookResponse&gt;&gt; GetById(int id)
    {
        BookResponse? dto = await db.Books
            .Where(b =&gt; b.Id == id)
            .ProjectTo&lt;BookResponse&gt;(mapper.ConfigurationProvider)
            .FirstOrDefaultAsync();
        return dto is null ? NotFound() : dto;
    }
    [HttpPost]
    public async Task&lt;ActionResult&lt;BookResponse&gt;&gt; Create(CreateBookRequest request)
    {
        Book book = mapper.Map&lt;Book&gt;(request);
        book.CreatedAt = DateTime.UtcNow;             // server owned, never from the client
        db.Books.Add(book);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = book.Id }, mapper.Map&lt;BookResponse&gt;(book));
    }
    // Three argument Map copies onto the entity EF Core is already tracking
    [HttpPut("{id:int}")]
    public async Task&lt;IActionResult&gt; Update(int id, UpdateBookRequest request)
    {
        Book? book = await db.Books.FindAsync(id);
        if (book is null) return NotFound();
        mapper.Map(request, book);
        await db.SaveChangesAsync();
        return NoContent();
    }
    [HttpPatch("{id:int}")]
    public async Task&lt;IActionResult&gt; Patch(int id, PatchBookRequest patch)
    {
        Book? book = await db.Books.FindAsync(id);
        if (book is null) return NotFound();
        mapper.Map(patch, book);                      // nulls are skipped by the profile
        await db.SaveChangesAsync();
        return NoContent();
    }
}
// ---------- The test that makes AutoMapper safe. Do not skip it.
// [Fact]
// public void Mapping_configuration_is_valid()
// {
//     var config = new MapperConfiguration(cfg =&gt; cfg.AddMaps(typeof(BookProfile).Assembly));
//     config.AssertConfigurationIsValid();
// }
public class Book
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public decimal Price { get; set; }
    public DateTime CreatedAt { get; set; }
    public Publisher Publisher { get; set; } = null!;
    public List&lt;Review&gt; Reviews { get; set; } = new();
}
public class Publisher { public int Id { get; set; } public string Name { get; set; } = ""; }
public class Review    { public int Id { get; set; } public int Rating { get; set; } }
public record CreateBookRequest(string Title, string FirstName, string LastName, decimal Price);
public record UpdateBookRequest(string Title, string FirstName, string LastName, decimal Price);
public record PatchBookRequest(string? Title, string? FirstName, string? LastName, decimal? Price);
public record BookListItem(int Id, string Title, decimal Price);
public class BookResponse
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string AuthorName { get; set; } = "";
    public string PublisherName { get; set; } = "";
    public int ReviewCount { get; set; }
    public decimal Price { get; set; }
    public string? DownloadUrl { get; set; }        // ignored in the profile
}
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;Book&gt; Books =&gt; Set&lt;Book&gt;();
}
</code></pre>
