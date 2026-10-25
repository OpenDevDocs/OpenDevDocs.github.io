---
course: javascript
slug: structural-sharing-and-immutability-at-scale
experienceLevel: senior
difficulty: hard
tags:
  - immutability
  - performance
  - state-management
question: What is structural sharing, and how do you keep immutable state updates fast at scale?
answer: |
  Immutable updates never modify existing objects; they create new ones. Copying a whole state tree on every change would be far too slow, so the trick is **structural sharing**: copy only the objects on the **path** from the root to the changed value, and reuse every other branch by reference.

  Updating `state.users[3].name` therefore creates a new root, a new `users` array, and a new user 3. The other users, and everything outside `users`, are the same objects as before. The cost is proportional to the **depth** of the change and the width of each copied node, not the size of the state.

  The payoff is cheap change detection. If `prev.settings === next.settings`, nothing inside changed. React's `memo`, Redux selectors, `useSyncExternalStore` and Angular's `OnPush` all rely on that reference equality.

  Where it goes wrong at scale:

  - **Wide nodes.** Spreading an array of 50,000 items on every keystroke is O(n) per update. Normalise state (entities by ID in an object or `Map`) or use persistent data structures (Immutable.js, or HAMT-based libraries) with O(log n) updates.
  - **Accidental new references.** Selectors that return `items.filter(...)` produce a new array on every call and defeat memoisation. Memoise derived data.
  - **Deep clones.** `structuredClone` or `JSON.parse(JSON.stringify(...))` throw sharing away and break equality checks downstream.
  - **`Object.freeze` everywhere.** `Object.freeze` is shallow, so deep freezing means walking the tree, which costs time. Many teams deep-freeze only in development to catch mutations. Immer freezes the objects it produces by default, and this can be turned off.

  **Immer** gives you mutation-style syntax on a draft and produces a structurally shared result, which is the pragmatic default for complex reducers. ES2023's `toSorted`, `toSpliced` and `with` help for arrays. For diagnosis, profile renders and check which props changed identity without changing value.
codeExample: |
  // Copy only the path to the change; share everything else
  function setIn(obj, [key, ...rest], value) {
    const copy = Array.isArray(obj) ? [...obj] : { ...obj };
    copy[key] = rest.length ? setIn(obj[key], rest, value) : value;
    return copy;
  }

  const state = {
    settings: { theme: 'dark' },
    users: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Linus' }],
  };

  const next = setIn(state, ['users', 1, 'name'], 'Grace');

  console.log(next !== state);                         // Output: true
  console.log(next.settings === state.settings);       // Output: true  (shared)
  console.log(next.users === state.users);             // Output: false (on the path)
  console.log(next.users[0] === state.users[0]);       // Output: true  (shared)
  console.log(next.users[1].name, state.users[1].name); // Output: Grace Linus

  // Deep cloning throws sharing away, so every memo check sees a "change"
  const cloned = structuredClone(state);
  console.log(cloned.settings === state.settings);     // Output: false

  // ES2023 non-mutating array helpers
  const sorted = state.users.toSorted((a, b) => b.id - a.id);
  console.log(sorted[0].name, state.users[0].name);    // Output: Linus Ada
popularity: 7.1
isPublished: true
---
