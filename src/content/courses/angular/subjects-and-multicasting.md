---
publishDate: 2026-06-20T11:20
title: Subjects, Multicasting and Sharing
slug: subjects-and-multicasting
metadescription: Understand Subject, BehaviorSubject and ReplaySubject, share one stream between subscribers, and know why signals replaced most of them.
updateDate: 2026-09-07T11:20
author: ['bishal-biswas']
level: 3
tags: ['rxjs', 'subjects', 'multicasting']
course: angular
---

## A Subject is both ends of a stream

An observable produces values. A `Subject` is an observable you can push values into.

```typescript
import { Subject } from 'rxjs';

const clicks$ = new Subject<string>();

clicks$.subscribe(v => console.log('A:', v));
clicks$.subscribe(v => console.log('B:', v));

clicks$.next('save');
// A: save
// B: save
```

Both subscribers get the same value. A `Subject` is **multicast**: one execution, many listeners. A plain cold observable is unicast, giving each subscriber its own run.

## The four kinds

**`Subject`** has no current value. Subscribers only see what is emitted after they subscribe.

```typescript
const subject = new Subject<number>();

subject.next(1);                              // nobody is listening, lost
subject.subscribe(v => console.log(v));
subject.next(2);                              // logs 2
```

**`BehaviorSubject`** holds a current value and emits it immediately to new subscribers.

```typescript
const state = new BehaviorSubject<number>(0);

state.subscribe(v => console.log('A:', v));   // A: 0, immediately
state.next(5);                                // A: 5

state.subscribe(v => console.log('B:', v));   // B: 5, immediately
console.log(state.value);                     // 5, read synchronously
```

This was **the** state container in Angular before signals. Almost every service written between 2017 and 2023 has one.

**`ReplaySubject`** remembers several values and replays them.

```typescript
const recent = new ReplaySubject<string>(3);

recent.next('a');
recent.next('b');
recent.next('c');
recent.next('d');

recent.subscribe(v => console.log(v));    // b, c, d
```

Also takes a time window:

```typescript
new ReplaySubject<string>(Infinity, 5000);   // everything from the last 5 seconds
```

**`AsyncSubject`** emits only the final value, and only on completion. Rare.

## The old store pattern

```typescript
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly itemsSubject = new BehaviorSubject<CartItem[]>([]);

  readonly items$ = this.itemsSubject.asObservable();

  readonly total$ = this.items$.pipe(
    map(items => items.reduce((sum, i) => sum + i.price, 0)),
  );

  add(item: CartItem): void {
    this.itemsSubject.next([...this.itemsSubject.value, item]);
  }
}
```

```html
<p>{{ (cart.total$ | async) | currency }}</p>
```

`asObservable()` hides `next` from consumers, so only the service can change the state.

The signal version:

```typescript
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly itemsState = signal<CartItem[]>([]);

  readonly items = this.itemsState.asReadonly();
  readonly total = computed(() => this.items().reduce((s, i) => s + i.price, 0));

  add(item: CartItem): void {
    this.itemsState.update(items => [...items, item]);
  }
}
```

Same structure, and `asReadonly()` mirrors `asObservable()` exactly. No subscription, no `async` pipe, and `total` is cached rather than recomputed per subscriber.

**If you find a `BehaviorSubject` used purely as state, it should be a signal.**

## Where Subjects are still right

**Events with no current value.** A notification, a refresh trigger, a save completing.

```typescript
@Injectable({ providedIn: 'root' })
export class RefreshService {
  private readonly refreshSubject = new Subject<void>();

  readonly refresh$ = this.refreshSubject.asObservable();

  trigger(): void {
    this.refreshSubject.next();
  }
}
```

```typescript
protected readonly data = toSignal(
  this.refresh.refresh$.pipe(
    startWith(undefined),
    switchMap(() => this.http.get<Data>('/api/data')),
  ),
);
```

A signal cannot express "it happened again with the same value", because setting a signal to its current value notifies nobody. That is exactly what a `Subject` is for.

**Bridging a callback API into a stream.**

```typescript
@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly messages = new Subject<Message>();

  readonly messages$ = this.messages.asObservable();

  constructor() {
    const socket = new WebSocket('wss://example.com');

    socket.onmessage = event => this.messages.next(JSON.parse(event.data));

    inject(DestroyRef).onDestroy(() => socket.close());
  }
}
```

**Driving an RxJS pipeline from user input.**

```typescript
export class Search {
  private readonly terms = new Subject<string>();

  protected readonly results = toSignal(
    this.terms.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => this.http.get<Result[]>(`/api/search?q=${term}`)),
    ),
    { initialValue: [] },
  );

  protected onInput(term: string): void {
    this.terms.next(term);
  }
}
```

The `Subject` is the entry point, and `toSignal` is the exit. That combination is the common shape now.

## Sharing a cold observable

Several subscribers to a cold observable each trigger the work.

```typescript
const users$ = this.http.get<User[]>('/api/users');

users$.subscribe();    // request 1
users$.subscribe();    // request 2
```

`shareReplay` multicasts it:

```typescript
const users$ = this.http.get<User[]>('/api/users').pipe(
  shareReplay({ bufferSize: 1, refCount: true }),
);

users$.subscribe();    // request
users$.subscribe();    // no request, replays the cached value
```

**Always pass `refCount: true`.** Without it, the subscription to the source stays alive forever even when every subscriber has gone, which leaks and keeps stale data cached.

```typescript
shareReplay(1)                                  // leaks, avoid
shareReplay({ bufferSize: 1, refCount: true })  // correct
```

