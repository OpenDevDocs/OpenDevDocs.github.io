---
publishDate: 2026-08-13T10:10
title: Custom and Remote Validation
slug: custom-and-remote-validation
metadescription: Write your own validation attributes, implement IValidatableObject for rules that span several properties, and use the Remote attribute to check a value against the server without a full postback.
updateDate: 2026-09-14T10:10
author: ['bishal-biswas']
level: 2
tags: ['validation', 'custom-attributes', 'forms']
course: dotnet-mvc
---

## When the built in attributes are not enough

`[Required]`, `[Range]` and friends cover most forms. Sooner or later you hit a rule they cannot express:

- A delivery date must be in the future.
- A discount code must exist in the database.
- The end date must be after the start date.
- A username must be unique.

This topic shows three tools for these cases: **custom attributes**, **IValidatableObject** and **remote validation**.

## Writing a custom validation attribute

A custom attribute is a class that inherits from `ValidationAttribute` and overrides `IsValid`:

```csharp
using System.ComponentModel.DataAnnotations;

public class FutureDateAttribute : ValidationAttribute
{
    public FutureDateAttribute()
    {
        ErrorMessage = "{0} must be a date in the future.";
    }

    protected override ValidationResult? IsValid(object? value, ValidationContext context)
    {
        if (value is DateTime date && date <= DateTime.Today)
        {
            return new ValidationResult(FormatErrorMessage(context.DisplayName));
        }

        return ValidationResult.Success;
    }
}
```

Return `ValidationResult.Success` when the value is fine, or a `ValidationResult` with a message when it is not. `FormatErrorMessage` fills `{0}` with the display name.

Use it like any other attribute:

```csharp
[FutureDate]
[Display(Name = "Delivery date")]
public DateTime DeliveryDate { get; set; }
```

Note that a null value passes here. That is on purpose. Let `[Required]` decide whether the field must be filled, and let your attribute decide whether a filled value is acceptable.

## Attributes with parameters

Give the attribute constructor arguments to make it reusable:

```csharp
public class MaxWordsAttribute : ValidationAttribute
{
    private readonly int _max;

    public MaxWordsAttribute(int max)
    {
        _max = max;
        ErrorMessage = "{0} cannot have more than {1} words.";
    }

    protected override ValidationResult? IsValid(object? value, ValidationContext context)
    {
        if (value is string text)
        {
            var count = text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
            if (count > _max)
            {
                return new ValidationResult(string.Format(ErrorMessage!, context.DisplayName, _max));
            }
        }

        return ValidationResult.Success;
    }
}
```

```csharp
[MaxWords(100)]
public string Summary { get; set; } = "";
```

## Using services inside an attribute

`ValidationContext` can resolve services from dependency injection. This lets an attribute check the database:

```csharp
protected override ValidationResult? IsValid(object? value, ValidationContext context)
{
    var repo = context.GetRequiredService<ICouponRepository>();

    if (value is string code && !repo.Exists(code))
    {
        return new ValidationResult("That coupon code is not valid.");
    }

    return ValidationResult.Success;
}
```

Keep these checks fast. They run on every request that binds the model.

## Rules that involve several properties

Sometimes a rule depends on two fields at once. An attribute sees only one property, so use `IValidatableObject` on the model instead:

```csharp
public class BookingViewModel : IValidatableObject
{
    [Required]
    public DateTime CheckIn { get; set; }

    [Required]
    public DateTime CheckOut { get; set; }

    public int Guests { get; set; }
    public bool HasChildren { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (CheckOut <= CheckIn)
        {
            yield return new ValidationResult(
                "Check out must be after check in.",
                new[] { nameof(CheckOut) });
        }

        if (HasChildren && Guests < 2)
        {
            yield return new ValidationResult(
                "A booking with children needs at least two guests.",
                new[] { nameof(Guests), nameof(HasChildren) });
        }
    }
}
```

The second argument names the properties the error belongs to, so the message shows next to the right field. Leave it out to make a model level error that appears in the validation summary.

`Validate` only runs if all the attribute checks passed. That means you can trust the attribute rules inside it.

## Adding client side support to a custom attribute

Custom attributes run on the server only. To get instant browser feedback you must implement `IClientModelValidator` and write a small jQuery Validation rule:

```csharp
public class FutureDateAttribute : ValidationAttribute, IClientModelValidator
{
    public void AddValidation(ClientModelValidationContext context)
    {
        context.Attributes["data-val"] = "true";
        context.Attributes["data-val-futuredate"] = FormatErrorMessage(context.ModelMetadata.GetDisplayName());
    }

    // IsValid as before
}
```

```javascript
$.validator.addMethod("futuredate", function (value, element) {
    if (!value) return true;
    return new Date(value) > new Date();
});
$.validator.unobtrusive.adapters.addBool("futuredate");
```

Put the JavaScript in a file that loads after the validation scripts. Now the message shows without a postback and the server still checks on submit.

## Remote validation

