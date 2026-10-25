---
publishDate: 2026-09-18T15:10
title: Role Based Authorization
slug: role-based-authorization
metadescription: Protect endpoints by role with the Authorize attribute, put roles into a JWT correctly, combine roles with AND and OR, and know when roles stop being enough.
updateDate: 2026-09-07T15:10
author: ['bishal-biswas']
level: 3
tags: ['authorization', 'roles', 'security']
course: dotnet-webapi
---

## What a role is

A **role** is a label on a user. Admin, Editor, Support, Customer. It is the simplest form of authorization and the one every team starts with.

In ASP.NET Core a role is just a claim with the type `role`. `User.IsInRole("Admin")` looks through the claims for one with that type and value.

## Requiring a role

```csharp
[HttpDelete("{id:int}")]
[Authorize(Roles = "Admin")]
public IActionResult Delete(int id) => NoContent();
```

A valid token without the `Admin` role now gets `403 Forbidden`. No token at all gets `401 Unauthorized`.

## OR versus AND

Commas in one attribute mean **any of these**:

```csharp
[Authorize(Roles = "Admin,Editor")]        // Admin OR Editor
public IActionResult Publish() => Ok();
```

Stacking attributes means **all of these**:

```csharp
[Authorize(Roles = "Editor")]
[Authorize(Roles = "Verified")]            // Editor AND Verified
public IActionResult Approve() => Ok();
```

That difference is easy to get backwards, and getting it backwards on a delete endpoint is expensive. Write a test for anything important.

## Roles on a controller

Apply once and every action inherits it:

```csharp
[ApiController]
[Route("api/admin/[controller]")]
[Authorize(Roles = "Admin")]
public class UsersController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll() => Ok();          // Admin only

    [HttpGet("public-stats")]
    [AllowAnonymous]                                 // the exception
    public IActionResult Stats() => Ok();
}
```

Note what happens when you combine attributes at both levels. A controller with `[Authorize(Roles = "Admin")]` and an action with `[Authorize(Roles = "Editor")]` requires **both**, because the attributes stack rather than override. An Editor who is not an Admin is refused. This surprises people.

## Getting roles into the token

A role in your database does nothing unless it reaches the token. Add one claim per role:

```csharp
var claims = new List<Claim>
{
    new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
    new(JwtRegisteredClaimNames.Email, user.Email)
};

foreach (string role in user.Roles)
    claims.Add(new Claim(ClaimTypes.Role, role));
```

The decoded payload then carries an array:

```json
{
  "sub": "42",
  "email": "asha@example.com",
  "role": ["Editor", "Reviewer"]
}
```

## Telling the framework which claim is the role

This is the most common reason `[Authorize(Roles = "Admin")]` returns `403` for a user who clearly has the role.

`User.IsInRole` looks for a specific claim type, and by default that is the long URI `http://schemas.microsoft.com/ws/2008/06/identity/claims/role`. If your token uses the short name `role`, nothing matches.

Tell the validator which claim to use:

```csharp
options.TokenValidationParameters = new TokenValidationParameters
{
    RoleClaimType = "role",             // or ClaimTypes.Role if you kept the mapping
    NameClaimType = "name",
    // ...
};
```

Debug it by printing every claim. The problem is almost always the claim **type**, not the value:

```csharp
[HttpGet("debug/claims")]
[Authorize]
public IActionResult Claims() =>
    Ok(User.Claims.Select(c => new { c.Type, c.Value }));
```

## Roles in an authorization policy

