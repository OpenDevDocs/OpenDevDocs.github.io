---
publishDate: 2026-08-30T15:50
title: Localization and Globalization
slug: localization-and-globalization
metadescription: Make an MVC app speak more than one language with resource files and IStringLocalizer, localize views and data annotations, format dates and currency for each culture, and let users pick their language with the request localization middleware.
updateDate: 2026-09-14T15:50
author: ['bishal-biswas']
level: 3
tags: ['localization', 'globalization', 'cultures']
course: dotnet-mvc
---

## Two related words

**Globalization** is making the app handle different cultures: how dates, numbers and currency are formatted, how strings are sorted. A German user expects `1.234,56 €` and `31.12.2026`. An American expects `$1,234.56` and `12/31/2026`. The code is the same, the output differs.

**Localization** is translating the text of the app: "Add to cart" becomes "In den Warenkorb". Each language's strings live in a resource file.

ASP.NET Core supports both through a **culture** attached to each request. Everything else follows from that.

## Setting up

Register the services and tell them where resource files live:

```csharp
builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");

builder.Services.AddControllersWithViews()
    .AddViewLocalization()
    .AddDataAnnotationsLocalization();

var supportedCultures = new[] { "en", "de", "fr" };

builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    options.SetDefaultCulture("en")
        .AddSupportedCultures(supportedCultures)
        .AddSupportedUICultures(supportedCultures);
});
```

Then add the middleware early in the pipeline, before anything that renders:

```csharp
app.UseRequestLocalization();
```

`AddViewLocalization` enables `IViewLocalizer` in views. `AddDataAnnotationsLocalization` translates validation messages.

## Culture and UI culture

Each request has two cultures. **Culture** controls formatting of dates, numbers and currency. **UI culture** controls which resource file is used for text. They are usually the same, but a user could read English text with German number formats. Most apps set both together.

## How the culture is chosen

The middleware looks at three things, in order, and uses the first supported match:

1. A `culture` query string value, such as `?culture=de`.
2. A cookie named `.AspNetCore.Culture`.
3. The browser's `Accept-Language` header.

Users get their browser language automatically. To let them choose, set the cookie:

```csharp
[HttpPost]
public IActionResult SetLanguage(string culture, string returnUrl)
{
    Response.Cookies.Append(
        CookieRequestCultureProvider.DefaultCookieName,
        CookieRequestCultureProvider.MakeCookieValue(new RequestCulture(culture)),
        new CookieOptions { Expires = DateTimeOffset.UtcNow.AddYears(1) });

    return LocalRedirect(returnUrl);
}
```

A language selector in the layout posts to this action. For URLs like `/de/products`, add a custom provider that reads the route, or use the query string provider.

## Resource files

A resource file is an XML file with a `.resx` extension holding name and value pairs. Create one per language, named after the class or view it belongs to.

For a controller `Controllers/HomeController.cs`, the files are:

```text
Resources/
  Controllers/
    HomeController.de.resx
    HomeController.fr.resx
```

Or with the dot naming style, `Resources/Controllers.HomeController.de.resx`. Both work.

Inside each file, the name is the English text or a key, and the value is the translation:

```text
Name: Welcome         Value: Willkommen
Name: AddToCart       Value: In den Warenkorb
```

There is no `.en.resx` in this setup. When no resource is found, the localizer returns the key itself, so English keys act as the default text.

## Localizing in controllers

Inject `IStringLocalizer<T>` where `T` is the controller:

```csharp
public class HomeController : Controller
{
    private readonly IStringLocalizer<HomeController> _localizer;

    public HomeController(IStringLocalizer<HomeController> localizer)
    {
        _localizer = localizer;
    }

    public IActionResult Index()
    {
        ViewData["Message"] = _localizer["Welcome"];
        return View();
    }
}
```

`_localizer["Welcome"]` returns "Willkommen" for a German request and "Welcome" for anything without a translation. Placeholders work too:

```csharp
_localizer["Hello {0}, you have {1} items", name, count]
```

## Localizing in views

Inject `IViewLocalizer` and use it the same way. Resource files for views are named after the view path:

```text
Resources/Views/Home/Index.de.resx
```

```cshtml
@inject IViewLocalizer Localizer

<h1>@Localizer["Welcome"]</h1>
<a asp-action="Cart">@Localizer["AddToCart"]</a>
```

For text shared by many views, create a marker class such as `SharedResource` and inject `IStringLocalizer<SharedResource>`. The file is `Resources/SharedResource.de.resx`.

## Localizing data annotations

Validation messages and display names come from a resource file for the model class:

```csharp
public class RegisterViewModel
{
    [Required(ErrorMessage = "EmailRequired")]
    [Display(Name = "EmailLabel")]
    public string Email { get; set; } = "";
}
```

```text
Resources/ViewModels/RegisterViewModel.de.resx
  EmailRequired:  Bitte geben Sie Ihre E-Mail-Adresse ein.
  EmailLabel:     E-Mail
```

With `AddDataAnnotationsLocalization`, the attribute text is treated as a key and looked up in that file. The built in messages, such as the default `[Required]` text, are only localised if you set explicit keys.

## Formatting for the culture

Once the culture is set, formatting happens automatically for anything that uses the current culture:

```cshtml
<p>@Model.Price.ToString("C")</p>
<p>@Model.ShipDate.ToString("d")</p>
<p>@Model.Weight.ToString("N2")</p>
```

For a German request these produce `49,99 €`, `31.12.2026` and `1.234,50`. No code changes.

Model binding uses the same culture when parsing what users type. A German user entering `49,99` in a price field gets `49.99m`. This is usually what you want. For dates, `type="date"` inputs always send ISO format, which avoids ambiguity.

