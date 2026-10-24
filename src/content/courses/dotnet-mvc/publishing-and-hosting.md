---
publishDate: 2026-08-29T15:30
title: Publishing and Hosting
slug: publishing-and-hosting
metadescription: Turn your project into a deployable package with dotnet publish, choose between framework dependent and self contained output, host on IIS, Linux with Kestrel behind Nginx, or in a Docker container, and prepare production settings such as data protection keys and health checks.
updateDate: 2026-09-14T15:30
author: ['bishal-biswas']
level: 3
tags: ['publishing', 'hosting', 'deployment']
course: dotnet-mvc
---

## From project to package

`dotnet run` compiles and starts the app on your machine. A server needs something different: a folder of compiled files it can start without the source code or the SDK. **Publishing** creates that folder.

```bash
dotnet publish -c Release -o ./publish
```

`-c Release` turns on optimisations and turns off debug helpers. `-o` picks the output folder. Inside you get the compiled DLLs, `wwwroot`, `appsettings.json` and a `web.config` for IIS. Copy that folder to a server and the app runs.

## Framework dependent or self contained

By default the output needs the .NET runtime installed on the server. That is **framework dependent** and keeps the package small.

A **self contained** publish includes the runtime, so the server needs nothing installed:

```bash
dotnet publish -c Release -r linux-x64 --self-contained -o ./publish
```

`-r` is the runtime identifier: `win-x64`, `linux-x64`, `linux-arm64`, `osx-arm64`. The package is bigger, around 70 MB more, but it does not depend on what the server has. Docker images and servers you do not control favour self contained. Servers you manage with the runtime already installed favour framework dependent.

## How the app is served

Every ASP.NET Core app has **Kestrel** built in. It is a full web server, and in most hosting setups it sits behind a **reverse proxy** that handles TLS certificates, static compression and multiple sites on one machine.

```text
Browser  -->  IIS or Nginx (port 443)  -->  Kestrel (port 5000)  -->  your app
```

The proxy forwards requests, and the app needs to know it is behind one so redirects and `Request.Scheme` are correct:

```csharp
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
});

app.UseForwardedHeaders();
```

`UseForwardedHeaders` goes first in the pipeline. IIS handles this automatically through its module, so the explicit setup matters mainly for Nginx and other proxies.

## Hosting on Windows with IIS

1. Install the **ASP.NET Core Hosting Bundle** on the server. It includes the runtime and the IIS module.
2. Publish the app and copy the folder to the server.
3. In IIS Manager, create a site pointing at that folder. Set the application pool's .NET CLR version to **No Managed Code**, because the app runs on .NET Core, not .NET Framework.
4. Set `ASPNETCORE_ENVIRONMENT` and connection strings as environment variables on the app pool or in the site's configuration editor.

The `web.config` in the publish output tells the IIS module how to start the app. In process hosting, the default, runs the app inside the IIS worker process for the best performance.

## Hosting on Linux

Install the runtime, copy the publish folder, and run the app as a systemd service so it restarts on failure and starts with the machine:

```ini
[Unit]
Description=ShopApp

[Service]
WorkingDirectory=/var/www/shopapp
ExecStart=/usr/bin/dotnet /var/www/shopapp/ShopApp.dll
Restart=always
RestartSec=10
User=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://localhost:5000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable shopapp
sudo systemctl start shopapp
```

Then put Nginx in front:

```nginx
server {
    listen 80;
    server_name shop.example.com;

    location / {
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection keep-alive;
        proxy_set_header   Host $host;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

Add TLS with Let's Encrypt through certbot, which edits this block for you.

## Hosting in Docker

A container packages the app and runtime together. The standard two stage Dockerfile builds in one image and runs in a smaller one:

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish ShopApp/ShopApp.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "ShopApp.dll"]
```

```bash
docker build -t shopapp .
docker run -p 8080:8080 -e ConnectionStrings__Default="..." shopapp
```