## Caching with shareReplay

```typescript
@Injectable({ providedIn: 'root' })
export class ConfigService {
  readonly config$ = this.http.get<Config>('/api/config').pipe(
    shareReplay({ bufferSize: 1, refCount: false }),
  );
}
```

Here `refCount: false` is deliberate: the config is fetched once and cached for the application's life, even if nothing is subscribed for a while.

Know which behaviour you want. That flag is the whole decision.

## Multicasting operators

```typescript
share()                                    // multicast, resets when subscribers drop
shareReplay({ bufferSize: 1, refCount: true })   // multicast plus replay
connectable(source$)                       // manual control over when it starts
```

`share()` gives new subscribers only future values. `shareReplay` gives them the buffered ones. For HTTP you almost always want `shareReplay`, since a late subscriber otherwise gets nothing.

## Completing and errors

A Subject that errors or completes is **dead**. Later `next` calls do nothing.

```typescript
const subject = new Subject<number>();

subject.error(new Error('boom'));
subject.next(1);                 // ignored, silently
```

This catches people using a Subject as an event bus. One error and the bus stops working with no obvious sign.

Guard against it by catching inside the pipeline rather than letting errors reach the Subject:

```typescript
this.terms.pipe(
  switchMap(term =>
    this.http.get<Result[]>(`/api/search?q=${term}`).pipe(
      catchError(() => of([])),      // contained here, the outer stream survives
    ),
  ),
);
```

Putting `catchError` on the **inner** observable is the important detail. On the outer one it would terminate the whole stream after the first failure.

## Cleaning up

```typescript
export class Widget implements OnDestroy {
  private readonly events = new Subject<string>();

  ngOnDestroy(): void {
    this.events.complete();
  }
}
```

Completing a Subject tells its subscribers to finish, which releases them. In a service with `providedIn: 'root'` this rarely matters, but in a component scoped service it does.

## Quick recap

- A Subject is an observable you can push into, and it multicasts.
- `BehaviorSubject` holds a current value and was the pre signals state container.
- If a `BehaviorSubject` is used purely as state, it should be a signal.
- Subjects are still right for events, callback bridging and driving pipelines.
- `asObservable()` hides `next`, exactly as `asReadonly()` hides `set`.
- `shareReplay` needs `refCount: true` unless you deliberately want a permanent cache.
- An errored Subject is dead, so catch errors on the inner observable.

<code id="code-content" class="language-typescript">
import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { Subject, BehaviorSubject, ReplaySubject, of,
         map, switchMap, debounceTime, distinctUntilChanged,
         catchError, shareReplay, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
// Subject          no current value, only future emissions
// BehaviorSubject  holds a value, emits it immediately to new subscribers
// ReplaySubject(n) replays the last n values
const events = new Subject&lt;string&gt;();
const state = new BehaviorSubject&lt;number&gt;(0);
const recent = new ReplaySubject&lt;string&gt;(3);
console.log(state.value);        // readable synchronously
// THE OLD STORE PATTERN. asObservable() hides next() from consumers.
@Injectable({ providedIn: 'root' })
export class OldCart {
  private readonly itemsSubject = new BehaviorSubject&lt;Item[]&gt;([]);
  readonly items$ = this.itemsSubject.asObservable();
  readonly total$ = this.items$.pipe(map(i =&gt; i.reduce((s, x) =&gt; s + x.price, 0)));
  add(item: Item) { this.itemsSubject.next([...this.itemsSubject.value, item]); }
}
// The signal version. asReadonly() mirrors asObservable() exactly.
// A BehaviorSubject used PURELY as state should be a signal.
@Injectable({ providedIn: 'root' })
export class Cart {
  private readonly itemsState = signal&lt;Item[]&gt;([]);
  readonly items = this.itemsState.asReadonly();
  readonly total = computed(() =&gt; this.items().reduce((s, x) =&gt; s + x.price, 0));
  add(item: Item) { this.itemsState.update(i =&gt; [...i, item]); }
}
// Subjects are STILL right for events with no current value. A signal cannot
// express "it happened again with the same value": setting a signal to its
// current value notifies nobody.
@Injectable({ providedIn: 'root' })
export class Refresh {
  private readonly subject = new Subject&lt;void&gt;();
  readonly refresh$ = this.subject.asObservable();
  trigger() { this.subject.next(); }
}
// The common modern shape: a Subject in, toSignal out
export class Search {
  private readonly terms = new Subject&lt;string&gt;();
  protected readonly results = toSignal(this.terms.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(term =&gt; http.get&lt;Result[]&gt;(`/api/search?q=${term}`).pipe(
      // catchError on the INNER observable. On the outer one it would
      // terminate the whole stream after the first failure.
      catchError(() =&gt; of([])))),
  ), { initialValue: [] as Result[] });
  protected onInput(term: string) { this.terms.next(term); }
}
// Sharing a COLD observable so several subscribers cause ONE request.
// ALWAYS pass refCount: true, or the source subscription never releases.
const users$ = http.get&lt;User[]&gt;('/api/users').pipe(
  shareReplay({ bufferSize: 1, refCount: true }));
// refCount: false is deliberate for a fetch once, cache forever config
const config$ = http.get&lt;Config&gt;('/api/config').pipe(
  shareReplay({ bufferSize: 1, refCount: false }));
// An errored or completed Subject is DEAD. Later next() calls do nothing,
// silently. That is how an event bus quietly stops working.
interface Item { price: number; }
interface Result { id: number; }
interface Config { url: string; }
interface User { id: number; }
</code></pre>
