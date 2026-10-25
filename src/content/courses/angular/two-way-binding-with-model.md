---
publishDate: 2026-06-06T07:35
title: Two-way Binding with model()
slug: two-way-binding-with-model
metadescription: Create inputs a child can write back to with model(), and understand what the banana in a box syntax actually expands to.
updateDate: 2026-09-07T07:35
author: ['bishal-biswas']
level: 1
tags: ['signals', 'two-way binding', 'model']
course: angular
---

## An input the child can change

`input()` is read only. Sometimes a child genuinely owns the value while the parent needs to know about it: a toggle, a slider, a rating widget.

`model()` creates a **writable** signal that syncs both ways.

```typescript
import { Component, model } from '@angular/core';

@Component({
  selector: 'app-toggle',
  template: `
    <button (click)="checked.set(!checked())">
      {{ checked() ? 'On' : 'Off' }}
    </button>
  `,
})
export class Toggle {
  readonly checked = model(false);
}
```

```html
<app-toggle [(checked)]="notificationsEnabled" />
```

The parent's signal and the child's model stay in step. Either side can set it.

## What the syntax expands to

`[(x)]` is shorthand for a property binding and an event binding together.

```html
<app-toggle [(checked)]="enabled" />

<!-- exactly the same thing -->
<app-toggle [checked]="enabled()" (checkedChange)="enabled.set($event)" />
```

That is why the convention exists: two-way binding needs an input `x` and an output `xChange`. `model()` creates both.

You can bind the halves separately when you want to intercept the change:

```html
<app-toggle
  [checked]="enabled()"
  (checkedChange)="onToggle($event)" />
```

```typescript
protected onToggle(value: boolean): void {
  if (this.canChange()) this.enabled.set(value);
}
```

That is the way to veto a change, which plain two-way binding does not allow.

## Required models

```typescript
readonly value = model.required<string>();
```

Same rules as `input.required`. The parent must bind it, and the type has no `undefined`.

## Aliasing

```typescript
readonly internalValue = model('', { alias: 'value' });
```

```html
<app-input [(value)]="name" />
```

## A worked example

```typescript
@Component({
  selector: 'app-rating',
  template: `
    @for (star of stars; track star) {
      <button
        (click)="rating.set(star)"
        [class.filled]="star <= rating()"
        [attr.aria-label]="'Rate ' + star">
        ★
      </button>
    }
  `,
})
export class Rating {
  readonly rating = model(0);
  protected readonly stars = [1, 2, 3, 4, 5];
}
```

```typescript
@Component({
  selector: 'app-review-form',
  imports: [Rating],
  template: `
    <app-rating [(rating)]="score" />
    <p>You gave {{ score() }} stars.</p>
    <button [disabled]="score() === 0" (click)="submit()">Submit</button>
  `,
})
export class ReviewForm {
  protected readonly score = signal(0);
  protected submit(): void { ... }
}
```

The rating component owns the interaction. The form owns the value and can read it, reset it, or validate it.

## Binding to a plain property

Two-way binding works with a non-signal property too.

```typescript
export class Parent {
  protected enabled = false;      // a plain boolean
}
```

```html
<app-toggle [(checked)]="enabled" />
```

Angular assigns to the property when the child emits. This works but is worse: a plain property does not notify anything, so with `OnPush` or zoneless the view may not update. Prefer a signal.

## ngModel is the same idea

`ngModel` from the forms module is two-way binding for native form controls.

```typescript
import { FormsModule } from '@angular/forms';

@Component({
  imports: [FormsModule],
  template: `
    <input [(ngModel)]="name" name="name">
    <p>Hello, {{ name() }}</p>
  `,
})
export class Greeting {
  protected readonly name = signal('');
}
```

Note `FormsModule` must be imported. It is one of the remaining NgModules in the framework.

## Watching for changes

Since a model is a signal, `effect` and `computed` work on it.

```typescript
export class Toggle {
  readonly checked = model(false);

  constructor() {
    effect(() => {
      console.log('now', this.checked());
    });
  }
}
```

