---
publishDate: 2026-10-22T20:00
title: State and Props in a Mobile App
slug: state-and-props
metadescription: 'Learn props and state in React Native by building the real HabitHop Today screen: a Habit type, a HabitCard component and marking habits done today.'
updateDate: 2026-10-22T20:00
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'state', 'props', 'habithop']
course: react-native
---

## From pretty screens to a working app

So far HabitHop has looked nice, but nothing really happened. Tapping "done" did not remember anything. Starting now, you build the real app. The first step is understanding the two kinds of data every React Native component works with:

- **Props**: values a component **receives** from its parent. They are read-only.
- **State**: values a component **owns and changes** over time. When state changes, the screen redraws.

If you know React for the web, good news: this works exactly the same on a phone. The [State and the useState Hook](/courses/react/state-and-usestate-hook) and [Props and Children](/courses/react/props-and-children) lessons in the React course go deeper. Here we focus on using them to build HabitHop.

By the end of this lesson you will have:

- a `Habit` type that describes one habit
- small helpers for dates and streaks
- a reusable `HabitCard` component that gets its data through props
- a Today screen that keeps the habit list in state and marks habits as done

## Props: passing data down

A **prop** is a value you pass into a component, like an argument to a function. Here is a tiny component with two props:

```tsx
// src/components/Greeting.tsx
import { Text } from 'react-native';

type GreetingProps = {
  name: string;
  habitCount?: number; // the ? means "optional"
};

export function Greeting({ name, habitCount = 0 }: GreetingProps) {
  return (
    <Text>
      Hi {name}, you have {habitCount} habits today.
    </Text>
  );
}
```

And here is how a parent uses it:

```tsx
// src/app/index.tsx (part)
<Greeting name="Riya" habitCount={3} />
<Greeting name="Sam" />
```

On screen you see:

```text
Hi Riya, you have 3 habits today.
Hi Sam, you have 0 habits today.
```

Three things to notice:

1. The **props type** (`GreetingProps`) lists what the component accepts. TypeScript now stops you if you forget `name` or pass a number where a string belongs. (A refresher is in [Just Enough TypeScript for React Native](/courses/react-native/typescript-basics).)
2. We **destructure** the props in the function's parameters, and give `habitCount` a default value of `0`.
3. Text goes in quotes (`name="Riya"`), everything else in curly braces (`habitCount={3}`).

Props are **read-only**. A component must never change its own props. If `Greeting` wrote `name = 'Mia'`, it would be fighting its parent. Data flows one way: **down**, from parent to child.

## State: data that changes

**State** is data a component remembers between renders. A **render** is one run of your component function, which produces what you see on screen. You create state with the `useState` hook:

```tsx
// src/components/WaterCounter.tsx
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

export function WaterCounter() {
  const [glasses, setGlasses] = useState(0);

  return (
    <Pressable onPress={() => setGlasses(glasses + 1)}>
      <Text>💧 {glasses} glasses today</Text>
    </Pressable>
  );
}
```

`useState(0)` gives you two things: the current value (`glasses`, starting at `0`) and a **setter function** (`setGlasses`) to change it. Tap the text and it says 1, then 2, then 3.

Why not just use a normal variable? Try it:

```tsx
// src/components/WaterCounter.tsx (broken!)
let glasses = 0;
// ...
<Pressable onPress={() => { glasses = glasses + 1; }}>
```

Tap all you want, the screen stays at 0. Changing a normal variable does not tell React anything, so it never redraws. And even if something else caused a redraw, the function runs again from the top and `glasses` starts at 0 again. Calling the setter does both jobs: it **remembers** the new value and **asks React to redraw**.

### Updating based on the old value

When the new state depends on the old one, pass a function to the setter:

```tsx
// src/components/WaterCounter.tsx (part)
function addThree() {
  setGlasses((g) => g + 1);
  setGlasses((g) => g + 1);
  setGlasses((g) => g + 1);
}
```

