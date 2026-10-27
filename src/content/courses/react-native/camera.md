---
publishDate: 2026-10-24T06:30
title: Taking Photos with the Camera
slug: camera
metadescription: 'Build a camera screen with expo-camera: CameraView, useCameraPermissions, taking a picture, a preview with retake, and saving the photo to a habit.'
updateDate: 2026-10-24T06:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'expo-camera', 'camera', 'photos']
course: react-native
---

## A photo for every habit

Habits are easier to stick with when you can see them. In this lesson you will add a camera screen to HabitHop, so Arjun can snap a picture of his running shoes for "Go for a run" 👟 and see it on the habit's details screen.

You will use **expo-camera**, Expo's camera library. You will learn how to:

- ask for camera permission with `useCameraPermissions`,
- show a live camera preview with `CameraView`,
- take a picture with `takePictureAsync`,
- show the photo with "Retake" and "Use photo" buttons,
- save the photo somewhere permanent and attach it to the habit.

You built the permission part already in [Asking for Permissions the Right Way](/courses/react-native/permissions). This lesson uses that `PermissionGate` component, so read that first if you skipped it.

**Camera or gallery?** If the user only needs to pick or take a single photo and you do not need your own camera screen, the system's ready-made UI from [expo-image-picker](/courses/react-native/image-picker) is even simpler. Use expo-camera when you want the camera **inside** your own screen, with your own buttons and layout.

## Install and configure

```bash
npx expo install expo-camera
```

expo-camera is included in Expo Go, so you can test right away on a real phone.

Then set your permission message in `app.json`. HabitHop only takes photos, so turn off the microphone (which is only needed for recording video with sound):

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
      ]
    ]
  }
}
```

As you learned in the permissions lesson, this message only shows in a [development build](/courses/react-native/expo-go-vs-development-builds) or store build. Expo Go shows its own text.

### Where can you test?

- **Real phone (iOS or Android):** works fully. This is the best way to test.
- **Android emulator:** has a fake camera that shows a simple 3D room. Good enough to test the flow.
- **iOS simulator:** has **no camera**. The preview stays black and you cannot take pictures. Use a real iPhone. (The iOS simulator also needs a Mac.)

## Add the route

The camera screen is a new route. It needs to know which habit the photo is for, so it takes a `habitId` **search param** (a value in the URL, see [Dynamic Routes and Route Params](/courses/react-native/dynamic-routes)). Create `src/app/take-photo.tsx`, and show it as a full screen modal in the root layout:

```tsx
// src/app/_layout.tsx (part)
<Stack.Screen
  name="take-photo"
  options={{ presentation: 'fullScreenModal', title: 'Add photo', headerShown: false }}
/>
```

From the habit details screen, open it with the habit's id:

```tsx
// src/app/habit/[id].tsx (part)
import { router } from 'expo-router';

<Button
  title="Add photo"
  onPress={() => router.push({ pathname: '/take-photo', params: { habitId: id } })}
/>
```

If modals are new, see [Modal Screens](/courses/react-native/modal-screens).

## Permission first

Before the camera can show anything, you need permission. `useCameraPermissions()` returns three things: the current permission (or `null` while checking), a function to request it, and a function to check again. Hand them to the `PermissionGate`:

```tsx
// src/app/take-photo.tsx (permission part)
const [permission, requestPermission, getPermission] = useCameraPermissions();

return (
  <PermissionGate
    permission={permission}
    request={requestPermission}
    refresh={getPermission}
    title="Camera access"
    reason="HabitHop uses the camera to add a photo to a habit. Photos stay on your phone."
  >
    {/* the camera goes here */}
  </PermissionGate>
);
```

The gate shows your explanation and an **Allow access** button the first time, an **Open Settings** button if the permission was denied forever, and its children once permission is granted.

## The live preview with CameraView

**`CameraView`** is a component that shows what the camera sees. It is a normal component, so you size it with styles. `flex: 1` makes it fill the space:

```tsx
// src/app/take-photo.tsx (camera part)
const cameraRef = useRef<CameraView>(null);
const [facing, setFacing] = useState<CameraType>('back');
const [isReady, setIsReady] = useState(false);

<CameraView
  ref={cameraRef}
  style={styles.preview}
  facing={facing}
  onCameraReady={() => setIsReady(true)}
/>
```

The props you need:

- **`facing`**: `'back'` for the main camera or `'front'` for the selfie camera. Changing it switches cameras.
- **`ref`**: a **ref** is a way to hold on to a component instance, so you can call its methods. You need it to take a picture, because taking a picture is an action, not a prop.
- **`onCameraReady`**: called when the camera has started. Taking a picture before that fails, so we keep the shutter button disabled until `isReady` is `true`.

A **flip** button just toggles the `facing` state:

```tsx
// src/app/take-photo.tsx (flip button)
<Pressable style={styles.button} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}>
  <Text style={styles.buttonText}>Flip</Text>
