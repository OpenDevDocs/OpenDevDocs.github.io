---
publishDate: 2026-06-06T07:25
title: Signal Inputs with input()
slug: signal-inputs
metadescription: Declare component inputs as signals with input(), make them required, transform incoming values and derive from them.
updateDate: 2026-09-07T07:25
author: ['bishal-biswas']
level: 1
tags: ['signals', 'inputs', 'components']
course: angular
---

## Inputs as signals

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-user-card',
  template: `
    <h3>{{ name() }}</h3>
    <p>{{ email() }}</p>
  `,
})
export class UserCard {
  readonly name = input<string>('');
  readonly email = input<string>('');
}
```

```html
<app-user-card name="Asha" email="asha@example.com" />
```

`input()` returns a **read only signal**. The parent sets it, the child reads it with brackets.

The child cannot write to it, which is exactly right. Data flows down.

## Optional, with a default

```typescript
readonly size = input<'small' | 'large'>('small');   // type and default
readonly count = input(0);                            // type inferred as number
readonly items = input<string[]>([]);
```

Without a default, the type includes `undefined`:

```typescript
readonly label = input<string>();       // Signal<string | undefined>
```

```html
<p>{{ label() ?? 'No label' }}</p>
```

## Required inputs

```typescript
readonly user = input.required<User>();
```

Now the type is `Signal<User>` with no `undefined`, and forgetting to pass it is a **compile error**:

```html
<app-user-card />                    <!-- error: required input user -->
<app-user-card [user]="current()" /> <!-- fine -->
```

This is a real improvement over the decorator version, where a missing input silently produced `undefined` at runtime.

Prefer `input.required` whenever the component cannot sensibly work without the value.

## Aliasing

```typescript
readonly userName = input<string>('', { alias: 'name' });
```

```html
<app-user-card name="Asha" />
```

Useful when a good internal property name clashes with something, or when keeping an old public name during a refactor. Use it sparingly, since two names for one thing is confusing.

## Transforms

A transform converts the incoming value before it reaches the signal.

```typescript
import { input, booleanAttribute, numberAttribute } from '@angular/core';

export class Card {
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly index = input(0, { transform: numberAttribute });
  readonly title = input('', { transform: (v: string) => v.trim() });
}
```

`booleanAttribute` is the useful one. It makes the input behave like a native HTML boolean attribute:

```html
<app-card disabled />                <!-- true, no value needed -->
<app-card disabled="true" />         <!-- true -->
<app-card [disabled]="isLocked()" /> <!-- the actual boolean -->
<app-card />                          <!-- false -->
```

Without it, `disabled` on its own passes the empty string, which is falsy, so the attribute would do the opposite of what it looks like.

`numberAttribute` turns `"5"` into `5`, which matters when a value comes from an attribute rather than a binding.

## Deriving from an input

Inputs are signals, so `computed` works on them directly.

```typescript
@Component({
  selector: 'app-user-card',
  template: `
    <h3>{{ displayName() }}</h3>
    @if (isAdmin()) { <span class="badge">Admin</span> }
  `,
})
export class UserCard {
  readonly user = input.required<User>();

  protected readonly displayName = computed(
    () => `${this.user().firstName} ${this.user().lastName}`
  );

  protected readonly isAdmin = computed(() => this.user().role === 'admin');
}
```

No lifecycle hook needed. With the decorator version this meant `ngOnChanges` or a setter, and getting it wrong was easy.

## Reacting to an input change

When you need a side effect rather than a derived value, use an effect.

```typescript
export class Chart {
  readonly data = input.required<number[]>();

  constructor() {
    effect(() => {
      this.redraw(this.data());
    });
  }

  private redraw(data: number[]): void { ... }
}
```

The effect runs when the component is created and again whenever `data` changes.

## Inputs from route parameters

With `withComponentInputBinding()`, route params, query params and resolved data are bound straight to inputs.

```typescript
provideRouter(routes, withComponentInputBinding())
```

```typescript
export const routes: Routes = [
  { path: 'users/:id', component: UserDetail },
];
```

```typescript
@Component({ ... })
export class UserDetail {
  readonly id = input.required<string>();   // filled from the :id segment
}
```

No `ActivatedRoute` subscription, no unsubscribing. This is one of the nicest things about modern Angular routing.

## What changed from at-Input

```typescript
// old
@Input() name = '';
@Input({ required: true }) user!: User;
@Input({ transform: booleanAttribute }) disabled = false;

