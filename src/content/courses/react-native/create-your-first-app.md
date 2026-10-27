---
publishDate: 2026-10-21T12:30
title: Creating Your First App with Expo
slug: create-your-first-app
metadescription: 'Create the HabitHop project with create-expo-app, open it on your phone with Expo Go, edit your first screen and clear the example code with reset-project.'
updateDate: 2026-10-21T12:30
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'expo', 'getting-started']
course: react-native
---

## Time to build something

Your computer is ready (if not, go back to [Setting Up Your Computer for React Native](/courses/react-native/setting-up-your-computer)). Now you will create the **HabitHop** project, see it running on your phone, change a line of text and watch the phone update. Then you will clear out the example code so you start from a clean, simple screen.

## Step 1: Create the project

Open a terminal in the folder where you keep your projects and run:

```bash
npx create-expo-app@latest habit-hop
```

Let's read that command piece by piece:

- `npx` runs a package without installing it globally.
- `create-expo-app` is Expo's project creator.
- `@latest` asks for the newest version, so you get the newest SDK (58 at the time of writing).
- `habit-hop` is the name of the new folder.

The creator downloads the **default template** (a ready-made starter project), installs all the libraries with npm, and sets up a Git repository. This takes a minute or two. When it finishes it tells you how to start the project, roughly like this:

```text
✅ Your project is ready!

To run your project, navigate to the directory and run one of the following npm commands.

- cd habit-hop
- npm run android
- npm run ios
- npm run web
```

The default template uses **TypeScript**, so files end in `.tsx` and `.ts`. You will learn the TypeScript you need in [Just Enough TypeScript for React Native](/courses/react-native/typescript-basics).

## Step 2: Start the dev server

Move into the new folder and start the project:

```bash
cd habit-hop
npx expo start
```

`npx expo start` starts the **dev server**: a program on your computer that bundles your code (with Metro) and sends it to your phone. You can also run `npm start`, which does the same thing, because the template's `package.json` has `"start": "expo start"`.

You will see a big QR code in the terminal and a list of keys:

```text
Starting project at /Users/riya/code/habit-hop
Starting Metro Bundler

▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █ (QR code here)  ▄▄▄▄▄ █
▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀

› Scan the QR code above to open in Expo Go.
› Metro: exp://192.168.1.20:8081
› Web: http://localhost:8081

› Using Expo Go
› Press s │ switch to development build

› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web

› Press j │ open debugger
› Press r │ reload app
› Press m │ toggle menu
› shift+m │ more tools
› Press o │ open project code in your editor

Logs for your project will appear below. Press Ctrl+C to exit.
```

The `i` line only appears on a Mac. Leave this terminal open: the dev server must keep running while you work.

## Step 3: Open the app on your phone

Make sure your phone has **Expo Go** installed and is on the same Wi-Fi as your computer. Then:

- **Android**: open Expo Go and tap **Scan QR code**, then scan the code in the terminal.
- **iPhone**: open the normal **Camera** app, point it at the QR code, and tap the banner that appears. It opens in Expo Go.

The first load takes a few seconds while Metro builds the bundle. You will see a progress bar in the terminal:

```text
iOS Bundled 2876ms node_modules/expo-router/entry.js (1012 modules)
```

Then the template app appears. It has a **Home** screen with a "Welcome to Expo" title and an animated logo, and an **Explore** tab. The tab bar at the bottom is a real native tab bar from iOS or Android, made with Expo Router's `NativeTabs`.

No phone? Press `a` for the Android emulator, `i` for the iOS simulator (Mac only) or `w` to open it in your web browser.

## Step 4: Change something

Open the `habit-hop` folder in VS Code. Find the file `src/app/index.tsx`. This file is the Home screen. Near the middle you will find this:

```tsx
<ThemedText type="title" style={styles.title}>
  Welcome to&nbsp;Expo
</ThemedText>
```

Change the text and save:

```tsx
<ThemedText type="title" style={styles.title}>
  Welcome to HabitHop
</ThemedText>
```

Look at your phone. Within a second the title changes, without restarting anything. That is **Fast Refresh**, and you will learn its tricks in [The Dev Server, Fast Refresh and the Dev Menu](/courses/react-native/dev-server-and-fast-refresh).

Take a few minutes to poke around the template. It shows off themes, images, animations and links. You will look at every file in [Understanding the Project Files](/courses/react-native/project-structure).

## Step 5: Clear the example with reset-project

The template is a nice demo, but HabitHop does not need its welcome screen, animated logo or Explore tab. The template comes with a script to clear them out. Stop the dev server first (press `Ctrl+C` in its terminal), then run:

```bash
npm run reset-project
```

The script asks one question:

```text
Do you want to move existing files to /example instead of deleting them? (Y/n):
```

- Type **y** (or just press Enter, since `Y` is the default) to **move** the example code into a new `example` folder. It stays there for you to read later.
- Type **n** to **delete** the example code for good.

Pressing **y** is the friendly choice while you are learning. Here is what it prints:

```text
📁 /example directory created.
➡️ /src moved to /example/src.
➡️ /scripts moved to /example/scripts.
➡️ /assets/images/expo-badge.png moved to /example/assets/images/expo-badge.png.
...

📁 New /src/app directory created.
📄 src/app/index.tsx created.
📄 src/app/_layout.tsx created.

✅ Project reset complete. Next steps:
1. Run `npx expo start` to start a development server.
2. Edit src/app/index.tsx to edit the main screen.
3. Put all your application code in /src, only screens and layout files should be in /src/app.
4. Delete the /example directory when you're done referencing it.
```

So what happened?

- The whole old `src` folder (screens, components, hooks, theme) went to `example/src`.
- The `scripts` folder (the reset script itself) went to `example/scripts`.
- The demo images (logos, tab icons) went to `example/assets/images`. The app icon and splash image stay in `assets/images`, because `app.json` uses them.
- Two fresh files were created in `src/app`.

The `example` folder is already listed in `.gitignore`, so Git ignores it. When you no longer need it, delete it. (If VS Code shows red errors inside `example`, that is because its imports point to files that moved. Deleting the folder fixes that.)

After the reset, `package.json` still has a `reset-project` line, but the script file is gone. You can remove that line.

## The two fresh files

The new root layout is tiny:

```tsx
// src/app/_layout.tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack />;
}
```

A **layout** wraps the screens in a folder. `<Stack />` is a **stack navigator**: screens stack on top of each other, with a header bar at the top and a back button. You will learn all about it in [Stack Navigation and Headers](/courses/react-native/stack-navigation).

And the new home screen:

```tsx
// src/app/index.tsx
import { Text, View, StyleSheet } from "react-native";

export default function Index() {
  return (
    <View style={styles.container}>
      <Text>Edit src/app/index.tsx to edit this screen.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
```

`index.tsx` inside `src/app` is the first screen your app shows. The file name becomes the route, so `index` means "the home route", like `index.html` on a website.

## Step 6: Make it HabitHop

Start the dev server again with `npx expo start`, open the app, and replace `src/app/index.tsx` with a first HabitHop welcome screen:

```tsx
// src/app/index.tsx
import { StyleSheet, Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🐸</Text>
      <Text style={styles.title}>HabitHop</Text>
      <Text style={styles.subtitle}>Small habits, one hop at a time.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F3FF',
  },
  logo: { fontSize: 64 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#7C5CFC' },
  subtitle: { fontSize: 16, color: '#555555', marginTop: 8 },
});
```

Save, and the phone shows a purple "HabitHop" title with a frog under a header bar that says "index". That header comes from the `<Stack />`. You will give it a proper title when you learn navigation.

## Common mistakes

**Running `npx expo start` in the wrong folder.** If you forget `cd habit-hop`, Expo cannot find a project:

```text
ConfigError: The expected package.json path: /Users/riya/code/package.json does not exist
```

Move into the project folder and try again.

**Scanning the QR code with the wrong app on Android.** The normal Android camera may open the link in a browser instead of Expo Go. Use the **Scan QR code** button inside Expo Go.

**Running reset-project while the dev server is running.** Metro may get confused when the files it is watching disappear, showing errors about missing modules like `Unable to resolve "@/components/app-tabs"`. Stop the server first, run the reset, then start it again. If an error sticks around, restart with a clean cache: `npx expo start --clear`.

**Forgetting to save the file.** Fast Refresh only reacts to saved files. In VS Code, turn on **File**, **Auto Save** if you keep forgetting.

## Quick recap

- `npx create-expo-app@latest habit-hop` creates a TypeScript Expo project from the default template, installs libraries and sets up Git.
- `npx expo start` (or `npm start`) runs the dev server. Scan the QR code with Expo Go, or press `a`, `i` or `w`.
- Editing and saving a file updates the phone in about a second.
- `npm run reset-project` moves (**y**) or deletes (**n**) the example code and leaves a fresh `src/app/index.tsx` and a `src/app/_layout.tsx` with a plain `<Stack />`.
- Next, learn what every file is for in [Understanding the Project Files](/courses/react-native/project-structure).

<code id="code-content" class="language-tsx">
// src/app/index.tsx
// The first HabitHop screen, right after npm run reset-project.
import { StyleSheet, Text, View } from 'react-native';
// ---
export default function Index() {
  return (
    &lt;View style={styles.container}&gt;
      &lt;Text style={styles.logo}&gt;🐸&lt;/Text&gt;
      &lt;Text style={styles.title}&gt;HabitHop&lt;/Text&gt;
      &lt;Text style={styles.subtitle}&gt;Small habits, one hop at a time.&lt;/Text&gt;
      &lt;View style={styles.badge}&gt;
        &lt;Text style={styles.badgeText}&gt;Made with Expo SDK 58&lt;/Text&gt;
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
    backgroundColor: '#F5F3FF',
  },
  logo: { fontSize: 64 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#7C5CFC' },
  subtitle: { fontSize: 16, color: '#555555', marginTop: 8 },
  badge: {
    marginTop: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#7C5CFC',
  },
  badgeText: { color: '#FFFFFF', fontWeight: '600' },
});
</code></pre>
