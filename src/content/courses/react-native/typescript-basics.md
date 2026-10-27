---
publishDate: 2026-10-21T18:30
title: Just Enough TypeScript for React Native
slug: typescript-basics
metadescription: 'Learn the small part of TypeScript you need for React Native: types, type aliases, unions, typed props, useState generics and style types, using HabitHop code.'
updateDate: 2026-10-21T18:30
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'typescript']
course: react-native
---

## Why TypeScript?

Your HabitHop project is a **TypeScript** project: files end in `.ts` and `.tsx`. **TypeScript** is JavaScript plus **types**: little labels that say what kind of value something is ("this is a string", "this is a list of habits"). Your editor reads those labels and warns you about mistakes **before** you run the app.

On a phone that is extra helpful. A typo in a prop name does not show an error in a browser console you are already looking at; it shows a red screen on a phone in your hand, or worse, just quietly does nothing. TypeScript catches many of those mistakes as you type.

You do not need to learn all of TypeScript. This lesson covers the part you will use in almost every file of this course. If you want the deeper version later, see [TypeScript Fundamentals](/courses/javascript/typescript-fundamentals) and [TypeScript with React](/courses/react/typescript-with-react).

## Types on variables

You can write a type after a name with a colon:

```ts
// src/playground.ts
const habitName: string = 'Drink water';
const streak: number = 4;
const isDoneToday: boolean = false;
```

Most of the time you do not need to write them. TypeScript **infers** (works out) the type from the value:

```ts
// src/playground.ts
const habitName = 'Drink water'; // TypeScript knows this is a string
let streak = 4;                  // a number

streak = 'five'; // Error!
```

The last line is an error, and VS Code underlines it in red:

```text
Type 'string' is not assignable to type 'number'.
```

The app would still start (Metro strips the types away and runs the JavaScript), but your editor told you about a bug right away. Treat red underlines as real bugs.

## Arrays and objects

An array type is written with `[]` after the item type:

```ts
// src/playground.ts
const doneDates: string[] = ['2026-10-19', '2026-10-20'];
const counts: number[] = [1, 2, 3];
```

For objects, you describe the shape with a **type alias**: a name for a type, made with the `type` keyword. Here is the most important type in the whole course. Create the file now:

```ts
// src/types/habit.ts
export type Habit = {
  id: string;          // e.g. 'h1' or Date.now().toString()
  name: string;        // 'Drink water'
  emoji: string;       // '💧'
  color: string;       // one of the palette colors
  createdAt: string;   // ISO date-time
  doneDates: string[]; // days it was done, as 'YYYY-MM-DD'
};
```

Now you can use `Habit` anywhere, and TypeScript checks every habit has the right fields:

```ts
// src/data/sample-habits.ts
import type { Habit } from '@/types/habit';

export const sampleHabits: Habit[] = [
  {
    id: 'h1',
    name: 'Drink water',
    emoji: '💧',
    color: '#0EA5E9',
    createdAt: '2026-10-01T08:00:00.000Z',
    doneDates: ['2026-10-19', '2026-10-20'],
  },
  {
    id: 'h2',
    name: 'Read 10 pages',
    emoji: '📚',
    color: '#7C5CFC',
    createdAt: '2026-10-02T08:00:00.000Z',
    doneDates: [],
  },
];
```

If you forget a field, or misspell one, you get a clear error. For example, leaving out `emoji`:

```text
Property 'emoji' is missing in type '{ id: string; name: string; color: string; createdAt: string; doneDates: never[]; }' but required in type 'Habit'.
```

`import type` imports only the type, not any code. It is a small hint that keeps your bundle clean, and it makes the intent obvious.

## Optional fields and unions

Add `?` after a name to make it **optional** (it may be missing):

```ts
// src/types/reminder.ts
export type Reminder = {
  habitId: string;
  time: string;   // '08:30'
  note?: string;  // may be left out
};
```

A **union type** says "one of these". Use `|` between the options. Unions of exact strings are great for settings:

```ts
// src/types/settings.ts
export type ThemeChoice = 'light' | 'dark' | 'system';

let theme: ThemeChoice = 'dark';
theme = 'blue'; // Error: Type '"blue"' is not assignable to type 'ThemeChoice'.
```

You will often see a union with `null` or `undefined`, meaning "this might not exist yet":

```ts
// src/playground.ts
import type { Habit } from '@/types/habit';

let selected: Habit | null = null;
```

## Typing functions

Give each **parameter** (input) a type. You can also write the **return type** after the brackets, though TypeScript usually infers it:

```ts
// src/lib/dates.ts
export function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function isDoneToday(doneDates: string[]): boolean {
  return doneDates.includes(todayKey());
}
```

`todayKey()` returns today's date as `'YYYY-MM-DD'` in the phone's own time zone. You will use it a lot in HabitHop. Now if someone calls `isDoneToday('2026-10-20')` with a string instead of an array, TypeScript complains before the app ever runs.

## Typing component props

A **prop** is a value you pass into a component, like an argument to a function. In TypeScript you describe a component's props with a type, then use it for the function's parameter:

```tsx
// src/components/HabitName.tsx
import { Text } from 'react-native';

type HabitNameProps = {
  name: string;
  emoji: string;
  streak?: number; // optional
};

export function HabitName({ name, emoji, streak = 0 }: HabitNameProps) {
  return (
    <Text>
      {emoji} {name} ({streak} day streak)
    </Text>
  );
}
```

Now using it wrong is an error right in the screen file:

```tsx
// src/app/index.tsx
import { HabitName } from '@/components/HabitName';

export default function Index() {
  return <HabitName name="Drink water" emoji="💧" streek={3} />;
}
```

```text
Property 'streek' does not exist on type 'IntrinsicAttributes & HabitNameProps'. Did you mean 'streak'?
```

The editor even suggests the fix. You also get autocomplete: type `<HabitName ` and VS Code lists the props.

### Passing whole objects

Often it is simpler to pass a whole `Habit`:

```tsx
// src/components/HabitRow.tsx
import { Text } from 'react-native';
import type { Habit } from '@/types/habit';

type HabitRowProps = {
  habit: Habit;
  onToggle: (id: string) => void;
};

export function HabitRow({ habit, onToggle }: HabitRowProps) {
  return (
    <Text onPress={() => onToggle(habit.id)}>
      {habit.emoji} {habit.name}
    </Text>
  );
}
```

`onToggle: (id: string) => void` is a **function type**: "a function that takes a string id and returns nothing". You will use this pattern for every button callback in HabitHop.

### Children

If a component wraps other components, type its `children` as `ReactNode` (anything React can show):

```tsx
// src/components/Card.tsx
import type { ReactNode } from 'react';
import { View } from 'react-native';

type CardProps = {
  children: ReactNode;
};

export function Card({ children }: CardProps) {
  return <View style={{ padding: 16, borderRadius: 12, backgroundColor: '#FFFFFF' }}>{children}</View>;
}
```

## Typing state

`useState` infers its type from the starting value. `useState(0)` is a number, `useState('')` is a string. But when you start with an empty array or `null`, tell TypeScript what goes in it with angle brackets (this is called a **generic**):

```tsx
// src/app/index.tsx
import { useState } from 'react';
import { Text } from 'react-native';
import type { Habit } from '@/types/habit';

export default function Index() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selected, setSelected] = useState<Habit | null>(null);

  return <Text>{habits.length} habits, selected: {selected?.name ?? 'none'}</Text>;
}
```

Without `<Habit[]>`, an empty `[]` would be typed as `never[]`, and adding a habit later would be an error. The `?.` (optional chaining) safely reads `name` only if `selected` is not `null`.

## Types that come with React Native

React Native ships types for all its components. Two you will use often:

```tsx
// src/components/Badge.tsx
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

type BadgeProps = {
  label: string;
  style?: StyleProp<ViewStyle>; // lets the caller pass extra styles
};

export function Badge({ label, style }: BadgeProps) {
  return (
    <View style={[{ padding: 6, borderRadius: 8, backgroundColor: '#EDE9FE' }, style]}>
      <Text>{label}</Text>
    </View>
  );
}
```

