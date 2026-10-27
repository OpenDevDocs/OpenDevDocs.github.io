---
publishDate: 2026-10-21T20:00
title: 'View and Text: The Building Blocks'
slug: view-and-text
metadescription: 'Learn the two components every React Native screen is built from, View and Text, and use them to build a first static HabitCard for HabitHop.'
updateDate: 2026-10-21T20:00
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'components', 'view', 'text']
course: react-native
---

## Two components, every screen

Look at any app on your phone: a chat, a shop, a settings page. Under the hood, nearly everything you see is either a **box** or some **text**. In React Native those are `View` and `Text`. Learn them well and every other component will feel familiar, because most of them are built on top of these two.

By the end of this lesson you will build a first version of HabitHop's `HabitCard`: a row with an emoji, a habit name, a streak and a "done" circle.

## View: the box

A `View` is a container. It is like a `<div>` on the web: it groups other components, and it can have a size, a background color, a border, rounded corners and padding. On iOS it becomes a native `UIView`; on Android an `android.view.View`.

```tsx
// src/app/index.tsx
import { View } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: '#F5F3FF' }}>
      <View style={{ height: 80, backgroundColor: '#7C5CFC', borderRadius: 16 }} />
    </View>
  );
}
```

What you see: a pale purple screen with a purple, rounded box across the top.

A few things to notice:

- `style` takes an **object**, not a CSS string. Property names are in **camelCase**: `backgroundColor`, not `background-color`.
- Numbers have **no units**. `padding: 24` means 24 **density-independent pixels** (dp), a unit that looks about the same size on every phone, whatever its screen sharpness. You will learn more in [Sizes, Dimensions and Different Screens](/courses/react-native/sizes-and-dimensions).
- `flex: 1` tells the outer `View` to fill all the space it can, so it covers the whole screen.

### Views stack top to bottom

Put several `View`s inside another one and they line up **in a column**, top to bottom. On the web, `div`s also stack, but React Native goes further: every `View` is a Flexbox container, and the default direction is `column`.

```tsx
// src/app/index.tsx
import { View } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, padding: 24, gap: 12 }}>
      <View style={{ height: 60, backgroundColor: '#7C5CFC', borderRadius: 12 }} />
      <View style={{ height: 60, backgroundColor: '#22C55E', borderRadius: 12 }} />
      <View style={{ height: 60, backgroundColor: '#F97316', borderRadius: 12 }} />
    </View>
  );
}
```

`gap: 12` adds 12 dp of space between the children. To put children side by side instead, set `flexDirection: 'row'` on the parent. The full story is in [Layout with Flexbox](/courses/react-native/flexbox-layout); for now, `column` (the default) and `row` are enough.

## Text: everything you can read

`Text` shows text. There is one rule you must remember:

> **Every string must be inside a `Text` component.**

On the web you can drop text straight into a `div`. In React Native, a string directly inside a `View` is an error:

```text
Error: Text strings must be rendered within a <Text> component.
```

So this is how you show words:

```tsx
// src/app/index.tsx
import { Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold' }}>Good morning, Riya</Text>
      <Text style={{ fontSize: 16, color: '#666666', marginTop: 4 }}>
        You have 3 habits to do today.
      </Text>
    </View>
  );
}
```

The text styles you will use most:

```text
fontSize       a number, e.g. 16
fontWeight     'normal', 'bold', or '100' to '900' (also numbers like 600)
color          '#666666', 'red', 'rgb(0, 0, 0)'
textAlign      'left', 'center', 'right'
lineHeight     a number, e.g. 22
fontStyle      'italic'
textTransform  'uppercase', 'lowercase', 'capitalize'
```

### Showing values

Inside `Text`, curly braces work just like in JSX on the web. Numbers and strings show up as text:

```tsx
// src/components/StreakText.tsx
import { Text } from 'react-native';

export function StreakText({ days }: { days: number }) {
  return (
    <Text>
      🔥 {days} {days === 1 ? 'day' : 'days'} in a row
    </Text>
  );
}
```

### Nesting Text inside Text

You can put a `Text` inside another `Text` to style **part** of a sentence. The inner text flows inline, like a `<span>` on the web, and it **inherits** (takes on) the outer text's styles:

```tsx
// src/components/Greeting.tsx
import { Text } from 'react-native';

export function Greeting() {
  return (
    <Text style={{ fontSize: 18, color: '#333333' }}>
      You did <Text style={{ fontWeight: 'bold', color: '#22C55E' }}>2 of 3</Text> habits today!
    </Text>
  );
}
```

