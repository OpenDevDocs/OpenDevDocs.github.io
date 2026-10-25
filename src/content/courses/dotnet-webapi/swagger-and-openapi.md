---
publishDate: 2026-09-21T16:00
title: Swagger and OpenAPI
slug: swagger-and-openapi
metadescription: Document your API with OpenAPI, enrich Swagger with XML comments and response types, add JWT support, group endpoints, and generate client code from the spec.
updateDate: 2026-09-07T16:00
author: ['bishal-biswas']
level: 2
tags: ['swagger', 'openapi', 'documentation']
course: dotnet-webapi
---

## OpenAPI and Swagger

**OpenAPI** is a specification: a JSON or YAML document describing every endpoint, parameter, request body and response your API has.

**Swagger** is a family of tools built on that spec. Swagger UI is the interactive page you have been using to test endpoints.

The valuable part is that the document is **machine readable**. From it you can generate a typed client in any language, run contract tests, import into Postman, or hand it to another team as the contract.

## The default setup

The Web API template already includes it:

```csharp
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();       // serves /swagger/v1/swagger.json
    app.UseSwaggerUI();     // serves the interactive page at /swagger
}
```

That gives you a page listing every endpoint. It is a good start and it says almost nothing useful about what the endpoints actually do.

## Describing the document

```csharp
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "BookStore API",
        Version = "v1",
        Description = "Manage books, authors and orders.",
        Contact = new OpenApiContact
        {
            Name = "API Support",
            Email = "api@example.com",
            Url = new Uri("https://example.com/support")
        },
        License = new OpenApiLicense
        {
            Name = "MIT",
            Url = new Uri("https://opensource.org/licenses/MIT")
        }
    });
});
```

## XML comments

The biggest single improvement. Turn them on in the project file:

```xml
<PropertyGroup>
  <GenerateDocumentationFile>true</GenerateDocumentationFile>
  <NoWarn>$(NoWarn);1591</NoWarn>
</PropertyGroup>
```

`1591` is the warning for a public member without a comment. Suppress it unless you genuinely intend to document everything.

Point Swagger at the generated file:

```csharp
builder.Services.AddSwaggerGen(options =>
{
    string xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    options.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, xmlFile));
});
```

Now your comments become documentation:

```csharp
/// <summary>
/// Fetches a single book by its id.
/// </summary>
/// <param name="id">The book's numeric id.</param>
/// <returns>The book, if it exists.</returns>
/// <response code="200">The book was found.</response>
/// <response code="404">No book has that id.</response>
/// <remarks>
/// Sample request:
///
///     GET /api/books/5
///
/// </remarks>
[HttpGet("{id:int}")]
public ActionResult<BookResponse> GetById(int id) => Ok();
```

Comments on your DTO properties show up too, which is where they help most:

```csharp
public class CreateBookRequest
{
    /// <summary>The book's full title.</summary>
    /// <example>Clean Code</example>
    public string Title { get; set; } = "";

    /// <summary>Year of first publication.</summary>
    /// <example>2008</example>
    public int Year { get; set; }
}
```

`<example>` fills in the sample request body, which turns Swagger from a list into something people can actually try.

## Documenting responses

Swagger cannot guess which status codes an action returns. Tell it:

```csharp
[HttpPost]
[ProducesResponseType(typeof(BookResponse), StatusCodes.Status201Created)]
[ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
public ActionResult<BookResponse> Create(CreateBookRequest request) => Ok();
```

Returning `ActionResult<T>` means you can skip the type on the success case, because it is already in the signature. You still need to declare the failures.

Cover the common ones globally rather than repeating them:

```csharp
builder.Services.AddControllers(options =>
{
    options.Filters.Add(new ProducesResponseTypeAttribute(StatusCodes.Status401Unauthorized));
    options.Filters.Add(new ProducesResponseTypeAttribute(StatusCodes.Status500InternalServerError));
});
```

## Minimal APIs

The same information comes from chained methods:

```csharp
app.MapGet("/api/books/{id:int}", GetBook)
   .WithName("GetBookById")
   .WithTags("Books")
   .WithSummary("Fetch a single book")
   .WithDescription("Returns 404 when the id does not exist.")
   .Produces<BookResponse>(StatusCodes.Status200OK)
   .Produces(StatusCodes.Status404NotFound)
   .WithOpenApi();
```

Or let `TypedResults` do it. The return type carries everything:

```csharp
app.MapGet("/api/books/{id:int}",
    Results<Ok<BookResponse>, NotFound> (int id) =>
        Find(id) is BookResponse book
            ? TypedResults.Ok(book)
            : TypedResults.NotFound());
```

Swagger reads both outcomes from the signature. No attributes, and the compiler enforces it.

## Adding JWT support

Without this you cannot test protected endpoints from the Swagger page:

```csharp
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the token only. Swagger adds the Bearer prefix."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});
```

