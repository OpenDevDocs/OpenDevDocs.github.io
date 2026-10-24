---
publishDate: 2026-06-26T12:55
title: End-to-End Testing with Playwright
slug: e2e-testing-with-playwright
metadescription: Test a real Angular application in a real browser with Playwright, covering the flows that unit tests cannot.
updateDate: 2026-09-07T12:55
author: ['bishal-biswas']
level: 3
tags: ['testing', 'playwright', 'e2e']
course: angular
---

## What end to end tests are for

Unit tests check pieces. An end to end test drives the whole application in a real browser: navigation, forms, routing, network calls and rendering together.

They catch what unit tests cannot: a broken route, a guard blocking the wrong thing, a form that fails to submit, a build that produces a blank page.

They are also slow and prone to flakiness, so you want few of them covering the paths that matter most.

## Setting up

```bash
npm init playwright@latest
```

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    command: 'ng serve',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

`webServer` starts the dev server automatically, so there is no separate command to remember. `reuseExistingServer` uses one you already have running locally.

`trace: 'on-first-retry'` is the setting worth having. A failed retry produces a recording you can step through, which turns a mystery into an obvious cause.

## A test

```typescript
import { test, expect } from '@playwright/test';

test('a user can sign in and see their dashboard', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill('asha@example.com');
  await page.getByLabel('Password').fill('correct-horse');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
```

No waits, no sleeps. Playwright automatically waits for elements to appear and for the page to settle, which removes the main source of flakiness in older tools.

## Selectors

Prefer selectors that reflect how a user finds things.

```typescript
page.getByRole('button', { name: 'Save' })
page.getByLabel('Email address')
page.getByPlaceholder('Search products')
page.getByText('Order confirmed')
page.getByTestId('user-menu')

page.locator('.btn-primary')       // avoid, breaks on any restyle
page.locator('#submit-btn-2')       // avoid
```

`getByRole` is the best default. It fails when the element is not properly labelled, which means the test also checks accessibility as a side effect.

`getByTestId` is the escape hatch for elements with no accessible name.

```html
<button data-testid="user-menu" aria-label="Open user menu">
```

## Assertions

```typescript
await expect(page.getByRole('alert')).toBeVisible();
await expect(page.getByRole('alert')).toHaveText('Saved successfully');
await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
await expect(page.getByRole('listitem')).toHaveCount(3);
await expect(page).toHaveURL(/\/orders\/\d+/);
await expect(page).toHaveTitle(/Dashboard/);
```

Playwright assertions **retry** until they pass or time out. That is why `await expect(...)` is different from `expect(await ...)`.

```typescript
await expect(page.getByText('Loaded')).toBeVisible();     // retries
expect(await page.getByText('Loaded').isVisible()).toBe(true);   // one check, flaky
```

Always use the first form.

## Mocking the network

Real API calls make tests slow and dependent on someone else's environment.

```typescript
test('shows the user list', async ({ page }) => {
  await page.route('**/api/users', route =>
    route.fulfill({
      status: 200,
      json: [
        { id: 1, name: 'Asha' },
        { id: 2, name: 'Ravi' },
      ],
    }),
  );

  await page.goto('/users');

  await expect(page.getByRole('listitem')).toHaveCount(2);
});
```

Error cases become easy to test, and these are the paths nobody exercises manually:

```typescript
test('shows an error when the API fails', async ({ page }) => {
  await page.route('**/api/users', route => route.fulfill({ status: 500 }));

  await page.goto('/users');

  await expect(page.getByText('Could not load users')).toBeVisible();
});

test('handles a slow response', async ({ page }) => {
  await page.route('**/api/users', async route => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    await route.fulfill({ json: [] });
  });

  await page.goto('/users');

  await expect(page.getByTestId('spinner')).toBeVisible();
});
```

## Reusing authentication

Signing in through the UI in every test is slow. Do it once and save the state.

```typescript
// e2e/auth.setup.ts
import { test as setup } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('asha@example.com');
  await page.getByLabel('Password').fill('correct-horse');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.waitForURL('/dashboard');

  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
```

```typescript
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
    dependencies: ['setup'],
  },
]
```

Every test now starts signed in, with no login step. Add `e2e/.auth` to `.gitignore`.

## Page objects

For flows used in several tests, wrap the interactions.

```typescript
export class CheckoutPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/checkout');
  }

  async fillDelivery(address: Address): Promise<void> {
    await this.page.getByLabel('Address line 1').fill(address.line1);
    await this.page.getByLabel('City').fill(address.city);
    await this.page.getByLabel('Postcode').fill(address.postcode);
  }

  async submit(): Promise<void> {
    await this.page.getByRole('button', { name: 'Place order' }).click();
  }
}
```

