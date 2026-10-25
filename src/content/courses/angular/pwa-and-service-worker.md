---
publishDate: 2026-06-27T13:05
title: Progressive Web Apps and the Service Worker
slug: pwa-and-service-worker
metadescription: Turn an Angular application into an installable progressive web app with offline support and update handling.
updateDate: 2026-09-07T13:05
author: ['bishal-biswas']
level: 3
tags: ['pwa', 'service worker', 'offline']
course: angular
---

## What you get

```bash
ng add @angular/pwa
```

That one command adds a service worker, a web app manifest, icons and the registration code. The application becomes installable and works offline.

What it changes:

```text
ngsw-config.json          what to cache
src/manifest.webmanifest  name, icons, theme colour
public/icons/             generated icons
index.html                links to the manifest
app.config.ts             provideServiceWorker()
```

## Registration

```typescript
import { provideServiceWorker } from '@angular/service-worker';
import { isDevMode } from '@angular/core';

providers: [
  provideServiceWorker('ngsw-worker.js', {
    enabled: !isDevMode(),
    registrationStrategy: 'registerWhenStable:30000',
  }),
]
```

`registerWhenStable:30000` waits for the application to be stable, or 30 seconds, before registering. Registering immediately competes with your initial page load for bandwidth.

Service workers **only work over HTTPS**, or on `localhost`. A staging site on plain HTTP will not run one.

## Caching configuration

```json
{
  "index": "/index.html",
  "assetGroups": [
    {
      "name": "app",
      "installMode": "prefetch",
      "resources": {
        "files": [
          "/favicon.ico",
          "/index.html",
          "/manifest.webmanifest",
          "/*.css",
          "/*.js"
        ]
      }
    },
    {
      "name": "assets",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": {
        "files": ["/media/**", "/icons/**"],
        "urls": ["https://fonts.googleapis.com/**"]
      }
    }
  ]
}
```

**`prefetch`** downloads everything during installation, so the application works offline immediately.

**`lazy`** caches a file the first time it is requested.

The application shell should be `prefetch`. Images and fonts are usually `lazy` with `updateMode: "prefetch"`, meaning they are fetched eagerly on an update but lazily on first install.

## Caching API responses

```json
{
  "dataGroups": [
    {
      "name": "api-fresh",
      "urls": ["/api/orders/**", "/api/cart/**"],
      "cacheConfig": {
        "strategy": "freshness",
        "maxSize": 50,
        "maxAge": "1h",
        "timeout": "5s"
      }
    },
    {
      "name": "api-stable",
      "urls": ["/api/products/**", "/api/categories/**"],
      "cacheConfig": {
        "strategy": "performance",
        "maxSize": 200,
        "maxAge": "1d"
      }
    }
  ]
}
```

**`freshness`** tries the network first and falls back to the cache after `timeout`. Use it for data that must be current.

**`performance`** serves the cache first and only hits the network when there is nothing cached or it has expired. Use it for data that changes rarely.

Getting this the wrong way round is the most common service worker problem. A cart cached with `performance` shows stale contents, and a product catalogue with `freshness` is slower than it needs to be.

**Only GET requests are cached.** POST, PUT and DELETE always go to the network.

## Handling updates

This is the part that goes wrong most often. A service worker serves the cached version, so a user can run an old build for days without knowing.

```typescript
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';

@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly updates = inject(SwUpdate);

  readonly updateAvailable = signal(false);

  constructor() {
    if (!this.updates.isEnabled) return;

    this.updates.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.updateAvailable.set(true));

    // check periodically for long lived sessions
    const id = setInterval(() => this.updates.checkForUpdate(), 6 * 60 * 60 * 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  async applyUpdate(): Promise<void> {
    await this.updates.activateUpdate();
    document.location.reload();
  }
}
```

```html
@if (updates.updateAvailable()) {
  <div class="update-banner">
    A new version is available.
    <button (click)="updates.applyUpdate()">Reload</button>
  </div>
}
```

Prompting is better than reloading automatically. Reloading under someone filling in a form loses their work.

The periodic check matters for applications people leave open all day. Without it, they only get an update when they close every tab.

## Handling a broken state

```typescript
this.updates.unrecoverable.subscribe(event => {
  console.error('The application is in a broken state', event.reason);

  document.location.reload();
});
```

This fires when the cache is corrupted or files are missing, usually because a deployment removed hashed files a cached version still references. A reload is the only fix.

Deployments that keep the previous build's files around for a while avoid causing this.

## The manifest

