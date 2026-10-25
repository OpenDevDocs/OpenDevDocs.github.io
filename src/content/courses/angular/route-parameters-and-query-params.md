---
publishDate: 2026-06-13T09:30
title: Route Parameters and Query Parameters
slug: route-parameters-and-query-params
metadescription: Read path parameters, query parameters and route data, and bind them straight to component inputs instead of subscribing.
updateDate: 2026-09-07T09:30
author: ['bishal-biswas']
level: 2
tags: ['routing', 'parameters', 'inputs']
course: angular
---

## The modern way: component inputs

Turn on one router feature and route parameters become component inputs.

```typescript
provideRouter(routes, withComponentInputBinding())
```

```typescript
export const routes: Routes = [
  { path: 'users/:id', component: UserDetail },
];
```

```typescript
@Component({
  selector: 'app-user-detail',
  template: `<h1>User {{ id() }}</h1>`,
})
export class UserDetail {
  readonly id = input.required<string>();
}
```

That is the whole thing. No `ActivatedRoute`, no subscription, no cleanup.

The input name must match the parameter name. Angular binds path parameters, query parameters, resolved data and static `data`, in that order of precedence.

```typescript
{
  path: 'users/:id',
  component: UserDetail,
  data: { mode: 'view' },
  resolve: { user: userResolver },
}
```

```typescript
export class UserDetail {
  readonly id = input.required<string>();      // from the path
  readonly tab = input<string>();               // from ?tab=
  readonly mode = input<string>();              // from data
  readonly user = input.required<User>();       // from the resolver
}
```

## Reacting to a change

Parameters are signals, so `computed` and `effect` work directly.

```typescript
export class UserDetail {
  readonly id = input.required<string>();

  protected readonly user = httpResource<User>(() => `/api/users/${this.id()}`);
}
```

Navigating from `/users/1` to `/users/2` reuses the component and updates the input, so the resource refetches. That reuse used to be a notorious trap, because `ngOnInit` did not run again.

## The traditional way

`ActivatedRoute` is still there and still used widely.

```typescript
export class UserDetail {
  private readonly route = inject(ActivatedRoute);

  protected readonly id = toSignal(
    this.route.paramMap.pipe(map(params => params.get('id')!))
  );
}
```

Or with a subscription:

```typescript
export class UserDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected id = '';

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.id = params.get('id')!;
        this.load();
      });
  }
}
```

The observable emits again when the parameter changes without the component being recreated, which is exactly the case a snapshot misses.

## Snapshot versus observable

```typescript
// snapshot: read once, never updates
const id = this.route.snapshot.paramMap.get('id');

// observable: updates when the parameter changes
this.route.paramMap.subscribe(params => params.get('id'));
```

The snapshot is fine when the component cannot be reused for a different parameter. It is wrong when navigating from `/users/1` to `/users/2` keeps the same component instance, which is the default behaviour.

Symptom: the URL changes, the page does not. Almost always a snapshot read that should have been reactive.

Component inputs avoid the question entirely.

## Query parameters

```typescript
// /search?q=shoes&page=2&sort=price
export class Search {
  readonly q = input<string>();
  readonly page = input('1');
  readonly sort = input<string>();
}
```

Everything arrives as a **string**. Convert with a transform:

```typescript
readonly page = input(1, { transform: numberAttribute });
readonly includeArchived = input(false, { transform: booleanAttribute });
```

Updating them means navigating:

```typescript
export class Search {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected setPage(page: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
  }
}
```

An empty array means "stay on this route, only change the parameters". `merge` keeps the other filters.

To remove a parameter, set it to `null`:

```typescript
queryParams: { page: null }
```

## Query parameters as state

Filters, sorting, paging and open tabs all belong in the URL. It makes the page shareable, bookmarkable and correct with the back button.

```typescript
@Component({
  template: `
    <input [value]="q() ?? ''" (input)="search($event)">
    @for (result of results.value() ?? []; track result.id) { ... }
  `,
})
export class Search {
  readonly q = input<string>();
  readonly page = input(1, { transform: numberAttribute });

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly results = httpResource<Result[]>(() =>
    this.q() ? `/api/search?q=${this.q()}&page=${this.page()}` : undefined
  );

  protected search(event: Event): void {
    const q = (event.target as HTMLInputElement).value;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: q || null, page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
```

`replaceUrl: true` while typing avoids filling the history with one entry per keystroke.

## Optional parameters in the path

Angular supports matrix parameters, which sit in the path rather than the query string.

```typescript
this.router.navigate(['/users', { sort: 'name', page: 2 }]);
// /users;sort=name;page=2
```

