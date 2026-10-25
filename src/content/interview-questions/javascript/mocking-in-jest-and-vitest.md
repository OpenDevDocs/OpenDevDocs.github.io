---
course: javascript
slug: mocking-in-jest-and-vitest
experienceLevel: mid
difficulty: medium
tags:
  - testing
  - jest
  - vitest
question: How does mocking work in Jest and Vitest, and when should you use mocks?
answer: |
  Mocking replaces a real dependency (a function, a module, a timer or the network) with a controllable fake so a unit test can run in isolation, return predictable data and assert how the dependency was called; Jest uses the `jest` object and Vitest uses the nearly identical `vi` object.

  The main tools (Jest name / Vitest name):

  - **Mock functions**: `jest.fn()` / `vi.fn()` create a function that records calls. Configure it with `mockReturnValue`, `mockResolvedValue`, `mockRejectedValue` or `mockImplementation`, and assert with `toHaveBeenCalledWith` or `toHaveBeenCalledTimes`.
  - **Spies**: `jest.spyOn(obj, 'method')` / `vi.spyOn(...)` wrap an existing method. By default the original still runs; add `mockImplementation` to replace it. Restore with `mockRestore()`.
  - **Module mocks**: `jest.mock('./api')` / `vi.mock('./api', factory)` replace a whole imported module. Both are **hoisted** above the imports, so the factory cannot use variables declared normally in the test file; Vitest offers `vi.hoisted()` for that.
  - **Fake timers**: `useFakeTimers()` plus `advanceTimersByTime(ms)` test debounce, retries and timeouts without waiting.
  - **Network**: for `fetch`, stub the global (`vi.stubGlobal('fetch', ...)`) or, better, use Mock Service Worker (MSW) to intercept requests at the network layer.

  Resetting state between tests:

  - `mockClear()` clears recorded calls; `mockReset()` also removes the implementation; `mockRestore()` puts the original back for spies.
  - Config options such as `clearMocks` and `restoreMocks` do this automatically. Leaking mock state between tests is a common cause of flaky suites.

  Good practice:

  1. Mock **boundaries** you do not control: network, database, time, randomness, third-party SDKs. Avoid mocking your own small pure functions.
  2. Prefer dependency injection (passing the dependency in) over module mocking where possible; it is simpler and framework-independent.
  3. Assert behaviour and results, not every internal call. Over-mocked tests pass while the real integration is broken.
  4. Keep a few integration tests that use real implementations.
codeExample: |
  // userService.test.js (Vitest; for Jest replace `vi` with `jest` and drop the import)
  import { describe, it, expect, vi, afterEach } from 'vitest';

  // Code under test: dependencies are injected, so they are easy to fake
  async function getDisplayName(id, api, logger) {
    try {
      const user = await api.fetchUser(id);
      return `${user.first} ${user.last}`;
    } catch (err) {
      logger.warn(`lookup failed for ${id}: ${err.message}`);
      return 'Unknown user';
    }
  }

  describe('getDisplayName', () => {
    afterEach(() => vi.restoreAllMocks());

    it('formats the name returned by the API', async () => {
      const api = { fetchUser: vi.fn().mockResolvedValue({ first: 'Ada', last: 'Lovelace' }) };
      await expect(getDisplayName(7, api, console)).resolves.toBe('Ada Lovelace');
      expect(api.fetchUser).toHaveBeenCalledWith(7);
      expect(api.fetchUser).toHaveBeenCalledTimes(1);
    });

    it('logs and falls back when the API fails', async () => {
      const api = { fetchUser: vi.fn().mockRejectedValue(new Error('timeout')) };
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); // silence output
      expect(await getDisplayName(7, api, console)).toBe('Unknown user');
      expect(warn).toHaveBeenCalledWith('lookup failed for 7: timeout');
    });
  });

  // Run with: npx vitest run
  // Output: both tests pass (2 passed)
popularity: 7.8
isPublished: true
---
