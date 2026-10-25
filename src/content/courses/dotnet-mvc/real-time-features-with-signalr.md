---
publishDate: 2026-08-26T14:40
title: Real Time Features with SignalR
slug: real-time-features-with-signalr
metadescription: Push updates from the server to the browser the moment they happen with SignalR, create a hub, connect from JavaScript, send messages to everyone, to groups or to one user, and trigger hub messages from controllers with IHubContext.
updateDate: 2026-09-14T14:40
author: ['bishal-biswas']
level: 4
tags: ['signalr', 'real-time', 'websockets']
course: dotnet-mvc
---

## When polling is not enough

A normal web page only changes when the browser asks. If an order status changes on the server, the customer sees it after they refresh. Scripts can poll with `fetch` every few seconds, but that wastes requests and still lags.

**SignalR** lets the server push to the browser instantly. A stock ticker, a chat, live order tracking, a "3 people are viewing this" badge, a progress bar for a long job. All of these are one persistent connection with messages flowing both ways.

Under the hood it uses WebSockets where available and falls back to other transports where not. You never deal with that. You call methods.

## The pieces

- A **hub** is a class on the server. Clients call its methods, and it calls methods on clients.
- The **JavaScript client** connects to the hub and registers handlers for messages from the server.
- `IHubContext` lets code outside the hub, such as a controller, send messages through it.

## Creating a hub

```csharp
using Microsoft.AspNetCore.SignalR;

public class NotificationHub : Hub
{
    public async Task SendMessage(string user, string message)
    {
        await Clients.All.SendAsync("ReceiveMessage", user, message);
    }
}
```

`SendMessage` is a method clients can call. Inside it, `Clients.All.SendAsync("ReceiveMessage", ...)` calls a method named `ReceiveMessage` on every connected client with the two arguments. The name is just a string agreed between server and client.

## Registering it

```csharp
builder.Services.AddSignalR();

var app = builder.Build();

app.MapHub<NotificationHub>("/hubs/notifications");
```

The hub is now reachable at that path. `MapHub` goes alongside `MapControllerRoute`.

## The JavaScript client

Install the client library. The simplest way is the CDN or LibMan:

```cshtml
<script src="https://cdn.jsdelivr.net/npm/@microsoft/signalr@8/dist/browser/signalr.min.js"></script>
```

Connect and listen:

```javascript
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/notifications")
    .withAutomaticReconnect()
    .build();

connection.on("ReceiveMessage", (user, message) => {
    const li = document.createElement("li");
    li.textContent = `${user}: ${message}`;
    document.getElementById("messages").appendChild(li);
});

await connection.start();
```

Call a hub method:

```javascript
await connection.invoke("SendMessage", "Ada", "Hello everyone");
```

`connection.on` registers a handler for a method the server may call. `connection.invoke` calls a method on the hub. `withAutomaticReconnect` handles dropped connections.

## Sending from a controller

Most real time updates are triggered by something that happens in a normal action: an order is shipped, a comment is posted. Inject `IHubContext<T>` and send from there:

```csharp
public class OrdersController : Controller
{
    private readonly IHubContext<NotificationHub> _hub;

    public OrdersController(IHubContext<NotificationHub> hub) => _hub = hub;

    [HttpPost]
    public async Task<IActionResult> Ship(int id)
    {
        // update the order

        await _hub.Clients.All.SendAsync("OrderShipped", id);
        return RedirectToAction("Details", new { id });
    }
}
```

Every connected page that listens for `OrderShipped` updates instantly.

## Groups

Sending to everyone is rarely what you want. **Groups** let you send to a subset. A client joins a group by calling a hub method:

```csharp
public class OrderHub : Hub
{
    public Task WatchOrder(int orderId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, $"order-{orderId}");

    public Task StopWatching(int orderId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, $"order-{orderId}");
}
```

```javascript
await connection.invoke("WatchOrder", 42);
```

Then the controller sends to that group only:

```csharp
await _hub.Clients.Group($"order-{id}").SendAsync("StatusChanged", "Shipped");
```

Group membership lives only as long as the connection. When a user reloads the page, the script must join again.

## Sending to one user

If the app uses authentication, SignalR knows who each connection belongs to. `Clients.User(userId)` sends to every connection for that user:

```csharp
await _hub.Clients.User(customerId).SendAsync("Notify", "Your order has shipped");
```

The user id comes from the `ClaimTypes.NameIdentifier` claim. Protect the hub with `[Authorize]` like a controller, and `Context.User` inside the hub gives you the caller.

## Strongly typed hubs

String method names are easy to mistype. A typed hub uses an interface for the client methods:

```csharp
public interface INotificationClient
{
    Task ReceiveMessage(string user, string message);
    Task OrderShipped(int orderId);
}

public class NotificationHub : Hub<INotificationClient>
{
    public Task SendMessage(string user, string message) =>
        Clients.All.ReceiveMessage(user, message);
}
```

Now `Clients.All.ReceiveMessage(...)` is a real method call checked by the compiler. Inject `IHubContext<NotificationHub, INotificationClient>` in controllers.

## Connection lifecycle

Override these in the hub to react to connections:

