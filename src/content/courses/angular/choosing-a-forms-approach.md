---
publishDate: 2026-06-19T11:10
title: Choosing Between Signal Forms and Reactive Forms
slug: choosing-a-forms-approach
metadescription: Compare template driven, reactive and signal forms, and pick the right one for a new form or an existing codebase.
updateDate: 2026-09-07T11:10
author: ['bishal-biswas']
level: 2
tags: ['forms', 'comparison', 'decision']
course: angular
---

## Three approaches, all supported

Angular 22 ships three form APIs, and none of them are deprecated.

```text
Template driven   ngModel and directives in the template
Reactive          FormGroup and FormControl built in the class
Signal forms      form() derived from a signal model
```

That sounds like too many. In practice the decision is simple, and this topic is the short version.

## The same form, three ways

**Template driven:**

```typescript
@Component({
  imports: [FormsModule],
  template: `
    <form #f="ngForm" (ngSubmit)="save(f)">
      <input name="email" [(ngModel)]="email" required email>
      <button [disabled]="f.invalid">Save</button>
    </form>
  `,
})
export class Contact {
  protected readonly email = signal('');
}
```

**Reactive:**

```typescript
@Component({
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()">
      <input formControlName="email">
      <button [disabled]="form.invalid">Save</button>
    </form>
  `,
})
export class Contact {
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });
}
```

**Signal forms:**

```typescript
@Component({
  imports: [FormField],
  template: `
    <form (ngSubmit)="save()">
      <input [formField]="contactForm.email">
      <button [disabled]="contactForm().invalid()">Save</button>
    </form>
  `,
})
export class Contact {
  protected readonly model = signal({ email: '' });

  protected readonly contactForm = form(this.model, path => {
    required(path.email);
    email(path.email);
  });
}
```

Similar length for something this small. The differences appear as forms grow.

## The comparison

```text
                        Template driven   Reactive        Signal forms
