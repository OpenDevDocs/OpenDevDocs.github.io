---
publishDate: 2026-09-20T15:40
title: Cross Origin Resource Sharing (CORS)
slug: cross-origin-resource-sharing-cors
metadescription: Understand why browsers block cross origin API calls, configure a CORS policy properly, handle preflight requests and credentials, and fix the common CORS errors.
updateDate: 2026-09-07T15:40
author: ['bishal-biswas']
level: 2
tags: ['cors', 'security', 'browsers']
course: dotnet-webapi
---

## The error everyone meets

Your API works in Swagger and in Postman. Then the React app calls it and the console says:

```text
Access to fetch at 'https://api.example.com/api/books' from origin
'https://app.example.com' has been blocked by CORS policy: No
'Access-Control-Allow-Origin' header is present on the requested resource.
```

Nothing is broken. This is a browser rule doing exactly what it was designed to do.

## What an origin is

An **origin** is the combination of scheme, host and port:

```text
https://app.example.com:443
  ^        ^              ^
scheme   host           port
```

Two URLs are the same origin only if **all three** match:

| URL | Same origin as `https://app.example.com`? |
|---|---|
| `https://app.example.com/books` | yes, the path does not matter |
| `http://app.example.com` | no, different scheme |
| `https://api.example.com` | no, different host |
| `https://app.example.com:8080` | no, different port |

That last one catches people constantly during local development. `localhost:3000` and `localhost:5000` are different origins.

## Why the browser blocks it

The **same origin policy** stops a malicious site reading your data from another site.

Imagine you are logged into your bank at `bank.com`, with a session cookie. You then open `evil.com`, which runs:

```javascript
fetch('https://bank.com/api/accounts', { credentials: 'include' })
  .then(r => r.json())
  .then(data => sendToAttacker(data));
```

Without the same origin policy, the browser would attach your cookie, the bank would answer, and `evil.com` would read your balance.

**CORS** is how a server says "these specific origins may read my responses". It is a relaxation of the rule, not a security feature you add. The protection is the default.

Two things follow, and both matter.

**CORS is a browser thing only.** Postman, curl and server to server calls ignore it entirely. CORS never protects your API from an attacker with a terminal. Only authentication and authorization do that.

**The request usually still reaches your server.** For a simple request, the browser sends it, your code runs, and the browser then hides the response because the header is missing. So a `GET` blocked by CORS may already have happened.

## Enabling CORS

Two steps: register a policy, then use the middleware.

```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("https://app.example.com", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors();      // before UseAuthentication and UseAuthorization
```

**Placement matters.** `UseCors` must come after `UseRouting` and **before** `UseAuthentication`, `UseAuthorization` and your endpoints. Put it after auth and preflight requests are rejected before the CORS headers are ever added.

## Named policies

Different rules for different parts of the API:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("PublicApi", policy =>
        policy.AllowAnyOrigin().WithMethods("GET").AllowAnyHeader());

    options.AddPolicy("Trusted", policy =>
        policy.WithOrigins("https://app.example.com")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});
```

```csharp
app.UseCors("Trusted");                            // the default for everything

[EnableCors("PublicApi")]                          // override on a controller or action
public class PublicController : ControllerBase { }

[DisableCors]                                      // no cross origin access at all
public class InternalController : ControllerBase { }
```

## Preflight requests

For anything beyond a plain `GET` or `POST` with a simple content type, the browser sends an `OPTIONS` request **first** to ask permission:

```http
OPTIONS /api/books HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: DELETE
Access-Control-Request-Headers: authorization, content-type
```

Your server answers:

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Max-Age: 600
```

Only then does the browser send the real `DELETE`.

The CORS middleware handles all of this. You never write an `OPTIONS` action.

A preflight is triggered by any of: a method other than `GET`, `HEAD` or `POST`; a `Content-Type` of `application/json`; or a custom header such as `Authorization`. In other words, essentially every real API call.

`SetPreflightMaxAge` tells the browser how long it may cache the answer, which removes a round trip:

```csharp
policy.SetPreflightMaxAge(TimeSpan.FromMinutes(10));
```

## Credentials

If the browser must send cookies, you need `AllowCredentials`:

```javascript
fetch('https://api.example.com/api/books', { credentials: 'include' })
```

```csharp
policy.WithOrigins("https://app.example.com")
      .AllowAnyHeader()
      .AllowAnyMethod()
      .AllowCredentials();
```

**You cannot combine `AllowCredentials` with `AllowAnyOrigin`.** The spec forbids it, and ASP.NET Core throws at startup:

```text
The CORS protocol does not allow specifying a wildcard (any) origin and credentials at the same time.
```

The reason is sound. `AllowAnyOrigin` plus credentials would let **any** website make authenticated requests as your user, which is precisely the attack the same origin policy prevents. List your origins explicitly.

Note that a JWT in an `Authorization` header is **not** a credential in this sense. You only need `AllowCredentials` for cookies.

## Exposing response headers

By default, JavaScript can only read a handful of response headers. Your custom ones are hidden unless you say otherwise:

```csharp
policy.WithOrigins("https://app.example.com")
      .WithExposedHeaders("X-Total-Count", "X-Page", "X-Request-Id");
```

This is the cause of "I can see the header in the network tab but `response.headers.get()` returns null". The header did arrive. The browser is hiding it.

## Do not use AllowAnyOrigin in production

```csharp
// Convenient, and it means any website can call your API from a browser
policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
```

If your API is genuinely public and needs no credentials, this is acceptable. For anything else, list the origins.

