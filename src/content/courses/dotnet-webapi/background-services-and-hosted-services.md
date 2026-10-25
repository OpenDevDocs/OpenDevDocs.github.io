---
publishDate: 2026-09-26T17:50
title: Background Services and Hosted Services
slug: background-services-and-hosted-services
metadescription: Run work outside the request with BackgroundService, build an in process job queue, use scoped services safely, and shut down gracefully without losing work.
updateDate: 2026-09-07T17:50
author: ['bishal-biswas']
level: 3
tags: ['background-services', 'queues', 'async']
course: dotnet-webapi
---

## Why not just do it in the request

Slow work inside a request holds a connection open and makes the client wait:

```csharp
[HttpPost]
public async Task<IActionResult> Create(CreateOrderRequest request, CancellationToken ct)
{
    Order order = await service.CreateAsync(request, ct);

    await emailService.SendConfirmationAsync(order, ct);      // 2 seconds
    await warehouseApi.NotifyAsync(order, ct);                // 3 seconds
    await analytics.TrackAsync(order, ct);                    // 1 second

    return Ok(order);
}
```

The order is saved in 50 milliseconds and the client waits six seconds. Worse, if the email service is down, the request fails even though the order exists.

Move that work out. Return as soon as the order is saved, and do the rest in the background.

## BackgroundService

The base class for long running work. Implement `ExecuteAsync`:

```csharp
public class CleanupService : BackgroundService
{
    private readonly IServiceScopeFactory scopeFactory;
    private readonly ILogger<CleanupService> logger;

    public CleanupService(IServiceScopeFactory scopeFactory, ILogger<CleanupService> logger)
    {
        this.scopeFactory = scopeFactory;
        this.logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using IServiceScope scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                int removed = await db.RefreshTokens
                    .Where(t => t.ExpiresAt < DateTime.UtcNow.AddDays(-30))
                    .ExecuteDeleteAsync(stoppingToken);

                logger.LogInformation("Removed {Count} expired tokens", removed);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Cleanup failed");
            }

            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }
}
```

```csharp
builder.Services.AddHostedService<CleanupService>();
```

Three details in there, and all three matter.

**The try/catch is inside the loop.** An unhandled exception in `ExecuteAsync` stops the service permanently, and by default it also stops the whole host. Catch per iteration so one failure does not end the service.

**Scoped services need a scope.** A hosted service is a singleton, so it cannot inject a `DbContext`. `IServiceScopeFactory` creates one per iteration.

**Pass the stopping token to everything.** It is how shutdown works.

## Scoped services in detail

The rule and its consequence:

```csharp
// Throws at startup, and rightly so
public CleanupService(AppDbContext db) { }

// Correct
public CleanupService(IServiceScopeFactory scopeFactory) { }
```

Create the scope **inside** the loop, not around it. A scope held for hours accumulates tracked entities in the change tracker and never releases the connection.

`IDbContextFactory<T>` is the alternative when you only need a context:

```csharp
await using AppDbContext db = await contextFactory.CreateDbContextAsync(stoppingToken);
```

## A job queue

The pattern that replaces fire and forget. A controller queues work, a background service does it.

`System.Threading.Channels` is the right tool: an in memory async queue with backpressure.

```csharp
public interface IBackgroundTaskQueue
{
    ValueTask QueueAsync(Func<IServiceProvider, CancellationToken, ValueTask> work);
    ValueTask<Func<IServiceProvider, CancellationToken, ValueTask>> DequeueAsync(CancellationToken ct);
}

public class BackgroundTaskQueue : IBackgroundTaskQueue
{
    private readonly Channel<Func<IServiceProvider, CancellationToken, ValueTask>> channel;

    public BackgroundTaskQueue(int capacity = 100)
    {
        var options = new BoundedChannelOptions(capacity)
        {
            FullMode = BoundedChannelFullMode.Wait      // apply backpressure, do not drop
        };

        channel = Channel.CreateBounded<Func<IServiceProvider, CancellationToken, ValueTask>>(options);
    }

    public ValueTask QueueAsync(Func<IServiceProvider, CancellationToken, ValueTask> work)
        => channel.Writer.WriteAsync(work);

    public ValueTask<Func<IServiceProvider, CancellationToken, ValueTask>> DequeueAsync(
        CancellationToken ct) => channel.Reader.ReadAsync(ct);
}
```

