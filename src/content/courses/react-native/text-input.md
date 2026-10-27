---
publishDate: 2026-10-21T23:00
title: Getting Text from Users with TextInput
slug: text-input
metadescription: 'Learn how to use the React Native TextInput component: controlled inputs, keyboard types, passwords, multiline notes and moving between fields.'
updateDate: 2026-10-21T23:00
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'textinput', 'forms', 'core-components']
course: react-native
---

## Typing on a phone

Almost every app needs the user to type something: a name, an email, a search word, a note. On the web you use `<input>`. In React Native you use **`TextInput`**, a component that shows a real native text field. On iOS it becomes a `UITextField` (or `UITextView` for many lines), and on Android it becomes an `EditText`. That is why it feels exactly like typing in any other app on the phone.

By the end of this page you will be able to read what the user types, pick the right keyboard, hide passwords, write long notes and jump from one field to the next. You will also build the first small piece of HabitHop: a box where you type the name of a new habit.

If you have not used `View` and `Text` yet, read [View and Text: The Building Blocks](/courses/react-native/view-and-text) first.

## Your first TextInput

Here is the smallest useful screen. It shows a text field and repeats what you type underneath it.

```tsx
// src/app/index.tsx
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

export default function Index() {
  const [name, setName] = useState('');

  return (
    <View style={styles.screen}>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Your name"
      />
      <Text>Hello, {name || 'stranger'}!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
});
```

Three props do the work:

- `value` is the text the field shows. A **prop** is a value you pass into a component, like an argument to a function.
- `onChangeText` is a function React Native calls every time the text changes. It gets the new text as a plain string, so you can pass `setName` straight in.
- `placeholder` is the grey hint text shown while the field is empty.

When you type "Riya", the line below the field changes to "Hello, Riya!" on every key press.

This pattern, where the text lives in state and the field only shows that state, is called a **controlled input**. It is the same idea as controlled inputs in React for the web, which you can read about in [Forms and Controlled Components](/courses/react/forms-and-controlled-components). The big win: the text is always in your state, so you can check it, clear it or send it anywhere.

### Why you need a style

Try removing `style={styles.input}`. On iOS the field becomes invisible: there is no border and no background, only a blinking cursor when you tap the empty space. On Android you get a thin underline. A `TextInput` has almost no look of its own, so you nearly always give it a border, padding and a font size. You will learn styling in detail in [Styling with StyleSheet](/courses/react-native/stylesheet-basics).

### onChangeText vs onChange

There is also an `onChange` prop. It gives you an **event object** (a bundle of information about what happened) instead of a string, and you read the text from `event.nativeEvent.text`. You rarely need it. Use `onChangeText` unless you have a special reason.

## Picking the right keyboard

Phones show a keyboard on screen, and you can choose which one. Showing a number pad for a phone number saves the user a lot of tapping.

```tsx
<TextInput keyboardType="email-address" placeholder="Email" />
<TextInput keyboardType="number-pad" placeholder="Age" />
<TextInput keyboardType="phone-pad" placeholder="Phone" />
<TextInput keyboardType="decimal-pad" placeholder="Price" />
```

These values work on both iOS and Android: `default`, `email-address`, `numeric`, `phone-pad`, `number-pad`, `decimal-pad` and `url`. There are a few more that only work on one platform (like `twitter` on iOS or `visible-password` on Android), so stick to the shared list.

There is also a newer prop called `inputMode`. It works like the HTML `inputmode` attribute, with values such as `text`, `numeric`, `decimal`, `tel`, `email`, `url` and `search`. If you set both, `inputMode` wins. Use whichever feels more familiar.

Important: the keyboard type is only a hint. A number pad does not stop someone from pasting letters. Always check the value in your code too. You will do that properly in [Building Forms and Checking Input](/courses/react-native/forms-and-validation).

## Helpful props for real forms

A few more props make a field much nicer to use:

```tsx
<TextInput
  value={email}
  onChangeText={setEmail}
  placeholder="you@example.com"
  placeholderTextColor="#888"
  keyboardType="email-address"
  autoCapitalize="none"
  autoCorrect={false}
  autoComplete="email"
  maxLength={80}
/>
```

