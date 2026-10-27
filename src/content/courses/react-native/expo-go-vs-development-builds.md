---
publishDate: 2026-10-21T17:00
title: Expo Go vs Development Builds
slug: expo-go-vs-development-builds
metadescription: 'Understand what Expo Go can and cannot do, what a development build is, when you need one, and how to make one with EAS Build or on your own computer.'
updateDate: 2026-10-21T17:00
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'expo', 'development-build']
course: react-native
---

## Two ways to run your code

So far you have opened HabitHop in **Expo Go**, the free app from the store. That is perfect for learning. But at some point almost every real app moves to a **development build**: your own version of the app, with your own name, icon and native libraries, plus the same developer tools you are used to.

This lesson explains the difference in plain terms, so you know which one to use and why. The key idea comes from [How React Native Works Under the Hood](/courses/react-native/how-react-native-works):

> JavaScript can change at any time. Native code is fixed when the app is built.

## What Expo Go really is

**Expo Go** is a normal app that the Expo team builds and publishes to the App Store and Google Play. Inside it is a big, fixed set of native code: React Native itself plus the native parts of the Expo SDK libraries (camera, location, file system, notifications, images and many more).

When you scan your QR code, Expo Go downloads **only your JavaScript bundle** and runs it on top of that native code. That is why it is so quick: there is nothing to build. It is like a game console with many games already installed, and your code is the save file.

That design gives Expo Go some limits:

- **Only the native code already inside Expo Go is available.** If you install a library that has its own native code which Expo Go does not include, it fails.
- **Your app config is mostly ignored.** The name and icon on the home screen are Expo Go's, not yours. Native settings in `app.json` (like permission messages or a custom URL scheme) do not apply the way they will in your real app.
- **One SDK at a time.** Each Expo Go version supports one SDK version, so a project on an older SDK may not open.
- **Some features are missing.** For example, remote **push notifications** on Android were removed from Expo Go in SDK 53. Local notifications still work.

## What a development build is

A **development build** is **your own app**, built from your project, with one extra library included: `expo-dev-client`. That library adds the developer tools you know from Expo Go:

- It connects to your dev server and loads your JavaScript bundle.
- It has Fast Refresh, the dev menu and the debugger.
- It has a small launcher screen where you pick which dev server to connect to.

But because it is built from **your** project, it has:

- **Your** app name, icon and splash screen.
- **Your** native settings from `app.json`.
- **Any** native library you install, even ones Expo Go has never heard of.

You can think of it as "Expo Go, made just for your app".

## Side by side

```text
                          Expo Go              Development build
How you get it            from the store       you build it (once)
Time to start             seconds              10 to 30 minutes for the first build
Your app name and icon    no                   yes
Any native library        no (built-in only)   yes
app.json native settings  mostly ignored       applied
Fast Refresh, dev menu    yes                  yes
Good for                  learning, quick      real apps, before
                          experiments          release
```

Both load your JavaScript from the dev server in the same way, so your day-to-day loop (save, see the change) is the same.

## How do I know I need one?

You need a development build when:

- A library's install guide says it **does not work in Expo Go**, or the app crashes with an error about a native module that cannot be found, like:

```text
Error: Cannot find native module 'SomeNativeLibrary'
```

- You need a feature Expo Go does not support, such as remote push notifications on Android.
- You want to test your real icon, splash screen, app name or deep links.
- You are getting close to publishing and want to test exactly what users will get.

In this course, Expo Go is enough for almost every lesson. When a lesson needs a development build, it says so clearly.

## Making a development build

There are two ways: in the cloud with **EAS Build**, or on your own computer.

### Step 1 (both ways): add expo-dev-client

```bash
npx expo install expo-dev-client
```

This adds the developer tools to your app. When it is installed, `npx expo start` switches to development build mode automatically. You will see:

```text
› Using development build
› Press s │ switch to Expo Go
```

Press `s` any time to switch back to Expo Go mode.

### Option A: build in the cloud with EAS

**EAS** (Expo Application Services) is Expo's cloud service. **EAS Build** builds the native app on Expo's computers, so you **do not need a Mac to build for iOS** and you do not need Android Studio for Android. It has a free plan that is enough for learning.

Install the command line tool and log in with a free Expo account:

```bash
npm install -g eas-cli
eas login
eas build:configure
```

`eas build:configure` creates an `eas.json` file with build **profiles** (named groups of build settings). The `development` profile is the one for development builds:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

- `developmentClient: true` means "include the developer tools".
- `distribution: "internal"` means "install it directly on test phones, not through the store".

Then start a build:

```bash
eas build --profile development --platform android
```

After 10 to 20 minutes you get a link and a QR code. Open it on your Android phone to install the app. For iPhone, use `--platform ios`. You need a paid Apple Developer account to install on a real iPhone, and EAS walks you through registering your device. The full story is in [Building Your App with EAS Build](/courses/react-native/eas-build).

### Option B: build on your own computer

If you have the native tools installed, Expo can build and install the app locally:

For Android you need Android Studio, plus an emulator or a phone with USB debugging turned on:

```bash
npx expo run:android
```

For iOS you need a Mac with Xcode:

```bash
npx expo run:ios
```

These commands create the native `android` and `ios` folders (a step called **prebuild**), compile the app, install it on the emulator, simulator or connected phone, and start the dev server. The first run is slow; later runs are faster.

The `android` and `ios` folders are generated from your `app.json` and libraries, which is why the template lists them in `.gitignore`. Expo calls this **Continuous Native Generation**: you never edit those folders by hand, you change `app.json` and regenerate.

## Using your development build day to day

Once the app is on your phone, the loop is just like Expo Go:

```bash
npx expo start
```

Open your app (the one with your name and icon), and it connects to the dev server. Fast Refresh, logs, the dev menu: everything works.

**When do you need to rebuild?** Only when the **native** side changes:

```text
You changed...                                 Rebuild needed?
a screen, a component, styles, logic (JS/TS)   no, just save
an image you import with require()             no
installed a library with native code           yes
native settings in app.json (icon, name,
  permissions, plugins)                        yes
upgraded the Expo SDK                          yes
```

Most days you change only JavaScript, so you rebuild rarely.

## What this course uses

- Lessons in Getting Started, Core Components, Styling, State and Logic, Navigation and Data work in **Expo Go**.
- Some device features work in Expo Go but need a development build to test your real permission messages; the [Asking for Permissions the Right Way](/courses/react-native/permissions) lesson explains this.
- Shipping lessons use **EAS Build** to make real builds.

## Common mistakes

**Installing a native library and testing only in Expo Go.** Everything looks fine until you open a screen that uses it, then the app crashes. Read the library's docs; if it says "not available in Expo Go", make a development build.

**Opening a development build with no dev server running.** The app shows its launcher screen with no servers listed, or an error that it could not connect. Start `npx expo start` on your computer first, on the same Wi-Fi.

**Rebuilding for every change.** You do not need a new build when you change JavaScript. Save the file and Fast Refresh handles it. Rebuild only for native changes.

**Editing the `android` or `ios` folders by hand.** The next prebuild overwrites them. Put native settings in `app.json` (or a config plugin) instead.

## Quick recap

- **Expo Go** is a ready-made app with a fixed set of native code. It runs your JavaScript and is perfect for learning.
- A **development build** is your own app plus `expo-dev-client`: your name, your icon, any native library, same developer tools.
- Add `expo-dev-client`, then build with **EAS Build** (`eas build --profile development`, no Mac needed for iOS) or locally with `npx expo run:android` / `npx expo run:ios` (iOS needs a Mac).
- Rebuild only when native code or native config changes. JavaScript changes just need a save.
- Next, learn the TypeScript you need in [Just Enough TypeScript for React Native](/courses/react-native/typescript-basics).

<code id="code-content" class="language-bash">
# commands.sh
# 1. Add the developer tools to your app
npx expo install expo-dev-client
# 2a. Build in the cloud with EAS (no Mac needed for iOS)
npm install -g eas-cli
eas login
eas build:configure
eas build --profile development --platform android
eas build --profile development --platform ios
# 2b. Or build on your own computer
npx expo run:android   # needs Android Studio
npx expo run:ios       # needs a Mac with Xcode
# 3. Day to day: start the dev server and open your app
npx expo start
# Press s in the terminal to switch between Expo Go and development build mode
</code></pre>
