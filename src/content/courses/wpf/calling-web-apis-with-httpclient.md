---
publishDate: 2026-10-25T20:52
title: 'Calling Web APIs with HttpClient'
slug: calling-web-apis-with-httpclient
metadescription: 'Call a JSON web API from a WPF app with HttpClient, IHttpClientFactory and AddHttpClient, read responses with System.Net.Http.Json, and handle timeouts, errors and cancellation.'
updateDate: 2026-10-25T20:52
author: ['bishal-biswas']
level: 3
tags: ['wpf', 'httpclient', 'web-api', 'json']
course: wpf
---

## What we are building

CoinJar users travel. They pay for a taxi in euros and want to know what that is in their own currency. A **web API** can tell us: it is a web address that returns data (usually JSON) instead of a web page.

In this lesson CoinJar gets a small currency converter. It asks a public exchange rate API for today's rates and converts an amount. Along the way you learn the right way to use `HttpClient` in a desktop app.

> **About the example API.** This lesson uses the free Frankfurter API, `https://api.frankfurter.dev/v1/`, as an **example only**. It needs no key and returns simple JSON. Public APIs change their addresses and rules over time, so check its documentation before you rely on it, and feel free to swap in any rates API that returns a similar shape.

A request to the example API looks like this:

```text
GET https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP
```

And the answer is JSON like this (the numbers change every day):

```json
{
  "amount": 1.0,
  "base": "USD",
  "date": "2026-10-23",
  "rates": {
    "EUR": 0.89342,
    "GBP": 0.74804
  }
}
```

## HttpClient in one minute

`HttpClient` is the .NET class for sending HTTP requests. The quickest possible call:

```csharp
using var client = new HttpClient();
string json = await client.GetStringAsync(
    "https://api.frankfurter.dev/v1/latest?base=USD");
```

It works, and it is fine for a quick experiment. But it hides two problems that matter in a real app:

1. **Creating a new `HttpClient` for every call is wasteful.** Each one opens its own network connections, and disposed clients leave closed connections hanging around for a while. Do it in a loop and the PC can run out of free connections (**socket exhaustion**).
2. **Keeping one `HttpClient` forever has its own issue.** It never notices when the server's address (DNS) changes.

The fix for both is `IHttpClientFactory`. It keeps a pool of the expensive network parts underneath, reuses them, and refreshes them every few minutes. You ask it for clients and never worry about the lifetime.

## Set up the factory in the host

`AddHttpClient` lives in the `Microsoft.Extensions.Http` package:

```bash
dotnet add package Microsoft.Extensions.Http
```

Now register a **typed client**. That is your own service class that receives a ready configured `HttpClient` in its constructor. In `App.xaml.cs`, where you build the host:

```csharp
builder.Services.AddHttpClient<IExchangeRateService, ExchangeRateService>(client =>
{
    // EXAMPLE API: replace with the rates API you choose
    client.BaseAddress = new Uri("https://api.frankfurter.dev/v1/");
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("CoinJar/1.0");
});
```

This does three things:

- registers `IExchangeRateService` with `ExchangeRateService` as its implementation
- gives every `ExchangeRateService` an `HttpClient` made by the factory
- applies your settings (base address, timeout, headers) to that client

`BaseAddress` should end with a slash. Then a relative path like `"latest?base=USD"` is added after it. Without the slash, the last part of the base address gets replaced, a classic source of confusing 404 errors.

You learned about registering services in [Dependency Injection with the Generic Host](/courses/wpf/dependency-injection-with-the-generic-host). In a later lesson, [App Settings and Configuration](/courses/wpf/app-settings-and-configuration), you will move the URL out of code and into `appsettings.json`.

## A model for the response

Describe the JSON with a C# type. A [record](/courses/c-sharp/records) is perfect for data that you only read:

```csharp
namespace CoinJar.Models;

public record ExchangeRates(
    decimal Amount,
    string Base,
    DateOnly Date,
    Dictionary<string, decimal> Rates);
```

