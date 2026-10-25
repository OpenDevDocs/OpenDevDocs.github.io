---
publishDate: 2026-09-25T17:40
title: Calling Other APIs with HttpClient
slug: calling-other-apis-with-httpclient
metadescription: Use IHttpClientFactory to call external APIs without socket exhaustion, build typed clients, add retries and circuit breakers with Polly, and handle failures well.
updateDate: 2026-09-07T17:40
author: ['bishal-biswas']
level: 3
tags: ['httpclient', 'polly', 'resilience']
course: dotnet-webapi
---

## The two ways to get HttpClient wrong

**Creating one per request:**

```csharp
using var client = new HttpClient();          // do not do this
var response = await client.GetAsync(url);
```

`HttpClient` is disposable, so this looks correct. It is not. Disposing it does not release the underlying socket immediately: the connection sits in `TIME_WAIT` for up to four minutes. Under load you run out of ports, and the symptom is `SocketException: Only one usage of each socket address is normally permitted`.

**Using one static instance forever:**

```csharp
private static readonly HttpClient Client = new();     // better, still flawed
```

This fixes socket exhaustion and introduces a subtler problem. The client caches DNS at connection time and never refreshes it. When the service you call changes IP, which happens routinely with cloud load balancers, your calls go to the old address until you restart.

## IHttpClientFactory

The factory solves both. It pools handlers and rotates them on a schedule, so sockets are reused and DNS is refreshed.

```csharp
builder.Services.AddHttpClient();
```

```csharp
public class WeatherService
{
    private readonly IHttpClientFactory factory;

    public WeatherService(IHttpClientFactory factory) => this.factory = factory;

    public async Task<Weather?> GetAsync(string city, CancellationToken ct)
    {
        HttpClient client = factory.CreateClient();
        return await client.GetFromJsonAsync<Weather>($"https://api.example.com/weather/{city}", ct);
    }
}
```

`CreateClient` is cheap. The expensive handler underneath is pooled and shared.

## Named clients

When you call several services, configure each once:

```csharp
builder.Services.AddHttpClient("weather", client =>
{
    client.BaseAddress = new Uri("https://api.weather.example.com/");
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.Add("User-Agent", "BookStore/1.0");
});

builder.Services.AddHttpClient("payments", client =>
{
    client.BaseAddress = new Uri("https://api.payments.example.com/");
    client.Timeout = TimeSpan.FromSeconds(30);
});
```

```csharp
HttpClient client = factory.CreateClient("weather");
```

A typo in the name gives you an unconfigured client with no base address and a confusing error, so use constants.

## Typed clients, the best option

A class that owns its own `HttpClient`. Registration configures it, and the rest of your code sees a normal service:

```csharp
public class WeatherClient
{
    private readonly HttpClient http;
    private readonly ILogger<WeatherClient> logger;

    public WeatherClient(HttpClient http, ILogger<WeatherClient> logger)
    {
        this.http = http;
        this.logger = logger;
    }

    public async Task<Weather?> GetAsync(string city, CancellationToken ct = default)
    {
        HttpResponseMessage response = await http.GetAsync($"weather/{city}", ct);

        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<Weather>(cancellationToken: ct);
    }
}
```

```csharp
builder.Services.AddHttpClient<WeatherClient>(client =>
{
    client.BaseAddress = new Uri("https://api.weather.example.com/");
    client.Timeout = TimeSpan.FromSeconds(10);
});
```

```csharp
public class ForecastService
{
    public ForecastService(WeatherClient weather) { }   // just a service
}
```

The HTTP details stay inside one class, and callers never see `HttpClient`. This is the shape to aim for.

Note the base address needs a trailing slash and the relative URL needs none. `new Uri("https://api.example.com/v1/")` plus `"weather"` gives `/v1/weather`. Drop the trailing slash and you get `/weather`, losing the `v1`.

## The JSON helpers

`System.Net.Http.Json` removes most of the boilerplate:

```csharp
Weather? weather = await http.GetFromJsonAsync<Weather>("weather/london", ct);

HttpResponseMessage response = await http.PostAsJsonAsync("orders", newOrder, ct);
Order? created = await response.Content.ReadFromJsonAsync<Order>(cancellationToken: ct);

await http.PutAsJsonAsync($"orders/{id}", updated, ct);
await http.DeleteAsync($"orders/{id}", ct);
```

