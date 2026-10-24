---
publishDate: 2026-09-21T16:10
title: API Versioning
slug: api-versioning
metadescription: Add versioning to an ASP.NET Core API with URL, query string, header or media type strategies, deprecate old versions gracefully, and know which changes actually break clients.
updateDate: 2026-09-07T16:10
author: ['bishal-biswas']
level: 3
tags: ['versioning', 'api-design', 'compatibility']
course: dotnet-webapi
---

## The problem

You ship an API. A mobile app uses it. Six months later you need to split `name` into `firstName` and `lastName`.

You cannot just change it. Every installed copy of that app breaks, and you cannot force people to update. **Versioning** lets the old shape keep working while new clients get the new one.

## What actually breaks a client

Not every change needs a new version, and getting this wrong means either breaking people or drowning in versions.

**Safe to add to v1:**

- A new endpoint
- A new **optional** field in a request
- A new field in a response, as long as clients ignore unknown fields
- A new optional query parameter
- Relaxing a validation rule

**Breaking, so needs a new version:**

- Removing or renaming a field
- Changing a field's type, such as `int` to `string`
- Making an optional field required
- Changing a URL or an HTTP method
- Changing the meaning of an existing field
- Tightening validation
- Changing a status code for an existing outcome

The rule of thumb: **adding is usually safe, changing and removing are not.**

That second bullet under "safe" has a caveat. Adding a response field is only safe if clients ignore unknown properties. Most do, and strict deserializers do not. Say so in your documentation.

## Installing

```bash
dotnet add package Asp.Versioning.Mvc
dotnet add package Asp.Versioning.Mvc.ApiExplorer
```

The `ApiExplorer` package is what makes Swagger show a document per version.

## Setting it up

```csharp
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;               // adds api-supported-versions headers

    options.ApiVersionReader = new UrlSegmentApiVersionReader();
})
.AddApiExplorer(options =>
{
    options.GroupNameFormat = "'v'VVV";             // v1, v1.1, v2
    options.SubstituteApiVersionInUrl = true;
});
```

`ReportApiVersions` adds headers that tell clients what exists:

```http
api-supported-versions: 1.0, 2.0
api-deprecated-versions: 1.0
```

That is the cheapest possible migration signal, and it costs one line.

## Four ways to carry the version

**URL segment**, the most common and the most visible:

```csharp
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class BooksController : ControllerBase { }
```

```text
GET /api/v1/books
GET /api/v2/books
```

Easy to read, easy to test in a browser, easy to route in a proxy. Purists object that a URL should identify a resource rather than a representation of it. In practice this is what most public APIs do.

**Query string:**

```csharp
options.ApiVersionReader = new QueryStringApiVersionReader("api-version");
```

```text
GET /api/books?api-version=2.0
```

**Header:**

```csharp
options.ApiVersionReader = new HeaderApiVersionReader("X-Api-Version");
```

```http
GET /api/books
X-Api-Version: 2.0
```

Keeps URLs clean, and makes the version invisible in a browser and in logs.

**Media type**, the most RESTful and the least used:

```csharp
options.ApiVersionReader = new MediaTypeApiVersionReader("v");
```

```http
Accept: application/json;v=2.0
```

You can accept several at once:

```csharp
options.ApiVersionReader = ApiVersionReader.Combine(
    new UrlSegmentApiVersionReader(),
    new HeaderApiVersionReader("X-Api-Version"),
    new QueryStringApiVersionReader("api-version"));
```

Pick one as the documented default. Supporting all of them quietly is a support burden.

## Versioning a controller

Two controllers, one per version:

```csharp
namespace Api.Controllers.V1;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/books")]
public class BooksController : ControllerBase
{
    [HttpGet("{id:int}")]
    public ActionResult<BookV1> GetById(int id) =>
        new BookV1 { Id = id, Name = "Robert C. Martin" };
}
```

