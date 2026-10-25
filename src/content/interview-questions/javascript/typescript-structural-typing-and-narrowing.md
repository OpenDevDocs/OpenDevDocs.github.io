---
course: javascript
slug: typescript-structural-typing-and-narrowing
experienceLevel: senior
difficulty: hard
tags:
  - typescript
  - types
question: What does structural typing mean in TypeScript, and how do you narrow types safely?
answer: |
  TypeScript is **structurally typed**: compatibility is decided by an object's **shape**, not by its declared name. If a value has at least the members a type requires, with compatible types, it's assignable. Two interfaces with the same members are interchangeable, and a class instance satisfies any interface it happens to match. This fits JavaScript's duck typing, but it has consequences:

  - **Excess property checks** only apply to fresh object literals. Pass the same object through a variable and extra properties are allowed.
  - Two IDs that are both `string`, like `UserId` and `OrderId`, are interchangeable unless you add **branding** (`string & { readonly __brand: 'UserId' }`).
  - Types are **erased** at runtime. `instanceof` doesn't work with interfaces, and data from the network is unchecked until you validate it with a schema library (Zod, Valibot, Ajv).

  **Narrowing** is how the compiler refines a union inside a branch. It's driven by control flow:

  - `typeof x === 'string'`, `x instanceof Date`, `'field' in x`, `Array.isArray(x)`, and truthiness or equality checks.
  - **Discriminated unions**: a shared literal field like `kind` or `type` that the compiler switches on. This is the most robust pattern for modelling states and events.
  - **User-defined type guards** (`value is Foo`) and **assertion functions** (`asserts value is Foo`). These are trusted blindly, so a wrong guard is a lie the compiler can't detect. Keep them small and tested.
  - **Exhaustiveness**: assign the remaining value to `never` in the `default` branch, so adding a new variant becomes a compile error everywhere it isn't handled.

  Prefer narrowing over `as` casts, which silence the checker instead of proving anything. Use `satisfies` to check that a value matches a type without widening its inferred literal types.
codeExample: |
  // Run with: node shapes.ts  (type stripping is on by default in Node 23.6+ and 22.18+)
  type Shape =
    | { kind: 'circle'; radius: number }
    | { kind: 'rect'; width: number; height: number };

  function area(shape: Shape): number {
    switch (shape.kind) {                        // discriminant narrows the union
      case 'circle': return Math.PI * shape.radius ** 2;
      case 'rect': return shape.width * shape.height;
      default: {
        const unreachable: never = shape;        // compile error if a kind is missing
        throw new Error(`Unknown shape: ${JSON.stringify(unreachable)}`);
      }
    }
  }

  // Structural: any object with the right shape is accepted
  const fromApi = { kind: 'rect' as const, width: 2, height: 3, color: 'red' };
  console.log(area(fromApi));                    // Output: 6

  // Runtime data must be checked; types alone are erased
  function isShape(value: unknown): value is Shape {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    return (v.kind === 'circle' && typeof v.radius === 'number') ||
      (v.kind === 'rect' && typeof v.width === 'number' && typeof v.height === 'number');
  }

  const input: unknown = JSON.parse('{"kind":"circle","radius":1}');
  if (isShape(input)) console.log(area(input).toFixed(2));  // Output: 3.14
  console.log(isShape({ kind: 'rect', width: '2' }));      // Output: false
popularity: 8.2
isPublished: true
---