An **Authorize** button appears. Paste a token once and every request carries it.

## Grouping endpoints

By default, endpoints are grouped by controller name. Override it with tags:

```csharp
[ApiController]
[Route("api/[controller]")]
[Tags("Catalogue")]
public class BooksController : ControllerBase { }
```

Order the groups so the page reads sensibly:

```csharp
app.UseSwaggerUI(options =>
{
    options.DocumentTitle = "BookStore API";
    options.RoutePrefix = "docs";                     // now at /docs instead of /swagger
    options.DefaultModelsExpandDepth(-1);             // hide the schemas section
    options.DocExpansion(DocExpansion.List);          // list endpoints, collapsed
    options.EnableTryItOutByDefault();
});
```

`DefaultModelsExpandDepth(-1)` is worth knowing. The schemas section at the bottom is long and rarely what people want first.

## Hiding endpoints

Internal endpoints do not belong in public documentation:

```csharp
[ApiExplorerSettings(IgnoreApi = true)]
[HttpGet("internal/debug")]
public IActionResult Debug() => Ok();
```

```csharp
app.MapGet("/internal/metrics", Metrics).ExcludeFromDescription();
```

## Should Swagger be public?

The template only enables it in development, and that is a deliberate default.

Swagger UI in production tells anyone your entire API surface: every endpoint, every parameter, every model. That is a gift to someone probing for weaknesses.

Three reasonable positions:

**Development only**, the default. Safest, and internal consumers have to get the spec elsewhere.

**Behind authentication.** Useful when partners need it:

```csharp
app.UseSwaggerUI().RequireAuthorization("ApiDocsPolicy");
```

**Fully public**, when the API is public anyway and documentation is a feature.

What matters is that it is a decision, not an accident. Never leave it on in production without deciding it should be.

## Generating clients

This is the payoff for documenting properly. Point a generator at the JSON and get a typed client:

```bash
# TypeScript for a front end
npx openapi-typescript https://localhost:7139/swagger/v1/swagger.json -o src/api-types.ts

# A C# client
dotnet tool install --global Microsoft.dotnet-openapi
dotnet openapi add url https://localhost:7139/swagger/v1/swagger.json
```

Every `ProducesResponseType` and XML comment you added shows up in the generated code. The documentation is not just for humans.

## Exporting the spec in CI

Generate the file at build time so it can be versioned and diffed:

```bash
dotnet tool install --global Swashbuckle.AspNetCore.Cli
dotnet swagger tofile --output openapi.json bin/Debug/net8.0/BookStore.Api.dll v1
```

Committing `openapi.json` means a pull request shows exactly how the API contract changed. That single habit prevents a lot of accidental breaking changes.

## Quick recap

- OpenAPI is the specification. Swagger is the tooling around it.
- `AddSwaggerGen` and `UseSwaggerUI` give you a page. Everything after that is enrichment.
- Turn on `GenerateDocumentationFile` and include the XML, then your comments become documentation.
- `<example>` on a DTO property fills in the sample request body.
- Declare failure codes with `ProducesResponseType`. `ActionResult<T>` covers the success type.
- Minimal APIs use `Produces`, or `TypedResults` with a `Results<...>` return type.
- Add a security definition or you cannot test protected endpoints from the page.
- Hide internal endpoints with `[ApiExplorerSettings(IgnoreApi = true)]` or `ExcludeFromDescription`.
- Decide deliberately whether Swagger is exposed in production.
- Generate typed clients from the spec, and commit it so contract changes show up in review.

<code id="code-content" class="language-csharp">
// A fully documented API: XML comments, response types, JWT, and tidy grouping.
// Add to the .csproj:
//   &lt;GenerateDocumentationFile&gt;true&lt;/GenerateDocumentationFile&gt;
//   &lt;NoWarn&gt;$(NoWarn);1591&lt;/NoWarn&gt;
using System.Reflection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerUI;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
// Declare the codes every endpoint can return, once, instead of on all of them
builder.Services.AddControllers(options =&gt;
{
    options.Filters.Add(new ProducesResponseTypeAttribute(StatusCodes.Status401Unauthorized));
    options.Filters.Add(new ProducesResponseTypeAttribute(StatusCodes.Status500InternalServerError));
});
builder.Services.AddSwaggerGen(options =&gt;
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title       = "BookStore API",
        Version     = "v1",
        Description = "Manage books, authors and orders.",
        Contact     = new OpenApiContact { Name = "API Support", Email = "api@example.com" },
        License     = new OpenApiLicense { Name = "MIT", Url = new Uri("https://opensource.org/licenses/MIT") }
    });
    // The single biggest improvement: your /// comments become the documentation
    string xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    options.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, xmlFile));
    // Without this, protected endpoints cannot be tested from the Swagger page
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization", Type = SecuritySchemeType.Http,
        Scheme = "bearer",      BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the token only. Swagger adds the Bearer prefix."
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { new OpenApiSecurityScheme { Reference = new OpenApiReference
            { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }, Array.Empty&lt;string&gt;() }
    });
    options.OrderActionsBy(a =&gt; a.RelativePath);
});
var app = builder.Build();
// Development only is the safe default. Exposing this in production advertises
// every endpoint, parameter and model to anyone probing your API.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =&gt;
    {
        options.DocumentTitle = "BookStore API";
        options.DefaultModelsExpandDepth(-1);          // hide the long schemas section
        options.DocExpansion(DocExpansion.List);
        options.EnableTryItOutByDefault();
    });
}
app.MapControllers();
// Minimal API: TypedResults puts both outcomes in the signature, so Swagger
// documents the 200 AND the 404 with no attributes at all.
app.MapGet("/api/health/books",
    Microsoft.AspNetCore.Http.HttpResults.Results&lt;
        Microsoft.AspNetCore.Http.HttpResults.Ok&lt;object&gt;,
        Microsoft.AspNetCore.Http.HttpResults.NotFound&gt; () =&gt;
            TypedResults.Ok((object)new { status = "ok" }))
   .WithTags("Ops")
   .WithSummary("Checks the books subsystem");
