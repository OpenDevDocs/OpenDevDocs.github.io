---
publishDate: 2026-08-12T09:50
title: Model Binding
slug: model-binding
metadescription: Understand how MVC turns route values, query strings, form fields and JSON into action parameters, the order the sources are searched, how complex objects and lists bind, and how to control binding with attributes.
updateDate: 2026-09-14T09:50
author: ['bishal-biswas']
level: 2
tags: ['model-binding', 'forms', 'requests']
course: dotnet-mvc
---

## From text to objects

Everything that arrives in an HTTP request is text. The URL is text. The query string is text. Form fields are text. But your action wants an `int id` or a `CreateProductViewModel`.

**Model binding** is the step that converts the text into the objects your action asked for. It runs before every action, and most of the time you never think about it. This topic explains what it is doing so you can fix it when it does not do what you expect.

## Where values come from

The binder looks for a value with the same name as the parameter in these places, in this order:

1. **Form fields** from a POST body.
2. **Route values** such as the `{id}` in `/Products/Details/5`.
3. **Query string** values such as `?page=2`.

The first match wins. Given this action:

```csharp
public IActionResult Details(int id, string? tab)
```

A request to `/Products/Details/5?tab=reviews` gives `id = 5` from the route and `tab = "reviews"` from the query string.

Matching is case insensitive, so `?Tab=reviews` also works.

## Simple types

Strings, numbers, booleans, dates, GUIDs and enums are converted directly:

```csharp
// GET /Orders?from=2026-01-01&status=Shipped&urgent=true
public IActionResult Index(DateTime from, OrderStatus status, bool urgent)
```

If the text cannot be converted, for example `?from=banana`, the parameter gets its default value and a validation error is added to `ModelState`. The action still runs, so check `ModelState.IsValid` when it matters.

A missing value gives the default: `0`, `false`, `null`. Use a nullable type such as `int?` when you need to know the difference between "zero" and "not sent".

## Complex types

For a class parameter, the binder creates the object and then tries to fill each public property by name:

```csharp
public class SearchFilter
{
    public string? Term { get; set; }
    public decimal? MaxPrice { get; set; }
    public bool InStockOnly { get; set; }
}

// GET /Products?term=mouse&maxPrice=50&inStockOnly=true
public IActionResult Index(SearchFilter filter)
```

Form fields work the same way. An input named `Name` fills the `Name` property. That is why `asp-for` matters: it generates the exact `name` attribute the binder expects.

## Nested objects

Properties of properties bind with dot notation:

```csharp
public class Order
{
    public Address ShippingAddress { get; set; } = new();
}
```

```html
<input name="ShippingAddress.Street" />
<input name="ShippingAddress.City" />
```

`asp-for="ShippingAddress.Street"` produces exactly that name.

## Lists and arrays

Collections bind from repeated or indexed names:

```html
<!-- Simple list: ?ids=1&ids=2&ids=3 -->
<input type="checkbox" name="ids" value="1" />
<input type="checkbox" name="ids" value="2" />
```

```csharp
public IActionResult Delete(int[] ids)
```

For a list of objects, use an index:

```html
<input name="Lines[0].ProductId" value="10" />
<input name="Lines[0].Quantity" value="2" />
<input name="Lines[1].ProductId" value="11" />
<input name="Lines[1].Quantity" value="1" />
```

```csharp
public class Cart
{
    public List<CartLine> Lines { get; set; } = new();
}
```

In a view, a `for` loop with `asp-for="Lines[i].Quantity"` generates these names. A `foreach` loop does not, so use `for` when you need indexed names.

Indexes must be sequential starting at zero. If you delete a row with JavaScript and leave a gap, binding stops at the gap.

## Telling the binder where to look

Attributes on a parameter restrict the source:

```csharp
public IActionResult Search(
    [FromQuery] string term,
    [FromRoute] int page,
    [FromForm] string sort,
    [FromHeader(Name = "X-Requested-With")] string? requestedWith)
```

For AJAX calls that send JSON, use `[FromBody]`:

```csharp
[HttpPost]
public IActionResult Save([FromBody] ProductDto dto)
```

Only one parameter can be `[FromBody]`, because the body can only be read once.

## Renaming with Bind and BindProperty

`[Bind]` lists which properties may be bound. It is an older way to prevent over posting:

```csharp
[HttpPost]
public IActionResult Create([Bind("Name,Price")] Product product)
```

Anything not in the list is ignored even if it appears in the form. A view model with only the needed properties is the cleaner solution, but you will see `[Bind]` in scaffolded code.

