---
publishDate: 2026-10-24T23:00
title: Making Your App Fast
slug: performance
metadescription: 'Make a React Native app feel fast: measure first, tune FlatList, load images well, keep the JS thread free and let the React Compiler handle memo.'
updateDate: 2026-10-24T23:00
author: ['bishal-biswas']
level: 3
tags: ['react-native', 'performance', 'flatlist', 'expo']
course: react-native
---

## What "fast" means on a phone

A phone app feels fast when two things are true: it reacts the moment you touch it, and scrolling and animations stay smooth. Smooth means about **60 frames per second** (fps), or 120 on newer phones. One **frame** is one picture on the screen. At 60 fps your app has about 16 milliseconds to draw each frame. If it takes longer, a frame is skipped and the user sees a tiny stutter, often called **jank**.

Remember from [How React Native Works Under the Hood](/courses/react-native/how-react-native-works) that your app has more than one thread. A **thread** is a line of work the phone runs at the same time as other lines of work:

- The **JS thread** runs your JavaScript: your components, state updates, `fetch` results and so on. Hermes, the JavaScript engine, lives here.
- The **UI thread** (also called the main thread) draws the native views and handles touches.

Most slowness in React Native comes from the JS thread being busy. While it is busy, it cannot answer a button press or give the list new rows to show. So most of this lesson is about one idea: **do less work on the JS thread, and do it at the right time.**

## Step 1: measure before you fix

Never guess where the slowness is. Measure first, then fix the slowest thing.

Open the dev menu (shake the phone, or press `m` in the terminal where `npx expo start` is running) and turn on the **performance monitor** (the menu may call it "Perf Monitor" or "Toggle performance monitor"). A small box appears on top of your app. Among its numbers are two frame rates:

```text
UI: 60 fps
JS: 60 fps
```

Scroll your list, open a screen, tap a habit. If the **JS** number drops a lot (for example to 20), your JavaScript is doing too much. If the **UI** number drops, the native side is struggling, often because of huge images or too many views.

For a deeper look, press `j` in the terminal to open React Native DevTools (you met it in [Debugging React Native Apps](/courses/react-native/debugging)). The **Profiler** tab records which components render and how long each one takes. Record a few seconds while you scroll, then look for components that render many times or take many milliseconds.

One very important rule: **development mode is slow on purpose.** It runs extra checks and warnings. Before you decide something is "too slow", try it without dev mode:

```bash
npx expo start --no-dev --minify
```

`--no-dev` turns off the development checks and `--minify` makes the JavaScript bundle smaller, like a real release. Many "slow" screens are fine here. The truest test is a real release build made with [EAS Build](/courses/react-native/eas-build) on a real, older phone. Cheap Android phones are much slower than your laptop's simulator.

## The React Compiler does the memo work for you

In older React code you will see `useMemo`, `useCallback` and `memo` everywhere. They tell React "do not redo this work, or do not re-render this component, unless its inputs changed". This is called **memoization**: remembering a result so you can reuse it.

Your project already has the **React Compiler** turned on. Look at `app.json`:

```json
{
  "expo": {
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    }
  }
}
```

The React Compiler is a build step that reads your components and adds memoization automatically, in the places where it is safe. That means in a new Expo app you **rarely need `useMemo`, `useCallback` or `memo` by hand**. Write plain, simple components. If you want to know how the compiler works, read [the React Compiler lesson in the React course](/courses/react/react-compiler).

The compiler only helps components that follow the [Rules of Hooks](/courses/react/rules-of-hooks) and do not change values they should not (for example, changing a prop object directly). If a component breaks the rules, the compiler skips it quietly and the component works as before, just without the free speed. So clean code and fast code go together.

You still use `useMemo` by hand in rare cases, like when you need a value to stay the exact same object for an effect, or in a library that does not use the compiler. Measure first.

## Tuning FlatList

Lists are where most apps get slow. You met `FlatList` in [Long Lists with FlatList](/courses/react-native/flatlist). It is already smart: it only renders the rows near the screen, not all 1,000 of them. This idea is called **virtualization**. With a few props you can make it even better.

### keyExtractor: stable keys

```tsx
// src/components/HabitList.tsx (part)
<FlatList
  data={habits}
  keyExtractor={(item) => item.id}
  renderItem={renderItem}
/>
```

`keyExtractor` gives every row a **key**, a unique name React uses to track the row between renders. Use a real id from your data, like `habit.id`. Never use the array index: if you delete the first habit, every index shifts, and React thinks every row changed, so it redraws them all (and may show the wrong state in a row).

