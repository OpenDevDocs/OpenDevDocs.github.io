---
publishDate: 2026-09-29T19:00
title: Docker for Web APIs
slug: docker-for-web-apis
metadescription: Containerise an ASP.NET Core Web API with a multi stage Dockerfile, run it alongside a database using Compose, and apply the security and size practices that matter.
updateDate: 2026-09-07T19:00
author: ['bishal-biswas']
level: 4
tags: ['docker', 'containers', 'deployment']
course: dotnet-webapi
---

## Why containers

A container packages your app with everything it needs to run. The same image runs on your laptop, in CI and in production, which removes an entire category of "it works on my machine".

It also makes deployment uniform. Kubernetes, Azure Container Apps, AWS ECS and Cloud Run all take an image and run it.

## A multi stage Dockerfile

The key idea. One stage builds, another runs, and only the second one ships:

```dockerfile
# ---- Build stage ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy only the project files first, so restore is cached
COPY ["BookStore.Api/BookStore.Api.csproj", "BookStore.Api/"]
COPY ["BookStore.Core/BookStore.Core.csproj", "BookStore.Core/"]
RUN dotnet restore "BookStore.Api/BookStore.Api.csproj"

# Now the rest of the source
COPY . .
WORKDIR "/src/BookStore.Api"
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# ---- Runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "BookStore.Api.dll"]
```

The build stage uses the **SDK** image, around 800 MB, containing compilers and tooling. The final stage uses the **aspnet runtime** image, around 220 MB, containing only what is needed to run.

Your shipped image never includes the SDK, your source code, or your git history.

## Layer caching

The two step copy is not stylistic. Docker caches each layer and reuses it when nothing changed.

`.csproj` files change rarely, so `dotnet restore` is cached and skipped on most builds. Source files change constantly, so only the compile step re runs.

Copy everything at once and every source edit re downloads every NuGet package. On a large solution that is minutes per build.

## A .dockerignore

Without one, the build sends your entire folder to Docker, including `bin`, `obj` and `.git`:

```text
**/bin/
**/obj/
**/.vs/
**/.vscode/
**/node_modules/
.git/
.gitignore
**/*.user
**/appsettings.Development.json
**/secrets.json
Dockerfile
docker-compose*.yml
README.md
```

Two benefits. Builds are much faster, and a stale local `bin` cannot leak into the image.

Excluding `appsettings.Development.json` matters. Local settings should never ship.

## Run as a non root user

By default a container runs as root. If someone escapes your app, they are root inside the container, which is a much better starting point for escaping the container.

The .NET 8 images include a `app` user:

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

USER $APP_UID          # the non root user built into the image

EXPOSE 8080
ENTRYPOINT ["dotnet", "BookStore.Api.dll"]
```

Or create one explicitly:

```dockerfile
RUN adduser --disabled-password --gecos "" --uid 1000 appuser \
    && chown -R appuser:appuser /app
USER appuser
```

Note that a non root user cannot bind to ports below 1024, which is why .NET 8 images default to **8080** rather than 80.

## Choosing a base image

| Image | Size | Notes |
|---|---|---|
| `aspnet:8.0` | ~220 MB | Debian. The default, works everywhere. |
| `aspnet:8.0-alpine` | ~110 MB | Alpine with musl libc. Smaller, occasionally incompatible with native libraries. |
| `aspnet:8.0-jammy-chiseled` | ~110 MB | Ubuntu with almost everything removed. No shell, so a much smaller attack surface. |
| `runtime-deps` + self contained | ~90 MB | Smallest, and you manage the runtime yourself. |

**Chiseled** images are the interesting option for production. Fewer packages means fewer CVEs to patch. The trade is that there is no shell, so you cannot `docker exec` into a running container to poke around.

For Alpine, publish with the right runtime identifier:

```dockerfile
RUN dotnet publish -c Release -r linux-musl-x64 --self-contained false -o /app/publish
```

## Never put secrets in an image

```dockerfile
# Every layer is readable by anyone who can pull the image
ENV ConnectionStrings__Default="Server=prod;Password=Secret123"
COPY appsettings.Production.json .
```

Image layers are not encrypted and deleting a file in a later layer does not remove it from the earlier one. `docker history` shows every `ENV`.

Pass secrets at **run** time:

```bash
docker run -e ConnectionStrings__Default="..." -e Jwt__Key="..." bookstore-api
```

Better still, use your platform's secret store: Kubernetes secrets, Azure Key Vault with a managed identity, AWS Secrets Manager.

## Docker Compose

For local development with a database:

```yaml
services:
  api:
    build:
      context: .
      dockerfile: BookStore.Api/Dockerfile
    ports:
      - "8080:8080"
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ASPNETCORE_URLS=http://+:8080
      - ConnectionStrings__Default=Server=db;Database=BookStore;User Id=sa;Password=Your_Strong_Pass123;TrustServerCertificate=True
      - ConnectionStrings__Redis=cache:6379
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_started

  db:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      - ACCEPT_EULA=Y
      - MSSQL_SA_PASSWORD=Your_Strong_Pass123
    ports:
      - "1433:1433"
    volumes:
      - sqldata:/var/opt/mssql
    healthcheck:
      test: ["CMD-SHELL", "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Your_Strong_Pass123 -C -Q 'SELECT 1' || exit 1"]
      interval: 10s
      retries: 10
      start_period: 30s

  cache:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  sqldata:
