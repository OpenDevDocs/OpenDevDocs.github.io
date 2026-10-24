---
publishDate: 2026-08-05T10:30
title: Route Parameters and Constraints
slug: route-parameters-and-constraints
metadescription: Capture values from URLs with route parameters, make them optional or give them defaults, restrict what matches with constraints such as int, min, alpha and regex, and write your own constraint.
updateDate: 2026-09-13T10:30
author: ['bishal-biswas']
level: 2
tags: ['routing', 'route-constraints', 'parameters']
course: dotnet-mvc
---

## Route parameters capture parts of the URL

Anything in curly braces in a route template is a **route parameter**. It captures that segment of the URL and hands the value to your action:

```csharp
[HttpGet("orders/{year}/{month}")]
public IActionResult Archive(int year, int month) => View();
```

```text
/orders/2026/09     year = 2026, month = 9
```

The parameter names in the template and in the method must match. The framework converts the text from the URL into the parameter's type, so `"2026"` becomes the integer `2026`.

## Optional parameters and defaults

A question mark makes a segment optional:

```csharp
[HttpGet("products/{page?}")]
public IActionResult Index(int page = 1) => View();
```

```text
/products        page = 1 (the C# default)
/products/3      page = 3
```

A route can also supply the default itself:

```csharp
[HttpGet("products/{page=1}")]
```

Either way, the segment can be left off. Optional segments must be at the end of the template. `products/{page?}/sort` is not allowed.

## Constraints decide what matches

A **constraint** restricts which values a parameter accepts. Write it after a colon:

```csharp
[HttpGet("products/{id:int}")]
public IActionResult Details(int id) => View();
```

Now `/products/42` matches and `/products/keyboard` does not. Without the constraint the route would match `keyboard`, model binding would fail to turn it into an `int`, and `id` would arrive as `0`.

The most useful constraints:

```text
{id:int}                 whole number
{price:decimal}          decimal number
{on:bool}                true or false
{when:datetime}          a date, such as 2026-09-13
{id:guid}                a GUID
{id:min(1)}              number of at least 1
{age:range(18,120)}      number between 18 and 120
{code:length(3)}         exactly 3 characters
{name:length(2,50)}      2 to 50 characters
{name:minlength(2)}      at least 2 characters
{slug:alpha}             letters only
{code:regex(^[a-z]{{3}}$)}   matches a regular expression
{slug:required}          non empty (useful with optional segments)
```

Constraints can be stacked. Each one must pass:

```csharp
[HttpGet("products/{id:int:min(1)}")]
```

In a regex constraint, curly braces have to be doubled, `{{3}}` rather than `{3}`, because single braces mean a parameter to the route parser.

## Why constraints matter: two routes with the same shape

The main job of constraints is to tell apart routes that look the same:

```csharp
[HttpGet("products/{id:int}")]        // /products/42
public IActionResult Details(int id) => View();

[HttpGet("products/{slug}")]          // /products/wireless-mouse
public IActionResult BySlug(string slug) => View();
```

Without `:int`, both routes match `/products/42` and the app throws an `AmbiguousMatchException`. With it, a number goes to `Details` and everything else goes to `BySlug`.

## Constraints are not validation

This is the point most beginners miss. A constraint decides whether a route **matches**. It does not report an error to the user.

```csharp
[HttpGet("products/{id:int:min(1)}")]
public IActionResult Details(int id) => View();
```

Visit `/products/0` and you get a `404`, because no route matched. The visitor does not learn that the id was too small. That is fine for URLs that only your own links produce. For anything a user types, validate inside the action and give a proper message:

```csharp
[HttpGet("products/{id:int}")]
public IActionResult Details(int id)
{
    if (id < 1)
    {
        return BadRequest("Product id must be 1 or higher.");
    }
    // ...
}
```

Use constraints to choose between routes. Use validation to check input.

## Catch all parameters

An asterisk captures everything left in the URL, slashes included:

```csharp
[HttpGet("files/{*path}")]
public IActionResult Browse(string? path) => View();
```

```text
/files/reports/2026/summary.pdf     path = "reports/2026/summary.pdf"
/files                              path = null
```

Slashes in the value are encoded when the framework generates a URL for this route. Use `{**path}` instead if you want them left alone in generated links.

## Constraints in conventional routes

Everything above works in `Program.cs` too:

```csharp
app.MapControllerRoute(
    name: "archive",
    pattern: "orders/{year:int:range(2000,2100)}/{month:int:range(1,12)}",
    defaults: new { controller = "Orders", action = "Archive" });
```

