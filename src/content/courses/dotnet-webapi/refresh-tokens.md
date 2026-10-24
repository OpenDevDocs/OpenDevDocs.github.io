---
publishDate: 2026-09-18T15:00
title: Refresh Tokens
slug: refresh-tokens
metadescription: Give users long sessions without long lived access tokens. Store refresh tokens, rotate them on every use, detect reuse of a stolen token, and revoke on logout.
updateDate: 2026-09-07T15:00
author: ['bishal-biswas']
level: 3
tags: ['jwt', 'refresh-tokens', 'security']
course: dotnet-webapi
---

## The problem

A JWT cannot be revoked. The server does not store it, so once issued it works until it expires.

That leaves you with a bad choice:

- **Long lived tokens**, say seven days. Convenient, and a stolen token gives an attacker a week.
- **Short lived tokens**, say fifteen minutes. Safe, and the user is logged out four times an hour.

**Refresh tokens** give you both. A short lived access token for API calls, plus a long lived refresh token whose only job is to get a new access token.

## How the pair works

```text
Login
  →  access token   (15 minutes, a JWT, sent with every request)
  →  refresh token  (7 days, an opaque random string, stored in the database)

15 minutes later the access token expires
  →  the client posts the refresh token to /auth/refresh
  →  the server checks it in the database
  →  a new access token AND a new refresh token come back

7 days later the refresh token expires
  →  the user logs in again
```

The important difference: the refresh token is **stored on the server**, so it can be checked and revoked. That is what buys back control.

## What a refresh token should be

Not a JWT. A JWT is self describing and unrevocable, which is the opposite of what you want here.

Use a long random string with no meaning:

```csharp
public static string GenerateRefreshToken()
{
    byte[] bytes = RandomNumberGenerator.GetBytes(64);
    return Convert.ToBase64String(bytes);
}
```

`RandomNumberGenerator` is cryptographically secure. Never use `Random` or `Guid.NewGuid()` for a security token, because both are predictable enough to matter.

## Storing it

One row per refresh token, so you can revoke each one individually:

```csharp
public class RefreshToken
{
    public int Id { get; set; }
    public string TokenHash { get; set; } = "";      // store the hash, not the token
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedByIp { get; set; }

    public DateTime? RevokedAt { get; set; }
    public string? ReplacedByTokenHash { get; set; }  // the rotation chain

    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsActive => RevokedAt is null && !IsExpired;
}
```

**Store a hash, not the token itself.** If your database leaks, hashed refresh tokens are useless to an attacker. This is the same reasoning as password hashing, though here a fast hash such as SHA256 is fine, because the token has 64 bytes of entropy and cannot be guessed.

```csharp
private static string Hash(string token) =>
    Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
```

## Rotation

Every refresh issues a **new** refresh token and revokes the old one. The old one is single use.

This matters because it makes theft detectable. Without rotation, a stolen refresh token quietly works for seven days and nobody notices.

```csharp
public async Task<TokenPair> RefreshAsync(string refreshToken, string? ip, CancellationToken ct)
{
    string hash = Hash(refreshToken);

    RefreshToken? stored = await db.RefreshTokens
        .Include(t => t.User)
        .FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

    if (stored is null)
        throw new SecurityException("Invalid refresh token.");

    // Reuse detection, explained below
    if (stored.RevokedAt is not null)
    {
        await RevokeAllForUserAsync(stored.UserId, ct);
        throw new SecurityException("Refresh token reuse detected. All sessions revoked.");
    }

    if (!stored.IsActive)
        throw new SecurityException("Refresh token expired.");

    // Rotate: revoke the old, issue a new one
    string newRefresh = GenerateRefreshToken();
    stored.RevokedAt = DateTime.UtcNow;
    stored.ReplacedByTokenHash = Hash(newRefresh);

    db.RefreshTokens.Add(new RefreshToken
    {
        TokenHash = Hash(newRefresh),
        UserId = stored.UserId,
        ExpiresAt = DateTime.UtcNow.AddDays(7),
        CreatedAt = DateTime.UtcNow,
        CreatedByIp = ip
    });

    await db.SaveChangesAsync(ct);

    return new TokenPair(tokenService.Create(stored.User).Token, newRefresh);
}
```

## Reuse detection

This is the security payoff, and it is worth understanding properly.

With rotation, a refresh token is used exactly once. So if an **already revoked** token is presented, one of two things happened: an attacker stole a token and used it after the real user, or the real user is replaying one the attacker already used.

