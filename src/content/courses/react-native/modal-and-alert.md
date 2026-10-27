---
publishDate: 2026-10-22T06:30
title: Modals and Alerts
slug: modal-and-alert
metadescription: 'Learn how to show pop-ups in React Native: native Alert dialogs with buttons, confirm before deleting, and the Modal component for sheets and custom pop-ups.'
updateDate: 2026-10-22T06:30
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'modal', 'alert', 'core-components']
course: react-native
---

## Things that pop up

Sometimes you need to interrupt the user for a moment: "Delete this habit?", "Saved!", or a small form that slides up from the bottom. React Native gives you two tools for this:

- **`Alert`**: the phone's own system dialog. A title, a message and a few buttons. You cannot change how it looks, but it takes one line of code and feels 100% native.
- **`Modal`**: a component that shows any content you want on top of the current screen. You design it yourself.

In this lesson you will use `Alert` to confirm deleting a habit in HabitHop, and `Modal` to build a small "new habit" sheet.

## Alert: the quickest pop-up

`Alert` is not a component. You do not put it in your JSX. You call a function, usually from a button press:

```tsx
import { Alert, Button } from 'react-native';

<Button title="Save" onPress={() => Alert.alert('Saved!', 'Your habit was saved.')} />
```

`Alert.alert(title, message)` shows a dialog with an "OK" button. Tapping OK closes it. That is all you need for a simple message.

The dialog looks different on each platform, because it is the real system dialog: a rounded box in the middle of the screen on iOS, a Material-style card on Android.

### Alert buttons

The third argument is an array of buttons. Each button is an object with a `text` and an optional `onPress` function:

```tsx
Alert.alert('Delete habit?', 'This removes "Drink water" and its history.', [
  { text: 'Cancel', style: 'cancel' },
  { text: 'Delete', style: 'destructive', onPress: () => deleteHabit('h1') },
]);
```

When a button is tapped, its `onPress` runs (if it has one) and the dialog closes. Here "Cancel" has no `onPress`, so it just closes the dialog.

The `style` field is a hint for iOS:

- `'cancel'`: the "safe" choice. iOS shows it in bold and positions it on its own.
- `'destructive'`: something that deletes or cannot be undone. iOS shows it in red.
- `'default'`: a normal button.

Android ignores `style`. It decides button positions by order instead, and it allows **at most three buttons**. With two buttons, Android treats the first as the "negative" one (like Cancel) and the second as the "positive" one (like OK), so list Cancel first.

### Confirm before deleting

This "are you sure?" pattern is the most common use of `Alert`. Put it in a small function so the button stays clean:

```tsx
function confirmDelete(habit: Habit) {
  Alert.alert(`Delete ${habit.name}?`, 'You will lose its streak. This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => deleteHabit(habit.id) },
  ]);
}
```

Note that `Alert.alert` does **not** wait. It shows the dialog and returns immediately. Any code you write on the next line runs right away, before the user has tapped anything. Code that should only run after a choice belongs inside the button's `onPress`.

### Tapping outside on Android

On Android, users can close an alert by tapping outside it or pressing the back button, but only if you allow it with the fourth argument:

```tsx
Alert.alert('Reminder', 'Have you had water today?', [{ text: 'Yes!' }], {
  cancelable: true,
  onDismiss: () => console.log('Closed without choosing'),
});
```

`cancelable` and `onDismiss` only affect Android. On iOS the user must tap a button.

### Platform notes

- **`Alert.prompt`** shows a dialog with a text box, but it only works on **iOS**. On Android, build your own with a `Modal` and a `TextInput` (like the sheet below).
- On the **web**, `Alert.alert` does nothing at all. If you also run your app in a browser, use a `Modal` for anything important.

## Modal: your own pop-up

When you need more than a title and buttons, use **`Modal`**. Anything you put inside a `Modal` is drawn on top of the whole app, in a separate native layer.

