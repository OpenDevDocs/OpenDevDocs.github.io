---
publishDate: 2026-08-31T16:20
title: Building a Complete MVC Web App
slug: building-a-complete-mvc-web-app
metadescription: Put the whole course together by building a small online shop from scratch, with a product catalogue, cart, checkout, Identity based accounts, an admin area, validation, caching, logging, tests and deployment, following a step by step plan you can reuse for any project.
updateDate: 2026-09-14T16:20
author: ['bishal-biswas']
level: 4
tags: ['project', 'capstone', 'full-app']
course: dotnet-mvc
---

## The project

Every topic so far taught one piece. This one assembles them into a working app: a small online shop called ShopApp. It is the same example that ran through the course, now built end to end in a sensible order.

The features:

- A public catalogue with search, sorting and paging.
- Product detail pages.
- A session based cart with AJAX add to cart.
- Checkout that creates an order for a logged in customer.
- Accounts with ASP.NET Core Identity.
- An admin area for managing products, protected by role.
- Flash messages, validation, error pages, caching and logging.
- Unit and integration tests.
- A deployment to Azure App Service.

You can follow the steps with the code blocks below or use them as a checklist for a project of your own.

## Step 1: create the project and the data model

```bash
dotnet new mvc -n ShopApp
cd ShopApp
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet add package Microsoft.AspNetCore.Identity.EntityFrameworkCore
dotnet user-secrets init
```

Create the entities: `Category`, `Product`, `Order`, `OrderLine` and `ApplicationUser`. Keep them simple. A product has a name, price, description, image path, stock and category. An order belongs to a user and has lines with a product, quantity and the unit price at the time of purchase.

Create `AppDbContext` inheriting from `IdentityDbContext<ApplicationUser>`, configure decimal precision and indexes in `OnModelCreating`, and seed categories with `HasData`.

Add the connection string to user secrets, register the context and Identity in `Program.cs`, then:

```bash
dotnet ef migrations add InitialCreate
dotnet ef database update
```

Write a `DbSeeder` that adds sample products and an admin user in the Admin role, and call it at startup in Development.

## Step 2: the service layer

Before any controllers, define the interfaces the controllers will use:

- `IProductService`: search with paging, get by id, create, update, delete, and a cached list of categories.
- `ICartService`: get the current cart, add, update quantity, remove, clear. Backed by session.
- `IOrderService`: place an order from a cart, get orders for a user, get one order, mark shipped.

Implement each against `AppDbContext`. Put business rules in the services: stock checks, empty cart checks, and the rule that `OrderLine.UnitPrice` copies the product price at purchase time. Register them as scoped.

This ordering matters. With services in place, every controller becomes thin from the start.

## Step 3: the public catalogue

`ProductsController` with `Index` and `Details`. `Index` takes search, sort and page parameters and returns a `ProductListViewModel` holding a `PagedList<Product>`. The view has a search form, sortable headers and the `_Pager` partial. `Details` shows the product with an add to cart button.

Cache the category menu with the `<cache>` tag helper in the layout and put an `[OutputCache]` policy on `Index` varied by query.

## Step 4: the cart

`CartController` with `Index`, `Add`, `Update` and `Remove`. `Add` accepts both a normal form post and an AJAX call, returning JSON with the new item count for the latter. A `CartSummary` view component in the navbar shows the count.

Session needs `AddSession`, `AddDistributedMemoryCache` and `UseSession`. The cart is stored as JSON with the session extension methods.

## Step 5: accounts

`AccountController` with register, login, logout and a simple profile page, using `UserManager` and `SignInManager`. Set `LoginPath` and `AccessDeniedPath`. Add the `_LoginPartial` to the layout.

Turn on the global `AutoValidateAntiforgeryTokenAttribute` filter and a fallback authorization policy that requires login, then mark the catalogue, cart and account pages with `[AllowAnonymous]`.

## Step 6: checkout and orders

`CheckoutController` with `Review` (GET) showing the cart and a shipping address form, and `PlaceOrder` (POST). The POST validates the address view model, calls `IOrderService.PlaceOrderAsync`, clears the cart, sets a flash message and redirects to a confirmation page.

`OrdersController` lists the current user's orders and shows one order, with a resource based authorization check so users can only see their own.

## Step 7: the admin area

Create `Areas/Admin` with an `AdminControllerBase` marked `[Area("Admin")]` and `[Authorize(Roles = "Admin")]`. Add `DashboardController` with counts and recent orders, `ProductsController` with full CRUD including image upload, and `OrdersController` with a list and a ship action that sends a SignalR message to anyone watching that order.

