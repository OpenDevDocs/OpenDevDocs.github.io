---
publishDate: 2026-06-15T09:50
title: Class-based Guards and Legacy Router Patterns
slug: class-based-guards-legacy
metadescription: Read the deprecated class based guards and resolvers in older codebases, and convert them to functions.
updateDate: 2026-09-07T09:50
author: ['bishal-biswas']
level: 2
tags: ['legacy', 'routing', 'guards']
course: angular
---

## The old shape

Before Angular 14, a guard was a class implementing an interface.

```typescript
import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): boolean | UrlTree {
    if (this.auth.isLoggedIn()) return true;

    return this.router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }
}
```

```typescript
{ path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] }
```

The logic is identical to the functional version. The class, the decorator, the constructor and the interface are all ceremony around it.

## The interfaces

```typescript
CanActivate         canActivate(route, state)
CanActivateChild    canActivateChild(route, state)
CanDeactivate<T>    canDeactivate(component, route, state, nextState)
CanLoad             canLoad(route, segments)
Resolve<T>          resolve(route, state)
```

All of them are **deprecated**. They still work in Angular 22, and Angular has been unusually patient about removing them, but new code should not use them.

## CanLoad is gone

`CanLoad` was replaced by `canMatch`, which does the same job and more.

```typescript
// old
@Injectable({ providedIn: 'root' })
export class AdminLoadGuard implements CanLoad {
  canLoad(route: Route, segments: UrlSegment[]): boolean {
    return this.auth.isAdmin();
  }
}

{ path: 'admin', canLoad: [AdminLoadGuard], loadChildren: ... }
```

```typescript
// new
export const adminGuard: CanMatchFn = () => inject(AuthService).isAdmin();

{ path: 'admin', canMatch: [adminGuard], loadChildren: ... }
```

`canMatch` also lets a route decline to match so a later route can handle the path, which `canLoad` never could.

## Class resolvers

```typescript
@Injectable({ providedIn: 'root' })
export class UserResolver implements Resolve<User> {
  constructor(private users: UserService) {}

  resolve(route: ActivatedRouteSnapshot): Observable<User> {
    return this.users.getById(route.paramMap.get('id')!);
  }
}
```

```typescript
{ path: 'users/:id', component: UserDetail, resolve: { user: UserResolver } }
```

Reading the result in the component, the old way:

```typescript
export class UserDetailComponent implements OnInit {
  user!: User;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.user = this.route.snapshot.data['user'];
  }
}
```

Note `data['user']` is a string lookup with no type checking. Rename the resolver key and this fails silently at runtime.

## Converting a guard

The mechanical steps:

1. Delete the class wrapper and the decorator.
2. Change constructor parameters into `inject()` calls inside the function.
3. Give it the right function type: `CanActivateFn`, `CanMatchFn`, `ResolveFn<T>`.
4. Update the route to reference the function.

```typescript
// before
@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    return this.auth.isAdmin() || this.router.createUrlTree(['/denied']);
  }
}
```

```typescript
// after
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAdmin() || router.createUrlTree(['/denied']);
};
```

The route entry changes from `canActivate: [AdminGuard]` to `canActivate: [adminGuard]`. Only the capital letter differs, which is worth watching during review.

## Converting incrementally

Both styles work in one application, and even on one route.

```typescript
{
  path: 'admin',
  component: Admin,
  canActivate: [OldClassGuard, newFunctionalGuard],
}
```

That lets you convert one guard at a time.

## Wrapping a class guard

For a guard you cannot convert yet, `mapToCanActivate` bridges it.

```typescript
import { mapToCanActivate } from '@angular/router';

{
  path: 'admin',
  component: Admin,
  canActivate: mapToCanActivate([OldClassGuard]),
}
```

Useful during a migration, though referencing the class directly also still works.

## Testing the difference

A class guard is easy to test, because you can construct it.

```typescript
it('redirects when signed out', () => {
  const guard = new AuthGuard(
    { isLoggedIn: () => false } as AuthService,
    routerSpy,
  );

  expect(guard.canActivate(route, state)).toBeInstanceOf(UrlTree);
});
```

