---
publishDate: 2026-09-27T18:10
title: File Uploads and Downloads
slug: file-uploads-and-downloads
metadescription: Accept file uploads safely with IFormFile, validate size and content type, stream large files without exhausting memory, and serve downloads with the right headers.
updateDate: 2026-09-07T18:10
author: ['bishal-biswas']
level: 2
tags: ['file-upload', 'streaming', 'security']
course: dotnet-webapi
---

## Accepting a file

A file arrives as `multipart/form-data`. ASP.NET Core binds it to `IFormFile`:

```csharp
[HttpPost("upload")]
public async Task<IActionResult> Upload(IFormFile file, CancellationToken ct)
{
    if (file.Length == 0)
        return BadRequest(new { error = "The file is empty." });

    string path = Path.Combine("uploads", Guid.NewGuid().ToString("N"));

    await using FileStream stream = System.IO.File.Create(path);
    await file.CopyToAsync(stream, ct);

    return Ok(new { file.FileName, file.Length });
}
```

The parameter name must match the form field name, or use `[FromForm(Name = "...")]`.

Files and other fields together:

```csharp
public class UploadRequest
{
    public IFormFile File { get; set; } = null!;
    public string Title { get; set; } = "";
    public string? Description { get; set; }
}

[HttpPost("upload")]
public async Task<IActionResult> Upload([FromForm] UploadRequest request, CancellationToken ct)
```

Note `[FromForm]`, not `[FromBody]`. A multipart request is not JSON.

Several files:

```csharp
public async Task<IActionResult> UploadMany(List<IFormFile> files, CancellationToken ct)
```

## Validate before you trust anything

An upload endpoint is one of the most attacked parts of an API. Four checks, and all four matter.

**Size.** Reject early, before reading the stream:

```csharp
const long MaxBytes = 5 * 1024 * 1024;      // 5 MB

if (file.Length > MaxBytes)
    return BadRequest(new { error = "The file must be 5 MB or smaller." });
```

Also cap it at the server, or a huge upload is buffered before your code ever runs:

```csharp
builder.Services.Configure<KestrelServerOptions>(options =>
{
    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024;
});
```

```csharp
[HttpPost("upload")]
[RequestSizeLimit(5 * 1024 * 1024)]
public async Task<IActionResult> Upload(IFormFile file) { }
```

**Extension.** Allow list, never deny list:

```csharp
private static readonly HashSet<string> Allowed =
    new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".pdf" };

string extension = Path.GetExtension(file.FileName);

if (!Allowed.Contains(extension))
    return BadRequest(new { error = "Only JPG, PNG and PDF files are allowed." });
```

A deny list is always incomplete. There is always another dangerous extension you did not think of.

**Content type.** Check it, and do not trust it. The client sets this header and can write anything:

```csharp
private static readonly HashSet<string> AllowedTypes =
    new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png", "application/pdf" };

if (!AllowedTypes.Contains(file.ContentType))
    return BadRequest(new { error = "Unsupported content type." });
```

**The actual bytes.** The only check a client cannot fake. Read the file signature, the magic number at the start:

```csharp
private static readonly Dictionary<string, byte[][]> Signatures = new()
{
    [".jpg"] = new[] { new byte[] { 0xFF, 0xD8, 0xFF } },
    [".png"] = new[] { new byte[] { 0x89, 0x50, 0x4E, 0x47 } },
    [".pdf"] = new[] { new byte[] { 0x25, 0x50, 0x44, 0x46 } }
};

await using Stream stream = file.OpenReadStream();
using var reader = new BinaryReader(stream);

byte[] header = reader.ReadBytes(8);

bool matches = Signatures[extension].Any(sig =>
    header.Take(sig.Length).SequenceEqual(sig));

if (!matches)
    return BadRequest(new { error = "The file content does not match its extension." });
```

An attacker renaming `shell.php` to `photo.jpg` gets past the first three checks and fails this one.

## Never use the client's filename

The most important rule here.

```csharp
// Dangerous: "../../appsettings.json" escapes your uploads folder
string path = Path.Combine("uploads", file.FileName);

// Safe: you choose the name
string safeName = $"{Guid.NewGuid():N}{Path.GetExtension(file.FileName)}";
string path = Path.Combine(uploadRoot, safeName);
```

