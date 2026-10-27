---
publishDate: 2026-10-22T09:30
title: Styling with StyleSheet
slug: stylesheet-basics
metadescription: 'Learn how styling works in React Native: the style prop, StyleSheet.create, units, colors, style arrays, conditional styles, text styles, borders and shadows.'
updateDate: 2026-10-22T09:30
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'styling', 'stylesheet', 'css']
course: react-native
---

## No CSS files, just JavaScript objects

On the web you style things with CSS files, class names and selectors. React Native has **no CSS**. There are no `.css` files, no class names, no selectors like `.card > p`. Instead, every component takes a **`style` prop**, and a style is a plain JavaScript object.

```tsx
<Text style={{ color: '#7C5CFC', fontSize: 24, fontWeight: 'bold' }}>HabitHop</Text>
```

If you know CSS, most of it will feel familiar. The property names are almost the same, with a few rules:

- Names are written in **camelCase**: `background-color` becomes `backgroundColor`, `font-size` becomes `fontSize`.
- Values are JavaScript values: numbers are numbers (`fontSize: 24`), everything else is a string (`color: 'red'`).
- Each component only accepts the styles that make sense for it. A `View` has no `fontSize`; a `Text` has no `gap`.

In this lesson you will learn how to write styles the React Native way, and use them to make HabitHop look good.

## Units: just numbers

You never write `px`, `rem` or `em` in React Native. Sizes are plain numbers:

```tsx
<View style={{ width: 120, height: 48, padding: 12, borderRadius: 8 }} />
```

These numbers are **density-independent pixels** (Apple calls them **points**, Android calls them **dp**). Phones have very different screen sharpness: one phone might pack 2 real pixels into each point, another 3 or more. React Native does the conversion for you, so `width: 120` looks about the same physical size on every phone.

You can also use **percentages** as strings, which are relative to the parent:

```tsx
<View style={{ width: '50%', height: 4, backgroundColor: '#22C55E' }} />
```

That makes a bar half as wide as its parent, which is handy for progress bars. Other screen-size tools, like reading the screen width, come in [Sizes, Dimensions and Different Screens](/courses/react-native/sizes-and-dimensions).

## StyleSheet.create

Writing style objects inline (directly inside `style={{ ... }}`) works, but it gets messy fast. The usual way is to collect them with **`StyleSheet.create`** at the bottom of the file:

```tsx
// src/app/index.tsx
import { StyleSheet, Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>HabitHop</Text>
      <Text style={styles.subtitle}>Small steps, every day.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 36, fontWeight: 'bold', color: '#7C5CFC' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8 },
});
```

`StyleSheet.create` takes an object of named styles and gives the same object back. Why use it, then?

- **Type checking and autocomplete.** Your editor knows which properties are valid and warns about typos: write `fontsize` and TypeScript asks "Did you mean to write 'fontSize'?".
- **Names.** `styles.title` says much more than a long inline object. Your JSX stays short and readable.
- **Safety.** In development, React Native freezes these objects, so you cannot change a shared style by accident.

Inline styles are still fine for one-off values, especially values that come from data, like a habit's color: `style={{ backgroundColor: habit.color }}`.

## Combining styles with arrays

The `style` prop also accepts an **array** of styles. They are merged from left to right, and later values win:

```tsx
<Text style={[styles.title, { color: '#F97316' }]}>HabitHop</Text>
```

The text gets everything from `styles.title`, but the orange color overrides the purple one. This replaces the CSS "cascade": instead of rules competing by specificity, the order in the array decides.

### Conditional styles

Arrays make conditional styles easy, because React Native **ignores** `false`, `null` and `undefined` inside them:

```tsx
<View style={[styles.card, done && styles.cardDone]}>
  <Text style={[styles.name, done && styles.nameDone]}>{habit.name}</Text>
</View>
```

```tsx
const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, backgroundColor: '#F6F6F8' },
  cardDone: { backgroundColor: '#ECFDF5' },
  name: { fontSize: 17, fontWeight: '600' },
  nameDone: { textDecorationLine: 'line-through', color: '#888' },
});
```

