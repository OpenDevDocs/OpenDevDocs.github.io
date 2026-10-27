---
publishDate: 2026-10-21T14:00
title: Understanding the Project Files
slug: project-structure
metadescription: 'A friendly tour of every file in a new Expo SDK 58 project: src/app routes, components, theme, app.json, package.json, tsconfig paths and the @/ import alias.'
updateDate: 2026-10-21T14:00
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'expo', 'project-structure']
course: react-native
---

## A map of your project

When you open a new Expo project for the first time, the number of files can feel like a lot. The good news: you only touch a few of them every day, and each one has one clear job.

This lesson is a tour of the default template you created with `npx create-expo-app@latest habit-hop` in [Creating Your First App with Expo](/courses/react-native/create-your-first-app). It shows the files **before** you run `npm run reset-project`, so you know what the example code was doing. At the end you will see where HabitHop's own files will live.

## The whole tree

```text
habit-hop/
├── app.json               app name, icon, splash screen, settings
├── package.json           libraries and npm scripts
├── package-lock.json      exact versions npm installed
├── tsconfig.json          TypeScript settings and the @/ alias
├── expo-env.d.ts          extra types from Expo (made for you)
├── .gitignore             files Git should not track
├── .vscode/               editor suggestions (Expo Tools extension)
├── assets/
│   ├── expo.icon/         the iOS app icon (Icon Composer format)
│   └── images/            app icon, splash image, demo images
├── scripts/
│   └── reset-project.js   the "clear the example" script
├── node_modules/          installed libraries (never edit)
└── src/
    ├── app/               SCREENS: every file here is a route
    │   ├── _layout.tsx
    │   ├── index.tsx
    │   └── explore.tsx
    ├── components/        reusable pieces of UI
    ├── constants/
    │   └── theme.ts       colors, fonts and spacing
    ├── hooks/             small reusable hooks
    └── global.css         CSS variables used by the web version
```

All your own code lives in `src`. The files around it are settings and tools. Let's go through them.

## src/app: your screens

`src/app` is the most important folder. **Every file in it becomes a screen** (also called a **route**, an address in your app, like a page URL on a website). This is called **file-based routing**, and it is how **Expo Router** works.

```text
src/app/index.tsx    ->  the "/" route, the first screen
src/app/explore.tsx  ->  the "/explore" route
src/app/_layout.tsx  ->  not a screen: it wraps the screens around it
```

Files that start with an underscore are special. `_layout.tsx` is a **layout**: a component that decides how the screens in its folder are shown, for example inside tabs or a stack with a back button.

In the template, the root layout looks like this:

```tsx
// src/app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
```

In plain words:

- `SplashScreen.preventAutoHideAsync()` keeps the **splash screen** (the image shown while the app starts) on screen until the app says it is ready.
- `useColorScheme()` reads whether the phone is in light or dark mode, and `ThemeProvider` passes matching colors to the navigation.
- `AnimatedSplashOverlay` plays the little logo animation when the app opens.
- `AppTabs` draws the tab bar at the bottom.

Rule of thumb from the template itself: **only screens and layouts go in `src/app`**. Everything else (components, helpers, types) goes in other folders in `src`. You will learn routing properly in [How Expo Router Works](/courses/react-native/expo-router-basics).

## src/components: reusable UI

A **component** you use on more than one screen goes here. The template has a few:

```text
src/components/
├── app-tabs.tsx            the native tab bar (Home and Explore)
├── app-tabs.web.tsx        a different tab bar for the web
├── animated-icon.tsx       the animated logo and splash overlay
├── animated-icon.web.tsx   the web version of it
├── animated-icon.module.css  styles used only by the web version
├── external-link.tsx       opens links in an in-app browser
├── hint-row.tsx            one row of the "get started" box
├── themed-text.tsx         Text that picks light or dark colors
├── themed-view.tsx         View that picks light or dark colors
├── web-badge.tsx           a small "made with Expo" badge on web
└── ui/
    └── collapsible.tsx     a section that opens and closes
```

