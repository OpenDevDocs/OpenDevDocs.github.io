---
publishDate: 2026-08-31T16:10
title: Migrating from ASP.NET MVC 5
slug: migrating-from-aspnet-mvc-5
metadescription: Move a classic ASP.NET MVC 5 application on .NET Framework to ASP.NET Core MVC, mapping Global.asax, web.config, HttpModules, bundling, HTML helpers, filters, Entity Framework 6 and Identity 2 to their modern equivalents, with an incremental strategy for large apps.
updateDate: 2026-09-14T16:10
author: ['bishal-biswas']
level: 4
tags: ['migration', 'mvc5', 'legacy']
course: dotnet-mvc
---

## Same pattern, different foundation

ASP.NET MVC 5 runs on the .NET Framework, Windows only, hosted in IIS through System.Web. ASP.NET Core MVC runs on modern .NET, on any platform, with its own pipeline. The controller, view and model pattern is the same, and most Razor views work with small changes. What changed is everything underneath: startup, configuration, hosting, dependency injection, and a number of libraries.

This topic maps the old to the new so you know what to expect, then suggests an order of work.

## Is it worth it

.NET Framework 4.8 is supported for as long as Windows is, so an MVC 5 app is not going to stop working. The reasons to move are performance, cross platform hosting including Linux and containers, modern C# and libraries, built in DI and configuration, and the fact that new features only arrive in ASP.NET Core.

The cost depends on how much the app leans on System.Web specifics. A clean MVC 5 app with thin controllers moves in days. An app full of `HttpContext.Current`, custom HttpModules, Web Forms pages and old third party libraries can take months.

## Project file and packages

MVC 5 uses an old style `.csproj` with hundreds of lines and `packages.config`. Create a new ASP.NET Core MVC project and move files into it rather than trying to convert in place. The new project file is a few lines and packages are `PackageReference` entries.

For each NuGet package, check whether a .NET version exists. Most popular libraries have one. Some are renamed, some are replaced by built in features, and a few are abandoned.

## Startup

| MVC 5 | ASP.NET Core |
| --- | --- |
| `Global.asax` `Application_Start` | `Program.cs` |
| `RouteConfig.RegisterRoutes` | `app.MapControllerRoute` |
| `FilterConfig.RegisterGlobalFilters` | `options.Filters.Add` in `AddControllersWithViews` |
| `BundleConfig` | See static files below |
| `web.config` app settings | `appsettings.json` and `IConfiguration` |
| `ConfigurationManager.AppSettings["Key"]` | `_config["Key"]` or `IOptions<T>` |
| `ConfigurationManager.ConnectionStrings` | `_config.GetConnectionString("Name")` |

Everything in `App_Start` becomes a few lines in `Program.cs`. `web.config` is only used for IIS hosting settings now, and the publish step generates it.

## HttpModules and HttpHandlers

These become middleware. An `HttpModule` that ran on `BeginRequest` becomes a class with `InvokeAsync` registered with `UseMiddleware`. An `HttpHandler` that served a custom URL becomes a middleware branch with `Map` or simply a controller action.

## Dependency injection

MVC 5 had no built in container. Apps used Unity, Ninject, Autofac or `new` everywhere. ASP.NET Core has DI built in. Register services in `Program.cs` and take them in constructors. If you used Autofac and want to keep it, it plugs into the new container, but most apps drop the extra library.

Static access to the request goes away. `HttpContext.Current` does not exist. In controllers use `HttpContext`. In services inject `IHttpContextAccessor`, or better, pass what the service needs as parameters.

## Controllers and actions

Most controller code moves unchanged. The differences:

| MVC 5 | ASP.NET Core |
| --- | --- |
| `System.Web.Mvc` | `Microsoft.AspNetCore.Mvc` |
| `ActionResult` | `IActionResult` (`ActionResult` still exists) |
| `HttpNotFound()` | `NotFound()` |
| `new HttpStatusCodeResult(403)` | `StatusCode(403)` or `Forbid()` |
| `JsonRequestBehavior.AllowGet` | Not needed, `Json()` works on GET |
| `Request.IsAjaxRequest()` | Check the `X-Requested-With` header yourself |
| `Server.MapPath("~/x")` | `IWebHostEnvironment.WebRootPath` or `ContentRootPath` |
| `Request.Url` | `Request.Path`, `Request.Query`, `Request.GetDisplayUrl()` |
| `HttpPostedFileBase` | `IFormFile` |
| `[OutputCache]` | `[ResponseCache]` or output caching middleware |
| `[HandleError]` | `UseExceptionHandler` middleware |