One caution on `GetFromJsonAsync`: it throws on a non success status rather than returning null. If a `404` is a normal outcome, use `GetAsync` and check the status yourself, as in the typed client above.

## Handling failures

An external call fails in more ways than your own code:

```csharp
try
{
    HttpResponseMessage response = await http.GetAsync(url, ct);

    if (!response.IsSuccessStatusCode)
    {
        string body = await response.Content.ReadAsStringAsync(ct);
        logger.LogWarning("Weather API returned {Status}: {Body}", response.StatusCode, body);
        return null;
    }

    return await response.Content.ReadFromJsonAsync<Weather>(cancellationToken: ct);
}
catch (TaskCanceledException) when (!ct.IsCancellationRequested)
{
    logger.LogWarning("Weather API timed out");      // a timeout, not a client cancellation
    return null;
}
catch (HttpRequestException ex)
{
    logger.LogError(ex, "Weather API unreachable");
    return null;
}
```

The `when (!ct.IsCancellationRequested)` filter is worth knowing. A timeout and a client cancellation both throw `TaskCanceledException`, and they mean completely different things.

## Resilience with Polly

Transient failures are normal. Retrying them is standard practice, and .NET 8 ships Polly integration:

```bash
dotnet add package Microsoft.Extensions.Http.Resilience
```

```csharp
builder.Services.AddHttpClient<WeatherClient>(client =>
{
    client.BaseAddress = new Uri("https://api.weather.example.com/");
})
.AddStandardResilienceHandler();
```

That one line adds a sensible default stack: retries with exponential backoff and jitter, a circuit breaker, a per attempt timeout and a total timeout.

Customise it when the defaults do not fit:

```csharp
.AddResilienceHandler("weather", pipeline =>
{
    pipeline.AddRetry(new HttpRetryStrategyOptions
    {
        MaxRetryAttempts = 3,
        Delay = TimeSpan.FromSeconds(1),
        BackoffType = DelayBackoffType.Exponential,
        UseJitter = true
    });

    pipeline.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
    {
        FailureRatio = 0.5,
        SamplingDuration = TimeSpan.FromSeconds(30),
        MinimumThroughput = 10,
        BreakDuration = TimeSpan.FromSeconds(15)
    });

    pipeline.AddTimeout(TimeSpan.FromSeconds(5));
});
```

**Retry** handles a blip. Exponential backoff spaces attempts out, and jitter stops every instance retrying at the same instant and creating a thundering herd.

**A circuit breaker** stops calling a service that is clearly down. After enough failures it opens and fails fast for a while, giving the other service room to recover instead of being hammered while it restarts.

**Only retry idempotent requests.** Retrying a `GET` is safe. Retrying a `POST` that already succeeded but whose response was lost creates two orders. Either restrict retries to safe methods or send an idempotency key.

## Timeouts

Set one, always. The default is 100 seconds, which is far too long: one slow dependency will hold your threads and take your API down with it.

```csharp
client.Timeout = TimeSpan.FromSeconds(10);
```

With a resilience pipeline you want two: a short per attempt timeout and a longer total timeout covering all retries.

## Adding headers per request

Authentication and correlation ids usually change per call. A `DelegatingHandler` adds them centrally:

```csharp
public class AuthHeaderHandler : DelegatingHandler
{
    private readonly ITokenService tokens;

    public AuthHeaderHandler(ITokenService tokens) => this.tokens = tokens;

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken ct)
    {
        string token = await tokens.GetAccessTokenAsync(ct);

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        return await base.SendAsync(request, ct);
    }
}
```

```csharp
builder.Services.AddTransient<AuthHeaderHandler>();

builder.Services.AddHttpClient<PaymentClient>()
    .AddHttpMessageHandler<AuthHeaderHandler>();
```

Every request through that client now carries a fresh token, and no calling code has to remember.

Handlers are middleware for outgoing calls. Use them for auth, correlation ids and logging.

## Testing

A typed client is testable because you can hand it an `HttpClient` with a fake handler:

