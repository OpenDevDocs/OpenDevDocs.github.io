---
publishDate: 2026-10-22T00:30
title: Buttons and Pressable
slug: buttons-and-pressable
metadescription: 'Learn how to make tappable things in React Native: the simple Button, the flexible Pressable, pressed styles, long presses, hitSlop and the Android ripple.'
updateDate: 2026-10-22T00:30
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'pressable', 'button', 'core-components']
course: react-native
---

## Making things tappable

On the web, almost anything can have an `onClick`. In React Native it is different: a plain `View` or `Text` does not react to taps on its own (`Text` has an `onPress` prop, but it is meant for things like links inside a paragraph). To build a button you use one of two components:

- **`Button`**: a ready-made button. Quick to use, but you can barely change how it looks.
- **`Pressable`**: a wrapper that makes anything inside it tappable. You design the look yourself, and it tells you when it is being pressed.

The short version: `Button` is fine for a quick test screen, `Pressable` is what real apps use. Let's see both, then build the "done" button for a HabitHop habit row.

## The built-in Button

```tsx
// src/app/index.tsx
import { Alert, Button, View } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Button title="Say hi" onPress={() => Alert.alert('Hi Riya!')} />
    </View>
  );
}
```

`title` is the label (it must be a string) and `onPress` is the function that runs when you tap it. `Alert.alert` shows a native pop-up; you will learn it properly in [Modals and Alerts](/courses/react-native/modal-and-alert).

Run this on both platforms and you will notice they look different:

- On **iOS** you see blue text with no background. When you tap it, it fades a little.
- On **Android** you see a filled blue rectangle with the label in CAPITAL LETTERS, and a ripple effect when you tap it.

That is because `Button` draws the platform's own default button. It only has a few props you can change:

```tsx
<Button title="Save" color="#7C5CFC" disabled={name === ''} onPress={save} />
```

- `color`: on iOS this is the text color, on Android it is the background color.
- `disabled`: greys the button out and ignores taps.

And that is about it. There is no `style` prop. You cannot change the font, padding, corner radius or border, and you cannot put an icon inside. As soon as you want a button that matches your app's design, `Button` is too limited. That is where `Pressable` comes in.

## Pressable: tappable anything

`Pressable` wraps other components and makes the whole area tappable. You style it like a `View`, because it basically is a `View` that listens for touches.

```tsx
import { Pressable, StyleSheet, Text } from 'react-native';

<Pressable style={styles.button} onPress={() => console.log('Saved!')}>
  <Text style={styles.label}>Save habit</Text>
</Pressable>

const styles = StyleSheet.create({
  button: { backgroundColor: '#7C5CFC', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  label: { color: 'white', fontSize: 16, fontWeight: '600' },
});
```

Now the button looks the same on iOS and Android, and you control every detail. You can put anything inside: text, an emoji, an icon, an image, or a whole row of content.

### Showing that it is being pressed

There is one problem with the example above: when you tap it, nothing visibly changes. Users expect feedback. `Pressable` helps here in a clever way: its `style` prop can be a **function** that receives `{ pressed }`, a boolean that is `true` while a finger is down.

```tsx
<Pressable
  onPress={save}
  style={({ pressed }) => [
    styles.button,
    pressed && { opacity: 0.7 },
  ]}
>
  <Text style={styles.label}>Save habit</Text>
</Pressable>
```

The `style` array combines the normal style with an extra one while pressed. `pressed && {...}` gives `false` when not pressed, and React Native simply ignores `false` inside a style array. (You will see style arrays again in [Styling with StyleSheet](/courses/react-native/stylesheet-basics).)

The `children` can be a function too, if the content itself should change:

```tsx
<Pressable onPress={save}>
  {({ pressed }) => <Text>{pressed ? 'Saving...' : 'Save habit'}</Text>}
</Pressable>
```

### The Android ripple

