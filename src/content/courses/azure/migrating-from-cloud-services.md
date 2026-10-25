---
publishDate: 2026-10-30T13:45
title: Migrating from Cloud Services and Classic VMs
slug: migrating-from-cloud-services
metadescription: Move workloads off Cloud Services and other retired Azure compute onto current services, without carrying the old design across.
updateDate: 2026-09-07T13:45
author: ['bishal-biswas']
level: 4
tags: ['legacy', 'migration', 'modernisation']
course: azure
---

## What Cloud Services was

Azure's original platform as a service, from 2010. An application was packaged as a `.cspkg` with a `.cscfg` configuration file and deployed into roles.

```text
Web role     IIS, for web applications
Worker role  a background process
Deployment slots  staging and production, with a VIP swap
```

```text
Cloud Services (classic)    RETIRED, August 2024
Cloud Services (extended support)  the ARM version. Still supported, and a
                                   staging post rather than a destination.
```

Extended support moved Cloud Services to Resource Manager without modernising it. Anything on it should have a plan to leave.

## Where each role should go

```text
Web role serving HTTP
  -> App Service, if it is a normal web application
  -> Container Apps, if containerising is acceptable

Worker role processing a queue
  -> Azure Functions with a queue trigger, for discrete work items
  -> Container Apps with KEDA, for a long running consumer

Worker role running scheduled work
  -> Azure Functions with a timer trigger
  -> Container Apps jobs

Role needing specific OS configuration
  -> Virtual machine scale set, which is the closest equivalent
```

**Most worker roles become Functions.** The trigger and binding model does what role startup code did, and the platform handles the polling loop, the retries and the poison message path.

## What the code has to change

```csharp
// Cloud Services
public class WorkerRole : RoleEntryPoint
{
    private CloudQueue _queue;

    public override bool OnStart()
    {
        var account = CloudStorageAccount.Parse(
            RoleEnvironment.GetConfigurationSettingValue("StorageConnection"));
        _queue = account.CreateCloudQueueClient().GetQueueReference("orders");
        _queue.CreateIfNotExists();
        return base.OnStart();
    }

    public override void Run()
    {
        while (true)
        {
            var message = _queue.GetMessage();
            if (message is null) { Thread.Sleep(1000); continue; }

            ProcessOrder(message.AsString);
            _queue.DeleteMessage(message);
        }
    }
}
```

```csharp
// the same thing as a Function
[Function("ProcessOrder")]
public async Task Run(
    [QueueTrigger("orders", Connection = "Storage")] Order order,
    FunctionContext context)
{
    await _handler.HandleAsync(order);
}
```

The polling loop, the sleep, the delete, the retry handling and the poison message path all disappear. That is a substantial reduction in code that was never business logic.

```text
RoleEnvironment.GetConfigurationSettingValue  -> IConfiguration
RoleEnvironment.Changed event                 -> configuration reload
Local resource storage                        -> Blob Storage
Startup tasks                                 -> a Dockerfile, or app configuration
Diagnostics store                             -> Application Insights
Internal endpoints between roles              -> HTTP, or a queue
VIP swap                                      -> deployment slot swap
```

## Storage SDK changes

The old `Microsoft.WindowsAzure.Storage` and `Microsoft.Azure.Storage` packages are replaced by `Azure.Storage.*`.

```csharp
// old
var account = CloudStorageAccount.Parse(connectionString);
var client = account.CreateCloudBlobClient();
var container = client.GetContainerReference("uploads");
await container.CreateIfNotExistsAsync();
var blob = container.GetBlockBlobReference("file.pdf");
await blob.UploadFromStreamAsync(stream);
```

```csharp
// current
var service = new BlobServiceClient(
    new Uri("https://stshopprod.blob.core.windows.net"),
    new DefaultAzureCredential());

var container = service.GetBlobContainerClient("uploads");
await container.CreateIfNotExistsAsync();
await container.GetBlobClient("file.pdf").UploadAsync(stream, overwrite: true);
```

Take the opportunity to move to a managed identity while rewriting the calls. Migrating and keeping a connection string means doing the work twice.

## Do not carry the design across

The temptation is a one to one port: each role becomes one App Service, wired the same way. That is fastest and it preserves decisions made for a platform that no longer exists.

```text
Worth reconsidering
  Roles split by deployment unit rather than by responsibility
  A worker polling a queue every second because that was the only option
  Internal endpoints between roles, which can now be a queue or HTTP
  Configuration in a .cscfg, which becomes app settings and Key Vault
  Session state in a role, which becomes Redis
  Local storage on the role, which becomes Blob Storage
```

Cloud Services encouraged large roles because deployment was slow and scaling was per role. Neither constraint exists now, so the shape can change.

That said, **do not rewrite everything at once.** Migrate first, then improve. A migration that also redesigns is two risks at the same time, and when it goes wrong you cannot tell which one caused it.

## A workable order

```text
1. Inventory: roles, dependencies, configuration, external integrations
2. Move to the current SDKs, still on Cloud Services, and deploy that
3. Pick the lowest risk worker role and move it to Functions
4. Verify in production, running alongside the old one if possible
5. Move the remaining workers
6. Move the web roles to App Service
7. Decommission
```

