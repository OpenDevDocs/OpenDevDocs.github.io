---
publishDate: 2026-03-29T09:49
title: Testing JavaScript (Jest, Mocha)
slug: testing-javascript-jest-mocha
metadescription: Write tests that catch bugs before your users do. Unit tests, assertions, mocking, async testing and what makes a test worth having.
updateDate: 2026-09-05T09:49
author: ['bishal-biswas']
level: 3
tags: ['testing', 'tooling']
course: javascript
---

## Why test?

Manual testing means clicking through the same screens every time you change anything. It is slow, and you will eventually skip a step. Automated tests run in seconds and never get bored.

The real payoff is confidence. With a good test suite you can refactor freely, because you will know immediately if something broke.

## The shape of a test

```javascript
function add(a, b) {
  return a + b;
}
test('adds two numbers', () => {
  expect(add(2, 3)).toBe(5);
});
```

Three parts, often called **arrange, act, assert**:

```javascript
test('applies a discount', () => {
  const price = 1000;
  const discounted = applyDiscount(price, 20);
  expect(discounted).toBe(800);
});
```

## The tools

- **Vitest** is the modern default. Fast, works with ES modules out of the box, and uses the same API as Jest.
- **Jest** is still the most widely used, especially in React projects.
- **Mocha** is older and more modular. You pick your own assertion library, usually Chai.
- **Node's built in runner** needs no dependency at all.

```bash
npm install --save-dev vitest
npx vitest
```

```bash
node --test
```

The examples below use the Jest and Vitest style, since it is the one you will meet most.

## Assertions

```javascript
expect(value).toBe(5);
expect(object).toEqual({ a: 1 });
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();
expect(number).toBeGreaterThan(3);
expect(number).toBeCloseTo(0.3);
expect(array).toContain('item');
expect(array).toHaveLength(3);
expect(text).toMatch(/pattern/);
expect(fn).toThrow();
expect(fn).toThrow('specific message');
```

The difference between `toBe` and `toEqual` catches everyone once:

```javascript
expect({ a: 1 }).toBe({ a: 1 });
expect({ a: 1 }).toEqual({ a: 1 });
```

`toBe` compares identity, `toEqual` compares contents. Use `toEqual` for objects and arrays.

And remember floating point from the numbers topic:

```javascript
expect(0.1 + 0.2).toBe(0.3);
expect(0.1 + 0.2).toBeCloseTo(0.3);
```

## Grouping and setup

```javascript
describe('ShoppingCart', () => {
  let cart;
  beforeEach(() => {
    cart = new ShoppingCart();
  });
  describe('add', () => {
    test('adds an item', () => {
      cart.add({ name: 'Pen', price: 20 });
      expect(cart.items).toHaveLength(1);
    });
    test('increases the total', () => {
      cart.add({ name: 'Pen', price: 20 });
      expect(cart.getTotal()).toBe(20);
    });
  });
  describe('remove', () => {
    test('throws for a missing item', () => {
      expect(() => cart.remove('Ghost')).toThrow('Item not found');
    });
  });
});
```

`beforeEach` gives every test a fresh cart, so they cannot affect each other. Tests that depend on each other's leftovers are a nightmare to debug.

Note `expect(() => ...)` for throwing. Passing a function lets the matcher call it and catch the error. `expect(cart.remove('Ghost'))` would throw before the assertion ever ran.

## Testing async code

```javascript
test('fetches a user', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('Asha');
});
test('rejects for a bad id', async () => {
  await expect(fetchUser(-1)).rejects.toThrow('Invalid id');
});
test('resolves with a value', async () => {
  await expect(fetchUser(1)).resolves.toHaveProperty('name');
});
```

Forgetting `await` is the classic async testing bug. The test finishes before the assertion runs, so it passes no matter what.

## Mocking

Real tests should not hit the network or the clock.

```javascript
const mockFn = vi.fn();
mockFn('hello');
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith('hello');
expect(mockFn).toHaveBeenCalledTimes(1);
const mockFetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve({ name: 'Asha' })
});
```

Replace a whole module:

```javascript
vi.mock('./api.js', () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: 1, name: 'Test User' })
}));
```

Control time:

```javascript
test('debounce waits before firing', () => {
  vi.useFakeTimers();
  const fn = vi.fn();
  const debounced = debounce(fn, 500);
  debounced();
  debounced();
  expect(fn).not.toHaveBeenCalled();
  vi.advanceTimersByTime(500);
  expect(fn).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});
```

