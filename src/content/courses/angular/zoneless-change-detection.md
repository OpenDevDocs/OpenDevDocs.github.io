---
publishDate: 2026-06-07T07:40
title: Zoneless Change Detection
slug: zoneless-change-detection
metadescription: Run Angular without Zone.js, understand what schedules a re-render instead, and learn what breaks when you make the switch.
updateDate: 2026-09-07T07:40
author: ['bishal-biswas']
level: 1
tags: ['zoneless', 'change detection', 'performance']
course: angular
---

## Angular without Zone.js

For most of Angular's life, a library called Zone.js patched every asynchronous API in the browser. `setTimeout`, `addEventListener`, `fetch`, promises, all of them. Whenever one fired, Zone.js told Angular that something might have changed, and Angular checked the entire component tree.

It worked, and it was wasteful. A `setTimeout` in an unrelated corner of the application triggered a check of every component.

**Zoneless** removes Zone.js entirely. Angular is told about changes explicitly instead of guessing.

Zoneless became stable in Angular 20.2 and is the default for new projects.

## Turning it on

```typescript
import { provideZonelessChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
  ],
};
```

Then remove Zone.js from the build. In `angular.json`:

```json
"polyfills": []
```

Older projects have `"polyfills": ["zone.js"]`. Deleting it is what actually removes the 30 or so kilobytes.

## What schedules an update now

Angular re-renders when one of these happens:

```text
a signal that the template reads changes
an event bound in a template fires
an async pipe emits
markForCheck() is called
an input on an OnPush component changes
```

That is a short and predictable list, which is the whole benefit.

```typescript
@Component({
  template: `<p>{{ count() }}</p><button (click)="add()">Add</button>`,
})
export class Counter {
  protected readonly count = signal(0);
  protected add(): void { this.count.update(n => n + 1); }   // schedules an update
}
```

## What stops working

This is the part to understand before switching. Anything that used to rely on Zone.js noticing an async callback now needs a signal.

```typescript
// works with Zone.js, does nothing zoneless
export class Broken {
  protected message = 'waiting';

  constructor() {
    setTimeout(() => {
      this.message = 'done';    // the view never updates
    }, 1000);
  }
}
```

```typescript
// correct
export class Fixed {
  protected readonly message = signal('waiting');

  constructor() {
    setTimeout(() => {
      this.message.set('done');   // schedules an update
    }, 1000);
  }
}
```

The rule: **anything the template reads must be a signal**, or you must tell Angular manually.

Common places this bites:

```typescript
// a callback from a non-Angular library
map.on('click', () => this.selected.set(true));      // use a signal

// a websocket message
socket.onmessage = e => this.messages.update(m => [...m, e.data]);

// a promise resolving
const data = await fetch('/api').then(r => r.json());
this.data.set(data);                                  // not this.data = data
```

## The manual escape hatch

When a value cannot be a signal, mark the component for check.

```typescript
export class Legacy {
  private readonly cdr = inject(ChangeDetectorRef);
  protected message = 'waiting';

  constructor() {
    someOldLibrary.onDone(() => {
      this.message = 'done';
      this.cdr.markForCheck();     // tell Angular explicitly
    });
  }
}
```

Treat this as a bridge to old code, not a pattern. Signals are better in every way.

## OnPush becomes irrelevant

`ChangeDetectionStrategy.OnPush` was a manual optimisation that limited when a component was checked. Zoneless applies that behaviour everywhere by default, so setting it changes nothing.

Leave it in existing code, since it is harmless and helps if the application ever runs with Zone.js again. There is no need to add it to new components.

## Testing zoneless

```typescript
TestBed.configureTestingModule({
  providers: [provideZonelessChangeDetection()],
});
```

Zoneless tests do not need `fakeAsync` or `tick` for signal updates. `await fixture.whenStable()` covers most cases.

```typescript
it('increments', async () => {
  const fixture = TestBed.createComponent(Counter);
  await fixture.whenStable();

  fixture.nativeElement.querySelector('button').click();
  await fixture.whenStable();

  expect(fixture.nativeElement.textContent).toContain('1');
});
```

