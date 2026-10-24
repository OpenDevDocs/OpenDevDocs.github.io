---
publishDate: 2026-08-28T15:10
title: Unit Testing Controllers
slug: unit-testing-controllers
metadescription: Write fast unit tests for MVC controllers and services with xUnit and Moq, fake dependencies with interfaces, assert on action results and view models, test validation failures by adding model errors, and use the EF Core in memory provider for data logic.
updateDate: 2026-09-14T15:10
author: ['bishal-biswas']
level: 3
tags: ['testing', 'xunit', 'moq']
course: dotnet-mvc
---

## Tests that run in milliseconds

A unit test checks one class in isolation. No web server, no database, no browser. You create the object, call a method, and check the result. Hundreds of them run in a second, so you run them constantly and find mistakes minutes after making them.

Controllers are testable because they are ordinary classes. `new ProductsController(fakeService)` works. The action returns an `IActionResult` you can inspect. This topic shows the tools and the patterns.

## Setting up a test project

```bash
dotnet new xunit -n ShopApp.Tests
cd ShopApp.Tests
dotnet add reference ../ShopApp/ShopApp.csproj
dotnet add package Moq
dotnet add package Microsoft.AspNetCore.Mvc.Core
```

xUnit is the test framework. Moq creates fake implementations of interfaces. Run everything with `dotnet test`.

## Your first controller test

Suppose this controller:

```csharp
public class ProductsController : Controller
{
    private readonly IProductService _products;
    public ProductsController(IProductService products) => _products = products;

    public async Task<IActionResult> Details(int id)
    {
        var product = await _products.GetAsync(id);
        if (product is null) return NotFound();
        return View(product);
    }
}
```

The test for the happy path:

```csharp
public class ProductsControllerTests
{
    [Fact]
    public async Task Details_ReturnsView_WithProduct_WhenFound()
    {
        // Arrange
        var service = new Mock<IProductService>();
        service.Setup(s => s.GetAsync(5)).ReturnsAsync(new Product { Id = 5, Name = "Keyboard" });
        var controller = new ProductsController(service.Object);

        // Act
        var result = await controller.Details(5);

        // Assert
        var view = Assert.IsType<ViewResult>(result);
        var model = Assert.IsType<Product>(view.Model);
        Assert.Equal("Keyboard", model.Name);
    }

    [Fact]
    public async Task Details_ReturnsNotFound_WhenMissing()
    {
        var service = new Mock<IProductService>();
        service.Setup(s => s.GetAsync(99)).ReturnsAsync((Product?)null);
        var controller = new ProductsController(service.Object);

        var result = await controller.Details(99);

        Assert.IsType<NotFoundResult>(result);
    }
}
```

The pattern is **Arrange, Act, Assert**. Set up the fake and the controller, call the action, check the result type and its contents.

`Assert.IsType<T>` both checks the type and returns the cast value, which is why it is used twice in a row.

## What the fake does

`new Mock<IProductService>()` creates an object that implements the interface but does nothing. `Setup(...).ReturnsAsync(...)` teaches it one answer. `service.Object` is the fake to pass to the controller.

This is why controllers should depend on interfaces. A controller that uses `AppDbContext` directly cannot be tested this way, because you cannot fake a concrete class easily.

## Testing a POST

The POST action has three paths: invalid model, success, and sometimes a business failure:

```csharp
[HttpPost]
public async Task<IActionResult> Create(CreateProductViewModel vm)
{
    if (!ModelState.IsValid) return View(vm);

    await _products.CreateAsync(vm);
    return RedirectToAction(nameof(Index));
}
```

Validation attributes do **not** run in a unit test, because model binding is not involved. To test the invalid path, add an error yourself:

```csharp
[Fact]
public async Task Create_ReturnsView_WhenModelInvalid()
{
    var service = new Mock<IProductService>();
    var controller = new ProductsController(service.Object);
    controller.ModelState.AddModelError("Name", "Required");

    var result = await controller.Create(new CreateProductViewModel());

    Assert.IsType<ViewResult>(result);
    service.Verify(s => s.CreateAsync(It.IsAny<CreateProductViewModel>()), Times.Never);
}

[Fact]
public async Task Create_Redirects_WhenValid()
{
    var service = new Mock<IProductService>();
    var controller = new ProductsController(service.Object);
    var vm = new CreateProductViewModel { Name = "Mouse", Price = 20 };

    var result = await controller.Create(vm);

    var redirect = Assert.IsType<RedirectToActionResult>(result);
    Assert.Equal("Index", redirect.ActionName);
    service.Verify(s => s.CreateAsync(vm), Times.Once);
}
```

