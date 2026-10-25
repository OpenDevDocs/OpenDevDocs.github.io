---
publishDate: 2026-06-15T09:55
title: HttpClient with provideHttpClient
slug: httpclient-setup
metadescription: Configure HttpClient with provide functions, make typed requests, and use the options that matter for real APIs.
updateDate: 2026-09-07T09:55
author: ['bishal-biswas']
level: 2
tags: ['http', 'httpclient', 'api']
course: angular
---

## Setting it up

```typescript
import { provideHttpClient, withFetch } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
  ],
};
```

`withFetch()` uses the browser `fetch` API instead of `XMLHttpRequest`. It is required for server-side rendering to work properly, and it is the better default.

This replaced importing `HttpClientModule`, which still works but pulls in everything whether you use it or not.

## Making requests

```typescript
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<User[]> {
    return this.http.get<User[]>('/api/users');
  }

  getById(id: string): Observable<User> {
    return this.http.get<User>(`/api/users/${id}`);
  }

  create(user: NewUser): Observable<User> {
    return this.http.post<User>('/api/users', user);
  }

  update(id: string, changes: Partial<User>): Observable<User> {
    return this.http.patch<User>(`/api/users/${id}`, changes);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/users/${id}`);
  }
}
```

The generic is essential. `http.get('/api/users')` returns `Object`, giving you no type safety at all. `http.get<User[]>` types the whole chain.

**Angular does not verify the type.** It is a compile time assertion about what the server returns. If the API changes, TypeScript will not notice, so validate at the boundary when it matters.

## Requests are cold

Nothing happens until you subscribe.

```typescript
const request$ = this.http.get<User[]>('/api/users');   // no request sent

request$.subscribe(users => console.log(users));        // now it is sent
```

Subscribing twice sends two requests. This surprises people coming from `fetch`, where the promise is already in flight.

The `async` pipe and `toSignal` subscribe for you. So does `httpResource`, which is the modern way and has its own topic.

## Query parameters

```typescript
// manual, and easy to get wrong
this.http.get<User[]>(`/api/users?role=${role}&page=${page}`);

// HttpParams, which encodes for you
const params = new HttpParams()
  .set('role', role)
  .set('page', page)
  .set('active', true);

this.http.get<User[]>('/api/users', { params });
```

`HttpParams` is **immutable**. Every `set` returns a new instance, so chaining is required.

```typescript
const params = new HttpParams();
params.set('page', 1);              // does nothing, the result is discarded

const params = new HttpParams().set('page', 1);   // correct
```

The object shorthand is shorter for simple cases:

```typescript
this.http.get<User[]>('/api/users', {
  params: { role: 'admin', page: 2, active: true },
});
```

For repeated keys, use `append`:

```typescript
let params = new HttpParams();
for (const tag of tags) params = params.append('tag', tag);
// ?tag=a&tag=b&tag=c
```

## Headers

```typescript
const headers = new HttpHeaders()
  .set('X-Request-Id', crypto.randomUUID())
  .set('Accept', 'application/json');

this.http.get<User[]>('/api/users', { headers });
```

Also immutable, same rule.

Do not set authentication headers on every call by hand. Use an interceptor, which is the next topic.

`Content-Type` is set automatically for a JSON body, and must **not** be set for `FormData`, because the browser needs to add the multipart boundary itself.

```typescript
// wrong, the upload breaks
this.http.post('/api/upload', formData, {
  headers: new HttpHeaders().set('Content-Type', 'multipart/form-data'),
});

// right, let the browser set it
this.http.post('/api/upload', formData);
```

## Response types

```typescript
this.http.get<User[]>('/api/users');                        // JSON, the default
this.http.get('/api/report', { responseType: 'text' });     // a string
this.http.get('/api/file', { responseType: 'blob' });       // binary
this.http.get('/api/data', { responseType: 'arraybuffer' });
```

For the full response including status and headers:

```typescript
this.http.get<User[]>('/api/users', { observe: 'response' })
  .subscribe(response => {
    console.log(response.status);
    console.log(response.headers.get('X-Total-Count'));
    console.log(response.body);
  });
