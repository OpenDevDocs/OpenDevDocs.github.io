---
publishDate: 2026-06-05T07:20
title: 'Signals: signal, computed and effect'
slug: signals-fundamentals
metadescription: Learn the three signal functions that hold and derive state in modern Angular, and why they replaced most manual change detection.
updateDate: 2026-09-07T07:20
author: ['bishal-biswas']
level: 1
tags: ['signals', 'reactivity', 'state']
course: angular
---

## A value that announces changes

A signal holds a value and tells anything reading it when that value changes.

```typescript
import { signal } from '@angular/core';

const count = signal(0);

console.log(count());      // 0, read with brackets

count.set(5);
console.log(count());      // 5

count.update(n => n + 1);
console.log(count());      // 6
```

Three operations. `signal(initial)` creates one, `count()` reads it, `set` and `update` change it.

The brackets are not decoration. Reading a signal **registers a dependency**, which is how Angular knows exactly what to update when the value changes.

## In a component

```typescript
@Component({
  selector: 'app-counter',
  template: `
    <p>Count: {{ count() }}</p>
    <button (click)="increment()">Add one</button>
  `,
})
export class Counter {
  protected readonly count = signal(0);

  protected increment(): void {
    this.count.update(n => n + 1);
  }
}
```

When `count` changes, Angular updates that one paragraph. It does not check the rest of the component, and it does not check other components.

That is the whole point. Before signals, a change anywhere meant checking everything.

## set or update

```typescript
count.set(10);              // a new value that does not depend on the old one
count.update(n => n + 1);   // a new value derived from the old one
```

Use `update` whenever the new value depends on the current one. Reading and then setting works but is more code and can go stale:

```typescript
count.set(count() + 1);     // works, but update is clearer
```

## Objects and arrays

Signals compare by reference. Mutating an object does not notify anyone, because the reference did not change.

```typescript
const user = signal({ name: 'Asha', age: 30 });

user().age = 31;            // nothing updates, same object
user.update(u => ({ ...u, age: 31 }));   // correct, a new object
```

```typescript
const items = signal<string[]>([]);

items().push('new');                      // nothing updates
items.update(list => [...list, 'new']);   // correct
```

This is the single most common signal mistake. **Always replace, never mutate.**

## computed derives values

```typescript
import { signal, computed } from '@angular/core';

const price = signal(100);
const quantity = signal(3);

const total = computed(() => price() * quantity());

console.log(total());    // 300

quantity.set(5);
console.log(total());    // 500, recalculated automatically
```

A computed signal is read only. There is no `set`. Its value comes entirely from the signals it reads.

Two properties make it efficient:

**It is lazy.** The function does not run until something reads the computed.

**It is cached.** Reading it repeatedly does not recalculate, unless one of its dependencies changed.

```typescript
const expensive = computed(() => {
  console.log('calculating');
  return items().filter(i => i.active).length;
});

expensive();    // logs 'calculating'
expensive();    // does not log, cached
expensive();    // still cached

items.set([...]);
expensive();    // logs 'calculating', a dependency changed
```

## Dependencies are tracked automatically

You never declare what a computed depends on. Angular records which signals were read while the function ran.

```typescript
const showAll = signal(false);
const items = signal<Item[]>([]);
const search = signal('');

const visible = computed(() => {
  if (showAll()) return items();          // only reads showAll and items
  return items().filter(i => i.name.includes(search()));
});
```

When `showAll` is true, the computed never reads `search`, so changing `search` does not recalculate it. Dependencies are tracked per run, not declared up front.

## effect runs side effects

```typescript
import { effect } from '@angular/core';

export class Settings {
  readonly theme = signal<'light' | 'dark'>('light');

  constructor() {
    effect(() => {
      document.body.className = this.theme();
      localStorage.setItem('theme', this.theme());
    });
  }
}
```

An effect runs once immediately, then again whenever a signal it read changes.

Effects are for reaching **outside** Angular: the DOM directly, `localStorage`, logging, a third party library, an analytics call.

## Do not use effects to derive state

This is the mistake everyone makes first.

```typescript
// wrong
readonly firstName = signal('Asha');
readonly lastName = signal('Biswas');
readonly fullName = signal('');

constructor() {
  effect(() => {
    this.fullName.set(`${this.firstName()} ${this.lastName()}`);
  });
}
```

```typescript
// right
readonly fullName = computed(() => `${this.firstName()} ${this.lastName()}`);
```

