---
publishDate: 2026-09-01T09:20
title: Your First Web API Project
slug: your-first-web-api-project
metadescription: Create a Web API project with the dotnet CLI, run it, read the sample weather endpoint, try it in Swagger, and then write your own first endpoint.
updateDate: 2026-09-07T09:20
author: ['bishal-biswas']
level: 1
tags: ['getting-started', 'dotnet-cli', 'swagger']
course: dotnet-webapi
---

## Creating the project

Open a terminal in the folder where you keep your code and run:

```bash
dotnet new webapi -n BookStore.Api
cd BookStore.Api
```

`dotnet new webapi` uses the built in Web API template. `-n` sets the project name, which also becomes the folder name and the default C# namespace.

By default this template creates a **minimal API**, where endpoints live directly in `Program.cs`. If you would rather start with controllers, add a flag:

```bash
dotnet new webapi -n BookStore.Api --use-controllers
```

Both styles are covered in this course. Start with the default so there is less to read.

## Running it

```bash
dotnet run
```

You will see output like this:

```text
Building...
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: https://localhost:7139
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5139
info: Microsoft.Hosting.Lifetime[0]
      Hosting environment: Development
```

Your API is live. The port numbers are random per project, so yours will differ. Copy the `https` address and open it in a browser with `/swagger` on the end:

```text
https://localhost:7139/swagger
```

You get an interactive page listing every endpoint. Click one, click **Try it out**, then **Execute**. Swagger sends a real request and shows you the real response. This is the fastest way to test an API while you build it.

Stop the server with `Ctrl+C`.

## Use watch mode instead

From now on, run this instead:

```bash
dotnet watch run
```

Now the API rebuilds and restarts every time you save a file. You will save a lot of time.

## Reading Program.cs

Open `Program.cs`. The template gives you something close to this:

```csharp
var builder = WebApplication.CreateBuilder(args);

// 1. Register services
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// 2. Configure the pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// 3. Map endpoints
app.MapGet("/weatherforecast", () => { /* ... */ })
   .WithName("GetWeatherForecast");

app.Run();
```

Every ASP.NET Core app has these same four beats. Learn them now and every project will look familiar.

**`WebApplication.CreateBuilder(args)`** creates a builder. It reads configuration from `appsettings.json`, environment variables and the command line, and sets up logging.

**`builder.Services`** is where you **register services**. This is the dependency injection container. Anything your code will later ask for gets added here.

**`builder.Build()`** locks the services in and produces the `app`.

**`app.Use...` and `app.Map...`** build the **request pipeline**. Every incoming request runs through these in order.

**`app.Run()`** starts the server and blocks until you stop it.

## The sample endpoint, line by line

The template ships a weather forecast endpoint. Here it is with comments:

```csharp
var summaries = new[] { "Freezing", "Bracing", "Chilly", "Mild", "Warm" };

app.MapGet("/weatherforecast", () =>
{
    var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast")
.WithOpenApi();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary);
```

`MapGet` says "when a GET request arrives at this path, run this function". The function returns an array of `WeatherForecast`. ASP.NET Core turns that into JSON automatically. You never write serialization code.

`.WithName(...)` and `.WithOpenApi()` are metadata used by Swagger to describe the endpoint.

## Writing your own endpoint

Delete the weather forecast code and write something of your own. Add this above `app.Run()`:

```csharp
var books = new List<Book>
{
    new Book(1, "The Pragmatic Programmer", 1999),
    new Book(2, "Clean Code", 2008)
};

app.MapGet("/api/books", () => books);

app.MapGet("/api/books/{id}", (int id) =>
{
    var book = books.FirstOrDefault(b => b.Id == id);
    return book is null ? Results.NotFound() : Results.Ok(book);
});

record Book(int Id, string Title, int Year);
```

Save. Watch mode restarts. Open `/api/books` in your browser and you get JSON:

```json
[
  { "id": 1, "title": "The Pragmatic Programmer", "year": 1999 },
  { "id": 2, "title": "Clean Code", "year": 2008 }
]
```

Two things to notice.

First, the property names came back as `id`, `title` and `year` in lowercase. ASP.NET Core uses **camelCase** for JSON by default, because that is the convention in JavaScript.

Second, `{id}` in the route became the `int id` parameter. That is **model binding**, and it is one of the biggest conveniences the framework gives you.

## Records must go at the bottom

C# top level statements have one rule that trips up beginners: any type you declare must come **after** all the executable statements. If you put `record Book(...)` above `app.MapGet(...)` you get a compiler error. Keep your types at the bottom of the file, or move them into their own file, which is what you will do as the project grows.

## Where the port numbers come from

Open `Properties/launchSettings.json`:

```json
{
  "profiles": {
    "https": {
      "commandName": "Project",
      "launchBrowser": true,
      "applicationUrl": "https://localhost:7139;http://localhost:5139",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}
```

This file is for local development only. It is not used when you deploy. Change `applicationUrl` if you want fixed ports.

## Quick recap

- `dotnet new webapi -n Name` creates a project. Add `--use-controllers` for the controller style.
- `dotnet watch run` is the command you want while developing, because it restarts on save.
- Visit `/swagger` to see and test every endpoint without writing a client.
- Every `Program.cs` follows the same shape: create a builder, register services, build the app, configure the pipeline, map endpoints, run.
- Returning a C# object from an endpoint sends it as JSON. You do not serialize by hand.
- JSON property names come back in camelCase by default.
- With top level statements, declare your records and classes at the bottom of the file.

<code id="code-content" class="language-csharp">
// Program.cs - your first Web API, replacing the template sample
// dotnet new webapi -n BookStore.Api
// cd BookStore.Api
// dotnet watch run   ->  https://localhost:7139/swagger
var builder = WebApplication.CreateBuilder(args);
// 1. Register services (Swagger so we get a test page)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
var app = builder.Build();
// 2. Configure the pipeline (only show Swagger while developing)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseHttpsRedirection();
// Our data, kept in memory for now
var books = new List&lt;Book&gt;
{
    new Book(1, "The Pragmatic Programmer", 1999),
    new Book(2, "Clean Code", 2008),
    new Book(3, "Refactoring", 1999)
};
// 3. Map endpoints
app.MapGet("/", () =&gt; "BookStore API is running. Try /api/books");
// Return the whole list
app.MapGet("/api/books", () =&gt; books)
   .WithName("GetBooks")
   .WithOpenApi();
// {id} in the route becomes the int id parameter: this is model binding
app.MapGet("/api/books/{id}", (int id) =&gt;
{
    Book? book = books.FirstOrDefault(b =&gt; b.Id == id);
    return book is null ? Results.NotFound() : Results.Ok(book);
})
   .WithName("GetBookById")
   .WithOpenApi();
// A query string parameter: /api/books/search?year=1999
app.MapGet("/api/books/search", (int? year) =&gt;
    books.Where(b =&gt; year is null || b.Year == year).ToList());
app.Run();
// Types come after the top level statements, never before
record Book(int Id, string Title, int Year);
</code></pre>
