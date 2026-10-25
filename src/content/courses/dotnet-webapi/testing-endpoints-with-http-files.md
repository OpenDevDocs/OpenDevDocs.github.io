---
publishDate: 2026-09-27T18:20
title: Testing Endpoints with .http Files
slug: testing-endpoints-with-http-files
metadescription: Test your API from inside your editor with .http files. Use variables, environments, request chaining and authentication, and see how they compare to Postman and curl.
updateDate: 2026-09-07T18:20
author: ['bishal-biswas']
level: 1
tags: ['testing', 'http-files', 'tools']
course: dotnet-webapi
---

## Four ways to call your API

**Swagger UI** is built in and needs no setup. Good for exploring, awkward for repeated tests, and nothing is saved.

**Postman** is powerful, with collections, environments and scripting. It is a separate application, and sharing collections properly needs an account.

**curl** works everywhere and is perfect in a script. Long requests get unreadable.

**`.http` files** live in your repository, next to the code, and run inside your editor. They are versioned, reviewable and require no account. For day to day development while building an API, they are the fastest option.

## Your first .http file

The Web API template already creates one. Open `BookStore.Api.http`:

```http
@host = https://localhost:7139

GET {{host}}/api/books
Accept: application/json

###

GET {{host}}/api/books/1
Accept: application/json
```

`###` separates requests. Above each one, your editor shows a **Send Request** link.

**Visual Studio 2022** supports these natively. **VS Code** needs the REST Client extension or the C# Dev Kit. **Rider** supports them natively too.

## Variables

Define once at the top with `@`:

```http
@host = https://localhost:7139
@apiVersion = v1
@contentType = application/json

GET {{host}}/api/{{apiVersion}}/books
Accept: {{contentType}}
```

Change the host in one place and every request follows.

## Request bodies

A blank line separates headers from the body:

```http
POST {{host}}/api/books
Content-Type: application/json

{
  "title": "Refactoring",
  "author": "Martin Fowler",
  "year": 1999,
  "price": 34.99
}
```

The blank line is required. Without it, your JSON is parsed as headers and you get a confusing error.

## Chaining requests

The feature that makes these genuinely useful. Name a request, then use its response in a later one:

```http
# @name login

POST {{host}}/api/auth/login
Content-Type: application/json

{
  "email": "asha@example.com",
  "password": "Secret123!"
}

###

@token = {{login.response.body.accessToken}}

GET {{host}}/api/books
Authorization: Bearer {{token}}
```

Run the login, then every request below uses the token automatically. No copying and pasting a JWT.

The same works for ids:

```http
# @name createBook

POST {{host}}/api/books
Content-Type: application/json

{ "title": "Domain Driven Design", "year": 2003 }

###

@bookId = {{createBook.response.body.id}}

GET {{host}}/api/books/{{bookId}}

###

DELETE {{host}}/api/books/{{bookId}}
```

Create, read, delete, all driven by the id the server assigned. You can run a whole CRUD cycle in a few clicks.

Response headers work too:

```http
@location = {{createBook.response.headers.Location}}

GET {{host}}{{location}}
```

## Environments

Keep per environment values in `http-client.env.json` next to your `.http` file:

```json
{
  "local": {
    "host": "https://localhost:7139",
    "apiKey": "dev-key-123"
  },
  "staging": {
    "host": "https://staging-api.example.com",
    "apiKey": "staging-key"
  }
}
```

```http
GET {{host}}/api/books
X-Api-Key: {{apiKey}}
```

Your editor shows a dropdown to pick the environment. The same file now tests local and staging.

**Real secrets go in `http-client.env.json.user`**, which the tooling looks for and which you add to `.gitignore`:

```json
{
  "staging": {
    "apiKey": "the-real-staging-key"
  }
}
```

The shared file documents the shape. The user file holds the values. Nothing secret is committed.

## Testing every verb

```http
### Read a collection with filters
GET {{host}}/api/books?year=1999&sort=price:desc&page=1&pageSize=10
Accept: application/json

### Read one
GET {{host}}/api/books/1

### Create
POST {{host}}/api/books
Content-Type: application/json
Idempotency-Key: 8f14e45f-ceea-467a-9c1e-4e2f6b2d0c3a

{ "title": "Refactoring", "year": 1999 }

### Full replace
PUT {{host}}/api/books/1
Content-Type: application/json

{ "title": "Refactoring, 2nd Edition", "year": 2018 }

### Partial update
PATCH {{host}}/api/books/1
Content-Type: application/json

{ "year": 2018 }

### Delete
DELETE {{host}}/api/books/1
Authorization: Bearer {{token}}
```

## Testing failures

Just as important as testing the happy path. Keep a file of requests that should fail:

```http
### Should be 404
GET {{host}}/api/books/999999

### Should be 400: title is missing
POST {{host}}/api/books
Content-Type: application/json

{ "year": 1999 }

### Should be 400: year out of range
POST {{host}}/api/books
Content-Type: application/json

{ "title": "Test", "year": 99999 }

### Should be 401: no token
DELETE {{host}}/api/books/1

### Should be 403: valid token, wrong role
DELETE {{host}}/api/books/1
Authorization: Bearer {{readOnlyToken}}

### Should be 415: wrong content type
POST {{host}}/api/books
Content-Type: text/plain

not json
```

