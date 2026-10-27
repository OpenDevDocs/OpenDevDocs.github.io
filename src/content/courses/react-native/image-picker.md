---
publishDate: 2026-10-24T08:00
title: Picking Photos from the Gallery
slug: image-picker
metadescription: 'Let users pick photos and videos from the phone gallery with expo-image-picker, show them on screen and save them so they stay after a restart.'
updateDate: 2026-10-24T08:00
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'expo', 'images', 'device-features']
course: react-native
---

## Why pick photos?

Many apps let you choose a picture: a profile photo, a receipt, a picture of your lunch. In HabitHop you will add a **profile photo** to the Settings screen. The user taps a round placeholder, the phone's own photo picker opens, they choose a picture, crop it to a square, and it shows up in the app. It also stays there after the app restarts.

The tool for this is **expo-image-picker**. It opens the **system photo picker**, which is the gallery screen that is built into iOS and Android. Your app does not draw this screen. It only receives the photo the user chose.

You will learn how to:

- install expo-image-picker and open the gallery
- read the result and show the picked image
- use the most useful options (cropping, quality, picking many photos)
- take a new photo with the camera instead
- keep the picked photo safe so it is still there tomorrow

## Installing expo-image-picker

Install it with `npx expo install`, which picks the version that matches your Expo SDK:

```bash
npx expo install expo-image-picker
```

expo-image-picker is part of Expo Go, so you can test everything in this lesson in Expo Go on your phone. No development build is needed.

When you later make a development build or a store build, iOS shows a short text that explains why your app wants the photos. You can set that text with the library's **config plugin** (a small script that changes the native project for you when it is built) in `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "HabitHop uses your photos to set a profile picture.",
          "cameraPermission": "HabitHop uses the camera to take a profile picture."
        }
      ]
    ]
  }
}
```

Expo Go ignores this text and uses its own, because Expo Go is already built. You will learn more about config plugins in [App Config, Icons and the Splash Screen](/courses/react-native/app-config-icons-and-splash).

## Do you need permission to open the gallery?

Usually, no. Modern phones give apps a "safe" picker: the user sees all their photos, but your app only gets the one photo they tap. Because of that, `launchImageLibraryAsync` works without asking for the photo library permission on current iOS and Android versions. The library's own docs say the permission is only required on very old iOS (iOS 10).

This is good for users. You do not need a scary "Allow access to all your photos?" dialog just to set a profile picture. If you want the general rules about asking for permissions, read [Asking for Permissions the Right Way](/courses/react-native/permissions).

The camera is different. Taking a new photo always needs the camera permission. You will see that later in this lesson.

## Opening the gallery

Here is the smallest useful example. It opens the picker, lets the user crop a square, and logs what came back:

```tsx
// src/lib/pickPhoto.ts
import * as ImagePicker from 'expo-image-picker';

export async function pickOne() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (!result.canceled) {
    const asset = result.assets[0];
    console.log(asset.uri, asset.width, asset.height);
  }
}
```

`launchImageLibraryAsync` returns a **Promise** (a value that arrives later), so you `await` it. The picker stays open until the user picks something or closes it.

The result has two fields:

- `canceled`: `true` if the user closed the picker without choosing anything.
- `assets`: an array of picked items, or `null` when `canceled` is `true`.

Always check `canceled` first. TypeScript helps here: inside `if (!result.canceled)`, it knows `assets` is an array and not `null`.

Each item in `assets` is an **asset** (one picked photo or video). The fields you will use most:

| Field | What it is |
| --- | --- |
| `uri` | A local file address like `file:///.../ImagePicker/1A2B.jpg`. Pass it to an `Image`. |
| `width`, `height` | The size in pixels. Can be `0` if the system did not say. |
| `type` | `'image'`, `'video'` and a few iOS-only values, or `null`. |
| `fileName` | The original file name, or `null`. |
| `fileSize` | The size in bytes. |
| `mimeType` | For example `'image/jpeg'`. |

If you log it, the terminal shows something like this:

```text
Android  LOG  file:///data/user/0/host.exp.exponent/cache/ImagePicker/3f2c9a1e.jpeg 1080 1080
```

## The options that matter

The object you pass to `launchImageLibraryAsync` has many options. These are the ones you will actually use:

