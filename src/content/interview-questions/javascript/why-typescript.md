---
course: javascript
slug: why-typescript
experienceLevel: mid
difficulty: medium
tags:
  - typescript
  - tooling
question: Why do teams use TypeScript, and what are its limitations?
answer: |
  Teams use TypeScript because static types catch a whole class of bugs **before the code runs** (typos, wrong argument types, missing `null` checks, unhandled cases) and make large codebases easier to navigate and refactor; it is JavaScript with a type layer that is erased at build time.

  Main benefits:

  - **Early error detection**: calling a function with the wrong arguments, misspelled properties and possibly-`undefined` values are reported in the editor and in CI.
  - **Editor tooling**: accurate autocomplete, go-to-definition, find-all-references and safe automated renames across hundreds of files.
  - **Documentation that cannot drift**: types describe the shape of API responses, component props and function contracts, and the compiler keeps them honest.
  - **Safer refactoring**: change a type, and the compiler lists every place that must be updated.
  - **Expressive modelling**: union types, literal types and discriminated unions with exhaustiveness checks (`never`) model real states such as `'loading' | 'success' | 'error'`.

  Limitations to be aware of:

  1. **No runtime checks.** Types are erased. Data from `fetch`, `JSON.parse`, forms or `localStorage` is not validated just because you annotated it. Use a runtime validator (Zod, Valibot, ArkType) at system boundaries.
  2. **Unsound escape hatches**: `any`, type assertions (`as User`) and non-null assertions (`!`) silence the compiler. Enable `strict` mode and keep these rare.
  3. **Build and tooling cost**: a compile or type-check step, configuration (`tsconfig.json`), and occasionally complex type errors from libraries.
  4. **Learning curve** for advanced generics and conditional types; application code rarely needs them.

  Practical notes:

  - Fast tools (esbuild, SWC, Vite, and Node.js's built-in type stripping) remove types without checking them, so run `tsc --noEmit` in CI.
  - TypeScript can be adopted gradually: `allowJs`, `checkJs` and JSDoc type annotations work in plain `.js` files.
  - In interviews, a balanced answer helps: TypeScript reduces bugs and improves maintainability, but it is not a substitute for tests or runtime validation.
codeExample: |
  // order.ts: run with `node order.ts` (Node.js 22.18+ strips types) and check with `npx tsc --noEmit --strict`
  type Status = 'pending' | 'paid' | 'shipped';

  interface Order {
    id: string;
    total: number;
    status: Status;
    coupon?: string;
  }

  function applyDiscount(order: Order, percent: number): Order {
    return { ...order, total: Math.round(order.total * (100 - percent)) / 100 };
  }

  function label(status: Status): string {
    switch (status) {
      case 'pending': return 'Awaiting payment';
      case 'paid': return 'Paid';
      case 'shipped': return 'On its way';
      default: {
        const unhandled: never = status; // compile error if a new Status is not handled
        return unhandled;
      }
    }
  }

  const order: Order = { id: 'A1', total: 80, status: 'paid' };
  console.log(applyDiscount(order, 25).total, label(order.status)); // Output: 60 Paid
  console.log(order.coupon?.toUpperCase() ?? 'no coupon');        // Output: no coupon

  // Errors reported by tsc before the code ever runs:
  // applyDiscount(order, '25');  // Argument of type 'string' is not assignable to parameter of type 'number'.
  // order.status = 'delivered';  // Type '"delivered"' is not assignable to type 'Status'.
  // order.coupon.toUpperCase();  // 'order.coupon' is possibly 'undefined'.
popularity: 8.2
isPublished: true
---
