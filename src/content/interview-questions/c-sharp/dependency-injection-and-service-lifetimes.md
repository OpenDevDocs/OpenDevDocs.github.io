---
course: c-sharp
slug: dependency-injection-and-service-lifetimes
experienceLevel: mid
difficulty: medium
tags:
  - design
question: "What is dependency injection, and what are the Transient, Scoped, and Singleton lifetimes?"
answer: |
  **Dependency injection (DI)** means a class receives its dependencies from the outside, usually through its constructor, instead of creating them with `new`. The class depends on abstractions, and a container decides which implementation to supply. That keeps code loosely coupled and easy to unit test with fakes.

  .NET has a built-in container, `Microsoft.Extensions.DependencyInjection`, used by ASP.NET Core and the generic host. Every registration has a lifetime:

  - **Transient:** a new instance every time it's resolved. Good for lightweight, stateless services.
  - **Scoped:** one instance per scope. In ASP.NET Core a scope is one HTTP request, which is why `DbContext` is registered as scoped.
  - **Singleton:** one instance for the whole application. It must be thread-safe.

  The classic pitfall is a **captive dependency**: a singleton that depends on a scoped service keeps that scoped instance alive forever. ASP.NET Core validates scopes by default in the Development environment and throws at startup when it detects this. The container also disposes the `IDisposable` services it creates.
codeExample: |
  using Microsoft.Extensions.DependencyInjection; // NuGet package

  var services = new ServiceCollection();
  services.AddTransient<Transient>();
  services.AddScoped<Scoped>();
  services.AddSingleton<Singleton>();
  using var root = services.BuildServiceProvider(validateScopes: true);

  using var scopeA = root.CreateScope();   // e.g. one HTTP request
  using var scopeB = root.CreateScope();   // another request
  var a = scopeA.ServiceProvider;
  var b = scopeB.ServiceProvider;

  Console.WriteLine(Get<Transient>(a) == Get<Transient>(a)); // Output: False (new)
  Console.WriteLine(Get<Scoped>(a) == Get<Scoped>(a));       // Output: True
  Console.WriteLine(Get<Scoped>(a) == Get<Scoped>(b));       // Output: False
  Console.WriteLine(Get<Singleton>(a) == Get<Singleton>(b)); // Output: True

  object Get<T>(IServiceProvider sp) where T : notnull => sp.GetRequiredService<T>();

  class Transient { }
  class Scoped { }
  class Singleton { }
popularity: 9.4
isPublished: true
---