@Input() set value(v: string) {
  this.internal = v.trim();
}

ngOnChanges(changes: SimpleChanges): void {
  if (changes['user']) this.recalculate();
}
```

```typescript
// new
readonly name = input('');
readonly user = input.required<User>();
readonly disabled = input(false, { transform: booleanAttribute });

readonly value = input('', { transform: (v: string) => v.trim() });

// no ngOnChanges needed
protected readonly derived = computed(() => this.recalculate(this.user()));
```

The gains: required inputs are enforced by the compiler, derived values use `computed` instead of hooks, and everything works with `OnPush` and zoneless without extra thought.

Migrate with:

```bash
ng generate @angular/core:signal-input-migration
```

## Mixing the two

A component can use both during a migration. What you cannot do is use a signal input from `ngOnChanges` reliably, since the ordering is not what you expect. If you are converting a component, convert its inputs together.

## Common mistakes

**Forgetting the brackets.**

```html
{{ name }}     <!-- prints the signal function -->
{{ name() }}   <!-- prints the value -->
```

**Trying to write to an input.**

```typescript
this.name.set('x');    // error, inputs are read only
```

If the child must change the value, use `model()` for two-way binding, or emit an output and let the parent decide.

**Using an input in a field initialiser.**

```typescript
readonly user = input.required<User>();
readonly name = this.user().name;      // error, no value yet
readonly name = computed(() => this.user().name);   // correct
```

Inputs have no value until the first binding runs, so read them inside `computed` or `effect`.

## Quick recap

- `input()` creates a read only signal that the parent sets.
- `input.required<T>()` makes a missing input a compile error and removes `undefined`.
- `transform: booleanAttribute` makes an input behave like a native boolean attribute.
- Derive from inputs with `computed`, which replaces `ngOnChanges`.
- Use `effect` when an input change needs a side effect.
- `withComponentInputBinding()` binds route parameters straight to inputs.
- Read inputs inside `computed` or `effect`, never in a field initialiser.

<code id="code-content" class="language-typescript">
import { Component, input, computed, effect, booleanAttribute, numberAttribute } from '@angular/core';
interface User { firstName: string; lastName: string; role: string; }
@Component({
  selector: 'app-user-card',
  template: `
    &lt;h3&gt;{{ displayName() }}&lt;/h3&gt;
    &lt;p&gt;{{ label() ?? 'No label' }}&lt;/p&gt;
    @if (isAdmin()) { &lt;span class="badge"&gt;Admin&lt;/span&gt; }
  `,
})
export class UserCard {
  // Required: missing it is a COMPILE ERROR, and the type has no undefined
  readonly user = input.required&lt;User&gt;();
  // Optional with a default. Without a default the type includes undefined.
  readonly size = input&lt;'small' | 'large'&gt;('small');
  readonly label = input&lt;string&gt;();               // Signal&lt;string | undefined&gt;
  // booleanAttribute makes it behave like a native HTML boolean attribute:
  //   &lt;app-user-card disabled /&gt;  is true, not the empty string
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly index = input(0, { transform: numberAttribute });   // "5" -&gt; 5
  readonly title = input('', { transform: (v: string) =&gt; v.trim() });
  readonly userName = input('', { alias: 'name' });            // external name
  // Derive with computed. This replaces ngOnChanges entirely.
  protected readonly displayName = computed(
    () =&gt; `${this.user().firstName} ${this.user().lastName}`);
  protected readonly isAdmin = computed(() =&gt; this.user().role === 'admin');
  constructor() {
    // Use an effect only when a change needs a SIDE EFFECT
    effect(() =&gt; console.log('user changed', this.user()));
  }
}
// Route params straight into inputs, no ActivatedRoute subscription needed:
//   provideRouter(routes, withComponentInputBinding())
//   { path: 'users/:id', component: UserDetail }
//   readonly id = input.required&lt;string&gt;();
// Mistakes:
//   {{ name }}                  prints the function, you want {{ name() }}
//   this.name.set('x')          error, inputs are READ ONLY. Use model().
//   readonly n = this.user().name;   error, no value yet. Use computed().
// Migrate with:  ng generate @angular/core:signal-input-migration
</code></pre>
