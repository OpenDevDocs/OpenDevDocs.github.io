---
publishDate: 2026-09-07T11:20
title: Route Groups and Endpoint Filters
slug: route-groups-and-endpoint-filters
metadescription: Group minimal API endpoints with MapGroup to share a prefix and metadata, then add cross cutting logic with endpoint filters for validation, logging and timing.
updateDate: 2026-09-07T11:20
author: ['bishal-biswas']
level: 2
tags: ['minimal-apis', 'route-groups', 'filters']
course: dotnet-webapi
---

## The repetition problem

Without grouping, every endpoint repeats its prefix and its metadata:

```csharp
app.MapGet("/api/v1/books", GetAll).WithTags("Books").RequireAuthorization();
app.MapGet("/api/v1/books/{id:int}", GetById).WithTags("Books").RequireAuthorization();
app.MapPost("/api/v1/books", Create).WithTags("Books").RequireAuthorization();
app.MapDelete("/api/v1/books/{id:int}", Delete).WithTags("Books").RequireAuthorization();
```

Four endpoints, four copies of the same three things. Change the version prefix and you edit every line.

## MapGroup

`MapGroup` creates a group. Everything set on the group applies to every endpoint inside it:

```csharp
var books = app.MapGroup("/api/v1/books")
               .WithTags("Books")
               .RequireAuthorization();

books.MapGet("/", GetAll);
books.MapGet("/{id:int}", GetById);
books.MapPost("/", Create);
books.MapDelete("/{id:int}", Delete);
```

Same four endpoints, and now the prefix, the tag and the auth requirement live in one place.

The route inside the group is the part **after** the prefix. `"/"` means the group root, so `books.MapGet("/", ...)` handles `GET /api/v1/books`.

## Nesting groups

Groups nest, and the prefixes join:

```csharp
var api = app.MapGroup("/api").WithTags("API");
var v1 = api.MapGroup("/v1");
var books = v1.MapGroup("/books");

books.MapGet("/{id:int}", GetById);        // GET /api/v1/books/{id}

var reviews = books.MapGroup("/{bookId:int}/reviews");
reviews.MapGet("/", GetReviews);           // GET /api/v1/books/{bookId}/reviews
reviews.MapPost("/", AddReview);           // POST /api/v1/books/{bookId}/reviews
```

Route parameters from a parent group are available to the handlers inside. `GetReviews(int bookId)` binds from the group's own template.

This makes versioning almost free:

```csharp
app.MapGroup("/api/v1").MapBookEndpointsV1();
app.MapGroup("/api/v2").MapBookEndpointsV2();
```

## Mixing public and protected endpoints

A common shape is a public group and a protected group under the same prefix:

```csharp
var books = app.MapGroup("/api/books").WithTags("Books");

// Anyone can read
books.MapGet("/", GetAll);
books.MapGet("/{id:int}", GetById);

// Writing needs a token
var admin = books.MapGroup("").RequireAuthorization("AdminOnly");
admin.MapPost("/", Create);
admin.MapPut("/{id:int}", Update);
admin.MapDelete("/{id:int}", Delete);
```

An empty prefix adds no path segment, so the sub group exists purely to carry the policy.

## What an endpoint filter is

A **filter** runs around a handler. It sees the arguments before the handler runs, and the result after. It is the minimal API answer to action filters in MVC.

```csharp
app.MapGet("/api/books", GetAll)
   .AddEndpointFilter(async (context, next) =>
   {
       Console.WriteLine("before the handler");
       object? result = await next(context);
       Console.WriteLine("after the handler");
       return result;
   });
```

`next(context)` calls the next filter, or the handler itself if this is the last one. Whatever you return becomes the response, so a filter can **replace** the result entirely.

## Short circuiting

Return a result without calling `next` and the handler never runs. That is how validation filters work:

```csharp
.AddEndpointFilter(async (context, next) =>
{
    var request = context.GetArgument<CreateBookRequest>(0);

    if (string.IsNullOrWhiteSpace(request.Title))
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["title"] = new[] { "Title is required." }
        });

    return await next(context);
});
```

`context.GetArgument<T>(index)` reads a handler parameter by position. The index is zero based and counts every parameter, including injected services, so it is brittle. A safer alternative when the type is unique:

```csharp
var request = context.Arguments.OfType<CreateBookRequest>().FirstOrDefault();
```

## A reusable validation filter

Writing the same check for every request type is the thing we are trying to avoid. Make it generic:

```csharp
using System.ComponentModel.DataAnnotations;

public class ValidationFilter<T> : IEndpointFilter where T : class
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        T? model = context.Arguments.OfType<T>().FirstOrDefault();

        if (model is null)
            return Results.BadRequest("Request body is missing.");

        var results = new List<ValidationResult>();
        bool valid = Validator.TryValidateObject(
            model, new ValidationContext(model), results, validateAllProperties: true);

        if (!valid)
        {
            var errors = results
                .SelectMany(r => r.MemberNames.Select(m => (Member: m, r.ErrorMessage)))
                .GroupBy(x => x.Member)
                .ToDictionary(g => g.Key, g => g.Select(x => x.ErrorMessage ?? "").ToArray());

            return Results.ValidationProblem(errors);
        }

        return await next(context);
    }
}
```

Now any endpoint can opt in with one line, and your `[Required]` and `[Range]` attributes finally do something in a minimal API:

```csharp
books.MapPost("/", Create).AddEndpointFilter<ValidationFilter<CreateBookRequest>>();
```

## Filters on a whole group

Add a filter to the group and every endpoint in it gets it:

```csharp
var books = app.MapGroup("/api/books")
    .AddEndpointFilter(async (context, next) =>
    {
        var watch = System.Diagnostics.Stopwatch.StartNew();
        object? result = await next(context);
        watch.Stop();

        context.HttpContext.Response.Headers["X-Elapsed-Ms"] =
            watch.ElapsedMilliseconds.ToString();

        return result;
    });
```

