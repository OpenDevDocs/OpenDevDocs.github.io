---
publishDate: 2026-09-19T15:20
title: Policy Based Authorization
slug: policy-based-authorization
metadescription: Express authorization rules that roles cannot. Build policies from claims, write requirements and handlers, and authorize against a specific resource at runtime.
updateDate: 2026-09-07T15:20
author: ['bishal-biswas']
level: 3
tags: ['authorization', 'policies', 'security']
course: dotnet-webapi
---

## Why policies

Roles answer "who are you a member of". Plenty of real rules are not membership questions:

- A user may edit their **own** post.
- A manager may approve an expense **up to their limit**.
- Anyone over 18 may buy this.
- Only staff in the same **department** may see this record.

None of these fit in `[Authorize(Roles = "...")]`. A policy can express all of them.

A **policy** is a named set of **requirements**. Each requirement is checked by a **handler**. If every requirement succeeds, the policy succeeds.

## Simple policies from claims

The builder covers a lot without any custom code:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireAdmin", p => p.RequireRole("Admin"));

    options.AddPolicy("Verified", p => p.RequireClaim("email_verified", "true"));

    options.AddPolicy("Internal", p => p.RequireClaim("department", "Engineering", "Product"));

    options.AddPolicy("HasSubscription", p => p.RequireClaim("subscription"));

    options.AddPolicy("AnyLoggedIn", p => p.RequireAuthenticatedUser());

    // A lambda, for anything the builders do not cover
    options.AddPolicy("AtLeast18", p => p.RequireAssertion(context =>
    {
        Claim? dob = context.User.FindFirst("date_of_birth");
        if (dob is null || !DateTime.TryParse(dob.Value, out DateTime birthday))
            return false;

        return birthday <= DateTime.UtcNow.AddYears(-18);
    }));
});
```

```csharp
[Authorize(Policy = "AtLeast18")]
public IActionResult BuyWine() => Ok();
```

`RequireAssertion` is the quick escape hatch. It works, but the logic is stuck inside `Program.cs` and cannot be unit tested on its own. For anything important, write a requirement.

## Requirements and handlers

A **requirement** is a marker class holding the data the rule needs:

```csharp
public class MinimumAgeRequirement : IAuthorizationRequirement
{
    public int MinimumAge { get; }

    public MinimumAgeRequirement(int minimumAge) => MinimumAge = minimumAge;
}
```

A **handler** decides whether it is met:

```csharp
public class MinimumAgeHandler : AuthorizationHandler<MinimumAgeRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, MinimumAgeRequirement requirement)
    {
        Claim? dob = context.User.FindFirst("date_of_birth");

        if (dob is null || !DateTime.TryParse(dob.Value, out DateTime birthday))
            return Task.CompletedTask;         // not met, but do not block other handlers

        int age = DateTime.UtcNow.Year - birthday.Year;
        if (birthday > DateTime.UtcNow.AddYears(-age)) age--;

        if (age >= requirement.MinimumAge)
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
```

Register both:

```csharp
builder.Services.AddSingleton<IAuthorizationHandler, MinimumAgeHandler>();

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AtLeast18", p => p.Requirements.Add(new MinimumAgeRequirement(18)));
    options.AddPolicy("AtLeast21", p => p.Requirements.Add(new MinimumAgeRequirement(21)));
});
```

One handler, two policies. The requirement carries the parameter.

## Succeed, Fail and silence

Three outcomes, and the difference matters.

**`context.Succeed(requirement)`** marks that requirement as met.

**Doing nothing** means this handler could not satisfy it. Another handler still might.

**`context.Fail()`** vetoes the whole policy. Even if another handler succeeds, the result is a failure.

Default to silence rather than `Fail()`. Reserve `Fail()` for a hard block, such as an account being suspended, where no other rule should be able to override it.

## Several handlers for one requirement, meaning OR

Register two handlers for the same requirement and **either** succeeding is enough. This is how you express alternatives cleanly:

```csharp
// Met by owning the document
public class OwnerHandler : AuthorizationHandler<CanEditRequirement, Document>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, CanEditRequirement requirement, Document document)
    {
        if (document.OwnerId == context.User.FindFirst("sub")?.Value)
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}

