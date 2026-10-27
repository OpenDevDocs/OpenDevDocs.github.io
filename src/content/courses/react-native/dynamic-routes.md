---
publishDate: 2026-10-23T09:30
title: Dynamic Routes and Route Params
slug: dynamic-routes
metadescription: 'Build one HabitHop details screen for every habit with a [id] dynamic route, read params with useLocalSearchParams and set the header title from data.'
updateDate: 2026-10-23T09:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'expo-router', 'navigation', 'params']
course: react-native
---

## One screen, many habits

HabitHop can have 3 habits or 300. You do not want a file for each one (`drink-water.tsx`, `read.tsx`, ...). You want **one** details screen that shows whichever habit was tapped.

That is what a **dynamic route** is: a route file with a part of its name in square brackets. The part in brackets is a **route param** (short for parameter): a placeholder that gets filled from the URL.

| File | Matches | Params |
| --- | --- | --- |
| `src/app/habit/[id].tsx` | `/habit/h1` | `{ id: 'h1' }` |
| | `/habit/1729587000000` | `{ id: '1729587000000' }` |
| `src/app/stats/[year]/[month].tsx` | `/stats/2026/10` | `{ year: '2026', month: '10' }` |

In [Links and Navigating in Code](/courses/react-native/links-and-navigating) you already made each `HabitCard` call `router.push({ pathname: '/habit/[id]', params: { id: item.id } })`. Right now that lands on "Unmatched Route". In this lesson you build the screen it is looking for.

## Step 1: create the file

Make a folder `habit` inside `src/app/`, and a file named exactly `[id].tsx` inside it:

```text
src/app/
  _layout.tsx
  index.tsx
  stats.tsx
  habit/
    [id].tsx
```

Brackets are fine in file names on Windows, macOS and Linux. If your terminal complains when you type the path, put it in quotes: `code "src/app/habit/[id].tsx"`.

## Step 2: read the param with useLocalSearchParams

The hook `useLocalSearchParams` returns the params of the current screen:

```tsx
// src/app/habit/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

export default function HabitDetailsScreen() {
  const { id } = useLocalSearchParams<'/habit/[id]'>();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Habit id: {id}</Text>
    </View>
  );
}
```

The part in angle brackets, `<'/habit/[id]'>`, is a **type argument**: it tells TypeScript which route this is. Thanks to [typed routes](/courses/react-native/expo-router-basics), TypeScript then knows that `id` exists and is a `string`. You can also describe the params yourself, which works with or without typed routes:

```tsx
const { id } = useLocalSearchParams<{ id: string }>();
```

Tap "Drink water" on the Today screen. What you will see: a new screen slides in with the text "Habit id: h1" and a back arrow. Tap "Read 10 pages" and you get "Habit id: h2". One file, every habit.

### Params are always strings

URLs are text, so params are **strings**. Even if you pass a number, `params: { id: 42 }`, the screen receives `'42'`. If you need a number, convert it:

```tsx
const { year } = useLocalSearchParams<{ year: string }>();
const yearNumber = Number(year); // 2026
```

HabitHop ids are strings already (`'h1'`, or `Date.now().toString()` for new habits), so nothing to convert here.

## Step 3: load the habit from context

An id on its own is not very useful. You want the whole habit, its streak and buttons. In [useReducer and Custom Hooks](/courses/react-native/usereducer-and-custom-hooks) you wrote `useHabit(id)` for exactly this moment:

```ts
// src/hooks/useHabit.ts (from the custom hooks lesson)
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

So the screen only needs one line to get everything:

```tsx
const { habit, streak, doneToday, toggle, remove } = useHabit(id);
```

This is a nice example of passing **only the id** through the URL and reading the rest from shared state. Do not try to pass the whole habit object as params. URLs can only carry short strings, and the data could be out of date by the time the screen opens.

## Step 4: handle "not found"

What if the id is wrong? Maybe a link points to a deleted habit, or someone types `/habit/nope`. `habit` is then `undefined`, and TypeScript forces you to deal with it before you can read `habit.name`:

```tsx
if (!habit) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Text>This habit does not exist.</Text>
    </View>
  );
}
```

## Step 5: a title from data

The header says "habit/[id]" by default, which is not pretty. Set a fallback title in the root layout:

```tsx
// src/app/_layout.tsx
<Stack>
  <Stack.Screen name="index" options={{ title: 'HabitHop' }} />
  <Stack.Screen name="habit/[id]" options={{ title: 'Habit' }} />
