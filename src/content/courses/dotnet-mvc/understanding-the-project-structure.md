---
publishDate: 2026-08-02T09:30
title: Understanding the Project Structure
slug: understanding-the-project-structure
metadescription: Walk through every folder and file the MVC template creates, learn what Controllers, Models, Views and wwwroot are for, and understand the special files such as _ViewImports, _ViewStart, appsettings.json and the project file.
updateDate: 2026-09-13T09:30
author: ['bishal-biswas']
level: 1
tags: ['project-structure', 'conventions', 'basics']
course: dotnet-mvc
---

## The big picture

A new MVC project looks like this:

```text
ShopApp/
    Controllers/
        HomeController.cs
    Models/
        ErrorViewModel.cs
    Views/
        Home/
            Index.cshtml
            Privacy.cshtml
        Shared/
            _Layout.cshtml
            _Layout.cshtml.css
            _ValidationScriptsPartial.cshtml
            Error.cshtml
        _ViewImports.cshtml
        _ViewStart.cshtml
    wwwroot/
        css/
        js/
        lib/
        favicon.ico
    Properties/
        launchSettings.json
    appsettings.json
    appsettings.Development.json
    Program.cs
    ShopApp.csproj
```

MVC relies on **conventions**, which means the framework finds things by name and location rather than by configuration. That only works if you know where things belong. This topic is the map.

## Controllers

The `Controllers` folder holds one C# class per group of related pages. Every controller class name ends with `Controller`, and that suffix is dropped in URLs. `ProductsController` handles URLs that start with `/Products`.

Inside each controller, public methods are **actions**. The template gives you `HomeController` with `Index`, `Privacy` and `Error`.

You can put controllers anywhere in the project, because the framework finds them by their base class rather than the folder. The folder is a convention to keep things tidy, so follow it.

## Models

The `Models` folder holds plain C# classes that describe your data. The template starts with just one:

```csharp
public class ErrorViewModel
{
    public string? RequestId { get; set; }

    public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);
}
```

That is a **view model**: a class shaped for one particular page. As the shop grows, this folder will also get classes such as `Product` and `Category`. Some teams split these into `Models` for database classes and `ViewModels` for page classes. Either way is fine.

## Views

The `Views` folder holds the `.cshtml` files that produce HTML. The rule that matters most:

```text
Views/{ControllerName}/{ActionName}.cshtml
```

`HomeController.Privacy()` shows `Views/Home/Privacy.cshtml`. If the framework cannot find a view in the controller's folder, it looks in `Views/Shared`.

### Views/Shared

Files here can be used by every controller:

- `_Layout.cshtml` is the page frame: the `<html>` and `<body>` tags, the navigation bar, the footer, and the CSS and script links. Each view fills in the middle.
- `_Layout.cshtml.css` holds styles that apply only to the layout. This is called **CSS isolation**.
- `_ValidationScriptsPartial.cshtml` loads the JavaScript for client side form validation. Pages with forms include it.
- `Error.cshtml` is the page visitors see when something goes wrong in production.

Files whose names start with an underscore are not meant to be shown on their own. They are pieces used by other views. The underscore is only a naming habit, but everyone follows it.

### _ViewImports.cshtml

This file runs before every view. It holds directives you would otherwise repeat at the top of each file:

```cshtml
@using ShopApp
@using ShopApp.Models
@addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers
```

The `@using` lines mean views can say `Product` instead of `ShopApp.Models.Product`. The `@addTagHelper` line turns on the built in tag helpers, such as `asp-action` on links.

### _ViewStart.cshtml

This file also runs before every view, and the template uses it to pick the layout:

```cshtml
@{
    Layout = "_Layout";
}
```

Because of this one file, every page gets the navigation bar and footer without asking for it. A view can override it by setting `Layout` itself, or set `Layout = null` for a page with no frame.

## wwwroot

`wwwroot` is the **web root**. It is the only folder whose files are sent directly to the browser. A file at `wwwroot/css/site.css` is available at the URL `/css/site.css`.

