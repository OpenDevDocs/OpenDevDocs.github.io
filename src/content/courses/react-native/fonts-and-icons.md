---
publishDate: 2026-10-22T18:30
title: Custom Fonts and Icons
slug: fonts-and-icons
metadescription: 'Load custom fonts in Expo with useFonts or the expo-font config plugin, keep the splash screen up while they load, and add icons with @expo/vector-icons.'
updateDate: 2026-10-22T18:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'fonts', 'icons', 'expo']
course: react-native
---

## Give HabitHop a personality

The system font is fine, but it makes every app look the same. A friendly rounded font and a few clear icons make HabitHop feel like a real product. They also help people: an icon next to a word is faster to understand than the word alone.

In this lesson you will:

- add the free **Nunito** font to HabitHop
- load it in two ways: with the `useFonts` hook, and with the `expo-font` config plugin
- keep the splash screen visible until the font is ready, so nothing flickers
- use thousands of ready-made icons from **@expo/vector-icons**

Both `expo-font` and `@expo/vector-icons` come with every new Expo project, so there is nothing to install.

## Getting the font files

A font is just a file, usually `.ttf` (TrueType) or `.otf` (OpenType). Download Nunito from Google Fonts (it is free to use in apps). In the download you will find a `static` folder with one file per weight. Copy the two you need into your project:

```text
habit-hop/
  assets/
    fonts/
      Nunito-Regular.ttf
      Nunito-Bold.ttf
  src/
    app/
      _layout.tsx
```

Why one file per weight? On the web you can load one font and ask for `font-weight: 700`. In React Native, each weight (regular, bold, extra bold) is usually its own file, and you load each one under its own name. Only load the weights you really use, because every file makes your app bigger.

## Way 1: the useFonts hook

The `useFonts` hook from `expo-font` loads font files while the app runs. It works in Expo Go, so it is the easiest way to start.

```tsx
// src/app/_layout.tsx
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Nunito-Regular': require('@/assets/fonts/Nunito-Regular.ttf'),
    'Nunito-Bold': require('@/assets/fonts/Nunito-Bold.ttf'),
  });

  if (!loaded && !error) {
    return null;
  }

  return <Stack />;
}
```

How it works:

- You pass an object. Each **key** is the name you choose for the font (`'Nunito-Bold'`). Each **value** is the file, loaded with `require`. `require` tells Metro to include the file in your app, just like images.
- The hook returns two things: `loaded` (becomes `true` when all fonts are ready) and `error` (an `Error` if something went wrong, otherwise `null`).
- Loading takes a moment, so for the first few frames `loaded` is `false`. Returning `null` means "draw nothing yet".

We put this in the **root layout**, the top-most file of the app. That way the fonts load once, before any screen shows.

Why return the app when there is an `error`? If a font fails to load, it is better to show the app in the system font than to show a blank screen forever.

### Using the font

Now use the name you chose as the `fontFamily`:

```tsx
// src/components/HabitCard.tsx (part)
const styles = StyleSheet.create({
  name: { fontFamily: 'Nunito-Bold', fontSize: 17 },
  streak: { fontFamily: 'Nunito-Regular', fontSize: 13, color: '#666' },
});
```

Notice there is no `fontWeight: 'bold'` here. The weight is already in the font file. If you write `fontFamily: 'Nunito-Regular', fontWeight: 'bold'`, Android and iOS each guess how to fake a bold version, and the results are different and often ugly. Use the bold file instead.

## Keep the splash screen up while loading

Returning `null` shows an empty screen for a split second. With the **splash screen** (the logo screen the phone shows while your app starts) you can hide that moment completely. The `expo-splash-screen` package lets you say "keep the splash up until I am ready":

```tsx
// src/app/_layout.tsx (part)
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

// Runs once, when this file is first loaded
SplashScreen.preventAutoHideAsync();

// inside RootLayout, after useFonts:
useEffect(() => {
  if (loaded || error) {
    SplashScreen.hideAsync();
  }
}, [loaded, error]);
```

1. `preventAutoHideAsync()` is called at the top of the file, outside the component, so it runs as early as possible. It stops the splash from hiding by itself.
2. When the fonts are ready (or failed), an **effect** calls `hideAsync()`. An effect is code that runs after React draws the screen; you will learn all about them in [Effects and the App Lifecycle](/courses/react-native/effects-and-app-state).

