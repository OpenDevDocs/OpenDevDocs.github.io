---
publishDate: 2026-10-23T23:00
title: Saving Data on the Phone with AsyncStorage
slug: async-storage
metadescription: 'Save and load data on the phone with AsyncStorage so HabitHop remembers your habits after the app closes, with JSON, keys and a loading flag.'
updateDate: 2026-10-23T23:00
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'asyncstorage', 'storage', 'context']
course: react-native
---

## The problem: habits disappear

Try this with HabitHop right now. Add a habit called "Drink water", mark it done, then fully close the app (swipe it away in the app switcher) and open it again. The habit is gone.

That happens because your habits live in React state inside `HabitsProvider`. You built it in [Sharing State with Context](/courses/react-native/context-for-shared-state) and moved its changes into `habitsReducer` in [useReducer and Custom Hooks](/courses/react-native/usereducer-and-custom-hooks). State lives in memory. When the app closes, memory is cleared.

To keep data, you must write it to the phone's **storage** (the disk). The simplest tool for that is **AsyncStorage**: a small key-value store. A **key-value store** works like a dictionary: you save a value under a name (the key), and later you read it back by that name. In this lesson you will:

- learn the AsyncStorage basics,
- write `src/lib/storage.ts` with `loadHabits` and `saveHabits`,
- teach `habitsReducer` one new action and connect storage to `HabitsProvider`, so habits survive restarts.

If you know `localStorage` from the browser ([JSON and Local Storage](/courses/javascript/json-and-local-storage)), AsyncStorage will feel very familiar. The big difference is in the name: every call is **async** and returns a promise.

## Install it

```bash
npx expo install @react-native-async-storage/async-storage
```

Always use `npx expo install` (not plain `npm install`) for packages with native code. It picks the version that matches your Expo SDK. AsyncStorage is included in Expo Go, so you do not need a development build.

## The basic API

AsyncStorage only stores **strings**. The four calls you will use most:

```ts
// a quick tour (not a file in HabitHop)
import AsyncStorage from '@react-native-async-storage/async-storage';

await AsyncStorage.setItem('habithop.hasSeenWelcome', 'true'); // save
const value = await AsyncStorage.getItem('habithop.hasSeenWelcome'); // 'true' or null
await AsyncStorage.removeItem('habithop.hasSeenWelcome'); // delete one key
const keys = await AsyncStorage.getAllKeys(); // list every key
```

A few rules worth remembering:

- `getItem` returns `null` when nothing is saved under that key. Always handle `null`, because on the very first launch nothing is saved yet.
- Both keys and values must be strings. Saving a number or an object directly is a mistake (more on that below).
- There is also `AsyncStorage.clear()`, which deletes **everything** your app saved. Handy while testing, dangerous in real code.

A good habit is to **prefix** your keys with the app name, like `habithop.`, so they never clash with keys saved by a library.

## Storing objects with JSON

Your habits are an array of objects, not a string. The fix is **JSON**: turn the array into a string with `JSON.stringify` before saving, and back into an array with `JSON.parse` after loading.

```ts
// how it looks on disk
const habits = [{ id: 'h1', name: 'Drink water', emoji: '💧', doneDates: ['2026-10-23'] }];
const json = JSON.stringify(habits);
// '[{"id":"h1","name":"Drink water","emoji":"💧","doneDates":["2026-10-23"]}]'
const back = JSON.parse(json); // an array again
```

This is why the `Habit` type stores dates as strings (`createdAt` is an ISO string and `doneDates` holds `'YYYY-MM-DD'` strings). A JavaScript `Date` object would turn into a string in JSON anyway, and would **not** turn back into a `Date` when you parse it. Plain strings avoid that surprise.

## Write the storage helpers

Keep all storage code in one file, so the rest of the app never touches AsyncStorage directly. If you later move to SQLite (you will, in [A Real Database on the Phone with SQLite](/courses/react-native/sqlite-database)), only this file changes.

