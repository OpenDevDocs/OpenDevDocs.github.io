---
publishDate: 2026-06-14T09:40
title: Lazy Loading with loadComponent and loadChildren
slug: lazy-loading-routes
metadescription: Split your bundle by route with loadComponent and loadChildren, and control when chunks are preloaded.
updateDate: 2026-09-07T09:40
author: ['bishal-biswas']
level: 2
tags: ['routing', 'lazy loading', 'performance']
course: angular
---

## Why split the bundle

Everything imported at the top of a file ends up in the initial bundle. A user visiting the home page downloads the admin panel, the reporting screens and the settings pages before anything renders.

Lazy loading splits those into separate files that download only when their route is visited.

## loadComponent

The simplest form. One route, one chunk.

```typescript
export const routes: Routes = [
  { path: '', component: Home },
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin').then(m => m.Admin),
  },
];
```

The `import()` call is what creates the split point. The bundler sees it and emits a separate chunk.

With a default export it is shorter:

```typescript
// admin.ts
export default class Admin {}
```

```typescript
{
  path: 'admin',
  loadComponent: () => import('./admin/admin'),
}
```

Named exports are clearer for anything that might be imported elsewhere, so most codebases use the longer form.

## loadChildren

A group of routes in one chunk.

```typescript
{
  path: 'users',
  loadChildren: () => import('./users/users.routes').then(m => m.userRoutes),
}
```

```typescript
// users/users.routes.ts
import { Routes } from '@angular/router';

export const userRoutes: Routes = [
  { path: '', component: UserList },
  { path: 'new', component: UserCreate },
  { path: ':id', component: UserDetail },
];
```

All three components share one chunk, downloaded when any route under `/users` is first visited.

That grouping is usually right. Splitting every component into its own chunk means many small requests, and a user in the users section will probably visit more than one of them.

Older code loads an NgModule instead, and both still work:

```typescript
{
  path: 'users',
  loadChildren: () => import('./users/users.module').then(m => m.UsersModule),
}
```

## Lazy routes with a layout

```typescript
// users/users.routes.ts
export const userRoutes: Routes = [
  {
    path: '',
    component: UsersLayout,
    providers: [UsersState],
    children: [
      { path: '', component: UserList },
      { path: ':id', component: UserDetail },
    ],
  },
];
```

The layout and the providers come with the chunk, so the feature is genuinely self contained.

## Preloading

Lazy loading trades initial size for a delay on first navigation. Preloading gets both: a small initial bundle, and chunks already downloaded by the time they are needed.

```typescript
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';

provideRouter(routes, withPreloading(PreloadAllModules))
```

`PreloadAllModules` downloads every lazy chunk in the background once the application is stable. Good for small and medium applications.

For larger ones, preload selectively.

```typescript
@Injectable({ providedIn: 'root' })
export class SelectivePreload implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    return route.data?.['preload'] ? load() : of(null);
  }
}
```

```typescript
{
  path: 'users',
  data: { preload: true },
  loadChildren: () => import('./users/users.routes').then(m => m.userRoutes),
}
```

```typescript
provideRouter(routes, withPreloading(SelectivePreload))
```

Now only the routes you mark are preloaded. Mark the common ones and leave rarely used sections to load on demand.

A more considerate strategy respects the connection:

```typescript
@Injectable({ providedIn: 'root' })
export class NetworkAwarePreload implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const connection = (navigator as any).connection;

    if (connection?.saveData) return of(null);
    if (/2g/.test(connection?.effectiveType ?? '')) return of(null);

    return load();
  }
}
```

## Guards run before loading

A guard on a lazy route runs **before** the chunk downloads, so an unauthorised user never fetches it.

```typescript
{
  path: 'admin',
  canMatch: [adminGuard],
  loadChildren: () => import('./admin/admin.routes').then(m => m.adminRoutes),
}
```

`canMatch` is the right guard here. `canActivate` runs after the chunk has loaded, so it does not prevent the download.

```text
canMatch      runs before loading, so the chunk is never fetched
canActivate   runs after loading, so the chunk is downloaded then blocked
```

Use `canMatch` for anything you want to keep off the wire.

`canMatch` also lets a route fall through to a later one:

```typescript
{ path: 'dashboard', canMatch: [isAdmin], loadComponent: () => import('./admin-dashboard') },
{ path: 'dashboard', loadComponent: () => import('./user-dashboard') },
```

Same path, different component depending on the guard. `canActivate` cannot do this, because it blocks rather than declining to match.

## Loading indicators

There is a gap while the chunk downloads. Show something.

```typescript
export class App {
  private readonly router = inject(Router);

  protected readonly loading = toSignal(
    this.router.events.pipe(
      map(e =>
        e instanceof NavigationStart ? true :
        e instanceof NavigationEnd || e instanceof NavigationCancel ||
        e instanceof NavigationError ? false : null
      ),
      filter(v => v !== null),
    ),
    { initialValue: false },
  );
}
```

