---
publishDate: 2026-08-07T11:10
title: Passing Data to Views
slug: passing-data-to-views
metadescription: Compare the four ways a controller can send data to a view, strongly typed models, ViewData, ViewBag and TempData, learn when each one fits, and see why the model should carry the real data.
updateDate: 2026-09-13T11:10
author: ['bishal-biswas']
level: 1
tags: ['views', 'viewdata', 'viewbag', 'models']
course: dotnet-mvc
---

## Four ways to send data

A view can only show what the controller gives it. There are four channels:

1. The **model**, one typed object passed to `View()`.
2. **ViewData**, a dictionary of loose values.
3. **ViewBag**, the same dictionary with a shorter syntax.
4. **TempData**, a dictionary that survives one redirect.

You will use the model for almost everything, `ViewData` for small extras like the page title, and `TempData` for messages after a redirect. Let us look at each.

## The model

Pass an object to `View()` and declare its type in the view:

```csharp
public IActionResult Details(int id)
{
    var product = _repo.Find(id);
    return View(product);
}
```

```cshtml
@model Product

<h1>@Model.Name</h1>
<p>@Model.Price.ToString("C")</p>
```

This is a **strongly typed view**. The compiler knows `Model` is a `Product`, so it checks your property names and your editor offers completion. Mistakes show up when you build, not when a visitor opens the page.

The model can be any type: a class, a record, a list, or a class that groups several things together. For a list:

```csharp
return View(_repo.GetAll());        // a List<Product>
```

```cshtml
@model List<Product>

@foreach (var product in Model)
{
    <p>@product.Name</p>
}
```

## When a page needs several things

A product page might need the product, its reviews and a list of related items. `View()` takes only one object, so make a class that holds all three:

```csharp
public class ProductPageViewModel
{
    public Product Product { get; set; } = null!;
    public List<Review> Reviews { get; set; } = new();
    public List<Product> Related { get; set; } = new();
}
```

```csharp
var vm = new ProductPageViewModel
{
    Product = _repo.Find(id),
    Reviews = _reviews.ForProduct(id),
    Related = _repo.Related(id)
};

return View(vm);
```

```cshtml
@model ProductPageViewModel

<h1>@Model.Product.Name</h1>
<p>@Model.Reviews.Count reviews</p>
```

This is a **view model**: a class shaped for one page. The topic on models and view models goes deeper, but the idea is simple. When a page needs more than one thing, wrap them in one object.

## ViewData

`ViewData` is a dictionary of `string` keys and `object` values. The controller writes, the view reads:

```csharp
public IActionResult Index()
{
    ViewData["Title"] = "All products";
    ViewData["Count"] = 42;
    return View(_repo.GetAll());
}
```

```cshtml
<h1>@ViewData["Title"]</h1>
<p>@ViewData["Count"] products</p>
```

Because values are stored as `object`, you must cast to use them as their real type:

```cshtml
@{
    var count = (int)ViewData["Count"]!;
}
```

A misspelt key is not a compile error. It just gives `null`. That is the trade off: `ViewData` is convenient but the compiler cannot help you.

The template uses `ViewData["Title"]` in every view, and the layout prints it in the `<title>` tag. That is the perfect use: a small value that the layout needs and the model has no business carrying.

## ViewBag

`ViewBag` is `ViewData` with a nicer syntax. Both read and write the same dictionary:

```csharp
ViewBag.Title = "All products";
ViewBag.Count = 42;
```

```cshtml
<h1>@ViewBag.Title</h1>
<p>@ViewBag.Count products</p>
```

`ViewBag` is `dynamic`, so no casting is needed, but you also get no compile time checks and no code completion. `ViewData["Title"]` and `ViewBag.Title` are the same value. Pick one style and stay consistent.

## TempData

`TempData` is different: it survives a **redirect**. Set a value in one action, redirect, and read it in the next action's view:

```csharp
[HttpPost]
public IActionResult Create(Product product)
{
    _repo.Add(product);
    TempData["Message"] = $"{product.Name} was added.";
    return RedirectToAction("Index");
}
```

```cshtml
@if (TempData["Message"] is string message)
{
    <div class="alert alert-success">@message</div>
}
```

