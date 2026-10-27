---
publishDate: 2026-10-22T03:30
title: Long Lists with FlatList
slug: flatlist
metadescription: 'Learn how to show long lists in React Native with FlatList: data, renderItem, keyExtractor, headers, empty states, grids, pull to refresh and loading more.'
updateDate: 2026-10-22T03:30
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'flatlist', 'lists', 'core-components']
course: react-native
---

## Why lists need a special component

Lists are everywhere in phone apps: chats, emails, songs, products, and in our case, habits. In the [ScrollView lesson](/courses/react-native/scrollview) you saw that a `ScrollView` draws every child at once. That is fine for 20 items, but a list of 2,000 would be slow to open and would eat memory.

**`FlatList`** solves this. It is a scrolling list that only draws the rows you can see (plus a few above and below). As you scroll, rows that leave the screen are thrown away and new ones are drawn. This idea is called **virtualization**, and the React course explains it in [List Virtualisation](/courses/react/list-virtualisation). With `FlatList` you get it for free.

In this lesson you will put HabitHop's habits in a `FlatList`: you will make the `HabitCard` from [View and Text: The Building Blocks](/courses/react-native/view-and-text) tappable, then show one card per habit, with a header, an empty state and pull to refresh. You will use the `Habit` type (`src/types/habit.ts`) and the `todayKey()` and `isDoneToday()` helpers (`src/lib/dates.ts`) from [Just Enough TypeScript for React Native](/courses/react-native/typescript-basics).

## The simplest FlatList

`FlatList` needs two props:

- `data`: an array of items.
- `renderItem`: a function that turns one item into the component to show.

```tsx
// src/app/index.tsx
import { FlatList, Text } from 'react-native';

const names = ['Drink water', 'Read 10 pages', 'Meditate', 'Walk 20 minutes'];

export default function Index() {
  return (
    <FlatList
      data={names}
      renderItem={({ item }) => <Text style={{ fontSize: 18, padding: 16 }}>{item}</Text>}
      keyExtractor={(item) => item}
    />
  );
}
```

Notice that `renderItem` does not receive the item directly. It receives an object, and the item is in its `item` field. That is why you see `({ item }) =>`. The same object also has `index` (the position in the array) if you need it.

`FlatList` scrolls by itself, so you do not wrap it in a `ScrollView`. It is a scroll view already.

## Keys: keyExtractor

Like `.map()` in React, a list needs a unique **key** for every row, so React knows which row is which when the data changes (see [Lists and Keys](/courses/react/lists-and-keys)). With `FlatList` you do not write `key=` on the row. Instead you pass `keyExtractor`, a function that returns a unique string for an item:

```tsx
keyExtractor={(habit) => habit.id}
```

If you leave it out, `FlatList` looks for an `item.key` field, then an `item.id` field, and finally falls back to the index. Index keys break when you add, remove or reorder items, so for real data always use a stable id.

## Making HabitCard tappable

In the View and Text lesson you built a static `HabitCard` with a `habit`, a `streak` number and an `isDone` flag. Its done circle was a plain `View`, so tapping it did nothing. Now add one optional prop, `onToggle`, and turn the circle into a `Pressable` (from [Buttons and Pressable](/courses/react-native/buttons-and-pressable)):

```tsx
// src/components/HabitCard.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Habit } from '@/types/habit';

type HabitCardProps = {
  habit: Habit;
  streak: number;
  isDone: boolean;
  onToggle?: () => void; // new: called when the done circle is tapped
};

export function HabitCard({ habit, streak, isDone, onToggle }: HabitCardProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.emojiCircle, { backgroundColor: habit.color + '22' }]}>
        <Text style={styles.emoji}>{habit.emoji}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{habit.name}</Text>
        <Text style={styles.streak}>🔥 {streak} {streak === 1 ? 'day' : 'days'}</Text>
      </View>
      <Pressable
        onPress={onToggle}
        disabled={!onToggle}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityLabel={`Mark ${habit.name} as done`}
        accessibilityState={{ checked: isDone }}
        style={({ pressed }) => [
          styles.doneCircle,
          { borderColor: habit.color },
          isDone && { backgroundColor: habit.color },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Text style={styles.doneMark}>{isDone ? '✓' : ''}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF' },
  emojiCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24 },
  info: { flex: 1 },
  name: { fontSize: 17, fontWeight: '600', color: '#1F1F1F' },
  streak: { fontSize: 14, color: '#666666', marginTop: 2 },
  doneCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  doneMark: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});
```

