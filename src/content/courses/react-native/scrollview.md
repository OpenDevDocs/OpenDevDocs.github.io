---
publishDate: 2026-10-22T02:00
title: Scrolling Content with ScrollView
slug: scrollview
metadescription: 'Learn how ScrollView works in React Native: vertical and horizontal scrolling, contentContainerStyle, pull to refresh, scrolling in code and when to use FlatList.'
updateDate: 2026-10-22T02:00
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'scrollview', 'core-components']
course: react-native
---

## Screens do not scroll on their own

Here is a surprise if you come from the web: in React Native, a screen does **not** scroll by default. If you put 30 `Text` lines in a `View`, the ones that do not fit are simply cut off at the bottom. You cannot reach them.

On the web, the browser scrolls the page for you. On a phone, scrolling is a native component that you have to add on purpose. The simplest one is **`ScrollView`**. In this lesson you will make content scroll up and down and sideways, add pull-to-refresh, scroll in code, and learn when `ScrollView` is the wrong tool.

## Your first ScrollView

Swap the outer `View` for a `ScrollView` and the content becomes scrollable:

```tsx
// src/app/index.tsx
import { ScrollView, StyleSheet, Text } from 'react-native';

const tips = Array.from({ length: 30 }, (_, i) => `Habit tip number ${i + 1}`);

export default function Index() {
  return (
    <ScrollView style={styles.screen}>
      {tips.map((tip) => (
        <Text key={tip} style={styles.tip}>
          {tip}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  tip: { fontSize: 18, padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
});
```

Now you can drag the list with your finger. When you reach the end, iOS gives a little bounce, and Android shows a glow or stretch effect. Those are native behaviors you get for free.

`Array.from({ length: 30 }, ...)` is just a quick way to make 30 fake strings. If `.map` and `key` look new, read [Lists and Keys](/courses/react/lists-and-keys) from the React course.

## A ScrollView needs a limited height

A `ScrollView` can only scroll if it knows how tall it is allowed to be. Think of it as a window: the window has a fixed size, and the content slides behind it. If the window grows to fit all the content, there is nothing left to scroll.

In practice this means the `ScrollView`, or the `View` around it, needs to fill the available space, usually with `flex: 1`. This breaks scrolling:

```tsx
// the outer View has no flex, so it grows with its content
<View>
  <ScrollView>{/* lots of content */}</ScrollView>
</View>
```

This works:

```tsx
<View style={{ flex: 1 }}>
  <ScrollView>{/* lots of content */}</ScrollView>
</View>
```

You will learn exactly what `flex: 1` does in [Layout with Flexbox](/courses/react-native/flexbox-layout). For now: "fill the space the parent gives me".

## style vs contentContainerStyle

A `ScrollView` is really two boxes:

1. The **outer box** (the window). Style it with `style`.
2. The **inner box** that holds your content and moves when you scroll. Style it with `contentContainerStyle`.

```text
+---------------------------+  <- style (the window, fixed size)
| +-----------------------+ |
| | content line 1        | |  <- contentContainerStyle (moves)
| | content line 2        | |
| | content line 3        | |
+-|-----------------------|-+
  | content line 4        |      (hidden until you scroll)
  | content line 5        |
  +-----------------------+
```

Padding, `gap`, `alignItems` and `justifyContent` for your content usually belong on the inner box:

```tsx
<ScrollView
  style={{ flex: 1, backgroundColor: '#fff' }}
  contentContainerStyle={{ padding: 24, gap: 12 }}
>
  {/* cards */}
</ScrollView>
```

If you put `padding` on `style` instead, the padding stays fixed around the window and the content gets cut off at the padding line, which looks odd. And if you try `alignItems` or `justifyContent` on `style`, React Native shows an error telling you to use `contentContainerStyle`.

A handy trick: to center a short piece of content but still scroll when it gets long, use `contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}`. `flexGrow: 1` lets the inner box be at least as tall as the window.

