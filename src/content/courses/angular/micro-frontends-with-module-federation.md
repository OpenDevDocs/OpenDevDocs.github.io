---
publishDate: 2026-06-29T13:40
title: Micro-frontends with Module Federation
slug: micro-frontends-with-module-federation
metadescription: Split an application across independently deployed pieces, and understand the real costs before you commit to it.
updateDate: 2026-09-07T13:40
author: ['bishal-biswas']
level: 4
tags: ['architecture', 'micro frontends', 'module federation']
course: angular
---

## The idea, and the honest caveat

Micro frontends split a frontend into pieces that separate teams build and **deploy independently**. Team A ships the orders section without waiting for team B.

Start with the caveat, because it is usually the deciding factor: **this is an organisational solution to an organisational problem.** It adds substantial technical complexity, and it only pays off when the constraint is genuinely that separate teams cannot coordinate releases.

If one team owns the application, a monorepo with lazy loaded routes gives you most of the modularity with none of the cost. Reach for micro frontends when deployment independence is a real requirement, not because the codebase feels large.

## How Module Federation works

A **host** application loads code from **remote** applications at runtime, over HTTP. Neither knows about the other at build time.

```text
shell (host)          loads at runtime
├── orders (remote)   deployed separately
├── billing (remote)  deployed separately
└── admin (remote)    deployed separately
```

Shared libraries such as Angular itself are loaded once and reused, rather than each remote shipping its own copy.

## Setting it up

```bash
ng add @angular-architects/module-federation --project shell --port 4200
ng add @angular-architects/module-federation --project orders --port 4201
```

```javascript
// orders/webpack.config.js
module.exports = {
  name: 'orders',
  exposes: {
    './Routes': './projects/orders/src/app/orders.routes.ts',
  },
  shared: {
    '@angular/core': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
    '@angular/common': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
    '@angular/router': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
    rxjs: { singleton: true, strictVersion: true, requiredVersion: 'auto' },
  },
};
```

`singleton: true` on Angular is **not optional**. Two copies of `@angular/core` means two dependency injection systems, two zones and two routers. The symptoms are bizarre: services that exist twice, guards that never fire, injection errors that make no sense.

## Loading a remote

```typescript
import { loadRemoteModule } from '@angular-architects/module-federation';

export const routes: Routes = [
  { path: '', component: Home },
  {
    path: 'orders',
    loadChildren: () =>
      loadRemoteModule({
        type: 'module',
        remoteEntry: 'https://orders.example.com/remoteEntry.js',
        exposedModule: './Routes',
      }).then(m => m.ORDER_ROUTES),
  },
];
```

The URL is resolved at runtime, so deploying a new version of `orders` changes what users load without rebuilding the shell.

Put the URLs in configuration rather than hardcoding them, so environments differ without a rebuild:

```typescript
provideAppInitializer(async () => {
  const config = await fetch('/assets/remotes.json').then(r => r.json());
  setRemoteDefinitions(config);
});
```

## Native federation

`@angular-architects/native-federation` is the successor, built on import maps and the esbuild builder rather than webpack.

```bash
ng add @angular-architects/native-federation --project shell
```

It is the better choice for new work, since it works with the current Angular build system rather than requiring a webpack fallback.

## Sharing state

The hardest part. Remotes are separate builds, so a service in one is not the service in another unless it is genuinely shared.

**A shared library** provided as a singleton:

```javascript
shared: {
  '@myorg/shared-state': { singleton: true, strictVersion: true },
}
```

**Custom events**, which are decoupled but untyped:

```typescript
window.dispatchEvent(new CustomEvent('cart:updated', { detail: { count: 3 } }));
```

**The URL**, which is the most robust option. Route parameters and query parameters are shared state with no coupling at all, and they survive a full page load.

Prefer the last. Every piece of shared runtime state is a coupling that undermines the independence you adopted micro frontends to get.

## What it costs

Be clear about this before committing.

**Versioning.** Every remote must use a compatible Angular version. Upgrading Angular becomes a coordinated effort across every team, which is precisely the coordination you were avoiding.

**Bundle size.** Shared dependencies help, but each remote still ships its own code, and duplication creeps in.

**Debugging.** A stack trace spanning three independently built applications is unpleasant. Source maps across origins need care.

**Testing.** Integration testing means running every remote. End to end tests need the whole set deployed.

**Runtime failures.** A remote being unavailable is a new failure mode. Every load needs error handling:

```typescript
{
  path: 'orders',
  loadChildren: () =>
    loadRemoteModule({ ... })
      .then(m => m.ORDER_ROUTES)
      .catch(() => import('./fallback.routes').then(m => m.routes)),
}
```

**Styling.** Global styles from one remote leaking into another, or conflicting design token versions.

## The alternatives

Before committing, consider these honestly.

**A monorepo with enforced boundaries.** Nx with module boundary rules gives you architectural separation and independent development. You give up independent deployment, which many teams do not actually need.

**Separate applications with shared libraries.** Genuinely separate applications, linked by navigation rather than composed at runtime. Simpler, and often enough when sections are not deeply interleaved.

**Server side composition.** Assembling pages from fragments at the edge. More mature in some stacks than client side federation.

**Web components.** Angular Elements lets you publish a component that any application can use, without a federation runtime. Good for a widget embedded in several places.

## When it is genuinely right

```text
several teams that must deploy independently
sections with different release cadences
gradually migrating from a legacy application
different technology choices per section
an organisation where coordinating releases is the actual bottleneck
```

The migration case is the strongest. Wrapping a legacy application as the shell and adding new Angular remotes lets you replace it incrementally without a rewrite.

## Quick recap

- Module Federation loads code from independently deployed applications at runtime.
- It is an organisational solution, so adopt it for deployment independence, not code size.
- Angular packages must be `singleton: true`, or you get two injection systems.
- Native federation is the successor and suits the current build system.
- Share state through the URL where possible, since it couples nothing.
- Angular upgrades become a cross team coordination problem.
- Consider a monorepo with enforced boundaries first, which is far cheaper.

<code id="code-content" class="language-typescript">
import { Routes } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/module-federation';
// START WITH THE CAVEAT: this is an ORGANISATIONAL solution to an
// organisational problem. It only pays off when separate teams genuinely
// cannot coordinate releases. If one team owns the app, a monorepo with
// lazy routes gives most of the modularity at none of the cost.
// A HOST loads code from REMOTES at runtime, over HTTP. Neither knows
// about the other at build time.
export const routes: Routes = [
  { path: '', component: Home },
  {
    path: 'orders',
    loadChildren: () =&gt; loadRemoteModule({
      type: 'module',
      remoteEntry: 'https://orders.example.com/remoteEntry.js',
      exposedModule: './Routes',
    })
      .then(m =&gt; m.ORDER_ROUTES)
      // A remote being unavailable is a NEW failure mode. Every load
      // needs handling, or a deploy elsewhere breaks your app.
      .catch(() =&gt; import('./fallback.routes').then(m =&gt; m.routes)),
  },
];
// webpack.config.js for a remote
//   module.exports = {
//     name: 'orders',
//     exposes: { './Routes': './src/app/orders.routes.ts' },
//     shared: {
//       // singleton: true on Angular is NOT OPTIONAL. Two copies of
//       // @angular/core means two dependency injection systems, two
//       // routers, and symptoms that make no sense: services existing
//       // twice, guards never firing, inexplicable injection errors.
//       '@angular/core':   { singleton: true, strictVersion: true, requiredVersion: 'auto' },
//       '@angular/common': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
//       '@angular/router': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
//       rxjs:              { singleton: true, strictVersion: true, requiredVersion: 'auto' },
//     },
//   };
// Put remote URLs in CONFIGURATION so environments differ without a rebuild
// provideAppInitializer(async () =&gt; {
//   setRemoteDefinitions(await fetch('/assets/remotes.json').then(r =&gt; r.json()));
// });
// Native federation is the successor, built on import maps and esbuild
// rather than webpack. The better choice for new work.
//   ng add @angular-architects/native-federation
// SHARING STATE, best option last:
//   a shared library marked singleton      typed, but tightly coupled
//   window.dispatchEvent(new CustomEvent)  decoupled, but untyped
//   THE URL                                couples nothing, survives reload
// Every piece of shared runtime state undermines the independence you
// adopted this for. Prefer route and query parameters.
// THE COSTS: every remote needs a compatible Angular version, so upgrades
// become cross team coordination. Debugging spans several builds. End to
// end tests need every remote deployed. Global styles can leak.
// CONSIDER FIRST: a monorepo with Nx boundary rules, separate apps linked
// by navigation, or Angular Elements for an embeddable widget.
// The strongest genuine case is INCREMENTAL MIGRATION: wrap a legacy app
// as the shell and replace it a section at a time.
</code></pre>
