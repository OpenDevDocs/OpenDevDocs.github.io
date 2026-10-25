---
publishDate: 2026-10-25T13:56
title: End-to-End Testing with Playwright
slug: testing-with-playwright
metadescription: Add Playwright end-to-end tests to a Next.js app that click through real pages, search, cart, forms and auth against a production build.
updateDate: 2026-10-25T13:56
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'testing', 'playwright', 'e2e']
course: nextjs
---

## What you will build

In [Unit Testing with Vitest](/courses/nextjs/testing-with-vitest) you tested small pieces on their own. That left a gap: async Server Components, Server Actions, caching and login cannot be unit tested easily. They only make sense when the whole app is running.

**End-to-end tests** (often shortened to **E2E tests**) fill that gap. An E2E test starts your real app, opens a real browser, and acts like a visitor: it visits pages, types into fields, clicks buttons and checks what appears. If the unit tests checked each car part on the workbench, E2E tests take the finished car for a drive around the block.

You will use **Playwright**, a testing tool from Microsoft that can drive Chromium (Chrome and Edge), Firefox and WebKit (Safari's engine) with one API. By the end, Book Nook will have tests that:

1. Navigate from the home page to the book list.
2. Search for a book by author.
3. Add a book to the cart and check the total.
4. Post a review, including the validation error.
5. Check that `/admin` sends visitors to the login page.

## Step 1: install Playwright

From your Book Nook folder, run the setup wizard:

```bash
npm init playwright@latest
```

It asks a few questions. Answer like this:

```text
✔ Do you want to use TypeScript or JavaScript? · JavaScript
✔ Where to put your end-to-end tests? · e2e
✔ Add a GitHub Actions workflow? (y/N) · false
✔ Install Playwright browsers (can be done manually via 'npx playwright install')? (Y/n) · true
```

We call the folder `e2e` (not the default `tests`) so it is obvious which tests are which. Your Vitest config from the previous lesson already ignores `e2e/**`.

The wizard installs `@playwright/test`, downloads the three browsers (a few hundred megabytes, so give it a minute), and creates:

```text
book-nook/
├── playwright.config.js   settings for Playwright
└── e2e/
    └── example.spec.js    a sample test (you can delete it)
```

It also adds a few lines to `.gitignore` for test reports. You never commit those.

## Step 2: point Playwright at Book Nook

Replace the generated `playwright.config.js` with this shorter version:

```javascript
// playwright.config.js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
  },
});
```

The important parts:

- **`baseURL`** lets tests write `page.goto('/books')` instead of the full address.
- **`projects`** lists the browsers. Every test runs once in each one.
- **`webServer`** tells Playwright how to start your app before testing. It runs the command, waits until the `url` answers, runs the tests, then stops the server.
- **`reuseExistingServer`**: on your computer, if something is already running on port 3000, Playwright uses it instead of starting a new one. On a CI server (where `CI` is set) it always starts fresh.
- **`trace: 'on-first-retry'`** records a step-by-step trace when a failed test is retried, which is gold for finding out what went wrong.

Why `build` and `start` instead of `dev`? The Next.js docs recommend testing against your **production** build, because that is what real visitors get. Production also behaves differently from development in ways that matter: caching is real, there is no error overlay, and pages are prerendered. The build takes a minute, which is why the `timeout` is generous. While you are writing tests, you can run `npm run dev` yourself in another terminal and Playwright will happily reuse it.

## Step 3: write your first test

Create `e2e/shop.spec.js`:

```javascript
// e2e/shop.spec.js
import { test, expect } from '@playwright/test';

test('home page links to the book list', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome to Book Nook');

  await page.getByRole('link', { name: 'See all books' }).click();
  await expect(page).toHaveURL('/books');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('All books');
});
```

Every Playwright test gets a fresh `page`, a brand-new browser tab with no cookies or history. Then:

- `page.goto('/')` visits the home page.
- `page.getByRole(...)` finds elements the same way React Testing Library does: by role and accessible name. These are called **locators**.
- `expect(...).toHaveText(...)` and `toHaveURL(...)` are **web-first assertions**. They keep retrying for up to 5 seconds until the condition is true. You almost never need to "wait" by hand, because Playwright waits for you.

## Step 4: run it

```bash
npx playwright test
```

Playwright builds and starts Book Nook, runs the test in all three browsers, and prints a summary (your times will differ):

```text
Running 3 tests using 3 workers

  3 passed (41.2s)

To open last HTML report run:

  npx playwright show-report
```

Most of that time is the production build. While you write tests, two options make life easier:

```bash
# Only one browser, much faster
npx playwright test --project=chromium

# UI mode: watch each step, time-travel through the test, rerun with one click
npx playwright test --ui
```

## Step 5: test the real features

Now add the tests that unit tests could not cover. Append these to `e2e/shop.spec.js`:

```javascript
// e2e/shop.spec.js
test('search finds a book by author', async ({ page }) => {
  await page.goto('/books');
  await page.getByPlaceholder('Search by title or author').fill('herbert');
  await page.getByRole('button', { name: 'Search' }).click();

  await expect(page).toHaveURL('/books?q=herbert');
  await expect(page.getByRole('link', { name: 'Dune' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'The Hobbit' })).toHaveCount(0);
});

test('adding a book updates the cart', async ({ page }) => {
  await page.goto('/books/dune');
  await expect(page).toHaveTitle('Dune | Book Nook');

  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('link', { name: 'Cart (1)' })).toBeVisible();

  await page.getByRole('link', { name: 'Cart (1)' }).click();
  await expect(page.getByText('Total: $14.50')).toBeVisible();
});
```

The search test exercises `searchParams`, the [Search Forms with the Form Component](/courses/nextjs/search-with-next-form) page, and the async Server Component that filters books. The cart test checks `generateMetadata` (the page title), the `CartProvider` context, and the cart page, all at once.

Next, a form that uses a Server Action with validation (as built in [Validating Forms and Showing Errors](/courses/nextjs/form-validation)):

```javascript
// e2e/shop.spec.js
test('a review needs a real comment', async ({ page }) => {
  await page.goto('/books/the-little-prince');
  await page.getByLabel('Your name').fill('Sam');
  await page.getByLabel('Review').fill('Short');
  await page.getByRole('button', { name: 'Post review' }).click();
  await expect(page.getByText('Your review needs at least 10 characters.')).toBeVisible();

  // The database keeps every review, so make this one unique for each run
  const review = `A tiny book with a very big heart. (test ${Date.now()})`;
  await page.getByLabel('Review').fill(review);
  await page.getByRole('button', { name: 'Post review' }).click();
  await expect(page.getByText('Thanks! Your review is live.')).toBeVisible();
  await expect(page.getByText(review)).toBeVisible();
});
```

`getByLabel('Your name')` finds the input whose `<label>` says "Your name". If this locator fails, it often means your form is missing a label, so E2E tests quietly improve accessibility too. The last line also proves that `updateTag` refreshed the cached review list.

Why `Date.now()` in the review text? This test writes a real row into your database, and the row stays there. On the second run there would be two identical reviews on the page, and `getByText` would complain that it found more than one element. Giving each run its own text avoids that. (Real teams usually point E2E tests at a separate test database that is reset before each run.)

This test caught a real bug while this course was being written. React 19 resets a form after its action finishes, so after the first (failed) submit, the name field was empty again and the second submit failed with "Please enter your name". The fix was to send the typed values back from the action and use them as `defaultValue`. A unit test would never have noticed.

Finally, check that the protected page is protected (see [Protecting Pages, Actions and APIs](/courses/nextjs/authorization)):

```javascript
// e2e/shop.spec.js
test('the admin page sends visitors to the login page', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
});
```

Run everything again with `npx playwright test`. Five tests in three browsers means 15 test runs:

```text
Running 15 tests using 8 workers

  15 passed (52.8s)
```

## Step 6: find out why a test failed

When a test fails, Playwright tells you exactly which line and what it was waiting for:

```text
  1) [chromium] › e2e\shop.spec.js:34:5 › a review needs a real comment

    Error: expect(locator).toBeVisible() failed

    Locator: getByText('Thanks! Your review is live.')
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found
```

Three tools help you dig in:

- `npx playwright show-report` opens the HTML report, with screenshots and the error for each failed test.
- `npx playwright test --ui` lets you step through the test and see the page at every moment.
- `npx playwright test --debug` opens the browser with a step-by-step inspector.

To write a new test quickly, let Playwright watch you click around and write the code for you:

```bash
npx playwright codegen http://localhost:3000
```

Use the generated code as a starting point, then tidy the locators into `getByRole` and `getByLabel` calls.

## Running on CI

On a CI server (for example GitHub Actions), install the browsers and the system libraries they need, then run the tests:

```bash
npm ci
npx playwright install --with-deps
npx playwright test
```

Because `CI` is set there, `reuseExistingServer` is false, `retries` is 2, and `forbidOnly` fails the run if someone left a `test.only` in the code by accident.

> **Good to know:** With Cache Components, Next.js also offers an `instant()` helper in the separate `@next/playwright` package, to check what is visible the moment a navigation happens, before streamed content arrives. It is an advanced tool; the plain Playwright tests in this lesson cover most needs.

## Common mistakes

### Testing against a stale build

If `npm start` is already running from an old build, `reuseExistingServer` makes Playwright test that old code, and your new feature "does not exist". Stop the old server, or let Playwright start its own.

### Port 3000 is busy

```text
Error: http://localhost:3000 is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.
```

On CI something else is using the port. Stop it, or change both `baseURL` and `webServer.url` (and start Next.js with `-p`) to another port.

### Using CSS selectors that break

`page.locator('.mt-4 > button')` breaks the moment you change a Tailwind class. Prefer `getByRole`, `getByLabel`, `getByPlaceholder` and `getByText`. They describe what the user sees, which changes far less often.

### Expecting state to carry over between tests

Each test starts with a clean browser, so the cart is empty and nobody is logged in. If a test needs a full cart or a session, do those steps inside the test (or in a `test.beforeEach`).

### Forgetting `await`

```javascript
// e2e/shop.spec.js
expect(page.getByText('Total: $14.50')).toBeVisible(); // missing await: never really checked
```

Web-first assertions return Promises. Without `await` the test finishes before the check happens, and may pass when it should fail. Always write `await expect(...)`.

## Quick recap

- E2E tests drive a real browser against your running app, so they can test Server Components, Server Actions, caching and auth.
- `npm init playwright@latest` installs Playwright and the browsers; use an `e2e` folder.
- `webServer` with `npm run build && npm run start` tests the production build, as the Next.js docs recommend.
- Find elements with `getByRole`, `getByLabel` and `getByText`, and always `await expect(...)`.
- Use `--project=chromium`, `--ui`, `show-report` and `codegen` to work faster.
- On CI, run `npx playwright install --with-deps` before `npx playwright test`.

<code id="code-content" class="language-javascript">
// e2e/shop.spec.js: run with "npx playwright test"
import { test, expect } from '@playwright/test';
// Visit a page and follow a link, like a real visitor
test('home page links to the book list', async ({ page }) =&gt; {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome to Book Nook');
  await page.getByRole('link', { name: 'See all books' }).click();
  await expect(page).toHaveURL('/books');
});
// searchParams plus an async Server Component
test('search finds a book by author', async ({ page }) =&gt; {
  await page.goto('/books');
  await page.getByPlaceholder('Search by title or author').fill('herbert');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('link', { name: 'Dune' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'The Hobbit' })).toHaveCount(0);
});
// Client context, metadata and the cart page together
test('adding a book updates the cart', async ({ page }) =&gt; {
  await page.goto('/books/dune');
  await expect(page).toHaveTitle('Dune | Book Nook');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('link', { name: 'Cart (1)' }).click();
  await expect(page.getByText('Total: $14.50')).toBeVisible();
});
// A Server Action with validation errors
test('a review needs a real comment', async ({ page }) =&gt; {
  await page.goto('/books/the-little-prince');
  await page.getByLabel('Your name').fill('Sam');
  await page.getByLabel('Review').fill('Short');
  await page.getByRole('button', { name: 'Post review' }).click();
  await expect(page.getByText('Your review needs at least 10 characters.')).toBeVisible();
});
// Protected pages send visitors to the login page
test('the admin page sends visitors to the login page', async ({ page }) =&gt; {
  await page.goto('/admin');
  await expect(page).toHaveURL('/login');
});
</code></pre>
