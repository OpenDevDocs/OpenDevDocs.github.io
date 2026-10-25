---
publishDate: 2026-08-11T09:30
title: Building Forms with Tag Helpers
slug: building-forms-with-tag-helpers
metadescription: Build a complete HTML form the MVC way with the form, label, input, textarea, select and validation tag helpers, handle the POST in the controller, and follow the Post Redirect Get pattern.
updateDate: 2026-09-14T09:30
author: ['bishal-biswas']
level: 1
tags: ['forms', 'tag-helpers', 'basics']
course: dotnet-mvc
---

## The shape of every form

Almost every form in an MVC app follows the same three step dance:

1. A **GET** action shows an empty or pre filled form.
2. The user submits it, which sends a **POST** to the server.
3. The POST action validates the data. If it is bad, it shows the form again with error messages. If it is good, it saves and redirects.

This topic builds a "Create product" form from scratch using the built in tag helpers so you can see all three steps together.

## The view model

Start with a class that describes the fields on the form:

```csharp
using System.ComponentModel.DataAnnotations;

public class CreateProductViewModel
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = "";

    [Range(0.01, 10000)]
    public decimal Price { get; set; }

    [Display(Name = "In stock")]
    public bool InStock { get; set; } = true;

    [DataType(DataType.MultilineText)]
    public string? Description { get; set; }
}
```

The attributes do two jobs. They tell the validator what is allowed, and they tell the tag helpers what kind of input to draw and what label text to use.

## The GET action

```csharp
public class ProductsController : Controller
{
    [HttpGet]
    public IActionResult Create()
    {
        return View(new CreateProductViewModel());
    }
}
```

Passing a fresh view model means the form has sensible defaults, such as `InStock` being checked.

## The form view

```cshtml
@model CreateProductViewModel
@{
    ViewData["Title"] = "New product";
}

<h1>New product</h1>

<form asp-action="Create" method="post">
    <div asp-validation-summary="ModelOnly" class="text-danger"></div>

    <div class="mb-3">
        <label asp-for="Name" class="form-label"></label>
        <input asp-for="Name" class="form-control" />
        <span asp-validation-for="Name" class="text-danger"></span>
    </div>

    <div class="mb-3">
        <label asp-for="Price" class="form-label"></label>
        <input asp-for="Price" class="form-control" />
        <span asp-validation-for="Price" class="text-danger"></span>
    </div>

    <div class="mb-3 form-check">
        <input asp-for="InStock" class="form-check-input" />
        <label asp-for="InStock" class="form-check-label"></label>
    </div>

    <div class="mb-3">
        <label asp-for="Description" class="form-label"></label>
        <textarea asp-for="Description" class="form-control" rows="4"></textarea>
        <span asp-validation-for="Description" class="text-danger"></span>
    </div>

    <button type="submit" class="btn btn-primary">Save</button>
    <a asp-action="Index" class="btn btn-link">Cancel</a>
</form>
```

Let us walk through what each helper does.

**`<form asp-action="Create">`** generates `action="/Products/Create"` and inserts a hidden anti forgery token. `method="post"` is required, because the default for a form is GET.

**`<label asp-for="Name">`** produces `<label for="Name">Name</label>`. The text comes from the property name or from `[Display(Name = ...)]`, which is why the checkbox label says "In stock" and not "InStock".

**`<input asp-for="Name">`** produces an input with the right `id`, `name`, `type` and `value`, plus `data-val-*` attributes that client side validation reads. The `Price` input becomes `type="text"` with a number validation rule, and `InStock` becomes `type="checkbox"`.

**`<textarea asp-for="Description">`** works like input but for multi line text.

**`<span asp-validation-for="Name">`** is empty until validation fails, then shows the message for that field.

**`<div asp-validation-summary="ModelOnly">`** lists errors that are not tied to one field, such as "This product name already exists".

## The POST action

```csharp
[HttpPost]
[ValidateAntiForgeryToken]
public IActionResult Create(CreateProductViewModel vm)
{
    if (!ModelState.IsValid)
    {
        return View(vm);
    }

    var product = new Product
    {
        Name = vm.Name,
        Price = vm.Price,
        InStock = vm.InStock,
        Description = vm.Description
    };

    _repository.Add(product);

    return RedirectToAction(nameof(Index));
}
```

Model binding fills `vm` from the posted fields. Validation runs automatically before the action starts, and the results land in `ModelState`.

If validation failed, returning `View(vm)` sends the form back with the values the user typed still in place and the error spans filled in. This is why you pass `vm` and not a new object.

If it passed, save and **redirect**. Never return a view directly after a successful POST.

## Post Redirect Get

That last rule has a name: **PRG**, for Post Redirect Get. Here is why it matters.

If a successful POST returned a page directly, the browser would remember the last request as a POST. Pressing refresh would show a "resubmit form?" warning and, if the user clicks yes, would create the product twice.

Redirecting after the POST means the browser's last request is a harmless GET. Refresh just reloads the list.

## Showing a success message

After a redirect, the original action is finished, so you cannot pass a model. Use `TempData`, which survives exactly one redirect:

```csharp
TempData["Success"] = $"{product.Name} was created.";
return RedirectToAction(nameof(Index));
```

```cshtml
@if (TempData["Success"] is string message)
{
    <div class="alert alert-success">@message</div>
}
```

The TempData topic covers this in more depth.

## Editing instead of creating

An edit form is the same pattern with two changes. The GET loads an existing record into the view model, and the form carries the id in a hidden field so the POST knows which record to update:

```cshtml
<form asp-action="Edit" method="post">
    <input type="hidden" asp-for="Id" />
    @* same fields as before *@
</form>
```

```csharp
[HttpPost]
[ValidateAntiForgeryToken]
public IActionResult Edit(EditProductViewModel vm)
{
    if (!ModelState.IsValid) return View(vm);

    var product = _repository.Find(vm.Id);
    if (product is null) return NotFound();

    product.Name = vm.Name;
    product.Price = vm.Price;
    _repository.Save(product);

    return RedirectToAction(nameof(Index));
}
```

## Client side validation scripts

For error messages to appear without a round trip to the server, include the validation scripts at the bottom of the view:

```cshtml
@section Scripts {
    <partial name="_ValidationScriptsPartial" />
}
```

The template creates this partial for you. It loads jQuery Validation and the unobtrusive adapter that reads the `data-val-*` attributes. The client side validation topic explains how it works.

## Quick recap

- A form needs a GET action to show it and a POST action to handle it.
- `asp-for` on labels, inputs, text areas and selects binds them to view model properties and generates ids, names, values and validation attributes.
- The form tag helper sets the action URL and adds an anti forgery token, and `[ValidateAntiForgeryToken]` checks it.
- Check `ModelState.IsValid` in the POST. Return the same view model on failure so the user's input is kept.
- After success, redirect (Post Redirect Get) so a refresh does not resubmit the form.
- Use `TempData` for a one time success message that survives the redirect.

<code id="code-content" class="language-csharp">
// ViewModels/CreateProductViewModel.cs
using System.ComponentModel.DataAnnotations;

public class CreateProductViewModel
{
    [Required, StringLength(100)]
    public string Name { get; set; } = "";

    [Range(0.01, 10000)]
    public decimal Price { get; set; }

    [Display(Name = "In stock")]
    public bool InStock { get; set; } = true;

    [DataType(DataType.MultilineText)]
    public string? Description { get; set; }
}

// Controllers/ProductsController.cs
public class ProductsController : Controller
{
    private readonly IProductRepository _repository;
    public ProductsController(IProductRepository repository) =&gt; _repository = repository;

    public IActionResult Index() =&gt; View(_repository.All());

    [HttpGet]
    public IActionResult Create() =&gt; View(new CreateProductViewModel());

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Create(CreateProductViewModel vm)
    {
        if (_repository.NameExists(vm.Name))
        {
            ModelState.AddModelError("", "A product with this name already exists.");
        }

        if (!ModelState.IsValid)
        {
            return View(vm);
        }

        var product = new Product
        {
            Name = vm.Name,
            Price = vm.Price,
            InStock = vm.InStock,
            Description = vm.Description
        };
        _repository.Add(product);

        TempData["Success"] = $"{product.Name} was created.";
        return RedirectToAction(nameof(Index));
    }
}

// Views/Products/Create.cshtml
//
//   @model CreateProductViewModel
//   &lt;form asp-action="Create" method="post"&gt;
//       &lt;div asp-validation-summary="ModelOnly" class="text-danger"&gt;&lt;/div&gt;
//       &lt;div class="mb-3"&gt;
//           &lt;label asp-for="Name" class="form-label"&gt;&lt;/label&gt;
//           &lt;input asp-for="Name" class="form-control" /&gt;
//           &lt;span asp-validation-for="Name" class="text-danger"&gt;&lt;/span&gt;
//       &lt;/div&gt;
//       &lt;div class="mb-3"&gt;
//           &lt;label asp-for="Price" class="form-label"&gt;&lt;/label&gt;
//           &lt;input asp-for="Price" class="form-control" /&gt;
//           &lt;span asp-validation-for="Price" class="text-danger"&gt;&lt;/span&gt;
//       &lt;/div&gt;
//       &lt;div class="mb-3 form-check"&gt;
//           &lt;input asp-for="InStock" class="form-check-input" /&gt;
//           &lt;label asp-for="InStock" class="form-check-label"&gt;&lt;/label&gt;
//       &lt;/div&gt;
//       &lt;div class="mb-3"&gt;
//           &lt;label asp-for="Description" class="form-label"&gt;&lt;/label&gt;
//           &lt;textarea asp-for="Description" class="form-control" rows="4"&gt;&lt;/textarea&gt;
//       &lt;/div&gt;
//       &lt;button type="submit" class="btn btn-primary"&gt;Save&lt;/button&gt;
//   &lt;/form&gt;
//   @section Scripts {
//       &lt;partial name="_ValidationScriptsPartial" /&gt;
//   }
// Views/Products/Index.cshtml
//
//   @if (TempData["Success"] is string message)
//   {
//       &lt;div class="alert alert-success"&gt;@message&lt;/div&gt;
//   }
</code></pre>
