---
publishDate: 2026-10-24T11:00
title: Local Notifications and Reminders
slug: notifications
metadescription: 'Schedule local notifications with expo-notifications: permissions, Android channels, daily reminders, foreground handling and opening a screen on tap.'
updateDate: 2026-10-24T11:00
author: ['bishal-biswas']
level: 3
tags: ['react-native', 'expo', 'notifications', 'device-features']
course: react-native
---

## Reminders make habits stick

A habit tracker that never reminds you is easy to forget. In this lesson you will give HabitHop a **daily reminder**: "Time to check in 🐇. Did you finish your habits today?" at a time the user picks, for example 8 PM. You will also add a reminder for a single habit that opens that habit's screen when tapped.

A **notification** is the message that slides down from the top of the screen and waits in the phone's notification list. There are two kinds:

- **Local notifications** are created by your app on the phone itself. You say "show this at 8 PM every day" and the phone does it, even if your app is closed. No server is needed.
- **Push notifications** (also called **remote notifications**) are sent from a server over the internet, for example "Sam liked your streak". They need a server, a push token and store credentials.

This lesson is about local notifications. They are perfect for reminders, and they are much simpler.

## Installing and what works where

```bash
npx expo install expo-notifications
```

Here is exactly what works in Expo Go, based on the library itself:

- **Local notifications** (everything in this lesson) work in Expo Go on both Android and iOS.
- **Push notifications on Android** were removed from Expo Go in SDK 53. If you call `getExpoPushTokenAsync()` in Expo Go on Android, the library throws an error that tells you to "Use a development build instead of Expo Go."
- **Push notifications on iOS** in Expo Go only log a warning, but you should still use a development build for real push work.

So: build and test reminders in Expo Go today. When you add push notifications later, switch to a development build (see [Expo Go vs Development Builds](/courses/react-native/expo-go-vs-development-builds)).

Notifications also work in the iOS Simulator and the Android emulator for local reminders.

## Step 1: decide what happens when the app is open

What should happen if a notification fires while the user is looking at your app? You decide with a **notification handler**. Set it once, at the top level of your root layout file, outside any component:

```tsx
// src/app/_layout.tsx (top of the file)
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,  // slide down a banner
    shouldShowList: true,    // keep it in the notification list
    shouldPlaySound: true,
    shouldSetBadge: false,   // iOS app icon badge number
  }),
});
```

In this version of expo-notifications, a notification that arrives while your app is open is shown even if you set no handler. The handler lets you change that, for example to stay silent, or to hide the banner when the user is already on the Today screen. `handleNotification` receives the notification, so you can decide per notification. It must answer within 3 seconds, or the default behavior is used.

You may see `shouldShowAlert` in older tutorials. It is deprecated. Use `shouldShowBanner` and `shouldShowList` instead.

When the app is closed or in the background, the handler is not involved. The system simply shows the notification.

## Step 2: create an Android channel

Android 8 and newer groups notifications into **channels**. A channel is a category like "Habit reminders" that the user can turn on, off or make silent in the phone's settings. Every notification must belong to a channel.

```ts
// src/lib/reminders.ts
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Habit reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
}
```

`importance: HIGH` lets the notification pop up as a banner. Lower values only show an icon in the status bar. Two Android rules to know:

- After a channel is created, you can only change its name and description. To change its importance, use a new channel ID.
- Create the channel before you ask for permission. On Android 13 and newer, the permission dialog is linked to the app having a channel.

On iOS, `setNotificationChannelAsync` does nothing, so the `Platform` check just keeps things clear.

## Step 3: ask for permission

iOS always asks the user. Android asks on version 13 and newer. Use the same polite pattern from [Asking for Permissions the Right Way](/courses/react-native/permissions): check first, ask only if you still can.

```ts
// src/lib/reminders.ts
export async function allowReminders(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false; // the user must use Settings now
  const answer = await Notifications.requestPermissionsAsync();
  return answer.granted;
}
```

Ask at a moment that makes sense, like when the user turns on "Daily reminder" in Settings. Not the moment the app first opens. People say yes much more often when they just asked for the feature.

## Step 4: schedule a notification

