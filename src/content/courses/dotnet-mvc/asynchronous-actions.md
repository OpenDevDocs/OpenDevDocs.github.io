---
publishDate: 2026-08-15T10:40
title: Asynchronous Actions
slug: asynchronous-actions
metadescription: Learn why controller actions should be async when they wait on a database or a web service, how Task, async and await work together, the naming convention, and the common mistakes such as blocking with Result.
updateDate: 2026-09-14T10:40
author: ['bishal-biswas']
level: 2
tags: ['async', 'await', 'performance']
course: dotnet-mvc
---

## Waiting without blocking

Most of what a web action does is wait. It waits for the database to return rows. It waits for a payment API to reply. It waits for a file to be read. The CPU work in between is tiny.

A **synchronous** action holds a thread for the whole wait. The thread sits there doing nothing until the answer arrives. With enough simultaneous users, the server runs out of threads and new requests queue up even though the CPU is nearly idle.

An **asynchronous** action gives the thread back while waiting. When the answer arrives, some thread picks up where it left off. The same server handles far more users.

That is the whole reason for `async` and `await`. Nothing runs faster for a single user. The server just wastes less.

## The three keywords

```csharp
public async Task<IActionResult> Details(int id)
{
    var product = await _db.Products.FindAsync(id);

    if (product is null)
    {
        return NotFound();
    }

    return View(product);
}
```

- `async` on the method says "this method may pause".
- `Task<IActionResult>` is the return type. A `Task` is a promise that an `IActionResult` will exist later.
- `await` is where the method pauses. The thread goes back to the pool. When `FindAsync` finishes, the method resumes on the next line.

Inside the method you still `return View(product)` as before. The compiler wraps it in the `Task` for you.

## Which methods to await

Anything that talks to something outside your process has an async version. Entity Framework Core provides them for every query:

```csharp
var all = await _db.Products.ToListAsync();
var one = await _db.Products.FirstOrDefaultAsync(p => p.Id == id);
var count = await _db.Products.CountAsync();
var exists = await _db.Products.AnyAsync(p => p.Name == name);
await _db.SaveChangesAsync();
```

`HttpClient`, file streams and most libraries follow the same pattern with an `Async` suffix.

If a method has no async version, it is probably CPU only and there is nothing to wait for. Just call it.

## An action with several waits

You can await as many times as you need:

```csharp
public async Task<IActionResult> Index()
{
    var products = await _db.Products.ToListAsync();
    var categories = await _db.Categories.ToListAsync();

    return View(new CatalogViewModel(products, categories));
}
```

These run one after another. If two operations are independent and use **different** resources, start both and then wait for both:

```csharp
var weatherTask = _weather.GetForecastAsync(city);
var newsTask = _news.GetHeadlinesAsync();

await Task.WhenAll(weatherTask, newsTask);

var vm = new DashboardViewModel(weatherTask.Result, newsTask.Result);
```

Do not do this with two queries on the same `DbContext`. A `DbContext` handles one operation at a time, and parallel queries on it throw an exception. Run them in sequence instead.

## Actions without a result to return

If an action returns a redirect or plain content and has nothing to compute, it still needs `Task<IActionResult>`. `async Task` on its own is for methods that return nothing at all, which is rare in a controller:

```csharp
[HttpPost]
public async Task<IActionResult> Delete(int id)
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

## Naming

The convention is to add `Async` to the name of async methods. Controllers are the one exception. `Details` is nicer than `DetailsAsync` in URLs and in `asp-action`, so most projects leave the suffix off for actions. The framework also strips the suffix from route names by default, so both styles map to the same URL.

Services and repositories should keep the suffix: `GetProductAsync`, `SaveAsync`.

## Mistakes to avoid

**Calling `.Result` or `.Wait()`.** This blocks the thread and can deadlock in some contexts. If you have a `Task`, await it:

```csharp
// Wrong
var product = _db.Products.FindAsync(id).Result;

