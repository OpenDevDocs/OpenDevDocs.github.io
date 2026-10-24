---
publishDate: 2026-09-26T18:00
title: Real Time Updates with SignalR
slug: real-time-updates-with-signalr
metadescription: Push data from the server to clients with SignalR. Build a hub, send to groups and users, call it from a controller, secure it with JWT, and scale it across instances.
updateDate: 2026-09-07T18:00
author: ['bishal-biswas']
level: 4
tags: ['signalr', 'websockets', 'real-time']
course: dotnet-webapi
---

## The problem with polling

A REST API is request and response. The client asks, the server answers. The server cannot start a conversation.

So for live data, clients poll:

```javascript
setInterval(() => fetch('/api/orders/status').then(update), 3000);
```

With 1000 users that is 20,000 requests a minute, and almost every one answers "nothing changed". You get load you do not need and updates up to three seconds late.

**SignalR** flips it. The server pushes to clients the moment something happens.

## What SignalR chooses for you

SignalR picks the best available transport and falls back automatically:

1. **WebSockets**, a genuine two way connection. Used whenever possible.
2. **Server Sent Events**, one way from server to client.
3. **Long polling**, a held request that returns when there is data.

You write the same code either way. That fallback handling is most of SignalR's value over using WebSockets directly.

## A hub

A **hub** is the server side class clients connect to and call methods on:

```csharp
using Microsoft.AspNetCore.SignalR;

public class OrderHub : Hub
{
    // Clients call this
    public async Task SubscribeToOrder(int orderId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"order-{orderId}");
    }

    public async Task UnsubscribeFromOrder(int orderId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"order-{orderId}");
    }

    public override async Task OnConnectedAsync()
    {
        if (Context.UserIdentifier is not null)
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{Context.UserIdentifier}");

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await base.OnDisconnectedAsync(exception);
    }
}
```

Register and map it:

```csharp
builder.Services.AddSignalR();

var app = builder.Build();

app.MapHub<OrderHub>("/hubs/orders");
```

## Typed hubs

`Hub` sends messages by string name, which is a typo waiting to happen:

```csharp
await Clients.All.SendAsync("OrderStatusChanged", orderId, status);   // no compiler help
```

Define an interface for what the client can receive:

```csharp
public interface IOrderClient
{
    Task OrderStatusChanged(int orderId, string status);
    Task OrderShipped(int orderId, string trackingNumber);
    Task Notification(string message);
}

public class OrderHub : Hub<IOrderClient>
{
    public async Task SubscribeToOrder(int orderId)
        => await Groups.AddToGroupAsync(Context.ConnectionId, $"order-{orderId}");
}
```

Now sending is compiler checked:

```csharp
await Clients.Group($"order-{orderId}").OrderStatusChanged(orderId, "Shipped");
```

Rename a method and every call site updates. Always use `Hub<T>`.

## Who to send to

```csharp
await Clients.All.Notification("Maintenance in 10 minutes.");

await Clients.Caller.Notification("Subscribed.");

await Clients.Others.Notification("Someone joined.");

await Clients.Client(connectionId).Notification("Just you.");

await Clients.Group("order-42").OrderStatusChanged(42, "Shipped");

await Clients.GroupExcept("order-42", Context.ConnectionId)
             .OrderStatusChanged(42, "Shipped");

await Clients.User(userId).Notification("Your order shipped.");
```

`Clients.User` is the useful one. It reaches **every** connection that user has, so a message arrives on their phone and their laptop at once. SignalR maps the user id from the `NameIdentifier` claim.

## Groups

A group is a named set of connections. Adding is cheap and needs no setup:

```csharp
await Groups.AddToGroupAsync(Context.ConnectionId, "order-42");
```

Two things to know. Group membership is **per connection**, not per user, so a reconnect loses it. Rejoin in `OnConnectedAsync` or have the client resubscribe.

And group membership is stored in memory per server. With several instances you need a backplane, covered below.

## Sending from a controller

Most pushes originate from ordinary API code, not from the hub. Inject `IHubContext`:

```csharp
[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly IHubContext<OrderHub, IOrderClient> hub;

    public OrdersController(IHubContext<OrderHub, IOrderClient> hub) => this.hub = hub;

    [HttpPost("{id:int}/ship")]
    public async Task<IActionResult> Ship(int id, ShipRequest request, CancellationToken ct)
    {
        Order order = await service.ShipAsync(id, request.TrackingNumber, ct);

        // Everyone watching this order
        await hub.Clients.Group($"order-{id}")
                 .OrderShipped(id, request.TrackingNumber);

        // And the customer, on every device
        await hub.Clients.User(order.CustomerId.ToString())
                 .Notification($"Order {id} has shipped.");

        return NoContent();
    }
}
```

