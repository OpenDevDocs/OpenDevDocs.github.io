---
publishDate: 2026-06-13T09:20
title: Router Setup and Route Configuration
slug: router-setup-and-configuration
metadescription: Configure Angular routing with provideRouter, understand route matching order, and pick the right router features.
updateDate: 2026-09-07T09:20
author: ['bishal-biswas']
level: 2
tags: ['routing', 'router', 'configuration']
course: angular
---

## Setting up

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { Home } from './home/home';
import { About } from './about/about';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'about', component: About },
  { path: '**', component: NotFound },
];
```

```typescript
// app.config.ts
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes)],
};
```

```typescript
// app.ts
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <nav>...</nav>
    <router-outlet />
  `,
})
export class App {}
```

The matched component renders where `<router-outlet />` sits.

`provideRouter` replaced `RouterModule.forRoot(routes)`. The old form still works.

## Route matching

Routes are matched **in order**, and the first match wins. This is the rule that causes most routing confusion.

```typescript
// wrong: /users/new never matches
export const routes: Routes = [
  { path: 'users/:id', component: UserDetail },
  { path: 'users/new', component: UserCreate },
];

// right: specific before generic
export const routes: Routes = [
  { path: 'users/new', component: UserCreate },
  { path: 'users/:id', component: UserDetail },
];
```

`:id` matches anything, including `new`. Specific paths must come first.

The wildcard `'**'` must be last, since it matches everything.

## Path matching strategies

```typescript
{ path: '', component: Home }                          // prefix match, matches everything
{ path: '', component: Home, pathMatch: 'full' }       // only the exact empty path
```

The default is `prefix`, which matches if the URL **starts with** the path. An empty path with prefix matching matches every URL, so the empty route almost always needs `pathMatch: 'full'`.

```typescript
export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Dashboard },
];
```

Without `pathMatch: 'full'`, that redirect fires for every URL and the application never goes anywhere else. It is the single most common routing bug.

## Redirects

```typescript
{ path: '', redirectTo: '/home', pathMatch: 'full' },
{ path: 'old-path', redirectTo: '/new-path' },
{ path: 'legacy/:id', redirectTo: 'items/:id' },        // parameters carry over
```

A function gives you full control:

```typescript
{
  path: 'profile',
  redirectTo: () => {
    const auth = inject(AuthService);
    return auth.isLoggedIn() ? '/profile/me' : '/login';
  },
}
```

## Route data and title

```typescript
{
  path: 'admin',
  component: Admin,
  title: 'Admin panel',
  data: { roles: ['admin'], breadcrumb: 'Administration' },
}
```

`title` sets the document title automatically. It can be a function:

```typescript
{
  path: 'users/:id',
  component: UserDetail,
  title: (route) => `User ${route.paramMap.get('id')}`,
}
```

Or a resolver class for anything asynchronous. Customise the format with a title strategy:

```typescript
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const pageTitle = this.buildTitle(snapshot);
    this.title.setTitle(pageTitle ? `${pageTitle} | My App` : 'My App');
  }
}

providers: [{ provide: TitleStrategy, useClass: AppTitleStrategy }]
```

`data` is arbitrary static information read by guards, breadcrumbs and layouts.

## Router features

```typescript
provideRouter(
  routes,
  withComponentInputBinding(),
  withViewTransitions(),
  withInMemoryScrolling({
    scrollPositionRestoration: 'enabled',
    anchorScrolling: 'enabled',
  }),
  withRouterConfig({ onSameUrlNavigation: 'reload' }),
  withHashLocation(),
  withDebugTracing(),
  withPreloading(PreloadAllModules),
)
```

**`withComponentInputBinding()`** binds route parameters, query parameters and resolved data straight to component inputs. Turn this on. It removes most `ActivatedRoute` boilerplate.

**`withViewTransitions()`** uses the browser View Transitions API to animate between routes, with a one line setup.

**`withInMemoryScrolling()`** restores scroll position on back navigation and supports `#anchor` links. Without it, every navigation lands at the top, which is wrong for back buttons.

**`withHashLocation()`** produces `/#/about` URLs. Only needed when the server cannot be configured to serve `index.html` for every path.

**`withDebugTracing()`** logs every routing event. Invaluable when a navigation is not doing what you expect. Development only.

**`withPreloading()`** loads lazy chunks in the background after the application starts.

## Server configuration

