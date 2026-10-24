---
publishDate: 2026-06-08T08:00
title: afterRenderEffect and Render Hooks
slug: after-render-effect
metadescription: Run code after Angular has updated the DOM, measure layout safely, and avoid the reflow traps of manual DOM work.
updateDate: 2026-09-07T08:00
author: ['bishal-biswas']
level: 2
tags: ['rendering', 'hooks', 'dom']
course: angular
---

## The problem with measuring in an effect

A plain `effect` runs when signals change, but not necessarily after the DOM has been updated.

```typescript
// unreliable
effect(() => {
  const height = this.panel().nativeElement.offsetHeight;
  console.log(height);        // may be the old height, or zero
});
```

`afterRenderEffect` runs **after** Angular has finished writing to the DOM, which is the only safe place to measure it.

```typescript
import { afterRenderEffect } from '@angular/core';

export class Panel {
  private readonly element = viewChild.required<ElementRef<HTMLElement>>('panel');
  protected readonly height = signal(0);

  constructor() {
    afterRenderEffect(() => {
      this.height.set(this.element().nativeElement.offsetHeight);
    });
  }
}
```

## The phases

Reading layout and then writing to the DOM in the same pass causes **layout thrashing**: the browser is forced to recalculate layout repeatedly. `afterRenderEffect` takes an object of phases that run in a fixed order to avoid it.

```typescript
afterRenderEffect({
  earlyRead: () => {
    // read layout before anything writes
    return this.element().nativeElement.getBoundingClientRect();
  },
  write: (rect) => {
    // write to the DOM, using what earlyRead returned
    this.tooltip().nativeElement.style.top = `${rect().bottom}px`;
  },
  read: () => {
    // read again after all writes
    console.log('final height', this.element().nativeElement.offsetHeight);
  },
});
```

The order is `earlyRead`, then `write`, then `read`. Each phase receives the previous phase's return value as a signal.

Batching all reads before all writes is exactly what performance guides tell you to do by hand. Here the framework enforces it.

## The common case

Most of the time you only need one phase, and the shorthand runs in the `mixedReadWrite` phase.

```typescript
afterRenderEffect(() => {
  const el = this.element().nativeElement;
  el.style.height = `${el.scrollHeight}px`;
});
```

That is fine for occasional work. For anything running frequently, use the explicit phases.

## afterNextRender

Runs once, after the next render, rather than on every change.

```typescript
import { afterNextRender } from '@angular/core';

export class Chart {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    afterNextRender(() => {
      this.chart = new ThirdPartyChart(this.canvas().nativeElement);
    });
  }
}
```

This is the right place to initialise a third party library that needs a real DOM element. It replaces the old habit of doing it in `ngAfterViewInit`.

It takes the same phase object when you need it:

```typescript
afterNextRender({
  write: () => this.initialiseLibrary(),
});
```

## They do not run on the server

This is the most useful property of both functions. During server-side rendering there is no DOM, so neither runs at all.

```typescript
constructor() {
  // safe: never runs on the server
  afterNextRender(() => {
    const width = window.innerWidth;
    this.isMobile.set(width < 768);
  });
}
```

Compare with the old approach:

```typescript
// the old way, still seen everywhere
private readonly platformId = inject(PLATFORM_ID);

ngAfterViewInit(): void {
  if (isPlatformBrowser(this.platformId)) {
    const width = window.innerWidth;
  }
}
```

`afterNextRender` makes the platform check unnecessary. Any code touching `window`, `document` or `localStorage` belongs in one of these callbacks, and then SSR works without special cases.

## A worked example: autosizing a textarea

```typescript
@Component({
  selector: 'app-autosize',
  template: `<textarea #box [value]="text()" (input)="onInput($event)"></textarea>`,
})
export class Autosize {
  private readonly box = viewChild.required<ElementRef<HTMLTextAreaElement>>('box');
  protected readonly text = signal('');

  constructor() {
    afterRenderEffect({
      write: () => {
        this.text();                       // depend on the text
        const el = this.box().nativeElement;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      },
    });
  }

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLTextAreaElement).value);
  }
}
```

Reading `this.text()` inside the callback is what makes it re-run when the text changes. Like any effect, dependencies are tracked by what it reads.

## Positioning a tooltip

```typescript
@Component({
  selector: 'app-tooltip',
  template: `
    <span #anchor><ng-content /></span>
    @if (visible()) {
      <div #bubble class="bubble">{{ text() }}</div>
    }
  `,
})
export class Tooltip {
  readonly text = input('');
  protected readonly visible = signal(false);

  private readonly anchor = viewChild.required<ElementRef<HTMLElement>>('anchor');
  private readonly bubble = viewChild<ElementRef<HTMLElement>>('bubble');

