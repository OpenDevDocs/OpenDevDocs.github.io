---
publishDate: 2026-09-09T12:00
title: Validation with FluentValidation
slug: validation-with-fluentvalidation
metadescription: Move validation out of your DTOs into testable validator classes, write conditional and async rules, inject services, and wire FluentValidation into controllers and minimal APIs.
updateDate: 2026-09-07T12:00
author: ['bishal-biswas']
level: 2
tags: ['validation', 'fluentvalidation', 'testing']
course: dotnet-webapi
---

## Why look past data annotations

Data annotations are good and you should keep using them for simple rules. They run out of road in three places.

**Conditional rules are awkward.** "Discount code is required only when the order total is over 100" cannot be expressed as an attribute.

**Rules cannot use services.** An attribute has no clean way to inject a repository, so "this email must not already exist" has to live somewhere else.

**Your DTO fills with attributes.** A record that should be four lines becomes twenty, and the rules are mixed into the shape.

FluentValidation moves the rules into their own class. The DTO goes back to being a plain data holder, and the rules become something you can unit test on their own.

## Installing it

```bash
dotnet add package FluentValidation.AspNetCore
```

## Your first validator

The DTO stays clean:

```csharp
public record CreateBookRequest(
    string Title,
    string Author,
    int Year,
    decimal Price,
    string ContactEmail);
```

The rules go in a separate class:

```csharp
using FluentValidation;

public class CreateBookRequestValidator : AbstractValidator<CreateBookRequest>
{
    public CreateBookRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required.")
            .MaximumLength(200);

        RuleFor(x => x.Author)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x.Year)
            .InclusiveBetween(1000, 2100)
            .WithMessage("Year must be between 1000 and 2100.");

        RuleFor(x => x.Price)
            .GreaterThan(0)
            .LessThanOrEqualTo(10000);

        RuleFor(x => x.ContactEmail)
            .NotEmpty()
            .EmailAddress();
    }
}
```

Read it top to bottom and you know every rule for this request. That readability is most of the point.

## Registering it

```csharp
using FluentValidation;

builder.Services.AddValidatorsFromAssemblyContaining<CreateBookRequestValidator>();
```

That one line finds every validator in the assembly. You never register them individually.

## Wiring it into controllers

FluentValidation stopped shipping automatic MVC integration, so you add a small filter. This is a good thing: the behaviour is visible instead of magic.

```csharp
public class ValidationFilter : IAsyncActionFilter
{
    private readonly IServiceProvider services;

    public ValidationFilter(IServiceProvider services) => this.services = services;

    public async Task OnActionExecutionAsync(
        ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null) continue;

            Type validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());

            if (services.GetService(validatorType) is not IValidator validator) continue;

            var result = await validator.ValidateAsync(new ValidationContext<object>(argument));

            if (!result.IsValid)
            {
                context.Result = new BadRequestObjectResult(
                    new ValidationProblemDetails(result.ToDictionary()));
                return;
            }
        }

        await next();
    }
}
```

Register it globally so every action is covered:

```csharp
builder.Services.AddControllers(options =>
{
    options.Filters.Add<ValidationFilter>();
});
```

Now a failing request produces the standard problem details `400`, exactly like data annotations, and your actions stay free of checks.

## Wiring it into minimal APIs

Use an endpoint filter:

```csharp
public class FluentValidationFilter<T> : IEndpointFilter where T : class
{
    private readonly IValidator<T> validator;

    public FluentValidationFilter(IValidator<T> validator) => this.validator = validator;

    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        T? model = context.Arguments.OfType<T>().FirstOrDefault();
        if (model is null) return Results.BadRequest("Request body is missing.");

        var result = await validator.ValidateAsync(model);
        if (!result.IsValid)
            return Results.ValidationProblem(result.ToDictionary());

        return await next(context);
    }
}
```

```csharp
app.MapPost("/api/books", (CreateBookRequest r) => Results.Ok(r))
   .AddEndpointFilter<FluentValidationFilter<CreateBookRequest>>();
```

## Conditional rules

This is where FluentValidation starts paying for itself:

```csharp
RuleFor(x => x.DiscountCode)
    .NotEmpty()
    .When(x => x.Total > 100)
    .WithMessage("A discount code is required for orders over 100.");

RuleFor(x => x.CompanyName)
    .NotEmpty()
    .When(x => x.CustomerType == CustomerType.Business);

// Group several rules under one condition
When(x => x.ShipInternationally, () =>
{
    RuleFor(x => x.CountryCode).NotEmpty().Length(2);
    RuleFor(x => x.CustomsValue).GreaterThan(0);
});
```

Try writing any of those with attributes and you will see the difference.

## Rules for nested objects and collections

