---
publishDate: 2026-06-12T09:05
title: Built-in Pipes and Formatting
slug: built-in-pipes
metadescription: 'Format dates, numbers, currency and text in templates with Angular''s built in pipes, and know which ones are expensive.'
updateDate: 2026-09-07T09:05
author: ['bishal-biswas']
level: 1
tags: ['pipes', 'formatting', 'templates']
course: angular
---

## A pipe transforms a display value

```html
<p>{{ price | currency:'GBP' }}</p>
<p>{{ created | date:'medium' }}</p>
<p>{{ name | uppercase }}</p>
```

The `|` passes the value on the left into the pipe on the right. Arguments follow with colons.

Pipes are for **display formatting**. They do not change the underlying data.

## Importing them

Each pipe is a separate standalone class.

```typescript
import { DatePipe, CurrencyPipe, DecimalPipe } from '@angular/common';

@Component({
  imports: [DatePipe, CurrencyPipe, DecimalPipe],
  ...
})
```

Older code imports `CommonModule` instead, which brings all of them plus the legacy directives. Importing individually is leaner.

## Text pipes

```html
{{ 'hello' | uppercase }}          <!-- HELLO -->
{{ 'HELLO' | lowercase }}          <!-- hello -->
{{ 'hello world' | titlecase }}    <!-- Hello World -->
{{ longText | slice:0:100 }}       <!-- first 100 characters -->
{{ items | slice:1:4 }}            <!-- works on arrays too -->
```

`slice` takes the same arguments as `Array.slice`, including negatives:

```html
{{ items | slice:-3 }}             <!-- last three -->
```

## Number pipes

```html
{{ 3.14159 | number }}             <!-- 3.142 -->
{{ 3.14159 | number:'1.2-2' }}     <!-- 3.14 -->
{{ 42 | number:'3.0-0' }}          <!-- 042 -->
{{ 0.256 | percent }}              <!-- 26% -->
{{ 0.256 | percent:'1.1-1' }}      <!-- 25.6% -->
```

The format string is `minIntegerDigits.minFractionDigits-maxFractionDigits`. So `'1.2-2'` means at least one digit before the point and exactly two after.

## Currency

```html
{{ 42.5 | currency }}                    <!-- $42.50, the default is USD -->
{{ 42.5 | currency:'GBP' }}              <!-- £42.50 -->
{{ 42.5 | currency:'INR' }}              <!-- ₹42.50 -->
{{ 42.5 | currency:'EUR':'code' }}       <!-- EUR42.50 -->
{{ 42.5 | currency:'GBP':'symbol':'1.0-0' }}   <!-- £43 -->
```

Arguments in order: currency code, display style, digit format, locale.

Set the application default rather than repeating the code everywhere:

```typescript
providers: [
  { provide: DEFAULT_CURRENCY_CODE, useValue: 'GBP' },
  { provide: LOCALE_ID, useValue: 'en-GB' },
]
```

## Date

```html
{{ now | date }}                     <!-- Sep 7, 2026 -->
{{ now | date:'short' }}             <!-- 9/7/26, 2:15 PM -->
{{ now | date:'medium' }}            <!-- Sep 7, 2026, 2:15:30 PM -->
{{ now | date:'fullDate' }}          <!-- Monday, September 7, 2026 -->
{{ now | date:'dd/MM/yyyy' }}        <!-- 07/09/2026 -->
{{ now | date:'HH:mm' }}             <!-- 14:15 -->
{{ now | date:'yyyy-MM-dd' }}        <!-- 2026-09-07 -->
{{ now | date:'medium':'UTC' }}      <!-- in UTC -->
{{ now | date:'medium':'':'fr' }}    <!-- in French -->
```

It accepts a `Date`, a timestamp number, or an ISO string, which is what an API usually returns.

```typescript
protected readonly created = '2026-09-07T14:15:30Z';   // works directly
```

Watch the format tokens. `MM` is month and `mm` is minutes, `DD` is not valid, and `dd` is day. Getting these confused is a classic bug.

## json

```html
<pre>{{ user | json }}</pre>
```

For debugging only. It stringifies with indentation, which beats seeing `[object Object]`.

Do not ship it. It is slow on large objects and exposes everything on the object.

## keyvalue

Iterating an object or a `Map`.

```html
@for (entry of settings | keyvalue; track entry.key) {
  <p>{{ entry.key }}: {{ entry.value }}</p>
}
```

It sorts by key by default. Pass a comparison to change that, or `null` to keep insertion order:

```html
@for (entry of settings | keyvalue:originalOrder; track entry.key) { ... }
```

```typescript
protected originalOrder = () => 0;
```

## async

The one that does real work. It subscribes to an observable or promise, returns the latest value, and unsubscribes when the component is destroyed.

```typescript
import { AsyncPipe } from '@angular/common';

@Component({
  imports: [AsyncPipe],
  template: `
    @if (users$ | async; as users) {
      <p>{{ users.length }} users</p>
    }
  `,
})
export class UserList {
  protected readonly users$ = inject(HttpClient).get<User[]>('/api/users');
}
```

Before signals this was the standard way to render asynchronous data. It is still correct and still everywhere.

The important detail: **each `| async` creates its own subscription.** Using it twice on the same observable makes two HTTP requests.

```html
<!-- two subscriptions, two requests -->
<p>{{ (users$ | async)?.length }}</p>
<p>{{ (users$ | async)?.[0]?.name }}</p>

<!-- one subscription -->
@if (users$ | async; as users) {
  <p>{{ users.length }}</p>
  <p>{{ users[0]?.name }}</p>
}
```

