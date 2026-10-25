---
publishDate: 2026-06-20T11:25
title: 'Signals and RxJS Interop: toSignal and toObservable'
slug: signals-rxjs-interop
metadescription: Convert between signals and observables with toSignal and toObservable, and know which direction you actually need.
updateDate: 2026-09-07T11:25
author: ['bishal-biswas']
level: 3
tags: ['signals', 'rxjs', 'interop']
course: angular
---

## Two directions

```typescript
import { toSignal, toObservable } from '@angular/core/rxjs-interop';

const users = toSignal(users$);          // observable to signal
const term$ = toObservable(this.term);   // signal to observable
```

Most real code needs the first far more than the second.

## toSignal

It subscribes, tracks the latest value, and unsubscribes when the injection context is destroyed.

```typescript
export class UserList {
  private readonly http = inject(HttpClient);

  protected readonly users = toSignal(
    this.http.get<User[]>('/api/users'),
    { initialValue: [] },
  );
}
```

```html
@for (user of users(); track user.id) {
  <p>{{ user.name }}</p>
}
```

It is the `async` pipe as a signal, usable outside templates and without the falsy value trap.

## The initial value

A signal must have a value immediately, but an observable may not have emitted yet. Three ways to resolve that:

```typescript
// 1. undefined until it emits
const users = toSignal(users$);
// Signal<User[] | undefined>

// 2. a starting value
const users = toSignal(users$, { initialValue: [] });
// Signal<User[]>

// 3. require a synchronous first emission
const users = toSignal(users$, { requireSync: true });
// Signal<User[]>, throws if the source does not emit synchronously
```

`requireSync: true` is right for a `BehaviorSubject`, which always has a value. It throws for HTTP, which never emits synchronously.

```typescript
// correct: a BehaviorSubject always has a value
protected readonly user = toSignal(this.auth.user$, { requireSync: true });

// wrong: HTTP is asynchronous, this throws at runtime
protected readonly users = toSignal(this.http.get('/api/users'), { requireSync: true });
```

## Where it can be called

`toSignal` needs an injection context, so it belongs in a field initialiser or constructor. Otherwise pass an injector:

```typescript
private readonly injector = inject(Injector);

load(): void {
  const data = toSignal(this.http.get('/api/x'), {
    initialValue: null,
    injector: this.injector,
  });
}
```

## Errors

An error in the source is **rethrown when the signal is read**.

```typescript
protected readonly users = toSignal(
  this.http.get<User[]>('/api/users').pipe(
    catchError(() => of([])),
  ),
  { initialValue: [] },
);
```

Handle errors in the pipeline. Without a `catchError`, reading the signal in a template throws, and the error surfaces in an unhelpful place.

For loading and error state, `httpResource` is the better tool. `toSignal` is for bridging a stream you already have.

## toObservable

The other direction. It watches a signal and emits when it changes.

```typescript
export class Search {
  protected readonly term = signal('');

  private readonly results$ = toObservable(this.term).pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(term => this.http.get<Result[]>(`/api/search?q=${term}`)),
  );

  protected readonly results = toSignal(this.results$, { initialValue: [] });
}
```

Signal in, RxJS operators in the middle, signal out. That is the main reason `toObservable` exists: to reach operators signals do not have.

## The timing detail

`toObservable` uses an effect, so it emits **after** change detection rather than synchronously.

```typescript
const count = signal(0);
const count$ = toObservable(count);

count$.subscribe(v => console.log(v));

count.set(1);
count.set(2);
count.set(3);

// logs 3, once. Not 0, 1, 2, 3.
```

Intermediate values are dropped. That is correct for driving a UI and wrong if you need every value, in which case use a `Subject` instead.

## Which direction to choose

**Observable to signal** whenever a template needs the value. HTTP, websockets, router events, anything from a library.

**Signal to observable** only when you need RxJS operators: debouncing, cancellation, retries, combining several async sources.

If neither applies, do not convert. A signal that stays a signal is simpler.

## Converting router events

```typescript
export class App {
  private readonly router = inject(Router);

  protected readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
}
```

For route parameters, `withComponentInputBinding()` is simpler than converting.

## Converting form state

```typescript
export class UserForm {
  protected readonly form = this.fb.group({ email: [''] });

  protected readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly isValid = toSignal(
    this.form.statusChanges.pipe(map(s => s === 'VALID')),
    { initialValue: this.form.valid },
  );
}
```

This is how reactive forms fit into a signal based component. Signal forms need none of it, which is a fair part of their appeal.

## outputFromObservable

Exposing a transformed stream as a component output.

```typescript
import { outputFromObservable, outputToObservable } from '@angular/core/rxjs-interop';

export class SearchBox {
  protected readonly term = signal('');

  readonly search = outputFromObservable(
    toObservable(this.term).pipe(
      debounceTime(300),
      distinctUntilChanged(),
    ),
  );
}
```