### getItemLayout: skip measuring

When rows have different heights, `FlatList` has to render a row and measure it before it knows where the next row goes. If all your rows are the same height, you can tell it the size up front with `getItemLayout`:

```tsx
// src/components/HabitList.tsx (part)
const ROW_HEIGHT = 88; // 76 for the card + 12 for the gap

<FlatList
  data={habits}
  keyExtractor={(item) => item.id}
  renderItem={renderItem}
  getItemLayout={(_data, index) => ({
    length: ROW_HEIGHT,
    offset: ROW_HEIGHT * index,
    index,
  })}
/>
```

- `length` is the height of one row.
- `offset` is how far from the top that row starts.
- `index` is the row number.

Now `FlatList` can jump straight to row 500 (for example with `scrollToIndex`) without measuring the 499 rows above it. Only use this when the height really is fixed. If you lie (say 88 when rows are really 120), rows overlap or leave gaps. The height includes the separator, so remember to add it. Also remember the user's font size: with very large system fonts (see [Accessibility: Apps Everyone Can Use](/courses/react-native/accessibility)) a row of text can grow taller than you planned. If your rows contain text that may wrap or scale, it is safer to leave `getItemLayout` out.

### windowSize and friends: how much to render

```tsx
<FlatList
  // ...
  initialNumToRender={10}
  maxToRenderPerBatch={10}
  windowSize={11}
/>
```

- `initialNumToRender` is how many rows to draw on the first frame. Make it just enough to fill one screen. Too high and the screen opens slowly.
- `maxToRenderPerBatch` is how many new rows to add each time `FlatList` catches up while you scroll.
- `windowSize` is how much to keep rendered around the visible area, measured in screens. The default is `21`: 10 screens above, the visible screen, and 10 screens below. A smaller number like `11` uses less memory and less JS work, but if the user scrolls very fast they may see blank space for a moment.

Do not change these numbers blindly. Change one, scroll on a real phone, look at the Perf Monitor, and keep it only if it helps.

### Keep rows light

The biggest win is usually a simpler row. Each `HabitCard` should only render what it needs. Avoid heavy work inside `renderItem`, such as sorting the full list or parsing dates for every row on every render. Do that work once, above the list. A good test: if your row component is more than about 100 lines, it is doing too much.

### FlashList: an even faster list

For very long or complex lists, many apps use **FlashList** from Shopify. It has almost the same props as `FlatList` but **recycles** row views: when a row scrolls off the top, its native view is reused for the row coming in at the bottom, instead of throwing it away and making a new one.

```bash
npx expo install @shopify/flash-list
```

```tsx
// src/components/HabitList.tsx (FlashList version)
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={habits}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <HabitCard habit={item} onToggle={toggleToday} />}
/>
```

FlashList is not part of this course's checked setup, so I could not type-check this snippet against your exact version. Read its README after installing. For HabitHop, with a few dozen habits, a tuned `FlatList` is more than enough.

## Images: the quiet memory eater

A photo from a phone camera can be 4000 by 3000 pixels. Showing it in a 48 by 48 pixel avatar still makes the phone **decode** (unpack) the full picture into memory first. Many of these at once and the app slows down or even crashes on Android.

Tips:

- Use `expo-image` (you saw it in [Showing Images](/courses/react-native/images)). It caches images on disk and in memory, and handles decoding well.
- Ask your server for small sizes when you can (many image services take a `?w=96` style parameter).
- Give images a fixed size with `width` and `height`.

```tsx
// src/components/Avatar.tsx
import { Image } from 'expo-image';

export function Avatar({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      style={{ width: 48, height: 48, borderRadius: 24 }}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={200}
    />
  );
}
```

`cachePolicy="memory-disk"` keeps the image in memory and on disk, so scrolling back up does not download it again. `transition={200}` fades it in over 200 ms instead of popping.

## Keeping the JS thread free

Some work has to happen, but it does not all have to happen *right now*.

### Let typing stay smooth with useDeferredValue

Imagine a search box over a long habit list. Every key press filters the list. If filtering is slow, typing feels laggy. React's `useDeferredValue` lets the text box update first, and the slow list catch up a moment later:

```tsx
// src/components/SearchHabits.tsx
import { useDeferredValue, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useHabits } from '@/context/HabitsContext';

export function SearchHabits() {
  const { habits } = useHabits();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const results = habits.filter((h) =>
    h.name.toLowerCase().includes(deferredQuery.toLowerCase()),
  );

  return (
    <View>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search habits" />
      {results.map((h) => (
        <Text key={h.id}>{h.name}</Text>
      ))}
    </View>
  );
}
```