When `done` is `false`, `done && styles.cardDone` is just `false`, so only `styles.card` applies. When it is `true`, the "done" style is added on top. You already used this trick with `Pressable`'s `pressed` state in [Buttons and Pressable](/courses/react-native/buttons-and-pressable).

## Styles do not cascade (mostly)

In CSS, setting `color` on a `<div>` changes the text inside it. In React Native, **a `View` does not pass styles to its children**. This does nothing for the text:

```tsx
<View style={{ color: 'red' }}>{/* TypeScript error: View has no color style */}
  <Text>Not red</Text>
</View>
```

Each `Text` needs its own text styles. The one exception: a `Text` inside another `Text` **does** inherit from its parent `Text`:

```tsx
<Text style={{ fontSize: 18, color: '#333' }}>
  You are on a <Text style={{ fontWeight: 'bold', color: '#7C5CFC' }}>5 day</Text> streak!
</Text>
```

The inner text keeps the size 18 and only changes weight and color. This is how you style a single word inside a sentence. If you want the same font everywhere, make a small text component of your own or a shared style, and reuse it.

## Colors

Colors are strings, and most CSS formats work:

```ts
const examples = {
  named: 'tomato',
  hex: '#7C5CFC',
  hexWithAlpha: '#7C5CFC80', // 80 = about 50% opacity
  rgb: 'rgb(124, 92, 252)',
  rgba: 'rgba(0, 0, 0, 0.4)',
  hsl: 'hsl(253, 96%, 67%)',
  none: 'transparent',
};
```

HabitHop keeps its habit colors in one file, so every screen uses the same palette:

```ts
// src/constants/colors.ts
export const habitColors = ['#7C5CFC', '#22C55E', '#F97316', '#0EA5E9', '#EC4899'];
```

Each habit stores one of these in its `color` field. Light and dark mode get their own colors later in [Dark Mode and Themes](/courses/react-native/dark-mode-and-themes).

## Text styles

The most common text styles:

```tsx
const styles = StyleSheet.create({
  heading: {
    fontSize: 28,
    fontWeight: '700', // '100' to '900', 'normal' or 'bold'
    color: '#111',
    lineHeight: 34, // a number, not '1.2'
    letterSpacing: 0.3,
    textAlign: 'center', // 'left', 'right', 'center', 'justify'
  },
  hint: { fontStyle: 'italic', textTransform: 'uppercase', textDecorationLine: 'underline' },
});
```

Watch out for `lineHeight`: on the web you can write `1.5`, but in React Native it is the full height of a line in points. For a 16 point font, `lineHeight: 24` is a comfortable choice.

Custom fonts (like a Google Font) come in [Custom Fonts and Icons](/courses/react-native/fonts-and-icons).

## Spacing, borders and corners

Spacing works like CSS, plus some handy shortcuts:

```tsx
const styles = StyleSheet.create({
  card: {
    padding: 16, // all sides
    paddingHorizontal: 20, // left and right
    paddingVertical: 12, // top and bottom
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#ccc' },
});
```

- `paddingHorizontal` / `paddingVertical` (and the same for `margin`) set two sides at once. There is no shorthand like `padding: '8px 16px'`.
- `borderWidth`, `borderColor` and `borderRadius` are separate properties. There is no `border: '1px solid red'`.
- `StyleSheet.hairlineWidth` is the thinnest line the screen can draw. Great for separators.

When you set `padding` and `paddingHorizontal` together, the more specific one wins for those sides.

## Shadows

Shadows used to be painful, because iOS and Android did them differently: iOS used `shadowColor`, `shadowOffset`, `shadowOpacity` and `shadowRadius`, while Android only had `elevation`. You will still see that in older code.

With the New Architecture (the only architecture now), React Native supports the CSS-style **`boxShadow`** on both platforms:

```tsx
const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  },
});
```

The string works like in CSS: x offset, y offset, blur, color. Give the view a `backgroundColor`, so the shadow has something to sit behind.

