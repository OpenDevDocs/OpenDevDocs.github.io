---
publishDate: 2026-08-12T09:40
title: Model Validation with Data Annotations
slug: model-validation-with-data-annotations
metadescription: Learn how validation attributes such as Required, StringLength, Range, EmailAddress and Compare protect your forms, how ModelState collects the results, and how to show error messages in the view.
updateDate: 2026-09-14T09:40
author: ['bishal-biswas']
level: 1
tags: ['validation', 'data-annotations', 'forms']
course: dotnet-mvc
---

## Never trust the form

Every value that arrives from a browser could be wrong. A price could be negative. An email could be missing its `@`. A name could be three thousand characters long. **Validation** is the habit of checking every incoming value before you use it.

In MVC, the easiest way to validate is with **data annotations**: attributes you place on the properties of your model. The framework reads them, checks the posted values, and tells you what went wrong.

## Your first validation attributes

```csharp
using System.ComponentModel.DataAnnotations;

public class RegisterViewModel
{
    [Required]
    [StringLength(50, MinimumLength = 2)]
    public string Name { get; set; } = "";

    [Required]
    [EmailAddress]
    public string Email { get; set; } = "";

    [Range(18, 120)]
    public int Age { get; set; }
}
```

- `[Required]` means the value must not be empty.
- `[StringLength(50, MinimumLength = 2)]` limits the length.
- `[EmailAddress]` checks the shape of an email address.
- `[Range(18, 120)]` limits a number to a range.

Nothing else is needed. When this model is bound from a form, these rules run automatically.

## Where the results go

After binding, the framework stores the outcome in `ModelState`. Your action checks one property:

```csharp
[HttpPost]
public IActionResult Register(RegisterViewModel vm)
{
    if (!ModelState.IsValid)
    {
        return View(vm);
    }

    // Safe to use vm here
    return RedirectToAction("Welcome");
}
```

`ModelState.IsValid` is `false` if any rule failed. You return the same view with the same model so the user sees their input and the messages.

The action still runs when validation fails. It is up to you to check `IsValid`. Forgetting this check is one of the most common bugs in MVC apps.

## Showing the messages

The tag helpers from the forms topic print the messages:

```cshtml
<div asp-validation-summary="All" class="text-danger"></div>

<input asp-for="Email" class="form-control" />
<span asp-validation-for="Email" class="text-danger"></span>
```

`asp-validation-for` shows the message for one property. `asp-validation-summary` shows either all messages (`All`) or only those not tied to a property (`ModelOnly`). Most forms use per field spans plus a `ModelOnly` summary at the top.

## Custom messages

The default messages are functional but plain, such as "The Email field is required." Set `ErrorMessage` to say it better:

```csharp
[Required(ErrorMessage = "Please enter your email address.")]
[EmailAddress(ErrorMessage = "That does not look like an email address.")]
public string Email { get; set; } = "";
```

Use `{0}` inside the message to insert the display name, and `{1}`, `{2}` for the attribute's arguments:

```csharp
[StringLength(50, MinimumLength = 2, ErrorMessage = "{0} must be between {2} and {1} characters.")]
[Display(Name = "Full name")]
public string Name { get; set; } = "";
```

This produces "Full name must be between 2 and 50 characters."

## The common attributes

| Attribute | Checks |
| --- | --- |
| `[Required]` | Not null or empty |
| `[StringLength(max, MinimumLength = min)]` | Text length |
| `[MinLength(n)]`, `[MaxLength(n)]` | Length of text or collections |
| `[Range(min, max)]` | Number or date within bounds |
| `[EmailAddress]` | Email shape |
| `[Phone]` | Phone number shape |
| `[Url]` | URL shape |
| `[RegularExpression(pattern)]` | Matches a regex |
| `[Compare(nameof(Other))]` | Equals another property |
| `[CreditCard]` | Passes the Luhn check |

`[DataType]` and `[Display]` are not validation attributes. They only affect how fields are drawn.

## Comparing two fields

The registration form classic:

```csharp
[Required]
[DataType(DataType.Password)]
public string Password { get; set; } = "";

[DataType(DataType.Password)]
[Compare(nameof(Password), ErrorMessage = "The passwords do not match.")]
public string ConfirmPassword { get; set; } = "";
```

## Regular expressions

For anything with a specific shape, such as a postcode or a username:

```csharp
[RegularExpression(@"^[a-z0-9_]{3,20}$", ErrorMessage = "Use 3 to 20 lowercase letters, numbers or underscores.")]
public string Username { get; set; } = "";
```

## Required and value types

`[Required]` on an `int` does nothing useful. An `int` cannot be null, so if the user leaves the field empty the binder puts `0` there and the required check passes. To make a number truly required, make it nullable:

```csharp
[Required]
public int? Quantity { get; set; }
```

Now an empty field leaves `Quantity` as `null` and `[Required]` catches it. The same applies to `decimal`, `DateTime` and `bool`.

## Nullable reference types and Required

When nullable reference types are enabled, which is the default in new projects, a non nullable `string` property is treated as required even without the attribute. The rule of thumb:

- `string Name` is required by the compiler's nullability.
- `string? Name` is optional.

Adding `[Required]` anyway is fine and lets you set a custom message.

