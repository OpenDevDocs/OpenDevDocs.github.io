---
publishDate: 2026-08-04T10:10
title: Conventional Routing
slug: conventional-routing
metadescription: Learn how the default route pattern turns a URL into a controller, an action and an id, how defaults and optional segments work, and how to add your own route patterns in Program.cs.
updateDate: 2026-09-13T10:10
author: ['bishal-biswas']
level: 1
tags: ['routing', 'conventional-routing', 'program-cs']
course: dotnet-mvc
---

## What routing does

**Routing** is the step that reads the URL of a request and decides which action should handle it. Without it, the framework would have no idea that `/Products/Details/5` means "run `Details` in `ProductsController` with `id` 5".

There are two ways to describe routes in MVC:

- **Conventional routing** defines URL patterns in one place, `Program.cs`, and applies them to every controller.
- **Attribute routing** puts the URL directly on each action.

This topic covers the first. The next topic covers the second, and you can use both in the same app.

## The default route

Every new project has one route:

```csharp
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
```

The pattern has three **segments** separated by slashes. Words in curly braces are **route parameters** that capture a piece of the URL:

```text
{controller=Home}   first segment, defaults to Home
{action=Index}      second segment, defaults to Index
{id?}               third segment, optional
```

Here is how some URLs are read:

```text
/                        controller=Home      action=Index     (all defaults)
/Products                controller=Products  action=Index
/Products/Details        controller=Products  action=Details
/Products/Details/5      controller=Products  action=Details   id=5
/Products/Details/5/x    no match, the pattern has only three segments
```

`controller` and `action` are special names. The framework uses them to pick the class and the method. Any other parameter, such as `id`, is handed to the action as an argument.

## Defaults and optional segments

`=Home` is a **default value**. When the segment is missing from the URL, the default is used.

`?` marks a segment as **optional**. When it is missing, the parameter is simply not set, and the action's parameter gets its own default value, such as `0` for an `int`.

These two are different. A default fills in a value. Optional means "may be absent". You cannot combine them on one segment, and you cannot have a required segment after an optional one.

## Matching is case insensitive

`/products/details/5`, `/Products/Details/5` and `/PRODUCTS/DETAILS/5` all reach the same action. The generated links in your views use the casing from your code, which you can change with one setting:

```csharp
builder.Services.AddRouting(options =>
{
    options.LowercaseUrls = true;
});
```

Now every link the framework builds is lowercase, which many sites prefer for a clean look.

## Adding your own routes

You can call `MapControllerRoute` as many times as you want. Routes are checked **in order**, and the first match wins, so put specific patterns before the general default:

```csharp
app.MapControllerRoute(
    name: "blog",
    pattern: "blog/{year:int}/{slug}",
    defaults: new { controller = "Blog", action = "Post" });

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
```

Now `/blog/2026/hello-world` runs `BlogController.Post(int year, string slug)`. The URL says nothing about a controller or an action, because the `defaults` argument supplies them. The `:int` part is a **constraint** that only matches numbers, and there is a topic on constraints later.

If the default route came first, `/blog/2026/hello-world` would be read as controller `blog`, action `2026`, and fail.

## Literal segments

A pattern can mix fixed words with parameters:

```csharp
app.MapControllerRoute(
    name: "productBySlug",
    pattern: "shop/{slug}",
    defaults: new { controller = "Products", action = "BySlug" });
```

`/shop/wireless-mouse` runs `ProductsController.BySlug("wireless-mouse")`. `shop` must appear exactly.

## Catch all segments

A `*` captures the rest of the URL, slashes included:

```csharp
app.MapControllerRoute(
    name: "docs",
    pattern: "docs/{*path}",
    defaults: new { controller = "Docs", action = "Show" });
```

`/docs/getting-started/install` gives `path = "getting-started/install"`. This is useful for documentation sites and file browsers.

## Route names

Every route has a `name`. It is not used for matching. It exists so you can build URLs from a specific route by name, which you will see in the topic on generating links. Names must be unique.

## A shortcut for the default route

If all you want is the standard pattern, this does the same thing as the long form:

```csharp
app.MapDefaultControllerRoute();
```

## What happens when nothing matches

If no route matches the URL, or the matched controller or action does not exist, the response is a `404`. In Development you see a blank page with the status code. In production, the error handling topic shows how to turn that into a friendly page.

## Which style should you use?

Conventional routing works well when your URLs all look alike, which is true for most admin panels and business apps. Attribute routing is better when you want full control over each URL, such as a public site with search engine friendly addresses. Many projects use the default route for everyday pages and attribute routes for the handful of pages that need something special.

## Quick recap

- Routing reads the URL to choose a controller and an action, and passes the other segments as parameters.
- The default pattern is `{controller=Home}/{action=Index}/{id?}`. Defaults fill in missing segments and `?` makes a segment optional.
- Matching is case insensitive. Set `LowercaseUrls` if you want generated links in lowercase.
- Add more routes with `MapControllerRoute`. The first match wins, so put specific routes before the default.
- Use `defaults:` to fix the controller and action for a pattern that does not mention them.
- `{*path}` captures everything that is left, slashes included.

<code id="code-content" class="language-csharp">
// Program.cs
// Three conventional routes, checked in order. The first match wins.
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
// Generated links come out as /products/details/5 instead of /Products/Details/5
builder.Services.AddRouting(options =&gt; options.LowercaseUrls = true);
var app = builder.Build();
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}
app.UseHttpsRedirection();
app.UseRouting();
app.UseAuthorization();
app.MapStaticAssets();
// 1. A pretty URL for blog posts: /blog/2026/hello-world
//    The controller and action are fixed by 'defaults', so the URL never mentions them.
app.MapControllerRoute(
    name: "blog",
    pattern: "blog/{year:int}/{slug}",
    defaults: new { controller = "Blog", action = "Post" });
// 2. A catch all for the help section: /docs/getting-started/install
//    Everything after /docs/ lands in the 'path' parameter, slashes included.
app.MapControllerRoute(
    name: "docs",
    pattern: "docs/{*path}",
    defaults: new { controller = "Docs", action = "Show" });
// 3. The default route, last, for everything else:
//    /             -&gt; HomeController.Index()
//    /products     -&gt; ProductsController.Index()
//    /products/details/5 -&gt; ProductsController.Details(5)
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();
app.Run();
// Controllers/BlogController.cs
using Microsoft.AspNetCore.Mvc;
public class BlogController : Controller
{
    // GET /blog/2026/hello-world  -&gt;  year = 2026, slug = "hello-world"
    public IActionResult Post(int year, string slug)
    {
        return Content($"Post '{slug}' from {year}");
    }
}
// Controllers/DocsController.cs
public class DocsController : Controller
{
    // GET /docs/getting-started/install  -&gt;  path = "getting-started/install"
    public IActionResult Show(string? path)
    {
        return Content($"Docs page: {path ?? "(home)"}");
    }
}
</code></pre>
