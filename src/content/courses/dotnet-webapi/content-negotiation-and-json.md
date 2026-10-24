---
publishDate: 2026-09-04T10:10
title: Content Negotiation and JSON
slug: content-negotiation-and-json
metadescription: See how Accept and Content-Type decide the response format, configure System.Text.Json naming and null handling, add XML support, and handle enums and dates cleanly.
updateDate: 2026-09-07T10:10
author: ['bishal-biswas']
level: 2
tags: ['json', 'serialization', 'content-negotiation']
course: dotnet-webapi
---

## What content negotiation means

The client and the server agree on a format before any data moves. The client says what it can read, the server says what it is sending.

The client asks with `Accept`:

```http
GET /api/books HTTP/1.1
Accept: application/json
```

The server answers with `Content-Type`:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
```

That handshake is content negotiation. ASP.NET Core does it for you. By default it knows one format, JSON, so it answers JSON no matter what you ask for.

## Where JSON comes from

.NET uses **System.Text.Json**. It is built in, fast, and strict.

You do not call it directly. Return an object from an action and the framework serializes it:

```csharp
[HttpGet]
public IActionResult Get() => Ok(new Book(1, "Clean Code", 2008));
```

```json
{ "id": 1, "title": "Clean Code", "year": 2008 }
```

Notice `Id` became `id`. The default policy is **camelCase**, because that is the JavaScript convention and most clients are JavaScript.

## Configuring JSON for controllers

Add options where you register controllers:

```csharp
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        var json = options.JsonSerializerOptions;

        // camelCase is the default. null keeps your C# PascalCase.
        json.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;

        // Accept "title" for a Title property when reading
        json.PropertyNameCaseInsensitive = true;

        // Leave nulls out of the response entirely
        json.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;

        // Send enums as "Published" instead of 2
        json.Converters.Add(new JsonStringEnumConverter());

        // Pretty print. Handy in development, wasteful in production.
        json.WriteIndented = builder.Environment.IsDevelopment();
    });
```

## Configuring JSON for minimal APIs

Minimal APIs do not go through MVC, so they use a different options object:

```csharp
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
```

If you use both styles in one app, configure both. Setting only one and wondering why half your endpoints ignore it is a common afternoon lost.

## Per property control with attributes

Global options set the defaults. Attributes handle the exceptions.

```csharp
using System.Text.Json.Serialization;

public class Book
{
    public int Id { get; set; }

    // Force an exact name, ignoring the naming policy
    [JsonPropertyName("book_title")]
    public string Title { get; set; } = "";

    // Never send this to the client
    [JsonIgnore]
    public string InternalNotes { get; set; } = "";

    // Only leave it out when it is null
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Subtitle { get; set; }

    // Control the order of properties in the output
    [JsonPropertyOrder(-1)]
    public string Isbn { get; set; } = "";
}
```

`[JsonIgnore]` is useful, but do not rely on it for security. The far safer habit is to return a **DTO** that simply does not have the field. There is a whole topic on that next.

## Enums

By default an enum serializes as its number, which is unreadable to a client:

```json
{ "status": 2 }
```

Adding `JsonStringEnumConverter` fixes it:

```json
{ "status": "Published" }
```

Do this on every API. Numbers force clients to keep a copy of your enum, and the meaning silently changes if you reorder the values.

## Dates

System.Text.Json writes `DateTime` in ISO 8601:

```json
{ "createdAt": "2026-09-07T10:15:00Z" }
```

Two habits will save you real pain:

**Store and send UTC.** Use `DateTime.UtcNow`, never `DateTime.Now`. Let the client convert to local time for display.

**Use `DateOnly` and `TimeOnly` when there is no time component.** A birthday is a date, not a moment. `DateOnly` serializes as `"1999-04-12"` with no timezone confusion attached.

## Handling bad JSON

If a client sends malformed JSON, or a string where a number belongs, model binding fails and `[ApiController]` returns `400` automatically:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "$.year": ["The JSON value could not be converted to System.Int32."]
  }
}
```

That is the right behaviour. Do not try to be clever and accept `"2008"` as a number. Strict parsing catches client bugs early.

## Adding XML

Some enterprise clients still want XML. Register the formatter and ASP.NET Core will negotiate between the two:

```csharp
builder.Services.AddControllers()
    .AddXmlSerializerFormatters();
```

Now the `Accept` header actually decides:

```http
GET /api/books
Accept: application/xml
```

```http
HTTP/1.1 200 OK
Content-Type: application/xml

<ArrayOfBook><Book><Id>1</Id><Title>Clean Code</Title></Book></ArrayOfBook>
```

