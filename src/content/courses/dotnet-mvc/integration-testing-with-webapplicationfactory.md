---
publishDate: 2026-08-28T15:20
title: Integration Testing with WebApplicationFactory
slug: integration-testing-with-webapplicationfactory
metadescription: Test the whole app end to end in memory with WebApplicationFactory, send real HTTP requests with HttpClient, swap the database for a test one, seed data, post forms with anti forgery tokens, and authenticate test requests.
updateDate: 2026-09-14T15:20
author: ['bishal-biswas']
level: 4
tags: ['testing', 'integration-tests', 'webapplicationfactory']
course: dotnet-mvc
---

## Testing the real thing

Unit tests prove a class works in isolation. They do not prove that routing finds the action, that model binding fills the view model, that the filter runs, that the view renders, or that the SQL EF Core generates actually works against the database.

**Integration tests** do. They start the whole app in memory, send real HTTP requests to it, and check the responses. No browser and no network, so they are still fast, usually well under a second each.

`WebApplicationFactory<T>` is the class that makes this possible.

## Setting up

Create a test project and add the package:

```bash
dotnet new xunit -n ShopApp.IntegrationTests
cd ShopApp.IntegrationTests
dotnet add reference ../ShopApp/ShopApp.csproj
dotnet add package Microsoft.AspNetCore.Mvc.Testing
```

The factory needs to find your app's `Program` class. Because top level statements make it invisible, add one line at the bottom of `Program.cs` in the web project:

```csharp
public partial class Program { }
```

## The first test

```csharp
public class HomePageTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HomePageTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Home_ReturnsSuccess_AndHtml()
    {
        var response = await _client.GetAsync("/");

        response.EnsureSuccessStatusCode();
        Assert.Equal("text/html; charset=utf-8", response.Content.Headers.ContentType?.ToString());

        var html = await response.Content.ReadAsStringAsync();
        Assert.Contains("Welcome", html);
    }
}
```

`IClassFixture` makes xUnit create one factory for all tests in the class, so the app starts once. `CreateClient` gives an `HttpClient` wired straight into the in memory server. Every middleware, filter, controller and view runs exactly as in production.

## Swapping the database

Tests must not touch the real database. Override the factory to replace the `DbContext` registration:

```csharp
public class ShopWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            var descriptor = services.Single(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));
            services.Remove(descriptor);

            services.AddDbContext<AppDbContext>(o => o.UseSqlite("DataSource=:memory:"));
        });
    }
}
```

SQLite in memory mode is a real relational database with constraints and SQL, much closer to production than the EF in memory provider. It only lives as long as one open connection, so open the connection once and keep it:

```csharp
private readonly SqliteConnection _connection = new("DataSource=:memory:");

protected override void ConfigureWebHost(IWebHostBuilder builder)
{
    _connection.Open();
    builder.ConfigureServices(services =>
    {
        // remove the existing registration as above
        services.AddDbContext<AppDbContext>(o => o.UseSqlite(_connection));
    });
}
```

Then create the schema and seed data once the app has started:

```csharp
using var scope = Services.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
db.Database.EnsureCreated();
db.Products.Add(new Product { Name = "Keyboard", Price = 50 });
db.SaveChanges();
```

Tests use `ShopWebApplicationFactory` instead of the plain one.

## Testing a page with data

```csharp
[Fact]
public async Task ProductList_ShowsSeededProduct()
{
    var response = await _client.GetAsync("/Products");
    var html = await response.Content.ReadAsStringAsync();

    Assert.Contains("Keyboard", html);
}

[Fact]
public async Task ProductDetails_Returns404_ForUnknownId()
{
    var response = await _client.GetAsync("/Products/Details/9999");

    Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
}
```

For anything more than a `Contains`, parse the HTML with a library such as AngleSharp so you can query elements by selector.

## Posting a form

A POST needs the anti forgery token, which means fetching the form first, pulling the token and cookie out of it, and sending them back:

