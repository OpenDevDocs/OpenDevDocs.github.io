---
publishDate: 2026-08-08T11:30
title: Partial Views
slug: partial-views
metadescription: Break big views into reusable pieces with partial views, render them with the partial tag helper, pass them a model, see where the framework looks for them, and return them from a controller for AJAX.
updateDate: 2026-09-13T11:30
author: ['bishal-biswas']
level: 1
tags: ['partial-views', 'razor', 'reuse']
course: dotnet-mvc
---

## What a partial view is

A **partial view** is a Razor file that renders a piece of a page rather than a whole page. It has no layout of its own. You use it in two situations:

- The same chunk of HTML appears on several pages, such as a product card or an address block.
- A view has grown too long and you want to split it into readable pieces.

Partial views are ordinary `.cshtml` files. By convention their names start with an underscore, such as `_ProductCard.cshtml`, to show that they are not meant to be shown on their own.

## Creating one

Make `Views/Shared/_ProductCard.cshtml`:

```cshtml
@model Product

<div class="card">
    <div class="card-body">
        <h5 class="card-title">@Model.Name</h5>
        <p class="card-text">@Model.Price.ToString("C")</p>
        <a asp-controller="Products" asp-action="Details" asp-route-id="@Model.Id">View</a>
    </div>
</div>
```

It declares a model just like a full view. It does not set a title or a layout, because it will be dropped into a page that already has both.

## Rendering it with the partial tag helper

Inside any view, use the `<partial>` tag:

```cshtml
@model List<Product>

<h1>Products</h1>

<div class="row">
    @foreach (var product in Model)
    {
        <div class="col-md-4">
            <partial name="_ProductCard" model="product" />
        </div>
    }
</div>
```

`name` is the partial's file name without the extension. `model` is the object to pass in. The partial renders in place, and the loop gives you one card per product.

## Where the framework looks

The name is resolved the same way as a view. For a partial used from `Views/Products/Index.cshtml`, the search order is:

```text
Views/Products/_ProductCard.cshtml
Views/Shared/_ProductCard.cshtml
```

Put a partial in the controller's folder if only that controller uses it, and in `Shared` if several do. You can also give an exact path:

```cshtml
<partial name="~/Views/Shared/Cards/_ProductCard.cshtml" model="product" />
```

## Passing a part of the model with for

When the piece you want to pass is a property of the current model, `for` is neater than `model`:

```cshtml
@model OrderViewModel

<partial name="_Address" for="ShippingAddress" />
<partial name="_Address" for="BillingAddress" />
```

The difference matters inside forms. With `for`, input names inside the partial are prefixed correctly, so `<input asp-for="Street" />` becomes `name="ShippingAddress.Street"`. With `model`, the prefix is lost and model binding cannot tell the two addresses apart. Use `for` when the partial contains form fields.

## Passing extra values with view-data

A partial sees the same `ViewData` as its parent. To add or override values just for one call:

```cshtml
<partial name="_ProductCard" model="product" view-data='new ViewDataDictionary(ViewData) { { "ShowPrice", false } }' />
```

```cshtml
@if (ViewData["ShowPrice"] as bool? != false)
{
    <p>@Model.Price.ToString("C")</p>
}
```

This works, but it is fiddly. If a partial needs several options, give it a small view model with those options as properties instead.

## The older ways

You will see two other forms in older code and in scaffolded views:

```cshtml
@await Html.PartialAsync("_ProductCard", product)
@{ await Html.RenderPartialAsync("_ProductCard", product); }
```

They do the same thing as the tag helper. `RenderPartialAsync` writes directly to the output and is slightly faster, but the difference rarely matters. Prefer the `<partial>` tag in new code, because it reads like HTML and supports `for`.

Avoid the synchronous `@Html.Partial(...)`. It can deadlock and the framework warns you about it.

## Partial views from a controller

