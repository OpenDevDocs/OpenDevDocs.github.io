---
publishDate: 2026-06-16T10:10
title: Class-based Interceptors and Migration
slug: class-based-interceptors
metadescription: Understand the HTTP_INTERCEPTORS class interceptors in older projects, and migrate them to functions.
updateDate: 2026-09-07T10:10
author: ['bishal-biswas']
level: 2
tags: ['legacy', 'http', 'interceptors']
course: angular
---

## The old shape

Before Angular 15, an interceptor was a class implementing `HttpInterceptor`.

```typescript
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    const token = this.auth.token;

    if (!token) return next.handle(req);

    return next.handle(req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }));
  }
}
```

Registered as a multi provider:

```typescript
@NgModule({
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: LoggingInterceptor, multi: true },
  ],
})
export class AppModule {}
```

`multi: true` is essential on every entry. Miss it on one and it replaces all the others rather than joining them, which is a confusing failure.

## The differences

```text
Class                                    Function
implements HttpInterceptor               HttpInterceptorFn
intercept(req, next)                     (req, next) => ...
next.handle(req)                         next(req)
constructor injection                    inject() inside the function
HTTP_INTERCEPTORS multi provider         withInterceptors([...])
order = provider order                   order = array order
```

The logic inside is identical. Only the wrapper changed.

## Registering both

`withInterceptorsFromDi()` includes class interceptors registered the old way.

```typescript
provideHttpClient(
  withInterceptors([newFunctionalInterceptor]),
  withInterceptorsFromDi(),
)
```

That is what you need during a migration, or when a library still ships a class interceptor.

**Ordering between the two is not intuitive.** All functional interceptors run before any class interceptors, regardless of the order of these calls. If ordering matters, convert them all.

## Converting

```typescript
// before
@Injectable()
export class LoggingInterceptor implements HttpInterceptor {
  constructor(private logger: LoggerService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler) {
    const started = Date.now();

    return next.handle(req).pipe(
      tap(event => {
        if (event.type === HttpEventType.Response) {
          this.logger.log(`${req.url} took ${Date.now() - started}ms`);
        }
      }),
    );
  }
}
```

```typescript
// after
export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);
  const started = Date.now();

  return next(req).pipe(
    tap(event => {
      if (event.type === HttpEventType.Response) {
        logger.log(`${req.url} took ${Date.now() - started}ms`);
      }
    }),
  );
};
```

Four mechanical changes:

1. Remove the class, the decorator and the interface.
2. Constructor parameters become `inject()` calls at the top of the function.
3. `next.handle(req)` becomes `next(req)`.
4. `this.x` becomes `x`.

Then swap the registration:

```typescript
// before
{ provide: HTTP_INTERCEPTORS, useClass: LoggingInterceptor, multi: true }

// after
provideHttpClient(withInterceptors([loggingInterceptor]))
```

## State in a class interceptor

A class instance can hold fields, which some interceptors relied on.

```typescript
@Injectable()
export class RefreshInterceptor implements HttpInterceptor {
  private refreshing = false;
  private tokenSubject = new BehaviorSubject<string | null>(null);

  intercept(req: HttpRequest<unknown>, next: HttpHandler) {
    // uses this.refreshing to coordinate concurrent 401s
  }
}
```

A function has no instance. Two options:

**Module level state**, which is fine for a single application:

```typescript
let refreshing: Observable<string> | null = null;

export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  // uses the module level `refreshing`
};
```

**A service**, which is cleaner and testable:

```typescript
@Injectable({ providedIn: 'root' })
export class TokenRefreshCoordinator {
  private refreshing: Observable<string> | null = null;

  refresh(): Observable<string> {
    this.refreshing ??= this.auth.refresh().pipe(
      shareReplay(1),
      finalize(() => { this.refreshing = null; }),
    );

    return this.refreshing;
  }
}
```

```typescript
export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const coordinator = inject(TokenRefreshCoordinator);
  // ...
};
```

Prefer the service. Module level state is shared across every test in a file, which causes intermittent failures.

## Testing

Class interceptors were testable by construction:

```typescript
const interceptor = new AuthInterceptor(fakeAuth);
```