This adds 3. If you wrote `setGlasses(glasses + 1)` three times instead, it would only add 1, because `glasses` is the same old number in all three lines. The function form, `(g) => g + 1`, always gets the latest value. It is a good habit whenever you update a list or a counter.

## The Habit type and the date helpers

Now for HabitHop. You already wrote the `Habit` type in [Just Enough TypeScript for React Native](/courses/react-native/typescript-basics). As a reminder:

```ts
// src/types/habit.ts
export type Habit = {
  id: string; // e.g. 'h1' or Date.now().toString()
  name: string; // 'Drink water'
  emoji: string; // '💧'
  color: string; // one of the palette colors
  createdAt: string; // ISO date-time
  doneDates: string[]; // days it was done, as 'YYYY-MM-DD'
};
```

The most interesting field is `doneDates`. Instead of a simple `done: true/false`, we keep a list of every day the habit was done, like `['2026-10-20', '2026-10-21']`. That one list answers every question: "is it done today?" (is today in the list?), "what is the streak?" (count the days in a row), and later, statistics for the Stats tab.

The palette lives in `src/constants/colors.ts`:

```ts
// src/constants/colors.ts
export const habitColors = ['#7C5CFC', '#22C55E', '#F97316', '#0EA5E9', '#EC4899'];
```

You also have `todayKey()` and `isDoneToday()` in `src/lib/dates.ts`. Now add a streak counter. To count backwards day by day, we first pull the "Date to key" part out into its own `toKey` function, so it works for any day, not only today:

```ts
// src/lib/dates.ts
// Turns any Date into 'YYYY-MM-DD' using the phone's local time zone.
export function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey(): string {
  return toKey(new Date());
}

export function isDoneToday(doneDates: string[]): boolean {
  return doneDates.includes(todayKey());
}

// Counts how many days in a row the habit was done, ending today.
export function getStreak(doneDates: string[]): number {
  const done = new Set(doneDates);
  const day = new Date();
  let streak = 0;
  while (done.has(toKey(day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}
```

Why not `new Date().toISOString().slice(0, 10)`? Because `toISOString()` uses UTC time, not the phone's time. For Arjun in India, a habit done at 2 a.m. would be saved under yesterday's date. `toKey` uses the local date, which is what the user expects. (`getMonth()` counts from 0, hence the `+ 1`.)

`getStreak` starts at today and walks backwards one day at a time, as long as the day is in the list. A `Set` makes "is this day in the list?" fast. Done today, yesterday and the day before? The streak is 3. Not done today yet? The streak is 0 until you tick it.

## The HabitCard component

In [View and Text](/courses/react-native/view-and-text) you built a static `HabitCard` that took `habit`, `streak` and `isDone` as props, and its done circle could not be pressed. Time to make it real. The new card gets just two props: the `habit` to show, and an `onToggle` function to call when the button is pressed. It works out the streak and the done state by itself.

```tsx
// src/components/HabitCard.tsx (part)
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getStreak, isDoneToday } from '@/lib/dates';
import type { Habit } from '@/types/habit';

type HabitCardProps = {
  habit: Habit;
  onToggle: (id: string) => void;
};

export function HabitCard({ habit, onToggle }: HabitCardProps) {
  const doneToday = isDoneToday(habit.doneDates);
  const streak = getStreak(habit.doneDates);

  return (
    <View style={[styles.card, { borderLeftColor: habit.color }]}>
      <Text style={styles.emoji}>{habit.emoji}</Text>
      <View style={styles.info}>
        <Text style={styles.name}>{habit.name}</Text>
        <Text style={styles.streak}>🔥 {streak} day streak</Text>
      </View>
      <Pressable
        onPress={() => onToggle(habit.id)}
        style={[styles.button, doneToday && { backgroundColor: habit.color }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: doneToday }}
        accessibilityLabel={`Mark ${habit.name} as done today`}>
        <Text style={[styles.buttonText, doneToday && styles.buttonTextDone]}>
          {doneToday ? 'Done' : 'Do it'}
        </Text>
      </Pressable>
    </View>
  );
}
```

