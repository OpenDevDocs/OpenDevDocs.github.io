---
publishDate: 2026-10-25T06:30
title: Building Your App with EAS Build
slug: eas-build
metadescription: 'Build real Android and iOS apps in the cloud with EAS Build: install eas-cli, set up eas.json profiles, make development builds, APKs and store-ready AABs.'
updateDate: 2026-10-25T06:30
author: ['bishal-biswas']
level: 3
tags: ['react-native', 'eas', 'expo', 'builds']
course: react-native
---

## From Expo Go to a real app

Until now you have run HabitHop inside Expo Go or a development build. That is great while you build, but nobody can download "your project in Expo Go" from a store. To ship, you need real app files:

- For Android: an **APK** (a file you can install directly on a phone) or an **AAB** (Android App Bundle, the format Google Play wants).
- For iOS: an **IPA** file, signed with your Apple account.

Making these by hand means installing Android Studio, Xcode (which only runs on a Mac), signing keys and lots of settings. **EAS Build** does it for you in the cloud. EAS stands for **Expo Application Services**, the paid-and-free cloud services made by the Expo team. You upload your project, their servers build it, and you get a link to download the app.

The big win: **you can build an iOS app without a Mac.** EAS uses Macs in the cloud.

EAS has a free plan with a monthly limit of builds and a shared queue, so a free build may wait a few minutes before it starts. That is enough to learn and to ship a small app like HabitHop.

## Step 1: install the EAS CLI and log in

The **EAS CLI** is a command line tool for talking to EAS. Install it once, globally:

```bash
npm install -g eas-cli
```

Then create a free account at expo.dev (in your browser) and log in from the terminal. You will see something like this:

```bash
eas login
```

```text
Log in to EAS with email or username (exit and run eas login --help to see other login options)
? Email or username › riya
? Password › ********
Logged in
```

Check who you are logged in as at any time:

```bash
eas whoami
```

If you prefer not to install anything globally, you can run every command with `npx eas-cli@latest` instead of `eas`, for example `npx eas-cli@latest login`.

## Step 2: link the project and create eas.json

Inside your `habit-hop` folder, run:

```bash
eas build:configure
```

This does two things:

1. It links your project to your Expo account, if it is not linked yet. It creates a project on expo.dev and writes its ID into your app config (as `extra.eas.projectId`, plus an `owner` field).
2. It creates a file called `eas.json` in the root of your project.