```ts
// src/lib/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Habit } from '@/types/habit';

const HABITS_KEY = 'habithop.habits.v1';

// Returns null when nothing has been saved yet (the very first launch)
export async function loadHabits(): Promise<Habit[] | null> {
  try {
    const json = await AsyncStorage.getItem(HABITS_KEY);
    return json ? (JSON.parse(json) as Habit[]) : null;
  } catch (error) {
    console.warn('Could not load habits', error);
    return null;
  }
}

export async function saveHabits(habits: Habit[]): Promise<void> {
  try {
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  } catch (error) {
    console.warn('Could not save habits', error);
  }
}

export async function clearHabits(): Promise<void> {
  await AsyncStorage.removeItem(HABITS_KEY);
}
```

Some details:

- **`.v1` in the key.** If you ever change the shape of `Habit` in a way old data cannot handle, you can switch to `habithop.habits.v2` and convert the old data once. A version number in the key makes that easy.
- **`null` means "nothing saved yet".** An empty array `[]` is a real answer: the user deleted all their habits. `null` is different: this is the first launch. Keeping the two apart lets the provider show the starter habits only to brand new users.
- **`try`/`catch`.** Reading can fail (for example, the JSON was damaged). Returning `null` is safer than crashing on launch.
- **`as Habit[]`.** Like with API data in [Fetching Data from an API](/courses/react-native/fetching-data), `JSON.parse` returns `any` and the type is a promise you make. It is your own data, so this is usually fine.

## A new action: loaded

Your provider already changes habits only through actions: `'added'`, `'toggled_today'` and `'deleted'`. Loading saved data is just one more change to the list, so it gets its own action. Add it to the `HabitsAction` type and to the reducer:

```tsx
// src/context/HabitsContext.tsx (reducer part)
export type HabitsAction =
  | { type: 'loaded'; habits: Habit[] } // new: replace the list with saved data
  | { type: 'added'; habit: Habit }
  | { type: 'toggled_today'; id: string }
  | { type: 'deleted'; id: string };

export function habitsReducer(habits: Habit[], action: HabitsAction): Habit[] {
  switch (action.type) {
    case 'loaded':
      return action.habits;
    // ...'added', 'toggled_today' and 'deleted' stay exactly the same
  }
}
```

`'loaded'` throws away the current list and uses the one from storage. Because the reducer is still a plain function, you can test this new case just like the others (see [Testing with Jest and React Native Testing Library](/courses/react-native/testing)).

## Connect storage to HabitsProvider

The provider needs two new behaviors:

1. **Load** the saved habits once, when the app starts.
2. **Save** the habits every time they change.

The reducer now starts with an empty list instead of `starterHabits`, because the real starting list comes from storage. Next to it, add an `isLoaded` flag with `useState`. It is not part of the habit list, so it does not belong in the reducer.

```tsx
// src/context/HabitsContext.tsx (loading part)
const [habits, dispatch] = useReducer(habitsReducer, []);
const [isLoaded, setIsLoaded] = useState(false);

useEffect(() => {
  let active = true;
  loadHabits().then((saved) => {
    if (!active) return;
    dispatch({ type: 'loaded', habits: saved ?? starterHabits });
    setIsLoaded(true);
  });
  return () => { active = false; };
}, []);
```

Some details:

- `saved ?? starterHabits` uses the **nullish coalescing** operator `??`: "use `saved`, unless it is `null` or `undefined`, then use `starterHabits`". So a brand new user still sees the two example habits from earlier lessons, while a user who deleted everything gets their empty list back.
- The `active` flag is a small safety net. If the provider unmounts before loading finishes, the cleanup sets `active` to `false` and we skip updating state on something that no longer exists.

Now the saving part:

```tsx
// src/context/HabitsContext.tsx (saving part)
useEffect(() => {
  if (isLoaded) saveHabits(habits);
}, [habits, isLoaded]);
```

This effect runs after every change to `habits`, whichever action caused it. The `isLoaded` check is the most important line in this lesson. Think about what happens without it:

```text
1. App starts. habits = [] (the empty starting state)
2. The save effect runs and saves [] to disk     <- your real habits are overwritten!
3. loadHabits() finishes and reads... []          <- they are gone forever
```

With the check, nothing is saved until the real data has been loaded. Then every change after that (adding, ticking, deleting) is saved automatically.

The rest of the provider barely changes. `addHabit`, `toggleToday` and `deleteHabit` still just dispatch actions and know nothing about storage. The context value gains `isLoaded`, so screens can tell "still loading" apart from "no habits":

