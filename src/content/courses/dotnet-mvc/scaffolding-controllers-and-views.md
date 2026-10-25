---
publishDate: 2026-08-17T11:20
title: Scaffolding Controllers and Views
slug: scaffolding-controllers-and-views
metadescription: Generate a full CRUD controller and its five views in seconds with the dotnet aspnet-codegenerator tool or Visual Studio, understand what the generated code does, and learn what to change before shipping it.
updateDate: 2026-09-14T11:20
author: ['bishal-biswas']
level: 2
tags: ['scaffolding', 'ef-core', 'tooling']
course: dotnet-mvc
---

## Let the tool write the boring parts

The previous topic built a CRUD controller by hand. It was seven actions and five views, and every entity in your app needs roughly the same seven actions and five views. Typing them again and again is a waste of time.

**Scaffolding** generates all of it from an entity class and a `DbContext`. You get a working controller with `Index`, `Details`, `Create`, `Edit` and `Delete`, plus a Razor view for each. Then you edit the result to fit your needs.

Think of scaffolding as a very fast first draft, not a finished feature.

## Installing the generator

The command line tool needs one global tool and one package in the project:

```bash
dotnet tool install --global dotnet-aspnet-codegenerator
dotnet add package Microsoft.VisualStudio.Web.CodeGeneration.Design
```

Visual Studio users can skip this. The "Add > New Scaffolded Item" menu installs what it needs.

The project must build, and the entity must be part of a `DbContext` that is registered in `Program.cs`. The setup topic covered both.

## Running the command

```bash
dotnet aspnet-codegenerator controller -name ProductsController -m Product -dc AppDbContext --relativeFolderPath Controllers --useDefaultLayout --referenceScriptLibraries
```

The options mean:

| Option | Meaning |
| --- | --- |
| `-name` | The controller class to create |
| `-m` | The model (entity) class |
| `-dc` | The `DbContext` class |
| `--relativeFolderPath` | Where to put the controller |
| `--useDefaultLayout` | Views use `_Layout.cshtml` |
| `--referenceScriptLibraries` | Views include the validation scripts partial |

After a few seconds you have `Controllers/ProductsController.cs` and a `Views/Products` folder with five files.

In Visual Studio, right click the `Controllers` folder, choose **Add > New Scaffolded Item**, then **MVC Controller with views, using Entity Framework**, and pick the same model and context.

## What the controller looks like

The generated controller is close to the one in the CRUD topic, with a few things worth knowing.

```csharp
[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Create([Bind("Id,Name,Price,InStock,CategoryId")] Product product)
{
    if (ModelState.IsValid)
    {
        _context.Add(product);
        await _context.SaveChangesAsync();
        return RedirectToAction(nameof(Index));
    }
    ViewData["CategoryId"] = new SelectList(_context.Categories, "Id", "Name", product.CategoryId);
    return View(product);
}
```

- It binds the **entity** directly and uses `[Bind]` to limit which properties are set. This works, but a view model is the cleaner long term choice.
- Dropdowns for foreign keys are filled through `ViewData` with a `SelectList`. It even detects the relationship from `CategoryId` to `Category`.
- `Edit` uses `_context.Update(product)` and catches `DbUpdateConcurrencyException`, the "overwrite everything" style from the CRUD topic.
- `Delete` uses the `[ActionName("Delete")]` trick for the confirmed POST.

## What the views look like

Each view uses the tag helpers you already know. `Index.cshtml` is a table:

```cshtml
@model IEnumerable<ShopApp.Models.Product>

<h1>Index</h1>
<p><a asp-action="Create">Create New</a></p>

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

`Create.cshtml` and `Edit.cshtml` are forms with a field group per property. `Details.cshtml` and `Delete.cshtml` are description lists.

The generated views use `DisplayNameFor` and `DisplayFor`, which means `[Display]` attributes and display templates on your model are respected without any changes.

## Scaffolding without a database

You can generate a controller and views from a class that is not an entity by leaving out `-dc`. You get the same actions with `// TODO` comments instead of database calls. It is useful when your data comes from an API or a service rather than EF Core.

There are also smaller options: `-actions` generates an empty controller with just the action signatures, and the `view` generator makes a single view from a template.

## Things to fix before shipping

Scaffolded code is meant to be edited. A short checklist:

1. **Titles and headings.** Change "Index" to "Products" and "Create New" to "Add a product".
2. **Bind to view models.** Replace the `[Bind]` entity binding with a view model so the form cannot set columns it should not.
3. **Load then modify.** Switch `Edit` from `Update(entity)` to loading the record and copying the fields.
4. **Related data on the list.** Add `Include` where the table shows a related name.
5. **Authorization.** Add `[Authorize]` to the controller or to the actions that change data.
6. **Feedback.** Add `TempData` success messages after create, edit and delete.
7. **Layout.** Style the table and forms to match the rest of the site.

