---
publishDate: 2026-06-18T10:40
title: 'Signal Forms: Dynamic and Nested Fields'
slug: signal-forms-dynamic-fields
metadescription: Handle nested objects and arrays in signal forms, adding and removing fields at runtime without FormArray.
updateDate: 2026-09-07T10:40
author: ['bishal-biswas']
level: 2
tags: ['signal forms', 'arrays', 'nested']
course: angular
---

## Nested objects

A nested object in the model becomes a nested field tree automatically.

```typescript
interface Order {
  reference: string;
  customer: {
    name: string;
    email: string;
  };
  delivery: {
    line1: string;
    city: string;
    postcode: string;
  };
}

protected readonly model = signal<Order>({
  reference: '',
  customer: { name: '', email: '' },
  delivery: { line1: '', city: '', postcode: '' },
});

protected readonly orderForm = form(this.model, path => {
  required(path.reference);
  required(path.customer.name);
  email(path.customer.email);
  required(path.delivery.line1);
  required(path.delivery.postcode);
});
```

```html
<input [formField]="orderForm.reference">
<input [formField]="orderForm.customer.name">
<input [formField]="orderForm.customer.email">
<input [formField]="orderForm.delivery.line1">
```

The path mirrors the model exactly, and every level is typed. There is no `FormGroup` to construct and no `formGroupName` in the template.

## Reusing a schema for a subtree

```typescript
import { schema, apply } from '@angular/forms/signals';

interface Address {
  line1: string;
  city: string;
  postcode: string;
}

export const addressSchema = schema<Address>(path => {
  required(path.line1, { message: 'Street address is required' });
  required(path.city);
  required(path.postcode);
  pattern(path.postcode, /^[A-Z0-9 ]{5,8}$/i, { message: 'Check the postcode' });
});
```

```typescript
protected readonly orderForm = form(this.model, path => {
  required(path.reference);

  apply(path.delivery, addressSchema);
  apply(path.billing, addressSchema);
});
```

One set of address rules, applied twice. Writing that with reactive forms means building the same `FormGroup` twice or writing a factory.

## Shortening deep paths in templates

```html
@let delivery = orderForm.delivery;

<input [formField]="delivery.line1">
<input [formField]="delivery.city">
<input [formField]="delivery.postcode">
```

`@let` keeps deeply nested forms readable.

Passing a subtree to a child component works too:

```typescript
@Component({
  selector: 'app-address-fields',
  imports: [FormField],
  template: `
    <input [formField]="address().line1">
    <input [formField]="address().city">
    <input [formField]="address().postcode">
  `,
})
export class AddressFields {
  readonly address = input.required<FieldTree<Address>>();
}
```

```html
<app-address-fields [address]="orderForm.delivery" />
<app-address-fields [address]="orderForm.billing" />
```

The child knows nothing about the parent form. That composition is much cleaner than passing a `FormGroup` around.

## Arrays

An array in the model becomes an iterable field.

```typescript
interface Invoice {
  customer: string;
  lines: { description: string; quantity: number; price: number }[];
}

protected readonly model = signal<Invoice>({
  customer: '',
  lines: [{ description: '', quantity: 1, price: 0 }],
});
```

```typescript
import { applyEach } from '@angular/forms/signals';

const lineSchema = schema<{ description: string; quantity: number; price: number }>(path => {
  required(path.description);
  min(path.quantity, 1);
  min(path.price, 0);
});

protected readonly invoiceForm = form(this.model, path => {
  required(path.customer);

  applyEach(path.lines, lineSchema);
});
```

`applyEach` applies a schema to every element, however many there are.

## Rendering an array

```html
@for (line of invoiceForm.lines; track $index) {
  <div class="line">
    <input [formField]="line.description">
    <input [formField]="line.quantity" type="number">
    <input [formField]="line.price" type="number">

    <button type="button" (click)="removeLine($index)">Remove</button>
  </div>
}

<button type="button" (click)="addLine()">Add line</button>
```

