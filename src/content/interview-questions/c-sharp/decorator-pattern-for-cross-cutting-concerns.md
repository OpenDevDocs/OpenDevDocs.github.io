---
course: c-sharp
slug: decorator-pattern-for-cross-cutting-concerns
experienceLevel: senior
difficulty: medium
tags:
  - design
question: "How do you add cross-cutting concerns such as caching or logging using the Decorator pattern?"
answer: |
  A **decorator** implements the same interface as the service it wraps, holds a reference to that inner instance, and adds behavior before or after delegating to it. Callers depend on the interface, so they can't tell the difference.

  That makes it a clean way to add **cross-cutting concerns** without touching business code:

  - **Caching:** return a cached value, or call the inner service and store the result.
  - **Logging and metrics:** time the call and log its inputs and outputs.
  - **Resilience:** retries or timeouts around an unreliable dependency.
  - **Authorization or validation** checks before the real work runs.

  Each decorator does one thing, which keeps the core service focused on its single responsibility, and decorators **compose**: a caching decorator can wrap a logging decorator that wraps the real implementation.

  Wiring them up with the built-in DI container takes a factory registration, because it has no decorator API. The **Scrutor** library adds `services.Decorate<IService, CachingDecorator>()`.

  Alternatives for the same goal include middleware and endpoint filters in ASP.NET Core, mediator pipeline behaviors, `DispatchProxy` for dynamic proxies, and source-generated proxies. Decorators are the most explicit option when only a few interfaces need the behavior.
codeExample: |
  using Microsoft.Extensions.Caching.Memory;
  using Microsoft.Extensions.DependencyInjection;

  var services = new ServiceCollection().AddMemoryCache();
  services.AddScoped<WeatherService>();                      // the real implementation
  services.AddScoped<IWeatherService>(sp => new CachedWeatherService(   // the decorator
      sp.GetRequiredService<WeatherService>(), sp.GetRequiredService<IMemoryCache>()));
  // Scrutor: services.AddScoped<IWeatherService, WeatherService>()
  //              .Decorate<IWeatherService, CachedWeatherService>();

  public interface IWeatherService { Task<int> GetTemperatureAsync(string city); }
  public class WeatherService : IWeatherService              // the real, slow service
  {
      public Task<int> GetTemperatureAsync(string city) => Task.FromResult(21);
  }
  public class CachedWeatherService(IWeatherService inner, IMemoryCache cache)
      : IWeatherService
  {
      public Task<int> GetTemperatureAsync(string city) =>
          cache.GetOrCreateAsync($"temp:{city}", entry =>
          {
              entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
              return inner.GetTemperatureAsync(city);        // delegate on a cache miss
          });
  }
popularity: 7.5
isPublished: true
---
