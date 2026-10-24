---
publishDate: 2026-06-03T06:35
title: Templates and Interpolation
slug: templates-and-interpolation
metadescription: Write Angular templates, display values with interpolation, and understand what template expressions can and cannot do.
updateDate: 2026-09-07T06:35
author: ['bishal-biswas']
level: 1
tags: ['templates', 'interpolation', 'basics']
course: angular
---

## Templates are HTML with extras

An Angular template is HTML, plus a small syntax for reading data and reacting to events.

```typescript
@Component({
  selector: 'app-greeting',
  template: `
    <h1>Hello, {{ name }}</h1>
    <p>You have {{ messageCount }} messages.</p>
  `,
})
export class Greeting {
  protected readonly name = 'Asha';
  protected readonly messageCount = 3;
}
```

The double braces are **interpolation**. Angular evaluates what is inside against the component and puts the result in the DOM as text.

## Inline or separate file

```typescript
// inline, good for short templates
@Component({
  template: `<p>{{ name }}</p>`,
})

// separate file, better once it grows
@Component({
  templateUrl: './greeting.html',
})
```

Use backticks for inline templates so they can span lines. Move to a file at around twenty lines, when the component class starts getting lost below it.

## What goes inside the braces

Interpolation takes a **template expression**. It looks like JavaScript but is deliberately restricted.

```html
{{ name }}
{{ user.email }}
{{ items.length }}
{{ price * quantity }}
{{ firstName + ' ' + lastName }}
{{ isActive ? 'Yes' : 'No' }}
{{ getLabel() }}
{{ count() }}                <!-- calling a signal -->
{{ user?.address?.city }}
{{ nickname ?? 'Anonymous' }}
```

The result is converted to a string. Objects become `[object Object]`, so use the `json` pipe when debugging:

```html
<pre>{{ user | json }}</pre>
```

## What is not allowed

Template expressions cannot have side effects, and several JavaScript operators are banned.

```html
{{ count = 5 }}          <!-- no assignment -->
{{ count++ }}            <!-- no increment -->
{{ new Date() }}         <!-- no new -->
{{ a; b }}               <!-- no chaining with ; -->
{{ x || y }}             <!-- allowed, but ?? is usually better -->
{{ typeof x }}           <!-- not supported -->
{{ window.innerWidth }}  <!-- no global scope -->
```

Expressions are evaluated against the component instance only. There is no `window`, `document` or `console`. If a template needs something global, expose it from the class.

```typescript
export class Layout {
  protected readonly width = signal(window.innerWidth);
}
```

## Do not call expensive methods

An expression can be evaluated many times. Anything expensive inside one is a performance problem.

```html
<!-- runs on every check -->
<p>{{ calculateTotal() }}</p>
```

```typescript
// better: a computed signal, recalculated only when its inputs change
protected readonly total = computed(() =>
  this.items().reduce((sum, i) => sum + i.price, 0)
);
```

```html
<p>{{ total() }}</p>
```

Calling a **signal** is cheap and is exactly how they are meant to be used. Calling an ordinary method that does real work is not.

## Safe navigation

```html
<p>{{ user.address.city }}</p>     <!-- throws if address is undefined -->
<p>{{ user?.address?.city }}</p>   <!-- renders nothing instead -->
```

`?.` is essential for data that arrives asynchronously, since the template renders before the response lands.

## Escaping and safety

Angular escapes interpolated values. This is the reason cross site scripting is hard to introduce by accident.

```typescript
protected readonly comment = '<script>alert(1)</script>';
```

```html
<p>{{ comment }}</p>
```

That renders the tags as visible text. Nothing executes.

Binding to `innerHTML` sanitises rather than escapes, removing dangerous parts while keeping safe markup:

```html
<div [innerHTML]="comment"></div>
```

Only bypass this when you genuinely control the content, and understand the risk. The security topic covers it properly.

## Comments and whitespace

```html
<!-- HTML comments are stripped from the build -->
```

Angular collapses insignificant whitespace by default. Turn it off per component if whitespace matters, such as inside a `<pre>`:

```typescript
@Component({
  preserveWhitespaces: true,
  ...
})
```

## Template type checking

With `strictTemplates` on, templates are type checked against the class.

```typescript
export class Profile {
  protected readonly user = signal<{ name: string } | null>(null);
}
```

```html
{{ user().name }}          <!-- error: user() may be null -->
{{ user()?.name }}         <!-- fine -->

@if (user(); as u) {
  {{ u.name }}             <!-- fine, narrowed to non-null -->
}
```

A misspelt property is a build error rather than a blank space in the browser. This is one of Angular's genuinely strong points, and it only works if you leave `strictTemplates` enabled.

## Multi-line and formatting

```html
<p>
  {{ user().firstName }}
  {{ user().lastName }}
</p>
```

Interpolation can span lines, though long expressions are usually better as a computed signal in the class. Templates are easier to read when they contain almost no logic.

## Quick recap

- Templates are HTML plus a restricted expression syntax.
- `{{ }}` interpolates a value and converts it to a string.
- Expressions cannot assign, increment or use `new`, and have no access to globals.
- Calling a signal in a template is cheap, calling an expensive method is not.
- Use `?.` for data that has not arrived yet.
- Interpolated values are escaped, so injected markup renders as text.
- `strictTemplates` turns template typos into build errors, so leave it on.

<code id="code-content" class="language-typescript">
import { Component, signal, computed } from '@angular/core';
import { JsonPipe } from '@angular/common';
@Component({
  selector: 'app-greeting',
  imports: [JsonPipe],
  template: `
    &lt;h1&gt;Hello, {{ name }}&lt;/h1&gt;
    &lt;p&gt;{{ firstName + ' ' + lastName }}&lt;/p&gt;
    &lt;p&gt;{{ isActive ? 'Active' : 'Inactive' }}&lt;/p&gt;
    &lt;p&gt;{{ nickname ?? 'Anonymous' }}&lt;/p&gt;
    &lt;!-- safe navigation for data that has not arrived yet --&gt;
    &lt;p&gt;{{ user()?.city }}&lt;/p&gt;
    &lt;!-- narrowing with `as` removes the null from the type --&gt;
    @if (user(); as u) { &lt;p&gt;{{ u.city }}&lt;/p&gt; }
    &lt;!-- calling a SIGNAL is cheap. Calling a heavy method is not. --&gt;
    &lt;p&gt;Total: {{ total() }}&lt;/p&gt;
    &lt;!-- json pipe for debugging, since objects stringify to [object Object] --&gt;
    &lt;pre&gt;{{ user() | json }}&lt;/pre&gt;
    &lt;!-- interpolated values are ESCAPED, so this renders as visible text --&gt;
    &lt;p&gt;{{ comment }}&lt;/p&gt;
  `,
})
export class Greeting {
  protected readonly name = 'Asha';
  protected readonly firstName = 'Asha';
  protected readonly lastName = 'Biswas';
  protected readonly isActive = true;
  protected readonly nickname: string | null = null;
  protected readonly comment = '&lt;script&gt;alert(1)&lt;/script&gt;';   // rendered as text
  protected readonly user = signal&lt;{ city: string } | null&gt;(null);
  protected readonly items = signal([{ price: 10 }, { price: 32 }]);
  // Prefer a computed signal over a method call in the template
  protected readonly total = computed(() =&gt;
    this.items().reduce((sum, i) =&gt; sum + i.price, 0));
}
// NOT allowed in template expressions: assignment, ++, new, ;, typeof,
// and there is no window, document or console. Expose those from the class.
</code></pre>
