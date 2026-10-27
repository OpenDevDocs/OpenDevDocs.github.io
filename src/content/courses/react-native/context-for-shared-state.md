---
publishDate: 2026-10-23T02:00
title: Sharing State with Context
slug: context-for-shared-state
metadescription: 'Share HabitHop habits across every screen with React context: build HabitsProvider and a useHabits hook with addHabit, toggleToday and deleteHabit.'
updateDate: 2026-10-23T02:00
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'context', 'state', 'habithop']
course: react-native
---

## One list, many screens

Right now the habit list lives in the Today screen's state. That worked while HabitHop had one screen. But look at where the app is going:

- **Today** shows the habits and lets you tick them.
- **Stats** needs the same habits to draw streaks and totals.
- **Settings** needs them to offer "delete all".
- **Habit details** (`habit/[id]`) needs one habit to show and delete.
- **New habit** (a modal) needs to **add** to the list.

These screens are not parent and child. They are siblings, side by side under the navigator. You could keep the state in the root layout and pass it down through props, layer after layer. That is called **prop drilling**, and it gets painful quickly: every component in the middle has to accept and pass along props it does not even use.

React has a built-in answer: **context**. Context lets a component near the top **provide** a value, and any component below it, at any depth, **read** it directly. No passing through the middle.

In this lesson you will build `src/context/HabitsContext.tsx` with a `HabitsProvider` component and a `useHabits()` hook. After this, any HabitHop screen can write one line to get the habits and the functions to change them:

```tsx
// any screen
const { habits, addHabit, toggleToday, deleteHabit } = useHabits();
```

## Context in three steps

Before HabitHop, here is context at its smallest:

```tsx
// src/app/index.tsx
import { createContext, useContext } from 'react';
import { Text } from 'react-native';

// 1. Create the context, with a default value
const UserNameContext = createContext('Guest');

export default function Index() {
  // 2. Provide a value to everything inside
  return (
    <UserNameContext value="Riya">
      <Profile />
    </UserNameContext>
  );
}

function Profile() {
  // 3. Read it anywhere below
  const name = useContext(UserNameContext);
  return <Text>Hello, {name}!</Text>;
}
```

On screen: "Hello, Riya!". `Profile` did not get a `name` prop. It read the value straight from the context.

1. `createContext(defaultValue)` makes a context object. The default is used only when there is **no** provider above.
2. `<UserNameContext value={...}>` provides a value. Since React 19 you render the context itself as the provider. In older code you will see `<UserNameContext.Provider value={...}>`, which still works.
3. `useContext(UserNameContext)` reads the nearest provided value. When that value changes, every component reading it re-renders.

The React course explains this in depth in [useContext Hook and Context API](/courses/react/usecontext-hook-and-context-api) and [Context as a Provider](/courses/react/context-as-a-provider).

## The plan for HabitsContext

Context can hold **any** value, including objects with functions. The pattern you will use in almost every real app is:

- a **provider component** that owns the state with `useState` and defines the functions that change it
- a **custom hook** that reads the context and checks that the provider exists

Everything lives in one file. Screens never touch `setHabits` or the context object directly. They only see `useHabits()`. That gives you one place for all habit logic, which pays off later when you save habits to storage or a database.

## Step 1: types

Start with what the context will offer:

```tsx
// src/context/HabitsContext.tsx (part)
import { createContext, useContext, useState, type ReactNode } from 'react';

import { todayKey } from '@/lib/dates';
import type { Habit } from '@/types/habit';

// What the form gives us when the user adds a habit
export type NewHabit = Pick<Habit, 'name' | 'emoji' | 'color'>;

// Everything a screen can read or call through useHabits()
type HabitsContextValue = {
  habits: Habit[];
  addHabit: (input: NewHabit) => void;
  toggleToday: (id: string) => void;
  deleteHabit: (id: string) => void;
};

const HabitsContext = createContext<HabitsContextValue | null>(null);
```

- `Pick<Habit, 'name' | 'emoji' | 'color'>` is a TypeScript helper that means "a type with only these three fields of `Habit`". That is exactly what `HabitForm` from [Building Forms and Checking Input](/courses/react-native/forms-and-validation) sends to `onSubmit`. The provider fills in the rest.
- The default value is `null`. There is no sensible "default habit list with working functions", so `null` means "no provider found". The hook will turn that into a clear error.

## Step 2: the provider

The provider is a normal component. It takes `children` (whatever you put inside it), owns the state, and wraps the children in the context:

```tsx
// src/context/HabitsContext.tsx (part)
export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>(starterHabits);

  function addHabit(input: NewHabit) {
    const habit: Habit = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      doneDates: [],
      ...input,
    };
    setHabits((current) => [...current, habit]);
  }

  function toggleToday(id: string) {
    const today = todayKey();
    setHabits((current) =>
      current.map((h) => {
        if (h.id !== id) return h;
        const isDone = h.doneDates.includes(today);
        return {
          ...h,
          doneDates: isDone ? h.doneDates.filter((d) => d !== today) : [...h.doneDates, today],
        };
      }),
    );
  }

  function deleteHabit(id: string) {
    setHabits((current) => current.filter((h) => h.id !== id));
  }

  return (
    <HabitsContext value={{ habits, addHabit, toggleToday, deleteHabit }}>
      {children}
    </HabitsContext>
  );
}
```

