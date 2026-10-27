---
publishDate: 2026-10-24T21:30
title: Debugging React Native Apps
slug: debugging
metadescription: 'Find and fix bugs in React Native: console logs, LogBox, React Native DevTools with breakpoints and the Network panel, error boundaries and common errors.'
updateDate: 2026-10-24T21:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'debugging', 'devtools', 'expo']
course: react-native
---

## Bugs will happen

Every app has bugs. The difference between a frustrating afternoon and a five-minute fix is knowing your tools. In this lesson you will learn the debugging toolbox for an Expo app:

- `console.log` and where its output goes
- **LogBox**, the red and yellow messages on your phone
- **React Native DevTools**: breakpoints, the Console, the Network panel and the React component tree
- **error boundaries**, so one broken screen does not crash the whole app
- how to read the most common error messages

You will practice on HabitHop's habit details screen, `src/app/habit/[id].tsx`, from [Dynamic Routes and Route Params](/courses/react-native/dynamic-routes).

## console.log: still the first tool

The quickest way to see what your code is doing is to print it:

```tsx
console.log('[HabitDetails] render', { id, found: !!habit, streak });
```

Where does this text show up? In the **terminal** where `npx expo start` is running. Expo CLI forwards logs from the phone to your computer and labels each line with the platform:

```text
iOS  LOG  [HabitDetails] render {"found": true, "id": "h1", "streak": 4}
Android  WARN  No habit with id "h9"
```

A few tips that save time:

- Add a **tag** like `[HabitDetails]` at the start, so you can find your logs among many others.
- Log objects as a second argument (`console.log('habit', habit)`) instead of gluing them into a string, so you see their fields.
- `console.warn` and `console.error` print in yellow and red, and also show up on the phone (see LogBox below).
- Remove noisy logs when you are done. Logging inside a component runs on **every render**, and lots of logging slows the app down.

## LogBox: errors and warnings on the phone

**LogBox** is the overlay React Native shows inside your app while you develop. It has two levels:

- **Warnings** (`console.warn`, and many library warnings) appear as a small yellow bar at the bottom of the screen. Tap it to read the full message and the **stack trace** (the list of function calls that led there).
- **Errors** (`console.error`) appear as a red bar. **Uncaught errors**, for example an exception thrown while rendering, take over the whole screen with a red error page that shows the message, the file and the exact line of your code.

The full red screen looks scary, but it is your friend: it usually points right at the broken line. Fix the code, save, and Fast Refresh reloads the screen. If it does not recover, press `r` in the terminal to reload the app.

Sometimes a library shows a warning you cannot fix yourself. You can hide specific messages:

```tsx
// src/app/_layout.tsx (top of the file)
import { LogBox } from 'react-native';

LogBox.ignoreLogs(['Some noisy warning from a library']);
```

A message is hidden if it contains one of these strings (you can also pass regular expressions). Use this sparingly. `LogBox.ignoreAllLogs()` hides everything, which also hides the warnings that would have saved you hours. LogBox only exists in development: users of your release app never see it.

## React Native DevTools

`console.log` gets you far, but sometimes you need to **pause** the app and look around. That is what a debugger is for. React Native's official debugger is **React Native DevTools**. It looks like the Chrome DevTools you may know from web development, and it is built in. Nothing to install.

### Opening it

With the app running, press `j` in the terminal where `npx expo start` is running:

```text
› Press j │ open debugger
```

DevTools opens in its own desktop window. If that window cannot start (for example on an unsupported setup), it opens in Chrome or Edge instead. You can also open it from the **dev menu**: press `m` in the terminal, or shake the phone, and choose the debugger option. You met the dev menu in [The Dev Server, Fast Refresh and the Dev Menu](/courses/react-native/dev-server-and-fast-refresh).

DevTools needs the **Hermes** JavaScript engine, which every Expo project uses by default. If you see this message in the terminal:

```text
Debug: No compatible apps connected, React Native DevTools can only be used with Hermes.
```

it usually just means the app is not open on any device yet. Open it on your phone or simulator first, then press `j` again.

### Console panel

Every `console.log` also appears here, with objects you can expand and click through. You can type JavaScript at the bottom to run it inside the app, which is handy for checking a value. Messages are grouped and searchable, which beats scrolling a terminal.

### Sources panel and breakpoints

A **breakpoint** pauses your app on a chosen line, so you can inspect every variable at that moment.

