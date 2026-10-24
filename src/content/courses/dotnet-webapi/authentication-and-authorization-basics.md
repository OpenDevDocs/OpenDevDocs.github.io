---
publishDate: 2026-09-17T14:40
title: Authentication and Authorization Basics
slug: authentication-and-authorization-basics
metadescription: Understand the difference between authentication and authorization, learn what claims and schemes are, and use the Authorize and AllowAnonymous attributes correctly.
updateDate: 2026-09-07T14:40
author: ['bishal-biswas']
level: 2
tags: ['authentication', 'authorization', 'security']
course: dotnet-webapi
---

## Two different questions

**Authentication** asks: who are you? It checks a credential and produces an identity.

**Authorization** asks: are you allowed to do this? It checks that identity against a rule.

Authentication comes first, always. You cannot decide what someone may do until you know who they are.

The HTTP status codes mirror this exactly:

- **`401 Unauthorized`** means authentication failed. Despite the name, it means unauthenticated. Log in.
- **`403 Forbidden`** means authentication succeeded but authorization failed. Logging in again will not help.

## Claims

Once authentication succeeds, the framework builds a **`ClaimsPrincipal`** and puts it on `context.User`. That object is the answer to "who is this?".

A **claim** is a name and value pair stating something about the user:

```text
sub                    42
email                  asha@example.com
name                   Asha Rao
role                   Editor
role                   Reviewer
department             Engineering
```

Two things to notice. A claim can appear more than once, which is how a user has several roles. And the claim is only a statement, trusted because the token it came from was signed by someone you trust.

Read claims from `User`:

```csharp
[HttpGet("me")]
[Authorize]
public IActionResult Me()
{
    string? id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    string? email = User.FindFirst(ClaimTypes.Email)?.Value;
    string? name = User.Identity?.Name;

    bool isEditor = User.IsInRole("Editor");
    List<string> roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();

    return Ok(new { id, email, name, isEditor, roles });
}
```

## The claim type name confusion

This catches everyone once. A JWT carries short claim names such as `sub`, `email` and `role`. By default, ASP.NET Core **maps** them to long URI style names:

```text
sub    ->  http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier
email  ->  http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress
role   ->  http://schemas.microsoft.com/ws/2008/06/identity/claims/role
```

So `User.FindFirst("sub")` returns null while `User.FindFirst(ClaimTypes.NameIdentifier)` works. Either use the `ClaimTypes` constants, or turn the mapping off so the short names survive:

```csharp
JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();
```

Pick one approach and be consistent, or you will spend an afternoon on a null claim.

## Schemes

A **scheme** is a named way of authenticating. Each has a handler that knows how to read a credential.

```csharp
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => { /* ... */ });
```

Common schemes:

- **JWT Bearer**, a signed token in the `Authorization` header. The standard for APIs.
- **Cookie**, a session cookie. Right for a server rendered site, awkward for an API.
- **API key**, a shared secret in a header. Simple, and only suitable for machine to machine.
- **OAuth and OpenID Connect**, delegating login to Google, Microsoft or an identity provider.

The argument to `AddAuthentication` names the **default** scheme, used when an endpoint does not say otherwise.

You can register several and choose per endpoint:

```csharp
[Authorize(AuthenticationSchemes = "ApiKey")]
public class WebhooksController : ControllerBase { }
```

## Turning it on

Two service registrations and two middleware calls:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => { /* validation settings */ });

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseAuthentication();   // reads the credential, builds context.User
app.UseAuthorization();    // enforces [Authorize] on the matched endpoint
```

**The order is not optional.** `UseAuthentication` must come first. Reverse them and authorization sees an empty user, so every authenticated request is rejected.

Both must also come **after** `UseRouting`, because authorization needs to know which endpoint matched in order to read its attributes.

## The Authorize attribute

On an action:

```csharp
[HttpDelete("{id:int}")]
[Authorize]
public IActionResult Delete(int id) => NoContent();
```

On a controller, applying to every action in it:

```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdersController : ControllerBase { }
```

`[AllowAnonymous]` carves out an exception, and it **always wins** over `[Authorize]`:

```csharp
[Authorize]
public class AccountController : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]                 // must be reachable without a token
    public IActionResult Login(LoginRequest request) => Ok();

    [HttpGet("profile")]              // still requires authentication
    public IActionResult Profile() => Ok();
}
```

That "always wins" rule is worth remembering, because it is also the risk. An `[AllowAnonymous]` left on an endpoint during debugging opens it completely, and no global policy will close it.

## Secure by default

Requiring a token on every endpoint and opting out explicitly is safer than the reverse. Forget an `[Authorize]` and an endpoint is public. Forget an `[AllowAnonymous]` and it merely returns `401`, which someone will notice immediately.

Set a fallback policy:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});
```