## What is missing compared to CSS

A few web habits do not exist in React Native:

- No `:hover`, `:focus` or other pseudo-classes. Use state, like `Pressable`'s `pressed`.
- No media queries. Read the screen size in code instead.
- No `margin: auto` centering tricks and no `display: grid`. Layout is done with **Flexbox**, which is the next lesson.
- No `!important`: the order in the style array decides.

## Putting it together in HabitHop

The code panel at the bottom is a small style playground with a habit card:

- The card uses a named style, a `boxShadow` and a colored left border taken from the habit's color with an inline style.
- Tapping it toggles "done": conditional styles in an array add a green background and cross out the name.
- A nested `Text` makes the streak number bold.
- A row of color dots shows the `habitColors` palette; the selected one gets a thicker border.

## Common mistakes

**1. Writing CSS units.** `fontSize: '16px'` gives a TypeScript error (`Type 'string' is not assignable to type 'number'`) and does not work. Write `fontSize: 16`.

**2. Text styles on a View.** You put `color` or `fontSize` on a `View` and expect the text inside to change. TypeScript complains, and nothing happens. Put text styles on the `Text`.

**3. CSS shorthands.** `border: '1px solid #ccc'` or `padding: '8px 16px'` are not valid. Use `borderWidth` plus `borderColor`, and `paddingVertical` plus `paddingHorizontal`.

**4. Wrong order in a style array.** `[styles.active, styles.base]` lets the base style override the active one. Put the "extra" styles last: `[styles.base, isActive && styles.active]`.

## Quick recap

- Styles are JavaScript objects with camelCase names; there is no CSS.
- Sizes are plain numbers (points/dp); percentages are strings like `'50%'`.
- `StyleSheet.create` gives you names, type checking and autocomplete.
- The `style` prop takes arrays; later styles win, and `false`/`null` are ignored, which makes conditional styles easy.
- Styles do not cascade from `View` to `Text`; only nested `Text` inherits text styles.
- Use `boxShadow` for shadows on both platforms.
- Keep shared values, like `habitColors`, in a constants file.

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { habitColors } from '@/constants/colors';
// A small style playground with one HabitHop card
export default function Index() {
  const [done, setDone] = useState(false);
  const [color, setColor] = useState(habitColors[0]);
  return (
    &lt;View style={styles.screen}&gt;
      &lt;Pressable onPress={() =&gt; setDone(!done)} style={[styles.card, { borderLeftColor: color }, done &amp;&amp; styles.cardDone]}&gt;
        &lt;Text style={[styles.name, done &amp;&amp; styles.nameDone]}&gt;💧 Drink water&lt;/Text&gt;
        &lt;Text style={styles.streak}&gt;
          Streak: &lt;Text style={styles.bold}&gt;{done ? 6 : 5} days&lt;/Text&gt;
        &lt;/Text&gt;
      &lt;/Pressable&gt;
      &lt;Text style={styles.label}&gt;Pick a color&lt;/Text&gt;
      &lt;View style={styles.dots}&gt;
        {habitColors.map((c) =&gt; (
          &lt;Pressable
            key={c}
            onPress={() =&gt; setColor(c)}
            style={[styles.dot, { backgroundColor: c }, c === color &amp;&amp; styles.dotSelected]}
          /&gt;
        ))}
      &lt;/View&gt;
    &lt;/View&gt;
  );
}
// ---
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, paddingTop: 80, gap: 16, backgroundColor: '#F6F6F8' },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 6,
    gap: 4,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  },
  cardDone: { backgroundColor: '#ECFDF5' },
  name: { fontSize: 18, fontWeight: '600', color: '#111' },
  nameDone: { textDecorationLine: 'line-through', color: '#888' },
  streak: { fontSize: 15, color: '#555' },
  bold: { fontWeight: 'bold', color: '#111' },
  label: { fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 1 },
  dots: { flexDirection: 'row', gap: 12 },
  dot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  dotSelected: { borderWidth: 4, borderColor: '#111' },
});
</code></pre>