Note the two type arguments: `IHubContext<OrderHub, IOrderClient>`. With one, you are back to string method names.

## The client

```javascript
const connection = new signalR.HubConnectionBuilder()
    .withUrl('/hubs/orders', { accessTokenFactory: () => getToken() })
    .withAutomaticReconnect([0, 2000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Information)
    .build();

connection.on('OrderStatusChanged', (orderId, status) => {
    document.querySelector(`#order-${orderId} .status`).textContent = status;
});

connection.on('Notification', message => showToast(message));

connection.onreconnected(() => {
    // Group membership is per connection and is LOST on reconnect
    currentOrderIds.forEach(id => connection.invoke('SubscribeToOrder', id));
});

await connection.start();
await connection.invoke('SubscribeToOrder', 42);
```

`withAutomaticReconnect` handles dropped connections. The `onreconnected` handler is essential, because groups do not survive.

## Authentication

The hub uses the same authentication as the rest of your API:

```csharp
[Authorize]
public class OrderHub : Hub<IOrderClient> { }
```

With one complication. WebSockets cannot set an `Authorization` header, so the token arrives in the query string. Read it explicitly:

```csharp
builder.Services.AddAuthentication()
    .AddJwtBearer(options =>
    {
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                string? token = context.Request.Query["access_token"];

                if (!string.IsNullOrEmpty(token) &&
                    context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                {
                    context.Token = token;
                }

                return Task.CompletedTask;
            }
        };
    });
```

The path check matters. Without it, any request could authenticate with a query string token, which then appears in server logs, browser history and proxy logs.

## CORS

SignalR needs `AllowCredentials`, which means you cannot use `AllowAnyOrigin`:

```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy
        .WithOrigins("https://app.example.com")     // explicit, never AllowAnyOrigin
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});
```

## Scaling out

Here is the constraint that catches people in production.

SignalR keeps connections **in memory on one server**. With three instances behind a load balancer, a client connected to instance A never receives a message sent from instance B.

A **backplane** fixes it by relaying messages between instances:

```bash
dotnet add package Microsoft.AspNetCore.SignalR.StackExchangeRedis
```

```csharp
builder.Services.AddSignalR()
    .AddStackExchangeRedis(builder.Configuration.GetConnectionString("Redis")!);