This is **path traversal**, and it is how uploads become remote code execution. Generate your own name, keep the original in the database for display only, and sanitise it before showing it:

```csharp
string display = Path.GetFileName(file.FileName);      // strips any directory part
```

Two more rules that follow.

**Store files outside the web root.** A file in `wwwroot` is directly reachable by URL and might be executed by the server. Keep uploads in a separate folder or in blob storage, and serve them through a controller action that checks authorization.

**Never serve an upload with its original content type.** Force a safe one, or a crafted SVG or HTML file becomes stored XSS.

## Large files: stream, do not buffer

`IFormFile` buffers the whole file. Anything above about 64 KB goes to a temporary file on disk, but a 2 GB upload still costs 2 GB of disk and a full copy before your code runs.

For large files, disable the form binding and read the multipart stream directly:

```csharp
[HttpPost("upload-large")]
[DisableFormValueModelBinding]
[RequestSizeLimit(1_073_741_824)]              // 1 GB
public async Task<IActionResult> UploadLarge(CancellationToken ct)
{
    if (!MultipartRequestHelper.IsMultipartContentType(Request.ContentType))
        return BadRequest("Expected a multipart request.");

    string boundary = MultipartRequestHelper.GetBoundary(
        MediaTypeHeaderValue.Parse(Request.ContentType), lengthLimit: 128);

    var reader = new MultipartReader(boundary, Request.Body);
    MultipartSection? section = await reader.ReadNextSectionAsync(ct);

    while (section is not null)
    {
        if (ContentDispositionHeaderValue.TryParse(
                section.ContentDisposition, out var disposition)
            && disposition.FileName.HasValue)
        {
            string path = Path.Combine(uploadRoot, $"{Guid.NewGuid():N}.dat");

            await using FileStream target = System.IO.File.Create(path);
            await section.Body.CopyToAsync(target, ct);      // streamed, never fully in memory
        }

        section = await reader.ReadNextSectionAsync(ct);
    }

    return Ok();
}
```

Memory stays flat regardless of file size. This is more code, so only reach for it when files are genuinely large.

For very large uploads, consider skipping your API entirely and using a **pre signed URL** so the client uploads straight to blob storage. Your API only issues the URL and records the result.

## Downloads

```csharp
[HttpGet("{id:int}/download")]
public async Task<IActionResult> Download(int id, CancellationToken ct)
{
    Document? document = await db.Documents.FindAsync(new object[] { id }, ct);
    if (document is null) return NotFound();

    // Authorization: never serve a file just because someone knows the id
    if (document.OwnerId != User.FindFirst("sub")?.Value)
        return NotFound();

    string path = Path.Combine(uploadRoot, document.StoredName);
    if (!System.IO.File.Exists(path)) return NotFound();

    Stream stream = System.IO.File.OpenRead(path);

    return File(stream, "application/octet-stream", document.OriginalName);
}
```

`File` with a `Stream` streams the response rather than loading it all into memory. Do not read the bytes yourself unless the file is small.

`enableRangeProcessing` allows resumable downloads and video seeking:

```csharp
return File(stream, "video/mp4", enableRangeProcessing: true);
```

Note `application/octet-stream` above. Serving an uploaded file with its stored content type lets a malicious HTML or SVG file execute in your domain. Force a download instead:

```csharp
Response.Headers["Content-Disposition"] = $"attachment; filename=\"{safeName}\"";
Response.Headers["X-Content-Type-Options"] = "nosniff";
```

`nosniff` stops the browser guessing the type and executing it anyway.

## Generating a file

You do not need a file on disk:

```csharp
[HttpGet("export")]
public async Task<IActionResult> Export(CancellationToken ct)
{
    var csv = new StringBuilder("Id,Title,Price\n");

    foreach (var book in await db.Books.ToListAsync(ct))
        csv.AppendLine($"{book.Id},\"{book.Title.Replace("\"", "\"\"")}\",{book.Price}");

    byte[] bytes = Encoding.UTF8.GetBytes(csv.ToString());

    return File(bytes, "text/csv", $"books-{DateTime.UtcNow:yyyy-MM-dd}.csv");
}
```

