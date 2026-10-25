---
publishDate: 2026-06-12T09:10
title: 'Custom Pipes: Pure and Impure'
slug: custom-pipes
metadescription: Write your own pipes, understand why pure pipes are cached, and know when a computed signal is the better choice.
updateDate: 2026-09-07T09:10
author: ['bishal-biswas']
level: 2
tags: ['pipes', 'custom', 'performance']
course: angular
---

## Writing one

```typescript
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncate',
})
export class Truncate implements PipeTransform {
  transform(value: string, limit = 50, suffix = '...'): string {
    if (!value) return '';
    if (value.length <= limit) return value;

    return value.slice(0, limit).trimEnd() + suffix;
  }
}
```

```typescript
@Component({
  imports: [Truncate],
  template: `<p>{{ description | truncate:100 }}</p>`,
})
```

The first parameter is the piped value. The rest are the colon separated arguments.

`name` is what appears in templates, and it is camel case by convention. The class name follows the modern naming style, so `truncate.ts` holds `Truncate`.

Generate one with:

```bash
ng g pipe truncate
```

## Typing properly

```typescript
@Pipe({ name: 'initials' })
export class Initials implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';

    return value
      .split(' ')
      .filter(Boolean)
      .map(part => part[0].toUpperCase())
      .join('');
  }
}
```

Accepting `null | undefined` matters. Data often has not arrived when the template first renders, and a pipe that throws on `null` produces an error at exactly the wrong moment.

For generics, overloads keep the types honest:

```typescript
@Pipe({ name: 'sortBy' })
export class SortBy implements PipeTransform {
  transform<T>(items: readonly T[], key: keyof T): T[];
  transform<T>(items: null | undefined, key: keyof T): [];
  transform<T>(items: readonly T[] | null | undefined, key: keyof T): T[] {
    if (!items) return [];

    return [...items].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
  }
}
```

Note `[...items]` before sorting. `Array.sort` mutates, and mutating an input inside a pipe causes very confusing bugs.

## Pure pipes are cached

By default a pipe is **pure**, meaning `transform` runs only when the input reference or an argument changes.

```typescript
@Pipe({ name: 'expensive' })
export class Expensive implements PipeTransform {
  transform(value: number): number {
    console.log('running');
    return heavyCalculation(value);
  }
}
```

```html
<p>{{ price() | expensive }}</p>
```

It logs once, not on every change detection pass. That caching is what makes pipes cheap.

The catch: **it is reference comparison.** Mutating an array does not retrigger the pipe.

```typescript
this.items.push(newItem);         // pipe does not rerun
this.items = [...this.items, newItem];   // it does
```

With signals this is a non issue, since you replace rather than mutate anyway.

## Impure pipes

```typescript
@Pipe({
  name: 'timeAgo',
  pure: false,
})
export class TimeAgo implements PipeTransform {
  transform(value: Date): string {
    return formatRelative(value, new Date());
  }
}
```

An impure pipe runs on **every** change detection pass. That is hundreds of times a second in an active application.

Only two situations justify it: the pipe depends on something Angular cannot see, like the current time, or it manages a subscription, like `async`.

Even for relative time, a signal updated by a timer is usually better:

```typescript
@Injectable({ providedIn: 'root' })
export class Clock {
  readonly now = signal(new Date());

  constructor() {
    const id = setInterval(() => this.now.set(new Date()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
```

```typescript
protected readonly relative = computed(
  () => formatRelative(this.date(), this.clock.now())
);
```

Now it updates once a minute rather than continuously.

## Pipes with dependencies

Pipes can inject.

```typescript
@Pipe({ name: 'translate' })
export class Translate implements PipeTransform {
  private readonly translations = inject(TranslationService);

  transform(key: string, params?: Record<string, string>): string {
    return this.translations.get(key, params);
  }
}
```

```html
<p>{{ 'welcome.title' | translate }}</p>
<p>{{ 'greeting' | translate:{ name: userName() } }}</p>
```

If the injected data changes, a pure pipe will not notice, since its input did not change. Either make the service expose a signal the component reads, or accept that the pipe needs an impure variant.

## Pipes or computed signals?

This is the real decision in modern Angular.

```typescript
// a pipe
@Pipe({ name: 'activeUsers' })
export class ActiveUsers implements PipeTransform {
  transform(users: User[]): User[] {
    return users.filter(u => u.active);
  }
}
```

```typescript
// a computed
protected readonly activeUsers = computed(
  () => this.users().filter(u => u.active)
);
```

```text
Pipe                              Computed signal
reusable across components        one component
works on any expression           reads specific signals
cached by input reference         cached by dependency
needs importing                   nothing to import
visible in the template           logic lives in the class
```