Some rules can only be answered by the server, such as "is this username taken?" **Remote validation** lets the browser ask the server about one field with a small AJAX call while the user is still typing.

Mark the property with `[Remote]` and point it at an action:

```csharp
[Required]
[Remote(action: "CheckUsername", controller: "Account")]
public string Username { get; set; } = "";
```

Write the action. It receives the field value by name and returns `true` for valid or a message string for invalid:

```csharp
[AcceptVerbs("GET", "POST")]
public IActionResult CheckUsername(string username)
{
    if (_users.UsernameExists(username))
    {
        return Json($"The username {username} is already taken.");
    }

    return Json(true);
}
```

That is the whole feature. With the validation scripts on the page, leaving the field triggers a request to `/Account/CheckUsername?Username=...` and the message appears in the usual span.

## Remote validation with extra fields

If the check depends on another field, pass it along with `AdditionalFields`:

```csharp
[Remote("CheckEmail", "Account", AdditionalFields = nameof(Id))]
public string Email { get; set; } = "";
```

The action gets both values. This is how an edit form avoids complaining that the email is "already taken" by the very record being edited:

```csharp
public IActionResult CheckEmail(string email, int id)
{
    var owner = _users.FindByEmail(email);
    return Json(owner is null || owner.Id == id ? true : "That email is in use.");
}
```

## Remote is client side only

`[Remote]` does nothing on the server. It only adds the `data-val-remote` attributes. Your POST action must still check uniqueness itself and add a `ModelState` error if needed. The two checks share the repository method, so this is a single extra line.

## Quick recap

- Inherit from `ValidationAttribute` and override `IsValid` to create your own rule.
- Use `ValidationContext` to reach the display name and to resolve services.
- Implement `IValidatableObject` on the model for rules that need more than one property.
- Add `IClientModelValidator` and a jQuery rule when a custom attribute should also work in the browser.
- `[Remote]` calls a server action from the browser to check one field, but the server still needs its own check.

<code id="code-content" class="language-csharp">
// Validation/FutureDateAttribute.cs
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

public class FutureDateAttribute : ValidationAttribute, IClientModelValidator
{
    public FutureDateAttribute() =&gt; ErrorMessage = "{0} must be a date in the future.";

    protected override ValidationResult? IsValid(object? value, ValidationContext context)
    {
        if (value is DateTime date &amp;&amp; date &lt;= DateTime.Today)
        {
            return new ValidationResult(FormatErrorMessage(context.DisplayName));
        }
        return ValidationResult.Success;
    }

    public void AddValidation(ClientModelValidationContext context)
    {
        context.Attributes["data-val"] = "true";
        context.Attributes["data-val-futuredate"] =
            FormatErrorMessage(context.ModelMetadata.GetDisplayName());
    }
}

// ViewModels/BookingViewModel.cs
public class BookingViewModel : IValidatableObject
{
    public int Id { get; set; }

    [Required]
    [Remote("CheckEmail", "Bookings", AdditionalFields = nameof(Id))]
    public string Email { get; set; } = "";

    [Required, FutureDate]
    [Display(Name = "Check in")]
    public DateTime CheckIn { get; set; }

    [Required]
    [Display(Name = "Check out")]
    public DateTime CheckOut { get; set; }

    [Range(1, 10)]
    public int Guests { get; set; } = 1;

    public bool HasChildren { get; set; }

    public IEnumerable&lt;ValidationResult&gt; Validate(ValidationContext context)
    {
        if (CheckOut &lt;= CheckIn)
        {
            yield return new ValidationResult(
                "Check out must be after check in.", new[] { nameof(CheckOut) });
        }
        if (HasChildren &amp;&amp; Guests &lt; 2)
        {
            yield return new ValidationResult(
                "A booking with children needs at least two guests.", new[] { nameof(Guests) });
        }
    }
}

// Controllers/BookingsController.cs
public class BookingsController : Controller
{
    private readonly IBookingRepository _bookings;
    public BookingsController(IBookingRepository bookings) =&gt; _bookings = bookings;

    [AcceptVerbs("GET", "POST")]
    public IActionResult CheckEmail(string email, int id)
    {
        var existing = _bookings.FindByEmail(email);
        if (existing is not null &amp;&amp; existing.Id != id)
        {
            return Json("A booking already exists for this email.");
        }
        return Json(true);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Create(BookingViewModel vm)
    {
        // Remote validation is browser only, so check again here.
        if (_bookings.FindByEmail(vm.Email) is not null)
        {
            ModelState.AddModelError(nameof(vm.Email), "A booking already exists for this email.");
        }

        if (!ModelState.IsValid) return View(vm);

        _bookings.Add(vm);
        return RedirectToAction("Index");
    }
}

// wwwroot/js/validation-rules.js (load after _ValidationScriptsPartial)
//
//   $.validator.addMethod("futuredate", function (value) {
//       if (!value) return true;
//       return new Date(value) &gt; new Date();
//   });
//   $.validator.unobtrusive.adapters.addBool("futuredate");
</code></pre>