The whole sentence is 18 dp and dark gray; "2 of 3" is also bold and green.

Here is the catch: **style inheritance only works from `Text` to `Text`**. A `View` does not pass font styles down. Setting `color` or `fontSize` on a `View` does nothing to the text inside it (TypeScript will even flag it, because `ViewStyle` has no `fontSize`). This is different from CSS, where a `div`'s font settings flow down to everything inside. If you want the same font everywhere, make a small reusable text component; you will see that idea in [Dark Mode and Themes](/courses/react-native/dark-mode-and-themes).

### Long text: numberOfLines

Phone screens are narrow, so long text needs a plan. `numberOfLines` cuts text after that many lines and adds `...`:

```tsx
// src/components/HabitTitle.tsx
import { Text } from 'react-native';

export function HabitTitle({ name }: { name: string }) {
  return (
    <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '600' }}>
      {name}
    </Text>
  );
}
```

A very long habit like "Practice the guitar for thirty minutes after dinner" becomes "Practice the guitar for thirty min..." on one line. `ellipsizeMode` picks where the dots go (`'tail'` by default, or `'head'`, `'middle'`, `'clip'`).

### Other handy Text props

- `selectable`: lets the user long-press to copy the text (off by default).
- `onPress`: makes the text tappable, useful for small links. For real buttons, use the components in [Buttons and Pressable](/courses/react-native/buttons-and-pressable).
- `allowFontScaling`: on by default, so text grows when the user picks a bigger font size in phone settings. Keep it on: people rely on it. More in [Accessibility: Apps Everyone Can Use](/courses/react-native/accessibility).

## Moving styles out with StyleSheet

Inline style objects are fine for tiny examples, but they get messy fast. `StyleSheet.create` lets you name your styles and keep them at the bottom of the file:

```tsx
// src/app/index.tsx
import { StyleSheet, Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold' },
});
```

You will see this pattern in every file from now on. [Styling with StyleSheet](/courses/react-native/stylesheet-basics) explains it fully, including how to combine styles with arrays.

## Build it: a static HabitCard

Time to build HabitHop's first real component. A `HabitCard` is one row in the Today list. It shows:

- a colored circle with the habit's emoji,
- the habit's name and its streak,
- a "done" circle on the right (it does not do anything yet; you will make it tappable in [Buttons and Pressable](/courses/react-native/buttons-and-pressable)).

First make sure you have the `Habit` type from [Just Enough TypeScript for React Native](/courses/react-native/typescript-basics) in `src/types/habit.ts`. Then create `src/components/HabitCard.tsx`. Let's build it in parts.

The props. For now the card takes a `habit`, its `streak` number and whether it is done today:

```tsx
// src/components/HabitCard.tsx (part 1: props)
import type { Habit } from '@/types/habit';

type HabitCardProps = {
  habit: Habit;
  streak: number;
  isDone: boolean;
};
```

The layout is three boxes in a **row**: emoji on the left, text in the middle (taking all the spare space with `flex: 1`), done circle on the right:

```text
+--------------------------------------------------+
| ( 💧 )  Drink water                       ( ✓ )  |
|         🔥 4 days                                |
+--------------------------------------------------+
```

And the colors come from the habit itself. The emoji circle uses the habit color with some transparency (adding `'22'` to a 6-digit hex color like `#0EA5E9` gives an 8-digit hex color with low opacity), and the done circle fills with the habit color when it is done. You can see the full file in the code panel. The key part is the JSX:

```tsx
// src/components/HabitCard.tsx (part 2: the JSX)
<View style={styles.card}>
  <View style={[styles.emojiCircle, { backgroundColor: habit.color + '22' }]}>
    <Text style={styles.emoji}>{habit.emoji}</Text>
  </View>

  <View style={styles.info}>
    <Text style={styles.name} numberOfLines={1}>{habit.name}</Text>
    <Text style={styles.streak}>🔥 {streak} {streak === 1 ? 'day' : 'days'}</Text>
  </View>

  <View style={[styles.doneCircle, { borderColor: habit.color }, isDone && { backgroundColor: habit.color }]}>
    <Text style={styles.doneMark}>{isDone ? '✓' : ''}</Text>
  </View>
</View>
```

Notice `style={[styles.doneCircle, ..., isDone && { ... }]}`. A style **array** merges styles left to right. When `isDone` is `false`, the last item is `false`, and React Native simply skips it.

Now use the card on the home screen with two sample habits:

```tsx
// src/app/index.tsx
import { StyleSheet, Text, View } from 'react-native';
import { HabitCard } from '@/components/HabitCard';
import type { Habit } from '@/types/habit';

const water: Habit = {
  id: 'h1', name: 'Drink water', emoji: '💧', color: '#0EA5E9',
  createdAt: '2026-10-01T08:00:00.000Z', doneDates: [],
};
const reading: Habit = {
  id: 'h2', name: 'Read 10 pages', emoji: '📚', color: '#7C5CFC',
  createdAt: '2026-10-02T08:00:00.000Z', doneDates: [],
};

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today</Text>
      <HabitCard habit={water} streak={4} isDone />
      <HabitCard habit={reading} streak={1} isDone={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12, backgroundColor: '#F5F3FF' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
});
```

What you see: a "Today" title and two white cards. The water card has a filled blue circle with a check mark; the reading card has an empty purple ring. `isDone` with no value is short for `isDone={true}`.

Later lessons grow this card: tapping in [Buttons and Pressable](/courses/react-native/buttons-and-pressable), many cards in [Long Lists with FlatList](/courses/react-native/flatlist), and real streaks from `doneDates` when you build HabitHop's logic.

## Common mistakes

**A string directly inside a View.** This includes sneaky cases, like a space or a number:

```tsx
// src/components/Broken.tsx
import { Text, View } from 'react-native';

export function Broken({ count }: { count: number }) {
  return (
    <View>
      {count} <Text>habits</Text>
    </View>
  );
}
```

Both `{count}` and the space after it end up as text in a `View`, so you get `Text strings must be rendered within a <Text> component`. Put everything inside one `Text`: `<Text>{count} habits</Text>`.

**`&&` with a number.** `{habits.length && <Text>...</Text>}` renders `0` when the list is empty, and that `0` is a bare string inside a `View`. Use a real true/false check: `{habits.length > 0 && <Text>...</Text>}`.

**Putting font styles on a View.** `fontSize` and `color` on a `View` do nothing to its children (and TypeScript reports `Object literal may only specify known properties`). Put text styles on the `Text`.

**Forgetting `flex: 1` on the screen's outer View.** Without it, the outer box is only as tall as its content, so a `backgroundColor` covers just the top part of the screen.

## Quick recap

- `View` is a box (like a `div`). Its children stack in a **column** by default; use `flexDirection: 'row'` for side by side.
- `Text` shows text, and **every string must be inside a `Text`**.
- Styles are camelCase objects with unitless numbers (dp). Text styles are inherited only from `Text` to nested `Text`, never from a `View`.
- `numberOfLines` keeps long text tidy; `selectable` and `onPress` add copy and tap.
- `StyleSheet.create` keeps styles named and tidy; style arrays merge styles and skip `false`.
- You built a static `HabitCard`. Next: [Showing Images](/courses/react-native/images).

<code id="code-content" class="language-tsx">
// src/components/HabitCard.tsx
// A static HabitCard: emoji, name, streak and a done circle.
import { StyleSheet, Text, View } from 'react-native';
import type { Habit } from '@/types/habit';
// ---
type HabitCardProps = {
  habit: Habit;
  streak: number;
  isDone: boolean;
};
// ---
export function HabitCard({ habit, streak, isDone }: HabitCardProps) {
  return (
    &lt;View style={styles.card}&gt;
      {/* Left: emoji on a light version of the habit color */}
      &lt;View style={[styles.emojiCircle, { backgroundColor: habit.color + '22' }]}&gt;
        &lt;Text style={styles.emoji}&gt;{habit.emoji}&lt;/Text&gt;
      &lt;/View&gt;
      {/* Middle: name and streak, takes the spare space */}
      &lt;View style={styles.info}&gt;
        &lt;Text style={styles.name} numberOfLines={1}&gt;{habit.name}&lt;/Text&gt;
        &lt;Text style={styles.streak}&gt;🔥 {streak} {streak === 1 ? 'day' : 'days'}&lt;/Text&gt;
      &lt;/View&gt;
      {/* Right: done circle, filled when done (not tappable yet) */}
      &lt;View style={[styles.doneCircle, { borderColor: habit.color }, isDone &amp;&amp; { backgroundColor: habit.color }]}&gt;
        &lt;Text style={styles.doneMark}&gt;{isDone ? '✓' : ''}&lt;/Text&gt;
      &lt;/View&gt;
    &lt;/View&gt;
  );
}
// ---
const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  emojiCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24 },
  info: { flex: 1 },
  name: { fontSize: 17, fontWeight: '600', color: '#1F1F1F' },
  streak: { fontSize: 14, color: '#666666', marginTop: 2 },
  doneCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneMark: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});
</code></pre>
