---
publishDate: 2026-09-28T18:30
title: Unit Testing Controllers
slug: unit-testing-controllers
metadescription: Write fast unit tests for controllers and services with xUnit, use fakes and Moq for dependencies, assert on action results, and know what is worth unit testing.
updateDate: 2026-09-07T18:30
author: ['bishal-biswas']
level: 3
tags: ['testing', 'xunit', 'moq']
course: dotnet-webapi
---

## Setting up a test project

```bash
dotnet new xunit -n BookStore.Tests
dotnet add BookStore.Tests reference BookStore.Api
dotnet sln add BookStore.Tests

dotnet add BookStore.Tests package Moq
dotnet add BookStore.Tests package FluentAssertions
```

```bash
dotnet test
```

xUnit is the default in .NET and the one most examples use. NUnit and MSTest work just as well.

## The basic shape

Arrange, act, assert:

```csharp
public class BooksControllerTests
{
    [Fact]
    public async Task GetById_returns_404_when_the_book_does_not_exist()
    {
        // Arrange
        var service = new FakeBookService();
        var controller = new BooksController(service);

        // Act
        ActionResult<BookResponse> result = await controller.GetById(999);

        // Assert
        Assert.IsType<NotFoundResult>(result.Result);
    }
}
```

`[Fact]` is a test with no parameters. `[Theory]` with `[InlineData]` runs the same test several times:

```csharp
[Theory]
[InlineData(0)]
[InlineData(-1)]
[InlineData(int.MinValue)]
public async Task GetById_rejects_a_non_positive_id(int id)
{
    var controller = new BooksController(new FakeBookService());

    ActionResult<BookResponse> result = await controller.GetById(id);

    Assert.IsType<BadRequestObjectResult>(result.Result);
}
```

## Asserting on ActionResult of T

This trips people up, because there are two places the value can be.

```csharp
public ActionResult<BookResponse> GetById(int id)
{
    if (book is null) return NotFound();     // lands in result.Result
    return response;                          // lands in result.Value
}
```

So:

```csharp
// When the action returned a status helper
ActionResult<BookResponse> result = await controller.GetById(999);
Assert.IsType<NotFoundResult>(result.Result);

// When the action returned the value directly
ActionResult<BookResponse> result = await controller.GetById(1);
Assert.NotNull(result.Value);
Assert.Equal("Clean Code", result.Value!.Title);

// When it returned Ok(value), the value is inside an OkObjectResult
var ok = Assert.IsType<OkObjectResult>(result.Result);
var response = Assert.IsType<BookResponse>(ok.Value);
Assert.Equal("Clean Code", response.Title);
```

Checking `result.Value` when the action used `Ok(...)` gives you a confusing null. Know which style the action uses.

## Fakes versus mocks

Two ways to supply a dependency.

**A fake** is a small real implementation you write once:

```csharp
public class FakeBookService : IBookService
{
    public List<Book> Books { get; } = new();

    public Task<Book?> GetByIdAsync(int id, CancellationToken ct = default)
        => Task.FromResult(Books.FirstOrDefault(b => b.Id == id));

    public Task<Book> CreateAsync(CreateBookRequest request, CancellationToken ct = default)
    {
        var book = new Book { Id = Books.Count + 1, Title = request.Title };
        Books.Add(book);
        return Task.FromResult(book);
    }
}
```

```csharp
var service = new FakeBookService();
service.Books.Add(new Book { Id = 1, Title = "Clean Code" });

var controller = new BooksController(service);
```

Readable, reusable, and the compiler tells you when the interface changes.

**A mock** is generated per test:

```csharp
var service = new Mock<IBookService>();

service.Setup(s => s.GetByIdAsync(1, It.IsAny<CancellationToken>()))
       .ReturnsAsync(new Book { Id = 1, Title = "Clean Code" });

var controller = new BooksController(service.Object);
```

Quicker for a one off, and it lets you verify interactions:

```csharp
service.Verify(s => s.SendEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
```

A reasonable rule: **fakes for things used in many tests, mocks for one off setups and interaction checks.** Do not mock a type you own and could easily fake.