Careful with an effect that writes back to the model. It can loop.

```typescript
// dangerous
effect(() => {
  if (this.checked()) this.checked.set(false);
});
```

If you need to constrain a value, do it where it is set rather than reacting afterwards.

## model or input plus output?

```text
model()                     input() + output()
one declaration             two declarations
enables [(x)]               the parent wires both halves
the child can set it        the child only emits
```

Use `model()` when the child genuinely owns the value and the parent just wants to follow along. Form controls, toggles, sliders, dialogs that manage their own open state.

Use `input()` plus `output()` when the parent should decide whether to accept the change. A delete button emits `deleted`, and the parent decides whether to actually delete.

The distinction is about authority. If the parent might refuse, do not use a model.

## Common mistakes

**Forgetting `xChange` when writing it by hand.**

```typescript
readonly value = input(0);
readonly changed = output<number>();     // wrong name, [(value)] will not work
readonly valueChange = output<number>(); // correct
```

**Binding a method call.**

```html
<app-toggle [(checked)]="getValue()" />   <!-- error, cannot assign to a call -->
<app-toggle [(checked)]="enabled" />      <!-- correct -->
```

Two-way binding needs something assignable.

**Passing the signal's value instead of the signal.**

```html
<app-toggle [(checked)]="enabled()" />    <!-- wrong, that reads the value -->
<app-toggle [(checked)]="enabled" />      <!-- correct, pass the signal itself -->
```

This one catches everyone. In a two-way binding you pass the signal, not its value. In a one-way binding you pass the value.

## Quick recap

- `model()` creates a writable signal both parent and child can set.
- `[(x)]` expands to `[x]` plus `(xChange)`, which is why the naming convention exists.
- Bind the two halves separately when the parent needs to veto a change.
- `model.required<T>()` works like `input.required`.
- `ngModel` is the same idea for native inputs, and needs `FormsModule`.
- Use `model()` when the child owns the value, `input` plus `output` when the parent decides.
- Pass the signal itself in a two-way binding, not `signal()`.

<code id="code-content" class="language-typescript">
import { Component, model, signal, effect } from '@angular/core';
@Component({
  selector: 'app-rating',
  template: `
    @for (star of stars; track star) {
      &lt;button (click)="rating.set(star)" [class.filled]="star &lt;= rating()"&gt;★&lt;/button&gt;
    }
  `,
})
export class Rating {
  // A WRITABLE input. The child can set it, and the parent follows along.
  readonly rating = model(0);
  protected readonly stars = [1, 2, 3, 4, 5];
}
@Component({
  selector: 'app-review-form',
  imports: [Rating],
  template: `
    &lt;!-- pass the SIGNAL, not signal(). This catches everyone once. --&gt;
    &lt;app-rating [(rating)]="score" /&gt;
    &lt;p&gt;You gave {{ score() }} stars.&lt;/p&gt;
    &lt;!-- the same thing written out. [(x)] is [x] plus (xChange). --&gt;
    &lt;app-rating [rating]="score()" (ratingChange)="onRated($event)" /&gt;
  `,
})
export class ReviewForm {
  protected readonly score = signal(0);
  // Binding the halves separately is how you VETO a change,
  // which plain two-way binding cannot do.
  protected onRated(value: number): void {
    if (value &lt;= 5) this.score.set(value);
  }
}
// Writing it by hand? The output MUST be the input name plus Change:
//   readonly value = input(0);
//   readonly valueChange = output&lt;number&gt;();     enables [(value)]
//   readonly changed = output&lt;number&gt;();         wrong name, will not work
// ngModel is the same idea for native inputs, and needs FormsModule:
//   imports: [FormsModule]
//   &lt;input [(ngModel)]="name" name="name"&gt;
// Choosing:
//   model()               the CHILD owns the value, parent follows
//   input() + output()    the PARENT decides whether to accept the change
// Mistakes:
//   [(checked)]="getValue()"   error, two-way binding needs something assignable
//   [(checked)]="enabled()"    wrong, pass the signal itself
</code></pre>