In new code, `toSignal` or `httpResource` is usually clearer:

```typescript
protected readonly users = httpResource<User[]>(() => '/api/users');
```

```html
@if (users.value(); as list) { <p>{{ list.length }} users</p> }
```

## i18n pipes

```html
{{ count | i18nPlural: pluralMap }}
{{ gender | i18nSelect: genderMap }}
```

```typescript
protected readonly pluralMap = {
  '=0': 'No items',
  '=1': 'One item',
  other: '# items',
};
```

Useful for pluralisation without a full translation setup. `#` is replaced by the number.

## Chaining

```html
{{ created | date:'fullDate' | uppercase }}
{{ price | currency:'GBP' | slice:0:10 }}
```

Left to right. Readable up to two pipes, confusing beyond that. Move anything longer into a `computed`.

## Performance

Pipes are **pure** by default, meaning they only recompute when the input reference changes. That makes them cheap.

```html
{{ price | currency:'GBP' }}      <!-- recomputed only when price changes -->
```

The exceptions are `async`, `json` and `keyvalue`, which are impure and run on every change detection pass. Keep `json` out of production templates, and avoid `keyvalue` on large objects.

## Locale

Date, number, currency and percent all depend on the locale, which defaults to `en-US`.

```typescript
import { registerLocaleData } from '@angular/common';
import localeEnGb from '@angular/common/locales/en-GB';

registerLocaleData(localeEnGb);

providers: [{ provide: LOCALE_ID, useValue: 'en-GB' }]
```

Without registering the locale data, non default locales throw at runtime.

## Quick recap

- A pipe formats a value for display, using `|` with colon separated arguments.
- Import each pipe individually rather than pulling in `CommonModule`.
- The number format string is `minInt.minFrac-maxFrac`.
- In date formats, `MM` is month and `mm` is minutes.
- `async` subscribes and unsubscribes for you, but each use is a separate subscription.
- `json` and `keyvalue` are impure, so keep `json` out of production.
- Set `LOCALE_ID` and `DEFAULT_CURRENCY_CODE` once instead of repeating arguments.

<code id="code-content" class="language-typescript">
import { Component, inject, signal, LOCALE_ID, DEFAULT_CURRENCY_CODE } from '@angular/core';
import { DatePipe, CurrencyPipe, DecimalPipe, PercentPipe, SlicePipe,
         TitleCasePipe, JsonPipe, KeyValuePipe, AsyncPipe } from '@angular/common';
@Component({
  selector: 'app-pipes',
  // Import each pipe individually. CommonModule brings all of them plus more.
  imports: [DatePipe, CurrencyPipe, DecimalPipe, PercentPipe, SlicePipe,
            TitleCasePipe, JsonPipe, KeyValuePipe, AsyncPipe],
  template: `
    &lt;!-- text --&gt;
    {{ 'hello world' | titlecase }}          &lt;!-- Hello World --&gt;
    {{ longText | slice:0:100 }}             &lt;!-- also works on arrays --&gt;
    {{ items | slice:-3 }}                   &lt;!-- last three --&gt;
    &lt;!-- numbers: minInt.minFrac-maxFrac --&gt;
    {{ 3.14159 | number:'1.2-2' }}           &lt;!-- 3.14 --&gt;
    {{ 42 | number:'3.0-0' }}                &lt;!-- 042 --&gt;
    {{ 0.256 | percent:'1.1-1' }}            &lt;!-- 25.6% --&gt;
    &lt;!-- currency: code, display, digits --&gt;
    {{ 42.5 | currency:'GBP' }}              &lt;!-- £42.50 --&gt;
    {{ 42.5 | currency:'GBP':'symbol':'1.0-0' }}   &lt;!-- £43 --&gt;
    &lt;!-- dates. MM is MONTH, mm is MINUTES. Accepts a Date, number or ISO string. --&gt;
    {{ created | date:'dd/MM/yyyy HH:mm' }}
    {{ created | date:'medium':'UTC' }}
    &lt;!-- debugging only, and impure: it runs on EVERY check --&gt;
    &lt;pre&gt;{{ user() | json }}&lt;/pre&gt;
    &lt;!-- iterate an object, sorted by key unless you pass a comparison --&gt;
    @for (entry of settings | keyvalue; track entry.key) {
      &lt;p&gt;{{ entry.key }}: {{ entry.value }}&lt;/p&gt;
    }
    &lt;!-- async subscribes AND unsubscribes. Each use is its OWN subscription,
         so this pattern makes ONE request, not two. --&gt;
    @if (users$ | async; as users) {
      &lt;p&gt;{{ users.length }}&lt;/p&gt;
      &lt;p&gt;{{ users[0]?.name }}&lt;/p&gt;
    }
  `,
})
export class Pipes {
  protected readonly created = '2026-09-07T14:15:30Z';   // an ISO string works
  protected readonly user = signal({ name: 'Asha' });
  protected readonly items = [1, 2, 3, 4, 5];
  protected readonly longText = 'a long piece of text';
  protected readonly settings = { theme: 'dark', locale: 'en-GB' };
  protected readonly users$ = inject(HttpClient).get&lt;{ name: string }[]&gt;('/api/users');
}
// Set these ONCE instead of repeating arguments in every template:
//   { provide: LOCALE_ID, useValue: 'en-GB' }
//   { provide: DEFAULT_CURRENCY_CODE, useValue: 'GBP' }
// Non default locales also need registerLocaleData(), or they throw at runtime.
// Pipes are PURE by default: recomputed only when the input reference changes.
// async, json and keyvalue are impure and run on every pass.
</code></pre>