Never mock a `DbContext`. It is a big class with intricate behaviour, and the mock ends up testing your mock. Test the repository or service against a real database in an integration test instead.

## Testing controllers that use HttpContext

`User`, `Request` and `Response` come from `ControllerContext`, which is null in a unit test. Set it up:

```csharp
private static BooksController CreateController(IBookService service, string? userId = "42")
{
    var claims = new List<Claim>();

    if (userId is not null)
    {
        claims.Add(new Claim("sub", userId));
        claims.Add(new Claim(ClaimTypes.Role, "Editor"));
    }

    var user = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));

    return new BooksController(service)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        }
    };
}
```

`DefaultHttpContext` gives you a working `Request`, `Response` and `Items` with no server.

If the action writes a response header, give the response a body stream:

```csharp
var context = new DefaultHttpContext();
context.Response.Body = new MemoryStream();
```

## Testing validation

`[ApiController]` validation runs in the framework, **not** in your action. A unit test calling the method directly bypasses it entirely.

So a test like this proves nothing:

```csharp
// Passes, but the framework would have returned 400 long before this ran
var result = await controller.Create(new CreateBookRequest("", 1999));
```

Two options. Test the validation rules directly:

```csharp
[Fact]
public void Title_is_required()
{
    var request = new CreateBookRequest { Title = "", Year = 1999 };
    var results = new List<ValidationResult>();

    bool valid = Validator.TryValidateObject(
        request, new ValidationContext(request), results, validateAllProperties: true);

    Assert.False(valid);
    Assert.Contains(results, r => r.MemberNames.Contains("Title"));
}
```

Or test the endpoint end to end with `WebApplicationFactory`, which does run the framework. That is the next topic, and it is the better answer for validation.

If your action reads `ModelState`, you can add errors manually:

```csharp
controller.ModelState.AddModelError("Title", "Title is required.");
```

## What is actually worth unit testing

Being honest here saves a lot of wasted effort.

A thin controller does almost nothing:

```csharp
[HttpGet("{id:int}")]
public async Task<ActionResult<BookResponse>> GetById(int id, CancellationToken ct)
    => await service.GetByIdAsync(id, ct) is BookResponse dto ? dto : NotFound();
```

A unit test for that mostly asserts that a mock returns what you told it to. Low value.

**High value unit tests:**

- **Service and domain logic.** Pricing rules, discounts, state transitions, validators. Real logic, no dependencies, fast tests.
- **Non trivial mapping.** Anything with a condition or a calculation in it.
- **Controllers with branching.** An action that checks ownership, chooses between status codes, or handles several outcomes.
- **Bug fixes.** Write the failing test first, then fix it. That one test earns its keep forever.

**Low value unit tests:**

- Pass through controllers.
- Anything that mainly asserts a mock was configured correctly.
- Repository methods that only call `DbSet`, since a unit test of those tests EF Core, not you.

The strongest signal that a controller is worth testing is that its test is interesting to write. If the test is boring, so is the code, and an integration test covers it better.

## FluentAssertions

Optional, and it makes failures much easier to read:

```csharp
result.Result.Should().BeOfType<NotFoundResult>();

response.Should().BeEquivalentTo(new BookResponse(1, "Clean Code", 34.99m));

books.Should().HaveCount(3)
     .And.OnlyContain(b => b.Year > 2000)
     .And.BeInAscendingOrder(b => b.Title);
```

A failure tells you what differed, not just that something did.

## Naming and organising

Name a test after the behaviour it describes:

```csharp
GetById_returns_404_when_the_book_does_not_exist()
Create_returns_409_when_the_isbn_is_already_registered()
CalculateTotal_applies_the_bulk_discount_above_500()
```

When one fails in CI, the name alone should tell you what broke.

Group by the class under test, and keep the folder structure mirroring the project:

```text
BookStore.Tests/
├── Controllers/
│   └── BooksControllerTests.cs
├── Services/
│   ├── PricingServiceTests.cs
│   └── OrderServiceTests.cs
└── Fakes/
    └── FakeBookService.cs
```

## Quick recap

