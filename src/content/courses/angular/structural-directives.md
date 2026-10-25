---
publishDate: 2026-06-11T08:55
title: Structural Directives and Custom Templates
slug: structural-directives
metadescription: Write directives that add and remove DOM, understand TemplateRef and ViewContainerRef, and add template type checking.
updateDate: 2026-09-07T08:55
author: ['bishal-biswas']
level: 2
tags: ['directives', 'structural', 'templates']
course: angular
---

## Directives that change the DOM

An attribute directive changes an element. A **structural directive** decides whether the element exists at all, and how many times.

`*ngIf` and `*ngFor` are the built in examples. You can write your own.

```typescript
import { Directive, TemplateRef, ViewContainerRef, inject, input, effect } from '@angular/core';

@Directive({
  selector: '[appIf]',
})
export class AppIf {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);

  readonly condition = input.required<boolean>({ alias: 'appIf' });

  constructor() {
    effect(() => {
      this.container.clear();

      if (this.condition()) {
        this.container.createEmbeddedView(this.template);
      }
    });
  }
}
```

```html
<p *appIf="isVisible()">Only when visible</p>
```

Two injections do everything.

**`TemplateRef`** is the markup the directive was applied to, captured rather than rendered.

**`ViewContainerRef`** is the place where views can be inserted.

## The asterisk

The `*` is shorthand. Angular expands it into an `ng-template`.

```html
<!-- what you write -->
<p *appIf="isVisible()">Hello</p>

<!-- what Angular sees -->
<ng-template [appIf]="isVisible()">
  <p>Hello</p>
</ng-template>
```

That expansion explains why `TemplateRef` is injectable: the directive is on an `ng-template`, not on the paragraph.

It also explains why two structural directives cannot share an element. Both want to be the `ng-template`.

## Passing extra values

A structural directive with several inputs uses a naming convention. Inputs are the selector name plus a suffix, and the microsyntax maps them.

```typescript
@Directive({
  selector: '[appRepeat]',
})
export class Repeat {
  private readonly template = inject(TemplateRef<RepeatContext>);
  private readonly container = inject(ViewContainerRef);

  readonly times = input.required<number>({ alias: 'appRepeat' });

  constructor() {
    effect(() => {
      this.container.clear();

      for (let i = 0; i < this.times(); i++) {
        this.container.createEmbeddedView(this.template, {
          $implicit: i,
          index: i,
          isFirst: i === 0,
        });
      }
    });
  }
}

interface RepeatContext {
  $implicit: number;
  index: number;
  isFirst: boolean;
}
```

```html
<p *appRepeat="3; let i = index; let first = isFirst">
  Row {{ i }} {{ first ? '(first)' : '' }}
</p>
```

`$implicit` binds to a bare `let x`. Named keys bind with `let x = key`.

## Template type checking

By default the context is untyped, so `let i = index` gives `any`. A static `ngTemplateContextGuard` fixes that.

```typescript
@Directive({ selector: '[appRepeat]' })
export class Repeat {
  readonly times = input.required<number>({ alias: 'appRepeat' });

  static ngTemplateContextGuard(
    directive: Repeat,
    context: unknown,
  ): context is RepeatContext {
    return true;
  }
}
```

Now `let i = index` is typed as `number`, and a typo in the key is a build error.

## Narrowing types

`*ngIf` narrows a nullable value inside the block. Your directive can too, with a second guard.

```typescript
@Directive({ selector: '[appIfPresent]' })
export class IfPresent<T> {
  readonly value = input.required<T | null | undefined>({ alias: 'appIfPresent' });

  static ngTemplateGuard_value: 'binding';

  static ngTemplateContextGuard<T>(
    directive: IfPresent<T>,
    context: unknown,
  ): context is { $implicit: T } {
    return true;
  }
}
```

The `ngTemplateGuard_value: 'binding'` declaration tells the compiler that the template only renders when the binding is truthy, so it can narrow accordingly.

This is fiddly, and it is why `@if` is better for the common case. Reserve custom structural directives for genuinely reusable behaviour.

## A useful example: permissions

```typescript
@Directive({
  selector: '[appHasRole]',
})
export class HasRole {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  readonly role = input.required<string>({ alias: 'appHasRole' });

  constructor() {
    effect(() => {
      const allowed = this.auth.roles().includes(this.role());

      this.container.clear();

      if (allowed) this.container.createEmbeddedView(this.template);
    });
  }
}
```

```html
<button *appHasRole="'admin'" (click)="deleteEverything()">Delete</button>
```

