---
publishDate: 2026-08-01T09:00
title: What is ASP.NET Core MVC
slug: what-is-aspnet-core-mvc
metadescription: Learn what ASP.NET Core MVC is, what the Model, View and Controller each do, how a browser request turns into an HTML page, and when MVC is the right choice for your project.
updateDate: 2026-09-13T09:00
author: ['bishal-biswas']
level: 1
tags: ['basics', 'mvc-pattern', 'aspnet-core']
course: dotnet-mvc
---

## What is ASP.NET Core MVC?

**ASP.NET Core** is Microsoft's free and open source framework for building web applications with C#. It runs on Windows, Linux and macOS.

**MVC** stands for **Model, View, Controller**. It is not a library you install. It is a way of organizing your code into three parts, where each part has one clear job.

**ASP.NET Core MVC** is the part of ASP.NET Core that builds websites using this pattern. When someone visits a page, your C# code runs on the server, builds a complete HTML page and sends it to the browser.

Here is the idea in its smallest form. The browser asks for a page:

```http
GET /Products/Details/1 HTTP/1.1
Host: localhost:5001
```

Your server answers with HTML that is ready to show:

```html
<h1>Keyboard</h1>
<p>Price: $49.99</p>
```

The browser simply displays it. All the work happened on the server.

## The three parts, in plain words

Think of ordering food at a restaurant:

- The **waiter** takes your order and decides what should happen next. That is the **Controller**.
- The **kitchen** prepares the food using ingredients and recipes. That is the **Model**: your data and your rules.
- The **plate** is how the food is presented to you. That is the **View**: the HTML the user sees.

The waiter never cooks, and the kitchen never talks to customers. Each one sticks to its own job. MVC asks your code to behave the same way.

### Model

The **Model** is your data and the rules around it. In code, models are plain C# classes.

```csharp
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
}
```

A model knows nothing about HTML or web requests. It only describes a product.

### View

The **View** decides what the user sees. It is a `.cshtml` file: normal HTML with small pieces of C# mixed in. This mix is called **Razor**.

```cshtml
@model Product

<h1>@Model.Name</h1>
<p>Price: @Model.Price.ToString("C")</p>
```

The `@` symbol switches from HTML to C#. `@Model.Name` prints the product's name into the page.

### Controller

The **Controller** receives the request, gets the right data and picks a view to show it. It is a C# class, and each public method inside it is called an **action**.

```csharp
public class ProductsController : Controller
{
    public IActionResult Details(int id)
    {
        var product = new Product { Id = id, Name = "Keyboard", Price = 49.99m };
        return View(product);
    }
}
```

`return View(product)` means "show the Details view, and give it this product".

## How a request becomes a page

Let us follow one visit to `/Products/Details/1` from start to finish.

```text
1. Browser      asks for  GET /Products/Details/1
2. Routing      reads the URL: controller = Products, action = Details, id = 1
3. Controller   ProductsController.Details(1) runs
4. Model        the action loads product number 1
5. View         Views/Products/Details.cshtml is filled with that product
6. Response     the finished HTML is sent back to the browser
```

Step 2 is called **routing**. A new project comes with a default rule that reads URLs like this:

```csharp
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
```

The first part of the URL picks the controller, the second part picks the action, and the optional third part becomes `id`. If the URL is just `/`, the defaults are used and you get `HomeController.Index`.

Step 5 works by **convention**. A `Details` action inside `ProductsController` automatically looks for the file `Views/Products/Details.cshtml`. You do not write any configuration for this. You just put files in the right place.

## Why split code into three parts?

Imagine one giant file that reads the URL, runs a database query, applies discount rules and prints HTML. It works for one page. By page twenty it is a mess that nobody wants to touch.

MVC fixes this by giving each kind of code its own home:

- **Easier to find things.** Page layout lives in views. Data and rules live in models. Request handling lives in controllers.
- **Easier to change things.** You can redesign a page without touching your business rules.
- **Easier to test.** A controller is a normal C# class, so you can test it without opening a browser.
- **Teams can work side by side.** One person styles the views while another writes the controllers.

## MVC compared with Web API

ASP.NET Core also has **Web API**, which uses the same controllers but returns **data** instead of pages. An MVC controller can actually do both:

