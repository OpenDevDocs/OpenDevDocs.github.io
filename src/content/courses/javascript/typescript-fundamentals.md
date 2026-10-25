---
publishDate: 2026-03-29T09:48
title: TypeScript Fundamentals
slug: typescript-fundamentals
metadescription: Add types to JavaScript to catch mistakes before you run the code. Basic types, interfaces, generics and how to get started.
updateDate: 2026-09-05T09:48
author: ['bishal-biswas']
level: 3
tags: ['typescript', 'tooling']
course: javascript
---

## What TypeScript adds

TypeScript is JavaScript with types. You write the same language plus annotations, and a compiler checks that everything lines up before the code runs.

```javascript
function greet(name) {
  return 'Hello ' + name.toUpperCase();
}
greet(42);
```

That crashes at runtime with `name.toUpperCase is not a function`. Maybe in front of a user.

```typescript
function greet(name: string) {
  return 'Hello ' + name.toUpperCase();
}
greet(42);
```

TypeScript refuses to compile: *Argument of type 'number' is not assignable to parameter of type 'string'.* You find out while typing, not in production.

Every valid JavaScript file is already valid TypeScript, so you can adopt it gradually.

## Getting started

```bash
npm install --save-dev typescript
npx tsc --init
npx tsc
```

Modern runtimes make this easier still. Node.js 24 and later can run a `.ts` file directly by stripping the types, and build tools like Vite handle it out of the box.

## Basic types

```typescript
let name: string = 'Asha';
let age: number = 28;
let isActive: boolean = true;
let nothing: null = null;
let notSet: undefined = undefined;
let scores: number[] = [90, 85, 78];
let names: Array<string> = ['Asha', 'Ben'];
let pair: [string, number] = ['Asha', 28];
```

Most of the time you can leave the annotation off, because TypeScript works it out:

```typescript
let name = 'Asha';
name = 42;
```

Write annotations on function parameters and returns. Let inference handle the rest.

## `any` and `unknown`

```typescript
let value: any = 'hello';
value.doesNotExist();
let safer: unknown = 'hello';
safer.toUpperCase();
if (typeof safer === 'string') {
  console.log(safer.toUpperCase());
}
```

`any` switches checking off completely, and sprinkling it everywhere defeats the point. `unknown` says "I do not know yet", and forces you to check before using it.

## Functions

```typescript
function add(a: number, b: number): number {
  return a + b;
}
const multiply = (a: number, b: number): number => a * b;
function greet(name: string, greeting: string = 'Hello'): string {
  return `${greeting}, ${name}`;
}
function log(message: string, level?: 'info' | 'error'): void {
  console.log(message, level);
}
```

`void` means it returns nothing useful. The `?` marks a parameter as optional.

## Interfaces and type aliases

```typescript
interface User {
  id: number;
  name: string;
  email?: string;
  readonly createdAt: Date;
}
const user: User = {
  id: 1,
  name: 'Asha',
  createdAt: new Date()
};
user.createdAt = new Date();
```

A type alias does much the same, and also works for things that are not objects:

```typescript
type ID = number | string;
type Status = 'pending' | 'active' | 'cancelled';
type Point = { x: number; y: number };
type Handler = (event: string) => void;
```

Use `interface` for object shapes, especially ones others may extend. Use `type` for unions and everything else.

## Union types

This is where TypeScript starts feeling genuinely useful.

```typescript
type Status = 'loading' | 'success' | 'error';
function render(status: Status) {
  if (status === 'loading') return 'Please wait';
  if (status === 'success') return 'Done';
  return 'Something went wrong';
}
render('loading');
render('done');
```

The editor autocompletes the three valid values and rejects anything else.

### Narrowing

```typescript
function format(value: string | number): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  return value.toFixed(2);
}
```

Inside the `if`, TypeScript knows it is a string. After it, it knows it is a number.

## Generics

A generic is a type you fill in later.

```typescript
function first(items: any[]): any {
  return items[0];
}
function firstTyped<T>(items: T[]): T {
  return items[0];
}
const a = firstTyped([1, 2, 3]);
const b = firstTyped(['x', 'y']);
```

`T` is a placeholder. Pass numbers and you get a number back, with no `any` and no cast.

```typescript
interface ApiResponse<T> {
  data: T;
  status: number;
}
const userResponse: ApiResponse<User> = {
  data: { id: 1, name: 'Asha', createdAt: new Date() },
  status: 200
};
```

## Handy utility types

