---
publishDate: 2026-09-19T15:30
title: ASP.NET Core Identity
slug: aspnet-core-identity
metadescription: Use ASP.NET Core Identity for user accounts, password hashing, roles, email confirmation and lockout, and combine it with JWT tokens in an API.
updateDate: 2026-09-07T15:30
author: ['bishal-biswas']
level: 3
tags: ['identity', 'authentication', 'users']
course: dotnet-webapi
---

## What Identity gives you

Rolling your own user system means writing password hashing, lockout after failed attempts, email confirmation, password reset, two factor authentication and role management. Each is easy to get subtly wrong, and each one is a security hole when you do.

**ASP.NET Core Identity** ships all of it: the entity model, the database schema, `UserManager` and `RoleManager` APIs, secure hashing with PBKDF2, token generation for confirmation and reset flows, and lockout.

It is worth using unless you have a specific reason not to.

## Installing

```bash
dotnet add package Microsoft.AspNetCore.Identity.EntityFrameworkCore
```

## Your user class

Inherit from `IdentityUser` and add whatever you need:

```csharp
public class AppUser : IdentityUser
{
    public string DisplayName { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? AvatarUrl { get; set; }
}
```

`IdentityUser` already has `Id`, `UserName`, `Email`, `EmailConfirmed`, `PasswordHash`, `PhoneNumber`, `TwoFactorEnabled`, `LockoutEnd`, `AccessFailedCount` and `SecurityStamp`.

The `Id` is a `string` holding a GUID by default. You can use `int` with `IdentityUser<int>`, but the string default is fine and avoids fighting the framework.

## Your DbContext

Inherit from `IdentityDbContext` instead of `DbContext`:

```csharp
public class AppDbContext : IdentityDbContext<AppUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Book> Books => Set<Book>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);      // required: configures the Identity tables

        builder.Entity<AppUser>()
               .Property(u => u.DisplayName)
               .HasMaxLength(100);
    }
}
```

Forgetting `base.OnModelCreating(builder)` is a common mistake. The Identity tables silently do not get configured.

Seven tables are created: `AspNetUsers`, `AspNetRoles`, `AspNetUserRoles`, `AspNetUserClaims`, `AspNetUserLogins`, `AspNetUserTokens` and `AspNetRoleClaims`.

## Registering

```csharp
builder.Services
    .AddIdentityCore<AppUser>(options =>
    {
        options.Password.RequiredLength = 8;
        options.Password.RequireDigit = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireNonAlphanumeric = false;

        options.User.RequireUniqueEmail = true;

        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);

        options.SignIn.RequireConfirmedEmail = true;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();
```

**Use `AddIdentityCore`, not `AddIdentity`, in an API.** `AddIdentity` sets up cookie authentication and redirects unauthenticated requests to a login page that does not exist. Your API would return `302` to `/Account/Login` instead of `401`. `AddIdentityCore` gives you the managers without the cookie machinery.

`AddDefaultTokenProviders` is what generates the tokens for email confirmation, password reset and two factor. Without it those calls throw.

