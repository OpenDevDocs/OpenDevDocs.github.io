---
publishDate: 2026-10-23T17:00
title: 'Deep Linking: Opening Your App from a URL'
slug: deep-linking
metadescription: 'Open HabitHop screens from a URL: set the app scheme, test exp:// links in Expo Go and habithop:// links in dev builds, and learn about universal links.'
updateDate: 2026-10-23T17:00
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'expo-router', 'deep-linking', 'navigation']
course: react-native
---

## What a deep link is

A **deep link** is a URL that opens your app on a specific screen, not just the home screen. You tap a link in a message, an email or a notification, and the app jumps straight to, say, the "Drink water" habit.

For HabitHop, this link:

```text
habithop://habit/h1
```

should open the details screen for habit `h1`.

Here is the good news: with Expo Router, you have already done most of the work. Every screen has a URL (that was the point of file-based routing in [How Expo Router Works](/courses/react-native/expo-router-basics)), and `src/app/habit/[id].tsx` already handles `/habit/h1`. Deep linking is mostly about getting the phone to hand that URL to your app.

## The parts of an app URL

```text
habithop://habit/h1?from=email
└──┬───┘   └──┬───┘ └───┬────┘
 scheme      path      query
```

- The **scheme** is the part before `://`. For websites it is `https`. For your app it is a word you choose, like `habithop`. When the phone sees a URL with your scheme, it opens your app.
- The **path** (`habit/h1`) is the route. Expo Router matches it to your files, exactly like a `Link` would.
- The **query** (`?from=email`) becomes extra params, readable with `useLocalSearchParams` as you saw in [Dynamic Routes and Route Params](/courses/react-native/dynamic-routes).

Route group names like `(tabs)` never appear in these URLs. `habithop://stats` opens the Stats tab.

## Step 1: set the scheme in app.json

The scheme lives in `app.json`. You may have set it back in the Getting Started section. If not, add it now:

```json
{
  "expo": {
    "name": "HabitHop",
    "slug": "habit-hop",
    "scheme": "habithop"
  }
}
```

Pick something short, lowercase and unique to your app. No spaces, no `://`.

Important: the scheme is a **native** setting. It gets written into the iOS and Android project files when the app is built. Changing it means you need a new build. And it has **no effect in Expo Go**, because Expo Go is one app shared by everyone, with its own scheme. That leads to two kinds of URLs during development.

## Step 2: test in Expo Go with exp://

When you run `npx expo start`, the terminal shows the address of your dev server:

```text
› Metro waiting on exp://192.168.1.20:8081
› Scan the QR code above to open the project in Expo Go.
```

Expo Go understands URLs that start with that address. To point at a screen, add `/--/` and then the route path:

```text
exp://192.168.1.20:8081/--/habit/h1
```

The `/--/` separates "which project to load" from "which screen inside it". Use your own IP address and port from the terminal, not the one above.

To try it:

- **Android emulator or iOS simulator**: use the `uri-scheme` tool, which sends a URL to the device for you:

```bash
npx uri-scheme open "exp://192.168.1.20:8081/--/habit/h1" --android
npx uri-scheme open "exp://192.168.1.20:8081/--/habit/h1" --ios
```

- **A real phone**: send yourself the link (for example in a chat or note app) and tap it. The phone asks to open Expo Go, and HabitHop opens on the habit screen.

The `--ios` option needs a Mac with Xcode, because the iOS simulator only runs on macOS. On Windows and Linux, test with Android or a real phone.

What you will see: the app opens (or comes to the front) with "💧 Drink water" on screen. Because of the `unstable_settings.anchor` you set in [Nested Layouts and Route Groups](/courses/react-native/layouts-and-route-groups), there is a back arrow, and it leads to the Today tab.

## Step 3: test your own scheme in a development build

Your real `habithop://` scheme only works in an app that was built with it: a **development build** or a release build. (See [Expo Go vs Development Builds](/courses/react-native/expo-go-vs-development-builds) if you need a refresher.) Build and install one with:

```bash
npx expo run:android
```

or in the cloud with EAS Build (no Mac needed for iOS), covered in [Building Your App with EAS Build](/courses/react-native/eas-build). Then send the link:

```bash
npx uri-scheme open "habithop://habit/h1" --android
npx uri-scheme open "habithop://habit/h1" --ios
```

If you prefer the platform tools directly, these do the same thing:

```bash
adb shell am start -W -a android.intent.action.VIEW -d "habithop://habit/h1"
xcrun simctl openurl booted "habithop://habit/h1"
```

You can also check which schemes a built project has with:

```bash
npx uri-scheme list
```

## How Expo Router handles the URL

