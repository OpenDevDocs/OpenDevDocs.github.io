---
course: javascript
slug: common-design-patterns
experienceLevel: mid
difficulty: medium
tags:
  - design-patterns
  - architecture
question: Which design patterns are commonly used in JavaScript, such as module, observer, factory and singleton?
answer: |
  The patterns you meet most in JavaScript are the **module** pattern for encapsulation, the **observer** (publish/subscribe) pattern for events, the **factory** pattern for creating objects without exposing construction details, and the **singleton** for a single shared instance; JavaScript's closures, first-class functions and ES modules make most of them lighter than in class-based languages.

  - **Module**: hide private state and expose a small public API. Historically done with an IIFE returning an object (closures keep the private variables). Today every ES module file is a module in this sense: anything not exported stays private.
  - **Observer / pub-sub**: subjects keep a list of listeners and notify them on change. It is everywhere: DOM `addEventListener`, Node.js `EventEmitter`, `EventTarget`, RxJS observables, and store subscriptions in Redux or Zustand. Always return or provide an **unsubscribe** function, or listeners leak.
  - **Factory**: a function that decides which object to create based on input or configuration (`createLogger('console')`). In JavaScript a plain function returning an object literal is often enough, and it avoids `new` and `this` issues.
  - **Singleton**: one instance shared by the whole app, such as a configuration object, a database pool or an API client. ES modules are evaluated once and cached, so exporting an instance (`export const db = new Pool()`) is already a singleton.

  Others worth recognising: **strategy** (pass different functions to vary behaviour, such as sort comparators), **decorator** (wrap a function to add logging, caching or retries), **proxy** (the built-in `Proxy`, used by Vue's reactivity) and **middleware** (Express and Koa).

  Pitfalls:

  1. Singletons are global state in disguise: they make testing harder because state leaks between tests. Prefer passing dependencies in, or provide a reset hook for tests.
  2. Do not port Java-style patterns verbatim. A function often replaces a whole class hierarchy.
  3. Use a pattern because it solves a real problem in your code, not to show it off.
codeExample: |
  // Module pattern: private state through a closure
  const counter = (() => {
    let count = 0;                                   // not reachable from outside
    return { increment: () => ++count, get value() { return count; } }; })();
  counter.increment();
  console.log(counter.value, counter.count);         // Output: 1 undefined

  // Observer: subscribe, notify, unsubscribe
  class EventBus {
    #listeners = new Map();
    on(event, fn) {
      if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
      this.#listeners.get(event).add(fn);
      return () => this.#listeners.get(event).delete(fn);
    }
    emit(event, data) { this.#listeners.get(event)?.forEach((fn) => fn(data)); }
  }
  const bus = new EventBus();
  const off = bus.on('order', (o) => console.log('email for order', o.id));
  bus.emit('order', { id: 1 });                      // Output: email for order 1
  off(); bus.emit('order', { id: 2 });               // (nothing logged after unsubscribing)

  // Factory: choose the implementation from input
  function createNotifier(type) {
    const senders = { email: (to) => `email -> ${to}`, sms: (to) => `sms -> ${to}` };
    if (!senders[type]) throw new Error(`Unknown notifier: ${type}`);
    return { type, send: senders[type] };
  }
  console.log(createNotifier('sms').send('+15550100')); // Output: sms -> +15550100
  // Singleton: one lazily created shared instance
  class Config {
    static #instance;
    static get instance() { return (Config.#instance ??= new Config()); }
    theme = 'dark'; }
  console.log(Config.instance === Config.instance, Config.instance.theme); // Output: true dark
popularity: 7.9
isPublished: true
---
