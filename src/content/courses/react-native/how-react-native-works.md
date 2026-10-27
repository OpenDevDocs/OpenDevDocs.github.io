---
publishDate: 2026-10-21T09:30
title: How React Native Works Under the Hood
slug: how-react-native-works
metadescription: 'See how React Native turns your components into native views: the JavaScript and UI threads, Hermes, Metro, Fabric, JSI and native modules, in plain words.'
updateDate: 2026-10-21T09:30
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'architecture', 'hermes']
course: react-native
---

## Why peek under the hood?

You can build a lot without knowing how React Native works inside. But a simple picture of the moving parts helps you every single day: it explains why an app can freeze, why some libraries need a "development build", why a red error screen shows up, and why animations are written in a special way.

This lesson gives you that picture in plain words. No native code, promise.

## The big picture

When your app runs on a phone, three main things work together:

```text
 Your code (React + TypeScript)
          |
          v
 +----------------------+        +---------------------------+
 |  JavaScript side     |  JSI   |  Native side              |
 |  Hermes engine runs  | <----> |  real iOS / Android views |
 |  React, your logic   |        |  camera, files, sensors   |
 +----------------------+        +---------------------------+
```

- **The JavaScript side** runs your components, your state and your logic. It runs inside a JavaScript **engine**, a program that reads and runs JavaScript. In React Native that engine is **Hermes**.
- **The native side** is the normal iOS or Android app code. It owns the screen, the touch events, and device features like the camera.
- **JSI** (JavaScript Interface) is the link between them. It lets JavaScript call native code directly, a bit like calling a normal function.

Let's walk through each piece.

## Step 1: Metro bundles your code

You write many files: screens, components, helpers. A phone does not want hundreds of loose files. So a tool called **Metro** (the React Native **bundler**) takes all your files and joins them into one big JavaScript file called the **bundle**.

Metro also translates things the engine does not understand on its own, like TypeScript types and JSX, into plain JavaScript.

During development Metro runs on your computer as part of the **dev server**. When you start your project you will see something like this:

```bash
npx expo start
```

```text
Starting Metro Bundler
› Metro: exp://192.168.1.20:8081
› Using Expo Go
```

Your phone downloads the bundle from your computer over Wi-Fi. When you save a file, Metro rebuilds only what changed and sends it to the phone. That is how you get instant updates, which you will use in [The Dev Server, Fast Refresh and the Dev Menu](/courses/react-native/dev-server-and-fast-refresh).

When you build the final app for the store, the bundle is put **inside** the app, so it works with no computer and no internet.

## Step 2: Hermes runs the JavaScript

**Hermes** is a JavaScript engine made for phones. Phones have less memory and slower processors than laptops, so Hermes is built to start apps fast and use little memory.

A neat trick: for release builds, Hermes turns your JavaScript into **bytecode** (a compact, pre-processed form of the code) ahead of time. The phone skips a lot of work when the app opens, so it starts faster.

You do not need to set anything up. Hermes is on by default. If you are curious, you can check it in code:

```tsx
// Check if Hermes is running your code
const usingHermes = typeof HermesInternal === 'object' && HermesInternal !== null;
console.log('Running on Hermes?', usingHermes);
```

## Step 3: React renders, Fabric draws

Here is what happens when your component returns some JSX:

```tsx
// src/app/index.tsx
import { Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={{ padding: 24 }}>
      <Text>Drink water 💧</Text>
    </View>
  );
}
```

1. **React runs your component** on the JavaScript side and works out what the screen should look like, exactly like on the web.
2. **The renderer** turns that into a tree of native view descriptions. React Native's renderer is called **Fabric**. Think of it as React Native's version of `react-dom`.
3. **Layout is calculated** by a small engine called **Yoga**. Yoga understands Flexbox, which is why you lay out React Native screens with Flexbox (see [Layout with Flexbox](/courses/react-native/flexbox-layout)). It figures out the exact size and position of every box.
4. **Real native views are created or updated.** `View` becomes a native view (`UIView` on iOS, `android.view.View` on Android). `Text` becomes a native text view.

So `View` and `Text` are not "fake" elements. They are thin React wrappers around real platform views. That is why a React Native app looks and feels native.

When state changes, React works out **only what changed** and Fabric updates just those native views. The same idea as the virtual DOM on the web.

## The two threads you should know about

A **thread** is a line of work a processor runs. Phones can run several at once. For everyday React Native, two matter:

- **The UI thread** (also called the main thread): owned by iOS or Android. It draws the screen and handles touches. It must never be blocked, or the app freezes.
- **The JavaScript thread**: where Hermes runs React and your code.

Most of the time they work happily side by side. Trouble starts when the JavaScript thread is too busy. Look at this:

```tsx
// A bad idea: a long loop blocks the JavaScript thread
function slowSum() {
  let total = 0;
  for (let i = 0; i < 500_000_000; i++) {
    total += i;
  }
  return total;
}
```

While this loop runs, React cannot respond to taps or update state. The app seems frozen. The native side is fine, but it is waiting for instructions that never come.

This is also why the animation libraries you will meet later, like Reanimated in [Smooth Animations with Reanimated](/courses/react-native/reanimated-basics), run animations on the UI thread instead. Even if JavaScript is busy, the animation stays smooth.

