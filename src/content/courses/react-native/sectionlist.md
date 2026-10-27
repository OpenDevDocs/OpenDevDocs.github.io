---
publishDate: 2026-10-22T05:00
title: Grouped Lists with SectionList
slug: sectionlist
metadescription: 'Learn how to show grouped lists in React Native with SectionList: the sections data shape, section headers, sticky headers and building sections from an array.'
updateDate: 2026-10-22T05:00
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'sectionlist', 'lists', 'core-components']
course: react-native
---

## Lists with groups

Open the contacts app on your phone. Names are grouped under letters: A, B, C. Open a settings screen: options are grouped under titles like "Account" and "Notifications". A list split into groups, each with a heading, is so common that React Native has a component just for it: **`SectionList`**.

`SectionList` is the grouped cousin of `FlatList`. It is just as fast (it also only draws what is on screen), and it adds **section headers**: a title row at the start of each group. If you have not read [Long Lists with FlatList](/courses/react-native/flatlist) yet, do that first, because most props work the same way.

In this lesson you will group HabitHop habits into "Morning" and "Evening" sections.

## The sections data shape

A `FlatList` takes a flat array in `data`. A `SectionList` takes an array of **sections** in a prop called `sections`. Each section is an object with a `data` array of its own, plus any extra fields you like, such as a `title`:

```ts
const sections = [
  { title: 'Morning', data: ['Drink water', 'Meditate', 'Stretch'] },
  { title: 'Evening', data: ['Read 10 pages', 'Floss'] },
];
```

The field must be called `data`. That is how `SectionList` finds the items of each group. Everything else on the section (like `title`) is yours to name.

## The simplest SectionList

```tsx
// src/app/index.tsx
import { SectionList, StyleSheet, Text } from 'react-native';

const sections = [
  { title: 'Morning', data: ['Drink water', 'Meditate', 'Stretch'] },
  { title: 'Evening', data: ['Read 10 pages', 'Floss'] },
];

export default function Index() {
  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item}
      renderItem={({ item }) => <Text style={styles.item}>{item}</Text>}
      renderSectionHeader={({ section }) => <Text style={styles.header}>{section.title}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  item: { fontSize: 18, padding: 16, backgroundColor: '#fff' },
  header: { fontSize: 14, fontWeight: 'bold', padding: 8, paddingHorizontal: 16, backgroundColor: '#F3F0FF' },
});
```

On screen you see a lilac "Morning" bar, three items, then an "Evening" bar and two items.

Two functions do the drawing:

- `renderItem` draws one item, exactly like in `FlatList`. It receives `{ item, index, section }`, so a row can also know which section it belongs to.
- `renderSectionHeader` draws the header of a section. It receives `{ section }`, the whole section object, so you can read `section.title` or any other field you added.

TypeScript understands the shape of your sections. If you type `section.titel` by mistake, the editor underlines it, because your sections do not have a `titel` field.

## Sticky headers

Scroll the list on an iPhone and you will notice the current section header **sticks** to the top of the list until the next section pushes it away. On Android, the headers scroll away with the rows.

That is because `stickySectionHeadersEnabled` defaults to `true` on iOS and `false` on Android. To get the same behavior on both, set it yourself:

```tsx
<SectionList
  sections={sections}
  stickySectionHeadersEnabled
  renderItem={({ item }) => <Text>{item}</Text>}
  renderSectionHeader={({ section }) => <Text>{section.title}</Text>}
/>
```

If you use sticky headers, give the header a solid `backgroundColor`. Otherwise the rows scrolling underneath will show through the header text and look messy.

## Section footers and separators

A few more slots are available. All are optional:

- `renderSectionFooter={({ section }) => ...}` draws something after each section, like "3 habits".
- `ItemSeparatorComponent` draws a line between items **inside** a section (not between the last item of one section and the next header).
- `SectionSeparatorComponent` draws something at the top and bottom of each section.
- `ListHeaderComponent`, `ListFooterComponent` and `ListEmptyComponent` work exactly like on `FlatList`.

