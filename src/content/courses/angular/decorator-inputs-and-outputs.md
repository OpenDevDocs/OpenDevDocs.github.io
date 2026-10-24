---
publishDate: 2026-06-08T08:10
title: Decorator Inputs and Outputs with EventEmitter
slug: decorator-inputs-and-outputs
metadescription: Read and maintain the at-Input and at-Output decorators you will meet in existing codebases, and know how they map to signals.
updateDate: 2026-09-07T08:10
author: ['bishal-biswas']
level: 2
tags: ['legacy', 'inputs', 'outputs']
course: angular
---

## The decorators you will still meet

Before `input()` and `output()`, component communication used decorators. Most existing Angular code does.

```typescript
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-user-card',
  template: `
    <h3>{{ name }}</h3>
    <button (click)="deleted.emit(id)">Delete</button>
  `,
})
export class UserCardComponent {
  @Input() name = '';
  @Input() id = 0;
  @Output() deleted = new EventEmitter<number>();
}
```

```html
<app-user-card [name]="user.name" [id]="user.id" (deleted)="remove($event)" />
```

The template usage is **identical** to the signal version. Only the declaration differs.

## Input options

```typescript
@Input() name = '';                                    // optional, with a default
@Input({ required: true }) user!: User;                // required
@Input({ alias: 'label' }) buttonText = '';            // different external name
@Input({ transform: booleanAttribute }) disabled = false;
@Input({ transform: numberAttribute }) count = 0;
```

`required: true` arrived in Angular 16. It is checked at compile time, but the property is still typed as if it always exists, which is why the `!` is needed. `input.required()` handles this better.

## The setter pattern

Reacting to an input change with a decorator meant a setter.

```typescript
export class SearchComponent {
  private _term = '';

  @Input()
  set term(value: string) {
    this._term = value.trim().toLowerCase();
    this.runSearch();
  }
  get term(): string {
    return this._term;
  }

  private runSearch(): void { ... }
}
```

This works, and it has real problems. The backing field is boilerplate. The setter runs during change detection, so doing anything heavy is expensive. And it is easy to write a setter that triggers another change.

The signal version:

```typescript
readonly term = input('', { transform: (v: string) => v.trim().toLowerCase() });

constructor() {
  effect(() => this.runSearch(this.term()));
}
```

## ngOnChanges

The other way to react, useful when several inputs matter together.

```typescript
export class ChartComponent implements OnChanges {
  @Input() data: number[] = [];
  @Input() colour = 'blue';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['colour']) {
      this.redraw();
    }

    if (changes['data']?.firstChange) {
      this.initialise();
    }

    const previous = changes['data']?.previousValue;
    const current = changes['data']?.currentValue;
  }
}
```

`SimpleChanges` is a plain object keyed by input name, so `changes['data']` is a string lookup with no type checking. Rename the input and the check silently stops working.

Each entry has `previousValue`, `currentValue` and `firstChange`.

## EventEmitter

```typescript
@Output() saved = new EventEmitter<User>();
@Output() closed = new EventEmitter<void>();
@Output('change') valueChanged = new EventEmitter<string>();

save(): void {
  this.saved.emit(this.user);
}

close(): void {
  this.closed.emit();
}
```

`EventEmitter` extends RxJS `Subject`, which was a design accident with consequences. It means an output can be subscribed to, and also completed or errored from outside the component, which nobody wants.

```typescript
// technically possible, and a bad idea
this.child.saved.complete();
this.child.saved.error(new Error());
```

`output()` removed that surface entirely.

## Two-way binding

The convention is the same in both worlds: an input `x` plus an output `xChange`.

```typescript
export class ToggleComponent {
  @Input() checked = false;
  @Output() checkedChange = new EventEmitter<boolean>();

  toggle(): void {
    this.checked = !this.checked;
    this.checkedChange.emit(this.checked);
  }
}
```

```html
<app-toggle [(checked)]="enabled" />
```

Note the child mutates its own `checked` **and** emits. Forgetting either half causes a subtle desynchronisation. `model()` removes the whole class of bug.

## The mapping

```typescript
// decorators                              signals
@Input() name = '';                        readonly name = input('');
@Input({ required: true }) user!: User;    readonly user = input.required<User>();
@Input({ alias: 'label' }) text = '';      readonly text = input('', { alias: 'label' });
@Input({ transform: booleanAttribute })    readonly x = input(false, { transform: booleanAttribute });
  disabled = false;

@Input() set term(v: string) {             readonly term = input('', {
  this._term = v.trim();                     transform: (v: string) => v.trim() });
}

ngOnChanges() { this.redraw(); }           effect(() => this.redraw(this.data()));

@Output() saved = new EventEmitter<User>(); readonly saved = output<User>();
@Input() checked = false;                   readonly checked = model(false);
@Output() checkedChange = new EventEmitter<boolean>();
```