The React course explains this hook in depth in [useDeferredValue](/courses/react/usedeferredvalue), and its sibling `startTransition` in [useTransition and Pending UI](/courses/react/usetransition-and-pending-ui). Both work the same way in React Native.

### Run animations off the JS thread

Animations made with Reanimated run on the UI thread, so they stay smooth even when your JavaScript is busy. That is why [Smooth Animations with Reanimated](/courses/react-native/reanimated-basics) is the right tool for anything that moves with a finger or loops forever.

### Other easy wins

- **Remove `console.log` in hot paths.** Logging inside `renderItem` or a scroll handler is slow in dev mode, and pointless in production.
- **Do not save to storage on every key press.** Save after the user stops typing, or when they leave the screen.
- **Load data once, not on every render.** Fetch in an effect or use [TanStack Query](/courses/react-native/tanstack-query), which caches results for you.
- **Keep state close to where it is used.** If only one row needs some state, put it in that row, not in the screen. Changing state high up in the tree re-renders everything below it.

## Common mistakes

**Using the index as the key.** Symptom: after deleting a habit, the wrong row shows as done, or every row flashes. Fix: `keyExtractor={(item) => item.id}`.

**A wrong `getItemLayout` height.** Symptom: rows overlap, or there are gaps, or `scrollToIndex` lands in the wrong place. Fix: measure the real row height (including the separator) or remove `getItemLayout` if rows can change height.

**Putting a `FlatList` inside a `ScrollView`.** You will see this warning:

```text
VirtualizedLists should never be nested inside plain ScrollViews with the same orientation because it can break windowing and other functionality - use another VirtualizedList-backed container instead.
```

Inside a `ScrollView`, the list cannot know what is on screen, so it renders every row and virtualization is lost. Fix: make the `FlatList` the scrolling container and put extra content in `ListHeaderComponent` or `ListFooterComponent`.

**Judging speed in dev mode.** Symptom: "my app is slow" but only with `npx expo start`. Fix: test with `--no-dev --minify` or a release build before you change code.

## Quick recap

- Smooth means about 16 ms per frame. Most jank comes from a busy JS thread.
- Measure with the Perf Monitor and the React Native DevTools Profiler, and test without dev mode.
- The React Compiler (`experiments.reactCompiler`) is on by default, so hand-written `useMemo`, `useCallback` and `memo` are rarely needed.
- Tune `FlatList` with stable `keyExtractor` keys, `getItemLayout` for fixed heights, and careful `windowSize`, `initialNumToRender` and `maxToRenderPerBatch` values.
- Consider FlashList (`npx expo install @shopify/flash-list`) for very long lists.
- Use `expo-image` with fixed sizes and caching. Avoid huge images in small spaces.
- Use `useDeferredValue` or transitions for slow updates, and Reanimated for animations.

Next, make HabitHop usable for everyone in [Accessibility: Apps Everyone Can Use](/courses/react-native/accessibility).

<code id="code-content" class="language-tsx">
// src/components/HabitList.tsx
import { FlatList, StyleSheet, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { HabitCard } from '@/components/HabitCard';
import { useHabits } from '@/context/HabitsContext';
import type { Habit } from '@/types/habit';
// Every row is the same height: 76 for the card + 12 for the gap.
const ROW_HEIGHT = 88;
function Separator() {
  return &lt;View style={styles.separator} /&gt;;
}
export function HabitList() {
  const { habits, toggleToday } = useHabits();
  // No useCallback needed: the React Compiler memoizes this for us.
  const renderItem = ({ item }: { item: Habit }) =&gt; (
    &lt;HabitCard habit={item} onToggle={toggleToday} /&gt;
  );
  return (
    &lt;FlatList
      data={habits}
      keyExtractor={(item) =&gt; item.id} // stable keys, never the index
      renderItem={renderItem}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={EmptyState}
      // Fixed row height: FlatList can skip measuring rows.
      getItemLayout={(_data, index) =&gt; ({
        length: ROW_HEIGHT,
        offset: ROW_HEIGHT * index,
        index,
      })}
      initialNumToRender={10} // about one screen
      maxToRenderPerBatch={10}
      windowSize={11} // 5 screens above, 5 below
      contentContainerStyle={styles.content}
    /&gt;
  );
}
const styles = StyleSheet.create({
  content: { padding: 16 },
  separator: { height: 12 },
});
</code></pre>