## Adding errors from code

Some checks need data the attributes cannot see, such as "is this email already registered?" Add those errors yourself before checking `IsValid`:

```csharp
[HttpPost]
public IActionResult Register(RegisterViewModel vm)
{
    if (_users.EmailExists(vm.Email))
    {
        ModelState.AddModelError(nameof(vm.Email), "This email is already registered.");
    }

    if (!ModelState.IsValid)
    {
        return View(vm);
    }

    // ...
}
```

The first argument is the property name, so the message appears next to the email field. Pass an empty string to add a model level error that shows in the summary.

## Validation on nested objects

Validation walks into child objects and collections. If an `Order` has a `ShippingAddress` with its own attributes, those rules run too, and the error keys look like `ShippingAddress.PostalCode`.

## Quick recap

- Data annotations are attributes on model properties that describe what values are allowed.
- Validation runs automatically during model binding and stores results in `ModelState`.
- Always check `ModelState.IsValid` in POST actions and return the view with the model when it is false.
- Use `ErrorMessage` with `{0}` placeholders for friendly messages.
- Use nullable types for numbers and dates that must be filled in, or `[Required]` will never fail.
- `ModelState.AddModelError` adds checks that need data from outside the model.

<code id="code-content" class="language-csharp">
// ViewModels/RegisterViewModel.cs
using System.ComponentModel.DataAnnotations;

public class RegisterViewModel
{
    [Required(ErrorMessage = "Please enter your name.")]
    [StringLength(50, MinimumLength = 2, ErrorMessage = "{0} must be between {2} and {1} characters.")]
    [Display(Name = "Full name")]
    public string Name { get; set; } = "";

    [Required(ErrorMessage = "Please enter your email address.")]
    [EmailAddress(ErrorMessage = "That does not look like an email address.")]
    public string Email { get; set; } = "";

    [Required]
    [RegularExpression(@"^[a-z0-9_]{3,20}$",
        ErrorMessage = "Use 3 to 20 lowercase letters, numbers or underscores.")]
    public string Username { get; set; } = "";

    [Required]
    [Range(18, 120, ErrorMessage = "You must be between {1} and {2} years old.")]
    public int? Age { get; set; }

    [Required]
    [StringLength(100, MinimumLength = 8)]
    [DataType(DataType.Password)]
    public string Password { get; set; } = "";

    [DataType(DataType.Password)]
    [Display(Name = "Confirm password")]
    [Compare(nameof(Password), ErrorMessage = "The passwords do not match.")]
    public string ConfirmPassword { get; set; } = "";

    [Phone]
    public string? PhoneNumber { get; set; }

    [Url]
    public string? Website { get; set; }
}

// Controllers/AccountController.cs
public class AccountController : Controller
{
    private readonly IUserRepository _users;
    public AccountController(IUserRepository users) =&gt; _users = users;

    [HttpGet]
    public IActionResult Register() =&gt; View(new RegisterViewModel());

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Register(RegisterViewModel vm)
    {
        if (_users.EmailExists(vm.Email))
        {
            ModelState.AddModelError(nameof(vm.Email), "This email is already registered.");
        }

        if (_users.UsernameExists(vm.Username))
        {
            ModelState.AddModelError(nameof(vm.Username), "This username is taken.");
        }

        if (!ModelState.IsValid)
        {
            return View(vm);
        }

        _users.Create(vm.Name, vm.Email, vm.Username, vm.Password);
        TempData["Success"] = "Welcome aboard!";
        return RedirectToAction("Index", "Home");
    }
}

// Views/Account/Register.cshtml
//
//   @model RegisterViewModel
//   &lt;form asp-action="Register" method="post"&gt;
//       &lt;div asp-validation-summary="ModelOnly" class="text-danger"&gt;&lt;/div&gt;
//       &lt;label asp-for="Name"&gt;&lt;/label&gt;
//       &lt;input asp-for="Name" class="form-control" /&gt;
//       &lt;span asp-validation-for="Name" class="text-danger"&gt;&lt;/span&gt;
//       &lt;label asp-for="Email"&gt;&lt;/label&gt;
//       &lt;input asp-for="Email" class="form-control" /&gt;
//       &lt;span asp-validation-for="Email" class="text-danger"&gt;&lt;/span&gt;
//       &lt;label asp-for="Age"&gt;&lt;/label&gt;
//       &lt;input asp-for="Age" class="form-control" /&gt;
//       &lt;span asp-validation-for="Age" class="text-danger"&gt;&lt;/span&gt;
//       &lt;label asp-for="Password"&gt;&lt;/label&gt;
//       &lt;input asp-for="Password" class="form-control" /&gt;
//       &lt;span asp-validation-for="Password" class="text-danger"&gt;&lt;/span&gt;
//       &lt;label asp-for="ConfirmPassword"&gt;&lt;/label&gt;
//       &lt;input asp-for="ConfirmPassword" class="form-control" /&gt;
//       &lt;span asp-validation-for="ConfirmPassword" class="text-danger"&gt;&lt;/span&gt;
//       &lt;button type="submit" class="btn btn-primary"&gt;Register&lt;/button&gt;
//   &lt;/form&gt;
</code></pre>
