---
publishDate: 2026-09-29T18:50
title: Publishing and Hosting
slug: publishing-and-hosting
metadescription: Publish a Web API for production, understand framework dependent versus self contained builds, configure Kestrel behind a reverse proxy, and run it as a service.
updateDate: 2026-09-07T18:50
author: ['bishal-biswas']
level: 3
tags: ['deployment', 'publishing', 'kestrel']
course: dotnet-webapi
---

## Publishing

`dotnet run` is for development. It rebuilds, watches files and runs in Debug. For production you publish:

```bash
dotnet publish -c Release -o ./publish
```

That produces the compiled DLLs, `appsettings.json`, and a runtime config, all in one folder. Run it with:

```bash
cd publish
dotnet BookStore.Api.dll
```

`-c Release` matters. A Debug build has optimizations off and extra checks on, and it is noticeably slower.

## Framework dependent or self contained

The choice that decides what you deploy.

**Framework dependent** is the default. The output is small, around 1 to 5 MB, and the target machine must have the matching .NET runtime installed:

```bash
dotnet publish -c Release
```

Right for Docker with a `dotnet/aspnet` base image, and for any server you control where the runtime is managed.

**Self contained** bundles the runtime, producing 60 to 80 MB but needing nothing installed:

```bash
dotnet publish -c Release -r linux-x64 --self-contained true
```

Right when you cannot control what is installed, or when you need a specific runtime version regardless of the host.

`-r` is the runtime identifier: `linux-x64`, `linux-musl-x64` for Alpine, `win-x64`, `osx-arm64`.

## Trimming and single file

Self contained builds can be shrunk:

```bash
dotnet publish -c Release -r linux-x64 --self-contained true \
  -p:PublishTrimmed=true \
  -p:PublishSingleFile=true
```

Trimming removes unused code and can cut the size substantially. **Be careful with it in an API.** Trimming analyses what your code references statically, and anything resolved by reflection can be removed. EF Core, JSON serialization and DI all use reflection in places. A trimmed API can build fine and throw at runtime.

If you trim, test the published output thoroughly. For most APIs the size saving is not worth the risk.

**ReadyToRun** is safer and usually more useful. It precompiles to native code so startup is faster:

```bash
dotnet publish -c Release -r linux-x64 -p:PublishReadyToRun=true
```

Startup time matters when a container scales up under load.

## Kestrel and the reverse proxy

**Kestrel** is the web server built into ASP.NET Core. It is fast and it can serve the internet directly.

Most production deployments still put a **reverse proxy** in front of it: nginx, IIS, Apache, or a cloud load balancer. Not because Kestrel is inadequate, but because a proxy adds things you would otherwise build:

- TLS termination and certificate management
- Serving static files efficiently
- Request buffering, which protects against slow clients
- Load balancing across instances
- Rate limiting and a web application firewall

If you deploy to a platform such as Azure App Service, Cloud Run or a Kubernetes ingress, this is already handled.

## Forwarded headers

Behind a proxy, every request appears to come from the proxy. `RemoteIpAddress` is the proxy's IP and the scheme looks like HTTP even when the client used HTTPS.

That breaks IP based rate limiting, IP logging and any redirect you generate.

```csharp
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

    options.KnownProxies.Add(IPAddress.Parse("10.0.0.1"));
    // or
    options.KnownNetworks.Add(new IPNetwork(IPAddress.Parse("10.0.0.0"), 8));
});

var app = builder.Build();

app.UseForwardedHeaders();      // first, before anything reads the IP or scheme
```

**Set `KnownProxies` or `KnownNetworks`.** Trusting `X-Forwarded-For` from any source lets a client claim any IP it likes, which defeats IP based rate limiting entirely.

## Configuring the ports

`launchSettings.json` is **not** deployed. In production, set the URLs another way:

```bash
export ASPNETCORE_URLS="http://+:8080"
dotnet BookStore.Api.dll
```

Or in `appsettings.Production.json`:

```json
{
  "Kestrel": {
    "Endpoints": {
      "Http": { "Url": "http://+:8080" }
    }
  }
}
```

