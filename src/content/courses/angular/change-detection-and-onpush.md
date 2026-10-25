---
publishDate: 2026-06-22T11:45
title: Change Detection Strategies and OnPush
slug: change-detection-and-onpush
metadescription: Understand how Angular decides what to re-render, what OnPush changes, and why signals made most of it unnecessary.
updateDate: 2026-09-07T11:45
author: ['bishal-biswas']
level: 3
tags: ['performance', 'change detection', 'onpush']
course: angular
---

## What change detection does

Angular keeps the DOM in step with your data. Change detection is the process of checking bindings and updating the ones whose values changed.

The question that decides performance is **when** it runs and **how much** it checks.

## The default strategy

With `ChangeDetectionStrategy.Default`, when change detection runs it checks **every component** in the tree, from the root down.

```text
AppComponent          checked
├── Header            checked
├── UserList          checked
│   ├── UserCard 1    checked
│   ├── UserCard 2    checked
│   └── ... 500 more  all checked
└── Footer            checked
```

A click on a button in the header causes all of it to be checked. Angular is fast, so this is fine for small applications and a real problem for large ones.

## OnPush

`OnPush` tells Angular to skip a component unless something specific happened.

```typescript
@Component({
  selector: 'app-user-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>{{ user().name }}</p>`,
})
export class UserCard {
  readonly user = input.required<User>();
}
```

An `OnPush` component is checked only when:

```text
one of its inputs changes by REFERENCE
an event fires inside its own template
a signal it reads changes
an async pipe in its template emits
markForCheck() is called on it
```

Otherwise it is skipped, along with everything below it.

## The reference comparison trap

`OnPush` compares inputs with `===`. Mutating an object does not change its reference, so the child is not updated.

```typescript
// the child never updates
addUser(user: User): void {
  this.users.push(user);
}

// the child updates
addUser(user: User): void {
  this.users = [...this.users, user];
}
```

This was the classic `OnPush` bug, and it is why immutable updates became the convention.

Signals remove the problem, because a signal notifies its readers regardless of how the tree is configured.

## markForCheck

The escape hatch when a value changes outside anything Angular tracks.

```typescript
export class Legacy {
  private readonly cdr = inject(ChangeDetectorRef);
  protected message = 'waiting';

  constructor() {
    someCallbackApi.onDone(() => {
      this.message = 'done';
      this.cdr.markForCheck();
    });
  }
}
```

`markForCheck()` marks this component and its **ancestors** as needing a check on the next cycle. It does not check immediately.

`detectChanges()` does run immediately, synchronously, on this component and its children. Use it rarely, because it bypasses Angular's scheduling.

`detach()` and `reattach()` remove a subtree from checking entirely. Occasionally useful for something updating very fast, like a live chart, but easy to misuse.

## Signals changed the model

A signal read in a template creates a precise dependency. When it changes, Angular knows exactly which views to update rather than checking a tree.

```typescript
@Component({
  template: `
    <p>{{ count() }}</p>
    <p>{{ name() }}</p>
  `,
})
export class Widget {
  protected readonly count = signal(0);
  protected readonly name = signal('Asha');
}
```

Changing `count` updates the first paragraph. The second is not touched, and neither is any other component.

That is a fundamentally better model than checking and comparing, and it is why zoneless works.

## Zoneless makes OnPush redundant

Zoneless change detection applies `OnPush` behaviour everywhere. Setting the strategy explicitly changes nothing.

```typescript
provideZonelessChangeDetection()
```

In a zoneless application, updates are scheduled by signal changes, template events and the `async` pipe. Nothing else triggers a check.

**For new zoneless code, do not bother adding `OnPush`.** For existing code it is harmless, and it helps if the application still runs with Zone.js anywhere.

## Migrating an existing application

If you are on Zone.js and want the benefit today, `OnPush` is still worth applying.

Set it as the default for generated components:

```json
{
  "projects": {
    "my-app": {
      "schematics": {
        "@schematics/angular:component": {
          "changeDetection": "OnPush"
        }
      }
    }
  }
}
```

Then work outwards from leaf components, which are safest, towards the root.

What to fix as you go:

**Mutations.** Replace `push`, `splice` and property assignment with immutable updates. Or better, move the state to signals.

**Values set from callbacks.** Timers, websockets and third party libraries need `markForCheck()`, or a signal.

**Getters doing work in templates.** They still run on every check of that component. Move them to `computed`.

## Common symptoms

**The value changes but the view does not.** An `OnPush` component received a mutated object, or a plain field was updated from an async callback.

**The view updates only when you click elsewhere.** Something else triggered a check that happened to include this component. A missing `markForCheck()`.

**Everything is slow with a large list.** Default strategy, no `track` on the loop, or expensive expressions in the template.

## Profiling

```typescript
import { provideCheckNoChangesConfig } from '@angular/core';
```

Angular DevTools has a profiler showing which components were checked and how long each took. Record an interaction, and anything unexpectedly wide is your target.

Rough triage:

- Many components checked on one click means `OnPush` is missing, or you are on Zone.js with default strategy.
- One component taking a long time means an expensive template expression.
- A whole list rebuilding means a missing or unstable `track`.

## Things that quietly cost you

```html
<!-- runs on every check of this component -->
<p>{{ calculateTotal() }}</p>
<p>{{ items.filter(i => i.active).length }}</p>
<div [class]="buildClasses()">

