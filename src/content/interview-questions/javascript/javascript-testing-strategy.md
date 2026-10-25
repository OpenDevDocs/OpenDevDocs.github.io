---
course: javascript
slug: javascript-testing-strategy
experienceLevel: senior
difficulty: medium
tags:
  - testing
  - architecture
question: How do you design a testing strategy for a large JavaScript application?
answer: |
  Aim for **confidence per unit of maintenance cost**, not for a coverage number. A practical strategy has layers, each catching a different class of bug:

  - **Static analysis**: TypeScript, ESLint and formatting catch typos, wrong types and unsafe patterns before any test runs. It's the cheapest layer.
  - **Unit tests** for pure logic: pricing rules, parsers, reducers, date handling. They're fast, deterministic and precise when they fail.
  - **Integration tests** for modules working together with real collaborators where practical: a route handler against a real database in a container, or a component rendered with Testing Library and network calls mocked at the HTTP layer (MSW). Most of the value is usually here.
  - **End-to-end tests** (Playwright, Cypress) for a small number of critical user journeys such as sign-up, checkout and login. They're slow and more brittle, so keep them few.
  - **Contract tests** or schema checks between services, so API changes break builds instead of production.

  Principles that keep a large suite healthy:

  - Test **behaviour through public interfaces**, not implementation details, so refactors don't break tests.
  - Make time, randomness and I/O **injectable**, and use fake timers instead of real sleeps.
  - Treat **flaky tests** as bugs: quarantine them, fix them, and track the flake rate. Flakiness destroys trust in the whole suite.
  - Keep the feedback loop fast: run affected tests on pull requests, parallelise, and shard end-to-end tests.
  - Add a regression test for every production bug, at the lowest layer that reproduces it.

  Tooling: Vitest or Jest for unit and component tests, the built-in `node:test` runner for libraries and back-end code with no extra dependencies, Playwright for browsers, and mutation testing (Stryker) occasionally to check that assertions actually catch bugs.
codeExample: |
  // Run with: node checkout.test.js   (or node --test)
  const { test, mock } = require('node:test');
  const assert = require('node:assert/strict');

  // Unit under test: the clock and payment gateway are injected
  function createCheckout({ gateway, now }) {
    return async (cart) => {
      const total = cart.reduce((sum, item) => sum + item.cents * item.qty, 0);
      if (total === 0) throw new Error('Cart is empty');
      const discount = now().getUTCDay() === 2 ? Math.round(total * 0.1) : 0; // Tuesdays
      return gateway.charge(total - discount);
    };
  }

  test('applies the Tuesday discount and charges once', async () => {
    const gateway = { charge: mock.fn(async (cents) => ({ ok: true, cents })) };
    const checkout = createCheckout({ gateway, now: () => new Date('2025-01-07T12:00:00Z') });

    const result = await checkout([{ cents: 1000, qty: 2 }]);

    assert.deepEqual(result, { ok: true, cents: 1800 });
    assert.equal(gateway.charge.mock.callCount(), 1);
  });

  test('rejects an empty cart without charging', async () => {
    const gateway = { charge: mock.fn() };
    const checkout = createCheckout({ gateway, now: () => new Date() });
    await assert.rejects(checkout([]), /Cart is empty/);
    assert.equal(gateway.charge.mock.callCount(), 0);
  });
  // Output (abridged; durations omitted):
  // ✔ applies the Tuesday discount and charges once
  // ✔ rejects an empty cart without charging
  // ℹ tests 2
  // ℹ pass 2
  // ℹ fail 0
popularity: 7.8
isPublished: true
---