`Verify` checks that the fake was called, or not called, as expected. That is how you prove the controller did not save invalid data.

## Controllers that use User, TempData or Url

Some actions read `User`, write `TempData` or call `Url.Action`. In a test those are null until you set them up:

```csharp
var controller = new OrdersController(service.Object);

// A logged in user with an id claim
var claims = new[] { new Claim(ClaimTypes.NameIdentifier, "user-1") };
var identity = new ClaimsIdentity(claims, "Test");
controller.ControllerContext = new ControllerContext
{
    HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
};

// TempData
controller.TempData = new TempDataDictionary(controller.HttpContext, Mock.Of<ITempDataProvider>());

// Url helper
var url = new Mock<IUrlHelper>();
url.Setup(u => u.Action(It.IsAny<UrlActionContext>())).Returns("/fake");
controller.Url = url.Object;
```

Put this in a helper method so tests stay short. If a controller needs a lot of this, it is a hint that logic should move into a service.

## Testing services

Services hold the business rules, so they deserve the most tests. They have no MVC dependencies, which makes them easy:

```csharp
[Fact]
public async Task PlaceOrder_Throws_WhenStockIsLow()
{
    var products = new Mock<IProductRepository>();
    products.Setup(r => r.GetAsync(1)).ReturnsAsync(new Product { Id = 1, Name = "Mouse", Stock = 1 });
    var orders = new Mock<IOrderRepository>();
    var email = new Mock<IEmailSender>();
    var service = new OrderService(products.Object, orders.Object, email.Object);

    var lines = new List<CartLine> { new() { ProductId = 1, Quantity = 5 } };

    var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.PlaceOrderAsync("c1", lines));
    Assert.Contains("stock", ex.Message, StringComparison.OrdinalIgnoreCase);
    email.Verify(e => e.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
}
```

## Testing code that uses DbContext

For classes that query EF Core directly, the in memory provider gives a real `DbContext` without a database:

```bash
dotnet add package Microsoft.EntityFrameworkCore.InMemory
```

```csharp
private static AppDbContext CreateContext()
{
    var options = new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .Options;
    return new AppDbContext(options);
}

[Fact]
public async Task Search_FindsByPartialName()
{
    using var db = CreateContext();
    db.Products.AddRange(new Product { Name = "Keyboard" }, new Product { Name = "Mouse" });
    await db.SaveChangesAsync();
    var repo = new EfProductRepository(db);

    var results = await repo.SearchAsync("key");

    Assert.Single(results);
    Assert.Equal("Keyboard", results[0].Name);
}
```

A new database name per test keeps them independent. The in memory provider is not a real relational database: no constraints, different case sensitivity, no raw SQL. Use it for query logic, and use the integration tests from the next topic for anything that must match the real database.

## Naming and organisation

Name tests as `Method_Expected_WhenCondition`. Group by class under test. Keep each test focused on one behaviour. When a test needs ten lines of setup, extract a builder or a helper.

## Quick recap

- Unit tests create a controller or service directly, call a method, and inspect the result, with no server or database.
- Use Moq to fake interfaces and `Verify` to check what was called.
- Assert on result types with `Assert.IsType<ViewResult>` and check the model or redirect target.
- Validation does not run in unit tests, so add model errors by hand to test the invalid path.
- Set up `ControllerContext`, `TempData` and `Url` when an action uses them.
- Test services most, and use the EF Core in memory provider for data access logic.

<code id="code-content" class="language-csharp">
// ShopApp.Tests/Controllers/ProductsControllerTests.cs
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Moq;
using Xunit;

public class ProductsControllerTests
{
    private readonly Mock&lt;IProductService&gt; _service = new();

    private ProductsController CreateController(string? userId = null)
    {
        var controller = new ProductsController(_service.Object);

        var claims = userId is null ? Array.Empty&lt;Claim&gt;() : new[] { new Claim(ClaimTypes.NameIdentifier, userId) };
        var identity = new ClaimsIdentity(claims, userId is null ? null : "Test");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
        controller.TempData = new TempDataDictionary(controller.HttpContext, Mock.Of&lt;ITempDataProvider&gt;());
        return controller;
    }

    [Fact]
    public async Task Details_ReturnsView_WithProduct_WhenFound()
    {
        _service.Setup(s =&gt; s.GetAsync(5)).ReturnsAsync(new Product { Id = 5, Name = "Keyboard" });
        var controller = CreateController();

        var result = await controller.Details(5);

        var view = Assert.IsType&lt;ViewResult&gt;(result);
        var model = Assert.IsType&lt;Product&gt;(view.Model);
        Assert.Equal("Keyboard", model.Name);
    }

