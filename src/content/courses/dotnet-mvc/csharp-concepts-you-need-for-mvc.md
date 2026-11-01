---
publishDate: 2026-08-01T09:05
title: C# Concepts You Need for ASP.NET Core MVC
slug: csharp-concepts-you-need-for-mvc
metadescription: The exact C# features ASP.NET Core MVC uses every day, from classes, properties and attributes to lambdas, LINQ, async and dependency injection, with links to learn each one.
updateDate: 2026-11-01T09:00
author: ['bishal-biswas']
level: 1
tags: ['csharp', 'prerequisites', 'basics', 'aspnet-core']
course: dotnet-mvc
---

## Why this topic exists

ASP.NET Core MVC is written in C#, and every controller, model and service you write in this course is normal C# code. You do not need to be a C# expert to start. You do need to recognise a handful of language features, because MVC uses them on almost every line.

This topic lists those features in the order you will meet them. For each one you get:

- a short explanation in plain words,
- a small piece of real MVC code that uses it,
- a link to the matching topic in the [C# course](/courses/c-sharp/introduction-to-csharp-and-dotnet) if you want to learn it properly.

The list is split into three groups:

1. **Know before you start.** You will see these in the first few topics.
2. **Learn as you go.** They appear a bit later, so you can pick them up when you get there.
3. **Can wait.** Useful C#, but this course barely touches it.

If you already write C# comfortably, skim the code samples and move on to [Setting Up the .NET SDK and Tools](/courses/dotnet-mvc/setting-up-the-dotnet-sdk-and-tools).

## Know before you start

### 1. Classes, objects and properties

Your **models** and **view models** are plain classes with properties. Almost every page in an MVC app starts with a class like this:

```csharp
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
}
```

`{ get; set; }` makes an **auto property**: C# creates the hidden field for you. MVC reads these properties to fill a page, and writes them when a form is posted back.

You will also create objects with an **object initializer**, which sets properties right after `new`:

```csharp
var product = new Product { Id = 1, Name = "Keyboard", Price = 49.99m };
```

The `m` after `49.99` makes it a `decimal`, the type you should always use for money.

Learn more: [Classes and Objects](/courses/c-sharp/classes-and-objects), [Fields and Properties](/courses/c-sharp/fields-and-properties), [Variables and Data Types](/courses/c-sharp/variables-and-data-types).

### 2. Methods, parameters and return types

Every **action** in a controller is just a public method. MVC calls it for you and fills its parameters from the URL, the query string or the posted form.

```csharp
// GET /Products/Details/3   ->   id = 3
public IActionResult Details(int id)
{
    return View();
}
```

You need to be happy reading a method signature: the return type (`IActionResult`), the name (`Details`) and the parameter list (`int id`). Optional parameters with default values also show up a lot:

```csharp
public IActionResult Index(int page = 1, string? search = null) => View();
```

The `=>` at the end is an **expression bodied** method: a short way to write a method that only returns one thing.

Learn more: [Methods and Functions](/courses/c-sharp/methods-and-functions), [Method Parameters and Return Types](/courses/c-sharp/method-parameters-and-return-types).

### 3. Inheritance

Your controllers **inherit** from the `Controller` base class. That one `: Controller` is what gives you helper methods such as `View()`, `NotFound()`, `RedirectToAction()` and properties such as `ModelState` and `TempData`.

```csharp
public class ProductsController : Controller
{
    public IActionResult Missing() => NotFound();   // NotFound() comes from the base class
}
```

You do not need deep inheritance trees in MVC, but you must understand that a class can reuse everything its base class offers.

Learn more: [Inheritance](/courses/c-sharp/inheritance), [Access Modifiers](/courses/c-sharp/access-modifiers).

### 4. Interfaces

An **interface** is a promise: "any class that implements me has these members". MVC uses interfaces everywhere:

- Actions return `IActionResult`, so one action can return a page, a redirect or a 404.
- Your own services are usually registered as an interface, such as `IProductService`, so you can swap the real one for a fake one in tests.

```csharp
public interface IProductService
{
    Product? Find(int id);
}

public class ProductService : IProductService
{
    public Product? Find(int id) => null; // real code would look it up
}
```

Learn more: [Interfaces](/courses/c-sharp/interfaces), [Polymorphism](/courses/c-sharp/polymorphism), [Abstraction](/courses/c-sharp/abstraction).

### 5. Nullable types and the `?` mark

New projects turn on **nullable reference types**. That means the compiler warns you when something might be `null` and you forgot to check. You will see `?` all over MVC code:

```csharp
Product? product = _service.Find(id);   // might be null
if (product is null)
{
    return NotFound();
}
return View(product);                   // the compiler now knows it is not null
```

A `string?` parameter means "this value is allowed to be missing". A plain `string` property needs a starting value, which is why models often end with `= "";`.

Learn more: [Variables and Data Types](/courses/c-sharp/variables-and-data-types), [Classes and Objects](/courses/c-sharp/classes-and-objects), [Conditional Statements](/courses/c-sharp/conditional-statements).

### 6. Attributes

**Attributes** are the labels in square brackets. They do not run code by themselves. Instead, MVC reads them and changes its behaviour. You will use them for routing, validation and security:

```csharp
public class ContactForm
{
    [Required, EmailAddress]
    public string Email { get; set; } = "";
}

[HttpPost]
[ValidateAntiForgeryToken]
public IActionResult Contact(ContactForm form) => View(form);
```

`[HttpPost]` says this action only answers form posts. `[Required]` tells model validation that the field cannot be empty.

Learn more: [Attributes](/courses/c-sharp/attributes). In this course: [Attribute Routing](/courses/dotnet-mvc/attribute-routing), [Model Validation with Data Annotations](/courses/dotnet-mvc/model-validation-with-data-annotations).

### 7. Collections and generics

A list page shows many items, so you will pass collections to views all the time. The `<T>` part is **generics**: one `List<T>` class that works for any type you put inside the angle brackets.

```csharp
List<Product> products = new() { new Product { Id = 1, Name = "Mouse", Price = 19.99m } };
return View(products);
```

In a view, the matching line is `@model List<Product>` or, more often, `@model IEnumerable<Product>`. `IEnumerable<T>` is the interface for "anything you can loop over with `foreach`".

Learn more: [List&lt;T&gt;](/courses/c-sharp/list-t), [Dictionary&lt;TKey, TValue&gt;](/courses/c-sharp/dictionary-tkey-tvalue), [Generics](/courses/c-sharp/generics), [Loops in C#](/courses/c-sharp/loops-in-csharp).

### 8. Lambda expressions

A **lambda** is a tiny function written inline: `p => p.Price > 20` means "take a product `p` and tell me if it costs more than 20". MVC code is full of them:

```csharp
var cheap = products.Where(p => p.Price < 20);                          // filtering
var first = products.FirstOrDefault(p => p.Id == id);                    // finding
builder.Services.AddSession(options => options.Cookie.HttpOnly = true);  // configuring
```

In Razor views, the older HTML helpers use them too: `@Html.DisplayFor(m => m.Name)`.

Learn more: [Lambda Expressions](/courses/c-sharp/lambda-expressions), [Delegates](/courses/c-sharp/delegates).

### 9. LINQ

**LINQ** lets you search, sort and shape collections with methods like `Where`, `OrderBy`, `Select` and `FirstOrDefault`. With Entity Framework Core, the same LINQ code turns into a SQL query against your database.

```csharp
var results = _db.Products
    .Where(p => p.Name.Contains(search))
    .OrderBy(p => p.Price)
    .Take(10)
    .ToList();
```

Learn the **method syntax** first. It is what almost all ASP.NET Core code uses.

Learn more: [LINQ Fundamentals](/courses/c-sharp/linq-fundamentals), [LINQ Method Syntax](/courses/c-sharp/linq-method-syntax). In this course: [Searching, Sorting and Pagination](/courses/dotnet-mvc/searching-sorting-and-pagination).

### 10. async and await

A web server handles many visitors at once. When an action waits for the database, `await` lets the server serve someone else in the meantime instead of blocking a thread. You will write actions like this as soon as a database is involved:

```csharp
public async Task<IActionResult> Index()
{
    var products = await _db.Products.ToListAsync();
    return View(products);
}
```

Three rules cover most cases: mark the method `async`, return `Task<IActionResult>` instead of `IActionResult`, and `await` every method whose name ends in `Async`.

Learn more: [Async and Await](/courses/c-sharp/async-and-await). In this course: [Asynchronous Actions](/courses/dotnet-mvc/asynchronous-actions).

## Learn as you go

### 11. Constructors and dependency injection

MVC creates your controllers for you, and hands them the services they ask for in their **constructor**. This is called **dependency injection** (DI). You will see two styles:

```csharp
// Classic constructor with a private readonly field
public class ProductsController : Controller
{
    private readonly IProductService _products;

    public ProductsController(IProductService products)
    {
        _products = products;
    }
}

// Primary constructor (C# 12 and later): same idea, less typing
public class OrdersController(IOrderService orders) : Controller
{
    public IActionResult Index() => View(orders.GetAll());
}
```

Learn more: [Constructors and Destructor](/courses/c-sharp/constructors-and-destructor), [Dependency Injection Fundamentals](/courses/c-sharp/dependency-injection-fundamentals). In this course: [Dependency Injection in MVC](/courses/dotnet-mvc/dependency-injection-in-mvc).

### 12. Program.cs: top level statements, namespaces and extension methods

`Program.cs` has no `class Program` and no `Main` method. It uses **top level statements**, where the code simply runs from top to bottom. Lines such as `builder.Services.AddControllersWithViews()` are **extension methods**: static methods that look like they belong to another type.

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();   // an extension method on IServiceCollection

var app = builder.Build();
app.UseStaticFiles();
app.Run();
```

Files usually start with a **file scoped namespace** such as `namespace ShopApp.Controllers;`. Common `using` lines are added for you by **implicit usings**, which is why many files have almost none.

Learn more: [Your First C# Program](/courses/c-sharp/your-first-csharp-program), [LINQ Method Syntax](/courses/c-sharp/linq-method-syntax) (it explains how extension methods work).

### 13. Strings, interpolation and formatting

Views print a lot of text. You will use **string interpolation** (`$"..."`) and format strings for prices and dates:

```csharp
TempData["Message"] = $"{product.Name} was added to your cart.";
string price = product.Price.ToString("C");   // "$49.99" in the en-US culture
```

Learn more: [String Fundamentals](/courses/c-sharp/string-fundamentals), [Type Conversion and Casting](/courses/c-sharp/type-conversion-and-casting).

### 14. Exceptions

Things go wrong: the database is down, a file is missing. MVC turns unhandled **exceptions** into an error page, and you will use `try` and `catch` when you can recover, for example when saving a form fails.

```csharp
try
{
    await _db.SaveChangesAsync();
}
catch (DbUpdateException)
{
    ModelState.AddModelError("", "Could not save. Please try again.");
}
```

Learn more: [Exception Handling](/courses/c-sharp/exception-handling). In this course: [Error Handling and Custom Error Pages](/courses/dotnet-mvc/error-handling-and-custom-error-pages).

### 15. switch expressions and pattern matching

Short `switch` expressions and `is` patterns keep actions tidy, for example when choosing a sort order:

```csharp
var sorted = sortOrder switch
{
    "price_desc" => products.OrderByDescending(p => p.Price),
    "price"      => products.OrderBy(p => p.Price),
    _            => products.OrderBy(p => p.Name)
};
```

Learn more: [Switch Statements and Expressions](/courses/c-sharp/switch-statements-and-expressions).

### 16. IDisposable and using

Some objects hold resources, like a file stream during a file upload. A `using` statement closes them for you, even if an error happens. The `DbContext` is also disposable, but DI disposes it for you at the end of each request.

```csharp
using var stream = System.IO.File.Create(path);
await upload.CopyToAsync(stream);
```

Learn more: [IDisposable and Resource Management](/courses/c-sharp/idisposable-and-resource-management), [File Handling](/courses/c-sharp/file-handling).

### 17. Records (optional)

A **record** is a short way to write a data class. Many people use records for small read only view models. For forms that the user edits, classes with `{ get; set; }` are still the usual choice.

```csharp
public record ProductSummary(int Id, string Name, decimal Price);
```

Learn more: [Records](/courses/c-sharp/records).

## Can wait

These are good C# skills, but you will not need them to finish this course:

- **Delegates and events in depth.** Middleware uses a delegate called `RequestDelegate`, and you will meet it in [Writing Custom Middleware](/courses/dotnet-mvc/writing-custom-middleware). Knowing what a lambda is is enough until then. See [Delegates](/courses/c-sharp/delegates) and [Events](/courses/c-sharp/events).
- **Threads and locks.** ASP.NET Core manages threads for you. Avoid `Thread`, `lock` and `.Result` in actions, and use `async` instead. See [Multithreading](/courses/c-sharp/multithreading) later.
- **Reflection, source generators, Span&lt;T&gt;, unsafe code and pointers.** Advanced topics for library authors and performance work.

## Your checklist

| C# concept | Where MVC uses it | C# topic |
| --- | --- | --- |
| Classes and properties | Models and view models | [Fields and Properties](/courses/c-sharp/fields-and-properties) |
| Methods and parameters | Controller actions | [Method Parameters and Return Types](/courses/c-sharp/method-parameters-and-return-types) |
| Inheritance | `: Controller` | [Inheritance](/courses/c-sharp/inheritance) |
| Interfaces | `IActionResult`, services | [Interfaces](/courses/c-sharp/interfaces) |
| Nullable `?` | `Product?`, `string?` | [Variables and Data Types](/courses/c-sharp/variables-and-data-types) |
| Attributes | Routing, validation, security | [Attributes](/courses/c-sharp/attributes) |
| Generics and collections | Passing lists to views | [Generics](/courses/c-sharp/generics) |
| Lambdas | Filters, configuration | [Lambda Expressions](/courses/c-sharp/lambda-expressions) |
| LINQ | Queries with EF Core | [LINQ Method Syntax](/courses/c-sharp/linq-method-syntax) |
| async and await | Database work | [Async and Await](/courses/c-sharp/async-and-await) |
| Constructors and DI | Getting services | [Dependency Injection Fundamentals](/courses/c-sharp/dependency-injection-fundamentals) |

If you can read the code panel on this page and explain roughly what each numbered part does, you are ready for MVC. Building a web API or a desktop app instead? The [Web API](/courses/dotnet-webapi/csharp-concepts-you-need-for-web-api) and [WPF](/courses/wpf/csharp-concepts-you-need-for-wpf) courses have their own version of this list.

## Quick recap

- MVC is plain C#, so a small set of language features covers almost everything you will write.
- Know classes, properties, methods, inheritance, interfaces, nullable types, attributes, generics, lambdas, LINQ and `async`/`await` before you start.
- Pick up dependency injection, top level statements, extension methods, exceptions and `using` as the course reaches them.
- Threads, reflection and low level performance features can wait.
- Each concept links to a full topic in the C# course when you want more depth.

<code id="code-content" class="language-csharp">
// Program.cs
// One file that uses every "know before you start" C# feature the way MVC does.
// The numbers match the sections of this topic.
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
var builder = WebApplication.CreateBuilder(args);       // 12. top level statements
builder.Services.AddControllersWithViews();             // 12. extension method
builder.Services.AddSingleton&lt;IProductService, ProductService&gt;(); // 4 + 11. interface and DI
var app = builder.Build();
app.MapControllerRoute("default", "{controller=Products}/{action=Index}/{id?}");
app.Run();
// 1. A model: a class with auto properties
public class Product
{
    public int Id { get; set; }
    [Required, StringLength(50)]                         // 6. attributes for validation
    public string Name { get; set; } = "";               // 5. not nullable, so it needs a value
    [Range(0.01, 10_000)]
    public decimal Price { get; set; }
}
// 4. An interface: the promise
public interface IProductService
{
    Task&lt;List&lt;Product&gt;&gt; GetAllAsync();                 // 7 + 10. generics and Task
    Product? Find(int id);                               // 5. may return null
}
// 4. A class that keeps the promise
public class ProductService : IProductService
{
    private readonly List&lt;Product&gt; _items = new()
    {
        new Product { Id = 1, Name = "Keyboard", Price = 49.99m },   // 1. object initializer
        new Product { Id = 2, Name = "Mouse", Price = 19.99m },
        new Product { Id = 3, Name = "Monitor", Price = 199.99m }
    };
    public async Task&lt;List&lt;Product&gt;&gt; GetAllAsync()
    {
        await Task.Delay(10);                            // pretend this is a database call
        return _items;
    }
    public Product? Find(int id) =&gt; _items.FirstOrDefault(p =&gt; p.Id == id); // 8 + 9. lambda and LINQ
}
// 3. Inheritance: ": Controller" gives us View(), NotFound() and ModelState
// 11. Primary constructor: MVC injects IProductService for us
public class ProductsController(IProductService products) : Controller
{
    // 2 + 10. GET /Products?maxPrice=50 : an async action with an optional parameter
    public async Task&lt;IActionResult&gt; Index(decimal? maxPrice = null)
    {
        List&lt;Product&gt; all = await products.GetAllAsync();
        var shown = all
            .Where(p =&gt; maxPrice is null || p.Price &lt;= maxPrice)   // 9. LINQ
            .OrderBy(p =&gt; p.Price)
            .ToList();
        ViewData["Title"] = $"{shown.Count} products";               // 13. interpolation
        return View(shown);
    }
    // GET /Products/Details/2
    public IActionResult Details(int id)
    {
        Product? product = products.Find(id);
        if (product is null)                             // 5. null check
        {
            return NotFound();
        }
        return View(product);
    }
    // POST /Products/Create
    [HttpPost]                                           // 6. attributes on actions
    [ValidateAntiForgeryToken]
    public IActionResult Create(Product product)
    {
        if (!ModelState.IsValid)                         // filled from the [Required] and [Range] attributes
        {
            return View(product);
        }
        return RedirectToAction(nameof(Index));
    }
}
</code></pre>
