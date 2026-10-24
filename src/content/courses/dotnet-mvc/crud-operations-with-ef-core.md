---
publishDate: 2026-08-16T11:10
title: CRUD Operations with EF Core
slug: crud-operations-with-ef-core
metadescription: Build a complete create, read, update and delete controller with Entity Framework Core, using Add, Find, FirstOrDefaultAsync, change tracking, Remove and SaveChangesAsync, with confirmation pages and proper redirects.
updateDate: 2026-09-14T11:10
author: ['bishal-biswas']
level: 2
tags: ['ef-core', 'crud', 'controllers']
course: dotnet-mvc
---

## The four operations

Almost every data driven page is one of four things: **Create** a record, **Read** records, **Update** a record, or **Delete** one. Together they spell CRUD. Once you can build a CRUD controller for one entity, you can build one for any entity.

This topic builds the whole thing for `Product`, one action at a time, using the `AppDbContext` from the setup topic.

## Read: the list page

```csharp
public async Task<IActionResult> Index()
{
    var products = await _db.Products
        .Include(p => p.Category)
        .OrderBy(p => p.Name)
        .ToListAsync();

    return View(products);
}
```

`_db.Products` is a query that has not run yet. `Include` adds the join. `OrderBy` adds the sort. `ToListAsync` sends the SQL and builds the objects. Nothing touches the database until that last call.

## Read: one record

```csharp
public async Task<IActionResult> Details(int id)
{
    var product = await _db.Products
        .Include(p => p.Category)
        .FirstOrDefaultAsync(p => p.Id == id);

    if (product is null)
    {
        return NotFound();
    }

    return View(product);
}
```

`FirstOrDefaultAsync` returns `null` when nothing matches, so always check. `FindAsync(id)` is a shortcut that looks up by primary key and checks the context's memory first, but it cannot `Include` related data.

## Create

Two actions: one to show the form, one to handle it.

```csharp
[HttpGet]
public IActionResult Create()
{
    return View();
}

[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Create(Product product)
{
    if (!ModelState.IsValid)
    {
        return View(product);
    }

    _db.Products.Add(product);
    await _db.SaveChangesAsync();

    return RedirectToAction(nameof(Index));
}
```

`Add` tells the context "this is new". `SaveChangesAsync` writes an `INSERT` and fills `product.Id` with the generated key. Until `SaveChangesAsync` runs, nothing has reached the database.

For simplicity this example binds `Product` directly. In a real app, bind a view model to avoid over posting, as the model binding topic explains.

## Update

```csharp
[HttpGet]
public async Task<IActionResult> Edit(int id)
{
    var product = await _db.Products.FindAsync(id);
    if (product is null) return NotFound();

    return View(product);
}

[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Edit(int id, Product input)
{
    if (id != input.Id) return BadRequest();

    if (!ModelState.IsValid) return View(input);

    var product = await _db.Products.FindAsync(id);
    if (product is null) return NotFound();

    product.Name = input.Name;
    product.Price = input.Price;
    product.InStock = input.InStock;
    product.CategoryId = input.CategoryId;

    await _db.SaveChangesAsync();

    return RedirectToAction(nameof(Index));
}
```

This is the **load then modify** pattern. Load the entity, change its properties, save. EF Core's **change tracker** notices which properties changed and writes an `UPDATE` for just those columns.

The `id` check stops someone editing a form to change the id in the URL to a different record than the one in the hidden field.

## The other way to update

Scaffolded code often uses `Update` instead:

```csharp
_db.Update(input);
await _db.SaveChangesAsync();
```

This marks every property as modified and writes all columns, without loading the entity first. It saves a query but overwrites everything, including columns the form did not include. Load then modify is safer, and the difference in speed is not noticeable in most apps.

## Delete

Deleting with a GET link is dangerous. A crawler following links could wipe your data. So the GET shows a confirmation page and the POST does the deletion:

```csharp
[HttpGet]
public async Task<IActionResult> Delete(int id)
{
    var product = await _db.Products
        .Include(p => p.Category)
        .FirstOrDefaultAsync(p => p.Id == id);

    if (product is null) return NotFound();

    return View(product);
}

[HttpPost, ActionName("Delete")]
[ValidateAntiForgeryToken]
public async Task<IActionResult> DeleteConfirmed(int id)
{
    var product = await _db.Products.FindAsync(id);

    if (product is not null)
    {
        _db.Products.Remove(product);
        await _db.SaveChangesAsync();
    }

    return RedirectToAction(nameof(Index));
}
```

Two methods cannot have the same name and the same parameters, so the POST is called `DeleteConfirmed`, and `[ActionName("Delete")]` makes it answer to `/Products/Delete` anyway. The view for both is `Delete.cshtml`.

The confirmation view is a form with just a button:

```cshtml
@model Product

<h1>Delete @Model.Name?</h1>
<p>This cannot be undone.</p>

<form asp-action="Delete" method="post">
    <input type="hidden" asp-for="Id" />
    <button type="submit" class="btn btn-danger">Delete</button>
    <a asp-action="Index" class="btn btn-link">Cancel</a>
</form>
```

## How SaveChanges works

The context tracks every entity it has loaded or added. When you call `SaveChangesAsync`, it looks at each one:

| State | What happens |
| --- | --- |
| Added | INSERT |
| Modified | UPDATE with only the changed columns |
| Deleted | DELETE |
| Unchanged | Nothing |

All the changes go in one transaction. If any statement fails, none of them are kept.

Because of this, you can add three products and delete one in a single `SaveChangesAsync` call. One trip, one transaction.

## Concurrency

If two people edit the same product at the same time, the second save silently overwrites the first. For most small apps that is acceptable. When it is not, add a row version column:

```csharp
[Timestamp]
public byte[] RowVersion { get; set; } = Array.Empty<byte>();
```

Include it as a hidden field in the edit form. EF Core then adds `WHERE RowVersion = @original` to the update, and throws `DbUpdateConcurrencyException` if the row changed. Catch it and tell the user to reload.

## Quick recap

- Read with `ToListAsync` for lists and `FirstOrDefaultAsync` or `FindAsync` for one record, checking for `null`.
- Create with `Add` then `SaveChangesAsync`, which fills in the generated id.
- Update by loading the entity, changing properties, and saving. The change tracker writes only what changed.
- Delete with a GET confirmation page and a POST that calls `Remove`, using `[ActionName]` to share the URL.
- `SaveChangesAsync` writes all pending changes in one transaction.
- Add a `[Timestamp]` column when overwriting concurrent edits is not acceptable.

<code id="code-content" class="language-csharp">
// Controllers/ProductsController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ShopApp.Data;
using ShopApp.Models;

public class ProductsController : Controller
{
    private readonly AppDbContext _db;
    public ProductsController(AppDbContext db) =&gt; _db = db;

    // READ: list
    public async Task&lt;IActionResult&gt; Index()
    {
        var products = await _db.Products
            .Include(p =&gt; p.Category)
            .OrderBy(p =&gt; p.Name)
            .ToListAsync();
        return View(products);
    }

    // READ: one
    public async Task&lt;IActionResult&gt; Details(int id)
    {
        var product = await _db.Products
            .Include(p =&gt; p.Category)
            .FirstOrDefaultAsync(p =&gt; p.Id == id);
        if (product is null) return NotFound();
        return View(product);
    }

    // CREATE
    [HttpGet]
    public async Task&lt;IActionResult&gt; Create()
    {
        ViewBag.Categories = await CategoryOptionsAsync();
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; Create([Bind("Name,Price,InStock,CategoryId")] Product product)
    {
        if (!ModelState.IsValid)
        {
            ViewBag.Categories = await CategoryOptionsAsync();
            return View(product);
        }

        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        TempData["Success"] = $"{product.Name} created.";
        return RedirectToAction(nameof(Index));
    }

    // UPDATE
    [HttpGet]
    public async Task&lt;IActionResult&gt; Edit(int id)
    {
        var product = await _db.Products.FindAsync(id);
        if (product is null) return NotFound();
        ViewBag.Categories = await CategoryOptionsAsync();
        return View(product);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; Edit(int id, [Bind("Id,Name,Price,InStock,CategoryId")] Product input)
    {
        if (id != input.Id) return BadRequest();

        if (!ModelState.IsValid)
        {
            ViewBag.Categories = await CategoryOptionsAsync();
            return View(input);
        }

        var product = await _db.Products.FindAsync(id);
        if (product is null) return NotFound();

        product.Name = input.Name;
        product.Price = input.Price;
        product.InStock = input.InStock;
        product.CategoryId = input.CategoryId;

        await _db.SaveChangesAsync();
        TempData["Success"] = $"{product.Name} updated.";
        return RedirectToAction(nameof(Index));
    }

    // DELETE
    [HttpGet]
    public async Task&lt;IActionResult&gt; Delete(int id)
    {
        var product = await _db.Products
            .Include(p =&gt; p.Category)
            .FirstOrDefaultAsync(p =&gt; p.Id == id);
        if (product is null) return NotFound();
        return View(product);
    }

    [HttpPost, ActionName("Delete")]
    [ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; DeleteConfirmed(int id)
    {
        var product = await _db.Products.FindAsync(id);
        if (product is not null)
        {
            _db.Products.Remove(product);
            await _db.SaveChangesAsync();
            TempData["Success"] = $"{product.Name} deleted.";
        }
        return RedirectToAction(nameof(Index));
    }

    private async Task&lt;SelectList&gt; CategoryOptionsAsync()
    {
        var categories = await _db.Categories.OrderBy(c =&gt; c.Name).ToListAsync();
        return new SelectList(categories, "Id", "Name");
    }
}
</code></pre>