```html
@if (loading()) { <app-progress-bar /> }
<router-outlet />
```

Remember `NavigationCancel` and `NavigationError`, or a blocked navigation leaves the bar spinning forever.

## Checking the split worked

```bash
ng build
```

The output lists chunks:

```text
Initial chunk files    | Names          | Raw size
main-ABC123.js         | main           | 245.30 kB
polyfills-DEF456.js    | polyfills      |  34.58 kB

Lazy chunk files       | Names          | Raw size
chunk-GHI789.js        | admin-routes   |  89.12 kB
chunk-JKL012.js        | users-routes   |  45.67 kB
```

If a feature you expected to be lazy appears in the initial bundle, something is importing it eagerly. That is the most common lazy loading failure.

## The eager import trap

```typescript
// app.routes.ts
import { Admin } from './admin/admin';        // this defeats the whole thing

export const routes: Routes = [
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin').then(m => m.Admin),
  },
];
```

The static import at the top pulls `Admin` into the initial bundle. The dynamic import then loads the same code again.

It happens easily: an editor auto import while writing the route, or importing a type from the lazy module.

For types only, use a type only import, which is erased at compile time:

```typescript
import type { AdminConfig } from './admin/admin';
```

## Shared code

Code used by both an eager and a lazy route ends up in a shared chunk automatically. The bundler works this out.

Where it goes wrong is a barrel file:

```typescript
// shared/index.ts
export * from './button';
export * from './heavy-chart';
export * from './date-utils';
```

Importing one thing from the barrel can pull in everything, depending on how well tree shaking works for those files. If a lazy chunk is unexpectedly large, look at barrel imports first and import from the specific file instead.

## What to lazy load

```text
Lazy                              Eager
admin and settings sections       the shell and navigation
rarely visited features           the landing page
heavy third party libraries       shared components used everywhere
routes behind authentication      the authentication screens themselves
```

The rough rule: if most users never see it in a session, it should be lazy.

Do not lazy load tiny components. A separate request for 3 KB costs more than it saves.

## Quick recap

- `loadComponent` splits one route, `loadChildren` splits a group into one chunk.
- Grouping a feature into one chunk usually beats splitting every component.
- Preloading gets a small initial bundle and no delay on navigation.
- Use a selective strategy in larger applications rather than preloading everything.
- `canMatch` runs before the chunk downloads, `canActivate` runs after.
- `canMatch` also lets two routes share a path and pick by condition.
- A static import of a lazy component defeats the split, so check the build output.

<code id="code-content" class="language-typescript">
import { Routes, provideRouter, withPreloading, PreloadingStrategy, Route } from '@angular/router';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
// import { Admin } from './admin/admin';   // NEVER: a static import defeats the split
import type { AdminConfig } from './admin/admin';   // type only imports are erased
export const routes: Routes = [
  { path: '', component: Home },             // eager: the shell and landing page
  // loadComponent: ONE route, one chunk
  { path: 'about', loadComponent: () =&gt; import('./about/about').then(m =&gt; m.About) },
  // loadChildren: a GROUP of routes sharing one chunk. Usually what you want,
  // because a user in this section will visit more than one of its pages.
  {
    path: 'users',
    data: { preload: true },                 // read by the strategy below
    loadChildren: () =&gt; import('./users/users.routes').then(m =&gt; m.userRoutes),
  },
  // canMatch runs BEFORE the chunk downloads, so it never reaches the wire.
  // canActivate runs AFTER loading, so the chunk is fetched and then blocked.
  {
    path: 'admin',
    canMatch: [adminGuard],
    loadChildren: () =&gt; import('./admin/admin.routes').then(m =&gt; m.adminRoutes),
  },
  // canMatch also lets two routes share a path and pick by condition.
  // canActivate cannot: it blocks rather than declining to match.
  { path: 'dashboard', canMatch: [isAdmin],
    loadComponent: () =&gt; import('./admin-dashboard').then(m =&gt; m.AdminDashboard) },
  { path: 'dashboard',
    loadComponent: () =&gt; import('./user-dashboard').then(m =&gt; m.UserDashboard) },
];
// Preload only the routes you mark, rather than everything
@Injectable({ providedIn: 'root' })
export class SelectivePreload implements PreloadingStrategy {
  preload(route: Route, load: () =&gt; Observable&lt;unknown&gt;): Observable&lt;unknown&gt; {
    const connection = (navigator as any).connection;
    if (connection?.saveData) return of(null);          // respect data saver
    return route.data?.['preload'] ? load() : of(null);
  }
}
provideRouter(routes, withPreloading(SelectivePreload));
// Check it worked. ng build lists initial and lazy chunks separately.
// A feature you expected to be lazy appearing in the INITIAL bundle means
// something imports it eagerly. Barrel files (shared/index.ts) are the
// usual culprit: import from the specific file instead.
// Rule of thumb: if most users never see it in a session, make it lazy.
// Do not split tiny components. A request for 3 kB costs more than it saves.
</code></pre>
