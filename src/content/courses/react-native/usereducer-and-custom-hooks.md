---
publishDate: 2026-10-23T03:30
title: useReducer and Custom Hooks
slug: usereducer-and-custom-hooks
metadescription: 'Move HabitHop state logic into a reducer with useReducer, then wrap repeated screen logic in small custom hooks like useHabit and useTodayProgress.'
updateDate: 2026-10-23T03:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'react', 'hooks', 'state']
course: react-native
---

## Why HabitHop needs a better home for its logic

In [Sharing State with Context](/courses/react-native/context-for-shared-state) you built `HabitsProvider`, a component that holds every habit and shares it with all screens through `useHabits()`. It works. But look at what lives inside it: three functions (`addHabit`, `toggleToday`, `deleteHabit`), each calling `setHabits` with its own little piece of list logic. As HabitHop grows (editing a habit, archiving, loading from storage), that provider turns into a long, tangled file.

This lesson fixes that with two tools:

- **`useReducer`**: a React hook that keeps all the "how does the state change?" rules in one plain function.
- **Custom hooks**: your own functions that start with `use` and bundle hooks together, so screens stay short.

Nothing here is mobile specific. These are normal React tools, and they work the same in React Native. If you want the web version too, see [useReducer in the React course](/courses/react/usereducer-hook) and [Custom Hooks](/courses/react/custom-hooks).

## A quick look at the "before" code

Here is the shape of the `useState` version from the context lesson, shortened:

```tsx
// src/context/HabitsContext.tsx (before)
const [habits, setHabits] = useState<Habit[]>(starterHabits);

function toggleToday(id: string) {
  const today = todayKey();
  setHabits((prev) =>
    prev.map((h) => {
      if (h.id !== id) return h;
      const done = h.doneDates.includes(today);
      return {
        ...h,
        doneDates: done ? h.doneDates.filter((d) => d !== today) : [...h.doneDates, today],
      };
    }),
  );
}
```

The logic is fine. The problem is *where* it lives: inside a component, mixed with JSX and context code. You cannot test it without rendering a component, and every new feature adds another `setHabits` call somewhere.

## What a reducer is

A **reducer** is a plain function that takes two things and returns one:

1. The **current state** (for HabitHop, the list of habits).
2. An **action**: a small object that describes *what happened*, like `{ type: 'deleted', id: 'h2' }`.

It returns the **next state**. It does not change the old state, it builds a new one. It also does nothing else: no network calls, no timers, no saving to disk. A function like this, where the same inputs always give the same output, is called a **pure function**.

Start with a tiny example so the idea is clear:

```tsx
// a counter reducer
type CounterAction = { type: 'increment' } | { type: 'reset' };

function counterReducer(count: number, action: CounterAction): number {
  switch (action.type) {
    case 'increment':
      return count + 1;
    case 'reset':
      return 0;
  }
}
```

And here is how a component uses it:

```tsx
import { useReducer } from 'react';
import { Button, Text, View } from 'react-native';

export function Counter() {
  const [count, dispatch] = useReducer(counterReducer, 0);

  return (
    <View>
      <Text>{count}</Text>
      <Button title="+1" onPress={() => dispatch({ type: 'increment' })} />
      <Button title="Reset" onPress={() => dispatch({ type: 'reset' })} />
    </View>
  );
}
```

`useReducer(reducer, initialState)` gives you back two things:

- `count`: the current state, just like with `useState`.
- `dispatch`: a function you call with an action. **Dispatch** simply means "send". React passes the action to your reducer, gets the new state back and re-renders.

So instead of telling React *how* to change the state (`setCount(count + 1)`), the button says *what happened* (`{ type: 'increment' }`) and the reducer decides the rest.

## Step 1: describe every action in HabitHop

TypeScript makes reducers really pleasant. You can list every possible action as a **union type** (a type that is "one of these shapes"):

```ts
// src/context/HabitsContext.tsx
export type HabitsAction =
  | { type: 'added'; habit: Habit }
  | { type: 'toggled_today'; id: string }
  | { type: 'deleted'; id: string };
```

Each action has a `type` string plus the data it needs. A good habit is to name actions in the past tense ("added", "deleted"), because an action describes something that already happened, not a command.

Now TypeScript knows that if `action.type` is `'added'`, then `action.habit` exists. If you mistype `'adddd'` anywhere, you get a red line right away.

## Step 2: write the reducer

```ts
// src/context/HabitsContext.tsx
export function habitsReducer(habits: Habit[], action: HabitsAction): Habit[] {
  switch (action.type) {
    case 'added':
      return [...habits, action.habit];
    case 'toggled_today': {
      const today = todayKey();
      return habits.map((h) => {
        if (h.id !== action.id) return h;
        const done = h.doneDates.includes(today);
        return {
          ...h,
          doneDates: done
            ? h.doneDates.filter((d) => d !== today)
            : [...h.doneDates, today],
        };
      });
    }
    case 'deleted':
      return habits.filter((h) => h.id !== action.id);
    default:
      return habits;
  }
}
```

A few things to notice:

- Every branch **returns a new array** (`[...habits, ...]`, `map`, `filter`). It never uses `push` or changes a habit in place. React compares the old and new state to decide whether to re-render, so changing the old array in place would mean your screen does not update.
- The `toggled_today` case has `{ }` braces around it. That lets you declare `const today` inside one `case` without clashing with other cases.
- `todayKey()` comes from `src/lib/dates.ts` and returns a string like `'2026-10-23'`. Strictly speaking, reading today's date makes the reducer a tiny bit impure. That is fine for a habit app. If you ever want 100% pure, put the date into the action instead: `{ type: 'toggled_today', id, day: todayKey() }`.

Because `habitsReducer` is exported and is just a function, you can test it later without any phone or screen at all. You will do exactly that in [Testing with Jest and React Native Testing Library](/courses/react-native/testing).

## Step 3: use the reducer inside the provider

Now the provider becomes very thin. It holds state with `useReducer` and turns each friendly function into a `dispatch` call:

```tsx
// src/context/HabitsContext.tsx
export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, dispatch] = useReducer(habitsReducer, starterHabits);

  const value: HabitsContextValue = {
    habits,
    addHabit: (input) =>
      dispatch({
        type: 'added',
        habit: {
          ...input,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          doneDates: [],
        },
      }),
    toggleToday: (id) => dispatch({ type: 'toggled_today', id }),
    deleteHabit: (id) => dispatch({ type: 'deleted', id }),
  };

  return <HabitsContext value={value}>{children}</HabitsContext>;
}
```

Notice what did **not** change: the context still offers `habits`, `addHabit`, `toggleToday` and `deleteHabit`. So every screen that calls `useHabits()` keeps working with zero edits. That is the nice thing about putting context behind a hook: you can rebuild the inside freely.

`addHabit` takes `{ name, emoji, color }` (the type `Pick<Habit, 'name' | 'emoji' | 'color'>`, meaning "only these three fields of `Habit`"). The provider fills in `id`, `createdAt` and an empty `doneDates`. The random-ish parts (`Date.now()`, `new Date()`) live here, not in the reducer, which keeps the reducer pure.

The `<HabitsContext value={value}>` line uses React 19's shorter syntax: you can render the context itself as the provider. Older code writes `<HabitsContext.Provider value={value}>`, which still works.

You may wonder about wrapping these functions in `useCallback` or the value in `useMemo`. In this project you do not need to: new Expo apps turn on the **React Compiler** (`"reactCompiler": true` in `app.json`), which adds that kind of caching for you. More on this in [Making Your App Fast](/courses/react-native/performance).

## When to pick useReducer over useState

Both are fine. A simple rule of thumb:

| Situation | Use |
| --- | --- |
| One value, simple updates (a text field, a toggle) | `useState` |
| A list or object with several different kinds of changes | `useReducer` |
| The next state depends on the previous one in tricky ways | `useReducer` |
| You want to unit test the update rules | `useReducer` |

The `TextInput` on the new habit form will stay as `useState`. The whole habit list moves to `useReducer`.

## Custom hooks: give repeated logic a name

A **custom hook** is just a function whose name starts with `use` and which calls other hooks inside. That is the whole rule. The `use` prefix tells React (and its lint rules) to apply the [Rules of Hooks](/courses/react/rules-of-hooks) to it: only call it at the top level of a component or another hook, never inside an `if` or a loop.

You already have one: `useHabits()`. Let's add two more that HabitHop screens will need.

### useHabit: everything about one habit

Soon you will build a details screen for a single habit in [Dynamic Routes and Route Params](/courses/react-native/dynamic-routes). That screen needs the habit, its streak, whether it is done today, and buttons to toggle or delete it. Instead of doing all that inside the screen, write a hook:

```ts
// src/hooks/useHabit.ts
import { useHabits } from '@/context/HabitsContext';
import { getStreak, todayKey } from '@/lib/dates';

export function useHabit(id: string) {
  const { habits, toggleToday, deleteHabit } = useHabits();
  const habit = habits.find((h) => h.id === id);

  return {
    habit,
    streak: habit ? getStreak(habit.doneDates) : 0,
    doneToday: habit ? habit.doneDates.includes(todayKey()) : false,
    toggle: () => toggleToday(id),
    remove: () => deleteHabit(id),
  };
}
```

`habit` can be `undefined` (maybe the id is wrong, or the habit was just deleted), so the screen must handle that case. TypeScript will remind you.

### useTodayProgress: numbers for the stats screen

```ts
// src/hooks/useTodayProgress.ts
import { useHabits } from '@/context/HabitsContext';
import { todayKey } from '@/lib/dates';

export function useTodayProgress() {
  const { habits } = useHabits();
  const today = todayKey();
  const done = habits.filter((h) => h.doneDates.includes(today)).length;
  const total = habits.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}
```

Now a stats screen is almost nothing:

```tsx
// src/app/stats.tsx
import { Text, View } from 'react-native';
import { useTodayProgress } from '@/hooks/useTodayProgress';

export default function StatsScreen() {
  const { done, total, percent } = useTodayProgress();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 48, fontWeight: '700' }}>{percent}%</Text>
      <Text>{done} of {total} habits done today</Text>
    </View>
  );
}
```

