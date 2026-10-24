---
publishDate: 2026-09-09T11:50
title: Model Validation with Data Annotations
slug: model-validation-with-data-annotations
metadescription: Validate incoming requests with Required, StringLength, Range and other attributes, customise the 400 response, and write your own validation attribute.
updateDate: 2026-09-07T11:50
author: ['bishal-biswas']
level: 1
tags: ['validation', 'data-annotations', 'requests']
course: dotnet-webapi
---

## Never trust the client

Client side validation is a convenience for the user. It stops nothing. Anyone can send a request with curl and skip your form entirely.

```bash
curl -X POST https://api.example.com/api/books \
  -H "Content-Type: application/json" \
  -d '{"title":"","year":-500,"price":-10}'
```

Server side validation is the only validation that counts. In ASP.NET Core the easiest way to write it is with attributes on your request DTO.

## Your first validated DTO

```csharp
using System.ComponentModel.DataAnnotations;

public class CreateBookRequest
{
    [Required(ErrorMessage = "Title is required.")]
    [StringLength(200, MinimumLength = 1)]
    public string Title { get; set; } = "";

    [Required]
    [StringLength(100)]
    public string Author { get; set; } = "";

    [Range(1000, 2100, ErrorMessage = "Year must be between 1000 and 2100.")]
    public int Year { get; set; }

    [Range(0.01, 10000)]
    public decimal Price { get; set; }
}
```

With `[ApiController]` on the controller, that is all you write. No `if` statements, no manual checks:

```csharp
[HttpPost]
public ActionResult<BookResponse> Create(CreateBookRequest request)
{
    // If we reach this line, the request is already valid.
}
```

A bad request never reaches your method. The client gets this instead:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "Title": ["Title is required."],
    "Year": ["Year must be between 1000 and 2100."],
    "Price": ["The field Price must be between 0.01 and 10000."]
  }
}
```

Every failing field, all at once. That is exactly what a client needs to show a form with three red messages.

## The attributes you will use

**Presence:**

```csharp
[Required]                                     // not null, and not empty for strings
[Required(AllowEmptyStrings = true)]           // not null, empty is fine
```

**Length:**

```csharp
[StringLength(200)]                            // at most 200
[StringLength(200, MinimumLength = 3)]         // between 3 and 200
[MinLength(3)]                                 // strings or collections
[MaxLength(200)]
```

**Numbers:**

```csharp
[Range(1, 100)]
[Range(0.01, 10000)]
[Range(typeof(decimal), "0.01", "10000")]      // exact decimal bounds
```

**Format:**

```csharp
[EmailAddress]
[Url]
[Phone]
[CreditCard]
[RegularExpression(@"^[a-z0-9-]+$", ErrorMessage = "Lowercase letters, digits and dashes only.")]
```

**Comparison:**

```csharp
public string Password { get; set; } = "";

[Compare(nameof(Password), ErrorMessage = "Passwords do not match.")]
public string ConfirmPassword { get; set; } = "";
```

**Display name in messages:**

```csharp
[Display(Name = "Publication year")]
[Range(1000, 2100)]                            // "The field Publication year must be..."
public int Year { get; set; }
```

## Nullable types matter

This trips up almost everyone once. With nullable reference types on, a non nullable `string` property that the client omits becomes `null`, and `[Required]` catches it. Good.

But a value type is different. If the client omits `Year`, an `int` becomes `0`, not null. `[Required]` sees `0`, which is a real value, so it passes.

```csharp
[Required]
public int Year { get; set; }        // does NOT catch a missing year
```

Make it nullable so "missing" is distinguishable from "zero":

```csharp
[Required(ErrorMessage = "Year is required.")]
public int? Year { get; set; }       // catches a missing year correctly
```

Or rely on `[Range]`, which rejects `0` anyway if `0` is outside your valid range. Both work. Be deliberate about which you mean.

## Validating nested objects and collections

Data annotations recurse automatically in ASP.NET Core. Attributes inside a nested class are checked:

```csharp
public class CreateOrderRequest
{
    [Required]
    public AddressDto ShippingAddress { get; set; } = new();

