---
publishDate: 2026-08-09T12:00
title: HTML Helpers
slug: html-helpers
metadescription: Learn the HTML helper methods that came before tag helpers, such as Html.ActionLink, Html.TextBoxFor and Html.DisplayNameFor, understand where they still show up in scaffolded views, and know when to use each style.
updateDate: 2026-09-13T12:00
author: ['bishal-biswas']
level: 2
tags: ['html-helpers', 'razor', 'views']
course: dotnet-mvc
---

## What HTML helpers are

Before tag helpers existed, Razor views generated links and form fields with **HTML helpers**: C# methods on the `Html` property that return a piece of markup.

```cshtml
@Html.ActionLink("Keyboard", "Details", "Products", new { id = 5 }, null)
```

```html
<a href="/Products/Details/5">Keyboard</a>
```

That is the same link the anchor tag helper makes. The difference is style. A tag helper looks like HTML with extra attributes. An HTML helper looks like a C# method call.

Tag helpers are the better choice for new code, and this course uses them everywhere. But you still need to read HTML helpers, because scaffolded views, older projects and a great many tutorials use them. A few of them also have no tag helper equivalent.

## Links

```cshtml
@Html.ActionLink("All products", "Index", "Products")
@Html.ActionLink("Keyboard", "Details", "Products", new { id = 5 }, new { @class = "btn" })
@Html.RouteLink("Keyboard", "ProductDetails", new { id = 5 })
```

The arguments are link text, action, controller, route values and then HTML attributes. Since `class` is a C# keyword, it is written as `@class` in the attributes object.

## Form fields

The `...For` helpers take a lambda that picks a model property, the same way `asp-for` takes a property name:

```cshtml
@model Product

@using (Html.BeginForm("Edit", "Products", FormMethod.Post))
{
    @Html.LabelFor(m => m.Name)
    @Html.TextBoxFor(m => m.Name, new { @class = "form-control" })
    @Html.ValidationMessageFor(m => m.Name)

    @Html.LabelFor(m => m.Price)
    @Html.TextBoxFor(m => m.Price, new { @class = "form-control" })

    @Html.CheckBoxFor(m => m.InStock)
    @Html.TextAreaFor(m => m.Description)
    @Html.HiddenFor(m => m.Id)
    @Html.DropDownListFor(m => m.CategoryId, (SelectList)ViewBag.Categories)

    <button type="submit">Save</button>
}
```

`Html.BeginForm` writes the opening `<form>` tag, and the closing tag is written when the `using` block ends. That trick is why the form sits inside `@using ( ... ) { }`.

Here is the same form with tag helpers, so you can see the mapping:

```cshtml
<form asp-action="Edit" method="post">
    <label asp-for="Name"></label>
    <input asp-for="Name" class="form-control" />
    <span asp-validation-for="Name"></span>

    <label asp-for="Price"></label>
    <input asp-for="Price" class="form-control" />

    <input asp-for="InStock" />
    <textarea asp-for="Description"></textarea>
    <input type="hidden" asp-for="Id" />
    <select asp-for="CategoryId" asp-items="ViewBag.Categories"></select>

    <button type="submit">Save</button>
</form>
```

Both produce the same HTML, including the `id`, `name`, `value` and validation attributes.

## Helpers that have no tag helper

These are the ones you will keep using even in a tag helper world.

**`Html.DisplayNameFor`** prints the display name of a property, which is the `[Display(Name = "...")]` text or the property name. Scaffolded list views use it for table headings:

```cshtml
<th>@Html.DisplayNameFor(model => model.Price)</th>
```

**`Html.DisplayFor`** prints a value using its display template, so a `DateTime` with `[DataType(DataType.Date)]` shows only the date and a `bool` shows a disabled checkbox:

```cshtml
<td>@Html.DisplayFor(modelItem => item.Price)</td>
```

**`Html.EditorFor`** picks the right input for a property's type and attributes. It is what the display and editor templates topic builds on:

```cshtml
@Html.EditorFor(m => m.ReleaseDate)
```

**`Html.Raw`** outputs a string without HTML encoding. Use it only with content you trust:

```cshtml
@Html.Raw(Model.DescriptionHtml)
```

**`Html.AntiForgeryToken`** writes the hidden anti forgery field. The form tag helper does this automatically, but a hand written form or an AJAX call needs it:

```cshtml
@Html.AntiForgeryToken()
```

**`Url` helpers** build URLs without a tag:

```cshtml
<img src="@Url.Content("~/images/logo.png")" />
<script>const detailsUrl = '@Url.Action("Details", "Products")';</script>
```

## A scaffolded view

When Visual Studio or the `dotnet aspnet-codegenerator` tool generates a list view, it mixes the two styles:

```cshtml
@model IEnumerable<Product>

<table class="table">
    <thead>
        <tr>
            <th>@Html.DisplayNameFor(model => model.Name)</th>
            <th>@Html.DisplayNameFor(model => model.Price)</th>
            <th></th>
        </tr>
    </thead>
    <tbody>
        @foreach (var item in Model)
        {
            <tr>
                <td>@Html.DisplayFor(modelItem => item.Name)</td>
                <td>@Html.DisplayFor(modelItem => item.Price)</td>
                <td>
                    <a asp-action="Edit" asp-route-id="@item.Id">Edit</a> |
                    <a asp-action="Details" asp-route-id="@item.Id">Details</a> |
                    <a asp-action="Delete" asp-route-id="@item.Id">Delete</a>
                </td>
            </tr>
        }
    </tbody>
</table>
```

HTML helpers for display, tag helpers for links and forms. That is a sensible mix and there is nothing wrong with keeping it.

## Choosing a style

- New forms and links: tag helpers. They read like HTML and get better editor support.
- Displaying values and names in tables: `DisplayFor` and `DisplayNameFor`.
- Raw output, anti forgery tokens and URLs inside script blocks: HTML helpers, because there is no tag for them.

Do not rewrite working HTML helpers just to modernise them. Both styles produce the same HTML and both are fully supported.

## Quick recap

- HTML helpers are C# methods on `Html` that return markup. Tag helpers do the same job with HTML attributes.
- `Html.ActionLink`, `Html.BeginForm`, `Html.TextBoxFor` and friends map one to one onto `asp-action`, `<form asp-action>` and `asp-for`.
- `Html.DisplayNameFor`, `Html.DisplayFor`, `Html.EditorFor`, `Html.Raw` and `Html.AntiForgeryToken` have no tag helper and remain useful.
- Scaffolded views mix both styles, and that mix is fine.
- Prefer tag helpers in new code, and read HTML helpers comfortably in older code.

<code id="code-content" class="language-cshtml">
@* Views/Products/Edit.cshtml written with HTML helpers, then the same form with tag helpers *@
@model Product
@{
    ViewData["Title"] = "Edit";
}
&lt;h1&gt;Edit @Html.DisplayFor(m =&gt; m.Name)&lt;/h1&gt;
@* ---- HTML helper version ---- *@
@using (Html.BeginForm("Edit", "Products", new { id = Model.Id }, FormMethod.Post, true, new { @class = "mb-5" }))
{
    @Html.ValidationSummary(true, "", new { @class = "text-danger" })
    @Html.HiddenFor(m =&gt; m.Id)
    &lt;div class="mb-3"&gt;
        @Html.LabelFor(m =&gt; m.Name, new { @class = "form-label" })
        @Html.TextBoxFor(m =&gt; m.Name, new { @class = "form-control" })
        @Html.ValidationMessageFor(m =&gt; m.Name, "", new { @class = "text-danger" })
    &lt;/div&gt;
    &lt;div class="mb-3"&gt;
        @Html.LabelFor(m =&gt; m.Price, new { @class = "form-label" })
        @Html.TextBoxFor(m =&gt; m.Price, new { @class = "form-control" })
        @Html.ValidationMessageFor(m =&gt; m.Price, "", new { @class = "text-danger" })
    &lt;/div&gt;
    &lt;div class="mb-3"&gt;
        @Html.LabelFor(m =&gt; m.CategoryId, new { @class = "form-label" })
        @Html.DropDownListFor(m =&gt; m.CategoryId, (SelectList)ViewBag.Categories, new { @class = "form-select" })
    &lt;/div&gt;
    &lt;div class="mb-3 form-check"&gt;
        @Html.CheckBoxFor(m =&gt; m.InStock, new { @class = "form-check-input" })
        @Html.LabelFor(m =&gt; m.InStock, new { @class = "form-check-label" })
    &lt;/div&gt;
    &lt;button type="submit" class="btn btn-primary"&gt;Save&lt;/button&gt;
    @Html.ActionLink("Cancel", "Index", "Products", null, new { @class = "btn btn-link" })
}
@* ---- The same form with tag helpers ---- *@
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
    &lt;button type="submit" class="btn btn-primary"&gt;Save&lt;/button&gt;
    &lt;a asp-action="Index" class="btn btn-link"&gt;Cancel&lt;/a&gt;
&lt;/form&gt;
@* Helpers with no tag helper equivalent *@
&lt;p&gt;Field name: @Html.DisplayNameFor(m =&gt; m.Price)&lt;/p&gt;
&lt;div&gt;@Html.Raw(Model.DescriptionHtml)&lt;/div&gt;
&lt;script&gt;
    const detailsUrl = '@Url.Action("Details", "Products")';
&lt;/script&gt;
</code></pre>