```csharp
public class StubHandler : HttpMessageHandler
{
    private readonly HttpStatusCode status;
    private readonly string body;

    public StubHandler(HttpStatusCode status, string body)
    {
        this.status = status;
        this.body = body;
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken ct)
        => Task.FromResult(new HttpResponseMessage(status)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        });
}
```

```csharp
[Fact]
public async Task Returns_null_when_the_city_is_unknown()
{
    var http = new HttpClient(new StubHandler(HttpStatusCode.NotFound, ""))
    {
        BaseAddress = new Uri("https://test/")
    };

    var client = new WeatherClient(http, NullLogger<WeatherClient>.Instance);

    Assert.Null(await client.GetAsync("nowhere"));
}
```

No network, no mocking framework, milliseconds to run.

## Quick recap

- Never `new HttpClient()` per request. It exhausts sockets.
- A static client fixes that and stops refreshing DNS.
- `IHttpClientFactory` pools handlers and rotates them, solving both.
- Typed clients are the best shape: HTTP details in one class, a plain service everywhere else.
- Base addresses need a trailing slash, relative URLs do not.
- `GetFromJsonAsync` throws on failure, so use `GetAsync` when `404` is a normal outcome.
- Distinguish a timeout from a cancellation with `when (!ct.IsCancellationRequested)`.
- `AddStandardResilienceHandler` gives retries, backoff, jitter, a circuit breaker and timeouts in one line.
- Only retry idempotent requests, or send an idempotency key.
- Always set a timeout. The 100 second default is a liability.
- Use a `DelegatingHandler` for auth headers and correlation ids.
- Test typed clients with a stub `HttpMessageHandler`.

<code id="code-content" class="language-csharp">
// Typed clients with resilience, auth handlers and proper failure handling.
// dotnet add package Microsoft.Extensions.Http.Resilience
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Http.Resilience;
using Polly;
using Polly.Retry;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddTransient&lt;AuthHeaderHandler&gt;();
builder.Services.AddTransient&lt;CorrelationIdHandler&gt;();
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton&lt;ITokenService, TokenService&gt;();
// A typed client. Callers inject WeatherClient and never see HttpClient.
builder.Services.AddHttpClient&lt;WeatherClient&gt;(client =&gt;
{
    // Trailing slash matters: with "/v1/" plus "weather" you get /v1/weather.
    // Without it you get /weather and lose the version segment.
    client.BaseAddress = new Uri("https://api.weather.example.com/v1/");
    client.Timeout     = TimeSpan.FromSeconds(10);   // never leave the 100 second default
    client.DefaultRequestHeaders.Add("User-Agent", "BookStore/1.0");
})
// One line: retries with exponential backoff and jitter, a circuit breaker,
// a per attempt timeout and a total timeout.
.AddStandardResilienceHandler();
// A payments client with hand tuned policies and an auth handler
builder.Services.AddHttpClient&lt;PaymentClient&gt;(client =&gt;
{
    client.BaseAddress = new Uri("https://api.payments.example.com/");
    client.Timeout     = TimeSpan.FromSeconds(30);
})
.AddHttpMessageHandler&lt;AuthHeaderHandler&gt;()        // adds a fresh bearer token per call
.AddHttpMessageHandler&lt;CorrelationIdHandler&gt;()     // passes our correlation id downstream
.AddResilienceHandler("payments", pipeline =&gt;
{
    pipeline.AddRetry(new HttpRetryStrategyOptions
    {
        MaxRetryAttempts = 3,
        Delay            = TimeSpan.FromSeconds(1),
        BackoffType      = DelayBackoffType.Exponential,
        // Jitter stops every instance retrying at the same instant and
        // creating a thundering herd against a recovering service.
        UseJitter        = true
    });
    // Stops hammering a service that is clearly down, giving it room to recover
    pipeline.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
    {
        FailureRatio      = 0.5,
        SamplingDuration  = TimeSpan.FromSeconds(30),
        MinimumThroughput = 10,
        BreakDuration     = TimeSpan.FromSeconds(15)
    });
    pipeline.AddTimeout(TimeSpan.FromSeconds(5));   // per attempt
});
var app = builder.Build();
app.MapGet("/api/weather/{city}", async (string city, WeatherClient weather, CancellationToken ct) =&gt;
    await weather.GetAsync(city, ct) is Weather w ? Results.Ok(w) : Results.NotFound());