// Internal endpoints stay out of the public documentation
app.MapGet("/internal/metrics", () =&gt; Results.Ok(new { requests = 42_000 }))
   .ExcludeFromDescription();
app.Run();
/// &lt;summary&gt;Books in the catalogue.&lt;/summary&gt;
[ApiController]
[Route("api/[controller]")]
[Tags("Catalogue")]                                     // the group name in the UI
[Produces("application/json")]
public class BooksController : ControllerBase
{
    /// &lt;summary&gt;Fetches a single book by its id.&lt;/summary&gt;
    /// &lt;param name="id"&gt;The book's numeric id.&lt;/param&gt;
    /// &lt;returns&gt;The book, if it exists.&lt;/returns&gt;
    /// &lt;response code="200"&gt;The book was found.&lt;/response&gt;
    /// &lt;response code="404"&gt;No book has that id.&lt;/response&gt;
    /// &lt;remarks&gt;
    /// Sample request:
    ///
    ///     GET /api/books/5
    ///
    /// &lt;/remarks&gt;
    [HttpGet("{id:int}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]   // the type is already in ActionResult&lt;T&gt;
    public ActionResult&lt;BookResponse&gt; GetById(int id) =&gt;
        id == 1 ? new BookResponse(1, "Clean Code", 2008) : NotFound();
    /// &lt;summary&gt;Adds a new book to the catalogue.&lt;/summary&gt;
    /// &lt;response code="201"&gt;Created. The Location header points at the new book.&lt;/response&gt;
    /// &lt;response code="400"&gt;The request failed validation.&lt;/response&gt;
    /// &lt;response code="409"&gt;A book with that ISBN already exists.&lt;/response&gt;
    [HttpPost]
    [ProducesResponseType(typeof(BookResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public ActionResult&lt;BookResponse&gt; Create([FromBody] CreateBookRequest request) =&gt;
        CreatedAtAction(nameof(GetById), new { id = 7 }, new BookResponse(7, request.Title, request.Year));
    /// &lt;summary&gt;An internal diagnostic endpoint, hidden from the documentation.&lt;/summary&gt;
    [HttpGet("debug")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public IActionResult Debug() =&gt; Ok();
}
/// &lt;summary&gt;The details needed to create a book.&lt;/summary&gt;
public class CreateBookRequest
{
    /// &lt;summary&gt;The book's full title.&lt;/summary&gt;
    /// &lt;example&gt;Clean Code&lt;/example&gt;
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(200)]
    public string Title { get; set; } = "";
    /// &lt;summary&gt;Year of first publication.&lt;/summary&gt;
    /// &lt;example&gt;2008&lt;/example&gt;
    [System.ComponentModel.DataAnnotations.Range(1000, 2100)]
    public int Year { get; set; }
    /// &lt;summary&gt;The 13 digit ISBN, without dashes.&lt;/summary&gt;
    /// &lt;example&gt;9780132350884&lt;/example&gt;
    public string Isbn { get; set; } = "";
}
/// &lt;summary&gt;A book as returned by the API.&lt;/summary&gt;
/// &lt;param name="Id"&gt;The book's numeric id.&lt;/param&gt;
/// &lt;param name="Title"&gt;The full title.&lt;/param&gt;
/// &lt;param name="Year"&gt;Year of first publication.&lt;/param&gt;
public record BookResponse(int Id, string Title, int Year);
// Export the spec in CI so contract changes show up in code review:
//   dotnet tool install --global Swashbuckle.AspNetCore.Cli
//   dotnet swagger tofile --output openapi.json bin/Debug/net8.0/BookStore.Api.dll v1
</code></pre>