The card still does not know how to change a habit. It only shows data and calls `onToggle` when the circle is tapped. The screen that owns the data decides what toggling means. Keeping components "dumb" like this makes them easy to reuse. Because `onToggle` is optional, the old static use (`<HabitCard habit={water} streak={4} isDone />`) still works: the circle is simply `disabled`.

## Showing the cards in a FlatList

Now the screen keeps the habits in state and renders one `HabitCard` per habit:

```tsx
<FlatList
  data={habits}
  keyExtractor={(habit) => habit.id}
  renderItem={({ item }) => (
    <HabitCard
      habit={item}
      streak={item.doneDates.length}
      isDone={isDoneToday(item.doneDates)}
      onToggle={() => toggle(item.id)}
    />
  )}
  contentContainerStyle={{ padding: 16, gap: 12 }}
/>
```

For now the `streak` is simply the number of days the habit was ever done. You will write a real `getStreak()` (counting days in a row) in [State and Props in a Mobile App](/courses/react-native/state-and-props).

`contentContainerStyle` works just like on `ScrollView`: padding and gap go on the moving content, not on the outer window. The full screen, with the `toggle` function, is in the code panel at the bottom.

When you tap a done button, `toggle` creates a **new** array with a changed habit and calls `setHabits`. `FlatList` sees a new `data` array and redraws the rows that changed. Never change the array in place (with `push` or by editing an item directly): `FlatList` would not notice and the screen would not update.

## Headers, footers, separators and empty lists

`FlatList` has slots for the extra pieces almost every list needs. Each one takes a component or an element:

```tsx
<FlatList
  data={habits}
  keyExtractor={(habit) => habit.id}
  renderItem={({ item }) => <Text>{item.name}</Text>}
  ListHeaderComponent={<Text style={{ fontSize: 28, fontWeight: 'bold' }}>Today</Text>}
  ListFooterComponent={<Text style={{ color: '#888' }}>Keep going, Sam!</Text>}
  ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#eee' }} />}
  ListEmptyComponent={<Text>No habits yet. Add your first one!</Text>}
/>
```

- `ListHeaderComponent` is shown above the first row and scrolls with the list. Perfect for a screen title or a summary.
- `ListFooterComponent` is shown after the last row. Often used for a "loading more" spinner.
- `ItemSeparatorComponent` is drawn **between** rows (not above the first or after the last).
- `ListEmptyComponent` is shown instead of rows when `data` is an empty array. Every list needs a friendly empty state. HabitHop will get a proper `EmptyState` component later in the course.

Why use the header slot instead of putting a `Text` above the `FlatList`? Because a `Text` above the list stays fixed while the list scrolls under it. The header scrolls away with the rows, which usually feels more natural on a phone.

## Pull to refresh, built in

`FlatList` has pull to refresh without a separate `RefreshControl`. Just pass two props:

```tsx
<FlatList
  data={habits}
  renderItem={renderHabit}
  refreshing={refreshing}
  onRefresh={reload}
/>
```

The rules are the same as in the ScrollView lesson: you own the `refreshing` boolean, set it to `true` while loading and back to `false` when done.

## Loading more at the end

For long lists from a server, you often load 20 items, then the next 20 when the user nears the bottom. `onEndReached` makes this easy:

```tsx
<FlatList
  data={quotes}
  renderItem={renderQuote}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
/>
```

`onEndReachedThreshold={0.5}` means "call `onEndReached` when the end is less than half a screen away". It can be called more than once, so guard your `loadMore` function with a "loading" flag. You will do this with real data in [Fetching Data from an API](/courses/react-native/fetching-data).

## Grids and horizontal lists

Two more layouts come almost free:

```tsx
// A grid with 2 columns
<FlatList data={habits} numColumns={2} renderItem={renderTile} keyExtractor={(h) => h.id} />

// A sideways list
<FlatList data={habits} horizontal renderItem={renderTile} keyExtractor={(h) => h.id} />
```

With `numColumns`, give each tile `flex: 1` so the columns share the width. `columnWrapperStyle={{ gap: 12 }}` adds space between the tiles in a row. One gotcha: you cannot change `numColumns` while the list is on screen. If you need to switch layouts, also change the list's `key` prop so React creates a fresh list.

## A note on speed

