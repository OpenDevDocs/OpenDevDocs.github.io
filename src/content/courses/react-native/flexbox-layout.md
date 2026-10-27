---
publishDate: 2026-10-22T11:00
title: Layout with Flexbox
slug: flexbox-layout
metadescription: 'Learn how React Native lays out screens with Flexbox: flexDirection, justifyContent, alignItems, flex, gap, wrapping, absolute position and how it differs from the web.'
updateDate: 2026-10-22T11:00
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'flexbox', 'layout', 'styling']
course: react-native
---

## One layout system for everything

On the web you have many ways to place things: block, inline, floats, grid, flexbox. React Native has just one: **Flexbox**. Every `View` is a flex container from the start. You do not write `display: 'flex'`; it is already on.

That sounds limiting, but it is actually freeing. Once you understand a handful of properties, you can build any screen: headers, rows, cards, grids and floating buttons. The layout is calculated by a small, fast engine called **Yoga**, which runs the same way on iOS and Android, so your layout looks the same on both.

If you know Flexbox from CSS, most of this will be familiar, but read the section on [how it differs from the web](#how-react-native-flexbox-differs-from-the-web) carefully, because a few defaults are different. If you have never used Flexbox, no problem: we will start from zero.

## Main axis and cross axis

Flexbox places the children of a container along a line. That line is the **main axis**. The direction across it is the **cross axis**.

```text
flexDirection: 'column' (the default)     flexDirection: 'row'

 main axis                                 main axis
    |                                      ------------------>
    |   [ A ]                               [ A ] [ B ] [ C ]
    |   [ B ]       cross axis --->
    v   [ C ]                              cross axis: top to bottom
```

Almost every Flexbox property is about one of these two axes:

- **`flexDirection`** picks the main axis.
- **`justifyContent`** places children along the **main** axis.
- **`alignItems`** places children along the **cross** axis.

Keep this picture in mind and everything else falls into place.

## flexDirection: column by default

In React Native, children stack from **top to bottom** unless you say otherwise:

```tsx
// src/app/index.tsx
import { StyleSheet, View } from 'react-native';

export default function Index() {
  return (
    <View style={styles.screen}>
      <View style={[styles.box, { backgroundColor: '#7C5CFC' }]} />
      <View style={[styles.box, { backgroundColor: '#22C55E' }]} />
      <View style={[styles.box, { backgroundColor: '#F97316' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, paddingTop: 80 },
  box: { width: 60, height: 60 },
});
```

You see three colored squares stacked in a column at the top left. Add `flexDirection: 'row'` to `screen` and they line up side by side instead.

The four values are `'column'` (default), `'row'`, `'column-reverse'` and `'row-reverse'`. Phones are tall and narrow, so a column default makes sense: most screens are a vertical stack of things.

## justifyContent: along the main axis

`justifyContent` decides where children sit along the main axis, and what to do with the free space:

```text
flex-start      center        flex-end      space-between   space-around    space-evenly
[A][B][C]....   ..[A][B][C]..  ....[A][B][C] [A]....[B]....[C] .[A]..[B]..[C]. ..[A]..[B]..[C]..
```

(Shown for a row. In a column, the same happens top to bottom.)

- `'flex-start'` (default): packed at the start.
- `'center'`: packed in the middle.
- `'flex-end'`: packed at the end.
- `'space-between'`: first and last at the edges, equal space between the rest.
- `'space-around'`: equal space around each child (so half-size space at the edges).
- `'space-evenly'`: exactly equal space everywhere, including the edges.

`space-between` in a row is the classic "label on the left, button on the right" layout. You used it for the settings rows in [Switch, ActivityIndicator and Other Handy Components](/courses/react-native/switch-and-activity-indicator).

## alignItems: along the cross axis

`alignItems` places children on the cross axis:

- `'stretch'` (default): children stretch to fill the cross axis, **unless** they have a fixed size in that direction.
- `'flex-start'`, `'center'`, `'flex-end'`: at the start, middle or end.
- `'baseline'`: lines up the text baselines of the children (useful for a big number next to a small label).

The default `stretch` explains something that surprises many beginners: in a column, a `View` without a width is as **wide as its parent**, but its height only fits its content. It is being stretched across the cross axis.

### Centering anything

The famous "center a thing" puzzle is two lines in React Native:

```tsx
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
  <Text>Perfectly centered</Text>
</View>
```

`justifyContent: 'center'` centers vertically (the main axis of a column), and `alignItems: 'center'` centers horizontally (the cross axis).

### alignSelf: one child does its own thing

A child can override its parent's `alignItems` with `alignSelf`:

```tsx
<View style={{ alignItems: 'flex-start' }}>
  <Text>Left</Text>
  <Text style={{ alignSelf: 'flex-end' }}>Right</Text>
</View>
```

## flex: sharing the space

So far, children only took the size of their content. **`flex`** lets a child grow to fill free space.

```tsx
<View style={{ flex: 1 }}>
  <View style={{ height: 60, backgroundColor: '#7C5CFC' }} />
  <View style={{ flex: 1, backgroundColor: '#F3F0FF' }} />
  <View style={{ height: 60, backgroundColor: '#7C5CFC' }} />
</View>
```

The top and bottom bars are 60 points tall. The middle one has `flex: 1`, so it takes **all the space left over**. This header, content, footer layout is the skeleton of many screens.

When several children have `flex`, they share the free space in proportion:

```tsx
<View style={{ flexDirection: 'row', height: 40 }}>
  <View style={{ flex: 1, backgroundColor: '#22C55E' }} />
  <View style={{ flex: 2, backgroundColor: '#E5E7EB' }} />
</View>
```

The green part gets 1 share and the grey part 2 shares, so green is one third of the width. That is a quick progress bar.

### Why your screen needs flex: 1

You have seen `flex: 1` on the outer `View` of almost every screen in this course. The screen's container is given the full screen by the navigator. With `flex: 1`, your `View` fills it. Without it, your `View` is only as tall as its content, so `justifyContent: 'center'` has no room to center anything, and a `ScrollView` or `FlatList` inside has no limited height to scroll in ([Scrolling Content with ScrollView](/courses/react-native/scrollview) explains why that matters).

### flexGrow, flexShrink and flexBasis

`flex` is a shortcut. The three long-hand properties are:

- **`flexGrow`**: how much of the free space this child takes (like the number in `flex`).
- **`flexShrink`**: how much this child shrinks when there is not enough space.
- **`flexBasis`**: the starting size before growing or shrinking.

In React Native, `flex` takes **only a single number**, not a string like CSS's `flex: 1 1 auto`. A positive `flex` makes the child grow to fill the space (and starts it from a size of 0). Use the long-hand properties when you need finer control.

## How React Native Flexbox differs from the web

These are the differences that trip up web developers. They come from the defaults of the Yoga layout engine:

| Property | Web CSS default | React Native default |
| --- | --- | --- |
| `display` | `block` (most elements) | `flex` (every `View`) |
| `flexDirection` | `row` | `column` |
| `alignContent` | `stretch` | `flex-start` |
| `flexShrink` | `1` | `0` |
| `flex` | shorthand string (`1 1 0%`) | a single number only |
| `boxSizing` | `content-box` | `border-box` |
| `position` | `static` | `relative` |

What they mean in practice:

- **Column first.** Children stack vertically. Want a row? Say `flexDirection: 'row'`.
- **No shrinking by default.** With `flexShrink: 0`, children keep their size even if they do not fit. A long text in a row will run off the edge of the screen instead of wrapping (see the mistakes section for the fix).
- **Border-box sizing.** `width: 100` includes padding and border, like the popular `* { box-sizing: border-box }` CSS reset. React Native does support `boxSizing: 'content-box'` if you ever need it.
- **Relative by default.** Every view can be the anchor for absolutely positioned children (more below).
- **Only flex layout.** There is no CSS Grid, no floats and no inline elements. Text runs inline only inside a `Text` component.

## gap: space between children

Instead of adding margins to every child, put `gap` on the parent:

```tsx
<View style={{ flexDirection: 'row', gap: 12 }}>
  <Chip label="Mon" />
  <Chip label="Tue" />
  <Chip label="Wed" />
</View>
```

`gap` adds space **between** children only, not at the edges. `rowGap` and `columnGap` set the two directions separately. This course uses `gap` everywhere, because it is much simpler than margins.

## flexWrap: more rows when space runs out

By default children stay on one line, even if they overflow. `flexWrap: 'wrap'` moves them to a new line when the line is full:

```tsx
<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
  {habitColors.map((color) => (
    <View key={color} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: color }} />
  ))}
</View>
```

When there are several lines, `alignContent` decides how the lines themselves are spread on the cross axis. Its React Native default is `'flex-start'` (lines packed at the top), not `stretch` like on the web. For long lists of tiles, prefer a `FlatList` with `numColumns` ([Long Lists with FlatList](/courses/react-native/flatlist)).

## Absolute position: stacking on top

Sometimes something should float on top of the normal layout: a badge in a corner, a floating "add" button. Use `position: 'absolute'` plus `top`, `right`, `bottom` or `left`:

```tsx
<View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#F3F0FF' }}>
  <Text style={{ fontSize: 40, textAlign: 'center' }}>💧</Text>
  <View style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#EC4899', borderRadius: 10, paddingHorizontal: 6 }}>
    <Text style={{ color: 'white', fontWeight: 'bold' }}>5</Text>
  </View>
</View>
```

An absolute child is taken **out of the flex flow**: it does not push its siblings, and it is placed relative to its parent (because every view is `relative` by default). Here the pink "5" badge sits on the top right corner of the emoji box.

- `StyleSheet.absoluteFill` is a ready-made style with `position: 'absolute'` and all four sides at `0`, for overlays that cover the parent.
- Later siblings are drawn on top of earlier ones. Use `zIndex` if you need a different order.

## Putting it together in HabitHop

The code panel at the bottom uses everything from this lesson to lay out a first HabitHop "Today" screen:

- **Header row** (`flexDirection: 'row'`, `justifyContent: 'space-between'`, `alignItems: 'center'`): the title on the left, a "2/3" counter on the right.
- **Progress bar**: a row with two `flex` children whose shares come from how many habits are done.
- **Habit cards**: each one is a row with the emoji, a text block with `flex: 1` (so it takes the middle and pushes the circle to the right edge) and the done circle.
- **List area** with `flex: 1`, so it fills the space between the header and the bottom.
- **Floating add button**: `position: 'absolute'` with `right` and `bottom`, on top of everything.

The habit cards use the same layout as the `HabitCard` from [View and Text: The Building Blocks](/courses/react-native/view-and-text); now you know exactly why its styles work. Next, make the layout fit any phone in [Sizes, Dimensions and Different Screens](/courses/react-native/sizes-and-dimensions), and keep it away from the notch in [Safe Areas: Notches, Status Bars and Home Bars](/courses/react-native/safe-areas).

## Common mistakes

**1. Long text runs off the screen.** In a row, a long habit name pushes the done button off the edge. Because `flexShrink` is `0` by default, the `Text` refuses to shrink. Give the text (or its wrapper) `flex: 1` or `flexShrink: 1`, so it takes only the space that is left and wraps onto a second line.

**2. "justifyContent does nothing."** You wanted to center vertically, but the content stays at the top. The container has no height to center in. Add `flex: 1` (or a fixed height) to it.

**3. Mixing up the axes after switching to a row.** In a column, `justifyContent: 'center'` centers vertically. In a row, the same line centers **horizontally**, because the main axis changed. When something moves the wrong way, check `flexDirection` first.

**4. Percentage heights that do nothing.** `height: '50%'` only works if the parent has a known height. Inside a parent that sizes to its content, there is nothing to take 50% of. Give the parent `flex: 1` or a fixed height.

## Quick recap

- Every `View` is a flex container; Flexbox is the only layout system.
- `flexDirection` sets the main axis and defaults to `'column'`.
- `justifyContent` works on the main axis; `alignItems` (default `'stretch'`) on the cross axis; `alignSelf` overrides it for one child.
- `flex: 1` makes a child fill the free space; several `flex` values share it by proportion.
- Differences from the web: column by default, `flexShrink: 0`, `alignContent: 'flex-start'`, `flex` is one number, border-box sizing, no grid.
- `gap` spaces children, `flexWrap: 'wrap'` makes new lines, and `position: 'absolute'` floats things on top.

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
// A first HabitHop "Today" layout built with Flexbox
const habits = [
  { id: 'h1', emoji: '💧', name: 'Drink 8 glasses of water before the evening', color: '#0EA5E9', done: true },
  { id: 'h2', emoji: '📚', name: 'Read 10 pages', color: '#7C5CFC', done: true },
  { id: 'h3', emoji: '🚶', name: 'Walk 20 minutes', color: '#22C55E', done: false },
];
export default function Index() {
  const doneCount = habits.filter((h) =&gt; h.done).length;
  return (
    &lt;View style={styles.screen}&gt;
      &lt;View style={styles.header}&gt;
        &lt;Text style={styles.title}&gt;Today&lt;/Text&gt;
        &lt;Text style={styles.counter}&gt;{doneCount}/{habits.length}&lt;/Text&gt;
      &lt;/View&gt;
      &lt;View style={styles.progress}&gt;
        &lt;View style={{ flex: doneCount, backgroundColor: '#22C55E' }} /&gt;
        &lt;View style={{ flex: habits.length - doneCount, backgroundColor: '#E5E7EB' }} /&gt;
      &lt;/View&gt;
      &lt;View style={styles.list}&gt;
        {habits.map((h) =&gt; (
          &lt;View key={h.id} style={styles.card}&gt;
            &lt;Text style={styles.emoji}&gt;{h.emoji}&lt;/Text&gt;
            &lt;Text style={styles.name}&gt;{h.name}&lt;/Text&gt;
            &lt;View style={[styles.circle, { borderColor: h.color }, h.done &amp;&amp; { backgroundColor: h.color }]} /&gt;
          &lt;/View&gt;
        ))}
      &lt;/View&gt;
      &lt;Pressable style={styles.fab} accessibilityRole="button" accessibilityLabel="Add habit"&gt;
        &lt;Text style={styles.fabText}&gt;+&lt;/Text&gt;
      &lt;/Pressable&gt;
    &lt;/View&gt;
  );
}
// ---
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, paddingTop: 80, gap: 16, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 32, fontWeight: 'bold' },
  counter: { fontSize: 18, color: '#666' },
  progress: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  list: { flex: 1, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: '#F6F6F8' },
  emoji: { fontSize: 28 },
  name: { flex: 1, fontSize: 17, fontWeight: '600' }, // flex: 1 lets long names wrap
  circle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  fab: { position: 'absolute', right: 24, bottom: 40, width: 60, height: 60, borderRadius: 30, backgroundColor: '#7C5CFC', alignItems: 'center', justifyContent: 'center' },
  fabText: { color: 'white', fontSize: 32, lineHeight: 36 },
});
</code></pre>