```csharp
namespace Api.Controllers.V2;

[ApiController]
[ApiVersion("2.0")]
[Route("api/v{version:apiVersion}/books")]
public class BooksController : ControllerBase
{
    [HttpGet("{id:int}")]
    public ActionResult<BookV2> GetById(int id) =>
        new BookV2 { Id = id, FirstName = "Robert", LastName = "Martin" };
}
```

Different namespaces let both classes share a name.

**Both versions should call the same service.** Only the shape at the edge differs. If v1 and v2 have separate business logic, a bug fix has to be written twice, and eventually they diverge in ways nobody intended.

```csharp
// V1
public ActionResult<BookV1> GetById(int id)
{
    Book book = service.GetById(id);                     // shared
    return new BookV1 { Id = book.Id, Name = $"{book.FirstName} {book.LastName}" };
}

// V2
public ActionResult<BookV2> GetById(int id)
{
    Book book = service.GetById(id);                     // the same call
    return new BookV2 { Id = book.Id, FirstName = book.FirstName, LastName = book.LastName };
}
```

## Versioning a single action

When only one endpoint changed, one controller can serve both:

```csharp
[ApiController]
[ApiVersion("1.0")]
[ApiVersion("2.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class BooksController : ControllerBase
{
    // Both versions
    [HttpGet]
    public ActionResult<List<BookResponse>> GetAll() => Ok();

    // v1 only
    [HttpGet("{id:int}")]
    [MapToApiVersion("1.0")]
    public ActionResult<BookV1> GetByIdV1(int id) => Ok();

    // v2 only
    [HttpGet("{id:int}")]
    [MapToApiVersion("2.0")]
    public ActionResult<BookV2> GetByIdV2(int id) => Ok();
}
```

An action with no `[MapToApiVersion]` answers every version the controller declares.

## Deprecating a version

Mark it, do not delete it:

```csharp
[ApiVersion("1.0", Deprecated = true)]
[ApiVersion("2.0")]
public class BooksController : ControllerBase { }
```

With `ReportApiVersions` on, v1 responses now carry:

```http
api-deprecated-versions: 1.0
api-supported-versions: 1.0, 2.0
```

Add a `Sunset` header with a date so clients know the deadline:

```csharp
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api/v1"))
    {
        context.Response.Headers["Sunset"] = "Wed, 31 Dec 2026 23:59:59 GMT";
        context.Response.Headers["Link"] =
            "<https://docs.example.com/migrate-v2>; rel=\"deprecation\"";
    }

    await next();
});
```

A reasonable lifecycle: announce, keep both running for six to twelve months, log v1 usage so you know who is still on it, contact them, then remove.

## Swagger per version

Generate one document per version automatically:

```csharp
builder.Services.AddSwaggerGen();
builder.Services.ConfigureOptions<ConfigureSwaggerOptions>();
```

```csharp
public class ConfigureSwaggerOptions : IConfigureOptions<SwaggerGenOptions>
{
    private readonly IApiVersionDescriptionProvider provider;

    public ConfigureSwaggerOptions(IApiVersionDescriptionProvider provider)
        => this.provider = provider;

    public void Configure(SwaggerGenOptions options)
    {
        foreach (ApiVersionDescription description in provider.ApiVersionDescriptions)
        {
            options.SwaggerDoc(description.GroupName, new OpenApiInfo
            {
                Title = "BookStore API",
                Version = description.ApiVersion.ToString(),
                Description = description.IsDeprecated
                    ? "This version is deprecated and will be removed."
                    : "Manage books and authors."
            });
        }
    }
}
```

```csharp
app.UseSwaggerUI(options =>
{
    foreach (ApiVersionDescription description in
             app.DescribeApiVersions().OrderByDescending(d => d.ApiVersion))
    {
        options.SwaggerEndpoint($"/swagger/{description.GroupName}/swagger.json",
                                description.GroupName.ToUpperInvariant());
    }
});
```

A dropdown appears in Swagger UI listing every version.

## Do you need versioning?

Honestly, sometimes not.

**Skip it** for an internal API where you control every client and can deploy them together, or for a brand new API with no consumers yet. Adding `v1` to every URL when there will never be a v2 is noise.

