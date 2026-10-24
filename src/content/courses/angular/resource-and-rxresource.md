---
publishDate: 2026-06-16T10:20
title: 'Async Signals: resource and rxResource'
slug: resource-and-rxresource
metadescription: Wrap any async work in signals with resource, and bridge RxJS streams with rxResource for debouncing and cancellation.
updateDate: 2026-09-07T10:20
author: ['bishal-biswas']
level: 2
tags: ['resource', 'signals', 'async']
course: angular
---

## resource is the general form

`httpResource` is a specialised wrapper. `resource` handles **any** promise based work.

```typescript
import { resource } from '@angular/core';

export class UserDetail {
  readonly id = input.required<string>();

  protected readonly user = resource({
    params: () => ({ id: this.id() }),
    loader: async ({ params, abortSignal }) => {
      const response = await fetch(`/api/users/${params.id}`, { signal: abortSignal });

      if (!response.ok) throw new Error(response.statusText);

      return response.json() as Promise<User>;
    },
  });
}
```

Two parts. **`params`** is a reactive computation naming what the request depends on. **`loader`** does the work.

When `params` produces a different value, the loader runs again and the previous call is aborted.

## Always pass the abort signal

```typescript
loader: async ({ params, abortSignal }) => {
  const response = await fetch(url, { signal: abortSignal });
  return response.json();
}
```

Without it, a superseded request keeps running and its response can arrive after a newer one, overwriting fresh data with stale data. Passing `abortSignal` cancels it properly.

For work that is not `fetch`, check the signal yourself:

```typescript
loader: async ({ params, abortSignal }) => {
  const data = await expensiveComputation(params.input);

  if (abortSignal.aborted) throw new Error('aborted');

  return data;
}
```

## The same signals as httpResource

```typescript
user.value()      // the data, or undefined
user.isLoading()
user.error()
user.status()     // idle, loading, resolved, error, reloading, local
user.hasValue()   // a narrowing type guard
user.reload()
```

## Skipping the load

Return `undefined` from `params` and the loader does not run.

```typescript
protected readonly user = resource({
  params: () => {
    const id = this.selectedId();
    return id ? { id } : undefined;
  },
  loader: ({ params }) => fetchUser(params.id),
});
```

The resource stays `idle`. This is how you avoid loading before the user has selected anything.

## Beyond HTTP

`resource` is not tied to the network, which is the point of having it as well as `httpResource`.

```typescript
// reading a file
protected readonly preview = resource({
  params: () => ({ file: this.selectedFile() }),
  loader: async ({ params }) => {
    if (!params.file) return null;
    return params.file.text();
  },
});
```

```typescript
// an indexedDB read
protected readonly draft = resource({
  params: () => ({ key: this.documentId() }),
  loader: ({ params }) => db.drafts.get(params.key),
});
```

```typescript
// a dynamically imported library doing heavy work
protected readonly rendered = resource({
  params: () => ({ markdown: this.source() }),
  loader: async ({ params }) => {
    const { marked } = await import('marked');
    return marked(params.markdown);
  },
});
```

Anything returning a promise fits.

## rxResource

When the async work is an observable, `rxResource` takes it directly.

```typescript
import { rxResource } from '@angular/core/rxjs-interop';

export class UserDetail {
  private readonly http = inject(HttpClient);
  readonly id = input.required<string>();

  protected readonly user = rxResource({
    params: () => ({ id: this.id() }),
    stream: ({ params }) => this.http.get<User>(`/api/users/${params.id}`),
  });
}
```

`stream` replaces `loader`. Angular subscribes, takes the values and unsubscribes when the params change or the component is destroyed.

## Why rxResource earns its place

Because you can use RxJS operators, and debouncing is the obvious case.

```typescript
export class Search {
  private readonly http = inject(HttpClient);

  protected readonly term = signal('');

  protected readonly results = rxResource({
    params: () => ({ term: this.term() }),
    stream: ({ params }) => {
      if (!params.term) return of([]);

      return timer(300).pipe(
        switchMap(() => this.http.get<Result[]>(`/api/search?q=${params.term}`)),
      );
    },
  });
}
```

The `timer(300)` delays the request, and because a new param value cancels the previous stream, typing quickly never fires the earlier requests. That is debouncing with cancellation, in three lines.

`httpResource` cannot do this. It fires immediately on every param change.

Another case: a stream that emits more than once.

```typescript
protected readonly liveOrders = rxResource({
  params: () => ({ id: this.customerId() }),
  stream: ({ params }) => this.websocket.orders$(params.id),
});
```

The resource value updates on every message. A promise based loader can only resolve once.

## Choosing between the three

```text
httpResource   an HTTP GET, using HttpClient and its interceptors
resource       any promise: fetch, file reads, indexedDB, dynamic imports
rxResource     an observable: debouncing, retries, websockets, polling
```

Start with `httpResource`. Move to `rxResource` when you need operators. Use `resource` when the work is not HTTP at all.

## Composing resources

A resource's params can read another resource's value.

