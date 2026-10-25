---
publishDate: 2026-08-10T09:00
title: Display and Editor Templates
slug: display-and-editor-templates
metadescription: Learn how display and editor templates let you decide once how a type such as a date, a price or an address should look, and then reuse that decision on every page with DisplayFor and EditorFor.
updateDate: 2026-09-14T09:00
author: ['bishal-biswas']
level: 2
tags: ['templates', 'razor', 'views']
course: dotnet-mvc
---

## Decide once, reuse everywhere

Imagine your app shows prices in twenty different views. One day the designer asks you to show them in green with a currency symbol. You now have twenty files to edit.

A **display template** solves this. It is a tiny view that says "this is how a value of this type should look". Once you write it, `Html.DisplayFor()` uses it automatically wherever that type appears.

An **editor template** does the same job for input fields. Write one editor template for `DateTime` and every date field in your app gets the same date picker.

## The two helper methods

These helpers were introduced in the HTML helpers topic. Here is what they do again in one line each:

```cshtml
@Html.DisplayFor(m => m.Price)
@Html.EditorFor(m => m.Price)
```

`DisplayFor` renders the value for reading. `EditorFor` renders an input for editing. Both look at the type of the property and pick a template.

Without any custom templates, they still work. A `bool` becomes a disabled checkbox in display mode and a live checkbox in edit mode. A `string` becomes plain text or a text box. These are the **built in templates**.

## Where templates live

Templates are just `.cshtml` files placed in special folders:

```text
Views/
  Shared/
    DisplayTemplates/
      Decimal.cshtml
      DateTime.cshtml
      Address.cshtml
    EditorTemplates/
      DateTime.cshtml
      Address.cshtml
```

The file name must match the **type name** of the value. `Decimal.cshtml` handles `decimal`, `DateTime.cshtml` handles `DateTime`, and `Address.cshtml` handles your own `Address` class.

You can also put the folders under a specific controller's view folder, such as `Views/Products/DisplayTemplates/`, and those templates will only apply to that controller's views.

## Your first display template

Let us make every `decimal` show as money:

```cshtml
@* Views/Shared/DisplayTemplates/Decimal.cshtml *@
@model decimal
<span class="price">@Model.ToString("C")</span>
```

Now in any view:

```cshtml
<p>Price: @Html.DisplayFor(m => m.Price)</p>
```

```html
<p>Price: <span class="price">$49.99</span></p>
```

Change the template and every price in the app changes with it.

## A template for your own class

Templates shine with small classes that appear in many places. Here is an address:

```csharp
public class Address
{
    public string Street { get; set; } = "";
    public string City { get; set; } = "";
    public string PostalCode { get; set; } = "";
}
```

```cshtml
@* Views/Shared/DisplayTemplates/Address.cshtml *@
@model Address
<address>
    @Model.Street<br />
    @Model.City @Model.PostalCode
</address>
```

Use it wherever an `Address` shows up:

```cshtml
@model Order

<h2>Shipping to</h2>
@Html.DisplayFor(m => m.ShippingAddress)

<h2>Billing to</h2>
@Html.DisplayFor(m => m.BillingAddress)
```

## Editor templates

An editor template renders inputs. The important rule is that the field names must line up with the model so that model binding works when the form is posted. `asp-for` handles this for you because it knows the current prefix:

```cshtml
@* Views/Shared/EditorTemplates/Address.cshtml *@
@model Address
<div class="mb-3">
    <label asp-for="Street"></label>
    <input asp-for="Street" class="form-control" />
</div>
<div class="mb-3">
    <label asp-for="City"></label>
    <input asp-for="City" class="form-control" />
</div>
<div class="mb-3">
    <label asp-for="PostalCode"></label>
    <input asp-for="PostalCode" class="form-control" />
</div>
```

When called with `@Html.EditorFor(m => m.ShippingAddress)`, the inputs come out with names like `ShippingAddress.Street`. That is exactly what the binder needs to fill an `Order` object.

## Templates for a whole collection

If the property is a `List<Address>`, `DisplayFor` renders the template once per item. You do not write a loop:

```cshtml
@model Customer

@Html.DisplayFor(m => m.Addresses)
```

Each item is rendered with the `Address` template, with correct indexed names like `Addresses[0].Street` in editor mode.

## Choosing a template by name

Sometimes one type needs two looks. A `DateTime` might be a full date in one place and just the month elsewhere. Give the template a different file name and ask for it:

```cshtml
@* Views/Shared/DisplayTemplates/MonthOnly.cshtml *@
@model DateTime
@Model.ToString("MMMM yyyy")
```