`scheduleNotificationAsync` takes the **content** (what to show) and a **trigger** (when to show it). It returns an **identifier**, a string you can use later to cancel it.

The quickest test is a notification 5 seconds from now:

```ts
await Notifications.scheduleNotificationAsync({
  content: {
    title: 'Hello from HabitHop',
    body: 'This is a test reminder.',
  },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: 5,
  },
});
```

Run it, then press the home button. After 5 seconds the notification appears.

Every trigger has a `type` from `SchedulableTriggerInputTypes`. The ones you will use:

| Type | Fires | Fields |
| --- | --- | --- |
| `TIME_INTERVAL` | after some seconds, optionally repeating | `seconds`, `repeats` |
| `DATE` | once at an exact date and time | `date` |
| `DAILY` | every day | `hour`, `minute` |
| `WEEKLY` | every week | `weekday`, `hour`, `minute` |
| `MONTHLY` | every month | `day`, `hour`, `minute` |
| `YEARLY` | every year | `month`, `day`, `hour`, `minute` |
| `CALENDAR` | when date parts match (iOS only) | `hour`, `weekday`, and more |

A few details that trip people up:

- `weekday` counts from `1` (Sunday) to `7` (Saturday). That is different from JavaScript's `Date.getDay()`, which counts from `0`.
- On iOS, a repeating `TIME_INTERVAL` must be at least 60 seconds, or it never fires.
- `hour` uses the 24-hour clock, so 8 PM is `20`.
- On Android you can add `channelId` to any trigger to pick the channel.
- Passing `trigger: null` shows the notification right away.

The content object can also hold `data`, a plain object that travels with the notification. You will use it to open the right screen on tap.

## Step 5: the daily reminder for HabitHop

Now the real feature. The code panel shows the whole `src/lib/reminders.ts`. The key function:

```ts
// src/lib/reminders.ts
const DAILY_ID = 'daily-reminder';

export async function scheduleDailyReminder(hour: number, minute: number) {
  if (!(await allowReminders())) return null;
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID);
  return Notifications.scheduleNotificationAsync({
    identifier: DAILY_ID,
    content: {
      title: 'Time to check in 🐇',
      body: 'Did you finish your habits today?',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: 'reminders',
    },
  });
}
```

You give the notification your own `identifier`, `'daily-reminder'`. Before scheduling, you cancel any notification with that ID. That way, when the user changes the time from 8 PM to 9 PM, they get one reminder, not two.

Hook it to a switch on the Settings screen (you met `Switch` in [Switch, ActivityIndicator and Other Handy Components](/courses/react-native/switch-and-activity-indicator)):

```tsx
// src/app/(tabs)/settings.tsx (part)
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { cancelDailyReminder, scheduleDailyReminder } from '@/lib/reminders';

export function ReminderRow() {
  const [on, setOn] = useState(false);

  async function toggle(value: boolean) {
    if (value) {
      const id = await scheduleDailyReminder(20, 0); // 8 PM
      setOn(id !== null); // stays off if permission was refused
    } else {
      await cancelDailyReminder();
      setOn(false);
    }
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text>Daily reminder at 8 PM</Text>
      <Switch value={on} onValueChange={toggle} />
    </View>
  );
}
```

In a real app you would save `on` and the chosen time with AsyncStorage so the switch remembers its state. The scheduled notification itself is saved by the system, so it keeps firing after the app restarts.

What you will see: turn the switch on, allow notifications, and you get a reminder every evening at 8 PM, even if HabitHop is closed.

On Android 14 and newer, apps can't schedule exact alarms by default, so a reminder may arrive a few minutes late while the phone saves battery. For a habit reminder that is fine.

## Step 6: open the right screen on tap

When the user taps a notification, your app opens. To go to a specific habit, put its ID in `data` when you schedule:

```ts
content: { title: `${habit.emoji} ${habit.name}`, data: { habitId: habit.id } },
```

Then read the tap in the root layout with the `useLastNotificationResponse` hook. A **notification response** is the user's interaction with a notification, such as a tap:

```tsx
// src/app/_layout.tsx (inside RootLayout)
const response = Notifications.useLastNotificationResponse();

useEffect(() => {
  if (!response) return;
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  const habitId = response.notification.request.content.data?.habitId;
  if (typeof habitId === 'string') {
    router.push({ pathname: '/habit/[id]', params: { id: habitId } });
  }
  Notifications.clearLastNotificationResponse();
}, [response]);
```