**Add it** the moment a client exists that you cannot redeploy at will: a mobile app, a partner integration, a public API.

A middle path many teams take: design URLs as `/api/v1/...` from the start but keep exactly one version. The cost is a path segment. The benefit is that adding v2 later needs no URL change for existing clients.

## Prefer not to version at all

The best version is the one you never had to create. Habits that reduce the need:

**Add, do not change.** A new optional field breaks nobody.

**Deprecate before removing.** Keep the old field, populate both, document the new one, remove the old one much later.

**Never return an entity.** DTOs are what let your database change without your contract changing. That is the whole argument from the DTOs topic, and versioning is where it pays off.

**Be generous in what you accept.** Ignore unknown request fields rather than rejecting them.

## Quick recap

- Adding is usually safe. Renaming, removing, retyping and tightening validation are breaking.
- `Asp.Versioning.Mvc` plus the ApiExplorer package handles versioning and Swagger.
- Turn on `ReportApiVersions` so responses advertise which versions exist.
- URL segments are the most common strategy. Headers and media types keep URLs clean.
- Share one service between versions. Only the DTO shape at the edge should differ.
- `[MapToApiVersion]` versions a single action inside a shared controller.
- Deprecate with `Deprecated = true` and a `Sunset` header, then remove months later.
- Generate one Swagger document per version with `IApiVersionDescriptionProvider`.
- Skip versioning for internal APIs you deploy together. Add it as soon as a client is out of your control.
- The best strategy is designing so you rarely need a new version.

