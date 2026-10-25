---
publishDate: 2026-06-24T12:20
title: Prerendering and Static Site Generation
slug: prerendering-and-ssg
metadescription: Build pages to static HTML at build time for the fastest possible delivery, including dynamic routes from your data.
updateDate: 2026-09-07T12:20
author: ['bishal-biswas']
level: 3
tags: ['ssg', 'prerendering', 'static']
course: angular
---

## Rendering once instead of per request

Server-side rendering builds the HTML on every request. **Prerendering** builds it once at build time and writes files to disk.

```text
Client rendered   empty HTML, then JavaScript renders
Server rendered   HTML built per request, needs a running server
Prerendered       HTML built once, served as a static file
```

Prerendered pages are the fastest possible option. There is no server work at all, so a CDN can serve them from an edge location in a few milliseconds.

The catch is obvious: the content is fixed until the next build.

## Setting it up

```bash
ng add @angular/ssr
```

Prerendering is part of the SSR package. Configure per route which mode to use.

```typescript
// app.routes.server.ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'pricing', renderMode: RenderMode.Prerender },
  { path: 'search', renderMode: RenderMode.Server },
  { path: 'account/**', renderMode: RenderMode.Client },
];
```

```typescript
// app.config.server.ts
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
  ],
};
```

```bash
ng build
```

The build writes an HTML file per prerendered route.

## Prerendering dynamic routes

A route with a parameter needs to know which values to build.

```typescript
import { RenderMode, ServerRoute, PrerenderFallback } from '@angular/ssr';
import { inject } from '@angular/core';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      const posts = await inject(BlogService).getAllSlugs();
      return posts.map(slug => ({ slug }));
    },
  },
];
```

`getPrerenderParams` returns an array of parameter objects, one per page to build. It runs in an injection context, so `inject()` works and you can call a service or read the filesystem.

For several parameters:

```typescript
{
  path: 'shop/:category/:product',
  renderMode: RenderMode.Prerender,
  async getPrerenderParams() {
    const products = await inject(ShopService).getAll();
    return products.map(p => ({ category: p.category, product: p.slug }));
  },
}
```

## Handling routes not prerendered

For a catalogue of a hundred thousand products, prerendering everything takes hours. Prerender the popular ones and fall back for the rest.

```typescript
{
  path: 'products/:id',
  renderMode: RenderMode.Prerender,
  fallback: PrerenderFallback.Server,
  async getPrerenderParams() {
    const popular = await inject(ProductService).getTopProducts(1000);
    return popular.map(p => ({ id: p.id }));
  },
}
```

```text
PrerenderFallback.Server   render on demand for anything not prebuilt
PrerenderFallback.Client   send the shell and let the browser render
PrerenderFallback.None     return a 404
```

`Server` is usually right. The common pages are instant, and the long tail still works.

## Data at build time

Prerendering runs your application in Node during the build, so any HTTP calls hit real endpoints at that moment.

```typescript
export class BlogPost {
  readonly slug = input.required<string>();

  protected readonly post = httpResource<Post>(() => `/api/posts/${this.slug()}`);
}
```

That API must be reachable **from the build machine**. In continuous integration it often is not, or it needs credentials that are not present.

Reading from the filesystem avoids the problem entirely and is faster:

```typescript
@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly platformId = inject(PLATFORM_ID);

  async getPost(slug: string): Promise<Post> {
    if (isPlatformServer(this.platformId)) {
      const { readFile } = await import('node:fs/promises');
      const raw = await readFile(`./content/${slug}.json`, 'utf-8');
      return JSON.parse(raw);
    }

    return firstValueFrom(this.http.get<Post>(`/api/posts/${slug}`));
  }
}
```

Content in the repository is the simplest approach for a blog or documentation site.

## Choosing a mode per route

```typescript
export const serverRoutes: ServerRoute[] = [
  // marketing pages: content changes rarely, SEO matters
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'blog/:slug', renderMode: RenderMode.Prerender, getPrerenderParams },

  // personalised but needs SEO
  { path: 'products/:id', renderMode: RenderMode.Server },

  // behind a login, SSR buys nothing
  { path: 'dashboard/**', renderMode: RenderMode.Client },
  { path: 'settings/**', renderMode: RenderMode.Client },
];
```

Marking authenticated routes `Client` is worth doing deliberately. Server rendering a dashboard wastes server time on a page only one person will ever see, and risks leaking one user's data into a cached response.

