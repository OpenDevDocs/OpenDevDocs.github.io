---
publishDate: 2026-08-02T09:40
title: Controllers and Action Methods
slug: controllers-and-action-methods
metadescription: Learn what a controller is, how action methods handle requests, how parameters arrive from the URL, what the Controller base class gives you, and how to keep controllers small and focused.
updateDate: 2026-09-13T09:40
author: ['bishal-biswas']
level: 1
tags: ['controllers', 'actions', 'basics']
course: dotnet-mvc
---

## What a controller does

A **controller** is a C# class that receives requests and decides what to send back. It is the "C" in MVC and the traffic officer of your app.

Each public method in a controller is an **action**. One action handles one kind of request: show the product list, show one product, save a new product, and so on.

```csharp
using Microsoft.AspNetCore.Mvc;

namespace ShopApp.Controllers;

public class ProductsController : Controller
{
    public IActionResult Index()
    {
        return View();
    }
}
```

Three things make this a controller:

1. It lives in the `Controllers` folder (a convention, not a requirement).
2. Its name ends with `Controller`.
3. It inherits from `Controller`, which gives it a toolbox of helper methods.

Visiting `/Products` or `/Products/Index` runs the `Index` action.

## The naming rule

The `Controller` suffix is required and it is dropped from URLs. That gives you this mapping:

```text
ProductsController   handles   /Products/...
OrdersController     handles   /Orders/...
AccountController    handles   /Account/...
```

Name controllers after the thing they manage, usually as a plural noun. A controller called `DoStuffController` is a sign that something is off.

## Actions and parameters

An action can take parameters. The framework fills them in from the request, a feature called **model binding**. With the default route, the third part of the URL becomes a parameter named `id`:

```csharp
// GET /Products/Details/5   ->   id = 5
public IActionResult Details(int id)
{
    return Content($"You asked for product {id}");
}
```

Values from the query string bind by name too:

```csharp
// GET /Products/Search?term=mouse&maxPrice=50
public IActionResult Search(string term, decimal maxPrice)
{
    return Content($"Searching for {term} under {maxPrice}");
}
```

The parameter names must match the names in the URL. Matching is case insensitive, so `?Term=mouse` also works.

If a value is missing, the parameter gets its default: `0` for `int`, `null` for `string`. Make a parameter nullable, such as `int? page`, when missing is a normal case.

## Return types

Almost every action returns `IActionResult`. It is an interface that means "some kind of response". `View()`, `Content()`, `RedirectToAction()` and `NotFound()` all return something that implements it, so one action can choose between them:

```csharp
public IActionResult Details(int id)
{
    var product = FindProduct(id);

    if (product is null)
    {
        return NotFound();
    }

    return View(product);
}
```

The next topic goes through every result type. For now, remember `View()` for pages and `IActionResult` as the return type.

## Which methods become actions

Every **public** method in a controller is an action, even if you did not mean it to be. A helper method like this would be reachable at `/Products/FindProduct`:

```csharp
public Product? FindProduct(int id) { /* ... */ }
```

Fix it by making the method `private`, or by marking it with `[NonAction]`:

```csharp
[NonAction]
public Product? FindProduct(int id) { /* ... */ }
```

Private is the better choice in almost every case.

## What the Controller base class gives you

Inheriting from `Controller` gives you helper methods to build responses:

```csharp
View()                                 // render a view
View("Custom")                         // render a differently named view
View(model)                            // render a view with data
RedirectToAction("Index")              // go to another action
RedirectToAction("Details", new { id = 5 })
Redirect("https://example.com")        // go to any URL
Content("plain text")                  // send text
Json(new { ok = true })                // send JSON
File(bytes, "application/pdf")         // send a file
NotFound()                             // 404
BadRequest()                           // 400
StatusCode(500)                        // any status code
```

It also gives you properties that describe the current request:

```csharp
Request        // the incoming request: headers, query string, cookies
Response       // the outgoing response
HttpContext    // everything about the current request and response
User           // who is logged in
ModelState     // validation results for bound parameters
ViewData       // a dictionary passed to the view
ViewBag        // the same dictionary with a friendlier syntax
TempData       // data that survives one redirect
Url            // builds URLs to actions
```

You will use each of these in later topics. `ViewData`, `ViewBag` and `TempData` are covered when you learn to pass data to views.

## Controller versus ControllerBase

There are two base classes:

- `ControllerBase` has the request handling basics, and it is what Web API controllers use.
- `Controller` inherits from `ControllerBase` and adds view support: `View()`, `PartialView()`, `ViewData`, `ViewBag` and `TempData`.

