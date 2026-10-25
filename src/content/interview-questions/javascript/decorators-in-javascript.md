---
course: javascript
slug: decorators-in-javascript
experienceLevel: senior
difficulty: hard
tags:
  - decorators
  - typescript
  - classes
question: How do TC39 Stage 3 decorators differ from TypeScript's experimentalDecorators?
answer: |
  **Decorators** are functions applied with `@name` to classes and class elements, to wrap or replace them declaratively: logging, binding, validation, dependency injection metadata, ORM column mappings. There are two incompatible designs in circulation.

  **TC39 decorators** (Stage 3 since 2022) are the standard track. A decorator is called as `decorator(value, context)`:

  - `value` is the thing being decorated: the method function, the class, the getter or setter, or `undefined` for fields.
  - `context` describes it: `kind` (`'class'`, `'method'`, `'getter'`, `'setter'`, `'field'`, `'accessor'`), `name`, `static`, `private`, an `access` object with `get` and `set`, `addInitializer()`, and `metadata` (from the companion decorator metadata proposal).
  - A method decorator returns a replacement function. A field decorator returns an initializer that transforms the initial value. The new `accessor` keyword creates an auto-accessor with a private backing slot that decorators can intercept.
  - Decorators **can't mutate the class shape arbitrarily**, and there are no **parameter decorators**.

  **TypeScript `experimentalDecorators`** implements an older proposal. Decorators receive `(target, propertyKey, descriptor)` and mutate the property descriptor. Parameter decorators exist, and `emitDecoratorMetadata` emits runtime type information through `reflect-metadata`. NestJS, TypeORM, InversifyJS and older Angular-style code depend on this behaviour.

  TypeScript 5.0 and later implement the standard decorators by default when `experimentalDecorators` is **off**. Babel supports both through plugin options. As for native support, engines had not shipped decorators by default at the time of writing, so code is normally compiled. Check current support before relying on native syntax.

  Advice for a real codebase: new code and libraries should target the standard decorators. Don't migrate a NestJS or TypeORM application piecemeal, because the two models can't be mixed in one compilation. Keep decorators thin and move real logic into plain functions that are easy to test.
codeExample: |
  // Standard syntax (TypeScript 5+ or Babel):
  //   class Api { @logged fetchUser(id) { ... } }
  // Node can't parse `@` yet, so here we apply the decorator by hand,
  // the way the compiled output calls it: decorator(value, context).

  function logged(method, context) {
    if (context.kind !== 'method') throw new TypeError('@logged is for methods');
    const name = String(context.name);
    return function (...args) {                         // replacement method
      console.log(`-> ${name}(${args.join(', ')})`);
      const result = method.apply(this, args);
      console.log(`<- ${name} returned ${result}`);
      return result;
    };
  }

  class Api {
    base = '/v1';
    fetchUser(id) { return `${this.base}/users/${id}`; }
  }

  const context = {
    kind: 'method', name: 'fetchUser', static: false, private: false,
    addInitializer() {}, metadata: {},
  };
  Api.prototype.fetchUser = logged(Api.prototype.fetchUser, context);

  new Api().fetchUser(42);
  // Output:
  // -> fetchUser(42)
  // <- fetchUser returned /v1/users/42

  // Legacy experimentalDecorators signature, for comparison:
  //   function logged(target, propertyKey, descriptor) { descriptor.value = ...; }
popularity: 7.1
isPublished: true
---
