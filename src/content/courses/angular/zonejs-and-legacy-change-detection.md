---
publishDate: 2026-06-22T11:50
title: Zone.js and How Change Detection Used to Work
slug: zonejs-and-legacy-change-detection
metadescription: Understand what Zone.js did, why Angular depended on it for a decade, and what to watch for when removing it.
updateDate: 2026-09-07T11:50
author: ['bishal-biswas']
level: 3
tags: ['legacy', 'zonejs', 'change detection']
course: angular
---

## The problem Zone.js solved

Angular needs to know when data might have changed. Before signals, there was no way to tell, because a plain property assignment is invisible to the framework.

```typescript
this.count = this.count + 1;    // nothing observes this
```

Zone.js solved it by **monkey patching every asynchronous API in the browser**.

```text
setTimeout, setInterval
addEventListener
Promise.then
XMLHttpRequest, fetch
requestAnimationFrame
and dozens more
```

Every one is replaced with a wrapper that notifies Angular when the callback finishes. The reasoning: data only changes in response to something asynchronous, so after any async callback, check everything.

It worked, and it made Angular feel magical. It also made it slow and hard to reason about.

## What it cost

**Bundle size.** Around 30 KB compressed, loaded before anything else.

**Startup time.** Patching dozens of APIs happens before your application runs.

**Wasted work.** A `setTimeout` in an unrelated corner triggered a check of the entire component tree.

**Unreadable stack traces.** Zone.js inserted frames into every asynchronous stack, so a simple error produced pages of `zone.js` noise.

**Interoperability problems.** Libraries doing their own async work fought with the patching, and third party code sometimes ran inside a zone unexpectedly.

## How it appeared in code

You will find these in older projects.

```typescript
export class Chart {
  private readonly zone = inject(NgZone);

  startAnimation(): void {
    // run outside Angular so the loop does not trigger change detection
    this.zone.runOutsideAngular(() => {
      const loop = () => {
        this.draw();
        requestAnimationFrame(loop);
      };
      loop();
    });
  }

  onComplete(result: string): void {
    // re-enter Angular so the view updates
    this.zone.run(() => {
      this.result = result;
    });
  }
}
```

`runOutsideAngular` was the standard fix for animation loops, scroll handlers and anything firing at high frequency. Without it, an animation loop triggered change detection sixty times a second across the whole application.

`NgZone.run` was needed when a third party callback fired outside the zone and the view had to update.

```typescript
this.zone.onStable.subscribe(() => {
  // everything has settled
});
```

`onStable` was used for measuring, for testing hooks, and for telling server-side rendering the page was ready.

## Why signals removed the need

A signal notifies Angular directly when it changes. There is no guessing, so there is nothing to patch.

```typescript
protected readonly count = signal(0);

increment(): void {
  this.count.update(n => n + 1);   // Angular is told, precisely
}
```

Angular knows which views read `count` and updates only those. Zone.js knew only that *something* asynchronous happened, so it checked everything.

That difference is why zoneless is both faster and simpler.

## Removing it

```typescript
import { provideZonelessChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [provideZonelessChangeDetection()],
};
```

```json
"polyfills": []
```

Deleting `"zone.js"` from `polyfills` in `angular.json` is what actually removes the bytes. Adding the provider without removing the polyfill leaves the library loaded.

## What to check when removing it

**Plain fields updated from async callbacks.** These worked because Zone.js noticed the callback. Zoneless, they do nothing.

```typescript
// worked with Zone.js, silent zoneless
setTimeout(() => { this.message = 'done'; }, 1000);

// correct
setTimeout(() => this.message.set('done'), 1000);
```

Search for `setTimeout`, `setInterval`, `.then(`, `.subscribe(` and `addEventListener` in components, and check what each callback assigns to.

**`NgZone` usage.** `runOutsideAngular` becomes unnecessary, since nothing is being triggered anyway. It is harmless to leave, and cleaner to remove.

**`onStable` subscriptions.** These will not fire meaningfully. Replace with `afterNextRender` or `whenStable` in tests.

**Third party integrations.** Libraries that called back into Angular relied on the patched APIs. Their callbacks must now update signals.

