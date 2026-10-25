---
publishDate: 2026-08-03T09:50
title: Action Results
slug: action-results
metadescription: Learn every kind of result an MVC action can return, from views and redirects to JSON, files and status codes, and how to pick the right one for each situation.
updateDate: 2026-09-13T09:50
author: ['bishal-biswas']
level: 1
tags: ['action-results', 'controllers', 'iactionresult']
course: dotnet-mvc
---

## What an action result is

An action does not write HTML itself. It returns an object that **describes** the response, and the framework turns that description into real bytes on the wire. That object is an **action result**.

```csharp
public IActionResult Index()
{
    return View();   // "render a view and send it as HTML"
}
```

`View()` returns a `ViewResult`. `RedirectToAction()` returns a `RedirectToActionResult`. Both implement `IActionResult`, which is why the action can return either one.

## Why the return type is IActionResult

`IActionResult` is an interface, and every result type implements it. Using it as the return type lets one action pick different outcomes:

```csharp
public IActionResult Details(int id)
{
    var product = _repo.Find(id);

    if (product is null)
    {
        return NotFound();        // NotFoundResult
    }

    return View(product);         // ViewResult
}
```

If an action can only ever return a view, `ViewResult` works as the return type too. Most developers use `IActionResult` everywhere so they never have to change it later.

## Results that render HTML

**`View()`** renders a Razor view. It has a few forms:

```csharp
return View();                       // Views/{Controller}/{Action}.cshtml
return View(product);                // same view, with a model
return View("Summary");              // Views/{Controller}/Summary.cshtml
return View("Summary", product);     // that view, with a model
return View("~/Views/Other/Page.cshtml");   // an exact path
```

**`PartialView()`** renders a view without the layout. It is handy when JavaScript asks for a fragment of HTML to insert into a page:

```csharp
return PartialView("_ProductCard", product);
```

## Results that redirect

A redirect tells the browser "go to this other address instead". The browser then makes a second request.

```csharp
return RedirectToAction("Index");                              // same controller
return RedirectToAction("Index", "Home");                      // another controller
return RedirectToAction("Details", new { id = product.Id });   // with route values
return Redirect("https://example.com/help");                   // any URL
return LocalRedirect("/Products");                             // only URLs on this site
```

Redirects are the standard move after a form is saved, so that refreshing the page does not save it twice. That pattern is called Post Redirect Get and it has its own topic.

`RedirectToAction` sends a `302` status. Use `RedirectToActionPermanent` for a `301` when a page has moved for good, which is what search engines expect.

`LocalRedirect` throws if the URL points to another site. Use it whenever the target came from user input, such as a `returnUrl` after login, so nobody can bounce your users to a fake site.

## Results that send data

**`Content()`** sends plain text:

```csharp
return Content("Hello");
return Content("<b>Hi</b>", "text/html");
```

**`Json()`** sends an object as JSON. This is how an MVC controller answers JavaScript running on your own pages:

```csharp
return Json(new { id = 5, name = "Mouse", inStock = true });
```

```json
{ "id": 5, "name": "Mouse", "inStock": true }
```

Property names come out in camelCase, the JavaScript convention.

## Results that send files

**`File()`** sends bytes or a stream as a download or an inline file:

```csharp
byte[] pdf = _invoices.Generate(orderId);
return File(pdf, "application/pdf", "invoice.pdf");   // download with a file name
return File(pdf, "application/pdf");                   // shown in the browser
```

The second argument is the **content type**, which tells the browser what kind of file it is.

For a file on disk, use `PhysicalFile` with a full path, or `File` with a path relative to `wwwroot`:

```csharp
return PhysicalFile(@"C:\reports\summary.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
return File("/downloads/guide.pdf", "application/pdf");
```

## Results that are just a status code

Sometimes the answer is only a status:

```csharp
return NotFound();                    // 404
return BadRequest();                  // 400
return Unauthorized();                // 401, not logged in
return Forbid();                      // 403, logged in but not allowed
return StatusCode(503);               // any code you like
return NoContent();                   // 204, success with an empty body
return Ok();                          // 200 with an empty body
```

In an MVC website, a `NotFound()` result is later turned into a friendly 404 page by the error handling middleware, which is covered in its own topic.

## A quick reference