## Storing dates and money

Always store dates in UTC and format them for display. Store money as `decimal` without a currency symbol and add the symbol at render time with the user's culture, or with a specific culture if the shop only trades in one currency:

```csharp
var euro = CultureInfo.GetCultureInfo("de-DE");
var text = price.ToString("C", euro);
```

## Right to left languages

Arabic and Hebrew read right to left. Add `dir="rtl"` to the `<html>` tag when the culture is one of them:

```cshtml
@{
    var isRtl = CultureInfo.CurrentUICulture.TextInfo.IsRightToLeft;
}
<html lang="@CultureInfo.CurrentUICulture.Name" dir="@(isRtl ? "rtl" : "ltr")">
```

## Quick recap

- Globalization formats dates, numbers and currency for a culture. Localization translates text with resource files.
- Register with `AddLocalization`, `AddViewLocalization` and `AddDataAnnotationsLocalization`, and add `UseRequestLocalization` early in the pipeline.
- The culture comes from the query string, a cookie, or the browser, and a small action can set the cookie for a language picker.
- Use `IStringLocalizer<T>` in controllers and `IViewLocalizer` in views, with `.resx` files named after the class or view.
- Data annotation messages and display names are keys looked up in the model's resource file.
- Formatting with `ToString("C")` and `ToString("d")` follows the current culture automatically.

<code id="code-content" class="language-csharp">
// Program.cs
using System.Globalization;
using Microsoft.AspNetCore.Localization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddLocalization(options =&gt; options.ResourcesPath = "Resources");
builder.Services.AddControllersWithViews()
    .AddViewLocalization()
    .AddDataAnnotationsLocalization();

var supported = new[] { "en", "de", "fr", "ar" };
builder.Services.Configure&lt;RequestLocalizationOptions&gt;(options =&gt;
{
    options.SetDefaultCulture("en")
        .AddSupportedCultures(supported)
        .AddSupportedUICultures(supported);
    // Order: query string, cookie, Accept-Language header (the default providers)
});

var app = builder.Build();
app.UseStaticFiles();
app.UseRequestLocalization();      // before routing and views
app.UseRouting();
app.UseAuthorization();
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
app.Run();

// Resources/SharedResource.cs (marker class for shared strings)
public class SharedResource { }

// Resources/SharedResource.de.resx (name / value)
//
//   AddToCart        In den Warenkorb
//   Welcome          Willkommen
//   ItemsInCart      Sie haben {0} Artikel im Warenkorb

// Resources/ViewModels/RegisterViewModel.de.resx
//
//   EmailRequired    Bitte geben Sie Ihre E-Mail-Adresse ein.
//   EmailLabel       E-Mail

// ViewModels/RegisterViewModel.cs
public class RegisterViewModel
{
    [Required(ErrorMessage = "EmailRequired")]
    [EmailAddress(ErrorMessage = "EmailInvalid")]
    [Display(Name = "EmailLabel")]
    public string Email { get; set; } = "";
}

// Controllers/CultureController.cs
public class CultureController : Controller
{
    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Set(string culture, string returnUrl)
    {
        Response.Cookies.Append(
            CookieRequestCultureProvider.DefaultCookieName,
            CookieRequestCultureProvider.MakeCookieValue(new RequestCulture(culture)),
            new CookieOptions { Expires = DateTimeOffset.UtcNow.AddYears(1), IsEssential = true });

        return LocalRedirect(returnUrl);
    }
}

// Controllers/CartController.cs
public class CartController : Controller
{
    private readonly IStringLocalizer&lt;SharedResource&gt; _text;
    private readonly ICartService _cart;

    public CartController(IStringLocalizer&lt;SharedResource&gt; text, ICartService cart)
    {
        _text = text;
        _cart = cart;
    }

    public IActionResult Index()
    {
        var cart = _cart.Get();
        ViewData["Summary"] = _text["ItemsInCart", cart.ItemCount].Value;
        return View(cart);
    }
}

// Views/Shared/_Layout.cshtml
//
//   @using System.Globalization
//   @inject IViewLocalizer Localizer
//   @inject IOptions&lt;RequestLocalizationOptions&gt; LocOptions
//   @{
//       var culture = CultureInfo.CurrentUICulture;
//       var isRtl = culture.TextInfo.IsRightToLeft;
//   }
//   &lt;html lang="@culture.Name" dir="@(isRtl ? "rtl" : "ltr")"&gt;
//   ...
//   &lt;form asp-controller="Culture" asp-action="Set" method="post" class="d-inline"&gt;
//       &lt;input type="hidden" name="returnUrl" value="@Context.Request.Path" /&gt;
//       &lt;select name="culture" onchange="this.form.submit()" class="form-select form-select-sm"&gt;
//           @foreach (var c in LocOptions.Value.SupportedUICultures!)
//           {
//               &lt;option value="@c.Name" selected="@(c.Name == culture.Name)"&gt;@c.NativeName&lt;/option&gt;
//           }
//       &lt;/select&gt;
//   &lt;/form&gt;

// Views/Products/Details.cshtml (formatting follows the culture)
//
//   @inject IStringLocalizer&lt;SharedResource&gt; Shared
//   &lt;h1&gt;@Model.Name&lt;/h1&gt;
//   &lt;p&gt;@Model.Price.ToString("C")&lt;/p&gt;              @* 49,99 € for de, $49.99 for en *@
//   &lt;p&gt;@Model.ReleaseDate.ToString("D")&lt;/p&gt;        @* long date in the current culture *@
//   &lt;button class="btn btn-primary"&gt;@Shared["AddToCart"]&lt;/button&gt;
</code></pre>
