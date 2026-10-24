---
publishDate: 2026-06-22T11:55
title: Image Optimisation with NgOptimizedImage
slug: ngoptimizedimage
metadescription: Use NgOptimizedImage to load images properly, prevent layout shift and improve Largest Contentful Paint.
updateDate: 2026-09-07T11:55
author: ['bishal-biswas']
level: 3
tags: ['performance', 'images', 'web vitals']
course: angular
---

## Why images need help

Images are usually the largest thing a page downloads, and the biggest cause of two Core Web Vitals problems: a slow Largest Contentful Paint and a poor Cumulative Layout Shift.

`NgOptimizedImage` applies the right attributes and warns when you get it wrong.

```typescript
import { NgOptimizedImage } from '@angular/common';

@Component({
  imports: [NgOptimizedImage],
  template: `<img ngSrc="/assets/hero.jpg" width="1200" height="600" alt="A hero image">`,
})
export class Hero {}
```

`ngSrc` instead of `src`. Everything else follows from that.

## Width and height are required

```html
<img ngSrc="/assets/photo.jpg" width="800" height="600" alt="A photo">
```

They are the **intrinsic** dimensions of the file, not the display size. The browser uses the ratio to reserve space before the image downloads, which is what prevents the page from jumping.

Style the display size in CSS:

```css
img {
  width: 100%;
  height: auto;
}
```

Omitting them is an error, deliberately. That single requirement fixes most layout shift problems.

For an image whose size is unknown or fluid, use `fill`:

```html
<div class="container" style="position: relative">
  <img ngSrc="/assets/banner.jpg" fill alt="A banner">
</div>
```

The parent must have `position: relative`, and you must set `object-fit` yourself.

## priority

The single most valuable attribute. Mark the image that is the Largest Contentful Paint element.

```html
<img ngSrc="/assets/hero.jpg" width="1200" height="600" alt="Hero" priority>
```

It sets `fetchpriority="high"`, removes lazy loading and adds a preload link in the document head, so the browser starts downloading it immediately rather than after parsing the page.

Use it on **one** image per page, the one visible at the top. Marking several defeats the point, because everything competing for priority means nothing has it.

Angular warns in development if your LCP image is not marked `priority`, which is a genuinely useful nudge.

## Lazy loading

Every image without `priority` is lazily loaded automatically. There is nothing to configure.

```html
<img ngSrc="/assets/hero.jpg" width="1200" height="600" alt="Hero" priority>
<img ngSrc="/assets/photo1.jpg" width="400" height="300" alt="Photo 1">
<img ngSrc="/assets/photo2.jpg" width="400" height="300" alt="Photo 2">
```

The hero loads immediately, the rest load as they approach the viewport.

## Responsive images

```html
<img
  ngSrc="/assets/photo.jpg"
  width="1200"
  height="800"
  sizes="(max-width: 768px) 100vw, 50vw"
  alt="A photo">
```

With `sizes`, Angular generates a `srcset` so the browser downloads an appropriately sized file rather than a 1200 pixel image for a 400 pixel slot.

`sizes="100vw"` is the shorthand for full width images.

Override the breakpoints if the defaults do not suit your layout:

```typescript
providers: [
  {
    provide: IMAGE_CONFIG,
    useValue: { breakpoints: [320, 640, 960, 1280, 1920] },
  },
]
```

## Image loaders

A loader rewrites the URL to use a CDN's resizing parameters.

```typescript
import { provideCloudinaryLoader, provideImgixLoader, provideCloudflareLoader }
  from '@angular/common';

providers: [
  provideCloudinaryLoader('https://res.cloudinary.com/my-account'),
]
```

```html
<img ngSrc="hero.jpg" width="1200" height="600" alt="Hero" sizes="100vw">
```

The loader turns that into `https://res.cloudinary.com/my-account/image/upload/w_640/hero.jpg` and similar for each breakpoint, so the CDN does the resizing.

Built in loaders exist for Cloudinary, Imgix, ImageKit, Cloudflare and Netlify.

A custom one is a function:

```typescript
providers: [
  {
    provide: IMAGE_LOADER,
    useValue: (config: ImageLoaderConfig) => {
      const width = config.width ? `?w=${config.width}` : '';
      return `https://cdn.example.com/${config.src}${width}`;
    },
  },
]
```

Without a loader, `NgOptimizedImage` still handles priority, lazy loading and layout shift. It just cannot generate different sizes.

## Placeholders

```html
<img
  ngSrc="/assets/photo.jpg"
  width="800"
  height="600"
  placeholder
  alt="A photo">
