---
publishDate: 2026-10-25T03:30
title: App Config, Icons and the Splash Screen
slug: app-config-icons-and-splash
metadescription: 'Set up app.json or app.config.ts for HabitHop: name, bundle ID, version numbers, an app icon, an Android adaptive icon and a splash screen.'
updateDate: 2026-10-25T03:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'expo', 'app-config', 'icons']
course: react-native
---

## Getting HabitHop ready to ship

So far HabitHop has been called "HelloWorld" (or whatever the template named it), with the Expo logo as its icon. Before you can put it in the stores, it needs a real name, a real icon, a splash screen and some IDs that the stores use to tell your app apart from every other app.

All of this lives in one place: the **app config**. This is the file `app.json` (or `app.config.ts`) in the root of your project. You met it briefly in [Understanding the Project Files](/courses/react-native/project-structure). In this lesson you will go through the parts that matter for shipping.

One important fact first: most of this config is **native**. The app name, icon, splash screen and IDs are baked into the Android and iOS app when it is built. Changing them needs a **new build** (see [Building Your App with EAS Build](/courses/react-native/eas-build)). Fast Refresh will not pick them up, and Expo Go always shows its own icon and its own splash screen.

## The main fields in app.json

Here is a cleaned-up `app.json` for HabitHop:

```json
{
  "expo": {
    "name": "HabitHop",
    "slug": "habit-hop",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "habithop",
    "userInterfaceStyle": "automatic",
    "ios": {
      "bundleIdentifier": "com.riya.habithop",
      "icon": "./assets/expo.icon"
    },
    "android": {
      "package": "com.riya.habithop",
      "adaptiveIcon": {
        "backgroundColor": "#7C5CFC",
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png"
      }
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#7C5CFC",
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 120
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    }
  }
}
```

Everything sits inside the `"expo"` key. Let's go through it.

- `name` is the name shown under the icon on the home screen. Keep it short (about 12 characters or less) so it is not cut off.
- `slug` is a URL-friendly name for your project on Expo's servers. Use lowercase and hyphens. Once you have built with EAS, do not change it.
- `orientation` locks the app to `portrait`, `landscape`, or `default` (both).
- `scheme` is the URL scheme for [deep linking](/courses/react-native/deep-linking), so links like `habithop://habit/h1` open your app.
- `userInterfaceStyle: "automatic"` lets the app follow the phone's light or dark mode (see [Dark Mode and Themes](/courses/react-native/dark-mode-and-themes)).
- `plugins` lists **config plugins**: small programs that change the native project during the build. Many Expo libraries add one, like `expo-splash-screen`.

## Bundle identifier and package name

Every app in the App Store and Google Play needs a unique ID:

- iOS calls it the **bundle identifier**: `ios.bundleIdentifier`.
- Android calls it the **package name**: `android.package`.

The usual format is a reversed domain name plus the app name: `com.yourcompany.appname`. If Riya owns `riya.dev`, she might use `dev.riya.habithop`. If you have no domain, `com.yourname.habithop` is fine. Use only lowercase letters, numbers and dots, and start each part with a letter.

**Choose carefully: you cannot change it after publishing.** To the stores, a new ID means a brand new app, with no reviews and no existing users. If you forget to set these, EAS Build will ask you for them the first time you build.

## Version numbers

Apps have two kinds of version number, and it is easy to mix them up:

| Field | Example | Who sees it | Rule |
| --- | --- | --- | --- |
| `version` | `"1.2.0"` | Users, in the store | Change it for each public release |
| `ios.buildNumber` | `"14"` | Only Apple | Must go up for every build you upload |
| `android.versionCode` | `14` | Only Google | Must go up for every build you upload (a whole number) |

`version` is the friendly number like `1.2.0`. People often follow **semantic versioning**: major, minor, patch. Bump the last number for a bug fix (`1.2.1`), the middle number for new features (`1.3.0`), and the first for big changes (`2.0.0`).

`buildNumber` and `versionCode` are internal counters. Google Play and App Store Connect reject an upload whose number is not higher than the last one. You may upload many builds of version `1.2.0` while testing (build 14, 15, 16...).