Behind a proxy, bind to HTTP only and let the proxy handle TLS. Binding both and enabling `UseHttpsRedirection` inside the container causes redirect loops, which is a classic first deployment problem.

## Production Kestrel limits

Defaults are generous. Tighten them:

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;

    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024;
    options.Limits.MaxConcurrentConnections = 1000;
    options.Limits.MaxRequestHeadersTotalSize = 32 * 1024;
    options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(30);
    options.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(2);

    // Disconnect clients sending data absurdly slowly
    options.Limits.MinRequestBodyDataRate =
        new MinDataRate(bytesPerSecond: 100, gracePeriod: TimeSpan.FromSeconds(10));
});
```

## Environment variables

Production configuration arrives as environment variables. Remember the double underscore for nested keys:

```bash
export ASPNETCORE_ENVIRONMENT=Production
export ASPNETCORE_URLS="http://+:8080"
export ConnectionStrings__Default="Server=prod-db;Database=Shop;..."
export Jwt__Key="the-production-signing-key"
export Serilog__MinimumLevel__Default="Warning"
```

A single colon works on Windows only. The double underscore works everywhere.

## Running as a service on Linux

Create a systemd unit at `/etc/systemd/system/bookstore-api.service`:

```text
[Unit]
Description=BookStore API
After=network.target

[Service]
WorkingDirectory=/var/www/bookstore
ExecStart=/usr/bin/dotnet /var/www/bookstore/BookStore.Api.dll
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=bookstore-api
User=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://localhost:5000
Environment=DOTNET_PRINT_TELEMETRY_MESSAGE=false

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable bookstore-api
sudo systemctl start bookstore-api
sudo systemctl status bookstore-api
sudo journalctl -u bookstore-api -f
```

`KillSignal=SIGINT` matters. It lets ASP.NET Core shut down gracefully, draining in flight requests, instead of being killed outright.

Run as a non root user. `User=www-data` limits the damage if the process is compromised.

## An nginx reverse proxy

```text
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    location / {
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection keep-alive;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

The `Upgrade` and `Connection` headers are needed for SignalR and WebSockets. Without them, WebSocket connections silently fall back to long polling.

## Graceful shutdown

When a deployment stops your app, in flight requests should finish:

```csharp
builder.Services.Configure<HostOptions>(options =>
{
    options.ShutdownTimeout = TimeSpan.FromSeconds(30);
});
```

The sequence is: the host stops accepting new requests, waits for in flight ones, then stops hosted services. Combined with a readiness probe that starts failing, and a load balancer that drains, a deploy drops no requests.

## A pre deployment checklist

- `-c Release`, never Debug.
- `ASPNETCORE_ENVIRONMENT=Production`.
- Secrets in environment variables or a vault, not in `appsettings.json`.
- Swagger and the developer exception page disabled or protected.
- Forwarded headers configured with known proxies.
- Health endpoints wired to the load balancer.
- Logs going somewhere you can search.
- Migrations applied by a script or a pipeline step, not at startup.
- Kestrel limits set and the `Server` header removed.
- Graceful shutdown timeout raised.

## Quick recap

- `dotnet publish -c Release` produces the deployable output. Never ship a Debug build.
- Framework dependent is small and needs the runtime installed. Self contained bundles it.
- ReadyToRun speeds up startup safely. Trimming can break reflection based code, so test it.
- Kestrel can face the internet, but a reverse proxy adds TLS, buffering and load balancing.
- Configure forwarded headers with known proxies, or IP based logic is meaningless and spoofable.
- `launchSettings.json` is not deployed. Use `ASPNETCORE_URLS` or Kestrel configuration.
- Behind a proxy, bind HTTP only and let the proxy terminate TLS.
- Nested configuration keys use a double underscore in environment variables.
- On Linux, use systemd with `KillSignal=SIGINT` and a non root user.
- Raise the shutdown timeout so deployments drain instead of dropping requests.

<code id="code-content" class="language-csharp">
// Program.cs configured for production hosting behind a reverse proxy.
using System.Net;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Server.Kestrel.Core;
var builder = WebApplication.CreateBuilder(args);
// Defaults are generous. Tighten them before facing real traffic.
builder.WebHost.ConfigureKestrel(options =&gt;
{
    options.AddServerHeader = false;                 // do not advertise the version
    options.Limits.MaxRequestBodySize         = 10 * 1024 * 1024;
    options.Limits.MaxConcurrentConnections   = 1000;
    options.Limits.MaxRequestHeadersTotalSize = 32 * 1024;
    options.Limits.RequestHeadersTimeout      = TimeSpan.FromSeconds(30);
    options.Limits.KeepAliveTimeout           = TimeSpan.FromMinutes(2);
    // Disconnects clients trickling data to hold a connection open
    options.Limits.MinRequestBodyDataRate =
        new MinDataRate(bytesPerSecond: 100, gracePeriod: TimeSpan.FromSeconds(10));
});
// Behind a proxy every request looks like it came from the proxy, over HTTP.
// That breaks IP rate limiting, IP logging and generated redirect URLs.
builder.Services.Configure&lt;ForwardedHeadersOptions&gt;(options =&gt;
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // ESSENTIAL. Trusting X-Forwarded-For from anywhere lets a client claim any
    // IP it likes, which defeats IP based rate limiting entirely.
    options.KnownNetworks.Add(new IPNetwork(IPAddress.Parse("10.0.0.0"), 8));
    options.KnownProxies.Add(IPAddress.Parse("10.0.0.1"));
});
// Give in flight requests time to finish when a deploy stops the app
builder.Services.Configure&lt;HostOptions&gt;(o =&gt; o.ShutdownTimeout = TimeSpan.FromSeconds(30));
builder.Services.AddControllers();
builder.Services.AddHealthChecks();
var app = builder.Build();
app.UseForwardedHeaders();      // FIRST, before anything reads the IP or the scheme
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
    // Behind a proxy that terminates TLS, the proxy already redirected.
    // Enabling this inside a container that only listens on HTTP causes a
    // redirect loop, and it is the classic first deployment failure.
    // app.UseHttpsRedirection();
}
app.MapControllers();
app.MapHealthChecks("/health/live");
app.MapHealthChecks("/health/ready");
app.Logger.LogInformation("Starting in {Environment} on {Urls}",
    app.Environment.EnvironmentName,
    builder.Configuration["ASPNETCORE_URLS"] ?? "the default urls");
