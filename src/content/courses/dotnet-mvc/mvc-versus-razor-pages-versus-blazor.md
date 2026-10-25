---
publishDate: 2026-08-30T16:00
title: MVC versus Razor Pages versus Blazor
slug: mvc-versus-razor-pages-versus-blazor
metadescription: Compare the three ways to build web UI on ASP.NET Core, see the same feature written in MVC, Razor Pages and Blazor, understand what each is good at, and learn how they can share one project.
updateDate: 2026-09-14T16:00
author: ['bishal-biswas']
level: 2
tags: ['razor-pages', 'blazor', 'comparison']
course: dotnet-mvc
---

## Three doors into the same house

ASP.NET Core offers three ways to build pages. They share the hosting, routing, dependency injection, configuration, authentication and EF Core you have learned. They differ in how you organise the code that produces HTML.

- **MVC**: controllers with actions, views in a separate folder. What this course teaches.
- **Razor Pages**: each page is a file with its handlers attached. No controllers.
- **Blazor**: components written in C# that run in the browser or on the server with a live connection. No page reloads.

None of them is "the new one that replaces the others". Each is a good fit for different apps, and they can live in the same project.

## The same feature three ways

A product details page that loads one product and shows it.

**MVC**

```csharp
public class ProductsController : Controller
{
    private readonly AppDbContext _db;
    public ProductsController(AppDbContext db) => _db = db;

    public async Task<IActionResult> Details(int id)
    {
        var product = await _db.Products.FindAsync(id);
        return product is null ? NotFound() : View(product);
    }
}
```

```cshtml
@* Views/Products/Details.cshtml *@
@model Product
<h1>@Model.Name</h1>
<p>@Model.Price.ToString("C")</p>
```

**Razor Pages**

```cshtml
@* Pages/Products/Details.cshtml *@
@page "{id:int}"
@model DetailsModel
<h1>@Model.Product.Name</h1>
<p>@Model.Product.Price.ToString("C")</p>
```

```csharp
// Pages/Products/Details.cshtml.cs
public class DetailsModel : PageModel
{
    private readonly AppDbContext _db;
    public DetailsModel(AppDbContext db) => _db = db;

    public Product Product { get; set; } = default!;

    public async Task<IActionResult> OnGetAsync(int id)
    {
        var product = await _db.Products.FindAsync(id);
        if (product is null) return NotFound();
        Product = product;
        return Page();
    }
}
```

**Blazor**

```razor
@* Components/Pages/ProductDetails.razor *@
@page "/products/{Id:int}"
@inject AppDbContext Db

@if (product is null)
{
    <p>Loading...</p>
}
else
{
    <h1>@product.Name</h1>
    <p>@product.Price.ToString("C")</p>
    <button @onclick="AddToCart">Add to cart (@cartCount)</button>
}

@code {
    [Parameter] public int Id { get; set; }
    private Product? product;
    private int cartCount;

    protected override async Task OnInitializedAsync()
    {
        product = await Db.Products.FindAsync(Id);
    }

    private void AddToCart() => cartCount++;
}
```

The Blazor button updates the count without a request to the server or a line of JavaScript. That is the big difference.

## MVC

Controllers group related actions. Views are separate and can be reused across actions. Routing is conventional or attribute based.

**Strengths**: clear separation, easy to test actions, natural for apps that mix HTML pages and JSON endpoints, well suited to large teams with established patterns, huge amount of existing code and documentation.

**Weaknesses**: for a simple form, the logic is split across a controller file and a view file in different folders. Controllers can grow into grab bags of unrelated actions.

## Razor Pages

A page is a `.cshtml` file with a `PageModel` class behind it. GET and POST handlers are `OnGet` and `OnPost` methods on that class. The URL comes from the file's location under `Pages`.

**Strengths**: everything for one page is in one place. Less ceremony for form heavy apps. Easier for beginners because there is no routing table or controller to find. Microsoft recommends it as the default for new server rendered apps.

**Weaknesses**: reuse across pages is a little less natural. Apps with many JSON endpoints still need controllers. Multiple forms on one page need named handlers.

Razor Pages and MVC use the same Razor syntax, tag helpers, layouts, partials, view components and validation. Almost everything from this course applies to both. Moving between them is mostly a matter of where files live.

## Blazor

Components are `.razor` files with HTML and C# in the same file. The UI updates in place when state changes, like a JavaScript framework, but in C#.

Blazor has two ways to run:

- **Server**: components run on the server, and a SignalR connection sends UI updates to the browser. Fast to start, full access to server resources, needs a constant connection.
- **WebAssembly**: the app is downloaded and runs in the browser on .NET compiled to WebAssembly. No connection needed after loading, works offline, but the download is bigger and the browser cannot touch the database directly.

Recent versions blend these with render modes per component, and can also render components as static HTML with no interactivity, much like Razor Pages.

**Strengths**: rich interactive UI without JavaScript, shared C# models between client and server, component model that scales well for app like interfaces.

**Weaknesses**: SEO and first load need care, server mode ties up resources per user, WebAssembly has a large initial download, and debugging is different. Not the best fit for content sites.

## Choosing

