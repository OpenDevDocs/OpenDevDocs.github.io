---
publishDate: 2026-09-01T09:00
title: Introduction to Web APIs and REST
slug: introduction-to-web-apis-and-rest
metadescription: Learn what a web API is, how clients and servers talk over HTTP, what REST actually means, and why ASP.NET Core is a good way to build one.
updateDate: 2026-09-07T09:00
author: ['bishal-biswas']
level: 1
tags: ['basics', 'rest', 'http']
course: dotnet-webapi
---

## What is a web API?

An **API** is an Application Programming Interface. It is a way for one piece of software to ask another piece of software to do something.

A **web API** is an API you reach over the internet using HTTP. Instead of a human opening a page in a browser, a program sends a request and gets back data.

Think of a restaurant. You do not walk into the kitchen. You talk to a waiter, who knows the menu and brings back your food. The API is the waiter. The kitchen is your database and your business logic.

Here is what that looks like in practice. A mobile app asks for a list of products:

```http
GET /api/products HTTP/1.1
Host: shop.example.com
```

The server answers with data, not with a web page:

```json
[
  { "id": 1, "name": "Keyboard", "price": 49.99 },
  { "id": 2, "name": "Mouse", "price": 19.99 }
]
```

That is the whole idea. Send a request, get back data.

## Why not just build a website?

A website returns HTML that a browser draws on screen. That works for one kind of client: a browser.

An API returns raw data. That means **many different clients** can use the same backend:

- A React or Angular website
- An Android app and an iOS app
- A desktop app
- Another server, such as a payment service calling you back
- A smart TV, a watch, or a script someone wrote

You write the logic once and every client uses it. This is the main reason APIs are everywhere today.

## What is REST?

**REST** stands for Representational State Transfer. It is not a library or a framework. It is a **set of ideas** for designing APIs so they feel predictable.

The most important idea is this: everything is a **resource**, and every resource has a URL.

A resource is a thing your system knows about. A product. A user. An order. You do not create URLs like `/getAllProductsFromDatabase`. You name the thing:

```text
/api/products             the collection of products
/api/products/5           the product with id 5
/api/products/5/reviews   the reviews for product 5
```

Notice that the URL says **what**, never **how**. The URL is a noun.

## The verb goes in the HTTP method

If the URL is the noun, then the HTTP method is the verb. The same URL does different work depending on which method you use:

```http
GET    /api/products/5     read product 5
PUT    /api/products/5     replace product 5
PATCH  /api/products/5     change part of product 5
DELETE /api/products/5     remove product 5
POST   /api/products       create a new product
```

This is why REST APIs feel familiar even when you have never seen them before. Once you learn the pattern, you can guess how a new API works.

## Statelessness

A REST API is **stateless**. The server does not remember anything about you between requests.

Every request must carry everything the server needs, including who you are:

```http
GET /api/orders HTTP/1.1
Host: shop.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

The token in that header tells the server who is asking. The server does not keep a session in memory saying "this person logged in five minutes ago".

This sounds like extra work, but it buys you something big. Any server can handle any request. You can run ten copies of your API behind a load balancer and it just works, because no copy holds special knowledge about a user.

## The parts of a request and a response

Every HTTP exchange has the same shape.

A **request** has:

- A method: `GET`, `POST`, `PUT`, `PATCH` or `DELETE`
- A URL such as `/api/products/5`
- Headers, which carry extra information such as `Authorization` or `Content-Type`
- An optional body, which is the data you are sending, usually JSON

A **response** has:

- A status code such as `200`, `404` or `500`
- Headers
- An optional body, usually JSON

Here is a full round trip for creating a product:

```http
POST /api/products HTTP/1.1
Host: shop.example.com
Content-Type: application/json

{ "name": "Monitor", "price": 199.99 }
```

```http
HTTP/1.1 201 Created
Location: /api/products/3
Content-Type: application/json

{ "id": 3, "name": "Monitor", "price": 199.99 }
```

The `201` says a new thing was created. The `Location` header says where to find it. You will build responses exactly like this in the coming topics.

## Where ASP.NET Core fits

**ASP.NET Core** is Microsoft's framework for building web applications, and **Web API** is the part of it made for building HTTP services.

It gives you, out of the box:

- Routing, so a URL finds the right piece of your code
- **Model binding**, which turns JSON in the request into a C# object automatically
- Validation, JSON serialization, dependency injection and logging
- A fast, cross platform server that runs on Windows, Linux and macOS

Here is a complete working API. Yes, this really is the whole file:

```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/api/products", () => new[]
{
    new { Id = 1, Name = "Keyboard", Price = 49.99 },
    new { Id = 2, Name = "Mouse", Price = 19.99 }
});

app.Run();
```

Run that and `GET /api/products` returns JSON. The framework handles the HTTP parsing, the routing and the conversion to JSON for you.

## What you will build in this course

You will start from this tiny example and grow it into a real API: controllers, a database with Entity Framework Core, validation, login with tokens, documentation, tests and deployment.

Do not worry about the C# details yet. Every topic builds on the one before it.

## Quick recap

- A web API lets programs talk to your server over HTTP and get back data instead of HTML.
- One API can serve web apps, mobile apps and other servers at the same time.
- REST is a style, not a tool. Its core idea is that resources get URLs and HTTP methods are the verbs.
- URLs are nouns such as `/api/products/5`. The action comes from `GET`, `POST`, `PUT`, `PATCH` or `DELETE`.
- REST APIs are stateless, so each request carries everything the server needs.
- ASP.NET Core handles routing, JSON and model binding so you can focus on your own logic.

<code id="code-content" class="language-csharp">
// Program.cs - the smallest possible REST style API in ASP.NET Core
// Run with: dotnet run
// Then open: http://localhost:5000/api/products
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
// A resource: our in memory list of products
var products = new List&lt;Product&gt;
{
    new Product(1, "Keyboard", 49.99m),
    new Product(2, "Mouse", 19.99m)
};
// GET the whole collection
app.MapGet("/api/products", () =&gt; products);
// GET a single item. Answers 404 when it does not exist.
app.MapGet("/api/products/{id}", (int id) =&gt;
{
    Product? found = products.FirstOrDefault(p =&gt; p.Id == id);
    return found is null
        ? Results.NotFound()                             // 404
        : Results.Ok(found);                             // 200
});
// POST creates a new item and answers 201 with a Location header
app.MapPost("/api/products", (Product incoming) =&gt;
{
    int nextId = products.Count == 0 ? 1 : products.Max(p =&gt; p.Id) + 1;
    Product created = incoming with { Id = nextId };
    products.Add(created);
    return Results.Created($"/api/products/{created.Id}", created);   // 201
});
// DELETE removes it and answers 204 (success, nothing to send back)
app.MapDelete("/api/products/{id}", (int id) =&gt;
{
    Product? found = products.FirstOrDefault(p =&gt; p.Id == id);
    if (found is null) return Results.NotFound();
    products.Remove(found);
    return Results.NoContent();                          // 204
});
app.Run();
// The resource, as a simple record
record Product(int Id, string Name, decimal Price);
</code></pre>