Cleaner than repeating `@if (auth.roles().includes('admin'))` everywhere, and the rule lives in one place.

This is a **display** concern only. Never rely on it for security. The button not rendering does not stop anyone calling the API.

## Reusing views instead of recreating

Clearing and recreating on every change is simple and wasteful. Track the created view and only change it when needed.

```typescript
@Directive({ selector: '[appIf]' })
export class AppIf {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private view: EmbeddedViewRef<unknown> | null = null;

  readonly condition = input.required<boolean>({ alias: 'appIf' });

  constructor() {
    effect(() => {
      const shouldShow = this.condition();

      if (shouldShow && !this.view) {
        this.view = this.container.createEmbeddedView(this.template);
      } else if (!shouldShow && this.view) {
        this.container.clear();
        this.view = null;
      }
    });
  }
}
```

Now toggling does not destroy and rebuild an unchanged view.

## Should you write one?

Usually not. `@if` and `@for` cover the common cases with better types and no imports.

Genuinely good reasons:

- A cross cutting rule used in many places, like permissions or feature flags.
- Integrating with something that needs `ViewContainerRef`, such as a virtual scroller.
- A library exposing declarative behaviour.

Bad reasons: replicating `@if` with a different name, or hiding a condition that would be clearer written out.

## Quick recap

- A structural directive controls whether and how often its element exists.
- Inject `TemplateRef` for the markup and `ViewContainerRef` for where to put it.
- The `*` expands to an `ng-template`, which is why only one is allowed per element.
- Pass context with `$implicit` and named keys, read with `let x = key`.
- Add `ngTemplateContextGuard` so the context is typed rather than `any`.
- Track the created view instead of clearing and recreating on every change.
- Prefer `@if` and `@for` unless the behaviour is genuinely reusable.

<code id="code-content" class="language-typescript">
import { Directive, TemplateRef, ViewContainerRef, EmbeddedViewRef,
         inject, input, effect } from '@angular/core';
// TemplateRef  = the markup, captured rather than rendered
// ViewContainerRef = the place views can be inserted
@Directive({ selector: '[appRepeat]' })
export class Repeat {
  private readonly template = inject(TemplateRef&lt;RepeatContext&gt;);
  private readonly container = inject(ViewContainerRef);
  readonly times = input.required&lt;number&gt;({ alias: 'appRepeat' });
  constructor() {
    effect(() =&gt; {
      this.container.clear();
      for (let i = 0; i &lt; this.times(); i++) {
        // $implicit binds to a bare `let x`, named keys to `let x = key`
        this.container.createEmbeddedView(this.template, {
          $implicit: i, index: i, isFirst: i === 0,
        });
      }
    });
  }
  // Without this the context is `any`. With it, `let i = index` is a number
  // and a typo in the key is a build error.
  static ngTemplateContextGuard(d: Repeat, ctx: unknown): ctx is RepeatContext {
    return true;
  }
}
interface RepeatContext { $implicit: number; index: number; isFirst: boolean; }
// Used as:  &lt;p *appRepeat="3; let i = index; let first = isFirst"&gt;
// The * is shorthand. Angular expands it to an ng-template, which is why
// TemplateRef is injectable and why two structural directives cannot share
// one element: both want to BE the ng-template.
//   &lt;p *appIf="x"&gt;Hi&lt;/p&gt;
//   becomes &lt;ng-template [appIf]="x"&gt;&lt;p&gt;Hi&lt;/p&gt;&lt;/ng-template&gt;
// A genuinely useful one: permissions in a single place
@Directive({ selector: '[appHasRole]' })
export class HasRole {
  private readonly template = inject(TemplateRef&lt;unknown&gt;);
  private readonly container = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);
  private view: EmbeddedViewRef&lt;unknown&gt; | null = null;
  readonly role = input.required&lt;string&gt;({ alias: 'appHasRole' });
  constructor() {
    effect(() =&gt; {
      const allowed = this.auth.roles().includes(this.role());
      // Reuse the view instead of clearing and rebuilding every change
      if (allowed &amp;&amp; !this.view) {
        this.view = this.container.createEmbeddedView(this.template);
      } else if (!allowed &amp;&amp; this.view) {
        this.container.clear();
        this.view = null;
      }
    });
  }
}
// &lt;button *appHasRole="'admin'" (click)="remove()"&gt;Delete&lt;/button&gt;
// This is a DISPLAY concern only. Not rendering the button does not stop
// anyone calling the API. Authorise on the server.
// Usually you want @if and @for: better types, no imports, no guards.
</code></pre>