1. Open the **Sources** panel and press `Ctrl+P` (`Cmd+P` on a Mac) to find a file, like `[id].tsx`.
2. Click a line number to set a breakpoint. A blue marker appears.
3. Use the app until that line runs. The app freezes and DevTools shows the paused line.
4. Hover over variables to see their values, or look in the **Scope** section on the right.
5. Use the buttons to **step over** (run the next line), **step into** a function, or **resume**.

You can also pause from code with the `debugger` statement:

```tsx
export async function loadQuote() {
  const res = await fetch('https://dummyjson.com/quotes/random');
  const data: { id: number; quote: string; author: string } = await res.json();
  debugger; // pauses here when DevTools is open
  return data;
}
```

`debugger` does nothing when DevTools is closed, but do not leave it in your code.

### Network panel

The **Network** panel lists the requests your app makes with `fetch`: the URL, status code, timing, headers and the response body. For HabitHop's quote card (from [Fetching Data from an API](/courses/react-native/fetching-data), using the free DummyJSON test API) you can click the `quotes/random` request and see the exact JSON that came back. When a screen shows "Something went wrong", check here first: is the status `200`, or a `404` or `500`? Is the body what your code expects?

### React Components and Profiler

DevTools also includes the **React** tabs. **Components** shows your component tree, like `HabitsProvider` › `TodayScreen` › `HabitCard`. Click one to see its props, state and hooks. This is the fastest way to answer "what props did this card actually get?". **Profiler** records which components re-render and how long they take, which you will use in [Making Your App Fast](/courses/react-native/performance).

## More tools in the dev menu

The dev menu (press `m`) has a few more helpers:

- **Element Inspector**: tap any element on screen to see its component, styles and size. Great for "why is there extra space here?" layout bugs.
- **Performance monitor**: shows frame rates for the UI and JavaScript threads.
- **Reload**: restarts the JavaScript, the same as pressing `r`.

If something is very strange (old code still running, an import that should exist "cannot be found"), restart the dev server with an empty cache:

```bash
npx expo start --clear
```

## Error boundaries: when a screen crashes

In development, a render error shows the red LogBox screen. In a **release build** there is no LogBox. An uncaught error while rendering can close the app entirely. That is a terrible experience.

An **error boundary** is a component that catches errors thrown while rendering the components inside it, and shows a fallback screen instead. In plain React you write one as a class component. Expo Router makes it easier: **export a function named `ErrorBoundary` from any route file**, and Expo Router uses it to wrap that route.

```tsx
// src/app/habit/[id].tsx (bottom of the file)
import type { ErrorBoundaryProps } from 'expo-router';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text>Something went wrong 😕</Text>
      <Text>{error.message}</Text>
      <Pressable onPress={retry}>
        <Text>Try again</Text>
      </Pressable>
    </View>
  );
}
```

It receives two props:

- `error`: the error that was thrown.
- `retry`: a function that renders the route again. Useful when the problem was temporary.

The boundary only covers its own route (and routes nested inside a layout, if you put it in a `_layout.tsx`). The rest of the app, like the tab bar, keeps working. If you just want a ready-made fallback screen, you can re-export Expo Router's own: `export { ErrorBoundary } from 'expo-router';`.

Error boundaries catch errors **during rendering**. They do not catch errors in event handlers (`onPress`) or in async code like `fetch`. Handle those with `try`/`catch`, as you did in [Loading States, Errors and Pull to Refresh](/courses/react-native/loading-and-refreshing).

## Putting it together in HabitHop

The code panel shows `src/app/habit/[id].tsx` with debugging in mind:

- A tagged `console.log` on each render, so you can see in the terminal which ID was opened and whether the habit was found.
- A `console.warn` when the habit does not exist (for example after it was deleted on another screen). It shows a yellow LogBox note during development, while the user sees a calm "This habit no longer exists" message.
- An `ErrorBoundary` export. To try it, add `throw new Error('Test crash');` at the top of `HabitDetailsScreen`, save, and open a habit. In development you first see the red LogBox screen. Dismiss it and you see your fallback with "Something went wrong 😕", the message and a "Try again" button. Remove the `throw` and tap "Try again": the screen renders normally.

The screen uses the `useHabit(id)` hook from the navigation section, which returns `habit`, `streak`, `doneToday` and `toggle`.

## Reading common error messages

Most bugs show one of a handful of messages. Learn to recognize them:

```text
TypeError: Cannot read property 'name' of undefined
```

You used `something.name`, but `something` was `undefined`. Often data that has not loaded yet, or an ID that does not match. Check with `if (!habit) return ...` or use `habit?.name`.

```text
ReferenceError: Property 'habbit' doesn't exist
```

