---
publishDate: 2026-10-25T12:30
title: Course Review and Where to Go Next
slug: next-steps
metadescription: 'Look back at everything you built in HabitHop, from your first View to the App Store, and pick your next React Native project and skills to learn.'
updateDate: 2026-10-25T12:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'expo', 'review']
course: react-native
---

## You built a real app

Take a moment. When you started this course, you may never have made a phone app. Now you have **HabitHop**: a habit tracker with tabs, a modal form, streaks, saved data, a quote of the day from an API, photos, reminders, animations, tests, and a path to Google Play and the App Store.

More importantly, you know *how* each piece works, so you can build the next app without a course holding your hand. This last lesson walks back through the whole course, section by section, so you can see the big picture and jump back to any lesson you want to review. Then it gives you ideas for what to build and learn next.

## The big picture in one file

The root layout ties most of the course together. Every provider you added along the way wraps the app here:

```tsx
// src/app/_layout.tsx (the shape of it)
<QueryClientProvider client={queryClient}>
  <SQLiteProvider databaseName="habithop.db" onInit={migrateDbIfNeeded}>
    <HabitsProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="habit/[id]" options={{ title: 'Habit' }} />
        <Stack.Screen name="new-habit" options={{ presentation: 'modal' }} />
      </Stack>
    </HabitsProvider>
  </SQLiteProvider>
</QueryClientProvider>
```

Read it from the outside in: server data (TanStack Query), then the database (SQLite), then your app state (habits context), then the navigation (a stack with tabs inside). The full file is in the code panel.

And here is the project you ended up with:

```text
habit-hop/
  app.json
  eas.json
  jest.setup.js
  src/
    app/
      _layout.tsx
      new-habit.tsx
      (tabs)/
        _layout.tsx
        index.tsx
        stats.tsx
        settings.tsx
      habit/
        [id].tsx
    components/
      HabitCard.tsx
      EmptyState.tsx
    context/
      HabitsContext.tsx
    lib/
      dates.ts
      db.ts
      quotes.ts
      storage.ts
    constants/
      colors.ts
    types/
      habit.ts
```

## Section by section

### Getting Started

You learned what React Native is: React components that turn into real native views, not a web page in a box ([What is React Native?](/courses/react-native/what-is-react-native) and [How React Native Works Under the Hood](/courses/react-native/how-react-native-works)). You set up your computer, created the project with `npx create-expo-app@latest`, and learned the files ([Creating Your First App with Expo](/courses/react-native/create-your-first-app), [Understanding the Project Files](/courses/react-native/project-structure)). You also met the difference between Expo Go and your own development build ([Expo Go vs Development Builds](/courses/react-native/expo-go-vs-development-builds)).

### Core Components

`View` and `Text` instead of `div` and `p` ([View and Text](/courses/react-native/view-and-text)), `TextInput` for typing ([Getting Text from Users with TextInput](/courses/react-native/text-input)), `Pressable` for anything tappable ([Buttons and Pressable](/courses/react-native/buttons-and-pressable)), and `FlatList` for long lists that only render what is on screen ([Long Lists with FlatList](/courses/react-native/flatlist)).

### Styling and Layout

`StyleSheet` and Flexbox with `flexDirection: 'column'` as the default ([Layout with Flexbox](/courses/react-native/flexbox-layout)), safe areas for notches and home bars ([Safe Areas](/courses/react-native/safe-areas)), code that differs per platform ([Writing Platform-Specific Code](/courses/react-native/platform-specific-code)), and light and dark themes ([Dark Mode and Themes](/courses/react-native/dark-mode-and-themes)).

### State and Logic

State and props in a mobile app ([State and Props in a Mobile App](/courses/react-native/state-and-props)), forms that check input ([Building Forms and Checking Input](/courses/react-native/forms-and-validation)), the keyboard ([Handling the Keyboard](/courses/react-native/keyboard-handling)), and shared state with context and a reducer ([Sharing State with Context](/courses/react-native/context-for-shared-state), [useReducer and Custom Hooks](/courses/react-native/usereducer-and-custom-hooks)).

### Navigation with Expo Router

Files in `src/app` become screens ([How Expo Router Works](/courses/react-native/expo-router-basics)). You built stacks, tabs and a modal ([Stack Navigation and Headers](/courses/react-native/stack-navigation), [Tab Navigation](/courses/react-native/tab-navigation), [Modal Screens](/courses/react-native/modal-screens)), passed data through the URL ([Dynamic Routes and Route Params](/courses/react-native/dynamic-routes)), protected screens behind a login ([Protected Routes and a Simple Login Flow](/courses/react-native/protected-routes)) and opened the app from links ([Deep Linking](/courses/react-native/deep-linking)).

