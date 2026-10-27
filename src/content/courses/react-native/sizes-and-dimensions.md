---
publishDate: 2026-10-22T12:30
title: Sizes, Dimensions and Different Screens
slug: sizes-and-dimensions
metadescription: 'Learn how sizes work in React Native: unitless points, percentages, aspectRatio, useWindowDimensions, pixel ratio and font scaling for every screen.'
updateDate: 2026-10-22T12:30
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'styling', 'responsive', 'layout']
course: react-native
---

## One app, hundreds of screens

Your app will run on small Android phones, big iPhones, foldables, tablets and even in a browser. Some of them will be turned sideways. Some users will have their text size turned up to the maximum. You cannot design for one screen and hope for the best.

The good news: React Native gives you a small set of tools that handle almost every case. You will learn what a number like `width: 100` really means, when to use percentages and `flex`, how to read the screen size with `useWindowDimensions`, and how to respect the user's font size setting. At the end you will build a HabitHop grid that shows 2 columns on a phone and 3 or 4 on a tablet.

This lesson builds on [Styling with StyleSheet](/courses/react-native/stylesheet-basics) and [Layout with Flexbox](/courses/react-native/flexbox-layout).

## Numbers without units

In CSS you write `width: 100px` or `2rem`. In React Native you write a plain number:

```tsx
// src/app/index.tsx (part)
const styles = StyleSheet.create({
  box: { width: 100, height: 100, backgroundColor: '#7C5CFC' },
});
```

That `100` is not 100 real pixels. It is 100 **density-independent pixels**. Apple calls them **points** and Android calls them **dp**. They are the same idea: a size unit that looks about the same physical size on every screen.

Why does this matter? A cheap phone might pack 2 real pixels into each point, and a high-end phone might pack 3 or more. If sizes were in real pixels, your button would look tiny on the sharp screen. With points, a `100` box is roughly the same size on both. The phone does the math for you.

So the rule is simple: write plain numbers and think "points". Never add `px`.

## Percentages and aspectRatio

Fixed numbers are fine for things like padding, icons and border radius. For anything that should grow with the screen, use **percentages** (as strings) or `flex`:

```tsx
// src/app/index.tsx (part)
const styles = StyleSheet.create({
  half: { width: '50%', height: 80 },
  banner: { width: '100%', aspectRatio: 16 / 9 },
});
```

- `width: '50%'` means half of the parent's width, just like CSS.
- `aspectRatio` sets the height from the width (or the other way round). `16 / 9` makes a widescreen box. This is perfect for images and cards, because you only set one side and the other follows. You saw it with images in [Showing Images](/courses/react-native/images).

Often you do not need percentages at all, because `flex` splits space for you. This progress bar fills two thirds of its row on any screen:

```tsx
// src/components/ProgressBar.tsx
import { View } from 'react-native';

export function ProgressBar() {
  return (
    <View style={{ flexDirection: 'row', height: 40 }}>
      <View style={{ flex: 2, backgroundColor: '#22C55E' }} />
      <View style={{ flex: 1, backgroundColor: '#E5E7EB' }} />
    </View>
  );
}
```

A good habit: reach for `flex` first, percentages second, and fixed numbers only for small details.

## Reading the screen size with useWindowDimensions

Sometimes you really need the numbers, for example to choose how many columns a grid has. The hook **`useWindowDimensions`** gives you the size of the app window in points:

```tsx
// src/app/index.tsx (part)
import { Text, useWindowDimensions } from 'react-native';

export default function Index() {
  const { width, height, scale, fontScale } = useWindowDimensions();
  const isLandscape = width > height;

  return <Text>{isLandscape ? 'Landscape' : 'Portrait'}: {width} x {height}</Text>;
}
```

On an iPhone 16 in portrait you would see something like this:

```text
Portrait: 393 x 852
```

What each value means:

- `width` and `height`: the window size in points.
- `scale`: how many real pixels fit in one point (for example `3`).
- `fontScale`: the user's text size setting. `1` is normal, `1.3` means "make text 30% bigger".

The best part is that it is a **hook**, so your component re-renders whenever the size changes. That happens when the user rotates the phone, opens your app in split screen on a tablet, unfolds a foldable or resizes the browser window on web.

### Dimensions: the older way

You will see `Dimensions.get('window')` in older code and blog posts:

```tsx
// src/app/index.tsx (part)
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window'); // read once, never updates
```

This reads the size **once**. If you put it at the top of a file, the value is frozen. Rotate the phone and your layout keeps using the old width. Inside components, prefer `useWindowDimensions`. `Dimensions` is still fine in plain functions that run once, outside of React.

There is also `Dimensions.get('screen')`. On Android the "screen" can include the system bars, so it can be a bit taller than the "window". For layout you almost always want the window.

## Pixel ratio and hairlines

`PixelRatio` tells you about the real pixels behind your points:

```tsx
// src/app/index.tsx (part)
import { PixelRatio, StyleSheet } from 'react-native';

console.log(PixelRatio.get()); // 3 on most new iPhones, 2.625 or 3 on many Androids

const styles = StyleSheet.create({
  // The thinnest line the screen can draw
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ccc' },
});
```

You rarely need `PixelRatio` directly. The two times it helps:

1. **Thin lines.** `StyleSheet.hairlineWidth` is one real pixel, which is a fraction of a point. Great for dividers in lists.
2. **Picking image sizes.** If an image shows at 100 points wide on a phone with a ratio of 3, a 300 pixel wide image looks sharp. React Native does this for you with `@2x` and `@3x` files, as you saw in the images lesson.

## Respecting the user's font size

Many people make the text bigger in their phone settings. React Native respects this by default: a `fontSize: 16` text gets bigger when the user's setting is bigger. This is great for **accessibility** (making your app usable by everyone), so do not turn it off.

What you can do is put a ceiling on it for tight spots, like a small label inside a tile:

```tsx
// src/components/HabitTile.tsx (part)
<Text style={{ fontSize: 15 }} maxFontSizeMultiplier={1.5}>
  {name}
</Text>
```

`maxFontSizeMultiplier={1.5}` means "grow with the setting, but never past 1.5 times". There is also `allowFontScaling={false}`, which ignores the setting completely. Use it almost never, because people who need big text will not be able to read your app. You will learn more in [Accessibility: Apps Everyone Can Use](/courses/react-native/accessibility).

To test it, open your phone's settings and turn up the text size (Display & Brightness, Text Size on iOS; Display, Font size on Android), then come back to your app. Fast Refresh keeps the app open, and the text should grow.

## Orientation

By default the template locks the app to portrait. You can see this in `app.json`:

```json
{
  "expo": {
    "orientation": "portrait"
  }
}
```

Change it to `"default"` to allow both portrait and landscape, or `"landscape"` to lock it sideways. This is a native setting, so in a development build you need to make a new build before it takes effect (see [Expo Go vs Development Builds](/courses/react-native/expo-go-vs-development-builds)). Tablets are worth a thought: on iPad, many apps are expected to work in every orientation and in split screen. Because `useWindowDimensions` updates on its own, a layout built with it just works when the window changes.

## Putting it together: a responsive habit grid

Here is a HabitHop screen that shows habits as square tiles. The number of columns depends on the window width:

- under 600 points (phones): 2 columns
- 600 to 899 points (small tablets, phones in landscape): 3 columns
- 900 points and up (big tablets, web): 4 columns

The tile width is calculated from the window width, minus the outer padding, minus the gaps between tiles, divided by the number of columns. `aspectRatio: 1` then makes every tile a square.

The full screen is in the code panel. The key lines are these:

```tsx
// src/app/index.tsx (part)
const { width } = useWindowDimensions();
const columns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
const tileWidth = (width - PADDING * 2 - GAP * (columns - 1)) / columns;
```

And on the list:

```tsx
// src/app/index.tsx (part)
<FlatList
  key={columns}
  numColumns={columns}
  columnWrapperStyle={{ gap: GAP }}
  // ...
/>
```

`numColumns` turns a [FlatList](/courses/react-native/flatlist) into a grid. A FlatList cannot change `numColumns` while it is on screen, so we give it `key={columns}`. When the column count changes, the key changes, and React throws away the old list and draws a new one. Without the key you get a red error screen.

On a phone you see two neat columns of square tiles. Rotate a tablet (or widen the browser on web) and it jumps to three or four.

The screen also uses `SafeAreaView` so the content does not hide behind the notch. That is the topic of the next lesson, [Safe Areas: Notches, Status Bars and Home Bars](/courses/react-native/safe-areas).

### Keeping content readable on big screens

