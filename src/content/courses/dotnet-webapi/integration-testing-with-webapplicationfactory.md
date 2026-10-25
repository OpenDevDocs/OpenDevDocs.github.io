---
publishDate: 2026-09-28T18:40
title: Integration Testing with WebApplicationFactory
slug: integration-testing-with-webapplicationfactory
metadescription: Test your whole API in memory with WebApplicationFactory. Swap the database, fake authentication, share the host across tests, and use Testcontainers for a real database.
updateDate: 2026-09-07T18:40
author: ['bishal-biswas']
level: 4
tags: ['testing', 'integration-testing', 'testcontainers']
course: dotnet-webapi
---

## What an integration test covers

A unit test calls a method. An integration test sends an HTTP request through the **real pipeline**: routing, model binding, validation, filters, middleware, authentication, serialization and your endpoint.

That difference matters. These bugs only show up in an integration test:

- A route that does not match
- A validation attribute that never runs
- Middleware in the wrong order
- A DI registration that is missing
- A JSON property that serializes with the wrong name
- An authorization policy that is not applied

None of them are visible when you call the controller method directly.

## Setting up

```bash
dotnet new xunit -n BookStore.IntegrationTests
dotnet add BookStore.IntegrationTests reference BookStore.Api
dotnet add BookStore.IntegrationTests package Microsoft.AspNetCore.Mvc.Testing
dotnet add BookStore.IntegrationTests package Microsoft.EntityFrameworkCore.InMemory
dotnet add BookStore.IntegrationTests package FluentAssertions
```

`Program` needs to be reachable from the test project. With top level statements it is internal, so add this to the bottom of `Program.cs`:

```csharp
public partial class Program { }
```

Or expose internals from the `.csproj`:

```xml
<ItemGroup>
  <InternalsVisibleTo Include="BookStore.IntegrationTests" />
</ItemGroup>
```

## The first test

```csharp
public class BooksApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient client;

    public BooksApiTests(WebApplicationFactory<Program> factory)
        => client = factory.CreateClient();

    [Fact]
    public async Task Get_books_returns_200()
    {
        HttpResponseMessage response = await client.GetAsync("/api/books");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
```

The whole app starts **in memory**. There is no real port, no network and no `dotnet run`. `CreateClient` gives you an `HttpClient` wired straight to the pipeline, so tests run in milliseconds.

`IClassFixture` shares one factory across every test in the class rather than starting the app per test.

## Swapping the database

You do not want tests hitting your development database. Override the registration:

```csharp
public class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            // Remove the real registration
            ServiceDescriptor? descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));

            if (descriptor is not null) services.Remove(descriptor);

            // Add a test one
            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase($"test-{Guid.NewGuid()}"));
        });
    }
}
```

A unique database name per factory means tests cannot contaminate each other.

Removing the old descriptor is the part people miss. `ConfigureServices` **adds** to the collection, so without the removal both registrations exist and the last one may not win the way you expect. Also remove `DbConnection` if your provider registered one.

## The in memory provider is not SQL

Worth being clear about, because it causes false confidence.

`UseInMemoryDatabase` is a fake. It does not enforce foreign keys, unique constraints or nullability. It does not translate LINQ to SQL, so a query that would throw against a real database passes here. Its transactions do nothing.

So a test can pass in memory and fail in production.

Two better options:

**SQLite in memory** is a real relational engine with real constraints:

```csharp
var connection = new SqliteConnection("DataSource=:memory:");
connection.Open();      // keep it open, or the database disappears

services.AddDbContext<AppDbContext>(options => options.UseSqlite(connection));
```

Much closer to reality. Still not identical to SQL Server: different types, different collation, no `GETUTCDATE()`.

**Testcontainers** runs the actual database in Docker:

```bash
dotnet add package Testcontainers.MsSql
```

```csharp
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly MsSqlContainer database = new MsSqlBuilder()
        .WithImage("mcr.microsoft.com/mssql/server:2022-latest")
        .Build();

    public async Task InitializeAsync()
    {
        await database.StartAsync();
    }

    public new async Task DisposeAsync() => await database.DisposeAsync();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();

            services.AddDbContext<AppDbContext>(options =>
                options.UseSqlServer(database.GetConnectionString()));
        });
    }
}
```

Your migrations run against the real engine, constraints are real, and the SQL is the SQL you will ship. Startup costs a few seconds per container, so share it across a test collection.

This is the option to reach for when correctness matters.

## Seeding data

Reset and seed before each test so they are independent:

```csharp
public class BooksApiTests : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private readonly ApiFactory factory;
    private readonly HttpClient client;

    public BooksApiTests(ApiFactory factory)
    {
        this.factory = factory;
        client = factory.CreateClient();
    }

    public async Task InitializeAsync()
    {
        using IServiceScope scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await db.Database.EnsureDeletedAsync();
        await db.Database.EnsureCreatedAsync();

        db.Books.AddRange(
            new Book { Title = "Clean Code", Year = 2008 },
            new Book { Title = "Refactoring", Year = 1999 });

        await db.SaveChangesAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;
}
```