```csharp
// Reuse another validator for a nested object
RuleFor(x => x.ShippingAddress).SetValidator(new AddressValidator());

// Every item in a list
RuleForEach(x => x.Lines).SetValidator(new OrderLineValidator());

// Or inline rules per item
RuleForEach(x => x.Tags)
    .NotEmpty()
    .MaximumLength(30);

// A rule about the collection itself
RuleFor(x => x.Lines)
    .NotEmpty().WithMessage("An order needs at least one line.")
    .Must(lines => lines.Count <= 50).WithMessage("At most 50 lines per order.");
```

## Custom rules with Must

`Must` takes any predicate:

```csharp
RuleFor(x => x.PublishedOn)
    .Must(date => date <= DateTime.UtcNow)
    .WithMessage("A publication date cannot be in the future.");

RuleFor(x => x.Isbn)
    .Must(BeAValidIsbn)
    .WithMessage("ISBN must be 13 digits.");

private static bool BeAValidIsbn(string isbn)
{
    string digits = isbn.Replace("-", "");
    return digits.Length == 13 && digits.All(char.IsDigit);
}
```

## Async rules with a database

The feature attributes genuinely cannot match. A validator is a normal class, so it takes constructor dependencies:

```csharp
public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator(AppDbContext db)
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MustAsync(async (email, cancellation) =>
                !await db.Users.AnyAsync(u => u.Email == email, cancellation))
            .WithMessage("That email is already registered.");
    }
}
```

Two cautions. Async rules run a query per request, so keep them cheap and indexed. And a uniqueness check here is still a race: two requests can both pass validation before either saves. Keep the unique constraint on the database column as the real guarantee, and treat the validator as the friendly message.

## Cascade mode

By default every rule on a property runs, so an empty email produces both "required" and "not a valid email". Usually you want to stop at the first:

```csharp
RuleFor(x => x.Email)
    .Cascade(CascadeMode.Stop)
    .NotEmpty()
    .EmailAddress()
    .MaximumLength(255);
```

Or set it for the whole validator:

```csharp
public CreateBookRequestValidator()
{
    ClassLevelCascadeMode = CascadeMode.Continue;    // keep checking other properties
    RuleLevelCascadeMode = CascadeMode.Stop;         // but stop at the first failure per property
    // ...
}
```

That combination gives the client one clear message per field, which is what a form wants.

## Testing validators

This is the biggest practical win. A validator is a plain class with no HTTP around it:

```csharp
public class CreateBookRequestValidatorTests
{
    private readonly CreateBookRequestValidator validator = new();

    [Fact]
    public void Title_is_required()
    {
        var result = validator.TestValidate(
            new CreateBookRequest("", "Martin", 2008, 30, "a@b.com"));

        result.ShouldHaveValidationErrorFor(x => x.Title);
    }

    [Fact]
    public void Valid_request_passes()
    {
        var result = validator.TestValidate(
            new CreateBookRequest("Clean Code", "Martin", 2008, 30, "a@b.com"));

        result.ShouldNotHaveAnyValidationErrors();
    }
}
```

`TestValidate` comes from the `FluentValidation.TestHelper` namespace. Tests like these run in milliseconds and cover rules you would otherwise only exercise through the API.

## Should you use both?

Yes, and most teams do. Data annotations for obvious shape rules, especially since Swagger reads them and documents the constraints. FluentValidation for anything conditional, cross field or database backed.

If you would rather have one source of truth, pick FluentValidation and add `[Required]` only where you want Swagger to show it.

## Quick recap

- FluentValidation moves rules out of the DTO and into a testable `AbstractValidator<T>` class.
- `AddValidatorsFromAssemblyContaining<T>()` registers every validator in one line.
- Controllers need an action filter and minimal APIs need an endpoint filter. Both are short and explicit.
- `When` and grouped `When` blocks express conditional rules that attributes cannot.
- `SetValidator` and `RuleForEach` handle nested objects and collections.
- Validators take constructor dependencies, so `MustAsync` can check the database.
- Keep the database unique constraint. An async check is a nicer message, not a guarantee.
- `CascadeMode.Stop` at rule level gives one clear message per field.
- Validators are plain classes, so unit testing them with `TestValidate` is fast and easy.

<code id="code-content" class="language-csharp">
// FluentValidation end to end: validators, registration, filters, tests.
// dotnet add package FluentValidation.AspNetCore
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt; o.UseInMemoryDatabase("shop"));
// One line finds every AbstractValidator in the assembly
builder.Services.AddValidatorsFromAssemblyContaining&lt;CreateOrderRequestValidator&gt;();
builder.Services.AddControllers(options =&gt; options.Filters.Add&lt;ValidationFilter&gt;());
var app = builder.Build();
app.MapControllers();
// Minimal APIs use an endpoint filter instead of an action filter
app.MapPost("/api/orders/quick", (CreateOrderRequest r) =&gt; Results.Ok(r))
   .AddEndpointFilter&lt;FluentValidationFilter&lt;CreateOrderRequest&gt;&gt;();
