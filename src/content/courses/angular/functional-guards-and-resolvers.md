---
publishDate: 2026-06-14T09:45
title: Functional Guards and Resolvers
slug: functional-guards-and-resolvers
metadescription: Protect routes and preload data with plain functions, using inject to reach services without a class.
updateDate: 2026-09-07T09:45
author: ['bishal-biswas']
level: 2
tags: ['routing', 'guards', 'resolvers']
course: angular
---

## Guards are functions now

A guard decides whether a navigation is allowed. Since `inject()` works in functions, guards need no class.

```typescript
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
```

```typescript
{ path: 'dashboard', component: Dashboard, canActivate: [authGuard] }
```

Returning a `UrlTree` redirects. Returning `false` blocks the navigation and leaves the user where they were, which usually looks broken. **Prefer a redirect to a plain `false`.**

## The return types

A guard may return:

```text
true          allow
false         block, staying where you are
UrlTree       redirect somewhere else
Promise<...>  any of the above, asynchronously
Observable<...>  the same
```

```typescript
export const asyncGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const allowed = await auth.checkPermission();

  return allowed || inject(Router).createUrlTree(['/denied']);
};
```

## The guard types

**`canActivate`** runs before entering a route.

```typescript
{ path: 'admin', component: Admin, canActivate: [authGuard, adminGuard] }
```

Several guards run in order, and all must pass.

**`canActivateChild`** runs before entering any child route.

```typescript
{
  path: 'admin',
  component: AdminLayout,
  canActivateChild: [adminGuard],
  children: [
    { path: 'users', component: AdminUsers },
    { path: 'settings', component: AdminSettings },
  ],
}
```

One guard protects every child rather than repeating it.

**`canMatch`** decides whether the route matches at all. It runs **before** a lazy chunk is downloaded.

```typescript
{
  path: 'admin',
  canMatch: [adminGuard],
  loadChildren: () => import('./admin/admin.routes').then(m => m.routes),
}
```

Use `canMatch` for anything behind lazy loading, so unauthorised users never fetch the code.

It also allows two routes on one path:

```typescript
{ path: 'home', canMatch: [isAdmin], component: AdminHome },
{ path: 'home', component: UserHome },
```

**`canDeactivate`** runs when leaving, and is how you prevent losing unsaved changes.

```typescript
export interface CanLeave {
  canLeave(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<CanLeave> = component => {
  return component.canLeave() || confirm('You have unsaved changes. Leave anyway?');
};
```

```typescript
{ path: 'edit', component: EditForm, canDeactivate: [unsavedChangesGuard] }
```

```typescript
export class EditForm implements CanLeave {
  protected readonly form = signal({ name: '' });
  private readonly saved = signal(true);

  canLeave(): boolean {
    return this.saved();
  }
}
```

This does not catch a browser refresh or tab close. Add a `beforeunload` listener for that.

## Reading route data in a guard

```typescript
export const roleGuard: CanActivateFn = route => {
  const required = route.data['roles'] as string[] | undefined;
  const auth = inject(AuthService);

  if (!required) return true;

  return required.some(role => auth.roles().includes(role))
    || inject(Router).createUrlTree(['/denied']);
};
```

```typescript
{ path: 'admin', component: Admin, canActivate: [roleGuard], data: { roles: ['admin'] } }
```

One guard, configured per route. Better than writing a guard per role.

## Guards with arguments

A factory returns a configured guard.

```typescript
export function requireRole(...roles: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return roles.some(r => auth.roles().includes(r))
      || router.createUrlTree(['/denied']);
  };
}
```

```typescript
{ path: 'admin', component: Admin, canActivate: [requireRole('admin')] }
{ path: 'reports', component: Reports, canActivate: [requireRole('admin', 'analyst')] }
```

Reads well at the call site, and the guard stays testable.

## Resolvers

A resolver fetches data before the route activates, so the component renders with data already present.

```typescript
import { ResolveFn } from '@angular/router';

export const userResolver: ResolveFn<User> = route => {
  const id = route.paramMap.get('id')!;
  return inject(UserService).getById(id);
};
```

```typescript
{
  path: 'users/:id',
  component: UserDetail,
  resolve: { user: userResolver },
}
```

With `withComponentInputBinding()`, the resolved value arrives as an input:

```typescript
export class UserDetail {
  readonly user = input.required<User>();
}
```

No loading state in the component, because the route did not activate until the data arrived.

## The cost of resolvers

That is also the drawback. **Nothing renders while a resolver runs.** The user clicks a link and the page sits there.