```

That one line is all it takes. Every instance publishes to Redis and every instance subscribes.

**Azure SignalR Service** goes further and holds the connections itself, so your API instances stay stateless and can scale freely:

```csharp
builder.Services.AddSignalR().AddAzureSignalR(connectionString);
```

You also need **sticky sessions** on the load balancer unless you use Azure SignalR Service, because the initial negotiate request and the connection must reach the same instance.

## When not to use SignalR

Being honest about the cost. A persistent connection per client is not free: memory, a file descriptor, and a load balancer that must handle long lived connections.

**Do not use it** when polling every thirty seconds is good enough, when updates are rare, or when clients cannot hold a connection.

**Do use it** for chat, live dashboards, collaborative editing, progress on a long job, and notifications where seconds matter.

A middle option worth knowing: **Server Sent Events** are a plain HTTP standard, one way, and need no library. If you only push server to client and can require a modern browser, SSE is simpler.

## Quick recap

- SignalR pushes from server to client instead of making clients poll.
- It negotiates WebSockets, Server Sent Events or long polling automatically.
- A hub is the class clients connect to. Always use `Hub<T>` so message names are compiler checked.
- Send to `All`, `Caller`, `Group`, `Client` or `User`. `User` reaches every device that person has.
- Groups are per connection and are lost on reconnect. Resubscribe in `onreconnected`.
- Inject `IHubContext<THub, TClient>` to push from a controller or service.
- WebSockets cannot send an `Authorization` header, so read the token from the query string, restricted to your hub path.
- CORS needs `AllowCredentials`, so origins must be listed explicitly.
- Connections live on one server. Add a Redis backplane or Azure SignalR Service to scale out, plus sticky sessions.
- Do not use it when polling every thirty seconds would do.

<code id="code-content" class="language-csharp">
// SignalR end to end: a typed hub, pushes from a controller, JWT and scale out.
// dotnet add package Microsoft.AspNetCore.SignalR.StackExchangeRedis
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
// Connections live in memory on ONE server. Without a backplane, a client on
// instance A never sees a message sent from instance B.
builder.Services.AddSignalR(options =&gt;
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.KeepAliveInterval    = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
})
.AddStackExchangeRedis(builder.Configuration.GetConnectionString("Redis") ?? "localhost");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =&gt;
    {
        options.Events = new JwtBearerEvents
        {
            // WebSockets cannot set an Authorization header, so the token comes
            // in the query string. The PATH CHECK matters: without it, any
            // endpoint would accept a query string token, and those end up in
            // server logs, browser history and proxy logs.
            OnMessageReceived = context =&gt;
            {
                string? token = context.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) &amp;&amp;
                    context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                {
                    context.Token = token;
                }
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();
// SignalR requires AllowCredentials, which forbids AllowAnyOrigin
builder.Services.AddCors(o =&gt; o.AddDefaultPolicy(p =&gt; p
    .WithOrigins("https://app.example.com")
    .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
var app = builder.Build();
app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub&lt;OrderHub&gt;("/hubs/orders");
app.Run();
// The contract for what a client can RECEIVE. Using Hub&lt;T&gt; instead of Hub means
// a renamed method is a compile error rather than a message nobody receives.
public interface IOrderClient
{
    Task OrderStatusChanged(int orderId, string status);
    Task OrderShipped(int orderId, string trackingNumber);
    Task Notification(string message);
}
[Authorize]
public class OrderHub : Hub&lt;IOrderClient&gt;
{
    private readonly ILogger&lt;OrderHub&gt; logger;
    public OrderHub(ILogger&lt;OrderHub&gt; logger) =&gt; this.logger = logger;
    // Clients call this to start watching one order
    public async Task SubscribeToOrder(int orderId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"order-{orderId}");
        await Clients.Caller.Notification($"Watching order {orderId}.");
    }
    public Task UnsubscribeFromOrder(int orderId) =&gt;
        Groups.RemoveFromGroupAsync(Context.ConnectionId, $"order-{orderId}");
    public override async Task OnConnectedAsync()
    {
        logger.LogInformation("Connected {ConnectionId} as user {User}",
            Context.ConnectionId, Context.UserIdentifier ?? "anonymous");
        // Group membership is PER CONNECTION and is lost on reconnect,
        // so rejoin the per user group every time.
        if (Context.UserIdentifier is not null)
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{Context.UserIdentifier}");
        await base.OnConnectedAsync();
    }
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception is not null)
            logger.LogWarning(exception, "{ConnectionId} dropped", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    // TWO type arguments. With one, you are back to string method names.
    private readonly IHubContext&lt;OrderHub, IOrderClient&gt; hub;
    public OrdersController(IHubContext&lt;OrderHub, IOrderClient&gt; hub) =&gt; this.hub = hub;
    [HttpPost("{id:int}/ship")]
    [Authorize(Roles = "Warehouse")]
    public async Task&lt;IActionResult&gt; Ship(int id, [FromBody] ShipRequest request, CancellationToken ct)
    {
        string customerId = "42";                       // from your service in real code
        // Everyone watching this specific order
        await hub.Clients.Group($"order-{id}").OrderShipped(id, request.TrackingNumber);
        // And the customer on EVERY device they have open
        await hub.Clients.User(customerId).Notification($"Order {id} has shipped.");
        return NoContent();
    }
    [HttpPost("broadcast")]
    [Authorize(Roles = "Admin")]
    public async Task&lt;IActionResult&gt; Broadcast([FromBody] string message)
    {
        await hub.Clients.All.Notification(message);
        return NoContent();
    }
}
public record ShipRequest(string TrackingNumber);
/* The browser client:
const connection = new signalR.HubConnectionBuilder()
    .withUrl('/hubs/orders', { accessTokenFactory: () =&gt; getToken() })
    .withAutomaticReconnect([0, 2000, 10000, 30000])
    .build();
connection.on('OrderShipped', (orderId, tracking) =&gt; showTracking(orderId, tracking));
connection.on('Notification', message =&gt; showToast(message));
// ESSENTIAL: group membership does not survive a reconnect
connection.onreconnected(() =&gt; {
    watchedOrderIds.forEach(id =&gt; connection.invoke('SubscribeToOrder', id));
});
await connection.start();
await connection.invoke('SubscribeToOrder', 42);
   Also needed when scaling out: sticky sessions on the load balancer, so the
   negotiate request and the connection reach the same instance. Azure SignalR
   Service removes that requirement by holding the connections itself.
*/
</code></pre>