```tsx
// src/app/index.tsx
import { useState } from 'react';
import { Button, Modal, Text, View } from 'react-native';

export default function Index() {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Button title="Show tips" onPress={() => setOpen(true)} />

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
          <Text style={{ fontSize: 22 }}>Small habits win. Start with 2 minutes a day.</Text>
          <Button title="Close" onPress={() => setOpen(false)} />
        </View>
      </Modal>
    </View>
  );
}
```

The `Modal` is always in your JSX. Whether it is shown depends on the `visible` prop, which you control with state. This is the same idea as a controlled input: your state decides, the component only shows it.

The important props:

- `visible`: `true` shows the modal, `false` hides it.
- `animationType`: `'slide'` (slides up from the bottom), `'fade'` or `'none'` (the default).
- `onRequestClose`: called when the user tries to close the modal with the system: the Android **back button** or back gesture, or a swipe down on iOS if you allow it. Always pass it and set `visible` to `false` inside. If you forget, the Android back button does nothing while the modal is open, which feels broken.

Notice that the modal does **not** close by itself. Even the "Close" button just sets the state; the `Modal` follows.

## A bottom sheet with a dimmed background

By default a `Modal` covers the whole screen with a white background. For a smaller pop-up, set `transparent`. Then the modal's background is see-through, and you draw your own dark overlay and a card:

```tsx
<Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
  <View style={styles.backdrop}>
    <View style={styles.sheet}>
      <Text style={styles.title}>New habit</Text>
      {/* form goes here */}
    </View>
  </View>
</Modal>
```

```tsx
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: 'white', padding: 24, paddingBottom: 40, gap: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  title: { fontSize: 22, fontWeight: 'bold' },
});
```

- The **backdrop** fills the screen (`flex: 1`) with a 40% black, so the app behind looks dimmed.
- `justifyContent: 'flex-end'` pushes the sheet to the bottom. Use `'center'` for a centered dialog instead.
- The sheet has rounded top corners, like the sheets in many apps.

### Closing when tapping the backdrop

Users expect a tap on the dark area to close the sheet. Make the backdrop a `Pressable`, and stop taps on the sheet itself from reaching it by making the sheet a `Pressable` too (with no `onPress`):

```tsx
<Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
  <Pressable style={styles.sheet}>{/* form */}</Pressable>
</Pressable>
```

A tap on the inner `Pressable` is "handled" by it, so the outer one does not fire. A tap on the dark part goes to the outer one and closes the sheet.

## iOS page sheets

iOS has a built-in "card" style where the screen behind shrinks a bit and the modal slides up as a sheet. Ask for it with `presentationStyle`:

```tsx
<Modal
  visible={open}
  animationType="slide"
  presentationStyle="pageSheet"
  allowSwipeDismissal
  onRequestClose={() => setOpen(false)}
>
  {/* content */}
</Modal>
```

`presentationStyle` and `allowSwipeDismissal` only work on **iOS**; Android shows a normal full-screen modal. `allowSwipeDismissal` lets the user swipe the sheet down to close it, and it needs `onRequestClose` (React Native prints a warning if it is missing).

## Modal component or modal screen?

