---
publishDate: 2026-06-19T11:00
title: Template-driven Forms
slug: template-driven-forms
metadescription: Build simple forms with ngModel in the template, and know when the simplicity is worth the limitations.
updateDate: 2026-09-07T11:00
author: ['bishal-biswas']
level: 2
tags: ['forms', 'template driven', 'ngmodel']
course: angular
---

## The form lives in the template

Template driven forms put the structure in the HTML. Angular builds the form model from the directives it finds.

```typescript
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-contact',
  imports: [FormsModule],
  template: `
    <form #contactForm="ngForm" (ngSubmit)="submit(contactForm)">
      <input name="name" [(ngModel)]="name" required>
      <input name="email" [(ngModel)]="email" type="email" required email>

      <button [disabled]="contactForm.invalid">Send</button>
    </form>
  `,
})
export class Contact {
  protected readonly name = signal('');
  protected readonly email = signal('');

  protected submit(form: NgForm): void {
    if (form.invalid) return;

    console.log(form.value);
  }
}
```

`FormsModule` must be imported, and it is still an NgModule.

## The name attribute is required

This is the mistake everyone makes once.

```html
<input [(ngModel)]="name">              <!-- error at runtime -->
<input name="name" [(ngModel)]="name">  <!-- correct -->
```

Angular uses `name` as the key in the form model. Without it, `ngModel` inside a `<form>` throws.

Outside a form, `ngModel` works alone as plain two way binding:

```html
<input [(ngModel)]="searchTerm">
```

That is a legitimate use, and quite common for filters and search boxes that are not really forms.

## ngModel with signals

`[(ngModel)]` works with a signal, which is the modern way to write it.

```typescript
protected readonly name = signal('');
```

```html
<input name="name" [(ngModel)]="name">
<p>Hello, {{ name() }}</p>
```

Angular calls `set` on the signal when the input changes. Older code binds to a plain property instead, which still works.

## The NgForm directive

`#contactForm="ngForm"` gives you the form's state.

```html
<form #f="ngForm">
  <p>Valid: {{ f.valid }}</p>
  <p>Dirty: {{ f.dirty }}</p>
  <p>Touched: {{ f.touched }}</p>
  <p>Value: {{ f.value | json }}</p>
</form>
```

Individual controls too, with `ngModel` as the export name:

```html
<input name="email" [(ngModel)]="email" required email #emailField="ngModel">

@if (emailField.touched && emailField.invalid) {
  @if (emailField.hasError('required')) { <p>Email is required</p> }
  @if (emailField.hasError('email')) { <p>Not a valid email</p> }
}
```

Every control needs its own reference variable to show errors, which is why template driven forms get noisy quickly.

## Validators are attributes

```html
<input name="name" ngModel required minlength="2" maxlength="50">
<input name="age" ngModel type="number" required min="18" max="120">
<input name="site" ngModel pattern="https?://.+">
<input name="email" ngModel email>
```

These are the standard HTML validation attributes, and Angular's directives hook into them. That is a genuine advantage: the markup reads like ordinary HTML.

They can be bound:

```html
<input name="quantity" ngModel [required]="isRequired()" [max]="maxAllowed()">
```

## Custom validators need a directive

This is where template driven forms get expensive. A custom rule has to be wrapped in a directive.

```typescript
import { Directive, input } from '@angular/core';
import { NG_VALIDATORS, Validator, AbstractControl, ValidationErrors } from '@angular/forms';

@Directive({
  selector: '[appForbidden]',
  providers: [{
    provide: NG_VALIDATORS,
    useExisting: Forbidden,
    multi: true,
  }],
})
export class Forbidden implements Validator {
  readonly words = input<string[]>([], { alias: 'appForbidden' });

  validate(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value ?? '').toLowerCase();
    const found = this.words().find(w => value.includes(w));

    return found ? { forbidden: { word: found } } : null;
  }
}
```

```html
<input name="username" ngModel [appForbidden]="['admin', 'root']">
```

`multi: true` is essential, or your directive replaces every other validator.

Compare with reactive forms, where the same rule is a plain function. This is the main reason template driven forms do not scale.

## Grouping

```html
<form #f="ngForm">
  <input name="name" ngModel>

  <div ngModelGroup="address">
    <input name="line1" ngModel>
    <input name="city" ngModel>
  </div>
</form>
```

```typescript
// f.value is { name: '...', address: { line1: '...', city: '...' } }
```

## Dynamic fields

```html
<form #f="ngForm">
  @for (line of lines(); track line.id) {
    <div [ngModelGroup]="line.id">
      <input name="description" [(ngModel)]="line.description">
      <input name="quantity" [(ngModel)]="line.quantity" type="number">
    </div>
  }
</form>

<button (click)="addLine()">Add</button>
```

It works, and the model is an object keyed by id rather than an array, which is often not what you want. Dynamic lists are where template driven forms are weakest.

## Submitting

```html
<form #f="ngForm" (ngSubmit)="submit(f)">
```