For MVC websites, always inherit from `Controller`.

## Controllers get their tools through the constructor

Actions often need something: a database, a logger, an email sender. You do not create these inside the controller. You ask for them in the constructor and the framework hands them over. This is **dependency injection**:

```csharp
public class ProductsController : Controller
{
    private readonly ILogger<ProductsController> _logger;

    public ProductsController(ILogger<ProductsController> logger)
    {
        _logger = logger;
    }

    public IActionResult Index()
    {
        _logger.LogInformation("Product list requested");
        return View();
    }
}
```

The `ILogger` service is registered by default. Your own services get registered in `Program.cs`, and there is a full topic on how that works.

## A new controller is created for every request

The framework creates a fresh instance of your controller for each request and throws it away afterwards. That has a consequence: fields on a controller do not remember anything between requests.

```csharp
public class CounterController : Controller
{
    private int _count = 0;

    // Always shows 1. Every request gets a brand new controller.
    public IActionResult Index() => Content($"Count: {++_count}");
}
```

Anything that must survive between requests belongs in a database, a cache, or session state, all of which come later.

## Keep controllers thin

A good action reads like a short to do list: get input, ask a service to do the work, pick a response.

```csharp
public IActionResult Index()
{
    var products = _productService.GetAll();
    return View(products);
}
```

Business rules, database queries and calculations belong in other classes. A controller that is hundreds of lines long is hard to read and hard to test. Keep it as the traffic officer, not the whole city.

## Quick recap

- A controller is a class ending in `Controller` that inherits from `Controller`. Its public methods are actions.
- The suffix is dropped in URLs: `ProductsController` handles `/Products/...`.
- Action parameters are filled from the URL and query string by name. Missing values get defaults, so use nullable types when a value is optional.
- Return `IActionResult` and pick a result with helpers such as `View()`, `RedirectToAction()` and `NotFound()`.
- Mark helper methods `private` or `[NonAction]` so they do not become reachable URLs.
- Controllers get their dependencies through the constructor, and a new controller instance is created for every request.

<code id="code-content" class="language-csharp">
// Controllers/ProductsController.cs
// A complete controller with several actions and a private helper.
using Microsoft.AspNetCore.Mvc;
using ShopApp.Models;
namespace ShopApp.Controllers;
public class ProductsController : Controller
{
    // Stand in for a database until we add EF Core later in the course.
    // 'static' so the list is shared, because a new controller is
    // created for every request.
    private static readonly List&lt;Product&gt; Products = new()
    {
        new Product { Id = 1, Name = "Keyboard", Price = 49.99m },
        new Product { Id = 2, Name = "Mouse", Price = 19.99m },
        new Product { Id = 3, Name = "Monitor", Price = 199.99m }
    };
    private readonly ILogger&lt;ProductsController&gt; _logger;
    // The framework supplies the logger. This is dependency injection.
    public ProductsController(ILogger&lt;ProductsController&gt; logger)
    {
        _logger = logger;
    }
    // GET /Products  or  /Products/Index
    public IActionResult Index()
    {
        _logger.LogInformation("Listing {Count} products", Products.Count);
        return View(Products);                  // Views/Products/Index.cshtml
    }
    // GET /Products/Details/2   (the route's {id?} segment)
    public IActionResult Details(int id)
    {
        Product? product = FindProduct(id);
        if (product is null)
        {
            return NotFound();                  // 404
        }
        return View(product);                   // Views/Products/Details.cshtml
    }
    // GET /Products/Search?term=mo&amp;maxPrice=100   (query string values)
    public IActionResult Search(string? term, decimal? maxPrice)
    {
        IEnumerable&lt;Product&gt; results = Products;
        if (!string.IsNullOrWhiteSpace(term))
        {
            results = results.Where(p =&gt;
                p.Name.Contains(term, StringComparison.OrdinalIgnoreCase));
        }
        if (maxPrice is not null)
        {
            results = results.Where(p =&gt; p.Price &lt;= maxPrice);
        }
        return View("Index", results.ToList()); // reuse the Index view
    }
    // GET /Products/Cheapest
    public IActionResult Cheapest()
    {
        Product cheapest = Products.MinBy(p =&gt; p.Price)!;
        // Send the visitor to the Details page of that product
        return RedirectToAction("Details", new { id = cheapest.Id });
    }
    // Private, so it is NOT reachable as /Products/FindProduct
    private static Product? FindProduct(int id)
    {
        return Products.FirstOrDefault(p =&gt; p.Id == id);
    }
}
// Models/Product.cs
namespace ShopApp.Models;
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
}
</code></pre>
