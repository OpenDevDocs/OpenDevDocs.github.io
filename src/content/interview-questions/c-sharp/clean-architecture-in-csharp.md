---
course: c-sharp
slug: clean-architecture-in-csharp
experienceLevel: senior
difficulty: hard
tags:
  - design
question: "How would you structure a large C# solution using Clean (Onion) Architecture?"
answer: |
  Clean Architecture organizes code in concentric layers, with one rule: **source dependencies point inward**. Business rules never depend on frameworks, databases, or the UI. A typical .NET solution uses one project per layer:

  - **Domain:** entities, value objects, domain events, and business rules, with no references to EF Core, ASP.NET Core, or other infrastructure.
  - **Application:** use cases (commands, queries, and their handlers), DTOs, validation, and the **interfaces** the use cases need, such as `IOrderRepository` or `IEmailSender`. It depends only on Domain.
  - **Infrastructure:** implementations of those interfaces using EF Core, HTTP clients, and message brokers. It depends on Application.
  - **Presentation (API or UI):** ASP.NET Core endpoints or controllers, plus the **composition root** that registers everything in DI.

  Because Application defines the interfaces and Infrastructure implements them (dependency inversion), use cases are testable with fakes and infrastructure is replaceable without touching business logic. Enforce the rules with project references, and add **architecture tests**, for example with NetArchTest, so violations fail the build.

  The trade-off is ceremony: more projects, more mapping, and more indirection. For small apps or CRUD services it's often overkill. Many teams prefer **vertical slice architecture**, organizing code by feature, or combine slices with the dependency rule.
codeExample: |
  // Solution layout (arrows = project references, always pointing inward)
  //   Shop.Api            -> Shop.Application, Shop.Infrastructure (composition root)
  //   Shop.Infrastructure -> Shop.Application
  //   Shop.Application    -> Shop.Domain
  //   Shop.Domain         -> (nothing)
  // Shop.Application: the use case owns the abstraction it needs
  public interface IOrderRepository
  {
      Task<Order?> FindAsync(Guid id, CancellationToken ct);
      Task SaveAsync(Order order, CancellationToken ct);
  }

  public sealed class CancelOrderHandler(IOrderRepository orders)
  {
      public async Task HandleAsync(Guid orderId, CancellationToken ct)
      {
          var order = await orders.FindAsync(orderId, ct)
              ?? throw new KeyNotFoundException($"Order {orderId} not found");
          order.Cancel();                      // the business rule lives in Domain
          await orders.SaveAsync(order, ct);
      }
  }

  // Shop.Infrastructure: EfOrderRepository : IOrderRepository (uses the DbContext)
  // Shop.Api: builder.Services.AddScoped<IOrderRepository, EfOrderRepository>();
popularity: 8.0
isPublished: true
---