Note `invoiceForm.lines` with **no** parentheses in the `@for`. The field tree is iterable directly. Its length is also structural:

```html
<p>{{ invoiceForm.lines.length }} lines</p>
```

## Adding and removing

You change the **model**, not the form. The form follows.

```typescript
protected addLine(): void {
  this.model.update(invoice => ({
    ...invoice,
    lines: [...invoice.lines, { description: '', quantity: 1, price: 0 }],
  }));
}

protected removeLine(index: number): void {
  this.model.update(invoice => ({
    ...invoice,
    lines: invoice.lines.filter((_, i) => i !== index),
  }));
}

protected moveUp(index: number): void {
  if (index === 0) return;

  this.model.update(invoice => {
    const lines = [...invoice.lines];
    [lines[index - 1], lines[index]] = [lines[index], lines[index - 1]];
    return { ...invoice, lines };
  });
}
```

No `FormArray`, no `push`, no `removeAt`, no rebuilding controls. Replace the array in the model and the form updates.

This is the biggest practical improvement over reactive forms, where keeping a `FormArray` and the data in step was a constant source of bugs.

## Derived totals

```typescript
protected readonly total = computed(() =>
  this.model().lines.reduce((sum, line) => sum + line.quantity * line.price, 0)
);
```

```html
<p>Total: {{ total() | currency:'GBP' }}</p>
```

The model is a signal, so totals are just computed values. There is no `valueChanges` subscription to manage.

## Nested loops

```html
@for (section of surveyForm.sections; track $index; let sectionIndex = $index) {
  <fieldset>
    <input [formField]="section.title">

    @for (question of section.questions; track $index) {
      <input [formField]="question.text">
      <button (click)="removeQuestion(sectionIndex, $index)">Remove</button>
    }
  </fieldset>
}
```

Alias the outer `$index`, because the inner loop shadows it. Forgetting that is the classic nested loop bug.

```typescript
protected removeQuestion(sectionIndex: number, questionIndex: number): void {
  this.model.update(survey => ({
    ...survey,
    sections: survey.sections.map((section, i) =>
      i !== sectionIndex
        ? section
        : { ...section, questions: section.questions.filter((_, q) => q !== questionIndex) }
    ),
  }));
}
```

## Validating the array itself

```typescript
form(this.model, path => {
  applyEach(path.lines, lineSchema);

  validate(path.lines, ctx => {
    const lines = ctx.value();

    if (lines.length === 0) {
      return { kind: 'empty', message: 'Add at least one line' };
    }

    if (lines.length > 50) {
      return { kind: 'tooMany', message: 'No more than 50 lines' };
    }

    return null;
  });
});
```

Element rules and whole array rules coexist.

## Multi select arrays

An array of selected values needs checkboxes or a multiple select.

```html
@for (option of availableTags; track option) {
  <label>
    <input
      type="checkbox"
      [value]="option"
      [formField]="form.tags">
    {{ option }}
  </label>
}
```

The `value` attribute is required here, unlike text inputs. It tells the directive which option this checkbox represents.

## Conditional fields

```typescript
form(this.model, path => {
  hidden(path.deliveryInstructions, ctx => ctx.valueOf(path.method) !== 'delivery');

  applyWhenValue(path, m => m.method === 'delivery', deliverySchema);
});
```

```html
@if (!orderForm.deliveryInstructions().hidden()) {
  <textarea [formField]="orderForm.deliveryInstructions"></textarea>
}
```

The field stays in the model, so switching back restores what was typed. Removing it from the model instead would lose it.

## Quick recap

- Nested objects become nested field trees with no `FormGroup` to build.
- `apply(path.x, someSchema)` reuses validation rules for a subtree.
- Pass a subtree to a child component as a `FieldTree` input.
- `applyEach` applies a schema to every array element.
- Iterate `form.lines` with no parentheses, and read `form.lines.length` structurally.
- Add and remove by updating the **model**, never the form.
- Alias the outer `$index` in nested loops, since the inner one shadows it.

