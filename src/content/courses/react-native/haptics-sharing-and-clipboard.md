---
publishDate: 2026-10-24T12:30
title: Haptics, Sharing and the Clipboard
slug: haptics-sharing-and-clipboard
metadescription: 'Add small vibrations with expo-haptics, open the share sheet with Share and expo-sharing, and copy and paste text with expo-clipboard in your app.'
updateDate: 2026-10-24T12:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'expo', 'haptics', 'device-features']
course: react-native
---

## Small features that make an app feel native

Some of the things that make an app feel "right" on a phone are tiny. A soft tap under your finger when you finish a task. A share button that opens the same share sheet every other app uses. A "Copy" button that just works. Users notice when these are missing.

In this lesson you will add three of them to HabitHop:

- **Haptics**: a short vibration when you mark a habit as done.
- **Sharing**: hold a habit card to share your streak ("💧 Drink water: 7 days in a row on HabitHop!").
- **Clipboard**: copy your habit list as text, and paste a habit name.

All three libraries are small and work in Expo Go. None of them need a development build.

```bash
npx expo install expo-haptics expo-clipboard expo-sharing
```

## Haptics: feedback you can feel

**Haptics** are small, precise vibrations. They are not the long buzz of an incoming call. They are short taps that tell your finger "yes, that worked". iPhones have a special motor for this called the Taptic Engine. Android phones use their vibration motor.

expo-haptics has three main functions:

```tsx
// src/lib/haptics-demo.ts
import * as Haptics from 'expo-haptics';

// 1. A physical "bump", like two objects touching
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// 2. A pattern that means success, warning or error
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// 3. A tiny tick for changing a selection, like a picker wheel
Haptics.selectionAsync();
```

`ImpactFeedbackStyle` has `Light`, `Medium`, `Heavy`, `Soft` and `Rigid`. `NotificationFeedbackType` has `Success`, `Warning` and `Error`. Each function returns a Promise, but you almost never need to `await` it. Fire it and move on.

### Android has its own, better function

On iOS, these functions map directly to Apple's haptic system. On Android, `impactAsync` and `notificationAsync` are **simulated** with the vibration motor, which can feel buzzy, and the library's own notes say this Android API "is not recommended for implementing haptics feedback".

For Android, expo-haptics has `performAndroidHapticsAsync`. It uses Android's built-in haptic patterns, which feel like the rest of the system, and it does not need the `VIBRATE` permission:

```tsx
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

if (Platform.OS === 'android') {
  Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm);
} else {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
```

`AndroidHaptics` has many patterns, such as `Confirm`, `Reject`, `Long_Press`, `Toggle_On`, `Toggle_Off` and `Clock_Tick`. You learned the `Platform.OS` check in [Writing Platform-Specific Code](/courses/react-native/platform-specific-code).

### Using haptics well

- Use them for **meaningful moments**: finishing a task, a toggle, an error. Not for every button.
- Match the feeling to the meaning. Success for "done", a light impact for "undo", error for "that failed".
- They do not work in the iOS Simulator (a Mac has no Taptic Engine). Test on a real phone.
- Users can turn system haptics off in their phone settings. Your call then quietly does nothing, which is correct. Never make haptics the only feedback: always change something on screen too.

## Sharing text with Share

To share text or a link, React Native has a built-in `Share` API. No install needed. It opens the system **share sheet** (the panel with Messages, WhatsApp, Mail and so on):

```tsx
import { Share } from 'react-native';

async function shareStreak() {
  try {
    const result = await Share.share({
      message: '💧 Drink water: 7 days in a row on HabitHop!',
    });
    if (result.action === Share.sharedAction) {
      console.log('Shared!');
    }
  } catch (e) {
    console.warn('Share failed', e);
  }
}
```

Platform details, from React Native's source:

- `message` is the text to share. `url` is **iOS only**, and `title` is **Android only**. To share a link on both, put it inside `message`.
- On iOS, `result.action` tells you if the user shared or closed the sheet (`Share.dismissedAction`). On Android, it is always `sharedAction`, because Android does not report it. So do not rely on it for anything important, like giving a reward.

