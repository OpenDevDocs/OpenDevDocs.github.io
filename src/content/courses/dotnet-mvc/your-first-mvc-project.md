---
publishDate: 2026-08-01T09:20
title: Your First MVC Project
slug: your-first-mvc-project
metadescription: Create an MVC project with the dotnet CLI, run it in watch mode, read Program.cs line by line, follow the home page from controller to view, and add your own first page.
updateDate: 2026-09-13T09:20
author: ['bishal-biswas']
level: 1
tags: ['getting-started', 'dotnet-cli', 'program-cs']
course: dotnet-mvc
---

## Creating the project

Open a terminal in the folder where you keep your code and run:

```bash
dotnet new mvc -n ShopApp
cd ShopApp
```

`dotnet new mvc` uses the built in MVC template. `-n` sets the project name, which becomes the folder name and the default C# namespace. We call it `ShopApp` because this is the small online shop you will grow through the whole course.

## Running it

```bash
dotnet run
```

You will see output like this:

```text
Building...
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: https://localhost:7042
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5042
info: Microsoft.Hosting.Lifetime[0]
      Hosting environment: Development
```

Your site is live. The port numbers are chosen at random when the project is created, so yours will be different. Copy the `https` address into your browser. You get a page with a blue **Welcome** heading, a navigation bar with **Home** and **Privacy** links, and a footer. All of that came from the template.

Stop the server with `Ctrl+C`.

## Use watch mode instead

From now on, start the app like this:

```bash
dotnet watch
```

Watch mode rebuilds and refreshes the browser every time you save a file. Small changes to views and C# code are applied without even restarting the app, which is called **hot reload**. You will save a lot of time.

## Reading Program.cs

Open `Program.cs`. It is short:

```csharp
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();

app.UseAuthorization();

app.MapStaticAssets();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();
```

Every ASP.NET Core app follows the same four steps. Learn them once and every project will look familiar.

**Step 1: create a builder.** `WebApplication.CreateBuilder(args)` reads settings from `appsettings.json`, environment variables and the command line, and sets up logging.

**Step 2: register services.** `builder.Services.AddControllersWithViews()` tells the app that you want controllers and Razor views. Anything your code needs later is registered here.

**Step 3: build the request pipeline.** Each `app.Use...` line adds a step that every request passes through. `UseExceptionHandler` shows a friendly error page in production, `UseHttpsRedirection` sends `http` visitors to `https`, `UseRouting` matches the URL to your code, and `UseAuthorization` checks whether the visitor is allowed in. `MapStaticAssets` serves the CSS, JavaScript and images from the `wwwroot` folder.

**Step 4: map routes and run.** `MapControllerRoute` defines the default URL pattern, which the next topics explain in detail. `app.Run()` starts the web server and waits for requests.

## Following the home page

How did that Welcome page appear? Start with the URL. You visited `/`, which is empty, so the route pattern used its defaults: controller `Home`, action `Index`.

Open `Controllers/HomeController.cs`:

```csharp
public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;

    public HomeController(ILogger<HomeController> logger)
    {
        _logger = logger;
    }

    public IActionResult Index()
    {
        return View();
    }

    public IActionResult Privacy()
    {
        return View();
    }
}
```

`Index` is an **action**. It does one thing: `return View()`. With no arguments, `View()` looks for a view with the same name as the action, inside a folder with the same name as the controller. That is `Views/Home/Index.cshtml`:

```cshtml
@{
    ViewData["Title"] = "Home Page";
}

<div class="text-center">
    <h1 class="display-4">Welcome</h1>
    <p>Learn about <a href="https://learn.microsoft.com/aspnet/core">building Web apps with ASP.NET Core</a>.</p>
</div>
```

The lines inside `@{ ... }` are C#. They store a title that the shared layout prints in the browser tab. Everything else is plain HTML.

Where did the navigation bar and footer come from? They live in `Views/Shared/_Layout.cshtml`, a page frame that wraps every view. Layouts get their own topic soon.

## Your first change

With `dotnet watch` running, change the heading in `Views/Home/Index.cshtml`:

```html
<h1 class="display-4">Welcome to ShopApp</h1>
```

Save the file. The browser refreshes on its own and shows the new heading. That is the loop you will live in: edit, save, look.

## Adding your own page

