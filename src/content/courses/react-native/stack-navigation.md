---
publishDate: 2026-10-23T06:30
title: Stack Navigation and Headers
slug: stack-navigation
metadescription: 'Use the Expo Router Stack to push and pop screens, style the header, add header buttons and set titles per screen in your HabitHop app.'
updateDate: 2026-10-23T06:30
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'expo-router', 'navigation', 'stack']
course: react-native
---

## The stack: a pile of cards

In [How Expo Router Works](/courses/react-native/expo-router-basics) you put `<Stack />` in `src/app/_layout.tsx` and got two screens with a back arrow for free. Now you will learn what that stack really does and how to make it look like HabitHop instead of a default demo.

A **stack navigator** keeps a list of screens, like a pile of cards on a table:

- Opening a screen **pushes** a new card on top. You see the top card.
- Going back **pops** the top card off. The card under it shows again, exactly as you left it (scroll position, typed text and all).

The screens under the top one stay **mounted**, which means they still exist in memory and keep their state. That is why going back is instant.

The `Stack` in Expo Router is a **native** stack. It uses the real iOS and Android navigation views (through the `react-native-screens` library), not a JavaScript imitation. So you get:

- On **iOS**: the slide-in animation from the right, the swipe-from-left-edge gesture to go back, and the standard iOS header.
- On **Android**: the system's own screen animation, the Android back button and back gesture, and a Material style header.

You did not write any of that. You only pick options.

## Three places to set options

Options are settings for a screen, like its title or header color. You can set them in three places, from "all screens" down to "this one screen right now".

### 1. screenOptions: every screen in the stack

```tsx
// src/app/_layout.tsx
<Stack
  screenOptions={{
    headerStyle: { backgroundColor: '#7C5CFC' },
    headerTintColor: '#FFFFFF',
    headerTitleStyle: { fontWeight: '700' },
  }}
/>
```

- `headerStyle` sets the header background. Only `backgroundColor` is supported here, since it is a native header, not a normal `View`.
- `headerTintColor` colors the back arrow and the title.
- `headerTitleStyle` changes the title font (`fontFamily`, `fontSize`, `fontWeight`, `color`).

### 2. Stack.Screen in the layout: one route

Put `Stack.Screen` elements inside the `Stack` to configure single routes. The `name` is the route file's name without `.tsx`:

```tsx
// src/app/_layout.tsx
<Stack screenOptions={{ headerTintColor: '#7C5CFC' }}>
  <Stack.Screen name="index" options={{ title: 'HabitHop' }} />
  <Stack.Screen name="stats" options={{ title: 'Your stats' }} />
</Stack>
```

Listing a `Stack.Screen` does **not** create a route, the file does that. It only adds options. Any route file you do not list still works, with default options.

### 3. Stack.Screen inside the screen: options that depend on data

Sometimes the title depends on what the screen shows, like a habit name. You can render `Stack.Screen` *inside the screen component itself*. It draws nothing, it only updates the header:

```tsx
// src/app/stats.tsx
import { Stack } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { useHabits } from '@/context/HabitsContext';

export default function StatsScreen() {
  const { habits } = useHabits();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: 'Stats', headerLargeTitleEnabled: true }} />
      <Text style={{ padding: 16 }}>You are tracking {habits.length} habits.</Text>
    </ScrollView>
  );
}
```

`headerLargeTitleEnabled` shows the big bold iOS title that shrinks into the bar when you scroll. It is **iOS only** (Android ignores it), and it only collapses on scroll when the screen's `ScrollView` or `FlatList` has `contentInsetAdjustmentBehavior="automatic"`.

You will use this third style a lot in [Dynamic Routes and Route Params](/courses/react-native/dynamic-routes) to show `💧 Drink water` as the title of a habit page.

If options are set in more than one place, the most specific one wins: options inside the screen beat `Stack.Screen` in the layout, which beats `screenOptions`.

## Useful header options

Here are the options you will reach for most. All of them are checked by TypeScript, so your editor autocompletes them.

| Option | What it does |
| --- | --- |
| `title` | The text in the header. Defaults to the route name, like `index`. |
| `headerShown` | `false` hides the header completely. |
| `headerStyle` | `{ backgroundColor }` of the header. |
| `headerTintColor` | Color of the back button and title. |
| `headerTitleStyle` | Font of the title. |
| `headerBackTitle` | Text next to the back arrow (iOS and web only). |
| `headerBackButtonDisplayMode` | `'minimal'` shows just the arrow, no text (iOS). |
| `headerRight` / `headerLeft` | A function returning a component, such as a button. |
| `headerLargeTitleEnabled` | Big collapsing title (iOS only). |

And a few that control the screen itself, not the header:

| Option | What it does |
| --- | --- |
| `animation` | `'default'`, `'fade'`, `'slide_from_right'`, `'slide_from_bottom'`, `'none'` and more. |
| `gestureEnabled` | `false` turns off the swipe-back gesture on iOS. |
| `contentStyle` | Style for the screen's background container, like `{ backgroundColor: '#F5F3FF' }`. |
| `presentation` | `'modal'`, `'formSheet'` and more. Covered in [Modal Screens](/courses/react-native/modal-screens). |

