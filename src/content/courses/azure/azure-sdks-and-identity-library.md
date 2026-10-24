---
publishDate: 2026-10-20T11:10
title: Azure SDKs and the Identity Library
slug: azure-sdks-and-identity-library
metadescription: Use the Azure SDKs correctly, authenticate with the identity library, and configure clients so they behave well under load.
updateDate: 2026-09-07T11:10
author: ['bishal-biswas']
level: 2
tags: ['tooling', 'sdk', 'identity']
course: azure
---

## The SDK generations

```text
Old      Microsoft.Azure.*, WindowsAzure.*   inconsistent, mostly deprecated
Current  Azure.*                             consistent design, one identity model
```

Anything starting `Azure.` follows the current guidelines: the same client construction, the same retry behaviour, the same paging model, the same identity library.

```bash
dotnet add package Azure.Identity
dotnet add package Azure.Security.KeyVault.Secrets
dotnet add package Azure.Storage.Blobs
dotnet add package Azure.Messaging.ServiceBus
```

## DefaultAzureCredential

```csharp
var credential = new DefaultAzureCredential();
```

It tries a chain of credential sources in order:

```text
1. Environment variables (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET)
2. Workload identity (AKS)
3. Managed identity (App Service, Functions, Container Apps, VMs)
4. Visual Studio
5. Azure CLI (az login)
6. Azure PowerShell
7. Azure Developer CLI
```

That is why the same code works on a laptop and in production. Locally it finds your `az login`; in Azure it finds the managed identity.

```csharp
// pick a specific user assigned identity
var credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions
{
    ManagedIdentityClientId = builder.Configuration["AZURE_CLIENT_ID"],
    ExcludeVisualStudioCredential = true,
    ExcludeAzurePowerShellCredential = true
});
```

**In production, prefer being explicit:**

```csharp
var credential = builder.Environment.IsDevelopment()
    ? new DefaultAzureCredential()
    : new ManagedIdentityCredential(builder.Configuration["AZURE_CLIENT_ID"]);
```

`DefaultAzureCredential` walks the entire chain before failing, so a misconfiguration produces a slow, vague error. `ManagedIdentityCredential` fails immediately with a clear one.

## Register clients properly

```csharp
builder.Services.AddAzureClients(clients =>
{
    clients.AddSecretClient(new Uri(builder.Configuration["KeyVault:Uri"]!));
    clients.AddBlobServiceClient(new Uri(builder.Configuration["Storage:BlobUri"]!));
    clients.AddServiceBusClient(builder.Configuration["ServiceBus:Namespace"]);

    clients.UseCredential(new DefaultAzureCredential());

    clients.ConfigureDefaults(options =>
    {
        options.Retry.MaxRetries = 5;
        options.Retry.Mode = RetryMode.Exponential;
        options.Retry.Delay = TimeSpan.FromMilliseconds(400);
        options.Retry.MaxDelay = TimeSpan.FromSeconds(20);
        options.Retry.NetworkTimeout = TimeSpan.FromSeconds(30);
    });
});
```

```bash
dotnet add package Microsoft.Extensions.Azure
```

**Azure SDK clients are thread safe and expensive to create.** Register them as singletons, which `AddAzureClients` does. Creating a `BlobServiceClient` per request exhausts sockets and produces intermittent failures under load.

This is the same class of mistake as a new `HttpClient` per request, and it is just as common.

## Retries are built in

```csharp
options.Retry.MaxRetries = 5;
options.Retry.Mode = RetryMode.Exponential;
```

Every current SDK client retries transient failures automatically with exponential backoff. You do not need Polly around them for that.

What the SDK does not do is decide whether retrying is safe for your operation, so a non idempotent call still needs your own protection.

```csharp
// disable retries where the caller handles it
options.Retry.MaxRetries = 0;
```

## Paging

