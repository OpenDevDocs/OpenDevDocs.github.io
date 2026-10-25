---
course: javascript
slug: implementing-an-event-emitter
experienceLevel: senior
difficulty: medium
tags:
  - design-patterns
  - events
question: How would you implement an event emitter, and which edge cases matter?
answer: |
  The core is a `Map` from event name to a list of listeners, with `on`, `off`, `once` and `emit`. The interesting part of the question is the edge cases a production implementation handles:

  - **Mutation during emit.** A listener may remove itself or add new listeners while `emit` is iterating. Iterate over a **copy** of the listener array, so the current emit sees a stable snapshot. Node's `EventEmitter` does the same.
  - **`once` and `off`.** `once` wraps the listener. `off(name, original)` must still remove it, so store a reference to the original on the wrapper and compare against both.
  - **Errors in listeners.** Decide whether one throwing listener stops the others. Node's emitter lets the exception propagate synchronously out of `emit`. Many UI buses catch, report and continue instead. Emitting `'error'` with no listener throws in Node, which is a deliberate fail-loud choice.
  - **Synchronous delivery.** `emit` runs listeners synchronously, in registration order. If you want async delivery, make it explicit with `queueMicrotask`, because mixing the two makes ordering unpredictable.
  - **Leaks.** Return an unsubscribe function from `on`, accept an `AbortSignal`, and consider a max-listeners warning like Node's to catch forgotten subscriptions.
  - **Duplicate listeners.** Decide whether adding the same function twice registers it twice (Node: yes; DOM `addEventListener`: no).

  In practice, prefer the built-ins: `node:events` in Node, or `EventTarget` in browsers and Node, before writing your own. A custom emitter is justified for typed events, a small dependency-free library, or specific error semantics.
codeExample: |
  class Emitter {
    #listeners = new Map();

    on(event, fn) {
      if (!this.#listeners.has(event)) this.#listeners.set(event, []);
      this.#listeners.get(event).push(fn);
      return () => this.off(event, fn);           // unsubscribe handle
    }
    once(event, fn) {
      const wrapper = (...args) => { this.off(event, wrapper); fn(...args); };
      wrapper.original = fn;
      return this.on(event, wrapper);
    }
    off(event, fn) {
      const list = this.#listeners.get(event) ?? [];
      const i = list.findIndex((l) => l === fn || l.original === fn);
      if (i !== -1) list.splice(i, 1);
    }
    emit(event, ...args) {
      const list = [...(this.#listeners.get(event) ?? [])]; // snapshot
      for (const fn of list) fn(...args);
      return list.length > 0;
    }
  }

  const bus = new Emitter();
  const stop = bus.on('save', (id) => console.log('audit', id));
  bus.once('save', (id) => console.log('first save', id));
  bus.emit('save', 1);
  bus.emit('save', 2);
  stop();
  console.log(bus.emit('save', 3));
  // Output:
  // audit 1
  // first save 1
  // audit 2
  // false
popularity: 7.4
isPublished: true
---