Step two matters. Updating the SDKs while still on the old platform separates "the code works with new libraries" from "the code works on a new platform", and each is easier to diagnose alone.

## Running both during transition

```csharp
// route a share of messages to the new consumer
var useNewConsumer = await _features.IsEnabledAsync("NewOrderProcessor");
var queueName = useNewConsumer ? "orders-v2" : "orders";
```

For a queue based worker, running old and new consumers on separate queues and shifting traffic gradually is the safest path. Compare output, then move the rest.

Two consumers on the **same** queue also works if processing is idempotent, since each message goes to one of them.

## Verifying

```kusto
union requests, traces, exceptions
| where timestamp > ago(1h)
| extend platform = tostring(customDimensions.Platform)
| summarize count(), avg(duration), failures = countif(success == false)
  by platform, name
```

Tagging telemetry with which platform handled it makes the comparison direct. If the new path is slower or failing more, that shows immediately rather than in a support ticket.

Keep the old deployment until the new one has handled a full business cycle, including month end, which is where the differences usually appear.

## Quick recap

- Cloud Services classic is retired, and extended support is a staging post rather than a destination.
- Most worker roles become Functions, and the polling and retry code disappears.
- Move to `Azure.Storage.*` and take managed identity at the same time.
- Do not carry across a design shaped by constraints that no longer exist.
- Migrate first and improve second, since doing both at once hides which change broke things.
- Update the SDKs while still on the old platform, so the two risks are separate.
- Keep the old deployment until the new one has survived a full business cycle.

<code id="code-content" class="language-csharp">
// CLOUD SERVICES CLASSIC IS RETIRED (August 2024). Extended support moved
// it to Resource Manager WITHOUT modernising it: a staging post, not a
// destination.
//
// WHERE EACH ROLE GOES:
//   web role serving HTTP        -&gt; App Service, or Container Apps
//   worker polling a queue       -&gt; FUNCTIONS with a queue trigger
//   worker on a schedule         -&gt; Functions timer trigger, or ACA jobs
//   role needing OS control      -&gt; virtual machine scale set
//
// MOST WORKER ROLES BECOME FUNCTIONS. Compare what disappears:
//   OLD: OnStart() builds a CloudQueue, Run() loops forever with
//        GetMessage / Thread.Sleep(1000) / ProcessOrder / DeleteMessage,
//        plus your own retry and poison message handling.
[Function("ProcessOrder")]
public async Task Run([QueueTrigger("orders", Connection = "Storage")] Order order)
    =&gt; await _handler.HandleAsync(order);
// The polling loop, the sleep, the delete, the retries and the poison path
// ALL DISAPPEAR. None of it was ever business logic.
//
//   RoleEnvironment.GetConfigurationSettingValue -&gt; IConfiguration
//   local resource storage                       -&gt; Blob Storage
//   startup tasks                                -&gt; a Dockerfile
//   diagnostics store                            -&gt; Application Insights
//   internal endpoints between roles             -&gt; HTTP, or a queue
//   VIP swap                                     -&gt; deployment slot swap
//
// SDKs: Microsoft.WindowsAzure.Storage becomes Azure.Storage.*. TAKE
// MANAGED IDENTITY WHILE REWRITING THE CALLS, or you do the work twice.
var service = new BlobServiceClient(
    new Uri("https://stshopprod.blob.core.windows.net"), new DefaultAzureCredential());
await service.GetBlobContainerClient("uploads")
             .GetBlobClient("file.pdf").UploadAsync(stream, overwrite: true);
//
// DO NOT CARRY THE DESIGN ACROSS. Cloud Services encouraged large roles
// because deployment was slow and scaling was per role. NEITHER CONSTRAINT
// EXISTS NOW, so reconsider: roles split by deployment unit rather than
// responsibility, per second polling, internal endpoints, .cscfg
// configuration, session state in a role, local storage.
//
// BUT DO NOT REWRITE EVERYTHING AT ONCE. MIGRATE FIRST, IMPROVE SECOND. A
// migration that also redesigns is two risks together, and when it breaks
// you cannot tell which one did it.
//   1. inventory roles, dependencies, configuration, integrations
//   2. MOVE TO CURRENT SDKs WHILE STILL ON CLOUD SERVICES, and deploy that
//      -&gt; separates "works with new libraries" from "works on a new platform"
//   3. lowest risk worker role -&gt; Functions
//   4. verify in production, alongside the old one if possible
//   5. remaining workers, then web roles, then decommission
//
// RUNNING BOTH: separate queues with traffic shifted gradually is safest.
// Two consumers on the SAME queue also works IF processing is idempotent.
//
// TAG TELEMETRY WITH THE PLATFORM so the comparison is direct, and a slower
// or failing new path shows immediately rather than in a support ticket:
//   union requests, traces, exceptions
//   | extend platform = tostring(customDimensions.Platform)
//   | summarize count(), avg(duration), failures = countif(success == false)
//     by platform, name
// KEEP THE OLD DEPLOYMENT UNTIL THE NEW ONE HAS SURVIVED A FULL BUSINESS
// CYCLE, INCLUDING MONTH END, which is where differences usually appear.
</code></pre>