Either way, someone has a token they should not. The correct response is to revoke **every** refresh token for that user, forcing a fresh login everywhere:

```csharp
if (stored.RevokedAt is not null)
{
    await db.RefreshTokens
        .Where(t => t.UserId == stored.UserId && t.RevokedAt == null)
        .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow), ct);

    logger.LogWarning("Refresh token reuse detected for user {UserId}", stored.UserId);
    throw new SecurityException("Session invalidated for security reasons.");
}
```

Yes, this occasionally logs out an innocent user whose network retried a request. That is the right trade. An unexpected logout is annoying. A silently hijacked account is not.

## The endpoints

```csharp
[HttpPost("login")]
[AllowAnonymous]
public async Task<IActionResult> Login(LoginRequest request, CancellationToken ct)
{
    TokenPair? pair = await auth.LoginAsync(request.Email, request.Password, Ip(), ct);

    if (pair is null)
        return Unauthorized(new { error = "Invalid email or password." });

    SetRefreshCookie(pair.RefreshToken);
    return Ok(new { accessToken = pair.AccessToken, expiresIn = 900 });
}

[HttpPost("refresh")]
[AllowAnonymous]                      // the access token is expired by definition
public async Task<IActionResult> Refresh(CancellationToken ct)
{
    string? refreshToken = Request.Cookies["refreshToken"];

    if (refreshToken is null)
        return Unauthorized(new { error = "No refresh token." });

    TokenPair pair = await auth.RefreshAsync(refreshToken, Ip(), ct);

    SetRefreshCookie(pair.RefreshToken);
    return Ok(new { accessToken = pair.AccessToken, expiresIn = 900 });
}

[HttpPost("logout")]
[Authorize]
public async Task<IActionResult> Logout(CancellationToken ct)
{
    string? refreshToken = Request.Cookies["refreshToken"];

    if (refreshToken is not null)
        await auth.RevokeAsync(refreshToken, ct);

    Response.Cookies.Delete("refreshToken");
    return NoContent();
}
```

`/auth/refresh` must be `[AllowAnonymous]`. The whole point is that the access token has expired.

## Where the refresh token lives

For a browser, an **httpOnly cookie** is the right answer:

```csharp
private void SetRefreshCookie(string token)
{
    Response.Cookies.Append("refreshToken", token, new CookieOptions
    {
        HttpOnly = true,                        // JavaScript cannot read it, so XSS cannot steal it
        Secure = true,                          // HTTPS only
        SameSite = SameSiteMode.Strict,         // not sent on cross site requests, blocking CSRF
        Expires = DateTimeOffset.UtcNow.AddDays(7),
        Path = "/api/auth"                      // sent only to the auth endpoints
    });
}
```

All four options matter. `HttpOnly` blocks XSS theft. `Secure` stops it travelling over HTTP. `SameSite=Strict` blocks CSRF. `Path` means it is not attached to every ordinary API call.

For a mobile app, use the platform's secure storage: Keychain on iOS, EncryptedSharedPreferences on Android.

## What logout actually means

Logging out revokes the refresh token. The **access token still works** until it expires, because nothing can revoke a JWT.

With a fifteen minute lifetime that window is acceptable for most applications. If it is not, you need a revocation list checked on every request, which means a cache lookup per call and gives up the main benefit of stateless tokens. Redis makes it cheap if you genuinely need it:

```csharp
// On logout, store the token's jti until it would have expired anyway
await cache.SetStringAsync($"revoked:{jti}", "1",
    new DistributedCacheEntryOptions { AbsoluteExpiration = tokenExpiry });
```

Most APIs should not do this. Shorten the access token lifetime instead.

## Cleaning up

Expired rows accumulate. Delete them on a schedule:

```csharp
await db.RefreshTokens
    .Where(t => t.ExpiresAt < DateTime.UtcNow.AddDays(-30))
    .ExecuteDeleteAsync(ct);
```

Keep them for a while after expiry so the rotation chain remains useful when investigating an incident.

## Limiting concurrent sessions

Since every session is a row, capping them is easy:

```csharp
const int maxSessions = 5;

List<RefreshToken> active = await db.RefreshTokens
    .Where(t => t.UserId == userId && t.RevokedAt == null && t.ExpiresAt > DateTime.UtcNow)
    .OrderBy(t => t.CreatedAt)
    .ToListAsync(ct);

foreach (RefreshToken old in active.Take(Math.Max(0, active.Count - maxSessions + 1)))
    old.RevokedAt = DateTime.UtcNow;
```

