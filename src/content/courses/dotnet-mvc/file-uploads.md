---
publishDate: 2026-08-14T10:30
title: File Uploads
slug: file-uploads
metadescription: Accept single and multiple file uploads with IFormFile, set the form encoding correctly, validate size and type, save files safely to disk with unique names, serve them back, and handle large uploads.
updateDate: 2026-09-14T10:30
author: ['bishal-biswas']
level: 2
tags: ['forms', 'file-upload', 'iformfile']
course: dotnet-mvc
---

## Files are just another form field

Uploading a file in MVC is the same GET and POST pattern as any other form, with two extra rules:

1. The form must have `enctype="multipart/form-data"`, or the browser sends only the file name.
2. The action receives the file as an `IFormFile`.

Once you know those two things, the rest is ordinary C#.

## The view model and form

```csharp
public class UploadAvatarViewModel
{
    [Required]
    public IFormFile? Avatar { get; set; }
}
```

```cshtml
@model UploadAvatarViewModel

<form asp-action="Upload" method="post" enctype="multipart/form-data">
    <div class="mb-3">
        <label asp-for="Avatar" class="form-label"></label>
        <input asp-for="Avatar" class="form-control" accept="image/*" />
        <span asp-validation-for="Avatar" class="text-danger"></span>
    </div>
    <button type="submit" class="btn btn-primary">Upload</button>
</form>
```

Because the property type is `IFormFile`, the input tag helper renders `type="file"`. The `accept` attribute is a hint for the file picker only. It is not security.

## Receiving the file

`IFormFile` gives you the name, size, content type and a stream:

```csharp
[HttpPost]
[ValidateAntiForgeryToken]
public async Task<IActionResult> Upload(UploadAvatarViewModel vm)
{
    if (!ModelState.IsValid || vm.Avatar is null)
    {
        return View(vm);
    }

    var file = vm.Avatar;

    // file.FileName      the original name from the browser
    // file.Length        size in bytes
    // file.ContentType   what the browser claims it is
    // file.OpenReadStream()   the bytes

    return RedirectToAction("Index");
}
```

You can also take `IFormFile avatar` directly as an action parameter with no view model. The parameter name must match the input name.

## Saving to disk

Never use the name the browser sent as the file name on disk. It can contain path characters, be enormous, or collide with another upload. Generate your own name and keep the extension:

```csharp
private readonly IWebHostEnvironment _env;

public async Task<IActionResult> Upload(UploadAvatarViewModel vm)
{
    var file = vm.Avatar!;
    var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
    var newName = $"{Guid.NewGuid()}{extension}";

    var folder = Path.Combine(_env.WebRootPath, "uploads");
    Directory.CreateDirectory(folder);

    var path = Path.Combine(folder, newName);
    await using (var stream = System.IO.File.Create(path))
    {
        await file.CopyToAsync(stream);
    }

    return RedirectToAction("Index");
}
```

`IWebHostEnvironment` comes from dependency injection and tells you where `wwwroot` is. Saving under `wwwroot/uploads` means the static file middleware can serve the file straight away at `/uploads/{newName}`.

If uploaded files should **not** be public, save them outside `wwwroot`, under `_env.ContentRootPath`, and serve them through an action that checks permissions.

## Validating size and type

Two checks belong in every upload action:

```csharp
private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };
private const long MaxBytes = 2 * 1024 * 1024; // 2 MB

if (file.Length == 0)
{
    ModelState.AddModelError(nameof(vm.Avatar), "Please choose a file.");
}
else if (file.Length > MaxBytes)
{
    ModelState.AddModelError(nameof(vm.Avatar), "The file must be 2 MB or smaller.");
}

var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
if (!AllowedExtensions.Contains(extension))
{
    ModelState.AddModelError(nameof(vm.Avatar), "Only JPG, PNG and WebP images are allowed.");
}

if (!ModelState.IsValid) return View(vm);
```

`file.ContentType` is set by the browser and can be faked, so do not rely on it alone. For images, the most reliable check is to try to open the stream with an image library and reject it if that fails.

## Multiple files

Bind to a list and let the input accept many:

```csharp
public List<IFormFile> Photos { get; set; } = new();
```

```cshtml
<input asp-for="Photos" class="form-control" multiple />
```

Then loop:

```csharp
foreach (var photo in vm.Photos)
{
    // validate and save each one
}
```

## Files alongside other fields

A file input can share a form with normal fields. The view model simply has both:

```csharp
public class CreateProductViewModel
{
    [Required] public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public IFormFile? Image { get; set; }
}
```

Save the file, then store its path on the entity:

```csharp
product.ImagePath = "/uploads/" + newName;
```

## Showing the uploaded file

For files under `wwwroot`, a plain image tag works:

```cshtml
<img src="@Model.ImagePath" alt="@Model.Name" />
```

For private files, return them from an action:

```csharp
[Authorize]
public IActionResult Download(int id)
{
    var doc = _docs.Find(id);
    if (doc is null) return NotFound();

    var path = Path.Combine(_env.ContentRootPath, "private-uploads", doc.StoredName);
    return PhysicalFile(path, doc.ContentType, doc.OriginalName);
}
```