`addHabit` and `toggleToday` are the same functions you wrote in the Today screen, just moved here. `deleteHabit` is new: it keeps every habit except the one with that id. All three use the function form of the setter and build new arrays, as you learned in [State and Props in a Mobile App](/courses/react-native/state-and-props).

`starterHabits` is a small array of two habits defined at the top of the file (see the code panel), so the app is not empty while you build it.

### Do I need useMemo here?

In older React code you will see the provider value wrapped in `useMemo` and the functions in `useCallback`. The reason: `{ habits, addHabit, ... }` is a **new object** on every render, so every component using the context would re-render even when nothing changed.

HabitHop has the **React Compiler** turned on (`"reactCompiler": true` in `app.json`, the default for new Expo projects). The compiler adds that kind of memoization for you automatically. So you can write the simple version above. There is more on this in [Making Your App Fast](/courses/react-native/performance).

## Step 3: the hook

Finally, a hook that screens will use:

```tsx
// src/context/HabitsContext.tsx (part)
export function useHabits() {
  const value = useContext(HabitsContext);
  if (value === null) {
    throw new Error('useHabits must be used inside <HabitsProvider>');
  }
  return value;
}
```

Two benefits:

1. **Clear errors.** If a screen is not inside the provider, you get a red screen that says exactly what is wrong, instead of a confusing "Cannot read property 'habits' of null".
2. **Better types.** After the `null` check, TypeScript knows `value` is a `HabitsContextValue`. Screens get full autocomplete for `habits`, `addHabit` and the rest, with no `?.` everywhere.

The complete file is in the code panel.

## Step 4: wrap the app

A provider only helps components **inside** it. To share habits with every screen, wrap the whole app in the **root layout**, `src/app/_layout.tsx`. This is the file Expo Router renders around every screen (you will learn all about it in [How Expo Router Works](/courses/react-native/expo-router-basics)):

```tsx
// src/app/_layout.tsx
import { Stack } from 'expo-router';

import { HabitsProvider } from '@/context/HabitsContext';

export default function RootLayout() {
  return (
    <HabitsProvider>
      <Stack />
    </HabitsProvider>
  );
}
```

If your root layout already has other wrappers, such as the `ThemeProvider` from [Dark Mode and Themes](/courses/react-native/dark-mode-and-themes), nest them. The order rarely matters, as long as the navigator (`<Stack />`) is inside both.

The provider sits in the root layout, which stays mounted the whole time the app runs. So the habits survive navigating between screens. They do **not** survive closing the app, because state lives in memory. Saving them on the phone is the job of [Saving Data on the Phone with AsyncStorage](/courses/react-native/async-storage), and thanks to this setup, only this one file will need to change.

## Step 5: use it in screens

The Today screen gets much shorter. No `useState`, no `toggleToday`, no `addHabit` in the screen anymore:

```tsx
// src/app/index.tsx
import { FlatList, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HabitCard } from '@/components/HabitCard';
import { HabitForm } from '@/components/HabitForm';
import { useHabits } from '@/context/HabitsContext';
import { isDoneToday } from '@/lib/dates';

export default function TodayScreen() {
  const { habits, addHabit, toggleToday } = useHabits();
  const doneCount = habits.filter((h) => isDoneToday(h.doneDates)).length;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={habits}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HabitCard habit={item} onToggle={toggleToday} />}
        ListHeaderComponent={<Text style={styles.subtitle}>{doneCount} of {habits.length} done</Text>}
        ListFooterComponent={<HabitForm existingNames={habits.map((h) => h.name)} onSubmit={addHabit} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  subtitle: { fontSize: 15, color: '#666' },
  list: { padding: 16, gap: 12 },
});
```

Notice `onSubmit={addHabit}`: the form sends `{ name, emoji, color }`, which is exactly a `NewHabit`, so the context function plugs straight in. (The screen skips the top safe-area edge because the Stack now draws a header there; see [Safe Areas](/courses/react-native/safe-areas).)

And here is the real win. Any other component can read the same list. A small summary you could put on any screen:

```tsx
// src/components/TodaySummary.tsx
import { Text } from 'react-native';

import { useHabits } from '@/context/HabitsContext';
import { isDoneToday } from '@/lib/dates';

export function TodaySummary() {
  const { habits } = useHabits();
  const left = habits.filter((h) => !isDoneToday(h.doneDates)).length;

  return <Text>{left === 0 ? 'All done for today! 🎉' : `${left} habits left today`}</Text>;
}
```

