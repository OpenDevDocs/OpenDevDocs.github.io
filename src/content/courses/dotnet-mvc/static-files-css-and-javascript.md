---
publishDate: 2026-08-09T11:50
title: Static Files, CSS and JavaScript
slug: static-files-css-and-javascript
metadescription: Serve CSS, JavaScript and images from wwwroot, understand MapStaticAssets and UseStaticFiles, bust browser caches with asp-append-version, manage client libraries with LibMan, and scope styles to one view with CSS isolation.
updateDate: 2026-09-13T11:50
author: ['bishal-biswas']
level: 1
tags: ['static-files', 'wwwroot', 'css', 'javascript']
course: dotnet-mvc
---

## The wwwroot folder

Browsers need more than HTML. They need stylesheets, scripts, images and fonts. In ASP.NET Core these **static files** live in the `wwwroot` folder, and only that folder is served to the public.

```text
wwwroot/
    css/site.css          ->  /css/site.css
    js/site.js            ->  /js/site.js
    images/logo.png       ->  /images/logo.png
    lib/bootstrap/...     ->  /lib/bootstrap/...
    favicon.ico           ->  /favicon.ico
```

The folder name disappears from the URL. A file at `wwwroot/css/site.css` is reached at `/css/site.css`.

Files outside `wwwroot` are never served, no matter what URL someone tries. That is what keeps `appsettings.json` and your C# code private.

## Referencing files from a view

Use `~/` at the start of a path to mean "the web root":

```cshtml
<link rel="stylesheet" href="~/css/site.css" />
<script src="~/js/site.js"></script>
<img src="~/images/logo.png" alt="ShopApp" />
```

Razor turns `~/` into the right path even when the app is hosted under a sub folder such as `/shop`. A plain `/css/site.css` would break in that case, so get in the habit of `~/`.

## How static files are served

Look at `Program.cs` from the template:

```csharp
app.MapStaticAssets();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();
```

`MapStaticAssets` is the modern way to serve `wwwroot`. At build time it compresses every file and computes a fingerprint, so files are sent small and cached correctly. `.WithStaticAssets()` links that up with your MVC pages.

You will also see the older line in many projects:

```csharp
app.UseStaticFiles();
```

It works fine and serves the files as they are, without the build time compression. Both can be used, but a new project only needs `MapStaticAssets`.

## Serving a second folder

Occasionally files live somewhere else, such as uploads saved outside the project. `UseStaticFiles` can map any folder to any URL:

```csharp
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(builder.Environment.ContentRootPath, "Uploads")),
    RequestPath = "/uploads"
});
```

Now `Uploads/photo.jpg` on disk is available at `/uploads/photo.jpg`. Be careful about what you expose this way, because everything in that folder becomes public.

## Cache busting with asp-append-version

Browsers cache static files to make pages load faster. That causes a classic problem: you change `site.css`, deploy, and visitors keep seeing the old styles because their browser still has the old file.

The fix is a version stamp in the URL:

```cshtml
<link rel="stylesheet" href="~/css/site.css" asp-append-version="true" />
```

```html
<link rel="stylesheet" href="/css/site.css?v=Kl_dqr9NVtnMdsM2MUg4qthUnWZm5T1fCEimBPWzT1Y" />
```

The `v` value is a hash of the file's contents. Change the file and the hash changes, so the browser sees a new URL and downloads the fresh copy. Leave the file alone and the hash stays the same, so caching still works. Use it on every `<link>`, `<script>` and `<img>` that points at your own files.

## Third party libraries with LibMan

The template ships Bootstrap and jQuery inside `wwwroot/lib`. They got there through **LibMan**, the Library Manager, which is a small tool that downloads client libraries from a CDN into your project.

Install the tool once:

```bash
dotnet tool install --global Microsoft.Web.LibraryManager.Cli
```

Then add a library from the project folder:

```bash
libman install lodash@4.17.21 --provider cdnjs --destination wwwroot/lib/lodash
```

LibMan records the library in `libman.json`, so the next developer can run `libman restore` and get the same files:

```json
{
  "version": "1.0",
  "defaultProvider": "cdnjs",
  "libraries": [
    {
      "library": "lodash@4.17.21",
      "destination": "wwwroot/lib/lodash/"
    }
  ]
}
```

