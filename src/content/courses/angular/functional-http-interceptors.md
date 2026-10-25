---
publishDate: 2026-06-16T10:05
title: Functional HTTP Interceptors
slug: functional-http-interceptors
metadescription: Add headers, logging, retries and error handling to every request with functional interceptors.
updateDate: 2026-09-07T10:05
author: ['bishal-biswas']
level: 2
tags: ['http', 'interceptors', 'authentication']
course: angular
---

## One place for cross cutting concerns

An interceptor sits between your code and the network. Every request passes through it, so authentication headers, logging and error handling live in one place.

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();

  if (!token) return next(req);

  return next(req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  }));
};
```

```typescript
provideHttpClient(
  withInterceptors([authInterceptor]),
)
```

Every request now carries the token, and no service has to think about it.

## Requests are immutable

You cannot modify a request. You clone it with changes.

```typescript
// does nothing
req.headers.set('Authorization', token);

// correct
const modified = req.clone({
  setHeaders: { Authorization: `Bearer ${token}` },
});

return next(modified);
```

`clone` accepts several options:

```typescript
req.clone({
  setHeaders: { 'X-Request-Id': id },       // add or replace headers
  setParams: { version: '2' },              // add or replace query params
  url: `${baseUrl}${req.url}`,              // rewrite the URL
  body: transformed,                        // replace the body
  withCredentials: true,
});
```

## Order matters

Interceptors run in the order you list them, and responses come back in reverse.

```typescript
withInterceptors([
  loggingInterceptor,   // sees the request first, the response last
  authInterceptor,
  retryInterceptor,     // sees the request last, the response first
])
```

Put logging first so it observes the fully prepared request. Put retries close to the network so they happen before anything else reacts.

## Adding a base URL

```typescript
export const baseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith('http')) return next(req);    // already absolute

  const base = inject(API_URL);

  return next(req.clone({ url: `${base}${req.url}` }));
};
```

Now services write `/users` and the interceptor makes it `https://api.example.com/users`. Changing environments becomes one provider change.

## Logging and timing

```typescript
export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const started = performance.now();

  return next(req).pipe(
    tap({
      next: event => {
        if (event.type === HttpEventType.Response) {
          const ms = Math.round(performance.now() - started);
          console.log(`${req.method} ${req.urlWithParams} ${event.status} in ${ms}ms`);
        }
      },
      error: error => {
        console.error(`${req.method} ${req.urlWithParams} failed`, error);
      },
    }),
  );
};
```

`next(req)` returns a stream of events, not just the response. Checking `event.type` is how you find the actual response.

## Retrying

```typescript
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') return next(req);          // only retry safe methods

  return next(req).pipe(
    retry({
      count: 3,
      delay: (error, retryCount) => {
        if (error.status >= 400 && error.status < 500) throw error;   // do not retry
        return timer(Math.pow(2, retryCount) * 500);                  // back off
      },
    }),
  );
};
```

Two rules worth keeping. **Only retry idempotent requests**, since retrying a POST can create duplicates. And **do not retry client errors**, because a 404 will still be a 404.

The exponential delay avoids hammering a struggling server.

## Global error handling

```typescript
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      switch (error.status) {
        case 0:
          notifications.show('No connection');
          break;
        case 401:
          auth.signOut();
          router.navigate(['/login']);
          break;
        case 403:
          notifications.show('You do not have permission');
          break;
        case 500:
          notifications.show('Something went wrong on our side');
          break;
      }

      return throwError(() => error);
    }),
  );
};
```

Rethrowing matters. Swallowing the error means the calling code thinks the request succeeded and never sees it.

Status `0` means the request never reached the server: offline, DNS failure, or a CORS rejection.

## Refreshing a token

The most involved interceptor most applications need.

```typescript
let refreshing: Observable<string> | null = null;

export const refreshTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(withToken(req, auth.token())).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || req.url.includes('/refresh')) {
        return throwError(() => error);
      }

      refreshing ??= auth.refresh().pipe(
        shareReplay(1),
        finalize(() => { refreshing = null; }),
      );

      return refreshing.pipe(
        switchMap(token => next(withToken(req, token))),
      );
    }),
  );
};

function withToken(req: HttpRequest<unknown>, token: string | null) {
  return token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;
}
```

Two details make this work. The `refreshing` variable means several failing requests share **one** refresh call rather than each triggering its own. And skipping the refresh endpoint itself prevents an infinite loop when the refresh also returns 401.

## Skipping an interceptor

`HttpContext` passes per request flags.

```typescript
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
```

```typescript
this.http.get('/api/public', {
  context: new HttpContext().set(SKIP_AUTH, true),
});
```

```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH)) return next(req);

  // ... add the token
};
```

