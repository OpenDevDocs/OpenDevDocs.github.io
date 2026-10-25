---
publishDate: 2026-08-11T09:20
title: Models and ViewModels
slug: models-and-viewmodels
metadescription: Understand the difference between a domain model and a view model, why views should get exactly the data they need, how to map between the two, and where each kind of class belongs in the project.
updateDate: 2026-09-14T09:20
author: ['bishal-biswas']
level: 1
tags: ['models', 'viewmodels', 'basics']
course: dotnet-mvc
---

## Two kinds of model

The word "model" gets used for two different things in MVC, and mixing them up causes a lot of confusion.

A **domain model** (or entity) describes a real thing your app manages: a product, a customer, an order. It usually matches a database table.

A **view model** describes what one **page** needs to display. It is shaped for the screen, not for the database.

```csharp
// Domain model: what a product IS
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public int CategoryId { get; set; }
    public decimal CostPrice { get; set; }
    public DateTime CreatedAt { get; set; }
}

// View model: what the product LIST PAGE needs
public class ProductListItemViewModel
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string DisplayPrice { get; set; } = "";
    public string CategoryName { get; set; } = "";
}
```

The domain model has a `CostPrice` that customers must never see and a `CategoryId` that means nothing to a person. The view model has a `CategoryName` ready to print and a price already formatted.

## Why not just pass the domain model?

For a quick demo, passing `Product` straight to a view is fine, and the earlier topics did exactly that. It starts to hurt when:

- The page needs data from **more than one** entity. A checkout page shows the cart, the customer's addresses and shipping options. No single entity holds all that.
- The page needs **less** than the entity. Sending `CostPrice` to the browser is a leak waiting to happen.
- The form collects fields that are **not** on the entity, such as "confirm password" or "I agree to the terms".
- You need **different validation** for the same entity on different pages.

A view model fixes every one of these because it is built for the page.

## A page with data from several places

```csharp
public class CheckoutViewModel
{
    public List<CartLineViewModel> Lines { get; set; } = new();
    public decimal Subtotal { get; set; }
    public List<Address> SavedAddresses { get; set; } = new();
    public int SelectedAddressId { get; set; }
    public List<SelectListItem> ShippingOptions { get; set; } = new();
}
```

The controller builds this object from wherever the pieces come from and passes it to the view:

```csharp
public IActionResult Checkout()
{
    var cart = _cart.GetCurrent();
    var customer = _customers.GetCurrent();

    var vm = new CheckoutViewModel
    {
        Lines = cart.Lines.Select(l => new CartLineViewModel
        {
            Name = l.Product.Name,
            Quantity = l.Quantity,
            LineTotal = l.Quantity * l.Product.Price
        }).ToList(),
        Subtotal = cart.Lines.Sum(l => l.Quantity * l.Product.Price),
        SavedAddresses = customer.Addresses,
        ShippingOptions = GetShippingOptions()
    };

    return View(vm);
}
```

The view declares `@model CheckoutViewModel` and has everything it needs. No `ViewBag`, no guessing.

## Input models for forms

A view model used to **receive** a posted form is sometimes called an input model or form model. The registration form is the classic example:

```csharp
public class RegisterViewModel
{
    [Required, EmailAddress]
    public string Email { get; set; } = "";

    [Required, DataType(DataType.Password)]
    public string Password { get; set; } = "";

    [Required, DataType(DataType.Password)]
    [Compare(nameof(Password), ErrorMessage = "Passwords do not match.")]
    public string ConfirmPassword { get; set; } = "";

    [Range(typeof(bool), "true", "true", ErrorMessage = "You must accept the terms.")]
    public bool AcceptTerms { get; set; }
}
```

`ConfirmPassword` and `AcceptTerms` are never stored. They exist only to validate the form. Putting them on the `User` entity would be wrong.

The controller receives the view model, validates it, then creates the entity:

```csharp
[HttpPost]
public IActionResult Register(RegisterViewModel vm)
{
    if (!ModelState.IsValid)
    {
        return View(vm);
    }

    var user = new User { Email = vm.Email };
    _users.Create(user, vm.Password);

    return RedirectToAction("Welcome");
}
```

## Mapping between them

Moving data from entity to view model and back is called **mapping**. For small apps, write it by hand. It is boring but clear:

```csharp
var vm = new ProductEditViewModel
{
    Id = product.Id,
    Name = product.Name,
    Price = product.Price
};
```

A small trick is to put the mapping in a static method or an extension method so it lives in one place:

```csharp
public static class ProductMappings
{
    public static ProductEditViewModel ToEditViewModel(this Product p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Price = p.Price
    };
}
```