```

```bash
docker compose up --build
docker compose logs -f api
docker compose down          # add -v to delete the database volume too
```

Two things to notice.

**The connection string uses `Server=db`**, the service name, not `localhost`. Compose gives each service a DNS name on a shared network. Using `localhost` inside a container means the container itself.

**`condition: service_healthy`** with a healthcheck. Plain `depends_on` only waits for the container to **start**, not for SQL Server to finish initialising, which takes far longer. Without the healthcheck your API starts, fails to connect, and crashes.

Even with it, add connection retries in EF Core:

```csharp
options.UseSqlServer(cs, sql => sql.EnableRetryOnFailure());
```

## Health checks in the image

Let the orchestrator know when the container is ready:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health/live || exit 1
```

Chiseled images have no `wget` or shell, so use a Kubernetes probe against your health endpoint instead.

## Building smaller and faster

**Pin the base image version.** `aspnet:8.0` moves. `aspnet:8.0.11-jammy-chiseled` does not, so your builds are reproducible.

**Use build cache mounts** for NuGet:

```dockerfile
RUN --mount=type=cache,target=/root/.nuget/packages \
    dotnet restore "BookStore.Api/BookStore.Api.csproj"
```

**`/p:UseAppHost=false`** skips the native executable, since the entrypoint runs `dotnet BookStore.Api.dll` anyway.

**Build for the right architecture.** On an Apple Silicon machine deploying to x64 servers:

```bash
docker build --platform linux/amd64 -t bookstore-api .
```

Forgetting this produces an image that will not start in production.

## Configuration inside a container

```bash
docker run -d \
  -p 8080:8080 \
  -e ASPNETCORE_ENVIRONMENT=Production \
  -e ASPNETCORE_URLS=http://+:8080 \
  -e ConnectionStrings__Default="Server=prod-db;..." \
  --name bookstore \
  bookstore-api:1.0
```

Bind HTTP only inside the container and let the ingress or load balancer terminate TLS. Enabling `UseHttpsRedirection` in a container listening only on HTTP causes a redirect loop.

## Quick recap

- A multi stage Dockerfile builds with the SDK image and ships only the runtime image.
- Copy `.csproj` files and restore before copying source, so the restore layer is cached.
- Add a `.dockerignore` excluding `bin`, `obj`, `.git` and development settings.
- Run as a non root user. .NET 8 images provide `$APP_UID` and default to port 8080.
- Chiseled images are smaller and have far fewer CVEs, at the cost of having no shell.
- Never bake secrets into an image. Layers are readable and `docker history` shows every `ENV`.
- In Compose, connect to a service by name, not `localhost`.
- Use a healthcheck plus `condition: service_healthy`, and enable EF Core retries anyway.
- Pin base image versions and build for the target architecture.
- Terminate TLS at the ingress and keep the container on HTTP only.

