---
publishDate: 2026-05-25T10:11
title: Testing with Vitest and React Testing Library
slug: testing-react-with-vitest-and-rtl
metadescription: Write tests that survive refactoring by testing what users see and do, not how components are built.
updateDate: 2026-09-05T10:11
author: ['bishal-biswas']
level: 3
tags: ['testing', 'vitest', 'quality']
course: react
---

## Setup

```bash
npm install --save-dev vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js'
  }
});
```

```javascript
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
afterEach(() => {
  cleanup();
});
```

Vitest is the modern default. Its API matches Jest, so Jest knowledge transfers directly.

## The guiding principle

> The more your tests resemble the way your software is used, the more confidence they can give you.

That is the philosophy behind React Testing Library, and it shapes everything.

**Do not test** state values, prop names, internal functions or how many times something rendered.

**Do test** what appears on screen, and what happens when the user interacts.

```javascript
test('bad: tests the implementation', () => {
  const { result } = renderHook(() => useCounter());
  expect(result.current.count).toBe(0);
});
test('good: tests the behaviour', async () => {
  render(<Counter />);
  await userEvent.click(screen.getByRole('button', { name: /increment/i }));
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

Rewrite `Counter` to use `useReducer` and the second test still passes. That is the whole point.

## A first test

```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect } from 'vitest';
import Counter from './Counter.jsx';
describe('Counter', () => {
  test('starts at zero', () => {
    render(<Counter />);
    expect(screen.getByText('Count: 0')).toBeInTheDocument();
  });
  test('increments when clicked', async () => {
    const user = userEvent.setup();
    render(<Counter />);
    await user.click(screen.getByRole('button', { name: /increment/i }));
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });
});
```

Note `userEvent.setup()` and the `await`. `userEvent` simulates real interaction, including focus, hover and keyboard events, and it is asynchronous. `fireEvent` is lower level and less realistic.

## Query priority

The queries you use are a design decision, not just a technicality.

```javascript
screen.getByRole('button', { name: /save/i });
screen.getByLabelText('Email address');
screen.getByPlaceholderText('you@example.com');
screen.getByText('Welcome back');
screen.getByTestId('submit-button');
```

**Prefer `getByRole`.** It finds elements the way assistive technology does, so a passing test is also evidence the component is accessible. If you cannot find a button by its accessible name, a screen reader user cannot find it either.

`getByTestId` is the last resort, for things with no accessible identity at all.

## The three query prefixes

```javascript
screen.getByText('Hello');
screen.queryByText('Hello');
await screen.findByText('Hello');
```

- **`get`** throws if not found. Use it when the element must exist.
- **`query`** returns `null`. Use it to assert absence.
- **`find`** returns a promise and waits. Use it for anything asynchronous.

```javascript
expect(screen.queryByText('Error')).not.toBeInTheDocument();
expect(await screen.findByText('Loaded')).toBeInTheDocument();
```

Using `getBy` for something that appears later is the most common beginner failure. It throws immediately because the element is not there yet.

## Testing a form

```javascript
test('shows a validation error for a bad email', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<SignupForm onSubmit={onSubmit} />);
  await user.type(screen.getByLabelText(/email/i), 'not-an-email');
  await user.click(screen.getByRole('button', { name: /sign up/i }));
  expect(await screen.findByText(/does not look like an email/i)).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});
