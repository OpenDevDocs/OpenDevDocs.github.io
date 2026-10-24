---
publishDate: 2026-08-21T12:40
title: TempData and Flash Messages
slug: tempdata-and-flash-messages
metadescription: Use TempData to carry a message across a redirect, understand how it is stored in a cookie and cleared after one read, use Peek and Keep to control its lifetime, and build a reusable flash message partial.
updateDate: 2026-09-14T12:40
author: ['bishal-biswas']
level: 2
tags: ['tempdata', 'state', 'redirects']
course: dotnet-mvc
---

## The problem with redirects

After a successful POST, you redirect. That is the Post Redirect Get pattern, and it is the right thing to do. But it creates a small puzzle. The POST action knows the product was saved. The GET action that runs after the redirect knows nothing about it. How does the "Product saved!" message get from one to the other?

`ViewData` and `ViewBag` cannot help. They live for a single request, and a redirect is two requests. That is what **TempData** is for.

## What TempData does

`TempData` is a dictionary that survives exactly one redirect. Write to it in one action, read it in the next request, and it is gone.

```csharp
[HttpPost]
public async Task<IActionResult> Create(Product product)
{
    _db.Products.Add(product);
    await _db.SaveChangesAsync();

    TempData["Success"] = $"{product.Name} was created.";
    return RedirectToAction(nameof(Index));
}
```

```cshtml
@* Views/Products/Index.cshtml *@
@if (TempData["Success"] is string message)
{
    <div class="alert alert-success">@message</div>
}
```

The first request writes the message. The browser follows the redirect. The second request reads it and shows it. Refresh the page and the message is gone, because reading it marked it for deletion.

## Where it is stored

By default, `TempData` is serialised into a **cookie** on the response. The next request sends the cookie back, the framework reads it, and the values are available. This means:

- It works without any server side storage.
- It works across several server instances behind a load balancer.
- The values must be small, because cookies have a size limit of about 4 KB.
- The values must be simple types: strings, numbers, booleans, and arrays of those. Complex objects are not supported by the cookie provider.

The cookie is encrypted with the data protection system, so users cannot read or tamper with it.

If you prefer server side storage, switch to the session provider:

```csharp
builder.Services.AddControllersWithViews()
    .AddSessionStateTempDataProvider();
builder.Services.AddSession();

// after UseRouting
app.UseSession();
```

Session is covered in the next topic. For plain messages, the cookie provider is fine.

## Reading without removing

Reading a key marks it for deletion at the end of the request. Two methods change that.

`Peek` reads the value without marking it:

```csharp
var message = TempData.Peek("Success");
```

`Keep` reads it normally, then tells the framework to keep it for one more request:

```csharp
var message = TempData["Success"];
TempData.Keep("Success");
```

Use these when a layout or a partial needs to check the value but the view will read it again.

## Passing more than a string

A common need is a message plus a type such as success or error. Two keys work:

```csharp
TempData["Message"] = "Order placed.";
TempData["MessageType"] = "success";
```

For anything richer, serialise to JSON yourself:

```csharp
TempData["Flash"] = JsonSerializer.Serialize(new FlashMessage("success", "Order placed."));
```

```csharp
if (TempData["Flash"] is string json)
{
    var flash = JsonSerializer.Deserialize<FlashMessage>(json);
}
```

## A reusable flash message helper

Rather than repeating the two keys everywhere, wrap them in extension methods on `ITempDataDictionary`:

```csharp
public static class TempDataExtensions
{
    public static void Flash(this ITempDataDictionary tempData, string type, string message)
    {
        tempData["FlashType"] = type;
        tempData["FlashMessage"] = message;
    }

    public static void Success(this ITempDataDictionary tempData, string message) =>
        tempData.Flash("success", message);

    public static void Error(this ITempDataDictionary tempData, string message) =>
        tempData.Flash("danger", message);
}
```

The controller reads better:

```csharp
TempData.Success($"{product.Name} was created.");
return RedirectToAction(nameof(Index));
```

And a partial in the layout shows whatever is there, on every page:

```cshtml
@* Views/Shared/_Flash.cshtml *@
@if (TempData["FlashMessage"] is string message)
{
    var type = TempData["FlashType"] as string ?? "info";
    <div class="alert alert-@type alert-dismissible fade show" role="alert">
        @message
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
}
```

