---
publishDate: 2026-10-25T11:00
title: Shipping Fixes Fast with EAS Update
slug: eas-update
metadescription: 'Send JavaScript fixes straight to users with EAS Update: install expo-updates, set channels and runtimeVersion, publish with eas update and roll back safely.'
updateDate: 2026-10-25T11:00
author: ['bishal-biswas']
level: 3
tags: ['react-native', 'eas', 'expo-updates', 'deployment']
course: react-native
---

## The problem: store reviews are slow

HabitHop is live. Then Arjun emails you: "My streak shows 0 even though I ticked the habit today!" You find the bug in two minutes. It is a one-line fix in `getStreak`.

Without updates, you now have to make a new build, upload it, wait for Google and Apple to review it, and then wait for each user to install the update. That can take days.

**EAS Update** fixes this. It sends a new version of your **JavaScript and assets** (images, fonts) straight to the apps already installed on phones. The next time someone opens HabitHop, it quietly downloads the fix. No store review, no new build.

This works because a React Native app has two parts (remember [How React Native Works Under the Hood](/courses/react-native/how-react-native-works)):

- The **native part**: the Android and iOS code, native libraries, permissions, icon. This only changes with a new build from the store.
- The **JavaScript bundle**: your components, screens and logic. This is just a file the native part loads. EAS Update replaces this file.

So EAS Update can change anything in your JavaScript and assets. It **cannot** add a new native library, change the app icon, change permissions or anything else native. Those still need a new build through [EAS Build](/courses/react-native/eas-build).

## Step 1: install and configure

Install the `expo-updates` library:

```bash
npx expo install expo-updates
```

`expo-updates` is the part inside your app that checks for, downloads and loads updates. It is native code, so it only works in a new build, not in Expo Go. Then let EAS set up the config:

```bash
eas update:configure
```

This adds two things to your app config:

```json
{
  "expo": {
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/your-project-id"
    }
  }
}
```

- `updates.url` is where the app asks for updates. It contains your EAS project ID (the real one is a long ID, `your-project-id` above is a placeholder).
- `runtimeVersion` is explained in a moment. It is the most important idea in this lesson.

It also adds a `channel` to the build profiles in `eas.json`:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "autoIncrement": true,
      "channel": "production"
    }
  }
}
```

Because `expo-updates` is native, **make new builds** after this step (preview and production), and ship the production one to the stores. Only builds that contain `expo-updates` can receive updates.

## Channels: which builds get which update

A **channel** is a name baked into each build. HabitHop's store builds are on the `production` channel, and the test APKs you send to Sam are on the `preview` channel.

When you publish an update, you say which channel it is for:

```bash
eas update --channel preview --message "Fix streak when today is not done"
```

Only builds on the `preview` channel get it. Your store users are not affected. Behind the scenes, EAS stores updates on a **branch** (a list of updates, like a git branch), and each channel points to a branch. By default the channel `preview` uses the branch named `preview`, so you rarely need to think about branches.

This gives you a safe workflow:

1. Fix the bug.
2. Publish to `preview`. Install or open the preview build and check the fix.
3. When it works, publish the same code to `production`:

```bash
eas update --channel production --message "Fix streak when today is not done"
```

```text
✔ Exported bundle(s)
✔ Uploaded 2 app bundles
✔ Published!

Branch             production
Runtime version    1.0.0
Platform           android, ios
Message            Fix streak when today is not done
```

(Your output will have more lines, such as the update group ID and a link to the update on expo.dev.)

If you use EAS environment variables from [Environment Variables and App Settings](/courses/react-native/environment-variables), add `--environment production` so the update is bundled with the same `EXPO_PUBLIC_` values as the production build. Remember that `EXPO_PUBLIC_` values are inlined when the bundle is made, and `eas update` makes a new bundle.

## runtimeVersion: keeping JavaScript and native code in sync

Here is the danger. Say version 1.0.0 of HabitHop has no camera. In version 1.1.0 you add `expo-camera` (native code) and a photo screen. If a phone still running the 1.0.0 build downloaded the 1.1.0 JavaScript, the photo screen would ask for a native camera module that does not exist, and crash with an error like:

```text
Error: Cannot find native module 'ExpoCamera'
```

The **runtime version** prevents this. It is a label for "this exact set of native code". Every build has one, and every update has one. **A build only accepts updates with the same runtime version.**

With `"policy": "appVersion"`, the runtime version is simply your app's `version`:

- All builds of `1.0.0` have runtime version `1.0.0`.
- When you run `eas update`, it uses your current `version`, so the update has runtime version `1.0.0` and goes to those builds.
- When you add native code, you **must** bump `version` (say to `1.1.0`) and make new builds. Updates for `1.1.0` then go only to `1.1.0` builds, and old `1.0.0` phones keep their old, working JavaScript until they install the new build from the store.

The rule to remember: **changed native code or native config? Bump `version`, build, submit.** Only JavaScript changed? `eas update` is enough.

There is another policy, `"fingerprint"`, which calculates the runtime version automatically from a hash (a fingerprint) of your native code and config. It catches native changes you might forget, at the cost of being less readable than a plain version number. `appVersion` is simpler to understand, so this course uses it.

## When do users get the update?

By default, `expo-updates` works like this:

1. The user opens HabitHop. The app starts right away with the JavaScript it already has.
2. In the background, it asks the update server if there is a newer update for its channel and runtime version.
3. If there is, it downloads it.
4. The **next** time the user opens the app (after fully closing it), the new JavaScript runs.

So a fix reaches most users after they open the app twice. That is usually fine for bug fixes. If you want the fix to apply sooner, you can check for updates yourself and reload the app:

```tsx
// src/hooks/use-update-check.ts
import * as Updates from 'expo-updates';
import { useEffect } from 'react';

