---
publishDate: 2026-06-01T06:05
title: TypeScript Essentials for Angular
slug: typescript-essentials-for-angular
metadescription: The TypeScript you actually need for Angular, from types and interfaces to generics, strict null checks and the decorators Angular relies on.
updateDate: 2026-09-07T06:05
author: ['bishal-biswas']
level: 1
tags: ['typescript', 'types', 'fundamentals']
course: angular
---

## Why Angular insists on TypeScript

Angular is written in TypeScript and expects you to use it. That is not decoration. The template compiler type checks your templates against your component classes, so a typo in a binding is a build error rather than a blank space on the page.

You do not need advanced TypeScript. You need about a dozen things, and they are all here.

## Basic types

```typescript
let name: string = 'Asha';
let age: number = 30;
let active: boolean = true;
let tags: string[] = ['admin', 'editor'];
let anything: unknown = fetchSomething();

// usually you can leave the type out, it is inferred
let city = 'Delhi';       // string
let counts = [1, 2, 3];   // number[]
```

Write the type when it is not obvious from the value. Leave it out when it is. Annotating everything makes code noisier without making it safer.

## Interfaces and types

An interface describes the shape of an object. This is the single most useful TypeScript feature in Angular, because it describes your API responses.

```typescript
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';   // only these three strings
  lastLogin?: Date;                       // optional
  readonly createdAt: Date;               // cannot be reassigned
}
```

`type` does almost the same job and can do more:

```typescript
type Status = 'idle' | 'loading' | 'error';
type Id = string | number;
type UserSummary = Pick<User, 'id' | 'name'>;
type UserDraft = Omit<User, 'id' | 'createdAt'>;
type MaybeUser = User | null;
```

Use `interface` for object shapes you might extend, and `type` for unions and derived types. In practice either is fine, so pick one and be consistent.

## Union types are the useful trick

A union says "one of these". Angular code uses them constantly for state.

```typescript
type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; users: User[] };

function render(state: LoadState) {
  switch (state.status) {
    case 'loading':
      return 'Please wait';
    case 'error':
      return state.message;      // TypeScript knows message exists here
    case 'ready':
      return `${state.users.length} users`;
  }
}
```

This is a **discriminated union**. Checking `state.status` narrows the type, so the compiler knows which properties are available in each branch. It makes impossible states impossible.

## Strict null checks

Angular projects enable `strict` mode by default, and the most important part is that `null` and `undefined` are not assignable to everything.

```typescript
let name: string = null;         // error under strict mode
let name: string | null = null;  // fine
```

That forces you to handle the missing case:

```typescript
function greet(user: User | null): string {
  if (user === null) return 'Hello, stranger';
  return `Hello, ${user.name}`;
}

// or shorter
const display = user?.name ?? 'Anonymous';
```

`?.` returns `undefined` instead of throwing when the left side is null. `??` supplies a fallback when the left side is null or undefined, but not when it is `0` or `''`, which is why it beats `||`.

```typescript
const count = 0;
console.log(count || 10);   // 10, probably not what you wanted
console.log(count ?? 10);   // 0, correct
```

## The non-null assertion

`!` tells the compiler "trust me, this is not null". It turns off a safety check, so it needs a reason.

```typescript
const element = document.getElementById('app')!;   // I know it exists
```

In Angular you will see it on properties assigned by the framework rather than the constructor. Prefer `?` and `??` where you can, and reserve `!` for cases where you genuinely know better than the compiler.

## Generics

A generic is a type that takes a type. You will use them far more often than you write them.

```typescript
// using them: extremely common
const users = signal<User[]>([]);
this.http.get<User[]>('/api/users');
const cache = new Map<string, User>();

// writing one: less common, but not hard
function first<T>(items: T[]): T | undefined {
  return items[0];
}

const firstUser = first(users());   // T is inferred as User
```

`<User[]>` on the HTTP call is the important one. Without it the response is `Object` and you get no help at all. With it, every property is checked.

