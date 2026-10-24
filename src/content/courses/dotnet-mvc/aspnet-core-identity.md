---
publishDate: 2026-08-24T14:00
title: ASP.NET Core Identity
slug: aspnet-core-identity
metadescription: Add ASP.NET Core Identity to an MVC app for a complete membership system with user registration, password hashing, login, lockout, roles and a database store, using UserManager and SignInManager from your own controllers.
updateDate: 2026-09-14T14:00
author: ['bishal-biswas']
level: 3
tags: ['identity', 'authentication', 'security']
course: dotnet-mvc
---

## Do not build your own login system

The authentication basics topic showed how the cookie pieces fit together. It also skipped the hard parts: storing users, hashing passwords safely, locking accounts after failed attempts, confirming emails, resetting passwords, two factor codes. Every one of these has traps that have caught experienced developers.

**ASP.NET Core Identity** is the built in membership system that does all of it. It stores users and roles in your database through EF Core, hashes passwords with a strong algorithm, and gives you two services, `UserManager` and `SignInManager`, to drive it from your controllers.

## Installing

Add the package:

```bash
dotnet add package Microsoft.AspNetCore.Identity.EntityFrameworkCore
```

Create a user class. It can be `IdentityUser` directly, but a subclass lets you add your own properties later:

```csharp
public class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = "";
}
```

Make your context inherit from `IdentityDbContext` instead of `DbContext`:

```csharp
public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Product> Products => Set<Product>();
}
```

Register Identity in `Program.cs`:

```csharp
builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequiredLength = 8;
    options.Password.RequireNonAlphanumeric = false;
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    options.User.RequireUniqueEmail = true;
    options.SignIn.RequireConfirmedEmail = false;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Account/Login";
    options.AccessDeniedPath = "/Account/Denied";
});
```

`AddIdentity` sets up cookie authentication for you, so you do not also call `AddAuthentication().AddCookie()`. `AddDefaultTokenProviders` enables the tokens used for email confirmation and password reset.

Then add a migration. Identity brings seven tables with names starting `AspNet`, such as `AspNetUsers` and `AspNetRoles`:

```bash
dotnet ef migrations add AddIdentity
dotnet ef database update
```

## The two managers

`UserManager<ApplicationUser>` creates and updates users, checks passwords, manages roles and claims, and generates tokens. `SignInManager<ApplicationUser>` signs users in and out and handles lockout and two factor flow. Both come from DI.

## Registration

```csharp
[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Register(RegisterViewModel vm)
{
    if (!ModelState.IsValid) return View(vm);

    var user = new ApplicationUser
    {
        UserName = vm.Email,
        Email = vm.Email,
        DisplayName = vm.DisplayName
    };

    var result = await _userManager.CreateAsync(user, vm.Password);

    if (!result.Succeeded)
    {
        foreach (var error in result.Errors)
        {
            ModelState.AddModelError("", error.Description);
        }
        return View(vm);
    }

    await _signInManager.SignInAsync(user, isPersistent: false);
    return RedirectToAction("Index", "Home");
}
```

`CreateAsync` hashes the password, checks it against the password rules, checks the email is unique, and saves. The result carries readable error messages when something fails.

## Login

```csharp
[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Login(LoginViewModel vm, string? returnUrl)
{
    if (!ModelState.IsValid) return View(vm);

    var result = await _signInManager.PasswordSignInAsync(
        vm.Email, vm.Password, vm.RememberMe, lockoutOnFailure: true);

    if (result.Succeeded)
    {
        return LocalRedirect(returnUrl ?? "/");
    }

    if (result.IsLockedOut)
    {
        ModelState.AddModelError("", "This account is locked. Try again in 15 minutes.");
        return View(vm);
    }

    ModelState.AddModelError("", "Invalid email or password.");
    return View(vm);
}
```

One call verifies the password, counts failed attempts, applies lockout, builds the claims and writes the cookie. The message on failure is deliberately vague so an attacker cannot tell whether the email exists.