</Stack>
```

Note that the `name` is the full path from the layout's folder: `habit/[id]`, brackets included.

Then, inside the screen, replace it with the real name once the habit is loaded. As you saw in [Stack Navigation and Headers](/courses/react-native/stack-navigation), a `Stack.Screen` rendered inside a screen updates that screen's header:

```tsx
<Stack.Screen options={{ title: `${habit.emoji} ${habit.name}` }} />
```

What you will see: the header shows "Habit" for a split second at most, then "💧 Drink water".

## Step 6: actions on the details screen

The details screen gets two buttons: one to tick today, one to delete the habit. After deleting, the habit no longer exists, so you leave the screen with `router.back()`:

```tsx
<Button title={doneToday ? 'Undo today' : 'Mark done today'} onPress={toggle} />
<Button
  title="Delete habit"
  color="#DC2626"
  onPress={() => {
    remove();
    router.back();
  }}
/>
```

Tick a habit here, then go back. The Today list already shows the tick, because both screens read from the same `HabitsProvider`.

The complete screen is in the code panel.

## Query params and useGlobalSearchParams

Anything you pass in `params` that is not part of the file name becomes a **query param**:

```tsx
router.push({ pathname: '/habit/[id]', params: { id: 'h1', from: 'stats' } });
// URL: /habit/h1?from=stats
```

Read it the same way:

```tsx
const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
```

Query params are optional, so mark them with `?` in the type and give a default when you use them (`from ?? 'today'`).

You might also spot a second hook, `useGlobalSearchParams`. The difference:

- `useLocalSearchParams` gives the params of **this** screen. If you push `/habit/h1` and then `/habit/h2` on top, the `h1` screen underneath still sees `id: 'h1'`. This is what you want almost always.
- `useGlobalSearchParams` gives the params of whatever screen is **currently in focus** anywhere in the app. Screens underneath re-render each time the URL changes. Use it rarely, for things like an analytics component in a layout.

## Catch-all routes

One more pattern, good to know: three dots inside the brackets make a **catch-all** route that matches any number of path parts.

```text
src/app/docs/[...path].tsx   matches /docs/a, /docs/a/b, /docs/a/b/c
```

The param is then an **array** of strings: `/docs/a/b` gives `{ path: ['a', 'b'] }`. HabitHop does not need one, but you will see them in content-heavy apps.

## Common mistakes

**Wrong folder or file name.** `src/app/habit/id.tsx` (no brackets) is a normal route that only matches `/habit/id`. `src/app/[habit]/id.tsx` puts the param in the wrong place. Check the path in `/_sitemap` while the dev server runs.

**Treating a param as a number.** `if (id === 1)` is never true, because `id` is `'1'`. Compare strings, or convert with `Number(id)`.

**Forgetting params in an href object.** With typed routes, this is a compile error:

```text
Property 'params' is missing in type '{ pathname: "/habit/[id]"; }' but required in type '{ pathname: "/habit/[id]"; params: UnknownInputParams & { id: string | number; }; }'.
```

Add `params: { id: habit.id }`.

**Passing whole objects as params.** `params: { habit }` does not work the way you hope: params are turned into URL text. Pass the id and look up the rest from context.

## Quick recap

- A file like `src/app/habit/[id].tsx` is a dynamic route. It matches `/habit/h1`, `/habit/h2` and so on.
- `useLocalSearchParams<'/habit/[id]'>()` (or `<{ id: string }>`) gives you `{ id }`. Params are always strings.
- Pass only ids through the URL. Load the real data from context with a hook like `useHabit(id)`, and handle the "not found" case.
- Set a fallback title with `<Stack.Screen name="habit/[id]">` in the layout, and the real title with `<Stack.Screen options>` inside the screen.
- Extra params become query params. `useLocalSearchParams` is for this screen, `useGlobalSearchParams` follows the focused screen.
- `[...path].tsx` is a catch-all route whose param is an array.

Next up, HabitHop gets a tab bar in [Tab Navigation](/courses/react-native/tab-navigation).

<code id="code-content" class="language-tsx">
// src/app/habit/[id].tsx
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Text, View } from 'react-native';
import { useHabit } from '@/hooks/useHabit';
export default function HabitDetailsScreen() {
  const { id } = useLocalSearchParams&lt;'/habit/[id]'&gt;();
  const router = useRouter();
  const { habit, streak, doneToday, toggle, remove } = useHabit(id);
  if (!habit) {
    return (
      &lt;View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}&gt;
        &lt;Stack.Screen options={{ title: 'Not found' }} /&gt;
        &lt;Text&gt;This habit does not exist.&lt;/Text&gt;
      &lt;/View&gt;
    );
  }
  return (
    &lt;View style={{ flex: 1, padding: 24, gap: 12 }}&gt;
      &lt;Stack.Screen options={{ title: `${habit.emoji} ${habit.name}` }} /&gt;
      &lt;Text style={{ fontSize: 20 }}&gt;🔥 {streak} day streak&lt;/Text&gt;
      &lt;Button title={doneToday ? 'Undo today' : 'Mark done today'} onPress={toggle} /&gt;
      &lt;Button
        title="Delete habit"
        color="#DC2626"
        onPress={() =&gt; {
          remove();
          router.back();
        }}
      /&gt;
    &lt;/View&gt;
  );
}
</code></pre>
