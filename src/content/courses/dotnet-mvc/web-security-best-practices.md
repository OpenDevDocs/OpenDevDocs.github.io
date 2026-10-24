---
publishDate: 2026-08-25T14:20
title: Web Security Best Practices
slug: web-security-best-practices
metadescription: A practical checklist for securing an MVC app against XSS, SQL injection, open redirects, over posting, insecure headers and secret leaks, with the ASP.NET Core features that handle each one and the mistakes that switch them off.
updateDate: 2026-09-14T14:20
author: ['bishal-biswas']
level: 4
tags: ['security', 'xss', 'best-practices']
course: dotnet-mvc
---

## Security is mostly not switching things off

ASP.NET Core does a lot for you. Razor encodes output. EF Core parameterises queries. The form tag helper adds anti forgery tokens. Identity hashes passwords. Most security failures in MVC apps come from bypassing one of these protections without realising it.

This topic walks through the common attacks, what the framework does about each, and the code that accidentally undoes it.

## Cross site scripting (XSS)

XSS is when an attacker gets their JavaScript to run on your page in another user's browser. The classic route is a comment field: they submit `<script>steal(document.cookie)</script>` and every visitor who sees the comment runs it.

**What the framework does**: Razor HTML encodes everything you write with `@`. That script becomes harmless text.

**What undoes it**:

```cshtml
@Html.Raw(comment.Body)
```

`Html.Raw` outputs the string unencoded. Only use it for HTML you generated yourself from trusted data. If users may submit rich text, sanitise it with a library such as HtmlSanitizer before storing or rendering.

Also watch for putting data into JavaScript inside a view:

```cshtml
<script>
    var name = "@Model.Name";   // an attacker's name could break out of the string
</script>
```

Serialise to JSON instead, which escapes correctly:

```cshtml
<script>
    var user = @Json.Serialize(Model);
</script>
```

Add a Content Security Policy header to limit where scripts may load from. It is a strong second line of defence against XSS.

## SQL injection

Building SQL from user input lets an attacker rewrite your query.

**What the framework does**: EF Core LINQ queries are always parameterised. `Where(p => p.Name == search)` sends `search` as a parameter, never as part of the SQL text.

**What undoes it**:

```csharp
_db.Products.FromSqlRaw($"SELECT * FROM Products WHERE Name = '{search}'");
```

String interpolation into `FromSqlRaw` is injection. Use `FromSqlInterpolated` or `FromSql`, which turn the interpolated values into parameters:

```csharp
_db.Products.FromSqlInterpolated($"SELECT * FROM Products WHERE Name = {search}");
```

The same applies to `ExecuteSqlRaw` and to any ADO.NET code you write directly.

## Cross site request forgery (CSRF)

Covered in its own topic. The short version: use the form tag helper, add `AutoValidateAntiforgeryTokenAttribute` globally, send the token as a header from `fetch`, and never change data in GET actions.

## Open redirects

A login page that redirects to `?returnUrl=` after success can be abused. An attacker sends a link to your real login page with `returnUrl=https://evil.example`. The user logs in on your genuine site and is then sent to the attacker's copy, which asks them to "log in again".

**What the framework does**: `LocalRedirect(url)` throws if the URL is not local. `Url.IsLocalUrl(url)` checks without throwing.

**What undoes it**: `Redirect(returnUrl)` with a user supplied value. Always use `LocalRedirect` for return URLs.

## Over posting

Binding a form directly to an entity lets a user set any property on it, including ones not in the form. The model binding topic covered this.

**Fix**: bind to view models with only the properties the form should change. Never bind an entity from a public form.

## Authorization gaps

Every action that changes data or shows private data must check who is asking. The most common gap is an edit action that checks the user is logged in but not that they own the record.

```csharp
[Authorize]
public async Task<IActionResult> Edit(int id)
{
    var order = await _db.Orders.FindAsync(id);   // anyone logged in can edit any order
    return View(order);
}
```

**Fix**: filter by the current user or use resource based authorization:

```csharp
var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == id && o.CustomerId == userId);
```

Prefer a fallback policy that requires login everywhere and opt out with `[AllowAnonymous]`, so forgetting `[Authorize]` fails safe.

## Secrets in the repository

Connection strings with passwords and API keys in `appsettings.json` end up in git history forever. Use user secrets in development and environment variables or a key vault in production, as the environments topic describes. If a secret was ever committed, rotate it. Removing it from the file does not remove it from history.

## HTTPS and headers

Run on HTTPS everywhere. The template's `UseHttpsRedirection` and `UseHsts` handle the redirect and tell browsers to never use HTTP for your site again.

Add a few headers in middleware. They cost nothing and close off whole classes of attack:

| Header | Value | Purpose |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'` and what you need | Limits script and resource sources |
| `X-Content-Type-Options` | `nosniff` | Stops MIME type guessing |
| `X-Frame-Options` | `DENY` | Stops your site being framed for clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits what URLs leak in the Referer header |
| `Permissions-Policy` | Disable what you do not use | Limits browser features |

Remove the `Server` header by setting `AddServerHeader = false` on Kestrel. There is no need to advertise what you run.

## Cookies

The authentication cookie is already `HttpOnly` and `Secure` on HTTPS. Set `SameSite` to `Lax` or `Strict`. For your own cookies, set the same flags unless there is a reason not to. Never store sensitive values in plain cookies.

## Passwords and accounts

