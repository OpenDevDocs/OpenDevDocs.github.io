---
publishDate: 2026-05-31T10:30
title: 'React Native: Reusing React Skills on Mobile'
slug: react-native-fundamentals
metadescription: Everything you know about React transfers to mobile. Learn what changes, what does not, and how to decide if it fits.
updateDate: 2026-09-05T10:30
author: ['bishal-biswas']
level: 4
tags: ['react-native', 'mobile', 'architecture']
course: react
---

## What transfers

Almost everything.

Components, props, state, hooks, context, effects, custom hooks, composition, keys, the rules of hooks. All identical, because it is the same `react` package.

What changes is the **renderer**. Instead of `react-dom` producing DOM nodes, React Native produces real native views: `UIView` on iOS, `android.view.View` on Android.

These are not web views. A React Native app renders genuine platform components.

## Getting started

```bash
npx create-expo-app@latest my-app
cd my-app
npx expo start
```

**Use Expo.** It handles the native build tooling, gives you a large library of native modules, and lets you test on a real device by scanning a QR code. The bare React Native CLI exists, and you rarely want it now.

## The differences

### No HTML elements

```javascript
<div>
  <p>Hello</p>
  <img src="/photo.jpg" />
  <button onClick={handlePress}>Press</button>
</div>
```

```javascript
import { View, Text, Image, Pressable } from 'react-native';
<View>
  <Text>Hello</Text>
  <Image source={{ uri: 'https://example.com/photo.jpg' }} />
  <Pressable onPress={handlePress}>
    <Text>Press</Text>
  </Pressable>
</View>
```

The mapping is small: `View` for `div`, `Text` for text, `Image`, `Pressable`, `TextInput`, `ScrollView`, `FlatList`.

**All text must be inside `<Text>`.** A bare string inside a `View` is an error, not a warning. This catches everyone on day one.

### No CSS

Styles are objects, and only a subset of CSS exists.

```javascript
import { StyleSheet, View, Text } from 'react-native';
const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold'
  }
});
function Card({ title }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}
```

Key differences:

- **Flexbox is the only layout**, and `flexDirection` defaults to `column`, not `row`. This is the most common source of confusion.
- **No cascade and no inheritance.** A `fontSize` on a `View` does nothing. Every `Text` needs its own.
- **No units.** Numbers are density independent pixels.
- **Shadows differ per platform**, hence `shadowColor` and `elevation` together.

You can use **NativeWind** to write Tailwind classes instead, which many teams prefer.

### Lists

```javascript
{items.map((item) => <Row key={item.id} item={item} />)}
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <Row item={item} />}
/>
```

`FlatList` is virtualised by default, which matters far more on a phone than on a desktop. Mapping a long list will make the app stutter.

### Navigation

```javascript
import { Stack } from 'expo-router';
export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Home' }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Product' }} />
    </Stack>
  );
}
```

Expo Router uses file based routing much like Next.js. React Navigation is the other main option.

Navigation is genuinely different from the web: screens are stacked rather than replaced, they stay mounted underneath, and the platform provides back gestures.

### Platform differences

```javascript
import { Platform } from 'react-native';
const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
    ...Platform.select({
      ios: { shadowOpacity: 0.1 },
      android: { elevation: 3 }
    })
  }
});
```

```javascript
import { SafeAreaView } from 'react-native-safe-area-context';
```

`SafeAreaView` keeps content clear of notches, the status bar and the home indicator. Forgetting it is why a layout looks fine in the simulator and wrong on a real phone.

## What stays exactly the same

```javascript
function useCart() {
  const [items, setItems] = useState([]);
  const total = items.reduce((sum, i) => sum + i.price, 0);
  const addItem = useCallback((item) => {
    setItems((current) => [...current, item]);
  }, []);
  return { items, total, addItem };
}
```

That hook works unchanged on both platforms. So does your Context, your Zustand store, your TanStack Query setup, your Zod schemas and your API client.

In a shared codebase, this is usually most of your logic. The platform specific part is the presentation layer.

## Sharing code between web and mobile

```bash
packages/
  core/       hooks, state, API client, validation
  ui-web/     React DOM components
  ui-native/  React Native components
apps/
  web/
  mobile/
```

Share the logic, keep the presentation separate. Attempting to share components across both usually produces something that fits neither platform well.

