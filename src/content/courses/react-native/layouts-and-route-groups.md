---
publishDate: 2026-10-23T12:30
title: Nested Layouts and Route Groups
slug: layouts-and-route-groups
metadescription: 'Understand how Expo Router layouts nest, why HabitHop has a Stack around its Tabs, how (group) folders work and how to give one tab its own stack.'
updateDate: 2026-10-23T12:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'expo-router', 'navigation', 'layouts']
course: react-native
---

## Layouts inside layouts

After [Tab Navigation](/courses/react-native/tab-navigation), HabitHop has two layout files: the root `src/app/_layout.tsx` with a `Stack`, and `src/app/(tabs)/_layout.tsx` with `Tabs`. That is a **nested layout**: one navigator living inside another. It is the single most important idea for structuring an Expo Router app, so this lesson slows down and looks at it properly.

Here is the rule from [How Expo Router Works](/courses/react-native/expo-router-basics), stated fully:

> A `_layout.tsx` file controls every route in its folder and all folders below it. A folder with its own `_layout.tsx` becomes **one screen** of the parent layout.

So for HabitHop:

```text
src/app/_layout.tsx               Stack (root)
├── (tabs)/_layout.tsx            ... one screen of the Stack, called "(tabs)"
│   ├── index.tsx                 ...... one tab of Tabs
│   ├── stats.tsx                 ...... one tab of Tabs
│   └── settings.tsx              ...... one tab of Tabs
└── habit/[id].tsx                ... one screen of the Stack
```

The root stack has only **two** screens: "the whole tab bar" and "a habit's details". When you open a habit, the stack pushes `habit/[id]` on top of the tab bar screen. That is why the details screen covers the tab bar and has a back arrow.

## Where a screen lives decides how it looks

This is worth saying clearly, because it is the question you will ask yourself every time you add a screen: **which layout should this file be under?**

- **Under the root Stack** (`src/app/habit/[id].tsx`): opens over everything, hides the tab bar, has a back button. Good for details pages, forms and anything that is "a step deeper".
- **Under the Tabs** (`src/app/(tabs)/stats.tsx`): is a tab. It gets a button in the tab bar. Good for the main sections of the app.
- **Under a Stack inside a tab** (see below): opens inside that tab, and the tab bar **stays visible**. Good for drilling down while staying in a section, like Settings, then About.

If you moved `habit/[id].tsx` into `(tabs)`, it would become a fourth tab. That is not what you want, which is why it stays outside.

## Route groups

A **route group** is a folder whose name is in round brackets, like `(tabs)`. Groups have three properties:

1. **They do not change URLs.** `src/app/(tabs)/stats.tsx` is `/stats`, not `/(tabs)/stats`.
2. **They can have their own `_layout.tsx`.** That is how `(tabs)` gets a tab bar without adding `/tabs` to every URL.
3. **They organize files.** Even without a layout, a group can just keep related files together.

The group name is your choice. `(tabs)`, `(main)` and `(app)` are all common. Later, in [Protected Routes and a Simple Login Flow](/courses/react-native/protected-routes), you will add an `(auth)` group for the sign-in screen:

```text
src/app/
  _layout.tsx
  (auth)/
    sign-in.tsx         -> /sign-in
  (tabs)/
    _layout.tsx
    index.tsx           -> /
    stats.tsx           -> /stats
    settings.tsx        -> /settings
  habit/
    [id].tsx            -> /habit/h1
```

With typed routes you can write either the short URL or the full path with the group in a `Link`. These two are the same route:

```tsx
<Link href="/stats">Stats</Link>
<Link href="/(tabs)/stats">Stats</Link>
```

The short form is easier to read, so use it unless two groups contain a file with the same name.

## The root layout in full

Here is HabitHop's root layout at this point. It is also in the code panel.

```tsx
// src/app/_layout.tsx
import { Stack } from 'expo-router';
import { HabitsProvider } from '@/context/HabitsContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <HabitsProvider>
      <Stack screenOptions={{ headerTintColor: '#7C5CFC' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="habit/[id]" options={{ title: 'Habit' }} />
      </Stack>
    </HabitsProvider>
  );
}
```

Two new things:

- `name="(tabs)"` refers to the whole group, brackets included, because the group is a single screen of this stack.
- `unstable_settings.anchor` is explained next.

### The anchor: what sits under a screen

Usually people start on Today and tap into a habit, so the stack is `(tabs)` then `habit/[id]`, and back works. But what if the app is opened *directly* on `/habit/h1`, for example from a notification or a link (see [Deep Linking](/courses/react-native/deep-linking))? Then the stack would contain only the habit screen, and there would be nothing to go back to.

`unstable_settings` is a special export that a layout file can have. Its `anchor` option names the route that should always be at the bottom of this stack. With `anchor: '(tabs)'`, opening `/habit/h1` directly gives a stack of `(tabs)` then `habit/[id]`, so the back arrow appears and leads to Today. The `unstable_` prefix means the name might still change in a future version, but it is the documented way to do this today.

