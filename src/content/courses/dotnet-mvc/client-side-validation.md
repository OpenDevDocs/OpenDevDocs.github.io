---
publishDate: 2026-08-13T10:00
title: Client Side Validation
slug: client-side-validation
metadescription: See how MVC turns your data annotations into instant browser side validation with jQuery Validation and the unobtrusive adapter, what the data-val attributes mean, how to include the scripts, and why the server must still validate.
updateDate: 2026-09-14T10:00
author: ['bishal-biswas']
level: 2
tags: ['validation', 'javascript', 'forms']
course: dotnet-mvc
---

## Validation in two places

Server side validation is the one that counts. It cannot be bypassed and it protects your data. But it only tells the user about mistakes after a round trip: submit, wait, see the error, fix it, submit again.

**Client side validation** runs in the browser and shows the message the moment the user leaves a field. It is a convenience layer on top of the server checks, never a replacement. Anyone can turn off JavaScript or send a request with a tool, so the server must always check again.

The good news is that MVC gives you client side validation for free from the same data annotations you already wrote.

## How it works

Look at what the input tag helper renders for a property with `[Required]` and `[StringLength(50)]`:

```html
<input type="text" id="Name" name="Name"
       data-val="true"
       data-val-required="The Name field is required."
       data-val-length="The field Name must be a string with a maximum length of 50."
       data-val-length-max="50" />
```

These `data-val-*` attributes describe the rules and the messages. A small script called **jQuery Unobtrusive Validation** reads them when the page loads and wires them into **jQuery Validation**, which does the actual checking.

"Unobtrusive" means the rules live in HTML attributes instead of inline scripts. Your view stays clean and the same attributes work for any page.

## Including the scripts

The scripts must be on the page. The project template includes a partial for this:

```cshtml
@* Views/Shared/_ValidationScriptsPartial.cshtml *@
<script src="~/lib/jquery-validation/dist/jquery.validate.min.js"></script>
<script src="~/lib/jquery-validation-unobtrusive/jquery.validate.unobtrusive.min.js"></script>
```

jQuery itself is loaded by the layout. On any page with a form, add the partial to the `Scripts` section:

```cshtml
@section Scripts {
    <partial name="_ValidationScriptsPartial" />
}
```

That is all. If you have the section and the `data-val` attributes, validation works.

## Where the messages go

The same tag helpers that show server messages show client messages:

```cshtml
<input asp-for="Email" class="form-control" />
<span asp-validation-for="Email" class="text-danger"></span>
```

The span renders as:

```html
<span class="text-danger field-validation-valid" data-valmsg-for="Email" data-valmsg-replace="true"></span>
```

`data-valmsg-for` tells the script which field this span belongs to. When the field is invalid, the script puts the message inside and swaps `field-validation-valid` for `field-validation-error`. The input also gets an `input-validation-error` class, which you can style.

## Which attributes have client support

Most of the built in attributes work on both sides:

| Attribute | Client rule |
| --- | --- |
| `[Required]` | required |
| `[StringLength]`, `[MinLength]`, `[MaxLength]` | length |
| `[Range]` | range |
| `[RegularExpression]` | regex |
| `[EmailAddress]` | email |
| `[Url]` | url |
| `[Phone]` | phone |
| `[Compare]` | equalto |
| `[CreditCard]` | creditcard |

Custom validation attributes do not get a client rule unless you write one, which the next topic covers. Any rule that needs the database, such as "this email is already taken", can only be checked with the remote validation feature in the same topic.

## Numbers and dates

The `Price` input gets an automatic number rule even without `[Range]`, because the property is a `decimal`. Typing "abc" shows "The field Price must be a number." immediately.

Dates work similarly, but the client check uses the browser's locale. If your users type dates in a different format than the server expects, you may want to use `type="date"` inputs so the browser handles the picker and sends ISO format.

## Styling the states

Bootstrap does not know about `input-validation-error`. Two small CSS rules make it match:

```css
.input-validation-error {
    border-color: #dc3545;
}

.field-validation-error {
    display: block;
    font-size: 0.875rem;
}
```

Put these in `wwwroot/css/site.css`.

## Turning it off

To skip client validation for one form, add `novalidate` to the form or set `data-val="false"` on an input. To turn it off for the whole app:

```csharp
builder.Services.AddControllersWithViews()
    .AddViewOptions(o => o.HtmlHelperOptions.ClientValidationEnabled = false);
```

Removing the scripts partial has the same effect for a single page.

