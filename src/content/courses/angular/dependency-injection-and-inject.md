---
publishDate: 2026-06-10T08:30
title: Dependency Injection and inject()
slug: dependency-injection-and-inject
metadescription: Get services with the inject function, understand the injection context, and use DI in functions as well as classes.
updateDate: 2026-09-07T08:30
author: ['bishal-biswas']
level: 2
tags: ['dependency injection', 'inject', 'services']
course: angular
---

## Asking for what you need

Dependency injection means a class does not create its dependencies. It asks, and Angular supplies them.

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<User[]>('/api/users');
  }
}
```

`inject(HttpClient)` returns the shared `HttpClient`. The service does not know how it was made or configured.

That is what makes it testable. A test provides a different `HttpClient` and the service is none the wiser.

## providedIn root

```typescript
@Injectable({ providedIn: 'root' })
export class UserService {}
```

One instance for the whole application, created the first time something asks for it.

It is also **tree shakeable**. If nothing injects `UserService`, it is removed from the bundle entirely. Registering it in a module's `providers` array does not have that property, which is why `providedIn: 'root'` is the default advice.

## Where inject can be called

`inject()` only works in an **injection context**:

```text
a field initialiser
a constructor
a factory function in a provider
inside runInInjectionContext
```

```typescript
export class UserList {
  private readonly service = inject(UserService);      // field, fine

  constructor() {
    const router = inject(Router);                      // constructor, fine
  }

  load(): void {
    const http = inject(HttpClient);                    // error
  }
}
```

Outside those places, capture an `Injector` and use it:

```typescript
export class Late {
  private readonly injector = inject(Injector);

  later(): void {
    runInInjectionContext(this.injector, () => {
      const http = inject(HttpClient);
    });
  }
}
```

Rarely needed. Injecting into a field covers nearly every case.

## The options

```typescript
const logger = inject(Logger, { optional: true });        // null if not provided
const parent = inject(ParentService, { skipSelf: true }); // skip this injector
const own = inject(Config, { self: true });               // only this injector
const local = inject(Theme, { host: true });              // stop at the host element
```

`optional` is the useful one. It returns `null` instead of throwing, which lets a component work with or without an optional dependency.

```typescript
private readonly analytics = inject(AnalyticsService, { optional: true });

track(event: string): void {
  this.analytics?.send(event);
}
```

## Injection in functions

This is what `inject()` unlocked, and it is why guards, resolvers and interceptors became plain functions.

```typescript
// a route guard
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isLoggedIn() ? true : router.createUrlTree(['/login']);
};
```

```typescript
// an HTTP interceptor
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();

  return next(token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req);
};
```

```typescript
// a resolver
export const userResolver: ResolveFn<User> = route => {
  const id = route.paramMap.get('id')!;
  return inject(UserService).getById(id);
};
```

None of these need a class. Angular calls them inside an injection context, so `inject()` works.

## Reusable injection functions

You can write your own helpers that inject.

```typescript
export function injectQueryParam(name: string): Signal<string | null> {
  const route = inject(ActivatedRoute);
  return toSignal(route.queryParamMap.pipe(map(p => p.get(name))), {
    initialValue: null,
  });
}
```

```typescript
export class Search {
  protected readonly term = injectQueryParam('q');
}
```

The convention is to name these `injectSomething`, so it is obvious they can only be called from an injection context.

Another common one:

```typescript
export function injectDestroy(): Observable<void> {
  const subject = new Subject<void>();

  inject(DestroyRef).onDestroy(() => {
    subject.next();
    subject.complete();
  });

  return subject.asObservable();
}
```

## The hierarchy

Injectors form a tree that mirrors the component tree. A lookup walks upward until it finds a provider.

```text
root injector          providedIn: 'root'
  route injector       route providers
    component injector component providers
      element injector directives on that element
```

```typescript
@Component({
  selector: 'app-wizard',
  providers: [WizardState],     // one per <app-wizard>
  ...
})
export class Wizard {
  private readonly state = inject(WizardState);
}
```

Two wizards get two independent states. Anything inside a wizard's template that injects `WizardState` gets that wizard's copy.

This is the cleanest way to scope state to a subtree, and it needs no explicit passing.

## Injecting things that are not classes

```typescript
export const API_URL = new InjectionToken<string>('API_URL');