A `Modal` is great for small, local pop-ups that belong to one screen. When the pop-up is really a whole screen of its own (like HabitHop's full "New habit" form), Expo Router can open a **route** as a modal instead. That gives you a URL for it, a proper header and native sheet presentations on both platforms. You will build that in [Modal Screens](/courses/react-native/modal-screens), once you know [How Expo Router Works](/courses/react-native/expo-router-basics).

## Putting it together in HabitHop

The code panel at the bottom has a small HabitHop screen with both tools:

- A list of habit names. A long press on a habit asks "Delete Drink water?" with an `Alert`, and only deletes after "Delete" is tapped.
- An "Add habit" button that opens a `Modal` with a `TextInput` (from [Getting Text from Users with TextInput](/courses/react-native/text-input)). Tapping "Add" adds the habit and closes it; tapping the dark backdrop or pressing back on Android just closes it.

This time the card is centered (`justifyContent: 'center'`) instead of sitting at the bottom. Why? The text field gets focus right away (`autoFocus`), so the keyboard opens, and a sheet at the very bottom would be hidden behind the keyboard. A centered card stays visible on most phones. You will learn the proper tools for keyboards in [Handling the Keyboard](/courses/react-native/keyboard-handling).

## Common mistakes

**1. Putting `<Alert>` in JSX.** You write `<Alert title="Hi" />` and get a TypeScript error (`'Alert' cannot be used as a JSX component`). `Alert` is an API, not a component. Call `Alert.alert(...)` from a handler.

**2. Expecting `Alert.alert` to wait.** You write `Alert.alert('Delete?', ...)` and then `deleteHabit(id)` on the next line. The habit is deleted before the user even sees the question. Put the action inside the button's `onPress`.

**3. The modal will not close on Android.** Pressing the back button does nothing. You forgot `onRequestClose`, or it does not set `visible` to `false`.

**4. The whole screen turns white.** You wanted a small centered pop-up but forgot `transparent`. Without it, the modal paints a full-screen background.

## Quick recap

- `Alert.alert(title, message, buttons, options)` shows the native system dialog.
- Button `style` (`cancel`, `destructive`) is for iOS; Android allows up to three buttons and orders them itself.
- `Alert.alert` does not wait: put follow-up code inside a button's `onPress`.
- `Alert.prompt` is iOS only, and `Alert` does nothing on the web.
- `Modal` shows your own content on top of the app; `visible` (from state) shows or hides it.
- Always pass `onRequestClose` so the Android back button closes the modal.
- `transparent` plus a dark backdrop `View` gives you bottom sheets and centered dialogs.

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// Alert to confirm a delete, Modal to add a habit
export default function Index() {
  const [habits, setHabits] = useState(['Drink water', 'Read 10 pages']);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  function confirmDelete(habit: string) {
    Alert.alert(`Delete ${habit}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () =&gt; setHabits((c) =&gt; c.filter((h) =&gt; h !== habit)) },
    ]);
  }
  function add() {
    if (!name.trim()) return;
    setHabits((c) =&gt; [...c, name.trim()]);
    setName('');
    setOpen(false);
  }
  return (
    &lt;View style={styles.screen}&gt;
      {habits.map((habit) =&gt; (
        &lt;Pressable key={habit} style={styles.row} onLongPress={() =&gt; confirmDelete(habit)}&gt;
          &lt;Text style={styles.rowText}&gt;{habit}&lt;/Text&gt;
        &lt;/Pressable&gt;
      ))}
      &lt;Text style={styles.hint}&gt;Long press a habit to delete it&lt;/Text&gt;
      &lt;Pressable style={styles.button} onPress={() =&gt; setOpen(true)}&gt;
        &lt;Text style={styles.buttonText}&gt;Add habit&lt;/Text&gt;
      &lt;/Pressable&gt;
      &lt;Modal visible={open} transparent animationType="fade" onRequestClose={() =&gt; setOpen(false)}&gt;
        &lt;Pressable style={styles.backdrop} onPress={() =&gt; setOpen(false)}&gt;
          &lt;Pressable style={styles.sheet}&gt;
            &lt;Text style={styles.title}&gt;New habit&lt;/Text&gt;
            &lt;TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Meditate" autoFocus /&gt;
            &lt;Pressable style={styles.button} onPress={add}&gt;
              &lt;Text style={styles.buttonText}&gt;Add&lt;/Text&gt;
            &lt;/Pressable&gt;
          &lt;/Pressable&gt;
        &lt;/Pressable&gt;
      &lt;/Modal&gt;
    &lt;/View&gt;
  );
}
// ---
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, paddingTop: 80, gap: 12 },
  row: { padding: 16, borderRadius: 12, backgroundColor: '#F3F0FF' },
  rowText: { fontSize: 17 },
  hint: { color: '#888', textAlign: 'center' },
  button: { backgroundColor: '#7C5CFC', padding: 14, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: 'white', padding: 24, gap: 16, borderRadius: 24 },
  title: { fontSize: 22, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
});
</code></pre>