## Deploying

Prerendered output is static files, so it deploys anywhere.

```text
dist/my-app/browser/
├── index.html
├── about/index.html
├── blog/first-post/index.html
└── ...
```

With no `Server` routes, you need no Node process at all. Upload the folder to any static host or CDN.

With `Server` routes, you need the Node server for those paths, and the static files are still served directly.

## Keeping content fresh

The weakness of prerendering: content is fixed until the next build.

**Rebuild on a schedule.** A nightly build suits documentation and marketing pages.

**Rebuild on a webhook.** Publishing in a content management system triggers a build. This is how most static sites work.

**Use `Server` mode** for anything that changes hourly.

**Fetch on the client** for small dynamic pieces inside an otherwise static page, such as a live stock count.

```html
<h1>{{ product().name }}</h1>       <!-- prerendered -->

@defer (on viewport) {
  <app-live-stock [productId]="product().id" />   <!-- fetched in the browser -->
}
```

## Build time

Prerendering a thousand pages takes real time, since each renders your application.

```bash
ng build --verbose
```

If the build becomes slow, prerender fewer pages and use the `Server` fallback for the rest. There is rarely value in prebuilding a page nobody visits.

## Quick recap

- Prerendering builds HTML at build time, giving the fastest possible delivery.
- Set `renderMode` per route: `Prerender`, `Server` or `Client`.
- `getPrerenderParams` supplies the parameter values for dynamic routes.
- Use `PrerenderFallback.Server` so pages you did not prebuild still work.
- Build time data fetching needs the API reachable from the build machine.
- Mark authenticated routes `Client`, since server rendering them wastes work.
- Content is fixed until the next build, so rebuild on a schedule or a webhook.

<code id="code-content" class="language-typescript">
import { inject, Injectable, PLATFORM_ID, input } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { RenderMode, ServerRoute, PrerenderFallback,
         provideServerRendering, withRoutes } from '@angular/ssr';
export const serverRoutes: ServerRoute[] = [
  // Prerender: built ONCE at build time, served as a static file.
  // The fastest possible delivery, and no server needed for these.
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  // A dynamic route needs to know WHICH values to build.
  // getPrerenderParams runs in an injection context, so inject() works.
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      const slugs = await inject(BlogService).getAllSlugs();
      return slugs.map(slug =&gt; ({ slug }));
    },
  },
  // 100,000 products would take hours. Prebuild the popular ones and
  // render the long tail on demand.
  {
    path: 'products/:id',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.Server,      // or Client, or None (404)
    async getPrerenderParams() {
      const popular = await inject(ProductService).getTopProducts(1000);
      return popular.map(p =&gt; ({ id: p.id }));
    },
  },
  // Server: rendered per request. For personalised pages that need SEO.
  { path: 'search', renderMode: RenderMode.Server },
  // Client: not server rendered at all. Mark authenticated routes this way
  // deliberately: rendering a dashboard wastes server time on a page one
  // person will see, and risks leaking data into a cached response.
  { path: 'dashboard/**', renderMode: RenderMode.Client },
];
export const serverConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};
// Prerendering runs your app in Node AT BUILD TIME, so any HTTP call hits
// a real endpoint then. In CI that endpoint is often unreachable.
// Reading from the filesystem avoids the problem and is faster.
@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly platformId = inject(PLATFORM_ID);
  async getPost(slug: string): Promise&lt;Post&gt; {
    if (isPlatformServer(this.platformId)) {
      const { readFile } = await import('node:fs/promises');
      return JSON.parse(await readFile(`./content/${slug}.json`, 'utf-8'));
    }
    return firstValueFrom(this.http.get&lt;Post&gt;(`/api/posts/${slug}`));
  }
  async getAllSlugs(): Promise&lt;string[]&gt; { return []; }
}
// Output is plain static files, deployable to any CDN:
//   dist/my-app/browser/index.html
//   dist/my-app/browser/about/index.html
//   dist/my-app/browser/blog/first-post/index.html
// KEEPING IT FRESH: content is fixed until the next build.
//   rebuild nightly, rebuild on a CMS webhook, use Server mode for
//   hourly content, or fetch small dynamic pieces in the browser:
//     &lt;h1&gt;{{ product().name }}&lt;/h1&gt;                    prerendered
//     @defer (on viewport) { &lt;app-live-stock /&gt; }      fetched client side
interface Post { title: string; }
</code></pre>
