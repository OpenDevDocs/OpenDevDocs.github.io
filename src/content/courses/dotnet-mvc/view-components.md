---
publishDate: 2026-08-10T12:10
title: View Components
slug: view-components
metadescription: Build reusable page pieces that fetch their own data with view components, learn the class and view conventions, invoke them from views with Component.InvokeAsync or the vc tag, and pass parameters.
updateDate: 2026-09-13T12:10
author: ['bishal-biswas']
level: 2
tags: ['view-components', 'razor', 'reuse']
course: dotnet-mvc
---

## Reusable pieces that need their own data

A partial view can only render what the page passes to it. That is a problem for things like a shopping cart summary in the header, a "recently viewed" panel or a category menu. Every page would have to load that data and pass it along.

A **view component** solves this. It is a small class that gets its own data and renders its own view. Drop it anywhere and it works, no matter what the surrounding page knows.

Think of it as a mini controller and view pair that lives inside a page.

## The class

A view component is a class that inherits from `ViewComponent`, with the name ending in `ViewComponent`. Put it in a `ViewComponents` folder:

```csharp
using Microsoft.AspNetCore.Mvc;

namespace ShopApp.ViewComponents;

public class CartSummaryViewComponent : ViewComponent
{
    private readonly ICartService _cart;

    public CartSummaryViewComponent(ICartService cart)
    {
        _cart = cart;
    }

    public async Task<IViewComponentResult> InvokeAsync()
    {
        var summary = await _cart.GetSummaryAsync();
        return View(summary);
    }
}
```

The method must be called `InvokeAsync` (or `Invoke` if it has nothing to await). It fetches data, usually through a service injected into the constructor, and returns `View(model)` just like a controller action.

## The view

The view lives in a folder named after the component, and the default file name is `Default.cshtml`:

```text
Views/Shared/Components/CartSummary/Default.cshtml
```

The folder name is the class name without the `ViewComponent` suffix.

```cshtml
@model CartSummary

<a asp-controller="Cart" asp-action="Index" class="cart-link">
    Cart: @Model.ItemCount items, @Model.Total.ToString("C")
</a>
```

If only one controller uses the component, the view can also live in `Views/{Controller}/Components/CartSummary/Default.cshtml`, but `Shared` is the normal place.

## Invoking it from a view

Two ways. The first is a method call:

```cshtml
@await Component.InvokeAsync("CartSummary")
```

The second is a tag helper, which needs one extra line in `_ViewImports.cshtml` so the framework knows to look in your project for components:

```cshtml
@addTagHelper *, ShopApp
```

Then:

```cshtml
<vc:cart-summary></vc:cart-summary>
```

The tag name is the class name in kebab case. Both forms do the same thing. The tag helper reads better in HTML, and the method call is handy when the name is decided at run time.

Put the cart summary in `_Layout.cshtml` and every page shows it, with no changes to any controller.

## Passing parameters

`InvokeAsync` can take parameters:

```csharp
public async Task<IViewComponentResult> InvokeAsync(int count, bool showPrices)
{
    var products = await _products.GetTopSellersAsync(count);
    ViewData["ShowPrices"] = showPrices;
    return View(products);
}
```

Pass them by name:

```cshtml
@await Component.InvokeAsync("TopSellers", new { count = 5, showPrices = true })

<vc:top-sellers count="5" show-prices="true"></vc:top-sellers>
```

With the tag helper, parameter names become kebab case attributes, so `showPrices` is `show-prices`.

## Choosing a different view

Return a named view when one component has several looks:

```csharp
public async Task<IViewComponentResult> InvokeAsync(string style = "full")
{
    var summary = await _cart.GetSummaryAsync();
    return style == "compact" ? View("Compact", summary) : View(summary);
}
```

That looks for `Views/Shared/Components/CartSummary/Compact.cshtml`.

## What a view component can and cannot do

It **can**:

- Use dependency injection through its constructor.
- Run database queries and other async work.
- Read the current user with `User` and the request with `HttpContext`.
- Have its own `ViewData` and `ViewBag`.

It **cannot**:

- Be reached by a URL. There is no routing to a view component.
- Use filters, and it does not take part in model binding.
- Access the parent view's model. Whatever it needs, it fetches or receives as a parameter.

