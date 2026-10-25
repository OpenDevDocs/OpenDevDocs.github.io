---
publishDate: 2026-06-18T10:45
title: Custom Controls for Signal Forms
slug: signal-forms-custom-controls
metadescription: Build your own form controls for signal forms with FormValueControl, and reuse existing ControlValueAccessor components.
updateDate: 2026-09-07T10:45
author: ['bishal-biswas']
level: 2
tags: ['signal forms', 'custom controls', 'components']
course: angular
---

## Why a custom control

Native inputs cover text, numbers, dates and checkboxes. Anything else needs a component: a star rating, a tag picker, a rich text editor, a colour swatch, a stepper.

A custom control lets `[formField]` bind to your component exactly as it binds to an `<input>`.

## FormValueControl

Implement the interface and expose a `value` model.

```typescript
import { Component, model, input } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';

@Component({
  selector: 'app-rating',
  template: `
    @for (star of stars; track star) {
      <button
        type="button"
        (click)="value.set(star)"
        [class.filled]="star <= value()"
        [disabled]="disabled()"
        [attr.aria-label]="'Rate ' + star + ' out of 5'">
        ★
      </button>
    }
  `,
})
export class Rating implements FormValueControl<number> {
  readonly value = model(0);
  readonly disabled = input(false);
  readonly errors = input<ValidationError.WithOptionalField[]>([]);

  protected readonly stars = [1, 2, 3, 4, 5];
}
```

```html
<app-rating [formField]="reviewForm.score" />
```

That is the whole contract. `[formField]` connects the model, the disabled state and the errors.

## The interface members

```typescript
readonly value = model<T>(initial);    // required, two way
readonly disabled = input(false);      // optional, set from the schema
readonly readonly = input(false);      // optional
readonly required = input(false);      // optional
readonly errors = input<ValidationError.WithOptionalField[]>([]);
readonly touched = model(false);       // optional, for marking on blur
readonly invalid = input(false);
```

Only `value` is required. Accept the others when your control should react to them.

Taking `errors` lets the control render its own error state:

```typescript
@Component({
  selector: 'app-tag-input',
  host: { '[class.invalid]': 'errors().length > 0' },
  template: `
    ...
    @for (error of errors(); track error.kind) {
      <p class="error">{{ error.message ?? error.kind }}</p>
    }
  `,
})
```

## Marking as touched

For a control with no native blur, set `touched` yourself so validation messages appear at the right moment.

```typescript
export class TagInput implements FormValueControl<string[]> {
  readonly value = model<string[]>([]);
  readonly touched = model(false);

  protected onBlur(): void {
    this.touched.set(true);
  }
}
```

```html
<div (focusout)="onBlur()">...</div>
```

Without this, a form built entirely from custom controls never becomes touched, so `submit` is the only thing that reveals errors.

## A worked example: a tag picker

```typescript
@Component({
  selector: 'app-tag-picker',
  template: `
    <div class="tags" (focusout)="touched.set(true)">
      @for (tag of value(); track tag) {
        <span class="tag">
          {{ tag }}
          <button type="button" (click)="remove(tag)" [disabled]="disabled()">×</button>
        </span>
      }

      <input
        #box
        [disabled]="disabled()"
        (keydown.enter)="add(box.value); box.value = ''; $event.preventDefault()"
        placeholder="Add a tag">
    </div>

    @for (error of errors(); track error.kind) {
      <p class="error">{{ error.message ?? error.kind }}</p>
    }
  `,
})
export class TagPicker implements FormValueControl<string[]> {
  readonly value = model<string[]>([]);
  readonly disabled = input(false);
  readonly touched = model(false);
  readonly errors = input<ValidationError.WithOptionalField[]>([]);

  protected add(tag: string): void {
    const trimmed = tag.trim();

    if (!trimmed || this.value().includes(trimmed)) return;

    this.value.update(tags => [...tags, trimmed]);
  }

  protected remove(tag: string): void {
    this.value.update(tags => tags.filter(t => t !== tag));
  }
}
```

```typescript
protected readonly model = signal({ title: '', tags: [] as string[] });

protected readonly postForm = form(this.model, path => {
  required(path.title);

  validate(path.tags, ctx =>
    ctx.value().length === 0
      ? { kind: 'noTags', message: 'Add at least one tag' }
      : null
  );
});
```

```html
<input [formField]="postForm.title">
<app-tag-picker [formField]="postForm.tags" />
```

The control knows nothing about forms. It has a value, and `[formField]` does the rest.

## Checkbox style controls

For a control whose value is a boolean and which behaves like a checkbox, implement `FormCheckboxControl` instead.

```typescript
import { FormCheckboxControl } from '@angular/forms/signals';

@Component({
  selector: 'app-switch',
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked()"
      (click)="checked.set(!checked())"
      [disabled]="disabled()">
      <span class="knob"></span>
    </button>
  `,
})
export class Switch implements FormCheckboxControl {
  readonly checked = model(false);
  readonly disabled = input(false);
}
```

The member is `checked` rather than `value`, matching how native checkboxes work.

## Reusing a ControlValueAccessor component

`[formField]` also works with components implementing the classic `ControlValueAccessor`. That means Angular Material inputs, and any custom control you wrote for reactive forms, work with signal forms unchanged.

```html
<mat-form-field>
  <mat-label>Email</mat-label>
  <input matInput [formField]="userForm.email">
