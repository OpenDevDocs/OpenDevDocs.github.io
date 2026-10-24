---
publishDate: 2026-08-23T13:40
title: Authentication and Authorization Basics
slug: authentication-and-authorization-basics
metadescription: Learn the difference between proving who a user is and deciding what they may do, set up cookie authentication with claims, sign users in and out, protect actions with Authorize and AllowAnonymous, and read the current user in controllers and views.
updateDate: 2026-09-14T13:40
author: ['bishal-biswas']
level: 2
tags: ['authentication', 'authorization', 'security']
course: dotnet-mvc
---

## Two questions

Security in a web app starts with two separate questions:

- **Authentication**: who are you? Proving identity, usually with a username and password.
- **Authorization**: what are you allowed to do? Deciding whether a known user may reach a page or perform an action.

They are easy to confuse because they sound alike. Remember it this way: authentication happens once, at login. Authorization happens on every request.

## How the framework remembers a user

HTTP has no memory, so after login the server must give the browser something to present on later requests. In MVC apps that is an **authentication cookie**. It contains the user's identity, encrypted and signed so it cannot be forged or read. The browser sends it with every request, and the authentication middleware turns it back into a `User` object.

The identity inside the cookie is a set of **claims**. A claim is a simple name and value pair: the user's id, their name, their email, their roles. Everything the app knows about the logged in user is a claim.

## Setting up cookie authentication

The smallest possible setup, without a user database, is a good way to see the pieces:

```csharp
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.AccessDeniedPath = "/Account/Denied";
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
        options.SlidingExpiration = true;
    });

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
```

`LoginPath` is where unauthenticated users are sent. `AccessDeniedPath` is for authenticated users who lack permission. `SlidingExpiration` renews the cookie on activity.

Both middlewares must be present and in that order, after `UseRouting`.

## Signing in

Signing in means building a set of claims and asking the framework to write the cookie:

```csharp
[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Login(LoginViewModel vm, string? returnUrl)
{
    var user = _users.Validate(vm.Email, vm.Password);
    if (user is null)
    {
        ModelState.AddModelError("", "Invalid email or password.");
        return View(vm);
    }

    var claims = new List<Claim>
    {
        new(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new(ClaimTypes.Name, user.Name),
        new(ClaimTypes.Email, user.Email),
        new(ClaimTypes.Role, "Customer")
    };

    var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
    var principal = new ClaimsPrincipal(identity);

    await HttpContext.SignInAsync(principal, new AuthenticationProperties
    {
        IsPersistent = vm.RememberMe
    });

    return LocalRedirect(returnUrl ?? "/");
}
```

`SignInAsync` creates the cookie. `IsPersistent` keeps it after the browser closes. `LocalRedirect` only follows URLs on your own site, which stops an attacker from using the login page to send users elsewhere.

Never compare passwords in plain text. `_users.Validate` must hash the submitted password and compare hashes. The Identity topic does this properly.

## Signing out

```csharp
[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Logout()
{
    await HttpContext.SignOutAsync();
    return RedirectToAction("Index", "Home");
}
```

Logout should be a POST. A GET link can be triggered by an image tag on another site.

## Protecting actions

`[Authorize]` requires an authenticated user:

```csharp
[Authorize]
public class OrdersController : Controller
{
    public IActionResult Index() => View();

    [AllowAnonymous]
    public IActionResult TrackingInfo() => View();
}
```

On the controller it protects every action. `[AllowAnonymous]` punches a hole for one action. Unauthenticated users are redirected to `LoginPath` with a `ReturnUrl` so they come back after logging in.

To protect the whole app by default and opt out per page, add a global policy:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = options.DefaultPolicy;
});
```

Now every endpoint requires login unless marked `[AllowAnonymous]`. This is the safer default for internal apps.

## Roles

A quick form of authorization is by role:

```csharp
[Authorize(Roles = "Admin")]
public IActionResult Dashboard() => View();