LibMan only copies files. It does not bundle or transpile. If your front end grows to need a build step, use npm with a bundler such as Vite and point its output folder at `wwwroot`.

## Using a CDN in production

A common set up is a local file while developing and a CDN in production, with a fallback in case the CDN is down:

```cshtml
<environment include="Development">
    <script src="~/lib/jquery/dist/jquery.js"></script>
</environment>
<environment exclude="Development">
    <script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"
            asp-fallback-src="~/lib/jquery/dist/jquery.min.js"
            asp-fallback-test="window.jQuery"></script>
</environment>
```

`asp-fallback-test` is a JavaScript expression. If it is false after the CDN script should have loaded, the local file is loaded instead.

## CSS isolation: styles for one view

Styles in `site.css` apply to the whole site. To style one view without leaking into others, create a `.cshtml.css` file next to it:

```text
Views/Products/Details.cshtml
Views/Products/Details.cshtml.css
```

```css
.price {
    font-size: 1.5rem;
    color: #1a7f37;
}
```

At build time the framework rewrites those rules so they only match elements in that view, and bundles everything into one file. The template's layout already links it:

```cshtml
<link rel="stylesheet" href="~/ShopApp.styles.css" asp-append-version="true" />
```

Replace `ShopApp` with your project name. The template does this for `_Layout.cshtml.css` out of the box.

## Where your own code goes

- Site wide styles go in `wwwroot/css/site.css`.
- Site wide scripts go in `wwwroot/js/site.js`, which the layout already loads.
- A script for one page goes in its own file, loaded through the `Scripts` section of that view so it runs after jQuery and Bootstrap.

```cshtml
@section Scripts {
    <script src="~/js/product-gallery.js" asp-append-version="true"></script>
}
```

## Quick recap

- Static files live in `wwwroot`, and only that folder is public. The folder name is dropped from URLs.
- Use `~/` paths in views so they work wherever the app is hosted.
- `MapStaticAssets` serves `wwwroot` with build time compression and fingerprinting. `UseStaticFiles` is the older option and can also expose extra folders.
- Add `asp-append-version="true"` to links, scripts and images so browsers fetch new versions after a change.
- LibMan downloads client libraries into `wwwroot/lib` and records them in `libman.json`.
- A `.cshtml.css` file next to a view scopes its styles to that view only.

<code id="code-content" class="language-csharp">
// Program.cs: serving wwwroot plus an extra uploads folder
using Microsoft.Extensions.FileProviders;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();
var app = builder.Build();
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}
app.UseHttpsRedirection();
// Files saved by users live outside the project, in an Uploads folder
// next to the app. Expose them at /uploads/...
string uploads = Path.Combine(builder.Environment.ContentRootPath, "Uploads");
Directory.CreateDirectory(uploads);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploads),
    RequestPath = "/uploads"
});
app.UseRouting();
app.UseAuthorization();
// wwwroot, compressed and fingerprinted at build time
//   wwwroot/css/site.css  -&gt;  /css/site.css
//   wwwroot/js/site.js    -&gt;  /js/site.js
app.MapStaticAssets();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();
app.Run();
// Views/Shared/_Layout.cshtml (the relevant lines)
//
//   &lt;link rel="stylesheet" href="~/lib/bootstrap/dist/css/bootstrap.min.css" /&gt;
//   &lt;link rel="stylesheet" href="~/css/site.css" asp-append-version="true" /&gt;
//   &lt;link rel="stylesheet" href="~/ShopApp.styles.css" asp-append-version="true" /&gt;
//   ...
//   &lt;script src="~/lib/jquery/dist/jquery.min.js"&gt;&lt;/script&gt;
//   &lt;script src="~/lib/bootstrap/dist/js/bootstrap.bundle.min.js"&gt;&lt;/script&gt;
//   &lt;script src="~/js/site.js" asp-append-version="true"&gt;&lt;/script&gt;
//   @await RenderSectionAsync("Scripts", required: false)
// Views/Products/Details.cshtml.css (CSS isolation: only applies to Details.cshtml)
//
//   .price { font-size: 1.5rem; color: #1a7f37; }
// Terminal: add a client library with LibMan
//
//   dotnet tool install --global Microsoft.Web.LibraryManager.Cli
//   libman install lodash@4.17.21 --provider cdnjs --destination wwwroot/lib/lodash
//   libman restore
</code></pre>