`eas.json` is the settings file for EAS. Here is what it looks like after a little editing for HabitHop:

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "APP_VARIANT": "development"
      }
    },
    "development-simulator": {
      "extends": "development",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

The version number in `"cli"` will match the `eas-cli` you installed. It means "this project needs at least this version of the CLI".

## Build profiles

Each key inside `"build"` is a **build profile**: a named recipe for one kind of build. You pick one with `--profile`. The three standard profiles are:

### development

A **development build** is your own custom version of Expo Go. It contains all the native code your app uses (for example `expo-camera` or `expo-notifications` from the Device Features section), plus the developer tools. You still run `npx expo start` on your computer, and the app loads your JavaScript from it with Fast Refresh. You learned why you need one in [Expo Go vs Development Builds](/courses/react-native/expo-go-vs-development-builds).

- `"developmentClient": true` includes the developer tools. It needs the `expo-dev-client` package.
- `"distribution": "internal"` means "for installing directly on test phones, not for a store".
- `"env"` sets `APP_VARIANT`, which your `app.config.ts` from [App Config, Icons and the Splash Screen](/courses/react-native/app-config-icons-and-splash) can use to name the app "HabitHop (Dev)" with its own bundle ID, so it can live next to the real app.

`development-simulator` uses `"extends"` to copy everything from `development` and only adds `"ios": { "simulator": true }`, which builds for the iOS Simulator on a Mac instead of a real iPhone.

### preview

A **preview** build is the real app, with no developer tools and the JavaScript bundled inside, but shared directly with testers instead of through a store. Perfect for "Sam, can you try this on your phone?".

`"android": { "buildType": "apk" }` makes an APK, which anyone can install on an Android phone by opening the download link.

### production

The **production** build is what you upload to Google Play and the App Store.

- On Android it makes an **AAB**. Google Play requires AABs for new apps. You cannot install an AAB directly on a phone; Google Play turns it into small APKs made for each device.
- On iOS it makes an IPA signed for the App Store.
- `"autoIncrement": true` adds one to `android.versionCode` and `ios.buildNumber` for every production build. Together with `"appVersionSource": "remote"` (in `"cli"`), EAS keeps these counters on its servers, so you never upload a build with an old number by mistake.

You can add your own profiles too, like a `staging` profile that points to a test server with a different `env`.

## Step 3: your first development build

First install the dev client package:

```bash
npx expo install expo-dev-client
```

Then start an Android development build:

```bash
eas build --profile development --platform android
```

The first time, EAS asks a few questions. The output looks roughly like this (exact wording changes between CLI versions):

```text
✔ What would you like your Android application id to be? … com.riya.habithop.dev
✔ Generate a new Android Keystore? … yes
✔ Created keystore

Compressing project files and uploading to EAS Build.
✔ Uploaded to EAS
Build details: https://expo.dev/accounts/riya/projects/habit-hop/builds/...

Waiting for build to complete. You can press Ctrl+C to exit.
✔ Build finished

🤖 Open this link on your Android devices (or scan the QR code) to install the app:
https://expo.dev/accounts/riya/projects/habit-hop/builds/...
```

What just happened:

- EAS asked for the **application id** (the `android.package` from your config) if it was missing.
- It created a **keystore**: the private key that signs your Android app. Every update to a Play Store app must be signed with the same key. EAS stores it safely on its servers, so you do not have to worry about losing it.
- It **uploaded** your project. Files listed in `.gitignore` are skipped (you can add a `.easignore` file for more control).
- The build ran in the cloud. A first build often takes 10 to 20 minutes, plus queue time on the free plan.

Open the link on your Android phone, download and install the app. Then on your computer run:

```bash
npx expo start
```

Open the development build on the phone and pick your computer's dev server. You now have HabitHop running with all its native modules, and Fast Refresh still works.

You only need a **new** development build when native things change: you add a library with native code, or change native config like the icon. For JavaScript changes, the dev server is enough.

### Development builds for iOS

For the iOS Simulator (needs a Mac with Xcode):

```bash
eas build --profile development-simulator --platform ios
```

For a real iPhone, you need a paid **Apple Developer Program** membership (see [Publishing to the Apple App Store](/courses/react-native/publishing-to-the-app-store)). Apple only lets "internal" apps run on phones that are registered to your account, so first register each test iPhone:

```bash
eas device:create
```

This gives you a link or QR code to open on the iPhone. Then build with `--profile development --platform ios`. EAS logs in to your Apple account and creates the certificates and profiles Apple needs. You do not need a Mac for any of this.

## Step 4: a preview build for testers

When HabitHop is ready for Mia and Arjun to try:

```bash
eas build --profile preview --platform android
```

You get a link to an APK. Send the link (or the QR code from the build page on expo.dev) to your testers. They open it on their Android phone and install it. Their phone may ask them to allow installing apps from their browser the first time.

For iPhones, a preview build also needs registered devices, or you can use TestFlight, which is covered in the App Store lesson.

## Step 5: a production build

```bash
eas build --profile production --platform android
```

```text
✔ Incremented versionCode from 1 to 2.
...
✔ Build finished

🤖 Android app:
https://expo.dev/artifacts/eas/....aab
```

And for iOS:

```bash
eas build --profile production --platform ios
```

Or both at once with `--platform all`. These are the files you send to the stores in the next two lessons: [Publishing to Google Play](/courses/react-native/publishing-to-google-play) and [Publishing to the Apple App Store](/courses/react-native/publishing-to-the-app-store).

Before a production build, a good habit is to run your tests and type check first:

```bash
npx tsc --noEmit
npx jest
```

You wrote those tests in [Testing with Jest and React Native Testing Library](/courses/react-native/testing).

## Can I build on my own computer?

Yes, but it needs more setup:

- `npx expo run:android` builds and runs a debug app locally. It needs Android Studio and the Android SDK.
- `npx expo run:ios` does the same for iOS. It needs a **Mac** with Xcode.
- `eas build --local` runs the EAS build steps on your own machine (same tools needed).

EAS Build in the cloud is the easiest route, especially on Windows or Linux, and it is what this course uses.

## Common mistakes

**Installing an AAB on a phone.** Symptom: the file will not open, or the phone says it cannot install it. Fix: AABs are only for Google Play. Use the `preview` profile with `"buildType": "apk"` for direct installs.

**The build fails at "Install dependencies".** Usually your `package.json` and lock file do not match, or a package version does not fit your SDK. Fix: run `npx expo install --check` locally, commit the lock file, and build again. The build page on expo.dev shows the full log for every step; read the first red error, not the last.

**Forgetting `expo-dev-client`.** Symptom: the development build opens like a normal app and cannot connect to your dev server. Fix: `npx expo install expo-dev-client` and make a new development build.

**A secret in `.env.local` is missing in the build.** `.gitignore`d files are not uploaded. Use the `env` field in `eas.json` or EAS environment variables, as shown in [Environment Variables and App Settings](/courses/react-native/environment-variables).

## Quick recap

- EAS Build makes real Android and iOS apps in the cloud. No Mac needed for iOS.
- Install with `npm install -g eas-cli`, then `eas login` and `eas build:configure`.
- `eas.json` holds **build profiles**: `development` (your own Expo Go with dev tools), `preview` (real app for testers) and `production` (for the stores).
- Development builds need `expo-dev-client`. Rebuild only when native code or native config changes.
- Android: `"buildType": "apk"` for direct installs, AAB (the default) for Google Play.
- iOS real-device builds need a paid Apple Developer account and registered devices (`eas device:create`), or TestFlight.
- `"appVersionSource": "remote"` and `"autoIncrement": true` let EAS manage build numbers.

<code id="code-content" class="language-json">
{
  "cli": {
    "version": "&gt;= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "APP_VARIANT": "development"
      }
    },
    "development-simulator": {
      "extends": "development",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
</code></pre>
