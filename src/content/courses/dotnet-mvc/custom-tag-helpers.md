---
publishDate: 2026-08-11T09:10
title: Custom Tag Helpers
slug: custom-tag-helpers
metadescription: Write your own tag helpers by inheriting from TagHelper, target elements or attributes, read and write HTML output, access the current view context, and register the helpers in _ViewImports.
updateDate: 2026-09-14T09:10
author: ['bishal-biswas']
level: 3
tags: ['tag-helpers', 'razor', 'advanced']
course: dotnet-mvc
---

## Why write your own

The built in tag helpers cover links, forms and inputs. But every app has its own repeated bits of HTML: a badge that shows an order status, an email link, an alert box, a button with an icon. You could paste the same markup around, or use a partial view, but a tag helper reads better in the page and feels like a real HTML element.

```cshtml
<order-status value="@order.Status"></order-status>
<email to="support@shop.com">Contact us</email>
```

This topic shows how to build these.

## The simplest tag helper

A tag helper is a class that inherits from `TagHelper` and overrides `Process` or `ProcessAsync`:

```csharp
using Microsoft.AspNetCore.Razor.TagHelpers;

namespace ShopApp.TagHelpers;

public class EmailTagHelper : TagHelper
{
    public string To { get; set; } = "";

    public override void Process(TagHelperContext context, TagHelperOutput output)
    {
        output.TagName = "a";
        output.Attributes.SetAttribute("href", "mailto:" + To);
    }
}
```

Three things to notice:

1. The class name minus `TagHelper` becomes the element name: `EmailTagHelper` handles `<email>`.
2. Public properties become attributes. `To` becomes `to`. A property called `SubjectLine` would become `subject-line`.
3. `output` is the HTML that will be sent. You change the tag name, add attributes, or replace the content.

## Registering it

Add your project's assembly to `Views/_ViewImports.cshtml`:

```cshtml
@addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers
@addTagHelper *, ShopApp
```

The second value is the assembly name, which is normally the project name. Now use it:

```cshtml
<email to="support@shop.com">Contact support</email>
```

```html
<a href="mailto:support@shop.com">Contact support</a>
```

## Controlling the target

By default the helper matches an element with the same name as the class. `[HtmlTargetElement]` lets you be more specific:

```csharp
[HtmlTargetElement("email", Attributes = "to")]
public class EmailTagHelper : TagHelper { }
```

Now the helper only runs on `<email>` elements that have a `to` attribute.

You can also target **existing** HTML elements by attribute. This one adds a Bootstrap class to any button with a `variant` attribute:

```csharp
[HtmlTargetElement("button", Attributes = "variant")]
public class ButtonVariantTagHelper : TagHelper
{
    public string Variant { get; set; } = "primary";

    public override void Process(TagHelperContext context, TagHelperOutput output)
    {
        output.Attributes.RemoveAll("variant");
        output.AddClass("btn", HtmlEncoder.Default);
        output.AddClass("btn-" + Variant, HtmlEncoder.Default);
    }
}
```

```cshtml
<button variant="danger">Delete</button>
```

```html
<button class="btn btn-danger">Delete</button>
```

`AddClass` comes from `Microsoft.AspNetCore.Mvc.TagHelpers` and appends to any existing `class` value instead of replacing it.

## Working with content

`output.Content` holds what goes between the tags. You can set it, append to it, or read the original child content:

```csharp
public class OrderStatusTagHelper : TagHelper
{
    public OrderStatus Value { get; set; }

    public override void Process(TagHelperContext context, TagHelperOutput output)
    {
        output.TagName = "span";

        var css = Value switch
        {
            OrderStatus.Shipped => "bg-success",
            OrderStatus.Cancelled => "bg-danger",
            _ => "bg-secondary"
        };

        output.Attributes.SetAttribute("class", "badge " + css);
        output.Content.SetContent(Value.ToString());
    }
}
```

Note that the `Value` property is an enum, not a string. Razor converts the attribute value for you, so `value="@order.Status"` just works.

`SetContent` HTML encodes the text. Use `SetHtmlContent` when you deliberately want to inject markup.

## Reading the original children

To wrap whatever the user wrote inside the tag, read the child content first. That requires the async version:

```csharp
public class AlertTagHelper : TagHelper
{
    public string Type { get; set; } = "info";

    public override async Task ProcessAsync(TagHelperContext context, TagHelperOutput output)
    {
        var child = await output.GetChildContentAsync();

        output.TagName = "div";
        output.Attributes.SetAttribute("class", $"alert alert-{Type}");
        output.Attributes.SetAttribute("role", "alert");
        output.Content.SetHtmlContent(child.GetContent());
    }
}
```

```cshtml
<alert type="warning">Your session expires in <strong>5 minutes</strong>.</alert>
```

## Removing the tag entirely

Sometimes you only want the content, not a wrapping element. Set `TagName` to `null`:

```csharp
output.TagName = null;
```

This is handy for helpers that conditionally hide content, such as a `<show-if>` helper:

```csharp
[HtmlTargetElement("show-if")]
public class ShowIfTagHelper : TagHelper
{
    public bool Condition { get; set; }

    public override void Process(TagHelperContext context, TagHelperOutput output)
    {
        output.TagName = null;
        if (!Condition)
        {
            output.SuppressOutput();
        }
    }
}
```

`SuppressOutput` removes the element and everything inside it.

## Accessing the view and services

A tag helper can receive services through its constructor like any other class. It can also get the current view context, which gives access to the request, the user and route data:

```csharp
[HtmlTargetElement("a", Attributes = "active-controller")]
public class ActiveLinkTagHelper : TagHelper
{
    [ViewContext]
    [HtmlAttributeNotBound]
    public ViewContext ViewContext { get; set; } = default!;

    public string ActiveController { get; set; } = "";

    public override void Process(TagHelperContext context, TagHelperOutput output)
    {
        var current = ViewContext.RouteData.Values["controller"]?.ToString();
        if (string.Equals(current, ActiveController, StringComparison.OrdinalIgnoreCase))
        {
            output.AddClass("active", HtmlEncoder.Default);
        }
    }
}
```

`[ViewContext]` tells the framework to fill the property. `[HtmlAttributeNotBound]` stops it from being treated as an attribute.

## Ordering and nesting

If two helpers target the same element, the `Order` property decides who runs first. Lower runs earlier. Parents and children can share data through `context.Items`, which is a dictionary that lives for the duration of one element and its descendants.

## Quick recap

- A custom tag helper is a class that inherits from `TagHelper` and overrides `Process` or `ProcessAsync`.
- The class name sets the element name, and public properties become kebab case attributes.
- `[HtmlTargetElement]` can target a custom element or an existing one by attribute.
- Change `output.TagName`, set attributes, and use `output.Content` to control the HTML.
- `GetChildContentAsync` reads what was written inside the tag, and `SuppressOutput` removes the element.
- Register your assembly in `_ViewImports.cshtml` with `@addTagHelper *, YourProjectName`.

<code id="code-content" class="language-csharp">
// TagHelpers/EmailTagHelper.cs
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Mvc.TagHelpers;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Microsoft.AspNetCore.Razor.TagHelpers;

namespace ShopApp.TagHelpers;

[HtmlTargetElement("email", Attributes = "to")]
public class EmailTagHelper : TagHelper
{
    public string To { get; set; } = "";
    public string? Subject { get; set; }

    public override void Process(TagHelperContext context, TagHelperOutput output)
    {
        output.TagName = "a";
        var href = "mailto:" + To;
        if (!string.IsNullOrEmpty(Subject))
        {
            href += "?subject=" + Uri.EscapeDataString(Subject);
        }
        output.Attributes.SetAttribute("href", href);
    }
}

// TagHelpers/AlertTagHelper.cs
public class AlertTagHelper : TagHelper
{
    public string Type { get; set; } = "info";
    public bool Dismissible { get; set; }

    public override async Task ProcessAsync(TagHelperContext context, TagHelperOutput output)
    {
        var child = await output.GetChildContentAsync();
        output.TagName = "div";
        output.Attributes.SetAttribute("role", "alert");
        output.AddClass("alert", HtmlEncoder.Default);
        output.AddClass("alert-" + Type, HtmlEncoder.Default);
        output.Content.SetHtmlContent(child.GetContent());
        if (Dismissible)
        {
            output.AddClass("alert-dismissible", HtmlEncoder.Default);
            output.PostContent.SetHtmlContent(
                "&lt;button type=\"button\" class=\"btn-close\" data-bs-dismiss=\"alert\"&gt;&lt;/button&gt;");
        }
    }
}

// TagHelpers/ActiveLinkTagHelper.cs
[HtmlTargetElement("a", Attributes = "active-controller")]
public class ActiveLinkTagHelper : TagHelper
{
    [ViewContext]
    [HtmlAttributeNotBound]
    public ViewContext ViewContext { get; set; } = default!;

    public string ActiveController { get; set; } = "";

    public override void Process(TagHelperContext context, TagHelperOutput output)
    {
        var current = ViewContext.RouteData.Values["controller"]?.ToString();
        if (string.Equals(current, ActiveController, StringComparison.OrdinalIgnoreCase))
        {
            output.AddClass("active", HtmlEncoder.Default);
        }
    }
}

// Views/_ViewImports.cshtml
//
//   @addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers
//   @addTagHelper *, ShopApp
// Views/Shared/_Layout.cshtml
//
//   &lt;a asp-controller="Products" asp-action="Index" active-controller="Products" class="nav-link"&gt;Products&lt;/a&gt;
//   &lt;alert type="warning" dismissible="true"&gt;Sale ends &lt;strong&gt;tonight&lt;/strong&gt;.&lt;/alert&gt;
//   &lt;email to="help@shop.com" subject="Order question"&gt;Email support&lt;/email&gt;
</code></pre>