Android users are used to a **ripple**: a circle of color that spreads from your finger. `Pressable` can draw it for you with `android_ripple`:

```tsx
<Pressable
  onPress={save}
  android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
  style={styles.button}
>
  <Text style={styles.label}>Save habit</Text>
</Pressable>
```

This prop does nothing on iOS, so combine it with a pressed style if you want feedback on both. If the ripple spills outside your rounded corners, add `overflow: 'hidden'` to the button style. You can also set `borderless: true` for a round ripple without edges, which is nice for icon buttons.

## Press events: in, out, long

`onPress` is just one of several events. Here is the order things happen when you tap:

```text
finger down   ->  onPressIn
finger up     ->  onPressOut  ->  onPress
finger held   ->  onPressIn  ->  (after 500 ms) onLongPress  ->  onPressOut
```

- `onPressIn` fires the moment the finger touches. Good for instant effects.
- `onPressOut` fires when the finger leaves.
- `onPress` fires after a normal tap.
- `onLongPress` fires if the finger stays down long enough (500 milliseconds by default, change it with `delayLongPress`). If `onLongPress` runs, `onPress` does not.

Long press is great for "secondary" actions. In HabitHop, a tap will mark a habit as done, and a long press could open the habit's options:

```tsx
<Pressable
  onPress={() => setDone(!done)}
  onLongPress={() => Alert.alert('Drink water', 'Edit or delete this habit?')}
  delayLongPress={400}
>
  <Text>💧 Drink water</Text>
</Pressable>
```

If the user presses, then slides the finger far away before lifting it, the press is cancelled and `onPress` does not run. That is normal phone behavior: it lets people "change their mind".

## Small targets and hitSlop

Fingers are much bigger than mouse pointers. Apple suggests touch targets of at least 44 by 44 points, and Android suggests 48 by 48. A small icon button can be hard to hit. You have two fixes:

1. Give the `Pressable` some padding, so the tappable area is bigger.
2. Use **`hitSlop`**: extra invisible space around the button that also counts as a tap.

```tsx
<Pressable hitSlop={12} onPress={close}>
  <Text style={{ fontSize: 18 }}>✕</Text>
</Pressable>
```

`hitSlop={12}` adds 12 points on every side. You can also pass an object like `{ top: 10, bottom: 10, left: 20, right: 20 }`. The extra area does not change the layout; it only makes taps easier.

## Disabled buttons

`Pressable` has a `disabled` prop. When it is `true`, none of the press events run. It does not change the look, so style it yourself:

```tsx
<Pressable
  disabled={!name}
  onPress={save}
  style={[styles.button, !name && { opacity: 0.4 }]}
>
  <Text style={styles.label}>Save habit</Text>
</Pressable>
```

## What about TouchableOpacity?

In older tutorials you will see `TouchableOpacity`, `TouchableHighlight` and `TouchableWithoutFeedback`. They still exist and still work. `Pressable` is the newer, more flexible API that the React Native team recommends for new code, so this course uses `Pressable` everywhere.

## Making your buttons accessible

A screen reader (VoiceOver on iOS, TalkBack on Android) reads the screen out loud for people who cannot see it well. To make it announce your `Pressable` as a button, add `accessibilityRole="button"`. If the button shows only an icon, add an `accessibilityLabel` that says what it does:

```tsx
<Pressable accessibilityRole="button" accessibilityLabel="Mark Drink water as done" onPress={toggle}>
  <Text>✓</Text>
</Pressable>
```

`Button` does this for you automatically, which is one small advantage it has. You will learn much more in [Accessibility: Apps Everyone Can Use](/courses/react-native/accessibility).

## Putting it together in HabitHop

The code panel at the bottom has a small HabitHop screen with one habit row. It shows the pieces from this lesson working together:

- The whole row is not tappable, only the round "done" button on the right. It uses a pressed style, a ripple on Android, `hitSlop` and an accessibility role and state.
- When the habit is done, the circle fills with the habit color and shows a check mark.
- A long press on the row's text opens an alert.
- A "Reset" `Button` at the bottom shows the built-in button next to your custom one, so you can compare them.