</mat-form-field>

<app-old-datepicker [formField]="userForm.startDate" />
```

This matters for migration. You do not have to rewrite your control library to move a form over.

## Validation inside a control

A control can contribute its own validation errors rather than relying on the schema.

```typescript
@Component({ selector: 'app-postcode', ... })
export class PostcodeInput implements FormValueControl<string> {
  readonly value = model('');

  readonly errors = computed<ValidationError.WithOptionalField[]>(() => {
    const value = this.value();

    if (!value) return [];

    return /^[A-Z0-9 ]{5,8}$/i.test(value)
      ? []
      : [{ kind: 'format', message: 'That does not look like a postcode' }];
  });
}
```

Use this sparingly. Validation in the schema is easier to find and easier to change per form. Put a rule in the control only when it is intrinsic to the control itself, like a postcode input that is always a postcode.

## Testing a custom control

It is an ordinary component, so test it directly.

```typescript
it('adds a tag on enter', async () => {
  const fixture = TestBed.createComponent(TagPicker);
  await fixture.whenStable();

  const input = fixture.nativeElement.querySelector('input');
  input.value = 'angular';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

  await fixture.whenStable();

  expect(fixture.componentInstance.value()).toEqual(['angular']);
});
```

No form is needed, because the control only knows about its `value` model.

## Common mistakes

**Not naming the member `value`.** The interface requires `value` for `FormValueControl` and `checked` for `FormCheckboxControl`.

**Using `input()` instead of `model()`.** The value must be writable and two way.

**Forgetting `touched`.** Errors then never appear until submit.

**Mutating the value array.** `this.value().push(tag)` does nothing. Use `update` with a new array.

**Ignoring `disabled`.** A disabled form field whose control stays interactive is a real bug.

## Quick recap

- Implement `FormValueControl<T>` with a `value` model to make a component bindable.
- `[formField]` then connects value, disabled state and errors automatically.
- Accept `disabled`, `errors` and `touched` inputs so the control behaves properly.
- Set `touched` on blur, or errors never appear before submit.
- Use `FormCheckboxControl` with a `checked` member for switch style controls.
- Existing `ControlValueAccessor` components work unchanged, including Angular Material.
- Keep validation in the schema unless the rule is intrinsic to the control.

<code id="code-content" class="language-typescript">
import { Component, model, input, computed, signal } from '@angular/core';
import { form, required, validate, FormField, FormValueControl,
         FormCheckboxControl, ValidationError } from '@angular/forms/signals';
// Implement FormValueControl and expose a `value` MODEL (not an input).
// [formField] then connects value, disabled and errors automatically.
@Component({
  selector: 'app-tag-picker',
  template: `
    &lt;div class="tags" (focusout)="touched.set(true)"&gt;
      @for (tag of value(); track tag) {
        &lt;span&gt;{{ tag }}&lt;button (click)="remove(tag)" [disabled]="disabled()"&gt;×&lt;/button&gt;&lt;/span&gt;
      }
      &lt;input #box [disabled]="disabled()"
             (keydown.enter)="add(box.value); box.value = ''"&gt;
    &lt;/div&gt;
    @for (error of errors(); track error.kind) {
      &lt;p class="error"&gt;{{ error.message ?? error.kind }}&lt;/p&gt;
    }
  `,
})
export class TagPicker implements FormValueControl&lt;string[]&gt; {
  readonly value = model&lt;string[]&gt;([]);        // REQUIRED, and must be a model
  readonly disabled = input(false);
  readonly errors = input&lt;ValidationError.WithOptionalField[]&gt;([]);
  // Without touched, a form of custom controls never becomes touched,
  // so errors only appear after submit.
  readonly touched = model(false);
  protected add(tag: string): void {
    const t = tag.trim();
    if (!t || this.value().includes(t)) return;
    this.value.update(tags =&gt; [...tags, t]);    // replace, never push
  }
  protected remove(tag: string): void {
    this.value.update(tags =&gt; tags.filter(x =&gt; x !== tag));
  }
}
// Checkbox style controls use `checked` instead of `value`
@Component({ selector: 'app-switch', template: `&lt;button role="switch"&gt;&lt;/button&gt;` })
export class Switch implements FormCheckboxControl {
  readonly checked = model(false);
  readonly disabled = input(false);
}
// Using it is identical to a native input
@Component({
  selector: 'app-post-form',
  imports: [FormField, TagPicker],
  template: `
    &lt;input [formField]="postForm.title"&gt;
    &lt;app-tag-picker [formField]="postForm.tags" /&gt;
  `,
})
export class PostForm {
  protected readonly model = signal({ title: '', tags: [] as string[] });
  protected readonly postForm = form(this.model, path =&gt; {
    required(path.title);
    validate(path.tags, ctx =&gt; ctx.value().length === 0
      ? { kind: 'noTags', message: 'Add at least one tag' } : null);
  });
}
// [formField] ALSO works with classic ControlValueAccessor components,
// so Angular Material and your existing reactive form controls need no
// rewriting when you migrate:
//   &lt;input matInput [formField]="userForm.email"&gt;
//   &lt;app-old-datepicker [formField]="userForm.startDate" /&gt;
// Mistakes: naming the member something other than value/checked,
// using input() instead of model(), forgetting touched, mutating the array.
</code></pre>