Instead of repeating role strings across the codebase, name the rule once:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireAdmin", policy => policy.RequireRole("Admin"));
    options.AddPolicy("CanPublish", policy => policy.RequireRole("Admin", "Editor"));
    options.AddPolicy("CanApprove", policy =>
    {
        policy.RequireRole("Editor");
        policy.RequireClaim("verified", "true");     // role AND claim
    });
});
```

```csharp
[Authorize(Policy = "CanPublish")]
public IActionResult Publish() => Ok();
```

Three real advantages. The rule lives in one place, so changing who can publish is a one line edit. The endpoint says **what** is being permitted rather than who happens to hold the role today. And a policy can combine roles with claims and custom logic, which the attribute cannot.

Use policies by default. Reach for `[Authorize(Roles = "...")]` only for something genuinely simple.

## Checking a role in code

When the decision depends on data:

```csharp
[HttpGet("{id:int}")]
[Authorize]
public async Task<IActionResult> GetById(int id)
{
    Order? order = await db.Orders.FindAsync(id);
    if (order is null) return NotFound();

    string? userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    // Admins see anything, everyone else sees only their own
    if (!User.IsInRole("Admin") && order.CustomerId.ToString() != userId)
        return Forbid();

    return Ok(order);
}
```

A useful habit: return `404` rather than `403` when even the existence of the record is private. A `403` confirms that order 5001 exists, which is sometimes information you do not want to give away.

## Roles as constants

Magic strings are typos waiting to happen, and a typo here silently locks people out or lets them in:

```csharp
public static class Roles
{
    public const string Admin = "Admin";
    public const string Editor = "Editor";
    public const string Support = "Support";
}
```

```csharp
[Authorize(Roles = Roles.Admin)]
```

The compiler now catches mistakes, and renaming a role is a refactor rather than a search.

## Where roles run out

Roles work well until they do not, and the signals are recognisable.

**Role explosion.** You start with Admin and Editor. Then you need an editor who can only work on one category, and one who can publish but not delete. Soon you have `SeniorEditorCategoryB` and nobody can explain the difference between two of them.

**Rules that depend on the record.** "A user may edit their own post" is not a role question. No label on the user can answer it, because the answer depends on which post.

**Rules that depend on data.** "A manager may approve expenses up to their limit" needs the amount and the limit.

**Rules that change without a deployment.** Roles are compiled into attributes. Changing who can do what means a release.

When you hit these, move to **policy based authorization** with requirements and handlers. That is the next topic, and it handles all four cases.

## Managing roles

Roles need administration eventually: assigning them, listing them, auditing them. Two options.

**Store them yourself**, as a `UserRoles` join table. Simple, and entirely under your control.

**Use ASP.NET Core Identity**, which ships with `AspNetRoles` and `AspNetUserRoles` plus a `RoleManager` API. That is the topic after next.

Either way, one rule: roles are assigned **server side** and read from the database when the token is issued. A client must never be able to influence which roles land in its own token.

## Quick recap

- A role is a claim with the type `role`. `[Authorize(Roles = "Admin")]` requires it.
- Commas mean OR. Stacked attributes mean AND. Attributes on a controller and an action also stack.
- Add one `ClaimTypes.Role` claim per role when issuing the token.
- Set `RoleClaimType` to match your token, or `IsInRole` silently fails.
- Prefer named policies over role strings. They centralise the rule and describe intent.
- Use constants instead of magic strings for role names.
- Return `404` instead of `403` when the existence of a record is itself private.
- Roles cannot express per record or data dependent rules. That is when you move to policies.
- Roles are always assigned server side. Never let a client choose its own.

<code id="code-content" class="language-csharp">
// Role based authorization, with the claim type trap handled.
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =&gt;
    {
        options.MapInboundClaims = false;                  // keep the short names
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,  ValidIssuer   = "BookStoreApi",
            ValidateAudience = true, ValidAudience = "BookStoreClients",
            ValidateLifetime = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes("a-development-signing-key-at-least-32-chars")),
            // THE trap. IsInRole looks for THIS claim type. If your token says "role"
            // and this says the long Microsoft URI, every role check silently fails.
            RoleClaimType = "role",
            NameClaimType = "name"
        };
    });
// Named policies: the rule lives in one place, and the endpoint says WHAT it permits
builder.Services.AddAuthorization(options =&gt;
{
    options.AddPolicy(Policies.RequireAdmin, p =&gt; p.RequireRole(Roles.Admin));
    options.AddPolicy(Policies.CanPublish,   p =&gt; p.RequireRole(Roles.Admin, Roles.Editor));  // OR
    options.AddPolicy(Policies.CanApprove,   p =&gt;
    {
        p.RequireRole(Roles.Editor);                       // role AND claim,
        p.RequireClaim("verified", "true");                // which an attribute cannot express
    });
});
var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
// Constants, so a typo is a compile error rather than a silent lockout
public static class Roles
{
    public const string Admin   = "Admin";
    public const string Editor  = "Editor";
    public const string Support = "Support";
}
public static class Policies
{
    public const string RequireAdmin = "RequireAdmin";
    public const string CanPublish   = "CanPublish";
    public const string CanApprove   = "CanApprove";
}
[ApiController]
[Route("api/[controller]")]
public class ArticlesController : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public IActionResult GetAll() =&gt; Ok(new[] { "Article 1" });
    // Simple and direct
    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public IActionResult Delete(int id) =&gt; NoContent();
    // Commas mean OR: Admin or Editor gets through
    [HttpPost("{id:int}/publish")]
    [Authorize(Roles = Roles.Admin + "," + Roles.Editor)]
    public IActionResult Publish(int id) =&gt; Ok();
    // Stacked attributes mean AND: BOTH roles are required.
    // Easy to get backwards, so test anything that matters.
    [HttpPost("{id:int}/archive")]
    [Authorize(Roles = Roles.Editor)]
    [Authorize(Roles = Roles.Support)]
    public IActionResult Archive(int id) =&gt; Ok();
    // The same rules, named. Change who can publish in one place.
    [HttpPost("{id:int}/publish-v2")]
    [Authorize(Policy = Policies.CanPublish)]
    public IActionResult PublishV2(int id) =&gt; Ok();
    [HttpPost("{id:int}/approve")]
    [Authorize(Policy = Policies.CanApprove)]
    public IActionResult Approve(int id) =&gt; Ok();
    // A decision that depends on the record: no role can express this on its own
    [HttpGet("{id:int}")]
    [Authorize]
    public IActionResult GetById(int id)
    {
        var article = new { Id = id, AuthorId = "42", Title = "Draft" };
        string? userId = User.FindFirst("sub")?.Value;
        if (!User.IsInRole(Roles.Admin) &amp;&amp; article.AuthorId != userId)
            return NotFound();   // 404, not 403: a 403 confirms the article exists
        return Ok(article);
    }
    // When a role check "does not work", print the claims. It is nearly always
    // the claim TYPE that is wrong, not the value.
    [HttpGet("debug/claims")]
    [Authorize]
    public IActionResult DebugClaims() =&gt; Ok(new
    {
        roleClaimType = ClaimsIdentity.DefaultRoleClaimType,
        isAdmin       = User.IsInRole(Roles.Admin),
        claims        = User.Claims.Select(c =&gt; new { c.Type, c.Value })
    });
}
public class TokenService
{
    public string Create(User user)
    {
        var claims = new List&lt;Claim&gt;
        {
            new(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("name", user.DisplayName)
        };
        // One claim per role. Roles come from the DATABASE, never from the client.
        // The token then carries: "role": ["Editor", "Reviewer"]
        claims.AddRange(user.Roles.Select(r =&gt; new Claim("role", r)));
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes("a-development-signing-key-at-least-32-chars")),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken("BookStoreApi", "BookStoreClients", claims,
            expires: DateTime.UtcNow.AddMinutes(15), signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public List&lt;string&gt; Roles { get; set; } = new();
}
</code></pre>