// Right
var product = await _db.Products.FindAsync(id);
```

**Forgetting the await.** Without `await`, the method carries on before the work is finished and you get a `Task` where you expected a value. The compiler warns about this. Do not ignore the warning.

**Using `async void`.** Exceptions from an `async void` method cannot be caught by the caller and can crash the process. Actions should return `Task<IActionResult>`.

**Wrapping CPU work in `Task.Run`.** On a web server this only moves work from one thread to another. It does not help throughput. Reserve `Task.Run` for desktop apps that need to keep a UI responsive.

## Cancellation

If a user closes the browser mid request, the server can stop the work. Accept a `CancellationToken` parameter and pass it to the async calls:

```csharp
public async Task<IActionResult> Index(CancellationToken cancellationToken)
{
    var products = await _db.Products.ToListAsync(cancellationToken);
    return View(products);
}
```

The framework fills the token in and cancels it when the connection drops. Most apps do this only for slow or expensive queries.

## Async in views

Views can await too. The most common case is invoking a view component:

```cshtml
@await Component.InvokeAsync("CartSummary")
```

Avoid putting database calls directly in views. Load the data in the controller and pass it in.

## Quick recap

- Async actions release the thread while waiting on the database or a web service, so the server can handle more users.
- Mark the action `async`, return `Task<IActionResult>`, and `await` every call that ends in `Async`.
- Run independent waits in parallel with `Task.WhenAll`, but never two queries on one `DbContext` at the same time.
- Never block with `.Result` or `.Wait()`, never use `async void`, and do not wrap CPU work in `Task.Run` on a server.
- Accept a `CancellationToken` for slow queries so abandoned requests can stop early.

<code id="code-content" class="language-csharp">
// Controllers/ProductsController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

public class ProductsController : Controller
{
    private readonly AppDbContext _db;
    private readonly IStockService _stock;

    public ProductsController(AppDbContext db, IStockService stock)
    {
        _db = db;
        _stock = stock;
    }

    // Two queries on the same DbContext: run them one after another.
    public async Task&lt;IActionResult&gt; Index(CancellationToken cancellationToken)
    {
        var products = await _db.Products
            .Include(p =&gt; p.Category)
            .OrderBy(p =&gt; p.Name)
            .ToListAsync(cancellationToken);

        var categoryCount = await _db.Categories.CountAsync(cancellationToken);

        return View(new CatalogViewModel(products, categoryCount));
    }

    // A database call and an external API call are independent: run them together.
    public async Task&lt;IActionResult&gt; Details(int id)
    {
        var productTask = _db.Products.FirstOrDefaultAsync(p =&gt; p.Id == id);
        var stockTask = _stock.GetAvailabilityAsync(id);

        await Task.WhenAll(productTask, stockTask);

        var product = productTask.Result;
        if (product is null) return NotFound();

        ViewData["Stock"] = stockTask.Result;
        return View(product);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; Create(Product product)
    {
        if (await _db.Products.AnyAsync(p =&gt; p.Name == product.Name))
        {
            ModelState.AddModelError(nameof(product.Name), "That name is already used.");
        }

        if (!ModelState.IsValid) return View(product);

        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; Delete(int id)
    {
        var product = await _db.Products.FindAsync(id);
        if (product is not null)
        {
            _db.Products.Remove(product);
            await _db.SaveChangesAsync();
        }
        return RedirectToAction(nameof(Index));
    }
}

// Services/IStockService.cs
public interface IStockService
{
    Task&lt;int&gt; GetAvailabilityAsync(int productId);
}

// Services/HttpStockService.cs
public class HttpStockService : IStockService
{
    private readonly HttpClient _http;
    public HttpStockService(HttpClient http) =&gt; _http = http;

    public async Task&lt;int&gt; GetAvailabilityAsync(int productId)
    {
        var response = await _http.GetFromJsonAsync&lt;StockResponse&gt;($"/stock/{productId}");
        return response?.Available ?? 0;
    }

    private record StockResponse(int Available);
}
</code></pre>