```csharp
// asynchronous pageable: iterate items
await foreach (BlobItem blob in container.GetBlobsAsync(prefix: "invoices/2026/"))
{
    Console.WriteLine(blob.Name);
}

// or page by page, which is what you want for continuation tokens
await foreach (Page<BlobItem> page in container.GetBlobsAsync().AsPages(pageSizeHint: 500))
{
    Console.WriteLine($"{page.Values.Count} items, token {page.ContinuationToken}");
}
```

`AsyncPageable<T>` handles continuation tokens for you. Iterating it fetches pages as needed, so a listing of a million blobs does not load a million blobs into memory.

## Long running operations

```csharp
var operation = await client.StartCopyFromUriAsync(sourceUri);
await operation.WaitForCompletionAsync();

// or poll with your own control
while (!operation.HasCompleted)
{
    await Task.Delay(TimeSpan.FromSeconds(5));
    await operation.UpdateStatusAsync();
}
```

Anything that takes minutes returns an `Operation<T>`. The `WaitForCompletion` pattern is consistent across every SDK.

## Diagnostics

```csharp
using var listener = AzureEventSourceListener.CreateConsoleLogger(EventLevel.Verbose);
```

```csharp
builder.Services.AddAzureClients(clients =>
{
    clients.ConfigureDefaults(options =>
    {
        options.Diagnostics.IsLoggingEnabled = true;
        options.Diagnostics.IsDistributedTracingEnabled = true;
        options.Diagnostics.ApplicationId = "shop-api";
        options.Diagnostics.IsLoggingContentEnabled = false;   // do not log payloads
    });
});
```

The event source listener shows every request, retry and response, and it is the fastest way to diagnose an authentication problem. Turn it on temporarily, since it is verbose.

Leave `IsLoggingContentEnabled` false in production, or request and response bodies end up in logs.

## The management SDK is separate

```bash
dotnet add package Azure.ResourceManager
dotnet add package Azure.ResourceManager.Storage
```

```csharp
var armClient = new ArmClient(new DefaultAzureCredential());
SubscriptionResource subscription = await armClient.GetDefaultSubscriptionAsync();

ResourceGroupResource resourceGroup =
    await subscription.GetResourceGroups().GetAsync("rg-shop-prod-uks");

await foreach (StorageAccountResource account in resourceGroup.GetStorageAccounts())
{
    Console.WriteLine($"{account.Data.Name} {account.Data.Sku.Name}");
}
```

```text
Data plane        Azure.Storage.Blobs, Azure.Messaging.ServiceBus. Reading and writing data.
Management plane  Azure.ResourceManager.*. Creating and configuring resources.
```

They need different permissions, which is the data plane against management plane distinction that catches people in RBAC.

Most applications only need data plane packages. Reach for `Azure.ResourceManager` when the application genuinely creates infrastructure.

## Token caching

```csharp
var credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions
{
    TokenCachePersistenceOptions = new TokenCachePersistenceOptions()
});
```

Credentials cache tokens in memory and refresh before expiry, so a shared singleton credential is efficient. Persistent caching helps for developer tools that restart frequently and is unnecessary for a long running service.

Creating a new credential per request defeats the cache and produces a token request every time, which is slow and can hit throttling limits.

## Common problems

**`DefaultAzureCredential` fails with a long aggregate error.** Each credential in the chain reports why it failed. Read the whole message: the relevant line is usually about the managed identity or the CLI.

**Works locally, fails in Azure.** The managed identity has no role assignment, or a data plane role is missing while a management role exists.

**Intermittent failures under load.** A client created per request. Register singletons.

**403 with a valid token.** The token is for the right tenant and the identity lacks the data plane role.

```bash
az account show
az account get-access-token --resource https://storage.azure.com/ --query expiresOn
```

## Quick recap

- Use `Azure.*` packages, since they share one design and one identity model.
- `DefaultAzureCredential` is why the same code works locally and in Azure.
- Prefer `ManagedIdentityCredential` in production for fast, clear failures.
- Register clients as singletons with `AddAzureClients`, because per request creation exhausts sockets.
- Retries with exponential backoff are already built in, so no Polly is needed for that.
- `AsyncPageable` handles continuation tokens, so large listings stream rather than load.
- Management and data plane packages need different permissions.

