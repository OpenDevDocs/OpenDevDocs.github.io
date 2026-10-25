---
publishDate: 2026-08-03T10:00
title: Handling GET and POST Requests
slug: handling-get-and-post-requests
metadescription: Understand the difference between GET and POST, use HttpGet and HttpPost to pair a form page with the action that saves it, read submitted values, and apply the Post Redirect Get pattern.
updateDate: 2026-09-13T10:00
author: ['bishal-biswas']
level: 1
tags: ['http-methods', 'forms', 'post-redirect-get']
course: dotnet-mvc
---

## Two kinds of requests

When a browser talks to your site, almost every request is one of two kinds.

**GET** asks for a page. Typing a URL, clicking a link and pressing refresh all send GET requests. A GET should only read data and never change anything.

**POST** sends data to the server. Submitting a form is a POST. It is used for actions that change something: creating an order, saving a profile, logging in.

```http
GET /Contact HTTP/1.1
Host: localhost:7042
```

```http
POST /Contact HTTP/1.1
Host: localhost:7042
Content-Type: application/x-www-form-urlencoded

Name=Asha&Email=asha%40example.com&Message=Hello
```

The POST carries the form fields in its **body**. A GET has no body, so its data can only travel in the URL.

## Actions respond to GET by default

An action with no attribute answers any method. In practice that means GET, because the browser only sends POST when a form asks it to.

```csharp
public IActionResult Contact()
{
    return View();
}
```

To limit an action to one method, add an attribute:

```csharp
[HttpGet]
public IActionResult Contact() => View();
```

There are matching attributes for every method: `[HttpPost]`, `[HttpPut]`, `[HttpDelete]`, `[HttpPatch]`. In an MVC website you will mostly use the first two, because HTML forms can only send GET and POST.

## The GET and POST pair

Forms almost always come in pairs: one action shows the empty form, and a second action with the same name receives the submitted data.

```csharp
// Shows the form
[HttpGet]
public IActionResult Contact()
{
    return View();
}

// Receives the form
[HttpPost]
public IActionResult Contact(ContactForm form)
{
    _mailer.Send(form);
    return RedirectToAction("ThankYou");
}
```

Two methods with the same name are allowed because they respond to different HTTP methods. Without the attributes, the framework could not tell them apart and would throw an error saying the request matched multiple actions.

The view for both is `Views/Contact/Contact.cshtml`, and the form in it posts back to the same URL:

```cshtml
@model ContactForm

<form asp-action="Contact" method="post">
    <label asp-for="Name"></label>
    <input asp-for="Name" />

    <label asp-for="Email"></label>
    <input asp-for="Email" />

    <label asp-for="Message"></label>
    <textarea asp-for="Message"></textarea>

    <button type="submit">Send</button>
</form>
```

`method="post"` is what makes the browser send a POST. Leave it out and the form sends a GET with the fields in the query string, which is wrong for anything that saves data.

## Reading the submitted values

The `ContactForm` parameter in the POST action is filled automatically. The framework matches each form field name to a property name:

```csharp
public class ContactForm
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Message { get; set; } = "";
}
```

This is **model binding**, and it works the same way for the query string in a GET. You can also bind single values instead of a class:

```csharp
[HttpPost]
public IActionResult Subscribe(string email, bool weekly)
{
    // email = "asha@example.com", weekly = true
    return RedirectToAction("Index");
}
```

If you ever need the raw values, they are in `Request.Form` for a POST and `Request.Query` for a GET. Binding is nicer, so reach for the raw collections only in unusual cases.

## Post Redirect Get

Look at the POST action again. It does not return a view. It **redirects**:

```csharp
[HttpPost]
public IActionResult Contact(ContactForm form)
{
    _mailer.Send(form);
    return RedirectToAction("ThankYou");
}
```

Here is why. If a POST returns a page directly and the visitor presses refresh, the browser asks "Resend the form?" and, if they say yes, the message is sent twice. Redirecting to a GET page avoids that, because refreshing the new page is a harmless GET.

The pattern is called **Post Redirect Get**, or PRG:

```text
1. POST   the browser submits the form
2. 302    the server saves the data and redirects
3. GET    the browser loads the confirmation page
```

Do this after every successful form submission. There is one exception: when the data is invalid, return the same view so the visitor can fix their mistakes. Validation has its own topic.

## Checking the method by hand

Occasionally you want one action to handle both methods and branch inside:

```csharp
public IActionResult Contact(ContactForm? form)
{
    if (Request.Method == HttpMethods.Post)
    {
        // save
    }

    return View(form);
}
```

This works, but two clearly named actions are easier to read and test. Prefer the pair.

## When a form action needs a different name

Sometimes two actions cannot share a name. The classic case is delete: the GET shows a confirmation page, and the POST does the deleting, but both take an `int id` parameter, and C# does not allow two methods with the same name and the same parameter list.

`[ActionName]` solves it. The method has a different C# name but answers to the same URL:

```csharp
[HttpGet]
public IActionResult Delete(int id)
{
    return View(_repo.Find(id));
}

[HttpPost, ActionName("Delete")]
public IActionResult DeleteConfirmed(int id)
{
    _repo.Delete(id);
    return RedirectToAction("Index");
}
```

Both respond at `/Products/Delete/5`. You will see this exact pattern in the code that Visual Studio scaffolds for you.

## Other verbs from a browser

HTML forms only know GET and POST. If you want a `DELETE` or `PUT` request, you need JavaScript:

```javascript
await fetch('/Products/5', { method: 'DELETE' });
```

For a normal website, a POST to a `Delete` action is the standard approach and it is perfectly fine.

## Quick recap

- GET asks for a page and must not change anything. POST sends data that changes something.
- Use `[HttpGet]` and `[HttpPost]` on two actions with the same name: one shows the form, the other receives it.
- Form fields bind to a class or to individual parameters by name.
- After a successful POST, redirect to a GET page. This is Post Redirect Get, and it stops refresh from resubmitting the form.
- Return the view again only when the submitted data is invalid.
- `[ActionName]` lets a method with a different C# name answer the same URL, which is needed for delete confirmations.

<code id="code-content" class="language-csharp">
// Controllers/ContactController.cs
// The GET and POST pair, with Post Redirect Get.
using Microsoft.AspNetCore.Mvc;
using ShopApp.Models;
namespace ShopApp.Controllers;
public class ContactController : Controller
{
    // In a real app this would be an email service injected through the constructor.
    private static readonly List&lt;ContactForm&gt; Inbox = new();
    // GET /Contact
    // Shows the empty form. Views/Contact/Index.cshtml
    [HttpGet]
    public IActionResult Index()
    {
        return View(new ContactForm());
    }
    // POST /Contact
    // Receives the form. Same name as the GET action, different HTTP method.
    [HttpPost]
    public IActionResult Index(ContactForm form)
    {
        // Model binding filled 'form' from the posted fields Name, Email and Message.
        if (!ModelState.IsValid)
        {
            // Invalid input: show the same page again so the visitor can fix it.
            return View(form);
        }
        Inbox.Add(form);
        // Valid input: redirect so a refresh does not send the message twice.
        return RedirectToAction("ThankYou");
    }
    // GET /Contact/ThankYou
    public IActionResult ThankYou()
    {
        return View();
    }
    // GET /Contact/Delete/3   -&gt; confirmation page
    [HttpGet]
    public IActionResult Delete(int id)
    {
        if (id &lt; 0 || id &gt;= Inbox.Count) return NotFound();
        return View(Inbox[id]);
    }
    // POST /Contact/Delete/3  -&gt; actually delete
    // A different C# name, because two methods cannot share a name AND a parameter list.
    [HttpPost, ActionName("Delete")]
    public IActionResult DeleteConfirmed(int id)
    {
        if (id &lt; 0 || id &gt;= Inbox.Count) return NotFound();
        Inbox.RemoveAt(id);
        return RedirectToAction("Index");
    }
}
// Models/ContactForm.cs
namespace ShopApp.Models;
public class ContactForm
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Message { get; set; } = "";
}
// Views/Contact/Index.cshtml
//
//   @model ContactForm
//   &lt;form asp-action="Index" method="post"&gt;
//       &lt;label asp-for="Name"&gt;&lt;/label&gt;    &lt;input asp-for="Name" /&gt;
//       &lt;label asp-for="Email"&gt;&lt;/label&gt;   &lt;input asp-for="Email" /&gt;
//       &lt;label asp-for="Message"&gt;&lt;/label&gt; &lt;textarea asp-for="Message"&gt;&lt;/textarea&gt;
//       &lt;button type="submit"&gt;Send&lt;/button&gt;
//   &lt;/form&gt;
</code></pre>