Now add a page that did not exist before. First, a new action in `HomeController`:

```csharp
public IActionResult About()
{
    return View();
}
```

Then create the file `Views/Home/About.cshtml`:

```cshtml
@{
    ViewData["Title"] = "About";
}

<h1>About ShopApp</h1>
<p>A small shop built while learning ASP.NET Core MVC.</p>
```

Visit `/Home/About`. The URL maps to the `Home` controller and the `About` action, and the action shows the view with the matching name. No configuration needed.

Finally, put a link in the navigation bar. In `Views/Shared/_Layout.cshtml`, find the `Privacy` link and add one like it:

```cshtml
<li class="nav-item">
    <a class="nav-link text-dark" asp-controller="Home" asp-action="About">About</a>
</li>
```

`asp-controller` and `asp-action` build the correct `href` for you. This is a **tag helper**, and you will use them everywhere.

## If a view is missing

Try visiting `/Home/Missing`. You get a 404 page, because there is no `Missing` action. Now add an action but forget the view, and you get a detailed error page that lists every place the framework looked:

```text
InvalidOperationException: The view 'Missing' was not found.
The following locations were searched:
/Views/Home/Missing.cshtml
/Views/Shared/Missing.cshtml
```

This page only appears in Development. It is one of the most helpful errors you will ever see, because it tells you exactly which file to create.

## Where the port numbers come from

Open `Properties/launchSettings.json`:

```json
{
  "profiles": {
    "http": {
      "commandName": "Project",
      "launchBrowser": true,
      "applicationUrl": "http://localhost:5042",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    },
    "https": {
      "commandName": "Project",
      "launchBrowser": true,
      "applicationUrl": "https://localhost:7042;http://localhost:5042",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}
```

This file is for your machine only. It is not used when you deploy. Change `applicationUrl` if you want a port you can remember, and set `launchBrowser` to `true` if you want the browser to open automatically.

## Quick recap

- `dotnet new mvc -n Name` creates a working website with a home page, a layout and Bootstrap styling.
- `dotnet watch` is the command to use while developing, because it rebuilds and refreshes on every save.
- `Program.cs` always has the same shape: create a builder, register services, build the pipeline, map routes, run.
- A URL like `/Home/About` runs the `About` action in `HomeController`, which shows `Views/Home/About.cshtml`.
- `View()` with no arguments finds the view by convention: the action name inside the controller's folder.
- Use `asp-controller` and `asp-action` on links so the URLs are generated for you.

<code id="code-content" class="language-csharp">
// Program.cs and Controllers/HomeController.cs from a fresh project,
// with the About page added.
//
// dotnet new mvc -n ShopApp
// cd ShopApp
// dotnet watch
//
// ---------- Program.cs ----------
var builder = WebApplication.CreateBuilder(args);
// 1. Register services. This one turns on controllers and Razor views.
builder.Services.AddControllersWithViews();
var app = builder.Build();
// 2. Build the request pipeline. Order matters: each line runs in turn.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");   // friendly error page in production
    app.UseHsts();                             // tell browsers to always use HTTPS
}
app.UseHttpsRedirection();                     // http -&gt; https
app.UseRouting();                              // match the URL to an action
app.UseAuthorization();                        // is this visitor allowed?
app.MapStaticAssets();                         // serve wwwroot (css, js, images)
// 3. The default route: /Products/Details/5 -&gt; ProductsController.Details(5)
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();
app.Run();                                     // start listening
// ---------- Controllers/HomeController.cs ----------
using Microsoft.AspNetCore.Mvc;
namespace ShopApp.Controllers;
public class HomeController : Controller
{
    private readonly ILogger&lt;HomeController&gt; _logger;
    public HomeController(ILogger&lt;HomeController&gt; logger)
    {
        _logger = logger;
    }
    // GET /            (route defaults)
    // GET /Home/Index  -&gt; Views/Home/Index.cshtml
    public IActionResult Index()
    {
        return View();
    }
    // GET /Home/Privacy -&gt; Views/Home/Privacy.cshtml
    public IActionResult Privacy()
    {
        return View();
    }
    // GET /Home/About -&gt; Views/Home/About.cshtml (the page you added)
    public IActionResult About()
    {
        _logger.LogInformation("Someone opened the About page");
        return View();
    }
}
</code></pre>