A reasonable pattern is to be relaxed locally and strict in production:

```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy.SetIsOriginAllowed(_ => true)     // any localhost port
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        }
        else
        {
            string[] origins = builder.Configuration
                .GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

            policy.WithOrigins(origins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        }
    });
});
```

Origins in configuration means adding a new front end is an environment variable, not a deployment.

## Common problems

**No `Access-Control-Allow-Origin` header.** The origin is not in your list. Check for an exact match, including scheme and port.

**A trailing slash.** `WithOrigins("https://app.example.com/")` does not match the origin `https://app.example.com`. Never include a trailing slash.

**Preflight returns 401.** `UseCors` is registered after `UseAuthentication`. Move it before.

**Preflight returns 404.** `UseCors` is missing entirely, or comes after `UseRouting` is not called at all.

**It throws at startup.** You combined `AllowAnyOrigin` with `AllowCredentials`.

**The header is missing on an error response.** By default, CORS headers are not added to unhandled exceptions, so a `500` looks like a CORS problem in the browser console. Fix the exception, and make sure your global exception handler is registered before `UseCors` so the response still passes through it.

**Credentials are not sent.** The client must set `credentials: 'include'`, and the server must set `AllowCredentials`. Both are required.

## Quick recap

- An origin is scheme plus host plus port. All three must match.
- CORS relaxes the browser's same origin policy. It is not a server side protection.
- Postman and curl ignore CORS entirely, so a working Postman call proves nothing about the browser.
- Register a policy with `AddCors` and enable it with `UseCors`.
- `UseCors` goes after `UseRouting` and before `UseAuthentication` and `UseAuthorization`.
- Preflight `OPTIONS` requests are handled for you. Cache them with `SetPreflightMaxAge`.
- `AllowCredentials` cannot be combined with `AllowAnyOrigin`. List the origins.
- A JWT in a header is not a credential. Only cookies need `AllowCredentials`.
- Custom response headers are hidden from JavaScript unless listed in `WithExposedHeaders`.
- Never include a trailing slash in an origin.

<code id="code-content" class="language-csharp">
// CORS configured properly, including the ordering that trips people up.
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddCors(options =&gt;
{
    // The default policy: relaxed locally, strict in production
    options.AddDefaultPolicy(policy =&gt;
    {
        if (builder.Environment.IsDevelopment())
        {
            // Any localhost port, so a dev server on 3000, 5173 or 4200 all work
            policy.SetIsOriginAllowed(origin =&gt; new Uri(origin).Host is "localhost" or "127.0.0.1")
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        }
        else
        {
            // From configuration, so adding a front end is an env var, not a deploy
            string[] origins = builder.Configuration
                .GetSection("Cors:AllowedOrigins").Get&lt;string[]&gt;() ?? Array.Empty&lt;string&gt;();
            policy.WithOrigins(origins)          // NEVER a trailing slash: "https://app.example.com"
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials()            // required only for cookies, not for a JWT header
                  // Without this, JavaScript cannot read these, even though they arrive
                  .WithExposedHeaders("X-Total-Count", "X-Page", "X-Request-Id")
                  // Lets the browser cache the preflight answer and skip a round trip
                  .SetPreflightMaxAge(TimeSpan.FromMinutes(10));
        }
    });
    // A read only public policy. AllowAnyOrigin is fine HERE because there are
    // no credentials. Combining the two throws at startup, and rightly so.
    options.AddPolicy("PublicRead", policy =&gt;
        policy.AllowAnyOrigin()
              .WithMethods("GET", "HEAD")
              .AllowAnyHeader());
});
var app = builder.Build();
// Exception handling first, so an error response still travels back through CORS.
// Otherwise a 500 shows up in the browser as a confusing CORS error.
app.UseExceptionHandler("/error");
app.UseHttpsRedirection();
app.UseRouting();
// AFTER UseRouting, BEFORE authentication. Put it after auth and the preflight
// OPTIONS request, which carries no credentials, is rejected with 401.
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
[ApiController]
[Route("api/[controller]")]
public class BooksController : ControllerBase
{
    // Uses the default policy
    [HttpGet]
    public IActionResult GetAll([FromQuery] int page = 1)
    {
        Response.Headers["X-Total-Count"] = "1204";   // hidden from JS without WithExposedHeaders
        Response.Headers["X-Page"] = page.ToString();
        return Ok(new[] { "Clean Code", "Refactoring" });
    }
    // DELETE always triggers a preflight OPTIONS request first.
    // The CORS middleware answers it. You never write an OPTIONS action.
    [HttpDelete("{id:int}")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public IActionResult Delete(int id) =&gt; NoContent();
}
// A different policy for one controller
[ApiController]
[Route("api/[controller]")]
[EnableCors("PublicRead")]
public class CatalogueController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() =&gt; Ok(new { note = "readable from any origin" });
}
// No cross origin access at all. Note this stops BROWSERS only:
// curl, Postman and other servers can still call it, so it still needs authorization.
[ApiController]
[Route("api/[controller]")]
[DisableCors]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
public class InternalController : ControllerBase
{
    [HttpGet("metrics")]
    public IActionResult Metrics() =&gt; Ok(new { requests = 42_000 });
}
/* appsettings.Production.json
{
  "Cors": {
    "AllowedOrigins": [
      "https://app.example.com",
      "https://admin.example.com"
    ]
  }
}
   As an environment variable, an array binds by index:
     Cors__AllowedOrigins__0="https://app.example.com"
     Cors__AllowedOrigins__1="https://admin.example.com"
*/
</code></pre>
