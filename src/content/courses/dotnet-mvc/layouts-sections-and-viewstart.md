---
publishDate: 2026-08-07T11:20
title: Layouts, Sections and _ViewStart
slug: layouts-sections-and-viewstart
metadescription: Use a layout to share the page frame across every view, fill it with RenderBody, add optional sections for scripts and sidebars, and understand how _ViewStart picks the layout automatically.
updateDate: 2026-09-13T11:20
author: ['bishal-biswas']
level: 1
tags: ['layouts', 'razor', 'sections']
course: dotnet-mvc
---

## The problem layouts solve

Every page on a site shares the same frame: the `<html>` and `<head>` tags, the navigation bar, the footer, the stylesheet links. Copying that into every view would mean fixing the same thing in fifty places when the menu changes.

A **layout** holds the frame once. Each view supplies only the part in the middle.

## The template's layout

Open `Views/Shared/_Layout.cshtml`. Trimmed down, it looks like this:

```cshtml
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>@ViewData["Title"] - ShopApp</title>
    <link rel="stylesheet" href="~/lib/bootstrap/dist/css/bootstrap.min.css" />
    <link rel="stylesheet" href="~/css/site.css" asp-append-version="true" />
</head>
<body>
    <header>
        <nav class="navbar">
            <a class="navbar-brand" asp-controller="Home" asp-action="Index">ShopApp</a>
            <a class="nav-link" asp-controller="Home" asp-action="Privacy">Privacy</a>
        </nav>
    </header>

    <div class="container">
        <main role="main" class="pb-3">
            @RenderBody()
        </main>
    </div>

    <footer class="footer">
        &copy; 2026 - ShopApp
    </footer>

    <script src="~/lib/jquery/dist/jquery.min.js"></script>
    <script src="~/lib/bootstrap/dist/js/bootstrap.bundle.min.js"></script>
    <script src="~/js/site.js" asp-append-version="true"></script>
    @await RenderSectionAsync("Scripts", required: false)
</body>
</html>
```

Two lines do the real work.

**`@RenderBody()`** is where the view's content goes. When `Index.cshtml` renders, its HTML is dropped in at exactly this spot.

**`@ViewData["Title"]`** reads the title that each view sets at the top. This is why the template views all start with `ViewData["Title"] = "..."`.

## How a view picks its layout

A view can name its layout at the top:

```cshtml
@{
    Layout = "_Layout";
}
```

But you never see that line in the template's views. That is because of `Views/_ViewStart.cshtml`:

```cshtml
@{
    Layout = "_Layout";
}
```

`_ViewStart.cshtml` runs before **every** view in its folder and all folders below it. Since it sits in `Views`, it applies to everything, and every view gets the layout without asking.

The name `_Layout` is resolved like any view: first in the controller's folder, then in `Views/Shared`.

## Overriding the layout for some views

A view can change its mind:

```cshtml
@{
    Layout = "_AdminLayout";     // a different frame
}
```

Or have no frame at all, which is right for a printable invoice or a page that JavaScript loads into a popup:

```cshtml
@{
    Layout = null;
}
```

You can also put a second `_ViewStart.cshtml` in a subfolder, such as `Views/Admin`. It runs after the top level one, so its `Layout` wins for views in that folder.

## Sections: optional slots in the layout

`RenderBody` gives a view one spot to fill. **Sections** give it more, and each one is optional. The template defines one called `Scripts`:

```cshtml
@await RenderSectionAsync("Scripts", required: false)
```

A view fills it with `@section`:

```cshtml
@section Scripts {
    <script src="~/js/product-gallery.js"></script>
}
```

This is how a page adds its own script at the bottom of the body, after jQuery and Bootstrap have loaded, without editing the layout.

`required: false` means a view may skip the section. Change it to `true` and any view that forgets it fails with an error, which is useful for a slot that every page must fill.

## More than one section

A layout can have as many sections as you like. A sidebar slot is a common second one:

```cshtml
<div class="row">
    <div class="col-md-9">
        @RenderBody()
    </div>
    <aside class="col-md-3">
        @if (IsSectionDefined("Sidebar"))
        {
            @await RenderSectionAsync("Sidebar")
        }
        else
        {
            <partial name="_DefaultSidebar" />
        }
    </aside>
</div>
```

`IsSectionDefined` lets the layout react to a missing section, here by showing a default instead.

## Nested layouts

A layout can itself use a layout. Suppose the admin area needs the site frame plus an extra menu:

```cshtml
@* Views/Shared/_AdminLayout.cshtml *@
@{
    Layout = "_Layout";
}

<div class="admin-menu">
    <a asp-controller="Products" asp-action="Index">Products</a>
    <a asp-controller="Orders" asp-action="Index">Orders</a>
</div>

@RenderBody()
```

A view using `_AdminLayout` is placed in `_AdminLayout`'s body, and that whole thing is placed in `_Layout`'s body. Sections declared in the view must be passed up by the middle layout if the outer one should see them:

```cshtml
@section Scripts {
    @await RenderSectionAsync("Scripts", required: false)
}
```

Nested layouts are handy but easy to over use. Two levels is usually plenty.

## Setting the title properly

The layout expects `ViewData["Title"]`. Every view should set it:

```cshtml
@{
    ViewData["Title"] = "Products";
}
```

The layout adds the site name after it, giving a tab title like `Products - ShopApp`. For a dynamic page, use the model:

```cshtml
@{
    ViewData["Title"] = Model.Name;
}
```

## Quick recap

- A layout is a view that holds the shared frame, and `@RenderBody()` marks where each page's content goes.
- `Views/_ViewStart.cshtml` sets `Layout = "_Layout"` for every view, so you never repeat it.
- A view can override with `Layout = "_Other"` or switch it off with `Layout = null`.
- Sections are optional named slots. The view fills one with `@section Name { }` and the layout renders it with `RenderSectionAsync`.
- The `Scripts` section is how a page adds its own JavaScript after the shared scripts.
- Layouts can nest, but keep it to two levels, and pass sections up when you do.

<code id="code-content" class="language-cshtml">
@* Views/Shared/_Layout.cshtml: a layout with a body, a required title and two optional sections *@
&lt;!DOCTYPE html&gt;
&lt;html lang="en"&gt;
&lt;head&gt;
    &lt;meta charset="utf-8" /&gt;
    &lt;meta name="viewport" content="width=device-width, initial-scale=1.0" /&gt;
    &lt;title&gt;@ViewData["Title"] - ShopApp&lt;/title&gt;
    &lt;link rel="stylesheet" href="~/lib/bootstrap/dist/css/bootstrap.min.css" /&gt;
    &lt;link rel="stylesheet" href="~/css/site.css" asp-append-version="true" /&gt;
    @* Per page CSS, if the view provides any *@
    @await RenderSectionAsync("Styles", required: false)
&lt;/head&gt;
&lt;body&gt;
    &lt;header&gt;
        &lt;nav class="navbar navbar-expand-sm navbar-light bg-white border-bottom mb-3"&gt;
            &lt;div class="container"&gt;
                &lt;a class="navbar-brand" asp-controller="Home" asp-action="Index"&gt;ShopApp&lt;/a&gt;
                &lt;ul class="navbar-nav"&gt;
                    &lt;li class="nav-item"&gt;&lt;a class="nav-link" asp-controller="Products" asp-action="Index"&gt;Products&lt;/a&gt;&lt;/li&gt;
                    &lt;li class="nav-item"&gt;&lt;a class="nav-link" asp-controller="Home" asp-action="Privacy"&gt;Privacy&lt;/a&gt;&lt;/li&gt;
                &lt;/ul&gt;
            &lt;/div&gt;
        &lt;/nav&gt;
    &lt;/header&gt;
    &lt;div class="container"&gt;
        &lt;div class="row"&gt;
            &lt;main role="main" class="col-md-9 pb-3"&gt;
                @* Each view's HTML lands here *@
                @RenderBody()
            &lt;/main&gt;
            &lt;aside class="col-md-3"&gt;
                @if (IsSectionDefined("Sidebar"))
                {
                    @await RenderSectionAsync("Sidebar")
                }
                else
                {
                    &lt;partial name="_DefaultSidebar" /&gt;
                }
            &lt;/aside&gt;
        &lt;/div&gt;
    &lt;/div&gt;
    &lt;footer class="border-top footer text-muted"&gt;
        &lt;div class="container"&gt;&amp;copy; 2026 - ShopApp&lt;/div&gt;
    &lt;/footer&gt;
    &lt;script src="~/lib/jquery/dist/jquery.min.js"&gt;&lt;/script&gt;
    &lt;script src="~/lib/bootstrap/dist/js/bootstrap.bundle.min.js"&gt;&lt;/script&gt;
    &lt;script src="~/js/site.js" asp-append-version="true"&gt;&lt;/script&gt;
    @* Page scripts go after the shared ones *@
    @await RenderSectionAsync("Scripts", required: false)
&lt;/body&gt;
&lt;/html&gt;
@* Views/_ViewStart.cshtml: applies the layout to every view *@
@*
@{
    Layout = "_Layout";
}
*@
@* Views/Products/Details.cshtml: a view that fills the body and both sections *@
@*
@model Product
@{
    ViewData["Title"] = Model.Name;
}
&lt;h1&gt;@Model.Name&lt;/h1&gt;
&lt;p&gt;@Model.Price.ToString("C")&lt;/p&gt;
@section Sidebar {
    &lt;h4&gt;Related&lt;/h4&gt;
    &lt;a asp-action="Index"&gt;All products&lt;/a&gt;
}
@section Scripts {
    &lt;script src="~/js/product-gallery.js"&gt;&lt;/script&gt;
}
*@
</code></pre>