export function useUpdateCheck() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    async function check() {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (error) {
        console.warn('Update check failed', error);
      }
    }

    check();
  }, []);
}
```

- `checkForUpdateAsync()` asks the server whether a newer update exists.
- `fetchUpdateAsync()` downloads it.
- `reloadAsync()` restarts the JavaScript with the new update, right now.
- `Updates.isEnabled` is `false` in development and in Expo Go, so the check is skipped there. `__DEV__` is `true` while you run `npx expo start`.

Reloading while the user is in the middle of typing a new habit is rude. A friendlier way is to download quietly and then show a small banner: "A new version is ready. Restart now?" and only call `reloadAsync()` when they tap it. `expo-updates` also has a `useUpdates()` hook that tells you `isUpdateAvailable` and `isUpdatePending`, which is handy for such a banner.

`expo-updates` is not installed in the project used to check this course's code, so I could not type-check this snippet against the exact SDK 58 version. The functions above have been part of `expo-updates` for many releases, but check the library's README after installing.

## Rolling back

What if the "fix" makes things worse? Because every update is stored on EAS, you can go back:

- On expo.dev, open your project, then **Updates**, find the last good update, and republish it.
- Or from the terminal, republish an earlier update to the same branch:

```bash
eas update:republish --branch production
```

The CLI shows a list of recent updates to choose from. Phones get the old (good) JavaScript as a "new" update, the same way they got the bad one.

## Rules and good habits

- **Test every update on the preview channel first.** An update reaches every user of that channel, with no reviewer to catch mistakes.
- **Store rules still apply.** Apple and Google allow updates that fix bugs and make small changes to JavaScript. Do not use updates to turn your app into a different app, or to add features that would not pass review.
- **Keep the message clear**: `--message` is your changelog. "Fix streak when today is not done" is much more useful than "update".
- **Run your tests first**: `npx jest` from [Testing with Jest and React Native Testing Library](/courses/react-native/testing).

## Common mistakes

**The update never arrives.** Check three things: the build was made *after* installing `expo-updates`; the build's channel matches the `--channel` you published to; and the runtime versions match (same `version` with the `appVersion` policy). The update page on expo.dev shows the runtime version of each update.

**Testing in Expo Go or a development build.** Updates are disabled in development. Use a preview build.

**An update that needs native code.** Symptom: the app crashes with `Cannot find native module '...'` after an update. You added a native library but did not bump `version`. Fix: republish the last good update right away, then bump `version`, build and submit.

**Expecting the fix on the first launch.** By default the new JavaScript runs on the *second* launch. Close the app fully and open it again, or add a manual check as shown above.

## Quick recap

- EAS Update sends new JavaScript and assets to installed apps, without a store review.
- It cannot change native code, permissions, icons or other native config. Those need a new build.
- Setup: `npx expo install expo-updates`, then `eas update:configure`, then new builds.
- Each build has a **channel**. Publish with `eas update --channel production --message "..."`, after testing on `preview`.
- **runtimeVersion** makes sure updates only reach builds with matching native code. With `"policy": "appVersion"`, bump `version` whenever native code changes.
- By default updates download in the background and apply on the next launch. `checkForUpdateAsync`, `fetchUpdateAsync` and `reloadAsync` let you control it.
- Roll back by republishing an earlier update.

<code id="code-content" class="language-json">
{
  "expo": {
    "name": "HabitHop",
    "slug": "habit-hop",
    "version": "1.0.0",
    "scheme": "habithop",
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/your-project-id",
      "checkAutomatically": "ON_LOAD",
      "fallbackToCacheTimeout": 0
    },
    "ios": {
      "bundleIdentifier": "com.riya.habithop"
    },
    "android": {
      "package": "com.riya.habithop"
    },
    "plugins": [
      "expo-router"
    ],
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    }
  }
}
</code></pre>