## A stack inside a tab

Sometimes a tab needs its own little stack. Say Settings gets an "About HabitHop" page, and you want the tab bar to stay visible while you are on it. Turn `settings.tsx` into a folder with a layout:

```text
src/app/(tabs)/
  _layout.tsx
  index.tsx
  stats.tsx
  settings/
    _layout.tsx      <- a Stack just for this tab
    index.tsx        -> /settings
    about.tsx        -> /settings/about
```

```tsx
// src/app/(tabs)/settings/_layout.tsx
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="about" options={{ title: 'About HabitHop' }} />
    </Stack>
  );
}
```

Now the `settings` tab is a stack. Opening `/settings/about` pushes inside the tab, with a back arrow, and the tab bar stays at the bottom. The `Tabs.Screen name="settings"` line in the tabs layout still works, because the folder `settings` is one screen of the tabs.

One thing to fix when you do this: both the `Tabs` and the inner `Stack` want to draw a header, so you would see two. Add `headerShown: false` to that tab in `(tabs)/_layout.tsx`, and let the inner stack draw it:

```tsx
<Tabs.Screen name="settings" options={{ title: 'Settings', headerShown: false }} />
```

HabitHop keeps `settings.tsx` as a single file in this course, since it only has one page. But this pattern is how bigger apps (think of a store app with Home, then Category, then Product, all inside the Home tab) are built. It is also how you give `NativeTabs` headers, since native tabs do not draw headers themselves.

## Slot: a layout without a navigator

Not every layout needs a navigator. `Slot` renders the current child route and nothing else, so you can wrap screens in your own UI:

```tsx
import { Slot } from 'expo-router';
import { Text, View } from 'react-native';

export default function BannerLayout() {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 8, backgroundColor: '#FEF3C7' }}>
        <Text>Offline mode</Text>
      </View>
      <Slot />
    </View>
  );
}
```

Every screen under this layout gets the yellow banner on top, with no header, no animation, no back stack. Use it for shared wrappers. Use `Stack` or `Tabs` when you need actual navigation.

## Layouts are components

Do not forget that a layout is a normal React component that stays mounted while its child screens change. That makes it the right home for things that should be shared and long-lived:

- **Providers**: `HabitsProvider` in the root layout makes habits available everywhere. A provider in `(tabs)/_layout.tsx` would only be available to the tabs.
- **Shared options**: `screenOptions` set once for a group of screens.
- **Checks that guard a whole section**, like "is the user signed in?". That is the next big step for HabitHop.

## Common mistakes

**Two headers.** Every time a navigator sits inside another, both may draw a header. Decide which one should, and set `headerShown: false` on the other (on the `Stack.Screen` or `Tabs.Screen` that holds the nested navigator).

**Same URL in two groups.** `src/app/(tabs)/settings.tsx` and `src/app/(auth)/settings.tsx` both want `/settings`. Rename one, or always link with the full group path so it is clear which one you mean.

**Writing the URL with the group in the browser.** Groups are invisible in real URLs. A deep link to `habithop://(tabs)/stats` is wrong, use `habithop://stats`.

**Putting a provider in the wrong layout.** If `HabitsProvider` sits in `(tabs)/_layout.tsx`, then `habit/[id].tsx` (outside the tabs) crashes with `useHabits must be used inside <HabitsProvider>`. App-wide providers belong in the root layout.

## Quick recap

- Each `_layout.tsx` controls its folder. A folder with a layout is one screen of the parent layout.
- HabitHop's root `Stack` has the `(tabs)` group as one screen and `habit/[id]` as another, so details open over the tab bar.
- Folders in round brackets are route groups. They never appear in URLs, but can have their own layout.
- `export const unstable_settings = { anchor: '(tabs)' }` keeps the tabs under any screen opened directly.
- A folder with a `Stack` layout inside a tab gives that tab its own drill-down navigation while the tab bar stays visible.
- `Slot` renders the child route with no navigator, for shared wrappers.

<code id="code-content" class="language-tsx">
// src/app/_layout.tsx
import { Stack } from 'expo-router';
import { HabitsProvider } from '@/context/HabitsContext';
// If the app opens straight on a habit (for example from a link),
// put the tabs underneath it so the back button has somewhere to go.
export const unstable_settings = {
  anchor: '(tabs)',
};
export default function RootLayout() {
  return (
    &lt;HabitsProvider&gt;
      &lt;Stack screenOptions={{ headerTintColor: '#7C5CFC' }}&gt;
        {/* The whole tab bar is ONE screen of this stack */}
        &lt;Stack.Screen name="(tabs)" options={{ headerShown: false }} /&gt;
        {/* Pushed on top of the tabs, so it covers the tab bar */}
        &lt;Stack.Screen name="habit/[id]" options={{ title: 'Habit' }} /&gt;
      &lt;/Stack&gt;
    &lt;/HabitsProvider&gt;
  );
}
</code></pre>