## Logout

```csharp
[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Logout()
{
    await _signInManager.SignOutAsync();
    return RedirectToAction("Index", "Home");
}
```

## Roles

Create roles once, usually in a seeder, then assign them:

```csharp
if (!await roleManager.RoleExistsAsync("Admin"))
{
    await roleManager.CreateAsync(new IdentityRole("Admin"));
}

var admin = await userManager.FindByEmailAsync("admin@shop.com");
if (admin is not null && !await userManager.IsInRoleAsync(admin, "Admin"))
{
    await userManager.AddToRoleAsync(admin, "Admin");
}
```

`RoleManager<IdentityRole>` comes from DI like the others. Once assigned, `[Authorize(Roles = "Admin")]` and `User.IsInRole("Admin")` work.

## Getting the current user

```csharp
var user = await _userManager.GetUserAsync(User);
```

This loads the full `ApplicationUser` from the database for the logged in principal. For just the id, `_userManager.GetUserId(User)` reads it from the claims without a query.

## Password reset and email confirmation

Both follow the same shape: generate a token, email a link containing it, and verify the token when the user comes back.

```csharp
var token = await _userManager.GeneratePasswordResetTokenAsync(user);
var link = Url.Action("ResetPassword", "Account", new { email = user.Email, token }, Request.Scheme);
await _email.SendAsync(user.Email!, "Reset your password", $"Click here: {link}");
```

```csharp
var result = await _userManager.ResetPasswordAsync(user, vm.Token, vm.NewPassword);
```

Email confirmation uses `GenerateEmailConfirmationTokenAsync` and `ConfirmEmailAsync`. Set `SignIn.RequireConfirmedEmail = true` to block login until confirmed.

## The default UI

Identity also ships pre built Razor Pages for all of these flows. Add them with `AddDefaultIdentity` and scaffold the pages you want to customise. It is quick, but in an MVC app many teams prefer their own controllers so the account pages match the rest of the site. This topic showed the controller route because it makes the pieces visible.

## Customising the user

Because `ApplicationUser` is your class, you can add properties and relationships:

```csharp
public class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = "";
    public DateTime JoinedOn { get; set; } = DateTime.UtcNow;
    public List<Order> Orders { get; set; } = new();
}
```

Add a migration after each change. The `Order` entity gets a `string UserId` foreign key, because Identity uses string keys by default.

## Quick recap

- Identity provides users, roles, password hashing, lockout, tokens and a database store so you do not build them yourself.
- Subclass `IdentityUser`, inherit your context from `IdentityDbContext`, and call `AddIdentity` with `AddEntityFrameworkStores`.
- `UserManager` creates users and manages roles and tokens. `SignInManager` signs in, signs out and handles lockout.
- `PasswordSignInAsync` does password checking, lockout and cookie writing in one call.
- Create roles in a seeder and assign them with `AddToRoleAsync`.
- Password reset and email confirmation are generate token, send link, verify token.

<code id="code-content" class="language-csharp">
// Models/ApplicationUser.cs
using Microsoft.AspNetCore.Identity;

public class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = "";
    public DateTime JoinedOn { get; set; } = DateTime.UtcNow;
}

// Data/AppDbContext.cs
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;

public class AppDbContext : IdentityDbContext&lt;ApplicationUser&gt;
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; options) : base(options) { }
    public DbSet&lt;Product&gt; Products =&gt; Set&lt;Product&gt;();
}