A functional guard needs an injection context.

```typescript
it('redirects when signed out', () => {
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { isLoggedIn: () => false } },
    ],
  });

  const result = TestBed.runInInjectionContext(() => authGuard(route, state));

  expect(result).toBeInstanceOf(UrlTree);
});
```

Slightly more setup, and it exercises the real injection, so it catches provider mistakes the constructor version would not.

## Why the change happened

**Less code.** No class, no decorator, no constructor.

**Composable.** A function can be wrapped or generated by a factory. A class cannot, without inheritance.

```typescript
export function requireRole(role: string): CanActivateFn {
  return () => inject(AuthService).roles().includes(role);
}
```

**Better tree shaking.** An unused function is removed. An unused injectable class referenced in a route array is not.

**Consistent with the rest of Angular.** Interceptors, providers and resolvers all became functions at the same time, for the same reasons.

## Should you convert?

There is no urgency. Deprecated APIs in Angular have long lives, and these still work.

Convert when:

- You are already editing the guard.
- You want factory guards taking arguments.
- Your team has settled on the functional style.
- You are removing `CanLoad`, which has a genuinely better replacement in `canMatch`.

A stable `AuthGuard` class nobody touches can stay as it is.

## Quick recap

- Class based guards implement `CanActivate` and friends, and are deprecated but working.
- `CanLoad` is replaced by `canMatch`, which can also decline to match.
- Converting means deleting the class and turning constructor parameters into `inject()` calls.
- Both styles can appear on the same route during a migration.
- `mapToCanActivate` bridges a class guard you cannot convert yet.
- Functional guards need `TestBed.runInInjectionContext` in tests.
- Functions compose into factories, which classes cannot do without inheritance.

<code id="code-content" class="language-typescript">
import { Injectable, inject } from '@angular/core';
import { CanActivate, CanLoad, Resolve, Router, ActivatedRouteSnapshot,
         RouterStateSnapshot, UrlTree, CanActivateFn, CanMatchFn, ResolveFn,
         mapToCanActivate } from '@angular/router';
import { Observable } from 'rxjs';
// The OLD shape. Deprecated, still working in Angular 22.
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}
  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    if (this.auth.isLoggedIn()) return true;
    return this.router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
}
// The SAME logic as a function. The class, decorator, constructor and
// interface were all ceremony around these four lines.
export const authGuard: CanActivateFn = (route, state) =&gt; {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
// Converting: delete the class, turn constructor params into inject() calls,
// give it the right function type, update the route reference.
//   canActivate: [AuthGuard]   -&gt;   canActivate: [authGuard]
// Only the capital letter differs. Watch for that in review.
// CanLoad is REPLACED by canMatch, which can also decline to match so a
// later route handles the path. CanLoad never could.
@Injectable({ providedIn: 'root' })
export class AdminLoadGuard implements CanLoad {
  canLoad(): boolean { return inject(AuthService).isAdmin(); }
}
export const adminGuard: CanMatchFn = () =&gt; inject(AuthService).isAdmin();
// Class resolvers read back with an UNTYPED string key:
//   this.user = this.route.snapshot.data['user'];
// Rename the resolver key and that fails silently at runtime.
@Injectable({ providedIn: 'root' })
export class UserResolver implements Resolve&lt;User&gt; {
  constructor(private users: UserService) {}
  resolve(route: ActivatedRouteSnapshot): Observable&lt;User&gt; {
    return this.users.getById(route.paramMap.get('id')!);
  }
}
export const userResolver: ResolveFn&lt;User&gt; = route =&gt;
  inject(UserService).getById(route.paramMap.get('id')!);
// Both styles work together during a migration, even on one route:
//   canActivate: [OldClassGuard, newFunctionalGuard]
//   canActivate: mapToCanActivate([OldClassGuard])
// Why functions won: less code, better tree shaking, and they COMPOSE.
// A class cannot be parameterised without inheritance:
export function requireRole(role: string): CanActivateFn {
  return () =&gt; inject(AuthService).roles().includes(role);
}
interface User { name: string; }
</code></pre>