```csharp
public override async Task OnConnectedAsync()
{
    await Clients.Others.SendAsync("UserJoined", Context.User?.Identity?.Name);
    await base.OnConnectedAsync();
}

public override async Task OnDisconnectedAsync(Exception? exception)
{
    await Clients.Others.SendAsync("UserLeft", Context.User?.Identity?.Name);
    await base.OnDisconnectedAsync(exception);
}
```

Hubs are transient. A new instance is created for each method call, so do not keep state in fields. Use a singleton service or a static dictionary for shared state such as a list of online users.

## Scaling out

With one server, SignalR keeps connections in memory. With several servers behind a load balancer, a message sent from server A does not reach clients connected to server B. Add a backplane so all servers share messages:

```csharp
builder.Services.AddSignalR().AddStackExchangeRedis(connectionString);
```

Or use Azure SignalR Service, which handles connections for you.

## Quick recap

- SignalR keeps a persistent connection so the server can push to the browser instantly.
- A hub is a server class with methods clients call, and `Clients.*.SendAsync` calls methods on clients.
- Register with `AddSignalR` and `MapHub`, and connect from JavaScript with `HubConnectionBuilder`.
- Inject `IHubContext<T>` into controllers to send messages when something happens in an action.
- Use groups for subsets of clients and `Clients.User` for one authenticated user.
- Typed hubs replace string method names with an interface, and a Redis backplane is needed for multiple servers.

<code id="code-content" class="language-csharp">
// Hubs/INotificationClient.cs
public interface INotificationClient
{
    Task ReceiveMessage(string user, string message);
    Task OrderStatusChanged(int orderId, string status);
    Task ViewerCount(int count);
}

// Hubs/NotificationHub.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

[Authorize]
public class NotificationHub : Hub&lt;INotificationClient&gt;
{
    private readonly IOnlineTracker _online;
    public NotificationHub(IOnlineTracker online) =&gt; _online = online;

    public Task SendMessage(string message)
    {
        var user = Context.User?.Identity?.Name ?? "Anonymous";
        return Clients.All.ReceiveMessage(user, message);
    }

    public Task WatchOrder(int orderId) =&gt;
        Groups.AddToGroupAsync(Context.ConnectionId, $"order-{orderId}");

    public override async Task OnConnectedAsync()
    {
        var count = _online.Add(Context.ConnectionId);
        await Clients.All.ViewerCount(count);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var count = _online.Remove(Context.ConnectionId);
        await Clients.All.ViewerCount(count);
        await base.OnDisconnectedAsync(exception);
    }
}

// Services/OnlineTracker.cs (singleton: hubs are transient, so state lives here)
public interface IOnlineTracker { int Add(string id); int Remove(string id); }

public class OnlineTracker : IOnlineTracker
{
    private readonly HashSet&lt;string&gt; _ids = new();
    private readonly object _lock = new();

    public int Add(string id) { lock (_lock) { _ids.Add(id); return _ids.Count; } }
    public int Remove(string id) { lock (_lock) { _ids.Remove(id); return _ids.Count; } }
}

// Program.cs
builder.Services.AddSignalR();
builder.Services.AddSingleton&lt;IOnlineTracker, OnlineTracker&gt;();
// ...
app.MapHub&lt;NotificationHub&gt;("/hubs/notifications");
app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");

// Controllers/OrdersController.cs
public class OrdersController : Controller
{
    private readonly AppDbContext _db;
    private readonly IHubContext&lt;NotificationHub, INotificationClient&gt; _hub;

    public OrdersController(AppDbContext db, IHubContext&lt;NotificationHub, INotificationClient&gt; hub)
    {
        _db = db;
        _hub = hub;
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task&lt;IActionResult&gt; Ship(int id)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order is null) return NotFound();

        order.Status = "Shipped";
        await _db.SaveChangesAsync();

        await _hub.Clients.Group($"order-{id}").OrderStatusChanged(id, "Shipped");
        await _hub.Clients.User(order.CustomerId).ReceiveMessage("Shop", $"Order {id} has shipped!");

        return RedirectToAction("Details", new { id });
    }
}

// Views/Orders/Details.cshtml
//
//   &lt;p&gt;Status: &lt;span id="status"&gt;@Model.Status&lt;/span&gt;&lt;/p&gt;
//   &lt;p&gt;&lt;span id="viewers"&gt;0&lt;/span&gt; people online&lt;/p&gt;
//   @section Scripts {
//       &lt;script src="https://cdn.jsdelivr.net/npm/@microsoft/signalr@8/dist/browser/signalr.min.js"&gt;&lt;/script&gt;
//       &lt;script&gt;
//           const connection = new signalR.HubConnectionBuilder()
//               .withUrl("/hubs/notifications")
//               .withAutomaticReconnect()
//               .build();
//
//           connection.on("OrderStatusChanged", (orderId, status) =&gt; {
//               document.getElementById("status").textContent = status;
//           });
//           connection.on("ViewerCount", (count) =&gt; {
//               document.getElementById("viewers").textContent = count;
//           });
//           connection.on("ReceiveMessage", (user, message) =&gt; {
//               console.log(user + ": " + message);
//           });
//
//           connection.start().then(() =&gt; connection.invoke("WatchOrder", @Model.Id));
//       &lt;/script&gt;
//   }
</code></pre>
