---
publishDate: 2026-06-20T11:15
title: RxJS Essentials for Angular
slug: rxjs-essentials
metadescription: Learn the RxJS you actually need for Angular, the operators that matter, and where signals have replaced it.
updateDate: 2026-09-07T11:15
author: ['bishal-biswas']
level: 3
tags: ['rxjs', 'observables', 'async']
course: angular
---

## What is left for RxJS

Signals took over state. RxJS still owns **events over time**: things that happen repeatedly, need cancelling, or need coordinating.

```text
Signals                      RxJS
a value that changes         a sequence of events
synchronous reads            asynchronous streams
what the UI displays         websockets, typing, polling, retries
```

You need far less RxJS than Angular used to demand, but the parts you need are worth knowing properly.

## An observable is a stream

```typescript
import { Observable } from 'rxjs';

const numbers$ = new Observable<number>(subscriber => {
  subscriber.next(1);
  subscriber.next(2);
  subscriber.complete();
});

numbers$.subscribe({
  next: value => console.log(value),
  error: error => console.error(error),
  complete: () => console.log('done'),
});
```

Three callbacks. `next` for each value, `error` once and then it stops, `complete` once and then it stops.

**Errors terminate the stream.** After an error, nothing more arrives. That single fact explains most RxJS surprises.

## Cold and hot

```typescript
const request$ = this.http.get<User[]>('/api/users');

request$.subscribe();    // one request
request$.subscribe();    // a second request
```

HTTP observables are **cold**: the work starts on subscribe, and each subscriber gets its own.

```typescript
const clicks$ = fromEvent(button, 'click');
```

DOM events are **hot**: they happen whether anyone is listening, and subscribers share them.

Mixing this up is why the `async` pipe used twice makes two requests.

## Creating them

```typescript
of(1, 2, 3)                          // emits then completes
from([1, 2, 3])                      // from an array, promise or iterable
fromEvent(element, 'click')          // DOM events
interval(1000)                       // 0, 1, 2... every second
timer(500)                           // one value after 500ms
timer(0, 1000)                       // immediately, then every second
EMPTY                                // completes with nothing
NEVER                                // never emits or completes
throwError(() => new Error('bad'))   // errors immediately
```

## The operators worth knowing

**Transforming:**

```typescript
source$.pipe(
  map(x => x * 2),
  filter(x => x > 10),
  tap(x => console.log(x)),          // side effect, does not change the value
  scan((total, x) => total + x, 0),  // a running accumulation
);
```

**Timing:**

```typescript
source$.pipe(
  debounceTime(300),          // wait for a pause
  throttleTime(1000),         // at most one per second
  distinctUntilChanged(),     // ignore repeats
  delay(500),
  timeout(5000),
);
```

`debounceTime` and `distinctUntilChanged` together are the search box pattern, and probably the most used pair in Angular.

**Combining:**

```typescript
combineLatest([a$, b$])       // the latest of each, once all have emitted
merge(a$, b$)                 // values from either, interleaved
concat(a$, b$)                // all of a, then all of b
forkJoin([a$, b$])            // the final value of each, once all complete
withLatestFrom(b$)            // a's values, each paired with b's latest
startWith(initial)            // emit this first
```

`forkJoin` is the RxJS equivalent of `Promise.all` and only works with observables that complete. Using it with something that never completes hangs silently.

**Error handling:**

```typescript
source$.pipe(
  catchError(error => of(fallbackValue)),
  retry({ count: 3, delay: 1000 }),
  finalize(() => console.log('cleaned up')),
);
```

## The flattening operators

This is the part worth understanding properly, because the choice changes behaviour.

All four take a value and return a new observable. They differ in what happens when a new value arrives while the previous inner observable is still running.

```typescript
switchMap    cancel the previous, use the new one
mergeMap     run them all at once
concatMap    queue them, one at a time in order
exhaustMap   ignore the new one until the current finishes
```

**`switchMap` for search and navigation:**

```typescript
this.searchTerm$.pipe(
  debounceTime(300),
  switchMap(term => this.http.get<Result[]>(`/api/search?q=${term}`)),
);
```

Typing a new term cancels the previous request. Without `switchMap`, a slow earlier response can arrive after a newer one and overwrite it.

**`concatMap` for ordered writes:**

```typescript
this.saves$.pipe(
  concatMap(change => this.http.patch('/api/doc', change)),
);
```

Each save completes before the next starts, so they apply in order.

**`exhaustMap` for submit buttons:**

```typescript
this.submits$.pipe(
  exhaustMap(() => this.http.post('/api/order', this.order())),
);
```

Double clicking submit does not create two orders, because the second click is ignored while the first is in flight.

**`mergeMap` when order does not matter** and you want maximum concurrency, such as uploading several files.

The default choice for HTTP triggered by user input is `switchMap`. Reach for the others deliberately.

## Subscribing safely

```typescript
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export class Search {
  constructor() {
    this.service.updates$
      .pipe(takeUntilDestroyed())
      .subscribe(update => this.handle(update));
  }
}
```