## Sharing files with expo-sharing

`Share` shares text. To share a **file**, like a photo or a CSV export, use expo-sharing. It takes the local address of a file and opens the share sheet for it:

```tsx
import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';

export async function shareFile(uri: string) {
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Sharing is not available on this device');
    return;
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export habits',
  });
}
```

- `uri` must point to a file on the phone, such as `file:///.../habits.csv`. It cannot be a web address.
- `mimeType` tells the other app what kind of file it is (`'image/jpeg'`, `'text/csv'`, `'application/pdf'`).
- `dialogTitle` is shown on Android and web.
- `isAvailableAsync()` returns `false` on some web browsers without share support, so check it first.

You need a file to share, so you will use this for real in [Working with Files](/courses/react-native/file-system), where HabitHop writes a CSV export of all habits and shares it.

## The clipboard with expo-clipboard

The **clipboard** is the place where copied text waits until you paste it. expo-clipboard lets your app write to it and read from it.

### Copying

Copying is one line. Here is a Settings button that copies the user's habit list as plain text:

```tsx
// src/components/CopyHabitsButton.tsx
import { Alert, Button } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useHabits } from '@/context/HabitsContext';

export function CopyHabitsButton() {
  const { habits } = useHabits();

  async function copyList() {
    const text = habits.map((h) => `${h.emoji} ${h.name}`).join('\n');
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Your habit list is on the clipboard.');
  }

  return <Button title="Copy my habits" onPress={copyList} />;
}
```

Paste it into a notes app and you get:

```text
💧 Drink water
📚 Read 10 pages
🧘 Stretch
```

Recent Android versions show their own small "Copied" popup at the bottom of the screen. You can still show your own message. A quick toast or a change in the button text is a nice touch.

`setStringAsync` also accepts platform options. For private text such as a recovery code, pass `{ android: { isSensitive: true } }` so Android does not show the copied text in its preview popup. On iOS, `{ ios: { localOnly: true } }` keeps it off the user's other Apple devices.

### Pasting

Reading is just as short:

```tsx
const text = await Clipboard.getStringAsync();
```

There is a privacy rule on iOS. Since iOS 16, when your app reads the clipboard, iOS asks the user "Allow Paste?". If they say no, `getStringAsync()` returns an empty string, and the library's docs note there is no way to tell that apart from an empty clipboard. So:

- Only read the clipboard when the user asks for it, like tapping a "Paste" button. Never read it secretly when the screen opens.
- Treat an empty string as "nothing to paste".

To avoid the dialog completely on iOS, expo-clipboard offers `ClipboardPasteButton`. It shows Apple's own paste button, and because the user taps it on purpose, iOS does not ask again:

```tsx
// in the New Habit screen
import * as Clipboard from 'expo-clipboard';

{Clipboard.isPasteButtonAvailable && (
  <Clipboard.ClipboardPasteButton
    acceptedContentTypes={['plain-text']}
    onPress={(data) => {
      if (data.type === 'text') setName(data.text.trim());
    }}
    style={{ width: 120, height: 44 }}
  />
)}
```

`isPasteButtonAvailable` is only `true` on iOS 16 and newer, so show a normal button with `getStringAsync` on other platforms. Apple limits how this button looks: you must set its width and height, and you can't change its corner radius with `style`. Use the `cornerStyle` and `displayMode` props instead.

## Putting it together in HabitHop

The code panel shows the updated `src/components/HabitCard.tsx`. It builds on the card from [State and Props in a Mobile App](/courses/react-native/state-and-props):

- Tapping the round done button calls `handleToggle`. Marking a habit as done plays the success pattern (`Confirm` on Android, `Success` on iOS). Unmarking plays a light impact, so undo feels different from done.
- Long-pressing the name opens the share sheet with the streak. `onLongPress` on `Pressable` was covered in [Buttons and Pressable](/courses/react-native/buttons-and-pressable).
- The done button has `accessibilityRole="checkbox"` and `accessibilityState`, so screen readers announce "checked" or "not checked". The haptic is a bonus, never the only signal.

