---
publishDate: 2026-06-15T10:00
title: Observables and the async Pipe
slug: observables-and-async-pipe
metadescription: Render asynchronous data with observables and the async pipe, the pattern that dominated Angular before signals.
updateDate: 2026-09-07T10:00
author: ['bishal-biswas']
level: 2
tags: ['rxjs', 'async pipe', 'observables']
course: angular
---

## The pattern you will read everywhere

Before signals, this was how Angular displayed asynchronous data.

```typescript
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-user-list',
  imports: [AsyncPipe],
  template: `
    @if (users$ | async; as users) {
      @for (user of users; track user.id) {
        <p>{{ user.name }}</p>
      }
    } @else {
      <app-spinner />
    }
  `,
})
export class UserList {
  private readonly http = inject(HttpClient);

  protected readonly users$ = this.http.get<User[]>('/api/users');
}
```

The `$` suffix on a variable name is a widespread convention meaning "this is an observable".

## What the async pipe does

Four things, and the last two are why it exists.

1. Subscribes to the observable.
2. Returns the latest emitted value, or `null` before the first emission.
3. Marks the component for check when a value arrives.
4. **Unsubscribes when the component is destroyed.**

That last point is the whole reason to use it rather than subscribing by hand. Manual subscriptions leak unless you remember to clean them up.

```typescript
// leaks if you forget
ngOnInit(): void {
  this.service.updates$.subscribe(u => this.handle(u));
}
```

```typescript
// no leak possible
protected readonly updates$ = this.service.updates$;
```

## Each async is a separate subscription

The most important thing to know, and a real source of duplicate requests.

```html
<!-- TWO subscriptions, TWO HTTP requests -->
<p>{{ (users$ | async)?.length }} users</p>
<p>First: {{ (users$ | async)?.[0]?.name }}</p>
```

```html
<!-- ONE subscription -->
@if (users$ | async; as users) {
  <p>{{ users.length }} users</p>
  <p>First: {{ users[0]?.name }}</p>
}
```

The `as` binding stores the value so the rest of the block reads it directly.

The older equivalent used `*ngIf`, and you will see it constantly:

```html
<ng-container *ngIf="users$ | async as users">
  <p>{{ users.length }} users</p>
</ng-container>
```

If the same observable genuinely needs several subscriptions, share it:

```typescript
protected readonly users$ = this.http.get<User[]>('/api/users').pipe(
  shareReplay({ bufferSize: 1, refCount: true }),
);
```

## The falsy value trap

```html
@if (count$ | async; as count) {
  <p>{{ count }}</p>
}
```

When `count` is `0`, the block does not render. `0` is falsy, and `@if` cannot tell it apart from "no value yet".

The fix is to check explicitly:

```html
@if ((count$ | async) !== null) {
  <p>{{ count$ | async }}</p>
}
```

Or wrap the value:

```typescript
protected readonly state$ = this.count$.pipe(map(count => ({ count })));
```

```html
@if (state$ | async; as state) {
  <p>{{ state.count }}</p>
}
```

The same problem affects empty strings and `false`. It is one of the reasons signals are easier.

## Combining several streams

```typescript
protected readonly viewModel$ = combineLatest({
  user: this.userService.current$,
  orders: this.orderService.recent$,
  settings: this.settingsService.current$,
});
```

```html
@if (viewModel$ | async; as vm) {
  <h1>{{ vm.user.name }}</h1>
  <p>{{ vm.orders.length }} recent orders</p>
}
```

One subscription, one `@if`, and everything typed. This "view model" pattern was the standard way to avoid several `async` pipes in one template.

Note `combineLatest` waits for **every** source to emit at least once. One stream that never emits blocks the whole thing.

## Reacting to route parameters

```typescript
export class UserDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly users = inject(UserService);

  protected readonly user$ = this.route.paramMap.pipe(
    map(params => params.get('id')!),
    switchMap(id => this.users.getById(id)),
  );
}
```

`switchMap` cancels the previous request when a new id arrives, which is exactly right for navigation. Using `mergeMap` here would let a slow earlier response overwrite a newer one.

## Errors

An error terminates the observable. The `async` pipe rethrows it, and nothing renders afterwards.

```typescript
protected readonly users$ = this.http.get<User[]>('/api/users').pipe(
  catchError(() => of([])),
);
```

Better, keep the error visible:

```typescript
protected readonly state$ = this.http.get<User[]>('/api/users').pipe(
  map(users => ({ users, error: null })),
  catchError(error => of({ users: [], error })),
  startWith({ users: [], error: null }),
);
```

```html
@if (state$ | async; as state) {
  @if (state.error) {
    <p class="error">Could not load users</p>
  } @else {
    @for (user of state.users; track user.id) { ... }
  }
}
```

That is a lot of ceremony for loading and error state. `httpResource` provides both directly, which is the main reason it exists.

## Subscribing manually

Sometimes you genuinely need to, for example to trigger navigation after a save.

```typescript
export class UserForm {
  private readonly destroyRef = inject(DestroyRef);

  save(): void {
    this.users.create(this.form())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: user => this.router.navigate(['/users', user.id]),
        error: () => this.notifications.show('Save failed'),
      });
  }
}
```