With Testcontainers, use `MigrateAsync()` instead of `EnsureCreatedAsync()`. That also tests your migrations, which is worth doing.

Tests that depend on each other's data are the most common cause of a suite that passes locally and fails in CI, where order differs.

## Faking authentication

Real tokens in tests are painful. Register a fake scheme instead:

```csharp
public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "Test";

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder) : base(options, logger, encoder) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // Let a test choose the user with headers
        string userId = Context.Request.Headers["X-Test-UserId"].FirstOrDefault() ?? "42";
        string roles = Context.Request.Headers["X-Test-Roles"].FirstOrDefault() ?? "User";

        var claims = new List<Claim> { new("sub", userId), new(ClaimTypes.Name, "Test User") };

        claims.AddRange(roles.Split(',').Select(r => new Claim(ClaimTypes.Role, r.Trim())));

        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName));
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
```

```csharp
services.AddAuthentication(TestAuthHandler.SchemeName)
        .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
```

```csharp
[Fact]
public async Task Delete_requires_the_admin_role()
{
    client.DefaultRequestHeaders.Add("X-Test-Roles", "User");
    HttpResponseMessage forbidden = await client.DeleteAsync("/api/books/1");
    forbidden.StatusCode.Should().Be(HttpStatusCode.Forbidden);

    client.DefaultRequestHeaders.Remove("X-Test-Roles");
    client.DefaultRequestHeaders.Add("X-Test-Roles", "Admin");
    HttpResponseMessage ok = await client.DeleteAsync("/api/books/1");
    ok.StatusCode.Should().Be(HttpStatusCode.NoContent);
}
```

Your real authorization policies still run. Only the token parsing is replaced, which is exactly the right split.

## What to test

Integration tests are slower than unit tests, so spend them where they pay.

**Worth testing:**

- The full CRUD cycle for each resource
- Validation returning `400` with the right field errors
- Authorization returning `401` and `403` correctly
- The exact JSON shape a client depends on
- Paging, filtering and sorting
- Error responses, including problem details
- Anything that has broken before

**Not worth testing:**

- Every combination of every filter
- Framework behaviour, such as whether routing works at all
- Third party libraries

A good balance is one integration test per endpoint covering the happy path, plus one per interesting failure, with unit tests carrying the detailed business rules.

## Keeping them fast

**Share the factory** with `IClassFixture`, or `ICollectionFixture` across classes. Starting the host per test is the biggest avoidable cost.

**Run in parallel.** xUnit parallelises across collections by default, so give each test its own database name.

**Turn off retries and background services** in the test environment:

```csharp
builder.ConfigureServices(services =>
{
    services.RemoveAll<IHostedService>();      // do not run background jobs in tests
});
```

**Quieten logging:**

```csharp
builder.ConfigureLogging(logging =>
{
    logging.ClearProviders();
    logging.SetMinimumLevel(LogLevel.Warning);
});
```

## Quick recap

- `WebApplicationFactory<Program>` starts your whole app in memory with no port and no network.
- Add `public partial class Program { }` so the test project can reference it.
- Replace the database registration in `ConfigureWebHost`, and remember to **remove** the original descriptor.
- The in memory provider ignores constraints and does not translate SQL. Prefer SQLite, or Testcontainers for a real database.
- Reset and seed before each test with `IAsyncLifetime`, and give each factory a unique database.
- Replace only the authentication handler, so your real authorization policies still run.
- Test full CRUD cycles, validation, authorization and the exact JSON shape.
- Share the factory, remove hosted services and quieten logging to keep the suite fast.