Notice the files with `.web.tsx` at the end. This is a **platform extension**. When the app runs on the web, Metro picks `app-tabs.web.tsx`; on iOS and Android it picks `app-tabs.tsx`. Your import stays the same (`@/components/app-tabs`). You can also use `.ios.tsx` and `.android.tsx`. More on this in [Writing Platform-Specific Code](/courses/react-native/platform-specific-code).

`app-tabs.tsx` is worth a look, because it shows **native tabs**: a real iOS or Android tab bar, not one drawn in JavaScript:

```tsx
// src/components/app-tabs.tsx (shortened)
import { NativeTabs } from 'expo-router/native-tabs';

export default function AppTabs() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

Each `NativeTabs.Trigger` points at a screen file by `name`. You will build HabitHop's own tabs in [Tab Navigation](/courses/react-native/tab-navigation).

## src/constants and src/hooks

`src/constants/theme.ts` holds the design values: a `Colors` object with `light` and `dark` colors, `Fonts` for each platform and a `Spacing` scale (4, 8, 16, 24 and so on). Keeping them in one place means you change a color once and the whole app follows.

```ts
// src/constants/theme.ts (a small part)
export const Colors = {
  light: { text: '#000000', background: '#ffffff' /* ... */ },
  dark: { text: '#ffffff', background: '#000000' /* ... */ },
} as const;
```

`src/hooks` holds small **custom hooks** (functions starting with `use` that reuse logic):

- `use-color-scheme.ts` re-exports React Native's `useColorScheme`. The `.web.ts` version waits until the page is ready in the browser before trusting the value.
- `use-theme.ts` returns the right color set (`Colors.light` or `Colors.dark`) for the current mode.

You will build on these ideas in [Dark Mode and Themes](/courses/react-native/dark-mode-and-themes).

`src/global.css` only matters for the web version: it defines CSS font variables. Native screens do not use CSS.

## assets: images and icons

`assets/images` holds pictures the app bundles: the app **icon**, the Android **adaptive icon** layers, the **splash** image and the demo images. `assets/expo.icon` is an icon made with Apple's Icon Composer tool, used for the newer iOS icon styles. You will replace these with HabitHop's own art in [App Config, Icons and the Splash Screen](/courses/react-native/app-config-icons-and-splash), and learn how to show images in [Showing Images](/courses/react-native/images).

## app.json: the app's settings

`app.json` describes your app to Expo: its name, icon, splash screen and platform settings. Here are the parts you should know now:

```json
{
  "expo": {
    "name": "habit-hop",
    "slug": "habit-hop",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "habithop",
    "userInterfaceStyle": "automatic",
    "plugins": ["expo-router"],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    }
  }
}
```

- `name` is the name under the icon on the home screen. `slug` is the project's id on Expo's servers.
- `orientation: "portrait"` locks the app upright.
- `scheme` is the app's own link prefix, like `habithop://`, used for [Deep Linking](/courses/react-native/deep-linking). Your file may show a different value at first; set it to `habithop` so it matches this course.
- `userInterfaceStyle: "automatic"` lets the app follow the phone's light or dark mode.
- `plugins` lists **config plugins**, small scripts that set up native settings for a library.
- `experiments.typedRoutes` makes TypeScript check your links, so a typo in a route name is an error.
- `experiments.reactCompiler` turns on the **React Compiler**, which speeds up your components automatically. See [React Compiler](/courses/react/react-compiler) for how it works.

The real file also has `ios`, `android` and `web` sections plus a splash screen plugin. Changes in `app.json` usually need a restart of the dev server.

## package.json: libraries and scripts

```json
{
  "name": "habit-hop",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "reset-project": "node ./scripts/reset-project.js",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "lint": "expo lint"
  }
}
```

- `main` is where the app starts. `expo-router/entry` finds `src/app` and boots the router, so there is no `App.tsx`.
- `scripts` are shortcuts you run with `npm run <name>`, like `npm run android`.
- The real file also lists `dependencies`: `expo`, `react`, `react-native`, `expo-router`, `expo-image` and more, all at versions that match SDK 58.

