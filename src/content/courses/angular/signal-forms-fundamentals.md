---
publishDate: 2026-06-17T10:30
title: 'Signal Forms: form, FormField and Schemas'
slug: signal-forms-fundamentals
metadescription: Build forms from a signal model with form and FormField, the signal based forms API that became stable in Angular 22.
updateDate: 2026-09-07T10:30
author: ['bishal-biswas']
level: 2
tags: ['signal forms', 'forms', 'signals']
course: angular
---

## A form derived from a signal

Signal Forms became stable in Angular 22. The idea: your data is a signal, and the form is derived from it.

```typescript
import { Component, signal } from '@angular/core';
import { form, required, minLength, FormField } from '@angular/forms/signals';

@Component({
  selector: 'app-login',
  imports: [FormField],
  template: `
    <input [formField]="loginForm.email" type="email">
    <input [formField]="loginForm.password" type="password">

    <button [disabled]="loginForm().invalid()">Sign in</button>
  `,
})
export class Login {
  protected readonly credentials = signal({ email: '', password: '' });

  protected readonly loginForm = form(this.credentials, path => {
    required(path.email);
    required(path.password);
    minLength(path.password, 8);
  });
}
```

The model is the single source of truth. Typing in the input updates the signal, and setting the signal updates the input.

Note the import path: `@angular/forms/signals`, a separate entry point from the classic `@angular/forms`.

## The two arguments to form

```typescript
const myForm = form(modelSignal, schemaCallback);
```

**The model** is a writable signal holding an object describing the form's shape.

**The schema** is a callback receiving a `path` object that mirrors the model. You attach validation and behaviour to paths on it.

```typescript
protected readonly model = signal({
  name: '',
  email: '',
  age: 0,
});

protected readonly userForm = form(this.model, path => {
  required(path.name);
  required(path.email);
  email(path.email);
  min(path.age, 18);
});
```

`path.name` is typed from the model, so a typo is a compile error rather than a silent no-op.

## Never initialise with null

This is the rule that catches everyone.

```typescript
// wrong
signal({ name: null, age: null, tags: null });

// right
signal({ name: '', age: 0, tags: [] as string[] });
```

The form structure is derived from the model's shape. A `null` gives it nothing to work with. Use an empty string for text, `0` for numbers and `[]` for arrays.

## FormField versus FieldState

The distinction that trips people up.

```typescript
loginForm.email          // FormField: the structure
loginForm.email()        // FieldState: the signals
loginForm.email().value()   // the actual value
```

**Calling a field as a function gives you its state.** The field itself is structural and has no `valid` or `errors` on it.

```typescript
loginForm.email().valid()      // correct
loginForm.email.valid()        // wrong, FormField has no such method
```

Once that clicks, the rest of the API follows.

## Reading field state

```typescript
const email = this.loginForm.email();

email.value();      // the current value
email.valid();      // passes every validator
email.invalid();
email.errors();     // an array of validation errors
email.touched();    // has been blurred
email.dirty();      // has been changed
email.disabled();
email.readonly();
email.hidden();
```

The whole form has the same state:

```typescript
this.loginForm().valid();
this.loginForm().value();     // the model object
this.loginForm().dirty();
```

## In templates

```html
<label>
  Email
  <input [formField]="loginForm.email" type="email">
</label>

@if (loginForm.email().touched() && loginForm.email().invalid()) {
  @for (error of loginForm.email().errors(); track error.kind) {
    <p class="error">{{ error.message ?? error.kind }}</p>
  }
}
```

Checking `touched()` before showing errors is what stops every field turning red the moment the form appears.

`[formField]` handles the two way binding, and also syncs `required`, `disabled` and `readonly` onto the element. So do **not** set those attributes yourself:

```html
<!-- wrong, it fights the directive -->
<input [formField]="form.email" [disabled]="busy()" required>

<!-- right, express it in the schema -->
<input [formField]="form.email">
```

```typescript
form(this.model, path => {
  required(path.email);
  disabled(path.email, () => this.busy());
});
```

Also avoid `[value]` on text and number inputs, since the directive owns the value. The exception is radios and checkboxes, where `value` identifies which option the input represents.

## Reusable schemas

```typescript
import { schema } from '@angular/forms/signals';

export const addressSchema = schema<Address>(path => {
  required(path.line1);
  required(path.city);
  required(path.postcode);
  pattern(path.postcode, /^[A-Z0-9 ]{5,8}$/i);
});
```

```typescript
protected readonly deliveryForm = form(this.address, addressSchema);
```

The same schema can be applied to a nested part of a larger form with `apply`, which the nested fields topic covers.

## Submitting