## Forms added with JavaScript

The unobtrusive script only scans the page once, when it loads. If you insert a form or new fields with JavaScript later, tell it to look again:

```javascript
const form = document.querySelector("#orderForm");
$(form).removeData("validator").removeData("unobtrusiveValidation");
$.validator.unobtrusive.parse(form);
```

This is common on pages that add rows to a list dynamically.

## Checking validity before an AJAX submit

If you submit a form with `fetch` instead of a normal post, run the client rules first:

```javascript
const form = $("#orderForm");
if (!form.valid()) {
    return;
}
// proceed with fetch
```

`valid()` triggers the checks and shows the messages.

## The rule that never changes

Client side validation improves the experience. It does not improve security. Every action that changes data must still check `ModelState.IsValid` on the server. If you remember only one thing from this topic, make it that one.

## Quick recap

- Client side validation checks values in the browser before the form is sent, using the same data annotations.
- The input tag helper renders `data-val-*` attributes, and jQuery Unobtrusive Validation turns them into live checks.
- Add `<partial name="_ValidationScriptsPartial" />` in the `Scripts` section of any page with a form.
- Messages appear in the `asp-validation-for` spans, with `field-validation-error` and `input-validation-error` classes for styling.
- Re parse the form after adding fields with JavaScript, and call `valid()` before an AJAX submit.
- The server must always validate too.

<code id="code-content" class="language-csharp">
// ViewModels/ContactViewModel.cs
using System.ComponentModel.DataAnnotations;

public class ContactViewModel
{
    [Required(ErrorMessage = "Please tell us your name.")]
    [StringLength(60, MinimumLength = 2)]
    public string Name { get; set; } = "";

    [Required]
    [EmailAddress(ErrorMessage = "Please enter a valid email.")]
    public string Email { get; set; } = "";

    [Required]
    [StringLength(1000, MinimumLength = 10, ErrorMessage = "Messages need at least {2} characters.")]
    [DataType(DataType.MultilineText)]
    public string Message { get; set; } = "";

    [Range(1, 5)]
    public int? Rating { get; set; }
}

// Controllers/ContactController.cs
public class ContactController : Controller
{
    [HttpGet]
    public IActionResult Index() =&gt; View(new ContactViewModel());

    // The server checks again even though the browser already did.
    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Index(ContactViewModel vm)
    {
        if (!ModelState.IsValid)
        {
            return View(vm);
        }

        TempData["Success"] = "Thanks, we will reply soon.";
        return RedirectToAction(nameof(Index));
    }
}

// Views/Contact/Index.cshtml
//
//   @model ContactViewModel
//   &lt;form asp-action="Index" method="post" id="contactForm"&gt;
//       &lt;div class="mb-3"&gt;
//           &lt;label asp-for="Name" class="form-label"&gt;&lt;/label&gt;
//           &lt;input asp-for="Name" class="form-control" /&gt;
//           &lt;span asp-validation-for="Name" class="text-danger"&gt;&lt;/span&gt;
//       &lt;/div&gt;
//       &lt;div class="mb-3"&gt;
//           &lt;label asp-for="Email" class="form-label"&gt;&lt;/label&gt;
//           &lt;input asp-for="Email" class="form-control" /&gt;
//           &lt;span asp-validation-for="Email" class="text-danger"&gt;&lt;/span&gt;
//       &lt;/div&gt;
//       &lt;div class="mb-3"&gt;
//           &lt;label asp-for="Message" class="form-label"&gt;&lt;/label&gt;
//           &lt;textarea asp-for="Message" class="form-control" rows="5"&gt;&lt;/textarea&gt;
//           &lt;span asp-validation-for="Message" class="text-danger"&gt;&lt;/span&gt;
//       &lt;/div&gt;
//       &lt;button type="submit" class="btn btn-primary"&gt;Send&lt;/button&gt;
//   &lt;/form&gt;
//
//   @section Scripts {
//       &lt;partial name="_ValidationScriptsPartial" /&gt;
//       &lt;script&gt;
//           // Example: validate before an AJAX submit
//           document.getElementById("contactForm").addEventListener("submit", function (e) {
//               if (!$(this).valid()) {
//                   e.preventDefault();
//               }
//           });
//       &lt;/script&gt;
//   }
// wwwroot/css/site.css
//
//   .input-validation-error { border-color: #dc3545; }
//   .field-validation-error { display: block; font-size: 0.875rem; }
</code></pre>