If a client asks for a format you do not support, the default is to ignore the request and send JSON anyway. To reject it properly with `406 Not Acceptable`:

```csharp
builder.Services.AddControllers(options =>
{
    options.ReturnHttpNotAcceptable = true;
});
```

## Restricting formats per endpoint

`[Produces]` locks an action to one output format, and `[Consumes]` restricts what it accepts:

```csharp
[HttpPost]
[Consumes("application/json")]
[Produces("application/json")]
public IActionResult Create(Book book) => Ok(book);
```

A request with `Content-Type: application/xml` to that action now gets `415 Unsupported Media Type`.

## Returning something that is not JSON

Sometimes you want raw content:

```csharp
return Content("plain text here", "text/plain");
return File(bytes, "application/pdf", "invoice.pdf");
return Ok(new { }) ;                       // JSON
```

In minimal APIs:

```csharp
Results.Text("plain text here", "text/plain");
Results.File(bytes, "application/pdf", "invoice.pdf");
Results.Json(value);
```

## Quick recap

- `Accept` says what the client wants, `Content-Type` says what is actually being sent.
- ASP.NET Core uses System.Text.Json and defaults to camelCase property names.
- Configure controllers with `AddJsonOptions` and minimal APIs with `ConfigureHttpJsonOptions`. Both if you use both.
- Add `JsonStringEnumConverter` so enums travel as readable names instead of numbers.
- Send dates as UTC in ISO 8601, and use `DateOnly` when there is no time.
- `[JsonIgnore]` hides a property, but a DTO without the property is the safer design.
- `AddXmlSerializerFormatters` enables real negotiation, and `ReturnHttpNotAcceptable` makes unsupported formats fail honestly with `406`.

<code id="code-content" class="language-csharp">
// Program.cs - JSON configuration and content negotiation in one place.
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
var builder = WebApplication.CreateBuilder(args);
// Controllers: JSON options plus XML so Accept actually negotiates
builder.Services
    .AddControllers(options =&gt;
    {
        options.ReturnHttpNotAcceptable = true;   // 406 instead of silently sending JSON
    })
    .AddJsonOptions(options =&gt;
    {
        JsonSerializerOptions json = options.JsonSerializerOptions;
        json.PropertyNamingPolicy     = JsonNamingPolicy.CamelCase;
        json.PropertyNameCaseInsensitive = true;
        json.DefaultIgnoreCondition   = JsonIgnoreCondition.WhenWritingNull;
        json.Converters.Add(new JsonStringEnumConverter());   // "Published", not 2
        json.WriteIndented            = builder.Environment.IsDevelopment();
    })
    .AddXmlSerializerFormatters();
// Minimal APIs use a separate options object. Configure both or be surprised.
builder.Services.ConfigureHttpJsonOptions(options =&gt;
{
    options.SerializerOptions.PropertyNamingPolicy   = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
var app = builder.Build();
app.MapControllers();
// Try: Accept: application/json  vs  Accept: application/xml  vs  Accept: text/csv (406)
app.MapGet("/api/books/sample", () =&gt; new BookDto
{
    Isbn      = "978-0132350884",
    Title     = "Clean Code",
    Subtitle  = null,                      // omitted from the output
    Status    = PublishStatus.Published,   // sent as "Published"
    Released  = new DateOnly(2008, 8, 1),  // "2008-08-01", no timezone confusion
    CreatedAt = DateTime.UtcNow            // "2026-09-07T10:10:00Z"
});
// Not everything has to be JSON
app.MapGet("/api/books/export.csv", () =&gt;
    Results.Text("isbn,title\n978-0132350884,Clean Code\n", "text/csv"));
app.Run();
public enum PublishStatus { Draft, InReview, Published }
public class BookDto
{
    [JsonPropertyOrder(-1)]                          // pushed to the top of the object
    public string Isbn { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Subtitle { get; set; }            // dropped when null
    public PublishStatus Status { get; set; }
    public DateOnly Released { get; set; }
    public DateTime CreatedAt { get; set; }
    [JsonIgnore]                                     // never leaves the server
    public string InternalNotes { get; set; } = "reprint scheduled";
}
// A controller locked to JSON only: XML requests here get 415
[ApiController]
[Route("api/[controller]")]
[Consumes("application/json")]
[Produces("application/json")]
public class OrdersController : ControllerBase
{
    [HttpPost]
    public IActionResult Create([FromBody] BookDto dto) =&gt; Ok(dto);
}
</code></pre>
