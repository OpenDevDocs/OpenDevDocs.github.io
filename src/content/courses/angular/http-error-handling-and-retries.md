---
publishDate: 2026-06-17T10:25
title: HTTP Error Handling and Retries
slug: http-error-handling-and-retries
metadescription: Handle HTTP failures well, distinguish the error types, retry safely, and give users something better than a blank screen.
updateDate: 2026-09-07T10:25
author: ['bishal-biswas']
level: 2
tags: ['http', 'errors', 'retries']
course: angular
---

## What an HTTP error looks like

Angular wraps failures in `HttpErrorResponse`.

```typescript
this.http.get<User[]>('/api/users').subscribe({
  next: users => console.log(users),
  error: (error: HttpErrorResponse) => {
    console.log(error.status);       // 404, 500, or 0
    console.log(error.statusText);
    console.log(error.url);
    console.log(error.error);        // the response body, or an ErrorEvent
  },
});
```

The confusing part is `error.error`. It holds two different things depending on what went wrong.

## The two failure kinds

```typescript
function describe(error: HttpErrorResponse): string {
  if (error.status === 0) {
    // the request never reached the server
    return 'Cannot reach the server. Check your connection.';
  }

  // the server responded with an error status
  return `Server returned ${error.status}`;
}
```

**Status 0** means a network level failure: offline, DNS failure, CORS rejection, or a cancelled request. There is no response body, and `error.error` holds a `ProgressEvent`.

**Any other status** means the server replied. `error.error` is the parsed response body, which usually carries a useful message.

```typescript
function messageFrom(error: HttpErrorResponse): string {
  if (error.status === 0) return 'No connection';

  const body = error.error;

  if (typeof body === 'string') return body;
  if (body?.message) return body.message;
  if (body?.errors) return Object.values(body.errors).flat().join(', ');

  return `Request failed with status ${error.status}`;
}
```

Server error shapes vary, so a helper like this is worth writing once.

## Handling by status

```typescript
switch (error.status) {
  case 0:   return 'Cannot reach the server';
  case 400: return 'The request was invalid';
  case 401: return 'Please sign in again';
  case 403: return 'You do not have permission';
  case 404: return 'Not found';
  case 409: return 'Someone else changed this. Reload and try again.';
  case 422: return 'Some fields need correcting';
  case 429: return 'Too many requests. Wait a moment.';
  case 500: return 'Something went wrong on our side';
  case 503: return 'The service is temporarily unavailable';
  default:  return 'Something went wrong';
}
```

Two are worth handling properly rather than showing a generic message.

**401** means the session ended. Sign the user out and redirect, rather than showing an error they cannot act on.

**409** means a conflict, usually a concurrent edit. Telling the user to reload is genuinely actionable.

## Where to handle it

```text
Interceptor     cross cutting: 401 redirects, offline banners, logging
Service         translating an API's error shape into your own
Component       showing the message and offering a retry
```

The interceptor handles what is the same everywhere. The component handles what the user sees. Do not put user facing messages in an interceptor, because the right message depends on what the user was doing.

## In an interceptor

```typescript
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const notifications = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        auth.signOut();
        router.navigate(['/login']);
      }

      if (error.status === 0) {
        notifications.show('You appear to be offline');
      }

      if (error.status >= 500) {
        inject(ErrorReporter).report(error);
      }

      return throwError(() => error);      // always rethrow
    }),
  );
};
```

**Always rethrow.** Returning a value here means the calling code receives it as a success, which produces very confusing bugs.

## In a service

Translate the API's shape into something your application understands.

```typescript
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly userMessage: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(userMessage);
  }
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  create(user: NewUser): Observable<User> {
    return this.http.post<User>('/api/users', user).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 422) {
          return throwError(() => new ApiError(422, 'Please check the form', error.error.errors));
        }

        return throwError(() => new ApiError(error.status, messageFrom(error)));
      }),
    );
  }
}
```

Now components deal with one error type rather than raw HTTP details.

## In a component with a resource

```typescript
@Component({
  template: `
    @if (users.isLoading()) {
      <app-skeleton />
    } @else if (users.error(); as error) {
      <div class="error">
        <p>{{ message(error) }}</p>
        <button (click)="users.reload()">Try again</button>
      </div>
    } @else {
      @for (user of users.value() ?? []; track user.id) { ... }
    }
  `,
})
export class UserList {
  protected readonly users = httpResource<User[]>(() => '/api/users');

  protected message(error: unknown): string {
    return error instanceof HttpErrorResponse ? messageFrom(error) : 'Something went wrong';
  }
}
```

A retry button matters. An error with no way forward is a dead end.

## Retrying

```typescript
this.http.get<User[]>('/api/users').pipe(
  retry({
    count: 3,
    delay: (error: HttpErrorResponse, attempt) => {
      if (error.status >= 400 && error.status < 500) throw error;

      return timer(Math.min(1000 * Math.pow(2, attempt), 10_000));
    },
  }),
);
```

Three rules for retrying.

**Only idempotent requests.** GET, PUT and DELETE are safe. Retrying a POST can create two records.

**Never retry 4xx.** A 400, 404 or 403 will be the same next time. Only 5xx, 408 and 429 are worth retrying.

