---
publishDate: 2026-08-06T10:50
title: Introduction to Razor Views
slug: introduction-to-razor-views
metadescription: Learn what a Razor view is, how the View method finds the right cshtml file, how a strongly typed model flows from the action into the page, and how views are compiled.
updateDate: 2026-09-13T10:50
author: ['bishal-biswas']
level: 1
tags: ['razor', 'views', 'basics']
course: dotnet-mvc
---

## What a view is

A **view** is a file that produces HTML. In ASP.NET Core MVC, views are written in **Razor**, a template language that mixes HTML with small pieces of C#. Razor files end in `.cshtml`.

Here is a complete view:

```cshtml
@model Product

<h1>@Model.Name</h1>
<p>Price: @Model.Price.ToString("C")</p>
```

Everything that starts with `@` is C#. Everything else is HTML sent to the browser exactly as written. When the view runs with a product called "Keyboard", the browser receives:

```html
<h1>Keyboard</h1>
<p>Price: $49.99</p>
```

The view never talks to the database and never reads the request. It receives data from the controller and turns it into HTML. That single job is what keeps views easy to read.

## From action to view

An action hands data to a view with `View()`:

```csharp
public IActionResult Details(int id)
{
    var product = _repo.Find(id);
    return View(product);
}
```

The object you pass is the view's **model**. The view declares what type it expects with the `@model` directive (lowercase), and then reads it through the `Model` property (uppercase):

```cshtml
@model Product

<h1>@Model.Name</h1>
```

Because the type is declared, you get code completion in your editor and a compile error if you misspell a property. This is called a **strongly typed view**, and it is the way to write nearly every view.

## How the framework finds the view

`View()` with no name looks for a file named after the action, in a folder named after the controller:

```text
ProductsController.Details()   ->   Views/Products/Details.cshtml
```

If the file is not there, it tries the shared folder:

```text
Views/Shared/Details.cshtml
```

Then it gives up with an error that lists every path it searched. That error message is your friend: it tells you exactly where to create the file.

You can also name the view yourself:

```csharp
return View("Summary");                 // Views/Products/Summary.cshtml
return View("Summary", product);        // with a model
return View("~/Views/Legacy/Old.cshtml", product);   // an exact path
```

## Views/Shared is for reuse

Anything in `Views/Shared` is available to every controller. The layout, error page and reusable fragments live there. If two controllers both need a `NotFound` view, put it in `Shared` once instead of copying it.

## Views can only see what you give them

A view has no access to the controller's fields or the request body. Its inputs are:

- The **model** passed to `View()`.
- `ViewData` and `ViewBag`, a loose dictionary for small extras such as a page title.
- `TempData`, for messages that survive a redirect.
- Services pulled in with `@inject`.

The topic on passing data to views covers each of these. The rule of thumb: put the page's real data in the model, and use `ViewData` only for small odds and ends.

## What a view looks like in a real app

A view for a product list uses a loop to repeat a piece of HTML for each item:

```cshtml
@model List<Product>

<h1>Products</h1>

<ul>
    @foreach (var product in Model)
    {
        <li>
            <a asp-action="Details" asp-route-id="@product.Id">@product.Name</a>
            <span>@product.Price.ToString("C")</span>
        </li>
    }
</ul>
```

Notice how the C# `foreach` wraps HTML without any special markers. Razor understands where the C# ends and the HTML begins by watching for tags. The next topic explains the syntax rules in detail.

## Views are compiled

Razor views are not interpreted at runtime like a scripting language. When you build the project, each `.cshtml` file is turned into a C# class and compiled into the app. That means:

- Typos in C# code inside a view are caught at build time.
- Rendering is fast, because there is nothing to parse when a request comes in.
- The published app does not need the `.cshtml` files at all.

While developing, `dotnet watch` recompiles a changed view and refreshes the browser automatically, so you still get the quick edit and refresh loop.

## Razor views are HTML safe by default

When you print a value with `@`, Razor **encodes** it. A product named `<script>alert(1)</script>` renders as harmless text, not as a running script:

```html
&lt;script&gt;alert(1)&lt;/script&gt;
```

This protects you from a common attack called cross site scripting. You get this protection without doing anything. The only way to switch it off is `Html.Raw`, which you should treat with suspicion whenever you see it.

## Quick recap

- A view is a `.cshtml` file that mixes HTML with C# marked by `@`, and its only job is turning data into HTML.
- The action passes an object with `View(model)`. The view declares its type with `@model` and reads it as `Model`.
- `View()` finds the file at `Views/{Controller}/{Action}.cshtml`, then `Views/Shared`, and the error message lists both if neither exists.
- `Views/Shared` holds views and pieces used by more than one controller.
- Views are compiled into C# classes at build time, so mistakes show up early and pages render fast.
- Values printed with `@` are HTML encoded, which blocks script injection automatically.

<code id="code-content" class="language-csharp">
// Controllers/ProductsController.cs
// Each action passes a model to a view. The file names follow the convention
// Views/Products/{Action}.cshtml, and the views are shown below as comments.
using Microsoft.AspNetCore.Mvc;
using ShopApp.Models;
namespace ShopApp.Controllers;
public class ProductsController : Controller
{
    private static readonly List&lt;Product&gt; Products = new()
    {
        new Product { Id = 1, Name = "Keyboard", Price = 49.99m },
        new Product { Id = 2, Name = "Mouse", Price = 19.99m },
        new Product { Id = 3, Name = "Monitor", Price = 199.99m }
    };
    // GET /Products  -&gt;  Views/Products/Index.cshtml with a List&lt;Product&gt;
    public IActionResult Index()
    {
        return View(Products);
    }
    // GET /Products/Details/2  -&gt;  Views/Products/Details.cshtml with one Product
    public IActionResult Details(int id)
    {
        Product? product = Products.FirstOrDefault(p =&gt; p.Id == id);
        if (product is null)
        {
            // Views/Shared/NotFound.cshtml, shared by every controller
            return View("NotFound");
        }
        return View(product);
    }
}
// Views/Products/Index.cshtml
//
//   @model List&lt;Product&gt;
//   &lt;h1&gt;Products&lt;/h1&gt;
//   &lt;ul&gt;
//       @foreach (var product in Model)
//       {
//           &lt;li&gt;
//               &lt;a asp-action="Details" asp-route-id="@product.Id"&gt;@product.Name&lt;/a&gt;
//               &lt;span&gt;@product.Price.ToString("C")&lt;/span&gt;
//           &lt;/li&gt;
//       }
//   &lt;/ul&gt;
// Views/Products/Details.cshtml
//
//   @model Product
//   &lt;h1&gt;@Model.Name&lt;/h1&gt;
//   &lt;p&gt;Price: @Model.Price.ToString("C")&lt;/p&gt;
//   &lt;a asp-action="Index"&gt;Back to list&lt;/a&gt;
// Views/Shared/NotFound.cshtml
//
//   &lt;h1&gt;Not found&lt;/h1&gt;
//   &lt;p&gt;We could not find what you were looking for.&lt;/p&gt;
// Rendered HTML for /Products/Details/2
//
//   &lt;h1&gt;Mouse&lt;/h1&gt;
//   &lt;p&gt;Price: $19.99&lt;/p&gt;
//   &lt;a href="/Products"&gt;Back to list&lt;/a&gt;
</code></pre>