Where the model lives   the template      the class       a signal
Validation              HTML attributes   functions       schema functions
Custom validators       a directive       a function      a function
Cross field rules       awkward           group validator ctx.valueOf
Dynamic fields          weak              FormArray       update the model
Testing without DOM     no                yes             yes
Type safety             none              good            excellent
Works with signals      via ngModel       via toSignal    natively
Reads the value         f.value           form.value      model()
Ecosystem support       full              full            growing
```

Two rows matter most in practice.

**Dynamic fields.** `FormArray` requires keeping controls and data in step, which is a persistent source of bugs. Signal forms add and remove by updating a plain array in the model, and the form follows.

**Type safety.** Reactive forms are typed but `form.get('name')` is an unchecked string. Signal forms type every path from the model, so `path.emial` is a compile error.

## Choosing for new code

**Signal forms** for anything new in Angular 22, unless something below applies.

**Reactive forms** when:

- The team is not ready to learn a new API, and consistency matters more.
- You depend on a library built around `FormGroup`, and it has no signal forms support yet.
- The codebase is already entirely reactive forms and this form sits beside them.

**Template driven** for genuinely trivial forms in a codebase that already uses them. Even then, signal forms are about the same amount of code and scale better.

## Choosing for an existing codebase

**Do not migrate working forms for the sake of it.** Reactive forms are supported, not deprecated, and rewriting a complex form is a genuine risk with no user visible benefit.

Sensible triggers to migrate one:

- You are already substantially rewriting it.
- Its `FormArray` handling has become a source of bugs.
- The cross field validation is hard to follow.
- You are adding signals throughout the component anyway.

**Do not mix approaches in one form.** Mixing them across a codebase during migration is fine and unavoidable. Mixing them inside a single form is not.

## What carries over

Two things reduce the cost of moving.

**Custom controls.** `[formField]` accepts existing `ControlValueAccessor` components, including everything in Angular Material. Your control library does not need rewriting.

```html
<input matInput [formField]="userForm.email">
<app-old-datepicker [formField]="userForm.startDate" />
```

**Validation logic.** A reactive validator and a signal forms validator are both functions taking a value and returning errors. The shape differs slightly, but the actual rule copies across.

## What does not carry over

**`valueChanges` subscriptions.** Signal forms have no observable. The model is a signal, so you use `computed` and `effect` instead. That is usually simpler, but it is a rewrite rather than a translation.

**`FormArray` manipulation.** `push`, `removeAt` and `insert` become array updates on the model.

**Anything reading `form.get('x')`.** Paths are typed and direct.

## A practical rule

If you are asking which to use, the answer is usually **signal forms for new work, leave existing reactive forms alone**.

The exception is a team with a large reactive forms codebase and no appetite for a second API. Consistency has real value, and a codebase using one approach well beats one using two approaches half way.

## Do not roll your own

A fourth option people reach for: plain signals with no forms API at all.

```typescript
protected readonly email = signal('');
protected readonly emailError = computed(() =>
  this.email().includes('@') ? null : 'Invalid email'
);
```

For two fields this is fine and honest. It stops being fine when you need touched state, submit handling, nested objects, arrays, async validation and accessibility attributes, all of which a forms API already solves.

The threshold is roughly: more than three fields, or any validation that depends on another field.

## Quick recap

- All three APIs are supported and none are deprecated.
- Signal forms are the default for new work in Angular 22.
- Reactive forms remain the right choice for consistency with an existing codebase.
- Template driven forms suit only trivial static forms.
- Dynamic fields and type safety are where signal forms win most clearly.
- Existing `ControlValueAccessor` controls work with `[formField]` unchanged.
- Do not migrate working forms without a reason beyond fashion.

<code id="code-content" class="language-typescript">
import { Component, signal, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { form, required, email, FormField } from '@angular/forms/signals';
// TEMPLATE DRIVEN: the model is built from directives in the template
@Component({
  selector: 'app-a', imports: [FormsModule],
  template: `&lt;form #f="ngForm"&gt;&lt;input name="email" [(ngModel)]="value" required email&gt;&lt;/form&gt;`,
})
export class TemplateDriven { protected readonly value = signal(''); }
// REACTIVE: the model is built in the class
@Component({
  selector: 'app-b', imports: [ReactiveFormsModule],
  template: `&lt;form [formGroup]="form"&gt;&lt;input formControlName="email"&gt;&lt;/form&gt;`,
})
export class Reactive {
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });
  // form.get('email') is an UNCHECKED string. form.controls.email is typed.
}
// SIGNAL FORMS: the model IS a signal, and the form is derived from it
@Component({
  selector: 'app-c', imports: [FormField],
  template: `&lt;input [formField]="contactForm.email"&gt;`,
})
export class Signals {
  protected readonly model = signal({ email: '' });
  protected readonly contactForm = form(this.model, path =&gt; {
    required(path.email);
    email(path.email);        // path.emial would be a COMPILE ERROR
  });
}
// Where they differ most:
//   dynamic fields   FormArray push/removeAt  vs  update the model array
//   type safety      get('x') is unchecked    vs  every path typed
//   testing          both reactive and signal forms test without the DOM
//   cross field      group validator          vs  ctx.valueOf(path.other)
// CHOOSING:
//   new work in v22            -&gt; signal forms
//   large reactive codebase    -&gt; stay consistent, reactive forms
//   trivial static form        -&gt; any of them, signal forms is no longer
//   working existing form      -&gt; leave it alone
// Mixing approaches ACROSS a codebase during migration is fine.
// Mixing them INSIDE one form is not.
// What carries over: your ControlValueAccessor controls work unchanged,
//   &lt;input matInput [formField]="userForm.email"&gt;
// What does not: valueChanges subscriptions become computed/effect,
//   and FormArray manipulation becomes plain array updates.
// Rolling your own with bare signals is honest for two or three fields.
// Past that you will reimplement touched state, submit handling, nested
// objects, arrays, async validation and ARIA attributes. Use the API.
</code></pre>