Every endpoint under `/api/books` now reports its own timing.

## Order of execution

Filters run in the order you add them, wrapping each other like layers of an onion:

```csharp
app.MapGet("/test", handler)
   .AddEndpointFilter(A)
   .AddEndpointFilter(B);
```

```text
A before
  B before
    handler
  B after
A after
```

Group filters are added before endpoint filters, so a group filter is the outermost layer.

## Filters versus middleware

They look similar and solve different problems.

**Middleware** runs for every request that reaches the pipeline, before routing has necessarily finished. It works with the raw `HttpContext`. Use it for things that apply to the whole application: HTTPS redirection, CORS, authentication, global error handling.

**Filters** run after routing and after model binding, so they see the **typed arguments** and can change the **result**. Use them for things that apply to specific endpoints: validating a request object, checking that a resource belongs to the caller, adding a per endpoint header.

If your logic needs the bound model, it has to be a filter. Middleware runs too early to see it.

## Quick recap

- `MapGroup` shares a route prefix and metadata across many endpoints.
- Groups nest, and their prefixes and route parameters combine.
- A sub group with an empty prefix is a neat way to apply a policy to a subset of endpoints.
- An endpoint filter wraps the handler. Call `next(context)` to continue, or return early to short circuit.
- `context.Arguments.OfType<T>()` is safer than `GetArgument<T>(index)`, because it does not depend on parameter order.
- A generic `ValidationFilter<T>` restores automatic data annotation validation, which minimal APIs otherwise lack.
- Filters run in the order added, outermost first, and group filters wrap endpoint filters.
- Middleware is for the whole app and the raw context. Filters are for specific endpoints and typed arguments.

<code id="code-content" class="language-csharp">
// Program.cs - route groups plus a reusable validation filter and a timing filter.
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
var app = builder.Build();
var books = new List&lt;Book&gt; { new Book(1, "Clean Code", 2008) };
// One group: shared prefix, shared tag, shared timing filter
var group = app.MapGroup("/api/v1/books")
    .WithTags("Books")
    .AddEndpointFilter(async (context, next) =&gt;
    {
        var watch = System.Diagnostics.Stopwatch.StartNew();
        object? result = await next(context);
        watch.Stop();
        context.HttpContext.Response.Headers["X-Elapsed-Ms"] = watch.ElapsedMilliseconds.ToString();
        return result;
    });
// "/" is the group root: GET /api/v1/books
group.MapGet("/", () =&gt; TypedResults.Ok(books));
group.MapGet("/{id:int}", (int id) =&gt;
    books.FirstOrDefault(b =&gt; b.Id == id) is Book b
        ? Results.Ok(b)
        : Results.NotFound());
// One line restores data annotation validation for this endpoint
group.MapPost("/", (CreateBookRequest request) =&gt;
{
    var book = new Book(books.Max(b =&gt; b.Id) + 1, request.Title, request.Year);
    books.Add(book);
    return TypedResults.Created($"/api/v1/books/{book.Id}", book);
})
.AddEndpointFilter&lt;ValidationFilter&lt;CreateBookRequest&gt;&gt;();
// A nested group: route parameters from the parent are available to the handlers
var reviews = group.MapGroup("/{bookId:int}/reviews").WithTags("Reviews");
reviews.MapGet("/",  (int bookId) =&gt; TypedResults.Ok(new { bookId, reviews = Array.Empty&lt;string&gt;() }));
reviews.MapPost("/", (int bookId, ReviewDto review) =&gt; TypedResults.Created($"/api/v1/books/{bookId}/reviews/1", review))
       .AddEndpointFilter&lt;ValidationFilter&lt;ReviewDto&gt;&gt;();
// An empty prefix adds no path segment. The sub group exists only to carry the policy.
var admin = group.MapGroup("").RequireAuthorization();
admin.MapDelete("/{id:int}", (int id) =&gt;
    books.FirstOrDefault(b =&gt; b.Id == id) is Book b &amp;&amp; books.Remove(b)
        ? Results.NoContent()
        : Results.NotFound());
app.Run();
public record Book(int Id, string Title, int Year);
public class CreateBookRequest
{
    [Required, StringLength(200, MinimumLength = 1)]
    public string Title { get; set; } = "";
    [Range(1000, 2100)]
    public int Year { get; set; }
}
public class ReviewDto
{
    [Required, StringLength(1000)] public string Comment { get; set; } = "";
    [Range(1, 5)]                  public int Rating { get; set; }
}
// One filter, any request type. This is what minimal APIs are missing out of the box.
public class ValidationFilter&lt;T&gt; : IEndpointFilter where T : class
{
    public async ValueTask&lt;object?&gt; InvokeAsync(
        EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        // OfType is safer than GetArgument(index), which depends on parameter order
        T? model = context.Arguments.OfType&lt;T&gt;().FirstOrDefault();
        if (model is null) return Results.BadRequest("Request body is missing.");
        var results = new List&lt;ValidationResult&gt;();
        bool valid = Validator.TryValidateObject(
            model, new ValidationContext(model), results, validateAllProperties: true);
        if (!valid)
        {
            Dictionary&lt;string, string[]&gt; errors = results
                .SelectMany(r =&gt; r.MemberNames.Select(m =&gt; (Member: m, r.ErrorMessage)))
                .GroupBy(x =&gt; x.Member)
                .ToDictionary(g =&gt; g.Key, g =&gt; g.Select(x =&gt; x.ErrorMessage ?? "").ToArray());
            return Results.ValidationProblem(errors);   // short circuit: handler never runs
        }
        return await next(context);
    }
}
</code></pre>