The styles are ordinary (a row with a colored left border, a rounded pill button). You can copy them from the earlier styling lessons or write your own:

```tsx
// src/components/HabitCard.tsx (part)
const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderLeftWidth: 6, backgroundColor: '#F4F2FF' },
  emoji: { fontSize: 28 },
  info: { flex: 1 },
  name: { fontSize: 17, fontWeight: '600' },
  streak: { fontSize: 13, color: '#666' },
  button: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#ccc' },
  buttonText: { fontWeight: '600' },
  buttonTextDone: { color: '#fff' },
});
```

The button tells screen readers it is a **checkbox** (`accessibilityRole`) and whether it is ticked (`accessibilityState`), so a blind user hears something like "Mark Drink water as done today, checkbox, checked". More in [Accessibility: Apps Everyone Can Use](/courses/react-native/accessibility).

Look closely at what the card does **not** do. It does not store whether the habit is done. It **calculates** `doneToday` and `streak` from the props on every render. These are called **derived values**: anything you can calculate from props or state should be calculated, not stored in more state. That way they can never get out of sync.

The card also does not change the habit. When the button is pressed, it calls `onToggle(habit.id)` and lets the parent decide what happens. Passing a function as a prop like this is how a child **talks back up** to its parent.

## The Today screen: state lives at the top

Who should own the list of habits? The rule of thumb: put state in the **closest common parent** of everything that needs it. The Today screen shows all the cards and the "2 of 3 done" summary, so the list lives there. (The React course calls this [lifting state up](/courses/react/lifting-state-up).)

The full screen is in the code panel. Here is the heart of it:

```tsx
// src/app/index.tsx (part)
const [habits, setHabits] = useState<Habit[]>(starterHabits);

function toggleToday(id: string) {
  const today = todayKey();
  setHabits((current) =>
    current.map((habit) => {
      if (habit.id !== id) return habit;
      const isDone = habit.doneDates.includes(today);
      return {
        ...habit,
        doneDates: isDone
          ? habit.doneDates.filter((d) => d !== today)
          : [...habit.doneDates, today],
      };
    }),
  );
}
```

Read it slowly:

1. `useState<Habit[]>(starterHabits)` creates state holding an array of habits. The `<Habit[]>` tells TypeScript what goes in it.
2. `toggleToday` uses the function form of the setter, because the new list depends on the old one.
3. `current.map(...)` builds a **new** array. Every habit stays the same object, except the one with the matching `id`.
4. For that one we build a **new** habit object with `{ ...habit, doneDates: ... }`. If today is already in `doneDates`, we filter it out (undo). If not, we add it.

Why all the copying? React decides whether to redraw by checking if the state is a **new** value. If you changed the old array in place (with `push` or by editing `habit.doneDates`), React would see the same array and might not redraw. Always make new arrays and objects when updating state. This is called **immutable updates**.

Then the screen passes everything down through props:

```tsx
// src/app/index.tsx (part)
<FlatList
  data={habits}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <HabitCard habit={item} onToggle={toggleToday} />}
/>
```

The summary line is another derived value:

```tsx
// src/app/index.tsx (part)
const doneCount = habits.filter((h) => isDoneToday(h.doneDates)).length;
```

Run the app. You see the "Today" title, "0 of 3 done", and three cards. Tap "Do it" on Drink water: the button fills with blue, says "Done", the streak goes to 1, and the summary says "1 of 3 done". Tap again and it all goes back. One state change, and every part of the screen that depends on it updates.

The list uses [FlatList](/courses/react-native/flatlist), and the screen uses `SafeAreaView` from [Safe Areas](/courses/react-native/safe-areas).

## State resets: what is still missing

Reload the app (press `r` in the terminal) and your ticks are gone. State lives in memory only. That is fine for now. Over the next lessons you will fix the gaps one by one:

- add new habits with a form in [Building Forms and Checking Input](/courses/react-native/forms-and-validation)
- share the habits between screens in [Sharing State with Context](/courses/react-native/context-for-shared-state)
- save them on the phone in [Saving Data on the Phone with AsyncStorage](/courses/react-native/async-storage)

## Common mistakes

**1. Mutating state.** You write `habit.doneDates.push(today); setHabits(habits);` and the screen does not update (or updates late). Fix: build new arrays and objects with `map`, `filter` and `...spread`, as in `toggleToday`.

**2. Calling the function instead of passing it.** `onPress={onToggle(habit.id)}` runs the function during render, which sets state, which renders again, forever. TypeScript usually catches it first:

```text
Type 'void' is not assignable to type '((event: ...) => unknown) | undefined'.
```

If it slips through (for example in a plain JavaScript file), React stops with `Too many re-renders. React limits the number of renders to prevent an infinite loop.` Fix: wrap it in an arrow function: `onPress={() => onToggle(habit.id)}`.

**3. Copying props into state.** `const [done, setDone] = useState(isDoneToday(habit.doneDates))` inside the card. Now the card has its own copy that does not change when the parent's habit changes. Fix: calculate it from props on every render (a derived value).

**4. Using the index as key.** `keyExtractor={(item, index) => String(index)}` mixes up rows when habits are added or removed. Fix: use the habit's `id`.

## Quick recap

- **Props** come from the parent and are read-only. Type them with a props type.
- **State** is owned by a component and changed with its setter, which also triggers a redraw.
- Use the function form, `setX((old) => ...)`, when the new state depends on the old.
- Never mutate state. Build new arrays and objects with `map`, `filter` and spread.
- Calculate **derived values** (done today, streak, counts) instead of storing them.
- Put state in the closest common parent, pass data down as props and pass functions down so children can report back.
- HabitHop now has `getStreak`, an interactive `HabitCard` and a working Today screen.

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HabitCard } from '@/components/HabitCard';
import { isDoneToday, todayKey } from '@/lib/dates';
import type { Habit } from '@/types/habit';
// Starter data, so the screen is not empty on day one
const starterHabits: Habit[] = [
  { id: 'h1', name: 'Drink water', emoji: '💧', color: '#0EA5E9', createdAt: new Date().toISOString(), doneDates: [] },
  { id: 'h2', name: 'Read 10 pages', emoji: '📚', color: '#7C5CFC', createdAt: new Date().toISOString(), doneDates: [] },
  { id: 'h3', name: 'Stretch', emoji: '🧘', color: '#22C55E', createdAt: new Date().toISOString(), doneDates: [] },
];
export default function TodayScreen() {
  // The list of habits lives here, in state
  const [habits, setHabits] = useState&lt;Habit[]&gt;(starterHabits);
  // Adds today to doneDates, or removes it if it is already there
  function toggleToday(id: string) {
    const today = todayKey();
    setHabits((current) =&gt;
      current.map((habit) =&gt; {
        if (habit.id !== id) return habit;
        const isDone = habit.doneDates.includes(today);
        return {
          ...habit,
          doneDates: isDone
            ? habit.doneDates.filter((d) =&gt; d !== today)
            : [...habit.doneDates, today],
        };
      }),
    );
  }
  const doneCount = habits.filter((h) =&gt; isDoneToday(h.doneDates)).length;
  return (
    &lt;SafeAreaView style={styles.screen}&gt;
      &lt;Text style={styles.title}&gt;Today&lt;/Text&gt;
      &lt;Text style={styles.subtitle}&gt;
        {doneCount} of {habits.length} done
      &lt;/Text&gt;
      &lt;FlatList
        data={habits}
        keyExtractor={(item) =&gt; item.id}
        renderItem={({ item }) =&gt; &lt;HabitCard habit={item} onToggle={toggleToday} /&gt;}
        contentContainerStyle={styles.list}
      /&gt;
    &lt;/SafeAreaView&gt;
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 32, fontWeight: '700', marginTop: 8 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 16 },
  list: { gap: 12, paddingBottom: 24 },
});
</code></pre>
