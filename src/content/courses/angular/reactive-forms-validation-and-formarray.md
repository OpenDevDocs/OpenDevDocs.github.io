---
publishDate: 2026-06-19T10:55
title: Reactive Forms Validation and FormArray
slug: reactive-forms-validation-and-formarray
metadescription: Validate reactive forms with built in and custom validators, cross field rules, async checks and dynamic FormArray fields.
updateDate: 2026-09-07T10:55
author: ['bishal-biswas']
level: 2
tags: ['forms', 'validation', 'formarray']
course: angular
---

## Built in validators

```typescript
import { Validators } from '@angular/forms';

protected readonly form = this.fb.group({
  name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
  email: ['', [Validators.required, Validators.email]],
  age: [0, [Validators.required, Validators.min(18), Validators.max(120)]],
  website: ['', Validators.pattern(/^https?:\/\//)],
  terms: [false, Validators.requiredTrue],
});
```

`Validators.requiredTrue` is the one for checkboxes that must be ticked. `Validators.required` accepts `false`, which is not what you want for terms and conditions.

Note `Validators.email` is deliberately permissive. It accepts things a real mail server would reject, and rejects nothing that is valid. Server side validation is still needed.

## Custom validators

A validator is a function taking a control and returning errors or `null`.

```typescript
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function noSpaces(control: AbstractControl): ValidationErrors | null {
  return control.value?.includes(' ')
    ? { noSpaces: true }
    : null;
}
```

```typescript
username: ['', [Validators.required, noSpaces]],
```

```html
@if (form.controls.username.hasError('noSpaces')) {
  <p>Spaces are not allowed</p>
}
```

With arguments, return a validator from a factory:

```typescript
export function forbidden(words: string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').toLowerCase();

    const found = words.find(word => value.includes(word));

    return found ? { forbidden: { word: found } } : null;
  };
}
```

```typescript
username: ['', forbidden(['admin', 'root'])],
```

Returning an object rather than `true` lets the template show details:

```html
@if (form.controls.username.hasError('forbidden')) {
  <p>"{{ form.controls.username.getError('forbidden').word }}" is not allowed</p>
}
```

## Cross field validation

A validator on the **group** can compare its children.

```typescript
export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;

  return password === confirm ? null : { mismatch: true };
}
```

```typescript
protected readonly form = this.fb.group({
  password: ['', Validators.required],
  confirmPassword: ['', Validators.required],
}, { validators: passwordsMatch });
```

The error lands on the **group**, not the field:

```html
@if (form.hasError('mismatch') && form.controls.confirmPassword.touched) {
  <p class="error">The passwords do not match</p>
}
```

Forgetting that and checking `form.controls.confirmPassword.hasError('mismatch')` is a very common bug. Alternatively, set the error on the control yourself:

```typescript
export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const confirm = group.get('confirmPassword');
  const matches = group.get('password')?.value === confirm?.value;

  if (!matches) {
    confirm?.setErrors({ ...confirm.errors, mismatch: true });
  } else if (confirm?.hasError('mismatch')) {
    const { mismatch, ...rest } = confirm.errors ?? {};
    confirm.setErrors(Object.keys(rest).length ? rest : null);
  }

  return matches ? null : { mismatch: true };
}
```

Fiddly, which is exactly why signal forms handle cross field rules more directly.

## Async validators

```typescript
import { AsyncValidatorFn } from '@angular/forms';

export function usernameAvailable(users: UserService): AsyncValidatorFn {
  return control => {
    if (!control.value) return of(null);

    return timer(400).pipe(
      switchMap(() => users.checkUsername(control.value)),
      map(available => (available ? null : { taken: true })),
      catchError(() => of(null)),
    );
  };
}
```

```typescript
protected readonly form = this.fb.group({
  username: ['', [Validators.required], [usernameAvailable(inject(UserService))]],
});
```

Async validators go in the **third** position. Putting them in the second silently does nothing useful.

`timer(400)` debounces. Without it every keystroke hits the server.

The control is `pending` while it runs:

```html
@if (form.controls.username.pending) {
  <span>Checking...</span>
}

<button [disabled]="form.invalid || form.pending">Create</button>
```

Async validators only run when the synchronous ones pass, which saves pointless requests on obviously invalid input.

## FormArray

For a list of fields whose length changes.

```typescript
protected readonly form = this.fb.group({
  customer: ['', Validators.required],
  lines: this.fb.array([this.createLine()]),
});

private createLine() {
  return this.fb.group({
    description: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    price: [0, Validators.min(0)],
  });
}

protected get lines() {
  return this.form.controls.lines;
}

protected addLine(): void {
  this.lines.push(this.createLine());
}

protected removeLine(index: number): void {
  this.lines.removeAt(index);
}

protected moveUp(index: number): void {
  if (index === 0) return;

  const control = this.lines.at(index);
  this.lines.removeAt(index);
  this.lines.insert(index - 1, control);
}
```

```html
<div formArrayName="lines">
  @for (line of lines.controls; track line; let i = $index) {
    <div [formGroupName]="i">
      <input formControlName="description">
      <input formControlName="quantity" type="number">
      <button type="button" (click)="removeLine(i)">Remove</button>
    </div>
  }
</div>

<button type="button" (click)="addLine()">Add line</button>
```