```csharp
[Fact]
public async Task CreateProduct_Redirects_AndSaves()
{
    var page = await _client.GetAsync("/Products/Create");
    var html = await page.Content.ReadAsStringAsync();
    var token = ExtractToken(html);

    var form = new Dictionary<string, string>
    {
        ["__RequestVerificationToken"] = token,
        ["Name"] = "Mouse",
        ["Price"] = "20"
    };

    var response = await _client.PostAsync("/Products/Create", new FormUrlEncodedContent(form));

    Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
    Assert.Equal("/Products", response.Headers.Location?.ToString());
}
```

`ExtractToken` is a small regex over the hidden input. The client created by the factory keeps cookies between requests by default, so the token cookie from the GET is sent with the POST.

Create the client with `AllowAutoRedirect = false` so you can assert on the redirect rather than following it:

```csharp
_client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
```

## Authenticated requests

Pages behind `[Authorize]` redirect to login. Rather than logging in through the form in every test, add a test authentication scheme that treats every request as a chosen user:

```csharp
public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : base(options, logger, encoder) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-user"),
            new Claim(ClaimTypes.Name, "Test User"),
            new Claim(ClaimTypes.Role, "Admin")
        };
        var identity = new ClaimsIdentity(claims, "Test");
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), "Test");
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
```

Register it in the factory as the default scheme:

```csharp
services.AddAuthentication("Test")
    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", _ => { });
```

Now every request is an authenticated admin. For tests of the anonymous path, use a second factory without the handler, or make the handler read a header to decide which user to be.

## Replacing external services

The factory can swap any service. Replace the real email sender with a fake that records what was sent:

```csharp
services.RemoveAll<IEmailSender>();
services.AddSingleton<IEmailSender, FakeEmailSender>();
```

```csharp
var email = factory.Services.GetRequiredService<IEmailSender>() as FakeEmailSender;
Assert.Single(email!.Sent);
```

Anything that calls the outside world, such as payment gateways or HTTP APIs, should be replaced this way so tests are fast and repeatable.

## Keeping tests independent

Each test should start from known data. Options, from simplest to most thorough:

- One shared seeded database per test class, with tests that only read.
- Reset the tables in the constructor of each test class.
- A fresh factory per test, which is slower but fully isolated.

Avoid tests that depend on the order they run in.

## Where integration tests fit

Write integration tests for the paths that matter most: the main pages load, the key forms save, protected pages require login, and error pages appear. Keep the count modest. Unit tests cover the detailed branches, and integration tests prove the pieces fit together.

## Quick recap

- `WebApplicationFactory<Program>` starts the app in memory and gives an `HttpClient` that sends real requests through the full pipeline.
- Add `public partial class Program { }` so the factory can find the app.
- Override `ConfigureWebHost` to swap the database for SQLite in memory and replace external services with fakes.
- Fetch the form first to get the anti forgery token before posting, and turn off auto redirect to assert on redirects.
- Add a test authentication handler to make requests as a chosen user.
- Cover the main pages, forms and protected routes, and leave detailed branches to unit tests.

<code id="code-content" class="language-csharp">
// ShopApp/Program.cs (last line, so tests can reference the entry point)
public partial class Program { }

// ShopApp.IntegrationTests/ShopWebApplicationFactory.cs
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

public class ShopWebApplicationFactory : WebApplicationFactory&lt;Program&gt;
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    public FakeEmailSender Email { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        _connection.Open();
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =&gt;
        {
            services.RemoveAll(typeof(DbContextOptions&lt;AppDbContext&gt;));
            services.AddDbContext&lt;AppDbContext&gt;(o =&gt; o.UseSqlite(_connection));

            services.RemoveAll&lt;IEmailSender&gt;();
            services.AddSingleton&lt;IEmailSender&gt;(Email);

            services.AddAuthentication("Test")
                .AddScheme&lt;AuthenticationSchemeOptions, TestAuthHandler&gt;("Test", _ =&gt; { });
        });
    }

    public void SeedDatabase()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService&lt;AppDbContext&gt;();
        db.Database.EnsureCreated();
        if (!db.Products.Any())
        {
            db.Products.AddRange(
                new Product { Name = "Keyboard", Price = 50 },
                new Product { Name = "Mouse", Price = 20 });
            db.SaveChanges();
        }
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        _connection.Dispose();
    }
}