// Program.cs
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt;
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddIdentity&lt;ApplicationUser, IdentityRole&gt;(options =&gt;
{
    options.Password.RequiredLength = 8;
    options.Password.RequireNonAlphanumeric = false;
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores&lt;AppDbContext&gt;()
.AddDefaultTokenProviders();

builder.Services.ConfigureApplicationCookie(o =&gt;
{
    o.LoginPath = "/Account/Login";
    o.AccessDeniedPath = "/Account/Denied";
});

var app = builder.Build();
// ... UseRouting, UseAuthentication, UseAuthorization, MapControllerRoute

// Data/IdentitySeeder.cs
public static class IdentitySeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        var roles = services.GetRequiredService&lt;RoleManager&lt;IdentityRole&gt;&gt;();
        var users = services.GetRequiredService&lt;UserManager&lt;ApplicationUser&gt;&gt;();

        foreach (var role in new[] { "Admin", "Customer" })
        {
            if (!await roles.RoleExistsAsync(role))
                await roles.CreateAsync(new IdentityRole(role));
        }

        var admin = await users.FindByEmailAsync("admin@shop.com");
        if (admin is null)
        {
            admin = new ApplicationUser { UserName = "admin@shop.com", Email = "admin@shop.com", DisplayName = "Admin" };
            await users.CreateAsync(admin, "ChangeMe123");
            await users.AddToRoleAsync(admin, "Admin");
        }
    }
}

// Controllers/AccountController.cs
public class AccountController : Controller
{
    private readonly UserManager&lt;ApplicationUser&gt; _userManager;
    private readonly SignInManager&lt;ApplicationUser&gt; _signInManager;

    public AccountController(UserManager&lt;ApplicationUser&gt; userManager, SignInManager&lt;ApplicationUser&gt; signInManager)
    {
        _userManager = userManager;
        _signInManager = signInManager;
    }

    [HttpGet] public IActionResult Register() =&gt; View(new RegisterViewModel());

    [HttpPost, ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; Register(RegisterViewModel vm)
    {
        if (!ModelState.IsValid) return View(vm);

        var user = new ApplicationUser { UserName = vm.Email, Email = vm.Email, DisplayName = vm.DisplayName };
        var result = await _userManager.CreateAsync(user, vm.Password);

        if (!result.Succeeded)
        {
            foreach (var e in result.Errors) ModelState.AddModelError("", e.Description);
            return View(vm);
        }

        await _userManager.AddToRoleAsync(user, "Customer");
        await _signInManager.SignInAsync(user, isPersistent: false);
        return RedirectToAction("Index", "Home");
    }

    [HttpGet] public IActionResult Login(string? returnUrl) =&gt; View(new LoginViewModel { ReturnUrl = returnUrl });

    [HttpPost, ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; Login(LoginViewModel vm)
    {
        if (!ModelState.IsValid) return View(vm);

        var result = await _signInManager.PasswordSignInAsync(vm.Email, vm.Password, vm.RememberMe, lockoutOnFailure: true);

        if (result.Succeeded) return LocalRedirect(vm.ReturnUrl ?? "/");
        if (result.IsLockedOut) ModelState.AddModelError("", "Account locked. Try again in 15 minutes.");
        else ModelState.AddModelError("", "Invalid email or password.");
        return View(vm);
    }

    [HttpPost, ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; Logout()
    {
        await _signInManager.SignOutAsync();
        return RedirectToAction("Index", "Home");
    }

    [HttpPost, ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; ForgotPassword(string email, [FromServices] IEmailSender emailSender)
    {
        var user = await _userManager.FindByEmailAsync(email);
        if (user is not null)
        {
            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var link = Url.Action("ResetPassword", "Account", new { email, token }, Request.Scheme);
            await emailSender.SendAsync(email, "Reset your password", $"Reset here: {link}");
        }
        return View("ForgotPasswordSent");   // same response whether or not the email exists
    }

    [HttpPost, ValidateAntiForgeryToken]
    public async Task&lt;IActionResult&gt; ResetPassword(ResetPasswordViewModel vm)
    {
        var user = await _userManager.FindByEmailAsync(vm.Email);
        if (user is null) return RedirectToAction("Login");

        var result = await _userManager.ResetPasswordAsync(user, vm.Token, vm.NewPassword);
        if (!result.Succeeded)
        {
            foreach (var e in result.Errors) ModelState.AddModelError("", e.Description);
            return View(vm);
        }
        return RedirectToAction("Login");
    }
}
</code></pre>