Keeping these counters up to date by hand is boring and easy to forget. EAS can do it for you. In [Building Your App with EAS Build](/courses/react-native/eas-build) you will set `"appVersionSource": "remote"` and `"autoIncrement": true` in `eas.json`. Then EAS stores the counters on its servers and adds one for every production build, and you can leave `buildNumber` and `versionCode` out of your config.

## The app icon

The `icon` field is the main icon, used everywhere unless a platform overrides it.

- Make it a **1024 by 1024 pixel PNG**. Expo creates all the smaller sizes for you.
- Fill the whole square. iOS does not allow transparent icons and adds the rounded corners itself, so do not draw your own rounded corners.
- Keep the design simple: a single bold shape reads better at small sizes than fine detail. For HabitHop, a white frog (it hops!) on the purple `#7C5CFC` background works well.

### iOS: the .icon file

Look at the template's `ios.icon`: it points to `./assets/expo.icon`, which is a **folder**, not a PNG. This is the icon format made by Apple's **Icon Composer** app. It contains layers, so iOS can show the icon in the newer glass style and in light, dark and tinted modes. Icon Composer runs only on a Mac.

If you do not have a Mac, you have two easy options:

- Remove the `ios.icon` line. iOS will then use your main `icon` PNG.
- Give `ios.icon` an object with different PNGs for each look:

```json
{
  "expo": {
    "ios": {
      "icon": {
        "light": "./assets/images/icon.png",
        "dark": "./assets/images/icon-dark.png",
        "tinted": "./assets/images/icon-tinted.png"
      }
    }
  }
}
```

### Android: adaptive icons

Android phones from different brands show icons in different shapes: circles, squircles, rounded squares. An **adaptive icon** handles this by splitting your icon into layers that Android crops to the right shape:

- `foregroundImage`: your logo on a transparent background (1024 by 1024 PNG). Keep the important part inside the middle area, about two thirds of the width, because the edges may be cropped or moved by animations.
- `backgroundImage` or `backgroundColor`: what sits behind the logo. A plain `backgroundColor` like `#7C5CFC` is the simplest.
- `monochromeImage`: a one-color version of the logo. Android 13 and newer use it for **themed icons**, when the user wants all icons to match their wallpaper colors.

The template already includes all three files in `assets/images/`. Replace them with your own designs and keep the same names, or change the paths.

## The splash screen

The **splash screen** is the picture shown while your app starts, before your first screen is ready. In SDK 58 you configure it with the `expo-splash-screen` config plugin, exactly like the template does:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#7C5CFC",
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 120,
          "dark": {
            "backgroundColor": "#1E1B2E",
            "image": "./assets/images/splash-icon.png"
          }
        }
      ]
    ]
  }
}
```

- `backgroundColor` fills the whole screen.
- `image` is a small logo shown in the middle. Use a PNG with a transparent background.
- `imageWidth` is how wide the logo is drawn, in points (default 100).
- `dark` sets a different color or image when the phone is in dark mode.

On Android 12 and newer, the system always draws the splash screen in its own way: your image is shown inside a circle in the middle of the screen. Keep the logo small and centered so it is not cut off. On iOS it is shown as you set it.

### Keeping the splash screen up while you load

By default the splash screen hides as soon as your first screen renders. But HabitHop first loads saved habits from storage (see [Saving Data on the Phone with AsyncStorage](/courses/react-native/async-storage)). If the splash hides too early, the user sees an empty list flash for a moment.

The `expo-splash-screen` library lets you control when it hides:

```tsx
// src/app/_layout.tsx
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { HabitsProvider } from '@/context/HabitsContext';

