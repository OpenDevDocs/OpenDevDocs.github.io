---
publishDate: 2026-06-23T12:05
title: Server-Side Rendering with Angular SSR
slug: server-side-rendering
metadescription: Render Angular on the server for faster first paint and working SEO, and write code that survives having no browser.
updateDate: 2026-09-07T12:05
author: ['bishal-biswas']
level: 3
tags: ['ssr', 'rendering', 'seo']
course: angular
---

## What SSR does

Without server-side rendering, the browser downloads an almost empty HTML file, then JavaScript, then makes requests, then finally renders. The user sees nothing for a while, and a crawler that does not run JavaScript sees nothing at all.

With SSR, the server renders the page to HTML and sends that. The user sees content immediately, and the JavaScript takes over afterwards.

```bash
ng add @angular/ssr
```

That adds the server entry point, the build target and the providers. Existing projects can add it at any time.

## What it changes

```text
src/
├── main.ts              the browser entry point
├── main.server.ts       the server entry point
├── server.ts            an Express server
└── app/
    ├── app.config.ts
    └── app.config.server.ts
```

```typescript
// app.config.server.ts
import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/ssr';
import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering()],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
```

`mergeApplicationConfig` combines the browser providers with the server ones, so shared setup is written once.

```bash
ng build
node dist/my-app/server/server.mjs
```

## The main rule: there is no browser

Server code runs in Node. `window`, `document`, `localStorage` and `navigator` do not exist. Touching one crashes the render.

```typescript
// crashes on the server
export class Layout {
  protected readonly width = signal(window.innerWidth);
}
```

Three safe approaches, best first.

**`afterNextRender`**, which never runs on the server:

```typescript
export class Layout {
  protected readonly width = signal(0);

  constructor() {
    afterNextRender(() => {
      this.width.set(window.innerWidth);
    });
  }
}
```

**`inject(DOCUMENT)`** rather than the global, because Angular provides a server safe implementation:

```typescript
private readonly document = inject(DOCUMENT);

setTitle(title: string): void {
  this.document.title = title;
}
```

**A platform check**, which is the older approach and still common:

```typescript
private readonly platformId = inject(PLATFORM_ID);

load(): void {
  if (isPlatformBrowser(this.platformId)) {
    const stored = localStorage.getItem('theme');
  }
}
```

Prefer `afterNextRender`. It removes the check entirely, and the intent is clearer.

## Wrapping browser only APIs

```typescript
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly memory = new Map<string, string>();

  get(key: string): string | null {
    return isPlatformBrowser(this.platformId)
      ? localStorage.getItem(key)
      : this.memory.get(key) ?? null;
  }

  set(key: string, value: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(key, value);
    } else {
      this.memory.set(key, value);
    }
  }
}
```

One check in one place, rather than scattered through every component.

## Data fetching and transfer state

By default, the server fetches the data to render, then the browser fetches it **again** on startup. Wasteful and visibly flickery.

`provideClientHydration(withHttpTransferCacheOptions())` fixes it by embedding the responses in the HTML.

```typescript
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';

providers: [
  provideClientHydration(
    withHttpTransferCacheOptions({
      includePostRequests: false,
      filter: request => !request.url.includes('/api/private'),
    }),
  ),
]
```

Now a GET made during server rendering is serialised into the page, and the browser reuses it instead of making the request again.

The `filter` matters. Anything user specific or sensitive should not be embedded in HTML that might be cached by a CDN.

`httpResource` and `HttpClient` both participate automatically. `fetch` called directly does not.

## Rendering modes

Angular can decide per route whether to prerender, render on demand, or leave it to the client.

```typescript
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'blog/:slug', renderMode: RenderMode.Prerender, getPrerenderParams },
  { path: 'search', renderMode: RenderMode.Server },
  { path: 'dashboard/**', renderMode: RenderMode.Client },
];
```

```text
Prerender  built once at build time, served as a static file
Server     rendered per request
Client     not rendered on the server at all
```

Use `Prerender` for marketing and content pages, `Server` for anything personalised that still needs SEO, and `Client` for authenticated areas where SSR buys nothing.

## Setting metadata

Page titles and meta tags must be set during rendering, or crawlers never see them.