// provide
{ provide: API_URL, useValue: 'https://api.example.com' }

// inject
private readonly apiUrl = inject(API_URL);
```

Interfaces do not exist at runtime, so they cannot be tokens. `InjectionToken` gives you a runtime value carrying a compile time type.

Built in tokens worth knowing:

```typescript
const document = inject(DOCUMENT);          // safe on the server too
const platformId = inject(PLATFORM_ID);
const locale = inject(LOCALE_ID);
const elementRef = inject(ElementRef);
const destroyRef = inject(DestroyRef);
```

`inject(DOCUMENT)` rather than the global `document` is what makes code work under server-side rendering.

## Testing

```typescript
TestBed.configureTestingModule({
  providers: [
    { provide: UserService, useValue: fakeUserService },
    provideHttpClientTesting(),
  ],
});

const service = TestBed.inject(UserService);
```

`TestBed.inject` is the injection context for tests. Because the component asked for `UserService` rather than constructing one, the fake slots straight in.

## Common mistakes

**Calling `inject` too late.**

```typescript
ngOnInit(): void {
  const http = inject(HttpClient);    // error
}
```

Move it to a field.

**Circular dependencies.** Two services injecting each other. Angular reports it clearly. The fix is usually extracting the shared part into a third service.

**Injecting a service just to pass it on.** If a component only injects something to hand it to a child, the child should inject it itself.

**Providing a service in a component when you wanted a singleton.** Component `providers` creates one per instance, which is sometimes a surprise.

## Quick recap

- `inject(Thing)` asks Angular for a dependency, and needs an injection context.
- `providedIn: 'root'` gives one shared, tree shakeable instance.
- Injection contexts are field initialisers, constructors and factory functions.
- `optional: true` returns `null` instead of throwing.
- `inject()` in plain functions is what made functional guards and interceptors possible.
- Component `providers` scope a service to that component's subtree.
- Use `InjectionToken` for anything that is not a class, and `inject(DOCUMENT)` for SSR safety.

<code id="code-content" class="language-typescript">
import { Injectable, InjectionToken, Injector, DOCUMENT, DestroyRef,
         inject, runInInjectionContext, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, CanActivateFn } from '@angular/router';
// One shared instance, created on first use, and TREE SHAKEABLE:
// if nothing injects it, it is removed from the bundle.
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);          // field initialiser
  private readonly document = inject(DOCUMENT);        // SSR safe, unlike global document
  // optional returns null instead of throwing
  private readonly analytics = inject(AnalyticsService, { optional: true });
  track(event: string) { this.analytics?.send(event); }
}
// Not a class? Use an InjectionToken. Interfaces do not exist at runtime.
export const API_URL = new InjectionToken&lt;string&gt;('API_URL');
// provide:  { provide: API_URL, useValue: 'https://api.example.com' }
// inject:   private readonly url = inject(API_URL);
// inject() in plain FUNCTIONS is what made guards and interceptors functional
export const authGuard: CanActivateFn = () =&gt; {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? true : router.createUrlTree(['/login']);
};
// You can write your own. Name them injectSomething so the constraint is obvious.
export function injectDestroy() {
  const subject = new Subject&lt;void&gt;();
  inject(DestroyRef).onDestroy(() =&gt; { subject.next(); subject.complete(); });
  return subject.asObservable();
}
// Injection contexts: field initialisers, constructors, factory functions.
// Anywhere else, capture an Injector:
export class Late {
  private readonly injector = inject(Injector);
  later() {
    runInInjectionContext(this.injector, () =&gt; inject(HttpClient));
  }
}
// Component providers scope a service to ONE component subtree:
//   @Component({ providers: [WizardState] })
//   Two &lt;app-wizard&gt; elements get two independent states.
// Compare with providedIn: 'root', which is one instance app-wide.
// Testing: because the class ASKED rather than constructed, a fake slots in.
//   TestBed.configureTestingModule({
//     providers: [{ provide: UserService, useValue: fake }] });
</code></pre>