The JSON names are lower case (`base`, `rates`) and the C# names are Pascal case (`Base`, `Rates`). That is fine, as you will see next. The `rates` object has a key per currency, so a `Dictionary<string, decimal>` matches it well. `DateOnly` reads the `"2026-10-23"` text as a date without a time.

## Reading JSON with System.Net.Http.Json

The `System.Net.Http.Json` namespace adds extension methods to `HttpClient` that send the request **and** turn the JSON into your type in one step. It is part of .NET, nothing to install.

```csharp
using System.Net.Http.Json;

ExchangeRates? rates = await _http.GetFromJsonAsync<ExchangeRates>(
    "latest?base=USD", token);
```

These methods use the "web" JSON settings, which match property names without caring about upper or lower case. That is why `base` fills `Base` without any attributes.

The family includes:

```csharp
await http.GetFromJsonAsync<T>(url);              // GET, read JSON into T
await http.PostAsJsonAsync(url, body);            // POST, send body as JSON
await http.PutAsJsonAsync(url, body);             // PUT, send body as JSON
await response.Content.ReadFromJsonAsync<T>();    // read JSON from any response
```

`GetFromJsonAsync` throws an `HttpRequestException` if the server answers with an error status such as 404 or 500. When you want to look at the status yourself, get the response first:

```csharp
using HttpResponseMessage response = await _http.GetAsync("latest?base=USD", token);

if (response.StatusCode == HttpStatusCode.NotFound)
{
    return null;
}

response.EnsureSuccessStatusCode();   // throws for any other error status
var rates = await response.Content.ReadFromJsonAsync<ExchangeRates>(token);
```

## The service

Here is the core of `ExchangeRateService`. The full version, with a small cache, is in the code panel.

```csharp
public class ExchangeRateService : IExchangeRateService
{
    private readonly HttpClient _http;

    // The factory creates and configures this HttpClient for us.
    public ExchangeRateService(HttpClient http)
    {
        _http = http;
    }

    public async Task<ExchangeRates> GetLatestAsync(string baseCurrency, CancellationToken token = default)
    {
        string url = $"latest?base={Uri.EscapeDataString(baseCurrency)}";
        ExchangeRates? rates = await _http.GetFromJsonAsync<ExchangeRates>(url, token);
        return rates ?? throw new InvalidOperationException("The rates API returned no data.");
    }
}
```

`Uri.EscapeDataString` makes the value safe to put in a URL. It matters as soon as values come from user input.

## Using it from a view model

The view model asks for `IExchangeRateService` in its constructor and calls it from an async command, exactly like the commands in [Async, Await and a Responsive UI](/courses/wpf/async-await-and-a-responsive-ui):

```csharp
[RelayCommand]
private async Task ConvertAsync(CancellationToken token)
{
    try
    {
        ExchangeRates rates = await _rates.GetLatestAsync(FromCurrency, token);

        if (rates.Rates.TryGetValue(ToCurrency, out decimal rate))
        {
            Result = $"{Amount:N2} {FromCurrency} = {Amount * rate:N2} {ToCurrency}";
        }
        else
        {
            Result = $"No rate for {ToCurrency}";
        }
    }
    catch (HttpRequestException)
    {
        Result = "Could not reach the rates service. Check your connection.";
    }
    catch (TaskCanceledException) when (!token.IsCancellationRequested)
    {
        Result = "The rates service took too long to answer.";
    }
}
```

While the request is on its way, the UI stays responsive and the command's button is disabled.

## Things that go wrong on the network

Network calls fail far more often than file reads. A laptop goes offline, a café Wi-Fi needs a login, a server is down. Plan for these:

```text
HttpRequestException    no connection, DNS failure, or an error status code
TaskCanceledException   the Timeout passed, or your token was cancelled
JsonException           the body was not the JSON you expected
```