**Back off exponentially.** Retrying immediately three times against an overloaded server makes things worse.

Honouring `Retry-After` on a 429 is polite and often required:

```typescript
delay: (error: HttpErrorResponse, attempt) => {
  const header = error.headers?.get('Retry-After');
  const seconds = header ? Number(header) : Math.pow(2, attempt);

  return timer(seconds * 1000);
}
```

## Timeouts

A request that hangs is worse than one that fails, because the user has no idea what is happening.

```typescript
this.http.get<User[]>('/api/users').pipe(
  timeout(10_000),
  catchError(error => {
    if (error instanceof TimeoutError) {
      return throwError(() => new Error('The request took too long'));
    }
    return throwError(() => error);
  }),
);
```

As an interceptor it applies everywhere:

```typescript
export function timeoutInterceptor(ms: number): HttpInterceptorFn {
  return (req, next) => next(req).pipe(timeout(ms));
}
```

## Offline handling

```typescript
@Injectable({ providedIn: 'root' })
export class ConnectionService {
  readonly online = signal(navigator.onLine);

  constructor() {
    const goOnline = () => this.online.set(true);
    const goOffline = () => this.online.set(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    });
  }
}
```

```html
@if (!connection.online()) {
  <div class="banner">You are offline. Changes will not be saved.</div>
}
```

`navigator.onLine` only knows whether there is a network interface, not whether your API is reachable. Treat it as a hint, not a guarantee.

## Reporting errors

```typescript
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly reporter = inject(ErrorReporter);

  handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      // handled elsewhere, and 4xx are usually not bugs
      if (error.status < 500) return;
    }

    console.error(error);
    this.reporter.send(error);
  }
}
```

```typescript
providers: [{ provide: ErrorHandler, useClass: AppErrorHandler }]
```

Filtering out 4xx keeps the noise down. A user typing a bad URL is not a bug worth alerting on.

## Quick recap

- `HttpErrorResponse.status` of 0 means the request never reached the server.
- `error.error` is the response body for server errors, and a `ProgressEvent` for network ones.
- Handle cross cutting concerns in an interceptor and always rethrow.
- Translate API errors into your own error type in the service layer.
- Show the message and a retry button in the component.
- Retry only idempotent requests, never 4xx, and back off exponentially.
- Add a timeout, because a hanging request is worse than a failing one.

<code id="code-content" class="language-typescript">
import { inject, Injectable, ErrorHandler, signal, DestroyRef } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError, retry, timer, timeout, TimeoutError } from 'rxjs';
// status 0 = the request never reached the server (offline, DNS, CORS, cancelled).
// Any other status = the server replied, and error.error is the parsed body.
export function messageFrom(error: HttpErrorResponse): string {
  if (error.status === 0) return 'Cannot reach the server. Check your connection.';
  const body = error.error;
  if (typeof body === 'string') return body;
  if (body?.message) return body.message;
  return `Request failed with status ${error.status}`;
}
// In an interceptor: cross cutting only, and ALWAYS rethrow.
// Returning a value here makes the caller think the request SUCCEEDED.
export const errorInterceptor: HttpInterceptorFn = (req, next) =&gt;
  next(req).pipe(catchError((error: HttpErrorResponse) =&gt; {
    if (error.status === 401) { inject(AuthService).signOut(); }
    if (error.status === 0) inject(NotificationService).show('You appear to be offline');
    return throwError(() =&gt; error);
  }));
// In a service: translate the API's shape into YOUR error type
export class ApiError extends Error {
  constructor(readonly status: number, readonly userMessage: string,
              readonly fieldErrors?: Record&lt;string, string[]&gt;) { super(userMessage); }
}
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  create(user: unknown) {
    return this.http.post&lt;User&gt;('/api/users', user).pipe(
      // Retry rules: idempotent requests only, NEVER 4xx, back off exponentially
      retry({
        count: 3,
        delay: (error: HttpErrorResponse, attempt) =&gt; {
          if (error.status &gt;= 400 &amp;&amp; error.status &lt; 500) throw error;
          const header = error.headers?.get('Retry-After');    // honour 429
          const seconds = header ? Number(header) : Math.pow(2, attempt);
          return timer(Math.min(seconds * 1000, 10_000));
        },
      }),
      timeout(10_000),          // a hanging request is worse than a failing one
      catchError((error: unknown) =&gt; {
        if (error instanceof TimeoutError)
          return throwError(() =&gt; new ApiError(0, 'The request took too long'));
        const http = error as HttpErrorResponse;
        if (http.status === 422)
          return throwError(() =&gt; new ApiError(422, 'Please check the form',
                                               http.error.errors));
        return throwError(() =&gt; new ApiError(http.status, messageFrom(http)));
      }));
  }
}
// Worth handling specifically rather than showing a generic message:
//   401  the session ended: sign out and redirect, do not show an error
//   409  a concurrent edit: telling the user to reload is actionable
//   429  rate limited: honour Retry-After
// Filter 4xx out of error reporting. A user typing a bad URL is not a bug.
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse &amp;&amp; error.status &lt; 500) return;
    console.error(error);
  }
}
interface User { id: number; }
</code></pre>
