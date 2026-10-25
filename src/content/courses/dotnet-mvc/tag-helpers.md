---
publishDate: 2026-08-08T11:40
title: Tag Helpers
slug: tag-helpers
metadescription: Learn how tag helpers add server side behaviour to normal HTML tags, tour the built in ones for links, forms, inputs, validation, images, scripts, environments and caching, and see how to turn them on and off.
updateDate: 2026-09-13T11:40
author: ['bishal-biswas']
level: 1
tags: ['tag-helpers', 'razor', 'views']
course: dotnet-mvc
---

## HTML that the server understands

A **tag helper** is a normal looking HTML tag that the server fills in before the page is sent. You write HTML. The framework adds attributes, generates URLs and wires up form fields.

```cshtml
<a asp-controller="Products" asp-action="Details" asp-route-id="5">Keyboard</a>
```

```html
<a href="/Products/Details/5">Keyboard</a>
```

The `asp-` attributes are the tag helper's instructions. They never reach the browser. Only the finished `href` does.

Tag helpers look like HTML, so designers can read them, editors can format them, and you get code completion for the `asp-` attributes.

## Turning them on

Tag helpers are enabled by one line in `Views/_ViewImports.cshtml`, which the template already contains:

```cshtml
@addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers
```

The `*` means every tag helper in that assembly. Without this line, `asp-action` would be sent to the browser as a meaningless attribute.

## Links: the anchor tag helper

```cshtml
<a asp-action="Index">All products</a>
<a asp-controller="Home" asp-action="Index">Home</a>
<a asp-action="Details" asp-route-id="@product.Id">@product.Name</a>
<a asp-route="ProductDetails" asp-route-id="5">By route name</a>
<a asp-action="Index" asp-route-page="2">Page 2</a>
<a asp-area="Admin" asp-controller="Products" asp-action="Index">Admin</a>
```

Extra `asp-route-` values that do not match a route segment become the query string.

## Forms: the form tag helper

```cshtml
<form asp-action="Create" method="post">
```

```html
<form action="/Products/Create" method="post">
    <input name="__RequestVerificationToken" type="hidden" value="CfDJ8..." />
```

Two things happened. The `action` was generated, and a hidden **anti forgery token** was added. That token protects the form against cross site request forgery, a topic covered under security. You get it for free every time you use the form tag helper.

## Inputs, labels and text areas

`asp-for` binds an element to a property of the model:

```cshtml
@model Product

<label asp-for="Name"></label>
<input asp-for="Name" />

<label asp-for="Price"></label>
<input asp-for="Price" />

<label asp-for="Description"></label>
<textarea asp-for="Description"></textarea>
```

```html
<label for="Name">Name</label>
<input type="text" id="Name" name="Name" value="Keyboard" />

<label for="Price">Price</label>
<input type="text" id="Price" name="Price" value="49.99" data-val="true" data-val-number="The field Price must be a number." />

<label for="Description">Description</label>
<textarea id="Description" name="Description"></textarea>
```

From one attribute, the helper produced the `id`, the `name` that model binding expects, the current `value`, and `data-val` attributes for client side validation. The `type` is chosen from the property: a `bool` gives a checkbox, a `DateTime` gives a date picker, and `[DataType(DataType.Password)]` gives a password box.

The label text comes from the property name, or from `[Display(Name = "...")]` if the model has one.

## Select lists

```cshtml
<select asp-for="CategoryId" asp-items="Model.Categories"></select>
```

`asp-items` takes a list of `SelectListItem`. The option matching the current `CategoryId` is marked as selected. The topic on dropdowns covers building that list.

## Validation messages

```cshtml
<span asp-validation-for="Name"></span>
<div asp-validation-summary="ModelOnly"></div>
```

The first shows the error for one field, if any. The second lists errors that are not tied to a field. Both are empty until validation fails.

## Scripts, styles and images

```cshtml
<link rel="stylesheet" href="~/css/site.css" asp-append-version="true" />
<script src="~/js/site.js" asp-append-version="true"></script>
<img src="~/images/logo.png" asp-append-version="true" />
```

```html
<link rel="stylesheet" href="/css/site.css?v=Kl_dqr9NVtnMdsM2MUg4qthUnWZm5T1fCEimBPWzT1Y" />
```

`asp-append-version` adds a hash of the file's contents to the URL. When you change the file, the hash changes and browsers fetch the new version instead of using a stale cached copy. The `~/` at the start means "from the web root", which is `wwwroot`.

## Environment

Show different markup depending on the environment:

```cshtml
<environment include="Development">
    <link rel="stylesheet" href="~/lib/bootstrap/dist/css/bootstrap.css" />
</environment>
<environment exclude="Development">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />
</environment>
```

This is the classic way to use a readable file while developing and a fast CDN in production.

## Partial and cache

Two more that you will meet in later topics:

```cshtml
<partial name="_ProductCard" model="product" />

<cache expires-after="@TimeSpan.FromMinutes(10)">
    <partial name="_PopularProducts" />
</cache>
```