`(ngSubmit)` rather than `(submit)`. It calls `preventDefault()` for you and only fires when the form is submitted through a button or the enter key.

```typescript
protected submit(form: NgForm): void {
  if (form.invalid) {
    form.control.markAllAsTouched();    // reveal every error
    return;
  }

  this.save(form.value);
  form.resetForm();
}
```

`markAllAsTouched()` is how you show errors on fields the user never visited.

`resetForm()` clears both the values and the touched and dirty flags. Plain `reset()` on the underlying control leaves the flags set.

## Timing

Template driven forms build their model **asynchronously**, one change detection cycle after the template renders.

```typescript
@ViewChild('f') form!: NgForm;

ngAfterViewInit(): void {
  console.log(this.form.controls);     // often empty
}
```

Setting values programmatically has the same problem:

```typescript
ngOnInit(): void {
  this.form.setValue({ ... });     // throws, controls do not exist yet
}
```

The workaround is a `setTimeout` or a `ngAfterViewChecked` guard, both unpleasant. Reactive forms have no such issue, because the model exists before the template renders.

## When to use them

**Good for:** a login form, a contact form, a search filter, a settings toggle. Anything small, static and simple.

**Bad for:** anything with dynamic fields, cross field validation, complex conditional logic, or a need to test the form without rendering it.

The honest summary: template driven forms are fine for the simplest cases and become painful quickly. Most teams standardise on one approach, and it is usually not this one.

For new code in Angular 22, signal forms give the same brevity without the limitations.

## Quick recap

- The form model is built from directives in the template.
- Every `ngModel` inside a `<form>` needs a `name` attribute.
- `#f="ngForm"` exposes form state, and `#field="ngModel"` exposes control state.
- Validators are HTML attributes, which reads well but limits custom rules to directives.
- A custom validator directive must provide `NG_VALIDATORS` with `multi: true`.
- The model is built asynchronously, so setting values in `ngOnInit` fails.
- Use them for small static forms, and something else for anything dynamic.

<code id="code-content" class="language-typescript">
import { Component, Directive, signal, input } from '@angular/core';
import { FormsModule, NgForm, NG_VALIDATORS, Validator,
         AbstractControl, ValidationErrors } from '@angular/forms';
@Component({
  selector: 'app-contact',
  imports: [FormsModule],          // still an NgModule
  template: `
    &lt;form #f="ngForm" (ngSubmit)="submit(f)"&gt;
      &lt;!-- the name attribute is REQUIRED. Without it ngModel throws
           inside a form, because name is the key in the model. --&gt;
      &lt;input name="name" [(ngModel)]="name" required minlength="2"&gt;
      &lt;!-- each control needs its own reference variable to show errors --&gt;
      &lt;input name="email" [(ngModel)]="email" type="email" required email
             #emailField="ngModel"&gt;
      @if (emailField.touched &amp;&amp; emailField.invalid) {
        @if (emailField.hasError('required')) { &lt;p&gt;Email is required&lt;/p&gt; }
        @if (emailField.hasError('email')) { &lt;p&gt;Not a valid email&lt;/p&gt; }
      }
      &lt;!-- validators are plain HTML attributes, and can be bound --&gt;
      &lt;input name="qty" ngModel type="number" [required]="isRequired()" [max]="99"&gt;
      &lt;div ngModelGroup="address"&gt;
        &lt;input name="city" ngModel&gt;
      &lt;/div&gt;
      &lt;button [disabled]="f.invalid"&gt;Send&lt;/button&gt;
    &lt;/form&gt;
    &lt;!-- outside a form, ngModel is just two way binding. No name needed. --&gt;
    &lt;input [(ngModel)]="searchTerm"&gt;
  `,
})
export class Contact {
  protected readonly name = signal('');        // ngModel works with signals
  protected readonly email = signal('');
  protected readonly searchTerm = signal('');
  protected readonly isRequired = signal(true);
  protected submit(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();          // reveal every error
      return;
    }
    console.log(form.value);
    form.resetForm();      // clears values AND the touched/dirty flags
  }
}
// A custom rule needs a whole DIRECTIVE, which is why these do not scale.
// In reactive or signal forms the same rule is a plain function.
@Directive({
  selector: '[appForbidden]',
  // multi: true is ESSENTIAL, or this replaces every other validator
  providers: [{ provide: NG_VALIDATORS, useExisting: Forbidden, multi: true }],
})
export class Forbidden implements Validator {
  readonly words = input&lt;string[]&gt;([], { alias: 'appForbidden' });
  validate(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value ?? '').toLowerCase();
    const found = this.words().find(w =&gt; value.includes(w));
    return found ? { forbidden: { word: found } } : null;
  }
}
// TIMING: the model is built ASYNCHRONOUSLY, one cycle after render.
//   ngOnInit()      { this.form.setValue({...}); }   throws, no controls yet
//   ngAfterViewInit { console.log(this.form.controls); }  often empty
// Reactive forms have no such problem: the model exists before the template.
// Use these for small static forms. For anything dynamic, use signal forms.
</code></pre>