Async actions were optional in MVC 5 and are the norm now. Convert actions that hit the database to `async Task<IActionResult>` while you are touching them.

## Views

Razor is mostly the same. Things to change:

- `@Scripts.Render` and `@Styles.Render` bundling calls go away. See below.
- `Html.ActionLink` and `Html.BeginForm` still work, but tag helpers are cleaner. Convert gradually.
- `@Html.AntiForgeryToken()` still works. The form tag helper adds it automatically.
- `_ViewStart.cshtml` and `_Layout.cshtml` work the same.
- Add `_ViewImports.cshtml` with `@addTagHelper` and common `@using` lines.
- `@model` and `@using` declarations are identical.
- `Html.Partial` becomes `<partial>` or `Html.PartialAsync`. Synchronous partial rendering throws in some cases.
- `@helper` blocks are gone. Use a partial, a view component or a local function returning `IHtmlContent`.
- `Html.RenderAction` is gone. Use view components.

## Static files and bundling

MVC 5 served everything from the project root, and `System.Web.Optimization` bundled and minified scripts. ASP.NET Core serves only `wwwroot` by default and does no bundling at runtime. Move `Content` and `Scripts` into `wwwroot/css` and `wwwroot/js`. For bundling, either reference files directly with `asp-append-version`, or use a build tool such as Vite, esbuild or the WebOptimizer package. Many apps find they do not need bundling at all with HTTP/2.

Client libraries that came from NuGet, such as jQuery and Bootstrap, now come from LibMan, npm or a CDN.

## Filters

Filter attributes carry over with namespace changes. `ActionFilterAttribute` has the same methods. `AuthorizeAttribute` is now sealed; instead of subclassing it, write an authorization policy or a custom `IAuthorizationFilter`. Global filters register in `AddControllersWithViews`.

## Entity Framework

EF 6 and EF Core are different libraries with similar surfaces. Simple code moves easily: `DbContext`, `DbSet`, LINQ queries, `SaveChanges`. Differences to check:

- No lazy loading unless you opt in. Add `Include` where the old code relied on it.
- The `EDMX` designer is gone. Only code first.
- Some LINQ that EF 6 ran in memory now throws because EF Core insists on translating to SQL. Add `AsEnumerable()` where needed.
- Migrations have a new command line and the history table format differs. Create a fresh initial migration against the existing schema and mark it applied.

EF 6 itself also runs on modern .NET, so keeping it is an option for a first step. Migrate to EF Core when the rest is stable.

## Identity

ASP.NET Identity 2 and ASP.NET Core Identity have the same table layout by default, so existing users and hashed passwords can be kept. Set `PasswordHasherCompatibilityMode.IdentityV2` if hashes were created by the old system, and Identity will verify them and upgrade them on next login. Replace `Microsoft.AspNet.Identity.Owin` startup code with `AddIdentity` in `Program.cs`. Replace `OWIN` cookie middleware with the built in cookie authentication.

## Session and TempData

Both exist with the same names. Session must be explicitly enabled with `AddSession` and `UseSession`, stores only bytes and strings, and needs your own serialisation for objects. `TempData` works as before.

## Web API 2 controllers

If the app also had `ApiController` classes from Web API 2, they merge into the same project. ASP.NET Core has one controller type for both views and JSON. Inherit from `ControllerBase`, add `[ApiController]` and `[Route]`, and return `ActionResult<T>`.

## An incremental strategy

For a large app, do not stop feature work for a big bang rewrite. Two proven approaches:

**Strangler with YARP**: put the new ASP.NET Core app in front of the old one with the YARP reverse proxy. Routes that have been migrated are handled by the new app; everything else is forwarded to the old one. Move one area at a time. Microsoft provides `Microsoft.AspNetCore.SystemWebAdapters` to share session and authentication between the two during the transition.

**Library first**: move business logic and data access into .NET Standard or multi targeted class libraries that both apps can use. Once the web layer is thin, replace it.

Either way, get the tests running first. Integration tests through `WebApplicationFactory` on the new app catch regressions as each area moves.

## Tools that help

- The **.NET Upgrade Assistant** converts the project file and flags known incompatible APIs.
- `dotnet list package --outdated` and the NuGet gallery show which packages have modern versions.
- The **API analyzer** highlights System.Web calls in shared code.

## Quick recap

- The MVC pattern is the same, but startup, configuration, hosting, DI and static file handling all changed.
- `Global.asax` and `App_Start` become `Program.cs`, `web.config` becomes `appsettings.json`, HttpModules become middleware.
- Controllers move with namespace and result type changes, and views need tag helpers, `_ViewImports` and a `wwwroot` folder.
- EF 6 can be kept at first, and Identity 2 databases work with the compatibility hasher mode.
- Migrate large apps incrementally with YARP and the System.Web adapters, one area at a time, with tests in place.