On a tablet, a list that stretches across the whole width looks odd and is hard to read. A simple fix is a maximum width, centered:

```tsx
// src/app/index.tsx (part)
<View style={{ width: '100%', maxWidth: 600, alignSelf: 'center' }}>
  {/* your content */}
</View>
```

The template does the same thing with its `MaxContentWidth` constant in `src/constants/theme.ts`.

## Common mistakes

**1. Writing units.** `width: '100px'` is not how React Native sizes work. Careful: TypeScript will not warn you, because the type for sizes accepts any string (percentages are strings too). The box simply does not get the size you expect.

```diff
- box: { width: '100px' },
+ box: { width: 100 },
```

Fix: write a plain number. Only percentages are strings.

**2. Freezing the size with Dimensions.** You read `Dimensions.get('window').width` at the top of a file, and the layout breaks after rotating the phone. Fix: use `useWindowDimensions()` inside the component.

**3. Changing numColumns without a key.** You see:

```text
Invariant Violation: Changing numColumns on the fly is not supported. Change the key prop on FlatList when changing the number of columns to force a fresh render of the component.
```

Fix: add `key={columns}` to the FlatList, as in the grid above.

**4. Fixed heights on text containers.** A box with `height: 40` cuts off text when the user has big fonts. Fix: use `padding` or `minHeight` instead, and let the text decide the height.

## Quick recap

- Sizes are plain numbers in points (dp on Android). Never write `px`.
- Use `flex` first, percentages second, fixed numbers for small details. `aspectRatio` sets one side from the other.
- `useWindowDimensions()` gives the live window size and re-renders on rotation and resize. `Dimensions.get()` reads it only once.
- `StyleSheet.hairlineWidth` draws the thinnest possible line. `PixelRatio.get()` tells you the pixels per point.
- Respect the user's font size. Use `maxFontSizeMultiplier` for tight spots, and avoid `allowFontScaling={false}`.
- A FlatList grid needs a new `key` when `numColumns` changes.

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { FlatList, PixelRatio, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
const habits = [
  { id: 'h1', emoji: '💧', name: 'Drink water' },
  { id: 'h2', emoji: '📚', name: 'Read 10 pages' },
  { id: 'h3', emoji: '🧘', name: 'Stretch' },
  { id: 'h4', emoji: '🏃', name: 'Walk 20 minutes' },
  { id: 'h5', emoji: '🥗', name: 'Eat a salad' },
  { id: 'h6', emoji: '😴', name: 'Sleep by 11' },
];
const GAP = 12;
const PADDING = 16;
export default function HabitGrid() {
  // Re-renders when the window size changes (rotation, split screen, foldables)
  const { width, height, fontScale } = useWindowDimensions();
  // Pick a column count from the width: phones get 2, tablets get 3 or 4
  const columns = width &gt;= 900 ? 4 : width &gt;= 600 ? 3 : 2;
  // Width for one tile: total width, minus padding, minus the gaps between tiles
  const tileWidth = (width - PADDING * 2 - GAP * (columns - 1)) / columns;
  return (
    &lt;SafeAreaView style={styles.screen}&gt;
      &lt;Text style={styles.info}&gt;
        {Math.round(width)} x {Math.round(height)} points, pixel ratio {PixelRatio.get()}, font scale {fontScale}
      &lt;/Text&gt;
      &lt;FlatList
        key={columns} // numColumns cannot change on the fly, so a new key makes a fresh list
        data={habits}
        numColumns={columns}
        keyExtractor={(item) =&gt; item.id}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, padding: PADDING }}
        renderItem={({ item }) =&gt; (
          &lt;View style={[styles.tile, { width: tileWidth }]}&gt;
            &lt;Text style={styles.emoji}&gt;{item.emoji}&lt;/Text&gt;
            &lt;Text style={styles.name} maxFontSizeMultiplier={1.5}&gt;{item.name}&lt;/Text&gt;
          &lt;/View&gt;
        )}
      /&gt;
    &lt;/SafeAreaView&gt;
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  info: { fontSize: 12, color: '#666', paddingHorizontal: PADDING },
  tile: { aspectRatio: 1, borderRadius: 16, backgroundColor: '#EEE9FF', alignItems: 'center', justifyContent: 'center', padding: 8 },
  emoji: { fontSize: 36 },
  name: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
</code></pre>
