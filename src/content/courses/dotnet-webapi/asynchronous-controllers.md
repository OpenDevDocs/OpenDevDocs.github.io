---
publishDate: 2026-09-23T16:50
title: Asynchronous Controllers
slug: asynchronous-controllers
metadescription: Learn why async improves API throughput, write async actions correctly, pass cancellation tokens, and avoid deadlocks, sync over async and other common mistakes.
updateDate: 2026-09-07T16:50
author: ['bishal-biswas']
level: 2
tags: ['async', 'performance', 'threading']
course: dotnet-webapi
---

## What async actually buys you

A common misunderstanding: async does **not** make a single request faster. A database query that takes 50 milliseconds takes 50 milliseconds either way.

What async buys is **throughput**. It frees the thread while waiting.

ASP.NET Core has a limited thread pool. Every request takes a thread from it.

**Synchronous:** the thread calls the database and **blocks**. It sits there for 50 milliseconds doing nothing while the database works. With 100 concurrent requests, 100 threads are blocked. Request 101 waits for a thread.

**Asynchronous:** the thread starts the query and is **returned to the pool**. It serves other requests. When the database answers, any available thread picks up the continuation.

The same server handles far more concurrent requests with the same threads. On an API, where almost all the time is spent waiting on a database or another service, this is the difference between handling hundreds of concurrent users and thousands.

## Writing an async action

Three parts: `async`, a `Task` return type, and `await`.

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<BookResponse>> GetById(int id, CancellationToken ct)
{
    Book? book = await db.Books.FindAsync(new object[] { id }, ct);

    if (book is null) return NotFound();

    return new BookResponse(book.Id, book.Title, book.Price);
}
```

The return type wraps whatever you would have returned. `ActionResult<Book>` becomes `Task<ActionResult<Book>>`.

## Async all the way down

If any layer blocks, you lose the benefit and risk a deadlock. The chain must be async from the controller to the database:

```csharp
// Controller
public async Task<ActionResult<BookResponse>> GetById(int id, CancellationToken ct)
    => await service.GetByIdAsync(id, ct);

// Service
public async Task<BookResponse?> GetByIdAsync(int id, CancellationToken ct)
    => await repository.GetByIdAsync(id, ct);

// Repository
public async Task<BookResponse?> GetByIdAsync(int id, CancellationToken ct)
    => await db.Books.Where(b => b.Id == id)
                     .Select(b => new BookResponse(b.Id, b.Title, b.Price))
                     .FirstOrDefaultAsync(ct);
```

## Never block on async

These three lines are the classic mistake:

```csharp
var books = GetBooksAsync().Result;
GetBooksAsync().Wait();
var books = GetBooksAsync().GetAwaiter().GetResult();
```

**In ASP.NET Core they will not deadlock** as they did in the old ASP.NET, because there is no synchronization context. They still hurt.

The calling thread blocks while the async operation uses another thread. You have doubled the thread cost of the work and thrown away the entire benefit. Under load this exhausts the pool, and the symptom is an API that gets dramatically slower rather than one that fails clearly.

If a library only offers a synchronous method, call it synchronously and accept that. Do not wrap it in `Task.Run` inside a web request, which just moves the blocking to a pool thread.

## Cancellation tokens

When a client closes the tab, ASP.NET Core cancels the request. Nothing stops your database query unless you pass the token:

```csharp
[HttpGet]
public async Task<ActionResult<List<BookListItem>>> Search(
    string? term, CancellationToken cancellationToken)
{
    return await db.Books
        .Where(b => term == null || b.Title.Contains(term))
        .Select(b => new BookListItem(b.Id, b.Title))
        .ToListAsync(cancellationToken);
}
```

The parameter binds automatically. You add one word per method and stop wasting work on requests nobody is waiting for. On a busy API this matters.

Pass it to everything: `ToListAsync`, `FindAsync`, `SaveChangesAsync`, `HttpClient` calls, your own service methods.

A cancelled request throws `OperationCanceledException`. That is normal, not an error. Handle it in your global exception handler so it does not fill your dashboards with false alarms.

## Do not await in a loop unnecessarily

Sequential awaits are sometimes right and often wasteful:

```csharp
// Three round trips, one after the other
var books = await db.Books.ToListAsync(ct);
var authors = await db.Authors.ToListAsync(ct);
var reviews = await db.Reviews.ToListAsync(ct);
```

For independent HTTP calls, run them together:

```csharp
Task<Weather> weather = weatherClient.GetAsync(city, ct);
Task<Rates> rates = ratesClient.GetAsync(ct);
Task<News> news = newsClient.GetAsync(ct);

await Task.WhenAll(weather, rates, news);