The value is deleted as soon as it is read. Refresh the page and the message is gone. That is exactly what a "saved successfully" banner should do. `TempData` is stored in a cookie by default, and it has its own topic later in the course.

## Choosing the right channel

| Need | Use |
| --- | --- |
| The page's real data | The model |
| Several pieces of data | A view model class |
| The page title or a small flag | `ViewData` or `ViewBag` |
| A message shown after a redirect | `TempData` |

A good sign that something is wrong: a view with a dozen `ViewBag` lines. Those values belong in a view model, where they have names, types and compiler checks.

## Data every view needs

Two more channels exist for values that are not really "data from the controller":

- `@inject` pulls a service straight into the view, useful for things like a settings service or the current user's profile.
- Layouts and partial views see the same `ViewData` as the view that used them, which is how the layout reads the title.

Both are covered in their own topics.

## Quick recap

- Pass the page's data as the model with `View(model)` and declare its type with `@model`. This is strongly typed and checked by the compiler.
- When a page needs several things, group them in a view model class.
- `ViewData["Key"]` and `ViewBag.Key` are the same loose dictionary. Use them for small extras such as the title.
- `TempData` survives one redirect and is deleted when read, which makes it right for success messages.
- Values in `ViewData` and `ViewBag` are not checked by the compiler, so keep real data in the model.

<code id="code-content" class="language-csharp">
// Controllers/ProductsController.cs
// All four channels in one controller, each used for the job it fits.
using Microsoft.AspNetCore.Mvc;
using ShopApp.Models;
namespace ShopApp.Controllers;
public class ProductsController : Controller
{
    private static readonly List&lt;Product&gt; Products = new()
    {
        new Product { Id = 1, Name = "Keyboard", Price = 49.99m },
        new Product { Id = 2, Name = "Mouse", Price = 19.99m }
    };
    // GET /Products
    public IActionResult Index()
    {
        ViewData["Title"] = "All products";     // small extra, read by the layout
        ViewBag.ShowPrices = true;              // same dictionary, shorter syntax
        return View(Products);                  // the real data is the model
    }
    // GET /Products/Details/1
    public IActionResult Details(int id)
    {
        Product? product = Products.FirstOrDefault(p =&gt; p.Id == id);
        if (product is null) return NotFound();
        // The page needs several things, so wrap them in one view model
        var vm = new ProductPageViewModel
        {
            Product = product,
            Related = Products.Where(p =&gt; p.Id != id).ToList(),
            ReviewCount = 12
        };
        ViewData["Title"] = product.Name;
        return View(vm);
    }
    // POST /Products/Create
    [HttpPost]
    public IActionResult Create(Product product)
    {
        product.Id = Products.Max(p =&gt; p.Id) + 1;
        Products.Add(product);
        // Survives the redirect below, then disappears once it is read
        TempData["Message"] = $"{product.Name} was added.";
        return RedirectToAction("Index");
    }
}
// ViewModels/ProductPageViewModel.cs
namespace ShopApp.Models;
public class ProductPageViewModel
{
    public Product Product { get; set; } = null!;
    public List&lt;Product&gt; Related { get; set; } = new();
    public int ReviewCount { get; set; }
}
// Views/Products/Index.cshtml
//
//   @model List&lt;Product&gt;
//   &lt;h1&gt;@ViewData["Title"]&lt;/h1&gt;
//   @if (TempData["Message"] is string message)
//   {
//       &lt;div class="alert alert-success"&gt;@message&lt;/div&gt;
//   }
//   @foreach (var p in Model)
//   {
//       &lt;p&gt;@p.Name @(ViewBag.ShowPrices ? p.Price.ToString("C") : "")&lt;/p&gt;
//   }
// Views/Products/Details.cshtml
//
//   @model ProductPageViewModel
//   &lt;h1&gt;@Model.Product.Name&lt;/h1&gt;
//   &lt;p&gt;@Model.ReviewCount reviews&lt;/p&gt;
//   &lt;h2&gt;You may also like&lt;/h2&gt;
//   @foreach (var p in Model.Related) { &lt;p&gt;@p.Name&lt;/p&gt; }
</code></pre>
