---
publishDate: 2026-10-22T23:00
title: Handling the Keyboard
slug: keyboard-handling
metadescription: 'Stop the keyboard from hiding your inputs in React Native with KeyboardAvoidingView, keyboardShouldPersistTaps, Keyboard.dismiss and return key handling.'
updateDate: 2026-10-22T23:00
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'keyboard', 'forms', 'textinput']
course: react-native
---

## The keyboard is in the way

On a computer, the keyboard sits on your desk. On a phone it slides up and covers almost half the screen. That causes some classic problems you probably noticed with the HabitHop form from [Building Forms and Checking Input](/courses/react-native/forms-and-validation):

- You tap the name field at the bottom of the screen and the keyboard covers it. You type blind.
- The "Save habit" button is hidden under the keyboard.
- You tap the save button while the keyboard is open, and the first tap only closes the keyboard. You have to tap again.
- There is no obvious way to close the keyboard.

Every app with a text field has to deal with these. In this lesson you will fix all of them with tools that come with React Native:

- `KeyboardAvoidingView` to move content out of the way
- `keyboardShouldPersistTaps` so buttons work on the first tap
- `Keyboard.dismiss()` and "tap outside to close"
- the return key, to jump between fields or submit
- keyboard events, to react when the keyboard shows or hides

## How the keyboard covers content

When the keyboard opens, your app's screen does **not** get smaller by itself. The keyboard is drawn on top of your app. iOS has always worked this way. On Android, apps built with this version of Expo draw **edge to edge** (behind the system bars, see [Safe Areas](/courses/react-native/safe-areas)), so you should treat Android the same way: assume the keyboard covers your content, and move the content yourself.

## KeyboardAvoidingView

**`KeyboardAvoidingView`** is a `View` that listens for the keyboard and moves or shrinks itself so its content stays visible. Wrap your screen content in it:

```tsx
// src/app/index.tsx (part)
import { KeyboardAvoidingView } from 'react-native';

<KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
  {/* your form */}
</KeyboardAvoidingView>
```

The `behavior` prop decides **how** it gets out of the way:

- `"padding"`: adds bottom padding equal to the part of the view the keyboard covers. Your content gets pushed up. This is the one to start with, and it works well on both iOS and Android.
- `"height"`: makes the view shorter by that amount.
- `"position"`: moves the whole view up.

Many older tutorials use `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` or even no behavior on Android. That advice comes from the time when Android resized apps for you. Start with `"padding"` everywhere, and **always test on a real Android device or emulator too**, because keyboards differ between phones.

Two more things you need:

- `style={{ flex: 1 }}`: without it, the view is only as tall as its content and has nothing to shrink.
- It should be **high up** in your screen, around everything that should move. If it only wraps the text field, only the text field moves.

### keyboardVerticalOffset

`KeyboardAvoidingView` measures where it sits on the screen and where the keyboard starts. If something above it is not part of its measurement, such as a Stack header, the math can be off by the header height. You then see the content stop a bit too low, still under the keyboard. `keyboardVerticalOffset` fixes that by adding extra distance:

```tsx
// src/app/new-habit.tsx (part)
<KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={100}>
```

Do not guess numbers wildly. Try your screen, and only add an offset if the content does not clear the keyboard. You will meet Stack headers in [Stack Navigation and Headers](/courses/react-native/stack-navigation).

## Make it scroll

If the form is taller than the space above the keyboard, moving it up is not enough: the top would go off screen. Put a `ScrollView` inside the `KeyboardAvoidingView`. Then the user can scroll to any field:

```tsx
// src/app/index.tsx (part)
<KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
  <ScrollView
    contentContainerStyle={{ padding: 16, gap: 12 }}
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode="on-drag">
    {/* habits and the form */}
  </ScrollView>
</KeyboardAvoidingView>
```

Two props on the `ScrollView` matter a lot here (a `FlatList` has them too). You learned about scrolling in [Scrolling Content with ScrollView](/courses/react-native/scrollview).

### keyboardShouldPersistTaps

This is the fix for "the first tap only closes the keyboard". By default (`"never"`), when the keyboard is open, a tap inside a scroll view closes the keyboard and the tap is **thrown away**. Your save button never hears it.