```typescript
test('places an order', async ({ page }) => {
  const checkout = new CheckoutPage(page);

  await checkout.goto();
  await checkout.fillDelivery({ line1: '1 High Street', city: 'Delhi', postcode: 'SW1A 1AA' });
  await checkout.submit();

  await expect(page.getByText('Order confirmed')).toBeVisible();
});
```

Changing the checkout markup means editing one class rather than twenty tests.

## Accessibility checks

```bash
npm install --save-dev @axe-core/playwright
```

```typescript
import AxeBuilder from '@axe-core/playwright';

test('the dashboard has no obvious accessibility problems', async ({ page }) => {
  await page.goto('/dashboard');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

Automated checks catch roughly a third of real accessibility problems, and it is a cheap third: missing labels, poor contrast, invalid ARIA.

## Debugging

```bash
npx playwright test --ui           # an interactive runner with time travel
npx playwright test --debug        # step through with the inspector
npx playwright test --headed       # watch the browser
npx playwright codegen localhost:4200   # record clicks into a test
npx playwright show-report
```

The UI mode is genuinely good. It shows the DOM at each step, so you can see exactly what the page looked like when an assertion failed.

`codegen` writes a test as you click through the application, which is a quick way to draft one.

## In continuous integration

```yaml
- run: npm ci
- run: npx playwright install --with-deps chromium
- run: npx ng build
- run: npx playwright test
- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: playwright-report
    path: playwright-report/
```

Uploading the report on failure means you can open the trace from a failed pipeline run rather than trying to reproduce locally.

## How many to write

End to end tests are expensive: slow, occasionally flaky, and requiring maintenance.

**Do write:** sign in, the main purchase or submission flow, anything involving payment, one test per critical user journey.

**Do not write:** every validation message, every branch of a form, anything a unit test covers faster.

A useful target is five to twenty end to end tests for a substantial application. If you have hundreds, the pipeline will be slow and the flakiness will erode trust in the suite.

## Quick recap

- Playwright drives a real browser and auto waits, removing most flakiness.
- Configure `webServer` so the application starts automatically.
- Prefer `getByRole` and `getByLabel`, which also verify accessibility.
- Use `await expect(...)`, which retries, not `expect(await ...)`, which does not.
- Mock the network with `page.route` to test error and slow cases.
- Save authentication state once and reuse it across tests.
- Keep the suite small and focused on critical journeys.

<code id="code-content" class="language-typescript">
import { test, expect, devices, defineConfig, type Page } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',      // a failed retry gives a steppable recording
    screenshot: 'only-on-failure',
  },
  // Starts the dev server automatically, so there is no extra command
  webServer: {
    command: 'ng serve',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json' }, dependencies: ['setup'] },
  ],
});
test('a user can sign in and reach the dashboard', async ({ page }) =&gt; {
  // Mock the network: fast, deterministic, and error cases become testable
  await page.route('**/api/users', route =&gt; route.fulfill({
    status: 200, json: [{ id: 1, name: 'Asha' }],
  }));
  await page.goto('/login');
  // getByRole and getByLabel are the best defaults: they fail when an
  // element is not properly labelled, so the test checks accessibility too
  await page.getByLabel('Email').fill('asha@example.com');
  await page.getByRole('button', { name: 'Sign in' }).click();
  // await expect(...) RETRIES until it passes or times out.
  // expect(await ...) checks ONCE and is flaky. Always use the first form.
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(1);
});
test('shows an error when the API fails', async ({ page }) =&gt; {
  await page.route('**/api/users', route =&gt; route.fulfill({ status: 500 }));
  await page.goto('/users');
  await expect(page.getByText('Could not load users')).toBeVisible();
});
// A page object means changing markup edits ONE class, not twenty tests
export class CheckoutPage {
  constructor(private readonly page: Page) {}
  async goto() { await this.page.goto('/checkout'); }
  async fillCity(city: string) { await this.page.getByLabel('City').fill(city); }
  async submit() { await this.page.getByRole('button', { name: 'Place order' }).click(); }
}
// Sign in ONCE and reuse the state, rather than logging in per test:
//   await page.context().storageState({ path: 'e2e/.auth/user.json' });
//   then storageState in the project config. Add e2e/.auth to .gitignore.
// Debugging, and UI mode is genuinely good:
//   npx playwright test --ui        interactive, with time travel
//   npx playwright codegen localhost:4200   records clicks into a test
//   npx playwright show-report
// HOW MANY: five to twenty for a substantial application. Cover sign in,
// the main purchase or submission flow, and each critical journey.
// Hundreds of them means a slow pipeline and flakiness that erodes trust.
</code></pre>