// Or by being an administrator
public class AdminHandler : AuthorizationHandler<CanEditRequirement, Document>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, CanEditRequirement requirement, Document document)
    {
        if (context.User.IsInRole("Admin"))
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
```

Adding a third way to qualify is a new handler and one registration line. Nothing existing changes.

Note the contrast: several **requirements** in one policy are AND. Several **handlers** for one requirement are OR.

## Resource based authorization

The most useful thing policies give you. Attributes are evaluated before the record is loaded, so they can never answer "may this user edit **this** document". You have to authorize after loading it.

Note the second type argument on the handler above, `Document`. That is the resource.

In the controller, inject `IAuthorizationService`:

```csharp
[HttpPut("{id:int}")]
[Authorize]
public async Task<IActionResult> Update(int id, UpdateRequest request)
{
    Document? document = await db.Documents.FindAsync(id);
    if (document is null) return NotFound();

    AuthorizationResult result =
        await authorization.AuthorizeAsync(User, document, "CanEditDocument");

    if (!result.Succeeded)
        return User.Identity?.IsAuthenticated == true ? Forbid() : Challenge();

    // ...
    return NoContent();
}
```

`Forbid()` when they are logged in but not allowed, `Challenge()` when they are not logged in. `Challenge()` triggers the authentication scheme, which for JWT means a `401` with a `WWW-Authenticate` header.

## Handlers can use services

A handler is resolved from DI, so it can take dependencies:

```csharp
public class ApprovalLimitHandler : AuthorizationHandler<ApprovalLimitRequirement, Expense>
{
    private readonly AppDbContext db;

    public ApprovalLimitHandler(AppDbContext db) => this.db = db;

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, ApprovalLimitRequirement requirement, Expense expense)
    {
        string? userId = context.User.FindFirst("sub")?.Value;
        if (userId is null) return;

        decimal limit = await db.Users
            .Where(u => u.Id.ToString() == userId)
            .Select(u => u.ApprovalLimit)
            .FirstOrDefaultAsync();

        if (expense.Amount <= limit)
            context.Succeed(requirement);
    }
}
```

Register it **scoped** when it uses a `DbContext`:

```csharp
builder.Services.AddScoped<IAuthorizationHandler, ApprovalLimitHandler>();
```

Registering a handler that holds a `DbContext` as a singleton is the captive dependency bug again.

Be aware of the cost. This handler runs a query per authorization check. Prefer putting slow changing facts such as an approval limit into the token as a claim, and query only when the value genuinely must be current.

## Permission based authorization

A pattern worth knowing, because it solves role explosion. Instead of roles in the token, put **permissions**:

```json
{
  "sub": "42",
  "permissions": ["books.read", "books.write", "orders.read"]
}
```

```csharp
public class PermissionRequirement : IAuthorizationRequirement
{
    public string Permission { get; }
    public PermissionRequirement(string permission) => Permission = permission;
}

public class PermissionHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        if (context.User.HasClaim("permissions", requirement.Permission))
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
```

Generate the policies on demand rather than listing every one:

```csharp
public class PermissionPolicyProvider : IAuthorizationPolicyProvider
{
    private readonly DefaultAuthorizationPolicyProvider fallback;

    public PermissionPolicyProvider(IOptions<AuthorizationOptions> options)
        => fallback = new DefaultAuthorizationPolicyProvider(options);

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (policyName.Contains('.'))
        {
            var policy = new AuthorizationPolicyBuilder()
                .AddRequirements(new PermissionRequirement(policyName))
                .Build();

            return Task.FromResult<AuthorizationPolicy?>(policy);
        }

