---
publishDate: 2026-10-23T11:00
title: Tab Navigation
slug: tab-navigation
metadescription: 'Add a bottom tab bar to HabitHop with Expo Router: JavaScript Tabs with vector icons first, then real native tabs with NativeTabs from expo-router/native-tabs.'
updateDate: 2026-10-23T11:00
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'expo-router', 'navigation', 'tabs']
course: react-native
---

## Why tabs

Most phone apps have a bar of buttons at the bottom: Home, Search, Profile. That is a **tab bar**, and each button opens a **tab**. Tabs are perfect for the few main areas of an app that people jump between all the time. Unlike a stack, switching tabs does not pile screens up: each tab stays alive, and coming back to it shows it exactly as you left it.

HabitHop gets three tabs:

- **Today**: the habit list (`index`)
- **Stats**: today's progress (`stats`)
- **Settings**: account and app settings (`settings`)

Expo Router gives you two ways to build them, and you will learn both:

1. **`Tabs`**, a tab bar drawn with JavaScript and React Native views. Very flexible: any icon, any style.
2. **`NativeTabs`**, which uses the real iOS and Android tab bar views. This is what a new Expo project uses, and it looks and feels exactly like the system apps.

## Step 1: move the tab screens into a (tabs) folder

Tabs are a navigator, so they need their own `_layout.tsx`. And a layout controls the screens *in its folder*. So the three tab screens need a folder of their own:

```text
src/app/
  _layout.tsx          <- root Stack
  (tabs)/
    _layout.tsx        <- the tab bar (new)
    index.tsx          <- Today (moved here)
    stats.tsx          <- Stats (moved here)
    settings.tsx       <- Settings (new)
  habit/
    [id].tsx           <- details, stays outside the tabs
```

The brackets in `(tabs)` are round, not square. A folder name in round brackets is a **route group**: it organizes files and gets its own layout, but it does **not** add anything to the URL. So `src/app/(tabs)/stats.tsx` is still just `/stats`, and every `Link` you wrote keeps working. You will dig into groups in [Nested Layouts and Route Groups](/courses/react-native/layouts-and-route-groups).

Move `index.tsx` and `stats.tsx` into `(tabs)`, and add a simple settings screen:

```tsx
// src/app/(tabs)/settings.tsx
import { Text, View } from 'react-native';

export default function SettingsScreen() {
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text>Settings will live here.</Text>
    </View>
  );
}
```

## Step 2: the tab layout with Tabs

Now create `src/app/(tabs)/_layout.tsx`:

```tsx
// src/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router/js-tabs';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#7C5CFC' }}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
```

This should feel familiar after [Stack Navigation and Headers](/courses/react-native/stack-navigation): a navigator, `screenOptions` for all screens, and `Tabs.Screen` for one screen. The order of the `Tabs.Screen` elements is the order of the buttons.

Note the import path: `expo-router/js-tabs`. You may see older code import `Tabs` from `'expo-router'` directly. That still works in this version but is marked deprecated, so use `expo-router/js-tabs` in new code.

`tabBarActiveTintColor` is the color of the selected tab's icon and label. There is also `tabBarInactiveTintColor` for the others.

## Step 3: icons

A tab bar without icons looks unfinished. `@expo/vector-icons` (already installed) has thousands. Each `Tabs.Screen` gets a `tabBarIcon` function. The tab bar calls it with the right `color` and `size`, and with `focused` set to `true` for the selected tab:

```tsx
// src/app/(tabs)/_layout.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';

<Tabs.Screen
  name="index"
  options={{
    title: 'Today',
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="checkmark-circle" size={size} color={color as string} />
    ),
  }}
/>
```

Why `color as string`? The tab bar types the color as React Native's general `ColorValue` type, while the icon component wants a `string`. In practice it *is* a string, so `as string` simply tells TypeScript "trust me". Without it you get this error:

```text
error TS2322: Type '____ColorValue_Internal' is not assignable to type 'string | NativeColorValue | undefined'.
  Type 'null' is not assignable to type 'string | NativeColorValue | undefined'.
```

A nice touch is a filled icon for the selected tab and an outline icon for the others:

```tsx
tabBarIcon: ({ color, size, focused }) => (
  <Ionicons
    name={focused ? 'bar-chart' : 'bar-chart-outline'}
    size={size}
    color={color as string}
  />
),
```

The full layout with all three icons is in the code panel. Browse icon names at icons.expo.fyi, and see [Custom Fonts and Icons](/courses/react-native/fonts-and-icons) for more about icon sets.

## Step 4: hide the root header over the tabs

Run the app now and you get **two** headers stacked on top of each other: one from the root `Stack`, and one from `Tabs` (JavaScript tabs show a header for each tab by default). The tab bar is one screen of the root stack, so tell the stack not to draw a header for it:

```tsx
// src/app/_layout.tsx
<Stack screenOptions={{ headerTintColor: '#7C5CFC' }}>
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen name="habit/[id]" options={{ title: 'Habit' }} />
</Stack>
```

What you will see now:

- A white tab bar at the bottom with three icons. The selected one is purple.
- Each tab has its own header with its title: "Today", "Stats", "Settings".
- Tapping a habit on the Today tab pushes the details screen *over* the tab bar, with a back arrow. That is because `habit/[id]` lives in the root stack, outside the tabs.
- Switch to Stats and back to Today: the list keeps its scroll position.