```

Pagination headers are the usual reason to need this.

## Upload and download progress

```typescript
upload(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return this.http.post('/api/upload', formData, {
    reportProgress: true,
    observe: 'events',
  }).pipe(
    map(event => {
      if (event.type === HttpEventType.UploadProgress) {
        return Math.round(100 * event.loaded / (event.total ?? 1));
      }
      if (event.type === HttpEventType.Response) {
        return 100;
      }
      return 0;
    }),
  );
}
```

Both `reportProgress: true` and `observe: 'events'` are required. Setting only one gives you nothing useful.

## Configuration options

```typescript
provideHttpClient(
  withFetch(),
  withInterceptors([authInterceptor, loggingInterceptor]),
  withXsrfConfiguration({
    cookieName: 'XSRF-TOKEN',
    headerName: 'X-XSRF-TOKEN',
  }),
  withRequestsMadeViaParent(),
)
```

**`withFetch()`** for the modern transport and proper SSR support.

**`withInterceptors([...])`** registers functional interceptors.

**`withXsrfConfiguration()`** matches your server's cross site request forgery token names. Angular reads the cookie and sends the header automatically for mutating requests to relative URLs.

**`withInterceptorsFromDi()`** bridges to old class based interceptors registered with `HTTP_INTERCEPTORS`.

## Base URLs

Repeating the base in every call is noise. Put it in a token.

```typescript
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
```

```typescript
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_URL);

  getAll() {
    return this.http.get<User[]>(`${this.base}/users`);
  }
}
```

Or add it in an interceptor, so services use relative paths throughout.

## During development

A proxy avoids cross origin problems and keeps URLs relative.

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true
  }
}
```

```json
"serve": {
  "options": { "proxyConfig": "proxy.conf.json" }
}
```

Now `/api/users` in the browser reaches `http://localhost:3000/api/users`, with no CORS setup and no environment specific URLs.

## Testing

```typescript
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

TestBed.configureTestingModule({
  providers: [provideHttpClient(), provideHttpClientTesting()],
});

const http = TestBed.inject(HttpTestingController);
const service = TestBed.inject(UserService);

service.getAll().subscribe(users => expect(users.length).toBe(2));

const request = http.expectOne('/api/users');
expect(request.request.method).toBe('GET');
request.flush([{ id: 1 }, { id: 2 }]);

http.verify();
```

`http.verify()` fails the test if any request went unhandled, which catches requests you did not expect.

## Quick recap

- `provideHttpClient(withFetch())` is the modern setup, replacing `HttpClientModule`.
- Always pass the generic, or you get no type safety.
- The type is an assertion, not a runtime check.
- Requests are cold, so nothing is sent until something subscribes.
- `HttpParams` and `HttpHeaders` are immutable, so chain the calls.
- Never set `Content-Type` for `FormData`, the browser must add the boundary.
- Progress needs both `reportProgress: true` and `observe: 'events'`.

<code id="code-content" class="language-typescript">
import { Injectable, inject, InjectionToken } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders, HttpEventType,
         provideHttpClient, withFetch, withInterceptors,
         withXsrfConfiguration } from '@angular/common/http';
import { map } from 'rxjs';
// withFetch() is required for SSR to work properly, and is the better default
export const appConfig = {
  providers: [
    provideHttpClient(
      withFetch(),
      withInterceptors([]),
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
    ),
  ],
};
export const API_URL = new InjectionToken&lt;string&gt;('API_URL', {
  providedIn: 'root', factory: () =&gt; '/api',
});
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_URL);
  // ALWAYS pass the generic. Without it the response is typed Object.
  // Note it is a compile time ASSERTION, not a runtime check.
  getAll() { return this.http.get&lt;User[]&gt;(`${this.base}/users`); }
  create(user: NewUser) { return this.http.post&lt;User&gt;(`${this.base}/users`, user); }
  update(id: string, changes: Partial&lt;User&gt;) {
    return this.http.patch&lt;User&gt;(`${this.base}/users/${id}`, changes);
  }
  // HttpParams and HttpHeaders are IMMUTABLE. Every set returns a new one,
  // so you MUST chain. params.set(...) on its own does nothing.
  search(role: string, tags: string[]) {
    let params = new HttpParams().set('role', role).set('page', 1);
    for (const tag of tags) params = params.append('tag', tag);   // repeated keys
    return this.http.get&lt;User[]&gt;(`${this.base}/users`, { params });
  }
  // observe: 'response' for status and headers, e.g. pagination counts
  page() {
    return this.http.get&lt;User[]&gt;(`${this.base}/users`, { observe: 'response' })
      .pipe(map(r =&gt; ({ items: r.body ?? [], total: r.headers.get('X-Total-Count') })));
  }
  // Progress needs BOTH reportProgress and observe: 'events'
  upload(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    // Do NOT set Content-Type for FormData. The browser must add the boundary.
    return this.http.post(`${this.base}/upload`, formData, {
      reportProgress: true, observe: 'events',
    }).pipe(map(e =&gt; e.type === HttpEventType.UploadProgress
      ? Math.round(100 * e.loaded / (e.total ?? 1)) : 0));
  }
}
// Requests are COLD. Nothing is sent until something subscribes,
// and subscribing twice sends TWO requests.
// In development, a proxy keeps URLs relative and avoids CORS:
//   proxy.conf.json:  { "/api": { "target": "http://localhost:3000" } }
interface User { name: string; }
interface NewUser { name: string; }
</code></pre>
