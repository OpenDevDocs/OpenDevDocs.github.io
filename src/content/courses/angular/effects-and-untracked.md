---
publishDate: 2026-06-07T07:50
title: Effects, Cleanup and untracked
slug: effects-and-untracked
metadescription: Use effects for genuine side effects, clean up after them, and control dependency tracking with untracked.
updateDate: 2026-09-07T07:50
author: ['bishal-biswas']
level: 2
tags: ['signals', 'effects', 'untracked']
course: angular
---

## What effects are for

An effect runs when the signals it reads change. It is for reaching **outside** Angular's reactive world.

```typescript
export class ThemeSwitcher {
  readonly theme = signal<'light' | 'dark'>('light');

  constructor() {
    effect(() => {
      document.documentElement.dataset['theme'] = this.theme();
      localStorage.setItem('theme', this.theme());
    });
  }
}
```

Legitimate uses:

```text
writing to localStorage or a cookie
setting something on document or a DOM node directly
logging and analytics
driving a non-Angular library, such as a chart or a map
opening and closing a websocket
```

If the goal is to produce a value that the template reads, it is not an effect. It is a `computed` or a `linkedSignal`.

## Where they can be created

An effect needs an injection context.

```typescript
export class Widget {
  readonly value = signal(0);

  // field initialiser
  private readonly log = effect(() => console.log(this.value()));

  constructor() {
    // or the constructor
    effect(() => this.sync());
  }

  later(): void {
    effect(() => { ... });   // error, no injection context
  }
}
```

Pass an injector to create one elsewhere:

```typescript
private readonly injector = inject(Injector);

later(): void {
  effect(() => { ... }, { injector: this.injector });
}
```

An effect created in a component or service is destroyed with it. There is no manual cleanup.

## Cleanup between runs

The function receives an `onCleanup` callback, which runs before the next execution and when the effect is destroyed.

```typescript
export class Poller {
  readonly interval = signal(1000);

  constructor() {
    effect(onCleanup => {
      const id = setInterval(() => this.check(), this.interval());

      onCleanup(() => clearInterval(id));
    });
  }
}
```

Change `interval` and the old timer is cleared before the new one starts. Destroy the component and the timer is cleared.

Without the cleanup you would leak a timer on every change. This applies to event listeners, subscriptions, observers and websockets.

```typescript
effect(onCleanup => {
  const controller = new AbortController();

  fetch(`/api/search?q=${this.term()}`, { signal: controller.signal })
    .then(r => r.json())
    .then(data => this.results.set(data));

  onCleanup(() => controller.abort());
});
```

That cancels the in flight request when the term changes. For data fetching, `resource()` does this properly and is the better tool.

## untracked

Sometimes an effect needs to read a signal **without** depending on it.

```typescript
export class Analytics {
  readonly page = signal('/home');
  readonly userId = signal('u1');

  constructor() {
    effect(() => {
      const page = this.page();                    // tracked
      const user = untracked(() => this.userId()); // read, but not tracked

      this.send('page-view', { page, user });
    });
  }
}
```

The effect runs when `page` changes. Changing `userId` alone does not re-send the event, which is what you want.

Without `untracked`, changing the user id would fire a spurious page view.

## untracked for writes

Writing to a signal you also read inside an effect creates a loop. `untracked` breaks it.

```typescript
effect(() => {
  const items = this.items();

  untracked(() => {
    this.history.update(h => [...h, items.length]);
  });
});
```

Angular will throw if you write to a signal inside an effect without this, precisely because the loop is so easy to create by accident.

Better still: ask whether that write should be a `computed` or a `linkedSignal`.

## untracked around a whole block

```typescript
effect(() => {
  const term = this.searchTerm();      // the only dependency

  untracked(() => {
    // reads several signals, none of them tracked
    this.log(this.userId(), this.sessionId(), this.locale(), term);
  });
});
```

This is the clean way to say "run when the search term changes, and read whatever else you need at that moment".