You do not need any code to receive the link. When the app opens from a URL, Expo Router reads it, finds the matching route and builds the right navigation state. Everything you set up earlier still applies:

- **Dynamic routes**: `habithop://habit/h2` gives `useLocalSearchParams()` the value `{ id: 'h2' }`.
- **Missing habits**: `habithop://habit/nope` opens the details screen, which shows "This habit does not exist." That is why the not-found branch matters.
- **Unknown routes**: `habithop://nowhere` shows the "Unmatched Route" screen, or your own `src/app/+not-found.tsx`.
- **Protected routes**: if the user is signed out, `Stack.Protected` from [Protected Routes and a Simple Login Flow](/courses/react-native/protected-routes) blocks the habit screen, and the user sees sign-in instead.

## Making links from inside the app

To build a link that points into your app (for example to share a habit), do not hard-code `habithop://`. In Expo Go the URL must be `exp://...`, in a build it is `habithop://...`. The `expo-linking` package (already installed) picks the right one:

```tsx
import * as Linking from 'expo-linking';

const url = Linking.createURL('habit/h1');
// Expo Go:   exp://192.168.1.20:8081/--/habit/h1
// Dev build: habithop://habit/h1
```

The same package can open *other* apps and websites:

```tsx
await Linking.openURL('mailto:riya@example.com');
await Linking.openURL('https://dummyjson.com');
```

And `Linking.useURL()` returns the URL that opened the app, if you ever need to inspect it. With Expo Router you rarely do, because the router already turned it into a screen and params.

## Universal links and App Links

Custom schemes like `habithop://` have two weak points. If the app is not installed, the link does nothing. And any other app could register the same scheme.

The fix is to use normal **`https://` links** for your own website, and tell the phone "this website belongs to this app". Then `https://habithop.example.com/habit/h1` opens the app if it is installed, and the website if it is not.

- On iOS these are called **universal links**. You add `associatedDomains` in `app.json` (like `"applinks:habithop.example.com"`) and put a file called `apple-app-site-association` on your website.
- On Android they are called **App Links**. You add an `intentFilters` entry with `"autoVerify": true` in `app.json` and put a file called `assetlinks.json` on your website.

The code panel shows what that `app.json` setup looks like. Both need a website you control, a real build (not Expo Go) and app signing details, so set them up once you are close to publishing: see [Publishing to Google Play](/courses/react-native/publishing-to-google-play) and [Publishing to the Apple App Store](/courses/react-native/publishing-to-the-app-store). Expo Router handles the incoming `https://` URL the same way as `habithop://`, so your routes do not change.

## Common mistakes

**Testing habithop:// in Expo Go.** Nothing happens, or the phone says it cannot open the link, because Expo Go does not know your scheme. Use the `exp://.../--/...` URL in Expo Go, and `habithop://` only in a development build.

**Forgetting the /--/ in Expo Go URLs.** `exp://192.168.1.20:8081/habit/h1` (without `/--/`) does not open the habit screen. Expo Go reads `habit/h1` as part of the project address.

**Changing the scheme without rebuilding.** The scheme is baked into the native app. After editing `scheme` in `app.json`, run `npx expo run:android` (or a new EAS build) again.

**Putting the group in the URL.** `habithop://(tabs)/stats` is wrong. Groups are not part of URLs. Use `habithop://stats`.

## Quick recap

- A deep link is a URL that opens a specific screen of your app, like `habithop://habit/h1`.
- Set `"scheme": "habithop"` in `app.json`. It is a native setting that needs a new build and does nothing in Expo Go.
- In Expo Go, links look like `exp://<your-ip>:8081/--/habit/h1`. In a development build, they look like `habithop://habit/h1`.
- Test with `npx uri-scheme open "<url>" --android` or `--ios` (iOS needs a Mac), or tap a link on a real phone.
- Expo Router turns the URL into the right screen and params automatically. Anchors, not-found handling and protected routes all still apply.
- `Linking.createURL('habit/h1')` builds the correct URL for the current environment.
- Universal links (iOS) and App Links (Android) use `https://` links tied to your website, set up with `associatedDomains` and `intentFilters`.

<code id="code-content" class="language-json">
{
  "expo": {
    "name": "HabitHop",
    "slug": "habit-hop",
    "version": "1.0.0",
    "scheme": "habithop",
    "ios": {
      "bundleIdentifier": "com.example.habithop",
      "associatedDomains": ["applinks:habithop.example.com"]
    },
    "android": {
      "package": "com.example.habithop",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            { "scheme": "https", "host": "habithop.example.com", "pathPrefix": "/habit" }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "plugins": ["expo-router"],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    }
  }
}
</code></pre>