| Helper | Result type | What the browser gets |
| --- | --- | --- |
| `View()` | `ViewResult` | An HTML page |
| `PartialView()` | `PartialViewResult` | An HTML fragment without the layout |
| `RedirectToAction()` | `RedirectToActionResult` | A 302 to another action |
| `Redirect()` | `RedirectResult` | A 302 to any URL |
| `LocalRedirect()` | `LocalRedirectResult` | A 302, only to this site |
| `Content()` | `ContentResult` | Plain text |
| `Json()` | `JsonResult` | JSON |
| `File()` | `FileContentResult` | A file download |
| `NotFound()` | `NotFoundResult` | 404 |
| `BadRequest()` | `BadRequestResult` | 400 |
| `StatusCode(n)` | `StatusCodeResult` | Any status code |

## Returning a plain object

If an action returns something that is not an `IActionResult`, the framework wraps it for you:

```csharp
public string Ping() => "pong";                    // becomes ContentResult
public Product Latest() => _repo.Latest();         // becomes JSON
```

This is common in Web API projects. In MVC websites, be explicit and return `IActionResult`, because it is clearer to the next person reading the code.

## Choosing the right result

Ask what the visitor should see next:

- A page? `View()`.
- A different page, after saving something? `RedirectToAction()`.
- Data for JavaScript on the page? `Json()`.
- A download? `File()`.
- Nothing, because the thing does not exist? `NotFound()`.

## Quick recap

- An action returns an object that describes the response. The framework does the actual writing.
- Use `IActionResult` as the return type so one action can return a view, a redirect or a status code.
- `View()` renders HTML and `PartialView()` renders a fragment without the layout.
- `RedirectToAction()` sends the browser to another action, which is the normal step after a form is saved.
- `Json()`, `Content()` and `File()` send data instead of pages.
- `NotFound()`, `BadRequest()` and `StatusCode()` send a status with no page.

<code id="code-content" class="language-csharp">
// Controllers/DemoController.cs
// One controller that shows every common result type.
// Run the app and try each URL in your browser.
using Microsoft.AspNetCore.Mvc;
using ShopApp.Models;
namespace ShopApp.Controllers;
public class DemoController : Controller
{
    private static readonly Product Sample = new() { Id = 1, Name = "Mouse", Price = 19.99m };
    // /Demo            -&gt; an HTML page (Views/Demo/Index.cshtml)
    public IActionResult Index() =&gt; View();
    // /Demo/Product    -&gt; the Details view with a model
    public IActionResult Product() =&gt; View("Details", Sample);
    // /Demo/Card       -&gt; an HTML fragment with no layout
    public IActionResult Card() =&gt; PartialView("_ProductCard", Sample);
    // /Demo/GoHome     -&gt; 302 to /Home/Index
    public IActionResult GoHome() =&gt; RedirectToAction("Index", "Home");
    // /Demo/GoProduct  -&gt; 302 to /Products/Details/1
    public IActionResult GoProduct() =&gt; RedirectToAction("Details", "Products", new { id = 1 });
    // /Demo/OldPage    -&gt; 301, the page moved for good
    public IActionResult OldPage() =&gt; RedirectToActionPermanent("Index");
    // /Demo/Back?returnUrl=/Products  -&gt; safe redirect, only to this site
    public IActionResult Back(string? returnUrl)
    {
        if (string.IsNullOrEmpty(returnUrl) || !Url.IsLocalUrl(returnUrl))
        {
            return RedirectToAction("Index", "Home");
        }
        return LocalRedirect(returnUrl);
    }
    // /Demo/Text       -&gt; plain text
    public IActionResult Text() =&gt; Content("Hello from ShopApp");
    // /Demo/Data       -&gt; JSON: {"id":1,"name":"Mouse","price":19.99}
    public IActionResult Data() =&gt; Json(Sample);
    // /Demo/Download   -&gt; a file download called hello.txt
    public IActionResult Download()
    {
        byte[] bytes = System.Text.Encoding.UTF8.GetBytes("Hello from ShopApp");
        return File(bytes, "text/plain", "hello.txt");
    }
    // /Demo/Missing    -&gt; 404
    public IActionResult Missing() =&gt; NotFound();
    // /Demo/Broken     -&gt; 400
    public IActionResult Broken() =&gt; BadRequest();
    // /Demo/Later      -&gt; 503 Service Unavailable
    public IActionResult Later() =&gt; StatusCode(503);
    // /Demo/Find/1 or /Demo/Find/2 -&gt; different results from one action
    public IActionResult Find(int id)
    {
        if (id != Sample.Id)
        {
            return NotFound();
        }
        return View("Details", Sample);
    }
}
</code></pre>
