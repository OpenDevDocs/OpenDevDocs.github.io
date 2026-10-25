---
publishDate: 2026-06-25T12:35
title: Animations in Angular
slug: angular-animations
metadescription: Animate route transitions and element changes in Angular, and know when plain CSS is the better answer.
updateDate: 2026-09-07T12:35
author: ['bishal-biswas']
level: 3
tags: ['animations', 'css', 'transitions']
course: angular
---

## Start with CSS

Angular has an animation package, and most animations do not need it.

```css
.card {
  transition: transform 200ms ease, box-shadow 200ms ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

Hover states, focus rings, colour changes, loading spinners and progress bars are all better as plain CSS. They run on the compositor, need no JavaScript, and add nothing to the bundle.

Reach for Angular's animation support only when you need to animate something **entering or leaving** the DOM, which CSS alone cannot do.

## View transitions for routing

The simplest way to animate between routes, and it uses the browser's own API.

```typescript
import { provideRouter, withViewTransitions } from '@angular/router';

providers: [
  provideRouter(routes, withViewTransitions()),
]
```

That single line cross fades between routes. Customise it with CSS:

```css
::view-transition-old(root) {
  animation: fade-out 200ms ease-out;
}

::view-transition-new(root) {
  animation: fade-in 300ms ease-in;
}

@keyframes fade-out { to { opacity: 0; } }
@keyframes fade-in { from { opacity: 0; } }
```

Shared element transitions work by naming an element on both pages:

```css
.product-image {
  view-transition-name: product-hero;
}
```

The browser animates the element from its old position to its new one. That effect used to require a large library.

Browsers without support simply do not animate, and everything still works.

## The animations package

For entering and leaving elements, `@angular/animations` handles the parts CSS cannot.

```typescript
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

providers: [provideAnimationsAsync()],
```

Use the **async** version. It loads the animation engine lazily, so applications that never animate do not pay for it.

```typescript
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-notification',
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('200ms ease-out', style({ transform: 'translateX(0)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ transform: 'translateX(100%)', opacity: 0 })),
      ]),
    ]),
  ],
  template: `
    @for (message of messages(); track message.id) {
      <div class="toast" @slideIn>{{ message.text }}</div>
    }
  `,
})
export class Notifications {
  protected readonly messages = signal<Message[]>([]);
}
```

`:enter` and `:leave` are the reason this package exists. Angular keeps the element in the DOM long enough for the leave animation to finish, which plain CSS cannot arrange.

## State based animations

```typescript
animations: [
  trigger('expand', [
    state('collapsed', style({ height: '0', overflow: 'hidden' })),
    state('expanded', style({ height: '*' })),
    transition('collapsed <=> expanded', animate('200ms ease-in-out')),
  ]),
],
```

```html
<div [@expand]="isOpen() ? 'expanded' : 'collapsed'">
  <ng-content />
</div>
```

`height: '*'` is the useful part. It means the natural height, which CSS cannot transition to. Animating to `auto` does not work in plain CSS, and this is the standard workaround.

## Staggered lists

```typescript
import { query, stagger } from '@angular/animations';

animations: [
  trigger('listAnimation', [
    transition('* => *', [
      query(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        stagger(50, [
          animate('200ms ease-out', style({ opacity: 1, transform: 'none' })),
        ]),
      ], { optional: true }),
    ]),
  ]),
],
```

```html
<ul [@listAnimation]="items().length">
  @for (item of items(); track item.id) {
    <li>{{ item.name }}</li>
  }
</ul>
```

`{ optional: true }` prevents an error when nothing matches, which happens on the first render or an empty list. Omitting it is the usual cause of a confusing animation error.

## Respecting reduced motion

Some users get motion sickness from animation. Honouring their setting is not optional.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

In Angular animations:

```typescript
import { provideAnimationsAsync, provideNoopAnimations } from '@angular/platform-browser/animations/async';

providers: [
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? provideNoopAnimations()
    : provideAnimationsAsync(),
]
```

`provideNoopAnimations()` makes every animation complete instantly, so callbacks still fire and nothing breaks.

Note that reading `window` here means this cannot run on the server. Wrap it or use the CSS approach, which works everywhere.

## Performance

Only two properties animate cheaply.

```css
/* fast: handled by the compositor */
transform: translateX(100px);
transform: scale(1.1);
opacity: 0.5;

