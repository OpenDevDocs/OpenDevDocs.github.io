---
publishDate: 2026-08-14T10:20
title: Dropdowns, Checkboxes and Radio Buttons
slug: dropdowns-checkboxes-and-radio-buttons
metadescription: Build select lists from SelectListItem, enums and database tables, bind single and multiple selections, render checkbox lists and radio button groups, and keep the options alive when validation fails.
updateDate: 2026-09-14T10:20
author: ['bishal-biswas']
level: 2
tags: ['forms', 'select-lists', 'tag-helpers']
course: dotnet-mvc
---

## Choosing from a list

Text boxes are easy. The inputs that trip people up are the ones where the user picks from options: dropdowns, checkbox groups and radio buttons. The tricky part is not the HTML. It is getting the list of options to the view and getting the chosen value back.

This topic covers each control, from the simplest hard coded list to lists loaded from the database.

## The select tag helper

A dropdown needs two things: the property that holds the chosen value, and the list of options.

```cshtml
<select asp-for="CategoryId" asp-items="Model.Categories" class="form-select">
    <option value="">Choose a category</option>
</select>
```

`asp-for` binds the chosen value. `asp-items` takes a collection of `SelectListItem`. The `<option value="">` inside is optional and gives a placeholder that binds to `null` or `0`.

The rendered HTML marks the option matching the current `CategoryId` as selected, so the same view works for create and edit.

## Building the options

`SelectListItem` has a `Text` shown to the user and a `Value` sent to the server:

```csharp
public class ProductFormViewModel
{
    public int CategoryId { get; set; }
    public List<SelectListItem> Categories { get; set; } = new();
}
```

```csharp
vm.Categories = new List<SelectListItem>
{
    new("Keyboards", "1"),
    new("Mice", "2"),
    new("Monitors", "3")
};
```

For a list from the database, project the entities:

```csharp
vm.Categories = _db.Categories
    .OrderBy(c => c.Name)
    .Select(c => new SelectListItem(c.Name, c.Id.ToString()))
    .ToList();
```

`SelectList` is a helper that does the projection for you when you have a list of objects:

```csharp
vm.Categories = new SelectList(_db.Categories.ToList(), "Id", "Name");
```

The second argument is the property to use as the value and the third is the property for the text. Use whichever style you find clearer.

## Options from an enum

Enums are common for status fields. `Html.GetEnumSelectList<T>()` builds the list:

```csharp
public enum OrderStatus { Pending, Paid, Shipped, Cancelled }
```

```cshtml
<select asp-for="Status" asp-items="Html.GetEnumSelectList<OrderStatus>()" class="form-select"></select>
```

The display text comes from the enum member name, or from `[Display(Name = "...")]` on the member if you add one.

## Refilling the list after validation fails

This is the mistake everyone makes once. The options list is **not** posted back. Only the chosen value is. If validation fails and you return `View(vm)`, the dropdown will be empty because `vm.Categories` is an empty list.

Refill it before returning the view:

```csharp
[HttpPost]
public IActionResult Create(ProductFormViewModel vm)
{
    if (!ModelState.IsValid)
    {
        vm.Categories = LoadCategories();
        return View(vm);
    }

    // save
}
```

Putting the loading code in a private method keeps the GET and POST actions in sync.

## Multiple selection

Bind to a collection property and the select becomes multi select automatically:

```csharp
public List<int> TagIds { get; set; } = new();
public List<SelectListItem> Tags { get; set; } = new();
```

```cshtml
<select asp-for="TagIds" asp-items="Model.Tags" class="form-select" size="5"></select>
```

The tag helper adds the `multiple` attribute and marks every option whose value is in `TagIds` as selected. The browser posts `TagIds=1&TagIds=3`, which binds straight into the list.

## Option groups

Group related options with `SelectListGroup`:

```csharp
var hardware = new SelectListGroup { Name = "Hardware" };
var software = new SelectListGroup { Name = "Software" };

vm.Categories = new List<SelectListItem>
{
    new() { Text = "Keyboards", Value = "1", Group = hardware },
    new() { Text = "Mice", Value = "2", Group = hardware },
    new() { Text = "Antivirus", Value = "3", Group = software }
};
```

The helper renders `<optgroup>` elements around each group.

## A single checkbox

A `bool` property with `asp-for` renders a checkbox:

```cshtml
<input asp-for="Subscribe" class="form-check-input" />
<label asp-for="Subscribe" class="form-check-label"></label>
```

If you look at the HTML, there is also a hidden input with `value="false"` right after the checkbox. Browsers do not send unchecked boxes at all, so the hidden field guarantees a value arrives. The binder handles the `true,false` pair correctly.

## A list of checkboxes

There is no built in checkbox list helper. Write the loop yourself, giving every box the same `name`:

```csharp
public List<int> SelectedTagIds { get; set; } = new();
public List<Tag> AvailableTags { get; set; } = new();
```

```cshtml
@foreach (var tag in Model.AvailableTags)
{
    <div class="form-check">
        <input type="checkbox" name="SelectedTagIds" value="@tag.Id"
               id="tag-@tag.Id" class="form-check-input"
               checked="@Model.SelectedTagIds.Contains(tag.Id)" />
        <label for="tag-@tag.Id" class="form-check-label">@tag.Name</label>
    </div>
}
```

Razor is clever with `checked="@(bool)"`: if the value is `false` it leaves the attribute out entirely, which is exactly what HTML needs.

## Radio buttons

Radio buttons share a name, and only the chosen one is posted. `asp-for` with a `value` attribute gives you a group:

