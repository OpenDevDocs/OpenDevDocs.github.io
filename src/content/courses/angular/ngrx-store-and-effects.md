---
publishDate: 2026-06-21T11:35
title: NgRx Store, Effects and Entity
slug: ngrx-store-and-effects
metadescription: Understand the classic NgRx pattern of actions, reducers, selectors and effects that many large Angular applications still use.
updateDate: 2026-09-07T11:35
author: ['bishal-biswas']
level: 3
tags: ['ngrx', 'state management', 'redux']
course: angular
---

## The Redux pattern in Angular

Classic NgRx implements Redux: one immutable state tree, changed only by dispatching actions through pure reducers.

```text
Component  --dispatch(action)-->  Reducer  -->  new State
                                     |
                                  Effect  -->  side effects, then more actions
                                     |
Component  <--select(selector)--  Store
```

It is a lot of structure. That is the point: every change is explicit, traceable and testable.

```bash
ng add @ngrx/store @ngrx/effects @ngrx/store-devtools
```

SignalStore is the newer, much lighter option, and it is the better default for new work. Classic NgRx is here because a great many production applications use it.

## Actions

```typescript
import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const UserActions = createActionGroup({
  source: 'Users',
  events: {
    'Load Users': emptyProps(),
    'Load Users Success': props<{ users: User[] }>(),
    'Load Users Failure': props<{ error: string }>(),
    'Select User': props<{ id: number }>(),
  },
});
```

`createActionGroup` generates `UserActions.loadUsers()`, `UserActions.loadUsersSuccess({ users })` and so on, with correct types.

The `source` becomes part of the action type, so the devtools show `[Users] Load Users`. Name actions after **what happened**, not what should happen. `Load Users Success` describes an event, and several reducers can react to it.

## Reducers

A reducer is a pure function taking state and an action and returning new state.

```typescript
import { createReducer, on } from '@ngrx/store';

export interface UserState {
  users: User[];
  selectedId: number | null;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  users: [],
  selectedId: null,
  loading: false,
  error: null,
};

export const userReducer = createReducer(
  initialState,

  on(UserActions.loadUsers, state => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(UserActions.loadUsersSuccess, (state, { users }) => ({
    ...state,
    users,
    loading: false,
  })),

  on(UserActions.loadUsersFailure, (state, { error }) => ({
    ...state,
    error,
    loading: false,
  })),

  on(UserActions.selectUser, (state, { id }) => ({
    ...state,
    selectedId: id,
  })),
);
```

Reducers must be **pure**: no HTTP, no random values, no dates, no mutation. Always spread into a new object.

## Selectors

Selectors read state and are memoised, so they only recompute when their inputs change.

```typescript
import { createFeatureSelector, createSelector } from '@ngrx/store';

export const selectUserState = createFeatureSelector<UserState>('users');

export const selectAllUsers = createSelector(
  selectUserState,
  state => state.users,
);

export const selectLoading = createSelector(
  selectUserState,
  state => state.loading,
);

export const selectSelectedUser = createSelector(
  selectAllUsers,
  selectUserState,
  (users, state) => users.find(u => u.id === state.selectedId) ?? null,
);

export const selectAdmins = createSelector(
  selectAllUsers,
  users => users.filter(u => u.role === 'admin'),
);
```

Composing selectors is the pattern. Each builds on the last, and each is cached independently.

## Effects

Effects handle everything reducers cannot: HTTP, timers, navigation, storage.

```typescript
import { createEffect, Actions, ofType } from '@ngrx/effects';

@Injectable()
export class UserEffects {
  private readonly actions$ = inject(Actions);
  private readonly http = inject(HttpClient);

  readonly loadUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.loadUsers),
      switchMap(() =>
        this.http.get<User[]>('/api/users').pipe(
          map(users => UserActions.loadUsersSuccess({ users })),
          catchError(error => of(UserActions.loadUsersFailure({ error: error.message }))),
        ),
      ),
    ),
  );
}
```

An effect listens for an action, does the work, and dispatches another action. The pattern is always **load, then success or failure**.

The `catchError` must be on the **inner** observable. On the outer one it terminates the effect permanently, so the feature silently stops working after the first failure. This is the single most common NgRx bug.

Effects that do not dispatch need to say so:

```typescript
readonly redirectAfterSave$ = createEffect(
  () =>
    this.actions$.pipe(
      ofType(UserActions.saveSuccess),
      tap(() => this.router.navigate(['/users'])),
    ),
  { dispatch: false },
);
```

Forgetting `{ dispatch: false }` dispatches whatever the stream emits, which here is the action itself, producing an infinite loop.

## Registering it

```typescript
import { provideStore, provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStore(),
    provideState({ name: 'users', reducer: userReducer }),
    provideEffects(UserEffects),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
  ],
};
```

Feature state can be registered on a lazy route instead:

```typescript
{
  path: 'users',
  providers: [
    provideState({ name: 'users', reducer: userReducer }),
    provideEffects(UserEffects),
  ],
  loadChildren: () => import('./users/users.routes').then(m => m.routes),
}
```

The older `StoreModule.forRoot()` and `forFeature()` still work.

## Using it in a component

```typescript
@Component({
  template: `
    @if (loading()) {
      <app-spinner />
    } @else {
      @for (user of users(); track user.id) {
        <p (click)="select(user.id)">{{ user.name }}</p>
      }
    }
  `,
})
export class UserList {
  private readonly store = inject(Store);

  protected readonly users = this.store.selectSignal(selectAllUsers);
  protected readonly loading = this.store.selectSignal(selectLoading);

  constructor() {
    this.store.dispatch(UserActions.loadUsers());
  }

  protected select(id: number): void {
    this.store.dispatch(UserActions.selectUser({ id }));
  }
}
```

