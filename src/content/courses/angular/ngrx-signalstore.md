---
publishDate: 2026-06-21T11:30
title: NgRx SignalStore
slug: ngrx-signalstore
metadescription: Manage feature state with NgRx SignalStore, composing state, computed values and methods without reducers or actions.
updateDate: 2026-09-07T11:30
author: ['bishal-biswas']
level: 3
tags: ['ngrx', 'state management', 'signals']
course: angular
---

## When a service is not enough

A service with signals covers most state. SignalStore adds structure when a feature has a lot of it: entities, loading flags, filters, pagination and coordinated updates.

It is signal based, so there are no actions, reducers or selectors.

```bash
npm install @ngrx/signals
```

## A minimal store

```typescript
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { computed, inject } from '@angular/core';

export const CounterStore = signalStore(
  { providedIn: 'root' },

  withState({ count: 0, step: 1 }),

  withComputed(({ count, step }) => ({
    doubled: computed(() => count() * 2),
    nextValue: computed(() => count() + step()),
  })),

  withMethods(store => ({
    increment(): void {
      patchState(store, { count: store.count() + store.step() });
    },
    reset(): void {
      patchState(store, { count: 0 });
    },
  })),
);
```

```typescript
@Component({
  template: `
    <p>{{ store.count() }} (doubled: {{ store.doubled() }})</p>
    <button (click)="store.increment()">Add</button>
  `,
})
export class Counter {
  protected readonly store = inject(CounterStore);
}
```

Every state property becomes a signal automatically. `count` is a `Signal<number>`, and nested objects become nested signals.

## patchState

The only way to change state.

```typescript
patchState(store, { count: 5 });                      // a partial object
patchState(store, state => ({ count: state.count + 1 }));   // from the current state
patchState(store, { count: 5 }, { loading: false });   // several updates at once
```

Immutable by design. The store's signals are read only from outside, so nothing can bypass the methods.

## Loading data

```typescript
export const UserStore = signalStore(
  { providedIn: 'root' },

  withState({
    users: [] as User[],
    loading: false,
    error: null as string | null,
  }),

  withMethods((store, http = inject(HttpClient)) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });

      try {
        const users = await firstValueFrom(http.get<User[]>('/api/users'));
        patchState(store, { users, loading: false });
      } catch {
        patchState(store, { error: 'Could not load users', loading: false });
      }
    },
  })),
);
```

Injecting in the second parameter of `withMethods` is the convention. It runs in an injection context, so `inject()` works.

## rxMethod for streams

For anything needing RxJS operators, `rxMethod` accepts a value, a signal or an observable.

```typescript
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';

withMethods((store, http = inject(HttpClient)) => ({
  search: rxMethod<string>(
    pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => patchState(store, { loading: true })),
      switchMap(term =>
        http.get<User[]>(`/api/users?q=${term}`).pipe(
          tapResponse({
            next: users => patchState(store, { users, loading: false }),
            error: () => patchState(store, { error: 'Search failed', loading: false }),
          }),
        ),
      ),
    ),
  ),
}))
```

```typescript
this.store.search(this.term);      // pass a signal, and it tracks changes
this.store.search('angular');      // or a plain value
```

`tapResponse` matters. A plain `subscribe` with an error would terminate the outer stream permanently, so the search would stop working after one failure. `tapResponse` contains the error.

## Hooks

```typescript
import { withHooks } from '@ngrx/signals';

withHooks({
  onInit(store) {
    store.load();
  },
  onDestroy(store) {
    console.log('store destroyed');
  },
})
```

`onInit` replaces calling `load()` from a component's `ngOnInit`, so the store owns its own lifecycle.

## Entities

`withEntities` handles the common shape of a keyed collection.

```typescript
import { withEntities, setAllEntities, addEntity, removeEntity, updateEntity }
  from '@ngrx/signals/entities';

export const UserStore = signalStore(
  { providedIn: 'root' },

  withEntities<User>(),
  withState({ loading: false }),

  withComputed(({ entities }) => ({
    total: computed(() => entities().length),
    admins: computed(() => entities().filter(u => u.role === 'admin')),
  })),

  withMethods((store, http = inject(HttpClient)) => ({
    async load(): Promise<void> {
      const users = await firstValueFrom(http.get<User[]>('/api/users'));
      patchState(store, setAllEntities(users));
    },

    add(user: User): void {
      patchState(store, addEntity(user));
    },

    rename(id: number, name: string): void {
      patchState(store, updateEntity({ id, changes: { name } }));
    },

    remove(id: number): void {
      patchState(store, removeEntity(id));
    },
  })),
);
```

`withEntities` gives you `entities()` as an array and `entityMap()` for lookup by id, both maintained for you. Writing that by hand is tedious and easy to get subtly wrong.

## Composing features

The real strength. A feature is a reusable piece of store.

```typescript
import { signalStoreFeature, withState, withMethods, patchState, type } from '@ngrx/signals';

export function withRequestStatus() {
  return signalStoreFeature(
    withState({ loading: false, error: null as string | null }),

    withMethods(store => ({
      setLoading(): void {
        patchState(store, { loading: true, error: null });
      },
      setError(error: string): void {
        patchState(store, { loading: false, error });
      },
      setLoaded(): void {
        patchState(store, { loading: false });
      },
    })),
  );
}
```

