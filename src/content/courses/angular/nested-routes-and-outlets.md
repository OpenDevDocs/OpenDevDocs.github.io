---
publishDate: 2026-06-14T09:35
title: Nested Routes and Child Outlets
slug: nested-routes-and-outlets
metadescription: Build layouts with child routes, render several outlets at once, and use named outlets for modals and side panels.
updateDate: 2026-09-07T09:35
author: ['bishal-biswas']
level: 2
tags: ['routing', 'nested routes', 'outlets']
course: angular
---

## Child routes

A route can have children, and the parent supplies a layout with its own `<router-outlet />`.

```typescript
export const routes: Routes = [
  {
    path: 'settings',
    component: SettingsLayout,
    children: [
      { path: '', redirectTo: 'profile', pathMatch: 'full' },
      { path: 'profile', component: ProfileSettings },
      { path: 'security', component: SecuritySettings },
      { path: 'billing', component: BillingSettings },
    ],
  },
];
```

```typescript
@Component({
  selector: 'app-settings-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="settings">
      <nav>
        <a routerLink="profile" routerLinkActive="active">Profile</a>
        <a routerLink="security" routerLinkActive="active">Security</a>
        <a routerLink="billing" routerLinkActive="active">Billing</a>
      </nav>

      <main>
        <router-outlet />
      </main>
    </div>
  `,
})
export class SettingsLayout {}
```

Navigating to `/settings/security` renders `SettingsLayout` with `SecuritySettings` inside its outlet. The navigation stays visible and is not recreated when moving between tabs.

Note the relative `routerLink="profile"` in the nav. It resolves against the parent route, so the layout does not need to know its own path.

## The empty child redirect

```typescript
{ path: '', redirectTo: 'profile', pathMatch: 'full' }
```

Without this, `/settings` renders the layout with an empty outlet. Almost always you want a default child.

The alternative is a component on the empty path:

```typescript
{ path: '', component: SettingsOverview }
```

## Layout routes without a path

A parent route can exist purely to apply a layout or providers, with no path segment of its own.

```typescript
export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      { path: 'home', component: Home },
      { path: 'users', component: UserList },
    ],
  },
  {
    path: '',
    component: BareLayout,
    children: [
      { path: 'login', component: Login },
      { path: 'register', component: Register },
    ],
  },
];
```

`/home` renders inside `MainLayout` with its header and navigation. `/login` renders inside `BareLayout` with neither. The URLs are unchanged.

This is the cleanest way to have different shells for different parts of an application.

## Route level providers

A parent route can provide services scoped to its subtree.

```typescript
{
  path: 'checkout',
  component: CheckoutLayout,
  providers: [CheckoutState, { provide: API_URL, useValue: '/checkout-api' }],
  children: [
    { path: 'cart', component: Cart },
    { path: 'payment', component: Payment },
    { path: 'confirm', component: Confirm },
  ],
}
```

Every component under `/checkout` shares one `CheckoutState`, and it is destroyed when you navigate away. That is the standard way to hold multi step state without putting it in a global service.

## Nested outlets go deeper

```typescript
{
  path: 'users/:id',
  component: UserLayout,
  children: [
    { path: '', component: UserOverview },
    {
      path: 'orders',
      component: OrdersLayout,
      children: [
        { path: '', component: OrderList },
        { path: ':orderId', component: OrderDetail },
      ],
    },
  ],
}
```

`/users/42/orders/7` renders three nested layouts. Each one needs its own `<router-outlet />`.

Two or three levels is comfortable. Deeper usually means the URL structure needs rethinking.

## Named outlets

A route can render into a **secondary** outlet, letting two things be routed at once.

```typescript
@Component({
  template: `
    <router-outlet />
    <router-outlet name="sidebar" />
  `,
})
export class App {}
```

```typescript
export const routes: Routes = [
  { path: 'users', component: UserList },
  { path: 'help', component: HelpPanel, outlet: 'sidebar' },
];
```

```html
<a [routerLink]="[{ outlets: { sidebar: ['help'] } }]">Open help</a>
```

The URL becomes `/users(sidebar:help)`. That parenthesised syntax is how Angular encodes secondary outlets.

Closing it means routing the outlet to `null`:

```html
<a [routerLink]="[{ outlets: { sidebar: null } }]">Close</a>
```

```typescript
this.router.navigate([{ outlets: { sidebar: null } }]);
```

## Named outlets for modals

The practical use. A modal that is part of the URL can be linked to, bookmarked and closed with the back button.

```typescript
export const routes: Routes = [
  { path: 'users', component: UserList },
  { path: 'users/:id/edit', component: EditUserDialog, outlet: 'modal' },
];
```

```typescript
@Component({
  template: `
    <router-outlet />

    <div class="modal-host">
      <router-outlet name="modal" />
    </div>
  `,
})
export class App {}
```

```html
<a [routerLink]="[{ outlets: { modal: ['users', user.id, 'edit'] } }]">Edit</a>
```

The URL is `/users(modal:users/42/edit)`, which is ugly but genuinely useful. Refreshing reopens the modal, and back closes it.

For most applications a signal in a service is simpler. Use routed modals when the modal state genuinely belongs in the URL.

## Keeping state between children

Switching between sibling child routes destroys and recreates the child components. State inside them is lost.

Three ways to keep it:

**Put it in the parent**, which is not recreated.

```typescript
@Component({
  selector: 'app-settings-layout',
  providers: [SettingsDraft],
  template: `<router-outlet />`,
})
export class SettingsLayout {}
```

**Put it in the URL** as query parameters.

**Put it in a service** provided at the route.

The first two are usually right. A global service for what is really page state tends to leak.

## Route reuse

By default, navigating to the same component with different parameters reuses the instance. Signal inputs handle this correctly.

To force a fresh component instead:

```typescript
provideRouter(routes, withRouterConfig({ onSameUrlNavigation: 'reload' }))
```

Or supply a custom `RouteReuseStrategy`. That is rarely necessary and easy to get wrong, so reach for it last.

## Debugging

```typescript
provideRouter(routes, withDebugTracing())
```

It logs every routing event with the matched configuration. When a nested route renders nothing, this shows exactly where matching stopped.

The usual causes: a missing `<router-outlet />` in the parent, an empty child path without `pathMatch: 'full'`, or a parent path that already consumed the segment.

## Quick recap

- Child routes render inside the parent's `<router-outlet />`, keeping the layout alive.
- Add an empty child route with `pathMatch: 'full'` for a sensible default.
- A pathless parent route applies a layout or providers without adding a URL segment.
- Route level `providers` scope state to a feature and destroy it on leaving.
- Named outlets render a second route at once, encoded as `(name:path)`.
- Route an outlet to `null` to close it.
- State in a child is lost when switching siblings, so keep it in the parent or the URL.

<code id="code-content" class="language-typescript">
import { Component } from '@angular/core';
import { Routes, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
export const routes: Routes = [
  // A PATHLESS parent applies a layout without adding a URL segment.
  // /home renders inside MainLayout, /login inside BareLayout.
  {
    path: '', component: MainLayout,
    children: [
      { path: 'home', component: Home },
      {
        path: 'settings', component: SettingsLayout,
        // Route level providers: shared by the subtree, destroyed on leaving
        providers: [SettingsState],
        children: [
          // Without this, /settings renders the layout with an EMPTY outlet
          { path: '', redirectTo: 'profile', pathMatch: 'full' },
          { path: 'profile', component: ProfileSettings },
          { path: 'security', component: SecuritySettings },
        ],
      },
    ],
  },
  { path: '', component: BareLayout, children: [{ path: 'login', component: Login }] },
  // A NAMED outlet renders a second route at the same time
  { path: 'users/:id/edit', component: EditUserDialog, outlet: 'modal' },
];
@Component({
  selector: 'app-settings-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    &lt;nav&gt;
      &lt;!-- relative links: the layout does not need to know its own path --&gt;
      &lt;a routerLink="profile" routerLinkActive="active"&gt;Profile&lt;/a&gt;
      &lt;a routerLink="security" routerLinkActive="active"&gt;Security&lt;/a&gt;
    &lt;/nav&gt;
    &lt;main&gt;&lt;router-outlet /&gt;&lt;/main&gt;   &lt;!-- children render HERE --&gt;
  `,
})
export class SettingsLayout {}
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  template: `
    &lt;router-outlet /&gt;
    &lt;div class="modal-host"&gt;&lt;router-outlet name="modal" /&gt;&lt;/div&gt;
    &lt;!-- URL becomes /users(modal:users/42/edit). Refresh reopens it,
         and the back button closes it. --&gt;
    &lt;a [routerLink]="[{ outlets: { modal: ['users', 42, 'edit'] } }]"&gt;Edit&lt;/a&gt;
    &lt;a [routerLink]="[{ outlets: { modal: null } }]"&gt;Close&lt;/a&gt;
  `,
})
export class App {}
// Switching between SIBLING children destroys and recreates them, losing
// their state. Keep it in the parent, in route providers, or in the URL.
// A nested route rendering nothing is almost always one of:
//   a missing &lt;router-outlet /&gt; in the parent
//   an empty child path without pathMatch: 'full'
//   a parent path that already consumed the segment
// provideRouter(routes, withDebugTracing()) shows exactly where matching stopped.
</code></pre>