For a large export, write straight to the response body so nothing is buffered:

```csharp
[HttpGet("export-large")]
public async Task ExportLarge(CancellationToken ct)
{
    Response.ContentType = "text/csv";
    Response.Headers["Content-Disposition"] = "attachment; filename=\"books.csv\"";

    await using var writer = new StreamWriter(Response.Body);
    await writer.WriteLineAsync("Id,Title,Price");

    await foreach (Book book in db.Books.AsAsyncEnumerable().WithCancellation(ct))
        await writer.WriteLineAsync($"{book.Id},{book.Title},{book.Price}");
}
```

The client starts receiving rows immediately and memory stays flat.

## Where to store files

**The local file system** is simplest and does not survive a container restart or work across instances. Fine for a single server.

**Blob storage**, such as Azure Blob Storage or AWS S3, is the usual production answer. Durable, cheap, scales, and supports pre signed URLs so downloads bypass your API entirely.

**The database** as a `varbinary` column keeps everything transactional and consistent. It also bloats backups and makes queries slower. Acceptable for small files where consistency matters, poor for anything large.

## Quick recap

- `IFormFile` binds a `multipart/form-data` upload. Use `[FromForm]`, never `[FromBody]`.
- Validate size, extension against an allow list, content type, and the file signature.
- The content type header is client controlled. Only the magic number cannot be faked.
- Never build a path from the client's filename. Generate your own name.
- Store uploads outside the web root and serve them through an authorized action.
- `IFormFile` buffers. Use `MultipartReader` for large files so memory stays flat.
- For very large uploads, issue a pre signed URL and let the client upload directly to storage.
- `File(stream, ...)` streams the download. Add `enableRangeProcessing` for resume and seeking.
- Serve uploads as `application/octet-stream` with `nosniff`, or a crafted file becomes stored XSS.
- Write directly to `Response.Body` for large generated exports.