What you will see on a real phone: tap the circle and feel a crisp double tap as it fills with the habit's color. Tap it again and feel a single soft tap. Hold the habit name and the share sheet slides up with your streak message ready to send to Riya or Sam.

## Common mistakes

**"Haptics do nothing."** You are probably on the iOS Simulator, or the phone has system haptics turned off. Test on a real device. On Android, also check that touch vibration is on in the sound settings.

**Sharing a link with `url` on Android.** The `url` field is ignored on Android, so the shared message has no link. Put the link inside `message`.

**Passing a web address to `Sharing.shareAsync`.** It needs a local file. Download the file first (expo-file-system can do that) or share the link as text with `Share.share`.

**Reading the clipboard on screen load.** On iOS, users see "Allow Paste?" for no reason, which feels creepy, and if they decline you get an empty string. Read only after a user action.

## Quick recap

- `npx expo install expo-haptics expo-clipboard expo-sharing`. All work in Expo Go.
- Haptics: `impactAsync`, `notificationAsync` and `selectionAsync`. On Android, prefer `performAndroidHapticsAsync` with `AndroidHaptics` patterns. Test on a real phone.
- `Share.share({ message })` from React Native shares text. `url` is iOS only, `title` is Android only.
- `Sharing.shareAsync(fileUri, { mimeType })` from expo-sharing shares a local file.
- `Clipboard.setStringAsync(text)` copies. `getStringAsync()` pastes, but only after a user action, because iOS asks for permission.
- `ClipboardPasteButton` gives a no-prompt paste button on iOS 16 and newer.

<code id="code-content" class="language-tsx">
// src/components/HabitCard.tsx
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Habit } from '@/types/habit';
import { getStreak, isDoneToday } from '@/lib/dates';
type HabitCardProps = {
  habit: Habit;
  onToggle: (id: string) =&gt; void;
  onPress?: () =&gt; void; // opens the details screen
};
export function HabitCard({ habit, onToggle, onPress }: HabitCardProps) {
  const doneToday = isDoneToday(habit.doneDates);
  const streak = getStreak(habit.doneDates);
  function handleToggle() {
    if (doneToday) {
      // Undo: a light tap
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (Platform.OS === 'android') {
      // Android: the system "confirm" pattern, no VIBRATE permission needed
      Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm);
    } else {
      // iOS: the "success" pattern
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onToggle(habit.id);
  }
  async function handleShare() {
    try {
      await Share.share({
        message: `${habit.emoji} ${habit.name}: ${streak} days in a row on HabitHop!`,
      });
    } catch (e) {
      console.warn('Share failed', e);
    }
  }
  return (
    &lt;View style={[styles.card, { borderLeftColor: habit.color }]}&gt;
      &lt;Text style={styles.emoji}&gt;{habit.emoji}&lt;/Text&gt;
      &lt;Pressable style={styles.info} onPress={onPress} onLongPress={handleShare}&gt;
        &lt;Text style={styles.name}&gt;{habit.name}&lt;/Text&gt;
        &lt;Text style={styles.streak}&gt;🔥 {streak} day streak · hold to share&lt;/Text&gt;
      &lt;/Pressable&gt;
      &lt;Pressable
        onPress={handleToggle}
        style={[styles.done, doneToday &amp;&amp; { backgroundColor: habit.color }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: doneToday }}
        accessibilityLabel={`Mark ${habit.name} as done today`}
      &gt;
        &lt;Text style={styles.check}&gt;{doneToday ? '✓' : ''}&lt;/Text&gt;
      &lt;/Pressable&gt;
    &lt;/View&gt;
  );
}
const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#fff', borderRadius: 12, borderLeftWidth: 4 },
  emoji: { fontSize: 28 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  streak: { color: '#6B7280', marginTop: 2 },
  done: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  check: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
</code></pre>
