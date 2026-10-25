---
publishDate: 2026-09-17T14:50
title: JWT Authentication
slug: jwt-authentication
metadescription: Understand what a JSON Web Token contains, configure JWT bearer validation in ASP.NET Core, issue tokens on login, and add JWT support to Swagger.
updateDate: 2026-09-07T14:50
author: ['bishal-biswas']
level: 3
tags: ['jwt', 'authentication', 'security']
course: dotnet-webapi
---

## What a JWT is

A **JSON Web Token** is a string with three parts separated by dots:

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsIm5hbWUiOiJBc2hhIn0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

Split by the dots and you get:

**Header**, saying which algorithm signed it:

```json
{ "alg": "HS256", "typ": "JWT" }
```

**Payload**, the claims:

```json
{
  "sub": "42",
  "email": "asha@example.com",
  "role": ["Editor", "Reviewer"],
  "iss": "BookStoreApi",
  "aud": "BookStoreClients",
  "exp": 1789567890,
  "iat": 1789564290
}
```

**Signature**, which proves nobody altered the first two parts.

## The payload is not secret

This is the most important thing to understand about JWTs.

The header and payload are **base64 encoded, not encrypted**. Anyone holding the token can decode and read them. Paste one into any JWT decoder and the claims appear in plain text.

So never put anything sensitive in a JWT. No passwords, no card numbers, no personal data beyond what a client may see. A user id, an email and a list of roles are fine.

What the signature guarantees is **integrity**, not secrecy. Change one character of the payload and the signature no longer matches, so the server rejects it.

## The standard claims

Short names, defined by the spec:

| Claim | Meaning |
|---|---|
| `sub` | subject, the user id |
| `iss` | issuer, who created the token |
| `aud` | audience, who the token is for |
| `exp` | expiry, as a Unix timestamp |
| `iat` | issued at |
| `nbf` | not valid before |
| `jti` | a unique id for this token |

Add your own alongside them: `email`, `role`, `tenant_id` and anything else your API needs.

## Installing and configuring

```bash
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
```

```csharp
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,

            ValidateAudience = true,
            ValidAudience = jwt.Audience,

            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),

            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key))
        };
    });
```

Every one of those `Validate` flags should stay `true`. Turning one off to make something work is how APIs get compromised.

**Why validate the issuer and audience?** Without them, a valid token from a completely different system would be accepted. The issuer says who made it, the audience says who it is for.

**`ClockSkew`** defaults to five minutes, which means an expired token keeps working for five more minutes. Reduce it to about thirty seconds. Zero is too strict if your servers drift.

## The signing key

For **HS256**, one secret signs and verifies. Simple, and it means anyone who can verify can also forge.

The key must be at least 32 bytes for HS256, and it is a secret. It belongs in user secrets locally and in a vault or environment variable in production. Never in `appsettings.json`.

```csharp
if (jwt.Key.Length < 32)
    throw new InvalidOperationException("Jwt:Key must be at least 32 characters.");
```

For **RS256**, a private key signs and a public key verifies. Use it when several services need to validate tokens you issue, because you can distribute the public key freely.

## Issuing a token

```csharp
public string CreateToken(User user)
{
    var claims = new List<Claim>
    {
        new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new(JwtRegisteredClaimNames.Email, user.Email),
        new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        new("name", user.DisplayName)
    };

    foreach (string role in user.Roles)
        claims.Add(new Claim(ClaimTypes.Role, role));

    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Key));
    var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

    var token = new JwtSecurityToken(
        issuer: options.Issuer,
        audience: options.Audience,
        claims: claims,
        notBefore: DateTime.UtcNow,
        expires: DateTime.UtcNow.AddMinutes(options.ExpiryMinutes),
        signingCredentials: credentials);

    return new JwtSecurityTokenHandler().WriteToken(token);
}
```

And the login endpoint that uses it:

```csharp
[HttpPost("login")]
[AllowAnonymous]
public async Task<IActionResult> Login(LoginRequest request)
{
    User? user = await db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);

    // One message for both cases, so an attacker cannot discover which emails exist
    if (user is null || !passwordHasher.Verify(request.Password, user.PasswordHash))
        return Unauthorized(new { error = "Invalid email or password." });

    return Ok(new
    {
        accessToken = tokenService.CreateToken(user),
        expiresIn = options.ExpiryMinutes * 60
    });
}
```