Give the area its own layout with an admin navigation and register the area route before the default route.

## Step 8: cross cutting concerns

- **Errors**: `UseExceptionHandler("/Home/Error")` and `UseStatusCodePagesWithReExecute("/Error/{0}")` with friendly views.
- **Logging**: Serilog to console and rolling files, request logging enabled, business events logged in services.
- **Security headers**: a small middleware adding CSP, nosniff, frame options and referrer policy.
- **Flash messages**: the `TempData` extension methods and the `_Flash` partial in the layout.
- **Health check**: `/health` with a database check.

## Step 9: tests

A `ShopApp.Tests` project with unit tests for `OrderService` (stock rules, price capture, empty cart) and `CartService`, plus controller tests for `ProductsController` and `CheckoutController` with mocked services.

A `ShopApp.IntegrationTests` project with `ShopWebApplicationFactory` using SQLite in memory and a test authentication handler. Tests: the home and catalogue pages load, product details returns 404 for a bad id, the admin area redirects anonymous users, and creating a product through the admin form saves and redirects.

Run `dotnet test` in the solution folder and make it green.

## Step 10: deploy

Add data protection key persistence, forwarded headers and `Database.Migrate()` at startup. Create the Azure resources, set the connection string and environment as app settings, and deploy with a GitHub Actions workflow that runs the tests first.

Visit the URL. Register, browse, add to cart, check out, then log in as admin and ship the order.

## The order of work, in general

Notice the sequence: data model, services, public pages, state, accounts, transactions, admin, cross cutting, tests, deploy. This order works for most apps because each step builds on a stable layer below it, and because the boring but important things, such as error pages and logging, are added before the app is shown to anyone rather than after the first incident.

## Where to go next

- Add product reviews with a rating, and moderate them in the admin area.
- Add email confirmation and password reset with a real email provider.
- Replace the session cart with a database cart for logged in users so it survives devices.
- Add a JSON API for the catalogue and a small JavaScript or mobile front end against it.
- Add Stripe checkout in test mode.
- Move the services into a separate class library and reference it from a Blazor admin.

Each of these uses only things covered in this course plus one new library, and each is the kind of feature a real employer or client asks for.

## Quick recap

- Build in layers: entities and context, services with the business rules, then controllers and views on top.
- Public catalogue, cart, accounts, checkout and admin area cover the patterns most apps need.
- Add error handling, logging, security headers, flash messages and health checks before the first deploy, not after.
- Unit test the services and controllers, integration test the main pages and forms.
- Deploy with migrations at startup, persisted data protection keys and a CI workflow that runs the tests.