## Writing your own constraint

When the built in list is not enough, implement `IRouteConstraint`. Here is one that only accepts a product code such as `KB-1001`:

```csharp
public class ProductCodeConstraint : IRouteConstraint
{
    public bool Match(HttpContext? httpContext, IRouter? route, string routeKey,
        RouteValueDictionary values, RouteDirection routeDirection)
    {
        if (values[routeKey] is not string value)
        {
            return false;
        }

        return value.Length == 7
            && char.IsLetter(value[0])
            && char.IsLetter(value[1])
            && value[2] == '-'
            && value[3..].All(char.IsDigit);
    }
}
```

Register it with a name in `Program.cs`:

```csharp
builder.Services.AddRouting(options =>
{
    options.ConstraintMap.Add("productCode", typeof(ProductCodeConstraint));
});
```

Then use it like any other:

```csharp
[HttpGet("products/{code:productCode}")]
public IActionResult ByCode(string code) => View();
```

For a simple pattern, a `regex` constraint is quicker. Write a class when the rule needs real code or is reused in many places.

## Quick recap

- `{name}` captures a segment of the URL and passes it to the action parameter with the same name.
- `{name?}` makes a segment optional and `{name=value}` gives it a default. Optional segments go at the end.
- Constraints such as `{id:int}`, `{id:min(1)}` and `{slug:alpha}` limit what a route matches, and they can be stacked.
- Constraints tell apart routes with the same shape. They are not validation, because a failed constraint gives a plain 404.
- `{*path}` captures the rest of the URL including slashes.
- Implement `IRouteConstraint` and register it in `ConstraintMap` for rules the built in constraints cannot express.

<code id="code-content" class="language-csharp">
// Controllers/ProductsController.cs
// Parameters, defaults, constraints and a catch all, side by side.
using Microsoft.AspNetCore.Mvc;
namespace ShopApp.Controllers;
[Route("products")]
public class ProductsController : Controller
{
    // GET /products          page = 1
    // GET /products/page/3   page = 3
    [HttpGet("")]
    [HttpGet("page/{page:int:min(1)}")]
    public IActionResult Index(int page = 1)
    {
        return Content($"Product list, page {page}");
    }
    // GET /products/42       a number, so this route wins
    [HttpGet("{id:int}")]
    public IActionResult Details(int id)
    {
        // The constraint chose the route. Validation is still our job.
        if (id &lt; 1)
        {
            return BadRequest("Product id must be 1 or higher.");
        }
        return Content($"Product #{id}");
    }
    // GET /products/wireless-mouse   letters and hyphens only
    [HttpGet("{slug:regex(^[a-z0-9-]+$)}")]
    public IActionResult BySlug(string slug)
    {
        return Content($"Product with slug '{slug}'");
    }
    // GET /products/code/KB-1001    a custom constraint registered as "productCode"
    [HttpGet("code/{code:productCode}")]
    public IActionResult ByCode(string code)
    {
        return Content($"Product with code {code}");
    }
    // GET /products/archive/2026/9   two constrained numbers
    [HttpGet("archive/{year:int:range(2000,2100)}/{month:int:range(1,12)}")]
    public IActionResult Archive(int year, int month)
    {
        return Content($"Products added in {year}-{month:00}");
    }
    // GET /products/files/manuals/kb/setup.pdf   path = "manuals/kb/setup.pdf"
    [HttpGet("files/{*path}")]
    public IActionResult Files(string? path)
    {
        return Content($"File path: {path ?? "(root)"}");
    }
}
// Routing/ProductCodeConstraint.cs
// Accepts codes like KB-1001: two letters, a hyphen, four digits.
public class ProductCodeConstraint : IRouteConstraint
{
    public bool Match(HttpContext? httpContext, IRouter? route, string routeKey,
        RouteValueDictionary values, RouteDirection routeDirection)
    {
        if (values[routeKey] is not string value || value.Length != 7)
        {
            return false;
        }
        return char.IsLetter(value[0]) &amp;&amp; char.IsLetter(value[1])
            &amp;&amp; value[2] == '-' &amp;&amp; value[3..].All(char.IsDigit);
    }
}
// Program.cs (the registration line)
//   builder.Services.AddRouting(options =&gt;
//       options.ConstraintMap.Add("productCode", typeof(ProductCodeConstraint)));
</code></pre>