```cshtml
@Html.DisplayFor(m => m.PublishedOn, "MonthOnly")
```

The second argument is the template name. You can also attach it to the model with `[UIHint("MonthOnly")]` so you never have to repeat the name in views.

## DisplayForModel and EditorForModel

These two render the **entire** model using templates for each property:

```cshtml
@model Product

<dl>
    @Html.DisplayForModel()
</dl>
```

```cshtml
<form asp-action="Create" method="post">
    @Html.EditorForModel()
    <button type="submit">Save</button>
</form>
```

They are quick for admin pages and prototypes. For public pages you usually want more control over layout, so you write the fields by hand.

## Data annotations affect templates

Attributes on the model change what the built in templates produce:

```csharp
public class Product
{
    [Display(Name = "Product name")]
    public string Name { get; set; } = "";

    [DataType(DataType.Currency)]
    public decimal Price { get; set; }

    [DataType(DataType.MultilineText)]
    public string Description { get; set; } = "";

    [DisplayFormat(DataFormatString = "{0:d}", ApplyFormatInEditMode = true)]
    public DateTime ReleaseDate { get; set; }

    [HiddenInput]
    public int Id { get; set; }
}
```

`DataType.MultilineText` gives a text area. `DisplayFormat` controls the string format. `HiddenInput` renders a hidden field in editor mode. These are all handled by the built in templates without any custom files.

## Quick recap

- A display template decides how a type looks when read, and an editor template decides how it looks when edited.
- Put them in `Views/Shared/DisplayTemplates` and `Views/Shared/EditorTemplates`, named after the type.
- `Html.DisplayFor` and `Html.EditorFor` pick the template automatically, including for lists.
- Pass a template name or use `[UIHint]` when one type needs more than one look.
- `DisplayForModel` and `EditorForModel` render every property in one call.
- Data annotations such as `[DataType]` and `[DisplayFormat]` shape the built in templates without custom files.

<code id="code-content" class="language-csharp">
// Models/Address.cs
public class Address
{
    public string Street { get; set; } = "";
    public string City { get; set; } = "";
    public string PostalCode { get; set; } = "";
}
// Models/Order.cs
public class Order
{
    public int Id { get; set; }
    [Display(Name = "Order total")]
    public decimal Total { get; set; }
    [DisplayFormat(DataFormatString = "{0:d}", ApplyFormatInEditMode = true)]
    public DateTime PlacedOn { get; set; }
    [UIHint("MonthOnly")]
    public DateTime ShipMonth { get; set; }
    public Address ShippingAddress { get; set; } = new();
    public Address BillingAddress { get; set; } = new();
}
// Views/Shared/DisplayTemplates/Decimal.cshtml
//
//   @model decimal
//   &lt;span class="price"&gt;@Model.ToString("C")&lt;/span&gt;
// Views/Shared/DisplayTemplates/MonthOnly.cshtml
//
//   @model DateTime
//   @Model.ToString("MMMM yyyy")
// Views/Shared/DisplayTemplates/Address.cshtml
//
//   @model Address
//   &lt;address&gt;@Model.Street&lt;br /&gt;@Model.City @Model.PostalCode&lt;/address&gt;
// Views/Shared/EditorTemplates/Address.cshtml
//
//   @model Address
//   &lt;input asp-for="Street" class="form-control" placeholder="Street" /&gt;
//   &lt;input asp-for="City" class="form-control" placeholder="City" /&gt;
//   &lt;input asp-for="PostalCode" class="form-control" placeholder="Postal code" /&gt;
// Views/Orders/Details.cshtml
//
//   @model Order
//   &lt;p&gt;Total: @Html.DisplayFor(m =&gt; m.Total)&lt;/p&gt;
//   &lt;p&gt;Ships: @Html.DisplayFor(m =&gt; m.ShipMonth)&lt;/p&gt;
//   @Html.DisplayFor(m =&gt; m.ShippingAddress)
// Views/Orders/Edit.cshtml
//
//   @model Order
//   &lt;form asp-action="Edit" method="post"&gt;
//       &lt;input type="hidden" asp-for="Id" /&gt;
//       &lt;h3&gt;Shipping&lt;/h3&gt;
//       @Html.EditorFor(m =&gt; m.ShippingAddress)
//       &lt;h3&gt;Billing&lt;/h3&gt;
//       @Html.EditorFor(m =&gt; m.BillingAddress)
//       &lt;button type="submit"&gt;Save&lt;/button&gt;
//   &lt;/form&gt;
</code></pre>
