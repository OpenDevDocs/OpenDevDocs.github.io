---
publishDate: 2026-06-17T10:35
title: Signal Forms Validation
slug: signal-forms-validation
metadescription: Validate signal forms with built in validators, custom rules, conditional logic and asynchronous checks against a server.
updateDate: 2026-09-07T10:35
author: ['bishal-biswas']
level: 2
tags: ['signal forms', 'validation', 'forms']
course: angular
---

## Validators live in the schema

```typescript
import { form, required, email, minLength, maxLength, min, max, pattern }
  from '@angular/forms/signals';

protected readonly signupForm = form(this.model, path => {
  required(path.name, { message: 'Your name is required' });
  minLength(path.name, 2);
  maxLength(path.name, 100);

  required(path.email);
  email(path.email, { message: 'That does not look like an email address' });

  required(path.password);
  minLength(path.password, 8, { message: 'At least 8 characters' });
  pattern(path.password, /[0-9]/, { message: 'Include a number' });

  min(path.age, 18, { message: 'You must be 18 or over' });
  max(path.quantity, 99);
});
```

Every validator takes an optional `message`. Without one you get the error `kind`, such as `required`, which is fine for styling but not for showing a user.

Validation is **reactive**. The rules re-run whenever the model changes, so there is nothing to trigger by hand.

## Reading errors

```html
@if (signupForm.email().touched() && signupForm.email().invalid()) {
  @for (error of signupForm.email().errors(); track error.kind) {
    <p class="error">{{ error.message ?? error.kind }}</p>
  }
}
```

Each error has a `kind` identifying the validator and an optional `message`. Custom validators can add whatever else is useful.

Showing only after `touched()` is the convention. Showing errors on a form the user has not filled in yet is hostile.

A common refinement is to also show errors after a submit attempt, which `submit` handles by marking everything touched.

## Custom validators

```typescript
import { validate, SchemaPathTree } from '@angular/forms/signals';

export function noSpaces(path: SchemaPathTree<string>) {
  validate(path, ctx => {
    return ctx.value().includes(' ')
      ? { kind: 'noSpaces', message: 'Spaces are not allowed' }
      : null;
  });
}
```

```typescript
form(this.model, path => {
  required(path.username);
  noSpaces(path.username);
});
```

Return `null` when valid, and an object with a `kind` when not. Anything else on the object is available to the template.

```typescript
export function inList(path: SchemaPathTree<string>, allowed: string[]) {
  validate(path, ctx => {
    const value = ctx.value();

    return allowed.includes(value)
      ? null
      : { kind: 'notAllowed', message: `Choose one of: ${allowed.join(', ')}`, allowed };
  });
}
```

Writing them as functions taking a path is the convention, and it makes them composable with the built in ones.

## Cross field validation

A validator can read other fields through the context.

```typescript
form(this.model, path => {
  required(path.password);
  required(path.confirmPassword);

  validate(path.confirmPassword, ctx => {
    return ctx.value() === ctx.valueOf(path.password)
      ? null
      : { kind: 'mismatch', message: 'The passwords do not match' };
  });
});
```

`ctx.valueOf(otherPath)` reads another field reactively, so the check re-runs when either field changes.

Validating at the object level works too, when the error belongs to the group rather than one field:

```typescript
validate(path, ctx => {
  const { start, end } = ctx.value();

  return end > start ? null : { kind: 'range', message: 'End must be after start' };
});
```

## Conditional validation

`required` supports a `when` option:

```typescript
form(this.model, path => {
  required(path.companyName, { when: ctx => ctx.valueOf(path.isBusiness) });
});
```

**`when` only works with `required`.** For anything else, use `applyWhen` or `applyWhenValue`:

```typescript
import { applyWhenValue, schema } from '@angular/forms/signals';

const businessRules = schema<Model>(path => {
  required(path.companyName);
  required(path.vatNumber);
  pattern(path.vatNumber, /^[A-Z]{2}[0-9]+$/);
});

form(this.model, path => {
  required(path.email);

  applyWhenValue(path, model => model.isBusiness, businessRules);
});
```