Then add JWT separately, exactly as in the JWT topic:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => { /* validation */ });
```

## Registering a user

```csharp
[HttpPost("register")]
[AllowAnonymous]
public async Task<IActionResult> Register(RegisterRequest request)
{
    var user = new AppUser
    {
        UserName = request.Email,
        Email = request.Email,
        DisplayName = request.DisplayName
    };

    IdentityResult result = await userManager.CreateAsync(user, request.Password);

    if (!result.Succeeded)
        return BadRequest(new
        {
            errors = result.Errors.Select(e => new { e.Code, e.Description })
        });

    await userManager.AddToRoleAsync(user, "Customer");

    string token = await userManager.GenerateEmailConfirmationTokenAsync(user);
    await emailSender.SendConfirmationAsync(user.Email!, token);

    return Ok(new { message = "Check your email to confirm your account." });
}
```

`CreateAsync` hashes the password, enforces your password rules, and checks that the email is unique. You never touch a hash yourself.

`IdentityResult.Errors` gives structured codes such as `PasswordTooShort` and `DuplicateEmail`, which clients can act on.

## Logging in and issuing a JWT

Identity checks the credentials, you issue the token:

```csharp
[HttpPost("login")]
[AllowAnonymous]
public async Task<IActionResult> Login(LoginRequest request)
{
    AppUser? user = await userManager.FindByEmailAsync(request.Email);

    if (user is null)
        return Unauthorized(new { error = "Invalid email or password." });

    if (await userManager.IsLockedOutAsync(user))
        return Unauthorized(new { error = "Account locked. Try again later." });

    // lockoutOnFailure: true is what makes the lockout policy actually work
    bool valid = await userManager.CheckPasswordAsync(user, request.Password);

    if (!valid)
    {
        await userManager.AccessFailedAsync(user);
        return Unauthorized(new { error = "Invalid email or password." });
    }

    if (!await userManager.IsEmailConfirmedAsync(user))
        return Unauthorized(new { error = "Please confirm your email first." });

    await userManager.ResetAccessFailedCountAsync(user);

    IList<string> roles = await userManager.GetRolesAsync(user);

    return Ok(new { accessToken = tokenService.Create(user, roles) });
}
```

Two details worth copying. Call `AccessFailedAsync` on a wrong password, or the lockout counter never increments and the policy does nothing. And return the same message for an unknown email and a wrong password, so nobody can enumerate your users.

## Putting Identity data in the token

```csharp
public string Create(AppUser user, IList<string> roles)
{
    var claims = new List<Claim>
    {
        new(JwtRegisteredClaimNames.Sub, user.Id),
        new(JwtRegisteredClaimNames.Email, user.Email!),
        new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        new("name", user.DisplayName)
    };

    claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

    // Identity's own claims for this user, added through UserManager.AddClaimAsync
    // are fetched separately if you want them in the token.

    // ... sign and return
}
```

## Email confirmation and password reset

Both follow the same shape: generate a token, email a link, verify the token.

```csharp
[HttpGet("confirm-email")]
[AllowAnonymous]
public async Task<IActionResult> ConfirmEmail(string userId, string token)
{
    AppUser? user = await userManager.FindByIdAsync(userId);
    if (user is null) return NotFound();

    IdentityResult result = await userManager.ConfirmEmailAsync(user, token);

    return result.Succeeded
        ? Ok(new { message = "Email confirmed." })
        : BadRequest(new { error = "Invalid or expired token." });
}

[HttpPost("forgot-password")]
[AllowAnonymous]
public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
{
    AppUser? user = await userManager.FindByEmailAsync(request.Email);

    // Always the same answer, whether or not the account exists
    if (user is not null && await userManager.IsEmailConfirmedAsync(user))
    {
        string token = await userManager.GeneratePasswordResetTokenAsync(user);
        await emailSender.SendPasswordResetAsync(user.Email!, token);
    }

    return Ok(new { message = "If that email is registered, a reset link has been sent." });
}

[HttpPost("reset-password")]
[AllowAnonymous]
public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
{
    AppUser? user = await userManager.FindByEmailAsync(request.Email);
    if (user is null) return BadRequest(new { error = "Invalid request." });

    IdentityResult result =
        await userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);

    return result.Succeeded
        ? Ok(new { message = "Password changed." })
        : BadRequest(new { errors = result.Errors.Select(e => e.Description) });
}
```

**URL encode the token.** These tokens contain characters such as `+` that break in a query string. Encode when building the link and decode when reading it:

```csharp
string encoded = WebUtility.UrlEncode(token);
string link = $"https://app.example.com/confirm?userId={user.Id}&token={encoded}";
```

Forgetting this produces "invalid token" errors that are maddening to debug.

## Managing roles

```csharp
// Create roles once at startup
foreach (string role in new[] { "Admin", "Editor", "Customer" })
{
    if (!await roleManager.RoleExistsAsync(role))
        await roleManager.CreateAsync(new IdentityRole(role));
}

// Assign and remove
await userManager.AddToRoleAsync(user, "Editor");
await userManager.RemoveFromRoleAsync(user, "Editor");

// Query
IList<string> roles = await userManager.GetRolesAsync(user);
bool isAdmin = await userManager.IsInRoleAsync(user, "Admin");
IList<AppUser> admins = await userManager.GetUsersInRoleAsync("Admin");
```

Note the JWT consequence: changing a role does **not** change a token that is already issued. The user keeps the old roles until their token expires. Another reason to keep access tokens short.

## The security stamp

`SecurityStamp` is a value that changes whenever something security relevant changes: the password, the roles, the email. Cookie authentication revalidates against it automatically.

JWT does not. If you need "change password logs out every device", store the stamp as a claim and check it:

```csharp
new Claim("security_stamp", user.SecurityStamp!)
```

Then in a middleware or a filter, compare the claim against the current stamp and reject a mismatch. This costs a lookup per request, so only do it when you genuinely need that guarantee.

## Custom validation

Add your own rules by implementing a validator:

```csharp
public class NoCommonPasswordValidator : IPasswordValidator<AppUser>
{
    private static readonly HashSet<string> Banned =
        new(StringComparer.OrdinalIgnoreCase) { "password1", "qwerty123", "letmein1" };