```csharp
public string ShippingMethod { get; set; } = "standard";
```

```cshtml
<div class="form-check">
    <input asp-for="ShippingMethod" type="radio" value="standard" id="ship-standard" class="form-check-input" />
    <label for="ship-standard" class="form-check-label">Standard (free)</label>
</div>
<div class="form-check">
    <input asp-for="ShippingMethod" type="radio" value="express" id="ship-express" class="form-check-input" />
    <label for="ship-express" class="form-check-label">Express ($9.99)</label>
</div>
```

The helper checks the radio whose `value` matches the current property value. Because all radios share the property, you must set the `id` yourself to keep them unique for the labels.

For an enum property, generate the group in a loop over `Enum.GetValues<ShippingMethod>()`.

## Cascading dropdowns

When one list depends on another, such as city depending on country, load the second list with a small AJAX call when the first changes. The AJAX topic shows the pattern. The server side is just an action that returns JSON:

```csharp
public IActionResult CitiesFor(int countryId)
{
    var cities = _db.Cities
        .Where(c => c.CountryId == countryId)
        .Select(c => new { c.Id, c.Name });
    return Json(cities);
}
```

## Quick recap

- `<select asp-for asp-items>` renders a dropdown, marks the current value as selected, and binds the choice back.
- Build options as `SelectListItem` from hard coded values, a database query, `SelectList` or `Html.GetEnumSelectList`.
- Options are not posted back, so refill the list before returning the view after a validation failure.
- A collection property turns the select into multi select and binds the chosen values as a list.
- A `bool` renders as a checkbox with a hidden false value. For a checkbox list, loop with a shared `name`.
- Radio buttons use `asp-for` with `type="radio"` and a `value`, and need explicit ids.

<code id="code-content" class="language-csharp">
// ViewModels/ProductFormViewModel.cs
public enum Condition { New, Refurbished, Used }

public class ProductFormViewModel
{
    public int Id { get; set; }

    [Required]
    public string Name { get; set; } = "";

    [Range(1, int.MaxValue, ErrorMessage = "Please choose a category.")]
    public int CategoryId { get; set; }
    public List&lt;SelectListItem&gt; Categories { get; set; } = new();

    public Condition Condition { get; set; } = Condition.New;

    public List&lt;int&gt; SelectedTagIds { get; set; } = new();
    public List&lt;Tag&gt; AvailableTags { get; set; } = new();

    public string ShippingMethod { get; set; } = "standard";
    public bool FeaturedOnHomePage { get; set; }
}

// Controllers/ProductsController.cs
public class ProductsController : Controller
{
    private readonly AppDbContext _db;
    public ProductsController(AppDbContext db) =&gt; _db = db;

    private void FillLists(ProductFormViewModel vm)
    {
        vm.Categories = _db.Categories
            .OrderBy(c =&gt; c.Name)
            .Select(c =&gt; new SelectListItem(c.Name, c.Id.ToString()))
            .ToList();
        vm.AvailableTags = _db.Tags.OrderBy(t =&gt; t.Name).ToList();
    }

    [HttpGet]
    public IActionResult Create()
    {
        var vm = new ProductFormViewModel();
        FillLists(vm);
        return View(vm);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Create(ProductFormViewModel vm)
    {
        if (!ModelState.IsValid)
        {
            FillLists(vm);   // lists are never posted back
            return View(vm);
        }

        var product = new Product
        {
            Name = vm.Name,
            CategoryId = vm.CategoryId,
            Condition = vm.Condition,
            Featured = vm.FeaturedOnHomePage,
            Tags = _db.Tags.Where(t =&gt; vm.SelectedTagIds.Contains(t.Id)).ToList()
        };
        _db.Products.Add(product);
        _db.SaveChanges();
        return RedirectToAction("Index");
    }
}

// Views/Products/Create.cshtml
//
//   @model ProductFormViewModel
//   &lt;form asp-action="Create" method="post"&gt;
//       &lt;select asp-for="CategoryId" asp-items="Model.Categories" class="form-select"&gt;
//           &lt;option value="0"&gt;Choose a category&lt;/option&gt;
//       &lt;/select&gt;
//       &lt;span asp-validation-for="CategoryId" class="text-danger"&gt;&lt;/span&gt;
//
//       &lt;select asp-for="Condition" asp-items="Html.GetEnumSelectList&lt;Condition&gt;()" class="form-select"&gt;&lt;/select&gt;
//
//       @foreach (var tag in Model.AvailableTags)
//       {
//           &lt;div class="form-check"&gt;
//               &lt;input type="checkbox" name="SelectedTagIds" value="@tag.Id" id="tag-@tag.Id"
//                      class="form-check-input" checked="@Model.SelectedTagIds.Contains(tag.Id)" /&gt;
//               &lt;label for="tag-@tag.Id" class="form-check-label"&gt;@tag.Name&lt;/label&gt;
//           &lt;/div&gt;
//       }
//
//       &lt;input asp-for="ShippingMethod" type="radio" value="standard" id="ship-standard" /&gt;
//       &lt;label for="ship-standard"&gt;Standard&lt;/label&gt;
//       &lt;input asp-for="ShippingMethod" type="radio" value="express" id="ship-express" /&gt;
//       &lt;label for="ship-express"&gt;Express&lt;/label&gt;
//
//       &lt;input asp-for="FeaturedOnHomePage" class="form-check-input" /&gt;
//       &lt;label asp-for="FeaturedOnHomePage"&gt;&lt;/label&gt;
//
//       &lt;button type="submit"&gt;Save&lt;/button&gt;
//   &lt;/form&gt;
</code></pre>
