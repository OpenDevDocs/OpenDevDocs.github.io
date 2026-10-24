---
publishDate: 2026-06-07T07:45
title: linkedSignal and Derived Writable State
slug: linkedsignal
metadescription: Create writable state that resets when a source changes, and stop reaching for effects to keep two signals in sync.
updateDate: 2026-09-07T07:45
author: ['bishal-biswas']
level: 2
tags: ['signals', 'linkedsignal', 'state']
course: angular
---

## The gap it fills

`computed` is read only. `signal` does not react to anything. Sometimes you need both: a value that follows a source, but which the user can also override.

A selected item in a list is the classic case. It should follow the list, but the user picks it.

```typescript
readonly options = input.required<Option[]>();
readonly selected = signal<Option | undefined>(undefined);
```

That breaks the moment `options` changes. The selection still points at something that is no longer there.

`linkedSignal` fixes it.

```typescript
import { linkedSignal } from '@angular/core';

readonly options = input.required<Option[]>();

readonly selected = linkedSignal(() => this.options()[0]);
```

Now `selected` is writable, **and** it resets to the first option whenever `options` changes.

## The basic form

```typescript
const shipping = signal(['Standard', 'Express']);

const chosen = linkedSignal(() => shipping()[0]);

console.log(chosen());        // 'Standard'

chosen.set('Express');
console.log(chosen());        // 'Express', user override

shipping.set(['Next day', 'Pickup']);
console.log(chosen());        // 'Next day', reset because the source changed
```

Read it as: "this value is derived from that, until someone sets it, and derived again when the source changes."

## Keeping the previous value

The second form gives you access to the previous value and the previous source, so you can decide whether the override survives.

```typescript
readonly options = input.required<Option[]>();

readonly selected = linkedSignal<Option[], Option>({
  source: () => this.options(),
  computation: (options, previous) => {
    const stillThere = options.find(o => o.id === previous?.value?.id);
    return stillThere ?? options[0];
  },
});
```

Now the selection is kept if the same option still exists in the new list, and falls back to the first if it does not.

`previous` is `undefined` on the first run, and afterwards holds `{ source, value }`.

## Where it earns its keep

**A quantity that resets when the product changes:**

```typescript
readonly product = input.required<Product>();

protected readonly quantity = linkedSignal(() => {
  this.product();          // depend on it
  return 1;                // reset to 1 whenever the product changes
});
```

**A form that resets when the record changes:**

```typescript
readonly user = input.required<User>();

protected readonly draft = linkedSignal(() => ({ ...this.user() }));

protected save(): void {
  this.userService.update(this.draft());
}
```

Editing changes `draft`. Loading a different user throws the edits away and starts fresh. That is usually what you want.

**A page number that resets when a filter changes:**

```typescript
readonly filter = signal('');

protected readonly page = linkedSignal(() => {
  this.filter();
  return 1;
});
```

Without this, filtering while on page 7 leaves you on page 7 of a much shorter list.

## Compared with an effect

The effect version of the same thing:

```typescript
// avoid
readonly selected = signal<Option | undefined>(undefined);

constructor() {
  effect(() => {
    this.selected.set(this.options()[0]);
  });
}
```

Three problems. It runs after the render rather than during, so the UI flickers through a stale value. It is a write inside an effect, which Angular discourages. And it is more code.

`linkedSignal` computes at read time like a `computed`, so there is no flicker and no ordering question.

**If you have an effect that sets a signal based on another signal, it should probably be a `linkedSignal`.**

## Compared with computed

```typescript
readonly total = computed(() => this.price() * this.quantity());       // never written
readonly quantity = linkedSignal(() => this.defaultQuantity());        // user writable
```

Use `computed` when the value is purely derived and nothing should set it. Use `linkedSignal` when it starts derived but a user action can override it.

If you find yourself wanting `set` on a `computed`, you want `linkedSignal`.

## Equality

Like `signal`, it accepts a custom comparison.

```typescript
readonly selected = linkedSignal({
  source: () => this.options(),
  computation: options => options[0],
  equal: (a, b) => a?.id === b?.id,
});
```

This prevents a reset when the source produces an equivalent but not identical object, which happens whenever data is refetched.

## Common mistakes

**Forgetting to read the source.**

```typescript
// never resets, the computation depends on nothing
readonly page = linkedSignal(() => 1);

// resets when filter changes
readonly page = linkedSignal(() => {
  this.filter();
  return 1;
});
```

The computation must actually read a signal, or there is nothing to react to.

**Expecting it to preserve overrides by default.** The simple form throws the override away on every source change. Use the `source` and `computation` form to keep it.

**Using it for a value that is never overridden.** That is a `computed`.

## Quick recap

- `linkedSignal` is writable state that resets when its source changes.
- The short form recomputes and discards any override.
- The `source` plus `computation` form gives you the previous value so you can keep it.
- It replaces effects that set one signal from another, with no flicker.
- Use it for selections, drafts, quantities and page numbers tied to a parent value.
- Use `computed` when nothing should ever set the value.
- The computation must read a signal, or it will never reset.

<code id="code-content" class="language-typescript">
import { Component, input, signal, linkedSignal, computed } from '@angular/core';
interface Option { id: number; label: string; }
@Component({ selector: 'app-picker', template: `` })
export class Picker {
  readonly options = input.required&lt;Option[]&gt;();
  readonly filter = signal('');
  // Short form: writable, but RESETS whenever the source changes
  protected readonly selected = linkedSignal(() =&gt; this.options()[0]);
  // Long form: you get the previous value, so the override can survive
  protected readonly sticky = linkedSignal&lt;Option[], Option&gt;({
    source: () =&gt; this.options(),
    computation: (options, previous) =&gt;
      options.find(o =&gt; o.id === previous?.value?.id) ?? options[0],
    equal: (a, b) =&gt; a?.id === b?.id,
  });
  // A page number that resets when the filter changes.
  // The computation MUST read a signal or it will never reset.
  protected readonly page = linkedSignal(() =&gt; {
    this.filter();
    return 1;
  });
  // An editable draft that resets when a different record loads
  readonly user = input.required&lt;{ name: string }&gt;();
  protected readonly draft = linkedSignal(() =&gt; ({ ...this.user() }));
  // Purely derived, nothing should set it: that is a computed
  protected readonly count = computed(() =&gt; this.options().length);
}
// Replaces this anti-pattern, which flickers and writes inside an effect:
//   readonly selected = signal&lt;Option | undefined&gt;(undefined);
//   effect(() =&gt; this.selected.set(this.options()[0]));
// linkedSignal computes at READ time, so there is no stale frame.
// Rule of thumb: an effect that sets one signal from another
// should almost always be a linkedSignal instead.
// And if you want set() on a computed, you want linkedSignal.
</code></pre>
