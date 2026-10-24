---
publishDate: 2026-08-05T10:40
title: Generating URLs and Links
slug: generating-urls-and-links
metadescription: Stop hard coding URLs. Build links with the anchor tag helper, generate URLs in controllers with Url.Action and Url.RouteUrl, redirect with route values, and create absolute URLs for emails.
updateDate: 2026-09-13T10:40
author: ['bishal-biswas']
level: 2
tags: ['routing', 'tag-helpers', 'url-generation']
course: dotnet-mvc
---

## Never type a URL by hand

It is tempting to write links like this:

```html
<a href="/Products/Details/5">Keyboard</a>
```

It works today. Then someone renames the controller, changes the route to `/shop/{id}`, or turns on lowercase URLs, and every hand written link on the site is broken.

ASP.NET Core can **generate** URLs from your routes. You say which action you want and the framework works out the address. Change the route later and every link updates itself.

## Links in views: the anchor tag helper

The anchor tag helper adds `asp-` attributes to a normal `<a>` tag:

```cshtml
<a asp-controller="Products" asp-action="Details" asp-route-id="5">Keyboard</a>
```

It renders as:

```html
<a href="/Products/Details/5">Keyboard</a>
```

The pieces:

- `asp-controller` names the controller, without the `Controller` suffix.
- `asp-action` names the action.
- `asp-route-{name}` supplies a route value. `asp-route-id` fills the `{id}` segment.

Leave out `asp-controller` and the current controller is used, which is convenient inside a controller's own views:

```cshtml
<a asp-action="Index">Back to list</a>
```

The tag helpers need the `@addTagHelper` line in `_ViewImports.cshtml`, which the template already includes.

## Extra values become a query string

If you pass a route value that has no matching segment in the route, it is added as a query string parameter:

```cshtml
<a asp-action="Index" asp-route-page="2" asp-route-sort="price">Page 2</a>
```

```html
<a href="/Products?page=2&amp;sort=price">Page 2</a>
```

This is how paging and sorting links are normally built.

## Loops

Because the values are C# expressions, links inside loops just work:

```cshtml
@foreach (var product in Model)
{
    <a asp-action="Details" asp-route-id="@product.Id">@product.Name</a>
}
```

## Links to a named route

When a route has a name, you can link to it without knowing the controller and action:

```csharp
[HttpGet("products/{id:int}", Name = "ProductDetails")]
public IActionResult Details(int id) => View();
```

```cshtml
<a asp-route="ProductDetails" asp-route-id="5">Keyboard</a>
```

Use `asp-route` on its own. Combining it with `asp-controller` or `asp-action` is an error.

## Fragments, protocol and host

A few more attributes cover the rest of a URL:

```cshtml
<a asp-action="Details" asp-route-id="5" asp-fragment="reviews">Reviews</a>
<a asp-action="Index" asp-protocol="https" asp-host="shop.example.com">Shop</a>
```

The first renders `/Products/Details/5#reviews`. The second renders a full absolute URL, which you only need when the link is going somewhere outside your own pages.

## Forms

The form tag helper generates the `action` attribute the same way:

```cshtml
<form asp-controller="Products" asp-action="Create" method="post">
```

```html
<form action="/Products/Create" method="post">
```

## Generating URLs in a controller

Controllers have a `Url` property with the same abilities:

```csharp
string? details = Url.Action("Details", "Products", new { id = 5 });
// "/Products/Details/5"

string? byName = Url.RouteUrl("ProductDetails", new { id = 5 });
// "/products/5"

string? css = Url.Content("~/css/site.css");
// "/css/site.css"
```

`Url.Content` turns a `~/` path into a real path from the site root. It matters when the app is hosted under a sub path such as `/shop`, because `~/` becomes `/shop/`.

The return type is `string?` because the framework returns `null` if no route can produce the URL.

## Absolute URLs for emails

A link in an email must include the scheme and host, because the email client has no idea where your site lives. Pass the protocol and let the framework fill in the host from the current request:

```csharp
string? link = Url.Action("Confirm", "Account",
    new { token = token },
    protocol: Request.Scheme,
    host: Request.Host.Value);
// "https://shop.example.com/Account/Confirm?token=abc123"
```

Prefer `Url.Action` with an explicit protocol and host over building the string with `+`. It stays correct across HTTP and HTTPS and across environments.

## Redirects use the same route values

`RedirectToAction` takes the same shape of arguments and generates the URL the same way:

```csharp
return RedirectToAction("Details", new { id = product.Id });
return RedirectToAction("Index", "Home");
return RedirectToRoute("ProductDetails", new { id = product.Id });
```

