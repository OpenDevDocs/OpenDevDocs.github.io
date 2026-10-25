---
publishDate: 2026-10-25T11:20
title: Automated Testing in the Pipeline
slug: testing-in-the-pipeline
metadescription: Learn which automated tests belong in a CI/CD pipeline, the test pyramid, unit, integration and end-to-end tests, running databases in CI, flaky tests, code coverage and quality gates.
updateDate: 2026-10-25T11:20
author: ['bishal-biswas']
level: 2
tags: ['devops', 'ci-cd', 'testing', 'quality']
course: devops
---

## Why tests are the heart of the pipeline

A pipeline without tests only proves that your code **compiles**. It says nothing about whether it **works**. In [Continuous Integration Explained](/courses/devops/continuous-integration) you saw that a build must be **self-testing**: the tests are what turn "it built" into "it is safe to ship".

The more you automate delivery, the more your tests matter. When a human no longer checks every release by hand before it goes out, the tests are the thing standing between a bug and your users.

This lesson is about **which** tests to write, **where** in the pipeline to run them, and how to keep them fast and trustworthy.

## The test pyramid

The most common way to think about a balanced test suite is the **test pyramid**, popularised by Mike Cohn:

```text
              /\
             /  \        End-to-end (E2E)
            / E2E\       few: slow, realistic, fragile
           /------\
          /        \     Integration
         /  Integr. \    some: pieces working together
        /------------\
       /              \  Unit
      /     Unit       \ many: tiny, fast, precise
     /__________________\
```

| Level | Tests | Speed | When it fails, you know... |
|---|---|---|---|
| **Unit** | One function or class, on its own | Milliseconds | Exactly which function is wrong |
| **Integration** | Several parts together: your code plus a real database, HTTP server or queue | Seconds | Which connection between parts is broken |
| **End-to-end** | The whole system, driven like a real user would (a browser clicking buttons) | Seconds to minutes each | That a user journey is broken, but not always why |

The shape is the point: **lots** of fast unit tests at the bottom, **fewer** integration tests, and only a **handful** of end-to-end tests for the most important journeys, such as signing up, logging in and paying.

Teams that turn the pyramid upside down, with hundreds of slow browser tests and few unit tests, get pipelines that take an hour and fail randomly. People stop trusting them.

## The kinds of check in a pipeline

Tests are not the only automated checks. A full pipeline usually runs several kinds, cheapest first:

| Check | What it catches | Example tools |
|---|---|---|
| **Linting** and **formatting** | Typos, unused variables, inconsistent style | ESLint, Prettier, Ruff, shellcheck |
| **Type checking** | Wrong types passed around | TypeScript (`tsc --noEmit`), mypy |
| **Unit tests** | Logic bugs in single functions | Node test runner, Jest, Vitest, pytest, xUnit |
| **Integration tests** | Broken queries, wrong HTTP handling, bad config | The same runners, plus real databases in containers |
| **End-to-end tests** | Broken user journeys | Playwright, Cypress |
| **Security scans** | Vulnerable dependencies, leaked secrets | `npm audit`, Dependabot, Trivy |
| **Smoke tests** (after deploy) | "Is the new version alive at all?" | `curl` against `/health` and a key page |

You met linting in [Your First Pipeline with GitHub Actions](/courses/devops/first-github-actions-pipeline). Security scanning gets its own lesson, [DevSecOps: Security in the Pipeline](/courses/devops/devsecops-basics).

## Ordering: fail fast

Run the cheapest, fastest checks first, so a typo fails the pipeline in 20 seconds instead of after a 10-minute browser test:

```text
lint + type check  ->  unit tests  ->  build  ->  integration tests  ->  E2E tests  ->  deploy  ->  smoke tests
   (seconds)           (seconds)                    (a minute)          (minutes)                  (seconds)
```

Jobs that do not depend on each other, such as linting and unit tests, can run **in parallel**, as you saw with `needs:` in the previous lesson.

## Writing good unit tests

Good unit tests are:

- **Fast.** No network, no disk, no sleeping. Thousands should run in seconds.
- **Independent.** Each test sets up what it needs and can run alone, in any order.
- **Repeatable.** Same result every time, on every machine. No dependence on today's date or random numbers you do not control.
- **Clear when they fail.** The name and the message should tell you what broke without reading the test's code.

The common shape is **Arrange, Act, Assert**:

```javascript
test('WELCOME10 takes 10% off', () => {
  const price = 50000;                                  // Arrange: set up the input
  const result = applyDiscount(price, 'WELCOME10');     // Act: call the code
  assert.equal(result, 45000);                          // Assert: check the outcome
});
```

Test the **edge cases**, not just the happy path: empty lists, zero, negative numbers, very large numbers, unexpected input and rounding.

### Test doubles

Sometimes the code under test calls something slow or unpredictable, such as a payment provider or an email service. In unit tests you replace it with a stand-in, called a **test double**:

- a **stub** returns a fixed answer ("the payment always succeeds");
- a **mock** also records how it was called, so you can check ("was an email sent, to this address?");
- a **fake** is a simple working version, such as an in-memory database.

Use doubles for things **outside** your system. Then cover the real connections with a smaller number of integration tests.

## Integration tests with real services

Integration tests should use **real** dependencies, because that is where the surprises are: a SQL query that works in your head but not in PostgreSQL, a JSON field with a different name, a timeout.

CI systems make this easy with **containers**. In GitHub Actions, a **service container** starts a real database next to your job:

```yaml
jobs:
  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/postgres
```

The database is brand new for every run and thrown away afterwards, so tests can create and delete data freely. The health-check options make the job wait until PostgreSQL is actually ready. You will learn how containers work in [Docker Essentials](/courses/devops/docker-essentials).

## End-to-end tests

End-to-end tests start the whole app and drive it through a real browser. With **Playwright**, a test reads almost like instructions to a person:

```javascript
import { test, expect } from '@playwright/test';

test('a visitor can search for a recipe', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Search recipes').fill('dosa');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('heading', { name: 'Masala Dosa' })).toBeVisible();
});
```

They catch problems no other test can, such as a button hidden behind another element, but they are the slowest and most fragile. Keep them few, focused on the journeys that make or lose money, and run them after the faster tests have passed.

## Flaky tests

A **flaky test** sometimes passes and sometimes fails, with no change to the code. Common causes:

- **timing**: waiting a fixed 500 ms for something that usually, but not always, takes 400 ms;
- **shared state**: one test leaves data behind that another test trips over;
- **order dependence**: tests that only pass when run in a certain order;
- **real external services**: a third-party API that is sometimes slow.

Flaky tests are worse than they look. Each random failure teaches the team that red builds can be ignored, and then a **real** failure gets ignored too. Treat a flaky test as a bug: fix it, or **quarantine** it (skip it with a tracking ticket) the same day. Never just click **Re-run** and move on.

## Code coverage

**Code coverage** measures how much of your code ran during the tests: which lines, branches and functions were executed. Node's test runner can report it:

```bash
node --test --experimental-test-coverage
```

Coverage is useful for finding code that **no test touches at all**. But high coverage does not mean good tests: a test that runs every line but asserts nothing scores 100% and checks nothing. Use coverage as a flashlight to find gaps, not as a target to hit. Many teams agree a sensible floor, such as 80%, and focus their effort on important logic rather than chasing the last few percent.

## Quality gates

A **quality gate** is a rule that a change must pass before it can move on: all tests green, no lint errors, no high-severity vulnerabilities, coverage not lower than before. In GitHub, the gates are the **required status checks** on your protected branch. If a gate fails, the change does not merge, and does not deploy.

## A test file you can run

The code panel for this lesson is a single file containing a small discount function, a tiny HTTP API that uses it, and both kinds of test:

- **Unit tests** for `applyDiscount`: normal codes, case-insensitivity, unknown codes, rounding and bad input.
- **Integration tests** that start the real HTTP server on a random free port (`listen(0)`) in `before()`, call it with `fetch`, and stop it in `after()`.

```bash
node --test shop.test.mjs
```

```text
▶ applyDiscount (unit)
  ✔ no code means full price (0.49ms)
  ✔ WELCOME10 takes 10% off (0.08ms)
  ✔ codes are not case sensitive (0.06ms)
  ✔ unknown codes are ignored (0.06ms)
  ✔ rounds to whole paise (0.07ms)
  ✔ rejects bad prices (0.31ms)
✔ applyDiscount (unit) (1.73ms)
▶ price API (integration)
  ✔ GET /health answers ok (16.77ms)
  ✔ GET /price applies the discount code (3.37ms)
  ✔ unknown paths return 404 (1.15ms)
✔ price API (integration) (24.26ms)
ℹ tests 9
ℹ pass 9
ℹ fail 0
```