The hook also catches the tap that **launched** the app from a closed state, which a plain event listener can miss. `DEFAULT_ACTION_IDENTIFIER` means "the user tapped the notification itself" (not a custom action button). Clearing the response stops the app from jumping to the habit again on the next render. The route `/habit/[id]` is the details screen from [Dynamic Routes and Route Params](/courses/react-native/dynamic-routes).

If you want to react to a notification that arrives while the app is open (for example to refresh a list), use `Notifications.addNotificationReceivedListener(callback)` in an effect and call `.remove()` on the result in the cleanup.

## Checking what is scheduled

While building, it helps to see what is waiting:

```ts
const all = await Notifications.getAllScheduledNotificationsAsync();
console.log(all.map((r) => r.identifier));
```

```text
iOS  LOG  ["daily-reminder", "habit-h1"]
```

`cancelAllScheduledNotificationsAsync()` clears everything, which is handy for a "Reset" button.

## Common mistakes

**Testing push in Expo Go on Android.** The error says push "was removed from Expo Go with the release of SDK 53. Use a development build instead of Expo Go." Local reminders are fine in Expo Go. Push needs a development build.

**Using the old trigger shape.** Tutorials from a few years ago use `trigger: { seconds: 5 }` or `trigger: { hour: 20, minute: 0, repeats: true }`. In this version, TypeScript rejects that. Add a `type` from `SchedulableTriggerInputTypes`.

**Duplicate reminders.** Every call to `scheduleNotificationAsync` adds a new notification. If you schedule in a `useEffect` without cancelling first, you get one more reminder each time the screen opens. Use your own `identifier` and cancel before scheduling.

**A silent or hidden notification on Android.** If you created the channel with low importance, raising it later in code does nothing, because Android keeps the first settings. Use a new channel ID, or uninstall the app while developing.

## Quick recap

- Local notifications are scheduled on the phone and work in Expo Go. Push notifications need a development build on Android.
- `setNotificationHandler` controls what happens when a notification arrives while the app is open.
- On Android, create a channel with `setNotificationChannelAsync` before asking for permission.
- Ask with `getPermissionsAsync` and `requestPermissionsAsync` at a moment that makes sense.
- `scheduleNotificationAsync({ content, trigger })` with a `type` like `DAILY`, `WEEKLY` or `TIME_INTERVAL`. Use your own `identifier` and cancel before rescheduling.
- Put an ID in `data` and read taps with `useLastNotificationResponse` to open the right screen.

<code id="code-content" class="language-typescript">
// src/lib/reminders.ts
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Habit } from '@/types/habit';
const CHANNEL_ID = 'reminders';
const DAILY_ID = 'daily-reminder';
// Android 8+ needs a channel. Create it before asking for permission.
async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Habit reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
}
// Returns true if we are allowed to show notifications
export async function allowReminders(): Promise&lt;boolean&gt; {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false; // the user must use Settings now
  const answer = await Notifications.requestPermissionsAsync();
  return answer.granted;
}
// One reminder every day at hour:minute (24-hour clock)
export async function scheduleDailyReminder(hour: number, minute: number) {
  if (!(await allowReminders())) return null;
  // Remove the old one first, so there is never more than one
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID);
  return Notifications.scheduleNotificationAsync({
    identifier: DAILY_ID,
    content: {
      title: 'Time to check in 🐇',
      body: 'Did you finish your habits today?',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
}
// A reminder for one habit. Tapping it opens that habit.
export async function scheduleHabitReminder(habit: Habit, hour: number, minute: number) {
  if (!(await allowReminders())) return null;
  return Notifications.scheduleNotificationAsync({
    identifier: `habit-${habit.id}`,
    content: { title: `${habit.emoji} ${habit.name}`, data: { habitId: habit.id } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL_ID },
  });
}
export async function cancelDailyReminder() {
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID);
}
// Handy for a debug screen: what is waiting to fire?
export async function listReminders() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.map((r) =&gt; `${r.identifier}: ${r.content.title}`);
}
</code></pre>