`[BindNever]` on a property stops it from ever being bound. `[BindRequired]` adds a model error if it is missing.

## Over posting

Over posting is when a user adds extra fields to a form to set properties you never intended them to change. Imagine an entity with an `IsAdmin` property and an action that binds the whole entity. A user can add `<input name="IsAdmin" value="true">` with browser tools and become an admin.

The fix is simple: bind to a view model that only has the properties the form is supposed to change. Never bind a database entity directly from a form on a public page.

## Prefixes

When a view model has a property that is itself the thing you want to bind, or when a form field has a prefix, the binder can be told about it:

```csharp
public IActionResult Create([Bind(Prefix = "Product")] CreateProductViewModel vm)
```

This tells the binder that fields are named `Product.Name` rather than `Name`.

## Custom model binders

For rare cases, you can write a class that implements `IModelBinder` and decide yourself how to turn a request into an object. A common example is parsing a comma separated list `?tags=red,blue` into a `List<string>`. You register it with `[ModelBinder(typeof(CommaListBinder))]` on the parameter. Most apps never need this.

## Debugging binding problems

When a property stays at its default value, check these in order:

1. Does the input `name` exactly match the property name, including any prefix?
2. Is the input inside the `<form>` tag?
3. Is the input disabled? Disabled inputs are not submitted. Use `readonly` instead.
4. Does `ModelState` contain an error for that key? Bad conversions show up there.

## Quick recap

- Model binding converts text from the form, route and query string into action parameters.
- Simple types convert directly, complex types are filled property by property, and lists use repeated or indexed names.
- Nested objects use dot notation such as `ShippingAddress.City`, and `asp-for` generates the right names.
- `[FromQuery]`, `[FromRoute]`, `[FromForm]`, `[FromBody]` and `[FromHeader]` restrict where a value comes from.
- Bind to view models, not entities, to avoid over posting.
- Conversion failures land in `ModelState`, so check it when a value matters.

<code id="code-content" class="language-csharp">
// Models/CartUpdateViewModel.cs
public class CartUpdateViewModel
{
    public List&lt;CartLineViewModel&gt; Lines { get; set; } = new();
    public string? CouponCode { get; set; }
}

public class CartLineViewModel
{
    public int ProductId { get; set; }
    [Range(0, 99)]
    public int Quantity { get; set; }
}

// Models/SearchFilter.cs
public class SearchFilter
{
    public string? Term { get; set; }
    public decimal? MaxPrice { get; set; }
    public bool InStockOnly { get; set; }
    public int Page { get; set; } = 1;
}

// Controllers/CartController.cs
public class CartController : Controller
{
    // GET /Cart/Search?term=mouse&amp;maxPrice=50&amp;inStockOnly=true&amp;page=2
    [HttpGet]
    public IActionResult Search([FromQuery] SearchFilter filter)
    {
        return View(filter);
    }

    // POST with fields Lines[0].ProductId, Lines[0].Quantity, Lines[1].ProductId ...
    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Update(CartUpdateViewModel vm)
    {
        if (!ModelState.IsValid)
        {
            return View("Index", vm);
        }

        foreach (var line in vm.Lines)
        {
            // apply quantities
        }

        return RedirectToAction("Index");
    }

    // POST /Cart/Remove with ids=1&amp;ids=2
    [HttpPost]
    public IActionResult Remove(int[] ids)
    {
        return RedirectToAction("Index");
    }

    // AJAX: fetch('/Cart/Add', { method: 'POST', body: JSON.stringify({...}) })
    [HttpPost]
    public IActionResult Add([FromBody] CartLineViewModel line,
                             [FromHeader(Name = "X-Requested-With")] string? requestedWith)
    {
        if (requestedWith != "XMLHttpRequest") return BadRequest();
        return Json(new { ok = true, line.ProductId, line.Quantity });
    }
}

// Views/Cart/Index.cshtml (a for loop so the names are indexed)
//
//   @model CartUpdateViewModel
//   &lt;form asp-action="Update" method="post"&gt;
//       @for (var i = 0; i &lt; Model.Lines.Count; i++)
//       {
//           &lt;input type="hidden" asp-for="Lines[i].ProductId" /&gt;
//           &lt;input asp-for="Lines[i].Quantity" class="form-control" /&gt;
//           &lt;span asp-validation-for="Lines[i].Quantity" class="text-danger"&gt;&lt;/span&gt;
//       }
//       &lt;input asp-for="CouponCode" placeholder="Coupon" /&gt;
//       &lt;button type="submit"&gt;Update cart&lt;/button&gt;
//   &lt;/form&gt;
</code></pre>
