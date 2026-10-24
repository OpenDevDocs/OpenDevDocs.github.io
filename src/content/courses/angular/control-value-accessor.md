---
publishDate: 2026-06-19T11:05
title: Custom Form Controls with ControlValueAccessor
slug: control-value-accessor
metadescription: Make your own component work with ngModel and formControlName by implementing ControlValueAccessor.
updateDate: 2026-09-07T11:05
author: ['bishal-biswas']
level: 3
tags: ['forms', 'custom controls', 'controlvalueaccessor']
course: angular
---

## The bridge to reactive forms

`ControlValueAccessor` is the interface that lets a component behave like a native input inside reactive and template driven forms.

```html
<app-rating formControlName="score" />
<app-rating [(ngModel)]="score" name="score" />
```

Without it, those bindings do nothing.

## The interface

Four methods.

```typescript
interface ControlValueAccessor {
  writeValue(value: any): void;              // the form sets a value
  registerOnChange(fn: any): void;           // give me a callback for changes
  registerOnTouched(fn: any): void;          // give me a callback for blur
  setDisabledState?(isDisabled: boolean): void;
}
```

Angular calls `registerOnChange` and `registerOnTouched` once, handing you functions to call when things happen. You call them, and the form updates.

## A complete example

```typescript
import { Component, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-rating',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => Rating),
    multi: true,
  }],
  template: `
    @for (star of stars; track star) {
      <button
        type="button"
        (click)="select(star)"
        (blur)="onTouched()"
        [disabled]="disabled()"
        [class.filled]="star <= value()">
        ★
      </button>
    }
  `,
})
export class Rating implements ControlValueAccessor {
  protected readonly value = signal(0);
  protected readonly disabled = signal(false);
  protected readonly stars = [1, 2, 3, 4, 5];

  private onChange: (value: number) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: number | null): void {
    this.value.set(value ?? 0);
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected select(star: number): void {
    if (this.disabled()) return;

    this.value.set(star);
    this.onChange(star);      // tell the form
    this.onTouched();
  }
}
```

```typescript
protected readonly form = this.fb.group({
  score: [0, Validators.min(1)],
});
```

```html
<form [formGroup]="form">
  <app-rating formControlName="score" />
</form>
```

## The provider block

```typescript
providers: [{
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => Rating),
  multi: true,
}]
```

Three parts, all necessary.

**`NG_VALUE_ACCESSOR`** is the token Angular looks up to find the accessor.

**`forwardRef`** is needed because the class is referenced inside its own decorator, before the class exists. Without it you get an undefined provider.

**`multi: true`** is required because `NG_VALUE_ACCESSOR` is a multi provider. Omitting it breaks other accessors.

This block is pure boilerplate, and it is the main thing signal forms improved on.

## Do not forget writeValue

`writeValue` is how the form pushes a value in. Skip it and `patchValue`, `setValue` and `reset` all silently do nothing to your control.

```typescript
this.form.patchValue({ score: 4 });    // calls writeValue(4)
this.form.reset();                     // calls writeValue(null)
```

Handle `null`, because `reset()` passes it:

```typescript
writeValue(value: number | null): void {
  this.value.set(value ?? 0);
}
```

## Calling onChange at the right time

```typescript
protected select(star: number): void {
  this.value.set(star);
  this.onChange(star);       // the form now knows, and marks the control dirty
}
```

Update your internal state **and** call `onChange`. Doing only the first means the display updates but the form value does not, which is a genuinely confusing bug to debug.

Do **not** call `onChange` inside `writeValue`. That would create a loop: the form sets a value, you tell the form it changed, the form sets it again.

## Touched state

```html
<button (blur)="onTouched()">★</button>
```

Without this the control never becomes touched, so `touched && invalid` error checks never fire. For a component with several focusable parts, use `focusout` on the container instead.

## Disabled state

```typescript
setDisabledState(isDisabled: boolean): void {
  this.disabled.set(isDisabled);
}
```

Called when the form disables the control. Ignoring it leaves a disabled field fully interactive, which is a real bug rather than a cosmetic one.

## Adding validation

A control can validate itself by also providing `NG_VALIDATORS`.

```typescript
@Component({
  selector: 'app-postcode',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Postcode), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => Postcode), multi: true },
  ],
  ...
})
export class Postcode implements ControlValueAccessor, Validator {
  validate(control: AbstractControl): ValidationErrors | null {
    const value = control.value;

    if (!value) return null;

    return /^[A-Z0-9 ]{5,8}$/i.test(value) ? null : { postcode: true };
  }
}
```

Two providers, both `multi: true`.

## Avoiding the circular dependency

Injecting `NgControl` instead of providing `NG_VALUE_ACCESSOR` avoids `forwardRef`, and gives access to the control's state.