The computed version is shorter, cannot get out of sync, is lazy, and does not risk an update loop. **If you are setting a signal inside an effect, you almost certainly want a computed.**

## Where effects can be created

An effect needs an injection context, which means the constructor or a field initialiser.

```typescript
export class Widget {
  readonly value = signal(0);

  // field initialiser
  private readonly logger = effect(() => console.log(this.value()));

  constructor() {
    // or the constructor
    effect(() => console.log('also fine', this.value()));
  }

  someMethod(): void {
    effect(() => { ... });    // error, no injection context
  }
}
```

Outside those places, pass an injector:

```typescript
private readonly injector = inject(Injector);

someMethod(): void {
  effect(() => { ... }, { injector: this.injector });
}
```

Effects created in a component are destroyed with it, so there is no cleanup to remember.

## Equality

By default signals use `Object.is` to decide whether the value changed.

```typescript
const count = signal(5);
count.set(5);      // no notification, same value
```

For objects, supply a custom comparison when reference changes are too noisy:

```typescript
const user = signal(
  { id: 1, name: 'Asha' },
  { equal: (a, b) => a.id === b.id }
);

user.set({ id: 1, name: 'Asha B' });   // no notification, same id
```

Use this carefully. It is easy to suppress an update you actually wanted.

## Read only signals

Expose state without letting callers change it.

```typescript
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly itemsState = signal<Item[]>([]);

  readonly items = this.itemsState.asReadonly();
  readonly total = computed(() => this.items().reduce((s, i) => s + i.price, 0));

  add(item: Item): void {
    this.itemsState.update(list => [...list, item]);
  }
}
```

Components read `items` and `total`, and can only change them by calling `add`. That is the standard store shape in modern Angular.

## Signals or RxJS?

```text
Signals             synchronous state that the UI reads
RxJS                events over time, cancellation, complex async
```

Use signals for anything a template displays. Use RxJS for websockets, debounced typing, retries and racing requests. `toSignal` and `toObservable` convert between them, and are covered in the interop topic.

Signals are not a replacement for RxJS. They replaced the awkward use of RxJS for plain state.

## Quick recap

- `signal()` holds a value, read it with brackets to register a dependency.
- `set` for a fresh value, `update` when it derives from the current one.
- Replace objects and arrays, never mutate them, since comparison is by reference.
- `computed()` derives a value, and is lazy, cached and read only.
- Dependencies are tracked automatically, per run.
- `effect()` is for side effects outside Angular, not for deriving state.
- Expose `asReadonly()` from a store so only the store can change it.

<code id="code-content" class="language-typescript">
import { Component, Injectable, signal, computed, effect } from '@angular/core';
// signal holds a value. Reading with () registers a dependency.
const count = signal(0);
count.set(5);                    // a fresh value
count.update(n =&gt; n + 1);        // derived from the current value
console.log(count());            // 6
// Signals compare by REFERENCE. Mutating notifies nobody.
const items = signal&lt;string[]&gt;([]);
items().push('nope');                       // nothing updates
items.update(list =&gt; [...list, 'yes']);     // correct: replace, never mutate
// computed derives. It is lazy, cached and read only.
const price = signal(100);
const quantity = signal(3);
const total = computed(() =&gt; price() * quantity());
console.log(total());            // 300
quantity.set(5);
console.log(total());            // 500, recalculated on read
// Dependencies are tracked PER RUN, never declared.
const showAll = signal(false);
const search = signal('');
const visible = computed(() =&gt;
  showAll() ? items() : items().filter(i =&gt; i.includes(search())));
// When showAll is true this never reads search, so search changes cost nothing.
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly state = signal&lt;{ price: number }[]&gt;([]);
  readonly items = this.state.asReadonly();          // callers cannot set it
  readonly total = computed(() =&gt; this.items().reduce((s, i) =&gt; s + i.price, 0));
  add(item: { price: number }) { this.state.update(l =&gt; [...l, item]); }
}
@Component({ selector: 'app-c', template: `{{ count() }}` })
export class Counter {
  protected readonly count = signal(0);
  constructor() {
    // effect is for reaching OUTSIDE Angular: DOM, storage, logging, analytics
    effect(() =&gt; localStorage.setItem('count', String(this.count())));
  }
}
// NEVER use an effect to derive state:
//   effect(() =&gt; this.fullName.set(first() + ' ' + last()));   wrong
//   readonly fullName = computed(() =&gt; first() + ' ' + last()); right
</code></pre>