<code id="code-content" class="language-csharp">
// Program.cs adjusted for running in a container, with the Dockerfile below.
using Microsoft.EntityFrameworkCore;
var builder = WebApplication.CreateBuilder(args);
// Inside a container we listen on HTTP only. The ingress or load balancer
// terminates TLS. Enabling UseHttpsRedirection here would cause a redirect loop.
builder.WebHost.ConfigureKestrel(o =&gt; o.AddServerHeader = false);
builder.Services.AddDbContext&lt;AppDbContext&gt;(options =&gt;
    options.UseSqlServer(
        // "Server=db" is the COMPOSE SERVICE NAME, not localhost. Inside a
        // container, localhost is the container itself.
        builder.Configuration.GetConnectionString("Default"),
        // Even with a healthcheck, SQL Server takes a while to accept
        // connections. Retries turn a crash loop into a short delay.
        sql =&gt; sql.EnableRetryOnFailure(maxRetryCount: 5,
                                        maxRetryDelay: TimeSpan.FromSeconds(10),
                                        errorNumbersToAdd: null)));
builder.Services.AddControllers();
builder.Services.AddHealthChecks()
    .AddCheck("self", () =&gt; Microsoft.Extensions.Diagnostics.HealthChecks
        .HealthCheckResult.Healthy(), tags: new[] { "live" })
    .AddDbContextCheck&lt;AppDbContext&gt;("database", tags: new[] { "ready" });
var app = builder.Build();
app.MapControllers();
app.MapHealthChecks("/health/live",
    new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
    { Predicate = c =&gt; c.Tags.Contains("live") });
app.MapHealthChecks("/health/ready",
    new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
    { Predicate = c =&gt; c.Tags.Contains("ready") });
app.Run();
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
}
/* ---------------- Dockerfile ----------------
# Build stage: the SDK image is ~800 MB and never ships
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
# Project files FIRST. They rarely change, so this restore layer is cached and
# skipped on most builds. Copy everything at once and every source edit
# re downloads every NuGet package.
COPY ["BookStore.Api/BookStore.Api.csproj", "BookStore.Api/"]
COPY ["BookStore.Core/BookStore.Core.csproj", "BookStore.Core/"]
RUN dotnet restore "BookStore.Api/BookStore.Api.csproj"
COPY . .
WORKDIR "/src/BookStore.Api"
# UseAppHost=false skips the native launcher: the entrypoint runs the dll directly
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false
# Runtime stage: pinned and chiseled. No shell, no package manager,
# far fewer CVEs to patch. The shipped image has no SDK and no source.
FROM mcr.microsoft.com/dotnet/aspnet:8.0.11-jammy-chiseled AS final
WORKDIR /app
COPY --from=build /app/publish .
# Non root. A container running as root gives an attacker a much better
# starting point for escaping the container.
USER $APP_UID
# 8080, not 80: a non root user cannot bind below 1024
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080 \
    DOTNET_PRINT_TELEMETRY_MESSAGE=false
# NEVER bake secrets in. Layers are readable and docker history shows every ENV.
# Pass them at run time:  docker run -e ConnectionStrings__Default="..."
ENTRYPOINT ["dotnet", "BookStore.Api.dll"]
   ---------------- .dockerignore ----------------
**/bin/
**/obj/
**/.vs/
.git/
**/appsettings.Development.json
**/secrets.json
Dockerfile
docker-compose*.yml
   ---------------- docker-compose.yml ----------------
services:
  api:
    build: { context: ., dockerfile: BookStore.Api/Dockerfile }
    ports: [ "8080:8080" ]
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ConnectionStrings__Default=Server=db;Database=BookStore;User Id=sa;Password=Your_Strong_Pass123;TrustServerCertificate=True
    depends_on:
      db: { condition: service_healthy }     # plain depends_on waits for START,
                                             # not for SQL Server to be READY
  db:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment: [ "ACCEPT_EULA=Y", "MSSQL_SA_PASSWORD=Your_Strong_Pass123" ]
    volumes: [ "sqldata:/var/opt/mssql" ]
    healthcheck:
      test: ["CMD-SHELL", "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Your_Strong_Pass123 -C -Q 'SELECT 1' || exit 1"]
      interval: 10s
      retries: 10
      start_period: 30s
volumes: { sqldata: }
   ---------------- Commands ----------------
   docker compose up --build
   docker build --platform linux/amd64 -t bookstore-api:1.0 .   # on Apple Silicon
   docker run -d -p 8080:8080 -e ConnectionStrings__Default="..." bookstore-api:1.0
*/
</code></pre>