```json
{
  "name": "My Shop",
  "short_name": "Shop",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#dd0031",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    {
      "src": "icons/icon-512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

`display: standalone` removes the browser chrome when installed. The maskable icon matters on Android, where the system crops icons to a shape, and a non maskable icon gets its edges cut off.

## Detecting offline

```typescript
@Injectable({ providedIn: 'root' })
export class ConnectionService {
  readonly online = signal(true);

  constructor() {
    afterNextRender(() => {
      this.online.set(navigator.onLine);

      const on = () => this.online.set(true);
      const off = () => this.online.set(false);

      window.addEventListener('online', on);
      window.addEventListener('offline', off);

      inject(DestroyRef).onDestroy(() => {
        window.removeEventListener('online', on);
        window.removeEventListener('offline', off);
      });
    });
  }
}
```

`navigator.onLine` only knows whether there is a network interface. It says nothing about whether your API is reachable, so treat it as a hint.

## Testing

```bash
ng build
npx http-server dist/my-app/browser -p 8080
```

`ng serve` does **not** run the service worker. It must be a production build served over HTTP.

In Chrome DevTools, the Application panel shows the registered worker, the caches and an offline toggle. The "Update on reload" checkbox is essential while developing, or you will be testing a stale version and not realise.

## When not to build a PWA

**An internal tool** used only on a corporate network with reliable connectivity gains little and adds caching problems.

**A frequently changing application** where users must always have the latest version. The update flow becomes a permanent source of support requests.

**Anything with strict data freshness requirements**, such as trading or live inventory, where serving anything cached is wrong.

A service worker is a caching layer between your users and your deployments. That is powerful and occasionally painful, so add it deliberately.

## Quick recap

- `ng add @angular/pwa` sets up the service worker, manifest and icons.
- Service workers need HTTPS or localhost.
- `prefetch` the application shell and `lazy` the media.
- `freshness` for data that must be current, `performance` for data that rarely changes.
- Prompt before applying an update, and check periodically for long sessions.
- Handle `unrecoverable` by reloading, since the cache is broken.
- `ng serve` does not run the service worker, so test a production build.

<code id="code-content" class="language-typescript">
import { Injectable, inject, signal, isDevMode, DestroyRef, afterNextRender } from '@angular/core';
import { provideServiceWorker, SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
// ng add @angular/pwa  adds all of this. Service workers need HTTPS
// or localhost: a staging site on plain HTTP will not run one.
export const appConfig = {
  providers: [
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Registering immediately competes with the initial page load
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
// THE PART THAT GOES WRONG MOST: a service worker serves the cached
// version, so a user can run an old build for days without knowing.
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly updates = inject(SwUpdate);
  readonly updateAvailable = signal(false);
  constructor() {
    if (!this.updates.isEnabled) return;
    this.updates.versionUpdates.pipe(
      filter((e): e is VersionReadyEvent =&gt; e.type === 'VERSION_READY'),
      takeUntilDestroyed(),
    ).subscribe(() =&gt; this.updateAvailable.set(true));
    // For sessions people leave open all day. Without this they only get
    // an update after closing every tab.
    const id = setInterval(() =&gt; this.updates.checkForUpdate(), 6 * 60 * 60 * 1000);
    inject(DestroyRef).onDestroy(() =&gt; clearInterval(id));
    // The cache is broken, usually because a deploy removed hashed files
    // a cached version still references. A reload is the only fix.
    this.updates.unrecoverable.subscribe(() =&gt; document.location.reload());
  }
  // PROMPT, do not reload automatically. Reloading under someone filling
  // in a form loses their work.
  async applyUpdate(): Promise&lt;void&gt; {
    await this.updates.activateUpdate();
    document.location.reload();
  }
}
// ngsw-config.json
//   assetGroups:
//     the app shell   installMode: "prefetch"   works offline immediately
//     media and fonts installMode: "lazy", updateMode: "prefetch"
//   dataGroups: getting these the WRONG WAY ROUND is the common bug
//     "freshness"   network first, falls back to cache after `timeout`
//                   -&gt; cart, orders, anything that must be current
//     "performance" cache first, network only when missing or expired
//                   -&gt; product catalogue, categories, rarely changing data
//   Only GET is cached. POST, PUT and DELETE always hit the network.
// Manifest: display "standalone" removes browser chrome when installed,
// and a "maskable" icon stops Android cropping the edges off.
// TESTING: ng serve does NOT run the service worker. Build and serve:
//   ng build &amp;&amp; npx http-server dist/my-app/browser -p 8080
// In DevTools -&gt; Application, tick "Update on reload" or you will be
// testing a stale version without realising.
</code></pre>
