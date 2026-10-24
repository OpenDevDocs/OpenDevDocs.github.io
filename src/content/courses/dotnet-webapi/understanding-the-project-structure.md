---
publishDate: 2026-09-02T09:30
title: Understanding the Project Structure
slug: understanding-the-project-structure
metadescription: Walk through every file a new Web API project gives you, what the csproj does, where build output goes, and how to organise folders as the project grows.
updateDate: 2026-09-07T09:30
author: ['bishal-biswas']
level: 1
tags: ['project-structure', 'csproj', 'configuration']
course: dotnet-webapi
---

## What the template gives you

A fresh Web API project is small. Here is everything in it:

```text
BookStore.Api/
├── Properties/
│   └── launchSettings.json
├── obj/
├── bin/
├── appsettings.json
├── appsettings.Development.json
├── BookStore.Api.csproj
├── BookStore.Api.http
└── Program.cs
```

Only four of these matter to you right now. Let us go through them.

## Program.cs

This is the entry point. It builds the app, configures it and starts it.

In older .NET versions there were two files, `Program.cs` and `Startup.cs`, and a `Main` method with a class around it. Modern .NET uses **top level statements**, so all of that boilerplate is gone. What you see is what runs.

```csharp
var builder = WebApplication.CreateBuilder(args);
// register services here
var app = builder.Build();
// configure the pipeline here
app.Run();
```

Two rules to remember:

- **Order matters** in the pipeline section. Middleware runs top to bottom.
- Any `class` or `record` you declare must appear **after** all the statements.

## The .csproj file

This is the project file. It is XML and it is short:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.6.2" />
  </ItemGroup>