## Migrating

```bash
ng generate @angular/core:signal-input-migration
ng generate @angular/core:output-migration
```

The input migration converts declarations, adds `()` at every read site including templates, and handles required and aliased inputs. It skips inputs with setters or complex logic, leaving those for you.

Run one migration at a time, build, run the tests, commit. Reviewing a mixed diff of both is unpleasant.

## What to watch for

**Reads inside `ngOnChanges`.** A signal input does not fire it reliably. If a component uses `ngOnChanges`, convert the inputs and the hook together.

**Writes to an input.** Some code assigns to its own inputs, usually with two-way binding. That becomes `model()`, not `input()`.

```typescript
@Input() value = '';
onChange(v: string) { this.value = v; }     // becomes model()
```

**Inputs read in a constructor.** Decorator inputs are undefined there too, so this was already a latent bug, but it becomes a compile error with signals.

**Template reads.** Every `{{ name }}` becomes `{{ name() }}`. The migration handles it, but a hand written template string somewhere will not be caught.

## Should you migrate?

Not for its own sake. Decorator inputs work perfectly well in Angular 22.

Worth doing when:

- The component is being converted to signals anyway.
- You want it working properly with zoneless and `OnPush`.
- Setters and `ngOnChanges` have become hard to follow.
- You need `input.required` for genuine compile time safety.

Not worth doing to a stable component nobody touches.

## Quick recap

- `@Input()` and `@Output()` still work and are all over existing code.
- Template usage is identical, only the declaration differs.
- `@Input({ required: true })` is checked at compile time but still needs `!`.
- Reacting to input changes meant a setter or `ngOnChanges`, both awkward.
- `EventEmitter` is an RxJS Subject, which exposed completion and errors by accident.
- Two-way binding needs the child to both mutate and emit, which `model()` handles.
- Migrate with the CLI schematics, one at a time, and convert `ngOnChanges` alongside.

<code id="code-content" class="language-typescript">
import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
         booleanAttribute, numberAttribute } from '@angular/core';
// The decorator style. Template usage is IDENTICAL to signals.
@Component({
  selector: 'app-user-card',
  template: `&lt;h3&gt;{{ name }}&lt;/h3&gt;&lt;button (click)="deleted.emit(id)"&gt;Delete&lt;/button&gt;`,
})
export class UserCardComponent implements OnChanges {
  @Input() name = '';
  @Input() id = 0;
  @Input({ required: true }) user!: User;         // ! is still needed
  @Input({ alias: 'label' }) buttonText = '';
  @Input({ transform: booleanAttribute }) disabled = false;
  @Input({ transform: numberAttribute }) count = 0;
  @Output() deleted = new EventEmitter&lt;number&gt;();
  @Output() closed = new EventEmitter&lt;void&gt;();
  // Two-way binding: the child must BOTH mutate and emit. Miss either half
  // and the two sides quietly drift apart. model() removes this whole bug class.
  @Input() checked = false;
  @Output() checkedChange = new EventEmitter&lt;boolean&gt;();
  toggle() { this.checked = !this.checked; this.checkedChange.emit(this.checked); }
  // Reacting to a change: a setter, or ngOnChanges with STRING keys
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['name']) this.redraw();          // rename the input and this
    if (changes['name']?.firstChange) this.init();  // silently stops working
    const before = changes['name']?.previousValue;
  }
  private redraw() {}
  private init() {}
}
// The mapping to signals:
//   @Input() name = ''                  -&gt;  readonly name = input('')
//   @Input({required:true}) u!: User     -&gt;  readonly u = input.required&lt;User&gt;()
//   @Input() set term(v) { ... }         -&gt;  input('', { transform: ... })
//   ngOnChanges { this.redraw() }        -&gt;  effect(() =&gt; this.redraw(this.data()))
//   @Output() s = new EventEmitter&lt;T&gt;()  -&gt;  readonly s = output&lt;T&gt;()
//   @Input() x + @Output() xChange       -&gt;  readonly x = model(...)
// EventEmitter extends an RxJS Subject, so callers could complete or error it.
// output() removed that surface entirely.
// Migrate one at a time, building and committing between:
//   ng generate @angular/core:signal-input-migration
//   ng generate @angular/core:output-migration
// Convert ngOnChanges ALONGSIDE the inputs. It does not fire reliably for signals.
interface User { name: string; }
</code></pre>