Without fake timers that test would take half a second of real waiting. With them it is instant.

## Testing the DOM

```javascript
test('button updates the counter', () => {
  document.body.innerHTML = `
    <button id="increment">+</button>
    <span id="count">0</span>
  `;
  setupCounter();
  document.querySelector('#increment').click();
  expect(document.querySelector('#count').textContent).toBe('1');
});
```

You need a DOM environment. Vitest uses `environment: 'jsdom'`, and Jest uses `testEnvironment: 'jsdom'`.

## What makes a good test

**Test behaviour, not implementation.**

```javascript
test('bad: checks internals', () => {
  const cart = new ShoppingCart();
  cart.add({ price: 20 });
  expect(cart._internalItems.length).toBe(1);
});
test('good: checks the outcome', () => {
  const cart = new ShoppingCart();
  cart.add({ price: 20 });
  expect(cart.getTotal()).toBe(20);
});
```

Rewrite the internals and the second test still passes. That is the point.

**One reason to fail per test.** If a test asserts six unrelated things, a failure tells you very little.

**Name it as a sentence.** `test('throws when the amount is negative')` beats `test('test2')`.

**Cover the edges.** Empty arrays, zero, negative numbers, `null`, very large values. That is where bugs live.

## Coverage is a hint, not a goal

```bash
npx vitest --coverage
```

Coverage tells you which lines ran, not whether they were checked properly.

```javascript
test('runs the function', () => {
  calculateTotal([{ price: 10 }]);
});
```

That gives 100% coverage of `calculateTotal` and asserts nothing at all. Aim for meaningful tests on important paths rather than a number.

## Quick recap

- Arrange, act, assert is the shape of every test.
- `toBe` compares identity, `toEqual` compares contents.
- `beforeEach` keeps tests independent.
- Wrap throwing code in a function for `toThrow`.
- Always `await` async assertions, or the test silently passes.
- Mock network calls and use fake timers to keep tests fast and reliable.
- Test behaviour rather than internals, and treat coverage as a hint.

<code id="code-content" class="language-javascript">
// The code under test
function applyDiscount(price, percentage) {
  if (typeof price !== 'number' || price &lt;= 0) {
    throw new RangeError('Price must be a positive number');
  }
  return price - price * (percentage / 100);
}
// Arrange, act, assert
test('applies a percentage discount', () =&gt; {
  const price = 1000;                       // arrange
  const result = applyDiscount(price, 20);  // act
  expect(result).toBe(800);                 // assert
});
// toBe compares identity, toEqual compares contents
test('object comparison', () =&gt; {
  expect({ a: 1 }).toEqual({ a: 1 });       // passes
  // expect({ a: 1 }).toBe({ a: 1 });       // fails, different objects
});
// Floating point needs toBeCloseTo
test('handles decimals', () =&gt; {
  expect(0.1 + 0.2).toBeCloseTo(0.3);
});
// Wrap throwing code in a function so the matcher can call it
test('rejects an invalid price', () =&gt; {
  expect(() =&gt; applyDiscount(-5, 10)).toThrow('positive number');
});
// beforeEach keeps every test independent
describe('ShoppingCart', () =&gt; {
  let cart;
  beforeEach(() =&gt; { cart = new ShoppingCart(); });
  test('starts empty', () =&gt; {
    expect(cart.getTotal()).toBe(0);
  });
  test('adds an item', () =&gt; {
    cart.add({ name: 'Pen', price: 20 });
    expect(cart.getTotal()).toBe(20);
  });
});
// Async tests: always await, or the test passes without checking anything
test('fetches a user', async () =&gt; {
  const user = await fetchUser(1);
  expect(user).toHaveProperty('name');
});
test('rejects a bad id', async () =&gt; {
  await expect(fetchUser(-1)).rejects.toThrow('Invalid id');
});
// Fake timers turn a half second wait into an instant test
test('debounce fires once after the delay', () =&gt; {
  vi.useFakeTimers();
  const fn = vi.fn();
  const debounced = debounce(fn, 500);
  debounced();
  debounced();
  expect(fn).not.toHaveBeenCalled();
  vi.advanceTimersByTime(500);
  expect(fn).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});
</code></pre>