</Project>
```

`Sdk="Microsoft.NET.Sdk.Web"` tells the build system this is a web project, so it knows to copy `appsettings.json` to the output and to include the web libraries.

`TargetFramework` is the .NET version you are building for.

`Nullable` turns on nullable reference types. The compiler then warns you when a `string` might be null. Leave it on. It catches real bugs.

`ImplicitUsings` automatically adds common `using` lines such as `System`, `System.Linq` and `Microsoft.AspNetCore.Builder`. This is why `Program.cs` has almost no `using` statements at the top.

`PackageReference` is a NuGet dependency. You rarely edit these by hand. Use `dotnet add package` and the line appears for you.

One thing you should know: **every `.cs` file in the folder is compiled automatically**. There is no list of files to maintain. Create a file, and it is part of the project.

## appsettings.json

Your configuration lives here. Connection strings, API keys, feature flags, log levels.

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

`appsettings.Development.json` sits next to it and **overrides** values when you are running locally. The framework loads the base file first, then the environment specific one on top.

That layering is the key idea. You put safe defaults in `appsettings.json` and machine specific values in the Development file. Never put real passwords in either. There is a whole topic on that later.

## Properties/launchSettings.json

This file only affects your machine. It is not deployed.

```json
{
  "profiles": {
    "http": {
      "commandName": "Project",
      "applicationUrl": "http://localhost:5139",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    },
    "https": {
      "commandName": "Project",
      "launchBrowser": true,
      "launchUrl": "swagger",
      "applicationUrl": "https://localhost:7139;http://localhost:5139",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}
```

A **profile** is a named way to start the app. Pick one from the terminal:

```bash
dotnet run --launch-profile https
```

`ASPNETCORE_ENVIRONMENT` is what makes `app.Environment.IsDevelopment()` return true. Change it to `Production` here and Swagger disappears, because the template only enables Swagger in development.

## The .http file

A small file for testing requests without leaving your editor:

```http
@BookStore_HostAddress = http://localhost:5139

GET {{BookStore_HostAddress}}/api/books
Accept: application/json

###

POST {{BookStore_HostAddress}}/api/books
Content-Type: application/json

{ "title": "Domain Driven Design", "year": 2003 }
```

Visual Studio and VS Code with the REST Client extension put a **Send Request** link above each block. It is lighter than Postman for quick checks.

## bin and obj

`obj/` holds intermediate build files. `bin/` holds the final compiled output, including your `.dll` and the copied `appsettings.json`.

You never edit these and you never commit them. A .NET `.gitignore` excludes both:

```bash
dotnet new gitignore
```

If a build starts behaving strangely, deleting these folders often fixes it:

```bash
dotnet clean
```

## Growing beyond one file

`Program.cs` is fine for a demo. A real API needs folders. Here is a structure that works well and is easy to explain to a teammate:

```text
BookStore.Api/
├── Controllers/          endpoints, one file per resource
│   └── BooksController.cs
├── Models/               your database entities
│   └── Book.cs
├── DTOs/                 the shapes you send and receive
│   ├── BookResponse.cs
│   └── CreateBookRequest.cs
├── Data/                 DbContext and configuration
│   └── AppDbContext.cs
├── Services/             business logic
│   ├── IBookService.cs
│   └── BookService.cs
├── Middleware/           custom pipeline steps
├── Extensions/           small helpers to keep Program.cs short
├── appsettings.json
└── Program.cs
```

Folders in .NET do **not** have to match namespaces, but the tooling generates namespaces that match, and following it makes files easy to find. A file in `Controllers/` gets `namespace BookStore.Api.Controllers`.

Start flat. Add a folder when you have a second file that belongs in it. Do not build all of this on day one.

## When to split into multiple projects

Once the API grows, teams often split it:

- `Shop.Api` for controllers and the HTTP layer
- `Shop.Core` for models, interfaces and business rules
- `Shop.Infrastructure` for the database and outside services
- `Shop.Tests` for tests

The rule that makes this worth doing: **`Shop.Core` references nothing**. Everything points inward at it. That keeps your business rules free of any framework detail.

You do not need this for a small API. Know it exists so you recognise it when you see it.

## Quick recap

- `Program.cs` is the whole startup. Register services, build, configure the pipeline, run.
- The `.csproj` compiles every `.cs` file automatically. You never list files.
- `Nullable` and `ImplicitUsings` are on by default. Keep them.
- `appsettings.json` holds configuration, and `appsettings.Development.json` layers on top of it locally.
- `launchSettings.json` is local only and controls ports and `ASPNETCORE_ENVIRONMENT`.
- `bin` and `obj` are build output. Ignore them in git and delete them when a build misbehaves.
- Grow into folders such as Controllers, Models, DTOs, Data and Services only when you need them.

<code id="code-content" class="language-csharp">
// Program.cs - the same startup, split into readable steps with extension methods.
// This is the pattern teams use to stop Program.cs turning into 300 lines.
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddApiServices();          // our own extension, defined below
var app = builder.Build();
app.ConfigurePipeline();                    // our own extension, defined below
app.Run();
// Extensions/ServiceCollectionExtensions.cs
static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApiServices(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();
        services.AddSingleton&lt;IBookService, InMemoryBookService&gt;();
        return services;                    // returning the collection allows chaining
    }
}
// Extensions/WebApplicationExtensions.cs
static class WebApplicationExtensions
{
    public static WebApplication ConfigurePipeline(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())     // reads ASPNETCORE_ENVIRONMENT
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }
        app.UseHttpsRedirection();
        app.MapBookEndpoints();
        return app;
    }
    public static WebApplication MapBookEndpoints(this WebApplication app)
    {
        app.MapGet("/api/books", (IBookService service) =&gt; service.GetAll());
        app.MapGet("/api/books/{id}", (int id, IBookService service) =&gt;
            service.GetById(id) is Book b ? Results.Ok(b) : Results.NotFound());
        return app;
    }
}
// Models/Book.cs
record Book(int Id, string Title, int Year);
// Services/IBookService.cs
interface IBookService
{
    IReadOnlyList&lt;Book&gt; GetAll();
    Book? GetById(int id);
}
// Services/InMemoryBookService.cs
class InMemoryBookService : IBookService
{
    private readonly List&lt;Book&gt; books = new()
    {
        new Book(1, "The Pragmatic Programmer", 1999),
        new Book(2, "Clean Code", 2008)
    };
    public IReadOnlyList&lt;Book&gt; GetAll() =&gt; books;
    public Book? GetById(int id) =&gt; books.FirstOrDefault(b =&gt; b.Id == id);
}
</code></pre>
