---
course: javascript
slug: dependency-injection-in-javascript
experienceLevel: senior
difficulty: medium
tags:
  - architecture
  - testing
  - design-patterns
question: How do you do dependency injection in JavaScript, and do you need a DI container?
answer: |
  **Dependency injection** means a unit receives its collaborators (database client, HTTP client, clock, logger) from the outside instead of importing or constructing them itself. The benefits are the same as in any language: you can swap implementations, test without monkey-patching, and see a unit's dependencies in its signature.

  In JavaScript you rarely need a framework for it. The idiomatic forms are:

  - **Factory functions** that take dependencies and return an object or closure: `createOrderService({ db, clock })`.
  - **Constructor injection** with classes: `new OrderService(db, clock)`.
  - A single **composition root**, such as `main.js` or the server bootstrap, where real implementations are created and wired together once. Everything else just receives what it needs.

  The common anti-pattern is reaching for module-level singletons (`import db from './db'`) deep inside business logic, then using `jest.mock` or loader hooks to replace them in tests. It works, but it couples tests to file paths and hides dependencies.

  When a container helps: large applications with many layered services, request-scoped lifetimes (a per-request logger or transaction), or frameworks built around one (NestJS, Angular, InversifyJS, tsyringe). The cost is indirection, decorator and reflection metadata setup in TypeScript, and errors that appear at runtime rather than at the call site.

  Practical guidance:

  - Inject things that are **slow, non-deterministic or external**: I/O, time, randomness, configuration.
  - Don't inject pure utility functions. Just import them.
  - Keep the dependency object small. A constructor with ten dependencies is a design smell, not a DI problem.
  - Type the dependencies as interfaces (in TypeScript, structural types), so fakes in tests need only the methods used.
codeExample: |
  // Business logic depends on capabilities, not on concrete modules
  function createInvoiceService({ repo, clock, logger }) {
    return {
      async issue(customerId, amountCents) {
        const invoice = { customerId, amountCents, issuedAt: clock.now().toISOString() };
        await repo.save(invoice);
        logger.info(`issued invoice for ${customerId}`);
        return invoice;
      },
    };
  }

  // Composition root (production would pass a real DB repo and Date clock)
  const saved = [];
  const service = createInvoiceService({
    repo: { save: async (inv) => { saved.push(inv); } },
    clock: { now: () => new Date('2025-01-15T10:00:00Z') }, // deterministic in tests
    logger: { info: (msg) => console.log('[log]', msg) },
  });

  service.issue('cus_42', 1999).then((invoice) => {
    console.log(invoice.issuedAt, saved.length);
  });
  // Output:
  // [log] issued invoice for cus_42
  // 2025-01-15T10:00:00.000Z 1
popularity: 7.0
isPublished: true
---