```typescript
export class Dashboard {
  protected readonly user = httpResource<User>(() => '/api/me');

  protected readonly orders = httpResource<Order[]>(() => {
    const user = this.user.value();
    return user ? `/api/users/${user.id}/orders` : undefined;
  });
}
```

The second request waits until the first resolves, because `params` returns `undefined` until then. Sequential dependent requests need no coordination code.

## Error handling

```typescript
protected readonly users = rxResource({
  params: () => ({ page: this.page() }),
  stream: ({ params }) =>
    this.http.get<User[]>(`/api/users?page=${params.page}`).pipe(
      retry({ count: 2, delay: 1000 }),
    ),
});
```

```html
@if (users.error(); as error) {
  <p>Failed: {{ error }}</p>
  <button (click)="users.reload()">Try again</button>
}
```

Retrying inside the stream handles transient failures. `error()` plus `reload()` handles the rest.

## Testing

Resources are signals, so a test reads them after letting the microtask queue drain.

```typescript
it('loads the user', async () => {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });

  const fixture = TestBed.createComponent(UserDetail);
  fixture.componentRef.setInput('id', '42');

  const controller = TestBed.inject(HttpTestingController);

  await fixture.whenStable();

  controller.expectOne('/api/users/42').flush({ id: 42, name: 'Asha' });

  await fixture.whenStable();

  expect(fixture.componentInstance.user.value()?.name).toBe('Asha');
});
```

## Common mistakes

**Forgetting `abortSignal`.** Superseded requests keep running and can overwrite newer data.

**Reading a signal in the loader instead of `params`.** The loader is not reactive. Only `params` is tracked.

```typescript
// wrong: never refetches when id changes
resource({
  params: () => ({}),
  loader: () => fetchUser(this.id()),
});

// right
resource({
  params: () => ({ id: this.id() }),
  loader: ({ params }) => fetchUser(params.id),
});
```

**Using a resource for writes.** They are for reading. Call the API directly and reload.

**Expecting caching.** Two resources for the same URL make two requests. Share one in a service.

## Quick recap

- `resource` wraps any promise based work into signals.
- `params` is the reactive part, and the loader is not tracked.
- Always pass `abortSignal` so superseded work is cancelled.
- Returning `undefined` from `params` skips the load and stays idle.
- `rxResource` takes an observable, which is how you debounce, retry or stream.
- A resource whose params depend on another resource sequences requests automatically.
- All three are for reading. Write with `HttpClient`, then `reload()`.

<code id="code-content" class="language-typescript">
import { Component, Injectable, input, signal, inject, resource } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpClient, httpResource } from '@angular/common/http';
import { of, timer, switchMap, retry } from 'rxjs';
@Component({ selector: 'app-detail', template: `` })
export class Detail {
  private readonly http = inject(HttpClient);
  readonly id = input.required&lt;string&gt;();
  protected readonly term = signal('');
  // resource: ANY promise based work, not just HTTP
  protected readonly user = resource({
    params: () =&gt; ({ id: this.id() }),           // the ONLY reactive part
    loader: async ({ params, abortSignal }) =&gt; {
      // ALWAYS pass abortSignal, or a superseded request can land later
      // and overwrite newer data
      const response = await fetch(`/api/users/${params.id}`, { signal: abortSignal });
      if (!response.ok) throw new Error(response.statusText);
      return response.json() as Promise&lt;User&gt;;
    },
  });
  // rxResource: an OBSERVABLE, so RxJS operators are available.
  // This is debouncing with cancellation in three lines, which
  // httpResource cannot do.
  protected readonly results = rxResource({
    params: () =&gt; ({ term: this.term() }),
    stream: ({ params }) =&gt; params.term
      ? timer(300).pipe(switchMap(() =&gt;
          this.http.get&lt;Result[]&gt;(`/api/search?q=${params.term}`)))
      : of([]),
  });
  // A stream can emit MANY times. A promise loader resolves once.
  protected readonly live = rxResource({
    params: () =&gt; ({ id: this.id() }),
    stream: ({ params }) =&gt; this.socket.orders$(params.id),
  });
  // Composing: the second waits for the first, because params returns
  // undefined until the value exists. No coordination code needed.
  protected readonly me = httpResource&lt;User&gt;(() =&gt; '/api/me');
  protected readonly orders = httpResource&lt;Order[]&gt;(() =&gt; {
    const user = this.me.value();
    return user ? `/api/users/${user.id}/orders` : undefined;
  });
  private readonly socket = inject(SocketService);
}
// THE COMMON MISTAKE: the loader is NOT reactive. Only params is tracked.
//   resource({ params: () =&gt; ({}), loader: () =&gt; fetch(this.id()) })   never refetches
//   resource({ params: () =&gt; ({ id: this.id() }), loader: ({params}) =&gt; ... })  correct
// Choosing:
//   httpResource  an HTTP GET through HttpClient and its interceptors
//   resource      any promise: fetch, file reads, indexedDB, dynamic imports
//   rxResource    an observable: debouncing, retries, websockets, polling
// All three are for READING. Write with HttpClient, then reload().
// None of them cache: two resources for one URL make two requests.
interface User { id: number; name: string; }
interface Order { id: number; }
interface Result { id: number; }
</code></pre>