    [Fact]
    public async Task Details_ReturnsNotFound_WhenMissing()
    {
        _service.Setup(s =&gt; s.GetAsync(99)).ReturnsAsync((Product?)null);
        var controller = CreateController();

        var result = await controller.Details(99);

        Assert.IsType&lt;NotFoundResult&gt;(result);
    }

    [Fact]
    public async Task Create_ReturnsView_AndDoesNotSave_WhenModelInvalid()
    {
        var controller = CreateController("user-1");
        controller.ModelState.AddModelError("Name", "Required");
        var vm = new CreateProductViewModel();

        var result = await controller.Create(vm);

        var view = Assert.IsType&lt;ViewResult&gt;(result);
        Assert.Same(vm, view.Model);
        _service.Verify(s =&gt; s.CreateAsync(It.IsAny&lt;CreateProductViewModel&gt;()), Times.Never);
    }

    [Fact]
    public async Task Create_Saves_SetsMessage_AndRedirects_WhenValid()
    {
        var controller = CreateController("user-1");
        var vm = new CreateProductViewModel { Name = "Mouse", Price = 20 };

        var result = await controller.Create(vm);

        var redirect = Assert.IsType&lt;RedirectToActionResult&gt;(result);
        Assert.Equal("Index", redirect.ActionName);
        Assert.Equal("Mouse was created.", controller.TempData["Success"]);
        _service.Verify(s =&gt; s.CreateAsync(vm), Times.Once);
    }
}

// ShopApp.Tests/Services/OrderServiceTests.cs
public class OrderServiceTests
{
    [Fact]
    public async Task PlaceOrder_Throws_WhenStockIsLow()
    {
        var products = new Mock&lt;IProductRepository&gt;();
        products.Setup(r =&gt; r.GetAsync(1)).ReturnsAsync(new Product { Id = 1, Name = "Mouse", Stock = 1, Price = 20 });
        var orders = new Mock&lt;IOrderRepository&gt;();
        var email = new Mock&lt;IEmailSender&gt;();
        var service = new OrderService(products.Object, orders.Object, email.Object);
        var lines = new List&lt;CartLine&gt; { new() { ProductId = 1, Quantity = 5 } };

        var ex = await Assert.ThrowsAsync&lt;InvalidOperationException&gt;(() =&gt; service.PlaceOrderAsync("c1", lines));

        Assert.Contains("stock", ex.Message, StringComparison.OrdinalIgnoreCase);
        orders.Verify(o =&gt; o.AddAsync(It.IsAny&lt;Order&gt;()), Times.Never);
    }

    [Fact]
    public async Task PlaceOrder_ReducesStock_AndSendsEmail_WhenValid()
    {
        var product = new Product { Id = 1, Name = "Mouse", Stock = 10, Price = 20 };
        var products = new Mock&lt;IProductRepository&gt;();
        products.Setup(r =&gt; r.GetAsync(1)).ReturnsAsync(product);
        var orders = new Mock&lt;IOrderRepository&gt;();
        var email = new Mock&lt;IEmailSender&gt;();
        var service = new OrderService(products.Object, orders.Object, email.Object);

        var order = await service.PlaceOrderAsync("c1", new List&lt;CartLine&gt; { new() { ProductId = 1, Quantity = 3 } });

        Assert.Equal(7, product.Stock);
        Assert.Single(order.Lines);
        Assert.Equal(60m, order.Lines[0].Quantity * order.Lines[0].UnitPrice);
        email.Verify(e =&gt; e.SendAsync(It.IsAny&lt;string&gt;(), It.IsAny&lt;string&gt;(), It.IsAny&lt;string&gt;()), Times.Once);
    }
}

// ShopApp.Tests/Repositories/EfProductRepositoryTests.cs
using Microsoft.EntityFrameworkCore;

public class EfProductRepositoryTests
{
    private static AppDbContext CreateContext() =&gt;
        new(new DbContextOptionsBuilder&lt;AppDbContext&gt;()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    [Fact]
    public async Task Search_FindsByPartialName_CaseInsensitive()
    {
        using var db = CreateContext();
        db.Products.AddRange(new Product { Name = "Keyboard" }, new Product { Name = "Mouse" });
        await db.SaveChangesAsync();
        var repo = new EfProductRepository(db);

        var results = await repo.SearchAsync("key");

        Assert.Single(results);
        Assert.Equal("Keyboard", results[0].Name);
    }
}
</code></pre>