```csharp
public class ProductsController : Controller
{
    private readonly Product _product = new() { Id = 1, Name = "Keyboard", Price = 49.99m };

    // Returns an HTML page for people using a browser
    public IActionResult Details() => View(_product);

    // Returns JSON data for JavaScript code or a mobile app
    public IActionResult DetailsJson() => Json(_product);
}
```

Use MVC views when people look at pages in a browser. Use Web API when other programs need your data. Many real applications use both in the same project.

## ASP.NET MVC or ASP.NET Core MVC?

You will see both names online, so it helps to know the difference.

- **ASP.NET MVC 5** is the older version. It runs only on Windows, on the .NET Framework. It still gets important fixes, but no new features.
- **ASP.NET Core MVC** is the modern version. It is faster, runs on every major operating system and improves with every .NET release.

This course teaches **ASP.NET Core MVC on .NET 10**. When people say "ASP.NET MVC" today, this is usually what they mean.

A quick way to spot an old tutorial: if you see `Global.asax`, `Web.config` or `using System.Web.Mvc;`, it is about the old framework. The topic on migrating from ASP.NET MVC 5 near the end of this course explains how the old pieces map to the new ones.

## When is MVC a good choice?

MVC shines for websites where the server builds the pages:

- Online stores, blogs and news sites
- Company websites and customer portals
- Admin dashboards and business tools with lots of forms

Because the HTML arrives complete, search engines can read your pages easily, and the site feels fast even on slow phones.

If you need a very interactive screen that behaves like a desktop program, you can add some JavaScript to an MVC page, or look at Blazor. A later topic compares MVC, Razor Pages and Blazor side by side.

## What you will build in this course

Throughout the course you will grow a small online shop called **ShopApp**: product pages, forms with validation, a real database, a shopping cart, user login, an admin area, tests and finally a live deployment.

Do not worry if some words in this topic are new. Every one of them gets its own topic.

## Quick recap

- ASP.NET Core MVC builds websites where C# code on the server produces HTML pages.
- The **Model** holds data and rules, the **View** is the HTML the user sees, and the **Controller** handles the request and connects the two.
- Routing reads the URL to pick a controller and an action, such as `/Products/Details/1`.
- Views are found by convention: `ProductsController.Details` uses `Views/Products/Details.cshtml`.
- Splitting code this way makes apps easier to read, change and test.
- ASP.NET Core MVC is the modern, cross platform successor to ASP.NET MVC 5.

<code id="code-content" class="language-csharp">
// Controllers/ProductsController.cs
// The C (Controller) and the M (Model) of MVC in one file.
// The V (View) is Views/Products/Details.cshtml, shown at the bottom.
using Microsoft.AspNetCore.Mvc;
namespace ShopApp.Controllers;
public class ProductsController : Controller
{
    // A tiny in memory "database" so this example runs on its own
    private static readonly List&lt;Product&gt; Products = new()
    {
        new Product { Id = 1, Name = "Keyboard", Price = 49.99m },
        new Product { Id = 2, Name = "Mouse", Price = 19.99m },
        new Product { Id = 3, Name = "Monitor", Price = 199.99m }
    };
    // GET /Products
    // Shows Views/Products/Index.cshtml with the whole list
    public IActionResult Index()
    {
        return View(Products);
    }
    // GET /Products/Details/2
    // Routing turns the last part of the URL into the id parameter
    public IActionResult Details(int id)
    {
        Product? product = Products.FirstOrDefault(p =&gt; p.Id == id);
        if (product is null)
        {
            return NotFound();        // the visitor gets a 404 page
        }
        return View(product);         // shows Views/Products/Details.cshtml
    }
    // GET /Products/DetailsJson/2
    // The same data, sent as JSON instead of a page
    public IActionResult DetailsJson(int id)
    {
        Product? product = Products.FirstOrDefault(p =&gt; p.Id == id);
        return product is null ? NotFound() : Json(product);
    }
}
// The Model: a plain C# class that only describes the data
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
}
// The View: Views/Products/Details.cshtml
//
//   @model ShopApp.Controllers.Product
//   &lt;h1&gt;@Model.Name&lt;/h1&gt;
//   &lt;p&gt;Price: @Model.Price.ToString("C")&lt;/p&gt;
</code></pre>