return new Dashboard(weather.Result, rates.Result, news.Result);
```

Three calls of 200 milliseconds each take 200 milliseconds instead of 600.

**But not with one `DbContext`.** A context handles one operation at a time:

```csharp
// Throws: A second operation started on this context before a previous operation completed
var t1 = db.Books.ToListAsync(ct);
var t2 = db.Authors.ToListAsync(ct);
await Task.WhenAll(t1, t2);
```

For parallel database work, use `IDbContextFactory` and give each query its own context. Usually it is simpler to combine them into one query instead.

Similarly, a loop that awaits per item is an N plus 1 problem:

```csharp
// One query per id
foreach (int id in ids)
    results.Add(await db.Books.FindAsync(id));

// One query total
List<Book> results = await db.Books.Where(b => ids.Contains(b.Id)).ToListAsync(ct);
```

## Async void

Never write `async void` on anything except an event handler:

```csharp
public async void DoWork() { }      // an exception here crashes the process
public async Task DoWork() { }      // an exception is captured in the Task
```

An exception in an `async void` method cannot be caught by the caller, because there is no `Task` to observe. It reaches the top of the thread and terminates the process.

## Fire and forget

Tempting, and wrong:

```csharp
[HttpPost]
public async Task<IActionResult> Create(CreateBookRequest request, CancellationToken ct)
{
    Book book = await service.CreateAsync(request, ct);

    _ = emailService.SendAsync(book.Id);      // not awaited

    return Ok(book);
}
```

Three problems. Exceptions are swallowed silently. The work may be killed mid flight when the app shuts down. And nothing limits how many of these pile up.

Use a background service with a queue instead. That is the topic after next.

If you genuinely must, at least observe the failure:

```csharp
_ = Task.Run(async () =>
{
    try { await emailService.SendAsync(book.Id); }
    catch (Exception ex) { logger.LogError(ex, "Email failed for {Id}", book.Id); }
});
```

## ValueTask

`ValueTask<T>` avoids an allocation when a method often completes synchronously, such as a cache hit:

```csharp
public ValueTask<Book?> GetAsync(int id)
{
    if (cache.TryGetValue(id, out Book? cached))
        return ValueTask.FromResult(cached);       // no Task allocated

    return new ValueTask<Book?>(LoadFromDatabaseAsync(id));
}
```

Use it only on a genuinely hot path where you have measured a benefit. It has rules that `Task` does not: you may await it only once, and you must not access `.Result` before it completes. Default to `Task`.

## ConfigureAwait

You will see `ConfigureAwait(false)` in library code:

```csharp
await SomethingAsync().ConfigureAwait(false);
```

It says "do not resume on the captured synchronization context". In ASP.NET Core there is no synchronization context, so it does nothing in your application code.

Use it in a **library** that might also be consumed by WPF or WinForms, where the context does exist. Do not clutter an API codebase with it.

## Async and streaming

`IAsyncEnumerable<T>` streams results instead of buffering the whole list:

```csharp
[HttpGet("stream")]
public async IAsyncEnumerable<BookListItem> Stream(
    [EnumeratorCancellation] CancellationToken ct)
{
    await foreach (Book book in db.Books.AsAsyncEnumerable().WithCancellation(ct))
        yield return new BookListItem(book.Id, book.Title);
}
```

The first row reaches the client before the last is read, and memory stays flat. Useful for large exports. The `[EnumeratorCancellation]` attribute is required for the token to flow through.

## Quick recap

- Async does not speed up one request. It frees the thread while waiting, which raises throughput.
- Return `Task<T>`, mark the method `async`, and `await` the work.
- Be async from the controller down to the database. One blocking layer wastes the rest.
- Never use `.Result`, `.Wait()` or `GetAwaiter().GetResult()` in a request.
- Accept a `CancellationToken` and pass it everywhere. It binds automatically.
- Treat `OperationCanceledException` from a disconnect as information, not an error.
- Use `Task.WhenAll` for independent calls, but never for two queries on one `DbContext`.
- Never write `async void`. An exception in one crashes the process.
- Do not fire and forget. Use a background service with a queue.
- Default to `Task`. Reach for `ValueTask` only on a measured hot path.
- `ConfigureAwait(false)` does nothing in ASP.NET Core application code.

<code id="code-content" class="language-csharp">
// Async done right, with the common mistakes shown and explained.
using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private readonly AppDbContext db;
    private readonly IHttpClientFactory clients;
    private readonly ILogger&lt;BooksController&gt; logger;
    public BooksController(AppDbContext db, IHttpClientFactory clients, ILogger&lt;BooksController&gt; logger)
        =&gt; (this.db, this.clients, this.logger) = (db, clients, logger);
    // The CancellationToken binds automatically. One extra word per method, and
    // a client closing the tab now stops the database query too.
    [HttpGet]
    public async Task&lt;ActionResult&lt;List&lt;BookListItem&gt;&gt;&gt; Search(
        [FromQuery] string? term, CancellationToken cancellationToken)
    {
        return await db.Books
            .AsNoTracking()
            .Where(b =&gt; term == null || b.Title.Contains(term))
            .Select(b =&gt; new BookListItem(b.Id, b.Title))
            .ToListAsync(cancellationToken);      // pass it to EVERY async call
    }
    [HttpGet("{id:int}")]
    public async Task&lt;ActionResult&lt;BookListItem&gt;&gt; GetById(int id, CancellationToken ct)
    {
        Book? book = await db.Books.FindAsync(new object[] { id }, ct);
        return book is null ? NotFound() : new BookListItem(book.Id, book.Title);
    }
    // Independent HTTP calls run together: 200ms total instead of 600ms.
    [HttpGet("dashboard")]
    public async Task&lt;IActionResult&gt; Dashboard(CancellationToken ct)
    {
        HttpClient http = clients.CreateClient("external");
        Task&lt;string&gt; weather = http.GetStringAsync("https://example.com/weather", ct);
        Task&lt;string&gt; rates   = http.GetStringAsync("https://example.com/rates", ct);
        Task&lt;string&gt; news    = http.GetStringAsync("https://example.com/news", ct);
        await Task.WhenAll(weather, rates, news);
        return Ok(new { weather = weather.Result, rates = rates.Result, news = news.Result });
    }
    // WRONG, and it throws: a DbContext handles ONE operation at a time.
    //   var t1 = db.Books.ToListAsync(ct);
    //   var t2 = db.Authors.ToListAsync(ct);
    //   await Task.WhenAll(t1, t2);
    // For parallel database work use IDbContextFactory, or combine the queries.
    [HttpGet("with-authors")]
    public async Task&lt;IActionResult&gt; WithAuthors(CancellationToken ct) =&gt;
        Ok(await db.Books
            .Select(b =&gt; new { b.Id, b.Title, Author = b.Author.Name })   // one query
            .ToListAsync(ct));
    // N plus 1: one query per id.
    //   foreach (int id in ids) results.Add(await db.Books.FindAsync(id));
    // One query for all of them:
    [HttpPost("batch")]
    public async Task&lt;IActionResult&gt; Batch([FromBody] int[] ids, CancellationToken ct) =&gt;
        Ok(await db.Books.Where(b =&gt; ids.Contains(b.Id))
                         .Select(b =&gt; new BookListItem(b.Id, b.Title))
                         .ToListAsync(ct));
    [HttpPost]
    public async Task&lt;IActionResult&gt; Create([FromBody] CreateBookRequest request, CancellationToken ct)
    {
        var book = new Book { Title = request.Title, AuthorId = request.AuthorId };
        db.Books.Add(book);
        await db.SaveChangesAsync(ct);
        // Fire and forget swallows exceptions and can be killed at shutdown.
        // A background service with a queue is the right answer. If you must,
        // at least observe the failure:
        _ = Task.Run(async () =&gt;
        {
            try   { await SendConfirmationAsync(book.Id); }
            catch (Exception ex) { logger.LogError(ex, "Notification failed for {Id}", book.Id); }
        }, CancellationToken.None);
        return CreatedAtAction(nameof(GetById), new { id = book.Id }, book);
    }
    // Streams rows instead of buffering the whole list. The first row reaches the
    // client before the last is read, and memory stays flat.
    // [EnumeratorCancellation] is required for the token to flow through.
    [HttpGet("stream")]
    public async IAsyncEnumerable&lt;BookListItem&gt; Stream([EnumeratorCancellation] CancellationToken ct)
    {
        await foreach (Book book in db.Books.AsNoTracking().AsAsyncEnumerable().WithCancellation(ct))
            yield return new BookListItem(book.Id, book.Title);
    }
    private Task SendConfirmationAsync(int bookId) =&gt; Task.CompletedTask;
}
// Async all the way down. One blocking layer wastes the benefit of every other.
public class BookService
{
    private readonly AppDbContext db;
    public BookService(AppDbContext db) =&gt; this.db = db;
    public Task&lt;BookListItem?&gt; GetByIdAsync(int id, CancellationToken ct) =&gt;
        db.Books.Where(b =&gt; b.Id == id)
                .Select(b =&gt; new BookListItem(b.Id, b.Title))
                .FirstOrDefaultAsync(ct);
    // NEVER do this in a web request. It does not deadlock in ASP.NET Core, but it
    // blocks one thread while another does the work, doubling the cost and
    // throwing away the entire point of async.
    //   public BookListItem? GetById(int id) =&gt; GetByIdAsync(id, default).Result;
    // NEVER async void. An exception here cannot be caught by the caller and
    // terminates the process. Use async Task.
    //   public async void Refresh() { await SomethingAsync(); }
    public async Task RefreshAsync(CancellationToken ct) =&gt; await Task.Delay(10, ct);
}
public record BookListItem(int Id, string Title);
public record CreateBookRequest(string Title, int AuthorId);
public class Book   { public int Id { get; set; } public string Title { get; set; } = "";
                      public int AuthorId { get; set; } public Author Author { get; set; } = null!; }
public class Author { public int Id { get; set; } public string Name { get; set; } = ""; }
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;Book&gt; Books =&gt; Set&lt;Book&gt;();
    public DbSet&lt;Author&gt; Authors =&gt; Set&lt;Author&gt;();
}
</code></pre>