<code id="code-content" class="language-typescript">
import { Component, signal, computed, input } from '@angular/core';
import { form, schema, apply, applyEach, validate, required, min,
         FormField, FieldTree } from '@angular/forms/signals';
interface Address { line1: string; city: string; postcode: string; }
interface Line { description: string; quantity: number; price: number; }
interface Invoice { customer: string; delivery: Address; billing: Address; lines: Line[]; }
// Reusable schemas, applied to a subtree or to every array element
const addressSchema = schema&lt;Address&gt;(path =&gt; { required(path.line1); required(path.city); });
const lineSchema = schema&lt;Line&gt;(path =&gt; { required(path.description); min(path.quantity, 1); });
@Component({
  selector: 'app-invoice',
  imports: [FormField],
  template: `
    &lt;!-- @let keeps deeply nested paths readable --&gt;
    @let delivery = invoiceForm.delivery;
    &lt;input [formField]="delivery.line1"&gt;
    &lt;input [formField]="delivery.city"&gt;
    &lt;!-- iterate the field tree with NO parentheses --&gt;
    @for (line of invoiceForm.lines; track $index) {
      &lt;input [formField]="line.description"&gt;
      &lt;input [formField]="line.quantity" type="number"&gt;
      &lt;button (click)="removeLine($index)"&gt;Remove&lt;/button&gt;
    }
    &lt;!-- length is structural, no parentheses either --&gt;
    &lt;p&gt;{{ invoiceForm.lines.length }} lines, total {{ total() }}&lt;/p&gt;
    &lt;button (click)="addLine()"&gt;Add line&lt;/button&gt;
  `,
})
export class InvoiceForm {
  protected readonly model = signal&lt;Invoice&gt;({
    customer: '',
    delivery: { line1: '', city: '', postcode: '' },
    billing: { line1: '', city: '', postcode: '' },
    lines: [{ description: '', quantity: 1, price: 0 }],
  });
  protected readonly invoiceForm = form(this.model, path =&gt; {
    required(path.customer);
    apply(path.delivery, addressSchema);      // one schema, applied twice
    apply(path.billing, addressSchema);
    applyEach(path.lines, lineSchema);         // applied to EVERY element
    // whole array rules coexist with element rules
    validate(path.lines, ctx =&gt; ctx.value().length === 0
      ? { kind: 'empty', message: 'Add at least one line' } : null);
  });
  // The model is a signal, so totals are just computed. No valueChanges.
  protected readonly total = computed(() =&gt;
    this.model().lines.reduce((sum, l) =&gt; sum + l.quantity * l.price, 0));
  // Change the MODEL, never the form. No FormArray, no push, no removeAt.
  protected addLine(): void {
    this.model.update(inv =&gt; ({ ...inv,
      lines: [...inv.lines, { description: '', quantity: 1, price: 0 }] }));
  }
  protected removeLine(index: number): void {
    this.model.update(inv =&gt; ({ ...inv,
      lines: inv.lines.filter((_, i) =&gt; i !== index) }));
  }
}
// Pass a SUBTREE to a child component. The child knows nothing about the parent.
@Component({
  selector: 'app-address-fields',
  imports: [FormField],
  template: `&lt;input [formField]="address().line1"&gt;&lt;input [formField]="address().city"&gt;`,
})
export class AddressFields {
  readonly address = input.required&lt;FieldTree&lt;Address&gt;&gt;();
}
// &lt;app-address-fields [address]="invoiceForm.delivery" /&gt;
// In NESTED loops, alias the outer index. The inner $index shadows it.
//   @for (s of form.sections; track $index; let sectionIndex = $index) {
//     @for (q of s.questions; track $index) { ... }
//   }
</code></pre>