Use Identity. Do not write your own hashing. Enable lockout. Keep login failure messages vague. Require email confirmation for anything that matters. Offer two factor authentication for admin accounts.

## Error details

The developer exception page must never reach production. It shows source, configuration and connection strings. The error handling topic covers the production setup. Also keep detailed errors out of logs that users can see and out of API responses.

## File uploads

Generate file names, check extensions against an allow list, limit sizes, and store outside `wwwroot` unless the file is meant to be public. The file uploads topic has the full checklist.

## Dependencies

Old packages carry known holes. Run this now and then:

```bash
dotnet list package --vulnerable
```

Keep the framework and packages up to date, and read release notes for security fixes.

## Rate limiting

Login, registration and password reset endpoints deserve rate limiting so a bot cannot try thousands of passwords. ASP.NET Core has built in rate limiting middleware:

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("login", o =>
    {
        o.PermitLimit = 5;
        o.Window = TimeSpan.FromMinutes(1);
    });
});

app.UseRateLimiter();
```

```csharp
[EnableRateLimiting("login")]
public async Task<IActionResult> Login(LoginViewModel vm)
```

## A short checklist

1. Never use `Html.Raw` on user content.
2. Never interpolate user input into raw SQL.
3. Anti forgery on every POST, global filter on.
4. `LocalRedirect` for return URLs.
5. View models for forms, never entities.
6. Fallback authorization policy plus ownership checks.
7. Secrets outside the repo, rotated if ever committed.
8. HTTPS, HSTS and security headers.
9. Identity for accounts, with lockout and vague failure messages.
10. Generic error pages in production.
11. Dependencies checked for vulnerabilities.
12. Rate limits on authentication endpoints.

## Quick recap

- The framework encodes output, parameterises queries, adds anti forgery tokens and hashes passwords. Most breaches come from bypassing one of these.
- `Html.Raw`, `FromSqlRaw` with interpolation, `Redirect(returnUrl)` and binding entities from forms are the four most common self inflicted holes.
- Check ownership, not just login, on every action that touches a user's data.
- Add security headers, run on HTTPS, keep secrets out of the repo and packages up to date.
- Rate limit login and password reset endpoints.

<code id="code-content" class="language-csharp">
// Middleware/SecurityHeadersMiddleware.cs
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    public SecurityHeadersMiddleware(RequestDelegate next) =&gt; _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        headers["Content-Security-Policy"] =
            "default-src 'self'; " +
            "script-src 'self' https://cdn.jsdelivr.net; " +
            "style-src 'self' https://cdn.jsdelivr.net; " +
            "img-src 'self' data:; " +
            "frame-ancestors 'none'";
        await _next(context);
    }
}

// Program.cs
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(k =&gt; k.AddServerHeader = false);

builder.Services.AddControllersWithViews(options =&gt;
{
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
});

builder.Services.AddAuthorization(options =&gt;
{
    // Everything requires login unless marked [AllowAnonymous]
    options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
});

builder.Services.AddRateLimiter(options =&gt;
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("auth", o =&gt;
    {
        o.PermitLimit = 5;
        o.Window = TimeSpan.FromMinutes(1);
        o.QueueLimit = 0;
    });
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseMiddleware&lt;SecurityHeadersMiddleware&gt;();
app.UseStaticFiles();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
app.Run();

// Controllers/AccountController.cs (rate limited, safe redirect, vague errors)
[AllowAnonymous]
public class AccountController : Controller
{
    private readonly SignInManager&lt;ApplicationUser&gt; _signIn;
    public AccountController(SignInManager&lt;ApplicationUser&gt; signIn) =&gt; _signIn = signIn;

    [HttpPost]
    [EnableRateLimiting("auth")]
    public async Task&lt;IActionResult&gt; Login(LoginViewModel vm, string? returnUrl)
    {
        var result = await _signIn.PasswordSignInAsync(vm.Email, vm.Password, vm.RememberMe, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            ModelState.AddModelError("", "Invalid email or password.");   // never say which
            return View(vm);
        }
        return LocalRedirect(returnUrl ?? "/");   // throws on external URLs
    }
}

// Controllers/OrdersController.cs (ownership check, parameterised raw SQL)
public class OrdersController : Controller
{
    private readonly AppDbContext _db;
    public OrdersController(AppDbContext db) =&gt; _db = db;

    public async Task&lt;IActionResult&gt; Details(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var order = await _db.Orders
            .FirstOrDefaultAsync(o =&gt; o.Id == id &amp;&amp; o.CustomerId == userId);   // not just logged in: owner
        return order is null ? NotFound() : View(order);
    }

    public async Task&lt;IActionResult&gt; Search(string term)
    {
        // FromSqlInterpolated turns {term} into a parameter. FromSqlRaw with $"" would not.
        var orders = await _db.Orders
            .FromSqlInterpolated($"SELECT * FROM Orders WHERE Reference LIKE {"%" + term + "%"}")
            .ToListAsync();
        return View(orders);
    }
}

// Views/Comments/_Comment.cshtml (encode by default, sanitise if rich text is allowed)
//
//   &lt;p&gt;@Model.Body&lt;/p&gt;                          @* encoded: safe *@
//   &lt;div&gt;@Html.Raw(Sanitizer.Sanitize(Model.RichBody))&lt;/div&gt;   @* only after sanitising *@
//   &lt;script&gt;const user = @Json.Serialize(Model.Author);&lt;/script&gt;  @* JSON escaped, not string concatenated *@
</code></pre>