```typescript
const sort = this.route.snapshot.paramMap.get('sort');
```

They scope to a route segment rather than the whole URL, which is occasionally useful. Query parameters are more conventional and better understood by everything else.

## Parent route parameters

A child route can read a parent's parameters.

```typescript
{
  path: 'users/:userId',
  component: UserLayout,
  children: [
    { path: 'orders/:orderId', component: OrderDetail },
  ],
}
```

```typescript
export class OrderDetail {
  private readonly route = inject(ActivatedRoute);

  protected readonly userId = toSignal(
    this.route.parent!.paramMap.pipe(map(p => p.get('userId')))
  );
}
```

With `withComponentInputBinding()`, add `paramsInheritanceStrategy: 'always'` so children inherit parent parameters as inputs:

```typescript
provideRouter(routes,
  withComponentInputBinding(),
  withRouterConfig({ paramsInheritanceStrategy: 'always' }),
)
```

```typescript
export class OrderDetail {
  readonly userId = input.required<string>();    // inherited from the parent
  readonly orderId = input.required<string>();
}
```

## Route data

Static configuration attached to a route.

```typescript
{
  path: 'admin',
  component: Admin,
  data: { roles: ['admin'], layout: 'wide' },
}
```

```typescript
export const roleGuard: CanActivateFn = route => {
  const roles = route.data['roles'] as string[];
  return inject(AuthService).hasAnyRole(roles);
};
```

`data` is untyped, so a cast is needed. Keep the keys few and documented.

## Common mistakes

**Reading a snapshot for a parameter that can change.** The URL updates, the page does not.

**Forgetting that query parameters are strings.** `page === 1` is false when `page` is `'1'`.

**Replacing query parameters instead of merging.** Changing the page loses the search term.

**Not encoding values.** Use the array form of `navigate`, which encodes for you.

## Quick recap

- `withComponentInputBinding()` binds path parameters, query parameters, data and resolved values to inputs.
- The input name must match the parameter name.
- Parameters are signals, so `computed` and `httpResource` react to them automatically.
- A snapshot read misses changes when the component is reused for a different parameter.
- Query parameters are always strings, so transform them.
- Navigate with an empty array and `queryParamsHandling: 'merge'` to change one filter.
- Use `replaceUrl: true` while typing so history is not flooded.

<code id="code-content" class="language-typescript">
import { Component, inject, input, numberAttribute, booleanAttribute } from '@angular/core';
import { Router, ActivatedRoute, provideRouter, withComponentInputBinding,
         withRouterConfig } from '@angular/router';
import { httpResource } from '@angular/common/http';
// Turn this on and route params become plain component inputs.
// paramsInheritanceStrategy lets children inherit the parent's params.
provideRouter([],
  withComponentInputBinding(),
  withRouterConfig({ paramsInheritanceStrategy: 'always' }));
// { path: 'users/:id', component: UserDetail, data: { mode: 'view' } }
@Component({ selector: 'app-user-detail', template: `&lt;h1&gt;User {{ id() }}&lt;/h1&gt;` })
export class UserDetail {
  readonly id = input.required&lt;string&gt;();        // from the :id path segment
  readonly tab = input&lt;string&gt;();                 // from ?tab=
  readonly mode = input&lt;string&gt;();                // from route data
  // Params are SIGNALS, so this refetches when /users/1 becomes /users/2.
  // The old ngOnInit approach missed that, because the component is REUSED.
  protected readonly user = httpResource&lt;User&gt;(() =&gt; `/api/users/${this.id()}`);
}
// Query params are ALWAYS strings, so transform them
@Component({ selector: 'app-search', template: `` })
export class Search {
  readonly q = input&lt;string&gt;();
  readonly page = input(1, { transform: numberAttribute });
  readonly archived = input(false, { transform: booleanAttribute });
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected setPage(page: number): void {
    this.router.navigate([], {          // empty array = stay on this route
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',      // keep the other filters
    });
  }
  protected search(term: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: term || null, page: null },   // null REMOVES a param
      queryParamsHandling: 'merge',
      replaceUrl: true,                  // do not flood history while typing
    });
  }
}
// The traditional way, still everywhere:
//   private readonly route = inject(ActivatedRoute);
//   this.route.paramMap.subscribe(p =&gt; this.id = p.get('id')!);
// snapshot reads ONCE and never updates:
//   const id = this.route.snapshot.paramMap.get('id');
// Symptom of getting that wrong: the URL changes, the page does not.
interface User { name: string; }
</code></pre>