Notice the timings: each unit test takes a fraction of a millisecond, while the integration tests take a few milliseconds each because they open real network connections. That gap grows much bigger with real databases and browsers, which is exactly why the pyramid has so many more unit tests.

> **Tip:** In a real project, the code and the tests live in separate files: `src/shop.js` and `test/shop.test.js`. They are combined here only so the panel runs on its own.

## Common misunderstandings

### "Testing is the testers' job"

In a DevOps team, developers write automated tests alongside their code, and testers focus on exploring, finding unexpected problems and improving the test strategy. Quality is everyone's job.

### "More end-to-end tests means more safety"

Past a handful of key journeys, more E2E tests mostly means a slower, flakier pipeline. Push checks **down** the pyramid wherever you can.

### "100% coverage means no bugs"

Coverage tells you code **ran**, not that its result was **checked**. Missing requirements, wrong assumptions and untested combinations all survive 100% coverage.

## Quick recap

- Tests turn "it builds" into "it is safe to ship"; with automated delivery, they are your safety net.
- Follow the **test pyramid**: many **unit** tests, some **integration** tests, few **end-to-end** tests.
- Order the pipeline to **fail fast**: lint and unit tests first, slow tests later, smoke tests after deploy.
- Use **test doubles** for outside services in unit tests, and **real services in containers** for integration tests.
- Fix or quarantine **flaky tests** the same day.
- Use **coverage** to find gaps, not as a goal; enforce **quality gates** with required status checks.

Next, you will package what passed the tests into something you can ship, in [Build Artifacts and Versioning](/courses/devops/build-artifacts-and-versioning).

<code id="code-content" class="language-javascript">
// shop.test.mjs: unit and integration tests with Node's built-in test runner.
// The code under test is at the top so this file runs on its own.
// Run it with: node --test shop.test.mjs
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
// ---------- The code under test ----------
export function applyDiscount(pricePaise, code) {
  if (!Number.isInteger(pricePaise) || pricePaise &lt; 0) throw new RangeError('price must be whole paise');
  const discounts = { WELCOME10: 0.1, FESTIVE25: 0.25 };
  const rate = discounts[code?.toUpperCase()] ?? 0;
  return Math.round(pricePaise * (1 - rate));
}
export function createServer() {
  return http.createServer((req, res) =&gt; {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/health') return res.end('ok');
    if (url.pathname === '/price') {
      const price = applyDiscount(Number(url.searchParams.get('base')), url.searchParams.get('code'));
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ price }));
    }
    res.statusCode = 404;
    res.end('not found');
  });
}
// ---------- Unit tests: one function, no network, milliseconds each ----------
describe('applyDiscount (unit)', () =&gt; {
  test('no code means full price', () =&gt; {
    assert.equal(applyDiscount(50000), 50000);
  });
  test('WELCOME10 takes 10% off', () =&gt; {
    assert.equal(applyDiscount(50000, 'WELCOME10'), 45000);
  });
  test('codes are not case sensitive', () =&gt; {
    assert.equal(applyDiscount(50000, 'festive25'), 37500);
  });
  test('unknown codes are ignored', () =&gt; {
    assert.equal(applyDiscount(50000, 'FREEFOOD'), 50000);
  });
  test('rounds to whole paise', () =&gt; {
    assert.equal(applyDiscount(999, 'WELCOME10'), 899);
  });
  test('rejects bad prices', () =&gt; {
    assert.throws(() =&gt; applyDiscount(-5), RangeError);
    assert.throws(() =&gt; applyDiscount(10.5), RangeError);
  });
});
// ---------- Integration tests: a real HTTP server on a random free port ----------
describe('price API (integration)', () =&gt; {
  let server;
  let baseUrl;
  before(async () =&gt; {
    server = createServer().listen(0);              // port 0 = "any free port"
    await new Promise((resolve) =&gt; server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  after(() =&gt; server.close());
  test('GET /health answers ok', async () =&gt; {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'ok');
  });
  test('GET /price applies the discount code', async () =&gt; {
    const res = await fetch(`${baseUrl}/price?base=50000&amp;code=WELCOME10`);
    assert.equal(res.headers.get('content-type'), 'application/json');
    assert.deepEqual(await res.json(), { price: 45000 });
  });
  test('unknown paths return 404', async () =&gt; {
    const res = await fetch(`${baseUrl}/nope`);
    assert.equal(res.status, 404);
  });
});
</code></pre>