- `placeholderTextColor` sets the color of the hint text. The default can be very light on some phones.
- `autoCapitalize` controls automatic capital letters: `none`, `sentences` (the default), `words` or `characters`. Emails and usernames should use `none`, or "sam@x.com" becomes "Sam@x.com".
- `autoCorrect={false}` stops the phone from "fixing" words that are not real words, like emails or codes.
- `autoComplete` tells the phone what kind of data this is (`email`, `name`, `tel`, `password` and more), so it can offer saved values.
- `maxLength` limits how many characters the user can type.
- `editable={false}` makes the field read-only. It still shows the text, but the user cannot change it.

## Passwords

To hide what the user types, add `secureTextEntry`:

```tsx
<TextInput
  value={password}
  onChangeText={setPassword}
  placeholder="Password"
  secureTextEntry
  autoCapitalize="none"
  autoComplete="password"
/>
```

Each letter is shown as a dot. A common extra is a "Show" button that flips `secureTextEntry` with a boolean in state. You will build buttons like that in the next lesson, [Buttons and Pressable](/courses/react-native/buttons-and-pressable).

## Long text with multiline

By default a `TextInput` is one line. For notes or descriptions, set `multiline`:

```tsx
<TextInput
  value={note}
  onChangeText={setNote}
  placeholder="Why do you want this habit?"
  multiline
  style={{ minHeight: 100, textAlignVertical: 'top', borderWidth: 1, padding: 12 }}
/>
```

With `multiline`, the Enter key adds a new line instead of finishing the input, and the box grows as you type (unless you give it a fixed `height`). Give it a `minHeight` so it looks like a text area from the start.

`textAlignVertical: 'top'` is for Android. Without it, Android puts the text in the middle of a tall box, which looks odd. iOS already starts at the top.

## The Enter key and submitting

On a single-line field the keyboard has a return key. You can change its label and react when it is pressed:

```tsx
<TextInput
  value={name}
  onChangeText={setName}
  returnKeyType="done"
  onSubmitEditing={() => console.log('Saved', name)}
/>
```

- `returnKeyType` changes the label or icon of that key. `done`, `go`, `next`, `search` and `send` work on both platforms. (`enterKeyHint` is the newer, HTML-style name for the same thing.)
- `onSubmitEditing` runs when the user presses that key.
- `submitBehavior` decides what happens to the keyboard then. On a single-line field the default is `blurAndSubmit`: the field loses focus (the keyboard closes) and `onSubmitEditing` runs. Use `submit` if you want the keyboard to stay open. The older `blurOnSubmit` prop still exists but is deprecated, so use `submitBehavior` in new code.

**Focus** means "this field is the one receiving key presses right now". When a field has focus the keyboard is open. When it loses focus (this is called **blur**), the keyboard closes. `onFocus` and `onBlur` props let you run code at those moments, for example to change the border color of the active field.

## Moving to the next field with a ref

In a form with two fields, it is nice when pressing "Next" jumps to the second field. To do that you need a **ref**: a way to hold on to the real native field so you can call methods on it, like `focus()`. React's `useRef` hook creates one.

```tsx
// src/app/sign-up.tsx
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInputInstance>(null);

  return (
    <View style={styles.screen}>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextInput
        ref={passwordRef}
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
});
```

`TextInputInstance` is the type of the native field that the ref points to (React Native exports it for exactly this). Start the ref as `null`, because the field does not exist until the screen is drawn. Then `passwordRef.current?.focus()` moves the cursor to the password field. `submitBehavior="submit"` keeps the keyboard open while you jump, so it does not close and pop open again. The ref also has `blur()` and `clear()`. To close the keyboard from anywhere, you can call `Keyboard.dismiss()` (import `Keyboard` from `react-native`).

In React 19, `ref` is a normal prop, so passing `ref={passwordRef}` just works. See [Ref as a Prop](/courses/react/ref-as-a-prop) if you are curious about that change.

## Putting it together in HabitHop