The fallback applies to any endpoint with **no** authorization attribute at all. Add `[AllowAnonymous]` to login, registration, health checks and Swagger.

Do not confuse it with `DefaultPolicy`, which is what a bare `[Authorize]` means.

## Requiring a role

The quickest form of authorization:

```csharp
[Authorize(Roles = "Admin")]
public IActionResult DeleteEverything() => Ok();

[Authorize(Roles = "Admin,Editor")]        // either role, OR
public IActionResult Publish() => Ok();
```

Stacking the attribute means AND:

```csharp
[Authorize(Roles = "Editor")]
[Authorize(Roles = "Verified")]            // needs BOTH
public IActionResult Approve() => Ok();
```

Roles get their own topic, along with why policies are usually the better tool.

## Checking authorization in code

Sometimes the rule depends on data you only have at runtime, such as whether this user owns this record:

```csharp
public class BooksController : ControllerBase
{
    private readonly IAuthorizationService authorization;

    [HttpPut("{id:int}")]
    [Authorize]
    public async Task<IActionResult> Update(int id, UpdateBookRequest request)
    {
        Book? book = await db.Books.FindAsync(id);
        if (book is null) return NotFound();

        AuthorizationResult result =
            await authorization.AuthorizeAsync(User, book, "MustOwnBook");

        if (!result.Succeeded) return Forbid();

        // ...
        return NoContent();
    }
}
```

This is **resource based authorization**, and it is the only way to express rules that depend on the specific record. Attributes are evaluated before the record is loaded, so they cannot do it.

## Checking without the service

For simple checks inside an action:

```csharp
if (!User.Identity?.IsAuthenticated ?? true)
    return Unauthorized();

if (!User.IsInRole("Admin"))
    return Forbid();

string? userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
if (book.OwnerId != userId)
    return Forbid();
```

Use `Forbid()` and `Unauthorized()` rather than `StatusCode(403)`. They go through the authentication scheme, which lets it add the right headers.

## Getting the current user elsewhere

`User` is available on a controller. In a service, inject `IHttpContextAccessor`:

```csharp
builder.Services.AddHttpContextAccessor();
```

```csharp
public class CurrentUserService : ICurrentUser
{
    private readonly IHttpContextAccessor accessor;

    public CurrentUserService(IHttpContextAccessor accessor) => this.accessor = accessor;

    public string? UserId =>
        accessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    public bool IsAuthenticated =>
        accessor.HttpContext?.User.Identity?.IsAuthenticated ?? false;
}
```

Wrapping it in your own interface is worth the extra file. Your services then depend on `ICurrentUser` rather than on HTTP, which keeps them testable.

## Never trust a claim you did not verify

The claims in `User` are trustworthy because the middleware verified the token's signature first. A value the client sends any other way is not.

```csharp
// Never do this
string userId = Request.Headers["X-User-Id"]!;      // the client can write anything

// Do this
string userId = User.FindFirst(ClaimTypes.NameIdentifier)!.Value;
```

The same applies to a user id in the URL or the body. If a request says "update user 5" and the token says the caller is user 9, the answer is `403`, not an update.

## Quick recap

- Authentication proves who you are. Authorization decides what you may do.
- `401` means not authenticated. `403` means authenticated but not allowed.
- Authentication produces a `ClaimsPrincipal` on `context.User`, made of claims.
- Short JWT claim names are remapped to long URIs by default. Use `ClaimTypes` or clear the map.
- A scheme is a named authentication method. JWT bearer is the standard for APIs.
- `UseAuthentication` must come before `UseAuthorization`, and both after `UseRouting`.
- `[AllowAnonymous]` always beats `[Authorize]`, so a stray one opens an endpoint completely.
- Set a `FallbackPolicy` so endpoints are protected unless you opt out.
- Use `IAuthorizationService` for rules that depend on the specific record.
- Trust claims from the verified token, never a user id from a header, URL or body.