test('submits valid data', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<SignupForm onSubmit={onSubmit} />);
  await user.type(screen.getByLabelText(/email/i), 'asha@example.com');
  await user.type(screen.getByLabelText(/password/i), 'longenough123');
  await user.click(screen.getByRole('button', { name: /sign up/i }));
  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'asha@example.com',
      password: 'longenough123'
    });
  });
});
```

Note that `getByLabelText` only works if the field actually has a label. Another case where the test pushes you towards accessible markup.

## Mocking the network with MSW

Mocking `fetch` directly is brittle. MSW intercepts at the network level, so your component's real fetching code runs.

```bash
npm install --save-dev msw
```

```javascript
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
const server = setupServer(
  http.get('/api/users/:id', ({ params }) =>
    HttpResponse.json({ id: params.id, name: 'Asha' })
  )
);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
test('shows the user name', async () => {
  render(<UserProfile userId="1" />);
  expect(await screen.findByText('Asha')).toBeInTheDocument();
});
test('shows an error when the request fails', async () => {
  server.use(
    http.get('/api/users/:id', () => new HttpResponse(null, { status: 500 }))
  );
  render(<UserProfile userId="1" />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
});
```

The same handlers can drive local development, so your mocks stay honest.

## Custom render for providers

```javascript
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
export function renderWithProviders(ui, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}
```

Note `retry: false`. Without it a failing request retries and your error test times out.

## What to test

**Do test:** the happy path, validation errors, empty and error states, and any bug you fix.

**Do not test:** third party libraries, trivial presentational components, or exact class names.

That last point about bugs matters most. Every bug is proof that a case was untested. Writing the test first also confirms you understood the cause.

## Coverage is a hint

```bash
npx vitest --coverage
```

Coverage shows which lines ran, not whether they were checked.

```javascript
test('renders', () => {
  render(<ComplexForm />);
});
```

100% coverage of the render path, zero assertions, zero value. Aim for meaningful tests on the paths that matter.

## Quick recap

- Vitest plus React Testing Library is the modern default.
- Test what the user sees and does, never the implementation.
- Use `userEvent` with `await`, not `fireEvent`.
- Prefer `getByRole`, and treat `getByTestId` as a last resort.
- `get` throws, `query` returns null, `find` waits.
- Mock the network with MSW rather than stubbing `fetch`.
- Wrap providers in a custom render, and turn retries off.
- Write a test for every bug you fix.

<code id="code-content" class="language-javascript">
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
// MSW intercepts at the NETWORK level, so your component's real fetching
// code runs. Far less brittle than stubbing fetch.
const server = setupServer(
  http.get('/api/users/:id', ({ params }) =&gt;
    HttpResponse.json({ id: params.id, name: 'Asha' })
  )
);
beforeAll(() =&gt; server.listen());
afterEach(() =&gt; server.resetHandlers());
describe('SignupForm', () =&gt; {
  test('shows a validation error for a bad email', async () =&gt; {
    const user = userEvent.setup();     // realistic interaction, async
    const onSubmit = vi.fn();
    render(&lt;SignupForm onSubmit={onSubmit} /&gt;);
    // getByLabelText only works if the field HAS a label, which pushes
    // you towards accessible markup
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    // getByRole finds elements the way a screen reader does. If this
    // cannot find the button, neither can your users.
    await user.click(screen.getByRole('button', { name: /sign up/i }));
    // findBy WAITS. Using getBy here would throw, because the error
    // has not appeared yet. This is the commonest beginner failure.
    expect(await screen.findByText(/does not look like an email/i))
      .toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  test('submits valid data', async () =&gt; {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(&lt;SignupForm onSubmit={onSubmit} /&gt;);
    await user.type(screen.getByLabelText(/email/i), 'asha@example.com');
    await user.type(screen.getByLabelText(/password/i), 'longenough123');
    await user.click(screen.getByRole('button', { name: /sign up/i }));
    await waitFor(() =&gt;
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'asha@example.com',
        password: 'longenough123'
      })
    );
  });
  test('shows an error when the request fails', async () =&gt; {
    // Override the handler for this one test
    server.use(
      http.get('/api/users/:id', () =&gt; new HttpResponse(null, { status: 500 }))
    );
    render(&lt;UserProfile userId="1" /&gt;);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
  test('queryBy asserts ABSENCE, and returns null instead of throwing', () =&gt; {
    render(&lt;SignupForm /&gt;);
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });
});
// A custom render for providers. retry: false matters, or a failing
// request retries and your error test times out.
// export function renderWithProviders(ui, { route = '/' } = {}) {
//   const queryClient = new QueryClient({
//     defaultOptions: { queries: { retry: false } }
//   });
//   return render(
//     &lt;QueryClientProvider client={queryClient}&gt;
//       &lt;MemoryRouter initialEntries={[route]}&gt;{ui}&lt;/MemoryRouter&gt;
//     &lt;/QueryClientProvider&gt;
//   );
// }
// TEST BEHAVIOUR, NOT IMPLEMENTATION. Rewrite the component with
// useReducer instead of useState and every test above still passes.
</code></pre>