The consumer:

```csharp
public class QueuedHostedService : BackgroundService
{
    private readonly IBackgroundTaskQueue queue;
    private readonly IServiceScopeFactory scopeFactory;
    private readonly ILogger<QueuedHostedService> logger;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var work = await queue.DequeueAsync(stoppingToken);

            try
            {
                using IServiceScope scope = scopeFactory.CreateScope();
                await work(scope.ServiceProvider, stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "A queued job failed");
            }
        }
    }
}
```

The controller:

```csharp
[HttpPost]
public async Task<IActionResult> Create(CreateOrderRequest request, CancellationToken ct)
{
    Order order = await service.CreateAsync(request, ct);

    await queue.QueueAsync(async (services, token) =>
    {
        var email = services.GetRequiredService<IEmailService>();
        await email.SendConfirmationAsync(order.Id, token);
    });

    return CreatedAtAction(nameof(GetById), new { id = order.Id }, order);   // returns in 50ms
}
```

**A bounded channel matters.** Unbounded means a burst of traffic queues a million jobs and the process runs out of memory. Bounded with `FullMode.Wait` slows the producer down instead, which is exactly the behaviour you want.

## Timed work

For something that runs on a schedule, `PeriodicTimer` is cleaner than `Task.Delay`:

```csharp
protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));

    while (await timer.WaitForNextTickAsync(stoppingToken))
    {
        try
        {
            await DoWorkAsync(stoppingToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Timed work failed");
        }
    }
}
```

`PeriodicTimer` fires on a fixed schedule rather than waiting a fixed gap after the work finishes. If the work takes two minutes and the period is five, the next tick is three minutes later, not five.

For real cron expressions, use a library such as Quartz.NET or Hangfire.

## Graceful shutdown

When the app stops, the token is cancelled and the host waits for services to finish. The default grace period is **five seconds**, which is often not enough:

```csharp
builder.Services.Configure<HostOptions>(options =>
{
    options.ShutdownTimeout = TimeSpan.FromSeconds(30);
});
```

Drain in flight work rather than abandoning it:

```csharp
public override async Task StopAsync(CancellationToken cancellationToken)
{
    logger.LogInformation("Draining the queue before shutdown");

    await base.StopAsync(cancellationToken);

    logger.LogInformation("Drained");
}
```

Be honest about the limit. Anything still queued when the process exits is **lost**, because the queue is in memory. If losing a job is unacceptable, it belongs in a durable queue.

## When an in process queue is not enough

`BackgroundService` runs inside your API process. That has three consequences.

**Work is lost on restart.** A deploy in the middle of a job loses it.

**It does not scale separately.** Heavy background work competes with request handling for CPU on the same instances.

**It runs on every instance.** Three replicas means three copies of your scheduled cleanup running at once, which is usually wrong. Guard it with a distributed lock, or run scheduled work in a single instance job.

Move to a real queue once the work matters:

- **Hangfire** for persistent jobs with retries and a dashboard, backed by your existing database.
- **Quartz.NET** for cron scheduling with clustering.
- **Azure Service Bus**, **RabbitMQ** or **AWS SQS** for durable messaging between services.

The in process approach is genuinely right for best effort work: sending a notification email, warming a cache, writing an analytics event. Losing one of those occasionally is acceptable. Losing a payment reconciliation is not.

## IHostedService

`BackgroundService` is a helper over `IHostedService`, which has just `StartAsync` and `StopAsync`. Implement it directly when you have setup and teardown rather than a loop:

```csharp
public class MessageConsumer : IHostedService
{
    private IConnection? connection;

    public Task StartAsync(CancellationToken ct)
    {
        connection = CreateConnection();
        connection.Subscribe(OnMessage);
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken ct)
    {
        connection?.Dispose();
        return Task.CompletedTask;
    }
}
```

Note that `StartAsync` **blocks startup** until it returns. Do not put slow work in it, or your app takes a long time to become ready.