The parent binds `(search)` like any output, and the debouncing is the child's business.

`outputToObservable` goes the other way, turning an output into a stream for use in a pipeline.

## takeUntilDestroyed

Not a conversion, but part of the same package and the one you will use most.

```typescript
constructor() {
  this.service.updates$
    .pipe(takeUntilDestroyed())
    .subscribe(update => this.handle(update));
}
```

It completes the observable when the injection context is destroyed, replacing the `destroy$` subject pattern entirely.

## pendingUntilEvent

For server-side rendering, this tells Angular to hold the response until a stream settles.

```typescript
import { pendingUntilEvent } from '@angular/core/rxjs-interop';

protected readonly data = toSignal(
  this.http.get<Data>('/api/data').pipe(pendingUntilEvent()),
);
```

Without it, the server might render before your data arrives, producing an empty page in the HTML. `httpResource` handles this automatically.

## Common mistakes

**`requireSync` on an async source.** It throws at runtime rather than at build time.

**No `catchError` before `toSignal`.** The error surfaces when the template reads the signal, far from its cause.

**Expecting every value from `toObservable`.** It drops intermediate values within one change detection cycle.

**Converting when you do not need to.** `toObservable` followed immediately by `toSignal` with no operators between is pure overhead.

**Using `toSignal` for data fetching in new code.** `httpResource` gives loading and error state for free.

## Quick recap

- `toSignal` subscribes and unsubscribes automatically, like the `async` pipe.
- Supply `initialValue`, or the type includes `undefined`.
- `requireSync: true` suits a `BehaviorSubject` and throws for HTTP.
- Catch errors in the pipeline, or reading the signal throws in the template.
- `toObservable` exists to reach RxJS operators, and drops intermediate values.
- `outputFromObservable` exposes a debounced stream as an ordinary output.
- Prefer `httpResource` over `toSignal` for new data fetching.

<code id="code-content" class="language-typescript">
import { Component, inject, signal, Injector } from '@angular/core';
import { toSignal, toObservable, takeUntilDestroyed, outputFromObservable,
         pendingUntilEvent } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { of, map, filter, catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
@Component({ selector: 'app-search', template: `` })
export class Search {
  private readonly http = inject(HttpClient);
  private readonly injector = inject(Injector);
  protected readonly term = signal('');
  // OBSERVABLE -&gt; SIGNAL. Subscribes and unsubscribes for you.
  // Without initialValue the type includes undefined.
  protected readonly users = toSignal(
    this.http.get&lt;User[]&gt;('/api/users').pipe(
      catchError(() =&gt; of([]))),        // catch HERE, or reading the signal throws
    { initialValue: [] as User[] });
  // requireSync suits a BehaviorSubject, which always has a value.
  // It THROWS for HTTP, which never emits synchronously.
  protected readonly user = toSignal(this.auth.user$, { requireSync: true });
  // SIGNAL -&gt; OBSERVABLE -&gt; SIGNAL. The only reason to go this way is to
  // reach operators signals do not have.
  protected readonly results = toSignal(
    toObservable(this.term).pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(t =&gt; this.http.get&lt;Result[]&gt;(`/api/search?q=${t}`)),
      catchError(() =&gt; of([]))),
    { initialValue: [] as Result[] });
  // Expose a debounced stream as an ordinary output. The parent just
  // binds (search) and knows nothing about the debouncing.
  readonly search = outputFromObservable(
    toObservable(this.term).pipe(debounceTime(300), distinctUntilChanged()));
  constructor() {
    // Replaces the whole destroy$ Subject + ngOnDestroy pattern
    this.updates$.pipe(takeUntilDestroyed()).subscribe(u =&gt; this.handle(u));
  }
  later(): void {
    // Outside an injection context, pass an injector
    toSignal(this.http.get('/api/x'), { initialValue: null, injector: this.injector });
  }
  private readonly updates$ = of(1);
  private readonly auth = { user$: of({ name: '' }) };
  private handle(u: unknown) {}
}
// TIMING: toObservable uses an effect, so it emits AFTER change detection.
//   count.set(1); count.set(2); count.set(3);   -&gt; the subscriber logs 3, ONCE.
// Intermediate values are dropped. Correct for a UI, wrong if you need
// every value. Use a Subject for that.
// For SSR, pendingUntilEvent holds the server response until the stream settles:
//   toSignal(http.get('/api/data').pipe(pendingUntilEvent()))
//   httpResource does this automatically.
// Do NOT convert when you do not need to. toObservable immediately followed
// by toSignal with no operators between is pure overhead.
// And for NEW data fetching, prefer httpResource: it gives loading and
// error state that toSignal makes you build yourself.
interface User { id: number; name: string; }
interface Result { id: number; }
</code></pre>
