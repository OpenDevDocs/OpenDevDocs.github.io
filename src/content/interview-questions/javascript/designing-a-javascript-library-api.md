---
course: javascript
slug: designing-a-javascript-library-api
experienceLevel: senior
difficulty: hard
tags:
  - api-design
  - libraries
  - architecture
question: What principles do you follow when designing the public API of a JavaScript library?
answer: |
  A library's public API is a **contract you can't easily change**. Every exported name, option, error message format and side effect will end up depended on by someone. The goal is a small, predictable surface that can evolve without breaking users.

  Principles that hold up:

  - **Small surface, clear entry points.** Export only what users need, through named exports and a `package.json` `exports` map that hides internals. Anything reachable will be imported.
  - **Options objects over positional booleans.** `createClient({ retries: 3, timeoutMs: 5000 })` reads well and can grow. `connect(url, true, false)` is a boolean trap that can't be extended without breaking calls.
  - **Sensible, safe defaults**, with values validated early. Throw a clear `TypeError` at construction time rather than failing obscurely later. Unknown options should warn or throw, since typos are common.
  - **Consistent async behaviour.** A function should be always sync or always async, never "returns a value from cache, otherwise a promise". Accept an `AbortSignal` for anything long-running.
  - **Errors as API.** Use `Error` subclasses or a stable `code` property (`ERR_RATE_LIMITED`) that callers can match on, include `cause`, and never make users parse messages.
  - **No hidden global state or import-time side effects.** Factories (`createX()`) let users have several independent instances, which helps tests and tree-shaking.
  - **Types are part of the API.** Ship accurate TypeScript declarations, and type the public surface before implementing it.
  - **Tree-shakable, environment-aware builds.** Ship ESM (plus CJS if needed), avoid Node-only imports in code meant for browsers, and mark `sideEffects` correctly.

  Evolution: follow **semver** strictly, deprecate before removing (with a one-time `process.emitWarning` or console warning, and a migration note), and run the test suite against the built package (`npm pack`) to catch packaging mistakes. Design the API by writing the README examples first. If an example is awkward to write, the API is awkward to use.
codeExample: |
  class ClientError extends Error {
    constructor(code, message, options) { super(message, options); this.code = code; }
  }

  const DEFAULTS = Object.freeze({ baseUrl: 'https://api.example.com', retries: 2, timeoutMs: 5000 });

  export function createClient(options = {}) {
    const unknown = Object.keys(options).filter((k) => !(k in DEFAULTS));
    if (unknown.length) throw new TypeError(`Unknown option(s): ${unknown.join(', ')}`);
    const config = Object.freeze({ ...DEFAULTS, ...options });
    if (!Number.isInteger(config.retries) || config.retries < 0) {
      throw new TypeError('retries must be a non-negative integer');
    }

    return {
      config,
      async get(path, { signal } = {}) {          // always async, always cancellable
        signal?.throwIfAborted();
        if (!path.startsWith('/')) throw new ClientError('ERR_BAD_PATH', `Path must start with "/": ${path}`);
        return { url: config.baseUrl + path };
      },
    };
  }

  const client = createClient({ retries: 3 });
  console.log(client.config.retries, client.config.timeoutMs); // Output: 3 5000

  try { createClient({ retires: 3 }); } catch (e) { console.log(e.message); }
  // Output: Unknown option(s): retires

  client.get('users').catch((e) => console.log(e.code));       // Output: ERR_BAD_PATH
popularity: 7.0
isPublished: true
---
