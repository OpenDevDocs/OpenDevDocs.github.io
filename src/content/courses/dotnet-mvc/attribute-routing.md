---
publishDate: 2026-08-04T10:20
title: Attribute Routing
slug: attribute-routing
metadescription: Put URLs directly on controllers and actions with Route, HttpGet and HttpPost attributes, use the controller and action tokens, combine prefixes, and mix attribute routes with the default route.
updateDate: 2026-09-13T10:20
author: ['bishal-biswas']
level: 1
tags: ['routing', 'attribute-routing', 'controllers']
course: dotnet-mvc
---

## Routes on the code itself

With conventional routing, URL patterns live in `Program.cs` and apply to every controller. With **attribute routing**, you write the URL right next to the action that handles it:

```csharp
public class ProductsController : Controller
{
    [Route("products")]
    public IActionResult Index() => View();

    [Route("products/{id}")]
    public IActionResult Details(int id) => View();
}
```

Now `/products` runs `Index` and `/products/42` runs `Details(42)`. The default route in `Program.cs` is ignored for these actions, because an action with a route attribute is only reachable through that route.

Attribute routing is the better choice when you care about exactly how each URL looks, which is usually the case for a public site.

## A prefix on the controller

Repeating `products/` on every action is noisy. Put the shared part on the class:

```csharp
[Route("products")]
public class ProductsController : Controller
{
    [Route("")]              // /products
    public IActionResult Index() => View();

    [Route("{id}")]          // /products/42
    public IActionResult Details(int id) => View();

    [Route("new")]           // /products/new
    public IActionResult Create() => View();
}
```

The controller route and the action route are joined with a slash. An empty `[Route("")]` means "just the prefix".

## Combining the HTTP method and the route

`[HttpGet]` and `[HttpPost]` accept a route template too. This is the most common way to write attribute routes, because it says the method and the URL in one place:

```csharp
[Route("products")]
public class ProductsController : Controller
{
    [HttpGet("")]                // GET /products
    public IActionResult Index() => View();

    [HttpGet("{id}")]            // GET /products/42
    public IActionResult Details(int id) => View();

    [HttpGet("new")]             // GET /products/new
    public IActionResult Create() => View();

    [HttpPost("new")]            // POST /products/new
    public IActionResult Create(Product product) => RedirectToAction("Index");
}
```

Notice the GET and POST pair for `Create`. Same URL, different method, two actions.

## The [controller] and [action] tokens

Writing the controller name in the route means changing it in two places if you rename the class. Tokens fix that:

```csharp
[Route("[controller]")]
public class ProductsController : Controller
{
    [HttpGet("")]                // /Products
    public IActionResult Index() => View();

    [HttpGet("[action]/{id}")]   // /Products/Details/42
    public IActionResult Details(int id) => View();
}
```

`[controller]` is replaced with the class name minus the `Controller` suffix, and `[action]` with the method name. A pattern of `[controller]/[action]/{id?}` on a controller behaves exactly like the default conventional route.

## Starting from the root

A route that begins with `/` or `~/` ignores the controller prefix:

```csharp
[Route("products")]
public class ProductsController : Controller
{
    [HttpGet("/deals")]          // /deals, not /products/deals
    public IActionResult Deals() => View();
}
```

This is how you give one action a short memorable URL while the rest of the controller stays under its prefix.

## Several routes for one action

An action can answer to more than one URL. Stack the attributes:

```csharp
[HttpGet("")]
[HttpGet("all")]
[HttpGet("/catalog")]
public IActionResult Index() => View();
```

`/products`, `/products/all` and `/catalog` all run `Index`. This is handy when an old URL must keep working after a redesign. Do not overuse it, because links generated for this action will use the first route.

## Parameters and constraints

Route parameters work the same as in conventional routes. Add a constraint with a colon to limit what matches:

```csharp
[HttpGet("{id:int}")]                 // only numbers: /products/42
public IActionResult Details(int id) => View();

[HttpGet("{slug}")]                   // anything else: /products/wireless-mouse
public IActionResult BySlug(string slug) => View();
```

Both routes have one segment, but `42` matches the first because it is an integer, and `wireless-mouse` matches the second. Constraints get a full topic next.