<!-- cheap: a signal read, cached until a dependency changes -->
<p>{{ total() }}</p>
<p>{{ activeCount() }}</p>
```

```typescript
protected readonly total = computed(() =>
  this.items().reduce((sum, i) => sum + i.price, 0)
);
```

Method calls in templates are the most common avoidable cost. A `computed` is cached, a method is not.

## Quick recap

- Default strategy checks the entire component tree on every cycle.
- `OnPush` skips a component unless an input reference changes, an event fires, or a signal it reads changes.
- Mutating an object does not change its reference, which was the classic `OnPush` bug.
- `markForCheck()` schedules a check, `detectChanges()` runs one immediately.
- Signals create precise dependencies, so only affected views update.
- Zoneless applies `OnPush` behaviour everywhere, making the setting redundant.
- Replace method calls in templates with computed signals.

<code id="code-content" class="language-typescript">
import { Component, ChangeDetectionStrategy, ChangeDetectorRef,
         inject, input, signal, computed } from '@angular/core';
// DEFAULT: when change detection runs, EVERY component is checked, root down.
// OnPush: this component is checked only when
//   an input changes by REFERENCE
//   an event fires in its own template
//   a signal it reads changes
//   an async pipe emits
//   markForCheck() is called
@Component({
  selector: 'app-user-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    &lt;p&gt;{{ user().name }}&lt;/p&gt;
    &lt;!-- CHEAP: a computed signal, cached until a dependency changes --&gt;
    &lt;p&gt;{{ total() }}&lt;/p&gt;
    &lt;!-- EXPENSIVE: a method runs on EVERY check of this component --&gt;
    &lt;p&gt;{{ calculateTotal() }}&lt;/p&gt;
  `,
})
export class UserCard {
  readonly user = input.required&lt;{ name: string }&gt;();
  readonly items = input&lt;{ price: number }[]&gt;([]);
  protected readonly total = computed(() =&gt;
    this.items().reduce((s, i) =&gt; s + i.price, 0));
  protected calculateTotal(): number {
    return this.items().reduce((s, i) =&gt; s + i.price, 0);
  }
}
// THE CLASSIC OnPush BUG: === compares references, so a mutation is invisible
class Parent {
  users: { name: string }[] = [];
  addBroken(u: { name: string }) { this.users.push(u); }        // child never updates
  addWorking(u: { name: string }) { this.users = [...this.users, u]; }   // it does
}
// The escape hatch for values changed outside anything Angular tracks
@Component({ selector: 'app-legacy', template: `{{ message }}` })
export class LegacyBridge {
  private readonly cdr = inject(ChangeDetectorRef);
  protected message = 'waiting';
  ngOnInit() {
    someCallbackApi.onDone(() =&gt; {
      this.message = 'done';
      this.cdr.markForCheck();     // schedules a check of this and its ANCESTORS
      // this.cdr.detectChanges(); would run one immediately, synchronously
    });
  }
}
// SIGNALS changed the model entirely. A signal read in a template is a
// precise dependency, so changing `count` updates ONLY that binding.
@Component({ template: `&lt;p&gt;{{ count() }}&lt;/p&gt;&lt;p&gt;{{ name() }}&lt;/p&gt;` })
export class Modern {
  protected readonly count = signal(0);
  protected readonly name = signal('Asha');
}
// ZONELESS applies OnPush behaviour everywhere, so setting the strategy
// changes nothing. For new zoneless code, do not bother adding it.
// Symptoms:
//   value changes, view does not     -&gt; a mutated object, or a plain field
//   view updates on an unrelated click -&gt; a missing markForCheck()
//   slow with a big list             -&gt; default strategy, or a missing track
// Angular DevTools has a profiler showing exactly what was checked.
</code></pre>
