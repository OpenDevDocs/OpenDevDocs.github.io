---
course: c-sharp
slug: cqrs-and-mediator-pattern
experienceLevel: senior
difficulty: hard
tags:
  - design
question: "What is CQRS, and how is the mediator pattern commonly used in .NET applications?"
answer: |
  **CQRS** (Command Query Responsibility Segregation) separates operations that change state from operations that read it:

  - **Commands**, such as `PlaceOrder`, change state. They go through the domain model, enforce invariants, and return little more than an ID or a success result.
  - **Queries**, such as `GetOrderSummary`, return DTOs shaped for the screen and can bypass the domain model, using projections, raw SQL, or a denormalized read store.

  Each side can then be optimized independently: reads get lean projections, caching, or replicas, while writes keep rich domain logic. CQRS doesn't require separate databases or event sourcing. Those are optional, and a separate read store brings eventual consistency you must design for.

  The **mediator pattern** is a common way to organize this in .NET. Each command or query is a small request object with exactly one handler, and endpoints send requests to a mediator instead of calling services directly. The mediator's **pipeline behaviors** apply cross-cutting concerns such as validation, logging, and transactions to every request in one place. Libraries such as MediatR provide this, and a small hand-rolled dispatcher works too.

  The costs are more files and extra indirection. Use it where the structure pays off, not for every CRUD endpoint.
codeExample: |
  // A minimal hand-rolled mediator contract: one handler per request type
  public interface IRequest<TResult> { }
  public interface IHandler<TRequest, TResult> where TRequest : IRequest<TResult>
  {
      Task<TResult> HandleAsync(TRequest request, CancellationToken ct);
  }

  // Command: changes state through the domain model
  public record PlaceOrder(Guid CustomerId, string Sku, int Qty) : IRequest<Guid>;

  public sealed class PlaceOrderHandler(ShopDbContext db) : IHandler<PlaceOrder, Guid>
  {
      public async Task<Guid> HandleAsync(PlaceOrder cmd, CancellationToken ct)
      {
          var order = Order.Create(cmd.CustomerId, cmd.Sku, cmd.Qty); // invariants here
          db.Orders.Add(order);
          await db.SaveChangesAsync(ct);
          return order.Id;
      }
  }

  // Query: a lean read-side projection that bypasses the domain model
  public record GetOrderSummary(Guid Id) : IRequest<OrderSummaryDto?>;
  // Its handler: db.Orders.AsNoTracking().Where(o => o.Id == q.Id)
  //   .Select(o => new OrderSummaryDto(o.Id, o.Total)).SingleOrDefaultAsync(ct)
popularity: 7.6
isPublished: true
---