```typescript
export class ProductPage {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  readonly product = input.required<Product>();

  constructor() {
    effect(() => {
      const product = this.product();

      this.title.setTitle(`${product.name} | My Shop`);

      this.meta.updateTag({ name: 'description', content: product.summary });
      this.meta.updateTag({ property: 'og:title', content: product.name });
      this.meta.updateTag({ property: 'og:image', content: product.imageUrl });
    });
  }
}
```

Route `title` handles the simple case:

```typescript
{ path: 'about', component: About, title: 'About us' }
```

## What breaks

**`setTimeout` and `setInterval`** keep the server render waiting. Long timers block the response.

**Infinite loops or never completing observables** hang the render. A stream that never emits blocks it forever.

**Third party libraries touching `window`** at import time crash the server. Import them inside `afterNextRender`, or lazily.

```typescript
afterNextRender(async () => {
  const { default: Chart } = await import('chart.js/auto');
  new Chart(this.canvas().nativeElement, config);
});
```

**Animations** need `provideAnimationsAsync()` rather than the synchronous version.

## Is it worth it?

**Yes for:** public content, marketing sites, blogs, product pages, anything needing SEO or fast first paint on slow connections.

**No for:** internal tools, dashboards behind a login, anything where every user is authenticated. SSR adds a server to run and maintain, and buys nothing when there is no crawler and the audience has good connections.

The cost is real. You now have Node in production, a second execution environment where code can break, and more complex deployment.

## Quick recap

- SSR sends rendered HTML, so content appears immediately and crawlers see it.
- `ng add @angular/ssr` sets it all up, including on an existing project.
- There is no `window` or `document` on the server, so use `afterNextRender`.
- `inject(DOCUMENT)` is the server safe way to touch the document.
- Transfer state stops the browser refetching what the server already fetched.
- Filter user specific data out of the transfer cache.
- Choose a render mode per route: prerender, server, or client only.

<code id="code-content" class="language-typescript">
import { Component, Injectable, inject, signal, effect, input,
         PLATFORM_ID, DOCUMENT, afterNextRender, mergeApplicationConfig } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Title, Meta, provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { provideServerRendering, RenderMode, ServerRoute } from '@angular/ssr';
// THE MAIN RULE: server code runs in Node. There is no window, document,
// localStorage or navigator. Touching one CRASHES the render.
@Component({ selector: 'app-layout', template: `` })
export class Layout {
  protected readonly width = signal(0);
  private readonly document = inject(DOCUMENT);   // server safe, unlike the global
  constructor() {
    // afterNextRender NEVER runs on the server, so no platform check is needed
    afterNextRender(() =&gt; this.width.set(window.innerWidth));
    // Import browser only libraries lazily, INSIDE the callback
    afterNextRender(async () =&gt; {
      const { default: Chart } = await import('chart.js/auto');
    });
  }
}
// Wrap browser only APIs once, rather than checking in every component
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly memory = new Map&lt;string, string&gt;();
  get(key: string): string | null {
    return isPlatformBrowser(this.platformId)
      ? localStorage.getItem(key) : this.memory.get(key) ?? null;
  }
}
// Transfer state: without it the server fetches the data, then the browser
// fetches it AGAIN. Filter out anything user specific or sensitive, because
// it is embedded in HTML a CDN might cache.
export const appConfig = {
  providers: [
    provideClientHydration(withHttpTransferCacheOptions({
      includePostRequests: false,
      filter: request =&gt; !request.url.includes('/api/private'),
    })),
  ],
};
// app.config.server.ts merges the server providers into the browser ones
export const config = mergeApplicationConfig(appConfig, {
  providers: [provideServerRendering()],
});
// Render mode PER ROUTE
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },        // static at build time
  { path: 'search', renderMode: RenderMode.Server },     // per request
  { path: 'dashboard/**', renderMode: RenderMode.Client },// not rendered at all
];
// Metadata must be set DURING rendering or crawlers never see it
@Component({ selector: 'app-product', template: `` })
export class ProductPage {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  readonly product = input.required&lt;{ name: string; summary: string }&gt;();
  constructor() {
    effect(() =&gt; {
      this.title.setTitle(`${this.product().name} | My Shop`);
      this.meta.updateTag({ name: 'description', content: this.product().summary });
      this.meta.updateTag({ property: 'og:title', content: this.product().name });
    });
  }
}
// WHAT HANGS THE RENDER: long setTimeout, never completing observables,
// and third party libraries touching window at import time.
// Worth it for public content and SEO. Not worth it for internal tools
// behind a login, where it adds a Node server for no benefit.
</code></pre>