The same image runs on your laptop, in Azure Container Apps, on Kubernetes, or anywhere else Docker runs. Settings come in as environment variables.

## Data protection keys

The anti forgery and authentication cookies are encrypted with keys managed by the data protection system. By default those keys live in a local folder or the Windows registry, which means:

- A redeploy or container restart can generate new keys, logging everyone out and breaking in flight forms.
- Two servers have different keys and cannot read each other's cookies.

Store the keys somewhere shared and persistent:

```csharp
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo("/var/shopapp/keys"))
    .SetApplicationName("ShopApp");
```

Or to a database, Redis or Azure Blob Storage with the matching package. This is the most commonly forgotten production step.

## Health checks

Load balancers and container hosts need a URL to ask "are you alive?":

```csharp
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>();

app.MapHealthChecks("/health");
```

`/health` returns 200 when the app and database are fine, 503 otherwise. Point the host's health probe at it.

## Production checklist

- `ASPNETCORE_ENVIRONMENT=Production` set on the server.
- Secrets in environment variables or a vault, not in the published `appsettings.json`.
- HTTPS at the proxy, with `UseHsts` in the app.
- Data protection keys persisted and shared.
- Migrations applied, by the app at startup or by a deployment step.
- Logs going to files or a log server, not just the console.
- A health check endpoint wired to the host's probe.
- `web.config` or systemd configured to restart on failure.

## Quick recap

- `dotnet publish -c Release` creates a folder that runs without source code or the SDK.
- Framework dependent needs the runtime installed. Self contained with `-r` bundles it.
- Kestrel serves the app, usually behind IIS, Nginx or a container host, with `UseForwardedHeaders` for proxies.
- On Windows use the Hosting Bundle and IIS. On Linux use systemd plus Nginx. Anywhere, a two stage Dockerfile.
- Persist data protection keys so cookies survive restarts and work across servers.
- Add a health check endpoint and set production environment variables before going live.

<code id="code-content" class="language-csharp">
// Program.cs: production ready pieces
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt;
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

// Cookies must survive restarts and be readable by every instance
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(builder.Configuration["DataProtection:KeyPath"] ?? "/var/shopapp/keys"))
    .SetApplicationName("ShopApp");

// Behind Nginx or a load balancer
builder.Services.Configure&lt;ForwardedHeadersOptions&gt;(options =&gt;
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddHealthChecks()
    .AddDbContextCheck&lt;AppDbContext&gt;("database");

var app = builder.Build();

app.UseForwardedHeaders();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");

// Apply pending migrations at startup (fine for a single instance)
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService&lt;AppDbContext&gt;().Database.Migrate();
}

app.Run();

// Terminal: publish options
//
//   dotnet publish -c Release -o ./publish                                  (framework dependent)
//   dotnet publish -c Release -r linux-x64 --self-contained -o ./publish    (bundles the runtime)
//   dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true

// Dockerfile
//
//   FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
//   WORKDIR /src
//   COPY . .
//   RUN dotnet publish ShopApp/ShopApp.csproj -c Release -o /app
//
//   FROM mcr.microsoft.com/dotnet/aspnet:8.0
//   WORKDIR /app
//   COPY --from=build /app .
//   ENV ASPNETCORE_URLS=http://+:8080
//   ENV ASPNETCORE_ENVIRONMENT=Production
//   EXPOSE 8080
//   HEALTHCHECK CMD curl -f http://localhost:8080/health || exit 1
//   ENTRYPOINT ["dotnet", "ShopApp.dll"]

// /etc/systemd/system/shopapp.service (Linux)
//
//   [Service]
//   WorkingDirectory=/var/www/shopapp
//   ExecStart=/usr/bin/dotnet /var/www/shopapp/ShopApp.dll
//   Restart=always
//   User=www-data
//   Environment=ASPNETCORE_ENVIRONMENT=Production
//   Environment=ASPNETCORE_URLS=http://localhost:5000
//   Environment=ConnectionStrings__Default=Server=...;Password=...
</code></pre>