## Useful Tabs options

| Option | What it does |
| --- | --- |
| `title` | Label under the icon and the header title. |
| `tabBarIcon` | Function returning the icon. |
| `tabBarActiveTintColor` / `tabBarInactiveTintColor` | Colors of selected and other tabs. |
| `tabBarBadge` | A small bubble with a number or text, like `tabBarBadge: 3`. |
| `tabBarStyle` | Style of the bar itself, like `{ backgroundColor: '#111' }`. |
| `headerShown` | `false` hides the header of that tab. |
| `href: null` | Keeps the route but hides its button from the tab bar. |

## NativeTabs: the real system tab bar

`Tabs` is drawn by JavaScript to *look* native. **`NativeTabs`**, from `expo-router/native-tabs`, *is* native: it uses the actual iOS `UITabBarController` and the Android Material bottom navigation view. That brings platform details for free: on recent iOS versions you get the new glassy tab bar and its animations, on Android you get the Material 3 look with its pill-shaped indicator. Remember the template app from [Creating Your First App with Expo](/courses/react-native/create-your-first-app)? Its tabs were `NativeTabs`.

The API looks different. Instead of `options`, you compose small components:

```tsx
// src/app/(tabs)/_layout.tsx
import { NativeTabs } from 'expo-router/native-tabs';

export default function TabsLayout() {
  return (
    <NativeTabs tintColor="#7C5CFC">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="checkmark.circle.fill" md="check_circle" />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" />
        <NativeTabs.Trigger.Label>Stats</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge>1</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

- `NativeTabs.Trigger` is one tab button. Its `name` is the route, like `Tabs.Screen`.
- `NativeTabs.Trigger.Icon` takes **system icon names**: `sf` is an Apple SF Symbol (used on iOS), `md` is a Material Symbol (used on Android). You can also pass your own image with `src`, which is what the template does with `src={require('@/assets/images/tabIcons/home.png')}`.
- `NativeTabs.Trigger.Label` is the text, `NativeTabs.Trigger.Badge` is the bubble.
- `tintColor` on `NativeTabs` colors the selected tab.

`NativeTabs` works in Expo Go, so you can try it right away.

### Which one should HabitHop use?

| | `Tabs` (JS) | `NativeTabs` |
| --- | --- | --- |
| Look and feel | Close to native | Exactly native, follows OS updates |
| Styling | Anything you can draw | Limited to what the OS allows |
| Icons | Any React component | System symbols or images |
| Header per tab | Built in | None, nest a `Stack` if you need one |

A good rule: start with `NativeTabs` if the standard look is what you want, and use `Tabs` when you need a custom design (a floating bar, a big center button, your own animations). The rest of this course uses the JavaScript `Tabs` version because it shows headers out of the box and every option is easy to see, but either works with everything that follows.

## Common mistakes

**Two headers on screen.** If you see a header above another header, the root `Stack` is drawing one for `(tabs)`. Add `<Stack.Screen name="(tabs)" options={{ headerShown: false }} />`.

**A tab screen left outside the folder.** If `stats.tsx` stays in `src/app/` instead of `src/app/(tabs)/`, it is not a tab. It becomes a stack screen, and the `Tabs.Screen name="stats"` line prints a "No route named" warning.

**Two files for the same URL.** Keeping the old `src/app/index.tsx` *and* adding `src/app/(tabs)/index.tsx` gives two screens for the same URL `/`, and you cannot be sure which one opens. Delete the old file after moving it.

**Mixing up icon names.** `sf` names (like `chart.bar.fill`) only work on iOS and `md` names (like `bar_chart`) only on Android. Give both, or the tab has no icon on one platform.

## Quick recap

- Tabs are for the few main areas of an app. Each tab keeps its state when you switch away.
- Put tab screens in a group folder like `src/app/(tabs)/` with its own `_layout.tsx`. The group name does not appear in URLs.
- `Tabs` from `expo-router/js-tabs` is the flexible JavaScript tab bar. Use `Tabs.Screen` with `title` and `tabBarIcon`, and `color as string` for `@expo/vector-icons`.
- Hide the root stack header for the tabs with `headerShown: false` on `(tabs)`.
- `NativeTabs` from `expo-router/native-tabs` uses the real system tab bar, configured with `Trigger`, `Icon` (`sf` and `md`), `Label` and `Badge`.
- Screens like `habit/[id]` stay in the root stack, so they open over the tab bar.

<code id="code-content" class="language-tsx">
// src/app/(tabs)/_layout.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
export default function TabsLayout() {
  return (
    &lt;Tabs screenOptions={{ tabBarActiveTintColor: '#7C5CFC' }}&gt;
      &lt;Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) =&gt; (
            &lt;Ionicons name="checkmark-circle" size={size} color={color as string} /&gt;
          ),
        }}
      /&gt;
      &lt;Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, size }) =&gt; (
            &lt;Ionicons name="bar-chart" size={size} color={color as string} /&gt;
          ),
        }}
      /&gt;
      &lt;Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) =&gt; (
            &lt;Ionicons name="settings" size={size} color={color as string} /&gt;
          ),
        }}
      /&gt;
    &lt;/Tabs&gt;
  );
}
</code></pre>