app.Run();
// ---------- The DTO stays a plain data holder. No attributes, no noise.
public record CreateOrderRequest(
    string Email, CustomerType CustomerType, string? CompanyName,
    decimal Total, string? DiscountCode,
    bool ShipInternationally, string? CountryCode,
    AddressDto ShippingAddress, List&lt;OrderLineDto&gt; Lines);
public record AddressDto(string Street, string City, string Postcode);
public record OrderLineDto(string Sku, int Quantity);
public enum CustomerType { Personal, Business }
// ---------- All the rules, in one readable place. Dependencies arrive by constructor.
public class CreateOrderRequestValidator : AbstractValidator&lt;CreateOrderRequest&gt;
{
    public CreateOrderRequestValidator(AppDbContext db)
    {
        RuleLevelCascadeMode = CascadeMode.Stop;   // one clear message per field
        RuleFor(x =&gt; x.Email)
            .NotEmpty()
            .EmailAddress()
            // Async rules can query. Keep the DB unique index too: this is a race, not a guarantee.
            .MustAsync(async (email, ct) =&gt; !await db.Users.AnyAsync(u =&gt; u.Email == email, ct))
            .WithMessage("That email is already registered.");
        // Conditional rules: the thing data annotations cannot express
        RuleFor(x =&gt; x.CompanyName)
            .NotEmpty().When(x =&gt; x.CustomerType == CustomerType.Business)
            .WithMessage("Business customers must supply a company name.");
        RuleFor(x =&gt; x.DiscountCode)
            .NotEmpty().When(x =&gt; x.Total &gt; 100)
            .WithMessage("A discount code is required for orders over 100.");
        // A group of rules under one condition
        When(x =&gt; x.ShipInternationally, () =&gt;
        {
            RuleFor(x =&gt; x.CountryCode).NotEmpty().Length(2);
            RuleFor(x =&gt; x.Total).GreaterThan(25).WithMessage("International orders start at 25.");
        });
        // Nested object: reuse another validator
        RuleFor(x =&gt; x.ShippingAddress).NotNull().SetValidator(new AddressValidator());
        // The collection itself, then each item in it
        RuleFor(x =&gt; x.Lines)
            .NotEmpty().WithMessage("An order needs at least one line.")
            .Must(l =&gt; l.Count &lt;= 50).WithMessage("At most 50 lines per order.");
        RuleForEach(x =&gt; x.Lines).ChildRules(line =&gt;
        {
            line.RuleFor(l =&gt; l.Sku).NotEmpty().Matches(@"^[A-Z]{3}-\d{4}$");
            line.RuleFor(l =&gt; l.Quantity).InclusiveBetween(1, 999);
        });
    }
}
public class AddressValidator : AbstractValidator&lt;AddressDto&gt;
{
    public AddressValidator()
    {
        RuleFor(a =&gt; a.Street).NotEmpty().MaximumLength(100);
        RuleFor(a =&gt; a.City).NotEmpty().MaximumLength(60);
        RuleFor(a =&gt; a.Postcode).NotEmpty().Matches(@"^\d{6}$").WithMessage("Postcode must be 6 digits.");
    }
}
// ---------- Controllers: one global action filter validates every argument
public class ValidationFilter : IAsyncActionFilter
{
    private readonly IServiceProvider services;
    public ValidationFilter(IServiceProvider services) =&gt; this.services = services;
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (object? argument in context.ActionArguments.Values)
        {
            if (argument is null) continue;
            Type validatorType = typeof(IValidator&lt;&gt;).MakeGenericType(argument.GetType());
            if (services.GetService(validatorType) is not IValidator validator) continue;
            ValidationResult result = await validator.ValidateAsync(new ValidationContext&lt;object&gt;(argument));
            if (!result.IsValid)
            {
                context.Result = new BadRequestObjectResult(
                    new ValidationProblemDetails(result.ToDictionary()));
                return;                                   // short circuit: the action never runs
            }
        }
        await next();
    }
}
// ---------- Minimal APIs: the same job, as an endpoint filter
public class FluentValidationFilter&lt;T&gt; : IEndpointFilter where T : class
{
    private readonly IValidator&lt;T&gt; validator;
    public FluentValidationFilter(IValidator&lt;T&gt; validator) =&gt; this.validator = validator;
    public async ValueTask&lt;object?&gt; InvokeAsync(
        EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        T? model = context.Arguments.OfType&lt;T&gt;().FirstOrDefault();
        if (model is null) return Results.BadRequest("Request body is missing.");
        ValidationResult result = await validator.ValidateAsync(model);
        return result.IsValid
            ? await next(context)
            : Results.ValidationProblem(result.ToDictionary());
    }
}
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;User&gt; Users =&gt; Set&lt;User&gt;();
}
public class User { public int Id { get; set; } public string Email { get; set; } = ""; }
</code></pre>
