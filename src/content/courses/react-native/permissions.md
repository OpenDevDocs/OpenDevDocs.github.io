---
publishDate: 2026-10-24T05:00
title: Asking for Permissions the Right Way
slug: permissions
metadescription: 'Learn the check, explain, request pattern for camera, photos and location permissions in Expo, handle denied forever and open Settings.'
updateDate: 2026-10-24T05:00
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'permissions', 'expo', 'privacy']
course: react-native
---

## Why apps must ask

Phones protect private things: the camera, the microphone, photos, location, contacts, notifications. An app cannot just use them. It must ask the user first, and the user can say no. This request is called a **permission**.

The Device Features section of this course uses several of them: the [camera](/courses/react-native/camera), [photo gallery](/courses/react-native/image-picker), [location](/courses/react-native/location) and [notifications](/courses/react-native/notifications). They all follow the **same pattern**, so it pays to learn it once, properly, before any of them.

In this lesson you will learn:

- how iOS and Android permissions differ,
- the three states a permission can be in, including "denied forever",
- the **check, explain, request** pattern,
- how to send users to the Settings app with `Linking.openSettings()`,
- how to write your own permission messages in `app.json`,
- a reusable `PermissionGate` component for HabitHop.

## How iOS and Android handle permissions

Both systems show a **system dialog**: a popup drawn by the phone, not by your app. You cannot change its buttons or style. But there are differences.

**iOS:**

- Every sensitive feature needs a **usage description**: a sentence explaining why the app needs it. It appears inside the system dialog. Without it, the app is not allowed to use the feature at all, and App Review rejects apps with vague texts.
- iOS shows the dialog **only once**. If the user taps "Don't Allow", calling request again returns "denied" right away, with no dialog. From then on, only the Settings app can change it.
- Some permissions have extra choices, like "Allow Once" for location or "Limited Access" for photos.

**Android:**

- The app lists its permissions in a file called `AndroidManifest.xml`. Some, like internet access, are "normal" and granted automatically. Sensitive ones are **runtime permissions** that need a dialog.
- If the user denies, you can ask again. But if they deny **twice** (on modern Android), the system stops showing the dialog. That is Android's version of "denied forever".
- Users can pick "Only this time" for camera, microphone and location. The permission is then removed again soon after they leave the app.

Expo hides most of these differences behind one API, but the user experience is different, so keep both in mind.

## The permission response

Every Expo module that needs a permission gives you the same tools. For the camera, for example:

```text
Camera.getCameraPermissionsAsync()       check the current state (never shows a dialog)
Camera.requestCameraPermissionsAsync()   show the system dialog if allowed
useCameraPermissions()                   a hook that does both for components
```

Location has `getForegroundPermissionsAsync` and `requestForegroundPermissionsAsync`, the image picker has `getMediaLibraryPermissionsAsync` and so on. Each one returns a **PermissionResponse** object:

```ts
// what every check or request returns
type PermissionResponse = {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean; // shortcut for status === 'granted'
  canAskAgain: boolean; // false = "denied forever", the dialog will not show
  expires: 'never' | number;
};
```

The combinations that matter:

```text
status: 'undetermined'                    never asked yet           -> explain, then request
status: 'granted'                         allowed                   -> use the feature
status: 'denied', canAskAgain: true       said no, can ask again    -> explain again, then request
status: 'denied', canAskAgain: false      denied forever            -> offer "Open Settings"
```

## The pattern: check, explain, request

Here is the flow good apps follow:

1. **Check** the current state quietly, without a dialog.
2. If it is granted, just continue.
3. If it is not, **explain** in your own screen why you need it, and let the user tap a button.
4. Only then **request**, which shows the system dialog.
5. If it is denied forever, offer to **open Settings** instead.

Why explain first? Because on iOS you get **one** chance at the system dialog. If it pops up out of nowhere when the app starts, many people tap "Don't Allow" out of habit, and you can never ask again. If they first see "Add a photo to your habit, so you can see your progress", and then tap a button themselves, they understand what they are agreeing to. This also matches the rules of both app stores: ask at the moment the feature is used, not at launch.

Here is the pattern as a plain async function, using location as the example:

```ts
// src/lib/permissions.ts
import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';

export async function ensureLocationPermission(): Promise<boolean> {
  // 1. Check (never shows a dialog)
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;

  // 2. Denied for good: the system will not ask again
  if (!current.canAskAgain) {
    Alert.alert('Location is turned off', 'You can turn it on for HabitHop in Settings.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]);
    return false;
  }

  // 3. Ask (shows the system dialog)
  const result = await Location.requestForegroundPermissionsAsync();
  return result.granted;
}
```

Call it right when the user taps a feature that needs location, and only continue if it returns `true`. The explain step here is the button the user just tapped, which should already say what will happen (for example, "Use my location for reminders").

## Opening the Settings app

When a permission is denied forever, the only way back is the Settings app. React Native's `Linking` API has a method for that:

```ts
// opens your app's page in the phone's Settings app
import { Linking } from 'react-native';

await Linking.openSettings();
```

On iOS it opens your app's page in Settings, where the user can flip the switch. On Android it opens your app's "App info" screen, where the user taps **Permissions**. Tell the user what to look for, because they may not find it otherwise.

Two things to know about coming back:

- Your app does not get a callback. You must **check again** when the app returns to the foreground, using `AppState` (from [Effects and the App Lifecycle](/courses/react-native/effects-and-app-state)).
- On iOS, if the user turns a permission **off** in Settings, iOS restarts your app. Your state is lost, so make sure important data is saved (it is, thanks to [SQLite](/courses/react-native/sqlite-database)).

## A reusable PermissionGate component

For screens that cannot work at all without a permission (like a camera screen), a small component keeps things tidy. It shows its children only when the permission is granted. Otherwise it shows your explanation and the right button.

The props take exactly what the Expo permission hooks return, so it works with any of them:

```tsx
// src/components/PermissionGate.tsx (props)
type Props = {
  permission: PermissionResponse | null; // null while the first check runs
  request: () => Promise<PermissionResponse>; // shows the system dialog
  refresh: () => Promise<PermissionResponse>; // checks again, no dialog
  title: string;
  reason: string;
  children: ReactNode;
};
```

The interesting part decides which button to show:

```tsx
// src/components/PermissionGate.tsx (decision)
if (!permission) return <ActivityIndicator style={styles.box} />;
if (permission.granted) return <>{children}</>;

const blocked = !permission.canAskAgain;
// ...button text: blocked ? 'Open Settings' : 'Allow access'
// ...onPress:     blocked ? Linking.openSettings() : request()
```

And an `AppState` listener calls `refresh` when the app comes back from Settings, so the screen updates by itself. The whole component is in the code panel.

Using it with the camera hook looks like this:

```tsx
// src/app/take-photo.tsx (preview of the next lesson)
import { CameraView, useCameraPermissions } from 'expo-camera';
import { PermissionGate } from '@/components/PermissionGate';

export default function TakePhotoScreen() {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  return (
    <PermissionGate
      permission={permission}
      request={requestPermission}
      refresh={getPermission}
      title="Camera access"
      reason="HabitHop uses the camera to add a photo to a habit. Photos stay on your phone."
    >
      <CameraView style={{ flex: 1 }} facing="back" />
    </PermissionGate>
  );
}
```

The hook returns an array of three things: the current `PermissionResponse` (or `null` while it checks), a function to request, and a function to check again. By default it checks on mount and never requests by itself, which is exactly what the check, explain, request pattern needs.

**What you will see:** the first time, a friendly screen with "Camera access", your reason and an **Allow access** button. Tap it and the system dialog appears. Allow, and the camera preview fills the screen. Deny it (twice on Android), and the button changes to **Open Settings**.

## Writing your own permission messages

The text inside the iOS dialog comes from your app's config. Expo libraries add a default text, like "Allow $(PRODUCT_NAME) to access your camera". You should replace it with a specific reason. Each library's **config plugin** accepts options for this in `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "HabitHop uses the camera so you can add a photo to a habit.",
          "microphonePermission": false,
          "recordAudioAndroid": false
        }
      ],
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "HabitHop uses your location to remind you about habits at places like the gym."
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "HabitHop opens your photos so you can pick a picture for a habit."
        }
      ]
    ]
  }
}
```

A few details:

- `false` removes a permission completely. HabitHop only takes photos, never videos, so we turn the microphone off. Asking for permissions you do not use makes users (and app reviewers) suspicious.
- Android does not show your text in its dialog, but the plugin still adds the right entries to `AndroidManifest.xml`. You can also list extra Android permissions under `"android": { "permissions": [...] }`, or remove ones added by libraries with `"android": { "blockedPermissions": [...] }`.
- Config plugins change **native** files. They only take effect in a new native build: a [development build](/courses/react-native/expo-go-vs-development-builds) or a store build with [EAS Build](/courses/react-native/eas-build). **Expo Go** is a ready-made app with its own fixed messages, so you will see Expo Go's texts there, not yours.

## Common mistakes

**Asking for everything on launch.** Three system dialogs in a row on first open is the fastest way to get "Don't Allow" three times, and on iOS that is permanent. Ask for each permission when its feature is first used.

**Calling request again and again after "denied forever".** Nothing happens: no dialog, just `status: 'denied'`. Users tap your button and think the app is broken. Check `canAskAgain` and offer **Open Settings** instead.

**Not re-checking after Settings.** The user turns on the camera in Settings, comes back, and still sees "Allow access". Listen to `AppState` and call the hook's check function when the app becomes `active`.

**Missing usage description on iOS.** If a native build has no camera usage text, iOS ends the app the moment you touch the camera. In the device logs you see a message like:

```text
This app has crashed because it attempted to access privacy-sensitive data without a usage description.
```

Installing the library with `npx expo install` adds its plugin, but if you removed the plugin or set the permission to `false`, add it back and rebuild.

## Quick recap

- Sensitive features need a permission. The system shows the dialog; you cannot style it.
- iOS shows the dialog once. Android stops showing it after two denials. Both end in "denied forever".
- Every Expo module gives you `get...PermissionsAsync`, `request...PermissionsAsync` and often a `use...Permissions` hook. They return `status`, `granted` and `canAskAgain`.
- Follow **check, explain, request**: check quietly, explain in your own UI, then request at the moment the feature is used.
- When `canAskAgain` is `false`, offer `Linking.openSettings()`, and check again when the app returns to the foreground.
- Set your own messages with config plugin options in `app.json`. They only apply in a development or store build, not in Expo Go.

<code id="code-content" class="language-tsx">
// src/components/PermissionGate.tsx
import type { PermissionResponse } from 'expo';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
type Props = {
  permission: PermissionResponse | null; // null while the first check runs
  request: () =&gt; Promise&lt;PermissionResponse&gt;; // shows the system dialog
  refresh: () =&gt; Promise&lt;PermissionResponse&gt;; // checks again, no dialog
  title: string;
  reason: string;
  children: ReactNode;
};
// Shows children only when the permission is granted, otherwise explains and asks
export function PermissionGate({ permission, request, refresh, title, reason, children }: Props) {
  // The user may change the permission in Settings: check again when the app comes back
  useEffect(() =&gt; {
    const subscription = AppState.addEventListener('change', (state) =&gt; {
      if (state === 'active') refresh();
    });
    return () =&gt; subscription.remove();
  }, [refresh]);
  if (!permission) return &lt;ActivityIndicator style={styles.box} /&gt;;
  if (permission.granted) return &lt;&gt;{children}&lt;/&gt;;
  // Denied for good: only the Settings app can change it now
  const blocked = !permission.canAskAgain;
  return (
    &lt;View style={styles.box}&gt;
      &lt;Text style={styles.title}&gt;{title}&lt;/Text&gt;
      &lt;Text style={styles.reason}&gt;{reason}&lt;/Text&gt;
      &lt;Pressable
        style={styles.button}
        onPress={() =&gt; (blocked ? Linking.openSettings() : request())}
      &gt;
        &lt;Text style={styles.buttonText}&gt;{blocked ? 'Open Settings' : 'Allow access'}&lt;/Text&gt;
      &lt;/Pressable&gt;
    &lt;/View&gt;
  );
}
const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  reason: { textAlign: 'center', color: '#4B5563' },
  button: { backgroundColor: '#7C5CFC', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  buttonText: { color: 'white', fontWeight: '600' },
});
</code></pre>