app.Run();
public class WeatherClient
{
    private readonly HttpClient http;
    private readonly ILogger&lt;WeatherClient&gt; logger;
    public WeatherClient(HttpClient http, ILogger&lt;WeatherClient&gt; logger)
        =&gt; (this.http, this.logger) = (http, logger);
    public async Task&lt;Weather?&gt; GetAsync(string city, CancellationToken ct = default)
    {
        try
        {
            // GetAsync, not GetFromJsonAsync: a 404 is a normal outcome here,
            // and GetFromJsonAsync would throw instead of returning null.
            HttpResponseMessage response = await http.GetAsync($"weather/{Uri.EscapeDataString(city)}", ct);
            if (response.StatusCode == HttpStatusCode.NotFound) return null;
            if (!response.IsSuccessStatusCode)
            {
                string body = await response.Content.ReadAsStringAsync(ct);
                logger.LogWarning("Weather API returned {Status}: {Body}", response.StatusCode, body);
                return null;
            }
            return await response.Content.ReadFromJsonAsync&lt;Weather&gt;(cancellationToken: ct);
        }
        // A TIMEOUT, not the client giving up. Both throw TaskCanceledException,
        // and this filter is how you tell them apart.
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("Weather API timed out for {City}", city);
            return null;
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "Weather API unreachable");
            return null;
        }
    }
}
public class PaymentClient
{
    private readonly HttpClient http;
    public PaymentClient(HttpClient http) =&gt; this.http = http;
    public async Task&lt;PaymentResult?&gt; ChargeAsync(decimal amount, string idempotencyKey, CancellationToken ct)
    {
        // Retries plus a POST would create duplicate charges. The idempotency key
        // is what makes retrying this safe.
        var request = new HttpRequestMessage(HttpMethod.Post, "charges")
        {
            Content = JsonContent.Create(new { amount, currency = "GBP" })
        };
        request.Headers.Add("Idempotency-Key", idempotencyKey);
        HttpResponseMessage response = await http.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync&lt;PaymentResult&gt;(cancellationToken: ct);
    }
}
// Handlers are middleware for OUTGOING calls. Every request through the client
// gets a fresh token, and no calling code has to remember.
public class AuthHeaderHandler : DelegatingHandler
{
    private readonly ITokenService tokens;
    public AuthHeaderHandler(ITokenService tokens) =&gt; this.tokens = tokens;
    protected override async Task&lt;HttpResponseMessage&gt; SendAsync(
        HttpRequestMessage request, CancellationToken ct)
    {
        request.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", await tokens.GetAccessTokenAsync(ct));
        return await base.SendAsync(request, ct);
    }
}
public class CorrelationIdHandler : DelegatingHandler
{
    private readonly IHttpContextAccessor accessor;
    public CorrelationIdHandler(IHttpContextAccessor accessor) =&gt; this.accessor = accessor;
    protected override Task&lt;HttpResponseMessage&gt; SendAsync(
        HttpRequestMessage request, CancellationToken ct)
    {
        string? id = accessor.HttpContext?.Response.Headers["X-Correlation-Id"];
        if (!string.IsNullOrEmpty(id)) request.Headers.Add("X-Correlation-Id", id);
        return base.SendAsync(request, ct);
    }
}
// A typed client is testable: hand it an HttpClient with a stub handler.
// No network, no mocking framework.
public class StubHandler : HttpMessageHandler
{
    private readonly HttpStatusCode status;
    private readonly string body;
    public StubHandler(HttpStatusCode status, string body = "") =&gt; (this.status, this.body) = (status, body);
    protected override Task&lt;HttpResponseMessage&gt; SendAsync(HttpRequestMessage request, CancellationToken ct)
        =&gt; Task.FromResult(new HttpResponseMessage(status)
        {
            Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json")
        });
}
public record Weather(string City, double TemperatureC, string Summary);
public record PaymentResult(string Id, string Status);
public interface ITokenService { Task&lt;string&gt; GetAccessTokenAsync(CancellationToken ct); }
public class TokenService : ITokenService
{
    public Task&lt;string&gt; GetAccessTokenAsync(CancellationToken ct) =&gt; Task.FromResult("cached.jwt.here");
}
</code></pre>