<code id="code-content" class="language-csharp">
// Program.cs: the finished composition root for ShopApp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Serilog;
using ShopApp.Data;
using ShopApp.Hubs;
using ShopApp.Middleware;
using ShopApp.Models;
using ShopApp.Services;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog((ctx, services, cfg) =&gt; cfg
        .ReadFrom.Configuration(ctx.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext());

    // MVC with global filters
    builder.Services.AddControllersWithViews(options =&gt;
    {
        options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
    });

    // Data
    builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt;
        o.UseSqlServer(builder.Configuration.GetConnectionString("Default"), sql =&gt; sql.EnableRetryOnFailure()));

    // Identity
    builder.Services.AddIdentity&lt;ApplicationUser, IdentityRole&gt;(o =&gt;
    {
        o.Password.RequiredLength = 8;
        o.Password.RequireNonAlphanumeric = false;
        o.Lockout.MaxFailedAccessAttempts = 5;
        o.User.RequireUniqueEmail = true;
    })
    .AddEntityFrameworkStores&lt;AppDbContext&gt;()
    .AddDefaultTokenProviders();

    builder.Services.ConfigureApplicationCookie(o =&gt;
    {
        o.LoginPath = "/Account/Login";
        o.AccessDeniedPath = "/Account/Denied";
        o.Cookie.SameSite = SameSiteMode.Lax;
    });

    // Everything requires login unless [AllowAnonymous]
    builder.Services.AddAuthorization(o =&gt;
    {
        o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
        o.AddPolicy("ViewOrder", p =&gt; p.Requirements.Add(new OrderOwnerRequirement()));
    });
    builder.Services.AddSingleton&lt;IAuthorizationHandler, OrderOwnerHandler&gt;();

    // Settings
    builder.Services.AddOptions&lt;ShopSettings&gt;()
        .Bind(builder.Configuration.GetSection("Shop"))
        .ValidateDataAnnotations()
        .ValidateOnStart();

    // Session cart
    builder.Services.AddDistributedMemoryCache();
    builder.Services.AddSession(o =&gt;
    {
        o.IdleTimeout = TimeSpan.FromHours(2);
        o.Cookie.HttpOnly = true;
        o.Cookie.IsEssential = true;
    });
    builder.Services.AddHttpContextAccessor();

    // Application services
    builder.Services.AddMemoryCache();
    builder.Services.AddScoped&lt;IProductService, ProductService&gt;();
    builder.Services.AddScoped&lt;ICartService, SessionCartService&gt;();
    builder.Services.AddScoped&lt;IOrderService, OrderService&gt;();
    builder.Services.AddScoped&lt;IEmailSender, SmtpEmailSender&gt;();

    // Real time, caching, health, production plumbing
    builder.Services.AddSignalR();
    builder.Services.AddOutputCache(o =&gt;
        o.AddPolicy("Catalogue", p =&gt; p.Expire(TimeSpan.FromMinutes(5)).SetVaryByQuery("search", "sort", "page").Tag("products")));
    builder.Services.AddHealthChecks().AddDbContextCheck&lt;AppDbContext&gt;();
    builder.Services.AddDataProtection()
        .PersistKeysToFileSystem(new DirectoryInfo(builder.Configuration["DataProtection:KeyPath"] ?? "keys"))
        .SetApplicationName("ShopApp");
    builder.Services.Configure&lt;ForwardedHeadersOptions&gt;(o =&gt;
        o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto);

    var app = builder.Build();

    // Pipeline
    app.UseForwardedHeaders();
    if (app.Environment.IsDevelopment())
    {
        app.UseDeveloperExceptionPage();
    }
    else
    {
        app.UseExceptionHandler("/Home/Error");
        app.UseHsts();
    }
    app.UseStatusCodePagesWithReExecute("/Error/{0}");
    app.UseSerilogRequestLogging();
    app.UseHttpsRedirection();
    app.UseMiddleware&lt;SecurityHeadersMiddleware&gt;();
    app.UseStaticFiles();
    app.UseRouting();
    app.UseAuthentication();
    app.UseAuthorization();
    app.UseSession();
    app.UseOutputCache();

    app.MapHealthChecks("/health").AllowAnonymous();
    app.MapHub&lt;OrderHub&gt;("/hubs/orders");
    app.MapControllerRoute("areas", "{area:exists}/{controller=Dashboard}/{action=Index}/{id?}");
    app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");

    // Migrate and seed
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService&lt;AppDbContext&gt;();
        await db.Database.MigrateAsync();
        await IdentitySeeder.SeedAsync(scope.ServiceProvider);
        if (app.Environment.IsDevelopment())
        {
            await DbSeeder.SeedAsync(db);
        }
    }

    Log.Information("ShopApp starting in {Environment}", app.Environment.EnvironmentName);
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "ShopApp failed to start");
}
finally
{
    Log.CloseAndFlush();
}

public partial class Program { }   // for WebApplicationFactory in integration tests

// Folder layout
//
//   ShopApp/
//     Areas/Admin/{Controllers,Views}
//     Authorization/      OrderOwnerRequirement.cs, OrderOwnerHandler.cs
//     Controllers/        Home, Products, Cart, Checkout, Orders, Account, Error
//     Data/               AppDbContext.cs, DbSeeder.cs, IdentitySeeder.cs, Migrations/
//     Extensions/         TempDataExtensions.cs, SessionExtensions.cs
//     Helpers/            PagedList.cs
//     Hubs/               OrderHub.cs
//     Middleware/         SecurityHeadersMiddleware.cs
//     Models/             Category, Product, Order, OrderLine, ApplicationUser, Cart
//     Services/           IProductService, ProductService, ICartService, SessionCartService, IOrderService, OrderService
//     Settings/           ShopSettings.cs
//     ViewComponents/     CartSummaryViewComponent.cs
//     ViewModels/         Products/, Checkout/, Account/
//     Views/              Shared/{_Layout,_Flash,_Pager,_LoginPartial,Error}, Products/, Cart/, ...
//     wwwroot/            css/, js/, uploads/
//   ShopApp.Tests/            unit tests (xUnit + Moq)
//   ShopApp.IntegrationTests/ WebApplicationFactory tests (SQLite in memory)
//   .github/workflows/deploy.yml
</code></pre>