<code id="code-content" class="language-csharp">
// Authentication and authorization wired up, with the ordering and defaults that matter.
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped&lt;ICurrentUser, CurrentUserService&gt;();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)   // the default scheme
    .AddJwtBearer(options =&gt;
    {
        // Full token validation settings are covered in the JWT topic
        options.MapInboundClaims = false;    // keep short names: sub, email, role
    });
builder.Services.AddAuthorization(options =&gt;
{
    // Secure by default: any endpoint with NO authorization attribute requires a
    // logged in user. Forgetting [Authorize] now returns 401 instead of leaking data.
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});
var app = builder.Build();
app.UseRouting();
app.UseAuthentication();     // WHO: reads the token, builds context.User
app.UseAuthorization();      // WHAT: enforces the attributes on the matched endpoint
                             // Swap these two and every request fails with 403.
app.MapControllers();
app.Run();
[ApiController]
[Route("api/[controller]")]
[Authorize]                                    // every action here needs a token
public class AccountController : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]                           // always wins over [Authorize]
    public IActionResult Login([FromBody] LoginRequest request) =&gt;
        Ok(new { token = "..." });
    // Reading the identity that UseAuthentication built
    [HttpGet("me")]
    public IActionResult Me()
    {
        // With MapInboundClaims = false these short names work.
        // Leave mapping on and you need ClaimTypes.NameIdentifier instead.
        string? id    = User.FindFirst("sub")?.Value;
        string? email = User.FindFirst("email")?.Value;
        return Ok(new
        {
            id,
            email,
            name          = User.Identity?.Name,
            authenticated = User.Identity?.IsAuthenticated ?? false,
            scheme        = User.Identity?.AuthenticationType,
            roles         = User.FindAll("role").Select(c =&gt; c.Value).ToArray(),
            isAdmin       = User.IsInRole("Admin")
        });
    }
}
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private readonly IAuthorizationService authorization;
    private readonly ICurrentUser currentUser;
    public BooksController(IAuthorizationService authorization, ICurrentUser currentUser)
        =&gt; (this.authorization, this.currentUser) = (authorization, currentUser);
    [HttpGet]
    [AllowAnonymous]                           // public, despite the fallback policy
    public IActionResult GetAll() =&gt; Ok(new[] { "Clean Code" });
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]               // 403 for a valid token without the role
    public IActionResult Delete(int id) =&gt; NoContent();
    [HttpPut("{id:int}")]
    public async Task&lt;IActionResult&gt; Update(int id, [FromBody] UpdateBookRequest request)
    {
        var book = new Book { Id = id, OwnerId = "42" };   // pretend this came from the database
        // Resource based: the rule depends on THIS record, so an attribute cannot express it.
        // Attributes run before the record is loaded.
        AuthorizationResult result = await authorization.AuthorizeAsync(User, book, "MustOwnBook");
        if (!result.Succeeded) return Forbid();
        // Never trust an id the client supplied. Trust only the verified token.
        // string userId = Request.Headers["X-User-Id"]!;   // the client can write anything
        string? userId = currentUser.UserId;                // came from a signed token
        return NoContent();
    }
}
// Wrapping HttpContext in your own interface keeps services testable and HTTP free
public interface ICurrentUser
{
    string? UserId { get; }
    bool IsAuthenticated { get; }
    bool IsInRole(string role);
}
public class CurrentUserService : ICurrentUser
{
    private readonly IHttpContextAccessor accessor;
    public CurrentUserService(IHttpContextAccessor accessor) =&gt; this.accessor = accessor;
    private ClaimsPrincipal? User =&gt; accessor.HttpContext?.User;
    public string? UserId =&gt; User?.FindFirst("sub")?.Value
                          ?? User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    public bool IsAuthenticated =&gt; User?.Identity?.IsAuthenticated ?? false;
    public bool IsInRole(string role) =&gt; User?.IsInRole(role) ?? false;
}
public record LoginRequest(string Email, string Password);
public record UpdateBookRequest(string Title);
public class Book { public int Id { get; set; } public string OwnerId { get; set; } = ""; }
</code></pre>