`PhysicalFile` streams the file and the third argument sets the download name.

## Size limits

Kestrel and the form reader both have limits, and a big upload will fail with a 413 or 400 error before your action runs. Raise them where you need to:

```csharp
// Program.cs: allow bigger multipart bodies app wide
builder.Services.Configure<FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = 50 * 1024 * 1024; // 50 MB
});
```

```csharp
// Or per action
[RequestSizeLimit(50 * 1024 * 1024)]
[RequestFormLimits(MultipartBodyLengthLimit = 50 * 1024 * 1024)]
public async Task<IActionResult> Upload(...)
```

If you host behind IIS, its `maxAllowedContentLength` in `web.config` also applies.

For very large files, hundreds of megabytes and up, buffering the whole request in memory is a problem. The streaming approach, reading the multipart sections directly from the request, avoids it. That is an advanced technique documented in the ASP.NET Core docs and is rarely needed for typical web apps.

## Security checklist

- Generate your own file names. Never trust `FileName`.
- Check the extension against an allow list. Never use a block list.
- Limit the size.
- Store public files under `wwwroot` and private files outside it.
- Never execute or include an uploaded file.
- Consider scanning uploads with an antivirus tool in high risk apps.

## Quick recap

- Add `enctype="multipart/form-data"` to the form and bind to an `IFormFile` property or parameter.
- `IFormFile` gives you `FileName`, `Length`, `ContentType` and a stream to copy from.
- Save with a generated name under `wwwroot/uploads` for public files or outside `wwwroot` for private ones.
- Validate size and extension on the server, and do not trust the content type the browser sends.
- Use `List<IFormFile>` and the `multiple` attribute for several files.
- Raise `MultipartBodyLengthLimit` or add `[RequestSizeLimit]` when uploads are large.

<code id="code-content" class="language-csharp">
// ViewModels/CreateProductViewModel.cs
public class CreateProductViewModel
{
    [Required, StringLength(100)]
    public string Name { get; set; } = "";

    [Range(0.01, 10000)]
    public decimal Price { get; set; }

    [Display(Name = "Product image")]
    public IFormFile? Image { get; set; }

    [Display(Name = "Gallery photos")]
    public List&lt;IFormFile&gt; Gallery { get; set; } = new();
}

// Controllers/ProductsController.cs
public class ProductsController : Controller
{
    private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };
    private const long MaxBytes = 2 * 1024 * 1024;

    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;

    public ProductsController(AppDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    [HttpGet]
    public IActionResult Create() =&gt; View(new CreateProductViewModel());

    [HttpPost]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(20 * 1024 * 1024)]
    public async Task&lt;IActionResult&gt; Create(CreateProductViewModel vm)
    {
        if (vm.Image is not null &amp;&amp; !IsValidImage(vm.Image, nameof(vm.Image)))
        {
            // error already added
        }

        foreach (var photo in vm.Gallery)
        {
            IsValidImage(photo, nameof(vm.Gallery));
        }

        if (!ModelState.IsValid) return View(vm);

        var product = new Product { Name = vm.Name, Price = vm.Price };

        if (vm.Image is not null)
        {
            product.ImagePath = await SaveAsync(vm.Image);
        }

        foreach (var photo in vm.Gallery)
        {
            product.GalleryPaths.Add(await SaveAsync(photo));
        }

        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        return RedirectToAction("Index");
    }

    private bool IsValidImage(IFormFile file, string key)
    {
        if (file.Length == 0)
        {
            ModelState.AddModelError(key, "The file is empty.");
            return false;
        }
        if (file.Length &gt; MaxBytes)
        {
            ModelState.AddModelError(key, "Each file must be 2 MB or smaller.");
            return false;
        }
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
        {
            ModelState.AddModelError(key, "Only JPG, PNG and WebP files are allowed.");
            return false;
        }
        return true;
    }

    private async Task&lt;string&gt; SaveAsync(IFormFile file)
    {
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var name = $"{Guid.NewGuid()}{ext}";
        var folder = Path.Combine(_env.WebRootPath, "uploads");
        Directory.CreateDirectory(folder);

        await using var stream = System.IO.File.Create(Path.Combine(folder, name));
        await file.CopyToAsync(stream);

        return "/uploads/" + name;
    }
}

// Views/Products/Create.cshtml
//
//   @model CreateProductViewModel
//   &lt;form asp-action="Create" method="post" enctype="multipart/form-data"&gt;
//       &lt;input asp-for="Name" class="form-control" /&gt;
//       &lt;input asp-for="Price" class="form-control" /&gt;
//       &lt;input asp-for="Image" class="form-control" accept="image/*" /&gt;
//       &lt;span asp-validation-for="Image" class="text-danger"&gt;&lt;/span&gt;
//       &lt;input asp-for="Gallery" class="form-control" accept="image/*" multiple /&gt;
//       &lt;span asp-validation-for="Gallery" class="text-danger"&gt;&lt;/span&gt;
//       &lt;button type="submit" class="btn btn-primary"&gt;Save&lt;/button&gt;
//   &lt;/form&gt;
</code></pre>
