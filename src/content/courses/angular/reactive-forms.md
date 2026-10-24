---
publishDate: 2026-06-18T10:50
title: Reactive Forms
slug: reactive-forms
metadescription: Build forms with FormGroup and FormControl, the API that most existing Angular applications use and that still works today.
updateDate: 2026-09-07T10:50
author: ['bishal-biswas']
level: 2
tags: ['forms', 'reactive forms', 'formgroup']
course: angular
---

## The form object comes first

Reactive forms build a form model in the class, then bind the template to it.

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <input formControlName="email" type="email">
      <input formControlName="password" type="password">

      <button [disabled]="form.invalid">Sign in</button>
    </form>
  `,
})
export class Login {
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected submit(): void {
    if (this.form.invalid) return;

    console.log(this.form.value);
  }
}
```

`ReactiveFormsModule` must be imported. It is one of the NgModules still in Angular itself.

Signal Forms are the newer approach and are stable in Angular 22. Reactive forms are **not deprecated**, they work fine, and the overwhelming majority of existing Angular code uses them.

## The building blocks

```typescript
new FormControl('initial value')          // one field
new FormGroup({ ... })                    // an object of controls
new FormArray([ ... ])                    // a list of controls
new FormRecord({ ... })                   // a group with dynamic keys
```

`FormBuilder` is shorthand for the same thing:

```typescript
// verbose
protected readonly form = new FormGroup({
  email: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  password: new FormControl('', { nonNullable: true }),
});

// with FormBuilder
protected readonly form = this.fb.group({
  email: ['', Validators.required],
  password: [''],
});

// nonNullable by default
private readonly fb = inject(NonNullableFormBuilder);
```

The array shorthand is `[initialValue, validators, asyncValidators]`.

## nonNullable matters

By default, calling `reset()` sets a control to `null`, so the type is `string | null`.

```typescript
const control = new FormControl('hello');
control.reset();
console.log(control.value);          // null, and the type says so

const better = new FormControl('hello', { nonNullable: true });
better.reset();
console.log(better.value);           // 'hello', the initial value
```

`NonNullableFormBuilder` applies it everywhere:

```typescript
private readonly fb = inject(NonNullableFormBuilder);

protected readonly form = this.fb.group({
  email: ['', Validators.required],    // typed string, not string | null
});
```

Use it. The `| null` on every field otherwise spreads through your whole codebase.

## Typed forms

Since Angular 14, forms are typed from their definition.

```typescript
protected readonly form = this.fb.group({
  name: [''],
  age: [0],
});

const value = this.form.value;
// { name?: string; age?: number }

const raw = this.form.getRawValue();
// { name: string; age: number }
```

`value` omits disabled controls, so every property is optional. `getRawValue()` includes them and is fully typed, which is usually what you want when submitting.

Accessing controls is typed too:

```typescript
this.form.controls.name.setValue('Asha');    // typed
this.form.get('name')?.setValue('Asha');      // works, but returns AbstractControl | null
```

Prefer `controls.name` over `get('name')`. The string version is not checked, so a typo compiles.

## Reading state

```typescript
this.form.value;
this.form.getRawValue();
this.form.valid;
this.form.invalid;
this.form.dirty;        // has been changed
this.form.pristine;
this.form.touched;      // has been blurred
this.form.pending;      // async validation running
this.form.errors;
this.form.status;       // 'VALID' | 'INVALID' | 'PENDING' | 'DISABLED'
```

Same properties on each control:

```typescript
this.form.controls.email.hasError('required');
this.form.controls.email.errors;
this.form.controls.email.touched;
```

## Showing errors

```html
<input formControlName="email" type="email">

@if (form.controls.email.touched && form.controls.email.invalid) {
  @if (form.controls.email.hasError('required')) {
    <p class="error">Email is required</p>
  }
  @if (form.controls.email.hasError('email')) {
    <p class="error">That is not a valid email address</p>
  }
}
```

Verbose, and it is one of the reasons signal forms exist. A common tidy up is a small component:

```typescript
@Component({
  selector: 'app-field-errors',
  template: `
    @if (control().touched && control().invalid) {
      @for (key of errorKeys(); track key) {
        <p class="error">{{ messages[key] ?? key }}</p>
      }
    }
  `,
})
export class FieldErrors {
  readonly control = input.required<AbstractControl>();

  protected readonly errorKeys = computed(() => Object.keys(this.control().errors ?? {}));

  protected readonly messages: Record<string, string> = {
    required: 'This field is required',
    email: 'Enter a valid email address',
    minlength: 'Too short',
  };
}
```

## Updating values

```typescript
this.form.setValue({ email: 'a@b.com', password: 'secret123' });   // every field required
this.form.patchValue({ email: 'a@b.com' });                        // partial

this.form.controls.email.setValue('a@b.com');

this.form.reset();
this.form.reset({ email: 'default@example.com', password: '' });
```

`setValue` throws if you miss a field, which catches mistakes. `patchValue` ignores missing and unknown keys silently, which is convenient and hides typos.

Loading a record into a form:

```typescript
protected load(user: User): void {
  this.form.patchValue({ name: user.name, email: user.email });
  this.form.markAsPristine();
}
```

`markAsPristine()` matters. Without it the form is dirty immediately, so an unsaved changes guard fires on a form nobody edited.