`FlatList` is fast for most apps out of the box. A few tips if a list ever feels slow:

- Keep `renderItem` rows simple and avoid heavy work inside them.
- If every row has the same fixed height, `getItemLayout` lets the list skip measuring rows.
- HabitHop has the **React Compiler** turned on (it is on by default in new Expo projects), so you rarely need `useCallback` or `memo` for your `renderItem` function.

The [Making Your App Fast](/courses/react-native/performance) lesson goes into detail.

## Common mistakes

**1. A FlatList inside a ScrollView.** You see the warning `VirtualizedLists should never be nested inside plain ScrollViews with the same orientation because it can break windowing and other functionality - use another VirtualizedList-backed container instead.` The outer `ScrollView` makes the list draw every row, so virtualization is lost. Remove the `ScrollView` and move the other content into `ListHeaderComponent` or `ListFooterComponent`.

**2. Index keys.** If your items have neither a `key` nor an `id` field, the list uses the index as the key. Rows then show the wrong state after you delete or reorder one. Add a `keyExtractor` that returns a stable, unique string for each item, and be explicit even when an `id` exists: `keyExtractor={(habit) => habit.id}`.

**3. Changing the array in place.** You write `habits[0].doneDates.push(todayKey())` and the screen does not update. Always build a new array (and a new object for the changed item), as the `toggle` function in the code panel does.

**4. The list does not fill the screen or does not scroll.** Same as `ScrollView`: the list needs a limited height. Make sure its parent has `flex: 1`.

## Quick recap

- `FlatList` only draws the rows on screen, so it stays fast with long lists.
- It needs `data` and `renderItem`; `renderItem` gets `{ item, index }`.
- Always give a stable `keyExtractor`, such as `(habit) => habit.id`.
- `ListHeaderComponent`, `ListFooterComponent`, `ItemSeparatorComponent` and `ListEmptyComponent` cover the common extras.
- `refreshing` and `onRefresh` add pull to refresh; `onEndReached` loads more.
- `numColumns` makes a grid and `horizontal` makes a sideways list.
- Never nest a `FlatList` inside a vertical `ScrollView`, and never change the data array in place.

Next, you will group habits into "Morning" and "Evening" with [Grouped Lists with SectionList](/courses/react-native/sectionlist).

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { HabitCard } from '@/components/HabitCard';
import { isDoneToday, todayKey } from '@/lib/dates';
import type { Habit } from '@/types/habit';
const startHabits: Habit[] = [
  { id: 'h1', name: 'Drink water', emoji: '💧', color: '#0EA5E9', createdAt: '2026-10-01T08:00:00.000Z', doneDates: ['2026-10-20'] },
  { id: 'h2', name: 'Read 10 pages', emoji: '📚', color: '#7C5CFC', createdAt: '2026-10-01T08:00:00.000Z', doneDates: [] },
  { id: 'h3', name: 'Walk 20 minutes', emoji: '🚶', color: '#22C55E', createdAt: '2026-10-02T08:00:00.000Z', doneDates: [] },
];
export default function Index() {
  const [habits, setHabits] = useState(startHabits);
  // Build a NEW array with a NEW habit object, never change state in place
  function toggle(id: string) {
    setHabits((current) =&gt;
      current.map((habit) =&gt; {
        if (habit.id !== id) return habit;
        const today = todayKey();
        const done = habit.doneDates.includes(today);
        const doneDates = done ? habit.doneDates.filter((d) =&gt; d !== today) : [...habit.doneDates, today];
        return { ...habit, doneDates };
      }),
    );
  }
  return (
    &lt;FlatList
      style={styles.list}
      data={habits}
      keyExtractor={(habit) =&gt; habit.id}
      renderItem={({ item }) =&gt; (
        &lt;HabitCard habit={item} streak={item.doneDates.length} isDone={isDoneToday(item.doneDates)} onToggle={() =&gt; toggle(item.id)} /&gt;
      )}
      ListHeaderComponent={&lt;Text style={styles.title}&gt;Today&lt;/Text&gt;}
      ListEmptyComponent={&lt;Text style={styles.empty}&gt;No habits yet. Add your first one!&lt;/Text&gt;}
      contentContainerStyle={styles.content}
    /&gt;
  );
}
// ---
const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#F6F6F8' },
  content: { padding: 16, paddingTop: 60, gap: 12 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 4 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
});
</code></pre>