Tick a habit on the Today screen, and `TodaySummary` updates too, wherever it is, because both read the same context. Later, the habit details screen will call `deleteHabit(id)` and the Today list will update by itself.

## When to use context (and when not)

Context is great for data that **many screens need** and that **changes not too often**:

- the habit list
- the signed-in user (used in [Protected Routes and a Simple Login Flow](/courses/react-native/protected-routes))
- the theme or language

It is **not** the answer for everything:

- **State only one screen needs** (the text in a form, whether a menu is open) should stay local with `useState`. Putting it in context makes every reader re-render for nothing.
- **Data from a server** (like the quote of the day) is better handled by a caching library like [TanStack Query](/courses/react-native/tanstack-query).
- **Very big apps** with lots of fast-changing shared state sometimes use a store library like Zustand. You can read about it in the React course's [Zustand State Management](/courses/react/zustand-state-management) lesson. For HabitHop, context is plenty.

## Common mistakes

**1. Using the hook outside the provider.** A screen crashes with:

```text
Error: useHabits must be used inside <HabitsProvider>
```

The screen is not inside the provider, often because the provider wraps only one screen instead of the navigator. Fix: put `HabitsProvider` in `src/app/_layout.tsx`, around `<Stack />`.

**2. Two providers.** You add `<HabitsProvider>` in the root layout **and** in a screen. The screen and its children now talk to a second, separate list, and changes do not show up elsewhere. Fix: one provider, at the top.

**3. Changing state from outside the provider.** You export `setHabits` or the context object, and screens start doing their own updates. Bugs follow, because the logic is spread everywhere. Fix: export only `HabitsProvider`, `useHabits` and types. All changes go through `addHabit`, `toggleToday` and `deleteHabit`.

**4. Everything in one giant context.** You put the habits, the user, the theme and the form text in one context, and every keystroke re-renders the whole app. Fix: one context per topic, and keep local state local.

## Quick recap

- **Context** shares a value with every component below a provider, without prop drilling.
- `createContext` makes it, `<MyContext value={...}>` provides it (React 19 style), `useContext` reads it.
- The pattern: a **provider component** that owns state and defines the update functions, plus a **custom hook** that reads the context and throws a clear error if the provider is missing.
- HabitHop now has `HabitsProvider` and `useHabits()` in `src/context/HabitsContext.tsx`, offering `habits`, `addHabit`, `toggleToday` and `deleteHabit`.
- Wrap the navigator in the root layout so every screen can use it. With the React Compiler on, no `useMemo` is needed for the value.
- Keep local state local, and use context for data many screens share. Next, clean up the update logic with [useReducer and Custom Hooks](/courses/react-native/usereducer-and-custom-hooks).

<code id="code-content" class="language-tsx">
// src/context/HabitsContext.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';
import { todayKey } from '@/lib/dates';
import type { Habit } from '@/types/habit';
// What the form gives us when the user adds a habit
export type NewHabit = Pick&lt;Habit, 'name' | 'emoji' | 'color'&gt;;
// Everything a screen can read or call through useHabits()
type HabitsContextValue = {
  habits: Habit[];
  addHabit: (input: NewHabit) =&gt; void;
  toggleToday: (id: string) =&gt; void;
  deleteHabit: (id: string) =&gt; void;
};
const HabitsContext = createContext&lt;HabitsContextValue | null&gt;(null);
// A few habits to start with (saved data replaces these in a later lesson)
const starterHabits: Habit[] = [
  { id: 'h1', name: 'Drink water', emoji: '💧', color: '#0EA5E9', createdAt: '2026-10-01T08:00:00.000Z', doneDates: [] },
  { id: 'h2', name: 'Read 10 pages', emoji: '📚', color: '#7C5CFC', createdAt: '2026-10-01T08:00:00.000Z', doneDates: [] },
];
export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState&lt;Habit[]&gt;(starterHabits);
  function addHabit(input: NewHabit) {
    const habit: Habit = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      doneDates: [],
      ...input,
    };
    setHabits((current) =&gt; [...current, habit]);
  }
  function toggleToday(id: string) {
    const today = todayKey();
    setHabits((current) =&gt;
      current.map((h) =&gt; {
        if (h.id !== id) return h;
        const isDone = h.doneDates.includes(today);
        return {
          ...h,
          doneDates: isDone ? h.doneDates.filter((d) =&gt; d !== today) : [...h.doneDates, today],
        };
      }),
    );
  }
  function deleteHabit(id: string) {
    setHabits((current) =&gt; current.filter((h) =&gt; h.id !== id));
  }
  return (
    &lt;HabitsContext value={{ habits, addHabit, toggleToday, deleteHabit }}&gt;
      {children}
    &lt;/HabitsContext&gt;
  );
}
// The hook screens use. It fails loudly if the provider is missing.
export function useHabits() {
  const value = useContext(HabitsContext);
  if (value === null) {
    throw new Error('useHabits must be used inside &lt;HabitsProvider&gt;');
  }
  return value;
}
</code></pre>
