---
publishDate: 2026-08-06T11:00
title: Razor Syntax Basics
slug: razor-syntax-basics
metadescription: "Master the Razor syntax you use every day: expressions, code blocks, if and foreach, explicit expressions, comments, escaping the @ symbol, the text tag, and the directives at the top of a view."
updateDate: 2026-09-13T11:00
author: ['bishal-biswas']
level: 1
tags: ['razor', 'syntax', 'views']
course: dotnet-mvc
---

## The @ symbol switches to C#

Razor has one core rule: `@` means "the next thing is C#". Everything else is HTML.

```cshtml
<p>Hello, @Model.Name. Today is @DateTime.Now.DayOfWeek.</p>
```

```html
<p>Hello, Asha. Today is Saturday.</p>
```

That is an **implicit expression**. Razor reads the C# after `@` until it reaches something that cannot be part of an expression, such as a space or an HTML tag, then switches back to HTML.

## Explicit expressions

Sometimes Razor stops too early. This does not work as intended:

```cshtml
<p>Total: @Model.Price * 2</p>
```

Razor prints `@Model.Price`, then the literal text ` * 2`, because a space ends the expression. Wrap the C# in parentheses to tell Razor exactly where it ends:

```cshtml
<p>Total: @(Model.Price * 2)</p>
<p>Next year: @(DateTime.Now.Year + 1)</p>
<p>@(Model.InStock ? "In stock" : "Sold out")</p>
```

Use `@( ... )` whenever an expression contains spaces or operators.

## Code blocks

A **code block** runs C# statements without printing anything:

```cshtml
@{
    var total = Model.Price * Model.Quantity;
    var label = total > 100 ? "Free shipping" : "Standard shipping";
}

<p>@label: @total.ToString("C")</p>
```

Code blocks are common at the top of a view for setting the page title or preparing values. Try not to put real logic there. If the C# in a view is getting long, the calculation probably belongs in the controller or a view model.

## Conditions

`@if` works like C#, and you can put HTML straight inside the braces:

```cshtml
@if (Model.InStock)
{
    <span class="badge">In stock</span>
}
else if (Model.RestockDate is not null)
{
    <span class="badge">Back on @Model.RestockDate.Value.ToShortDateString()</span>
}
else
{
    <span class="badge">Sold out</span>
}
```

`@switch` is available too, with the same shape as C#.

## Loops

`@foreach` repeats a block of HTML for each item. This is the most used piece of Razor there is:

```cshtml
<ul>
    @foreach (var product in Model.Products)
    {
        <li>@product.Name</li>
    }
</ul>
```

`@for` and `@while` work as well:

```cshtml
@for (var i = 1; i <= Model.PageCount; i++)
{
    <a asp-action="Index" asp-route-page="@i">@i</a>
}
```

## How Razor knows where HTML starts and ends

Inside a code block or loop, Razor treats a line that starts with an HTML tag as markup, and reads until that tag is closed. That is why you can mix them freely:

```cshtml
@foreach (var product in Model)
{
    var cssClass = product.Price > 100 ? "premium" : "";   // C#
    <li class="@cssClass">@product.Name</li>                // HTML
}
```

Sometimes you want to print text that is not wrapped in a tag. Use `@:` for a single line or `<text>` for several:

```cshtml
@if (Model.Count == 0)
{
    @:No products yet.
}

@if (Model.IsOnSale)
{
    <text>
        On sale now!
        Limited time only.
    </text>
}
```

The `<text>` tag is not sent to the browser. It only marks the lines as content.

## Comments

Razor comments never reach the browser, unlike HTML comments:

```cshtml
@* This is invisible in the page source *@
<!-- This is visible in the page source -->
```

Use Razor comments for notes to other developers. Anything in an HTML comment is public.

## Printing a literal @

To show an `@` in the page, double it:

```cshtml
<p>Follow us at @@shopapp</p>
```

Email addresses are a special case. Razor recognises them and leaves them alone, so `support@shopapp.com` prints correctly without any escaping.

## Everything is encoded

Values printed with `@` are HTML encoded, which turns `<` into `&lt;` and so on. If a value genuinely contains HTML that you trust and want rendered, use `Html.Raw`:

```cshtml
@Html.Raw(Model.TrustedHtmlFromCms)
```

Only do this with content you control. Never pass user input to `Html.Raw`.

## Directives at the top of a view

Lines that start with `@` followed by a keyword are **directives**. They set up the view rather than printing anything:

```cshtml
@model Product
@using ShopApp.Services
@inject IPriceFormatter Prices

<h1>@Model.Name</h1>
<p>@Prices.Format(Model.Price)</p>
```

- `@model` declares the model type.
- `@using` imports a namespace, just like in C#.
- `@inject` asks the dependency injection container for a service and gives it a name.

Directives that every view needs, such as `@using ShopApp.Models`, belong in `_ViewImports.cshtml` so you write them once.

## Functions inside a view

For a tiny helper used only in this view, `@functions` lets you declare a method:

```cshtml
@functions {
    string Stars(int rating) => new string('*', rating);
}

<p>@Stars(Model.Rating)</p>
```

Keep these rare. Shared helpers belong in C# classes, where they can be tested.

## Whitespace

Razor removes the lines that contain only code, so your HTML output stays tidy. It keeps the whitespace inside markup exactly as you wrote it. You rarely need to think about this.

## Quick recap

- `@` switches from HTML to C#. `@Model.Name` prints a value, and `@( ... )` marks where a longer expression ends.
- `@{ ... }` runs statements without printing. Keep the logic in there short.
- `@if`, `@foreach` and `@for` wrap HTML directly. Use `@:` or `<text>` for text without a tag.
- `@* ... *@` is a comment that never reaches the browser.
- `@@` prints a literal `@`. Email addresses need no escaping.
- Printed values are HTML encoded. `Html.Raw` disables that, so only use it on content you trust.
- `@model`, `@using` and `@inject` set up a view. Put the common ones in `_ViewImports.cshtml`.

<code id="code-content" class="language-cshtml">
@* Views/Products/Details.cshtml: every everyday piece of Razor syntax in one page *@
@model ShopApp.Models.Product
@using ShopApp.Services
@inject IPriceFormatter Prices
@{
    ViewData["Title"] = Model.Name;
    var total = Model.Price * Model.Quantity;
    var shipping = total &gt; 100 ? "Free shipping" : "Standard shipping";
}
&lt;h1&gt;@Model.Name&lt;/h1&gt;
@* Implicit expression, method call and explicit expression *@
&lt;p&gt;Unit price: @Prices.Format(Model.Price)&lt;/p&gt;
&lt;p&gt;Total for @Model.Quantity: @(Model.Price * Model.Quantity)&lt;/p&gt;
&lt;p&gt;@shipping&lt;/p&gt;
@* Condition with HTML inside each branch *@
@if (Model.InStock)
{
    &lt;span class="badge bg-success"&gt;In stock&lt;/span&gt;
}
else if (Model.RestockDate is not null)
{
    &lt;span class="badge bg-warning"&gt;Back on @Model.RestockDate.Value.ToShortDateString()&lt;/span&gt;
}
else
{
    &lt;span class="badge bg-secondary"&gt;Sold out&lt;/span&gt;
}
@* Loop with a C# line and an HTML line side by side *@
&lt;ul&gt;
    @foreach (var tag in Model.Tags)
    {
        var cssClass = tag == "sale" ? "text-danger" : "";
        &lt;li class="@cssClass"&gt;@tag&lt;/li&gt;
    }
&lt;/ul&gt;
@* Text with no tag *@
@if (Model.Tags.Count == 0)
{
    @:No tags for this product.
}
@* Literal @ and an email address *@
&lt;p&gt;Questions? Email support@shopapp.com or message @@shopapp&lt;/p&gt;
@* Trusted HTML from your own CMS, never from user input *@
&lt;div class="description"&gt;@Html.Raw(Model.DescriptionHtml)&lt;/div&gt;
@functions {
    string Stars(int rating) =&gt; new string('*', rating);
}
&lt;p&gt;Rating: @Stars(Model.Rating)&lt;/p&gt;
&lt;a asp-action="Index"&gt;Back to list&lt;/a&gt;
</code></pre>
