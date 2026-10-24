---
course: c-sharp
slug: static-class-vs-singleton
experienceLevel: mid
difficulty: medium
tags:
  - design
  - oop
question: "What is the difference between a static class and a singleton?"
answer: |
  Both give you one shared thing, but a **singleton is an object** and a **static class isn't**, and that difference drives everything else.

  A singleton:

  - Can implement interfaces and inherit from a base class, so it supports polymorphism.
  - Can be passed as a parameter, stored in a field, and injected through DI.
  - Can be replaced with a fake in unit tests when consumers depend on its interface.
  - Can be created lazily, with controlled construction (for example through `Lazy<T>`).

  A static class:

  - Can't be instantiated, implement interfaces, or be inherited, and all its members are static.
  - Is initialized by the runtime before first use, through its static constructor or field initializers.
  - Can't be swapped out in tests, so code that calls it is harder to isolate.

  Use a static class for stateless helpers such as `Math` or extension methods. Use a singleton, ideally one registered in DI, when the shared object has state, dependencies, or needs a contract. Both hold global state, so both must be thread-safe.
codeExample: |
  // Static class: stateless helpers, called directly through the type name
  public static class Slug
  {
      public static string From(string title) =>
          title.Trim().ToLowerInvariant().Replace(' ', '-');
  }

  // Singleton behind an interface: one instance, but replaceable in tests
  public interface IFeatureFlags { bool IsEnabled(string feature); }

  public sealed class FeatureFlags : IFeatureFlags
  {
      private readonly HashSet<string> _enabled = ["new-checkout"];
      public bool IsEnabled(string feature) => _enabled.Contains(feature);
  }

  public class CheckoutPage(IFeatureFlags flags)   // depends on the contract
  {
      public string Render() => flags.IsEnabled("new-checkout") ? "v2" : "v1";
  }

  // Registration: services.AddSingleton<IFeatureFlags, FeatureFlags>();
  // Test:         new CheckoutPage(new FakeFlags()).Render();
popularity: 8.0
isPublished: true
---
