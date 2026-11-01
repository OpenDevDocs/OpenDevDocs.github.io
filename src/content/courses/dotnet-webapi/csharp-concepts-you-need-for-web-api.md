---
publishDate: 2026-09-01T09:05
title: C# Concepts You Need for ASP.NET Core Web API
slug: csharp-concepts-you-need-for-web-api
metadescription: The C# features ASP.NET Core Web API uses on every endpoint, from records, attributes and lambdas to generics, LINQ, async, nullable types and dependency injection, with links to learn each one.
updateDate: 2026-11-01T09:00
author: ['bishal-biswas']
level: 1
tags: ['csharp', 'prerequisites', 'basics', 'aspnet-core']
course: dotnet-webapi
---

## Why this topic exists

A Web API is a C# program that receives HTTP requests and answers with JSON. Everything you write in this course, from endpoints to services to tests, is ordinary C#. You do not need to know the whole language before you start, but some features show up on almost every line of an API.

This topic lists those features in the order you will meet them. For each one you get:

- a short explanation in plain words,
- a small piece of real Web API code that uses it,
- a link to the matching topic in the [C# course](/courses/c-sharp/introduction-to-csharp-and-dotnet) for the full story.

The list is split into three groups:

1. **Know before you start.** You will see these in the first few topics.
2. **Learn as you go.** They appear later, so you can learn them when you get there.
3. **Can wait.** Good C#, but this course barely needs it.

Already comfortable with modern C#? Skim the samples and jump to [Setting Up the .NET SDK and Tools](/courses/dotnet-webapi/setting-up-the-dotnet-sdk-and-tools).

## Know before you start

### 1. Classes, objects and properties

Your **entities** (what you store in the database) are classes with properties. ASP.NET Core turns their public properties into JSON fields, and back again.

```csharp
public class Book
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Author { get; set; } = "";
    public decimal Price { get; set; }
}
```

`{ get; set; }` creates an **auto property**. A `Book` with `Id = 1` and `Title = "Dune"` becomes `{"id":1,"title":"Dune",...}` in the response. Notice that the JSON names start with a lower case letter: that is the default in ASP.NET Core.

You will create objects with **object initializers** all the time:

```csharp
var book = new Book { Id = 1, Title = "Dune", Author = "Frank Herbert", Price = 9.99m };
```

Learn more: [Classes and Objects](/courses/c-sharp/classes-and-objects), [Fields and Properties](/courses/c-sharp/fields-and-properties), [Variables and Data Types](/courses/c-sharp/variables-and-data-types).

### 2. Records

**Records** are the most common way to write **DTOs** (Data Transfer Objects): the shapes your API accepts and returns. One line gives you a type with properties, a constructor and value equality.

```csharp
public record CreateBookRequest(string Title, string Author, int Year, decimal Price);
public record BookResponse(int Id, string Title, decimal Price);
```

You will meet records on the very first day, because the project template already contains one. Records must come **after** the top level code in `Program.cs`, which is why the template puts them at the bottom.

Learn more: [Records](/courses/c-sharp/records). In this course: [DTOs and Why You Need Them](/courses/dotnet-webapi/dtos-and-why-you-need-them).

### 3. Lambda expressions

A **lambda** is a small inline function, such as `b => b.Price < 10`. **Minimal APIs** are built entirely from lambdas: each endpoint is a URL plus a lambda that handles it.

```csharp
app.MapGet("/books/{id}", (int id) => $"You asked for book {id}");
```

The parameter `id` is filled from the URL, and whatever the lambda returns becomes the response. Lambdas also appear when you configure services: `builder.Services.AddCors(options => ...)`.

Learn more: [Lambda Expressions](/courses/c-sharp/lambda-expressions), [Delegates](/courses/c-sharp/delegates). In this course: [Minimal APIs Introduction](/courses/dotnet-webapi/minimal-apis-introduction).

### 4. Methods, parameters and return types

In the controller style, every endpoint is a public **method** called an **action**. ASP.NET Core fills its parameters from the route, the query string or the JSON body.

```csharp
// GET /api/books?page=2
[HttpGet]
public IActionResult GetAll(int page = 1) => Ok(page);
```

You need to read a method signature without effort: return type, name, parameters and default values. The `=>` form is an **expression bodied** method, a short way to write a one line method.

Learn more: [Methods and Functions](/courses/c-sharp/methods-and-functions), [Method Parameters and Return Types](/courses/c-sharp/method-parameters-and-return-types).

### 5. Attributes

**Attributes** are the labels in square brackets. ASP.NET Core reads them to decide routing, where data comes from and what is valid:

```csharp
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    [HttpPost]
    public IActionResult Create([FromBody] CreateBookRequest request) => Ok(request);
}
```

You will also put validation attributes such as `[Required]` and `[Range]` on DTO properties, and `[Authorize]` on endpoints that need a logged in user.

Learn more: [Attributes](/courses/c-sharp/attributes). In this course: [Attribute Routing](/courses/dotnet-webapi/attribute-routing), [Model Validation with Data Annotations](/courses/dotnet-webapi/model-validation-with-data-annotations).

### 6. Inheritance and interfaces

API controllers **inherit** from `ControllerBase`, which gives you helpers like `Ok()`, `NotFound()`, `CreatedAtAction()` and `BadRequest()`. Your own services are written behind **interfaces**, so the controller depends on a promise instead of a concrete class:

```csharp
public interface IBookService
{
    Task<Book?> FindAsync(int id);
}
```

This makes testing easy: in a unit test you hand the controller a fake `IBookService`.

Learn more: [Inheritance](/courses/c-sharp/inheritance), [Interfaces](/courses/c-sharp/interfaces), [Polymorphism](/courses/c-sharp/polymorphism).

### 7. Generics and collections

**Generics** let one type work with many others. In an API you see them in return types and collections:

```csharp
public ActionResult<List<BookResponse>> GetAll() => new List<BookResponse>();
public ActionResult<BookResponse> GetById(int id) => NotFound();
```

`ActionResult<T>` means "either a `T` sent back as JSON, or another result such as 404". `List<T>`, `IEnumerable<T>` and `Dictionary<TKey, TValue>` are everywhere too.

Learn more: [Generics](/courses/c-sharp/generics), [List&lt;T&gt;](/courses/c-sharp/list-t), [Dictionary&lt;TKey, TValue&gt;](/courses/c-sharp/dictionary-tkey-tvalue).

### 8. Nullable types and the `?` mark

Projects have **nullable reference types** turned on. `Book?` means "this might be null", and the compiler warns you if you use it without checking. In an API, a missing item usually becomes a 404:

```csharp
Book? book = await _books.FindAsync(id);
return book is null ? NotFound() : Ok(book);
```

The `? :` here is the **conditional operator**: "if this, then that, otherwise the other".

Learn more: [Variables and Data Types](/courses/c-sharp/variables-and-data-types), [Operators in C#](/courses/c-sharp/operators-in-csharp), [Conditional Statements](/courses/c-sharp/conditional-statements).

### 9. LINQ

**LINQ** methods such as `Where`, `OrderBy`, `Select`, `Skip` and `Take` filter and reshape data. With Entity Framework Core the same code becomes SQL. In an API you will use `Select` constantly to turn entities into DTOs:

```csharp
var page = await _db.Books
    .OrderBy(b => b.Title)
    .Skip((pageNumber - 1) * pageSize)
    .Take(pageSize)
    .Select(b => new BookResponse(b.Id, b.Title, b.Price))
    .ToListAsync();
```

Learn more: [LINQ Fundamentals](/courses/c-sharp/linq-fundamentals), [LINQ Method Syntax](/courses/c-sharp/linq-method-syntax). In this course: [Pagination, Filtering and Sorting](/courses/dotnet-webapi/pagination-filtering-and-sorting).

### 10. async and await

APIs spend most of their time waiting: for the database, for another API, for a file. `async` and `await` let one server handle thousands of requests while it waits.

```csharp
[HttpGet("{id}")]
public async Task<ActionResult<Book>> GetById(int id)
{
    var book = await _db.Books.FindAsync(id);
    return book is null ? NotFound() : book;
}
```

Remember three things: mark the method `async`, wrap the return type in `Task<...>`, and `await` every method that ends in `Async`. Never block with `.Result` or `.Wait()`.

Learn more: [Async and Await](/courses/c-sharp/async-and-await). In this course: [Asynchronous Controllers](/courses/dotnet-webapi/asynchronous-controllers).

## Learn as you go

### 11. Constructors and dependency injection

ASP.NET Core creates your controllers and services, and passes in what they need through the **constructor**. This is **dependency injection**. You will see the classic form and the shorter **primary constructor** form:

```csharp
public class BooksController(IBookService books) : ControllerBase
{
    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id) =>
        await books.FindAsync(id) is { } book ? Ok(book) : NotFound();
}
```

In Minimal APIs, services are injected straight into the lambda's parameters instead: `app.MapGet("/books", (IBookService books) => ...)`.

Learn more: [Constructors and Destructor](/courses/c-sharp/constructors-and-destructor), [Dependency Injection Fundamentals](/courses/c-sharp/dependency-injection-fundamentals). In this course: [Dependency Injection in ASP.NET Core](/courses/dotnet-webapi/dependency-injection-in-aspnet-core).

### 12. Program.cs, extension methods and static classes

`Program.cs` uses **top level statements**: no `Main` method, the code just runs from top to bottom. Calls like `builder.Services.AddControllers()` and `app.MapGet(...)` are **extension methods**. You will write your own too, for example to keep mapping code in one place:

```csharp
public static class BookMappings
{
    public static BookResponse ToResponse(this Book book) =>
        new(book.Id, book.Title, book.Price);
}

// Now any Book has a ToResponse() method
BookResponse dto = book.ToResponse();
```

Learn more: [Your First C# Program](/courses/c-sharp/your-first-csharp-program), [LINQ Method Syntax](/courses/c-sharp/linq-method-syntax) (explains how extension methods work). In this course: [Object Mapping with AutoMapper](/courses/dotnet-webapi/object-mapping-with-automapper).

### 13. Pattern matching and switch expressions

Modern API code uses patterns to pick a result in one expression. You saw `is null` and `is { } book` above. `switch` expressions are handy for things like sort orders or mapping errors to status codes:

```csharp
int status = error switch
{
    NotFoundException    => 404,
    ValidationException  => 400,
    _                    => 500
};
```

Learn more: [Switch Statements and Expressions](/courses/c-sharp/switch-statements-and-expressions), [Advanced Pattern Matching](/courses/c-sharp/advanced-pattern-matching).

### 14. Exceptions

An unhandled **exception** becomes a 500 error. You will learn to catch the ones you expect, and to let one central handler turn the rest into a clean error response.

```csharp
try
{
    await _db.SaveChangesAsync();
}
catch (DbUpdateConcurrencyException)
{
    return Conflict();
}
```

Learn more: [Exception Handling](/courses/c-sharp/exception-handling). In this course: [Global Exception Handling](/courses/dotnet-webapi/global-exception-handling), [Problem Details and Error Responses](/courses/dotnet-webapi/problem-details-and-error-responses).

### 15. Enums, strings and interpolation

**Enums** give names to fixed choices, such as an order status, and they show up in JSON as numbers or strings. **String interpolation** builds URLs and log messages:

```csharp
public enum OrderStatus { Pending, Paid, Shipped }

_logger.LogInformation("Book {BookId} was created", book.Id);   // structured logging
string location = $"/api/books/{book.Id}";
```

Note that logging uses `{BookId}` placeholders, not `$"..."`, so tools can search by the value.

Learn more: [Variables and Data Types](/courses/c-sharp/variables-and-data-types), [String Fundamentals](/courses/c-sharp/string-fundamentals). In this course: [Logging with Serilog](/courses/dotnet-webapi/logging-with-serilog).

### 16. IDisposable, using and CancellationToken

Streams for file uploads are **disposable**, so wrap them in `using`. `HttpClient` should come from DI (`IHttpClientFactory`) rather than `new` plus `using`. A `CancellationToken` parameter lets your action stop work when the caller gives up:

```csharp
[HttpGet]
public async Task<List<Book>> GetAll(CancellationToken ct) =>
    await _db.Books.ToListAsync(ct);
```

Learn more: [IDisposable and Resource Management](/courses/c-sharp/idisposable-and-resource-management), [Task Parallel Library](/courses/c-sharp/task-parallel-library). In this course: [Calling Other APIs with HttpClient](/courses/dotnet-webapi/calling-other-apis-with-httpclient), [File Uploads and Downloads](/courses/dotnet-webapi/file-uploads-and-downloads).

## Can wait

You can finish this course without these:

- **Events.** Web APIs rarely use C# events. See [Events](/courses/c-sharp/events) when you need them.
- **Threads and locks.** ASP.NET Core manages threads. Use `async` instead of `Thread`, and use a thread safe type such as `ConcurrentDictionary` if you share data. [Synchronization and Thread Safety](/courses/c-sharp/synchronization-and-thread-safety) explains why later.
- **Reflection, source generators, Span&lt;T&gt;, unsafe code and pointers.** Useful for library authors and performance tuning, not for building endpoints.

## Your checklist

| C# concept | Where Web API uses it | C# topic |
| --- | --- | --- |
| Classes and properties | Entities, JSON fields | [Fields and Properties](/courses/c-sharp/fields-and-properties) |
| Records | Request and response DTOs | [Records](/courses/c-sharp/records) |
| Lambdas | Minimal API endpoints, configuration | [Lambda Expressions](/courses/c-sharp/lambda-expressions) |
| Methods and parameters | Controller actions | [Method Parameters and Return Types](/courses/c-sharp/method-parameters-and-return-types) |
| Attributes | Routing, binding, validation, auth | [Attributes](/courses/c-sharp/attributes) |
| Inheritance and interfaces | `ControllerBase`, services | [Interfaces](/courses/c-sharp/interfaces) |
| Generics | `ActionResult<T>`, lists | [Generics](/courses/c-sharp/generics) |
| Nullable `?` | Not found becomes 404 | [Variables and Data Types](/courses/c-sharp/variables-and-data-types) |
| LINQ | Queries and DTO mapping | [LINQ Method Syntax](/courses/c-sharp/linq-method-syntax) |
| async and await | Every database call | [Async and Await](/courses/c-sharp/async-and-await) |
| Constructors and DI | Getting services | [Dependency Injection Fundamentals](/courses/c-sharp/dependency-injection-fundamentals) |

If you can follow the code panel on this page, you are ready for this course. Building web pages or a desktop app instead? The [MVC](/courses/dotnet-mvc/csharp-concepts-you-need-for-mvc) and [WPF](/courses/wpf/csharp-concepts-you-need-for-wpf) courses have their own version of this list.

## Quick recap

- A Web API is plain C#, and a small set of features covers nearly every endpoint.
- Before you start, know classes, records, lambdas, methods, attributes, inheritance, interfaces, generics, nullable types, LINQ and `async`/`await`.
- Learn dependency injection, extension methods, pattern matching, exceptions, enums and cancellation tokens as the course reaches them.
- Events, threads, reflection and low level performance features can wait.
- Each concept links to a full topic in the C# course when you want to go deeper.

<code id="code-content" class="language-csharp">
// Program.cs
// A tiny BookStore API that uses every "know before you start" C# feature.
// The numbers match the sections of this topic.
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
var builder = WebApplication.CreateBuilder(args);          // 12. top level statements
builder.Services.AddControllers();                         // 12. extension method
builder.Services.AddSingleton&lt;IBookService, BookService&gt;(); // 6 + 11. interface and DI
var app = builder.Build();
app.MapControllers();
// 3. Minimal API endpoint: a URL plus a lambda. IBookService is injected into the lambda.
app.MapGet("/books/cheap", async (IBookService books, decimal max = 10m) =&gt;
    (await books.GetAllAsync())
        .Where(b =&gt; b.Price &lt;= max)                         // 9. LINQ
        .Select(b =&gt; b.ToResponse()));                      // 12. our own extension method
app.Run();
// 1. Entity: a class with auto properties
public class Book
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Author { get; set; } = "";
    public decimal Price { get; set; }
}
// 2. DTOs as records, with 5. validation attributes
public record CreateBookRequest(
    [Required, StringLength(100)] string Title,
    [Required] string Author,
    [Range(0.01, 1000)] decimal Price);
public record BookResponse(int Id, string Title, decimal Price);
// 12. Extension method: every Book gets a ToResponse() method
public static class BookMappings
{
    public static BookResponse ToResponse(this Book book) =&gt; new(book.Id, book.Title, book.Price);
}
// 6. The interface (the promise) and 7 + 8 + 10. generics, nullable and Task
public interface IBookService
{
    Task&lt;List&lt;Book&gt;&gt; GetAllAsync();
    Task&lt;Book?&gt; FindAsync(int id);
    Task&lt;Book&gt; AddAsync(CreateBookRequest request);
}
public class BookService : IBookService
{
    private readonly List&lt;Book&gt; _books = new()
    {
        new Book { Id = 1, Title = "Dune", Author = "Frank Herbert", Price = 9.99m },  // 1. object initializer
        new Book { Id = 2, Title = "Emma", Author = "Jane Austen", Price = 4.99m }
    };
    public Task&lt;List&lt;Book&gt;&gt; GetAllAsync() =&gt; Task.FromResult(_books);
    public Task&lt;Book?&gt; FindAsync(int id) =&gt; Task.FromResult(_books.FirstOrDefault(b =&gt; b.Id == id));
    public Task&lt;Book&gt; AddAsync(CreateBookRequest request)
    {
        var book = new Book
        {
            Id = _books.Max(b =&gt; b.Id) + 1,
            Title = request.Title,
            Author = request.Author,
            Price = request.Price
        };
        _books.Add(book);
        return Task.FromResult(book);
    }
}
// 4 + 5 + 6. Controller style: attributes, inheritance from ControllerBase, action methods
[ApiController]
[Route("api/[controller]")]
public class BooksController(IBookService books) : ControllerBase   // 11. primary constructor
{
    // GET /api/books
    [HttpGet]
    public async Task&lt;ActionResult&lt;List&lt;BookResponse&gt;&gt;&gt; GetAll()    // 7 + 10. generics and async
    {
        var all = await books.GetAllAsync();
        return all.OrderBy(b =&gt; b.Title).Select(b =&gt; b.ToResponse()).ToList();
    }
    // GET /api/books/1
    [HttpGet("{id:int}")]
    public async Task&lt;ActionResult&lt;BookResponse&gt;&gt; GetById(int id)
    {
        Book? book = await books.FindAsync(id);                      // 8. may be null
        return book is null ? NotFound() : book.ToResponse();
    }
    // POST /api/books  with a JSON body
    [HttpPost]
    public async Task&lt;ActionResult&lt;BookResponse&gt;&gt; Create(CreateBookRequest request)
    {
        Book book = await books.AddAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = book.Id }, book.ToResponse());
    }
}
</code></pre>