## Effects run after rendering

An effect is not synchronous with the signal change. Angular batches and runs effects after the current change detection pass.

```typescript
const count = signal(0);

effect(() => console.log('effect saw', count()));

count.set(1);
count.set(2);
count.set(3);

// logs once, with 3
```

That batching is deliberate. Three rapid updates cause one effect run, not three.

It also means you cannot rely on an effect for anything that must happen immediately after a set.

## Effects and DOM measurement

For reading layout after render, `afterRenderEffect` is the right tool, not `effect`. It has its own topic.

```typescript
// wrong: may run before the DOM is updated
effect(() => {
  const height = this.element.nativeElement.offsetHeight;
});

// right
afterRenderEffect(() => {
  const height = this.element.nativeElement.offsetHeight;
});
```

## Destroying manually

`effect()` returns a reference with a `destroy` method.

```typescript
const ref = effect(() => console.log(this.value()));

ref.destroy();
```

Rarely needed, since component effects are cleaned up automatically. Useful for an effect created dynamically and finished with early.

## The rules worth keeping

**Do not derive state.** Use `computed`.

**Do not sync two signals.** Use `linkedSignal`.

**Do clean up.** Timers, listeners and subscriptions all need `onCleanup`.

**Do use `untracked`** for values you read but do not want to react to.

**Do keep them few.** A component with five effects usually has a design problem. Most reactive logic belongs in `computed`.

## Quick recap

- Effects are for side effects outside Angular, not for deriving values.
- They need an injection context, so create them in a constructor or field.
- `onCleanup` runs before the next execution and on destroy, so timers do not leak.
- `untracked` reads a signal without depending on it.
- Writing to a signal inside an effect needs `untracked`, and usually means you want `computed`.
- Effects are batched and run after change detection, not immediately.
- Use `afterRenderEffect` for anything that measures the DOM.

<code id="code-content" class="language-typescript">
import { Component, signal, effect, untracked, inject, Injector } from '@angular/core';
@Component({ selector: 'app-effects', template: `` })
export class Effects {
  readonly theme = signal&lt;'light' | 'dark'&gt;('light');
  readonly interval = signal(1000);
  readonly page = signal('/home');
  readonly userId = signal('u1');
  private readonly injector = inject(Injector);
  constructor() {
    // Legitimate: reaching OUTSIDE Angular
    effect(() =&gt; {
      document.documentElement.dataset['theme'] = this.theme();
      localStorage.setItem('theme', this.theme());
    });
    // onCleanup runs before the next run AND on destroy. Timers must use it.
    effect(onCleanup =&gt; {
      const id = setInterval(() =&gt; this.check(), this.interval());
      onCleanup(() =&gt; clearInterval(id));
    });
    // Cancel an in flight request when the input changes
    effect(onCleanup =&gt; {
      const controller = new AbortController();
      fetch(`/api/search?q=${this.page()}`, { signal: controller.signal });
      onCleanup(() =&gt; controller.abort());
    });
    // untracked: read a signal WITHOUT depending on it.
    // Runs when page changes. Changing userId alone does not fire it.
    effect(() =&gt; {
      const page = this.page();
      const user = untracked(() =&gt; this.userId());
      this.send('page-view', { page, user });
    });
  }
  later(): void {
    // Outside a constructor or field initialiser, pass an injector
    effect(() =&gt; console.log(this.theme()), { injector: this.injector });
  }
  private check(): void {}
  private send(name: string, data: unknown): void {}
}
// Effects are BATCHED and run after change detection:
//   count.set(1); count.set(2); count.set(3);   -&gt; the effect runs ONCE, with 3
// The rules:
//   deriving a value?      computed, not an effect
//   syncing two signals?   linkedSignal, not an effect
//   measuring the DOM?     afterRenderEffect, not an effect
//   writing a signal?      wrap in untracked, and ask if computed fits better
</code></pre>