```cshtml
@* Views/Shared/_Layout.cshtml *@
<main class="container">
    <partial name="_Flash" />
    @RenderBody()
</main>
```

Now any action in the app can flash a message and it appears after the redirect, wherever the user lands.

## TempData in a controller property

A controller can declare a property backed by TempData with `[TempData]`:

```csharp
public class ProductsController : Controller
{
    [TempData]
    public string? StatusMessage { get; set; }

    [HttpPost]
    public IActionResult Delete(int id)
    {
        // delete
        StatusMessage = "Product deleted.";
        return RedirectToAction(nameof(Index));
    }
}
```

The property reads and writes `TempData["StatusMessage"]` behind the scenes. The same attribute works on Razor Pages page models.

## When not to use it

`TempData` is for one off messages and small values across a single redirect. It is not for:

- Shopping carts or anything that must last across many pages. Use session or the database.
- Large objects. The cookie limit will bite.
- Anything security sensitive that the next request must have. It can be lost if the user opens another tab in between.

## Quick recap

- `TempData` carries values from one request to the next, which is what you need after a redirect.
- Values are removed after they are read. `Peek` reads without removing and `Keep` preserves for one more request.
- The default provider stores it in an encrypted cookie, so keep values small and simple.
- Wrap the pattern in extension methods and a `_Flash` partial in the layout for site wide messages.
- `[TempData]` on a controller property gives typed access to one key.
- Use session or the database for state that must last longer than one redirect.

<code id="code-content" class="language-csharp">
// Extensions/TempDataExtensions.cs
using Microsoft.AspNetCore.Mvc.ViewFeatures;

public static class TempDataExtensions
{
    private const string TypeKey = "FlashType";
    private const string MessageKey = "FlashMessage";

    public static void Flash(this ITempDataDictionary tempData, string type, string message)
    {
        tempData[TypeKey] = type;
        tempData[MessageKey] = message;
    }

    public static void Success(this ITempDataDictionary tempData, string message) =&gt;
        tempData.Flash("success", message);

    public static void Error(this ITempDataDictionary tempData, string message) =&gt;
        tempData.Flash("danger", message);

    public static void Warning(this ITempDataDictionary tempData, string message) =&gt;
        tempData.Flash("warning", message);
}

// Controllers/ProductsController.cs
public class ProductsController : Controller
{
    private readonly AppDbContext _db;
    public ProductsController(AppDbContext db) =&gt; _db = db;

    public async Task&lt;IActionResult&gt; Index() =&gt;
        View(await _db.Products.OrderBy(p =&gt; p.Name).ToListAsync());

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; Create(Product product)
    {
        if (!ModelState.IsValid) return View(product);

        _db.Products.Add(product);
        await _db.SaveChangesAsync();

        TempData.Success($"{product.Name} was created.");
        return RedirectToAction(nameof(Index));
    }

    [HttpPost, ActionName("Delete")]
    [ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; DeleteConfirmed(int id)
    {
        var product = await _db.Products.FindAsync(id);
        if (product is null)
        {
            TempData.Error("That product no longer exists.");
            return RedirectToAction(nameof(Index));
        }

        _db.Products.Remove(product);
        await _db.SaveChangesAsync();

        TempData.Warning($"{product.Name} was deleted.");
        return RedirectToAction(nameof(Index));
    }
}

// Views/Shared/_Flash.cshtml
//
//   @if (TempData["FlashMessage"] is string message)
//   {
//       var type = TempData["FlashType"] as string ?? "info";
//       &lt;div class="alert alert-@type alert-dismissible fade show" role="alert"&gt;
//           @message
//           &lt;button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"&gt;&lt;/button&gt;
//       &lt;/div&gt;
//   }

// Views/Shared/_Layout.cshtml
//
//   &lt;main class="container"&gt;
//       &lt;partial name="_Flash" /&gt;
//       @RenderBody()
//   &lt;/main&gt;

// Program.cs (optional: store TempData in session instead of a cookie)
//
//   builder.Services.AddSession();
//   builder.Services.AddControllersWithViews().AddSessionStateTempDataProvider();
//   ...
//   app.UseRouting();
//   app.UseSession();
</code></pre>