```typescript
type PartialUser = Partial<User>;
type RequiredUser = Required<User>;
type ReadonlyUser = Readonly<User>;
type UserPreview = Pick<User, 'id' | 'name'>;
type UserWithoutId = Omit<User, 'id'>;
type UsersById = Record<number, User>;
```

`Partial` is especially common for update functions, where every field is optional.

## Classes

```typescript
class Account {
  private balance = 0;
  constructor(public readonly owner: string) {}
  deposit(amount: number): this {
    if (amount <= 0) throw new RangeError('Must be positive');
    this.balance += amount;
    return this;
  }
  getBalance(): number {
    return this.balance;
  }
}
const account = new Account('Asha');
account.deposit(500);
console.log(account.getBalance());
```

`public readonly owner` in the constructor declares and assigns the property in one go. Note that `private` is enforced only at compile time. For real runtime privacy use `#` fields.

## Typing DOM code

```typescript
const input = document.querySelector('#email') as HTMLInputElement;
console.log(input.value);
const button = document.querySelector<HTMLButtonElement>('#save');
if (button) {
  button.disabled = true;
}
```

`querySelector` returns `Element | null`, so you need to narrow or assert. Prefer the generic form and a `null` check over `as`, which switches off checking.

## Reading errors

TypeScript errors look long but follow a pattern:

```typescript
// Type 'string' is not assignable to type 'number'.
// Property 'email' is missing in type '{ id: number; }'
//   but required in type 'User'.
```

Read the first line, which names the mismatch, and the last, which names what was expected.

## Is it worth it?

**Yes** for anything with more than one developer or more than a few months of life. Refactoring safely, real autocomplete, and self documenting function signatures pay for the setup many times over.

**Maybe not** for a small script or a quick prototype.

A middle path is JSDoc comments, which give you type checking in editors without a build step:

```javascript
/**
 * @param {string} name
 * @param {number} age
 * @returns {string}
 */
function describe(name, age) {
  return `${name} is ${age}`;
}
```

## Quick recap

- TypeScript checks types before your code runs, and compiles to plain JavaScript.
- Annotate function parameters and returns, let inference do the rest.
- Prefer `unknown` over `any` when a type is genuinely unknown.
- Use `interface` for object shapes, `type` for unions and aliases.
- Union types plus narrowing catch a whole class of bugs.
- Generics keep types flowing through reusable code.
- `Partial`, `Pick`, `Omit` and `Record` save a lot of typing.

<code id="code-content" class="language-typescript">
// Types are checked before the code ever runs
function greet(name: string): string {
  return 'Hello ' + name.toUpperCase();
}
// greet(42);   Error: number is not assignable to string
console.log(greet('Asha'));
// Interfaces describe object shapes
interface User {
  id: number;
  name: string;
  email?: string;              // optional
  readonly createdAt: Date;    // cannot be reassigned
}
const user: User = { id: 1, name: 'Asha', createdAt: new Date() };
console.log(user.name);
// Union types limit a value to a known set
type Status = 'loading' | 'success' | 'error';
function render(status: Status): string {
  if (status === 'loading') return 'Please wait';
  if (status === 'success') return 'Done';
  return 'Something went wrong';
}
console.log(render('success'));
// render('done');   Error: not one of the three allowed values
// Narrowing tells TypeScript which type you have in each branch
function format(value: string | number): string {
  if (typeof value === 'string') return value.trim();
  return value.toFixed(2);
}
console.log(format('  hi  '), format(3.14159));
// Generics keep the real type instead of falling back to any
function first&lt;T>(items: T[]): T | undefined {
  return items[0];
}
const n: number | undefined = first([1, 2, 3]);
const s: string | undefined = first(['x', 'y']);
console.log(n, s);
interface ApiResponse&lt;T> {
  data: T;
  status: number;
}
const response: ApiResponse&lt;User> = { data: user, status: 200 };
console.log(response.data.name);
// Utility types save a lot of repetition
type UserUpdate = Partial&lt;User>;              // every field optional
type UserPreview = Pick&lt;User, 'id' | 'name'>; // just these two
type UsersById = Record&lt;number, User>;        // a lookup object
const update: UserUpdate = { name: 'Asha Rao' };
console.log(update);
// Classes with typed members
class Account {
  private balance = 0;
  constructor(public readonly owner: string) {}
  deposit(amount: number): this {
    if (amount &lt;= 0) throw new RangeError('Must be positive');
    this.balance += amount;
    return this;
  }
  getBalance(): number { return this.balance; }
}
console.log(new Account('Asha').deposit(500).getBalance());
</code></pre>