### Data and Storage

Fetching from an API with loading and error states ([Fetching Data from an API](/courses/react-native/fetching-data), [Loading States, Errors and Pull to Refresh](/courses/react-native/loading-and-refreshing)), caching it with [TanStack Query](/courses/react-native/tanstack-query), and saving data on the phone three ways: [AsyncStorage](/courses/react-native/async-storage) for simple data, [SecureStore](/courses/react-native/secure-store) for secrets like tokens, and [SQLite](/courses/react-native/sqlite-database) for a real database. You also handled being offline ([Offline Support and Network Status](/courses/react-native/offline-and-network-status)).

### Device Features

Asking for permissions politely ([Asking for Permissions the Right Way](/courses/react-native/permissions)), then using the [camera](/courses/react-native/camera), the [photo gallery](/courses/react-native/image-picker), [location](/courses/react-native/location), [local notifications](/courses/react-native/notifications), [haptics, sharing and the clipboard](/courses/react-native/haptics-sharing-and-clipboard) and [files](/courses/react-native/file-system).

### Animations and Gestures

Starting with the built-in [Animated API](/courses/react-native/animated-api), then smooth UI-thread animations with [Reanimated](/courses/react-native/reanimated-basics), swipes and drags with [Gesture Handler](/courses/react-native/gestures), and items that animate in and out ([Entering, Exiting and Layout Animations](/courses/react-native/layout-animations)).

### Quality and Performance

Finding bugs with React Native DevTools ([Debugging React Native Apps](/courses/react-native/debugging)), keeping the JS thread free and lists fast ([Making Your App Fast](/courses/react-native/performance)), making the app work with screen readers and big fonts ([Accessibility](/courses/react-native/accessibility)), and proving it all works with [Jest and React Native Testing Library](/courses/react-native/testing).

### Shipping Your App

Name, IDs, icons and splash screen ([App Config, Icons and the Splash Screen](/courses/react-native/app-config-icons-and-splash)), public settings with `EXPO_PUBLIC_` variables ([Environment Variables and App Settings](/courses/react-native/environment-variables)), cloud builds ([EAS Build](/courses/react-native/eas-build)), the two stores ([Google Play](/courses/react-native/publishing-to-google-play) and the [App Store](/courses/react-native/publishing-to-the-app-store)), and fast JavaScript fixes ([EAS Update](/courses/react-native/eas-update)).

## The ideas that matter most

If you forget everything else, keep these:

- **It is React.** Components, props, state, hooks and context work the same as on the web. If you want to go deeper into React itself, the [React course](/courses/react/what-is-react-introduction-and-setup) is the next stop.
- **Native vs JavaScript.** Some changes need a new build (native libraries, permissions, icons, app config). Others are just JavaScript and work with Fast Refresh or EAS Update. Knowing which is which saves you hours.
- **Expo Go is for learning, development builds are for real apps.** As soon as you need a library that is not in Expo Go, make a development build.
- **Test on real devices, both platforms.** Android and iOS differ in small ways: shadows, keyboard behavior, permissions, back buttons. Cheap Android phones show performance problems your laptop hides.
- **Never ship secrets in the app.** Anything in the bundle can be read.
- **Read the types.** When you are unsure whether a prop exists, open the library's `.d.ts` files in `node_modules`. TypeScript and the types are the most up-to-date documentation you have.

## Make HabitHop your own

Before starting something new, try improving HabitHop. You know the code, so every feature is pure practice:

- **Weekly goals**: "Exercise 3 times a week" instead of every day. This changes how `getStreak` works, so write the tests first.
- **A calendar heat map** on the stats screen, like the green squares on GitHub, built with `View`s in a grid.
- **Home screen widgets** that show today's progress. This needs native code (widgets are written in Swift and Kotlin) and a config plugin, a good first step into native modules.
- **Sync across devices**: a small backend (for example with Supabase or Firebase, or your own API) and login. This combines [SecureStore](/courses/react-native/secure-store), [TanStack Query](/courses/react-native/tanstack-query) and [offline support](/courses/react-native/offline-and-network-status).
- **Translations**: show HabitHop in Hindi, Spanish or your own language with a library like `i18next` and `expo-localization`.