Two details. `formArrayName` on the wrapper, then `[formGroupName]="i"` with the **index** on each item. And `track line` on the control object rather than `$index`, so removing an item does not shuffle the DOM incorrectly.

## The FormArray typing gap

`FormArray` is where the typed forms story is weakest.

```typescript
protected get lines() {
  return this.form.controls.lines;   // FormArray<FormGroup<...>>
}

this.lines.at(0).controls.description.value;   // typed
this.lines.at(0).get('description')?.value;    // any
```

Use `.at(i).controls.x` rather than `get()` to keep the types.

Adding a group with a different shape compiles but breaks at runtime, so keep a single factory function like `createLine()` and use it everywhere.

## Validating the array

```typescript
lines: this.fb.array([this.createLine()], [Validators.minLength(1), maxLines(50)]),
```

```typescript
export function maxLines(max: number): ValidatorFn {
  return control => {
    const array = control as FormArray;
    return array.length > max ? { tooMany: { max } } : null;
  };
}
```

## Dynamic validators

```typescript
protected onBusinessChange(isBusiness: boolean): void {
  const company = this.form.controls.companyName;

  if (isBusiness) {
    company.setValidators([Validators.required]);
  } else {
    company.clearValidators();
  }

  company.updateValueAndValidity();
}
```

`updateValueAndValidity()` is essential. Changing validators does not revalidate on its own, so without it the control keeps its old status and the form looks valid when it is not.

## Computing totals

```typescript
protected readonly total = toSignal(
  this.form.controls.lines.valueChanges.pipe(
    map(lines => lines.reduce((sum, l) => sum + (l.quantity ?? 0) * (l.price ?? 0), 0)),
    startWith(0),
  ),
  { initialValue: 0 },
);
```

The `?? 0` fallbacks are there because `value` types every field optional. `getRawValue()` avoids that but does not emit on changes, which is the awkward part.

## Quick recap

- `Validators.requiredTrue` is the one for checkboxes that must be ticked.
- A custom validator returns an errors object or `null`, and a factory adds arguments.
- Cross field validators go on the group, so the error lands on the group.
- Async validators go in the third position and should debounce.
- `FormArray` needs `formArrayName` plus `[formGroupName]="i"` on each item.
- Track by the control object, not the index, so removals behave.
- Always call `updateValueAndValidity()` after changing validators.

<code id="code-content" class="language-typescript">
import { inject } from '@angular/core';
import { NonNullableFormBuilder, Validators, AbstractControl, ValidationErrors,
         ValidatorFn, AsyncValidatorFn, FormArray } from '@angular/forms';
import { of, timer, switchMap, map, catchError } from 'rxjs';
const fb = inject(NonNullableFormBuilder);
// A validator returns an errors object, or null when valid.
// Returning an OBJECT rather than true lets the template show details.
export function forbidden(words: string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =&gt; {
    const value = String(control.value ?? '').toLowerCase();
    const found = words.find(w =&gt; value.includes(w));
    return found ? { forbidden: { word: found } } : null;
  };
}
// Cross field validators go on the GROUP, so the error lands on the GROUP.
// Checking form.controls.confirm.hasError('mismatch') is the classic bug.
export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  return group.get('password')?.value === group.get('confirmPassword')?.value
    ? null : { mismatch: true };
}
// Async validators debounce themselves, or every keystroke hits the server.
// They only run once the SYNCHRONOUS validators pass.
export function usernameAvailable(users: UserService): AsyncValidatorFn {
  return control =&gt; !control.value ? of(null) : timer(400).pipe(
    switchMap(() =&gt; users.checkUsername(control.value)),
    map(available =&gt; available ? null : { taken: true }),
    catchError(() =&gt; of(null)));
}
const createLine = () =&gt; fb.group({
  description: ['', Validators.required],
  quantity: [1, [Validators.required, Validators.min(1)]],
  price: [0, Validators.min(0)],
});
const form = fb.group({
  // requiredTrue for checkboxes. required accepts false.
  terms: [false, Validators.requiredTrue],
  password: ['', Validators.required],
  confirmPassword: ['', Validators.required],
  // async validators go in the THIRD position. Second silently does nothing.
  username: ['', [Validators.required, forbidden(['admin'])], [usernameAvailable(users)]],
  lines: fb.array([createLine()]),
}, { validators: passwordsMatch });
// FormArray operations
const lines = form.controls.lines;
lines.push(createLine());
lines.removeAt(0);
const moved = lines.at(1);
lines.removeAt(1);
lines.insert(0, moved);
// Keep the types: .at(i).controls.x is typed, .get('x') is any
lines.at(0).controls.description.value;
// Template:
//   &lt;div formArrayName="lines"&gt;
//     @for (line of lines.controls; track line; let i = $index) {
//       &lt;div [formGroupName]="i"&gt;          &lt;!-- the INDEX, bound --&gt;
//         &lt;input formControlName="description"&gt;
//       &lt;/div&gt;
//     }
//   &lt;/div&gt;
// track the CONTROL, not $index, or removals shuffle the DOM wrongly.
// Changing validators does NOT revalidate. This line is essential:
form.controls.username.setValidators([Validators.required]);
form.controls.username.updateValueAndValidity();
</code></pre>
