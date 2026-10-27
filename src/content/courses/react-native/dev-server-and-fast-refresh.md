---
publishDate: 2026-10-21T15:30
title: The Dev Server, Fast Refresh and the Dev Menu
slug: dev-server-and-fast-refresh
metadescription: 'Get comfortable with npx expo start: terminal shortcuts, Fast Refresh that keeps your state, console logs, the red error screen and the in-app dev menu.'
updateDate: 2026-10-21T15:30
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'expo', 'tooling']
course: react-native
---

## Your daily loop

Building an app is a loop: change some code, look at the phone, change some more. The faster that loop is, the more fun (and productive) your day is. Expo gives you three tools for it:

- The **dev server**: the terminal program you start with `npx expo start`.
- **Fast Refresh**: updates the phone a moment after you save, often without losing what is on screen.
- The **dev menu**: a hidden menu inside the app with reload, debugging and inspection tools.

This lesson shows how to use each one well. You need the HabitHop project from [Creating Your First App with Expo](/courses/react-native/create-your-first-app).

## What the dev server does

Start it from your project folder:

```bash
npx expo start
```

While it runs, the dev server:

1. Runs **Metro**, which bundles your code into one JavaScript file (see [How React Native Works Under the Hood](/courses/react-native/how-react-native-works)).
2. Serves that bundle to every phone, emulator or browser that connects.
3. Watches your files and pushes changes when you save.
4. Prints your `console.log` messages and errors in the terminal.

It keeps running until you press `Ctrl+C`. If you close the terminal, the app on your phone loses its connection and shows an error the next time it tries to reload.

## The terminal shortcuts

While the dev server is running, the terminal listens for single key presses. These are the ones you will use most:

```text
› Press a │ open Android
› Press i │ open iOS simulator   (Mac only)
› Press w │ open web
› Press r │ reload app
› Press m │ toggle menu
› Press j │ open debugger
› shift+m │ more tools
› Press o │ open project code in your editor
› Press ? │ show all commands
```

- `r` reloads the app on every connected device. Use it when something looks stuck.
- `m` opens the dev menu on the phone, handy when shaking the phone is awkward.
- `j` opens **React Native DevTools**, the debugger. You will use it in [Debugging React Native Apps](/courses/react-native/debugging).
- `shift+m` shows extra tools, like the element inspector and the performance monitor.
- `?` lists every shortcut, including `c` to show the QR code again.

## Useful start options

`npx expo start` takes a few options (also called **flags**) that solve common problems:

To clear Metro's cache (this fixes many "weird" errors):

```bash
npx expo start --clear
```

To connect through the internet when your Wi-Fi blocks the phone:

```bash
npx expo start --tunnel
```

To open straight in the Android emulator, the iOS simulator or the web:

```bash
npx expo start --android
npx expo start --ios
npx expo start --web
```

`--clear` (short form `-c`) throws away Metro's saved work and bundles from scratch. Use it after changing `babel.config.js` (if your project has one), after installing a library, or when an error makes no sense.

## Fast Refresh

**Fast Refresh** is the feature that updates your app when you save a file. It is on by default. The clever part is that it tries to **keep your component state**. Let's see that in action. Replace `src/app/index.tsx` with a small counter:

```tsx
// src/app/index.tsx
import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

export default function Index() {
  const [count, setCount] = useState(0);

  return (
    <View style={styles.container}>
      <Text style={styles.count}>Glasses of water: {count}</Text>
      <Button title="Add one 💧" onPress={() => setCount(count + 1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  count: { fontSize: 24 },
});
```

Tap the button a few times so the count is, say, 4. Now change the label text from `Glasses of water` to `Water today` and save.

The text changes on the phone, and the count is **still 4**. Fast Refresh swapped in your new component code but kept the state that `useState` was holding. When you are styling a screen deep inside your app, this saves you from tapping your way back to it after every change.

### When Fast Refresh resets state

Fast Refresh keeps state only when it is safe. It does a full **remount** (state goes back to the start) when:

- You edit a file that exports things which are **not** React components. For example, editing `src/constants/colors.ts` re-runs the files that import it, and their state resets.
- You change the hooks in a component in a way React cannot match up, like adding a new `useState` above an old one.
- The component is a **class component** (rare in modern code).

You can also force a reset for one file by adding this comment anywhere in it:

```tsx
// @refresh reset
```

Use it when a screen holds state that must start fresh after every edit.

### When to reload by hand

Fast Refresh cannot pick up everything. Press `r` (or choose **Reload** in the dev menu) when:

- You changed code that runs only once when the app starts, like code at the very top of `src/app/_layout.tsx`.
- The app got into a strange state and you want a clean start.

And **restart the dev server** (`Ctrl+C`, then `npx expo start`) when you change `app.json`, `babel.config.js`, `tsconfig.json` or environment variables in `.env`, since those are read when the server starts.

## Seeing your logs

`console.log` works just like on the web, but the messages appear in the **terminal** where the dev server runs, not on the phone:

```tsx
// src/app/index.tsx
export default function Index() {
  console.log('Index rendered at', new Date().toLocaleTimeString());
  // ...
  return null;
}
```