- `mediaTypes`: what the user can pick. Use an array: `['images']`, `['videos']` or `['images', 'videos']`. The default is `'images'`. You may see `ImagePicker.MediaTypeOptions.Images` in old tutorials. It still works but is **deprecated** (marked as old and going away), so use the array form.
- `allowsEditing`: shows a crop screen after picking. On Android the user can crop and rotate. On iOS they can only crop.
- `aspect`: the crop shape, like `[1, 1]` for a square or `[16, 9]`. This only works on **Android**. On iOS the crop box is always a square.
- `quality`: a number from `0` to `1`. `1` keeps full quality, smaller numbers make smaller files. `0.7` is a good choice for photos you will show on a phone screen.
- `allowsMultipleSelection`: lets the user pick more than one item.
- `selectionLimit`: the most items they can pick when multiple selection is on. `0` (the default) means "as many as the system allows".
- `base64`: also returns the image as a **base64** string (the image bytes written as text). It makes the result much bigger, so only turn it on if an API really needs it.

There are more options for videos and a few iOS-only and Android-only settings. Your editor shows all of them with their notes when you hover over `launchImageLibraryAsync`, because the types come with the library.

## Picking many photos at once

Turn on `allowsMultipleSelection` and you get several assets back:

```tsx
// src/components/PhotoStrip.tsx
import { useState } from 'react';
import { Button, Image, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export function PhotoStrip() {
  const [uris, setUris] = useState<string[]>([]);

  async function pickMany() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.6,
    });
    if (!result.canceled) {
      setUris(result.assets.map((a) => a.uri));
    }
  }

  return (
    <View>
      <Button title="Pick up to 5 photos" onPress={pickMany} />
      <ScrollView horizontal>
        {uris.map((uri) => (
          <Image key={uri} source={{ uri }} style={{ width: 90, height: 90, marginRight: 8 }} />
        ))}
      </ScrollView>
    </View>
  );
}
```

Two rules to remember:

- Multiple selection and cropping do not mix. If `allowsMultipleSelection` is `true`, `allowsEditing` is ignored.
- Multiple selection needs iOS 14 or newer. That covers nearly every iPhone in use today.

## Taking a new photo with the camera

The same library can open the phone's camera app with `launchCameraAsync`. It takes the same options and returns the same result shape. The difference: you must ask for the camera permission first.

```tsx
// src/lib/takePhoto.ts
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export async function takePhoto() {
  const { granted } = await ImagePicker.requestCameraPermissionsAsync();
  if (!granted) {
    Alert.alert('Camera access is off', 'You can turn it on in Settings.');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  return result.canceled ? null : result.assets[0].uri;
}
```

The camera does not work in the iOS Simulator, because a simulator has no camera. Use a real iPhone, or an Android emulator (it shows a fake camera scene). If you need a live camera preview inside your own screen, with your own buttons on top, use expo-camera instead. That is covered in [Taking Photos with the Camera](/courses/react-native/camera).

## Keeping the photo after a restart

Here is a trap that catches many people. The `uri` you get back points into the app's **cache folder**. The cache is a place for temporary files, and the system may delete it when the phone is low on space. If you save that `uri` and show it next week, the file might be gone.

The fix is to copy the picked file into the **document folder**, which the system does not clean up. You can do that with expo-file-system and its `File` and `Paths` classes:

```tsx
// inside your pick function
import { File, Paths } from 'expo-file-system';

const picked = new File(result.assets[0].uri);
const saved = new File(Paths.document, `avatar-${Date.now()}.jpg`);
await picked.copy(saved);
// saved.uri is now a safe address you can store
```

`new File(...)` does not create anything on disk. It is just a handle that points at a path. `copy` does the real work. The file name includes `Date.now()` so each new photo gets a new address. That matters because image components cache pictures by their address, and reusing one name could keep showing the old photo.

You will learn the full `File` and `Directory` API in [Working with Files](/courses/react-native/file-system). To remember the saved address itself, store it with AsyncStorage, as you did in [Saving Data on the Phone with AsyncStorage](/courses/react-native/async-storage).

## Putting it together in HabitHop

Now build the profile photo for `src/app/(tabs)/settings.tsx`. It:

1. loads the saved photo address from AsyncStorage when the screen opens
2. opens the picker with a square crop when the user taps the circle
3. copies the photo into the document folder and deletes the old one
4. saves the new address and shows the image

The full file is in the code panel. The image is shown with `Image` from **expo-image**, which is already in the default Expo template. It works like the React Native `Image` you met in [Showing Images](/courses/react-native/images), and adds caching and a `contentFit` prop. `contentFit="cover"` fills the circle without stretching the photo.

What you will see: a light purple circle with a plus sign. Tap it, pick a photo, drag the crop box, and tap Choose (iOS) or the check mark (Android). The circle now shows your photo. Close the app fully and open it again: the photo is still there.

