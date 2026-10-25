---
course: c-sharp
slug: designing-testable-code
experienceLevel: senior
difficulty: medium
tags:
  - design
question: "How do you design C# code so that it is easy to unit test?"
answer: |
  Testable code is mostly code whose **dependencies are explicit and replaceable**, and whose logic is **separated from I/O**.

  Key practices:

  - **Inject dependencies through the constructor**, as interfaces or abstract types, instead of creating them with `new` inside methods. Tests pass fakes, and the class's needs are visible in its signature.
  - **Remove hidden dependencies.** Static calls such as `DateTime.Now`, `Guid.NewGuid()`, and `File.ReadAllText` make behavior impossible to control in a test, so wrap them behind abstractions. For time, .NET 8 provides **`TimeProvider`**, with `FakeTimeProvider` for tests.
  - **Keep business rules in pure functions or small classes** that take data in and return results, with no I/O. They're trivial to test exhaustively. Push databases, HTTP, and file access to thin edges.
  - **Don't mock what you don't own.** Wrap `HttpClient` or `DbContext` in your own narrow interface, or cover them with integration tests. For `HttpClient`, a stub `HttpMessageHandler` works well.
  - **Test behavior through public APIs**, not private methods. A private method that needs its own tests probably wants its own class.
  - **Favor small, single-purpose classes.** A constructor with eight dependencies is a design smell that tests make visible.
codeExample: |
  using Microsoft.Extensions.Time.Testing;   // NuGet package

  // Production code: time is an injected dependency, not DateTime.Now
  public sealed class SubscriptionService(TimeProvider clock)
  {
      public bool IsExpired(Subscription s) => clock.GetUtcNow() >= s.ExpiresAt;
  }

  public record Subscription(DateTimeOffset ExpiresAt);

  // Test (xUnit): control time precisely, with no sleeping and no flakiness
  public class SubscriptionServiceTests
  {
      [Fact]
      public void Expires_exactly_at_the_deadline()
      {
          var clock = new FakeTimeProvider(DateTimeOffset.Parse("2026-01-01T00:00Z"));
          var service = new SubscriptionService(clock);
          var sub = new Subscription(clock.GetUtcNow().AddDays(30));
          Assert.False(service.IsExpired(sub));
          clock.Advance(TimeSpan.FromDays(30));      // jump forward instantly
          Assert.True(service.IsExpired(sub));
      }
  }
  // In the app: services.AddSingleton(TimeProvider.System);
popularity: 7.4
isPublished: true
---