```text
 LOG  Index rendered at 9:41:07 AM
```

`console.warn` and `console.error` also show up there, marked as `WARN` and `ERROR`. The logs come from whichever device is connected, so with two phones open you see both.

## The red error screen

When your code throws an error, React Native shows a full-screen red **error overlay** (React Native calls this system **LogBox**). Try it: add a typo, like calling a function that does not exist:

```tsx
// src/app/index.tsx
export default function Index() {
  const total = countHabits(); // there is no countHabits function
  return null;
}
```

The phone shows something like:

```text
Render Error
Property 'countHabits' doesn't exist

src/app/index.tsx (3:17)
```

The overlay shows the message, the file and line, and the **call stack** (the chain of functions that led to the error). Fix the code and save: Fast Refresh notices and the red screen goes away by itself. You rarely need to reload.

A **syntax error** (like a missing bracket) shows a similar screen with the exact spot Metro could not understand. TypeScript type errors do **not** stop the app: VS Code shows them as red underlines, and you should fix them, but Metro still runs the code.

Smaller problems, like `console.warn` calls, show up as a small notification bar at the bottom of the screen instead. Tap it to see the details.

## The dev menu

The **dev menu** is a hidden menu inside your app, only in development. Open it with any of these:

```text
Real phone:          shake the phone
Android emulator:    Ctrl+M (Windows/Linux) or Cmd+M (Mac)
iOS simulator:       Cmd+D (or Ctrl+Cmd+Z, the "shake" gesture)
Any device:          press m in the dev server terminal
```

In Expo Go you will find options like these:

- **Reload**: same as pressing `r`.
- **Go home**: back to Expo Go's home screen, to pick another project.
- **Open DevTools** (or **Open JS Debugger**): opens the debugger on your computer.
- **Toggle element inspector**: tap anything on screen to see its component, size and styles.
- **Toggle performance monitor**: a small overlay showing frames per second for the UI and JavaScript threads.
- **Fast Refresh**: switch it off and on.

The **performance monitor** is a great teacher. Leave it on while you scroll, and you will see the JavaScript frame rate drop when a screen does too much work. You will dig into that in [Making Your App Fast](/courses/react-native/performance).

## A quick workflow that works

Here is a setup many developers use every day:

1. Editor on one side of the screen, terminal below it.
2. A phone or emulator next to the keyboard.
3. Save often. Look at the phone. Check the terminal for logs.
4. When something is weird: `r` to reload. Still weird: `Ctrl+C` and `npx expo start --clear`.

## Common mistakes

**Looking for logs in the wrong place.** `console.log` does not appear on the phone screen. Check the dev server terminal (or the console in React Native DevTools).

**Expecting a change in `app.json` to appear after saving.** It will not, because the config is read when the server starts. Restart the dev server. Some changes (like a new app icon, or a new native library) also need a new build of the app, which you will learn about in [Expo Go vs Development Builds](/courses/react-native/expo-go-vs-development-builds).

**A stale cache after installing or moving files.** Errors like this one, for a file that clearly exists, usually come from Metro's cache:

```text
Unable to resolve module ./src/components/HabitCard from /Users/sam/code/habit-hop/src/app/index.tsx
```

Check the spelling and path first (paths are case-sensitive on some systems). If it is correct, run `npx expo start --clear`.

**Leaving the red screen open and reloading over and over.** Reloading does not fix code. Read the first line of the error, jump to the file and line it shows, fix it and save.

## Quick recap

- `npx expo start` runs the dev server: Metro, the bundle server, the file watcher and your logs.
- Terminal keys: `r` reload, `m` dev menu, `j` debugger, `a`/`i`/`w` open a platform, `?` show all commands.
- `--clear` fixes cache problems; `--tunnel` helps when your Wi-Fi blocks the phone.
- **Fast Refresh** updates the app on save and keeps component state when it can. `// @refresh reset` forces a fresh start for a file.
- `console.log` output appears in the terminal. Errors show a red overlay that clears itself when you fix the code.
- Open the **dev menu** by shaking the phone, `Ctrl+M`/`Cmd+M` on Android, `Cmd+D` on iOS, or `m` in the terminal.

<code id="code-content" class="language-tsx">
// src/app/index.tsx
// A tiny counter to test Fast Refresh: tap a few times, edit the label,
// save, and the count stays the same.
import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
// ---
export default function Index() {
  const [count, setCount] = useState(0);
  // Shows up in the dev server terminal, not on the phone
  console.log('Index rendered, count =', count);
  // ---
  function addGlass() {
    setCount(count + 1);
    if (count + 1 === 8) {
      console.warn('8 glasses! Nice work, Riya.');
    }
  }
  // ---
  return (
    &lt;View style={styles.container}&gt;
      &lt;Text style={styles.title}&gt;Glasses of water&lt;/Text&gt;
      &lt;Text style={styles.count}&gt;{count}&lt;/Text&gt;
      &lt;Button title="Add one 💧" onPress={addGlass} /&gt;
      &lt;Button title="Reset" onPress={() =&gt; setCount(0)} /&gt;
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
    fontSize: 20,
    color: '#555555',
  },
  count: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#0EA5E9',
  },
});
</code></pre>
