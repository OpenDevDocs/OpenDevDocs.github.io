---
course: javascript
slug: retry-with-exponential-backoff
experienceLevel: senior
difficulty: medium
tags:
  - async
  - resilience
  - networking
question: How would you implement retries with exponential backoff and jitter, and what are the pitfalls?
answer: |
  Retrying helps with **transient** failures: timeouts, connection resets, HTTP 429, 502, 503 and 504. Done naively, though, retries turn a struggling dependency into a dead one, because every client hammers it in lockstep.

  The standard pattern:

  - **Exponential backoff**: wait `base * 2^attempt`, capped at a maximum delay, so pressure drops quickly.
  - **Jitter**: randomise the delay. "Full jitter" picks a random value between 0 and the capped exponential delay. Without jitter, clients that failed together retry together, causing synchronised spikes.
  - **Bounded attempts and a total deadline**: three to five attempts or an overall time budget, whichever comes first.
  - **Respect server hints**: honour `Retry-After` on 429 and 503 responses.

  Pitfalls seen in production:

  - **Retrying non-idempotent operations.** Retrying a `POST /payments` after a timeout can charge twice. Only retry operations that are idempotent, or send an **idempotency key** the server deduplicates on.
  - **Retrying permanent errors.** A 400, 401 or 404 won't fix itself. Classify errors and fail fast.
  - **Retry amplification.** If each of three layers retries three times, one user request becomes 27 calls to the bottom service. Retry at one layer, usually the edge closest to the caller.
  - **Ignoring cancellation.** The backoff wait should stop when the caller's `AbortSignal` fires.

  Pair retries with a **circuit breaker** or a retry budget (for example, retries may be at most 10% of traffic), and emit a metric for every retry so a rising retry rate is visible before it becomes an outage.
codeExample: |
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const isTransient = (err) => [429, 502, 503, 504].includes(err.status);

  async function retry(fn, { attempts = 4, baseMs = 20, maxMs = 1000,
                             random = Math.random } = {}) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn(attempt);
      } catch (err) {
        if (!isTransient(err) || attempt === attempts - 1) throw err;
        const cap = Math.min(maxMs, baseMs * 2 ** attempt);
        const delay = Math.round(random() * cap);        // full jitter
        console.log(`attempt ${attempt} failed (${err.status}), waiting ${delay} ms`);
        await sleep(delay);
      }
    }
  }

  let calls = 0;
  const flaky = async () => {
    if (++calls < 3) throw Object.assign(new Error('busy'), { status: 503 });
    return 'ok';
  };

  retry(flaky, { random: () => 0.5 })    // fixed "random" so the output is stable
    .then((result) => console.log(result, 'after', calls, 'calls'));
  // Output:
  // attempt 0 failed (503), waiting 10 ms
  // attempt 1 failed (503), waiting 20 ms
  // ok after 3 calls
popularity: 8.2
isPublished: true
---