- `dotnet new xunit`, reference the API project, and `dotnet test` runs them.
- `[Fact]` for one case, `[Theory]` with `[InlineData]` for several.
- With `ActionResult<T>`, a status helper lands in `result.Result` and a direct return in `result.Value`.
- Use fakes for dependencies used across many tests, mocks for one off setups and verification.
- Never mock a `DbContext`. Test data access with a real database in an integration test.
- Set `ControllerContext` with a `DefaultHttpContext` when the action reads `User` or `Request`.
- `[ApiController]` validation does not run in a unit test. Test the rules directly or use an integration test.
- Unit test business logic and branching controllers. Skip pass through actions.
- Write a failing test for every bug before fixing it.
- Name tests after the behaviour, so a CI failure explains itself.

<code id="code-content" class="language-csharp">
// A test class covering the cases that are actually worth unit testing.
// dotnet add package Moq FluentAssertions
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;
public class BooksControllerTests
{
    // A FAKE: written once, reused everywhere, and the compiler tells us when
    // IBookService changes. Better than a mock for anything used repeatedly.
    private class FakeBookService : IBookService
    {
        public List&lt;Book&gt; Books { get; } = new();
        public int SaveCount { get; private set; }
        public Task&lt;Book?&gt; GetByIdAsync(int id, CancellationToken ct = default) =&gt;
            Task.FromResult(Books.FirstOrDefault(b =&gt; b.Id == id));
        public Task&lt;bool&gt; IsbnExistsAsync(string isbn, CancellationToken ct = default) =&gt;
            Task.FromResult(Books.Any(b =&gt; b.Isbn == isbn));
        public Task&lt;Book&gt; CreateAsync(CreateBookRequest request, string ownerId, CancellationToken ct = default)
        {
            var book = new Book
            {
                Id = Books.Count + 1, Title = request.Title,
                Isbn = request.Isbn, OwnerId = ownerId
            };
            Books.Add(book);
            SaveCount++;
            return Task.FromResult(book);
        }
    }
    // ControllerContext is null in a unit test, so User and Request throw.
    // DefaultHttpContext gives us working ones with no server.
    private static BooksController CreateController(IBookService service, string? userId = "42")
    {
        var claims = new List&lt;Claim&gt;();
        if (userId is not null)
        {
            claims.Add(new Claim("sub", userId));
            claims.Add(new Claim(ClaimTypes.Role, "Editor"));
        }
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
        };
        context.Response.Body = new MemoryStream();     // needed if the action writes headers
        return new BooksController(service) { ControllerContext = new ControllerContext { HttpContext = context } };
    }
    [Fact]
    public async Task GetById_returns_404_when_the_book_does_not_exist()
    {
        BooksController controller = CreateController(new FakeBookService());
        ActionResult&lt;Book&gt; result = await controller.GetById(999);
        // A status helper lands in .Result. A direct return lands in .Value.
        result.Result.Should().BeOfType&lt;NotFoundResult&gt;();
    }
    [Fact]
    public async Task GetById_returns_the_book_when_it_exists()
    {
        var service = new FakeBookService();
        service.Books.Add(new Book { Id = 1, Title = "Clean Code", OwnerId = "42" });
        ActionResult&lt;Book&gt; result = await CreateController(service).GetById(1);
        result.Value.Should().NotBeNull();
        result.Value!.Title.Should().Be("Clean Code");
    }
    // Branching on the current user: exactly the kind of controller logic worth testing
    [Fact]
    public async Task GetById_returns_404_for_a_book_owned_by_someone_else()
    {
        var service = new FakeBookService();
        service.Books.Add(new Book { Id = 1, Title = "Private", OwnerId = "99" });
        // 404 rather than 403: a 403 would confirm the book exists
        ActionResult&lt;Book&gt; result = await CreateController(service, userId: "42").GetById(1);
        result.Result.Should().BeOfType&lt;NotFoundResult&gt;();
    }
    [Fact]
    public async Task Create_returns_409_when_the_isbn_is_already_registered()
    {
        var service = new FakeBookService();
        service.Books.Add(new Book { Id = 1, Isbn = "9780132350884" });
        BooksController controller = CreateController(service);
        ActionResult&lt;Book&gt; result = await controller.Create(
            new CreateBookRequest { Title = "Duplicate", Isbn = "9780132350884", Year = 2008 });
        result.Result.Should().BeOfType&lt;ConflictObjectResult&gt;();
        service.SaveCount.Should().Be(0);        // and nothing was written
    }
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(int.MinValue)]
    public async Task GetById_rejects_a_non_positive_id(int id)
    {
        ActionResult&lt;Book&gt; result = await CreateController(new FakeBookService()).GetById(id);
        result.Result.Should().BeOfType&lt;BadRequestObjectResult&gt;();
    }
    // A MOCK: quicker for a one off, and it can verify an interaction happened
    [Fact]
    public async Task Create_saves_exactly_once()
    {
        var service = new Mock&lt;IBookService&gt;();
        service.Setup(s =&gt; s.IsbnExistsAsync(It.IsAny&lt;string&gt;(), It.IsAny&lt;CancellationToken&gt;()))
               .ReturnsAsync(false);
        service.Setup(s =&gt; s.CreateAsync(It.IsAny&lt;CreateBookRequest&gt;(), It.IsAny&lt;string&gt;(), It.IsAny&lt;CancellationToken&gt;()))
               .ReturnsAsync(new Book { Id = 7, Title = "New" });
        var controller = CreateController(service.Object);
        await controller.Create(new CreateBookRequest { Title = "New", Isbn = "9781234567890", Year = 2020 });
        service.Verify(s =&gt; s.CreateAsync(It.IsAny&lt;CreateBookRequest&gt;(), "42", It.IsAny&lt;CancellationToken&gt;()),
                       Times.Once);
    }
    // [ApiController] validation runs in the FRAMEWORK, not in the action, so a
    // unit test calling the method directly bypasses it. Test the rules instead,
    // or cover it with an integration test.
    [Fact]
    public void CreateBookRequest_requires_a_title()
    {
        var request = new CreateBookRequest { Title = "", Isbn = "9781234567890", Year = 1999 };
        var results = new List&lt;ValidationResult&gt;();
        bool valid = Validator.TryValidateObject(
            request, new ValidationContext(request), results, validateAllProperties: true);
        valid.Should().BeFalse();
        results.Should().Contain(r =&gt; r.MemberNames.Contains(nameof(CreateBookRequest.Title)));
    }
}
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private readonly IBookService service;
    public BooksController(IBookService service) =&gt; this.service = service;
    [HttpGet("{id:int}")]
    public async Task&lt;ActionResult&lt;Book&gt;&gt; GetById(int id, CancellationToken ct = default)
    {
        if (id &lt;= 0) return BadRequest(new { error = "Ids start at 1." });
        Book? book = await service.GetByIdAsync(id, ct);
        if (book is null) return NotFound();
        if (book.OwnerId != User.FindFirst("sub")?.Value) return NotFound();
        return book;
    }
    [HttpPost]
    public async Task&lt;ActionResult&lt;Book&gt;&gt; Create([FromBody] CreateBookRequest request, CancellationToken ct = default)
    {
        if (await service.IsbnExistsAsync(request.Isbn, ct))
            return Conflict(new { error = $"ISBN {request.Isbn} is already registered." });
        Book book = await service.CreateAsync(request, User.FindFirst("sub")!.Value, ct);
        return CreatedAtAction(nameof(GetById), new { id = book.Id }, book);
    }
}
public interface IBookService
{
    Task&lt;Book?&gt; GetByIdAsync(int id, CancellationToken ct = default);
    Task&lt;bool&gt; IsbnExistsAsync(string isbn, CancellationToken ct = default);
    Task&lt;Book&gt; CreateAsync(CreateBookRequest request, string ownerId, CancellationToken ct = default);
}
public class Book { public int Id { get; set; } public string Title { get; set; } = "";
                    public string Isbn { get; set; } = ""; public string OwnerId { get; set; } = ""; }
public class CreateBookRequest
{
    [Required, StringLength(200, MinimumLength = 1)] public string Title { get; set; } = "";
    [Required, StringLength(13, MinimumLength = 13)] public string Isbn { get; set; } = "";
    [Range(1000, 2100)]                              public int Year { get; set; }
}
</code></pre>