- `"handled"`: if the tap lands on something that handles it (a button, a Pressable, a chip), the button gets the tap and the keyboard stays open. Tapping empty space still closes the keyboard. **This is the one you want almost always.**
- `"always"`: the keyboard never closes from taps.
- `"never"`: the default described above.

### keyboardDismissMode

This decides whether scrolling closes the keyboard:

- `"on-drag"`: start scrolling and the keyboard slides away. Feels natural for long forms and lists.
- `"interactive"`: iOS only. The keyboard follows your finger as you drag down, like in the Messages app. On Android it acts like `"none"`.
- `"none"`: the default, scrolling does nothing to the keyboard.

## Closing the keyboard yourself

The `Keyboard` module from `react-native` has a `dismiss()` function that closes the keyboard and removes focus from the current field:

```tsx
// src/components/HabitForm.tsx (part)
import { Keyboard } from 'react-native';

function handleSave() {
  Keyboard.dismiss();
  // ...check and save
}
```

Closing the keyboard after saving is a nice touch: the user sees the new habit appear in the list instead of a keyboard.

### Tap outside to close

On screens without a `ScrollView`, users expect a tap on empty space to close the keyboard. Wrap the screen in a `Pressable` that calls `Keyboard.dismiss`:

```tsx
// src/components/DismissKeyboard.tsx
import type { ReactNode } from 'react';
import { Keyboard, Pressable } from 'react-native';

export function DismissKeyboard({ children }: { children: ReactNode }) {
  return (
    <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss} accessible={false}>
      {children}
    </Pressable>
  );
}
```

`accessible={false}` keeps screen readers from announcing the whole screen as one big button. Buttons and fields inside still work normally, because the innermost element that handles a tap wins. (You may also see `TouchableWithoutFeedback` used for this in older code. It does the same job.)

## The return key

The key in the bottom right corner of the keyboard is the **return key**. You can change its label and what it does:

```tsx
// src/components/HabitNoteFields.tsx
import { useRef } from 'react';
import { Keyboard, TextInput, View, type TextInputInstance } from 'react-native';

export function HabitNoteFields() {
  const noteRef = useRef<TextInputInstance>(null);

  return (
    <View>
      <TextInput
        placeholder="Habit name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => noteRef.current?.focus()}
      />
      <TextInput
        ref={noteRef}
        placeholder="A short note"
        returnKeyType="done"
        onSubmitEditing={() => Keyboard.dismiss()}
      />
    </View>
  );
}
```

- `returnKeyType` sets the label: `"next"`, `"done"`, `"go"`, `"search"`, `"send"` and more. Users read it as a promise of what will happen, so make it true.
- `onSubmitEditing` runs when the return key is pressed.
- A **ref** (created with `useRef`) points at the second field, so the first one can call `noteRef.current?.focus()` to jump there. The type is `TextInputInstance`, which React Native exports for exactly this. The [TextInput lesson](/courses/react-native/text-input) explains refs in more detail.
- `submitBehavior="submit"` keeps the keyboard open while you jump to the next field. Without it the keyboard closes and pops up again, which looks jumpy.

For HabitHop's one-field form, you can make the return key save the habit: `returnKeyType="done"` and `onSubmitEditing={handleSave}`. Then Mia can type a name and press "done" without reaching for the button.

### Picking the right keyboard

The fastest keyboard fix is showing the right keyboard in the first place. Quick reminders from the TextInput lesson:

```tsx
// src/components/ContactFields.tsx (part)
<TextInput keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
<TextInput keyboardType="number-pad" />
```

`autoFocus` opens the keyboard as soon as the screen appears. Use it on screens whose only job is typing, like the "new habit" modal you will build later, and nowhere else. A keyboard that pops up uninvited is annoying.

## Listening to the keyboard

Sometimes you want to change the layout when the keyboard is open, for example hide a footer tip to save space. `Keyboard.addListener` tells you when it shows and hides. Wrap it in a small custom hook:

```tsx
// src/hooks/use-keyboard-visible.ts
import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return visible;
}
```

The effect starts listening when the component appears, and the **cleanup function** (the one returned from the effect) stops listening when it goes away. You will learn exactly how this works in the next lesson, [Effects and the App Lifecycle](/courses/react-native/effects-and-app-state).

A note on events: iOS also sends `keyboardWillShow` and `keyboardWillHide`, slightly **before** the keyboard moves, which lets you animate in sync. Android does **not** send the "will" events at all, only the "did" ones. If you use `keyboardWillShow` only, your code silently does nothing on Android. Use the "did" events when you want the same behavior on both.