<code id="code-content" class="language-csharp">
// BEFORE: MVC 5 Global.asax.cs and App_Start
//
//   protected void Application_Start()
//   {
//       AreaRegistration.RegisterAllAreas();
//       FilterConfig.RegisterGlobalFilters(GlobalFilters.Filters);
//       RouteConfig.RegisterRoutes(RouteTable.Routes);
//       BundleConfig.RegisterBundles(BundleTable.Bundles);
//       var container = new UnityContainer();
//       container.RegisterType&lt;IProductService, ProductService&gt;();
//       DependencyResolver.SetResolver(new UnityDependencyResolver(container));
//   }
//   // web.config: &lt;add key="PageSize" value="20" /&gt; and &lt;connectionStrings&gt;

// AFTER: Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews(options =&gt;
{
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());   // was FilterConfig
});
builder.Services.AddScoped&lt;IProductService, ProductService&gt;();           // was Unity
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt;
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default"))); // was web.config
builder.Services.Configure&lt;ShopSettings&gt;(builder.Configuration.GetSection("Shop"));

builder.Services.AddIdentity&lt;ApplicationUser, IdentityRole&gt;()
    .AddEntityFrameworkStores&lt;AppDbContext&gt;();
builder.Services.Configure&lt;PasswordHasherOptions&gt;(o =&gt;
    o.CompatibilityMode = PasswordHasherCompatibilityMode.IdentityV2);  // verify old Identity 2 hashes

var app = builder.Build();
app.UseExceptionHandler("/Home/Error");                                  // was [HandleError]
app.UseStaticFiles();                                                    // was System.Web serving everything
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllerRoute("areas", "{area:exists}/{controller=Home}/{action=Index}/{id?}");
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");  // was RouteConfig
app.Run();

// BEFORE: an MVC 5 controller
//
//   using System.Web.Mvc;
//   public class ProductsController : Controller
//   {
//       public ActionResult Details(int id)
//       {
//           var product = db.Products.Find(id);
//           if (product == null) return HttpNotFound();
//           ViewBag.PageSize = ConfigurationManager.AppSettings["PageSize"];
//           return View(product);
//       }
//       [HttpPost]
//       public ActionResult Upload(HttpPostedFileBase file)
//       {
//           var path = Server.MapPath("~/Uploads/" + file.FileName);
//           file.SaveAs(path);
//           return Json(new { ok = true }, JsonRequestBehavior.AllowGet);
//       }
//   }

// AFTER: the same controller on ASP.NET Core
using Microsoft.AspNetCore.Mvc;

public class ProductsController : Controller
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly ShopSettings _settings;

    public ProductsController(AppDbContext db, IWebHostEnvironment env, IOptions&lt;ShopSettings&gt; settings)
    {
        _db = db;
        _env = env;
        _settings = settings.Value;
    }

    public async Task&lt;IActionResult&gt; Details(int id)
    {
        var product = await _db.Products.Include(p =&gt; p.Category).FirstOrDefaultAsync(p =&gt; p.Id == id);
        if (product is null) return NotFound();                         // was HttpNotFound()
        ViewBag.PageSize = _settings.PageSize;                          // was ConfigurationManager
        return View(product);
    }

    [HttpPost]
    public async Task&lt;IActionResult&gt; Upload(IFormFile file)             // was HttpPostedFileBase
    {
        var name = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        var path = Path.Combine(_env.WebRootPath, "uploads", name);     // was Server.MapPath
        await using var stream = System.IO.File.Create(path);
        await file.CopyToAsync(stream);
        return Json(new { ok = true });                                 // no AllowGet needed
    }
}

// Views: what changes
//
//   BEFORE  @Scripts.Render("~/bundles/jquery")
//   AFTER   &lt;script src="~/js/site.js" asp-append-version="true"&gt;&lt;/script&gt;
//
//   BEFORE  @Html.ActionLink("Edit", "Edit", new { id = item.Id })
//   AFTER   &lt;a asp-action="Edit" asp-route-id="@item.Id"&gt;Edit&lt;/a&gt;
//
//   BEFORE  @{ Html.RenderAction("CartSummary", "Cart"); }
//   AFTER   &lt;vc:cart-summary&gt;&lt;/vc:cart-summary&gt;
//
//   BEFORE  @Html.Partial("_ProductCard", item)
//   AFTER   &lt;partial name="_ProductCard" model="item" /&gt;
//
//   NEW     Views/_ViewImports.cshtml with @addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers
</code></pre>
