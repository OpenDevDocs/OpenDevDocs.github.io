---
course: javascript
slug: debounce-vs-throttle
experienceLevel: mid
difficulty: medium
tags:
  - performance
  - functions
  - closures
question: What is the difference between debounce and throttle, and how would you implement them?
answer: |
  Both limit how often a function runs in response to rapid events: **debounce** waits until the events have **stopped** for a given delay and then runs once, while **throttle** runs at most once per interval **while** the events keep coming.

  When to use each:

  - **Debounce**: search-as-you-type (call the API after the user pauses), validating a field after typing stops, saving a draft, recalculating layout after a window resize ends.
  - **Throttle**: scroll position tracking, infinite-scroll checks, mousemove or drag handlers, rate-limiting a button that fires analytics. You want regular updates during the activity, not just one at the end.

  How they work:

  - Debounce keeps a timer in a closure. Every call clears the previous timer and starts a new one, so the function only fires once the calls have been quiet for `delay` ms.
  - Throttle remembers when it last ran (or whether a timer is pending) and ignores or postpones calls inside the interval.

  Details interviewers like to probe:

  1. **Leading vs trailing** edge. Debounce normally fires on the trailing edge; a leading option fires immediately and then ignores the burst. A good throttle usually fires on the leading edge and also once on the trailing edge, so the last value is not lost.
  2. **Arguments and `this`**: forward them with `fn.apply(this, args)` and use a regular function for the wrapper so `this` is preserved.
  3. **Cancel and flush** methods are useful when a component unmounts or a form submits before the debounce fires.
  4. Create the debounced function **once** (outside a render function or with `useMemo`/`useRef` in React); creating it on every call defeats the purpose.

  For visual updates tied to scrolling, `requestAnimationFrame` is often a better throttle than a fixed interval. Libraries such as Lodash provide well-tested versions with all these options.
codeExample: |
  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function throttle(fn, interval, now = Date.now) {
    let last = -Infinity;
    return function (...args) {
      if (now() - last >= interval) {
        last = now();
        fn.apply(this, args);
      }
    };
  }

  // Debounce: four keystrokes 10 ms apart, only the last one triggers a search
  const search = debounce((q) => console.log('debounced search:', q), 50);
  ['j', 'ja', 'jav', 'java'].forEach((q, i) => setTimeout(() => search(q), i * 10));

  // Throttle: a fake clock makes the timing deterministic
  let clock = 0;
  const track = throttle((t) => console.log('throttled scroll at', t), 100, () => clock);
  for (clock = 0; clock <= 250; clock += 20) track(clock); // event every 20 ms

  // Output:
  // throttled scroll at 0
  // throttled scroll at 100
  // throttled scroll at 200
  // debounced search: java
popularity: 8.9
isPublished: true
---