```text
Resolver          nothing renders until the data arrives
Load in component the page renders immediately with a spinner
```

Use a resolver when the page is meaningless without the data, and the request is fast. Use `httpResource` in the component when you can show a useful skeleton.

Modern Angular leans towards the second. A skeleton usually feels faster than a frozen page.

If you do use resolvers, give the user feedback:

```typescript
protected readonly resolving = toSignal(
  this.router.events.pipe(
    map(e => e instanceof ResolveStart ? true : e instanceof ResolveEnd ? false : null),
    filter(v => v !== null),
  ),
  { initialValue: false },
);
```

## Handling resolver errors

An error in a resolver cancels the navigation, which can leave the user stuck.

```typescript
export const userResolver: ResolveFn<User | null> = route => {
  const id = route.paramMap.get('id')!;
  const router = inject(Router);

  return inject(UserService).getById(id).pipe(
    catchError(() => {
      router.navigate(['/not-found']);
      return of(null);
    }),
  );
};
```

Redirect explicitly rather than letting the navigation fail silently.

## Testing a functional guard

Guards need an injection context, so use `TestBed.runInInjectionContext`.

```typescript
describe('authGuard', () => {
  it('redirects when signed out', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { isLoggedIn: () => false } }],
    });

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/admin' } as RouterStateSnapshot)
    );

    expect(result).toBeInstanceOf(UrlTree);
  });
});
```

## Guards are not security

A guard stops a route rendering in the browser. It does not stop anyone calling your API.

Anyone can open the developer tools and change a signal, or simply request the endpoint directly. **Authorisation belongs on the server.** Guards are for the experience, not the protection.

## Quick recap

- Guards are plain functions using `inject()`, with no class needed.
- Return a `UrlTree` to redirect rather than `false`, which leaves the user stuck.
- `canMatch` runs before a lazy chunk downloads, `canActivate` runs after.
- `canMatch` also lets two routes share a path and choose by condition.
- `canDeactivate` protects unsaved changes, but not against a refresh.
- A resolver blocks rendering until data arrives, so prefer a skeleton in the component.
- Guards are a user experience feature. Real authorisation is on the server.

<code id="code-content" class="language-typescript">
import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, CanDeactivateFn, ResolveFn, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
// A guard is just a function. inject() works because Angular calls it
// inside an injection context.
export const authGuard: CanActivateFn = (route, state) =&gt; {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  // Return a UrlTree to REDIRECT. Returning false blocks and leaves the
  // user where they were, which usually looks broken.
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
// Configure one guard per route with route data, rather than a guard per role
export const roleGuard: CanActivateFn = route =&gt; {
  const required = route.data['roles'] as string[] | undefined;
  if (!required) return true;
  const auth = inject(AuthService);
  return required.some(r =&gt; auth.roles().includes(r))
    || inject(Router).createUrlTree(['/denied']);
};
// Or a factory, which reads better at the call site
export function requireRole(...roles: string[]): CanActivateFn {
  return () =&gt; roles.some(r =&gt; inject(AuthService).roles().includes(r))
    || inject(Router).createUrlTree(['/denied']);
}
// { path: 'admin', canActivate: [requireRole('admin')] }
// canDeactivate protects unsaved work. It does NOT catch a browser refresh.
export interface CanLeave { canLeave(): boolean; }
export const unsavedGuard: CanDeactivateFn&lt;CanLeave&gt; = component =&gt;
  component.canLeave() || confirm('You have unsaved changes. Leave anyway?');
// A resolver fetches BEFORE the route activates. With withComponentInputBinding()
// the value arrives as a plain input.
export const userResolver: ResolveFn&lt;User | null&gt; = route =&gt; {
  const id = route.paramMap.get('id')!;
  const router = inject(Router);
  return inject(UserService).getById(id).pipe(
    catchError(() =&gt; { router.navigate(['/not-found']); return of(null); }));
};
// { path: 'users/:id', component: UserDetail, resolve: { user: userResolver } }
// export class UserDetail { readonly user = input.required&lt;User&gt;(); }
// The cost: NOTHING renders while a resolver runs. The page just sits there.
// Often a skeleton plus httpResource in the component feels faster.
// Guard placement:
//   canMatch        before a lazy chunk downloads. Use this for lazy routes.
//   canActivate     after loading, before entering
//   canActivateChild once for every child route
//   canDeactivate   on leaving
// GUARDS ARE NOT SECURITY. They stop a route rendering in the browser.
// Anyone can call your API directly. Authorise on the SERVER.
interface User { name: string; }
</code></pre>
