---
publishDate: 2026-10-20T11:15
title: Local Development with Emulators
slug: local-development-with-emulators
metadescription: Develop against Azure services locally with Azurite, the Cosmos DB emulator and containers, so the inner loop is fast and free.
updateDate: 2026-09-07T11:15
author: ['bishal-biswas']
level: 2
tags: ['tooling', 'local development', 'emulators']
course: azure
---

## Why bother

Developing against real Azure resources means every developer needs their own, every test run costs money, and nothing works on a train.

Emulators give a fast inner loop, no cost, and no shared state to conflict over.

```text
Azurite                 Blob, Queue and Table storage
Cosmos DB emulator      the NoSQL API, in a Linux container
Azure Functions Core Tools  the Functions runtime
Aspire                  orchestrates all of it, with a dashboard
Service Bus             no official emulator, use a container or a real namespace
```

## Azurite

```bash
npm install -g azurite
azurite --silent --location ./.azurite --debug ./.azurite/debug.log

# or as a container, which is easier to keep consistent
docker run -d -p 10000:10000 -p 10001:10001 -p 10002:10002 \
  -v azurite-data:/data \
  mcr.microsoft.com/azure-storage/azurite
```

```text
10000  Blob
10001  Queue
10002  Table
```

```csharp
// the well known development connection string
const string connectionString = "UseDevelopmentStorage=true";

var blobService = new BlobServiceClient(connectionString);
var container = blobService.GetBlobContainerClient("uploads");
await container.CreateIfNotExistsAsync();
```

That connection string is a fixed value understood by every Azure Storage SDK. It expands to the emulator endpoints and the well known development account key.

```json
{
  "ConnectionStrings": {
    "Storage": "UseDevelopmentStorage=true"
  }
}
```

```json
{
  "ConnectionStrings": {
    "Storage": "https://stshopprod.blob.core.windows.net"
  }
}
```

Development uses the connection string, production uses a URI with a managed identity. The application picks the right one from configuration.

Azurite supports most of the storage API. It does not support Entra ID authentication or some newer features, so anything depending on those needs a real account.

## Cosmos DB emulator

```bash
docker run -d -p 8081:8081 -p 10250-10255:10250-10255 \
  --name cosmos-emulator \
  -e AZURE_COSMOS_EMULATOR_PARTITION_COUNT=10 \
  -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true \
  mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-preview
```

```csharp
var client = new CosmosClient(
    "https://localhost:8081",
    "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
    new CosmosClientOptions
    {
        ConnectionMode = ConnectionMode.Gateway,
        HttpClientFactory = () => new HttpClient(new HttpClientHandler
        {
            // the emulator uses a self signed certificate
            ServerCertificateCustomValidationCallback =
                HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        })
    });
```

That key is the emulator's fixed, publicly documented development key. It is the same everywhere and is not a secret.

**Use `ConnectionMode.Gateway` with the emulator.** Direct mode needs the additional ports and often fails in Docker networking setups.

The Linux emulator is much faster to start than the older Windows one, which is worth knowing if you tried this a few years ago and gave up.

## Azure Functions locally

```bash
func start --verbose
```

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
    "ServiceBusConnection": "Endpoint=sb://sb-shop-dev.servicebus.windows.net/;Authentication=ManagedIdentity",
    "CosmosConnection": "AccountEndpoint=https://localhost:8081/;AccountKey=C2y6..."
  }
}
```

`local.settings.json` is not deployed and should be git ignored. Queue and blob triggers work fully against Azurite, so the whole trigger and binding model can be developed offline.

## .NET Aspire

Aspire orchestrates the whole local environment, and it is the most convenient option for a multi service application.

```csharp
var builder = DistributedApplication.CreateBuilder(args);

var storage = builder.AddAzureStorage("storage").RunAsEmulator();
var blobs = storage.AddBlobs("blobs");
var queues = storage.AddQueues("queues");

var cosmos = builder.AddAzureCosmosDB("cosmos").RunAsEmulator();
var db = cosmos.AddDatabase("shop");

var cache = builder.AddRedis("cache");

var api = builder.AddProject<Projects.Shop_Api>("api")
    .WithReference(blobs)
    .WithReference(queues)
    .WithReference(db)
    .WithReference(cache);

builder.AddNpmApp("web", "../shop-web", "dev")
    .WithReference(api)
    .WithHttpEndpoint(env: "PORT");

builder.Build().Run();
```

```bash
dotnet run --project ./AppHost
```

One command starts Azurite, the Cosmos emulator, Redis, the API and the front end, wires the connection strings between them, and opens a dashboard showing logs, traces and metrics for all of it.

`RunAsEmulator()` is the key part: the same code uses the real Azure resource when deployed, and the emulator when running locally.

## Containers for the rest

```yaml
services:
  azurite:
    image: mcr.microsoft.com/azure-storage/azurite
    ports: ["10000:10000", "10001:10001", "10002:10002"]
    volumes: ["azurite:/data"]

  cosmos:
    image: mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-preview
    ports: ["8081:8081", "10250-10255:10250-10255"]

  postgres:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: localdev
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "LocalDev!Password1"
    ports: ["1433:1433"]

volumes:
  azurite:
```

PostgreSQL, MySQL, Redis and SQL Server all run as ordinary containers, and the Azure managed versions are the same engines. That covers most of what an application needs.

## What has no emulator

```text
Service Bus       no official emulator. Use a shared dev namespace, or an
                  abstraction with an in memory implementation for tests.