```typescript
@Component({ selector: 'app-rating', ... })
export class Rating implements ControlValueAccessor {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  protected readonly showError = computed(() => {
    const control = this.ngControl?.control;
    return !!control && control.touched && control.invalid;
  });
}
```

Setting `valueAccessor` in the constructor replaces the provider block. The trade is that the component now depends on being used inside a form, so `optional: true` matters if it should also work standalone.

## Testing

```typescript
it('reports the selected value to the form', () => {
  const fixture = TestBed.createComponent(Rating);
  const component = fixture.componentInstance;

  let reported: number | undefined;
  component.registerOnChange((v: number) => { reported = v; });

  component.writeValue(3);
  expect(fixture.nativeElement.querySelectorAll('.filled').length).toBe(3);

  fixture.nativeElement.querySelectorAll('button')[4].click();
  expect(reported).toBe(5);
});
```

Testing the interface directly is faster than building a form around it.

## Signal forms make this unnecessary

For new controls, `FormValueControl` is far less code.

```typescript
export class Rating implements FormValueControl<number> {
  readonly value = model(0);
  readonly disabled = input(false);
}
```

No provider block, no `forwardRef`, no four methods, no manual callbacks.

The good news for migration: `[formField]` **accepts existing `ControlValueAccessor` components**. Your control library keeps working when you move a form to signal forms, so there is no need to rewrite it.

## Quick recap

- `ControlValueAccessor` makes a component work with `formControlName` and `ngModel`.
- The provider needs `NG_VALUE_ACCESSOR`, `forwardRef` and `multi: true`.
- `writeValue` receives values from the form, including `null` on reset.
- Call `onChange` when the value changes, or the form never learns about it.
- Call `onTouched` on blur, or touched based error display never triggers.
- Implement `setDisabledState`, or disabled controls stay interactive.
- Signal forms replace all of this with `FormValueControl`, and still accept old accessors.

<code id="code-content" class="language-typescript">
import { Component, forwardRef, signal, inject, computed } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NG_VALIDATORS, Validator,
         AbstractControl, ValidationErrors, NgControl } from '@angular/forms';
@Component({
  selector: 'app-rating',
  providers: [
    // All three parts are necessary:
    //   NG_VALUE_ACCESSOR  the token Angular looks up
    //   forwardRef         the class is referenced inside its own decorator
    //   multi: true        it is a multi provider
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() =&gt; Rating), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() =&gt; Rating), multi: true },
  ],
  template: `
    @for (star of stars; track star) {
      &lt;button type="button" (click)="select(star)" (blur)="onTouched()"
              [disabled]="disabled()" [class.filled]="star &lt;= value()"&gt;star&lt;/button&gt;
    }
  `,
})
export class Rating implements ControlValueAccessor, Validator {
  protected readonly value = signal(0);
  protected readonly disabled = signal(false);
  protected readonly stars = [1, 2, 3, 4, 5];
  private onChange: (v: number) =&gt; void = () =&gt; {};
  protected onTouched: () =&gt; void = () =&gt; {};
  // The form pushes values IN here. Skip it and patchValue, setValue and
  // reset all silently do nothing. reset() passes null, so handle it.
  writeValue(value: number | null): void { this.value.set(value ?? 0); }
  registerOnChange(fn: (v: number) =&gt; void): void { this.onChange = fn; }
  registerOnTouched(fn: () =&gt; void): void { this.onTouched = fn; }
  // Ignore this and a disabled control stays fully interactive
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }
  validate(control: AbstractControl): ValidationErrors | null {
    return control.value &gt; 0 ? null : { noRating: true };
  }
  protected select(star: number): void {
    if (this.disabled()) return;
    this.value.set(star);       // update internal state AND
    this.onChange(star);        // tell the form, or the value never updates
    this.onTouched();
  }
  // NEVER call onChange inside writeValue. The form sets a value, you tell
  // it the value changed, it sets it again. That is a loop.
}
// Alternative: inject NgControl and set valueAccessor yourself. No forwardRef,
// and you get access to the control's touched/invalid state.
@Component({ selector: 'app-alt', template: `` })
export class Alt implements ControlValueAccessor {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  constructor() { if (this.ngControl) this.ngControl.valueAccessor = this; }
  protected readonly showError = computed(() =&gt; {
    const c = this.ngControl?.control;
    return !!c &amp;&amp; c.touched &amp;&amp; c.invalid;
  });
  writeValue(): void {}
  registerOnChange(): void {}
  registerOnTouched(): void {}
}
// Signal forms replace ALL of this with:
//   export class Rating implements FormValueControl&lt;number&gt; {
//     readonly value = model(0);
//     readonly disabled = input(false);
//   }
// And [formField] still accepts existing ControlValueAccessor components,
// so your control library needs no rewriting when you migrate.
</code></pre>
