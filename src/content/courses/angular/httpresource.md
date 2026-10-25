---
publishDate: 2026-06-16T10:15
title: Reactive Data Fetching with httpResource
slug: httpresource
metadescription: Fetch data as signals with httpResource, getting loading and error state without writing any subscription code.
updateDate: 2026-09-07T10:15
author: ['bishal-biswas']
level: 2
tags: ['http', 'resource', 'signals']
course: angular
---

## Fetching without subscriptions

`httpResource` turns an HTTP request into a set of signals. It is production ready in Angular 22 and is the shortest path for reading data.

```typescript
import { httpResource } from '@angular/common/http';

@Component({
  selector: 'app-user-list',
  template: `
    @if (users.isLoading()) {
      <app-spinner />
    } @else if (users.error()) {
      <p class="error">Could not load users</p>
    } @else {
      @for (user of users.value() ?? []; track user.id) {
        <p>{{ user.name }}</p>
      }
    }
  `,
})
export class UserList {
  protected readonly users = httpResource<User[]>(() => '/api/users');
}
```

No subscribe, no unsubscribe, no manual loading flag, no `catchError`.

## The signals it gives you

```typescript
users.value()      // the data, or undefined
users.isLoading()  // true while the request is in flight
users.error()      // the error, or undefined
users.status()     // 'idle' | 'loading' | 'resolved' | 'error' | 'reloading' | 'local'
users.hasValue()   // a type guard: true when value() is defined
```

`hasValue()` is worth using, because it narrows the type:

```html
@if (users.hasValue()) {
  @for (user of users.value(); track user.id) { ... }
}
```

Inside that block `value()` is `User[]` rather than `User[] | undefined`, so the `?? []` disappears.

## It reacts to signals

The request function is reactive. Reading a signal inside it means the request re-runs when that signal changes.

```typescript
export class UserDetail {
  readonly id = input.required<string>();

  protected readonly user = httpResource<User>(() => `/api/users/${this.id()}`);
}
```

Navigate from `/users/1` to `/users/2` and the resource refetches automatically. The previous request is aborted.

```typescript
export class Search {
  protected readonly term = signal('');
  protected readonly page = signal(1);

  protected readonly results = httpResource<Result[]>(() =>
    `/api/search?q=${this.term()}&page=${this.page()}`
  );
}
```

Changing either signal triggers a new request and cancels the old one.

## Skipping the request

Return `undefined` and no request is made.

```typescript
protected readonly user = httpResource<User>(() => {
  const id = this.selectedId();
  return id ? `/api/users/${id}` : undefined;
});
```

The resource stays in the `idle` status with no value. This is how you avoid firing a request before the user has chosen anything.

## The full request form

Instead of a URL string, return a request object.

```typescript
protected readonly users = httpResource<User[]>(() => ({
  url: '/api/users',
  method: 'GET',
  params: { role: this.role(), page: this.page() },
  headers: { 'X-Requested-With': 'resource' },
}));
```

Parameters are encoded for you, which is safer than building the string yourself.

## Typed variants

```typescript
httpResource<User[]>(() => '/api/users');           // JSON, the default
httpResource.text(() => '/api/readme');             // a string
httpResource.blob(() => '/api/report.pdf');         // binary
httpResource.arrayBuffer(() => '/api/data.bin');
```

## Default and parse

```typescript
protected readonly users = httpResource<User[]>(() => '/api/users', {
  defaultValue: [],
});
```

With `defaultValue`, `value()` is never `undefined`, so the template loses its `?? []`.

`parse` validates or transforms the response, which is where a schema library earns its place:

```typescript
import { z } from 'zod';

const UserSchema = z.array(z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
}));

protected readonly users = httpResource(() => '/api/users', {
  parse: response => UserSchema.parse(response),
  defaultValue: [],
});
```

Now the type is derived from the schema and checked at runtime. A plain generic is only an assertion, so a changed API fails silently. With `parse`, a mismatch becomes an error you can see.

## Reloading

```typescript
protected refresh(): void {
  this.users.reload();
}
```

The status becomes `reloading` rather than `loading`, so `value()` keeps the previous data while the new request runs. That avoids the page flashing empty on every refresh.

```html
@if (users.status() === 'reloading') {
  <span class="subtle">Updating...</span>
}
```

## Local updates

```typescript
protected rename(id: number, name: string): void {
  this.users.value.update(list =>
    (list ?? []).map(u => u.id === id ? { ...u, name } : u)
  );

  this.http.patch(`/api/users/${id}`, { name }).subscribe({
    error: () => this.users.reload(),      // put it back if the save failed
  });
}
```

`value` is writable, so you can update optimistically and reload on failure. The status becomes `local` to indicate the value did not come from the server.

## It uses the whole HTTP stack