## Classes and access modifiers

Angular components and services are classes.

```typescript
export class UserProfile {
  public name = '';            // default, visible everywhere
  private token = '';          // this class only
  protected role = 'viewer';   // this class and subclasses, and templates
  readonly id = 1;             // cannot be reassigned after construction
}
```

`protected` matters in Angular. A template can read `public` and `protected` members but not `private` ones. Modern Angular style marks template-only members `protected`, which keeps the public surface of the class honest.

```typescript
@Component({ template: `{{ label }}` })
export class Badge {
  protected readonly label = 'New';   // template can read it, other code cannot
}
```

## Decorators

A decorator is the `@Something` syntax that attaches metadata to a class or member. Angular uses them for its core building blocks.

```typescript
@Component({ ... })   // this class is a component
@Injectable({ ... })  // this class can be injected
@Directive({ ... })   // this class is a directive
@Pipe({ ... })        // this class is a pipe
```

You almost never write your own. You just apply Angular's.

Note that modern Angular has moved away from decorators for **members**. `@Input()` and `@Output()` are being replaced by the `input()` and `output()` functions, which give better types and work with signals.

## Type narrowing in templates

The template compiler narrows types too, which is why `@if` blocks are safer than they look.

```typescript
@Component({
  template: `
    @if (user(); as u) {
      <p>{{ u.name }}</p>       <!-- u is User, not User | null -->
    } @else {
      <p>Not signed in</p>
    }
  `,
})
export class Profile {
  readonly user = signal<User | null>(null);
}
```

The `as u` binding captures the narrowed value, so the compiler knows it is not null inside the block.

## Configuring strictness

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true
  },
  "angularCompilerOptions": {
    "strictTemplates": true,
    "typeCheckHostBindings": true
  }
}
```

`strictTemplates` is the one worth protecting. It type checks bindings in your templates, catching a whole class of runtime bugs at build time. New projects enable it. Do not turn it off to silence errors.

## Quick recap

- Angular type checks templates, so TypeScript is doing real work for you.
- Interfaces describe API shapes, and unions describe the states something can be in.
- Discriminated unions make impossible states impossible.
- Strict null checks force you to handle missing values, with `?.` and `??`.
- Use `??` rather than `||` so `0` and empty strings survive.
- Pass a generic to `http.get<User[]>()` or you get no type safety at all.
- Mark template-only members `protected`, and keep `strictTemplates` on.

<code id="code-content" class="language-typescript">
// Interfaces describe the shape of your data, especially API responses
export interface User {
  id: number;
  name: string;
  role: 'admin' | 'editor' | 'viewer';   // a union of allowed strings
  lastLogin?: Date;                       // optional
  readonly createdAt: Date;
}
// Derived types save you repeating yourself
type UserSummary = Pick&lt;User, 'id' | 'name'&gt;;
type UserDraft = Omit&lt;User, 'id' | 'createdAt'&gt;;
// A discriminated union makes impossible states impossible
type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; users: User[] };
function describe(state: LoadState): string {
  switch (state.status) {
    case 'loading': return 'Please wait';
    case 'error':   return state.message;          // narrowed: message exists
    case 'ready':   return `${state.users.length} users`;
  }
}
// Strict null checks force you to handle the missing case
function greet(user: User | null): string {
  return user ? `Hello, ${user.name}` : 'Hello, stranger';
}
const display = (u: User | null) =&gt; u?.name ?? 'Anonymous';
// ?? beats || because 0 and '' survive
console.log(0 || 10);    // 10, probably wrong
console.log(0 ?? 10);    // 0,  correct
// Pass the generic or you get no type safety from HTTP at all
// this.http.get&lt;User[]&gt;('/api/users')
// Access modifiers: templates can read public and protected, never private
export class Badge {
  protected readonly label = 'New';    // template only, not public API
  private readonly token = 'secret';   // invisible to the template
}
</code></pre>