```tsx
// src/context/HabitsContext.tsx (value part)
const value: HabitsContextValue = {
  habits,
  isLoaded,
  addHabit: (input) =>
    dispatch({ type: 'added', habit: { ...input, id: Date.now().toString(), createdAt: new Date().toISOString(), doneDates: [] } }),
  toggleToday: (id) => dispatch({ type: 'toggled_today', id }),
  deleteHabit: (id) => dispatch({ type: 'deleted', id }),
};
```

Remember to add `isLoaded: boolean` to the `HabitsContextValue` type as well. The full provider is in the code panel. It also has one more action, `'photo_set'`, with a `setHabitPhoto` function, which you will use in [Taking Photos with the Camera](/courses/react-native/camera).

## Do not flash the empty state

On launch, `habits` is `[]` for a short moment while loading. If the Today screen shows `EmptyState` whenever the list is empty, users see "No habits yet!" blink before their habits appear. Use `isLoaded` to show a spinner instead:

```tsx
// src/app/(tabs)/index.tsx (part)
const { habits, isLoaded } = useHabits();

if (!isLoaded) {
  return <ActivityIndicator style={{ flex: 1 }} color="#7C5CFC" />;
}

if (habits.length === 0) {
  return <EmptyState />;
}
```

In practice, loading takes a few milliseconds, so most people will never see the spinner. Another option is to keep the splash screen visible until `isLoaded` is true, using `expo-splash-screen`, which the [app config lesson](/courses/react-native/app-config-icons-and-splash) covers.

## Try it

1. Add two habits: "Drink water" 💧 and "Read 10 pages" 📚.
2. Tick "Drink water" as done.
3. Close the app completely and reopen it.

**What you will see:** both habits are still there, and "Drink water" is still ticked with its streak. 🎉 Now delete every habit and restart: the list stays empty. The starter habits only appear on the very first launch.

To start fresh while testing, call `clearHabits()` from a temporary button in Settings, or uninstall the app (that deletes its storage too).

## What AsyncStorage is good for (and what it is not)

AsyncStorage is perfect for small things: settings, flags like "has seen the welcome screen", a cached copy of small data, or a simple list like HabitHop's habits.

It is **not** good for:

- **Secrets.** AsyncStorage is **not encrypted**. Anyone with access to the device files (for example on a rooted phone, or through a backup) can read it. Tokens and passwords belong in [SecureStore](/courses/react-native/secure-store).
- **Big data.** On Android the whole store is limited to about 6 MB by default, and very large single values can fail to load. Reading and writing also means parsing the entire JSON string every time.
- **Searching and sorting lots of records.** You must load everything to find one item. A real database like SQLite can do this much better.

For HabitHop's few dozen habits, AsyncStorage is a great fit. When the history grows to thousands of check-ins, SQLite becomes the better choice.

## Common mistakes

**Saving a non-string.** `AsyncStorage.setItem('count', 5)` is a type error in TypeScript, and with objects you may end up saving `"[object Object]"`. Always `JSON.stringify` objects and `String()` numbers.

**Forgetting `await`.** `const json = AsyncStorage.getItem(KEY)` gives you a `Promise`, not the string. `JSON.parse` on a promise throws an error like:

```text
SyntaxError: JSON Parse error: Unexpected character: o
```

TypeScript usually warns you first (a `Promise` is not a `string`), so read those red squiggles. Always `await` (or `.then`) AsyncStorage calls.

**Overwriting data on startup.** Saving in an effect without the `isLoaded` check writes the empty starting array over the real data before it has been loaded. The symptom: "my habits are saved, but they vanish after the second restart". Guard your save effect.

**Expecting it on web to be shared.** On the web, AsyncStorage uses the browser's `localStorage`, so data is per browser and per site. That is fine, just do not be surprised that the web and phone versions have different habits.

## Quick recap

- AsyncStorage is a simple, async key-value store for small data. Install it with `npx expo install @react-native-async-storage/async-storage`. It works in Expo Go.
- It only stores strings: use `JSON.stringify` to save objects and `JSON.parse` to load them. Handle `null` for "nothing saved yet".
- Keep storage code in `src/lib/storage.ts` with `loadHabits` and `saveHabits`, and prefix and version your keys.
- Add a `'loaded'` action to `habitsReducer`. In `HabitsProvider`, load once in an effect (falling back to `starterHabits` when `loadHabits()` returns `null`), then save in a second effect, but only after `isLoaded` is `true`.
- AsyncStorage is not encrypted and not for big data. Use SecureStore for secrets and SQLite for large or searchable data.

