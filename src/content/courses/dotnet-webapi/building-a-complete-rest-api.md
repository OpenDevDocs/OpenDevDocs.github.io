---
publishDate: 2026-09-30T19:20
title: Building a Complete REST API
slug: building-a-complete-rest-api
metadescription: Put the whole course together into one production shaped API, with a layered structure, EF Core, JWT auth, validation, paging, caching, tests and a deployment pipeline.
updateDate: 2026-09-07T19:20
author: ['bishal-biswas']
level: 4
tags: ['project', 'architecture', 'capstone']
course: dotnet-webapi
---

## What you are building

A bookstore API with everything a real service needs. Every topic in this course appears somewhere in it.

**The features:**

- Register, log in, refresh a token, log out
- Browse books with paging, filtering and sorting
- Full CRUD on books and authors, restricted by role
- Place and view orders, with each customer seeing only their own
- File upload for cover images
- Health checks, rate limiting, caching and structured logging

## The structure

Four projects, with dependencies pointing inward:

```text
BookStore.sln
├── BookStore.Api/              controllers, middleware, Program.cs
│   ├── Controllers/
│   ├── Middleware/
│   ├── Extensions/
│   └── Program.cs
├── BookStore.Core/             entities, interfaces, business rules
│   ├── Entities/
│   ├── Interfaces/
│   ├── DTOs/
│   └── Services/
├── BookStore.Infrastructure/   EF Core, external services
│   ├── Data/
│   ├── Repositories/
│   └── Services/
└── BookStore.Tests/
    ├── Unit/
    └── Integration/
```

```bash
dotnet new sln -n BookStore
dotnet new webapi -n BookStore.Api --use-controllers
dotnet new classlib -n BookStore.Core
dotnet new classlib -n BookStore.Infrastructure
dotnet new xunit -n BookStore.Tests

dotnet sln add BookStore.Api BookStore.Core BookStore.Infrastructure BookStore.Tests

dotnet add BookStore.Api reference BookStore.Core BookStore.Infrastructure
dotnet add BookStore.Infrastructure reference BookStore.Core
dotnet add BookStore.Tests reference BookStore.Api BookStore.Core BookStore.Infrastructure
```

**The rule that makes this worth doing: `BookStore.Core` references nothing.** No EF Core, no ASP.NET Core. Your entities and business rules stay free of framework detail, which keeps them easy to test and easy to move.

Do not build this for a ten endpoint API. A single project with folders is fine, and you can split later. Know the shape so you recognise it.

## The endpoints

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout

GET    /api/v1/books                 paged, filtered, sorted, public
GET    /api/v1/books/{id}            public
POST   /api/v1/books                 Admin or Editor
PUT    /api/v1/books/{id}            Admin or Editor
PATCH  /api/v1/books/{id}            Admin or Editor
DELETE /api/v1/books/{id}            Admin
POST   /api/v1/books/{id}/cover      Admin or Editor

GET    /api/v1/authors
GET    /api/v1/authors/{id}
GET    /api/v1/authors/{id}/books

GET    /api/v1/orders                the caller's own orders only
GET    /api/v1/orders/{id}           404 for someone else's
POST   /api/v1/orders                authenticated, idempotency key
POST   /api/v1/orders/{id}/cancel