Functional ones go through `TestBed`:

```typescript
TestBed.configureTestingModule({
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideHttpClientTesting(),
    { provide: AuthService, useValue: { token: () => 'abc' } },
  ],
});

const http = TestBed.inject(HttpClient);
const controller = TestBed.inject(HttpTestingController);

http.get('/api/data').subscribe();

expect(controller.expectOne('/api/data').request.headers.get('Authorization'))
  .toBe('Bearer abc');
```

More setup, but it tests the real pipeline rather than the class in isolation.

## Why the change

**Consistency.** Guards, resolvers and interceptors all became functions in the same era.

**Less code.** No class, decorator, interface or constructor.

**Explicit ordering.** An array is obviously ordered. A list of multi providers spread across modules is not.

**Better tree shaking.** An unreferenced function is removed.

**Composition.** A factory can produce a configured interceptor, which a class cannot without inheritance.

```typescript
export function timeoutInterceptor(ms: number): HttpInterceptorFn {
  return (req, next) => next(req).pipe(timeout(ms));
}
```

```typescript
withInterceptors([timeoutInterceptor(5000)])
```

## Should you convert?

`HttpInterceptor` is not deprecated and works in Angular 22. There is no deadline.

Convert when you are already changing the interceptor, when ordering between the two styles is causing confusion, or when you want parameterised interceptors.

## Quick recap

- Class interceptors implement `HttpInterceptor` and register with `HTTP_INTERCEPTORS` and `multi: true`.
- Missing `multi: true` on one entry silently replaces the others.
- `withInterceptorsFromDi()` keeps class interceptors working alongside functional ones.
- All functional interceptors run before any class ones, whatever the order of registration.
- Converting is mechanical: `next.handle(req)` becomes `next(req)`, and constructor parameters become `inject()`.
- Move instance state into a service rather than a module level variable.
- Functions compose into factories, so an interceptor can take arguments.

<code id="code-content" class="language-typescript">
import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpEventType,
         HTTP_INTERCEPTORS, HttpInterceptorFn, provideHttpClient,
         withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { Observable, tap, timeout, shareReplay, finalize } from 'rxjs';
// The OLD shape. Not deprecated, still works in Angular 22.
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}
  intercept(req: HttpRequest&lt;unknown&gt;, next: HttpHandler): Observable&lt;HttpEvent&lt;unknown&gt;&gt; {
    const token = this.auth.token;
    return token
      ? next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
      : next.handle(req);
  }
}
// Registered as a MULTI provider. Miss multi: true on ONE entry and it
// replaces all the others instead of joining them. Confusing failure.
const oldProviders = [
  { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
];
// The same logic as a function. Four mechanical changes:
//   1. drop the class, decorator and interface
//   2. constructor params become inject() calls
//   3. next.handle(req)  -&gt;  next(req)
//   4. this.x            -&gt;  x
export const authInterceptor: HttpInterceptorFn = (req, next) =&gt; {
  const token = inject(AuthService).token;
  return token
    ? next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
    : next(req);
};
// Run both during a migration. NOTE: ALL functional interceptors run before
// ANY class interceptors, whatever order you write these in.
provideHttpClient(
  withInterceptors([authInterceptor]),
  withInterceptorsFromDi(),        // keeps HTTP_INTERCEPTORS classes working
);
// A class could hold instance state. A function cannot, so move it to a
// SERVICE rather than a module level variable: module state is shared
// across every test in a file and causes intermittent failures.
@Injectable({ providedIn: 'root' })
export class TokenRefreshCoordinator {
  private refreshing: Observable&lt;string&gt; | null = null;
  private readonly auth = inject(AuthService);
  refresh(): Observable&lt;string&gt; {
    this.refreshing ??= this.auth.refresh().pipe(
      shareReplay(1), finalize(() =&gt; { this.refreshing = null; }));
    return this.refreshing;
  }
}
// The real win: functions COMPOSE. A class cannot be parameterised
// without inheritance.
export function timeoutInterceptor(ms: number): HttpInterceptorFn {
  return (req, next) =&gt; next(req).pipe(timeout(ms));
}
// withInterceptors([timeoutInterceptor(5000)])
</code></pre>