  constructor() {
    afterRenderEffect({
      earlyRead: () => this.anchor().nativeElement.getBoundingClientRect(),

      write: (anchorRect) => {
        const bubble = this.bubble();
        if (!bubble) return;

        const rect = anchorRect();
        bubble.nativeElement.style.top = `${rect.bottom + 8}px`;
        bubble.nativeElement.style.left = `${rect.left}px`;
      },
    });
  }
}
```

All measurement happens in `earlyRead`, all mutation in `write`. No thrashing.

## Cleanup

Both take an `onCleanup` callback, exactly like `effect`.

```typescript
afterNextRender(onCleanup => {
  const observer = new ResizeObserver(entries => {
    this.width.set(entries[0].contentRect.width);
  });

  observer.observe(this.element().nativeElement);

  onCleanup(() => observer.disconnect());
});
```

`ResizeObserver`, `IntersectionObserver` and `MutationObserver` all belong here, and all need disconnecting.

## Choosing between them

```text
computed              a derived value                    prefer this
effect                a side effect outside Angular
afterRenderEffect     reads or writes the DOM, repeatedly
afterNextRender       one time DOM setup, third party init
```

Work down the list. Most reactive logic should be a `computed`. Reach for the render hooks only when you genuinely need the real DOM.

## What they replaced

```typescript
// old
ngAfterViewInit(): void {
  if (isPlatformBrowser(this.platformId)) {
    this.chart = new Chart(this.canvas.nativeElement);
  }
}

ngAfterViewChecked(): void {
  this.resize();      // runs constantly, easy to make slow
}

ngOnDestroy(): void {
  this.chart.destroy();
}
```

```typescript
// new
constructor() {
  afterNextRender(onCleanup => {
    const chart = new Chart(this.canvas().nativeElement);
    onCleanup(() => chart.destroy());
  });
}
```

One block instead of three hooks, no platform check, and cleanup right beside the setup.

## Common mistakes

**Using `effect` to measure the DOM.** It may run before the DOM is updated.

**Writing to a signal read by the template inside `write`.** That schedules another render, and can loop.

**Doing heavy work in `mixedReadWrite`.** Split it into phases.

**Forgetting cleanup for observers.** They keep the element alive and keep firing.

## Quick recap

- `afterRenderEffect` runs after Angular has updated the DOM, so measurement is safe.
- The phases run `earlyRead`, then `write`, then `read`, batching reads before writes.
- `afterNextRender` runs once, and suits third party library initialisation.
- Neither runs during server-side rendering, which removes the platform check.
- Dependencies are tracked by what the callback reads, like any effect.
- Use `onCleanup` for observers, and disconnect them.
- Prefer `computed`, then `effect`, and only then the render hooks.

<code id="code-content" class="language-typescript">
import { Component, ElementRef, input, signal, viewChild,
         afterRenderEffect, afterNextRender } from '@angular/core';
@Component({
  selector: 'app-tooltip',
  template: `
    &lt;span #anchor&gt;&lt;ng-content /&gt;&lt;/span&gt;
    @if (visible()) { &lt;div #bubble class="bubble"&gt;{{ text() }}&lt;/div&gt; }
  `,
})
export class Tooltip {
  readonly text = input('');
  protected readonly visible = signal(false);
  private readonly anchor = viewChild.required&lt;ElementRef&lt;HTMLElement&gt;&gt;('anchor');
  private readonly bubble = viewChild&lt;ElementRef&lt;HTMLElement&gt;&gt;('bubble');
  private readonly width = signal(0);
  constructor() {
    // Phases run in order: earlyRead -&gt; write -&gt; read.
    // Batching all reads before all writes prevents layout thrashing.
    afterRenderEffect({
      earlyRead: () =&gt; this.anchor().nativeElement.getBoundingClientRect(),
      write: (anchorRect) =&gt; {
        const bubble = this.bubble();
        if (!bubble) return;
        const rect = anchorRect();
        bubble.nativeElement.style.top = `${rect.bottom + 8}px`;
        bubble.nativeElement.style.left = `${rect.left}px`;
      },
    });
    // afterNextRender runs ONCE. Right place for third party libraries.
    // Neither of these runs during server-side rendering, so no
    // isPlatformBrowser check is needed for window or document.
    afterNextRender(onCleanup =&gt; {
      const observer = new ResizeObserver(entries =&gt;
        this.width.set(entries[0].contentRect.width));
      observer.observe(this.anchor().nativeElement);
      onCleanup(() =&gt; observer.disconnect());     // observers MUST be cleaned up
    });
  }
}
// A plain effect() may run BEFORE the DOM is updated, so this is unreliable:
//   effect(() =&gt; console.log(el.nativeElement.offsetHeight));
// What this replaced:
//   ngAfterViewInit + isPlatformBrowser check + ngAfterViewChecked + ngOnDestroy
// Choose in this order:
//   computed            a derived value                 (prefer this)
//   effect              a side effect outside Angular
//   afterRenderEffect   repeatedly reads/writes the DOM
//   afterNextRender     one time DOM setup
</code></pre>