    [Required, MinLength(1, ErrorMessage = "An order needs at least one line.")]
    public List<OrderLineDto> Lines { get; set; } = new();
}

public class AddressDto
{
    [Required, StringLength(100)]
    public string Street { get; set; } = "";

    [Required, RegularExpression(@"^\d{6}$", ErrorMessage = "Postcode must be 6 digits.")]
    public string Postcode { get; set; } = "";
}
```

Errors come back with a path so the client knows which item failed:

```json
{
  "errors": {
    "ShippingAddress.Postcode": ["Postcode must be 6 digits."],
    "Lines[0].Quantity": ["The field Quantity must be between 1 and 999."]
  }
}
```

## Writing a custom attribute

When no built in attribute fits, inherit from `ValidationAttribute`:

```csharp
public class NotInFutureAttribute : ValidationAttribute
{
    protected override ValidationResult? IsValid(object? value, ValidationContext context)
    {
        if (value is null) return ValidationResult.Success;      // let [Required] handle null

        if (value is DateTime date && date > DateTime.UtcNow)
            return new ValidationResult(
                ErrorMessage ?? "The date cannot be in the future.",
                new[] { context.MemberName! });

        return ValidationResult.Success;
    }
}
```

```csharp
[NotInFuture(ErrorMessage = "A publication date cannot be in the future.")]
public DateTime PublishedOn { get; set; }
```

Two habits that make custom attributes behave well. Return `Success` for `null` and let `[Required]` decide whether null is allowed, so the two attributes compose. And pass the member name in the result, so the error lands under the right field.

## Validating across properties

An attribute on one property cannot see another. For rules that span fields, implement `IValidatableObject` on the DTO:

```csharp
public class DateRangeRequest : IValidatableObject
{
    [Required] public DateOnly? From { get; set; }
    [Required] public DateOnly? To { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (From is not null && To is not null && From > To)
            yield return new ValidationResult(
                "From must not be later than To.",
                new[] { nameof(From), nameof(To) });
    }
}
```

`Validate` runs **after** all the attributes pass, so you can assume the individual fields are already valid.

## Customising the 400 response

If the default shape does not suit your clients, replace it:

```csharp
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState
            .Where(e => e.Value?.Errors.Count > 0)
            .ToDictionary(
                e => e.Key,
                e => e.Value!.Errors.Select(x => x.ErrorMessage).ToArray());

        return new BadRequestObjectResult(new
        {
            success = false,
            message = "Validation failed",
            errors
        });
    };
});
```

Do this once, at startup, and every endpoint follows the same shape. Do not hand roll error bodies in individual actions.

## Turning the automatic 400 off

Occasionally you want to inspect `ModelState` yourself:

```csharp
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.SuppressModelStateInvalidFilter = true;
});
```

```csharp
[HttpPost]
public IActionResult Create(CreateBookRequest request)
{
    if (!ModelState.IsValid)
        return ValidationProblem(ModelState);

    // ...
}
```

Rarely worth it. The automatic behaviour is right almost always.

## Minimal APIs need a filter

Data annotations do nothing in a minimal API unless you run them. Use the generic `ValidationFilter<T>` from the endpoint filters topic:

```csharp
app.MapPost("/api/books", (CreateBookRequest request) => Results.Ok(request))
   .AddEndpointFilter<ValidationFilter<CreateBookRequest>>();
```

## What data annotations cannot do

They validate **shape**, not **truth**. They can check that an email looks like an email. They cannot check that it is not already registered, because that needs a database query.

```csharp
// Belongs in the service or the controller, not in an attribute
if (await db.Users.AnyAsync(u => u.Email == request.Email))
    return Conflict(new { error = "That email is already registered." });
