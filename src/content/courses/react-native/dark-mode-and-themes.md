---
publishDate: 2026-10-22T17:00
title: Dark Mode and Themes
slug: dark-mode-and-themes
metadescription: 'Support light and dark mode in React Native with useColorScheme, a theme colors object, themed components and an in-app appearance switcher.'
updateDate: 2026-10-22T17:00
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'dark-mode', 'theming', 'styling']
course: react-native
---

## Why dark mode matters

Most people use their phone in dark mode at least some of the time. When every other app on the phone turns dark at night and yours stays bright white, it feels broken. It also hurts the eyes.

Good news: the default Expo template already has a clean theme system built in. In this lesson you will:

- learn how your app finds out if the phone is in light or dark mode
- understand the template's `Colors` object and its `useTheme` hook
- add HabitHop's own colors to the theme
- make the navigation and status bar follow along
- build a "System / Light / Dark" switcher so users can choose

## Step 1: the app must allow dark mode

Open `app.json`. The template already has this line:

```json
{
  "expo": {
    "userInterfaceStyle": "automatic"
  }
}
```

`userInterfaceStyle` tells the phone which modes your app supports:

- `"automatic"`: follow the phone's setting. This is what you want.
- `"light"` or `"dark"`: always that mode, whatever the phone says.

If this is set to `"light"`, your code will **always** see light mode on iOS, even when the phone is dark. That is a common reason for "my dark mode does not work". This is a native setting, so after changing it you need a new development build (see [Expo Go vs Development Builds](/courses/react-native/expo-go-vs-development-builds)).

## Step 2: read the scheme with useColorScheme

React Native has a hook called **`useColorScheme`**. A **color scheme** is just the name for "light or dark". The hook returns `'light'` or `'dark'` and re-renders your component when it changes:

```tsx
// src/app/index.tsx
import { Text, View, useColorScheme } from 'react-native';

export default function Index() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
      <Text style={{ color: isDark ? '#fff' : '#000' }}>Hello, Mia!</Text>
    </View>
  );
}
```

Try it. Change your phone or simulator to dark mode (on the iOS simulator: Settings, Developer, Dark Appearance, or press Cmd+Shift+A; on Android: Settings, Display, Dark theme). The screen flips right away, without a reload.

The type of `scheme` is `'light' | 'dark' | null`. It is `null` only in rare cases where the system cannot tell. Comparing with `'dark'` treats `null` as light, which is a safe default.

This works, but writing `isDark ? ... : ...` for every color gets messy fast. You need a **theme**: one place that lists all your colors for each mode.

## Step 3: the template's theme

Open `src/constants/theme.ts`. The important part looks like this:

```ts
// src/constants/theme.ts (part)
export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
```

Notice that the colors have **role names**, not color names. It says `background` and `textSecondary`, not `white` and `grey`. That is the trick of every theme: your components ask for "the background color", and the theme answers with white or black depending on the mode.

`as const` tells TypeScript these values never change, and `ThemeColor` is a type that means "one of these role names". If you add a color to `light` but forget `dark`, it disappears from `ThemeColor`, and TypeScript complains wherever you use it. That is a nice safety net.

Next, `src/hooks/use-theme.ts` turns the scheme into the right set of colors:

```ts
// src/hooks/use-theme.ts
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? 'dark' : 'light';

  return Colors[theme];
}
```