<code id="code-content" class="language-tsx">
// src/context/HabitsContext.tsx
import { createContext, use, useEffect, useReducer, useState, type ReactNode } from 'react';
import { todayKey } from '@/lib/dates';
import { loadHabits, saveHabits } from '@/lib/storage';
import type { Habit } from '@/types/habit';
export type HabitsAction =
  | { type: 'loaded'; habits: Habit[] } // new: replace the list with saved data
  | { type: 'added'; habit: Habit }
  | { type: 'toggled_today'; id: string }
  | { type: 'deleted'; id: string }
  | { type: 'photo_set'; id: string; photoUri: string }; // used by the camera lesson
export function habitsReducer(habits: Habit[], action: HabitsAction): Habit[] {
  switch (action.type) {
    case 'loaded':
      return action.habits;
    case 'added':
      return [...habits, action.habit];
    case 'toggled_today': {
      const today = todayKey();
      return habits.map((h) =&gt; {
        if (h.id !== action.id) return h;
        const done = h.doneDates.includes(today);
        return { ...h, doneDates: done ? h.doneDates.filter((d) =&gt; d !== today) : [...h.doneDates, today] };
      });
    }
    case 'deleted':
      return habits.filter((h) =&gt; h.id !== action.id);
    case 'photo_set':
      return habits.map((h) =&gt; (h.id === action.id ? { ...h, photoUri: action.photoUri } : h));
    default:
      return habits;
  }
}
type NewHabit = Pick&lt;Habit, 'name' | 'emoji' | 'color'&gt;;
type HabitsContextValue = {
  habits: Habit[];
  isLoaded: boolean;
  addHabit: (input: NewHabit) =&gt; void;
  toggleToday: (id: string) =&gt; void;
  deleteHabit: (id: string) =&gt; void;
  setHabitPhoto: (id: string, photoUri: string) =&gt; void;
};
const HabitsContext = createContext&lt;HabitsContextValue | null&gt;(null);
const starterHabits: Habit[] = [
  { id: 'h1', name: 'Drink water', emoji: '💧', color: '#0EA5E9', createdAt: '2026-10-01T08:00:00.000Z', doneDates: [] },
  { id: 'h2', name: 'Read 10 pages', emoji: '📚', color: '#7C5CFC', createdAt: '2026-10-01T08:00:00.000Z', doneDates: [] },
];
export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, dispatch] = useReducer(habitsReducer, []);
  const [isLoaded, setIsLoaded] = useState(false);
  // 1. Load once when the app starts (starter habits on the very first launch)
  useEffect(() =&gt; {
    let active = true;
    loadHabits().then((saved) =&gt; {
      if (!active) return;
      dispatch({ type: 'loaded', habits: saved ?? starterHabits });
      setIsLoaded(true);
    });
    return () =&gt; { active = false; };
  }, []);
  // 2. Save after every change, but never before loading has finished
  useEffect(() =&gt; {
    if (isLoaded) saveHabits(habits);
  }, [habits, isLoaded]);
  const value: HabitsContextValue = {
    habits,
    isLoaded,
    addHabit: (input) =&gt;
      dispatch({ type: 'added', habit: { ...input, id: Date.now().toString(), createdAt: new Date().toISOString(), doneDates: [] } }),
    toggleToday: (id) =&gt; dispatch({ type: 'toggled_today', id }),
    deleteHabit: (id) =&gt; dispatch({ type: 'deleted', id }),
    setHabitPhoto: (id, photoUri) =&gt; dispatch({ type: 'photo_set', id, photoUri }),
  };
  return &lt;HabitsContext value={value}&gt;{children}&lt;/HabitsContext&gt;;
}
export function useHabits() {
  const ctx = use(HabitsContext);
  if (!ctx) throw new Error('useHabits must be used inside &lt;HabitsProvider&gt;');
  return ctx;
}
</code></pre>