<code id="code-content" class="language-csharp">
// API versioning with URL segments, a deprecated v1, and per version Swagger.
// dotnet add package Asp.Versioning.Mvc
// dotnet add package Asp.Versioning.Mvc.ApiExplorer
using Asp.Versioning;
using Asp.Versioning.ApiExplorer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddSingleton&lt;IBookService, BookService&gt;();
builder.Services
    .AddApiVersioning(options =&gt;
    {
        options.DefaultApiVersion = new ApiVersion(1, 0);
        options.AssumeDefaultVersionWhenUnspecified = true;
        // Adds api-supported-versions and api-deprecated-versions headers.
        // The cheapest possible migration signal.
        options.ReportApiVersions = true;
        options.ApiVersionReader = ApiVersionReader.Combine(
            new UrlSegmentApiVersionReader(),
            new HeaderApiVersionReader("X-Api-Version"));
    })
    .AddApiExplorer(options =&gt;
    {
        options.GroupNameFormat = "'v'VVV";           // v1, v2
        options.SubstituteApiVersionInUrl = true;     // shows the real URL in Swagger
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.ConfigureOptions&lt;ConfigureSwaggerOptions&gt;();
var app = builder.Build();
// Tell v1 callers when it goes away, and where the migration guide is
app.Use(async (context, next) =&gt;
{
    if (context.Request.Path.StartsWithSegments("/api/v1"))
    {
        context.Response.Headers["Sunset"] = "Wed, 31 Dec 2026 23:59:59 GMT";
        context.Response.Headers["Link"]   = "&lt;https://docs.example.com/migrate-v2&gt;; rel=\"deprecation\"";
    }
    await next();
});
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =&gt;
    {
        foreach (ApiVersionDescription d in app.DescribeApiVersions().OrderByDescending(x =&gt; x.ApiVersion))
            options.SwaggerEndpoint($"/swagger/{d.GroupName}/swagger.json", d.GroupName.ToUpperInvariant());
    });
}
app.MapControllers();
app.Run();
// ---------- v1: deprecated, still working
namespace Api.V1
{
    [ApiController]
    [ApiVersion("1.0", Deprecated = true)]
    [Route("api/v{version:apiVersion}/books")]
    public class BooksController : ControllerBase
    {
        private readonly IBookService service;
        public BooksController(IBookService service) =&gt; this.service = service;
        // v1 exposed a single Name field
        [HttpGet("{id:int}")]
        public ActionResult&lt;BookV1&gt; GetById(int id)
        {
            // The SAME service as v2. Only the shape at the edge differs, so a bug
            // fix lands once instead of twice.
            Book? book = service.GetById(id);
            if (book is null) return NotFound();
            return new BookV1
            {
                Id     = book.Id,
                Title  = book.Title,
                Author = $"{book.AuthorFirstName} {book.AuthorLastName}"    // joined for v1
            };
        }
    }
}
// ---------- v2: the current version
namespace Api.V2
{
    [ApiController]
    [ApiVersion("2.0")]
    [Route("api/v{version:apiVersion}/books")]
    public class BooksController : ControllerBase
    {
        private readonly IBookService service;
        public BooksController(IBookService service) =&gt; this.service = service;
        // v2 split the author into two fields, which is a breaking change
        [HttpGet("{id:int}")]
        public ActionResult&lt;BookV2&gt; GetById(int id)
        {
            Book? book = service.GetById(id);
            if (book is null) return NotFound();
            return new BookV2
            {
                Id              = book.Id,
                Title           = book.Title,
                AuthorFirstName = book.AuthorFirstName,
                AuthorLastName  = book.AuthorLastName,
                // A NEW field. Adding one is safe, so it did not need v2 by itself.
                Isbn            = book.Isbn
            };
        }
    }
}
// ---------- One controller serving both, when only one action changed
namespace Api.Shared
{
    [ApiController]
    [ApiVersion("1.0")]
    [ApiVersion("2.0")]
    [Route("api/v{version:apiVersion}/authors")]
    public class AuthorsController : ControllerBase
    {
        // No [MapToApiVersion], so this answers BOTH versions
        [HttpGet]
        public IActionResult GetAll() =&gt; Ok(new[] { "Robert C. Martin" });
        [HttpGet("{id:int}")]
        [MapToApiVersion("1.0")]
        public IActionResult GetByIdV1(int id) =&gt; Ok(new { id, name = "Robert C. Martin" });
        [HttpGet("{id:int}")]
        [MapToApiVersion("2.0")]
        public IActionResult GetByIdV2(int id) =&gt; Ok(new { id, firstName = "Robert", lastName = "Martin" });
    }
}
// One Swagger document per version, generated from what is registered
public class ConfigureSwaggerOptions : IConfigureOptions&lt;SwaggerGenOptions&gt;
{
    private readonly IApiVersionDescriptionProvider provider;
    public ConfigureSwaggerOptions(IApiVersionDescriptionProvider provider) =&gt; this.provider = provider;
    public void Configure(SwaggerGenOptions options)
    {
        foreach (ApiVersionDescription description in provider.ApiVersionDescriptions)
        {
            options.SwaggerDoc(description.GroupName, new OpenApiInfo
            {
                Title       = "BookStore API",
                Version     = description.ApiVersion.ToString(),
                Description = description.IsDeprecated
                    ? "DEPRECATED. This version is removed on 31 December 2026."
                    : "Manage books and authors."
            });
        }
    }
}
public class BookV1 { public int Id { get; set; } public string Title { get; set; } = "";
                      public string Author { get; set; } = ""; }
public class BookV2 { public int Id { get; set; } public string Title { get; set; } = "";
                      public string AuthorFirstName { get; set; } = "";
                      public string AuthorLastName { get; set; } = "";
                      public string Isbn { get; set; } = ""; }
public class Book   { public int Id { get; set; } public string Title { get; set; } = "";
                      public string AuthorFirstName { get; set; } = "";
                      public string AuthorLastName { get; set; } = "";
                      public string Isbn { get; set; } = ""; }
public interface IBookService { Book? GetById(int id); }
public class BookService : IBookService
{
    public Book? GetById(int id) =&gt; id == 1
        ? new Book { Id = 1, Title = "Clean Code", AuthorFirstName = "Robert",
                     AuthorLastName = "Martin", Isbn = "9780132350884" }
        : null;
}
</code></pre>