Cleaner than checking URLs with string matching, which breaks the moment a path changes.

## Caching

```typescript
export const CACHEABLE = new HttpContextToken<boolean>(() => false);

const cache = new Map<string, HttpResponse<unknown>>();

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET' || !req.context.get(CACHEABLE)) return next(req);

  const cached = cache.get(req.urlWithParams);
  if (cached) return of(cached.clone());

  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse) cache.set(req.urlWithParams, event);
    }),
  );
};
```

Opt in rather than caching everything, and give it a way to expire. A cache that never invalidates causes stranger bugs than no cache at all.

## Testing

```typescript
TestBed.configureTestingModule({
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideHttpClientTesting(),
    { provide: AuthService, useValue: { token: () => 'test-token' } },
  ],
});

const http = TestBed.inject(HttpClient);
const controller = TestBed.inject(HttpTestingController);

http.get('/api/users').subscribe();

const request = controller.expectOne('/api/users');
expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
```

## Quick recap

- Interceptors are functions using `inject()`, registered with `withInterceptors`.
- Requests are immutable, so use `req.clone()` with `setHeaders` or `setParams`.
- They run in listed order for requests and reverse order for responses.
- Only retry idempotent requests, and never retry 4xx errors.
- Rethrow errors after handling them, or callers never learn the request failed.
- Share one refresh call between concurrent 401s, and skip the refresh endpoint itself.
- Use `HttpContext` tokens to opt out per request rather than matching URLs.

<code id="code-content" class="language-typescript">
import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse, HttpEventType, HttpResponse,
         HttpContextToken, HttpContext, HttpRequest,
         provideHttpClient, withInterceptors } from '@angular/common/http';
import { catchError, throwError, tap, retry, timer, switchMap, shareReplay,
         finalize, of, Observable } from 'rxjs';
// Requests are IMMUTABLE. Clone with changes, never mutate.
export const authInterceptor: HttpInterceptorFn = (req, next) =&gt; {
  if (req.context.get(SKIP_AUTH)) return next(req);     // per request opt out
  const token = inject(AuthService).token();
  return token
    ? next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
    : next(req);
};
// A context token is cleaner than matching URLs with strings
export const SKIP_AUTH = new HttpContextToken&lt;boolean&gt;(() =&gt; false);
// this.http.get('/api/public', { context: new HttpContext().set(SKIP_AUTH, true) })
// next(req) returns a stream of EVENTS, not just the response
export const loggingInterceptor: HttpInterceptorFn = (req, next) =&gt; {
  const started = performance.now();
  return next(req).pipe(tap({
    next: event =&gt; {
      if (event.type === HttpEventType.Response)
        console.log(`${req.method} ${req.urlWithParams} ${event.status}`,
                    Math.round(performance.now() - started) + 'ms');
    },
  }));
};
// Only retry IDEMPOTENT requests, and never retry 4xx: a 404 stays a 404
export const retryInterceptor: HttpInterceptorFn = (req, next) =&gt; {
  if (req.method !== 'GET') return next(req);
  return next(req).pipe(retry({
    count: 3,
    delay: (error, attempt) =&gt; {
      if (error.status &gt;= 400 &amp;&amp; error.status &lt; 500) throw error;
      return timer(Math.pow(2, attempt) * 500);        // exponential back off
    },
  }));
};
// Handle globally, then RETHROW. Swallowing means callers think it succeeded.
export const errorInterceptor: HttpInterceptorFn = (req, next) =&gt;
  next(req).pipe(catchError((error: HttpErrorResponse) =&gt; {
    if (error.status === 0) inject(NotificationService).show('No connection');
    if (error.status === 401) inject(Router).navigate(['/login']);
    return throwError(() =&gt; error);
  }));
// Token refresh: ONE shared refresh for concurrent 401s, and skip the
// refresh endpoint itself or you get an infinite loop.
let refreshing: Observable&lt;string&gt; | null = null;
export const refreshInterceptor: HttpInterceptorFn = (req, next) =&gt; {
  const auth = inject(AuthService);
  return next(req).pipe(catchError((error: HttpErrorResponse) =&gt; {
    if (error.status !== 401 || req.url.includes('/refresh'))
      return throwError(() =&gt; error);
    refreshing ??= auth.refresh().pipe(
      shareReplay(1), finalize(() =&gt; { refreshing = null; }));
    return refreshing.pipe(switchMap(token =&gt;
      next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))));
  }));
};
// Order: requests run top to bottom, responses come back bottom to top.
provideHttpClient(withInterceptors([
  loggingInterceptor,   // sees the request first, the response last
  authInterceptor,
  retryInterceptor,     // closest to the network
]));
</code></pre>