In a constructor it needs no argument. Elsewhere, pass a `DestroyRef`:

```typescript
private readonly destroyRef = inject(DestroyRef);

load(): void {
  this.service.get().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
}
```

The older pattern, which you will read constantly:

```typescript
private readonly destroy$ = new Subject<void>();

ngOnInit(): void {
  this.service.updates$.pipe(takeUntil(this.destroy$)).subscribe();
}

ngOnDestroy(): void {
  this.destroy$.next();
  this.destroy$.complete();
}
```

`takeUntilDestroyed` replaced all of it.

Better still, avoid subscribing at all. Use `toSignal`, `httpResource` or the `async` pipe, and unsubscription is not your problem.

## Converting to promises

```typescript
import { firstValueFrom, lastValueFrom } from 'rxjs';

async save(): Promise<void> {
  const user = await firstValueFrom(this.http.post<User>('/api/users', data));
  this.router.navigate(['/users', user.id]);
}
```

`firstValueFrom` takes the first value then unsubscribes, which is right for HTTP. `lastValueFrom` waits for completion.

`toPromise()` is removed. Do not use it in new code.

## When to use RxJS now

**Yes:**

- Debouncing typing.
- Cancelling superseded requests.
- Websockets and server sent events.
- Polling.
- Retries with back off.
- Coordinating several async sources.

**No:**

- Holding state a template reads. Use a signal.
- Simple HTTP GETs. Use `httpResource`.
- Deriving one value from another. Use `computed`.
- Component communication. Use a service with signals.

The historical use of a `BehaviorSubject` as a store is exactly what signals replaced.

## Quick recap

- RxJS is for events over time, signals are for state.
- An error terminates a stream permanently.
- HTTP observables are cold, so each subscription is a new request.
- `debounceTime` plus `distinctUntilChanged` is the search box pattern.
- `switchMap` cancels, `concatMap` queues, `exhaustMap` ignores, `mergeMap` parallelises.
- `takeUntilDestroyed` replaced the `destroy$` subject pattern.
- Prefer not subscribing at all: `toSignal`, `httpResource` or the `async` pipe.

<code id="code-content" class="language-typescript">
import { inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { of, from, fromEvent, timer, interval, combineLatest, forkJoin, merge,
         map, filter, tap, scan, debounceTime, distinctUntilChanged, startWith,
         switchMap, concatMap, exhaustMap, mergeMap, catchError, retry,
         finalize, firstValueFrom } from 'rxjs';
// An error TERMINATES the stream. Nothing arrives after it.
// That one fact explains most RxJS surprises.
// The search box pattern, and the most used pair in Angular
const results$ = searchTerm$.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  // switchMap CANCELS the previous request. Without it a slow earlier
  // response can land after a newer one and overwrite it.
  switchMap(term =&gt; http.get&lt;Result[]&gt;(`/api/search?q=${term}`)),
  catchError(() =&gt; of([])),
);
// The four flattening operators differ ONLY in what happens when a new
// value arrives while the previous inner observable is still running:
//   switchMap    cancel the previous          search, navigation
//   concatMap    queue them, in order         ordered writes
//   exhaustMap   ignore the new one           submit buttons, no double orders
//   mergeMap     run them all at once         parallel uploads
const orderedSaves$ = changes$.pipe(concatMap(c =&gt; http.patch('/api/doc', c)));
const oneOrder$ = submits$.pipe(exhaustMap(() =&gt; http.post('/api/order', {})));
// Combining. forkJoin is Promise.all, and only works with streams that
// COMPLETE. Using it with one that never completes hangs silently.
const both$ = forkJoin([http.get('/api/a'), http.get('/api/b')]);
const latest$ = combineLatest([a$, b$]);   // waits for each to emit once
// Retries with back off
const resilient$ = http.get('/api/data').pipe(
  retry({ count: 3, delay: 1000 }),
  finalize(() =&gt; console.log('done')));
// Subscribing safely. In a constructor takeUntilDestroyed needs no argument.
class Search {
  private readonly destroyRef = inject(DestroyRef);
  constructor() {
    updates$.pipe(takeUntilDestroyed()).subscribe(u =&gt; this.handle(u));
  }
  load(): void {
    http.get('/api/x').pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
  private handle(u: unknown) {}
}
// This replaced the old pattern you will read everywhere:
//   private destroy$ = new Subject&lt;void&gt;();
//   ngOnInit()    { x$.pipe(takeUntil(this.destroy$)).subscribe(); }
//   ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
// Better still, do not subscribe at all: toSignal, httpResource, async pipe.
const users = toSignal(http.get&lt;User[]&gt;('/api/users'), { initialValue: [] });
// Converting to a promise. toPromise() was REMOVED.
async function save() { return firstValueFrom(http.post('/api/users', {})); }
// Use RxJS for: debouncing, cancellation, websockets, polling, retries.
// Use signals for: state, derived values, component communication.
// A BehaviorSubject used as a store is exactly what signals replaced.
</code></pre>