Event Grid        no emulator. ngrok or a dev codespace for webhook testing.
Key Vault         no emulator. Use user secrets locally and a real vault in Azure.
Entra ID          no emulator. Use a development tenant.
```

For Key Vault, the practical approach:

```bash
dotnet user-secrets init
dotnet user-secrets set "StripeKey" "sk_test_..."
```

```csharp
builder.Configuration.AddUserSecrets<Program>();

if (!builder.Environment.IsDevelopment())
{
    builder.Configuration.AddAzureKeyVault(
        new Uri(builder.Configuration["KeyVault:Uri"]!),
        new DefaultAzureCredential());
}
```

User secrets are stored outside the repository, so nothing sensitive can be committed by accident.

## Testcontainers for integration tests

```csharp
public class StorageFixture : IAsyncLifetime
{
    private readonly IContainer _azurite = new ContainerBuilder()
        .WithImage("mcr.microsoft.com/azure-storage/azurite")
        .WithPortBinding(10000, true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilPortIsAvailable(10000))
        .Build();

    public string ConnectionString => $"DefaultEndpointsProtocol=http;" +
        $"AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;" +
        $"BlobEndpoint=http://127.0.0.1:{_azurite.GetMappedPublicPort(10000)}/devstoreaccount1;";

    public Task InitializeAsync() => _azurite.StartAsync();
    public Task DisposeAsync() => _azurite.DisposeAsync().AsTask();
}
```

Testcontainers starts a fresh container per test run and cleans up afterwards, so integration tests are isolated and run in CI without any Azure resources.

That is a meaningfully better position than mocking the storage client, because it tests the real API surface.

## Keeping local and deployed consistent

```csharp
var storageUri = builder.Configuration["Storage:BlobUri"];

builder.Services.AddAzureClients(clients =>
{
    if (builder.Environment.IsDevelopment())
    {
        clients.AddBlobServiceClient(builder.Configuration.GetConnectionString("Storage"));
    }
    else
    {
        clients.AddBlobServiceClient(new Uri(storageUri!));
        clients.UseCredential(new DefaultAzureCredential());
    }
});
```

Keep the difference to configuration and client construction. Everything past that point is identical, so code paths that work locally work deployed.

Branching on environment deeper in the application is where "works on my machine" comes from.

## Quick recap

- Azurite covers Blob, Queue and Table, and `UseDevelopmentStorage=true` is the well known connection string.
- The Cosmos emulator key is public and fixed, and Gateway mode avoids Docker networking problems.
- Aspire starts every emulator and service with one command and wires them together.
- PostgreSQL, Redis and SQL Server are ordinary containers running the same engines as the managed versions.
- Service Bus, Event Grid and Key Vault have no emulator, so use dev resources or user secrets.
- Testcontainers gives isolated integration tests that run in CI with no Azure resources.
- Keep environment differences at configuration level, not deep in the application.

<code id="code-content" class="language-bash">
# WHY: developing against real Azure means every developer needs their own
# resources, every test run costs money, and nothing works on a train.
# AZURITE covers Blob (10000), Queue (10001) and Table (10002):
docker run -d -p 10000:10000 -p 10001:10001 -p 10002:10002 \
  -v azurite-data:/data mcr.microsoft.com/azure-storage/azurite
# "UseDevelopmentStorage=true" IS A FIXED VALUE understood by every Storage
# SDK. It expands to the emulator endpoints and the well known dev key.
#   development: UseDevelopmentStorage=true
#   production:  https://stshopprod.blob.core.windows.net + managed identity
# Azurite does NOT support Entra ID auth or some newer features.
# COSMOS EMULATOR. The Linux one starts far faster than the old Windows one.
docker run -d -p 8081:8081 -p 10250-10255:10250-10255 \
  -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true \
  mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-preview
# Its key (C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPM...)
# is PUBLICLY DOCUMENTED and identical everywhere. It is not a secret.
# USE ConnectionMode.Gateway: Direct mode needs extra ports and often fails
# in Docker networking. The emulator also uses a SELF SIGNED CERTIFICATE.
# .NET ASPIRE IS THE MOST CONVENIENT OPTION for a multi service application.
# One command starts Azurite, Cosmos, Redis, the API and the front end,
# WIRES THE CONNECTION STRINGS BETWEEN THEM, and opens a dashboard with
# logs, traces and metrics.
#   var storage = builder.AddAzureStorage("storage").RunAsEmulator();
#   var cosmos  = builder.AddAzureCosmosDB("cosmos").RunAsEmulator();
#   builder.AddProject&lt;Projects.Shop_Api&gt;("api").WithReference(blobs);
# RunAsEmulator() IS THE KEY PART: the same code uses the REAL resource when
# deployed and the emulator locally.
dotnet run --project ./AppHost
# PostgreSQL, MySQL, Redis and SQL Server are ORDINARY CONTAINERS running
# the SAME ENGINES as the Azure managed versions.
# WHAT HAS NO EMULATOR: Service Bus, Event Grid, Key Vault, Entra ID.
# For Key Vault, use USER SECRETS locally, stored OUTSIDE the repository so
# nothing sensitive can be committed by accident:
dotnet user-secrets init &amp;&amp; dotnet user-secrets set "StripeKey" "sk_test_..."
#   ...and AddAzureKeyVault only when NOT in development.
# TESTCONTAINERS gives isolated integration tests that run in CI with NO
# Azure resources, testing the REAL API surface rather than a mock:
#   new ContainerBuilder().WithImage("mcr.microsoft.com/azure-storage/azurite")
#     .WithPortBinding(10000, true).Build()
# KEEP THE DIFFERENCE AT CONFIGURATION LEVEL. Branching on environment
# DEEPER in the application is where "works on my machine" comes from.
</code></pre>