None of these are hard. The point is that scaffolding got you 80 percent of the way in one command, and the remaining 20 percent is where you add what makes your app different.

## Regenerating

If you scaffold the same controller again with `-f` (force), the tool overwrites your file and all your edits are gone. Scaffold once per entity, then treat the result as your own code. If the model gains a property later, add the field to the views by hand.

## Quick recap

- Scaffolding generates a CRUD controller and five views from an entity and a `DbContext`.
- Install `dotnet-aspnet-codegenerator` and the code generation design package, or use the Visual Studio menu.
- The generated code binds entities with `[Bind]`, fills dropdowns through `ViewData`, and uses `Update` in edit.
- Treat it as a first draft: rename headings, switch to view models, add `Include`, add `[Authorize]`, and add feedback.
- Do not regenerate over edited files, because `-f` overwrites them.

<code id="code-content" class="language-csharp">
// Terminal
//
//   dotnet tool install --global dotnet-aspnet-codegenerator
//   dotnet add package Microsoft.VisualStudio.Web.CodeGeneration.Design
//   dotnet aspnet-codegenerator controller -name ProductsController -m Product -dc AppDbContext
//       --relativeFolderPath Controllers --useDefaultLayout --referenceScriptLibraries

// Controllers/ProductsController.cs (as generated, lightly trimmed)
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using ShopApp.Data;
using ShopApp.Models;

namespace ShopApp.Controllers
{
    public class ProductsController : Controller
    {
        private readonly AppDbContext _context;

        public ProductsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: Products
        public async Task&lt;IActionResult&gt; Index()
        {
            var appDbContext = _context.Products.Include(p =&gt; p.Category);
            return View(await appDbContext.ToListAsync());
        }

        // GET: Products/Details/5
        public async Task&lt;IActionResult&gt; Details(int? id)
        {
            if (id == null) return NotFound();

            var product = await _context.Products
                .Include(p =&gt; p.Category)
                .FirstOrDefaultAsync(m =&gt; m.Id == id);
            if (product == null) return NotFound();

            return View(product);
        }

        // GET: Products/Create
        public IActionResult Create()
        {
            ViewData["CategoryId"] = new SelectList(_context.Categories, "Id", "Name");
            return View();
        }

        // POST: Products/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task&lt;IActionResult&gt; Create([Bind("Id,Name,Price,InStock,CategoryId")] Product product)
        {
            if (ModelState.IsValid)
            {
                _context.Add(product);
                await _context.SaveChangesAsync();
                return RedirectToAction(nameof(Index));
            }
            ViewData["CategoryId"] = new SelectList(_context.Categories, "Id", "Name", product.CategoryId);
            return View(product);
        }

        // GET: Products/Edit/5
        public async Task&lt;IActionResult&gt; Edit(int? id)
        {
            if (id == null) return NotFound();

            var product = await _context.Products.FindAsync(id);
            if (product == null) return NotFound();
            ViewData["CategoryId"] = new SelectList(_context.Categories, "Id", "Name", product.CategoryId);
            return View(product);
        }

        // POST: Products/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task&lt;IActionResult&gt; Edit(int id, [Bind("Id,Name,Price,InStock,CategoryId")] Product product)
        {
            if (id != product.Id) return NotFound();

            if (ModelState.IsValid)
            {
                try
                {
                    _context.Update(product);
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!ProductExists(product.Id)) return NotFound();
                    throw;
                }
                return RedirectToAction(nameof(Index));
            }
            ViewData["CategoryId"] = new SelectList(_context.Categories, "Id", "Name", product.CategoryId);
            return View(product);
        }

        // GET: Products/Delete/5
        public async Task&lt;IActionResult&gt; Delete(int? id)
        {
            if (id == null) return NotFound();

            var product = await _context.Products
                .Include(p =&gt; p.Category)
                .FirstOrDefaultAsync(m =&gt; m.Id == id);
            if (product == null) return NotFound();

            return View(product);
        }

        // POST: Products/Delete/5
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public async Task&lt;IActionResult&gt; DeleteConfirmed(int id)
        {
            var product = await _context.Products.FindAsync(id);
            if (product != null)
            {
                _context.Products.Remove(product);
            }
            await _context.SaveChangesAsync();
            return RedirectToAction(nameof(Index));
        }

        private bool ProductExists(int id)
        {
            return _context.Products.Any(e =&gt; e.Id == id);
        }
    }
}
</code></pre>