HabitHop will let you add new habits. Here is a first, standalone version of that "add a habit" box. It keeps the typed name in state, refuses empty names and shows the habits you added in a simple list.

The code panel at the bottom of this page has the full file. The important part is the `add` function:

```tsx
function add() {
  const trimmed = name.trim();
  if (!trimmed) return; // ignore empty or spaces-only names
  setHabits((current) => [...current, trimmed]);
  setName(''); // clear the field for the next habit
}
```

Because the input is controlled, clearing it is just `setName('')`. The field updates right away. Both the return key (`onSubmitEditing={add}`) and a small "Add" button call the same function. The button uses `Pressable`, which the [Buttons and Pressable](/courses/react-native/buttons-and-pressable) lesson explains fully.

Later in the course this grows into the real `new-habit` modal screen with an emoji and a color picker ([Modal Screens](/courses/react-native/modal-screens)), and the keyboard handling gets better in [Handling the Keyboard](/courses/react-native/keyboard-handling).

## Common mistakes

**1. Using `onChange` like on the web.** You write `onChange={(e) => setName(e.target.value)}` and TypeScript complains: `Property 'value' does not exist on type 'number | ReactNativeElement'`. React Native events are different from DOM events. Use `onChangeText={setName}` instead.

**2. Setting `value` without `onChangeText`.** The field looks stuck: you type, and the letters vanish or the old text comes back. A controlled input only shows what is in `value`, so if you never update state, nothing changes. Always pair `value` with `onChangeText`.

**3. The field is invisible.** You added a `TextInput` and cannot see it (on iOS especially). Give it a `borderWidth`, `padding` and maybe a background color.

**4. The keyboard covers the field.** A field near the bottom of the screen disappears behind the keyboard. This is a separate topic with its own tools (`KeyboardAvoidingView` and friends), covered in [Handling the Keyboard](/courses/react-native/keyboard-handling).

## Quick recap

- `TextInput` shows a real native text field on iOS and Android.
- Use a controlled input: `value` from state plus `onChangeText` to update it.
- A `TextInput` has almost no default style, so add a border, padding and font size.
- `keyboardType` (or `inputMode`) picks the keyboard, but it is only a hint, so still check the value.
- `autoCapitalize="none"` and `autoCorrect={false}` are a must for emails and usernames.
- `secureTextEntry` hides passwords; `multiline` makes a text area (add `textAlignVertical: 'top'` for Android).
- `returnKeyType`, `onSubmitEditing` and `submitBehavior` control the Enter key.
- A ref lets you call `focus()`, `blur()` and `clear()` on a field.

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// A first "add a habit" box for HabitHop
export default function Index() {
  const [name, setName] = useState('');
  const [habits, setHabits] = useState&lt;string[]&gt;([]);
  function add() {
    const trimmed = name.trim();
    if (!trimmed) return; // ignore empty names
    setHabits((current) =&gt; [...current, trimmed]);
    setName(''); // clear the field
  }
  return (
    &lt;View style={styles.screen}&gt;
      &lt;Text style={styles.title}&gt;New habit&lt;/Text&gt;
      &lt;View style={styles.row}&gt;
        &lt;TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Drink water"
          placeholderTextColor="#888"
          maxLength={40}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={add}
        /&gt;
        &lt;Pressable style={styles.button} onPress={add}&gt;
          &lt;Text style={styles.buttonText}&gt;Add&lt;/Text&gt;
        &lt;/Pressable&gt;
      &lt;/View&gt;
      &lt;Text style={styles.hint}&gt;{name.length}/40 characters&lt;/Text&gt;
      {habits.map((habit, index) =&gt; (
        &lt;Text key={index} style={styles.habit}&gt;
          {index + 1}. {habit}
        &lt;/Text&gt;
      ))}
    &lt;/View&gt;
  );
}
// ---
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, paddingTop: 80, gap: 12 },
  title: { fontSize: 24, fontWeight: 'bold' },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#7C5CFC', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  hint: { color: '#888' },
  habit: { fontSize: 16 },
});
</code></pre>