To add a library, use `npx expo install` instead of plain `npm install`. It picks the version that matches your SDK:

```bash
npx expo install @react-native-async-storage/async-storage
```

## tsconfig.json and the @/ alias

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"],
      "@/assets/*": ["./assets/*"]
    }
  }
}
```

`strict: true` turns on TypeScript's careful checks. The `paths` part creates an **import alias**: a short name for a folder. `@/` means "the `src` folder", and `@/assets/` means the `assets` folder. Compare:

```tsx
// Without the alias, from a deep file:
import { habitColors } from '../../../constants/colors';

// With the alias, from anywhere:
import { habitColors } from '@/constants/colors';
```

The alias works the same from every file, so moving a file never breaks its imports.

## Files you should not edit

- `node_modules/`: installed libraries. Delete it and run `npm install` if it gets broken, but never edit inside it.
- `package-lock.json`: npm keeps it up to date. Do commit it to Git.
- `expo-env.d.ts`: Expo writes it for you. It is in `.gitignore`.
- `.expo/`: a hidden folder the dev server creates for its own data (like generated route types). Also ignored by Git.

You may also see `ios/` and `android/` folders later. Those hold generated native projects; this project creates them only when needed, and `.gitignore` already ignores them.

## Where HabitHop's files will go

After the reset, you will grow `src` like this over the course:

```text
src/
├── app/                 screens and layouts only
├── components/          HabitCard.tsx, EmptyState.tsx
├── constants/           colors.ts (the habit color palette)
├── context/             HabitsContext.tsx (shared habit state)
├── lib/                 dates.ts, storage.ts, db.ts
└── types/               habit.ts (the Habit type)
```

Let's create the first one now, the color palette:

```ts
// src/constants/colors.ts
export const habitColors = ['#7C5CFC', '#22C55E', '#F97316', '#0EA5E9', '#EC4899'];
```

## Common mistakes

**Putting components inside `src/app`.** Every file there becomes a route, so a `src/app/HabitCard.tsx` file turns into a screen at `/HabitCard`. Keep components in `src/components`.

**Using `@/` for a file that is not in `src`.** `@/utils/x` looks for `src/utils/x`. If the file is somewhere else you get:

```text
Unable to resolve "@/utils/x" from "src/app/index.tsx"
```

Move the file into `src`, or fix the path.

**Installing libraries with the wrong version.** `npm install some-expo-library` may grab a version made for a newer SDK, and the app crashes with a native module error. Use `npx expo install`, and run `npx expo install --check` to find mismatches.

## Quick recap

- `src/app` holds screens and layouts; every file there is a route. `_layout.tsx` wraps the screens around it.
- `src/components`, `src/constants` and `src/hooks` hold reusable UI, design values and hooks. `.web.tsx` files are picked only on the web.
- `app.json` configures the app (name, icon, scheme, plugins, typed routes, React Compiler).
- `package.json` starts the app at `expo-router/entry` and holds npm scripts. Add libraries with `npx expo install`.
- `tsconfig.json` makes `@/` point at `src` and `@/assets/` at `assets`.
- Next, learn the dev server's tricks in [The Dev Server, Fast Refresh and the Dev Menu](/courses/react-native/dev-server-and-fast-refresh).

<code id="code-content" class="language-tsx">
// src/app/index.tsx
// The home screen, importing HabitHop's palette with the @/ alias.
import { StyleSheet, Text, View } from 'react-native';
import { habitColors } from '@/constants/colors';
// ---
export default function Index() {
  return (
    &lt;View style={styles.container}&gt;
      &lt;Text style={styles.title}&gt;HabitHop colors&lt;/Text&gt;
      &lt;Text style={styles.hint}&gt;Loaded from src/constants/colors.ts&lt;/Text&gt;
      &lt;View style={styles.row}&gt;
        {habitColors.map((color) =&gt; (
          &lt;View key={color} style={[styles.swatch, { backgroundColor: color }]} /&gt;
        ))}
      &lt;/View&gt;
    &lt;/View&gt;
  );
}
// ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  hint: {
    color: '#666666',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
</code></pre>