GET    /health/live
GET    /health/ready
```

## Build it in this order

Each step is small and leaves you with something that runs.

**1. Solution and entities.** Create the projects. Write `Book`, `Author`, `Order`, `OrderLine` and `AppUser` in `Core/Entities`. No attributes, no EF Core.

**2. DbContext and migrations.** Add `AppDbContext` in Infrastructure, one `IEntityTypeConfiguration<T>` per entity, then `dotnet ef migrations add InitialCreate` and `dotnet ef database update`. Check the generated migration before applying it.

**3. Books, read only.** `GET /api/v1/books` and `GET /api/v1/books/{id}`, projecting to DTOs. Confirm it works in Swagger. You now have a running API.

**4. Paging, filtering, sorting.** Add `PagedResult<T>`, the `ToPagedResultAsync` extension, and an allow list for sort fields. Clamp the page size.

**5. Writes and validation.** `POST`, `PUT`, `PATCH`, `DELETE` with request DTOs and data annotations. Check that `400` responses carry field level errors.

**6. Service layer.** Move business rules out of the controllers into `BookService` and `OrderService`. Controllers become read, call, map.

**7. Authentication.** Identity for users, JWT for tokens, refresh tokens with rotation. Add the Swagger security definition so you can test protected endpoints.

**8. Authorization.** Roles for the simple cases, a resource based policy so a customer only sees their own orders. Add a `FallbackPolicy`.

**9. Errors.** `IExceptionHandler` with problem details, a trace id on every error, and no internals leaking in production.

**10. Orders.** The most interesting part. Stock checks, an idempotency key, a transaction, and a background job for the confirmation email.

**11. Cross cutting.** Serilog, health checks, rate limiting, output caching with tag eviction, CORS.

**12. Tests.** Unit tests for the pricing and order rules. Integration tests for each endpoint, using Testcontainers.

**13. Deploy.** Dockerfile, Compose for local development, GitHub Actions running tests then deploying to a staging slot and swapping.

## The pieces that matter most

Four decisions carry most of the quality.

**DTOs everywhere.** No entity is ever accepted or returned. This alone prevents over posting, data leaks and a contract that breaks whenever the schema changes.

**Thin controllers.** If an action is longer than about twenty lines, something in it belongs in a service. It also makes the choice between controllers and minimal APIs a cheap one.

**Every query scoped by the caller.** `Where(o => o.Id == id && o.CustomerId == userId)`, not a check afterwards. This is the single highest value security habit in the whole course.

**Consistent responses.** One paging shape, one error shape, one date format. Consistency is worth more than any individual design choice.

## Where this design has costs

Worth being honest, because a capstone that pretends otherwise teaches the wrong lesson.

**Four projects is a lot for a small API.** The layering pays off at maybe thirty endpoints and several developers. Below that it is friction. Start with one project and folders.

**A repository over EF Core is often unnecessary.** `DbContext` is already a unit of work. Add repositories when you want to unit test a service without a database, or when the domain project must not reference EF Core. Otherwise inject the context.

**Caching adds failure modes.** Stale data, invalidation bugs, a new dependency. Add an index or fix an N plus 1 first, and cache only what you have measured.

**Rate limiting in process does not work across instances.** It is a last line of defence. The real limit belongs at the gateway.

Knowing where a pattern stops paying is as useful as knowing the pattern.

## A finishing checklist

Before you would call this done:

- [ ] Every endpoint returns DTOs and accepts DTOs.
- [ ] Every id based query is scoped by the current user.
- [ ] `404` rather than `403` where existence is private.
- [ ] Validation returns `400` with field level errors.
- [ ] Errors use problem details with a trace id, and leak nothing in production.
- [ ] Collections are paged, with a clamped page size.
- [ ] `[AllowAnonymous]` appears only on login, register and health.
- [ ] No secrets in the repository.
- [ ] Swagger documents every response code and is disabled or protected in production.
- [ ] Migrations run as a pipeline step, not at startup.
- [ ] Health checks are wired to the load balancer.
- [ ] Structured logs with a correlation id, and no secrets logged.
- [ ] Tests run in CI and the pipeline fails when they do.

## Where to go next

**gRPC** for service to service calls, where the speed and a generated contract beat REST.

**GraphQL** with Hot Chocolate, when clients need to choose their own fields and REST is producing dozens of near duplicate endpoints.

**CQRS with MediatR**, splitting reads from writes. Useful on a large codebase, and it adds real indirection, so adopt it when you feel the need rather than by default.

**Domain driven design** when the business rules become the hard part rather than the plumbing.

**Distributed systems**: message queues, the outbox pattern, idempotent consumers, OpenTelemetry tracing.

None of these are next steps you must take. They are directions. The API you have built here is a genuinely good one, and most production services never need more.

## Quick recap

- Build it in small steps, each leaving you with something that runs.
- Four projects with dependencies pointing inward, and `Core` referencing nothing.
- Do not adopt that structure for a small API. Start flat and split when it hurts.
- DTOs everywhere, thin controllers, every query scoped by the caller, consistent responses.
- Add caching, repositories and rate limiting when you have a reason, not by default.
- Work through the checklist before calling any API finished.
- gRPC, GraphQL, CQRS and DDD are directions to explore, not requirements.

<code id="code-content" class="language-csharp">
// Program.cs for the complete API. Every topic in this course lands here.
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using System.Threading.RateLimiting;
Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();
try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog((context, services, config) =&gt; config
        .ReadFrom.Configuration(context.Configuration)
        .Enrich.FromLogContext());
    // ---- Configuration and secrets ----
    string connectionString = builder.Configuration.GetConnectionString("Default")
        ?? throw new InvalidOperationException("ConnectionStrings:Default is missing.");
    builder.Services.AddOptions&lt;JwtOptions&gt;()
        .Bind(builder.Configuration.GetSection("Jwt"))
        .ValidateDataAnnotations()
        .ValidateOnStart();          // bad config fails the deploy, not the first request
    var jwt = builder.Configuration.GetSection("Jwt").Get&lt;JwtOptions&gt;()!;
    // ---- Data ----
    builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt; o.UseSqlServer(connectionString,
        sql =&gt; sql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null)));
    // ---- Identity and JWT ----
    builder.Services.AddIdentityCore&lt;AppUser&gt;(o =&gt;
    {
        o.Password.RequiredLength = 8;
        o.User.RequireUniqueEmail = true;
        o.Lockout.MaxFailedAccessAttempts = 5;
    })
    .AddRoles&lt;IdentityRole&gt;()
    .AddEntityFrameworkStores&lt;AppDbContext&gt;()
    .AddDefaultTokenProviders();
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =&gt;
        {
            options.MapInboundClaims = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,   ValidIssuer   = jwt.Issuer,
                ValidateAudience = true, ValidAudience = jwt.Audience,
                ValidateLifetime = true, ClockSkew     = TimeSpan.FromSeconds(30),
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
                RoleClaimType = "role", NameClaimType = "name"
            };
        });
    builder.Services.AddAuthorization(options =&gt;
    {
        // Secure by default: forgetting [Authorize] now returns 401 instead of leaking data
        options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
        options.AddPolicy("CanEditCatalogue", p =&gt; p.RequireRole("Admin", "Editor"));
        options.AddPolicy("CanDeleteCatalogue", p =&gt; p.RequireRole("Admin"));
    });
    // ---- Application services ----
    builder.Services.AddScoped&lt;IBookService, BookService&gt;();
    builder.Services.AddScoped&lt;IOrderService, OrderService&gt;();
    builder.Services.AddScoped&lt;IPricingService, PricingService&gt;();
    builder.Services.AddSingleton&lt;IBackgroundTaskQueue&gt;(_ =&gt; new BackgroundTaskQueue(100));
    builder.Services.AddHostedService&lt;QueuedHostedService&gt;();
    // ---- Cross cutting ----
    builder.Services.AddProblemDetails();
    builder.Services.AddExceptionHandler&lt;AppExceptionHandler&gt;();
    builder.Services.AddExceptionHandler&lt;UnhandledExceptionHandler&gt;();
    builder.Services.AddOutputCache(o =&gt;
        o.AddPolicy("BookList", p =&gt; p.Expire(TimeSpan.FromMinutes(5))
                                      .SetVaryByQuery("page", "pageSize", "sort")
                                      .Tag("books")));
    builder.Services.AddRateLimiter(o =&gt;
    {
        o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        o.AddFixedWindowLimiter("auth", l =&gt; { l.PermitLimit = 5;   l.Window = TimeSpan.FromMinutes(15); });
        o.AddFixedWindowLimiter("api",  l =&gt; { l.PermitLimit = 100; l.Window = TimeSpan.FromMinutes(1); });
    });
    builder.Services.AddCors(o =&gt; o.AddDefaultPolicy(p =&gt; p
        .WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get&lt;string[]&gt;() ?? [])
        .AllowAnyHeader().AllowAnyMethod().AllowCredentials()
        .WithExposedHeaders("X-Total-Count", "X-Correlation-Id")));
    builder.Services.AddHealthChecks()
        .AddCheck("self", () =&gt; Microsoft.Extensions.Diagnostics.HealthChecks
            .HealthCheckResult.Healthy(), tags: ["live"])          // NO dependencies here
        .AddDbContextCheck&lt;AppDbContext&gt;("database", tags: ["ready"]);
    builder.Services.AddControllers();
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(o =&gt;
    {
        o.SwaggerDoc("v1", new OpenApiInfo { Title = "BookStore API", Version = "v1" });
        o.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, "BookStore.Api.xml"));
        o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Name = "Authorization", Type = SecuritySchemeType.Http,
            Scheme = "bearer", BearerFormat = "JWT", In = ParameterLocation.Header
        });
        o.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            { new OpenApiSecurityScheme { Reference = new OpenApiReference
                { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }, Array.Empty&lt;string&gt;() }
        });
    });
    builder.Services.Configure&lt;ForwardedHeadersOptions&gt;(o =&gt;
        o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto);
    builder.Services.Configure&lt;HostOptions&gt;(o =&gt; o.ShutdownTimeout = TimeSpan.FromSeconds(30));
    var app = builder.Build();
    // ---- The pipeline. Order is not negotiable. ----
    app.UseForwardedHeaders();          // real client IP and scheme first
    app.UseExceptionHandler();          // outermost: only catches what is below it
    app.UseSerilogRequestLogging();
    app.UseHttpsRedirection();
    app.UseRouting();
    app.UseCors();                      // BEFORE auth, or preflights get a 401
    app.UseAuthentication();            // WHO
    app.UseAuthorization();             // WHAT
    app.UseRateLimiter();
    app.UseOutputCache();
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }
    app.MapControllers();
    app.MapHealthChecks("/health/live",
        new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
        { Predicate = c =&gt; c.Tags.Contains("live") });
    app.MapHealthChecks("/health/ready",
        new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
        { Predicate = c =&gt; c.Tags.Contains("ready") });
    // NOT Database.Migrate() here. Several instances would race during a rolling
    // deploy. Run "dotnet ef migrations script --idempotent" as a pipeline step.
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "The application failed to start");
}
finally
{
    Log.CloseAndFlush();
}
// Needed so the integration test project can reference the host
public partial class Program { }
/* The four habits that carry most of the quality in this API:
     1. DTOs everywhere. No entity is ever accepted or returned.
     2. Thin controllers. Read the request, call a service, map the result.
     3. Every id based query scoped by the caller:
          .Where(o =&gt; o.Id == id &amp;&amp; o.CustomerId == userId)
        and 404, not 403, when existence itself is private.
     4. One paging shape, one error shape, one date format, everywhere.
   And the honest caveats:
     - Four projects is overkill below roughly thirty endpoints. Start flat.
     - A repository over EF Core earns its place only for testability or to keep
       EF out of a domain project. Otherwise inject the DbContext.
     - Cache after measuring. An index or a fixed N plus 1 is often the bigger win.
     - In process rate limiting does not work across instances. The real limit
       belongs at the gateway.
*/
</code></pre>