**Tests using `fakeAsync` and `tick`.** They still work for real timers, but signal updates no longer need them. `await fixture.whenStable()` is the zoneless idiom.

## Migrating safely

The staged approach, which lets you back out at any point:

**One.** Convert component state to signals. This is the bulk of the work and is worth doing regardless.

**Two.** Add `provideZonelessChangeDetection()` while **keeping** Zone.js in the polyfills. The application now behaves as if zoneless, with the safety net still loaded.

**Three.** Test everything, especially timers, third party widgets and anything with a callback.

**Four.** Remove `zone.js` from the polyfills. This is the step that shrinks the bundle.

Doing steps two and four together is what makes a migration hard to debug, because you cannot tell whether a problem is behavioural or a missing polyfill.

## Zone.js is not deprecated

Applications can still run with it, and many will for years. It is not going away in a hurry, and there is no urgency to remove it from a working application that performs acceptably.

The reason to move is real: a smaller bundle, faster startup, less work per update, readable stack traces and better library compatibility. But it is an optimisation, not a fix.

## Quick recap

- Zone.js patched every async browser API so Angular knew when to check.
- It cost roughly 30 KB, slowed startup and checked the whole tree unnecessarily.
- `runOutsideAngular` avoided triggering checks from high frequency work.
- `NgZone.run` re-entered Angular from a third party callback.
- Signals tell Angular exactly what changed, so no patching is needed.
- Remove the provider first and the polyfill last, so problems are easy to attribute.
- Zone.js is not deprecated, and moving away is an optimisation rather than a fix.

<code id="code-content" class="language-typescript">
import { Component, inject, NgZone, signal, ChangeDetectorRef,
         provideZonelessChangeDetection, afterNextRender } from '@angular/core';
// WHAT ZONE.JS DID: patched setTimeout, addEventListener, Promise, fetch,
// XMLHttpRequest, requestAnimationFrame and dozens more, so that after any
// async callback it could tell Angular to check the ENTIRE component tree.
// It worked, and it cost ~30 kB, slow startup, wasted checks and
// unreadable stack traces full of zone.js frames.
@Component({ selector: 'app-legacy-chart', template: `` })
export class LegacyChart {
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  protected result = '';
  startAnimation(): void {
    // The standard fix for high frequency work. Without it this triggers
    // change detection across the whole app 60 times a second.
    this.zone.runOutsideAngular(() =&gt; {
      const loop = () =&gt; { this.draw(); requestAnimationFrame(loop); };
      loop();
    });
  }
  onThirdPartyCallback(value: string): void {
    // Re-enter Angular so the view updates
    this.zone.run(() =&gt; { this.result = value; });
  }
  private draw() {}
}
// SIGNALS removed the need. Angular is told precisely what changed,
// and knows exactly which views read it.
@Component({ selector: 'app-modern', template: `{{ result() }}` })
export class Modern {
  protected readonly result = signal('');
  onThirdPartyCallback(value: string): void {
    this.result.set(value);      // no zone, no markForCheck, no guessing
  }
}
// Removing it. BOTH steps are needed: the provider changes behaviour,
// deleting the polyfill removes the bytes.
export const appConfig = { providers: [provideZonelessChangeDetection()] };
// angular.json:  "polyfills": []      (was ["zone.js"])
// WHAT TO CHECK when removing it. These worked because Zone.js noticed
// the callback, and do nothing zoneless:
//   setTimeout(() =&gt; { this.message = 'done'; })       -&gt; use a signal
//   fetch(...).then(d =&gt; { this.data = d; })           -&gt; use a signal
//   socket.onmessage = e =&gt; { this.items.push(e) }     -&gt; use a signal
// Grep components for setTimeout, setInterval, .then(, .subscribe(
// and addEventListener, then check what each callback assigns to.
// Also: runOutsideAngular becomes unnecessary, onStable will not fire
// meaningfully (use afterNextRender), and fakeAsync/tick is no longer
// needed for signal updates (use await fixture.whenStable()).
// MIGRATE IN STAGES: convert state to signals, add the provider while
// KEEPING zone.js, test hard, then remove the polyfill last. Doing the
// provider and the polyfill together makes failures hard to attribute.
// Zone.js is NOT deprecated. Moving away is an optimisation, not a fix.
</code></pre>