</Pressable>
```

Other useful props, for later: `flash` (`'off'`, `'on'` or `'auto'`), `enableTorch` to turn the light on, `zoom` (a number from 0 to 1) and `mirror` to flip front camera photos.

## Taking the picture

Now the shutter button. It calls `takePictureAsync` on the ref:

```tsx
// src/app/take-photo.tsx (shutter)
const [photoUri, setPhotoUri] = useState<string | null>(null);

async function takePhoto() {
  const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
  if (photo) setPhotoUri(photo.uri);
}
```

`takePictureAsync` returns an object with the picture's details:

```json
{
  "uri": "file:///data/user/0/com.example.habithop/cache/Camera/4f1c-example.jpg",
  "width": 3024,
  "height": 4032,
  "format": "jpg"
}
```

The **uri** is the address of the image file on the phone. You can show it in an `Image` with `source={{ uri }}`, exactly like an image from the internet (see [Showing Images](/courses/react-native/images)).

The `quality` option goes from `0` (small file, low quality) to `1` (best quality, big file). Phone photos can be several megabytes. For a small habit thumbnail, `0.7` looks good and saves a lot of space. You can also pass `base64: true` to get the image as a text string, but that string is huge, so only ask for it if you really need to send the image somewhere as text.

## Preview, retake or use

After a picture is taken, `photoUri` is set, and the screen switches from the live camera to a preview with two buttons:

```tsx
// src/app/take-photo.tsx (preview)
if (photoUri) {
  return (
    <View style={styles.screen}>
      <Image source={{ uri: photoUri }} style={styles.preview} />
      <View style={styles.bar}>
        <Pressable style={styles.button} onPress={() => setPhotoUri(null)}>
          <Text style={styles.buttonText}>Retake</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={savePhoto}>
          <Text style={styles.buttonText}>Use photo</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

**Retake** clears `photoUri`, which brings the camera back. Because the camera is not on screen while previewing, the system can release it. That also means the camera only runs when it is visible, which saves battery.

## Saving the photo for real

Look at the `uri` again: it is inside a **cache** folder. The system may delete cache files whenever the phone is low on space. If you store that address in your habit, the photo can vanish one day. So before saving, copy the file into your app's **document** folder, which is kept until the app is uninstalled.

Here is a tiny helper using expo-file-system. The full story of files and folders is in [Working with Files](/courses/react-native/file-system).

```ts
// src/lib/photos.ts
import { Directory, File, Paths } from 'expo-file-system';

export async function keepPhoto(tempUri: string, habitId: string): Promise<string> {
  const folder = new Directory(Paths.document, 'habit-photos');
  if (!folder.exists) folder.create();
  const photo = new File(tempUri);
  const saved = new File(folder, `${habitId}-${Date.now()}.jpg`);
  await photo.copy(saved);
  return saved.uri;
}
```

`copy` returns a promise (the file is copied in the background), so `keepPhoto` is `async` and callers must `await` it. If you forget, you would save the address of a file that does not exist yet. There is also `copySync`, which blocks until it is done, but the async version keeps the app smooth for big photos.

## Putting it together in HabitHop

The `Habit` type needs a place for the photo. Add one **optional** field, so all existing habits stay valid:

```diff
 // src/types/habit.ts
 export type Habit = {
   id: string;
   name: string;
   emoji: string;
   color: string;
   createdAt: string;
   doneDates: string[];
+  photoUri?: string; // a file in the app's document folder
 };
```

Then give `HabitsProvider` (from [Saving Data on the Phone with AsyncStorage](/courses/react-native/async-storage)) a way to set it. HabitHop changes habits through `habitsReducer`, so this is a new action, `'photo_set'`, plus a `setHabitPhoto` function in the context value (add it to the `HabitsContextValue` type too):

```tsx
// src/context/HabitsContext.tsx (new action)
// in the HabitsAction type:
  | { type: 'photo_set'; id: string; photoUri: string };

// in habitsReducer:
case 'photo_set':
  return habits.map((h) => (h.id === action.id ? { ...h, photoUri: action.photoUri } : h));

// in the context value:
setHabitPhoto: (id, photoUri) => dispatch({ type: 'photo_set', id, photoUri }),
```

Because the provider saves habits whenever they change, the photo address is saved automatically. (If you use the [SQLite version](/courses/react-native/sqlite-database), add a `photo_uri TEXT` column in a version 2 migration and an `UPDATE habits SET photo_uri = ? WHERE id = ?` query.)

Finally, the "Use photo" button keeps the file, attaches it and closes the screen:

```tsx
// src/app/take-photo.tsx (save)
async function savePhoto() {
  if (!photoUri || !habitId) return;
  setHabitPhoto(habitId, await keepPhoto(photoUri, habitId));
  router.back();
}
```

On the habit details screen, show it when it exists:

```tsx
// src/app/habit/[id].tsx (part)
{habit.photoUri && (
  <Image source={{ uri: habit.photoUri }} style={{ width: '100%', height: 220, borderRadius: 16 }} />
)}
```

The complete camera screen is in the code panel.

**What you will see:** on the habit details screen, tap **Add photo**. The first time, you see the "Camera access" explanation; allow it. A full screen camera preview appears with a round white shutter button and a **Flip** button. Tap the shutter and the frozen photo appears with **Retake** and **Use photo**. Tap **Use photo**, and you are back on the details screen with the picture at the top. Restart the app: the photo is still there.

## Common mistakes

**Black screen on the iOS simulator.** It has no camera. Test on a real iPhone or the Android emulator.

**`takePictureAsync` does nothing or fails right after opening.** The camera was not ready yet. Wait for `onCameraReady` before enabling the shutter, as we did with `isReady`.

**`Cannot read property 'takePictureAsync' of null`.** The ref is not attached, often because the `CameraView` is not rendered (for example, you are on the preview step or permission is missing). Use `cameraRef.current?.` and only show the shutter together with the camera.

**Photos disappear after a few days.** You saved the cache `uri` directly. Copy the file to `Paths.document` first, as `keepPhoto` does.

**Two cameras at once.** Only one `CameraView` can use the camera at a time. If a camera screen stays mounted under another camera screen in a stack, the second one may show a black preview. Keep one camera screen, and present it as a modal that closes after use.

## Quick recap

- Install `expo-camera` and set `cameraPermission` (and turn off `microphonePermission` if you only take photos) in `app.json`. It works in Expo Go; the iOS simulator has no camera.
- Use `useCameraPermissions()` with a permission gate before showing the camera.
- `CameraView` shows the live preview. Use `facing` to switch cameras and wait for `onCameraReady`.
- Keep a ref to the camera and call `takePictureAsync({ quality: 0.7 })`. It returns a `uri` to a JPEG file.
- Show a preview with Retake and Use photo, so users can try again.
- The photo starts in the cache folder. Copy it to the document folder before saving its address on the habit.

<code id="code-content" class="language-tsx">
// src/app/take-photo.tsx
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { PermissionGate } from '@/components/PermissionGate';
import { useHabits } from '@/context/HabitsContext';
import { keepPhoto } from '@/lib/photos';
export default function TakePhotoScreen() {
  const { habitId } = useLocalSearchParams&lt;{ habitId: string }&gt;();
  const { setHabitPhoto } = useHabits();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const cameraRef = useRef&lt;CameraView&gt;(null);
  const [facing, setFacing] = useState&lt;CameraType&gt;('back');
  const [isReady, setIsReady] = useState(false);
  const [photoUri, setPhotoUri] = useState&lt;string | null&gt;(null);
  async function takePhoto() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
    if (photo) setPhotoUri(photo.uri);
  }
  async function savePhoto() {
    if (!photoUri || !habitId) return;
    setHabitPhoto(habitId, await keepPhoto(photoUri, habitId));
    router.back();
  }
  // Step 2: show the photo and let the user keep it or try again
  if (photoUri) {
    return (
      &lt;View style={styles.screen}&gt;
        &lt;Image source={{ uri: photoUri }} style={styles.preview} /&gt;
        &lt;View style={styles.bar}&gt;
          &lt;Pressable style={styles.button} onPress={() =&gt; setPhotoUri(null)}&gt;
            &lt;Text style={styles.buttonText}&gt;Retake&lt;/Text&gt;
          &lt;/Pressable&gt;
          &lt;Pressable style={styles.button} onPress={savePhoto}&gt;
            &lt;Text style={styles.buttonText}&gt;Use photo&lt;/Text&gt;
          &lt;/Pressable&gt;
        &lt;/View&gt;
      &lt;/View&gt;
    );
  }
  // Step 1: live camera preview (only after permission is granted)
  return (
    &lt;PermissionGate
      permission={permission}
      request={requestPermission}
      refresh={getPermission}
      title="Camera access"
      reason="HabitHop uses the camera to add a photo to a habit. Photos stay on your phone."
    &gt;
      &lt;View style={styles.screen}&gt;
        &lt;CameraView ref={cameraRef} style={styles.preview} facing={facing} onCameraReady={() =&gt; setIsReady(true)} /&gt;
        &lt;View style={styles.bar}&gt;
          &lt;Pressable style={styles.button} onPress={() =&gt; setFacing((f) =&gt; (f === 'back' ? 'front' : 'back'))}&gt;
            &lt;Text style={styles.buttonText}&gt;Flip&lt;/Text&gt;
          &lt;/Pressable&gt;
          &lt;Pressable style={[styles.shutter, !isReady &amp;&amp; styles.disabled]} onPress={takePhoto} disabled={!isReady} accessibilityLabel="Take photo" /&gt;
        &lt;/View&gt;
      &lt;/View&gt;
    &lt;/PermissionGate&gt;
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'black' },
  preview: { flex: 1 },
  bar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', padding: 24 },
  button: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, backgroundColor: '#7C5CFC' },
  buttonText: { color: 'white', fontWeight: '600' },
  shutter: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'white', borderWidth: 4, borderColor: '#7C5CFC' },
  disabled: { opacity: 0.4 },
});
</code></pre>