Now the user sees: splash screen, then the app with the right font. No blank flash, no font jump. The full root layout is in the code panel. You will learn how to change the splash image itself in [App Config, Icons and the Splash Screen](/courses/react-native/app-config-icons-and-splash).

## Way 2: the expo-font config plugin

There is a second way that does not need any loading code at all. You add the fonts to `app.json`, and they are built right into the native app:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-font",
        {
          "fonts": ["./assets/fonts/Nunito-Regular.ttf", "./assets/fonts/Nunito-Bold.ttf"]
        }
      ]
    ]
  }
}
```

A **config plugin** is a small script that changes the native iOS and Android projects for you when your app is built. Here it copies the font files into the native app. Your existing `plugins` list in `app.json` already has some entries; add this one next to them.

The good parts:

- The fonts are ready the instant the app starts. No `useFonts`, no waiting, no splash screen code.
- It is the method the Expo team recommends for apps you ship.

The catches:

- It changes native code, so it **does not work in Expo Go**. You need a development build, and a new build every time you add or change a font file (see [Expo Go vs Development Builds](/courses/react-native/expo-go-vs-development-builds)).
- The font name works a bit differently. On Android the name is the **file name** without `.ttf`. On iOS the name comes from **inside** the font file (its PostScript name). The easy fix is to keep the file names exactly as Google Fonts ships them, like `Nunito-Bold.ttf`, since the name inside matches. Then `fontFamily: 'Nunito-Bold'` works on both.

Which one should you use? While learning in Expo Go, use `useFonts`. Once you move to development builds, switch to the config plugin and delete the loading code.

## Icons with @expo/vector-icons

Icons are usually not images. They are **icon fonts**: special fonts where each "letter" is a little picture. That means icons are sharp at any size and take any color, just like text.

`@expo/vector-icons` bundles many popular icon sets: Ionicons, MaterialIcons, MaterialCommunityIcons, Feather, FontAwesome6 and more. You can search all of them on the icons.expo.fyi website. Import one set at a time:

```tsx
// src/components/StreakBadge.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';

export function StreakBadge({ streak }: { streak: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="flame" size={14} color="#F97316" />
      <Text>{streak} day streak</Text>
    </View>
  );
}
```

Each icon component takes three main props:

- `name`: which icon. TypeScript knows every valid name for the set, so you get autocomplete, and a typo like `"flme"` is a type error.
- `size`: the size in points (like `fontSize`).
- `color`: any color, so it works with your theme: `color={theme.text}`.

Importing from `'@expo/vector-icons/Ionicons'` (one set) instead of `'@expo/vector-icons'` (everything) keeps it clear which set you use.

### Storing icon names in variables

If you keep icon names in an object (for example for tabs), give it a type so TypeScript still checks the names:

```tsx
// src/constants/icons.ts
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const tabIcons: Record<'today' | 'stats' | 'settings', IconName> = {
  today: 'today-outline',
  stats: 'stats-chart',
  settings: 'settings-outline',
};
```

`ComponentProps<typeof Ionicons>['name']` means "whatever type the `name` prop of Ionicons has". It is a long way of saying "a valid Ionicons name".

### Preloading icon fonts

Icon fonts are fonts too, so they load the first time they are used. Usually that is instant, but on a slow device you can see an empty square for a moment. To avoid that, load them together with your own fonts. Each icon set has a `font` property you can spread into `useFonts`:

```tsx
// src/app/_layout.tsx (part)
const [loaded, error] = useFonts({
  'Nunito-Regular': require('@/assets/fonts/Nunito-Regular.ttf'),
  'Nunito-Bold': require('@/assets/fonts/Nunito-Bold.ttf'),
  ...Ionicons.font,
});
```

## Putting it together in HabitHop

Here is the `HabitCard` from [View and Text](/courses/react-native/view-and-text), now with the Nunito fonts, two icons and an `onToggle` prop: a flame next to the streak, and a check circle as the done button.

```tsx
// src/components/HabitCard.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Habit } from '@/types/habit';

type HabitCardProps = { habit: Habit; streak: number; isDone: boolean; onToggle: () => void };