## Adding a header button

HabitHop's home screen should have a small stats icon in the top right corner. Use `headerRight` with a `Link` that wraps a `Pressable`:

```tsx
// src/app/_layout.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Stack } from 'expo-router';
import { Pressable } from 'react-native';

<Stack.Screen
  name="index"
  options={{
    title: 'HabitHop',
    headerRight: () => (
      <Link href="/stats" asChild>
        <Pressable hitSlop={12} accessibilityLabel="Open stats">
          <Ionicons name="bar-chart" size={22} color="#FFFFFF" />
        </Pressable>
      </Link>
    ),
  }}
/>
```

A few details:

- `headerRight` is a **function** that returns the button, not the button itself.
- `asChild` tells `Link` to pass its "go to `/stats`" behavior to the `Pressable` inside, instead of drawing its own text. You will see more of this in [Links and Navigating in Code](/courses/react-native/links-and-navigating).
- `hitSlop={12}` makes the touch area 12 points bigger on each side, because a 22 point icon is a small target for a thumb.
- `Ionicons` comes from `@expo/vector-icons`, which is already installed in Expo projects. See [Custom Fonts and Icons](/courses/react-native/fonts-and-icons).

What you will see: a purple header with a white "HabitHop" title and a white chart icon on the right. Tap the icon and the stats screen slides in with a white back arrow. On iOS the back button says "HabitHop" (the previous screen's title) unless you set `headerBackTitle`.

## Hiding the header for one screen

Some screens, like a welcome screen, look better with no header at all:

```tsx
<Stack.Screen name="welcome" options={{ headerShown: false }} />
```

Without a header, your content goes right up to the top of the phone, under the status bar and notch. Use the safe area tools from [Safe Areas: Notches, Status Bars and Home Bars](/courses/react-native/safe-areas) to keep text out of that area. When the header is visible, it already takes care of the top edge for you.

## The full root layout

Put it together and `src/app/_layout.tsx` looks like the file in the code panel: the `HabitsProvider` around a `Stack`, shared header colors in `screenOptions`, and per-screen titles. The screens themselves (`index.tsx`, `stats.tsx`) did not change at all, which is the point: navigation setup lives in layouts, screen content lives in screens.

## Common mistakes

**Typo in the Stack.Screen name.** If you write `<Stack.Screen name="Stats" />` (capital S) but the file is `stats.tsx`, the options never apply and you see a warning like this in the terminal:

```text
[Layout children]: No route named "Stats" exists in nested children: ["index", "stats", ...]
```

The `name` must match the file path exactly, without the extension.

**Passing an element instead of a function to headerRight.** `headerRight: <Button ... />` is a type error. Write `headerRight: () => <Button ... />`.

**Expecting headerStyle to accept any style.** Because the header is native, `headerStyle` only supports `backgroundColor`. Things like `height` or `borderBottomWidth` do nothing. To hide the thin line under the header, use `headerShadowVisible: false`.

**Header button too small to tap.** A bare 20 point icon is hard to hit, especially on Android. Add `hitSlop` or padding so the touch target is at least 44 points.

## Quick recap

- A stack pushes screens on top and pops them off when going back. Lower screens stay mounted and keep their state.
- Expo Router's `Stack` is native: real iOS and Android animations, gestures and headers.
- Set options in `screenOptions` (all screens), `Stack.Screen` in the layout (one route) or `Stack.Screen` inside a screen (dynamic values). The most specific wins.
- Common header options: `title`, `headerShown`, `headerStyle`, `headerTintColor`, `headerRight`, `headerLargeTitleEnabled` (iOS).
- `headerRight` takes a function. Wrap a `Pressable` in `Link asChild` for header buttons, and give it a big `hitSlop`.

<code id="code-content" class="language-tsx">
// src/app/_layout.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Stack } from 'expo-router';
import { Pressable } from 'react-native';
import { HabitsProvider } from '@/context/HabitsContext';
export default function RootLayout() {
  return (
    &lt;HabitsProvider&gt;
      &lt;Stack
        // Options for every screen in this stack
        screenOptions={{
          headerStyle: { backgroundColor: '#7C5CFC' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}
      &gt;
        {/* Options for one screen */}
        &lt;Stack.Screen
          name="index"
          options={{
            title: 'HabitHop',
            headerRight: () =&gt; (
              &lt;Link href="/stats" asChild&gt;
                &lt;Pressable hitSlop={12} accessibilityLabel="Open stats"&gt;
                  &lt;Ionicons name="bar-chart" size={22} color="#FFFFFF" /&gt;
                &lt;/Pressable&gt;
              &lt;/Link&gt;
            ),
          }}
        /&gt;
        &lt;Stack.Screen
          name="stats"
          options={{ title: 'Your stats', headerBackTitle: 'Today' }}
        /&gt;
      &lt;/Stack&gt;
    &lt;/HabitsProvider&gt;
  );
}
</code></pre>