## Ambient values

When you generate a URL, the framework reuses values from the **current** request for anything you did not specify. That is why `asp-action="Index"` without a controller links to the current controller.

Watch out for this with `id`. On the page `/Products/Details/5`, this link:

```cshtml
<a asp-action="Edit">Edit</a>
```

renders as `/Products/Edit/5`, because the ambient `id` is carried along. Usually that is exactly what you want. If it is not, set the value explicitly, or set it to an empty string to drop it.

## Checking a URL is safe

When a URL comes from user input, such as a `returnUrl` after login, check that it points to your own site before redirecting to it:

```csharp
if (Url.IsLocalUrl(returnUrl))
{
    return Redirect(returnUrl);
}

return RedirectToAction("Index", "Home");
```

Without this check, an attacker could craft a login link that sends your users to a look alike site after they sign in.

## Quick recap

- Never hard code URLs. Generate them so they follow your routes when the routes change.
- In views, use `asp-controller`, `asp-action` and `asp-route-{name}` on `<a>` and `<form>` tags.
- Values with no matching route segment become query string parameters, which is perfect for paging links.
- `asp-route` links to a named route without mentioning the controller or action.
- In controllers, `Url.Action`, `Url.RouteUrl` and `Url.Content` build the same URLs, and `RedirectToAction` accepts the same route values.
- Pass `protocol` and `host` to build absolute URLs for emails, and check user supplied URLs with `Url.IsLocalUrl`.

<code id="code-content" class="language-csharp">
// Every way to build a URL, in a controller and in a view.
using Microsoft.AspNetCore.Mvc;
namespace ShopApp.Controllers;
[Route("products")]
public class ProductsController : Controller
{
    [HttpGet("", Name = "ProductList")]
    public IActionResult Index(int page = 1, string sort = "name")
    {
        // Values with no route segment become a query string
        ViewData["NextPage"] = Url.Action("Index", new { page = page + 1, sort });
        //   "/products?page=2&amp;sort=name"
        return View();
    }
    [HttpGet("{id:int}", Name = "ProductDetails")]
    public IActionResult Details(int id)
    {
        // Three ways to build the same kind of link
        string? byAction = Url.Action("Details", "Products", new { id });        // "/products/5"
        string? byRoute  = Url.RouteUrl("ProductDetails", new { id });            // "/products/5"
        string? absolute = Url.Action("Details", "Products", new { id },
                               protocol: Request.Scheme, host: Request.Host.Value);
        //   "https://localhost:7042/products/5"   (use this in emails)
        ViewData["ShareLink"] = absolute;
        return View();
    }
    [HttpPost("{id:int}/buy")]
    public IActionResult Buy(int id, string? returnUrl)
    {
        // ... add to cart ...
        // Only follow a returnUrl that points to this site
        if (!string.IsNullOrEmpty(returnUrl) &amp;&amp; Url.IsLocalUrl(returnUrl))
        {
            return Redirect(returnUrl);
        }
        // Redirects use the same route values as links
        return RedirectToRoute("ProductDetails", new { id });
    }
}
// Views/Products/Index.cshtml
//
//   @model List&lt;Product&gt;
//   @foreach (var p in Model)
//   {
//       &lt;a asp-action="Details" asp-route-id="@p.Id"&gt;@p.Name&lt;/a&gt;
//       &lt;a asp-route="ProductDetails" asp-route-id="@p.Id" asp-fragment="reviews"&gt;Reviews&lt;/a&gt;
//   }
//   &lt;a asp-action="Index" asp-route-page="2" asp-route-sort="price"&gt;Page 2&lt;/a&gt;
//   &lt;a asp-controller="Home" asp-action="Index"&gt;Home&lt;/a&gt;
//   &lt;form asp-action="Buy" asp-route-id="5" method="post"&gt;
//       &lt;input type="hidden" name="returnUrl" value="@Context.Request.Path" /&gt;
//       &lt;button type="submit"&gt;Buy&lt;/button&gt;
//   &lt;/form&gt;
//
// Rendered HTML:
//   &lt;a href="/products/1"&gt;Keyboard&lt;/a&gt;
//   &lt;a href="/products/1#reviews"&gt;Reviews&lt;/a&gt;
//   &lt;a href="/products?page=2&amp;amp;sort=price"&gt;Page 2&lt;/a&gt;
//   &lt;a href="/"&gt;Home&lt;/a&gt;
//   &lt;form action="/products/5/buy" method="post"&gt;...&lt;/form&gt;
</code></pre>
