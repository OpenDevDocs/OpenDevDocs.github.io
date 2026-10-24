---
publishDate: 2026-08-20T12:30
title: Organizing Large Apps with Areas
slug: organizing-large-apps-with-areas
metadescription: Split a growing MVC app into areas such as Admin and Customer, each with its own controllers, views and layout, register area routes, generate links between areas with asp-area, and keep shared views working.
updateDate: 2026-09-14T12:30
author: ['bishal-biswas']
level: 3
tags: ['areas', 'architecture', 'routing']
course: dotnet-mvc
---

## When one Controllers folder is not enough

A shop has a public storefront and an admin back office. Both have a `ProductsController`. The storefront one shows products to customers. The admin one lets staff edit them. With a single `Controllers` folder, the two collide, and the `Views` folder becomes a mess of unrelated pages.

**Areas** solve this. An area is a self contained section of the app with its own controllers, views and models folders. `Areas/Admin/Controllers/ProductsController` and `Controllers/ProductsController` can live side by side, and their URLs are different: `/Admin/Products` and `/Products`.

## The folder structure

```text
Areas/
  Admin/
    Controllers/
      DashboardController.cs
      ProductsController.cs
    Views/
      Dashboard/
        Index.cshtml
      Products/
        Index.cshtml
        Edit.cshtml
      Shared/
        _Layout.cshtml
      _ViewImports.cshtml
      _ViewStart.cshtml
    Models/
Controllers/
Views/
```

The area folder name (`Admin`) is the area name. Inside, the layout is exactly what you already know: a `Controllers` folder and a `Views` folder with one subfolder per controller.

## Marking the controller

A controller belongs to an area only if it says so with the `[Area]` attribute:

```csharp
using Microsoft.AspNetCore.Mvc;

namespace ShopApp.Areas.Admin.Controllers;

[Area("Admin")]
public class ProductsController : Controller
{
    public IActionResult Index()
    {
        return View();
    }
}
```

The folder alone is not enough. Without the attribute, routing will not know the controller is in an area, and the view engine will look in the wrong place.

## Registering the route

Area URLs need a route pattern with an `{area}` segment. Add it **before** the default route in `Program.cs`:

```csharp
app.MapControllerRoute(
    name: "areas",
    pattern: "{area:exists}/{controller=Home}/{action=Index}/{id?}");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
```

`{area:exists}` is a constraint that only matches if a registered area has that name. A request to `/Admin/Products` matches the first route. A request to `/Products` does not, because there is no area called Products, so it falls through to the default route.

If you use attribute routing, put the area in the route template:

```csharp
[Area("Admin")]
[Route("admin/products")]
public class ProductsController : Controller
{
    [HttpGet("")]
    public IActionResult Index() => View();

    [HttpGet("{id:int}/edit")]
    public IActionResult Edit(int id) => View();
}
```

## Where views are found

For a controller in an area, the view engine looks in:

```text
Areas/Admin/Views/Products/Index.cshtml
Areas/Admin/Views/Shared/Index.cshtml
Views/Shared/Index.cshtml
```

The last line matters. Partials, layouts and error pages in the root `Views/Shared` folder are still found from inside an area. You do not need to copy `_ValidationScriptsPartial` into every area.

## _ViewImports and _ViewStart

These two files are per folder tree, so an area needs its own copies:

```cshtml
@* Areas/Admin/Views/_ViewImports.cshtml *@
@using ShopApp
@using ShopApp.Areas.Admin.Models
@addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers
```

```cshtml
@* Areas/Admin/Views/_ViewStart.cshtml *@
@{
    Layout = "_Layout";
}
```

With this `_ViewStart`, views in the area use `Areas/Admin/Views/Shared/_Layout.cshtml` if it exists, or fall back to the root `Views/Shared/_Layout.cshtml`. An admin section usually has its own layout with a different navigation bar, so it is common to give the area one.

To reuse the root layout on purpose, set the full path:

```cshtml
@{
    Layout = "/Views/Shared/_Layout.cshtml";
}
```

## Links between areas

Tag helpers take an `asp-area` attribute:

```cshtml
<a asp-area="Admin" asp-controller="Products" asp-action="Index">Manage products</a>
<a asp-area="" asp-controller="Home" asp-action="Index">Back to the store</a>
```

`asp-area=""` with an empty string means "the root, not an area". Leave `asp-area` off entirely and the link stays in the **current** area, which is what you want for links within the admin section but not for a "back to site" link.

The same rule applies to `RedirectToAction`:

```csharp
return RedirectToAction("Index", "Home", new { area = "" });
```

And to `Url.Action`:

```csharp
var url = Url.Action("Edit", "Products", new { area = "Admin", id = 5 });
```

## Securing an area