    public Task<IdentityResult> ValidateAsync(
        UserManager<AppUser> manager, AppUser user, string? password)
    {
        if (password is not null && Banned.Contains(password))
            return Task.FromResult(IdentityResult.Failed(new IdentityError
            {
                Code = "CommonPassword",
                Description = "That password is too common."
            }));

        return Task.FromResult(IdentityResult.Success);
    }
}
```

```csharp
builder.Services.AddScoped<IPasswordValidator<AppUser>, NoCommonPasswordValidator>();
```

## Should you use it?

**Yes**, when you store your own users and need registration, login, password reset, roles and lockout. Writing that yourself is a lot of security sensitive code for no benefit.

**No**, when an external identity provider handles login. Auth0, Microsoft Entra ID, Okta, Firebase or Keycloak take on password storage, MFA and compliance. Your API then only validates tokens, which is much less to get wrong.

**Also no**, for a machine to machine API with no human users. API keys or client credentials are simpler.

## Quick recap

- Identity provides users, hashing, roles, claims, lockout, email confirmation and password reset.
- Inherit from `IdentityUser` and `IdentityDbContext`, and remember `base.OnModelCreating`.
- Use `AddIdentityCore`, not `AddIdentity`, or your API redirects instead of returning `401`.
- Add `AddDefaultTokenProviders` or confirmation and reset tokens throw.
- `CreateAsync` hashes and validates. You never handle a password hash yourself.
- Call `AccessFailedAsync` on a bad password, or lockout never triggers.
- Return the same message for unknown email and wrong password.
- URL encode confirmation and reset tokens, and decode them on the way back.
- A role change does not affect an already issued JWT. Keep access tokens short.
- Consider an external identity provider instead when you do not want to own passwords at all.

<code id="code-content" class="language-csharp">
// ASP.NET Core Identity in an API, issuing JWTs.
// dotnet add package Microsoft.AspNetCore.Identity.EntityFrameworkCore
using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt; o.UseSqlServer(
    builder.Configuration.GetConnectionString("Default")));
// AddIdentityCore, NOT AddIdentity. AddIdentity wires up cookie auth and would make
// this API answer 302 to /Account/Login instead of 401.
builder.Services
    .AddIdentityCore&lt;AppUser&gt;(options =&gt;
    {
        options.Password.RequiredLength         = 8;
        options.Password.RequireDigit           = true;
        options.Password.RequireUppercase       = true;
        options.Password.RequireNonAlphanumeric = false;
        options.User.RequireUniqueEmail         = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan  = TimeSpan.FromMinutes(15);
        options.SignIn.RequireConfirmedEmail    = true;
    })
    .AddRoles&lt;IdentityRole&gt;()
    .AddEntityFrameworkStores&lt;AppDbContext&gt;()
    .AddDefaultTokenProviders();          // without this, confirmation and reset tokens throw
builder.Services.AddScoped&lt;IPasswordValidator&lt;AppUser&gt;, NoCommonPasswordValidator&gt;();
builder.Services.AddSingleton&lt;TokenService&gt;();
// JWT is configured separately. Identity checks the credentials, JWT carries the session.
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddAuthorization();
var app = builder.Build();
// Create the roles once at startup
using (IServiceScope scope = app.Services.CreateScope())
{
    var roleManager = scope.ServiceProvider.GetRequiredService&lt;RoleManager&lt;IdentityRole&gt;&gt;();
    foreach (string role in new[] { "Admin", "Editor", "Customer" })
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole(role));
}
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
public class AppUser : IdentityUser              // Id, Email, PasswordHash, LockoutEnd and more
{
    public string DisplayName { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
public class AppDbContext : IdentityDbContext&lt;AppUser&gt;
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; options) : base(options) { }
    public DbSet&lt;Book&gt; Books =&gt; Set&lt;Book&gt;();
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);           // REQUIRED: configures the seven Identity tables
        builder.Entity&lt;AppUser&gt;().Property(u =&gt; u.DisplayName).HasMaxLength(100);
    }
}
[ApiController]
[Route("api/[controller]")]
public class AccountController : ControllerBase
{
    private readonly UserManager&lt;AppUser&gt; users;
    private readonly TokenService tokens;
    private readonly ILogger&lt;AccountController&gt; logger;
    public AccountController(UserManager&lt;AppUser&gt; users, TokenService tokens,
                             ILogger&lt;AccountController&gt; logger)
        =&gt; (this.users, this.tokens, this.logger) = (users, tokens, logger);
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task&lt;IActionResult&gt; Register([FromBody] RegisterRequest request)
    {
        var user = new AppUser
        {
            UserName    = request.Email,
            Email       = request.Email,
            DisplayName = request.DisplayName
        };
        // Hashes with PBKDF2, applies the password rules, enforces a unique email
        IdentityResult result = await users.CreateAsync(user, request.Password);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(e =&gt; new { e.Code, e.Description }) });
        await users.AddToRoleAsync(user, "Customer");
        string token = await users.GenerateEmailConfirmationTokenAsync(user);
        // URL encode it. These tokens contain '+' and break in a query string otherwise,
        // producing "invalid token" errors that are painful to diagnose.
        string link = $"https://app.example.com/confirm?userId={user.Id}&amp;token={WebUtility.UrlEncode(token)}";
        logger.LogInformation("Confirmation link for {Email}: {Link}", user.Email, link);
        return Ok(new { message = "Check your email to confirm your account." });
    }
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task&lt;IActionResult&gt; Login([FromBody] LoginRequest request)
    {
        AppUser? user = await users.FindByEmailAsync(request.Email);
        // The SAME message for every failure, so nobody can enumerate registered emails
        const string generic = "Invalid email or password.";
        if (user is null) return Unauthorized(new { error = generic });
        if (await users.IsLockedOutAsync(user))
            return Unauthorized(new { error = "Account locked. Try again in 15 minutes." });
        if (!await users.CheckPasswordAsync(user, request.Password))
        {
            // Without this the lockout counter never moves and the policy does nothing
            await users.AccessFailedAsync(user);
            return Unauthorized(new { error = generic });
        }
        if (!await users.IsEmailConfirmedAsync(user))
            return Unauthorized(new { error = "Please confirm your email first." });
        await users.ResetAccessFailedCountAsync(user);
        IList&lt;string&gt; roles = await users.GetRolesAsync(user);
        return Ok(new { accessToken = tokens.Create(user, roles), tokenType = "Bearer", expiresIn = 900 });
    }
    [HttpGet("confirm-email")]
    [AllowAnonymous]
    public async Task&lt;IActionResult&gt; ConfirmEmail([FromQuery] string userId, [FromQuery] string token)
    {
        AppUser? user = await users.FindByIdAsync(userId);
        if (user is null) return NotFound();
        IdentityResult result = await users.ConfirmEmailAsync(user, token);
        return result.Succeeded
            ? Ok(new { message = "Email confirmed. You can now sign in." })
            : BadRequest(new { error = "Invalid or expired confirmation token." });
    }
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task&lt;IActionResult&gt; ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        AppUser? user = await users.FindByEmailAsync(request.Email);
        if (user is not null &amp;&amp; await users.IsEmailConfirmedAsync(user))
        {
            string token = await users.GeneratePasswordResetTokenAsync(user);
            logger.LogInformation("Reset token for {Email}: {Token}", user.Email, WebUtility.UrlEncode(token));
        }
        // Always the same answer, whether or not the account exists
        return Ok(new { message = "If that email is registered, a reset link has been sent." });
    }
    [HttpPost("change-password")]
    [Authorize]
    public async Task&lt;IActionResult&gt; ChangePassword([FromBody] ChangePasswordRequest request)
    {
        AppUser? user = await users.GetUserAsync(User);
        if (user is null) return Unauthorized();
        IdentityResult result = await users.ChangePasswordAsync(
            user, request.CurrentPassword, request.NewPassword);
        // Changing the password rotates SecurityStamp, but an already issued JWT
        // keeps working until it expires. Another reason for a 15 minute lifetime.
        return result.Succeeded
            ? NoContent()
            : BadRequest(new { errors = result.Errors.Select(e =&gt; e.Description) });
    }
}
public class NoCommonPasswordValidator : IPasswordValidator&lt;AppUser&gt;
{
    private static readonly HashSet&lt;string&gt; Banned =
        new(StringComparer.OrdinalIgnoreCase) { "password1", "qwerty123", "letmein1", "welcome1" };
    public Task&lt;IdentityResult&gt; ValidateAsync(UserManager&lt;AppUser&gt; manager, AppUser user, string? password) =&gt;
        Task.FromResult(password is not null &amp;&amp; Banned.Contains(password)
            ? IdentityResult.Failed(new IdentityError
              { Code = "CommonPassword", Description = "That password is too common." })
            : IdentityResult.Success);
}
public class TokenService
{
    public string Create(AppUser user, IList&lt;string&gt; roles)
    {
        var claims = new List&lt;Claim&gt;
        {
            new("sub",   user.Id),
            new("email", user.Email!),
            new("name",  user.DisplayName),
            new("jti",   Guid.NewGuid().ToString())
        };
        claims.AddRange(roles.Select(r =&gt; new Claim("role", r)));
        return "signed.jwt.here";     // see the JWT topic for the signing code
    }
}
public record RegisterRequest(string Email, string Password, string DisplayName);
public record LoginRequest(string Email, string Password);
public record ForgotPasswordRequest(string Email);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public class Book { public int Id { get; set; } public string Title { get; set; } = ""; }
</code></pre>