Notice the `when` filter in the view model. A timeout and a user cancel both throw `TaskCanceledException`. If your own token was not cancelled, it must have been the timeout. Read more about filters in [exception handling](/courses/c-sharp/exception-handling).

Good habits:

- **Always set a timeout** that suits the call. The default is 100 seconds, far too long for a user staring at a button.
- **Show a friendly message**, never a raw exception, and keep the app usable without the network.
- **Cache results** that do not change often. Exchange rates change once a day, so the service in the panel keeps them for an hour.
- **Pass the cancellation token** so users can leave the screen without waiting.

For automatic retries, Microsoft offers the `Microsoft.Extensions.Http.Resilience` package, which plugs into `AddHttpClient` with one extra call. For a simple app, a friendly error and a Retry button are usually enough.

## Named clients

A typed client is the cleanest choice when one service talks to one API. You may also meet **named clients**, where you register settings under a name and ask the factory directly:

```csharp
builder.Services.AddHttpClient("rates", client =>
{
    client.BaseAddress = new Uri("https://api.frankfurter.dev/v1/"); // example API
});
```

```csharp
public class RatesChecker(IHttpClientFactory factory)
{
    public async Task<string> PingAsync()
    {
        HttpClient http = factory.CreateClient("rates");
        return await http.GetStringAsync("latest");
    }
}
```

Clients from `CreateClient` are cheap. Create one per use and do not dispose it yourself.

## Keeping API keys safe

Many APIs need a key. A desktop app runs on the user's PC, so **anything you ship inside it can be read** by a curious user, even if you hide it in code. Never put a paid or secret key in a WPF app. If an API needs a secret, put a small server of your own in between, like the one you build in the [Web API course](/courses/dotnet-webapi/calling-other-apis-with-httpclient), and let the app call that.

## Common mistakes

- **`new HttpClient()` in a `using` for every call.** Use `AddHttpClient` and let the factory manage connections.
- **No trailing slash on `BaseAddress`.** `https://api.example.com/v1` plus `latest` becomes `https://api.example.com/latest`.
- **Blocking with `.Result`.** It freezes or deadlocks the UI. Await the call.
- **No error handling.** The network is unreliable. Catch `HttpRequestException` and timeouts and show a message.
- **Building URLs from user input without escaping.** Use `Uri.EscapeDataString`.
- **Shipping secrets in the app.** Anything in the exe can be found.

## Quick recap

- A web API returns data, usually JSON, from a URL.
- Do not create and dispose an `HttpClient` per call. Use `IHttpClientFactory` through `AddHttpClient`, from the `Microsoft.Extensions.Http` package.
- A typed client is your own service that receives a configured `HttpClient`. Set `BaseAddress` (with a trailing slash), `Timeout` and headers at registration.
- `System.Net.Http.Json` gives you `GetFromJsonAsync`, `PostAsJsonAsync` and `ReadFromJsonAsync`, with case insensitive web JSON settings.
- Expect failures: catch `HttpRequestException` and timeouts, show friendly messages, cache slow changing data and pass cancellation tokens.
- The Frankfurter URL here is an example. Check any public API's documentation before relying on it, and never ship secret keys in a desktop app.

