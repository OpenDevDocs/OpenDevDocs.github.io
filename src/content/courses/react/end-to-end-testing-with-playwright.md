---
publishDate: 2026-05-25T10:12
title: End-to-End Testing with Playwright
slug: end-to-end-testing-with-playwright
metadescription: Test complete user journeys in a real browser, and write assertions that do not flake.
updateDate: 2026-09-05T10:12
author: ['bishal-biswas']
level: 3
tags: ['testing', 'playwright', 'quality']
course: react
---

## What end to end tests add

Unit tests check a component in isolation, with a fake DOM and a mocked network.

End to end tests drive a **real browser** against your **real application**. They catch things unit tests structurally cannot:

- A route that 404s in production because of a host misconfiguration.
- A form that fails against the real API.
- A build that ships broken JavaScript.
- CSS that hides a button on mobile.
- An auth flow spanning several pages.

They are slower and need more maintenance, so you want fewer of them, aimed at journeys that matter.

## Setup

```bash
npm init playwright@latest
```

```javascript
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'mobile', use: devices['iPhone 14'] }
  ]
});
```

`webServer` starts your app automatically. `trace: 'on-first-retry'` records a full timeline of a failing run, which is by far the best debugging tool here.

## A first test

```javascript
import { test, expect } from '@playwright/test';
test('a user can sign up', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill('asha@example.com');
  await page.getByLabel('Password').fill('longenough123');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await expect(page).toHaveURL('/dashboard');
});
```

The locators mirror React Testing Library, which makes moving between the two comfortable.

## Auto waiting

Playwright waits automatically, which removes the biggest source of flaky tests.

```javascript
await page.waitForTimeout(2000);
await page.click('#submit');
await page.getByRole('button', { name: 'Submit' }).click();
```

Before acting, it waits for the element to be attached, visible, stable, enabled and able to receive events.

Assertions retry too:

```javascript
await expect(page.getByText('Saved')).toBeVisible();
expect(await page.getByText('Saved').isVisible()).toBe(true);
```

The first retries until it passes or times out. The second checks once and flakes.

**Never use `waitForTimeout`.** A fixed sleep is either too short, so it flakes, or too long, so your suite crawls. If you are reaching for it, you are waiting for the wrong thing.

## Locators

```javascript
page.getByRole('button', { name: 'Save' });
page.getByLabel('Email');
page.getByPlaceholder('Search...');
page.getByText('Welcome back');
page.getByTestId('user-menu');
page.locator('.some-class');
```

Prefer role and label, exactly as in unit tests. A CSS selector breaks the moment someone renames a class.

For an ambiguous match:

```javascript
page.getByRole('listitem').filter({ hasText: 'Asha' });
page.getByRole('button', { name: 'Delete' }).first();
page.getByRole('row', { name: 'Asha' }).getByRole('button', { name: 'Edit' });
```

That last one, scoping a query inside another, is the cleanest way to act on a specific row.

## Signing in once

Logging in at the start of every test is slow. Do it once and reuse the state.

```javascript
import { test as setup } from '@playwright/test';
setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
```

```javascript
export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.js/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup']
    }
  ]
});
```

Every test now starts signed in, with no login step.

## Controlling the network

```javascript
test('shows an error when the API fails', async ({ page }) => {
  await page.route('**/api/products', (route) =>
    route.fulfill({ status: 500, body: 'Server error' })
  );
  await page.goto('/products');
  await expect(page.getByRole('alert')).toBeVisible();
});
test('shows the empty state', async ({ page }) => {
  await page.route('**/api/products', (route) =>
    route.fulfill({ json: [] })
  );
  await page.goto('/products');
  await expect(page.getByText('No products found')).toBeVisible();
});
```

Error and empty states are hard to produce against a real backend, and easy to force this way.

## Debugging

```bash
npx playwright test --ui
npx playwright test --debug
npx playwright test --headed
npx playwright show-trace trace.zip
```