## Enabling and disabling

```typescript
this.form.controls.email.disable();
this.form.controls.email.enable();
this.form.disable();

this.form.controls.email.disable({ emitEvent: false });
```

A disabled control is **excluded from `value`** and from validation. That surprises people: a disabled field vanishes from the submitted object unless you use `getRawValue()`.

Do not set the `disabled` attribute in the template on a `formControlName` input. Angular warns about it, because the two mechanisms fight.

```html
<!-- wrong -->
<input formControlName="email" [disabled]="busy()">

<!-- right -->
```

```typescript
constructor() {
  effect(() => {
    const email = this.form.controls.email;
    this.busy() ? email.disable() : email.enable();
  });
}
```

## Watching for changes

```typescript
constructor() {
  this.form.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe(value => console.log(value));

  this.form.controls.country.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe(country => this.loadRegions(country));

  this.form.statusChanges
    .pipe(takeUntilDestroyed())
    .subscribe(status => console.log(status));
}
```

`valueChanges` emits on every keystroke. Debounce anything expensive:

```typescript
this.form.controls.search.valueChanges
  .pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(term => this.search(term)),
    takeUntilDestroyed(),
  )
  .subscribe(results => this.results.set(results));
```

Watch for loops: setting a value inside a `valueChanges` handler triggers it again. Use `{ emitEvent: false }`:

```typescript
this.form.controls.slug.setValue(slugify(title), { emitEvent: false });
```

## Bridging to signals

```typescript
protected readonly formValue = toSignal(this.form.valueChanges, {
  initialValue: this.form.getRawValue(),
});

protected readonly isValid = toSignal(
  this.form.statusChanges.pipe(map(s => s === 'VALID')),
  { initialValue: this.form.valid },
);
```

This is how reactive forms fit into a signal based component. It works, and it is more ceremony than signal forms need, which is the honest comparison.

## Nested groups

```typescript
protected readonly form = this.fb.group({
  name: [''],
  address: this.fb.group({
    line1: [''],
    city: [''],
    postcode: [''],
  }),
});
```

```html
<input formControlName="name">

<div formGroupName="address">
  <input formControlName="line1">
  <input formControlName="city">
</div>
```

`formGroupName` on the wrapper, then plain `formControlName` inside.

## Quick recap

- Reactive forms build the model in the class and bind the template to it.
- `ReactiveFormsModule` must be imported, and it is still an NgModule.
- Use `NonNullableFormBuilder` or every field is typed `| null`.
- `value` omits disabled controls, `getRawValue()` includes them.
- Prefer `form.controls.name` over `form.get('name')`, which is unchecked.
- Call `markAsPristine()` after loading data, or unsaved change guards misfire.
- Disable in the class, never with the `disabled` attribute in the template.

<code id="code-content" class="language-typescript">
import { Component, inject, effect, signal, computed } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators,
         AbstractControl } from '@angular/forms';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule],      // still an NgModule, must be imported
  template: `
    &lt;form [formGroup]="form" (ngSubmit)="submit()"&gt;
      &lt;input formControlName="email" type="email"&gt;
      &lt;!-- do NOT also set [disabled] here: the two mechanisms fight --&gt;
      @if (form.controls.email.touched &amp;&amp; form.controls.email.invalid) {
        @if (form.controls.email.hasError('required')) { &lt;p&gt;Email is required&lt;/p&gt; }
        @if (form.controls.email.hasError('email')) { &lt;p&gt;Not a valid email&lt;/p&gt; }
      }
      &lt;div formGroupName="address"&gt;
        &lt;input formControlName="city"&gt;
      &lt;/div&gt;
      &lt;button [disabled]="form.invalid"&gt;Save&lt;/button&gt;
    &lt;/form&gt;
  `,
})
export class UserForm {
  // NonNullableFormBuilder, or reset() sets null and every field is `| null`
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly busy = signal(false);
  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    address: this.fb.group({ city: [''] }),
  });
  constructor() {
    // valueChanges fires on EVERY keystroke. Debounce anything expensive.
    this.form.controls.email.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(v =&gt; console.log(v));
    // Disable in the CLASS, not with a template attribute
    effect(() =&gt; this.busy()
      ? this.form.controls.email.disable()
      : this.form.controls.email.enable());
  }
  protected load(user: { email: string }): void {
    this.form.patchValue({ email: user.email });
    // Without this the form is dirty immediately and unsaved change
    // guards fire on a form nobody edited.
    this.form.markAsPristine();
  }
  protected submit(): void {
    if (this.form.invalid) return;
    // value OMITS disabled controls and types every field optional.
    // getRawValue() includes them and is fully typed.
    console.log(this.form.getRawValue());
  }
  // Setting a value inside a valueChanges handler loops. Suppress the event:
  protected syncSlug(title: string): void {
    this.form.controls.email.setValue(title, { emitEvent: false });
  }
  // Bridging into a signal based component
  protected readonly isValid = toSignal(
    this.form.statusChanges.pipe(map(s =&gt; s === 'VALID')),
    { initialValue: this.form.valid });
}
// form.controls.name is TYPED. form.get('name') is an unchecked string
// lookup returning AbstractControl | null. Prefer controls.
// setValue requires EVERY field. patchValue ignores missing and unknown
// keys silently, which is convenient and hides typos.
</code></pre>
