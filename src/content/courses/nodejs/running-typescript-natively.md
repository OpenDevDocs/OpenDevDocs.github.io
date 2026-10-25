---
publishDate: 2026-10-25T11:25
title: Running TypeScript Natively with Type Stripping
slug: running-typescript-natively
metadescription: Run .ts files directly with Node 24 using type stripping. Learn what erasable syntax is, what fails, and when to use --experimental-transform-types.
updateDate: 2026-10-25T11:25
author: ['bishal-biswas']
level: 2
tags: ['typescript', 'type-stripping', 'tooling']
course: nodejs
---

## What is type stripping?

**TypeScript** is JavaScript with type labels added: `name: string`, `age: number`, `interface User { ... }`. The labels help your editor catch mistakes before you run anything.

Node itself only understands JavaScript. For years you had to **compile** TypeScript first (turn it into plain `.js` with a tool like `tsc`), then run the result.

Modern Node takes a shortcut called **type stripping**. When you run a `.ts` file, Node blanks out the type labels and runs what is left.

Think of a recipe with pencil notes in the margin: "use the big pan", "Ravi likes extra salt". The cook skips the notes and follows the recipe. Type stripping is Node skipping the pencil notes.

## Running your first .ts file

In Node 24, this works with no flags and no packages:

```typescript
// greet.ts
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return `Hello, ${user.name}`;
}

const asha: User = { name: 'Asha', age: 30 };
console.log(greet(asha));
```

```bash
node greet.ts
```

```text
Hello, Asha
```

Node removed `interface User { ... }`, `: User` and `: string`, then ran the plain JavaScript underneath.

You can check that the feature is on:

```bash
node -p "process.features.typescript"
```

```text
strip
```

Node replaces each type with blank spaces rather than deleting it, so line and column numbers in error messages still match your `.ts` file. No source maps needed.

## Node does not check your types

This is the most important thing to understand. Node **strips** types. It does **not check** them.

```typescript
// oops.ts
const pages: number = 'lots';
console.log(pages.toUpperCase());
```

```bash
node oops.ts
```

```text
LOTS
```

TypeScript's own checker would reject that line, because a string is not a number. Node runs it anyway, because after stripping it is valid JavaScript.

So keep using the TypeScript compiler as a **checker** only. Install it as a dev dependency and run it with `--noEmit`, which means "check, but write no files":

```bash
npm install --save-dev typescript
npx tsc --noEmit
```

The usual setup is: your editor and `tsc --noEmit` (often in CI) find type errors, and `node file.ts` runs the code.

## What "erasable syntax" means

Type stripping only works when the TypeScript bits can be **erased** and leave correct JavaScript behind. Syntax that disappears cleanly is called **erasable syntax**.

These are all erasable, so they just work:

```typescript
type Id = string | number;                        // type aliases
interface Book { title: string; pages: number }   // interfaces
function first<T>(items: T[]): T | undefined {    // generics and return types
  return items[0];
}
const id = 5 as Id;                               // 'as' assertions
const config = { port: 3000 } satisfies object;   // satisfies
declare const API_URL: string;                    // declare
abstract class Shape { abstract area(): number }  // abstract members
class Square { private readonly size = 2 }        // private, readonly
```

Some TypeScript features are not just labels. They **generate JavaScript code** that did not exist before. Stripping cannot produce that code, so Node refuses them:

| Feature | Why it is not erasable |
| --- | --- |
| `enum Colour { Red, Green }` | Creates a real object at run time |
| `namespace Shapes { ... }` | Creates a real object at run time |
| `constructor(public x: number)` | **Parameter properties** add hidden `this.x = x` lines |
| `<number>value` | Node rejects the old angle-bracket assertion, use `value as number` |

Here is what happens with an enum:

```typescript
// colour.ts
enum Colour { Red, Green }
console.log(Colour.Green);
```

```text
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode
```

The fix is to use plain JavaScript that does the same job. A frozen object with `as const` replaces most enums:

```typescript
// colour.ts
const Colour = { Red: 'red', Green: 'green' } as const;
type Colour = (typeof Colour)[keyof typeof Colour]; // 'red' | 'green'

function paint(c: Colour): string {
  return `Painting ${c}`;
}
console.log(paint(Colour.Green)); // prints: Painting green
```

For parameter properties, write the fields out yourself:

```typescript
class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}
```

> **Tip:** TypeScript 5.8 added a compiler option, `erasableSyntaxOnly`. Turn it on and your editor flags enums, namespaces and parameter properties as errors, before Node ever sees them.

## --experimental-transform-types

If you have existing code full of enums, Node has a second mode that actually **transforms** (rewrites) TypeScript into JavaScript instead of just erasing it:

```bash
node --experimental-transform-types colour.ts
```

```text
1
(node:10120) ExperimentalWarning: Transform Types is an experimental feature and might change at any time
```

As the warning says, this mode is **experimental**. It is handy for trying old code, but for new projects stick to erasable syntax so plain `node file.ts` is enough.

## Imports need real file extensions

Node does not guess file extensions, and it does not read `tsconfig.json`. Write the import exactly as the file is named on disk, including `.ts`:

```typescript
// types.ts
export interface Book { title: string; pages: number }
export function describe(book: Book): string {
  return `${book.title} (${book.pages} pages)`;
}
```

```typescript
// main.ts
import { describe } from './types.ts';
import type { Book } from './types.ts'; // 'import type' for types only

const dune: Book = { title: 'Dune', pages: 412 };
console.log(describe(dune)); // prints: Dune (412 pages)
```

Two rules are hiding in there:

1. **Include `.ts`.** `import ... from './types'` fails with `ERR_MODULE_NOT_FOUND`.
2. **Use `import type` for types.** An interface does not exist at run time. If you write `import { describe, Book }`, Node keeps the import, finds no `Book` export, and stops with "does not provide an export named 'Book'".

Because Node ignores `tsconfig.json`, features configured there, like `paths` aliases, do nothing at run time.

### A matching tsconfig.json

So your editor and `tsc` agree with Node, use settings like these (they match the TypeScript section of the Node documentation):

```json
{
  "compilerOptions": {
    "noEmit": true,
    "target": "esnext",
    "module": "nodenext",
    "rewriteRelativeImportExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true
  }
}
```

- `rewriteRelativeImportExtensions` lets you write `.ts` in imports.
- `erasableSyntaxOnly` bans non-erasable syntax.
- `verbatimModuleSyntax` makes `tsc` insist on `import type` for types, which is exactly what Node needs.

## ES modules or CommonJS?

`.ts` files follow the same rules as `.js` files: the `"type"` field in `package.json` decides, and Node can also detect `import`/`export` syntax. For an explicit choice, use the TypeScript versions of the special extensions:

- `.mts`: always an ES module (like `.mjs`).
- `.cts`: always CommonJS (like `.cjs`).

## Gotchas

### TypeScript inside node_modules

Node will not strip types from `.ts` files inside `node_modules`:

```text
Error [ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING]: Stripping types is currently unsupported for files under node_modules
```

Packages you publish to npm should still ship compiled `.js` files plus `.d.ts` type files. Type stripping is for running *your own* code.

### Turning it off

If a tool or old project needs the previous behaviour, disable stripping with `--no-strip-types`. Then a `.ts` file with types fails with a plain `SyntaxError`, as it did in older Node versions.

### Thinking it checks types

It is worth saying twice: a green `node app.ts` run does not mean your types are correct. Run `npx tsc --noEmit` as well.

## Quick recap

- Node 24 runs `.ts` files directly by **stripping** type annotations. No flags, no packages.
- Node never **checks** types. Use `tsc --noEmit` or your editor for that.
- Only **erasable syntax** works: types, interfaces, generics, `as`, `satisfies`, `declare`.
- `enum`, `namespace`, parameter properties and `<T>value` assertions fail. Use `as const` objects and normal fields instead.
- `--experimental-transform-types` handles enums and friends, but it is experimental.
- Write `.ts` in import paths and use `import type` for types. Node ignores `tsconfig.json`.
- Turn on `erasableSyntaxOnly` and `verbatimModuleSyntax` so your editor matches Node.

<code id="code-content" class="language-typescript">
// library.ts: run with  node library.ts  (Node 24, no flags needed)
import { readFile } from 'node:fs/promises';
import type { Stats } from 'node:fs'; // type-only import: erased completely
// Interfaces and type aliases are erased before the code runs
interface Book {
  title: string;
  author: string;
  pages: number;
  read?: boolean;
}
type Shelf = Book[];
// Use a const object instead of an enum (enums are not erasable)
const Status = { Unread: 'unread', Reading: 'reading', Done: 'done' } as const;
type Status = (typeof Status)[keyof typeof Status];
// Generics and return types are fine too
function longest&lt;T extends { pages: number }&gt;(items: T[]): T | undefined {
  return items.reduce&lt;T | undefined&gt;((best, item) =&gt;
    !best || item.pages &gt; best.pages ? item : best, undefined);
}
function statusOf(book: Book): Status {
  return book.read ? Status.Done : Status.Unread;
}
const shelf: Shelf = [
  { title: 'Dune', author: 'Frank Herbert', pages: 412, read: true },
  { title: 'Matilda', author: 'Roald Dahl', pages: 240 },
  { title: 'Emma', author: 'Jane Austen', pages: 474 },
];
for (const book of shelf) {
  console.log(`${book.title.padEnd(8)} ${statusOf(book)}`);
}
const big = longest(shelf);
console.log('Longest:', big?.title, `(${big?.pages} pages)`);
// 'as' assertions are erasable; the old &lt;Type&gt;value form is not
const total = shelf.reduce((sum, b) =&gt; sum + b.pages, 0) as number;
console.log('Total pages:', total);
// Types are NOT checked at run time: this would be a tsc error, but Node runs it
const oops: number = 'not a number' as unknown as number;
console.log('typeof oops is', typeof oops);
// Node is still Node: built-in modules work as usual
const self: string = await readFile(new URL(import.meta.url), 'utf8');
console.log('This file has', self.split('\n').length, 'lines');
let info: Stats | undefined; // only used as a type, never imported at run time
console.log('info is', info);
</code></pre>