<code id="code-content" class="language-csharp">
// A complete integration test setup: real pipeline, swapped database, fake auth.
// dotnet add package Microsoft.AspNetCore.Mvc.Testing Testcontainers.MsSql FluentAssertions
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using FluentAssertions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Testcontainers.MsSql;
using Xunit;
public class ApiFactory : WebApplicationFactory&lt;Program&gt;, IAsyncLifetime
{
    // A REAL SQL Server in Docker. The in memory provider ignores foreign keys,
    // unique constraints and nullability, and never translates LINQ to SQL, so a
    // test can pass there and fail in production.
    private readonly MsSqlContainer database = new MsSqlBuilder()
        .WithImage("mcr.microsoft.com/mssql/server:2022-latest")
        .Build();
    public async Task InitializeAsync() =&gt; await database.StartAsync();
    public new async Task DisposeAsync() =&gt; await database.DisposeAsync();
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureLogging(logging =&gt;
        {
            logging.ClearProviders();
            logging.SetMinimumLevel(LogLevel.Warning);
        });
        builder.ConfigureServices(services =&gt;
        {
            // ConfigureServices ADDS, so the original registration must be removed
            // or both exist. People miss this and wonder why the real database is hit.
            services.RemoveAll&lt;DbContextOptions&lt;AppDbContext&gt;&gt;();
            services.RemoveAll&lt;AppDbContext&gt;();
            services.AddDbContext&lt;AppDbContext&gt;(o =&gt; o.UseSqlServer(database.GetConnectionString()));
            // Background jobs should not run during tests
            services.RemoveAll&lt;IHostedService&gt;();
            // Replace ONLY the authentication handler. Real authorization policies
            // still run, which is exactly the split we want to test.
            services.AddAuthentication(TestAuthHandler.SchemeName)
                    .AddScheme&lt;AuthenticationSchemeOptions, TestAuthHandler&gt;(
                        TestAuthHandler.SchemeName, _ =&gt; { });
        });
    }
}
public class TestAuthHandler : AuthenticationHandler&lt;AuthenticationSchemeOptions&gt;
{
    public const string SchemeName = "Test";
    public TestAuthHandler(IOptionsMonitor&lt;AuthenticationSchemeOptions&gt; options,
                           ILoggerFactory logger, UrlEncoder encoder)
        : base(options, logger, encoder) { }
    protected override Task&lt;AuthenticateResult&gt; HandleAuthenticateAsync()
    {
        // Headers let each test pick who is calling, with no real tokens involved
        string userId = Context.Request.Headers["X-Test-UserId"].FirstOrDefault() ?? "42";
        string roles  = Context.Request.Headers["X-Test-Roles"].FirstOrDefault() ?? "User";
        var claims = new List&lt;Claim&gt; { new("sub", userId), new(ClaimTypes.Name, "Test User") };
        claims.AddRange(roles.Split(',').Select(r =&gt; new Claim(ClaimTypes.Role, r.Trim())));
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName));
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName)));
    }
}
public class BooksApiTests : IClassFixture&lt;ApiFactory&gt;, IAsyncLifetime
{
    private readonly ApiFactory factory;
    private readonly HttpClient client;
    public BooksApiTests(ApiFactory factory)
    {
        this.factory = factory;
        client = factory.CreateClient();       // in memory, no port, no network
    }
    // Reset and seed before EVERY test. Tests that share state are the usual cause
    // of a suite that passes locally and fails in CI, where the order differs.
    public async Task InitializeAsync()
    {
        using IServiceScope scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService&lt;AppDbContext&gt;();
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();      // also proves the migrations work
        db.Books.AddRange(
            new Book { Title = "Clean Code",  Year = 2008, Isbn = "9780132350884" },
            new Book { Title = "Refactoring", Year = 1999, Isbn = "9780201485677" });
        await db.SaveChangesAsync();
    }
    public Task DisposeAsync() =&gt; Task.CompletedTask;
    [Fact]
    public async Task Get_books_returns_the_seeded_list()
    {
        List&lt;BookResponse&gt;? books = await client.GetFromJsonAsync&lt;List&lt;BookResponse&gt;&gt;("/api/books");
        books.Should().HaveCount(2);
        books.Should().Contain(b =&gt; b.Title == "Clean Code");
    }
    // The full pipeline: routing, binding, validation, the action, serialization
    [Fact]
    public async Task Post_then_get_round_trips_a_book()
    {
        HttpResponseMessage created = await client.PostAsJsonAsync("/api/books",
            new { title = "Domain Driven Design", year = 2003, isbn = "9780321125217" });
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        created.Headers.Location.Should().NotBeNull();
        BookResponse? fetched = await client.GetFromJsonAsync&lt;BookResponse&gt;(created.Headers.Location);
        fetched!.Title.Should().Be("Domain Driven Design");
    }
    // Validation that a unit test cannot reach, because [ApiController] runs it
    // in the framework rather than in the action
    [Fact]
    public async Task Post_returns_400_with_field_errors_for_an_invalid_book()
    {
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/books",
            new { title = "", year = 99999 });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        ValidationProblemDetails? problem =
            await response.Content.ReadFromJsonAsync&lt;ValidationProblemDetails&gt;();
        problem!.Errors.Should().ContainKey("Title");
        problem.Errors.Should().ContainKey("Year");
    }
    // Real authorization policies, fake identity
    [Fact]
    public async Task Delete_requires_the_admin_role()
    {
        client.DefaultRequestHeaders.Remove("X-Test-Roles");
        client.DefaultRequestHeaders.Add("X-Test-Roles", "User");
        (await client.DeleteAsync("/api/books/1")).StatusCode
            .Should().Be(HttpStatusCode.Forbidden);
        client.DefaultRequestHeaders.Remove("X-Test-Roles");
        client.DefaultRequestHeaders.Add("X-Test-Roles", "Admin");
        (await client.DeleteAsync("/api/books/1")).StatusCode
            .Should().Be(HttpStatusCode.NoContent);
    }
    // The exact JSON a client depends on. A renamed property breaks callers,
    // and only a test at this level catches it.
    [Fact]
    public async Task Response_uses_camelCase_property_names()
    {
        string json = await client.GetStringAsync("/api/books/1");
        json.Should().Contain("\"title\"").And.NotContain("\"Title\"");
    }
}
public record BookResponse(int Id, string Title, int Year, string Isbn);
public class Book { public int Id { get; set; } public string Title { get; set; } = "";
                    public int Year { get; set; } public string Isbn { get; set; } = ""; }
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;Book&gt; Books =&gt; Set&lt;Book&gt;();
}
// Add this to the bottom of Program.cs so the test project can reference it.
// Top level statements make Program internal by default.
//   public partial class Program { }
</code></pre>