The **UI mode** is excellent: it shows every step with a DOM snapshot at each point, so you can see exactly what the page looked like when the test failed.

```bash
npx playwright codegen http://localhost:5173
```

Codegen records your clicks and writes the test. Useful for a first draft, though the generated locators usually want tidying.

## What to test

Keep the suite small and focused on journeys that would be expensive to break:

- Sign up, log in, log out.
- The core action of your product.
- Checkout or payment.
- A critical form end to end.

Do not test every validation message here. Those belong in unit tests, which run in seconds rather than minutes.

The usual shape is many unit tests, some integration tests, and a handful of end to end tests.

## In CI

```bash
npx playwright install --with-deps
npx playwright test
```

Run against a production build, since that is what users get. Upload the trace and screenshots as artifacts so a failure is diagnosable without reproducing it locally.

## Quick recap

- End to end tests drive a real browser against your real app.
- Playwright auto waits, which removes most flakiness.
- Never use a fixed `waitForTimeout`.
- Use `expect(...)` assertions, which retry, rather than manual checks.
- Prefer role and label locators, and scope queries to act on a row.
- Save auth state once and reuse it across tests.
- Route interception makes error and empty states easy to test.
- Keep the suite small and aimed at critical journeys.

<code id="code-content" class="language-javascript">
import { test, expect } from '@playwright/test';
test.describe('checkout', () =&gt; {
  test('a user can buy a product', async ({ page }) =&gt; {
    await page.goto('/products');
    // Prefer role and label locators. A CSS selector breaks the moment
    // someone renames a class.
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Notebook' })
      .getByRole('button', { name: 'Add to cart' })
      .click();
    await page.getByRole('link', { name: 'Cart' }).click();
    await expect(page.getByText('1 item')).toBeVisible();
    await page.getByRole('button', { name: 'Checkout' }).click();
    await page.getByLabel('Card number').fill('4242424242424242');
    await page.getByRole('button', { name: 'Pay' }).click();
    // expect() RETRIES until it passes or times out. Playwright also
    // waits for elements to be visible, stable and enabled before acting.
    await expect(page.getByRole('heading', { name: 'Order confirmed' }))
      .toBeVisible();
    await expect(page).toHaveURL(/\/orders\/\d+/);
  });
  // Route interception makes error and empty states easy to produce,
  // which is hard against a real backend
  test('shows an error when the API fails', async ({ page }) =&gt; {
    await page.route('**/api/products', (route) =&gt;
      route.fulfill({ status: 500, body: 'Server error' })
    );
    await page.goto('/products');
    await expect(page.getByRole('alert')).toBeVisible();
  });
  test('shows the empty state', async ({ page }) =&gt; {
    await page.route('**/api/products', (route) =&gt; route.fulfill({ json: [] }));
    await page.goto('/products');
    await expect(page.getByText('No products found')).toBeVisible();
  });
});
// NEVER DO THIS. A fixed sleep is either too short, so it flakes, or
// too long, so the suite crawls.
//   await page.waitForTimeout(2000);
//   expect(await page.getByText('Saved').isVisible()).toBe(true);
// SIGN IN ONCE and reuse the state, instead of logging in every test:
// setup('authenticate', async ({ page }) =&gt; {
//   await page.goto('/login');
//   await page.getByLabel('Email').fill('test@example.com');
//   await page.getByRole('button', { name: 'Log in' }).click();
//   await page.waitForURL('/dashboard');
//   await page.context().storageState({ path: 'e2e/.auth/user.json' });
// });
// DEBUGGING:
//   npx playwright test --ui        every step with a DOM snapshot
//   npx playwright codegen URL      records your clicks into a test
//   trace: 'on-first-retry'         a full timeline of any CI failure
// KEEP THE SUITE SMALL. Sign up, log in, the core action, checkout.
// Validation messages belong in unit tests that run in seconds.
</code></pre>