public class TestAuthHandler : AuthenticationHandler&lt;AuthenticationSchemeOptions&gt;
{
    public TestAuthHandler(IOptionsMonitor&lt;AuthenticationSchemeOptions&gt; options, ILoggerFactory logger, UrlEncoder encoder)
        : base(options, logger, encoder) { }

    protected override Task&lt;AuthenticateResult&gt; HandleAuthenticateAsync()
    {
        if (Request.Headers.ContainsKey("X-Anonymous"))
            return Task.FromResult(AuthenticateResult.NoResult());

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-user"),
            new Claim(ClaimTypes.Name, "Test User"),
            new Claim(ClaimTypes.Role, "Admin")
        };
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(new ClaimsIdentity(claims, "Test")), "Test");
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}

public class FakeEmailSender : IEmailSender
{
    public List&lt;(string To, string Subject)&gt; Sent { get; } = new();
    public Task SendAsync(string to, string subject, string body)
    {
        Sent.Add((to, subject));
        return Task.CompletedTask;
    }
}

// ShopApp.IntegrationTests/ProductsTests.cs
using System.Net;
using System.Text.RegularExpressions;
using Xunit;

public class ProductsTests : IClassFixture&lt;ShopWebApplicationFactory&gt;
{
    private readonly ShopWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public ProductsTests(ShopWebApplicationFactory factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
    }

    [Fact]
    public async Task Index_ListsSeededProducts()
    {
        var response = await _client.GetAsync("/Products");
        response.EnsureSuccessStatusCode();
        var html = await response.Content.ReadAsStringAsync();
        Assert.Contains("Keyboard", html);
        Assert.Contains("Mouse", html);
    }

    [Fact]
    public async Task Details_Returns404_ForUnknownProduct()
    {
        var response = await _client.GetAsync("/Products/Details/9999");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Create_RedirectsToLogin_WhenAnonymous()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/Products/Create");
        request.Headers.Add("X-Anonymous", "1");

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.StartsWith("/Account/Login", response.Headers.Location?.ToString());
    }

    [Fact]
    public async Task Create_SavesProduct_AndRedirects()
    {
        var page = await _client.GetAsync("/Products/Create");
        var html = await page.Content.ReadAsStringAsync();
        var token = Regex.Match(html, "name=\"__RequestVerificationToken\" type=\"hidden\" value=\"([^\"]+)\"").Groups[1].Value;

        var form = new Dictionary&lt;string, string&gt;
        {
            ["__RequestVerificationToken"] = token,
            ["Name"] = "Monitor",
            ["Price"] = "250"
        };
        var response = await _client.PostAsync("/Products/Create", new FormUrlEncodedContent(form));

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("/Products", response.Headers.Location?.ToString());

        var list = await (await _client.GetAsync("/Products")).Content.ReadAsStringAsync();
        Assert.Contains("Monitor", list);
    }

    [Fact]
    public async Task Create_ShowsErrors_WhenInvalid()
    {
        var page = await _client.GetAsync("/Products/Create");
        var html = await page.Content.ReadAsStringAsync();
        var token = Regex.Match(html, "name=\"__RequestVerificationToken\" type=\"hidden\" value=\"([^\"]+)\"").Groups[1].Value;

        var form = new Dictionary&lt;string, string&gt; { ["__RequestVerificationToken"] = token, ["Name"] = "", ["Price"] = "-1" };
        var response = await _client.PostAsync("/Products/Create", new FormUrlEncodedContent(form));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("field-validation-error", body);
    }
}
</code></pre>
