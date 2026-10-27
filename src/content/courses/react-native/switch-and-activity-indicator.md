---
publishDate: 2026-10-22T08:00
title: Switch, ActivityIndicator and Other Handy Components
slug: switch-and-activity-indicator
metadescription: 'Learn the React Native Switch for on/off settings, ActivityIndicator for loading spinners, the status bar, and a quick tour of other handy built-in components.'
updateDate: 2026-10-22T08:00
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'switch', 'activityindicator', 'core-components']
course: react-native
---

## Small components, big difference

Some components are small but appear in almost every app. An on/off toggle on a settings screen. A spinning wheel while something loads. The bar at the very top of the screen with the time and battery.

In this lesson you will learn:

- **`Switch`**, the native on/off toggle.
- **`ActivityIndicator`**, the native loading spinner.
- **`StatusBar`** from `expo-status-bar`, to make the top bar readable.
- A quick tour of other built-in components you will meet later in the course.

At the end you will build the first version of HabitHop's settings screen.

## Switch: an on/off toggle

A `Switch` is the round toggle you see in every phone's settings app. It holds a `true` or `false` value.

```tsx
// src/app/index.tsx
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

export default function Index() {
  const [reminders, setReminders] = useState(false);

  return (
    <View style={styles.screen}>
      <View style={styles.row}>
        <Text style={styles.label}>Daily reminder</Text>
        <Switch value={reminders} onValueChange={setReminders} />
      </View>
      <Text>Reminders are {reminders ? 'on' : 'off'}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, paddingTop: 80, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 17 },
});
```

Just like `TextInput`, a `Switch` is **controlled**:

- `value` is what the switch shows (`true` is on).
- `onValueChange` is called with the new boolean when the user flips it. Passing `setReminders` updates the state, and the switch follows.

If you pass `value` but never update it, the switch flicks back as soon as the user lets go. Your state is in charge, not the switch.

The row uses `flexDirection: 'row'` and `justifyContent: 'space-between'` to put the label on the left and the switch on the right. You will learn exactly how that works in [Layout with Flexbox](/courses/react-native/flexbox-layout).

### Switch looks different on each platform

The `Switch` is drawn by the operating system, so it matches each phone:

- On **iOS**, it is the familiar green pill with a white round thumb.
- On **Android**, it follows Material Design: a track with a round thumb, colored with the system accent color when on.

### Coloring a Switch

You can change the colors to match your app:

```tsx
<Switch
  value={reminders}
  onValueChange={setReminders}
  trackColor={{ false: '#D1D5DB', true: '#7C5CFC' }}
  thumbColor="#FFFFFF"
  ios_backgroundColor="#D1D5DB"
/>
```

- `trackColor` sets the track (the long part) color, separately for off (`false`) and on (`true`).
- `thumbColor` sets the round knob. On iOS, setting it removes the knob's small shadow.
- `ios_backgroundColor` is the background on iOS when the switch is off. Set it to the same color as `trackColor.false` so it looks consistent.

You may find old code using `onTintColor`, `tintColor` or `thumbTintColor`. Those are deprecated; use `trackColor` and `thumbColor`.

A `Switch` has a fixed native size. Setting `width` or `height` does not make it bigger. If you really need a larger one, use `transform: [{ scale: 1.2 }]` in its style.

Use `disabled` to show a switch that cannot be changed right now, for example when a setting depends on another one.

## ActivityIndicator: a loading spinner

When something takes time (loading data, saving, signing in), show the user that the app is working. `ActivityIndicator` draws the native spinning wheel:

```tsx
import { ActivityIndicator } from 'react-native';

<ActivityIndicator />
<ActivityIndicator size="large" color="#7C5CFC" />
```

- `size` can be `'small'` (the default, about 20 points tall) or `'large'` (about 36 points). On Android you can also pass a number.
- `color` sets the color. The default is gray on iOS and the system accent color on Android.
- `animating={false}` stops it. On iOS it also hides by default when stopped (`hidesWhenStopped`).

Most of the time you do not toggle `animating`. You simply show the spinner only while loading:

```tsx
{loading ? <ActivityIndicator size="large" /> : <Text>Loaded!</Text>}
```

If `? :` inside JSX is new to you, see [Conditional Rendering](/courses/react/conditional-rendering).

### A spinner inside a button

A common pattern is a "Save" button that turns into a spinner while saving. That also stops the user from tapping twice:

```tsx
<Pressable style={styles.button} onPress={save} disabled={saving}>
  {saving ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Save</Text>}
</Pressable>
```

Give the button a fixed `height` (or `minHeight`) so it does not jump in size when the text is swapped for the spinner. `Pressable` was covered in [Buttons and Pressable](/courses/react-native/buttons-and-pressable).

### A full-screen loader

For a whole screen that is still loading, center a large spinner:

```tsx
if (loading) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#7C5CFC" />
    </View>
  );
}
```

You will combine this with real data and error messages in [Loading States, Errors and Pull to Refresh](/courses/react-native/loading-and-refreshing).

## The status bar

The **status bar** is the strip at the very top of the phone with the time, signal and battery. Your app draws behind it, so its text must contrast with your background: dark text on a light screen, light text on a dark screen.

Expo projects include the `expo-status-bar` package for this:

```tsx
import { StatusBar } from 'expo-status-bar';

export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: '#1E1B4B' }}>
      <StatusBar style="light" />
      {/* screen content */}
    </View>
  );
}
```

`style` can be:

- `'auto'` (the default): dark text in light mode, light text in dark mode.
- `'light'`: light text, for dark backgrounds.
- `'dark'`: dark text, for light backgrounds.
- `'inverted'`: the opposite of `'auto'`.

`hidden` hides the status bar, which can be nice for a full-screen photo. You can put a `StatusBar` on any screen; the most recently mounted one wins. Keeping your content from going under the status bar (and the notch) is a separate job, covered in [Safe Areas: Notches, Status Bars and Home Bars](/courses/react-native/safe-areas).

React Native also has its own `StatusBar` component with similar props. In Expo apps, `expo-status-bar` is the usual choice because its `'auto'` style follows light and dark mode for you.

## A quick tour of other handy components

React Native ships a few more built-in components. You do not need them yet, but it helps to know they exist:

- **`KeyboardAvoidingView`**: moves content up when the keyboard opens. See [Handling the Keyboard](/courses/react-native/keyboard-handling).
- **`RefreshControl`**: the pull-to-refresh spinner for a `ScrollView`, from [Scrolling Content with ScrollView](/courses/react-native/scrollview).
- **`ImageBackground`**: like `Image`, but you can put children on top of it. See [Showing Images](/courses/react-native/images).
- **`TouchableOpacity`** and friends: older ways to make things tappable. Prefer `Pressable` in new code.
- **`SafeAreaView`** from `react-native`: deprecated. Use the one from `react-native-safe-area-context` instead, as the safe areas lesson explains.

## Putting it together in HabitHop

The code panel at the bottom is the first version of HabitHop's settings screen:

- Two `Switch` rows: "Daily reminder" and "Show streaks". The colors match the HabitHop purple.
- A short "We will remind you at 8:00" note that only appears while the reminder switch is on.
- A "Save settings" button that shows an `ActivityIndicator` for one second (pretend saving), then shows "Saved!".
- An `expo-status-bar` with `style="dark"` because the screen is light.

These settings only live in memory for now. You will save them on the phone in [Saving Data on the Phone with AsyncStorage](/courses/react-native/async-storage), and the reminder switch will schedule a real notification in [Local Notifications and Reminders](/courses/react-native/notifications).

## Common mistakes

**1. The switch flicks back.** You wrote `<Switch value={reminders} />` without `onValueChange`, or with a handler that does not update state. Add `onValueChange={setReminders}`.

**2. Using `onChange` and getting an object.** `onChange` receives an event object, not a boolean. Use `onValueChange` to get `true` or `false` directly.

**3. Status bar text you cannot read.** White time and battery icons on a white screen. Add `<StatusBar style="dark" />` (or `"auto"` and a background that follows dark mode).

**4. A spinner that never stops.** You set `loading` to `true` but forgot to set it back to `false` when an error happens. Use `try` and `finally`, so it always resets. See [Error Handling with try and catch](/courses/javascript/error-handling-try-catch).

## Quick recap

- `Switch` is a controlled on/off toggle: `value` plus `onValueChange`.
- Color it with `trackColor`, `thumbColor` and `ios_backgroundColor`; you cannot resize it with `width`.
- `ActivityIndicator` is the native spinner; `size` is `'small'` or `'large'` (or a number on Android), and `color` sets its color.
- Show the spinner only while loading, and disable buttons while saving.
- `StatusBar` from `expo-status-bar` sets the top bar text to `'light'`, `'dark'` or `'auto'`.
- `KeyboardAvoidingView`, `RefreshControl` and `ImageBackground` are other built-ins you will use later.

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
// First version of the HabitHop settings screen
const purple = '#7C5CFC';
export default function Index() {
  const [reminders, setReminders] = useState(false);
  const [streaks, setStreaks] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await new Promise((resolve) =&gt; setTimeout(resolve, 1000)); // pretend to save
      setSaved(true);
    } finally {
      setSaving(false); // always stop the spinner
    }
  }
  return (
    &lt;View style={styles.screen}&gt;
      &lt;StatusBar style="dark" /&gt;
      &lt;Text style={styles.title}&gt;Settings&lt;/Text&gt;
      &lt;View style={styles.row}&gt;
        &lt;Text style={styles.label}&gt;Daily reminder&lt;/Text&gt;
        &lt;Switch value={reminders} onValueChange={setReminders} trackColor={{ false: '#D1D5DB', true: purple }} ios_backgroundColor="#D1D5DB" /&gt;
      &lt;/View&gt;
      {reminders &amp;&amp; &lt;Text style={styles.note}&gt;We will remind you at 8:00 every morning.&lt;/Text&gt;}
      &lt;View style={styles.row}&gt;
        &lt;Text style={styles.label}&gt;Show streaks&lt;/Text&gt;
        &lt;Switch value={streaks} onValueChange={setStreaks} trackColor={{ false: '#D1D5DB', true: purple }} ios_backgroundColor="#D1D5DB" /&gt;
      &lt;/View&gt;
      &lt;Pressable style={styles.button} onPress={save} disabled={saving}&gt;
        {saving ? &lt;ActivityIndicator color="white" /&gt; : &lt;Text style={styles.buttonText}&gt;Save settings&lt;/Text&gt;}
      &lt;/Pressable&gt;
      {saved &amp;&amp; &lt;Text style={styles.note}&gt;Saved!&lt;/Text&gt;}
    &lt;/View&gt;
  );
}
// ---
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, paddingTop: 80, gap: 16, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 17 },
  note: { color: '#666' },
  button: { height: 50, borderRadius: 12, backgroundColor: purple, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
</code></pre>