// Keep the splash screen up until we say so.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <HabitsProvider>
      <Stack />
    </HabitsProvider>
  );
}
```

- `preventAutoHideAsync()` is called at the top of the file, outside the component, so it runs as early as possible.
- `hideAsync()` hides it. Call it when your data is ready. In a real app you would call it after your habits finish loading, not in an empty `useEffect`.

The default template calls `SplashScreen.preventAutoHideAsync()` in its root layout too, and hides it after a small animation. If you replace the template's layout, make sure *your* layout still calls `hideAsync()` somewhere. You can also make it fade out more slowly:

```tsx
SplashScreen.setOptions({ duration: 600, fade: true });
```

`fade` only has an effect on iOS. Always test the splash screen in a development or release build, not in Expo Go.

## app.config.ts: config with code

`app.json` is plain JSON, so it cannot contain logic. If you need logic, create `app.config.ts` next to it. It is a TypeScript file that **exports a function** returning the config.

A common use is building two versions of HabitHop that can sit on the same phone: a development version and the real one. They need different IDs and names:

```ts
// app.config.ts
import type { ConfigContext, ExpoConfig } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? 'HabitHop (Dev)' : 'HabitHop',
  slug: 'habit-hop',
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEV ? 'com.riya.habithop.dev' : 'com.riya.habithop',
  },
  android: {
    ...config.android,
    package: IS_DEV ? 'com.riya.habithop.dev' : 'com.riya.habithop',
  },
});
```

How it works:

- If both files exist, Expo reads `app.json` first and passes its contents in as `config`. Your function returns the final config. The `...config` spread keeps everything from `app.json` (icons, plugins and so on), and you only override what changes.
- `ExpoConfig` and `ConfigContext` are types from `expo/config`, so your editor warns you about typos like `bundleIdentfier`.
- `process.env.APP_VARIANT` is an **environment variable**: a value set outside your code, for example by an EAS build profile. You will learn about these in [Environment Variables and App Settings](/courses/react-native/environment-variables).

This file runs on your computer (or the build server) while building, not inside the app. So you can read environment variables here that should never ship inside the app.

To see the final config after all files and plugins are combined, run:

```bash
npx expo config --type public
```

```text
{
  name: 'HabitHop',
  slug: 'habit-hop',
  version: '1.0.0',
  ...
}
```

This is a great way to check that `app.config.ts` does what you think.

## Common mistakes

**Changing the icon and seeing no change.** You are probably in Expo Go, or using an old build. Icons, splash screens, names and IDs are native. Make a new development or release build.

**Upload rejected because the build number was used.** Google Play says something like "Version code 3 has already been used. Try another version code." Fix: increase `android.versionCode` (or `ios.buildNumber`), or let EAS do it with `autoIncrement`.

**The splash screen never goes away.** You called `preventAutoHideAsync()` but `hideAsync()` never runs, for example because loading threw an error. Fix: call `hideAsync()` in a `finally` block or after both success and failure.

**An adaptive icon with the logo cut off.** The logo filled the whole foreground image. Fix: shrink it to the middle two thirds of the canvas.

## Quick recap

- The app config (`app.json` or `app.config.ts`) holds the name, IDs, versions, icons and splash screen.
- These settings are native: you need a new build to see changes.
- `ios.bundleIdentifier` and `android.package` are permanent IDs. Pick them carefully.
- `version` is for users. `ios.buildNumber` and `android.versionCode` must go up for every upload, and EAS can manage them for you.
- Use a 1024 by 1024 PNG icon. Android adds adaptive icon layers, and iOS can use an Icon Composer `.icon` folder.
- Configure the splash screen with the `expo-splash-screen` plugin, and control when it hides with `preventAutoHideAsync()` and `hideAsync()`.
- Use `app.config.ts` when the config needs logic, and check the result with `npx expo config`.

<code id="code-content" class="language-typescript">
// app.config.ts
import type { ConfigContext, ExpoConfig } from 'expo/config';
// Set APP_VARIANT=development for a dev build that installs next to the real app.
const IS_DEV = process.env.APP_VARIANT === 'development';
export default ({ config }: ConfigContext): ExpoConfig =&gt; ({
  // Everything from app.json (icons, splash plugin, experiments) comes in as config
  ...config,
  name: IS_DEV ? 'HabitHop (Dev)' : 'HabitHop',
  slug: 'habit-hop',
  version: '1.0.0', // the version users see in the store
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEV ? 'com.riya.habithop.dev' : 'com.riya.habithop',
    buildNumber: '1', // must go up for every upload (or let EAS autoIncrement it)
  },
  android: {
    ...config.android,
    package: IS_DEV ? 'com.riya.habithop.dev' : 'com.riya.habithop',
    versionCode: 1, // a whole number that must go up for every upload
  },
  extra: {
    ...config.extra,
    showDebugMenu: IS_DEV,
  },
});
</code></pre>