## New project ideas

Pick one that you would actually use. You will finish it more easily.

1. **Expense splitter** for trips with friends (Riya paid for dinner, Sam paid for the taxi). Practice: forms, SQLite, sharing a summary.
2. **Recipe box**: save recipes with photos, search them, and a step-by-step cooking mode that keeps the screen on. Practice: camera, image picker, FlatList performance, large text accessibility.
3. **Walk tracker**: record a route with location and show distance and time. Practice: location, permissions, background work, maps (with a library like `react-native-maps`).
4. **Flashcards with spaced repetition**: cards come back just before you would forget them. Practice: date logic, notifications, swipe gestures, Reanimated.
5. **A client for a public API** you like (weather, movies, books, space photos). Practice: TanStack Query, infinite scrolling lists, offline caching, deep links to items.

For each one: sketch the screens on paper, list the routes in `src/app`, decide where the data lives, then build one screen at a time.

## What to learn next

- **Push notifications** from a server, with `expo-notifications` and a push service. You learned local notifications; push notifications add a backend.
- **Native modules**: when no library does what you need, the Expo Modules API lets you write your own in Swift and Kotlin, with a TypeScript API on top.
- **End-to-end testing** with Maestro or Detox, which tap through a real app on a simulator.
- **Crash and error reporting** with a service like Sentry, so you hear about problems before users email you.
- **Analytics** to learn which features people use (and be honest about it in your privacy labels).
- **The web**: Expo Router apps can also run on the web, and if you want to build full websites with React, the [Next.js course](/courses/nextjs/what-is-nextjs) teaches the web side.
- **TypeScript in more depth**: the [TypeScript fundamentals lesson](/courses/javascript/typescript-fundamentals) in the JavaScript course is a good refresher.

## Staying up to date

React Native and Expo move fast. A new Expo SDK comes out a few times a year. Good habits:

- Read the Expo SDK release notes and the upgrade guide before upgrading.
- Upgrade with `npx expo install expo@latest` followed by `npx expo install --fix`, which brings all Expo packages to matching versions. Then run your tests and try a fresh development build.
- Use `npx expo-doctor` to check your project for common problems:

```bash
npx expo-doctor
```

- Do not upgrade the week you plan to ship. Upgrade, test, then ship.

## Quick recap

- You built and can ship a complete app: UI, navigation, state, storage, device features, animations, tests, builds, store releases and updates.
- The root layout shows the whole app: providers on the outside, navigation inside.
- Remember the big ideas: it is React; know native from JavaScript; use development builds; test on both platforms; no secrets in the app; read the types.
- Keep practicing by adding features to HabitHop, then build something new that you would use yourself.
- Keep learning: push notifications, native modules, end-to-end tests, crash reporting.

Thanks for building HabitHop all the way to the store. Now go make something of your own, and ship it.

<code id="code-content" class="language-tsx">
// src/app/_layout.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { HabitsProvider } from '@/context/HabitsContext';
import { migrateDbIfNeeded } from '@/lib/db';
// Keep the splash screen up until the first screen is ready
SplashScreen.preventAutoHideAsync();
// Server data cache (quotes), from the TanStack Query lesson
const queryClient = new QueryClient();
export default function RootLayout() {
  useEffect(() =&gt; {
    SplashScreen.hideAsync();
  }, []);
  return (
    // Outside in: server cache, then the database, then the habits state
    &lt;QueryClientProvider client={queryClient}&gt;
      &lt;SQLiteProvider databaseName="habithop.db" onInit={migrateDbIfNeeded}&gt;
        &lt;HabitsProvider&gt;
          &lt;StatusBar style="auto" /&gt;
          &lt;Stack&gt;
            {/* Tabs: Today, Stats, Settings */}
            &lt;Stack.Screen name="(tabs)" options={{ headerShown: false }} /&gt;
            {/* Habit details: /habit/h1 */}
            &lt;Stack.Screen name="habit/[id]" options={{ title: 'Habit' }} /&gt;
            {/* The add-habit form slides up as a modal */}
            &lt;Stack.Screen name="new-habit" options={{ presentation: 'modal', title: 'New habit' }} /&gt;
          &lt;/Stack&gt;
        &lt;/HabitsProvider&gt;
      &lt;/SQLiteProvider&gt;
    &lt;/QueryClientProvider&gt;
  );
}
</code></pre>
