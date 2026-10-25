---
publishDate: 2026-05-20T09:56
title: Jotai and Atomic State
slug: jotai-and-atomic-state
metadescription: Build state from small independent atoms that compose, so components re-render only for the exact values they read.
updateDate: 2026-09-05T09:56
author: ['bishal-biswas']
level: 3
tags: ['state', 'jotai']
course: react
---

## A different shape

Redux and Zustand both keep one big object and slice into it with selectors.

Jotai works the other way round. State is built from many **atoms**, each holding one small value, and larger values are composed from them.

```bash
npm install jotai
```

```javascript
import { atom, useAtom } from 'jotai';
const countAtom = atom(0);
function Counter() {
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

The API deliberately mirrors `useState`. The difference is that the atom lives outside any component, so anything can read it.

## Reading and writing separately

```javascript
import { useAtomValue, useSetAtom } from 'jotai';
function Display() {
  const count = useAtomValue(countAtom);
  return <p>{count}</p>;
}
function IncrementButton() {
  const setCount = useSetAtom(countAtom);
  return <button onClick={() => setCount((c) => c + 1)}>+</button>;
}
```

`useSetAtom` does **not** subscribe. `IncrementButton` never re-renders when the count changes, because it only writes. That is a genuine advantage over a single store with selectors.

## Derived atoms

This is where the model pays off.

```javascript
const itemsAtom = atom([]);
const filterAtom = atom('all');
const visibleItemsAtom = atom((get) => {
  const items = get(itemsAtom);
  const filter = get(filterAtom);
  if (filter === 'done') return items.filter((i) => i.done);
  if (filter === 'active') return items.filter((i) => !i.done);
  return items;
});
const remainingCountAtom = atom((get) =>
  get(itemsAtom).filter((i) => !i.done).length
);
```

An atom taking a `get` function is read only and computed. It recalculates only when the atoms it reads change, and components using it re-render only then.

There is no dependency array. Jotai tracks what you read.

```javascript
function ItemList() {
  const items = useAtomValue(visibleItemsAtom);
  return <ul>{items.map((i) => <li key={i.id}>{i.text}</li>)}</ul>;
}
function Counter() {
  const remaining = useAtomValue(remainingCountAtom);
  return <p>{remaining} remaining</p>;
}
```

Changing the filter re-renders `ItemList` but **not** `Counter`, because `remainingCountAtom` does not read the filter. That precision is automatic.

## Writable derived atoms

```javascript
const celsiusAtom = atom(0);
const fahrenheitAtom = atom(
  (get) => get(celsiusAtom) * 9 / 5 + 32,
  (get, set, newFahrenheit) => {
    set(celsiusAtom, (newFahrenheit - 32) * 5 / 9);
  }
);
function TemperatureInput() {
  const [fahrenheit, setFahrenheit] = useAtom(fahrenheitAtom);
  return (
    <input
      type="number"
      value={fahrenheit}
      onChange={(e) => setFahrenheit(Number(e.target.value))}
    />
  );
}
```

Two functions: how to read, and what to do when written. Both inputs stay in sync with one source of truth.

## Action atoms

An atom with `null` as its read value becomes a pure action.

```javascript
const addItemAtom = atom(null, (get, set, text) => {
  const items = get(itemsAtom);
  set(itemsAtom, [...items, { id: crypto.randomUUID(), text, done: false }]);
});
function AddButton() {
  const addItem = useSetAtom(addItemAtom);
  return <button onClick={() => addItem('New item')}>Add</button>;
}
```

The component writing it never re-renders, since there is nothing to read.

## Async atoms

```javascript
const userIdAtom = atom(1);
const userAtom = atom(async (get) => {
  const id = get(userIdAtom);
  const response = await fetch(`/api/users/${id}`);
  return response.json();
});
function UserName() {
  const user = useAtomValue(userAtom);
  return <h2>{user.name}</h2>;
}
function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <UserName />
    </Suspense>
  );
}
```

An async atom suspends, so Suspense handles the loading state. Change `userIdAtom` and it refetches automatically.

Note this has no cache invalidation, retries or background refetching. For serious server data, TanStack Query is still the answer.

## Scoping with Provider

By default atoms are global. A `Provider` gives a subtree its own independent values.

```javascript
import { Provider } from 'jotai';
function App() {
  return (
    <div>
      <Provider>
        <Editor />
      </Provider>
      <Provider>
        <Editor />
      </Provider>
    </div>
  );
}
```

Two editors, two completely separate sets of atom values, from the same atom definitions. Useful for multi instance widgets and for isolating tests.

## Utilities

```javascript
import { atomWithStorage } from 'jotai/utils';
const themeAtom = atomWithStorage('theme', 'light');
```

```javascript
import { splitAtom } from 'jotai/utils';
const itemAtomsAtom = splitAtom(itemsAtom);
```

`splitAtom` turns a list atom into an atom of atoms, so each row subscribes only to its own item. Editing one row re-renders one row, which matters in long lists.

## Jotai or the others?

**Jotai** when state is naturally lots of small independent values that derive from each other. Form fields, editor settings, filters and computed views fit well. The re-render precision is excellent and comes for free.

**Zustand** when you prefer one store with actions, and want the simplest possible model.

**Redux Toolkit** when you need DevTools time travel or a strict action log.

The atomic model takes a little adjustment if you are used to one big store, but derived state is much nicer than writing selectors.

## Quick recap

- State is many small atoms rather than one object.
- `useAtom` mirrors `useState`, with `useAtomValue` and `useSetAtom` splitting it.
- A write only component never re-renders.
- Derived atoms take `get` and track dependencies automatically.
- A second function makes a derived atom writable.
- Async atoms suspend, so Suspense handles loading.
- `Provider` scopes atoms to a subtree.
- `splitAtom` gives per row subscriptions in long lists.

<code id="code-content" class="language-javascript">
import { atom, useAtom, useAtomValue, useSetAtom, Provider } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
// Atoms are small independent values that live outside components
const itemsAtom = atom([]);
const filterAtom = atom('all');
const themeAtom = atomWithStorage('theme', 'light');
// DERIVED atoms take get, and Jotai tracks the dependencies itself.
// No dependency array to keep in sync.
const visibleItemsAtom = atom((get) =&gt; {
  const items = get(itemsAtom);
  const filter = get(filterAtom);
  if (filter === 'done') return items.filter((i) =&gt; i.done);
  if (filter === 'active') return items.filter((i) =&gt; !i.done);
  return items;
});
const remainingCountAtom = atom((get) =&gt;
  get(itemsAtom).filter((i) =&gt; !i.done).length
);
// An ACTION atom: null to read, a function to write
const addItemAtom = atom(null, (get, set, text) =&gt; {
  set(itemsAtom, [
    ...get(itemsAtom),
    { id: crypto.randomUUID(), text, done: false }
  ]);
});
// A WRITABLE derived atom keeps two views of one value in sync
const celsiusAtom = atom(0);
const fahrenheitAtom = atom(
  (get) =&gt; get(celsiusAtom) * 9 / 5 + 32,
  (get, set, next) =&gt; set(celsiusAtom, (next - 32) * 5 / 9)
);
function ItemList() {
  const items = useAtomValue(visibleItemsAtom);
  return &lt;ul&gt;{items.map((i) =&gt; &lt;li key={i.id}&gt;{i.text}&lt;/li&gt;)}&lt;/ul&gt;;
}
function RemainingCount() {
  // Changing the FILTER re-renders ItemList but NOT this, because
  // remainingCountAtom never reads filterAtom. That precision is free.
  const remaining = useAtomValue(remainingCountAtom);
  return &lt;p&gt;{remaining} remaining&lt;/p&gt;;
}
function AddButton() {
  // useSetAtom does NOT subscribe, so this never re-renders
  const addItem = useSetAtom(addItemAtom);
  return &lt;button onClick={() =&gt; addItem('New item')}&gt;Add&lt;/button&gt;;
}
// An ASYNC atom suspends, so Suspense handles the loading state
const userIdAtom = atom(1);
const userAtom = atom(async (get) =&gt; {
  const response = await fetch('/api/users/' + get(userIdAtom));
  return response.json();
});
export default function App() {
  return (
    &lt;div&gt;
      &lt;ItemList /&gt;
      &lt;RemainingCount /&gt;
      &lt;AddButton /&gt;
      {/* A Provider scopes atoms, so these two editors have completely
          separate values from the same atom definitions */}
      &lt;Provider&gt;&lt;Editor /&gt;&lt;/Provider&gt;
      &lt;Provider&gt;&lt;Editor /&gt;&lt;/Provider&gt;
    &lt;/div&gt;
  );
}
</code></pre>