`selectSignal` is the modern way to read state. The older `select()` returns an observable used with the `async` pipe:

```typescript
protected readonly users$ = this.store.select(selectAllUsers);
```

## Entity adapter

`@ngrx/entity` removes the repetition of managing a keyed collection.

```typescript
import { createEntityAdapter, EntityState } from '@ngrx/entity';

export interface UserState extends EntityState<User> {
  selectedId: number | null;
  loading: boolean;
}

export const adapter = createEntityAdapter<User>({
  selectId: user => user.id,
  sortComparer: (a, b) => a.name.localeCompare(b.name),
});

const initialState: UserState = adapter.getInitialState({
  selectedId: null,
  loading: false,
});

export const userReducer = createReducer(
  initialState,
  on(UserActions.loadUsersSuccess, (state, { users }) =>
    adapter.setAll(users, { ...state, loading: false })),
  on(UserActions.addUser, (state, { user }) => adapter.addOne(user, state)),
  on(UserActions.updateUser, (state, { update }) => adapter.updateOne(update, state)),
  on(UserActions.deleteUser, (state, { id }) => adapter.removeOne(id, state)),
);

export const { selectAll, selectEntities, selectTotal } = adapter.getSelectors();
```

## Is it worth it?

**Yes when:** the application is large, several teams work on it, state is shared widely and changed from many places, and an auditable log of every change is genuinely useful. Time travel debugging on a complex bug is a real advantage.

**No when:** the application is small or medium, one team owns it, or most state is really server data. The boilerplate is substantial: four files and a dozen lines to load a list.

For most applications, a service with signals or SignalStore does the job with a fraction of the code.

## Quick recap

- NgRx is Redux: actions dispatched into pure reducers producing new state.
- Name actions after events that happened, not commands.
- Reducers must be pure and must not mutate state.
- Selectors are memoised and compose.
- Effects handle side effects and dispatch follow up actions.
- Put `catchError` on the inner observable, or the effect dies permanently.
- Use `{ dispatch: false }` for effects that do not produce an action.

<code id="code-content" class="language-typescript">
import { Injectable, inject, isDevMode } from '@angular/core';
import { createActionGroup, emptyProps, props, createReducer, on,
         createFeatureSelector, createSelector, Store, provideStore, provideState } from '@ngrx/store';
import { createEffect, Actions, ofType, provideEffects } from '@ngrx/effects';
import { HttpClient } from '@angular/common/http';
import { of, map, switchMap, catchError, tap } from 'rxjs';
// ACTIONS name what HAPPENED, not what should happen.
export const UserActions = createActionGroup({
  source: 'Users',
  events: {
    'Load Users': emptyProps(),
    'Load Users Success': props&lt;{ users: User[] }&gt;(),
    'Load Users Failure': props&lt;{ error: string }&gt;(),
  },
});
// REDUCERS are PURE. No HTTP, no dates, no random values, no mutation.
export interface UserState { users: User[]; loading: boolean; error: string | null; }
const initialState: UserState = { users: [], loading: false, error: null };
export const userReducer = createReducer(
  initialState,
  on(UserActions.loadUsers, s =&gt; ({ ...s, loading: true, error: null })),
  on(UserActions.loadUsersSuccess, (s, { users }) =&gt; ({ ...s, users, loading: false })),
  on(UserActions.loadUsersFailure, (s, { error }) =&gt; ({ ...s, error, loading: false })),
);
// SELECTORS are memoised and compose
export const selectUserState = createFeatureSelector&lt;UserState&gt;('users');
export const selectAllUsers = createSelector(selectUserState, s =&gt; s.users);
export const selectLoading = createSelector(selectUserState, s =&gt; s.loading);
export const selectAdmins = createSelector(selectAllUsers,
  users =&gt; users.filter(u =&gt; u.role === 'admin'));
// EFFECTS do the work reducers cannot, then dispatch a follow up action
@Injectable()
export class UserEffects {
  private readonly actions$ = inject(Actions);
  private readonly http = inject(HttpClient);
  readonly loadUsers$ = createEffect(() =&gt; this.actions$.pipe(
    ofType(UserActions.loadUsers),
    switchMap(() =&gt; this.http.get&lt;User[]&gt;('/api/users').pipe(
      map(users =&gt; UserActions.loadUsersSuccess({ users })),
      // catchError on the INNER observable. On the outer one it kills the
      // effect permanently and the feature silently stops working.
      // This is the single most common NgRx bug.
      catchError(e =&gt; of(UserActions.loadUsersFailure({ error: e.message }))))),
  ));
  // Effects that do not dispatch MUST say so, or you get an infinite loop
  readonly redirect$ = createEffect(() =&gt; this.actions$.pipe(
    ofType(UserActions.loadUsersSuccess),
    tap(() =&gt; this.router.navigate(['/users']))),
    { dispatch: false });
  private readonly router = inject(Router);
}
// Registration, at the root or on a lazy route
export const appConfig = {
  providers: [
    provideStore(),
    provideState({ name: 'users', reducer: userReducer }),
    provideEffects(UserEffects),
  ],
};
// In a component: selectSignal is the modern read
// protected readonly users = inject(Store).selectSignal(selectAllUsers);
// this.store.dispatch(UserActions.loadUsers());
// Worth it for large multi team applications where an auditable change log
// and time travel debugging genuinely pay off. For most applications a
// service with signals or SignalStore does the same job in far less code.
interface User { id: number; name: string; role: string; }
</code></pre>