## Never store a password in plain text

Hash it with a slow, salted algorithm. BCrypt is the easy choice:

```bash
dotnet add package BCrypt.Net-Next
```

```csharp
string hash = BCrypt.Net.BCrypt.HashPassword(password);
bool valid = BCrypt.Net.BCrypt.Verify(password, hash);
```

Never MD5 or SHA256. They are fast, which is exactly wrong for passwords: a modern GPU tries billions of SHA256 guesses per second. BCrypt, Argon2 and PBKDF2 are deliberately slow.

ASP.NET Core Identity handles this for you, and gets its own topic.

## Using the token

The client sends it in a header:

```http
GET /api/books HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

The word `Bearer`, a space, then the token. That word matters. Sending the raw token without it produces a `401` with no explanation.

## Keep access tokens short lived

A JWT is **stateless**. The server does not store it, so it cannot be revoked. Once issued it is valid until it expires.

That is the tradeoff. No database lookup per request, but no logout either. If a token is stolen, it works until `exp`.

The answer is a short lifetime, typically **fifteen minutes**, paired with a longer lived **refresh token** that can be revoked because it is stored. Refresh tokens are the next topic.

## Debugging a 401

When a token is rejected, get the reason rather than guessing:

```csharp
options.Events = new JwtBearerEvents
{
    OnAuthenticationFailed = context =>
    {
        if (context.Exception is SecurityTokenExpiredException)
            context.Response.Headers["X-Token-Expired"] = "true";

        return Task.CompletedTask;
    }
};
```

In development you can also see the full error:

```csharp
options.IncludeErrorDetails = builder.Environment.IsDevelopment();
```

The usual causes, in rough order of frequency:

- The `Bearer ` prefix is missing.
- The token has expired.
- The signing key on the API does not match the one used to issue it.
- The issuer or audience does not match.
- `UseAuthentication` is missing, or comes after `UseAuthorization`.
- You are reading `"sub"` when claim mapping renamed it. Set `MapInboundClaims = false`.

## Adding JWT to Swagger

Without this, you cannot test protected endpoints from the Swagger page:

```csharp
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the token only. Swagger adds the Bearer prefix."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});
```

An **Authorize** button appears at the top of the page.

## Where should the client store it?

A question you will be asked, so it is worth having the answer.

**`localStorage`** is easy and vulnerable to XSS. Any injected script can read it.

**An httpOnly cookie** cannot be read by JavaScript, which removes the XSS risk, but introduces CSRF, so it needs `SameSite=Strict` and a CSRF token.

**In memory only** is the safest and loses the session on refresh, unless paired with a refresh token in an httpOnly cookie.

The common recommendation for a browser app: access token in memory, refresh token in an httpOnly cookie. For a mobile app, the platform's secure storage.

## Quick recap

- A JWT has a header, a payload and a signature. The payload is encoded, not encrypted, so anyone can read it.
- Put a user id, email and roles in it. Never a password or anything sensitive.
- Keep every validation flag on: issuer, audience, lifetime and signing key.
- Reduce `ClockSkew` from five minutes to about thirty seconds.
- The HS256 signing key must be at least 32 characters and kept out of source control.
- Hash passwords with BCrypt or Argon2, never MD5 or SHA256.
- The header is `Authorization: Bearer <token>`. The prefix is required.
- JWTs cannot be revoked, so keep them short lived and pair them with refresh tokens.
- Add a security definition so Swagger can send the token.
- Return the same error for a wrong email and a wrong password.

<code id="code-content" class="language-csharp">
// Complete JWT authentication: configuration, issuing, and Swagger support.
// dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
// dotnet add package BCrypt.Net-Next
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
var builder = WebApplication.CreateBuilder(args);
var jwt = builder.Configuration.GetSection("Jwt").Get&lt;JwtOptions&gt;()
          ?? throw new InvalidOperationException("The Jwt section is missing.");
if (jwt.Key.Length &lt; 32)
    throw new InvalidOperationException("Jwt:Key must be at least 32 characters for HS256.");
builder.Services.AddSingleton(jwt);
builder.Services.AddSingleton&lt;TokenService&gt;();
builder.Services.AddControllers();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =&gt;
    {
        options.MapInboundClaims  = false;                       // keep "sub" as "sub"
        options.IncludeErrorDetails = builder.Environment.IsDevelopment();
        options.TokenValidationParameters = new TokenValidationParameters
        {
            // Every one of these stays true. Turning one off to "make it work"
            // is how APIs get compromised.
            ValidateIssuer           = true,  ValidIssuer   = jwt.Issuer,
            ValidateAudience         = true,  ValidAudience = jwt.Audience,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            // Default is 5 minutes, so an "expired" token keeps working. Tighten it.
            ClockSkew = TimeSpan.FromSeconds(30),
            RoleClaimType = ClaimTypes.Role,
            NameClaimType = "name"
        };
        // Tells the client WHY the 401 happened, which saves a lot of guessing
        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = context =&gt;
            {
                if (context.Exception is SecurityTokenExpiredException)
                    context.Response.Headers["X-Token-Expired"] = "true";
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();
// Without this, Swagger cannot send a token and every protected endpoint fails there
builder.Services.AddSwaggerGen(options =&gt;
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization", Type = SecuritySchemeType.Http,
        Scheme = "bearer",      BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the token only. Swagger adds the Bearer prefix."
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { new OpenApiSecurityScheme { Reference = new OpenApiReference
            { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }, Array.Empty&lt;string&gt;() }
    });
});
var app = builder.Build();
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
app.UseAuthentication();     // must come first
app.UseAuthorization();
app.MapControllers();
app.Run();
public class JwtOptions
{
    public string Issuer { get; set; } = "";
    public string Audience { get; set; } = "";
    public string Key { get; set; } = "";        // user secrets locally, a vault in production
    public int ExpiryMinutes { get; set; } = 15; // short: a JWT cannot be revoked
}
public class TokenService
{
    private readonly JwtOptions options;
    public TokenService(JwtOptions options) =&gt; this.options = options;
    public (string Token, int ExpiresInSeconds) Create(User user)
    {
        // Remember: the payload is readable by anyone holding the token.
        // Nothing sensitive goes in here.
        var claims = new List&lt;Claim&gt;
        {
            new(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),  // unique per token
            new("name", user.DisplayName)
        };
        claims.AddRange(user.Roles.Select(r =&gt; new Claim(ClaimTypes.Role, r)));
        var key         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Key));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer:    options.Issuer,
            audience:  options.Audience,
            claims:    claims,
            notBefore: DateTime.UtcNow,
            expires:   DateTime.UtcNow.AddMinutes(options.ExpiryMinutes),
            signingCredentials: credentials);
        return (new JwtSecurityTokenHandler().WriteToken(token), options.ExpiryMinutes * 60);
    }
}
[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly TokenService tokens;
    public AuthController(TokenService tokens) =&gt; this.tokens = tokens;
    [HttpPost("register")]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public IActionResult Register([FromBody] LoginRequest request)
    {
        // BCrypt is deliberately slow. SHA256 is fast, which is exactly wrong here:
        // a GPU tries billions of SHA256 guesses per second.
        string hash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        return Ok(new { stored = hash[..20] + "..." });
    }
    [HttpPost("login")]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public IActionResult Login([FromBody] LoginRequest request)
    {
        User? user = FindUser(request.Email);
        // The SAME message for both failures, so nobody can discover which emails exist
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { error = "Invalid email or password." });
        (string token, int expiresIn) = tokens.Create(user);
        return Ok(new { accessToken = token, tokenType = "Bearer", expiresIn });
    }
    [HttpGet("me")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public IActionResult Me() =&gt; Ok(new
    {
        id    = User.FindFirst("sub")?.Value,        // works because MapInboundClaims is false
        email = User.FindFirst("email")?.Value,
        roles = User.FindAll(ClaimTypes.Role).Select(c =&gt; c.Value)
    });
    private static User? FindUser(string email) =&gt; email == "asha@example.com"
        ? new User { Id = 42, Email = email, DisplayName = "Asha Rao",
                     PasswordHash = BCrypt.Net.BCrypt.HashPassword("Secret123!"),
                     Roles = new List&lt;string&gt; { "Editor" } }
        : null;
}
public record LoginRequest(string Email, string Password);
public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public List&lt;string&gt; Roles { get; set; } = new();
}
</code></pre>