<code id="code-content" class="language-csharp">
// USE Azure.* PACKAGES. They share one design, one retry model, one paging
// model and one identity library. Microsoft.Azure.* is the old generation.
//
// DefaultAzureCredential TRIES A CHAIN: environment variables, workload
// identity, managed identity, Visual Studio, az login, PowerShell, azd.
// That is why THE SAME CODE works on a laptop and in production.
var credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions
{
    ManagedIdentityClientId = builder.Configuration["AZURE_CLIENT_ID"]
});
//
// IN PRODUCTION, PREFER BEING EXPLICIT. DefaultAzureCredential walks the
// WHOLE CHAIN before failing, so a misconfiguration is slow and vague.
// ManagedIdentityCredential fails immediately with a clear error.
var production = new ManagedIdentityCredential(builder.Configuration["AZURE_CLIENT_ID"]);
//
// AZURE SDK CLIENTS ARE THREAD SAFE AND EXPENSIVE TO CREATE. Register them
// as SINGLETONS. Creating a BlobServiceClient per request EXHAUSTS SOCKETS
// and gives intermittent failures under load. Same mistake as a new
// HttpClient per request, and just as common.
builder.Services.AddAzureClients(clients =&gt;
{
    clients.AddSecretClient(new Uri(config["KeyVault:Uri"]!));
    clients.AddBlobServiceClient(new Uri(config["Storage:BlobUri"]!));
    clients.AddServiceBusClient(config["ServiceBus:Namespace"]);
    clients.UseCredential(credential);
//
    clients.ConfigureDefaults(options =&gt;
    {
        // RETRIES ARE ALREADY BUILT IN with exponential backoff. You do not
        // need Polly for that. What the SDK cannot decide is whether
        // retrying is SAFE for your operation.
        options.Retry.MaxRetries = 5;
        options.Retry.Mode = RetryMode.Exponential;
        options.Retry.NetworkTimeout = TimeSpan.FromSeconds(30);
//
        options.Diagnostics.IsDistributedTracingEnabled = true;
        options.Diagnostics.ApplicationId = "shop-api";
        // LEAVE THIS FALSE, or request and response BODIES end up in logs.
        options.Diagnostics.IsLoggingContentEnabled = false;
    });
});
//
// AsyncPageable HANDLES CONTINUATION TOKENS. Iterating fetches pages as
// needed, so listing a million blobs does not load a million into memory.
await foreach (BlobItem blob in container.GetBlobsAsync(prefix: "invoices/2026/"))
    Console.WriteLine(blob.Name);
// Or page by page, when you want the token yourself:
await foreach (Page&lt;BlobItem&gt; page in container.GetBlobsAsync().AsPages(pageSizeHint: 500))
    Console.WriteLine(page.ContinuationToken);
//
// LONG RUNNING OPERATIONS are consistent across every SDK:
var operation = await client.StartCopyFromUriAsync(sourceUri);
await operation.WaitForCompletionAsync();
//
// THE FASTEST WAY TO DIAGNOSE AN AUTHENTICATION PROBLEM. Very verbose, so
// turn it on temporarily:
using var listener = AzureEventSourceListener.CreateConsoleLogger(EventLevel.Verbose);
//
// MANAGEMENT PLANE IS A SEPARATE SDK, needing DIFFERENT PERMISSIONS. Most
// applications need only data plane packages.
var armClient = new ArmClient(credential);
var subscription = await armClient.GetDefaultSubscriptionAsync();
//
// COMMON PROBLEMS:
//   long aggregate error   read the WHOLE message: each credential says why
//   works locally, not in Azure   no role assignment, or a MANAGEMENT role
//                                 where a DATA PLANE role is needed
//   intermittent under load       a client created per request
//   403 with a valid token        right tenant, missing data plane role
</code></pre>