```

Rule of thumb: shape rules go in attributes and return `400`. Business rules go in your code and return `409`, `422` or another code that fits.

## Quick recap

- Server side validation is the only validation that counts. Client side is a convenience.
- With `[ApiController]`, failing attributes return `400` with every error, before your action runs.
- `[Required]`, `[StringLength]`, `[Range]`, `[EmailAddress]` and `[RegularExpression]` cover most needs.
- `[Required]` cannot detect a missing value type. Use `int?` when absent and zero must differ.
- Nested objects and collections are validated automatically, with paths such as `Lines[0].Quantity`.
- Inherit `ValidationAttribute` for one field, and implement `IValidatableObject` for rules across fields.
- Customise the `400` shape once through `InvalidModelStateResponseFactory`.
- Minimal APIs need an endpoint filter to run data annotations at all.
- Attributes check shape. Uniqueness and other business rules belong in your service.

<code id="code-content" class="language-csharp">
// Validated DTOs plus a custom attribute, a cross field rule, and a customised 400.
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
// One place decides what every validation failure looks like
builder.Services.Configure&lt;ApiBehaviorOptions&gt;(options =&gt;
{
    options.InvalidModelStateResponseFactory = context =&gt;
    {
        var errors = context.ModelState
            .Where(e =&gt; e.Value?.Errors.Count &gt; 0)
            .ToDictionary(e =&gt; e.Key,
                          e =&gt; e.Value!.Errors.Select(x =&gt; x.ErrorMessage).ToArray());
        return new BadRequestObjectResult(new
        {
            success = false,
            message = "Validation failed",
            errors,
            traceId = context.HttpContext.TraceIdentifier
        });
    };
});
var app = builder.Build();
app.MapControllers();
app.Run();
// ---------- The request DTO. IValidatableObject adds the cross field rule.
public class CreateBookRequest : IValidatableObject
{
    [Required(ErrorMessage = "Title is required.")]
    [StringLength(200, MinimumLength = 1)]
    public string Title { get; set; } = "";
    [Required]
    [StringLength(100)]
    public string Author { get; set; } = "";
    // int? not int: with a plain int, an omitted year arrives as 0 and [Required] passes it
    [Required(ErrorMessage = "Year is required.")]
    [Range(1000, 2100, ErrorMessage = "Year must be between 1000 and 2100.")]
    public int? Year { get; set; }
    [Range(0.01, 10000)]
    public decimal Price { get; set; }
    [Required, EmailAddress]
    public string ContactEmail { get; set; } = "";
    [RegularExpression(@"^[a-z0-9-]+$", ErrorMessage = "Lowercase letters, digits and dashes only.")]
    public string Slug { get; set; } = "";
    [NotInFuture(ErrorMessage = "A publication date cannot be in the future.")]
    public DateTime PublishedOn { get; set; }
    // Nested objects and lists are validated automatically, with paths in the error keys
    [Required, MinLength(1, ErrorMessage = "At least one format is required.")]
    public List&lt;FormatDto&gt; Formats { get; set; } = new();
    // Runs only after every attribute above has passed
    public IEnumerable&lt;ValidationResult&gt; Validate(ValidationContext context)
    {
        if (Year is not null &amp;&amp; PublishedOn != default &amp;&amp; PublishedOn.Year != Year)
            yield return new ValidationResult(
                "PublishedOn must fall inside the stated year.",
                new[] { nameof(PublishedOn), nameof(Year) });
    }
}
public class FormatDto
{
    [Required, StringLength(20)] public string Name { get; set; } = "";   // "Paperback"
    [Range(1, 999)]              public int Stock { get; set; }
}
// ---------- A custom attribute. Return Success for null so [Required] stays in charge.
public class NotInFutureAttribute : ValidationAttribute
{
    protected override ValidationResult? IsValid(object? value, ValidationContext context)
    {
        if (value is null) return ValidationResult.Success;
        if (value is DateTime date &amp;&amp; date &gt; DateTime.UtcNow)
            return new ValidationResult(
                ErrorMessage ?? "The date cannot be in the future.",
                new[] { context.MemberName! });      // names the field in the error output
        return ValidationResult.Success;
    }
}
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    [HttpPost]
    public IActionResult Create([FromBody] CreateBookRequest request)
    {
        // Nothing to check: an invalid request never reaches this line.
        // Business rules such as uniqueness DO belong here, and answer 409, not 400.
        if (request.Slug == "clean-code")
            return Conflict(new { error = "That slug is already taken." });
        return Ok(request);
    }
}
</code></pre>