**Use a pipe** when the transformation is genuinely reusable and generic: formatting, truncating, translating.

**Use a computed** when it is specific to this component: filtering this list, deriving this total. It is simpler, has no import, and composes with other signals.

The mistake to avoid is a pipe used in exactly one template, which adds a file and an import for no benefit.

## Do not filter with pipes

A common pattern from older Angular that causes real problems:

```html
<!-- avoid -->
@for (user of users() | filterBy:'active' | sortBy:'name'; track user.id) { ... }
```

Angular deliberately does not ship `filter` or `orderBy` pipes, and the reason is instructive. A pure filter pipe cannot detect mutations, so it looks broken. An impure one runs constantly, so it is slow. And it hides the cost of an operation that is `O(n log n)`.

```typescript
// better
protected readonly visibleUsers = computed(() =>
  this.users()
    .filter(u => u.active)
    .sort((a, b) => a.name.localeCompare(b.name))
);
```

```html
@for (user of visibleUsers(); track user.id) { ... }
```

Cached properly, tracked properly, and testable without rendering anything.

## Testing

A pipe is a plain class, so it needs no TestBed.

```typescript
describe('Truncate', () => {
  const pipe = new Truncate();

  it('leaves short strings alone', () => {
    expect(pipe.transform('short', 10)).toBe('short');
  });

  it('truncates and adds a suffix', () => {
    expect(pipe.transform('a very long string', 6)).toBe('a very...');
  });

  it('handles null', () => {
    expect(pipe.transform(null as unknown as string)).toBe('');
  });
});
```

For a pipe with dependencies, use `TestBed.runInInjectionContext` or provide fakes.

## Quick recap

- A pipe is a class with a `transform` method and a `@Pipe` decorator.
- The first parameter is the value, the rest are the colon separated arguments.
- Accept `null` and `undefined`, since data often has not arrived yet.
- Pure pipes are cached by input reference, so never mutate the input.
- Impure pipes run on every change detection pass, so justify them carefully.
- Prefer a `computed` for anything specific to one component.
- Never filter or sort a list with a pipe, use a computed signal.

<code id="code-content" class="language-typescript">
import { Pipe, PipeTransform, Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
// The first parameter is the piped value, the rest are the : arguments.
// Accept null and undefined: data often has not arrived on first render.
@Pipe({ name: 'truncate' })
export class Truncate implements PipeTransform {
  transform(value: string | null | undefined, limit = 50, suffix = '...'): string {
    if (!value) return '';
    return value.length &lt;= limit ? value : value.slice(0, limit).trimEnd() + suffix;
  }
}
// Used as:  {{ description | truncate:100 }}   with imports: [Truncate]
// Pipes can inject
@Pipe({ name: 'translate' })
export class Translate implements PipeTransform {
  private readonly translations = inject(TranslationService);
  transform(key: string, params?: Record&lt;string, string&gt;): string {
    return this.translations.get(key, params);
  }
}
// PURE (the default): transform runs only when the input REFERENCE changes.
// So never mutate the input, and never mutate inside the pipe:
@Pipe({ name: 'sortBy' })
export class SortBy implements PipeTransform {
  transform&lt;T&gt;(items: readonly T[] | null, key: keyof T): T[] {
    if (!items) return [];
    return [...items].sort((a, b) =&gt;      // copy first: sort() MUTATES
      String(a[key]).localeCompare(String(b[key])));
  }
}
// IMPURE runs on EVERY change detection pass. Hundreds of times a second.
// Only justified for values Angular cannot see, like the current time.
@Pipe({ name: 'timeAgo', pure: false })
export class TimeAgo implements PipeTransform {
  transform(value: Date): string { return formatRelative(value, new Date()); }
}
// Usually better: a signal updated by a timer, so it recomputes once a minute
@Injectable({ providedIn: 'root' })
export class Clock {
  readonly now = signal(new Date());
  constructor() {
    const id = setInterval(() =&gt; this.now.set(new Date()), 60_000);
    inject(DestroyRef).onDestroy(() =&gt; clearInterval(id));
  }
}
// Pipe or computed?
//   pipe     reusable across components, generic formatting
//   computed specific to THIS component, no import, composes with signals
// NEVER filter or sort a list with a pipe. Angular deliberately ships no
// filter or orderBy pipe: pure ones miss mutations, impure ones run constantly.
//   protected readonly visible = computed(() =&gt;
//     this.users().filter(u =&gt; u.active).sort((a, b) =&gt; a.name.localeCompare(b.name)));
// Testing needs no TestBed, because a pipe is a plain class:
//   const pipe = new Truncate();
//   expect(pipe.transform('a very long string', 6)).toBe('a very...');
</code></pre>