<code id="code-content" class="language-csharp">
// Services/ExchangeRateService.cs
using System.Net.Http;
using System.Net.Http.Json;
using CoinJar.Models;
namespace CoinJar.Services;
public interface IExchangeRateService
{
    Task&lt;ExchangeRates&gt; GetLatestAsync(string baseCurrency, CancellationToken token = default);
}
// A typed client: the factory hands it a configured HttpClient.
public class ExchangeRateService : IExchangeRateService
{
    private static readonly TimeSpan CacheTime = TimeSpan.FromHours(1);
    private readonly HttpClient _http;
    // Very small cache: rates only change about once a day.
    private ExchangeRates? _cached;
    private DateTime _cachedAt;
    public ExchangeRateService(HttpClient http)
    {
        _http = http;
    }
    public async Task&lt;ExchangeRates&gt; GetLatestAsync(string baseCurrency, CancellationToken token = default)
    {
        if (_cached is not null
            &amp;&amp; _cached.Base == baseCurrency
            &amp;&amp; DateTime.UtcNow - _cachedAt &lt; CacheTime)
        {
            return _cached;
        }
        // Relative to BaseAddress. Escape anything that could come from the user.
        string url = $"latest?base={Uri.EscapeDataString(baseCurrency)}";
        // Sends GET and reads the JSON body into ExchangeRates.
        // Throws HttpRequestException for error status codes.
        ExchangeRates? rates = await _http.GetFromJsonAsync&lt;ExchangeRates&gt;(url, token);
        _cached = rates ?? throw new InvalidOperationException("The rates API returned no data.");
        _cachedAt = DateTime.UtcNow;
        return _cached;
    }
}
// Models/ExchangeRates.cs
namespace CoinJar.Models;
// Matches JSON like {"amount":1.0,"base":"USD","date":"2026-10-23","rates":{"EUR":0.89}}
// Names are matched case insensitively, so "base" fills Base.
public record ExchangeRates(
    decimal Amount,
    string Base,
    DateOnly Date,
    Dictionary&lt;string, decimal&gt; Rates);
// ViewModels/CurrencyViewModel.cs
using System.Net.Http;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CoinJar.Models;
using CoinJar.Services;
namespace CoinJar.ViewModels;
public partial class CurrencyViewModel : ObservableObject
{
    private readonly IExchangeRateService _rates;
    public CurrencyViewModel(IExchangeRateService rates)
    {
        _rates = rates;
    }
    public string[] Currencies { get; } = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD"];
    [ObservableProperty]
    public partial decimal Amount { get; set; } = 10m;
    [ObservableProperty]
    public partial string FromCurrency { get; set; } = "EUR";
    [ObservableProperty]
    public partial string ToCurrency { get; set; } = "USD";
    [ObservableProperty]
    public partial string Result { get; set; } = "";
    // ConvertCommand + ConvertCancelCommand. Disabled while running.
    [RelayCommand(IncludeCancelCommand = true)]
    private async Task ConvertAsync(CancellationToken token)
    {
        Result = "Fetching rates...";
        try
        {
            if (FromCurrency == ToCurrency)
            {
                Result = $"{Amount:N2} {FromCurrency}";
                return;
            }
            ExchangeRates rates = await _rates.GetLatestAsync(FromCurrency, token);
            Result = rates.Rates.TryGetValue(ToCurrency, out decimal rate)
                ? $"{Amount:N2} {FromCurrency} = {Amount * rate:N2} {ToCurrency} (rates of {rates.Date})"
                : $"No rate for {ToCurrency}";
        }
        catch (HttpRequestException)
        {
            Result = "Could not reach the rates service. Check your connection.";
        }
        catch (TaskCanceledException) when (!token.IsCancellationRequested)
        {
            Result = "The rates service took too long to answer.";
        }
        catch (OperationCanceledException)
        {
            Result = "Cancelled";
        }
        catch (System.Text.Json.JsonException)
        {
            Result = "The rates service sent data we did not understand.";
        }
    }
}
// In the App constructor (App.xaml.cs), before builder.Build():
// builder.Services.AddHttpClient&lt;IExchangeRateService, ExchangeRateService&gt;(client =&gt;
// {
//     client.BaseAddress = new Uri("https://api.frankfurter.dev/v1/"); // EXAMPLE API, check its docs
//     client.Timeout = TimeSpan.FromSeconds(10);
//     client.DefaultRequestHeaders.UserAgent.ParseAdd("CoinJar/1.0");
// });
// builder.Services.AddTransient&lt;CurrencyViewModel&gt;();
</code></pre>
