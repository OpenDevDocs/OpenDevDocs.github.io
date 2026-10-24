---
publishDate: 2026-08-25T14:10
title: Role and Policy Based Authorization
slug: role-and-policy-based-authorization
metadescription: Go beyond Authorize with roles, define named policies with claim and role requirements, write custom requirements and handlers for rules such as resource ownership, and check policies from code with IAuthorizationService.
updateDate: 2026-09-14T14:10
author: ['bishal-biswas']
level: 3
tags: ['authorization', 'policies', 'security']
course: dotnet-mvc
---

## Beyond logged in or not

`[Authorize]` answers one question: is there a user? Real apps need more. Only admins may delete products. Only the person who placed an order may view it. Only users over 18 may buy certain items. Only staff on the sales team may issue refunds.

ASP.NET Core has three ways to express these, from simplest to most flexible: **roles**, **policies** and **requirements with handlers**.

## Roles

A role is a label on the user, stored as a `ClaimTypes.Role` claim. The check is a string comparison:

```csharp
[Authorize(Roles = "Admin")]
public IActionResult Delete(int id)
```

Several roles in one attribute means any of them:

```csharp
[Authorize(Roles = "Admin,Manager")]
```

Several attributes means all of them:

```csharp
[Authorize(Roles = "Admin")]
[Authorize(Roles = "Auditor")]
```

Roles are quick and readable. They fall short when the rule is not "who are you" but "what is true about you", or when the same rule appears in many places and you want to change it once.

## Policies

A policy is a named rule defined in one place and referenced by name everywhere:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CanManageProducts", policy =>
        policy.RequireRole("Admin", "Manager"));

    options.AddPolicy("VerifiedEmail", policy =>
        policy.RequireClaim("email_verified", "true"));

    options.AddPolicy("SalesTeam", policy =>
        policy.RequireAuthenticatedUser()
              .RequireRole("Staff")
              .RequireClaim("department", "Sales"));
});
```

```csharp
[Authorize(Policy = "CanManageProducts")]
public class ProductsAdminController : Controller
```

Now if managers should lose product access, you change one line in `Program.cs`. `RequireRole`, `RequireClaim`, `RequireUserName` and `RequireAuthenticatedUser` can be chained, and every requirement must pass.

For rules that fit in a lambda, `RequireAssertion` takes the user and returns a bool:

```csharp
options.AddPolicy("Adult", policy =>
    policy.RequireAssertion(context =>
    {
        var dob = context.User.FindFirst("date_of_birth")?.Value;
        return DateTime.TryParse(dob, out var date) && date <= DateTime.Today.AddYears(-18);
    }));
```

## Requirements and handlers

When a rule needs services, such as a database lookup, or depends on the specific resource being accessed, write a **requirement** class and a **handler**.

A requirement is a marker with any parameters:

```csharp
public class MinimumAgeRequirement : IAuthorizationRequirement
{
    public int MinimumAge { get; }
    public MinimumAgeRequirement(int minimumAge) => MinimumAge = minimumAge;
}
```

A handler decides whether the requirement is met:

```csharp
public class MinimumAgeHandler : AuthorizationHandler<MinimumAgeRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        MinimumAgeRequirement requirement)
    {
        var dob = context.User.FindFirst("date_of_birth")?.Value;

        if (DateTime.TryParse(dob, out var date))
        {
            var age = DateTime.Today.Year - date.Year;
            if (date > DateTime.Today.AddYears(-age)) age--;

            if (age >= requirement.MinimumAge)
            {
                context.Succeed(requirement);
            }
        }

        return Task.CompletedTask;
    }
}
```

Call `context.Succeed` when the rule passes. Do nothing when it fails; another handler for the same requirement might still succeed. Call `context.Fail()` only to veto regardless of other handlers.

Register the handler and use the requirement in a policy:

```csharp
builder.Services.AddSingleton<IAuthorizationHandler, MinimumAgeHandler>();

options.AddPolicy("Over18", policy =>
    policy.Requirements.Add(new MinimumAgeRequirement(18)));
```

Handlers can take services in their constructor. Register them as scoped if they need a `DbContext`.

## Resource based authorization

The most common custom rule is "may this user touch this particular record". An attribute cannot express it because the record is not known until the action loads it. Instead, check inside the action with `IAuthorizationService`:

```csharp
public class OrdersController : Controller
{
    private readonly AppDbContext _db;
    private readonly IAuthorizationService _authorization;

    public OrdersController(AppDbContext db, IAuthorizationService authorization)
    {
        _db = db;
        _authorization = authorization;
    }