A single page application needs the server to return `index.html` for any path, otherwise a refresh on `/about` gives a 404.

```text
nginx        try_files $uri $uri/ /index.html;
Apache       a rewrite rule to index.html
Netlify      a _redirects file with  /*  /index.html  200
Firebase     "rewrites": [{ "source": "**", "destination": "/index.html" }]
```

This catches people out after their first deploy. Routing works while clicking around, then breaks on refresh.

## Base href

```html
<base href="/">
```

Deploying to a subfolder means changing it:

```bash
ng build --base-href=/my-app/
```

Getting this wrong produces an application that loads but whose routes and assets all 404.

## Router events

```typescript
export class App {
  private readonly router = inject(Router);

  protected readonly navigating = toSignal(
    this.router.events.pipe(
      map(e => e instanceof NavigationStart),
      startWith(false),
    ),
    { initialValue: false },
  );
}
```

Useful events:

```text
NavigationStart      navigation began
NavigationEnd        it finished successfully
NavigationCancel     a guard blocked it
NavigationError      something threw
ResolveStart/End     resolvers ran
```

A progress bar during navigation is the common use.

## Reading the current route

```typescript
export class Breadcrumbs {
  private readonly router = inject(Router);

  protected readonly url = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
}
```

For parameters, `withComponentInputBinding()` and component inputs are far simpler than reading the router directly.

## Organising routes

Keep feature routes in their own files.

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: '', component: Home },
  {
    path: 'users',
    loadChildren: () => import('./users/users.routes').then(m => m.userRoutes),
  },
  { path: '**', component: NotFound },
];
```

```typescript
// users/users.routes.ts
export const userRoutes: Routes = [
  { path: '', component: UserList },
  { path: 'new', component: UserCreate },
  { path: ':id', component: UserDetail },
];
```

The root file stays readable, and each feature owns its own paths.

## Quick recap

- `provideRouter(routes)` sets up routing, and `<router-outlet />` is where components render.
- Routes match in order, so specific paths must come before parameterised ones.
- An empty path redirect needs `pathMatch: 'full'`, or it matches every URL.
- Turn on `withComponentInputBinding()` to bind route parameters to inputs.
- `withInMemoryScrolling()` restores scroll position on back navigation.
- The server must serve `index.html` for every path, or refreshes 404.
- Split feature routes into their own files and load them lazily.

<code id="code-content" class="language-typescript">
import { Routes, provideRouter, withComponentInputBinding, withViewTransitions,
         withInMemoryScrolling, withPreloading, PreloadAllModules,
         withDebugTracing, TitleStrategy } from '@angular/router';
import { inject } from '@angular/core';
export const routes: Routes = [
  // Routes match IN ORDER, first match wins.
  // An empty path with the default prefix matching matches EVERY url,
  // so a redirect here MUST have pathMatch: 'full'. This is the classic bug.
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Dashboard, title: 'Dashboard' },
  // SPECIFIC before parameterised, or /users/new never matches: :id eats it
  { path: 'users/new', component: UserCreate },
  { path: 'users/:id', component: UserDetail,
    title: (route) =&gt; `User ${route.paramMap.get('id')}`,
    data: { roles: ['admin'], breadcrumb: 'User' } },
  // A redirect can be a function
  { path: 'profile', redirectTo: () =&gt; inject(AuthService).isLoggedIn()
      ? '/profile/me' : '/login' },
  // Feature routes in their own file, loaded lazily
  { path: 'orders', loadChildren: () =&gt; import('./orders/orders.routes')
      .then(m =&gt; m.orderRoutes) },
  { path: '**', component: NotFound },      // wildcard MUST be last
];
export const appConfig = {
  providers: [
    provideRouter(
      routes,
      withComponentInputBinding(),    // route params bind straight to inputs
      withViewTransitions(),          // animated navigation, one line
      withInMemoryScrolling({         // without this, back always lands at the top
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
      withPreloading(PreloadAllModules),
      // withHashLocation(),          // /#/about, when the server cannot be configured
      // withDebugTracing(),          // logs every routing event. Development only.
    ),
  ],
};
// The server MUST serve index.html for every path, or a refresh on /about 404s:
//   nginx     try_files $uri $uri/ /index.html;
//   Netlify   /*  /index.html  200
// Deploying to a subfolder needs:  ng build --base-href=/my-app/
</code></pre>