app.Run();
/* ---------- Publishing ----------
   Framework dependent, small, needs the runtime on the host:
     dotnet publish -c Release -o ./publish
   Self contained, ~70 MB, needs nothing installed:
     dotnet publish -c Release -r linux-x64 --self-contained true
   Faster startup, safe:
     dotnet publish -c Release -r linux-x64 -p:PublishReadyToRun=true
   Smaller, RISKY for an API: trimming removes code only reached by reflection,
   which EF Core, JSON and DI all use. It builds fine and throws at runtime.
     -p:PublishTrimmed=true
   ---------- Environment variables (double underscore works on every platform) ----------
     ASPNETCORE_ENVIRONMENT=Production
     ASPNETCORE_URLS=http://+:8080
     ConnectionStrings__Default="Server=prod-db;Database=Shop;..."
     Jwt__Key="the-production-signing-key"
   ---------- /etc/systemd/system/bookstore-api.service ----------
   [Unit]
   Description=BookStore API
   After=network.target
   [Service]
   WorkingDirectory=/var/www/bookstore
   ExecStart=/usr/bin/dotnet /var/www/bookstore/BookStore.Api.dll
   Restart=always
   RestartSec=10
   KillSignal=SIGINT          # lets ASP.NET Core drain instead of being killed
   User=www-data              # never root
   Environment=ASPNETCORE_ENVIRONMENT=Production
   Environment=ASPNETCORE_URLS=http://localhost:5000
   [Install]
   WantedBy=multi-user.target
   ---------- nginx ----------
   location / {
       proxy_pass         http://localhost:5000;
       proxy_http_version 1.1;
       proxy_set_header   Upgrade $http_upgrade;      # required for SignalR
       proxy_set_header   Connection keep-alive;
       proxy_set_header   Host $host;
       proxy_set_header   X-Real-IP $remote_addr;
       proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header   X-Forwarded-Proto $scheme;
   }
*/
</code></pre>