## Named routes

Give a route a name so you can build links to it without knowing the controller and action:

```csharp
[HttpGet("{id:int}", Name = "ProductDetails")]
public IActionResult Details(int id) => View();
```

```cshtml
<a asp-route="ProductDetails" asp-route-id="42">Keyboard</a>
```

Route names must be unique across the whole app.

## Mixing both styles

An app can use both kinds of routing. Controllers with route attributes use them. Controllers without any use the conventional routes from `Program.cs`. The only rule is that a single action cannot be reached both ways: once it has an attribute route, the conventional route no longer applies to it.

One trap: a controller with `[Route("products")]` on the class makes **every** action in it attribute routed, even actions with no attribute of their own. Those actions become unreachable unless they also get a route. If you see a 404 for an action you are sure exists, check for a class level `[Route]`.

## When two routes collide

If two actions can match the same URL and method, the framework throws an `AmbiguousMatchException`:

```text
AmbiguousMatchException: The request matched multiple endpoints. Matches:
ShopApp.Controllers.ProductsController.Details
ShopApp.Controllers.ProductsController.BySlug
```

Fix it by making the routes different, adding a constraint, or setting `Order` on the attribute so one is checked first. A lower `Order` wins, and the default is `0`.

## Quick recap

- Attribute routing puts the URL on the action with `[Route]`, `[HttpGet("...")]` or `[HttpPost("...")]`.
- A `[Route]` on the controller is a prefix for every action inside it.
- `[controller]` and `[action]` tokens keep routes in sync when you rename things.
- A route that starts with `/` ignores the controller prefix.
- Constraints such as `{id:int}` let two routes with the same shape match different values.
- An action with an attribute route is only reachable through that route. A class level `[Route]` turns the whole controller into attribute routing.

<code id="code-content" class="language-csharp">
// Controllers/ProductsController.cs
// Every action has its own URL, written next to the code that handles it.
using Microsoft.AspNetCore.Mvc;
using ShopApp.Models;
namespace ShopApp.Controllers;
[Route("products")]                    // prefix for every action below
public class ProductsController : Controller
{
    private static readonly List&lt;Product&gt; Products = new()
    {
        new Product { Id = 1, Name = "Keyboard", Slug = "keyboard", Price = 49.99m },
        new Product { Id = 2, Name = "Wireless Mouse", Slug = "wireless-mouse", Price = 19.99m }
    };
    // GET /products
    // GET /catalog      (a second, root level URL for the same page)
    [HttpGet("")]
    [HttpGet("/catalog")]
    public IActionResult Index() =&gt; View(Products);
    // GET /products/2   only matches a number, thanks to :int
    [HttpGet("{id:int}", Name = "ProductDetails")]
    public IActionResult Details(int id)
    {
        Product? product = Products.FirstOrDefault(p =&gt; p.Id == id);
        return product is null ? NotFound() : View(product);
    }
    // GET /products/wireless-mouse   anything that is not a number
    [HttpGet("{slug}")]
    public IActionResult BySlug(string slug)
    {
        Product? product = Products.FirstOrDefault(p =&gt; p.Slug == slug);
        return product is null ? NotFound() : View("Details", product);
    }
    // GET /products/new      shows the form
    [HttpGet("new")]
    public IActionResult Create() =&gt; View();
    // POST /products/new     receives the form
    [HttpPost("new")]
    public IActionResult Create(Product product)
    {
        if (!ModelState.IsValid) return View(product);
        product.Id = Products.Max(p =&gt; p.Id) + 1;
        Products.Add(product);
        return RedirectToRoute("ProductDetails", new { id = product.Id });
    }
    // GET /deals    starts with '/', so the 'products' prefix is skipped
    [HttpGet("/deals")]
    public IActionResult Deals() =&gt; View(Products.Where(p =&gt; p.Price &lt; 30).ToList());
}
// Controllers/HomeController.cs
// No attributes at all, so it still uses the default route from Program.cs:
//   /            -&gt; Index
//   /Home/About  -&gt; About
public class HomeController : Controller
{
    public IActionResult Index() =&gt; View();
    public IActionResult About() =&gt; View();
}
</code></pre>