```typescript
import { submit } from '@angular/forms/signals';

@Component({
  template: `
    <form (ngSubmit)="save()">
      <input [formField]="userForm.name">
      <button [disabled]="userForm().invalid()">Save</button>
    </form>
  `,
})
export class UserForm {
  private readonly http = inject(HttpClient);

  protected readonly model = signal({ name: '' });
  protected readonly userForm = form(this.model, path => required(path.name));

  protected async save(): Promise<void> {
    await submit(this.userForm, async () => {
      await firstValueFrom(this.http.post('/api/users', this.model()));
    });
  }
}
```

`submit` marks every field as touched before running, so validation errors appear for fields the user never visited. That is exactly what you want when someone clicks Save on an empty form.

The callback must be `async` and return a promise.

## Resetting

```typescript
protected reset(): void {
  this.model.set({ name: '', email: '' });
}
```

Because the model is the source of truth, resetting is just setting the signal. There is no separate form reset to remember.

Loading an existing record works the same way:

```typescript
protected load(user: User): void {
  this.model.set({ name: user.name, email: user.email });
}
```

## Compared with reactive forms

```text
Reactive forms                     Signal forms
new FormGroup({ ... })             signal({ ... }) + form()
FormControl, FormGroup, FormArray  none of these
form.get('email')                  form.email
form.value                         model() or form().value()
valueChanges observable            the model signal itself
Validators.required                required(path.email)
[formControlName]="'email'"        [formField]="form.email"
form.controls['email'].errors      form.email().errors()
```

The biggest practical difference: there is no separate form object holding a copy of the data. The model **is** the data, so there is nothing to keep in sync.

## Quick recap

- Signal Forms are stable in Angular 22 and live in `@angular/forms/signals`.
- `form(model, schema)` derives a form from a writable signal.
- Never initialise model fields with `null`, use `''`, `0` and `[]`.
- Call a field as a function to reach its state: `form.email().valid()`.
- `[formField]` handles binding and syncs required, disabled and readonly.
- Do not set `disabled`, `required` or `[value]` yourself, express them in the schema.
- `submit` marks every field touched, so errors appear on an untouched form.

<code id="code-content" class="language-typescript">
import { Component, signal, inject } from '@angular/core';
import { form, schema, submit, required, email, minLength, min, disabled,
         FormField } from '@angular/forms/signals';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
@Component({
  selector: 'app-user-form',
  imports: [FormField],
  template: `
    &lt;form (ngSubmit)="save()"&gt;
      &lt;!-- [formField] owns the value AND syncs required/disabled/readonly.
           Do NOT also set [value], [disabled] or required yourself. --&gt;
      &lt;input [formField]="userForm.name"&gt;
      &lt;input [formField]="userForm.email" type="email"&gt;
      &lt;!-- checking touched() stops every field turning red immediately --&gt;
      @if (userForm.email().touched() &amp;&amp; userForm.email().invalid()) {
        @for (error of userForm.email().errors(); track error.kind) {
          &lt;p class="error"&gt;{{ error.message ?? error.kind }}&lt;/p&gt;
        }
      }
      &lt;button [disabled]="userForm().invalid()"&gt;Save&lt;/button&gt;
    &lt;/form&gt;
  `,
})
export class UserForm {
  private readonly http = inject(HttpClient);
  protected readonly busy = signal(false);
  // NEVER initialise with null. The form shape is derived from the model.
  // Use '' for text, 0 for numbers, [] for arrays.
  protected readonly model = signal({ name: '', email: '', age: 0 });
  protected readonly userForm = form(this.model, path =&gt; {
    required(path.name);
    required(path.email);
    email(path.email);
    min(path.age, 18);
    disabled(path.email, () =&gt; this.busy());   // express it HERE, not in the template
  });
  protected async save(): Promise&lt;void&gt; {
    // submit marks EVERY field touched first, so errors show on an
    // untouched form. The callback must be async.
    await submit(this.userForm, async () =&gt; {
      await firstValueFrom(this.http.post('/api/users', this.model()));
    });
  }
  // The model IS the data, so resetting and loading are just signal sets
  protected reset(): void { this.model.set({ name: '', email: '', age: 0 }); }
}
// THE KEY DISTINCTION: FormField is structural, FieldState holds the signals.
// CALL the field to reach its state:
//   userForm.email          FormField, the structure
//   userForm.email()        FieldState
//   userForm.email().value()   valid()  invalid()  errors()  touched()  dirty()
//   userForm.email.valid()     WRONG, FormField has no such method
// Reusable schemas compose into larger forms:
const addressSchema = schema&lt;{ city: string }&gt;(path =&gt; required(path.city));
</code></pre>