For bigger apps, libraries such as AutoMapper or Mapster can map matching property names automatically.

## Where the files go

A common layout:

```text
Models/           domain entities: Product, Order, Customer
ViewModels/       page models: ProductListViewModel, CheckoutViewModel
  Products/       optionally grouped by controller
  Account/
```

Some teams keep view models next to their controller or use a `Models` folder for both with a `ViewModels` subfolder. What matters is that the two kinds are easy to tell apart. The suffix `ViewModel` (or `Vm`) does most of that work.

## Records as view models

For display only view models that never change after creation, a C# record is a neat fit:

```csharp
public record ProductCardViewModel(int Id, string Name, string DisplayPrice);
```

Records need a constructor call, which does not work well with model binding for posted forms. Use classes with settable properties for input models.

## A rule of thumb

Ask "who owns this shape?"

- If the **database** owns it, it is a domain model.
- If a **page** owns it, it is a view model.

When the answer is "both", pick the view model. Pages change more often than tables, and a view model lets the page change without touching the entity.

## Quick recap

- A domain model describes a thing in your business. A view model describes what one page needs.
- Use a view model when a page combines several entities, needs fewer fields, or has form only fields such as confirm password.
- The controller builds the view model from entities and maps posted view models back into entities.
- Keep mapping in one place, by hand for small apps or with a mapping library for larger ones.
- Name view models with a clear suffix and keep them in their own folder.

<code id="code-content" class="language-csharp">
// Models/Product.cs (domain model, matches the database)
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public decimal CostPrice { get; set; }
    public int CategoryId { get; set; }
    public Category Category { get; set; } = default!;
}

// ViewModels/Products/ProductListViewModel.cs (what the list page needs)
public class ProductListViewModel
{
    public string? SearchTerm { get; set; }
    public List&lt;ProductListItemViewModel&gt; Products { get; set; } = new();
    public int TotalCount { get; set; }
}

public class ProductListItemViewModel
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string DisplayPrice { get; set; } = "";
    public string CategoryName { get; set; } = "";
}

// ViewModels/Products/ProductEditViewModel.cs (what the edit form posts)
public class ProductEditViewModel
{
    public int Id { get; set; }
    [Required, StringLength(100)]
    public string Name { get; set; } = "";
    [Range(0.01, 100000)]
    public decimal Price { get; set; }
    public int CategoryId { get; set; }
    public List&lt;SelectListItem&gt; Categories { get; set; } = new();
}

// Mappings/ProductMappings.cs
public static class ProductMappings
{
    public static ProductListItemViewModel ToListItem(this Product p) =&gt; new()
    {
        Id = p.Id,
        Name = p.Name,
        DisplayPrice = p.Price.ToString("C"),
        CategoryName = p.Category.Name
    };

    public static ProductEditViewModel ToEditViewModel(this Product p) =&gt; new()
    {
        Id = p.Id,
        Name = p.Name,
        Price = p.Price,
        CategoryId = p.CategoryId
    };

    public static void ApplyTo(this ProductEditViewModel vm, Product p)
    {
        p.Name = vm.Name;
        p.Price = vm.Price;
        p.CategoryId = vm.CategoryId;
    }
}

// Controllers/ProductsController.cs
public class ProductsController : Controller
{
    private readonly IProductRepository _products;
    private readonly ICategoryRepository _categories;

    public ProductsController(IProductRepository products, ICategoryRepository categories)
    {
        _products = products;
        _categories = categories;
    }

    public IActionResult Index(string? search)
    {
        var items = _products.Search(search);
        var vm = new ProductListViewModel
        {
            SearchTerm = search,
            Products = items.Select(p =&gt; p.ToListItem()).ToList(),
            TotalCount = items.Count
        };
        return View(vm);
    }

    public IActionResult Edit(int id)
    {
        var product = _products.Find(id);
        if (product is null) return NotFound();

        var vm = product.ToEditViewModel();
        vm.Categories = _categories.All()
            .Select(c =&gt; new SelectListItem(c.Name, c.Id.ToString()))
            .ToList();
        return View(vm);
    }

    [HttpPost]
    public IActionResult Edit(ProductEditViewModel vm)
    {
        if (!ModelState.IsValid)
        {
            vm.Categories = _categories.All()
                .Select(c =&gt; new SelectListItem(c.Name, c.Id.ToString()))
                .ToList();
            return View(vm);
        }

        var product = _products.Find(vm.Id);
        if (product is null) return NotFound();

        vm.ApplyTo(product);
        _products.Save(product);
        return RedirectToAction(nameof(Index));
    }
}
</code></pre>