The toggle uses `useState`, which you know from React. Mobile state works exactly the same; the [State and Props in a Mobile App](/courses/react-native/state-and-props) lesson goes deeper. In [Long Lists with FlatList](/courses/react-native/flatlist), this pressable done circle moves into the `HabitCard` component you built in [View and Text: The Building Blocks](/courses/react-native/view-and-text).

## Common mistakes

**1. Putting `onPress` on a `View`.** Nothing happens when you tap, and TypeScript says `Property 'onPress' does not exist on type 'IntrinsicAttributes & Omit<ViewProps, "ref"> ...'`. Wrap the content in a `Pressable` instead.

**2. Trying to style `Button`.** You write `<Button style={...} />` and get a TypeScript error like `Property 'style' does not exist on type 'IntrinsicAttributes & Omit<ButtonProps, "ref"> ...'`. `Button` does not take a style. Switch to `Pressable`.

**3. Calling the function instead of passing it.** `onPress={save()}` runs `save` immediately while the screen is drawing (and maybe causes an endless loop if `save` sets state). Pass the function itself, `onPress={save}`, or wrap it: `onPress={() => save(habit.id)}`.

**4. No feedback.** The button works, but users tap it three times because nothing seemed to happen. Always add a pressed style or `android_ripple`.

## Quick recap

- `Button` is quick but limited: a `title`, `onPress`, `color` and `disabled`, and it looks different on iOS and Android.
- `Pressable` makes anything tappable and is the flexible choice for real apps.
- `style` and `children` on `Pressable` can be functions that receive `{ pressed }`.
- `android_ripple` adds the Android ripple; it does nothing on iOS.
- `onPressIn`, `onPressOut`, `onPress` and `onLongPress` cover every kind of touch.
- Use padding or `hitSlop` to make small targets easy to hit.
- Add `accessibilityRole="button"` (and a label for icon buttons).

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { useState } from 'react';
import { Alert, Button, Pressable, StyleSheet, Text, View } from 'react-native';
// One HabitHop row with a custom "done" button
export default function Index() {
  const [done, setDone] = useState(false);
  const color = '#7C5CFC';
  return (
    &lt;View style={styles.screen}&gt;
      &lt;View style={styles.row}&gt;
        &lt;Pressable
          style={styles.info}
          onLongPress={() =&gt; Alert.alert('Drink water', 'Edit or delete this habit?')}
        &gt;
          &lt;Text style={styles.emoji}&gt;💧&lt;/Text&gt;
          &lt;Text style={styles.name}&gt;Drink water&lt;/Text&gt;
        &lt;/Pressable&gt;
        &lt;Pressable
          onPress={() =&gt; setDone(!done)}
          hitSlop={8}
          android_ripple={{ color: 'rgba(0,0,0,0.15)', borderless: true }}
          accessibilityRole="button"
          accessibilityLabel="Mark Drink water as done"
          accessibilityState={{ checked: done }}
          style={({ pressed }) =&gt; [
            styles.doneButton,
            { borderColor: color },
            done &amp;&amp; { backgroundColor: color },
            pressed &amp;&amp; { transform: [{ scale: 0.9 }] },
          ]}
        &gt;
          &lt;Text style={styles.check}&gt;{done ? '✓' : ''}&lt;/Text&gt;
        &lt;/Pressable&gt;
      &lt;/View&gt;
      &lt;Button title="Reset" color={color} disabled={!done} onPress={() =&gt; setDone(false)} /&gt;
    &lt;/View&gt;
  );
}
// ---
const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 24 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: '#F3F0FF' },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 28 },
  name: { fontSize: 18, fontWeight: '600' },
  doneButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  check: { color: 'white', fontSize: 20, fontWeight: 'bold' },
});
</code></pre>
