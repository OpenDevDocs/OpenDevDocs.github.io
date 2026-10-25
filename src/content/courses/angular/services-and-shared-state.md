---
publishDate: 2026-06-11T08:45
title: Services and Shared State
slug: services-and-shared-state
metadescription: Build services that hold state with signals, expose it read only, and choose the right scope for shared data.
updateDate: 2026-09-07T08:45
author: ['bishal-biswas']
level: 2
tags: ['services', 'state', 'signals']
course: angular
---

## A service is just a class

```typescript
import { Injectable, inject, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly itemsState = signal<CartItem[]>([]);

  readonly items = this.itemsState.asReadonly();
  readonly count = computed(() => this.items().length);
  readonly total = computed(() =>
    this.items().reduce((sum, i) => sum + i.price * i.quantity, 0)
  );

  add(product: Product): void {
    this.itemsState.update(items => {
      const existing = items.find(i => i.productId === product.id);

      return existing
        ? items.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i)
        : [...items, { productId: product.id, price: product.price, quantity: 1 }];
    });
  }

  remove(productId: number): void {
    this.itemsState.update(items => items.filter(i => i.productId !== productId));
  }

  clear(): void {
    this.itemsState.set([]);
  }
}
```

That is the standard shape for state in modern Angular, and it is worth learning as a template.

## The read only pattern

Three lines do the work:

```typescript
private readonly itemsState = signal<CartItem[]>([]);   // private, writable
readonly items = this.itemsState.asReadonly();          // public, read only
readonly total = computed(() => ...);                    // derived
```

Components can read `items` and `total` but cannot set them. The only way to change the cart is through `add`, `remove` and `clear`.

That constraint is what keeps state manageable. When something goes wrong, there are three places to look rather than every component in the application.

## Using it

```typescript
@Component({
  selector: 'app-cart-badge',
  template: `
    <span class="badge">{{ cart.count() }}</span>
    <span>{{ cart.total() | currency:'GBP' }}</span>
  `,
})
export class CartBadge {
  protected readonly cart = inject(CartService);
}
```

No inputs, no outputs, no passing data down through five components. Any component that needs the cart injects it.

## Scope

Where a service is provided decides how many instances exist.

```typescript
// one for the whole application
@Injectable({ providedIn: 'root' })
export class CartService {}

// one per component instance
@Component({ providers: [WizardState] })
export class Wizard {}

// one per route subtree
{ path: 'admin', providers: [AdminState], loadChildren: ... }
```

**Application wide** for genuinely global state: the signed in user, the cart, the theme.

**Per component** for state belonging to one instance: a wizard's current step, a data table's sort and filter.

**Per route** for state shared within a feature but not beyond it.

The per component scope is underused. It gives you a place for complex component state without polluting global state, and it is destroyed automatically with the component.

```typescript
@Injectable()
export class TableState {
  readonly sortColumn = signal<string | null>(null);
  readonly sortAscending = signal(true);
  readonly page = signal(1);

  toggleSort(column: string): void {
    if (this.sortColumn() === column) {
      this.sortAscending.update(v => !v);
    } else {
      this.sortColumn.set(column);
      this.sortAscending.set(true);
    }
  }
}
```

```typescript
@Component({
  selector: 'app-data-table',
  providers: [TableState],       // each table has its own
  template: `...`,
})
export class DataTable {
  protected readonly state = inject(TableState);
}
```

Two tables on a page sort independently, with no extra work.

## Loading data

```typescript
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  private readonly selectedId = signal<string | null>(null);

  readonly user = httpResource<User>(() => {
    const id = this.selectedId();
    return id ? `/api/users/${id}` : undefined;    // undefined skips the request
  });

  select(id: string): void {
    this.selectedId.set(id);
  }
}
```

```typescript
@Component({
  template: `
    @if (users.user.isLoading()) {
      <app-spinner />
    } @else if (users.user.error()) {
      <p>Could not load</p>
    } @else if (users.user.value(); as user) {
      <h1>{{ user.name }}</h1>
    }
  `,
})
export class UserDetail {
  protected readonly users = inject(UserService);
}
```

Loading and error states come with the resource, so the service does not need to track them by hand.

## Communication between components

A shared service replaces long chains of inputs and outputs.

```typescript
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messagesState = signal<Notification[]>([]);

  readonly messages = this.messagesState.asReadonly();

  show(text: string, type: 'info' | 'error' = 'info'): void {
    const id = crypto.randomUUID();

    this.messagesState.update(list => [...list, { id, text, type }]);

    setTimeout(() => this.dismiss(id), 5000);
  }

  dismiss(id: string): void {
    this.messagesState.update(list => list.filter(m => m.id !== id));
  }
}
```