<code id="code-content" class="language-csharp">
// Uploads validated properly, plus streamed uploads and downloads.
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt; o.UseInMemoryDatabase("docs"));
// A hard cap at the server, so an oversized upload is rejected before your code runs
builder.Services.Configure&lt;KestrelServerOptions&gt;(o =&gt; o.Limits.MaxRequestBodySize = 10 * 1024 * 1024);
var app = builder.Build();
app.MapControllers();
app.Run();
[ApiController]
[Route("api/[controller]")]
public class DocumentsController : ControllerBase
{
    private const long MaxBytes = 5 * 1024 * 1024;
    // Allow list, never a deny list. A deny list is always missing something.
    private static readonly HashSet&lt;string&gt; AllowedExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".pdf" };
    private static readonly HashSet&lt;string&gt; AllowedContentTypes =
        new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png", "application/pdf" };
    // Magic numbers: the ONLY check a client cannot fake by renaming a file
    private static readonly Dictionary&lt;string, byte[][]&gt; Signatures =
        new(StringComparer.OrdinalIgnoreCase)
        {
            [".jpg"]  = new[] { new byte[] { 0xFF, 0xD8, 0xFF } },
            [".jpeg"] = new[] { new byte[] { 0xFF, 0xD8, 0xFF } },
            [".png"]  = new[] { new byte[] { 0x89, 0x50, 0x4E, 0x47 } },
            [".pdf"]  = new[] { new byte[] { 0x25, 0x50, 0x44, 0x46 } }
        };
    // OUTSIDE wwwroot. A file in the web root is reachable by URL and may be executed.
    private static readonly string UploadRoot =
        Path.Combine(Directory.GetCurrentDirectory(), "storage", "uploads");
    private readonly AppDbContext db;
    public DocumentsController(AppDbContext db) =&gt; this.db = db;
    [HttpPost("upload")]
    [RequestSizeLimit(MaxBytes)]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task&lt;IActionResult&gt; Upload([FromForm] UploadRequest request, CancellationToken ct)
    {
        IFormFile file = request.File;
        if (file.Length == 0)        return BadRequest(new { error = "The file is empty." });
        if (file.Length &gt; MaxBytes)  return BadRequest(new { error = "The file must be 5 MB or smaller." });
        string extension = Path.GetExtension(file.FileName);
        if (!AllowedExtensions.Contains(extension))
            return BadRequest(new { error = "Only JPG, PNG and PDF files are allowed." });
        // The client sets this header and can write anything. Check it, but do not rely on it.
        if (!AllowedContentTypes.Contains(file.ContentType))
            return BadRequest(new { error = "Unsupported content type." });
        // The real check: shell.php renamed to photo.jpg passes everything above and fails here
        await using (Stream probe = file.OpenReadStream())
        {
            byte[] header = new byte[8];
            int read = await probe.ReadAsync(header, ct);
            bool matches = Signatures[extension]
                .Any(sig =&gt; read &gt;= sig.Length &amp;&amp; header.Take(sig.Length).SequenceEqual(sig));
            if (!matches)
                return BadRequest(new { error = "The file content does not match its extension." });
        }
        Directory.CreateDirectory(UploadRoot);
        // NEVER Path.Combine(root, file.FileName). A name of "../../appsettings.json"
        // escapes the folder. This is path traversal, and it is how uploads become
        // remote code execution. We choose the name.
        string storedName = $"{Guid.NewGuid():N}{extension}";
        string fullPath   = Path.Combine(UploadRoot, storedName);
        await using (FileStream target = System.IO.File.Create(fullPath))
            await file.CopyToAsync(target, ct);
        var document = new Document
        {
            StoredName   = storedName,
            OriginalName = Path.GetFileName(file.FileName),   // strips any directory part
            SizeBytes    = file.Length,
            OwnerId      = User.FindFirst("sub")?.Value ?? "",
            UploadedAt   = DateTime.UtcNow
        };
        db.Documents.Add(document);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Download), new { id = document.Id },
            new { document.Id, document.OriginalName, document.SizeBytes });
    }
    [HttpGet("{id:int}/download")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task&lt;IActionResult&gt; Download(int id, CancellationToken ct)
    {
        Document? document = await db.Documents.FindAsync(new object[] { id }, ct);
        if (document is null) return NotFound();
        // Never serve a file just because the caller knows the id.
        // 404 rather than 403: do not confirm that the document exists.
        if (document.OwnerId != User.FindFirst("sub")?.Value) return NotFound();
        string path = Path.Combine(UploadRoot, document.StoredName);
        if (!System.IO.File.Exists(path)) return NotFound();
        // nosniff stops the browser guessing the type and executing a crafted
        // HTML or SVG file in your domain.
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Stream stream = System.IO.File.OpenRead(path);      // streamed, not read into memory
        return File(stream, "application/octet-stream", document.OriginalName,
                    enableRangeProcessing: true);           // resumable downloads and seeking
    }
    // A generated file, streamed straight to the response so nothing is buffered.
    // The client starts receiving rows immediately.
    [HttpGet("export")]
    public async Task Export(CancellationToken ct)
    {
        Response.ContentType = "text/csv; charset=utf-8";
        Response.Headers["Content-Disposition"] =
            $"attachment; filename=\"documents-{DateTime.UtcNow:yyyy-MM-dd}.csv\"";
        await using var writer = new StreamWriter(Response.Body, Encoding.UTF8);
        await writer.WriteLineAsync("Id,Name,SizeBytes,UploadedAt");
        await foreach (Document d in db.Documents.AsNoTracking().AsAsyncEnumerable().WithCancellation(ct))
            await writer.WriteLineAsync(
                $"{d.Id},\"{d.OriginalName.Replace("\"", "\"\"")}\",{d.SizeBytes},{d.UploadedAt:O}");
    }
}
public class UploadRequest
{
    public IFormFile File { get; set; } = null!;      // [FromForm], never [FromBody]
    [System.ComponentModel.DataAnnotations.StringLength(200)]
    public string Title { get; set; } = "";
    public string? Description { get; set; }
}
public class Document
{
    public int Id { get; set; }
    public string StoredName { get; set; } = "";      // the name WE generated
    public string OriginalName { get; set; } = "";    // the client's name, for display only
    public long SizeBytes { get; set; }
    public string OwnerId { get; set; } = "";
    public DateTime UploadedAt { get; set; }
}
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;Document&gt; Documents =&gt; Set&lt;Document&gt;();
}
</code></pre>