`fakeAsync` and `tick` still work for genuine timers.

## Migrating an existing application

Do it in stages.

**One: convert template state to signals.** Anything read by a template becomes a signal. This is the bulk of the work, and it is worth doing regardless of zoneless.

**Two: add `provideZonelessChangeDetection()`** but keep Zone.js in the polyfills. The application now behaves as if zoneless while Zone.js is still loaded, so if something is broken you have not lost the safety net.

**Three: test thoroughly.** Look for anything that updates late or not at all. Third party integrations and timers are the usual offenders.

**Four: remove `zone.js` from polyfills.** This is the step that actually shrinks the bundle.

```json
"polyfills": []
```

## What you gain

**A smaller bundle.** Zone.js is around 30 KB compressed.

**Faster startup.** Patching every async API costs time before the application runs.

**Less work per update.** Only what actually depends on the change is checked.

**Readable stack traces.** Zone.js inserted frames into every async stack, which made debugging harder than it needed to be.

**Better interoperability.** Libraries that fought with Zone.js just work.

## What to watch for

**Third party libraries** that expect Zone.js. Most do not care, but anything doing its own change detection tricks might.

**`setTimeout` inside components** updating plain fields. Search for them.

**Tests using `fakeAsync`** for what are really signal updates. They will still pass, but `whenStable` is clearer.

## Quick recap

- Zoneless removes Zone.js, so Angular is told about changes rather than guessing.
- It is stable since Angular 20.2 and the default for new projects.
- Updates are scheduled by signal changes, template events and the async pipe.
- Anything a template reads must be a signal, or you must call `markForCheck()`.
- `OnPush` becomes irrelevant, since zoneless behaves that way everywhere.
- Migrate in stages, and remove `zone.js` from polyfills last.
- You gain a smaller bundle, faster startup and readable stack traces.

<code id="code-content" class="language-typescript">
import { Component, signal, inject, ChangeDetectorRef, provideZonelessChangeDetection } from '@angular/core';
// Turn it on, then remove zone.js from "polyfills" in angular.json
export const appConfig = {
  providers: [provideZonelessChangeDetection()],
};
// What schedules a re-render now:
//   a signal the template reads changes
//   a template event fires
//   an async pipe emits
//   markForCheck() is called
//   an input on an OnPush component changes
@Component({
  selector: 'app-fixed',
  template: `&lt;p&gt;{{ message() }}&lt;/p&gt;&lt;button (click)="add()"&gt;Add&lt;/button&gt;`,
})
export class Fixed {
  protected readonly message = signal('waiting');
  protected readonly count = signal(0);
  constructor() {
    // A signal update schedules a render, even from a plain setTimeout
    setTimeout(() =&gt; this.message.set('done'), 1000);
  }
  protected add(): void { this.count.update(n =&gt; n + 1); }
}
// This WORKED with Zone.js and does NOTHING zoneless:
@Component({ selector: 'app-broken', template: `&lt;p&gt;{{ message }}&lt;/p&gt;` })
export class Broken {
  protected message = 'waiting';
  constructor() {
    setTimeout(() =&gt; { this.message = 'done'; }, 1000);   // view never updates
  }
}
// The rule: anything the template reads must be a SIGNAL.
// Stuck with a library that cannot be? Mark for check by hand:
@Component({ selector: 'app-bridge', template: `&lt;p&gt;{{ message }}&lt;/p&gt;` })
export class Bridge {
  private readonly cdr = inject(ChangeDetectorRef);
  protected message = 'waiting';
  ngOnInit() {
    someOldLibrary.onDone(() =&gt; {
      this.message = 'done';
      this.cdr.markForCheck();       // a bridge to old code, not a pattern
    });
  }
}
// Migrate in stages:
//   1. convert template state to signals
//   2. add provideZonelessChangeDetection(), KEEP zone.js in polyfills
//   3. test hard, watch timers and third party integrations
//   4. remove zone.js from polyfills  ("polyfills": [])  -- this shrinks the bundle
// OnPush becomes irrelevant: zoneless behaves that way everywhere already.
</code></pre>