`httpResource` goes through `HttpClient`, so interceptors, the base URL rewriting, authentication headers and XSRF protection all apply.

This is the difference from calling `fetch` in a `resource()`. Anything you have configured for `HttpClient` works here too.

## In a service

```typescript
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly selectedId = signal<string | null>(null);

  readonly user = httpResource<User>(() => {
    const id = this.selectedId();
    return id ? `/api/users/${id}` : undefined;
  });

  select(id: string): void {
    this.selectedId.set(id);
  }
}
```

Components inject the service and read `user.value()`, `user.isLoading()` and `user.error()`. Several components share one request rather than each making their own.

## What it does not do

**It is for reading, not writing.** Use `HttpClient` directly for POST, PUT and DELETE, then reload the resource.

```typescript
protected async save(user: NewUser): Promise<void> {
  await firstValueFrom(this.http.post<User>('/api/users', user));
  this.users.reload();
}
```

**No caching between components.** Two components each creating their own resource for the same URL make two requests. Put it in a service if it should be shared.

**No debouncing.** Reading a signal that changes on every keystroke fires a request per keystroke. Debounce the signal first, or use `rxResource` with RxJS operators.

## Compared with the alternatives

```text
                    subscribe    async pipe    toSignal    httpResource
loading state       manual       manual        manual      built in
error state         manual       manual        manual      built in
cancellation        manual       manual        manual      automatic
reacts to signals   manual       no            no          yes
reload              manual       manual        manual      built in
```

For reading data in new code, this is the shortest correct version.

## Quick recap

- `httpResource` turns a request into `value`, `isLoading`, `error` and `status` signals.
- The request function is reactive, so it refetches when a signal it reads changes.
- Returning `undefined` skips the request entirely.
- `hasValue()` narrows the type and removes the `?? []` from templates.
- `reload()` keeps the old value visible, avoiding an empty flash.
- `parse` with a schema turns a type assertion into a real runtime check.
- It is for reading. Use `HttpClient` for writes, then reload.

<code id="code-content" class="language-typescript">
import { Component, Injectable, input, signal, inject } from '@angular/core';
import { httpResource, HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
@Component({
  selector: 'app-user-detail',
  template: `
    @if (user.isLoading()) {
      &lt;app-spinner /&gt;
    } @else if (user.error()) {
      &lt;p class="error"&gt;Could not load&lt;/p&gt;
    } @else if (user.hasValue()) {
      &lt;!-- hasValue() NARROWS the type, so no ?? fallback is needed --&gt;
      &lt;h1&gt;{{ user.value().name }}&lt;/h1&gt;
    }
    &lt;!-- reloading keeps the previous value visible, so no empty flash --&gt;
    @if (user.status() === 'reloading') { &lt;span&gt;Updating...&lt;/span&gt; }
    &lt;button (click)="user.reload()"&gt;Refresh&lt;/button&gt;
  `,
})
export class UserDetail {
  readonly id = input.required&lt;string&gt;();
  // The request function is REACTIVE. Navigating /users/1 -&gt; /users/2
  // refetches automatically and aborts the previous request.
  protected readonly user = httpResource&lt;User&gt;(() =&gt; `/api/users/${this.id()}`);
}
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);
  readonly term = signal('');
  readonly page = signal(1);
  // The object form encodes params for you
  readonly results = httpResource&lt;Result[]&gt;(() =&gt; ({
    url: '/api/search',
    params: { q: this.term(), page: this.page() },
  }), { defaultValue: [] });        // value() is then never undefined
  // Returning undefined SKIPS the request entirely and stays idle
  private readonly selectedId = signal&lt;string | null&gt;(null);
  readonly user = httpResource&lt;User&gt;(() =&gt; {
    const id = this.selectedId();
    return id ? `/api/users/${id}` : undefined;
  });
  // value is writable: update optimistically, reload if the save fails
  rename(id: number, name: string): void {
    this.results.value.update(list =&gt; list.map(r =&gt; r.id === id ? { ...r, name } : r));
    this.http.patch(`/api/items/${id}`, { name })
      .subscribe({ error: () =&gt; this.results.reload() });
  }
  // It is for READING. Use HttpClient for writes, then reload.
  async create(item: unknown): Promise&lt;void&gt; {
    await firstValueFrom(this.http.post('/api/items', item));
    this.results.reload();
  }
}
// parse turns a type ASSERTION into a real runtime check:
//   httpResource(() =&gt; '/api/users', {
//     parse: r =&gt; UserSchema.parse(r),   // zod or similar
//     defaultValue: [],
//   })
// It goes through HttpClient, so interceptors, auth headers and XSRF apply.
// It does NOT debounce: a signal changing per keystroke fires a request per
// keystroke. Debounce the signal, or use rxResource.
interface User { id: number; name: string; }
interface Result { id: number; name: string; }
</code></pre>