The whole group of rules switches on and off together, which is clearer than scattering conditions across individual validators.

## Disabled, readonly and hidden

These are validation adjacent, and they live in the schema too.

```typescript
import { disabled, readonly, hidden } from '@angular/forms/signals';

form(this.model, path => {
  disabled(path.discount, ctx => !ctx.valueOf(path.isMember));
  readonly(path.id, true);
  hidden(path.internalNotes, ctx => !this.isAdmin());
});
```

```html
@if (!orderForm.internalNotes().hidden()) {
  <textarea [formField]="orderForm.internalNotes"></textarea>
}
```

Putting these in the schema rather than the template means one place decides, and `[formField]` applies the resulting attributes for you.

A disabled field is excluded from validation, which is usually what you want.

## Asynchronous validation

For checks that need a server, such as whether a username is taken.

```typescript
import { validateAsync } from '@angular/forms/signals';

form(this.model, path => {
  required(path.username);
  minLength(path.username, 3);

  validateAsync(path.username, {
    params: ctx => ctx.value(),
    factory: params => resource({
      params,
      loader: async ({ params, abortSignal }) => {
        if (!params) return null;

        const response = await fetch(`/api/username-available?u=${params}`, {
          signal: abortSignal,
        });

        const { available } = await response.json();

        return available ? null : { kind: 'taken', message: 'That username is taken' };
      },
    }),
    onError: () => ({ kind: 'checkFailed', message: 'Could not check availability' }),
  });
});
```

`params` must be a function. The resource aborts the previous request when the value changes, so typing does not leave a queue of stale checks.

Always supply `onError`. Without it, a network failure leaves the field in a confusing state.

## Async validation over HTTP

`validateHttp` is the shorthand when the check is a plain request.

```typescript
import { validateHttp } from '@angular/forms/signals';

form(this.model, path => {
  validateHttp(path.postcode, {
    request: ctx => ({
      url: '/api/postcode-lookup',
      params: { code: ctx.value() },
    }),
    onSuccess: (result: { valid: boolean }) =>
      result.valid ? null : { kind: 'unknownPostcode', message: 'We could not find that postcode' },
    onError: () => ({ kind: 'lookupFailed' }),
  });
});
```

It goes through `HttpClient`, so interceptors and authentication apply.

## Debouncing

Validating on every keystroke against a server is wasteful.

```typescript
import { debounce } from '@angular/forms/signals';

form(this.model, path => {
  debounce(path.username, 400);

  validateHttp(path.username, { ... });
});
```

`debounce(path, 'blur')` waits until the field loses focus instead, which suits expensive checks.

## Pending state

```html
@if (signupForm.username().pending()) {
  <span class="hint">Checking availability...</span>
}

<button [disabled]="signupForm().invalid() || signupForm().pending()">
  Create account
</button>
```

Disabling submit while validation is pending stops a form being submitted before the async check finishes.

## Using a schema library

`validateStandardSchema` accepts any Standard Schema compatible validator, such as Zod.

```typescript
import { z } from 'zod';
import { validateStandardSchema } from '@angular/forms/signals';

const SignupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().min(18),
});

form(this.model, path => {
  validateStandardSchema(path, SignupSchema);
});
```

Useful when the same schema validates on the server, so the rules cannot drift apart.

## Showing a summary

```typescript
protected readonly errorSummary = computed(() => {
  const state = this.signupForm();

  if (state.valid()) return [];

  return [
    ...this.signupForm.name().errors(),
    ...this.signupForm.email().errors(),
    ...this.signupForm.password().errors(),
  ];
});
```