## Putting it together in HabitHop

The code panel shows the Today screen with everything working together:

1. `SafeAreaView` keeps it clear of the notch.
2. `KeyboardAvoidingView` with `behavior="padding"` pushes the content up when the keyboard opens.
3. A `ScrollView` with `keyboardShouldPersistTaps="handled"` lets the emoji chips and "Save habit" button work on the first tap, and `keyboardDismissMode="on-drag"` lets the user swipe the keyboard away.
4. The habit cards and the `HabitForm` sit inside the scroll view.

Try it on a phone: tap the name field. The keyboard slides up and the field moves above it. Type a name, tap an emoji (it selects on the first tap, and the keyboard stays), then tap "Save habit". Drag the list down and the keyboard goes away.

## Common mistakes

**1. KeyboardAvoidingView does nothing.** The content still hides. Usually it has no `flex: 1`, or it only wraps a small part of the screen. Fix: give it `style={{ flex: 1 }}` and put it around the whole screen content.

**2. Buttons need two taps.** The first tap only closes the keyboard. Fix: add `keyboardShouldPersistTaps="handled"` to the `ScrollView` or `FlatList` that contains the button.

**3. Wrong ref type.** You write `useRef<TextInput>(null)` (as in older tutorials) and TypeScript says:

```text
Property 'focus' does not exist on type 'TextInputType'.
```

Fix: use `useRef<TextInputInstance>(null)`, importing the type from `react-native`.

**4. A keyboard listener that only works on iOS.** You listen to `keyboardWillShow`, and nothing happens on Android. Fix: listen to `keyboardDidShow` and `keyboardDidHide`.

## Quick recap

- The keyboard covers your app on both iOS and Android. Moving content is your job.
- `KeyboardAvoidingView` with `behavior="padding"` and `flex: 1`, around the whole screen, moves content up. Use `keyboardVerticalOffset` only if a header throws the math off.
- Put a `ScrollView` inside it, with `keyboardShouldPersistTaps="handled"` so buttons work on the first tap, and `keyboardDismissMode="on-drag"` to swipe the keyboard away.
- `Keyboard.dismiss()` closes the keyboard. A `Pressable` around the screen gives "tap outside to close".
- `returnKeyType`, `onSubmitEditing`, a `TextInputInstance` ref and `submitBehavior="submit"` let users move between fields.
- `Keyboard.addListener('keyboardDidShow' | 'keyboardDidHide')` works on both platforms. The "will" events are iOS only.

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HabitCard } from '@/components/HabitCard';
import { HabitForm } from '@/components/HabitForm';
import { todayKey } from '@/lib/dates';
import type { Habit } from '@/types/habit';
export default function TodayScreen() {
  const [habits, setHabits] = useState&lt;Habit[]&gt;([]);
  function addHabit(values: { name: string; emoji: string; color: string }) {
    const habit: Habit = { id: Date.now().toString(), createdAt: new Date().toISOString(), doneDates: [], ...values };
    setHabits((current) =&gt; [...current, habit]);
  }
  function toggleToday(id: string) {
    const today = todayKey();
    setHabits((current) =&gt;
      current.map((h) =&gt;
        h.id !== id ? h : { ...h, doneDates: h.doneDates.includes(today) ? h.doneDates.filter((d) =&gt; d !== today) : [...h.doneDates, today] },
      ),
    );
  }
  return (
    &lt;SafeAreaView style={styles.screen}&gt;
      {/* 1. Move the content up when the keyboard opens */}
      &lt;KeyboardAvoidingView style={styles.screen} behavior="padding"&gt;
        {/* 2. Scrollable, and taps on buttons work while the keyboard is open */}
        &lt;ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"&gt;
          &lt;Text style={styles.title}&gt;Today&lt;/Text&gt;
          {habits.map((h) =&gt; (
            &lt;HabitCard key={h.id} habit={h} onToggle={toggleToday} /&gt;
          ))}
          &lt;HabitForm existingNames={habits.map((h) =&gt; h.name)} onSubmit={addHabit} /&gt;
        &lt;/ScrollView&gt;
      &lt;/KeyboardAvoidingView&gt;
    &lt;/SafeAreaView&gt;
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 32, fontWeight: '700' },
});
</code></pre>