(It imports `useColorScheme` from the project's own hook, which has a special version for web. You can read why in [Writing Platform-Specific Code](/courses/react-native/platform-specific-code).)

Now any component can do this:

```tsx
// src/components/HabitPreview.tsx
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function HabitPreview() {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Text style={[styles.name, { color: theme.text }]}>💧 Drink water</Text>
      <Text style={{ color: theme.textSecondary }}>3 day streak</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16 },
  name: { fontSize: 17, fontWeight: '600' },
});
```

See the pattern? Sizes, spacing and shapes stay in `StyleSheet.create` (they never change). Only the colors come from the theme, added with a style array. A **style array** like `[styles.card, { backgroundColor }]` merges styles from left to right; you met it in [Styling with StyleSheet](/courses/react-native/stylesheet-basics).

### Themed components

The template goes one step further with `ThemedText` and `ThemedView` in `src/components`. They call `useTheme` for you:

```tsx
// src/components/TodayHeader.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export function TodayHeader() {
  return (
    <ThemedView type="backgroundElement" style={{ padding: 16 }}>
      <ThemedText type="subtitle">Today</ThemedText>
      <ThemedText themeColor="textSecondary">2 of 3 done</ThemedText>
    </ThemedView>
  );
}
```

`ThemedView` takes a `type` prop with a color role for its background, and `ThemedText` takes a `themeColor` for its text color plus a `type` for its size (`title`, `subtitle`, `small` and so on). Use these for most of your screens and you get dark mode almost for free.

## Step 4: add HabitHop colors

HabitHop needs a brand color (a purple **tint** for buttons and links) and a soft card color. Add them to **both** modes:

```diff
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
+   tint: '#7C5CFC',
+   card: '#F4F2FF',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
+   tint: '#A08BFF',
+   card: '#1C1830',
  },
```

The dark tint is a little lighter. Strong, dark colors look dull and are hard to read on a black background, so dark themes usually use lighter, softer versions of the same color. The habit colors in `src/constants/colors.ts` (`#7C5CFC`, `#22C55E` and friends) are bright enough to work in both modes, so they can stay as they are.

Now `theme.tint` and `theme.card` work everywhere, with autocomplete.

## Step 5: navigation and the status bar

Your screens are themed now, but two things are drawn outside your components: the navigation (headers, tab bars) and the status bar.

**Navigation.** Expo Router gives you two ready-made navigation themes, `DefaultTheme` and `DarkTheme`. The template's root layout already uses them:

```tsx
// src/app/_layout.tsx
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const scheme = useColorScheme();

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
```

`ThemeProvider` hands the theme to every header and screen background that Expo Router draws, so a Stack header turns dark at the same time as your content. You will build this root layout properly in [Stack Navigation and Headers](/courses/react-native/stack-navigation).

**Status bar.** `<StatusBar style="auto" />` from `expo-status-bar` shows dark icons in light mode and light icons in dark mode. More about it in [Safe Areas: Notches, Status Bars and Home Bars](/courses/react-native/safe-areas).

## Step 6: let users choose

Some people want your app dark even when their phone is light, or the other way round. React Native's `Appearance` module can override the mode **for your app only**:

```tsx
// any file
import { Appearance } from 'react-native';

Appearance.setColorScheme('dark'); // always dark
Appearance.setColorScheme('light'); // always light
Appearance.setColorScheme('auto'); // follow the phone again
```

After the call, `useColorScheme()` returns the new value everywhere, so all your themed components, the navigation theme and the status bar update together. You do not need any extra state for the colors.

The code panel has a `ThemeSwitcher` component with three buttons: System, Light and Dark. It keeps the user's choice in `useState` so it can highlight the active button, and calls `Appearance.setColorScheme` when a button is pressed. Put it on a settings screen and try it: tap "Dark" and the whole app turns dark, even if the phone is light.

One limit: the choice is forgotten when the app restarts, because state only lives in memory. You will fix that by saving it with [AsyncStorage](/courses/react-native/async-storage) later in the course.

## Tips for good dark themes

- **Do not just invert colors.** Pure white text on pure black is harsh for long reading. Slightly grey text (like `textSecondary`) for less important text helps a lot.
- **Use surfaces, not shadows.** Shadows are hard to see on black. Show depth with a slightly lighter background instead, like `backgroundElement` (`#212225`) on `background` (`#000000`).
- **Check images and icons.** A black icon disappears on a black screen. Color icons with `theme.text`.
- **Test both modes** on every new screen. It takes ten seconds and saves embarrassing bugs.

## Common mistakes

**1. Dark mode never shows up on iOS.** `useColorScheme()` always returns `'light'`. Fix: set `"userInterfaceStyle": "automatic"` in `app.json`, then make a new development build.

**2. Colors are hard-coded inside StyleSheet.create.** `color: '#000'` in a stylesheet never changes, so the text becomes invisible in dark mode (black on black). Fix: keep colors out of `StyleSheet.create` and add them from `useTheme()` with a style array.

**3. A color is added to one mode only.** TypeScript says something like `Property 'tint' does not exist on type ...` when you use it. Fix: add the same key to both `light` and `dark`.

**4. The header stays white in dark mode.** Your screens are dark, but the Stack header is not. Fix: wrap the navigator in `ThemeProvider` with `DarkTheme` and `DefaultTheme`, as shown above.

## Quick recap

- `"userInterfaceStyle": "automatic"` in `app.json` lets your app follow the phone.
- `useColorScheme()` returns `'light'` or `'dark'` and re-renders when it changes.
- A theme lists colors by **role** (`background`, `text`, `tint`) for each mode. The template has one in `src/constants/theme.ts`, and `useTheme()` returns the right set.
- Keep sizes in `StyleSheet.create` and add theme colors with a style array, or use `ThemedText` and `ThemedView`.
- `ThemeProvider` with `DarkTheme`/`DefaultTheme` themes the navigation, `<StatusBar style="auto" />` themes the status bar.
- `Appearance.setColorScheme('light' | 'dark' | 'auto')` overrides the mode for your app only.
- Next: [Custom Fonts and Icons](/courses/react-native/fonts-and-icons).

<code id="code-content" class="language-tsx">
// src/components/ThemeSwitcher.tsx
import { useState } from 'react';
import { Appearance, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
type Choice = 'auto' | 'light' | 'dark';
const choices: { value: Choice; label: string }[] = [
  { value: 'auto', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
export function ThemeSwitcher() {
  const theme = useTheme(); // the colors for the current scheme
  const scheme = useColorScheme(); // 'light' or 'dark' right now
  const [choice, setChoice] = useState&lt;Choice&gt;('auto');
  function pick(value: Choice) {
    setChoice(value);
    // Overrides the phone setting for this app only. 'auto' follows the phone again.
    Appearance.setColorScheme(value);
  }
  return (
    &lt;View style={[styles.box, { backgroundColor: theme.backgroundElement }]}&gt;
      &lt;Text style={[styles.label, { color: theme.text }]}&gt;Appearance&lt;/Text&gt;
      &lt;View style={styles.row}&gt;
        {choices.map((c) =&gt; {
          const active = c.value === choice;
          return (
            &lt;Pressable
              key={c.value}
              onPress={() =&gt; pick(c.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.option, { backgroundColor: active ? theme.backgroundSelected : 'transparent' }]}&gt;
              &lt;Text style={{ color: theme.text, fontWeight: active ? '700' : '400' }}&gt;{c.label}&lt;/Text&gt;
            &lt;/Pressable&gt;
          );
        })}
      &lt;/View&gt;
      &lt;Text style={{ color: theme.textSecondary }}&gt;The app is in {scheme ?? 'light'} mode.&lt;/Text&gt;
    &lt;/View&gt;
  );
}
const styles = StyleSheet.create({
  box: { padding: 16, borderRadius: 16, gap: 12 },
  label: { fontSize: 17, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
});
</code></pre>