export function HabitCard({ habit, streak, isDone, onToggle }: HabitCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>{habit.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{habit.name}</Text>
        <View style={styles.streakRow}>
          <Ionicons name="flame" size={14} color="#F97316" />
          <Text style={styles.streak}>{streak} day streak</Text>
        </View>
      </View>
      <Pressable onPress={onToggle} hitSlop={8} accessibilityRole="button" accessibilityLabel={isDone ? 'Mark as not done' : 'Mark as done'}>
        <Ionicons name={isDone ? 'checkmark-circle' : 'ellipse-outline'} size={32} color={isDone ? '#22C55E' : '#9CA3AF'} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: '#F4F2FF' },
  emoji: { fontSize: 28 },
  name: { fontFamily: 'Nunito-Bold', fontSize: 17 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streak: { fontFamily: 'Nunito-Regular', fontSize: 13, color: '#666' },
});
```

A few details worth noticing:

- The done button shows an empty circle (`ellipse-outline`) or a green check (`checkmark-circle`). Swapping the icon `name` is all it takes.
- An icon has no text, so a screen reader has nothing to read. `accessibilityLabel` tells it what the button does. See [Accessibility: Apps Everyone Can Use](/courses/react-native/accessibility).
- `hitSlop={8}` makes the tap area 8 points bigger on each side, because a 32 point icon is a small target for a thumb.

Right now the parent passes `streak` and `isDone` in. In [State and Props in a Mobile App](/courses/react-native/state-and-props) the card learns to work them out from the habit itself.

### What about SF Symbols?

You may have seen Apple's **SF Symbols** in iOS apps. The `expo-symbols` package can show them on iOS (and Google's Material Symbols on Android). The template uses native tab icons too. For a simple, same-on-every-platform look, `@expo/vector-icons` is the easiest choice, and it is what this course uses.

## Common mistakes

**1. The font does not show, and there is no error.** You see the system font. Usually the `fontFamily` does not match the key you used in `useFonts` exactly (it is case-sensitive). Fix: copy the key, for example `'Nunito-Bold'`, into the style.

**2. The text "jumps" when the app starts.** For a moment the text shows in the system font, then it switches to Nunito and the layout shifts. A screen was drawn before the font was loaded (React Native quietly falls back to the system font instead of showing an error). Fix: return `null` and keep the splash screen up until `loaded` (or `error`) is set, as shown above:

```diff
+ if (!loaded && !error) {
+   return null;
+ }
  return <Stack />;
```

**3. The config plugin font works on Android but not on iOS.** The file was renamed, so its inner PostScript name does not match the file name. Fix: keep the original file name, or check the font's real name and use that.

**4. Bold looks strange.** You used `fontWeight: 'bold'` with a custom regular font. Fix: load the bold file and use its name as the `fontFamily`.

## Quick recap

- Put font files in `assets/fonts`, one file per weight, and only load what you use.
- `useFonts({ name: require(file) })` loads fonts at runtime and works in Expo Go. Wait for `loaded` (or `error`) before showing the app.
- `SplashScreen.preventAutoHideAsync()` plus `hideAsync()` in an effect hides the loading moment.
- The `expo-font` config plugin builds fonts into the app. Faster start, but it needs a development build.
- Use the font's name as `fontFamily`, and the bold file instead of `fontWeight: 'bold'`.
- `@expo/vector-icons` gives you typed icon components with `name`, `size` and `color`. Spread `Ionicons.font` into `useFonts` to preload it.

<code id="code-content" class="language-tsx">
// src/app/_layout.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
// Keep the splash screen up until the fonts are ready
SplashScreen.preventAutoHideAsync();
export default function RootLayout() {
  const [loaded, error] = useFonts({
    // The key is the name you will use as fontFamily
    'Nunito-Regular': require('@/assets/fonts/Nunito-Regular.ttf'),
    'Nunito-Bold': require('@/assets/fonts/Nunito-Bold.ttf'),
    // Preload the icon font too, so icons never pop in late
    ...Ionicons.font,
  });
  useEffect(() =&gt; {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);
  // Render nothing (the splash is still showing) until loading has finished
  if (!loaded &amp;&amp; !error) {
    return null;
  }
  return &lt;Stack /&gt;;
}
</code></pre>