## Quick recap

- Move slow, non essential work out of the request so clients get a fast response.
- `BackgroundService` with `ExecuteAsync` is the standard base class.
- Catch exceptions **inside** the loop, or one failure stops the service for good.
- A hosted service is a singleton. Use `IServiceScopeFactory` and create the scope inside the loop.
- Pass the stopping token to everything you await.
- A bounded `Channel` gives you a job queue with backpressure instead of unbounded memory growth.
- `PeriodicTimer` keeps a fixed schedule rather than a fixed gap.
- Raise `ShutdownTimeout` and drain in flight work in `StopAsync`.
- Queued work is lost on restart and runs on every instance. Use Hangfire or a real queue when that matters.
- Implement `IHostedService` directly for setup and teardown, and keep `StartAsync` fast.

<code id="code-content" class="language-csharp">
// A background job queue plus a scheduled cleanup service.
using System.Threading.Channels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddDbContext&lt;AppDbContext&gt;(o =&gt; o.UseInMemoryDatabase("shop"));
builder.Services.AddScoped&lt;IEmailService, EmailService&gt;();
// Bounded, so a traffic burst applies backpressure instead of exhausting memory
builder.Services.AddSingleton&lt;IBackgroundTaskQueue&gt;(_ =&gt; new BackgroundTaskQueue(capacity: 100));
builder.Services.AddHostedService&lt;QueuedHostedService&gt;();
builder.Services.AddHostedService&lt;ExpiredTokenCleanupService&gt;();
// The default grace period is 5 seconds, which is often not enough to drain
builder.Services.Configure&lt;HostOptions&gt;(o =&gt; o.ShutdownTimeout = TimeSpan.FromSeconds(30));
var app = builder.Build();
app.MapControllers();
app.Run();
// ---------- The queue: an in memory async channel
public interface IBackgroundTaskQueue
{
    ValueTask QueueAsync(Func&lt;IServiceProvider, CancellationToken, ValueTask&gt; work);
    ValueTask&lt;Func&lt;IServiceProvider, CancellationToken, ValueTask&gt;&gt; DequeueAsync(CancellationToken ct);
}
public class BackgroundTaskQueue : IBackgroundTaskQueue
{
    private readonly Channel&lt;Func&lt;IServiceProvider, CancellationToken, ValueTask&gt;&gt; channel;
    public BackgroundTaskQueue(int capacity)
    {
        // Unbounded would let a burst queue a million jobs and kill the process.
        // Wait applies backpressure to the producer instead of dropping work.
        channel = Channel.CreateBounded&lt;Func&lt;IServiceProvider, CancellationToken, ValueTask&gt;&gt;(
            new BoundedChannelOptions(capacity) { FullMode = BoundedChannelFullMode.Wait });
    }
    public ValueTask QueueAsync(Func&lt;IServiceProvider, CancellationToken, ValueTask&gt; work) =&gt;
        channel.Writer.WriteAsync(work);
    public ValueTask&lt;Func&lt;IServiceProvider, CancellationToken, ValueTask&gt;&gt; DequeueAsync(CancellationToken ct) =&gt;
        channel.Reader.ReadAsync(ct);
}
// ---------- The consumer
public class QueuedHostedService : BackgroundService
{
    private readonly IBackgroundTaskQueue queue;
    private readonly IServiceScopeFactory scopeFactory;
    private readonly ILogger&lt;QueuedHostedService&gt; logger;
    public QueuedHostedService(IBackgroundTaskQueue queue, IServiceScopeFactory scopeFactory,
                               ILogger&lt;QueuedHostedService&gt; logger)
        =&gt; (this.queue, this.scopeFactory, this.logger) = (queue, scopeFactory, logger);
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Job queue started");
        while (!stoppingToken.IsCancellationRequested)
        {
            Func&lt;IServiceProvider, CancellationToken, ValueTask&gt; work;
            try   { work = await queue.DequeueAsync(stoppingToken); }
            catch (OperationCanceledException) { break; }        // normal shutdown
            try
            {
                // A hosted service is a SINGLETON, so it cannot hold a scoped
                // service. A scope per job also keeps the change tracker clean.
                using IServiceScope scope = scopeFactory.CreateScope();
                await work(scope.ServiceProvider, stoppingToken);
            }
            catch (Exception ex)
            {
                // Inside the loop. An escaping exception would stop the service
                // permanently, and by default stop the whole host with it.
                logger.LogError(ex, "A queued job failed");
            }
        }
    }
    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Job queue stopping. Anything still queued is LOST, "
                            + "because this queue is in memory.");
        await base.StopAsync(cancellationToken);
    }
}
// ---------- A scheduled service. PeriodicTimer keeps a fixed schedule rather
// than a fixed gap after the work finishes.
public class ExpiredTokenCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory scopeFactory;
    private readonly ILogger&lt;ExpiredTokenCleanupService&gt; logger;
    public ExpiredTokenCleanupService(IServiceScopeFactory scopeFactory,
                                      ILogger&lt;ExpiredTokenCleanupService&gt; logger)
        =&gt; (this.scopeFactory, this.logger) = (scopeFactory, logger);
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        // NOTE: this runs on EVERY instance. Three replicas means three copies of
        // this cleanup. Guard it with a distributed lock, or run scheduled work
        // as a separate single instance job.
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using IServiceScope scope = scopeFactory.CreateScope();   // inside the loop
                var db = scope.ServiceProvider.GetRequiredService&lt;AppDbContext&gt;();
                int removed = await db.RefreshTokens
                    .Where(t =&gt; t.ExpiresAt &lt; DateTime.UtcNow.AddDays(-30))
                    .ExecuteDeleteAsync(stoppingToken);
                logger.LogInformation("Removed {Count} expired tokens", removed);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Token cleanup failed, will retry next hour");
            }
        }
    }
}
[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly AppDbContext db;
    private readonly IBackgroundTaskQueue queue;
    public OrdersController(AppDbContext db, IBackgroundTaskQueue queue) =&gt; (this.db, this.queue) = (db, queue);
    [HttpGet("{id:int}")]
    public async Task&lt;ActionResult&lt;Order&gt;&gt; GetById(int id, CancellationToken ct) =&gt;
        await db.Orders.FindAsync(new object[] { id }, ct) is Order o ? o : NotFound();
    [HttpPost]
    public async Task&lt;IActionResult&gt; Create([FromBody] CreateOrderRequest request, CancellationToken ct)
    {
        var order = new Order { CustomerEmail = request.Email, Total = request.Total };
        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);
        // Queued instead of awaited. The client gets a response in milliseconds,
        // and a failing email service no longer fails an order that already exists.
        await queue.QueueAsync(async (services, token) =&gt;
        {
            var email = services.GetRequiredService&lt;IEmailService&gt;();   // resolved in the job's own scope
            await email.SendConfirmationAsync(order.Id, order.CustomerEmail, token);
        });
        return CreatedAtAction(nameof(GetById), new { id = order.Id }, order);
    }
}
public interface IEmailService { Task SendConfirmationAsync(int orderId, string to, CancellationToken ct); }
public class EmailService : IEmailService
{
    private readonly ILogger&lt;EmailService&gt; logger;
    public EmailService(ILogger&lt;EmailService&gt; logger) =&gt; this.logger = logger;
    public async Task SendConfirmationAsync(int orderId, string to, CancellationToken ct)
    {
        await Task.Delay(2000, ct);                        // the two seconds we removed from the request
        logger.LogInformation("Confirmation for order {OrderId} sent to {To}", orderId, to);
    }
}
public record CreateOrderRequest(string Email, decimal Total);
public class Order { public int Id { get; set; } public string CustomerEmail { get; set; } = "";
                     public decimal Total { get; set; } }
public class RefreshToken { public int Id { get; set; } public DateTime ExpiresAt { get; set; } }
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions&lt;AppDbContext&gt; o) : base(o) { }
    public DbSet&lt;Order&gt; Orders =&gt; Set&lt;Order&gt;();
    public DbSet&lt;RefreshToken&gt; RefreshTokens =&gt; Set&lt;RefreshToken&gt;();
}
</code></pre>