    public async Task<IActionResult> Details(int id)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order is null) return NotFound();

        var result = await _authorization.AuthorizeAsync(User, order, "ViewOrder");
        if (!result.Succeeded)
        {
            return Forbid();
        }

        return View(order);
    }
}
```

The handler receives the order as the resource:

```csharp
public class OrderOwnerHandler : AuthorizationHandler<OrderOwnerRequirement, Order>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        OrderOwnerRequirement requirement,
        Order order)
    {
        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (order.CustomerId == userId || context.User.IsInRole("Admin"))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
```

`Forbid()` returns a 403 for a logged in user, which the cookie handler turns into a redirect to the access denied page. `Challenge()` would send them to log in, which is wrong here because they are already logged in.

## Checking policies in views

Hide buttons the user cannot use. Inject the service:

```cshtml
@inject IAuthorizationService Authorization

@if ((await Authorization.AuthorizeAsync(User, "CanManageProducts")).Succeeded)
{
    <a asp-action="Edit" asp-route-id="@Model.Id" class="btn btn-secondary">Edit</a>
}
```

Hiding a button is not security. The action must still check. The view check is only for a cleaner interface.

## Applying policies broadly

A policy on a controller applies to all its actions. A fallback policy applies everywhere:

```csharp
options.FallbackPolicy = new AuthorizationPolicyBuilder()
    .RequireAuthenticatedUser()
    .Build();
```

For areas, a base controller with the attribute is the simplest approach, as the areas topic showed.

## Choosing

| Rule | Use |
| --- | --- |
| Based on a role label | `[Authorize(Roles = ...)]` |
| Combines roles and claims, reused in several places | Policy with `RequireRole` and `RequireClaim` |
| Needs a small calculation on claims | Policy with `RequireAssertion` |
| Needs a service or database | Requirement and handler |
| Depends on the record being accessed | Resource based check with `IAuthorizationService` |

Start with roles. Move to policies when the same role list appears three times. Write handlers only when the rule cannot be expressed on claims alone.

## Quick recap

- Roles are labels on the user checked by `[Authorize(Roles = ...)]`.
- Policies are named rules defined once in `AddAuthorization` and applied with `[Authorize(Policy = ...)]`.
- Requirements and handlers express rules that need services or calculation, and call `context.Succeed` when satisfied.
- Resource based authorization checks a specific record with `IAuthorizationService.AuthorizeAsync` inside the action.
- Return `Forbid()` for a logged in user who is not allowed, and check policies in views only to tidy the interface.

<code id="code-content" class="language-csharp">
// Authorization/MinimumAgeRequirement.cs
using Microsoft.AspNetCore.Authorization;

public class MinimumAgeRequirement : IAuthorizationRequirement
{
    public int MinimumAge { get; }
    public MinimumAgeRequirement(int minimumAge) =&gt; MinimumAge = minimumAge;
}

public class MinimumAgeHandler : AuthorizationHandler&lt;MinimumAgeRequirement&gt;
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, MinimumAgeRequirement requirement)
    {
        var dob = context.User.FindFirst("date_of_birth")?.Value;
        if (DateTime.TryParse(dob, out var date))
        {
            var age = DateTime.Today.Year - date.Year;
            if (date &gt; DateTime.Today.AddYears(-age)) age--;
            if (age &gt;= requirement.MinimumAge) context.Succeed(requirement);
        }
        return Task.CompletedTask;
    }
}

// Authorization/OrderOwnerRequirement.cs (resource based)
public class OrderOwnerRequirement : IAuthorizationRequirement { }

public class OrderOwnerHandler : AuthorizationHandler&lt;OrderOwnerRequirement, Order&gt;
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, OrderOwnerRequirement requirement, Order order)
    {
        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (order.CustomerId == userId || context.User.IsInRole("Admin"))
        {
            context.Succeed(requirement);
        }
        return Task.CompletedTask;
    }
}

// Program.cs
builder.Services.AddSingleton&lt;IAuthorizationHandler, MinimumAgeHandler&gt;();
builder.Services.AddSingleton&lt;IAuthorizationHandler, OrderOwnerHandler&gt;();

builder.Services.AddAuthorization(options =&gt;
{
    options.AddPolicy("CanManageProducts", p =&gt; p.RequireRole("Admin", "Manager"));
    options.AddPolicy("SalesTeam", p =&gt; p.RequireRole("Staff").RequireClaim("department", "Sales"));
    options.AddPolicy("Over18", p =&gt; p.Requirements.Add(new MinimumAgeRequirement(18)));
    options.AddPolicy("ViewOrder", p =&gt; p.Requirements.Add(new OrderOwnerRequirement()));
});

// Controllers/ProductsAdminController.cs
[Authorize(Policy = "CanManageProducts")]
public class ProductsAdminController : Controller
{
    public IActionResult Index() =&gt; View();

    [Authorize(Roles = "Admin")]                 // narrower than the controller policy
    [HttpPost]
    public IActionResult Delete(int id) =&gt; RedirectToAction(nameof(Index));
}

// Controllers/OrdersController.cs
[Authorize]
public class OrdersController : Controller
{
    private readonly AppDbContext _db;
    private readonly IAuthorizationService _authorization;

    public OrdersController(AppDbContext db, IAuthorizationService authorization)
    {
        _db = db;
        _authorization = authorization;
    }

    public async Task&lt;IActionResult&gt; Details(int id)
    {
        var order = await _db.Orders.Include(o =&gt; o.Lines).FirstOrDefaultAsync(o =&gt; o.Id == id);
        if (order is null) return NotFound();

        var result = await _authorization.AuthorizeAsync(User, order, "ViewOrder");
        if (!result.Succeeded) return Forbid();

        return View(order);
    }

    [Authorize(Policy = "Over18")]
    public IActionResult RestrictedItems() =&gt; View();
}

// Views/Orders/Details.cshtml (hide what the user cannot do)
//
//   @inject IAuthorizationService Authorization
//   @if ((await Authorization.AuthorizeAsync(User, "CanManageProducts")).Succeeded)
//   {
//       &lt;a asp-controller="ProductsAdmin" asp-action="Index" class="btn btn-secondary"&gt;Manage&lt;/a&gt;
//   }
</code></pre>