Users expect an iOS app to feel like an iOS app. A web layout ported directly feels wrong in ways people notice without being able to name.

## Should you use it?

**Yes** when you need a real mobile app, your team already knows React, and the app is mostly standard interface work: lists, forms, navigation, network data.

**Consider native** when the app depends heavily on platform specific capability: complex camera work, heavy graphics, deep background processing, or the very latest OS features on day one.

**Consider a web app** if a website would genuinely do. Installation is a real barrier, and a good responsive site reaches more people with less work.

React Native's honest position is that it gets you most of the way to native quality with one team and one language. It is not identical to native, and for most applications the difference does not matter.

## Quick recap

- Components, hooks, state and context are identical, since it is the same React.
- The renderer produces real native views, not a web view.
- Use Expo unless you have a specific reason not to.
- `View`, `Text`, `Image` and `Pressable` replace HTML elements.
- All text must be inside `Text`, and styles are objects with no cascade.
- Flexbox defaults to `column`, which surprises everyone.
- Use `FlatList` for lists, and `SafeAreaView` for notches.
- Share logic across platforms, keep presentation separate.

<code id="code-content" class="language-javascript">
import { useState, useCallback } from 'react';
import {
  View, Text, Image, Pressable, TextInput, FlatList, StyleSheet, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// THIS HOOK IS IDENTICAL on web and mobile. It is the same `react`
// package, so hooks, context, state and composition all transfer.
function useCart() {
  const [items, setItems] = useState([]);
  const total = items.reduce((sum, i) =&gt; sum + i.price, 0);
  const addItem = useCallback((item) =&gt; {
    setItems((current) =&gt; [...current, item]);
  }, []);
  return { items, total, addItem };
}
// Styles are OBJECTS. No cascade, no inheritance, no units.
const styles = StyleSheet.create({
  // Flexbox is the only layout, and flexDirection defaults to COLUMN,
  // not row. This is the commonest source of confusion coming from web.
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'white',
    // Shadows differ per platform, so you set both
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  // A fontSize on a View does nothing. Every Text needs its own.
  title: { fontSize: 18, fontWeight: 'bold' },
  header: { paddingTop: Platform.OS === 'ios' ? 44 : 24 }
});
export default function CartScreen() {
  const { items, total, addItem } = useCart();
  const [query, setQuery] = useState('');
  return (
    // SafeAreaView keeps content clear of notches and the home
    // indicator. Forgetting it is why layouts look fine in the
    // simulator and wrong on a real phone.
    &lt;SafeAreaView style={{ flex: 1 }}&gt;
      &lt;View style={styles.card}&gt;
        {/* ALL text must be inside &lt;Text&gt;. A bare string in a View is
            an error, not a warning. This catches everyone on day one. */}
        &lt;Text style={styles.title}&gt;Your cart&lt;/Text&gt;
        &lt;Text&gt;Total: Rs {total}&lt;/Text&gt;
        &lt;TextInput
          value={query}
          onChangeText={setQuery}        // onChangeText, not onChange
          placeholder="Search"
        /&gt;
        {/* Pressable replaces button, and needs Text inside it */}
        &lt;Pressable onPress={() =&gt; addItem({ id: '1', price: 100 })}&gt;
          &lt;Text&gt;Add an item&lt;/Text&gt;
        &lt;/Pressable&gt;
      &lt;/View&gt;
      {/* FlatList is VIRTUALISED by default, which matters far more on
          a phone. Mapping a long list will make the app stutter. */}
      &lt;FlatList
        data={items}
        keyExtractor={(item) =&gt; item.id}
        renderItem={({ item }) =&gt; (
          &lt;View style={styles.row}&gt;
            &lt;Image source={{ uri: item.image }} style={{ width: 48, height: 48 }} /&gt;
            &lt;Text&gt;{item.name}&lt;/Text&gt;
          &lt;/View&gt;
        )}
        ListEmptyComponent={&lt;Text&gt;Your cart is empty&lt;/Text&gt;}
      /&gt;
    &lt;/SafeAreaView&gt;
  );
}
// SHARE LOGIC, NOT PRESENTATION:
//   packages/core        hooks, state, API client, Zod schemas
//   packages/ui-web      React DOM components
//   packages/ui-native   React Native components
// Sharing components across both usually produces something that fits
// neither platform. Users notice when an iOS app does not feel like one.
</code></pre>
