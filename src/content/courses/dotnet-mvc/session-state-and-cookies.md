---
publishDate: 2026-08-21T12:50
title: Session State and Cookies
slug: session-state-and-cookies
metadescription: Store per user data across requests with session state, configure the session middleware and its storage, read and write cookies directly, understand cookie options such as HttpOnly and SameSite, and choose between the two.
updateDate: 2026-09-14T12:50
author: ['bishal-biswas']
level: 2
tags: ['session', 'cookies', 'state']
course: dotnet-mvc
---

## HTTP forgets everything

Each request to a web server is independent. The server does not remember that the same person asked for the previous page. So how does a shopping cart survive from one page to the next?

Two tools handle this. **Cookies** store small pieces of data in the browser and send them with every request. **Session state** stores data on the server and uses a cookie holding only an id to find it again.

## Cookies

A cookie is a name and a value that the server asks the browser to keep. The browser sends it back on every later request to the same site.

Writing one:

```csharp
public IActionResult SetTheme(string theme)
{
    Response.Cookies.Append("theme", theme, new CookieOptions
    {
        Expires = DateTimeOffset.UtcNow.AddDays(30),
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Lax
    });

    return RedirectToAction("Index");
}
```

Reading one:

```csharp
var theme = Request.Cookies["theme"] ?? "light";
```

Deleting one:

```csharp
Response.Cookies.Delete("theme");
```

## Cookie options that matter

| Option | Meaning |
| --- | --- |
| `Expires` or `MaxAge` | How long the browser keeps it. Without either, it is deleted when the browser closes. |
| `HttpOnly` | JavaScript cannot read it. Set this unless a script truly needs the value. |
| `Secure` | Only sent over HTTPS. Always set this in production. |
| `SameSite` | Whether the cookie is sent on requests from other sites. `Lax` is a sensible default, `Strict` is tighter, `None` allows cross site and requires `Secure`. |
| `Path` and `Domain` | Limit which URLs receive the cookie. |

Cookies are visible to the user and can be edited with browser tools. Never store anything in a plain cookie that the user must not read or change, such as a user id or a price. If you need a tamper proof cookie, use the data protection system to encrypt the value, which is what the authentication cookie and `TempData` cookie already do.

## Session state

Session keeps data on the server. The browser gets a cookie called `.AspNetCore.Session` that holds a random id. On each request, the middleware uses the id to find that user's data.

Enable it in `Program.cs`:

```csharp
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

var app = builder.Build();

app.UseRouting();
app.UseSession();      // before MapControllerRoute
app.UseAuthorization();
```

`AddDistributedMemoryCache` is where the data lives, in the server's memory for now. `IdleTimeout` is how long a session lasts after the last request. `IsEssential` means the cookie is set even if the user has not consented to non essential cookies.

## Reading and writing session

Session stores bytes, with helpers for strings and integers:

```csharp
HttpContext.Session.SetString("Name", "Ada");
HttpContext.Session.SetInt32("Visits", 3);

var name = HttpContext.Session.GetString("Name");
var visits = HttpContext.Session.GetInt32("Visits") ?? 0;

HttpContext.Session.Remove("Name");
HttpContext.Session.Clear();
```

For objects, serialise to JSON. Two small extension methods make this painless:

```csharp
public static class SessionExtensions
{
    public static void SetObject<T>(this ISession session, string key, T value) =>
        session.SetString(key, JsonSerializer.Serialize(value));

    public static T? GetObject<T>(this ISession session, string key)
    {
        var json = session.GetString(key);
        return json is null ? default : JsonSerializer.Deserialize<T>(json);
    }
}
```

```csharp
var cart = HttpContext.Session.GetObject<Cart>("Cart") ?? new Cart();
cart.Add(productId, quantity);
HttpContext.Session.SetObject("Cart", cart);
```

You must write the object back after changing it. Session does not track changes inside an object.

## A session backed shopping cart

Wrapping the pattern in a service keeps controllers clean:

```csharp
public class SessionCartService : ICartService
{
    private const string Key = "Cart";
    private readonly ISession _session;

    public SessionCartService(IHttpContextAccessor accessor)
    {
        _session = accessor.HttpContext!.Session;
    }

    public Cart Get() => _session.GetObject<Cart>(Key) ?? new Cart();

    public void Save(Cart cart) => _session.SetObject(Key, cart);
}
```

Register `AddHttpContextAccessor()` and the service as scoped.

## Where session data lives

Memory is fine for one server. With two or more servers behind a load balancer, a user's second request might hit a server that does not have their session. Use a shared store instead:

```csharp
builder.Services.AddStackExchangeRedisCache(o =>
    o.Configuration = builder.Configuration.GetConnectionString("Redis"));
```

Or SQL Server with `AddDistributedSqlServerCache`. The rest of the code does not change. This is why session is built on `IDistributedCache`.

Alternatively, the load balancer can use sticky sessions so the same user always hits the same server. That works but is fragile when a server restarts.

## Session is not authentication

A session id in a cookie proves nothing about who the user is. Authentication uses a separate, signed cookie that the identity system manages. The session should hold conveniences, such as a cart or the last search filter, not the user's identity or permissions.

## Choosing between them

| Need | Use |
| --- | --- |
| A preference the browser can keep for weeks, such as a theme | Cookie |
| Small, non secret, readable by JavaScript | Cookie |
| Data the user must not see or edit | Session, or an encrypted cookie |
| Objects such as a cart or wizard state | Session |
| Anything that must survive a browser close for a logged in user | The database, keyed by user |

Sessions cost server memory and complicate scaling. Keep them small, and move important data to the database as soon as there is a user to attach it to.

## Quick recap

- Cookies store small values in the browser and are sent with every request. Set `HttpOnly`, `Secure` and `SameSite`.
- Session stores data on the server and uses a cookie holding only an id.
- Enable session with `AddSession`, a distributed cache, and `UseSession` before the endpoints.
- Use `GetString`, `SetInt32` and JSON extension methods for objects, and write objects back after changing them.
- Use a shared store such as Redis when running more than one server.
- Session is not authentication and is not permanent storage.

<code id="code-content" class="language-csharp">
// Extensions/SessionExtensions.cs
using System.Text.Json;

public static class SessionExtensions
{
    public static void SetObject&lt;T&gt;(this ISession session, string key, T value) =&gt;
        session.SetString(key, JsonSerializer.Serialize(value));

    public static T? GetObject&lt;T&gt;(this ISession session, string key)
    {
        var json = session.GetString(key);
        return json is null ? default : JsonSerializer.Deserialize&lt;T&gt;(json);
    }
}

// Models/Cart.cs
public class Cart
{
    public List&lt;CartLine&gt; Lines { get; set; } = new();

    public void Add(int productId, int quantity)
    {
        var line = Lines.FirstOrDefault(l =&gt; l.ProductId == productId);
        if (line is null) Lines.Add(new CartLine { ProductId = productId, Quantity = quantity });
        else line.Quantity += quantity;
    }

    public int ItemCount =&gt; Lines.Sum(l =&gt; l.Quantity);
}

public class CartLine
{
    public int ProductId { get; set; }
    public int Quantity { get; set; }
}

// Services/SessionCartService.cs
public class SessionCartService : ICartService
{
    private const string Key = "Cart";
    private readonly ISession _session;

    public SessionCartService(IHttpContextAccessor accessor) =&gt;
        _session = accessor.HttpContext!.Session;

    public Cart Get() =&gt; _session.GetObject&lt;Cart&gt;(Key) ?? new Cart();
    public void Save(Cart cart) =&gt; _session.SetObject(Key, cart);
    public void Clear() =&gt; _session.Remove(Key);
}

// Program.cs
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped&lt;ICartService, SessionCartService&gt;();

builder.Services.AddDistributedMemoryCache();      // swap for Redis when scaling out
builder.Services.AddSession(options =&gt;
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
});

var app = builder.Build();
app.UseStaticFiles();
app.UseRouting();
app.UseSession();
app.UseAuthorization();
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
app.Run();

// Controllers/CartController.cs
public class CartController : Controller
{
    private readonly ICartService _cart;
    public CartController(ICartService cart) =&gt; _cart = cart;

    public IActionResult Index() =&gt; View(_cart.Get());

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Add(int productId, int quantity = 1)
    {
        var cart = _cart.Get();
        cart.Add(productId, quantity);
        _cart.Save(cart);                  // must write back after changing
        return RedirectToAction(nameof(Index));
    }

    // A plain cookie for a preference the browser keeps for 30 days
    [HttpPost]
    public IActionResult SetTheme(string theme)
    {
        Response.Cookies.Append("theme", theme, new CookieOptions
        {
            Expires = DateTimeOffset.UtcNow.AddDays(30),
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax
        });
        return Redirect(Request.Headers.Referer.ToString() is { Length: &gt; 0 } r ? r : "/");
    }
}

// Views/Shared/_Layout.cshtml (reading the cookie)
//
//   @{ var theme = Context.Request.Cookies["theme"] ?? "light"; }
//   &lt;body class="theme-@theme"&gt;
</code></pre>
