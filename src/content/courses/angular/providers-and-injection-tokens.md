---
publishDate: 2026-06-10T08:40
title: Providers, Injection Tokens and Scopes
slug: providers-and-injection-tokens
metadescription: Register dependencies with useValue, useClass, useExisting and useFactory, and create tokens for things that are not classes.
updateDate: 2026-09-07T08:40
author: ['bishal-biswas']
level: 2
tags: ['dependency injection', 'providers', 'tokens']
course: angular
---

## A provider is a recipe

A provider tells Angular how to create something when a token is requested.

```typescript
providers: [UserService]
```

That shorthand means "when someone asks for `UserService`, build a `UserService`". The full form makes it explicit:

```typescript
providers: [
  { provide: UserService, useClass: UserService },
]
```

Once they are separate, you can swap the implementation without changing a single consumer.

## The four provider types

**`useClass`** builds an instance of a class.

```typescript
{ provide: Logger, useClass: ConsoleLogger }
{ provide: Logger, useClass: NoopLogger }      // in tests
```

Everything injecting `Logger` gets whatever you configured. `Logger` can be an abstract class acting as an interface:

```typescript
export abstract class Logger {
  abstract write(message: string): void;
}

@Injectable()
export class ConsoleLogger extends Logger {
  write(message: string): void { console.log(message); }
}
```

Abstract classes work as tokens because they exist at runtime, unlike interfaces.

**`useValue`** supplies an object you already have.

```typescript
{ provide: API_URL, useValue: 'https://api.example.com' }
{ provide: FEATURE_FLAGS, useValue: { darkMode: true } }
{ provide: UserService, useValue: fakeUserService }     // very common in tests
```

**`useExisting`** aliases one token to another, sharing a single instance.

```typescript
{ provide: Logger, useClass: ConsoleLogger },
{ provide: DebugSink, useExisting: Logger },
```

Both tokens now return the **same** object. With `useClass` you would get two separate instances, which is a subtle and annoying bug.

```typescript
// two instances, probably not what you wanted
{ provide: Logger, useClass: ConsoleLogger },
{ provide: DebugSink, useClass: ConsoleLogger },
```

**`useFactory`** runs a function.

```typescript
{
  provide: HttpService,
  useFactory: () => {
    const url = inject(API_URL);
    const http = inject(HttpClient);
    return new HttpService(http, url);
  },
}
```

Use it when construction needs logic: reading configuration, choosing between implementations, or wrapping a third party object.

```typescript
{
  provide: StorageService,
  useFactory: () => {
    return typeof localStorage !== 'undefined'
      ? new BrowserStorage()
      : new MemoryStorage();
  },
}
```

The older `deps` array is no longer needed, since `inject()` works inside a factory.

```typescript
// old
{ provide: HttpService, useFactory: (h: HttpClient) => new HttpService(h), deps: [HttpClient] }

// new
{ provide: HttpService, useFactory: () => new HttpService(inject(HttpClient)) }
```

## Injection tokens

Interfaces and primitives cannot be tokens, because they have no runtime existence. `InjectionToken` solves it.

```typescript
import { InjectionToken } from '@angular/core';

export const API_URL = new InjectionToken<string>('API_URL');

export interface AppConfig {
  apiUrl: string;
  retries: number;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
```

The string is a description used in error messages, not an identifier. Two tokens with the same description are still different tokens.

```typescript
providers: [
  { provide: API_URL, useValue: '/api' },
  { provide: APP_CONFIG, useValue: { apiUrl: '/api', retries: 3 } },
]
```

```typescript
private readonly config = inject(APP_CONFIG);    // typed as AppConfig
```

## Tokens with a default factory

A token can supply its own default, which makes it tree shakeable and removes the need to register it.

```typescript
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
```

Now `inject(API_URL)` works with no provider at all, and can still be overridden:

```typescript
providers: [{ provide: API_URL, useValue: 'https://staging.example.com/api' }]
```

This is the pattern Angular itself uses for configurable defaults.

## Multi providers

`multi: true` collects several values under one token into an array.

```typescript
export const VALIDATORS = new InjectionToken<Validator[]>('VALIDATORS');

providers: [
  { provide: VALIDATORS, useClass: EmailValidator, multi: true },
  { provide: VALIDATORS, useClass: LengthValidator, multi: true },
]
```

```typescript
private readonly validators = inject(VALIDATORS);   // Validator[]
```

Angular uses this for `HTTP_INTERCEPTORS`, `APP_INITIALIZER` and route guards. It lets several independent parts of an application each contribute without knowing about the others.

**Mixing `multi: true` and plain providers on one token is an error.** Pick one.

## Where providers live

```text
appConfig providers        the whole application, one instance
route providers            that route and its children
component providers        that component instance and its subtree
directive providers        that element
```

