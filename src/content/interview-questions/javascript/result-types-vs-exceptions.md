---
course: javascript
slug: result-types-vs-exceptions
experienceLevel: senior
difficulty: medium
tags:
  - error-handling
  - api-design
question: When should you use Result-style return values instead of throwing exceptions in JavaScript?
answer: |
  Exceptions and **Result values** (`{ ok: true, value }` or `{ ok: false, error }`) model different kinds of failure, and mature codebases use both deliberately.

  **Exceptions** fit failures the immediate caller can't handle: bugs, broken invariants, infrastructure outages, programmer errors. They unwind automatically to a boundary (an HTTP handler, a job runner) that logs and responds. The downside is that they're **invisible in signatures**. Nothing in JavaScript, or in TypeScript's types, tells you a function throws, and in TypeScript a `catch` variable is `unknown`.

  **Result values** fit **expected, recoverable** outcomes that are part of the domain: validation failures, "not found", "insufficient funds", a parse that may fail. Returning them forces the caller to handle both branches, and with TypeScript discriminated unions the compiler checks that. Errors become data you can aggregate, for example reporting all form errors instead of the first thrown one.

  Trade-offs:

  - Results add ceremony. Every caller must unwrap or propagate, and JavaScript has no `?` operator like Rust. Libraries such as `neverthrow` or Effect add chaining helpers.
  - Mixing the styles carelessly is worse than either alone. A function that returns a Result but can also throw gives a false sense of safety.
  - Async code already has a failure channel (rejected promises), so `Promise<Result>` should be reserved for domain outcomes.

  A practical rule: **throw for the unexpected, return for the expected**. Convert at boundaries. Wrap third-party code that throws into Results where the failure is part of your domain, and when you re-throw, keep the chain with `new Error(msg, { cause })`. Use `Error` subclasses with a stable `code` property so callers don't match on message text.
codeExample: |
  const ok = (value) => ({ ok: true, value });
  const err = (code, message) => ({ ok: false, error: { code, message } });

  // Expected failures are part of the return type
  function parseAge(input) {
    const n = Number(input);
    if (!Number.isInteger(n)) return err('NOT_INTEGER', `"${input}" is not a whole number`);
    if (n < 0 || n > 150) return err('OUT_OF_RANGE', `${n} is out of range`);
    return ok(n);
  }

  const results = ['42', 'abc', '200'].map(parseAge);
  for (const r of results) {
    console.log(r.ok ? `age ${r.value}` : `${r.error.code}: ${r.error.message}`);
  }
  // Output:
  // age 42
  // NOT_INTEGER: "abc" is not a whole number
  // OUT_OF_RANGE: 200 is out of range

  // Unexpected failures still throw, with the cause preserved
  function loadConfig(text) {
    try { return JSON.parse(text); }
    catch (cause) { throw new Error('Config file is corrupt', { cause }); }
  }
  try { loadConfig('{oops'); } catch (e) { console.log(e.message, '<-', e.cause.name); }
  // Output: Config file is corrupt <- SyntaxError
popularity: 7.2
isPublished: true
---