```html
@if (submitted() && errorSummary().length > 0) {
  <div role="alert" class="summary">
    <p>Please fix the following:</p>
    <ul>
      @for (error of errorSummary(); track error.kind) {
        <li>{{ error.message ?? error.kind }}</li>
      }
    </ul>
  </div>
}
```

A summary with `role="alert"` is a genuine accessibility improvement on a long form, since screen reader users do not have to hunt for the failing fields.

## Quick recap

- Validators are declared in the schema and re-run reactively.
- Always pass a `message`, or users see the raw error `kind`.
- Show errors only after `touched()`, and `submit` marks everything touched.
- Custom validators return `null` or an object with a `kind`.
- `ctx.valueOf(otherPath)` enables cross field checks.
- `when` works only with `required`, use `applyWhenValue` for conditional groups.
- Async validation needs `params` as a function and an `onError` handler.

<code id="code-content" class="language-typescript">
import { signal, computed, resource } from '@angular/core';
import { form, schema, validate, validateHttp, validateAsync, debounce,
         required, email, minLength, pattern, min, disabled, hidden,
         applyWhenValue, SchemaPathTree } from '@angular/forms/signals';
interface Model { name: string; email: string; password: string; confirm: string;
                  isBusiness: boolean; companyName: string; username: string; }
const model = signal&lt;Model&gt;({ name: '', email: '', password: '', confirm: '',
                              isBusiness: false, companyName: '', username: '' });
// A group of rules that switches on and off together
const businessRules = schema&lt;Model&gt;(path =&gt; {
  required(path.companyName, { message: 'Company name is required' });
});
// Custom validators are functions taking a path, so they compose with the built ins
function noSpaces(path: SchemaPathTree&lt;string&gt;) {
  validate(path, ctx =&gt; ctx.value().includes(' ')
    ? { kind: 'noSpaces', message: 'Spaces are not allowed' }
    : null);          // null means VALID
}
const signupForm = form(model, path =&gt; {
  // Always pass a message, or the user sees the raw kind ('required')
  required(path.name, { message: 'Your name is required' });
  minLength(path.name, 2);
  email(path.email, { message: 'That does not look like an email address' });
  pattern(path.password, /[0-9]/, { message: 'Include a number' });
  noSpaces(path.username);
  // Cross field: valueOf reads another field REACTIVELY
  validate(path.confirm, ctx =&gt; ctx.value() === ctx.valueOf(path.password)
    ? null : { kind: 'mismatch', message: 'The passwords do not match' });
  // `when` works ONLY with required. For anything else use applyWhenValue.
  required(path.companyName, { when: ctx =&gt; ctx.valueOf(path.isBusiness) });
  applyWhenValue(path, m =&gt; m.isBusiness, businessRules);
  // Disabled fields are excluded from validation
  disabled(path.companyName, ctx =&gt; !ctx.valueOf(path.isBusiness));
  hidden(path.username, () =&gt; false);
  // Debounce before hitting the server on every keystroke.
  // debounce(path, 'blur') waits for focus loss instead.
  debounce(path.username, 400);
  validateHttp(path.username, {
    request: ctx =&gt; ({ url: '/api/username-available', params: { u: ctx.value() } }),
    onSuccess: (r: { available: boolean }) =&gt; r.available
      ? null : { kind: 'taken', message: 'That username is taken' },
    onError: () =&gt; ({ kind: 'checkFailed' }),   // ALWAYS supply this
  });
});
// Template:
//   @if (signupForm.email().touched() &amp;&amp; signupForm.email().invalid()) {
//     @for (e of signupForm.email().errors(); track e.kind) {
//       &lt;p class="error"&gt;{{ e.message ?? e.kind }}&lt;/p&gt;
//     }
//   }
//   @if (signupForm.username().pending()) { &lt;span&gt;Checking...&lt;/span&gt; }
//   &lt;button [disabled]="signupForm().invalid() || signupForm().pending()"&gt;
// An error summary with role="alert" is a real accessibility win on long forms.
</code></pre>