- `ViewStyle` describes styles for a `View` (there is also `TextStyle` and `ImageStyle`).
- `StyleProp<ViewStyle>` is what the `style` prop accepts: one style, an array of styles, or nothing.

You will use these in [Styling with StyleSheet](/courses/react-native/stylesheet-basics).

## Checking the whole project

VS Code checks the files you open. To check **every** file at once, run the TypeScript compiler in check-only mode:

```bash
npx tsc --noEmit
```

No output means no errors. Run it before you commit, or when you rename something used in many files.

## Common mistakes

**Ignoring red underlines because "the app still runs".** Metro does not stop for type errors, so a bug can slip through and crash at runtime. Fix type errors as you go.

**Empty arrays without a type.** `useState([])` gives `never[]`, and then `setHabits([...habits, newHabit])` fails with `Type 'Habit' is not assignable to type 'never'`. Write `useState<Habit[]>([])`.

**Reaching for `any`.** `any` switches type checking off for that value. It makes errors go away, but it also hides real bugs. Describe the shape with a `type` instead.

**Forgetting to export the type.** If `src/types/habit.ts` has `type Habit = ...` without `export`, other files get `Module '"@/types/habit"' has no exported member 'Habit'`. Add `export`.

## Quick recap

- TypeScript adds **types** so your editor catches mistakes before the app runs. Metro strips them out.
- Use `type` aliases for object shapes, like `Habit` in `src/types/habit.ts`. Add `?` for optional fields and `|` for unions.
- Type function parameters, and type component props with a `Props` type.
- Use `useState<Habit[]>([])` and `useState<Habit | null>(null)` when the start value is empty.
- React Native gives you types like `ViewStyle`, `TextStyle` and `StyleProp`.
- Run `npx tsc --noEmit` to check the whole project. Next: [View and Text: The Building Blocks](/courses/react-native/view-and-text).

<code id="code-content" class="language-tsx">
// src/app/index.tsx
// Typed HabitHop data, a typed component and typed state in one screen.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Habit } from '@/types/habit';
// ---
const starterHabits: Habit[] = [
  { id: 'h1', name: 'Drink water', emoji: '💧', color: '#0EA5E9', createdAt: '2026-10-01T08:00:00.000Z', doneDates: [] },
  { id: 'h2', name: 'Read 10 pages', emoji: '📚', color: '#7C5CFC', createdAt: '2026-10-02T08:00:00.000Z', doneDates: [] },
];
// ---
type HabitRowProps = {
  habit: Habit;
  isSelected: boolean;
  onSelect: (id: string) =&gt; void;
};
// ---
function HabitRow({ habit, isSelected, onSelect }: HabitRowProps) {
  return (
    &lt;Text
      onPress={() =&gt; onSelect(habit.id)}
      style={[styles.row, { borderColor: habit.color }, isSelected &amp;&amp; styles.selected]}&gt;
      {habit.emoji} {habit.name}
    &lt;/Text&gt;
  );
}
// ---
export default function Index() {
  const [habits] = useState&lt;Habit[]&gt;(starterHabits);
  const [selectedId, setSelectedId] = useState&lt;string | null&gt;(null);
  const selected = habits.find((h) =&gt; h.id === selectedId) ?? null;
  // ---
  return (
    &lt;View style={styles.container}&gt;
      {habits.map((habit) =&gt; (
        &lt;HabitRow key={habit.id} habit={habit} isSelected={habit.id === selectedId} onSelect={setSelectedId} /&gt;
      ))}
      &lt;Text style={styles.hint}&gt;Selected: {selected?.name ?? 'none'}&lt;/Text&gt;
    &lt;/View&gt;
  );
}
// ---
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  row: { fontSize: 18, padding: 12, borderWidth: 2, borderRadius: 12 },
  selected: { backgroundColor: '#F5F3FF' },
  hint: { marginTop: 8, color: '#666666' },
});
</code></pre>
