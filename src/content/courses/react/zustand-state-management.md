---
publishDate: 2026-05-19T09:55
title: Zustand
slug: zustand-state-management
metadescription: Global state in a few lines with no provider, no boilerplate, and re-renders only where the state is actually used.
updateDate: 2026-09-05T09:55
author: ['bishal-biswas']
level: 3
tags: ['state', 'zustand']
course: react
---

## The whole store

```bash
npm install zustand
```

```javascript
import { create } from 'zustand';
export const useCartStore = create((set) => ({
  items: [],
  addItem: (product) =>
    set((state) => ({ items: [...state.items, product] })),
  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  clear: () => set({ items: [] })
}));
```

That is the entire setup. No provider, no reducer, no action types, no context.

## Using it

```javascript
function Cart() {
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          {item.name}
          <button onClick={() => removeItem(item.id)}>Remove</button>
        </li>
      ))}
    </ul>
  );
}
```

The store is a hook. Call it with a selector and you get that value, plus a subscription to changes in it.

## No provider

```javascript
function App() {
  return <Shop />;
}
```

The store lives in a module, not in the React tree. Any component can use it from anywhere, including code outside React:

```javascript
useCartStore.getState().addItem(product);
useCartStore.subscribe((state) => console.log(state.items.length));
```

That is genuinely useful in event handlers, WebSocket callbacks and tests.

## Selectors matter

```javascript
const store = useCartStore();
const items = useCartStore((state) => state.items);
```

The first subscribes to **everything**, so any change anywhere re-renders. The second re-renders only when `items` changes.

Selecting several values needs care:

```javascript
const { items, total } = useCartStore((state) => ({
  items: state.items,
  total: state.total
}));
```

That builds a new object each time, so it always looks different. Two options:

```javascript
const items = useCartStore((state) => state.items);
const total = useCartStore((state) => state.total);
```

```javascript
import { useShallow } from 'zustand/react/shallow';
const { items, total } = useCartStore(
  useShallow((state) => ({ items: state.items, total: state.total }))
);
```

Separate selectors are usually clearer.

## Updates merge shallowly

```javascript
set({ items: [] });
set((state) => ({ items: [...state.items, item] }));
```

`set` merges at the top level, so you only pass what changes. Nested objects still need spreading:

```javascript
set((state) => ({
  user: { ...state.user, name: 'Asha' }
}));
```

For deep updates, add the Immer middleware and mutate:

```javascript
import { immer } from 'zustand/middleware/immer';
export const useStore = create(
  immer((set) => ({
    user: { profile: { name: '' } },
    setName: (name) =>
      set((state) => {
        state.user.profile.name = name;
      })
  }))
);
```

## Async is just async

No thunks, no middleware, no special API.

```javascript
export const useUserStore = create((set, get) => ({
  user: null,
  isLoading: false,
  error: null,
  fetchUser: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/users/${id}`);
      if (!response.ok) throw new Error('Failed');
      set({ user: await response.json(), isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  refresh: async () => {
    const current = get().user;
    if (current) await get().fetchUser(current.id);
  }
}));
```

`get()` reads the current state inside an action, which is how `refresh` reuses `fetchUser`.

## Persisting

```javascript
import { persist, createJSONStorage } from 'zustand/middleware';
export const useSettingsStore = create(
  persist(
    (set) => ({
      theme: 'light',
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' }))
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme })
    }
  )
);
```

`partialize` chooses what to save, so transient values are not written to storage.

For server rendering, note this causes a hydration mismatch, since the server has no localStorage. Gate on a mounted flag or use `skipHydration`.

## Slicing a big store

```javascript
const createCartSlice = (set) => ({
  items: [],
  addItem: (p) => set((state) => ({ items: [...state.items, p] }))
});
const createUserSlice = (set) => ({
  user: null,
  setUser: (user) => set({ user })
});
export const useStore = create((...args) => ({
  ...createCartSlice(...args),
  ...createUserSlice(...args)
}));
```

Keeps one store while splitting the code by feature.

## Zustand or the alternatives?

**Zustand** for global client state with minimal ceremony. Small, no provider, easy to learn in an afternoon.

**Context** when the value rarely changes and you want no dependency at all. Remember every consumer re-renders on a change, which Zustand's selectors avoid.

**Redux Toolkit** when you need DevTools time travel, a strict action log, or the team already uses it.

**TanStack Query** for server data. Do not put fetched data in Zustand and reimplement caching.

That last point is the one people get wrong. Zustand is for client state: the open modal, the theme, the cart before checkout, the wizard step.

## Quick recap

- A store is created with `create` and used as a hook.
- No provider, so it works anywhere including outside React.
- Always pass a selector, or you subscribe to the whole store.
- Selectors returning new objects need `useShallow` or splitting.
- `set` merges shallowly, and Immer middleware handles deep updates.
- Async actions are plain async functions, with `get()` for current state.
- `persist` saves to storage, with `partialize` choosing what.
- Use it for client state, not for server data.

<code id="code-content" class="language-javascript">
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
// The ENTIRE store. No provider, no reducer, no action types.
export const useCartStore = create((set, get) =&gt; ({
  items: [],
  isOpen: false,
  addItem: (product) =&gt;
    set((state) =&gt; ({ items: [...state.items, product] })),
  removeItem: (id) =&gt;
    set((state) =&gt; ({ items: state.items.filter((i) =&gt; i.id !== id) })),
  clear: () =&gt; set({ items: [] }),          // set merges shallowly
  // Async is just async. No thunks, no middleware.
  checkout: async () =&gt; {
    const items = get().items;              // get() reads current state
    await fetch('/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ items })
    });
    set({ items: [] });
  }
}));
function Cart() {
  // ALWAYS pass a selector. useCartStore() with no argument subscribes
  // to the whole store, so any change anywhere re-renders this.
  const items = useCartStore((state) =&gt; state.items);
  const removeItem = useCartStore((state) =&gt; state.removeItem);
  // Selecting several values: a plain object literal is new every time,
  // so it always looks changed. Use useShallow, or separate selectors.
  const { isOpen, clear } = useCartStore(
    useShallow((state) =&gt; ({ isOpen: state.isOpen, clear: state.clear }))
  );
  return (
    &lt;ul&gt;
      {items.map((item) =&gt; (
        &lt;li key={item.id}&gt;
          {item.name}
          &lt;button onClick={() =&gt; removeItem(item.id)}&gt;Remove&lt;/button&gt;
        &lt;/li&gt;
      ))}
    &lt;/ul&gt;
  );
}
// The store lives in a module, so it works OUTSIDE React too
// useCartStore.getState().addItem(product);
// useCartStore.subscribe((state) =&gt; console.log(state.items.length));
// persist saves to storage, and partialize picks what is worth saving
export const useSettingsStore = create(
  persist(
    (set) =&gt; ({
      theme: 'light',
      draft: '',                            // transient, not persisted
      toggleTheme: () =&gt;
        set((state) =&gt; ({ theme: state.theme === 'light' ? 'dark' : 'light' }))
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() =&gt; localStorage),
      partialize: (state) =&gt; ({ theme: state.theme })
    }
  )
);
// USE IT FOR CLIENT STATE: the open modal, the theme, the cart, the
// wizard step. For server data use TanStack Query, rather than
// reimplementing caching and revalidation in a store.
</code></pre>