This is how Hermes says "this variable does not exist". Usually a typo or a missing import. TypeScript usually catches this before you run the app.

```text
TypeError: undefined is not a function
```

You called something that is not a function, often a wrong import (default versus named) or a misspelled method name.

```text
Error: Text strings must be rendered within a <Text> component.
```

You put text directly inside a `View`. A common hidden cause: `{count && <Text>...</Text>}` when `count` is `0` renders the number `0` outside a `Text`. Use `{count > 0 && ...}`.

```text
Error: Cannot find native module 'ExpoSomething'
```

The JavaScript package is installed, but the native code is not in the app you are running. In Expo Go this means the library is not included in Expo Go, so you need a development build (see [Expo Go vs Development Builds](/courses/react-native/expo-go-vs-development-builds)). In a development build, rebuild it after installing a library with native code.

## Common mistakes

**Only reading the first line of the error.** The stack trace in LogBox (and the code frame below it) tells you which file and line failed. Look for the first line that points at **your** code, not at `node_modules`.

**Debugging the wrong version of the code.** If your changes seem to have no effect, the app may not have reloaded. Press `r`, and if that fails, restart with `npx expo start --clear`.

**Leaving `LogBox.ignoreAllLogs()` in place.** It hides every warning, including the important ones. Ignore specific messages only.

**Shipping without an error boundary.** In development, crashes look harmless because LogBox catches them. In production, add `ErrorBoundary` exports to your important routes or the root layout.

## Quick recap

- `console.log` output appears in the `npx expo start` terminal, labeled `iOS` or `Android`, and in the DevTools Console.
- LogBox shows warnings in yellow and errors in red on the phone, with stack traces. It only exists in development.
- Press `j` to open React Native DevTools: Console, Sources with breakpoints and `debugger`, Network for `fetch` requests, and the React Components and Profiler tabs.
- The dev menu (`m` or shake) has the Element Inspector and performance monitor. `npx expo start --clear` fixes stale caches.
- Export an `ErrorBoundary` function from a route file to catch render errors and show a fallback with `retry`.
- Learn the common messages: `Cannot read property ... of undefined`, `Property ... doesn't exist`, `Text strings must be rendered within a <Text> component`, `Cannot find native module`.

<code id="code-content" class="language-tsx">
// src/app/habit/[id].tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router';
import { useHabit } from '@/hooks/useHabit';
export default function HabitDetailsScreen() {
  const { id } = useLocalSearchParams&lt;{ id: string }&gt;();
  const { habit, streak, doneToday, toggle } = useHabit(id);
  // Shows in the terminal and in the DevTools Console
  console.log('[HabitDetails] render', { id, found: !!habit, streak });
  if (!habit) {
    // A warning appears in LogBox as a yellow note while developing
    console.warn(`No habit with id "${id}"`);
    return &lt;Text style={styles.missing}&gt;This habit no longer exists.&lt;/Text&gt;;
  }
  return (
    &lt;View style={styles.screen}&gt;
      &lt;Stack.Screen options={{ title: habit.name }} /&gt;
      &lt;Text style={styles.emoji}&gt;{habit.emoji}&lt;/Text&gt;
      &lt;Text style={styles.streak}&gt;🔥 {streak} day streak&lt;/Text&gt;
      &lt;Pressable style={[styles.button, { backgroundColor: habit.color }]} onPress={toggle}&gt;
        &lt;Text style={styles.buttonText}&gt;{doneToday ? 'Undo today' : 'Mark done today'}&lt;/Text&gt;
      &lt;/Pressable&gt;
    &lt;/View&gt;
  );
}
// Expo Router shows this instead of the screen if rendering it throws
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  console.error('[HabitDetails] crashed:', error.message);
  return (
    &lt;View style={styles.screen}&gt;
      &lt;Text style={styles.title}&gt;Something went wrong 😕&lt;/Text&gt;
      &lt;Text style={styles.message}&gt;{error.message}&lt;/Text&gt;
      &lt;Pressable style={[styles.button, { backgroundColor: '#7C5CFC' }]} onPress={retry}&gt;
        &lt;Text style={styles.buttonText}&gt;Try again&lt;/Text&gt;
      &lt;/Pressable&gt;
    &lt;/View&gt;
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  missing: { padding: 24, color: '#6B7280' },
  emoji: { fontSize: 64 },
  streak: { fontSize: 18 },
  title: { fontSize: 20, fontWeight: '700' },
  message: { color: '#6B7280', textAlign: 'center' },
  button: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
</code></pre>