## Scrolling sideways

Add `horizontal` and the content scrolls left and right. The children are laid out in a row automatically.

```tsx
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
>
  {days.map((day) => (
    <Text key={day} style={{ padding: 12, borderRadius: 20, backgroundColor: '#F3F0FF' }}>
      {day}
    </Text>
  ))}
</ScrollView>
```

`showsHorizontalScrollIndicator={false}` hides the little scroll bar. (There is also `showsVerticalScrollIndicator` for normal scroll views.) This is how many apps build a row of "chips" or a carousel.

A horizontal `ScrollView` inside a vertical screen will try to be as tall as the space it gets. If it looks taller than expected, give it `style={{ flexGrow: 0 }}` so it only takes the height of its content.

### Paging

`pagingEnabled` makes the scroll view stop at whole "pages", where one page is the width of the scroll view. Combine it with children that are exactly the screen width and you have a simple swipe-through onboarding screen. You will learn how to get the screen width in [Sizes, Dimensions and Different Screens](/courses/react-native/sizes-and-dimensions).

## Pull to refresh

Most apps let you pull a list down to reload it. A `ScrollView` supports this through the `refreshControl` prop, which takes a `RefreshControl` element:

```tsx
import { useState } from 'react';
import { RefreshControl, ScrollView, Text } from 'react-native';

export default function Tips() {
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // pretend to load
    setRefreshing(false);
  }

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text>Pull me down</Text>
    </ScrollView>
  );
}
```

- `refreshing` tells the spinner whether to show. You own this state.
- `onRefresh` runs when the user pulls down far enough. Set `refreshing` to `true`, load your data, then set it back to `false`.

If you forget to set `refreshing` back to `false`, the spinner spins forever. You can color it with `tintColor` (iOS) and `colors={['#7C5CFC']}` (Android, an array). You will use this with real data in [Loading States, Errors and Pull to Refresh](/courses/react-native/loading-and-refreshing).

## Scrolling from code

Sometimes you want a button that jumps back to the top. For that you need a **ref** (a handle to the real native scroll view) and its `scrollTo` method:

```tsx
import { useRef } from 'react';
import { Button, ScrollView, type ScrollViewInstance } from 'react-native';

const scrollRef = useRef<ScrollViewInstance>(null);

<ScrollView ref={scrollRef}>{/* content */}</ScrollView>
<Button title="Back to top" onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
```

`scrollTo({ x, y, animated })` moves to a position in points. `scrollToEnd({ animated: true })` jumps to the very bottom, which is useful for chat screens. `ScrollViewInstance` is the type React Native exports for this ref.

## Two more useful props

- **`keyboardShouldPersistTaps="handled"`**: by default, if the keyboard is open and you tap a button inside a `ScrollView`, the first tap only closes the keyboard and the button does not fire. With `"handled"`, taps on buttons work right away. Use it on any scrolling form. More in [Handling the Keyboard](/courses/react-native/keyboard-handling).
- **`stickyHeaderIndices={[0]}`**: makes the child at that index stick to the top while the rest scrolls under it.

## When NOT to use ScrollView

`ScrollView` draws **all** of its children at once, even the ones far off screen. For 20 or 50 items that is fine. For 1,000 habits, messages or photos, it means building 1,000 rows before the screen even appears, which is slow and uses a lot of memory.

For long lists, or lists whose length you do not know (like data from an API), use **`FlatList`**. It only draws the rows that are on screen (and a few around them) and reuses memory as you scroll. That is the next lesson: [Long Lists with FlatList](/courses/react-native/flatlist).

A good rule:

- Fixed, short content (a settings page, a profile, an article): `ScrollView`.
- A list of items from data, especially if it can grow: `FlatList` or `SectionList`.

## Putting it together in HabitHop

The code panel at the bottom builds a first sketch of the HabitHop "Today" screen:

- A horizontal row of day chips at the top (a `ScrollView` with `horizontal`). Tapping a chip selects that day.
- A vertical `ScrollView` of a few habit cards, with padding and `gap` on `contentContainerStyle`.
- Pull to refresh that pretends to reload for one second.
- A "Back to top" link at the bottom that scrolls up with a ref.

The habits here are a fixed list of five, so `ScrollView` is fine. Once habits come from real state that can grow, you will switch to `FlatList`.

## Common mistakes

**1. The screen does not scroll.** You used a `View` as the outer container. Content past the bottom is just cut off. Use a `ScrollView`.

**2. The ScrollView does not scroll even though you used one.** Usually a parent `View` has no `flex: 1`, so the `ScrollView` grows to fit everything and has nothing to scroll. Give the parent (or the `ScrollView`) `flex: 1`.

**3. Layout error about alignItems.** React Native shows an error like `ScrollView child layout (["alignItems"]) must be applied through the contentContainerStyle prop.` Move `alignItems` and `justifyContent` into `contentContainerStyle`.

**4. A huge list feels slow.** You rendered hundreds of items with `.map` inside a `ScrollView`. Switch to `FlatList`.

## Quick recap

- Screens do not scroll by default; wrap content in a `ScrollView`.
- A `ScrollView` needs a limited height, usually `flex: 1` on it or its parent.
- `style` styles the window; `contentContainerStyle` styles the moving content (padding, gap, alignment).
- `horizontal` scrolls sideways; `pagingEnabled` snaps to whole pages.
- `refreshControl={<RefreshControl refreshing onRefresh />}` adds pull to refresh.
- A ref gives you `scrollTo` and `scrollToEnd`.
- `ScrollView` renders everything at once, so use `FlatList` for long or growing lists.

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
// A first sketch of the HabitHop "Today" screen
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const habits = ['💧 Drink water', '📚 Read 10 pages', '🧘 Meditate', '🚶 Walk 20 minutes', '🦷 Floss'];
export default function Index() {
  const [day, setDay] = useState('Mon');
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef&lt;ScrollViewInstance&gt;(null);
  async function onRefresh() {
    setRefreshing(true);
    await new Promise((resolve) =&gt; setTimeout(resolve, 1000)); // pretend to load
    setRefreshing(false);
  }
  return (
    &lt;View style={styles.screen}&gt;
      &lt;ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.days} contentContainerStyle={styles.daysContent}&gt;
        {days.map((d) =&gt; (
          &lt;Pressable key={d} onPress={() =&gt; setDay(d)} style={[styles.chip, d === day &amp;&amp; styles.chipActive]}&gt;
            &lt;Text style={d === day ? styles.chipTextActive : undefined}&gt;{d}&lt;/Text&gt;
          &lt;/Pressable&gt;
        ))}
      &lt;/ScrollView&gt;
      &lt;ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.list}
        refreshControl={&lt;RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C5CFC']} tintColor="#7C5CFC" /&gt;}
      &gt;
        {habits.map((habit) =&gt; (
          &lt;Text key={habit} style={styles.card}&gt;{habit}&lt;/Text&gt;
        ))}
        &lt;Pressable onPress={() =&gt; scrollRef.current?.scrollTo({ y: 0, animated: true })}&gt;
          &lt;Text style={styles.link}&gt;Back to top&lt;/Text&gt;
        &lt;/Pressable&gt;
      &lt;/ScrollView&gt;
    &lt;/View&gt;
  );
}
// ---
const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 60, backgroundColor: '#fff' },
  days: { flexGrow: 0 },
  daysContent: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#F3F0FF' },
  chipActive: { backgroundColor: '#7C5CFC' },
  chipTextActive: { color: 'white', fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  card: { fontSize: 18, padding: 20, borderRadius: 16, backgroundColor: '#F3F0FF', overflow: 'hidden' },
  link: { textAlign: 'center', color: '#7C5CFC', padding: 16 },
});
</code></pre>