Since a component is not an action, `[Authorize]` does nothing on it. Check `User` inside `InvokeAsync` if the content depends on who is logged in.

## Returning a component from a controller

A controller can return a view component directly, which is useful for refreshing one piece of a page from JavaScript:

```csharp
public IActionResult CartSummary()
{
    return ViewComponent("CartSummary");
}
```

## Partial or view component?

| Situation | Use |
| --- | --- |
| Same markup, data comes from the page | Partial view |
| Piece needs its own data or logic | View component |
| Appears in the layout on every page | View component |
| Table row or card inside a loop | Partial view |

A good test: if the page that uses it would have to load data purely so it can pass it on, make it a view component.

## Quick recap

- A view component is a class ending in `ViewComponent` with an `InvokeAsync` method that fetches data and returns a view.
- Its view lives at `Views/Shared/Components/{Name}/Default.cshtml`.
- Invoke it with `@await Component.InvokeAsync("Name", new { ... })` or `<vc:name></vc:name>` after adding `@addTagHelper *, YourProject`.
- Parameters are passed by name, and become kebab case attributes on the tag.
- Components get services through dependency injection but cannot be reached by URL or see the parent's model.
- Use a view component when a piece of the page needs its own data, and a partial view when the page already has the data.

<code id="code-content" class="language-csharp">
// ViewComponents/CartSummaryViewComponent.cs
// A cart summary that fetches its own data, so the layout can show it on every page.
using Microsoft.AspNetCore.Mvc;
using ShopApp.Services;
namespace ShopApp.ViewComponents;
public class CartSummaryViewComponent : ViewComponent
{
    private readonly ICartService _cart;
    // Services arrive through the constructor, like in a controller
    public CartSummaryViewComponent(ICartService cart)
    {
        _cart = cart;
    }
    // Parameters are passed by name from the view that invokes the component
    public async Task&lt;IViewComponentResult&gt; InvokeAsync(string style = "full")
    {
        // The current user is available, just like in a controller
        string? userName = User.Identity?.Name;
        CartSummary summary = await _cart.GetSummaryAsync(userName);
        // Pick a view: Default.cshtml or Compact.cshtml in the component's folder
        return style == "compact" ? View("Compact", summary) : View(summary);
    }
}
// ViewComponents/TopSellersViewComponent.cs
public class TopSellersViewComponent : ViewComponent
{
    private readonly IProductService _products;
    public TopSellersViewComponent(IProductService products) =&gt; _products = products;
    public async Task&lt;IViewComponentResult&gt; InvokeAsync(int count = 3, bool showPrices = true)
    {
        var top = await _products.GetTopSellersAsync(count);
        ViewData["ShowPrices"] = showPrices;
        return View(top);
    }
}
// Views/Shared/Components/CartSummary/Default.cshtml
//
//   @model CartSummary
//   &lt;a asp-controller="Cart" asp-action="Index" class="btn btn-outline-primary"&gt;
//       Cart: @Model.ItemCount items, @Model.Total.ToString("C")
//   &lt;/a&gt;
// Views/Shared/Components/TopSellers/Default.cshtml
//
//   @model List&lt;Product&gt;
//   &lt;h4&gt;Top sellers&lt;/h4&gt;
//   @foreach (var p in Model)
//   {
//       &lt;p&gt;@p.Name @(ViewData["ShowPrices"] is true ? p.Price.ToString("C") : "")&lt;/p&gt;
//   }
// Views/_ViewImports.cshtml (one extra line so the &lt;vc:...&gt; tags work)
//
//   @addTagHelper *, ShopApp
// Views/Shared/_Layout.cshtml (in the navbar)
//
//   &lt;vc:cart-summary style="compact"&gt;&lt;/vc:cart-summary&gt;
// Views/Home/Index.cshtml
//
//   @await Component.InvokeAsync("TopSellers", new { count = 5, showPrices = true })
//   &lt;vc:top-sellers count="5" show-prices="true"&gt;&lt;/vc:top-sellers&gt;
// Controllers/CartController.cs: refresh just the summary from JavaScript
//
//   public IActionResult Summary() =&gt; ViewComponent("CartSummary", new { style = "compact" });
</code></pre>