```tsx
<SectionList
  sections={sections}
  renderItem={({ item }) => <Text style={styles.item}>{item}</Text>}
  renderSectionHeader={({ section }) => <Text style={styles.header}>{section.title}</Text>}
  renderSectionFooter={({ section }) => (
    <Text style={styles.footer}>{section.data.length} habits</Text>
  )}
  ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#eee' }} />}
  ListEmptyComponent={<Text>No habits yet.</Text>}
/>
```

Note that `ListEmptyComponent` only shows when there are **no sections at all**. A section with an empty `data` array still draws its header. That is why you usually remove empty sections before passing them in (you will see how in a moment).

## Extra fields on a section

You can put anything on a section object, and `renderSectionHeader` gets it all. For example, an emoji per part of the day:

```ts
const sections = [
  { title: 'Morning', emoji: '🌅', data: ['Drink water', 'Meditate'] },
  { title: 'Evening', emoji: '🌙', data: ['Read 10 pages'] },
];
```

```tsx
renderSectionHeader={({ section }) => (
  <Text style={styles.header}>
    {section.emoji} {section.title}
  </Text>
)}
```

## Building sections from a flat array

In a real app your data rarely arrives already grouped. You usually have one array of items and a field to group by. HabitHop's `Habit` type does not have a "part of the day" field, so for this practice screen we add one with a small local type:

```ts
import type { Habit } from '@/types/habit';

type PartOfDay = 'Morning' | 'Evening';
type PlannedHabit = Habit & { partOfDay: PartOfDay };
```

`Habit & { partOfDay: PartOfDay }` means "everything a `Habit` has, plus a `partOfDay` field". This `&` is called an **intersection type**.

Then a small function turns the flat array into sections:

```ts
function toSections(habits: PlannedHabit[]) {
  const parts: PartOfDay[] = ['Morning', 'Evening'];
  return parts
    .map((part) => ({
      title: part,
      data: habits.filter((habit) => habit.partOfDay === part),
    }))
    .filter((section) => section.data.length > 0); // drop empty sections
}
```

For each part of the day it builds a section with the matching habits, then removes sections that ended up empty. The order of the `parts` array decides the order of the sections on screen. If the array functions here are new to you, see [Array Methods: map, filter, reduce](/courses/javascript/array-methods-map-filter-reduce).

Because `toSections` is a plain function of your state, you just call it while rendering: `sections={toSections(habits)}`. When `habits` changes, the sections are rebuilt. With the React Compiler on (the default in new Expo projects) you do not need `useMemo` here.

## Putting it together in HabitHop

The code panel at the bottom brings it all together:

- Five practice habits, each with a `partOfDay`.
- `toSections` groups them into "Morning" and "Evening".
- Each row is the `HabitCard` from the [FlatList lesson](/courses/react-native/flatlist), so tapping the circle marks a habit as done.
- Headers are sticky on both platforms, show an emoji and a "2/3 done" count for the section.

The section header can compute that count from `section.data`, because the whole section is passed in. That is a nice example of why extra information on a section object is useful.

Later in the course, habits move into shared state with [Sharing State with Context](/courses/react-native/context-for-shared-state), and you could group them by anything: done vs not done, color, or the day they were created.

## FlatList or SectionList?

- One plain list: `FlatList`.
- A list with headings between groups: `SectionList`.
- A list with only a title on top: `FlatList` with `ListHeaderComponent`. You do not need `SectionList` for a single heading.

## Common mistakes

**1. Naming the items field something else.** You write `{ title: 'Morning', items: [...] }`. TypeScript does not always catch this, but the app crashes with `TypeError: Cannot read property 'length' of undefined`, because `SectionList` reads `section.data.length`. Each section must have a `data` array.

**2. Passing `data` instead of `sections`.** `SectionList` has no `data` prop for the list itself. If you pass `data={sections}`, TypeScript says `Property 'data' does not exist` on the `SectionList` props. Use `sections={sections}`.

**3. See-through sticky headers.** Rows show through the header while scrolling on iOS. Give the header a `backgroundColor`.