What you will see: a big "50%" in the middle of the screen and "1 of 2 habits done today" under it, if you ticked one of the two starter habits.

Each component that calls a custom hook gets its **own** copy of any state inside it. Custom hooks share *logic*, not *state*. The habits are shared here only because both hooks read from the same context.

The project template already keeps hooks in `src/hooks/` (for example `use-theme.ts`), so put yours there too.

## Common mistakes

**Changing state in place inside the reducer.** If you write `habits.push(action.habit); return habits;`, nothing appears on screen. React sees the *same* array as before and skips the re-render. Always return a new array or object.

**Forgetting to return in a case.** A `case` that does not `return` falls through to the next case, or returns `undefined`. Then the next render crashes with something like:

```text
TypeError: Cannot read property 'map' of undefined
```

Add a `default: return habits;` and make sure every case returns.

**Calling a hook inside a condition.** This breaks the Rules of Hooks:

```tsx
if (id) {
  const { habit } = useHabit(id); // wrong
}
```

React shows an error like "Rendered more hooks than during the previous render". Call the hook at the top of the component every time, and handle the "no habit" case with the value it returns.

**Using useHabits outside the provider.** If a screen is not inside `HabitsProvider`, you get the error you wrote yourself: `useHabits must be used inside <HabitsProvider>`. Check that the provider wraps your root layout. In the next lesson, [How Expo Router Works](/courses/react-native/expo-router-basics), that root layout becomes `src/app/_layout.tsx`.

## Quick recap

- A reducer is a pure function: `(state, action) => newState`. It never changes the old state.
- `useReducer(reducer, initial)` returns `[state, dispatch]`. Components dispatch actions that describe what happened.
- A TypeScript union type lists every action, so typos are caught right away.
- HabitHop's `HabitsProvider` now uses `habitsReducer`, but `useHabits()` still offers the same `habits`, `addHabit`, `toggleToday` and `deleteHabit`, so no screen had to change.
- A custom hook is a function starting with `use` that calls other hooks. `useHabit(id)` and `useTodayProgress()` keep screens small.
- Custom hooks share logic, not state. Keep them in `src/hooks/`.

<code id="code-content" class="language-tsx">
// src/context/HabitsContext.tsx
import { createContext, use, useReducer, type ReactNode } from 'react';
import { todayKey } from '@/lib/dates';
import type { Habit } from '@/types/habit';
// 1. Every change that can happen to the list
export type HabitsAction =
  | { type: 'added'; habit: Habit }
  | { type: 'toggled_today'; id: string }
  | { type: 'deleted'; id: string };
// 2. The reducer: old list + action = new list
export function habitsReducer(habits: Habit[], action: HabitsAction): Habit[] {
  switch (action.type) {
    case 'added':
      return [...habits, action.habit];
    case 'toggled_today': {
      const today = todayKey();
      return habits.map((h) =&gt; {
        if (h.id !== action.id) return h;
        const done = h.doneDates.includes(today);
        return {
          ...h,
          doneDates: done
            ? h.doneDates.filter((d) =&gt; d !== today)
            : [...h.doneDates, today],
        };
      });
    }
    case 'deleted':
      return habits.filter((h) =&gt; h.id !== action.id);
    default:
      return habits;
  }
}
type NewHabit = Pick&lt;Habit, 'name' | 'emoji' | 'color'&gt;;
type HabitsContextValue = {
  habits: Habit[];
  addHabit: (input: NewHabit) =&gt; void;
  toggleToday: (id: string) =&gt; void;
  deleteHabit: (id: string) =&gt; void;
};
const HabitsContext = createContext&lt;HabitsContextValue | null&gt;(null);
const starterHabits: Habit[] = [
  { id: 'h1', name: 'Drink water', emoji: '💧', color: '#0EA5E9', createdAt: '2026-10-01T08:00:00.000Z', doneDates: [] },
  { id: 'h2', name: 'Read 10 pages', emoji: '📚', color: '#7C5CFC', createdAt: '2026-10-01T08:00:00.000Z', doneDates: [] },
];
// 3. The provider sends actions instead of calling setHabits
export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, dispatch] = useReducer(habitsReducer, starterHabits);
  const value: HabitsContextValue = {
    habits,
    addHabit: (input) =&gt;
      dispatch({
        type: 'added',
        habit: {
          ...input,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          doneDates: [],
        },
      }),
    toggleToday: (id) =&gt; dispatch({ type: 'toggled_today', id }),
    deleteHabit: (id) =&gt; dispatch({ type: 'deleted', id }),
  };
  return &lt;HabitsContext value={value}&gt;{children}&lt;/HabitsContext&gt;;
}
// 4. The custom hook every screen uses
export function useHabits() {
  const ctx = use(HabitsContext);
  if (!ctx) {
    throw new Error('useHabits must be used inside &lt;HabitsProvider&gt;');
  }
  return ctx;
}
</code></pre>