- `css/site.css` is your stylesheet.
- `js/site.js` is your JavaScript, empty to begin with.
- `lib/` holds third party libraries: Bootstrap, jQuery and the jQuery validation plugins.
- `favicon.ico` is the little icon in the browser tab.

Never put C# files or secrets in `wwwroot`. Anything there is public.

## Properties/launchSettings.json

This file describes how to start the app on your machine: which URLs to listen on, whether to open a browser, and which environment to use. It is ignored when the app is deployed.

## appsettings.json

This is your configuration file. The template starts small:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

Later you will add connection strings and your own settings here. `appsettings.Development.json` holds values that only apply while developing, and they override the main file. There is a whole topic on configuration later in the course.

## Program.cs

The entry point. It registers services, builds the request pipeline and starts the server. You read it line by line in the previous topic.

## The project file

`ShopApp.csproj` describes the project to the SDK:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

</Project>
```

- `Microsoft.NET.Sdk.Web` is the SDK for web projects. It knows how to compile Razor views and how to treat `wwwroot`.
- `TargetFramework` says which .NET version to use.
- `Nullable` turns on nullable reference types, so the compiler warns you when a value could be `null`.
- `ImplicitUsings` adds common `using` lines such as `System` and `System.Linq` to every file automatically.

When you add a NuGet package, a `PackageReference` line appears here. There is no list of source files, because every `.cs` file in the folder is included automatically.

## bin and obj

After the first build you will see two extra folders. `obj` holds temporary build files and `bin` holds the compiled output. Both are regenerated on every build, so never edit them and never commit them to source control. The template's `.gitignore` already excludes them.

## Where new things go

As the course goes on, you will add more folders. These names are common conventions, not rules:

```text
Data/          the EF Core DbContext and migrations
Services/      classes with business logic
ViewModels/    classes shaped for specific pages
Areas/         large sections of the site, such as Admin
Filters/       action filters
Middleware/    custom middleware
```

## Quick recap

- Controllers handle requests, Models describe data, and Views produce HTML. Each has its own folder.
- The framework finds views by convention: `Views/{Controller}/{Action}.cshtml`, then `Views/Shared`.
- `_ViewImports.cshtml` adds `using` lines and tag helpers to every view, and `_ViewStart.cshtml` picks the layout.
- `wwwroot` is the only folder served straight to the browser.
- `appsettings.json` holds configuration and `launchSettings.json` holds local start up options.
- The `.csproj` file lists the target framework and NuGet packages. Every `.cs` file is included automatically.

<code id="code-content" class="language-csharp">
// Program.cs, annotated with the folder each line depends on.
// Use this as a map of the project when you are new to it.
var builder = WebApplication.CreateBuilder(args);
//   Reads appsettings.json and appsettings.Development.json,
//   plus environment variables and Properties/launchSettings.json.
builder.Services.AddControllersWithViews();
//   Turns on the Controllers/ folder and the Views/ folder.
//   Razor views are compiled into the app by Microsoft.NET.Sdk.Web.
var app = builder.Build();
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    //   Runs HomeController.Error, which shows Views/Shared/Error.cshtml
    //   using Models/ErrorViewModel.cs.
    app.UseHsts();
}
app.UseHttpsRedirection();
app.UseRouting();
app.UseAuthorization();
app.MapStaticAssets();
//   Serves the wwwroot/ folder: /css/site.css, /js/site.js, /lib/...
//   Nothing outside wwwroot is ever sent to the browser.
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();
//   /Products/Details/5  -&gt;  Controllers/ProductsController.cs, Details(5)
//                        -&gt;  Views/Products/Details.cshtml
//   Before that view runs: Views/_ViewImports.cshtml (usings, tag helpers)
//                          Views/_ViewStart.cshtml   (Layout = "_Layout")
//   The layout itself:     Views/Shared/_Layout.cshtml
app.Run();
// Folders you will add during the course:
//   Data/        DbContext and EF Core migrations
//   Services/    business logic classes registered in builder.Services
//   ViewModels/  classes shaped for one page
//   Areas/       big sections such as Admin, each with its own MVC folders
</code></pre>
