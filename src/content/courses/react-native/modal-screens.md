---
publishDate: 2026-10-23T14:00
title: Modal Screens
slug: modal-screens
metadescription: 'Turn the HabitHop new habit form into a modal route with presentation modal or formSheet, close it with router.back and learn how iOS and Android differ.'
updateDate: 2026-10-23T14:00
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'expo-router', 'navigation', 'modal']
course: react-native
---

## What a modal screen is

A **modal** is a screen that slides up from the bottom and sits *on top of* the app for a short task: write a message, pick a photo, add a habit. When the task is done (or cancelled), it goes away and you are back exactly where you were.

On iOS you know it as the card that slides up and can be swiped down to close, with the previous screen peeking out behind it at the top. On Android it is a screen that slides or fades in over the current one and closes with the back button or gesture.

In [Modals and Alerts](/courses/react-native/modal-and-alert) you used React Native's `Modal` component, which shows a popup *inside* the current screen. A modal **screen** is different: it is a real route, with its own file and URL. That gives you a back button and gesture that just work, a header, deep links to it, and typed `Link`s.

HabitHop's "Add habit" form is the perfect candidate. It lives at `src/app/new-habit.tsx`, and the URL is `/new-habit`.

## Step 1: create the screen

The form is a normal screen, using the `useState`, `TextInput` and validation skills from [Building Forms and Checking Input](/courses/react-native/forms-and-validation). It reads `addHabit` from the context and closes itself after saving:

```tsx
// src/app/new-habit.tsx
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, TextInput, View } from 'react-native';
import { habitColors } from '@/constants/colors';
import { useHabits } from '@/context/HabitsContext';

export default function NewHabitScreen() {
  const { addHabit } = useHabits();
  const router = useRouter();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✅');
  const [color, setColor] = useState(habitColors[0]);

  function save() {
    if (name.trim() === '') return;
    addHabit({ name: name.trim(), emoji, color });
    router.back();
  }
  // ...inputs and a "Save habit" button that calls save()
}
```

The full file, with the color picker, is in the code panel.

The file is in `src/app/`, directly under the root `Stack`, not inside `(tabs)`. That matters: a modal must belong to a stack, and putting it in the root stack lets it cover everything, tab bar included. (See [Nested Layouts and Route Groups](/courses/react-native/layouts-and-route-groups) for why the folder decides this.)

## Step 2: present it as a modal

Right now `/new-habit` would slide in from the side like any other stack screen. To make it a modal, set the `presentation` option in the root layout:

```tsx
// src/app/_layout.tsx
<Stack screenOptions={{ headerTintColor: '#7C5CFC' }}>
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen name="habit/[id]" options={{ title: 'Habit' }} />
  <Stack.Screen
    name="new-habit"
    options={{ presentation: 'modal', title: 'New habit' }}
  />
</Stack>
```

That one option changes everything about how the screen appears.

## Step 3: open it

Opening a modal is just navigating to its route. On the Today screen, add a button with `Link asChild`, as in [Links and Navigating in Code](/courses/react-native/links-and-navigating):

```tsx
// src/app/(tabs)/index.tsx
<Link href="/new-habit" asChild>
  <Pressable style={{ padding: 16, borderRadius: 12, backgroundColor: '#7C5CFC' }}>
    <Text style={{ color: 'white', textAlign: 'center' }}>Add habit</Text>
  </Pressable>
</Link>
```

What you will see:

- **iOS**: the form slides up as a card. The Today screen shrinks slightly behind it and its top edge stays visible. Swipe the card down to close it.
- **Android**: the form slides up and covers the whole screen. Close it with the system back button or back gesture.
- Type "Stretch", pick a color, tap "Save habit". The modal closes and "Stretch" is at the bottom of the Today list.

## Closing a modal

There are a few ways to close a modal from code. All of them work here:

| Call | Effect |
| --- | --- |
| `router.back()` | Goes back one screen. For a modal, that closes it. |
| `router.dismiss()` | Closes the current screen in the stack. Reads nicely for modals. |
| `router.dismissTo('/')` | Closes screens until it reaches `/`. Useful if the modal opened more screens. |

The user can also close it without your code: swipe down on iOS, back button on Android. So never rely on "the user will press Save" to clean things up.

### A Cancel button

On iOS, many modals have a "Cancel" button in the top left. Add it from inside the screen with `Stack.Screen` (you met this trick in [Stack Navigation and Headers](/courses/react-native/stack-navigation)):

```tsx
// src/app/new-habit.tsx
import { Stack, useRouter } from 'expo-router';
import { Button } from 'react-native';

<Stack.Screen
  options={{
    headerLeft: () => <Button title="Cancel" onPress={() => router.dismiss()} />,
  }}
/>
```

Android users usually rely on the back button, so this is mostly for iOS. It does no harm on Android.

## All the presentation styles

`presentation` accepts several values. Each one is a different native style:

| Value | iOS | Android |
| --- | --- | --- |
| `'card'` (default) | Slides in from the right | System push animation |
| `'modal'` | Card sheet, swipe down to close | Full screen modal |
| `'formSheet'` | Sheet that can stop at set heights | Material bottom sheet |
| `'fullScreenModal'` | Covers everything, no swipe to close | Full screen modal |
| `'transparentModal'` | Screen below stays visible | Screen below stays visible |

### formSheet: a half-height sheet

A **form sheet** can stop at heights you choose, like the sheets in Apple Maps. The heights are called **detents**: fractions of the screen height from 0 to 1.

```tsx
// src/app/_layout.tsx
<Stack.Screen
  name="new-habit"
  options={{
    presentation: 'formSheet',
    sheetAllowedDetents: [0.6, 1],
    sheetGrabberVisible: true,
    sheetCornerRadius: 24,
    headerShown: false,
  }}
/>
```

- `sheetAllowedDetents: [0.6, 1]`: the sheet opens at 60% of the screen and can be dragged up to full height. The list must go from small to big. Android supports up to three values.
- `sheetGrabberVisible: true`: the small handle bar at the top (iOS only).
- `sheetCornerRadius`: how round the top corners are.
- `headerShown: false`: sheets usually look cleaner without a navigation header. Put a title inside the content instead.

For HabitHop either works. The short form fits nicely in a sheet, and the user still sees the habit list behind it. Pick `'modal'` if you prefer a simple full card.

### fullScreenModal: no accidental closing

`'fullScreenModal'` cannot be swiped away on iOS. Use it when closing by accident would lose real work, like a long form or a camera screen, and give the user a clear Close button.

## The keyboard in a modal

The new habit form has text inputs, so the keyboard appears. In a full height modal that usually works fine. In a short form sheet, the keyboard can cover the Save button. The tools from [Handling the Keyboard](/courses/react-native/keyboard-handling) apply here as well: put the content in a `ScrollView` with `keyboardShouldPersistTaps="handled"` so a tap on Save works while the keyboard is open, and test on both platforms.

## Common mistakes

**Putting the modal inside (tabs).** If `new-habit.tsx` is in `src/app/(tabs)/`, it becomes a tab, and `presentation` options in the root layout do nothing for it. Modals belong in a stack, usually the root one.

**Setting presentation on the wrong Stack.Screen name.** The `name` must match the file: `new-habit`, not `newHabit` or `/new-habit`. A typo means the screen opens as a normal pushed card, plus a "No route named" warning in the terminal.

**Saving after closing.** If you call `router.back()` before `addHabit(...)`, it usually still works, but the screen is already leaving. Save first, then close.

**Expecting the swipe to close on Android.** Android modals do not have the iOS swipe-down gesture (form sheets can be dragged down). Make sure there is always a way back: the system back button, or your own Cancel button.

## Quick recap

- A modal screen is a normal route file (like `src/app/new-habit.tsx`) shown with `presentation: 'modal'`.
- Put modal routes in the root `Stack`, so they cover the tab bar.
- Open it like any route: `<Link href="/new-habit">` or `router.push('/new-habit')`.
- Close it with `router.back()` or `router.dismiss()`. Users can also swipe down (iOS) or press back (Android).
- `formSheet` with `sheetAllowedDetents` gives a sheet that stops at set heights. `fullScreenModal` cannot be swiped away on iOS.
- iOS and Android draw modals differently. Test both.

<code id="code-content" class="language-tsx">
// src/app/new-habit.tsx
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, Pressable, Text, TextInput, View } from 'react-native';
import { habitColors } from '@/constants/colors';
import { useHabits } from '@/context/HabitsContext';
export default function NewHabitScreen() {
  const { addHabit } = useHabits();
  const router = useRouter();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✅');
  const [color, setColor] = useState(habitColors[0]);
  function save() {
    if (name.trim() === '') return;
    addHabit({ name: name.trim(), emoji, color });
    router.back();
  }
  return (
    &lt;View style={{ flex: 1, padding: 24, gap: 16 }}&gt;
      &lt;TextInput placeholder="Habit name" value={name} onChangeText={setName} style={{ borderWidth: 1, borderRadius: 8, padding: 12 }} /&gt;
      &lt;TextInput placeholder="Emoji" value={emoji} onChangeText={setEmoji} style={{ borderWidth: 1, borderRadius: 8, padding: 12 }} /&gt;
      &lt;View style={{ flexDirection: 'row', gap: 12 }}&gt;
        {habitColors.map((c) =&gt; (
          &lt;Pressable key={c} onPress={() =&gt; setColor(c)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: color === c ? 3 : 0 }} /&gt;
        ))}
      &lt;/View&gt;
      &lt;Button title="Save habit" onPress={save} /&gt;
      &lt;Text style={{ color: 'gray' }}&gt;Swipe down to cancel.&lt;/Text&gt;
    &lt;/View&gt;
  );
}
</code></pre>