Checking these by hand after a change catches a surprising number of regressions.

## File uploads

```http
POST {{host}}/api/documents/upload
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="title"

My holiday photo
------Boundary
Content-Disposition: form-data; name="file"; filename="photo.jpg"
Content-Type: image/jpeg

< ./test-files/photo.jpg
------Boundary--
```

`< ./path` reads a file from disk. Note the boundary must match exactly, including the two extra dashes on the closing line.

## Organising them

One file per resource, in a folder next to your project:

```text
BookStore.Api/
├── http/
│   ├── auth.http
│   ├── books.http
│   ├── orders.http
│   ├── errors.http
│   └── http-client.env.json
└── Program.cs
```

Commit these. A new team member can then exercise every endpoint on their first day without reading a line of documentation, and a pull request that adds an endpoint should add its requests too.

## Where they stop

Be clear about the limit. `.http` files are for **manual** testing. There is no assertion, no pass or fail, no CI integration.

They do not replace automated tests. Use them while building an endpoint, then write an integration test that asserts the behaviour, which is the topic after next.

If you want assertions without a full test project, Postman and Bruno both support scripted checks and can run in CI. Bruno is worth knowing: it stores collections as plain files in your repository, so it sits between `.http` files and Postman.

## Quick recap

- `.http` files live in your repo and run inside your editor, with no account and no separate app.
- `###` separates requests, and a blank line separates headers from the body.
- `@name` on a request lets later requests read its response body and headers.
- Chaining a login means you never paste a JWT by hand.
- `http-client.env.json` holds per environment values, and the `.user` variant holds secrets and stays out of git.
- Keep a file of requests that should fail, and check the status codes after a change.
- `< ./path` sends a file for multipart uploads.
- One file per resource, committed, so a new teammate can exercise the API immediately.
- They are manual only. They complement automated tests, they do not replace them.

<code id="code-content" class="language-csharp">
// The endpoints the .http file below exercises. Both belong in the repository.
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
var app = builder.Build();
app.MapControllers();
app.Run();
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    private static readonly List&lt;Book&gt; Books = new()
    {
        new Book { Id = 1, Title = "Clean Code", Year = 2008, Price = 34.99m }
    };
    [HttpGet]
    public IActionResult Search([FromQuery] int? year, [FromQuery] int page = 1) =&gt;
        Ok(Books.Where(b =&gt; year is null || b.Year == year).ToList());
    [HttpGet("{id:int}", Name = nameof(GetById))]
    public IActionResult GetById(int id) =&gt;
        Books.FirstOrDefault(b =&gt; b.Id == id) is Book b ? Ok(b) : NotFound();
    [HttpPost]
    public IActionResult Create([FromBody] Book book)
    {
        book.Id = Books.Max(b =&gt; b.Id) + 1;
        Books.Add(book);
        return CreatedAtAction(nameof(GetById), new { id = book.Id }, book);
    }
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public IActionResult Delete(int id) =&gt;
        Books.FirstOrDefault(b =&gt; b.Id == id) is Book b &amp;&amp; Books.Remove(b) ? NoContent() : NotFound();
}
public class Book
{
    public int Id { get; set; }
    [System.ComponentModel.DataAnnotations.Required]
    public string Title { get; set; } = "";
    [System.ComponentModel.DataAnnotations.Range(1000, 2100)]
    public int Year { get; set; }
    public decimal Price { get; set; }
}
/* ---------------- http/books.http ----------------
@host = {{host}}
### Log in once. Everything below reuses the token.
# @name login
POST {{host}}/api/auth/login
Content-Type: application/json
{ "email": "asha@example.com", "password": "Secret123!" }
###
@token = {{login.response.body.accessToken}}
### Read a collection with filters
GET {{host}}/api/books?year=2008&amp;page=1
Accept: application/json
### Create, and remember the id the server assigned
# @name createBook
POST {{host}}/api/books
Content-Type: application/json
{ "title": "Refactoring", "year": 1999, "price": 39.99 }
###
@bookId   = {{createBook.response.body.id}}
@location = {{createBook.response.headers.Location}}
### Fetch it back using the generated id
GET {{host}}/api/books/{{bookId}}
### Or follow the Location header directly
GET {{host}}{{location}}
### Delete it. Needs the Admin role, hence the token.
DELETE {{host}}/api/books/{{bookId}}
Authorization: Bearer {{token}}
   ---------------- http/errors.http ----------------
### Expect 404
GET {{host}}/api/books/999999
### Expect 400, title is required
POST {{host}}/api/books
Content-Type: application/json
{ "year": 1999 }
### Expect 400, year out of range
POST {{host}}/api/books
Content-Type: application/json
{ "title": "Test", "year": 99999 }
### Expect 401, no token
DELETE {{host}}/api/books/1
### Expect 415, wrong content type
POST {{host}}/api/books
Content-Type: text/plain
not json
   ---------------- http-client.env.json (committed) ----------------
{
  "local":   { "host": "https://localhost:7139", "apiKey": "dev-key-123" },
  "staging": { "host": "https://staging-api.example.com", "apiKey": "" }
}
   ---------------- http-client.env.json.user (gitignored) ----------------
{
  "staging": { "apiKey": "the-real-staging-key" }
}
*/
</code></pre>