Areas are a natural place for authorization. Instead of decorating every controller, put the rule in one base class:

```csharp
[Area("Admin")]
[Authorize(Roles = "Admin")]
public abstract class AdminControllerBase : Controller
{
}

public class ProductsController : AdminControllerBase
{
    // every action requires the Admin role
}
```

Or apply it through a convention in `Program.cs` so the requirement is impossible to forget:

```csharp
builder.Services.AddControllersWithViews(options =>
{
    options.Conventions.Add(new AreaAuthorizeConvention("Admin", "Admin"));
});
```

The role and policy topic explains the pieces.

## Static files per area

Static files still come from `wwwroot`. Areas do not have their own. Organise with subfolders such as `wwwroot/admin/css/admin.css` and reference them with `~/admin/css/admin.css`.

## Alternatives to areas

Areas group by **section of the site**. Another approach, sometimes called feature folders, groups by **feature**: everything about products in one folder, controller and views together. That needs a custom view location expander and is less common. For most apps with a clear public side and admin side, areas are the simplest answer.

## Quick recap

- An area is a section of the app with its own `Controllers`, `Views` and `Models` folders under `Areas/{Name}`.
- Mark controllers with `[Area("Name")]` and add an area route with `{area:exists}` before the default route.
- Views resolve inside the area first and fall back to the root `Views/Shared`.
- Give each area its own `_ViewImports` and `_ViewStart`, and usually its own layout.
- Use `asp-area` on links and `new { area = "" }` on redirects to move between areas and the root.
- Areas are a good boundary for authorization, such as requiring the Admin role for everything in `Admin`.

<code id="code-content" class="language-csharp">
// Program.cs
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
var app = builder.Build();

app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

// Area route first, then the default route
app.MapControllerRoute(
    name: "areas",
    pattern: "{area:exists}/{controller=Dashboard}/{action=Index}/{id?}");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();

// Areas/Admin/Controllers/AdminControllerBase.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ShopApp.Areas.Admin.Controllers;

[Area("Admin")]
[Authorize(Roles = "Admin")]
public abstract class AdminControllerBase : Controller
{
}

// Areas/Admin/Controllers/DashboardController.cs
public class DashboardController : AdminControllerBase
{
    public IActionResult Index() =&gt; View();
}

// Areas/Admin/Controllers/ProductsController.cs
public class ProductsController : AdminControllerBase
{
    private readonly AppDbContext _db;
    public ProductsController(AppDbContext db) =&gt; _db = db;

    // GET /Admin/Products
    public async Task&lt;IActionResult&gt; Index() =&gt;
        View(await _db.Products.OrderBy(p =&gt; p.Name).ToListAsync());

    // GET /Admin/Products/Edit/5
    public async Task&lt;IActionResult&gt; Edit(int id)
    {
        var product = await _db.Products.FindAsync(id);
        return product is null ? NotFound() : View(product);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; Edit(int id, Product input)
    {
        var product = await _db.Products.FindAsync(id);
        if (product is null) return NotFound();
        product.Name = input.Name;
        product.Price = input.Price;
        await _db.SaveChangesAsync();
        return RedirectToAction(nameof(Index));           // stays in the Admin area
    }

    public IActionResult ViewOnSite(int id) =&gt;
        RedirectToAction("Details", "Products", new { area = "", id });   // leaves the area
}

// Controllers/ProductsController.cs (root, public storefront: same name, different URL)
public class ProductsController : Controller
{
    // GET /Products/Details/5
    public IActionResult Details(int id) =&gt; View();
}

// Areas/Admin/Views/_ViewImports.cshtml
//
//   @using ShopApp
//   @using ShopApp.Models
//   @addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers

// Areas/Admin/Views/_ViewStart.cshtml
//
//   @{ Layout = "_Layout"; }      (resolves to Areas/Admin/Views/Shared/_Layout.cshtml)

// Areas/Admin/Views/Shared/_Layout.cshtml (admin navigation)
//
//   &lt;nav&gt;
//       &lt;a asp-area="Admin" asp-controller="Dashboard" asp-action="Index"&gt;Dashboard&lt;/a&gt;
//       &lt;a asp-area="Admin" asp-controller="Products" asp-action="Index"&gt;Products&lt;/a&gt;
//       &lt;a asp-area="" asp-controller="Home" asp-action="Index"&gt;Back to store&lt;/a&gt;
//   &lt;/nav&gt;
//   @RenderBody()

// Views/Shared/_Layout.cshtml (public navigation with a link into the area)
//
//   @if (User.IsInRole("Admin"))
//   {
//       &lt;a asp-area="Admin" asp-controller="Dashboard" asp-action="Index"&gt;Admin&lt;/a&gt;
//   }
</code></pre>