        return fallback.GetPolicyAsync(policyName);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync() => fallback.GetDefaultPolicyAsync();
    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() => fallback.GetFallbackPolicyAsync();
}
```

```csharp
[Authorize(Policy = "books.write")]
public IActionResult Create() => Ok();
```

Now roles are a way of **grouping permissions** in your admin screens, and the API only ever checks a permission. Adding a capability does not mean touching every endpoint.

## Testing a handler

A handler is a plain class, so it tests without HTTP:

```csharp
[Fact]
public async Task Owner_can_edit_their_own_document()
{
    var user = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("sub", "42") }, "test"));
    var document = new Document { OwnerId = "42" };
    var requirement = new CanEditRequirement();

    var context = new AuthorizationHandlerContext(new[] { requirement }, user, document);

    await new OwnerHandler().HandleAsync(context);

    Assert.True(context.HasSucceeded);
}
```

Rules this important deserve tests, and these ones are cheap to write.

## Quick recap

- A policy is a named set of requirements. Requirements are checked by handlers.
- `RequireClaim`, `RequireRole` and `RequireAssertion` cover simple cases with no custom code.
- Write a requirement and handler when the rule is worth naming, parameterising or testing.
- `Succeed` marks it met, silence means "not by me", and `Fail` vetoes the whole policy.
- Several requirements in a policy are AND. Several handlers for one requirement are OR.
- Resource based authorization needs `IAuthorizationService.AuthorizeAsync(user, resource, policy)`.
- Use `Forbid()` for a logged in user and `Challenge()` for an anonymous one.
- Handlers can inject services. Register them scoped when they use a `DbContext`.
- Permission claims plus a dynamic policy provider solve role explosion.
- Handlers are plain classes, so test them directly.

<code id="code-content" class="language-csharp">
// Policy based authorization: claims, requirements, handlers, and resource checks.
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddAuthentication().AddJwtBearer();
// Handlers are resolved from DI. Scoped when they touch a DbContext, singleton otherwise.
builder.Services.AddSingleton&lt;IAuthorizationHandler, MinimumAgeHandler&gt;();
builder.Services.AddSingleton&lt;IAuthorizationHandler, DocumentOwnerHandler&gt;();
builder.Services.AddSingleton&lt;IAuthorizationHandler, DocumentAdminHandler&gt;();
builder.Services.AddScoped&lt;IAuthorizationHandler, ApprovalLimitHandler&gt;();   // uses the database
builder.Services.AddAuthorization(options =&gt;
{
    // Built in builders: no custom code needed
    options.AddPolicy("Verified", p =&gt; p.RequireClaim("email_verified", "true"));
    options.AddPolicy("Internal", p =&gt; p.RequireClaim("department", "Engineering", "Product"));
    // Several requirements in ONE policy = AND
    options.AddPolicy("VerifiedAdult", p =&gt;
    {
        p.RequireClaim("email_verified", "true");
        p.Requirements.Add(new MinimumAgeRequirement(18));
    });
    // One handler, two policies: the requirement carries the parameter
    options.AddPolicy("AtLeast18", p =&gt; p.Requirements.Add(new MinimumAgeRequirement(18)));
    options.AddPolicy("AtLeast21", p =&gt; p.Requirements.Add(new MinimumAgeRequirement(21)));
    // Resource based: this policy is only ever used with AuthorizeAsync(user, document, ...)
    options.AddPolicy("CanEditDocument", p =&gt; p.Requirements.Add(new CanEditRequirement()));
    options.AddPolicy("CanApproveExpense", p =&gt; p.Requirements.Add(new ApprovalLimitRequirement()));
});
var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
// ---------- A parameterised requirement plus its handler
public class MinimumAgeRequirement : IAuthorizationRequirement
{
    public int MinimumAge { get; }
    public MinimumAgeRequirement(int minimumAge) =&gt; MinimumAge = minimumAge;
}
public class MinimumAgeHandler : AuthorizationHandler&lt;MinimumAgeRequirement&gt;
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, MinimumAgeRequirement requirement)
    {
        Claim? dob = context.User.FindFirst("date_of_birth");
        if (dob is null || !DateTime.TryParse(dob.Value, out DateTime birthday))
            return Task.CompletedTask;      // silence, not Fail(): another handler may still succeed
        int age = DateTime.UtcNow.Year - birthday.Year;
        if (birthday &gt; DateTime.UtcNow.AddYears(-age)) age--;
        if (age &gt;= requirement.MinimumAge)
            context.Succeed(requirement);
        return Task.CompletedTask;
    }
}
// ---------- TWO handlers for ONE requirement = OR.
// Adding a third way to qualify is a new class and one registration line.
public class CanEditRequirement : IAuthorizationRequirement { }
public class DocumentOwnerHandler : AuthorizationHandler&lt;CanEditRequirement, Document&gt;
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, CanEditRequirement requirement, Document resource)
    {
        if (resource.OwnerId == context.User.FindFirst("sub")?.Value)
            context.Succeed(requirement);
        return Task.CompletedTask;
    }
}
public class DocumentAdminHandler : AuthorizationHandler&lt;CanEditRequirement, Document&gt;
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, CanEditRequirement requirement, Document resource)
    {
        if (resource.IsLocked)
        {
            context.Fail();                 // a hard veto: nothing else can override this
            return Task.CompletedTask;
        }
        if (context.User.IsInRole("Admin"))
            context.Succeed(requirement);
        return Task.CompletedTask;
    }
}
// ---------- A handler with a dependency. Costs a query per check, so prefer a
// claim in the token for facts that rarely change.
public class ApprovalLimitRequirement : IAuthorizationRequirement { }
public class ApprovalLimitHandler : AuthorizationHandler&lt;ApprovalLimitRequirement, Expense&gt;
{
    private readonly AppDbContext db;
    public ApprovalLimitHandler(AppDbContext db) =&gt; this.db = db;
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, ApprovalLimitRequirement requirement, Expense expense)
    {
        string? userId = context.User.FindFirst("sub")?.Value;
        if (userId is null || !int.TryParse(userId, out int id)) return;
        decimal limit = await db.Users.Where(u =&gt; u.Id == id)
                                      .Select(u =&gt; u.ApprovalLimit)
                                      .FirstOrDefaultAsync();
        if (expense.Amount &lt;= limit)
            context.Succeed(requirement);
    }
}
[ApiController]
[Route("api/[controller]")]
public class DocumentsController : ControllerBase
{
    private readonly IAuthorizationService authorization;
    private readonly AppDbContext db;
    public DocumentsController(IAuthorizationService authorization, AppDbContext db)
        =&gt; (this.authorization, this.db) = (authorization, db);
    // Attribute policies: checked before anything is loaded
    [HttpGet("archive")]
    [Authorize(Policy = "Internal")]
    public IActionResult Archive() =&gt; Ok();
    [HttpPost("wine-review")]
    [Authorize(Policy = "AtLeast18")]
    public IActionResult WineReview() =&gt; Ok();
    // Resource based: an attribute cannot do this, because the rule depends on THIS record
    [HttpPut("{id:int}")]
    [Authorize]
    public async Task&lt;IActionResult&gt; Update(int id, [FromBody] UpdateRequest request, CancellationToken ct)
    {
        Document? document = await db.Documents.FindAsync(new object[] { id }, ct);
        if (document is null) return NotFound();
        AuthorizationResult result = await authorization.AuthorizeAsync(User, document, "CanEditDocument");
        if (!result.Succeeded)
            return User.Identity?.IsAuthenticated == true
                ? Forbid()        // logged in, not allowed
                : Challenge();    // not logged in: triggers the auth scheme
        document.Title = request.Title;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
    [HttpPost("expenses/{id:int}/approve")]
    [Authorize]
    public async Task&lt;IActionResult&gt; ApproveExpense(int id, CancellationToken ct)
    {
        Expense? expense = await db.Expenses.FindAsync(new object[] { id }, ct);
        if (expense is null) return NotFound();
        var result = await authorization.AuthorizeAsync(User, expense, "CanApproveExpense");
        if (!result.Succeeded)
            return Forbid();      // over their approval limit
        expense.ApprovedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
public record UpdateRequest(string Title);
public class Document { public int Id { get; set; } public string Title { get; set; } = "";
                        public string OwnerId { get; set; } = ""; public bool IsLocked { get; set; } }
public class Expense  { public int Id { get; set; } public decimal Amount { get; set; }
                        public DateTime? ApprovedAt { get; set; } }
public class User     { public int Id { get; set; } public decimal ApprovalLimit { get; set; } }
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;Document&gt; Documents =&gt; Set&lt;Document&gt;();
    public DbSet&lt;Expense&gt;  Expenses  =&gt; Set&lt;Expense&gt;();
    public DbSet&lt;User&gt;     Users     =&gt; Set&lt;User&gt;();
}
</code></pre>