A controller can return a partial view on its own, with no layout. That is useful when JavaScript on a page asks for a fragment to insert:

```csharp
public IActionResult Card(int id)
{
    var product = _repo.Find(id);
    return PartialView("_ProductCard", product);
}
```

```javascript
const html = await fetch('/Products/Card/5').then(r => r.text());
document.querySelector('#slot').innerHTML = html;
```

The response is just the card's HTML, ready to drop into the page. The topic on AJAX uses this pattern properly.

## Partials versus view components

A partial view is only markup. It cannot fetch its own data. Whatever it shows must be passed in by the view that uses it.

When a piece of the page needs its own logic and its own data, such as a shopping cart summary that runs a query, use a **view component** instead. They are covered in a later topic. The rule: partial for reusable markup, view component for reusable markup plus logic.

## Quick recap

- A partial view is a `.cshtml` file that renders part of a page and has no layout. Name it with a leading underscore.
- Render it with `<partial name="_Name" model="value" />`, which finds the file in the controller's folder, then `Views/Shared`.
- Use `for="Property"` instead of `model` when the partial contains form fields, so the input names get the right prefix.
- Partials share the parent's `ViewData`. For options, prefer a small view model over `view-data`.
- A controller can return `PartialView()` so JavaScript can fetch an HTML fragment.
- Partials cannot load their own data. When a piece needs logic, use a view component.

<code id="code-content" class="language-cshtml">
@* Views/Shared/_ProductCard.cshtml: a reusable card *@
@model Product
&lt;div class="card mb-3"&gt;
    &lt;div class="card-body"&gt;
        &lt;h5 class="card-title"&gt;@Model.Name&lt;/h5&gt;
        @if (ViewData["ShowPrice"] as bool? != false)
        {
            &lt;p class="card-text"&gt;@Model.Price.ToString("C")&lt;/p&gt;
        }
        &lt;a class="btn btn-primary" asp-controller="Products" asp-action="Details" asp-route-id="@Model.Id"&gt;View&lt;/a&gt;
    &lt;/div&gt;
&lt;/div&gt;
@* Views/Shared/_Address.cshtml: form fields for one address *@
@*
@model Address
&lt;div class="mb-3"&gt;
    &lt;label asp-for="Street"&gt;&lt;/label&gt;
    &lt;input asp-for="Street" class="form-control" /&gt;
&lt;/div&gt;
&lt;div class="mb-3"&gt;
    &lt;label asp-for="City"&gt;&lt;/label&gt;
    &lt;input asp-for="City" class="form-control" /&gt;
&lt;/div&gt;
*@
@* Views/Products/Index.cshtml: one card per product *@
@*
@model List&lt;Product&gt;
&lt;h1&gt;Products&lt;/h1&gt;
&lt;div class="row"&gt;
    @foreach (var product in Model)
    {
        &lt;div class="col-md-4"&gt;
            &lt;partial name="_ProductCard" model="product" /&gt;
        &lt;/div&gt;
    }
&lt;/div&gt;
*@
@* Views/Orders/Checkout.cshtml: the same address partial twice, with 'for' so
   the inputs are named ShippingAddress.Street and BillingAddress.Street *@
@*
@model OrderViewModel
&lt;form asp-action="Checkout" method="post"&gt;
    &lt;h2&gt;Shipping&lt;/h2&gt;
    &lt;partial name="_Address" for="ShippingAddress" /&gt;
    &lt;h2&gt;Billing&lt;/h2&gt;
    &lt;partial name="_Address" for="BillingAddress" /&gt;
    &lt;button type="submit" class="btn btn-primary"&gt;Place order&lt;/button&gt;
&lt;/form&gt;
*@
@* Controllers/ProductsController.cs: a fragment for JavaScript to fetch *@
@*
public IActionResult Card(int id)
{
    var product = _repo.Find(id);
    return product is null ? NotFound() : PartialView("_ProductCard", product);
}
*@
</code></pre>