You can also list active sessions for the user, showing device and IP, which is a feature people expect now.

## Quick recap

- A short access token plus a long refresh token gives you both security and a long session.
- The refresh token is stored server side, which is what makes revocation possible.
- Generate it with `RandomNumberGenerator`, never `Random` or `Guid`.
- Store a hash of it, so a database leak does not hand out working tokens.
- Rotate on every refresh: issue a new one and revoke the old.
- If a revoked token is presented, treat it as theft and revoke every session for that user.
- `/auth/refresh` must allow anonymous access, because the access token has expired by then.
- In a browser, keep it in an httpOnly, Secure, SameSite=Strict cookie with a narrow path.
- Logout revokes the refresh token. The access token still works until it expires.
- Delete long expired rows on a schedule, and consider capping concurrent sessions.

<code id="code-content" class="language-csharp">
// Refresh tokens with rotation and reuse detection.
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
public class RefreshToken
{
    public int Id { get; set; }
    public string TokenHash { get; set; } = "";       // never the raw token
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedByIp { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? ReplacedByTokenHash { get; set; }  // the rotation chain, useful in an incident
    public bool IsExpired =&gt; DateTime.UtcNow &gt;= ExpiresAt;
    public bool IsActive  =&gt; RevokedAt is null &amp;&amp; !IsExpired;
}
public record TokenPair(string AccessToken, string RefreshToken, int ExpiresIn);
public class AuthService
{
    private const int RefreshDays = 7;
    private const int MaxSessions = 5;
    private readonly AppDbContext db;
    private readonly TokenService tokens;
    private readonly ILogger&lt;AuthService&gt; logger;
    public AuthService(AppDbContext db, TokenService tokens, ILogger&lt;AuthService&gt; logger)
        =&gt; (this.db, this.tokens, this.logger) = (db, tokens, logger);
    public async Task&lt;TokenPair?&gt; LoginAsync(string email, string password, string? ip, CancellationToken ct)
    {
        User? user = await db.Users.FirstOrDefaultAsync(u =&gt; u.Email == email, ct);
        if (user is null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return null;                        // one message for both, so emails stay private
        await EnforceSessionLimitAsync(user.Id, ct);
        string refresh = await IssueRefreshTokenAsync(user.Id, ip, ct);
        await db.SaveChangesAsync(ct);
        return new TokenPair(tokens.Create(user), refresh, 900);
    }
    public async Task&lt;TokenPair&gt; RefreshAsync(string refreshToken, string? ip, CancellationToken ct)
    {
        string hash = Hash(refreshToken);
        RefreshToken? stored = await db.RefreshTokens
            .Include(t =&gt; t.User)
            .FirstOrDefaultAsync(t =&gt; t.TokenHash == hash, ct);
        if (stored is null)
            throw new UnauthorizedAccessException("Invalid refresh token.");
        // REUSE DETECTION. With rotation a token is used exactly once, so seeing a
        // revoked one means someone has a token they should not. Kill every session.
        // This occasionally logs out an innocent user. That is the right trade.
        if (stored.RevokedAt is not null)
        {
            logger.LogWarning("Refresh token reuse detected for user {UserId} from {Ip}", stored.UserId, ip);
            await db.RefreshTokens
                .Where(t =&gt; t.UserId == stored.UserId &amp;&amp; t.RevokedAt == null)
                .ExecuteUpdateAsync(s =&gt; s.SetProperty(t =&gt; t.RevokedAt, DateTime.UtcNow), ct);
            throw new UnauthorizedAccessException("Session invalidated for security reasons.");
        }
        if (!stored.IsActive)
            throw new UnauthorizedAccessException("Refresh token expired.");
        // ROTATE: the old one dies, a new one is born
        string newRefresh = await IssueRefreshTokenAsync(stored.UserId, ip, ct);
        stored.RevokedAt = DateTime.UtcNow;
        stored.ReplacedByTokenHash = Hash(newRefresh);
        await db.SaveChangesAsync(ct);
        return new TokenPair(tokens.Create(stored.User), newRefresh, 900);
    }
    public async Task RevokeAsync(string refreshToken, CancellationToken ct)
    {
        string hash = Hash(refreshToken);
        await db.RefreshTokens
            .Where(t =&gt; t.TokenHash == hash &amp;&amp; t.RevokedAt == null)
            .ExecuteUpdateAsync(s =&gt; s.SetProperty(t =&gt; t.RevokedAt, DateTime.UtcNow), ct);
    }
    private async Task&lt;string&gt; IssueRefreshTokenAsync(int userId, string? ip, CancellationToken ct)
    {
        // 64 cryptographically random bytes. NEVER Random or Guid.NewGuid() here.
        string token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        db.RefreshTokens.Add(new RefreshToken
        {
            TokenHash   = Hash(token),          // a leaked database hands out nothing usable
            UserId      = userId,
            ExpiresAt   = DateTime.UtcNow.AddDays(RefreshDays),
            CreatedAt   = DateTime.UtcNow,
            CreatedByIp = ip
        });
        await Task.CompletedTask;
        return token;                            // the raw token is returned exactly once
    }
    private async Task EnforceSessionLimitAsync(int userId, CancellationToken ct)
    {
        List&lt;RefreshToken&gt; active = await db.RefreshTokens
            .Where(t =&gt; t.UserId == userId &amp;&amp; t.RevokedAt == null &amp;&amp; t.ExpiresAt &gt; DateTime.UtcNow)
            .OrderBy(t =&gt; t.CreatedAt).ToListAsync(ct);
        foreach (RefreshToken old in active.Take(Math.Max(0, active.Count - MaxSessions + 1)))
            old.RevokedAt = DateTime.UtcNow;
    }
    // SHA256 is fine here: 64 random bytes cannot be brute forced, unlike a password
    private static string Hash(string token) =&gt;
        Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AuthService auth;
    public AuthController(AuthService auth) =&gt; this.auth = auth;
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task&lt;IActionResult&gt; Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        TokenPair? pair = await auth.LoginAsync(request.Email, request.Password, Ip(), ct);
        if (pair is null) return Unauthorized(new { error = "Invalid email or password." });
        SetRefreshCookie(pair.RefreshToken);
        return Ok(new { accessToken = pair.AccessToken, tokenType = "Bearer", expiresIn = pair.ExpiresIn });
    }
    // Must allow anonymous: by the time this is called the access token has expired
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task&lt;IActionResult&gt; Refresh(CancellationToken ct)
    {
        string? refreshToken = Request.Cookies["refreshToken"];
        if (refreshToken is null) return Unauthorized(new { error = "No refresh token." });
        try
        {
            TokenPair pair = await auth.RefreshAsync(refreshToken, Ip(), ct);
            SetRefreshCookie(pair.RefreshToken);
            return Ok(new { accessToken = pair.AccessToken, expiresIn = pair.ExpiresIn });
        }
        catch (UnauthorizedAccessException ex)
        {
            Response.Cookies.Delete("refreshToken");
            return Unauthorized(new { error = ex.Message });
        }
    }
    // Revokes the refresh token. The access token still works until it expires,
    // because nothing can revoke a JWT. That is why it is only 15 minutes long.
    [HttpPost("logout")]
    [Authorize]
    public async Task&lt;IActionResult&gt; Logout(CancellationToken ct)
    {
        if (Request.Cookies["refreshToken"] is string token)
            await auth.RevokeAsync(token, ct);
        Response.Cookies.Delete("refreshToken");
        return NoContent();
    }
    private string? Ip() =&gt; HttpContext.Connection.RemoteIpAddress?.ToString();
    private void SetRefreshCookie(string token) =&gt;
        Response.Cookies.Append("refreshToken", token, new CookieOptions
        {
            HttpOnly = true,                    // XSS cannot read it
            Secure   = true,                    // HTTPS only
            SameSite = SameSiteMode.Strict,     // blocks CSRF
            Expires  = DateTimeOffset.UtcNow.AddDays(7),
            Path     = "/api/auth"              // not attached to every ordinary API call
        });
}
public record LoginRequest(string Email, string Password);
public class User { public int Id { get; set; } public string Email { get; set; } = "";
                    public string PasswordHash { get; set; } = ""; }
public class TokenService { public string Create(User user) =&gt; "a.jwt.here"; }
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;User&gt; Users =&gt; Set&lt;User&gt;();
    public DbSet&lt;RefreshToken&gt; RefreshTokens =&gt; Set&lt;RefreshToken&gt;();
}
</code></pre>