## Native modules: how JavaScript talks to the phone

JavaScript alone cannot take a photo, read GPS or vibrate the phone. Those features live in the native side. A **native module** is a piece of native code (Swift, Kotlin, C++) that exposes functions JavaScript can call.

You never write native modules in this course. You install them as libraries. For example, `expo-device` is in your project from day one, and it reads information about the phone:

```tsx
// src/app/index.tsx
import * as Device from 'expo-device';
import { Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={{ padding: 24 }}>
      <Text>Model: {Device.modelName ?? 'unknown'}</Text>
      <Text>System: {Device.osName} {Device.osVersion}</Text>
    </View>
  );
}
```

`Device.modelName` looks like a normal JavaScript value, but the data comes from native code on the phone. In the New Architecture these modules are called **Turbo Modules**. They load only when you first use them (so the app starts faster) and are called through JSI.

There is one big rule that comes out of this:

> **Native code is baked into the app when it is built.** JavaScript can change at any time, native code cannot.

So if you install a library that has its own native code, the app on your phone must contain that native code. You will see how this affects your choice between Expo Go and your own app in [Expo Go vs Development Builds](/courses/react-native/expo-go-vs-development-builds).

## The New Architecture in one paragraph

Older versions of React Native sent messages between JavaScript and native through a "bridge": every message was turned into text (JSON), queued, and sent across. It worked, but it was slow for busy screens. The **New Architecture** replaces the bridge with JSI, Fabric and Turbo Modules. Calls are direct, layout can happen on any thread, and React 19 features (like transitions) work properly. In React Native 0.88 it is the only architecture, so every app gets it automatically.

## Where Expo sits in this picture

Expo does not replace any of the parts above. It adds:

- **Expo modules**: ready-made native modules (camera, file system, notifications) with a friendly JavaScript API.
- **Expo CLI**: the `npx expo` commands that start Metro, open simulators and run builds.
- **Expo Router**: file-based navigation built on top of real native navigation (you will start it in [How Expo Router Works](/courses/react-native/expo-router-basics)).
- **EAS**: cloud services that build the native app for you, so you can make an iOS app without a Mac.

## Common mistakes

**Doing heavy work right inside a component.** Sorting thousands of items or running a huge loop on every render blocks the JavaScript thread. The symptom is a laggy or frozen app, while the UI itself shows no error. The fix: do less work per render, move heavy work out of render, and use lists that only draw what is visible (see [Long Lists with FlatList](/courses/react-native/flatlist)).

**Expecting browser or Node.js APIs to exist.** There is no `document`, no `window.localStorage`, and no `fs` module on a phone. Code like `document.getElementById('app')` fails with:

```text
ReferenceError: Property 'document' doesn't exist
```

Use React Native components and Expo libraries instead (for example AsyncStorage instead of `localStorage`, in [Saving Data on the Phone with AsyncStorage](/courses/react-native/async-storage)).

**Installing a native library and only reloading.** If you add a library with native code while the app is running, a reload is not enough when you use your own build. The native part needs a new build. In Expo Go, only libraries included in Expo Go work at all.

## Quick recap

- Your code runs on the **JavaScript side** in the **Hermes** engine; real views live on the **native side**.
- **Metro** bundles all your files into one JavaScript bundle and serves it to your phone during development.
- **Fabric** is the renderer, **Yoga** calculates Flexbox layout, and `View`/`Text` become real native views.
- The **UI thread** draws the screen; the **JavaScript thread** runs React. Blocking the JavaScript thread makes the app feel frozen.
- **Native modules** (Turbo Modules) give JavaScript access to device features through **JSI**. Native code is fixed at build time.
- The **New Architecture** (JSI, Fabric, Turbo Modules) is the only architecture in React Native 0.88.

<code id="code-content" class="language-tsx">
// src/app/index.tsx
// A small "about this phone" screen that touches each layer:
// React (JS thread), a native module (expo-device) and native views.
import * as Device from 'expo-device';
import { Platform, StyleSheet, Text, View } from 'react-native';
// ---
// Is Hermes running our JavaScript?
const usingHermes = typeof HermesInternal === 'object' &amp;&amp; HermesInternal !== null;
// ---
export default function Index() {
  return (
    &lt;View style={styles.container}&gt;
      &lt;Text style={styles.title}&gt;About this phone&lt;/Text&gt;
      {/* Platform comes from React Native core */}
      &lt;Text style={styles.row}&gt;Platform: {Platform.OS}&lt;/Text&gt;
      {/* These values come from native code via a Turbo Module */}
      &lt;Text style={styles.row}&gt;Model: {Device.modelName ?? 'unknown'}&lt;/Text&gt;
      &lt;Text style={styles.row}&gt;
        System: {Device.osName} {Device.osVersion}
      &lt;/Text&gt;
      &lt;Text style={styles.row}&gt;Real device: {Device.isDevice ? 'yes' : 'no (simulator)'}&lt;/Text&gt;
      &lt;Text style={styles.row}&gt;Hermes: {usingHermes ? 'yes' : 'no'}&lt;/Text&gt;
    &lt;/View&gt;
  );
}
// ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  row: {
    fontSize: 16,
  },
});
</code></pre>
