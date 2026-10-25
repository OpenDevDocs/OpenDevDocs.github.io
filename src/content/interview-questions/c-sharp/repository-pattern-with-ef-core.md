---
course: c-sharp
slug: repository-pattern-with-ef-core
experienceLevel: senior
difficulty: medium
tags:
  - design
question: "Is the Repository pattern still useful on top of EF Core?"
answer: |
  It depends on what the repository adds. EF Core already implements both patterns: a `DbSet<T>` acts as a **repository**, and `DbContext` is a **Unit of Work** that tracks changes and commits them together in `SaveChanges`.

  **Generic repositories** (`IRepository<T>` with `GetById`, `GetAll`, `Add`, and `Delete`) on top of EF Core usually add little. Either they return `IQueryable<T>`, which leaks EF Core's query semantics anyway, or they hide useful features such as `Include`, projections with `Select`, and `AsNoTracking`.

  Repositories still earn their place when they're **specific and intention-revealing**:

  - In **DDD**, one repository per **aggregate root**, such as `IOrderRepository.GetWithLinesAsync(id)`, guarantees that aggregates load and save as a consistent unit.
  - They keep persistence concerns out of the domain and application layers.
  - They give a clear seam for faking data access in unit tests.

  For testing, don't rely on mocking `DbSet` or on the EF Core InMemory provider, which doesn't behave like a relational database. Prefer integration tests against a real engine, such as SQL Server in Testcontainers.

  A pragmatic approach: use `DbContext` directly in query handlers and read paths, and add aggregate-specific repositories where the domain logic lives.
codeExample: |
  // A generic IRepository<T> with GetAll() adds little and hides EF Core features

  // Aggregate-specific repository: intention-revealing, loads a consistent aggregate
  public interface IOrderRepository
  {
      Task<Order?> GetWithLinesAsync(int orderId, CancellationToken ct);
      void Add(Order order);
  }

  public sealed class EfOrderRepository(ShopDbContext db) : IOrderRepository
  {
      public Task<Order?> GetWithLinesAsync(int orderId, CancellationToken ct) =>
          db.Orders.Include(o => o.Lines).SingleOrDefaultAsync(o => o.Id == orderId, ct);
      public void Add(Order order) => db.Orders.Add(order);  // DbContext = unit of work
  }

  // Read side: skip the repository and project straight from the DbContext
  public sealed class OrderQueries(ShopDbContext db)
  {
      public Task<List<OrderSummary>> RecentAsync(CancellationToken ct) =>
          db.Orders.AsNoTracking()
              .OrderByDescending(o => o.CreatedAt).Take(20)
              .Select(o => new OrderSummary(o.Id, o.Total)).ToListAsync(ct);
  }
popularity: 7.8
isPublished: true
---