/* slow: forces layout on every frame */
width: 300px;
height: 200px;
top: 50px;
margin-left: 20px;
```

Animating `width` or `top` recalculates layout for the whole page sixty times a second. Use `transform` instead wherever the effect allows.

`height: '*'` in Angular animations is an exception worth accepting, since there is no transform based alternative for expanding content, and it usually runs once.

## Should you use the package?

Honestly, less often than you might think.

**Use CSS** for hover, focus, loading states and anything triggered by a class change.

**Use `withViewTransitions()`** for route changes.

**Use the animations package** for entering and leaving elements, and for animating to a natural height.

**Use a dedicated library** for complex sequenced animation, where something like GSAP or Motion is far more capable.

The package adds real bundle weight, which is why `provideAnimationsAsync` exists. If your application has three fade transitions, CSS is the better answer.

## Quick recap

- Most animation should be plain CSS, which is lighter and runs on the compositor.
- `withViewTransitions()` animates route changes in one line, using the browser API.
- `:enter` and `:leave` are what the animations package is genuinely for.
- `height: '*'` animates to the natural height, which CSS cannot do.
- Add `{ optional: true }` to `query` or empty lists throw.
- Always honour `prefers-reduced-motion`.
- Animate `transform` and `opacity`, not `width`, `height` or `top`.

<code id="code-content" class="language-typescript">
import { Component, signal } from '@angular/core';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withViewTransitions } from '@angular/router';
// START WITH CSS. Hover, focus, colour changes and spinners are all better
// as plain CSS: no bundle cost, and they run on the compositor.
// Route transitions in ONE line, using the browser's own View Transitions API
export const appConfig = {
  providers: [
    provideRouter([], withViewTransitions()),
    provideAnimationsAsync(),      // async: loads the engine lazily
  ],
};
@Component({
  selector: 'app-notifications',
  animations: [
    // :enter and :leave are what this package is genuinely FOR. Angular keeps
    // the element in the DOM long enough for the leave animation to finish,
    // which plain CSS cannot arrange.
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('200ms ease-out', style({ transform: 'translateX(0)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ transform: 'translateX(100%)', opacity: 0 })),
      ]),
    ]),
    // height: '*' means the NATURAL height. CSS cannot transition to auto,
    // and this is the standard workaround.
    trigger('expand', [
      state('collapsed', style({ height: '0', overflow: 'hidden' })),
      state('expanded', style({ height: '*' })),
      transition('collapsed &lt;=&gt; expanded', animate('200ms ease-in-out')),
    ]),
    trigger('listAnimation', [
      transition('* =&gt; *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(10px)' }),
          stagger(50, [animate('200ms ease-out', style({ opacity: 1, transform: 'none' }))]),
        // { optional: true } or an empty list THROWS. The usual cause of
        // a confusing animation error.
        ], { optional: true }),
      ]),
    ]),
  ],
  template: `
    @for (m of messages(); track m.id) { &lt;div class="toast" @slideIn&gt;{{ m.text }}&lt;/div&gt; }
    &lt;div [@expand]="open() ? 'expanded' : 'collapsed'"&gt;&lt;ng-content /&gt;&lt;/div&gt;
    &lt;ul [@listAnimation]="messages().length"&gt;
      @for (m of messages(); track m.id) { &lt;li&gt;{{ m.text }}&lt;/li&gt; }
    &lt;/ul&gt;
  `,
  styles: `
    /* Route transitions are styled with the browser's pseudo elements */
    ::view-transition-old(root) { animation: fade 200ms ease-out reverse; }
    ::view-transition-new(root) { animation: fade 300ms ease-in; }
    @keyframes fade { from { opacity: 0; } }
    /* Shared element: name it on both pages and the browser tweens it */
    .product-image { view-transition-name: product-hero; }
    /* NOT OPTIONAL. Some users get motion sickness from animation. */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `,
})
export class Notifications {
  protected readonly messages = signal&lt;{ id: number; text: string }[]&gt;([]);
  protected readonly open = signal(false);
}
// PERFORMANCE: only transform and opacity animate cheaply. Animating
// width, height, top or margin forces a layout recalculation on EVERY
// frame, sixty times a second.
</code></pre>