`<partial>` renders another view in place. `<cache>` keeps its rendered content in memory so the expensive part only runs once every ten minutes.

## Opting out for one tag

To stop a tag helper from touching one element, prefix it with `!`:

```cshtml
<!a href="/legacy" asp-action="Ignored">Untouched</a>
```

To remove a tag helper everywhere, use `@removeTagHelper` in `_ViewImports.cshtml`.

## The full list

| Tag | Key attributes |
| --- | --- |
| `<a>` | `asp-controller`, `asp-action`, `asp-route-*`, `asp-route`, `asp-area`, `asp-fragment` |
| `<form>` | `asp-controller`, `asp-action`, `asp-route-*`, `asp-antiforgery` |
| `<input>`, `<textarea>` | `asp-for`, `asp-format` |
| `<label>` | `asp-for` |
| `<select>` | `asp-for`, `asp-items` |
| `<span>`, `<div>` | `asp-validation-for`, `asp-validation-summary` |
| `<link>`, `<script>`, `<img>` | `asp-append-version`, `asp-src-include`, `asp-fallback-src` |
| `<environment>` | `include`, `exclude` |
| `<partial>` | `name`, `model`, `for`, `view-data` |
| `<cache>` | `expires-after`, `expires-on`, `vary-by-query`, `vary-by-user` |

## Quick recap

- Tag helpers are HTML tags with `asp-` attributes that the server processes before sending the page.
- `@addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers` in `_ViewImports.cshtml` turns them on.
- `asp-controller`, `asp-action` and `asp-route-*` generate URLs on links and forms, and the form tag helper adds an anti forgery token.
- `asp-for` on inputs, labels, text areas and selects binds them to a model property and sets up validation attributes.
- `asp-append-version` busts browser caches when a file changes, and `<environment>` swaps markup between development and production.
- Use `!` to opt one element out, and `@removeTagHelper` to switch a helper off everywhere.

<code id="code-content" class="language-cshtml">
@* Views/Products/Edit.cshtml: the built in tag helpers working together on one form *@
@model Product
@{
    ViewData["Title"] = "Edit " + Model.Name;
}
&lt;h1&gt;Edit product&lt;/h1&gt;
@* Generates action="/Products/Edit/5" and a hidden anti forgery token *@
&lt;form asp-action="Edit" asp-route-id="@Model.Id" method="post"&gt;
    &lt;div asp-validation-summary="ModelOnly" class="text-danger"&gt;&lt;/div&gt;
    &lt;input type="hidden" asp-for="Id" /&gt;
    &lt;div class="mb-3"&gt;
        &lt;label asp-for="Name" class="form-label"&gt;&lt;/label&gt;
        &lt;input asp-for="Name" class="form-control" /&gt;
        &lt;span asp-validation-for="Name" class="text-danger"&gt;&lt;/span&gt;
    &lt;/div&gt;
    &lt;div class="mb-3"&gt;
        &lt;label asp-for="Price" class="form-label"&gt;&lt;/label&gt;
        &lt;input asp-for="Price" class="form-control" /&gt;
        &lt;span asp-validation-for="Price" class="text-danger"&gt;&lt;/span&gt;
    &lt;/div&gt;
    &lt;div class="mb-3"&gt;
        &lt;label asp-for="CategoryId" class="form-label"&gt;&lt;/label&gt;
        &lt;select asp-for="CategoryId" asp-items="ViewBag.Categories" class="form-select"&gt;&lt;/select&gt;
    &lt;/div&gt;
    &lt;div class="mb-3 form-check"&gt;
        &lt;input asp-for="InStock" class="form-check-input" /&gt;
        &lt;label asp-for="InStock" class="form-check-label"&gt;&lt;/label&gt;
    &lt;/div&gt;
    &lt;div class="mb-3"&gt;
        &lt;label asp-for="Description" class="form-label"&gt;&lt;/label&gt;
        &lt;textarea asp-for="Description" class="form-control" rows="4"&gt;&lt;/textarea&gt;
    &lt;/div&gt;
    &lt;button type="submit" class="btn btn-primary"&gt;Save&lt;/button&gt;
    &lt;a asp-action="Index" class="btn btn-link"&gt;Cancel&lt;/a&gt;
&lt;/form&gt;
@* A product image whose URL changes whenever the file changes *@
&lt;img src="~/images/products/@(Model.Id).png" asp-append-version="true" alt="@Model.Name" /&gt;
@* Different scripts for development and production *@
&lt;environment include="Development"&gt;
    &lt;script src="~/js/edit-product.js"&gt;&lt;/script&gt;
&lt;/environment&gt;
&lt;environment exclude="Development"&gt;
    &lt;script src="~/js/edit-product.min.js" asp-append-version="true"&gt;&lt;/script&gt;
&lt;/environment&gt;
@section Scripts {
    &lt;partial name="_ValidationScriptsPartial" /&gt;
}
</code></pre>