```

Shows a blurred low resolution version while the full image loads. Needs a loader that can produce the small version.

Supply your own with a data URI:

```html
<img ngSrc="..." [placeholder]="'data:image/png;base64,...'" width="800" height="600" alt="">
```

## Background images

`NgOptimizedImage` only works on `<img>`. For a CSS background that matters for LCP, preload it manually:

```html
<link rel="preload" as="image" href="/assets/hero-background.jpg">
```

Often the better answer is to use a real `<img>` with `fill` and position it behind the content, which then gets all the optimisation.

## The warnings

In development, Angular logs warnings for common mistakes:

```text
The requested image is larger than its displayed size
No priority on the LCP element
The image was lazily loaded but is above the fold
width and height do not match the intrinsic ratio
```

These are worth reading rather than silencing. The oversized image warning in particular catches a very common waste: shipping a 3000 pixel photo into a 400 pixel slot.

## Common mistakes

**Using display size for width and height.** They must be the file's intrinsic size, or `srcset` selection and the aspect ratio go wrong.

**Marking several images `priority`.** Only one image per page should have it.

**Forgetting `alt`.** Angular does not enforce it, but an empty `alt=""` for decorative images and a real description otherwise is not optional for accessibility.

**Using `fill` without `position: relative` on the parent.** The image escapes its container.

**Keeping `src` alongside `ngSrc`.** Use one, and it should be `ngSrc`.

## Quick recap

- Use `ngSrc` with `NgOptimizedImage` imported.
- `width` and `height` are the file's intrinsic dimensions, and they prevent layout shift.
- Mark exactly one image `priority`, the one that is the LCP element.
- Everything else is lazily loaded automatically.
- Add `sizes` to generate a `srcset` and avoid oversized downloads.
- An image loader lets a CDN do the resizing.
- Read the development warnings rather than silencing them.

<code id="code-content" class="language-typescript">
import { Component } from '@angular/core';
import { NgOptimizedImage, IMAGE_CONFIG, IMAGE_LOADER, ImageLoaderConfig,
         provideCloudinaryLoader } from '@angular/common';
@Component({
  selector: 'app-gallery',
  imports: [NgOptimizedImage],
  template: `
    &lt;!-- width and height are the file's INTRINSIC size, not the display size.
         The browser uses the ratio to reserve space, preventing layout shift.
         They are REQUIRED, deliberately. --&gt;
    &lt;!-- priority: exactly ONE per page, the LCP element. It sets
         fetchpriority=high, disables lazy loading and adds a preload link. --&gt;
    &lt;img ngSrc="/assets/hero.jpg" width="1200" height="600"
         alt="A hero image" priority sizes="100vw"&gt;
    &lt;!-- everything else is lazily loaded automatically, nothing to configure --&gt;
    &lt;img ngSrc="/assets/photo1.jpg" width="400" height="300" alt="Photo one"&gt;
    &lt;!-- sizes generates a srcset so the browser picks an appropriate file --&gt;
    &lt;img ngSrc="/assets/wide.jpg" width="1200" height="800"
         sizes="(max-width: 768px) 100vw, 50vw" alt="A wide photo"&gt;
    &lt;!-- blurred low resolution version while the full image loads --&gt;
    &lt;img ngSrc="/assets/slow.jpg" width="800" height="600" placeholder alt=""&gt;
    &lt;!-- fill for unknown dimensions. The PARENT needs position: relative. --&gt;
    &lt;div style="position: relative; height: 300px"&gt;
      &lt;img ngSrc="/assets/banner.jpg" fill alt="A banner"
           style="object-fit: cover"&gt;
    &lt;/div&gt;
  `,
  styles: `img { width: 100%; height: auto; }`,   // style the DISPLAY size in CSS
})
export class Gallery {}
export const appConfig = {
  providers: [
    // A loader lets a CDN do the resizing. Built in: Cloudinary, Imgix,
    // ImageKit, Cloudflare, Netlify.
    provideCloudinaryLoader('https://res.cloudinary.com/my-account'),
    // Or write your own
    {
      provide: IMAGE_LOADER,
      useValue: (config: ImageLoaderConfig) =&gt;
        `https://cdn.example.com/${config.src}${config.width ? `?w=${config.width}` : ''}`,
    },
    { provide: IMAGE_CONFIG, useValue: { breakpoints: [320, 640, 960, 1280, 1920] } },
  ],
};
// Development warnings worth READING rather than silencing:
//   "the requested image is larger than its displayed size"  a 3000px file
//     in a 400px slot is pure waste
//   "no priority on the LCP element"
//   "width and height do not match the intrinsic ratio"
// NgOptimizedImage only works on &lt;img&gt;. For a CSS background that matters
// for LCP, either preload it by hand or use a real &lt;img&gt; with fill.
//   &lt;link rel="preload" as="image" href="/assets/hero-background.jpg"&gt;
</code></pre>