### A habit photo from the gallery

In [Taking Photos with the Camera](/courses/react-native/camera) you gave each habit an optional `photoUri`, a `keepPhoto` helper in `src/lib/photos.ts` and a `setHabitPhoto` action in the habits context. The gallery can feed the same pieces, so users can choose an existing photo instead of taking a new one:

```tsx
// src/components/PickHabitPhotoButton.tsx
import { Button } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useHabits } from '@/context/HabitsContext';
import { keepPhoto } from '@/lib/photos';

export function PickHabitPhotoButton({ habitId }: { habitId: string }) {
  const { setHabitPhoto } = useHabits();

  async function pick() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (result.canceled) return;
    setHabitPhoto(habitId, await keepPhoto(result.assets[0].uri, habitId));
  }

  return <Button title="Choose from gallery" onPress={pick} />;
}
```

Put this button on the habit details screen next to the "Take photo" button. Both paths end in the same place: a copy of the photo in the document folder, saved on the habit.

On the web, the picker opens your computer's file dialog instead. It must be opened from a button press, because browsers block file dialogs that open on their own.

## Common mistakes

**Reading `result.uri`.** Very old versions returned the address directly on the result. Today it is inside `assets`. TypeScript tells you:

```text
Property 'uri' does not exist on type 'ImagePickerResult'.
```

Use `result.assets[0].uri` after checking `result.canceled`.

**Forgetting the cancel case.** If the user closes the picker, `assets` is `null`. Code like `result.assets[0]` without a check crashes with `TypeError: Cannot read property '0' of null`. Always `if (result.canceled) return;` first.

**Expecting `aspect` to work on iOS.** On iPhones the crop box is always square, whatever you pass. If you need a 16:9 crop on both platforms, you need a separate image editing library.

**Saving the cache address.** The photo shows today and is a blank space next month. Copy the file into `Paths.document` first, then save that address.

**Android closing your app.** On low-memory Android phones, the system can close your app while the picker is open, and the result is lost. The library has `ImagePicker.getPendingResultAsync()` to get that result back when the app restarts. You can test this by turning on "Don't keep activities" in Android's developer options.

## Quick recap

- Install with `npx expo install expo-image-picker`. It works in Expo Go.
- `launchImageLibraryAsync(options)` opens the system gallery and does not need the photo permission on current iOS and Android.
- Check `result.canceled`, then read `result.assets[0].uri`.
- Use `mediaTypes: ['images']`, `allowsEditing`, `aspect` (Android only) and `quality` for most cases. `allowsMultipleSelection` turns off cropping.
- `launchCameraAsync` takes a new photo and needs `requestCameraPermissionsAsync` first.
- The returned file lives in the cache. Copy it to `Paths.document` with expo-file-system if you need to keep it.

<code id="code-content" class="language-tsx">
// src/app/(tabs)/settings.tsx
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
const AVATAR_KEY = 'habithop.avatar';
export default function SettingsScreen() {
  const [avatarUri, setAvatarUri] = useState&lt;string | null&gt;(null);
  // Load the saved photo once when the screen opens
  useEffect(() =&gt; {
    AsyncStorage.getItem(AVATAR_KEY).then(setAvatarUri);
  }, []);
  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return; // the user closed the picker
    // Copy the picked photo out of the cache into a safe folder
    const picked = new File(result.assets[0].uri);
    const saved = new File(Paths.document, `avatar-${Date.now()}.jpg`);
    await picked.copy(saved);
    // Delete the old photo so files do not pile up
    if (avatarUri) {
      const old = new File(avatarUri);
      if (old.exists) old.delete();
    }
    await AsyncStorage.setItem(AVATAR_KEY, saved.uri);
    setAvatarUri(saved.uri);
  }
  return (
    &lt;View style={styles.screen}&gt;
      &lt;Pressable onPress={pickAvatar} accessibilityRole="button" accessibilityLabel="Change profile photo"&gt;
        {avatarUri ? (
          &lt;Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" /&gt;
        ) : (
          &lt;View style={[styles.avatar, styles.placeholder]}&gt;
            &lt;Text style={styles.plus}&gt;+&lt;/Text&gt;
          &lt;/View&gt;
        )}
      &lt;/Pressable&gt;
      &lt;Text style={styles.hint}&gt;Tap to choose a profile photo&lt;/Text&gt;
    &lt;/View&gt;
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', paddingTop: 48, gap: 12 },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  placeholder: { backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  plus: { fontSize: 40, color: '#7C5CFC' },
  hint: { color: '#6B7280' },
});
</code></pre>