**4. Headers different on iOS and Android.** They stick on iOS but scroll away on Android. Set `stickySectionHeadersEnabled` to `true` or `false` explicitly.

## Quick recap

- `SectionList` is a fast, virtualized list with groups and section headers.
- Pass `sections`: an array of objects that each have a `data` array plus your own fields (like `title`).
- `renderItem` draws rows; `renderSectionHeader` draws headers and receives the whole `section`.
- Headers stick on iOS by default but not on Android; set `stickySectionHeadersEnabled` to choose, and give sticky headers a background.
- `renderSectionFooter`, `ItemSeparatorComponent` and `ListEmptyComponent` add the extras.
- Build sections from a flat array with `map` and `filter`, and drop empty sections.

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { useState } from 'react';
import { SectionList, StyleSheet, Text } from 'react-native';
import { HabitCard } from '@/components/HabitCard';
import { isDoneToday, todayKey } from '@/lib/dates';
import type { Habit } from '@/types/habit';
// Practice-only field: the real Habit type has no partOfDay
type PartOfDay = 'Morning' | 'Evening';
type PlannedHabit = Habit &amp; { partOfDay: PartOfDay };
const created = '2026-10-01T08:00:00.000Z';
const startHabits: PlannedHabit[] = [
  { id: 'h1', name: 'Drink water', emoji: '💧', color: '#0EA5E9', createdAt: created, doneDates: [], partOfDay: 'Morning' },
  { id: 'h2', name: 'Meditate', emoji: '🧘', color: '#7C5CFC', createdAt: created, doneDates: [], partOfDay: 'Morning' },
  { id: 'h3', name: 'Stretch', emoji: '🤸', color: '#F97316', createdAt: created, doneDates: [], partOfDay: 'Morning' },
  { id: 'h4', name: 'Read 10 pages', emoji: '📚', color: '#22C55E', createdAt: created, doneDates: [], partOfDay: 'Evening' },
  { id: 'h5', name: 'Floss', emoji: '🦷', color: '#EC4899', createdAt: created, doneDates: [], partOfDay: 'Evening' },
];
const emojis = { Morning: '🌅', Evening: '🌙' };
function toSections(habits: PlannedHabit[]) {
  const parts: PartOfDay[] = ['Morning', 'Evening'];
  return parts
    .map((part) =&gt; ({ title: part, data: habits.filter((h) =&gt; h.partOfDay === part) }))
    .filter((section) =&gt; section.data.length &gt; 0);
}
export default function Index() {
  const [habits, setHabits] = useState(startHabits);
  function toggle(id: string) {
    setHabits((current) =&gt;
      current.map((h) =&gt; {
        if (h.id !== id) return h;
        const today = todayKey();
        const done = h.doneDates.includes(today);
        return { ...h, doneDates: done ? h.doneDates.filter((d) =&gt; d !== today) : [...h.doneDates, today] };
      }),
    );
  }
  return (
    &lt;SectionList
      style={styles.list}
      contentContainerStyle={styles.content}
      sections={toSections(habits)}
      keyExtractor={(habit) =&gt; habit.id}
      stickySectionHeadersEnabled
      renderItem={({ item }) =&gt; (
        &lt;HabitCard habit={item} streak={item.doneDates.length} isDone={isDoneToday(item.doneDates)} onToggle={() =&gt; toggle(item.id)} /&gt;
      )}
      renderSectionHeader={({ section }) =&gt; {
        const done = section.data.filter((h) =&gt; isDoneToday(h.doneDates)).length;
        return (
          &lt;Text style={styles.header}&gt;
            {emojis[section.title]} {section.title} ({done}/{section.data.length} done)
          &lt;/Text&gt;
        );
      }}
    /&gt;
  );
}
// ---
const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#F6F6F8' },
  content: { padding: 16, paddingTop: 60, gap: 8 },
  header: { fontSize: 15, fontWeight: 'bold', paddingVertical: 8, backgroundColor: '#F6F6F8' },
});
</code></pre>