[Authorize(Roles = "Admin,Manager")]
public IActionResult Reports() => View();
```

Roles come from `ClaimTypes.Role` claims in the cookie. The comma means "any of these". The role and policy topic goes much further.

## Reading the user

In a controller, `User` is the `ClaimsPrincipal` from the cookie:

```csharp
var isLoggedIn = User.Identity?.IsAuthenticated ?? false;
var name = User.Identity?.Name;
var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
var isAdmin = User.IsInRole("Admin");
```

In a view, the same object is available as `User`:

```cshtml
@if (User.Identity?.IsAuthenticated ?? false)
{
    <span>Hello, @User.Identity.Name</span>
    <form asp-controller="Account" asp-action="Logout" method="post">
        <button type="submit" class="btn btn-link">Log out</button>
    </form>
}
else
{
    <a asp-controller="Account" asp-action="Login">Log in</a>
}
```

In a service outside MVC, inject `IHttpContextAccessor` and read `HttpContext.User`.

## Cookie settings that matter

The authentication cookie is `HttpOnly` and, on HTTPS, `Secure` by default. Set `SameSite` to `Lax` or `Strict` unless you have a reason not to. Give it a short lifetime with sliding expiration rather than a long fixed one. And host on HTTPS, always, so the cookie is never sent in the clear.

## Where this is going

This topic wired up the mechanics by hand so you can see them. Real apps need a user store, password hashing, lockout, password reset and email confirmation. ASP.NET Core Identity provides all of that on top of exactly these cookie pieces, and it is the subject of a later topic.

## Quick recap

- Authentication proves who the user is. Authorization decides what they may do.
- Cookie authentication stores the user's claims in an encrypted cookie that the middleware turns back into `User`.
- Sign in with `HttpContext.SignInAsync` and a `ClaimsPrincipal`, sign out with `SignOutAsync`, both from POST actions.
- `[Authorize]` protects controllers and actions, `[AllowAnonymous]` opens specific ones, and a fallback policy protects everything by default.
- Read the user with `User.Identity`, `User.FindFirstValue` and `User.IsInRole` in controllers and views.
- `UseAuthentication` must come before `UseAuthorization`, both after `UseRouting`.

<code id="code-content" class="language-csharp">
// Program.cs
using Microsoft.AspNetCore.Authentication.Cookies;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
builder.Services.AddScoped&lt;IUserStore, InMemoryUserStore&gt;();

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =&gt;
    {
        options.LoginPath = "/Account/Login";
        options.AccessDeniedPath = "/Account/Denied";
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
        options.SlidingExpiration = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
    });

builder.Services.AddAuthorization();

var app = builder.Build();
app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
app.Run();

// ViewModels/LoginViewModel.cs
public class LoginViewModel
{
    [Required, EmailAddress]
    public string Email { get; set; } = "";

    [Required, DataType(DataType.Password)]
    public string Password { get; set; } = "";

    [Display(Name = "Remember me")]
    public bool RememberMe { get; set; }
}

// Controllers/AccountController.cs
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;

public class AccountController : Controller
{
    private readonly IUserStore _users;
    public AccountController(IUserStore users) =&gt; _users = users;

    [HttpGet]
    public IActionResult Login(string? returnUrl)
    {
        ViewData["ReturnUrl"] = returnUrl;
        return View(new LoginViewModel());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; Login(LoginViewModel vm, string? returnUrl)
    {
        if (!ModelState.IsValid) return View(vm);

        var user = _users.ValidateCredentials(vm.Email, vm.Password);   // hashes and compares
        if (user is null)
        {
            ModelState.AddModelError("", "Invalid email or password.");
            return View(vm);
        }

        var claims = new List&lt;Claim&gt;
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Name),
            new(ClaimTypes.Email, user.Email)
        };
        claims.AddRange(user.Roles.Select(r =&gt; new Claim(ClaimTypes.Role, r)));

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(
            new ClaimsPrincipal(identity),
            new AuthenticationProperties { IsPersistent = vm.RememberMe });

        return LocalRedirect(returnUrl ?? "/");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; Logout()
    {
        await HttpContext.SignOutAsync();
        return RedirectToAction("Index", "Home");
    }

    public IActionResult Denied() =&gt; View();
}

// Controllers/OrdersController.cs
[Authorize]
public class OrdersController : Controller
{
    public IActionResult Index()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        ViewData["Title"] = $"Orders for {User.Identity?.Name}";
        return View();
    }

    [Authorize(Roles = "Admin")]
    public IActionResult All() =&gt; View();

    [AllowAnonymous]
    public IActionResult Track(string code) =&gt; View();
}

// Views/Shared/_LoginPartial.cshtml
//
//   @if (User.Identity?.IsAuthenticated ?? false)
//   {
//       &lt;span class="navbar-text"&gt;Hello, @User.Identity.Name&lt;/span&gt;
//       &lt;form asp-controller="Account" asp-action="Logout" method="post" class="d-inline"&gt;
//           &lt;button type="submit" class="btn btn-link"&gt;Log out&lt;/button&gt;
//       &lt;/form&gt;
//   }
//   else
//   {
//       &lt;a asp-controller="Account" asp-action="Login" class="nav-link"&gt;Log in&lt;/a&gt;
//   }
</code></pre>