```typescript
// application wide
export const appConfig: ApplicationConfig = {
  providers: [{ provide: API_URL, useValue: '/api' }],
};

// a route subtree
{
  path: 'admin',
  providers: [AdminService, { provide: API_URL, useValue: '/admin-api' }],
  loadChildren: () => import('./admin/admin.routes').then(m => m.routes),
}

// one component instance
@Component({
  providers: [WizardState],
  ...
})
export class Wizard {}
```

The lookup walks upward from where the request was made, so a nearer provider wins. That is how a route or component overrides an application wide value for its subtree.

## Overriding for a subtree

```typescript
@Component({
  selector: 'app-preview',
  providers: [
    { provide: ThemeService, useClass: PreviewThemeService },
  ],
  template: `<ng-content />`,
})
export class Preview {}
```

Everything inside `<app-preview>` gets the preview theme. Everything outside gets the normal one. Nothing else changes.

## Environment providers

Some providers only make sense at the application or route level, not on a component. `makeEnvironmentProviders` enforces that.

```typescript
import { makeEnvironmentProviders, EnvironmentProviders } from '@angular/core';

export function provideAnalytics(options: AnalyticsOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ANALYTICS_OPTIONS, useValue: options },
    AnalyticsService,
  ]);
}
```

```typescript
providers: [provideAnalytics({ trackingId: 'abc' })]
```

This is how every `provideSomething()` in Angular is written, and it is the right way to package a library's setup.

## Common mistakes

**Providing a service in a component when you wanted a singleton.**

```typescript
@Component({ providers: [CartService] })    // one per component instance
```

Each instance gets its own cart. Usually you want `providedIn: 'root'`.

**Using `useClass` twice for what should be one instance.** Use `useExisting`.

**Forgetting `multi: true` on one entry.** The array silently becomes a single value, or Angular throws about mixing.

**Providing a value that needs the injector at module load time.** Use `useFactory`, which runs lazily.

## Quick recap

- A provider maps a token to a recipe: `useClass`, `useValue`, `useExisting` or `useFactory`.
- `useExisting` shares one instance, `useClass` twice creates two.
- `inject()` works inside a factory, so the `deps` array is no longer needed.
- `InjectionToken` gives a runtime token with a compile time type.
- A token with a `factory` needs no provider and stays tree shakeable.
- `multi: true` collects several contributions into an array.
- Providers on a route or component override application wide ones for that subtree.

<code id="code-content" class="language-typescript">
import { InjectionToken, Injectable, inject, makeEnvironmentProviders,
         EnvironmentProviders } from '@angular/core';
import { HttpClient } from '@angular/common/http';
// Interfaces do not exist at runtime, so use a token. The string is only
// a description for error messages, not an identifier.
export interface AppConfig { apiUrl: string; retries: number; }
export const APP_CONFIG = new InjectionToken&lt;AppConfig&gt;('APP_CONFIG');
// A token with its own factory needs NO provider and stays tree shakeable
export const API_URL = new InjectionToken&lt;string&gt;('API_URL', {
  providedIn: 'root',
  factory: () =&gt; '/api',
});
// An abstract class works as a token, because it exists at runtime
export abstract class Logger { abstract write(m: string): void; }
@Injectable()
export class ConsoleLogger extends Logger { write(m: string) { console.log(m); } }
export const providers = [
  { provide: APP_CONFIG, useValue: { apiUrl: '/api', retries: 3 } },
  { provide: Logger, useClass: ConsoleLogger },
  // useExisting shares ONE instance. useClass twice would create two.
  { provide: DebugSink, useExisting: Logger },
  // useFactory when construction needs logic. inject() works inside it,
  // so the old `deps: [...]` array is no longer needed.
  {
    provide: StorageService,
    useFactory: () =&gt; typeof localStorage !== 'undefined'
      ? new BrowserStorage()
      : new MemoryStorage(),
  },
  // multi: true collects contributions into an array. Angular uses this for
  // HTTP_INTERCEPTORS and app initialisers. Do NOT mix multi and plain.
  { provide: VALIDATORS, useClass: EmailValidator, multi: true },
  { provide: VALIDATORS, useClass: LengthValidator, multi: true },
];
// Packaging setup for a library: this is how every provideSomething() works
export function provideAnalytics(options: { trackingId: string }): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ANALYTICS_OPTIONS, useValue: options },
    AnalyticsService,
  ]);
}
// Where providers live decides the scope. The lookup walks UPWARD,
// so the nearest provider wins:
//   appConfig providers  -&gt; whole application, one instance
//   route providers      -&gt; that route and its children
//   component providers  -&gt; that component INSTANCE and its subtree
// @Component({ providers: [CartService] }) gives EACH instance its own cart.
// If you wanted one shared cart, use @Injectable({ providedIn: 'root' }).
</code></pre>