`takeUntilDestroyed` completes the observable when the component is destroyed. In a constructor it needs no argument:

```typescript
constructor() {
  this.service.updates$
    .pipe(takeUntilDestroyed())
    .subscribe(u => this.handle(u));
}
```

Outside a constructor, pass the `DestroyRef` explicitly.

The older pattern, which you will still meet:

```typescript
export class UserList implements OnDestroy {
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.service.updates$
      .pipe(takeUntil(this.destroy$))
      .subscribe(u => this.handle(u));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

`takeUntilDestroyed` replaced all of that.

## Converting to signals

```typescript
import { toSignal } from '@angular/core/rxjs-interop';

export class UserList {
  protected readonly users = toSignal(
    this.http.get<User[]>('/api/users'),
    { initialValue: [] },
  );
}
```

```html
@for (user of users(); track user.id) { ... }
```

`toSignal` subscribes and unsubscribes exactly like the `async` pipe, and gives a signal instead. No falsy trap, no repeated subscriptions, and it works outside templates.

The `initialValue` matters. Without it the type includes `undefined`, since a signal must have a value immediately.

## Which to use now

```text
async pipe        existing code, and templates already using observables
toSignal          bridging an existing observable into signal based code
httpResource      new data fetching, with loading and error state included
```

For new code fetching data, `httpResource` is the shortest path. `toSignal` is the bridge for streams you already have. The `async` pipe remains correct and is not going anywhere, so there is no need to rewrite working templates.

## Quick recap

- The `async` pipe subscribes, unwraps and unsubscribes automatically.
- Every use of `async` on the same observable creates another subscription.
- Use `@if (x$ | async; as x)` to subscribe once and reuse the value.
- Falsy values like `0` and `''` do not render inside `@if`, which is a real trap.
- `combineLatest` into one view model avoids several pipes in a template.
- `takeUntilDestroyed` replaced the `destroy$` subject pattern.
- New code is usually simpler with `toSignal` or `httpResource`.

<code id="code-content" class="language-typescript">
import { Component, inject, DestroyRef } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, map, switchMap, catchError, of, startWith, shareReplay } from 'rxjs';
@Component({
  selector: 'app-user-list',
  imports: [AsyncPipe],
  template: `
    &lt;!-- ONE subscription: `as` stores the value for the whole block --&gt;
    @if (users$ | async; as users) {
      @for (user of users; track user.id) { &lt;p&gt;{{ user.name }}&lt;/p&gt; }
    } @else {
      &lt;app-spinner /&gt;
    }
    &lt;!-- TWO subscriptions, TWO HTTP requests. Avoid this. --&gt;
    &lt;p&gt;{{ (users$ | async)?.length }}&lt;/p&gt;
    &lt;p&gt;{{ (users$ | async)?.[0]?.name }}&lt;/p&gt;
    &lt;!-- one subscription, everything typed --&gt;
    @if (viewModel$ | async; as vm) {
      &lt;h1&gt;{{ vm.user.name }}&lt;/h1&gt;&lt;p&gt;{{ vm.orders.length }} orders&lt;/p&gt;
    }
  `,
})
export class UserList {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  // The $ suffix is the widespread convention for "this is an observable"
  protected readonly users$ = this.http.get&lt;User[]&gt;('/api/users').pipe(
    shareReplay({ bufferSize: 1, refCount: true }));   // if you truly need several
  // The view model pattern: combine streams so the template has ONE pipe.
  // combineLatest waits for EVERY source to emit at least once.
  protected readonly viewModel$ = combineLatest({
    user: this.http.get&lt;User&gt;('/api/me'),
    orders: this.http.get&lt;Order[]&gt;('/api/orders'),
  });
  // switchMap CANCELS the previous request when the id changes.
  // mergeMap here would let a slow earlier response overwrite a newer one.
  protected readonly user$ = this.route.paramMap.pipe(
    map(p =&gt; p.get('id')!),
    switchMap(id =&gt; this.http.get&lt;User&gt;(`/api/users/${id}`)));
  // Keep errors visible rather than swallowing them into an empty array
  protected readonly state$ = this.users$.pipe(
    map(users =&gt; ({ users, error: null as unknown })),
    catchError(error =&gt; of({ users: [] as User[], error })),
    startWith({ users: [] as User[], error: null as unknown }));
  save(): void {
    // takeUntilDestroyed replaced the whole destroy$ Subject + ngOnDestroy dance
    this.http.post&lt;User&gt;('/api/users', {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: u =&gt; {}, error: () =&gt; {} });
  }
  // toSignal subscribes and unsubscribes just like the async pipe.
  // initialValue matters: a signal must have a value immediately.
  protected readonly users = toSignal(this.users$, { initialValue: [] as User[] });
}
// THE TRAP: @if (count$ | async; as c) does not render when c is 0,
// because 0 is falsy and @if cannot tell it from "no value yet".
// The same applies to '' and false. Signals do not have this problem.
interface User { id: number; name: string; }
interface Order { id: number; }
</code></pre>