```typescript
export const UserStore = signalStore(
  { providedIn: 'root' },
  withEntities<User>(),
  withRequestStatus(),
  withMethods(...),
);

export const OrderStore = signalStore(
  { providedIn: 'root' },
  withEntities<Order>(),
  withRequestStatus(),
  withMethods(...),
);
```

One definition of loading and error handling, shared by every store. This composition is what SignalStore does better than a hand written service.

## Scoping to a component

```typescript
export const WizardStore = signalStore(
  withState({ step: 1, data: {} }),
  withMethods(...),
);
```

```typescript
@Component({
  selector: 'app-wizard',
  providers: [WizardStore],       // one per component instance
  template: `...`,
})
export class Wizard {
  protected readonly store = inject(WizardStore);
}
```

Omit `providedIn: 'root'` and provide it on the component instead. The store is created and destroyed with the component, which suits wizards, dialogs and editors.

## Compared with a plain service

```typescript
// a plain service
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly usersState = signal<User[]>([]);
  private readonly loadingState = signal(false);

  readonly users = this.usersState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly total = computed(() => this.users().length);

  async load(): Promise<void> { ... }
}
```

The service is fine, and for a handful of properties it is simpler. SignalStore earns its place when you have several stores that would otherwise repeat the same loading, error and entity handling.

**Start with a service.** Move to SignalStore when the repetition becomes obvious.

## Compared with classic NgRx

```text
Classic NgRx Store              SignalStore
actions, reducers, effects      state, computed, methods
selectors                       computed signals
dispatch(action)                store.method()
Store<AppState>                 inject(UserStore)
one global state tree           one store per feature
lots of boilerplate             much less
time travel debugging           limited devtools support
```

SignalStore is far less code. Classic NgRx still wins where a strict action log and full time travel debugging genuinely matter, which is a smaller set of applications than its popularity suggests.

## Quick recap

- SignalStore adds structure to feature state without actions or reducers.
- Every state property becomes a signal automatically.
- `patchState` is the only way to change state, and it is immutable.
- Inject dependencies in the second parameter of `withMethods`.
- Use `rxMethod` with `tapResponse` so an error does not kill the stream.
- `withEntities` maintains a keyed collection for you.
- `signalStoreFeature` composes reusable pieces, which is its main advantage.

<code id="code-content" class="language-typescript">
import { computed, inject } from '@angular/core';
import { signalStore, signalStoreFeature, withState, withComputed, withMethods,
         withHooks, patchState } from '@ngrx/signals';
import { withEntities, setAllEntities, addEntity, updateEntity, removeEntity }
  from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { HttpClient } from '@angular/common/http';
import { pipe, debounceTime, distinctUntilChanged, switchMap, tap, firstValueFrom } from 'rxjs';
// A reusable FEATURE. This composition is SignalStore's real advantage.
export function withRequestStatus() {
  return signalStoreFeature(
    withState({ loading: false, error: null as string | null }),
    withMethods(store =&gt; ({
      setLoading: () =&gt; patchState(store, { loading: true, error: null }),
      setError: (error: string) =&gt; patchState(store, { loading: false, error }),
      setLoaded: () =&gt; patchState(store, { loading: false }),
    })),
  );
}
export const UserStore = signalStore(
  { providedIn: 'root' },              // omit this and provide it on a component
  withEntities&lt;User&gt;(),                // gives entities() and entityMap()
  withRequestStatus(),                 // shared loading/error handling
  withComputed(({ entities }) =&gt; ({
    total: computed(() =&gt; entities().length),
    admins: computed(() =&gt; entities().filter(u =&gt; u.role === 'admin')),
  })),
  // Dependencies go in the SECOND parameter, which is an injection context
  withMethods((store, http = inject(HttpClient)) =&gt; ({
    async load(): Promise&lt;void&gt; {
      store.setLoading();
      const users = await firstValueFrom(http.get&lt;User[]&gt;('/api/users'));
      patchState(store, setAllEntities(users));    // the ONLY way to change state
      store.setLoaded();
    },
    rename(id: number, name: string) {
      patchState(store, updateEntity({ id, changes: { name } }));
    },
    remove(id: number) { patchState(store, removeEntity(id)); },
    // rxMethod accepts a value, a SIGNAL or an observable
    search: rxMethod&lt;string&gt;(pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap(() =&gt; store.setLoading()),
      switchMap(term =&gt; http.get&lt;User[]&gt;(`/api/users?q=${term}`).pipe(
        // tapResponse CONTAINS the error. A plain subscribe would kill the
        // outer stream, so search would stop working after one failure.
        tapResponse({
          next: users =&gt; { patchState(store, setAllEntities(users)); store.setLoaded(); },
          error: () =&gt; store.setError('Search failed'),
        }))),
    )),
  })),
  // The store owns its own lifecycle
  withHooks({ onInit: store =&gt; store.load() }),
);
// Using it: every state property is already a signal
// @Component({ template: `{{ store.total() }}` })
// export class UserList { protected readonly store = inject(UserStore); }
// Scoped to a component instead of root:
// @Component({ providers: [WizardStore] })   -&gt; created and destroyed with it
// START WITH A PLAIN SERVICE. Move here when several stores would otherwise
// repeat the same loading, error and entity handling.
interface User { id: number; name: string; role: string; }
</code></pre>