Any component calls `show`. One component displays `messages`. Neither knows the other exists.

## Persisting state

```typescript
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly themeState = signal<'light' | 'dark'>(this.loadTheme());

  readonly theme = this.themeState.asReadonly();

  constructor() {
    effect(() => localStorage.setItem('theme', this.themeState()));
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.themeState.set(theme);
  }

  private loadTheme(): 'light' | 'dark' {
    return (localStorage.getItem('theme') as 'light' | 'dark' | null) ?? 'light';
  }
}
```

The effect writes to storage whenever the signal changes. This is exactly what effects are for.

Under server-side rendering `localStorage` does not exist. Guard the read, or move it into `afterNextRender`.

## Keeping services focused

A service that does everything becomes as hard to reason about as global variables. Split by responsibility.

```text
CartService          the cart's contents and operations
CheckoutService      turning a cart into an order
PaymentService       talking to the payment provider
NotificationService  user facing messages
```

A rough test: if you cannot describe what a service does in one sentence without "and", it is doing too much.

## When you need more

For most applications, services with signals are enough. Reach for a state library when you need:

- Time travel debugging across a large application.
- A strict, auditable trail of every state change.
- Complex asynchronous coordination between many features.
- A large team that benefits from an enforced structure.

NgRx SignalStore is the natural step up, and it has its own topic. Do not start there.

## Quick recap

- Keep a private writable signal and expose `asReadonly()` plus computed values.
- Change state only through methods, so there are few places to look when it breaks.
- `providedIn: 'root'` for global state, component `providers` for per instance state.
- Per component services are underused and destroyed automatically.
- `httpResource` gives loading and error state without tracking it yourself.
- A shared service beats passing events up through several layers.
- Split services by responsibility, and reach for a state library only when you need it.

<code id="code-content" class="language-typescript">
import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { httpResource } from '@angular/common/http';
// The standard shape for state in modern Angular:
//   private writable signal  +  public asReadonly()  +  computed derivations
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly itemsState = signal&lt;CartItem[]&gt;([]);
  readonly items = this.itemsState.asReadonly();      // callers cannot set it
  readonly count = computed(() =&gt; this.items().length);
  readonly total = computed(() =&gt;
    this.items().reduce((sum, i) =&gt; sum + i.price * i.quantity, 0));
  // The ONLY ways to change the cart. Three places to look when it breaks.
  add(item: CartItem): void {
    this.itemsState.update(items =&gt; {
      const existing = items.find(i =&gt; i.productId === item.productId);
      return existing
        ? items.map(i =&gt; i === existing ? { ...i, quantity: i.quantity + 1 } : i)
        : [...items, item];                            // replace, never mutate
    });
  }
  remove(id: number): void {
    this.itemsState.update(items =&gt; items.filter(i =&gt; i.productId !== id));
  }
}
// Per COMPONENT state. Two tables sort independently, with no extra work,
// and the state is destroyed with the component.
@Injectable()
export class TableState {
  readonly sortColumn = signal&lt;string | null&gt;(null);
  readonly ascending = signal(true);
  toggleSort(column: string): void {
    if (this.sortColumn() === column) this.ascending.update(v =&gt; !v);
    else { this.sortColumn.set(column); this.ascending.set(true); }
  }
}
// @Component({ providers: [TableState] })  -&gt; one per &lt;app-data-table&gt;
// Loading data: the resource supplies loading and error state for free
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly selectedId = signal&lt;string | null&gt;(null);
  readonly user = httpResource&lt;User&gt;(() =&gt; {
    const id = this.selectedId();
    return id ? `/api/users/${id}` : undefined;        // undefined skips the request
  });
  select(id: string) { this.selectedId.set(id); }
}
// Persisting: an effect is exactly the right tool for writing outside Angular
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly themeState = signal&lt;'light' | 'dark'&gt;('light');
  readonly theme = this.themeState.asReadonly();
  constructor() {
    effect(() =&gt; localStorage.setItem('theme', this.themeState()));
  }
  setTheme(t: 'light' | 'dark') { this.themeState.set(t); }
}
// Scope: 'root' for global, component providers for per instance,
// route providers for a feature subtree. The nearest provider wins.
interface CartItem { productId: number; price: number; quantity: number; }
interface User { name: string; }
</code></pre>