| App | Best fit |
| --- | --- |
| Content site, blog, marketing pages | MVC or Razor Pages |
| Forms and CRUD admin, page by page | Razor Pages |
| Site with pages plus a JSON API for a mobile app | MVC |
| Dashboard with live updates and lots of interaction | Blazor |
| Internal line of business app with complex screens | Blazor |
| Public shop with product pages and a small cart | MVC or Razor Pages, with a little JavaScript |

When in doubt for a server rendered app, Razor Pages for new work and MVC where a team already knows it well. Reach for Blazor when the interface is more app than document.

## Mixing them

One project can host all three. Register what you use:

```csharp
builder.Services.AddControllersWithViews();
builder.Services.AddRazorPages();
builder.Services.AddRazorComponents().AddInteractiveServerComponents();

app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
app.MapRazorPages();
app.MapRazorComponents<App>().AddInteractiveServerRenderMode();
```

A common pattern is MVC or Razor Pages for the public site and a Blazor area for the admin dashboard. They share the layout, authentication and services.

## What carries over

Everything in this course outside the controller and view folders is shared: `Program.cs`, middleware, DI, configuration, EF Core, Identity, authorization, logging, caching, testing with `WebApplicationFactory`, and deployment. Learning MVC well means you already know most of Razor Pages and a good part of Blazor.

## Quick recap

- MVC uses controllers and separate views. Razor Pages puts each page and its handlers together. Blazor builds interactive components in C#.
- MVC suits apps mixing pages and APIs and teams that know it. Razor Pages suits page focused apps and beginners. Blazor suits app like interfaces with rich interaction.
- Razor Pages and MVC share Razor, tag helpers, layouts and validation, so skills transfer directly.
- Blazor runs on the server over SignalR or in the browser with WebAssembly, and newer versions mix render modes per component.
- All three can share one project and all of the framework services around them.

<code id="code-content" class="language-csharp">
// The same "product details with add to cart" in three styles.

// 1. MVC: Controllers/ProductsController.cs
public class ProductsController : Controller
{
    private readonly AppDbContext _db;
    private readonly ICartService _cart;

    public ProductsController(AppDbContext db, ICartService cart)
    {
        _db = db;
        _cart = cart;
    }

    public async Task&lt;IActionResult&gt; Details(int id)
    {
        var product = await _db.Products.FindAsync(id);
        return product is null ? NotFound() : View(product);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult AddToCart(int id)
    {
        _cart.Add(id, 1);
        TempData["Success"] = "Added to cart.";
        return RedirectToAction(nameof(Details), new { id });
    }
}
// Views/Products/Details.cshtml
//
//   @model Product
//   &lt;h1&gt;@Model.Name&lt;/h1&gt;
//   &lt;form asp-action="AddToCart" asp-route-id="@Model.Id" method="post"&gt;
//       &lt;button class="btn btn-primary"&gt;Add to cart&lt;/button&gt;
//   &lt;/form&gt;

// 2. Razor Pages: Pages/Products/Details.cshtml.cs
public class DetailsModel : PageModel
{
    private readonly AppDbContext _db;
    private readonly ICartService _cart;

    public DetailsModel(AppDbContext db, ICartService cart)
    {
        _db = db;
        _cart = cart;
    }

    public Product Product { get; set; } = default!;

    public async Task&lt;IActionResult&gt; OnGetAsync(int id)
    {
        var product = await _db.Products.FindAsync(id);
        if (product is null) return NotFound();
        Product = product;
        return Page();
    }

    public IActionResult OnPostAddToCart(int id)
    {
        _cart.Add(id, 1);
        TempData["Success"] = "Added to cart.";
        return RedirectToPage(new { id });
    }
}
// Pages/Products/Details.cshtml
//
//   @page "{id:int}"
//   @model DetailsModel
//   &lt;h1&gt;@Model.Product.Name&lt;/h1&gt;
//   &lt;form method="post" asp-page-handler="AddToCart" asp-route-id="@Model.Product.Id"&gt;
//       &lt;button class="btn btn-primary"&gt;Add to cart&lt;/button&gt;
//   &lt;/form&gt;

// 3. Blazor: Components/Pages/ProductDetails.razor
//
//   @page "/products/{Id:int}"
//   @rendermode InteractiveServer
//   @inject AppDbContext Db
//   @inject ICartService Cart
//
//   @if (product is null) { &lt;p&gt;Loading...&lt;/p&gt; }
//   else
//   {
//       &lt;h1&gt;@product.Name&lt;/h1&gt;
//       &lt;button class="btn btn-primary" @onclick="AddToCart"&gt;Add to cart&lt;/button&gt;
//       &lt;span&gt;@message&lt;/span&gt;
//   }
//
//   @code {
//       [Parameter] public int Id { get; set; }
//       private Product? product;
//       private string message = "";
//
//       protected override async Task OnInitializedAsync() =&gt; product = await Db.Products.FindAsync(Id);
//
//       private void AddToCart()
//       {
//           Cart.Add(Id, 1);
//           message = "Added to cart.";      // the UI updates in place, no reload
//       }
//   }

// Program.cs: all three in one project
builder.Services.AddControllersWithViews();
builder.Services.AddRazorPages();
builder.Services.AddRazorComponents().AddInteractiveServerComponents();
// ...
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
app.MapRazorPages();
app.MapRazorComponents&lt;App&gt;().AddInteractiveServerRenderMode();
</code></pre>
