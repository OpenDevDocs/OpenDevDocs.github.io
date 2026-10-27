---
publishDate: 2026-10-25T00:30
title: 'Accessibility: Apps Everyone Can Use'
slug: accessibility
metadescription: 'Make React Native apps work with TalkBack and VoiceOver: labels, roles, states, big touch targets, font scaling and testing with a real screen reader.'
updateDate: 2026-10-25T00:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'accessibility', 'a11y', 'screen-reader']
course: react-native
---

## Why accessibility matters

**Accessibility** (often written **a11y**, because there are 11 letters between the "a" and the "y") means making your app usable by everyone, including people who cannot see the screen well, cannot use their hands easily, or need bigger text. That is a lot of people: blind users, people with low vision, older people who set huge font sizes, and anyone using a phone in bright sunlight with one hand.

Phones have great built-in tools for this. The most important one is the **screen reader**: a program that reads the screen out loud and lets you move around with gestures instead of looking.

- On Android it is called **TalkBack**.
- On iOS it is called **VoiceOver**.

A screen reader does not see your pixels. It only knows what your app *tells* it: "this is a button", "its name is Add habit", "it is checked". React Native gives you props to say exactly that. In this lesson you will add them to HabitHop's `HabitCard`, make touch targets big enough, support large fonts, and test with a real screen reader.

## How a screen reader moves through your app

With TalkBack or VoiceOver on, the user swipes right to move to the next **element** (a thing the screen reader can focus) and swipes left to go back. The focused element gets a box around it, and the phone reads it out. A double tap anywhere on the screen "presses" the focused element.

So for every element, the screen reader needs to know three things:

1. **What is it called?** That is the **label**.
2. **What kind of thing is it?** That is the **role** (button, checkbox, header, link and so on).
3. **What state is it in?** That is the **state** (checked, disabled, selected, expanded).

Text inside a `Text` component is read automatically. Buttons with only an icon or an emoji are the usual problem: the screen reader has nothing good to say.

## Labels: tell the screen reader the name

Here is HabitHop's add button. It shows only a "+" sign:

```tsx
// src/components/AddButton.tsx
import { Pressable, Text } from 'react-native';

export function AddButton({ onAdd }: { onAdd: () => void }) {
  return (
    <Pressable
      onPress={onAdd}
      accessibilityRole="button"
      accessibilityLabel="Add a new habit"
      accessibilityHint="Opens a form to create a habit"
    >
      <Text>+</Text>
    </Pressable>
  );
}
```

- `accessibilityLabel` is what gets read instead of "plus". Keep it short and clear, and do not add the word "button": the role already says that.
- `accessibilityRole="button"` tells the screen reader this is something you can press. TalkBack and VoiceOver then say something like "Add a new habit, button".
- `accessibilityHint` is an extra sentence that says what happens when you press. Users can turn hints off, so never put important information only in the hint.

`Pressable` and `TouchableOpacity` are **accessible** by default. That means the screen reader treats the whole pressable area, and all the text inside it, as one element.

## Roles and states: the done button

HabitHop's done button works like a checkbox: a habit is done today, or it is not. So give it the `checkbox` role and tell the screen reader whether it is checked:

```tsx
// src/components/HabitCard.tsx (part)
<Pressable
  onPress={() => onToggle(habit.id)}
  accessibilityRole="checkbox"
  accessibilityLabel={`Mark ${habit.name} as done today`}
  accessibilityState={{ checked: doneToday }}
>
  <Text>{doneToday ? 'Done' : 'Do it'}</Text>
</Pressable>
```

`accessibilityState` is an object. Its common keys are:

- `checked`: `true`, `false` or `'mixed'` (for checkboxes and switches).
- `disabled`: the control cannot be used right now.
- `selected`: for things like the selected tab or the selected color.
- `expanded`: for something that opens and closes, like a collapsible section.
- `busy`: something is loading.

When `checked` changes, the screen reader says "checked" or "not checked". Without it, a blind user has no idea whether they already ticked off "Drink water".

Built-in components like `Switch` already report their role and state. You only add a label:

```tsx
<Switch value={remindersOn} onValueChange={setRemindersOn} accessibilityLabel="Daily reminder" />
```

## The newer aria-* props

React Native also supports props with the same names as on the web. If you already know [accessibility in React for the web](/courses/react/accessibility-a11y-in-react), these will feel familiar:

```tsx
// The same done button, written with web-style props
<Pressable
  onPress={onToggle}
  role="checkbox"
  aria-checked={done}
  aria-label="Drink water"
>
  <Text>{done ? 'Done' : 'Do it'}</Text>
</Pressable>
```

| Older prop | Web-style prop |
| --- | --- |
| `accessibilityLabel` | `aria-label` |
| `accessibilityRole` | `role` |
| `accessibilityState={{ checked }}` | `aria-checked` |
| `accessibilityState={{ disabled }}` | `aria-disabled` |
| `accessibilityState={{ expanded }}` | `aria-expanded` |
| `accessibilityElementsHidden` (iOS) and `importantForAccessibility` (Android) | `aria-hidden` |

Both sets work in React Native 0.88 and you can type-check both. Pick one style and use it everywhere in your project. This course mostly uses the `accessibility*` names, because you will see them in most existing code and tutorials, plus the short `aria-hidden` for decoration. Note one small difference: the header role is `accessibilityRole="header"` but `role="heading"`.

## Headers and grouping

Screen reader users often jump from header to header to skim a screen, like reading headings in a book. Mark your screen titles:

```tsx
<Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: '700' }}>
  Today
</Text>
```

Sometimes several small texts belong together. Without help, the user has to swipe three times to hear "💧", "Drink water", "5 day streak". Group them into one element with `accessible` and give the group one clear label:

```tsx
<View accessible accessibilityLabel="Drink water, 5 day streak">
  <Text>💧 Drink water</Text>
  <Text>5 day streak</Text>
</View>
```

Now one swipe reads the whole thing. Do not group things that the user must press separately, though: an element inside an `accessible` group cannot be focused on its own.

## Hiding decoration

Emoji and icons that only decorate should not be read. A screen reader may read "💧" as "droplet", which is just noise right before "Drink water". Hide it:

```tsx
<Text accessibilityElementsHidden importantForAccessibility="no">
  {habit.emoji}
</Text>
```

`accessibilityElementsHidden` works on iOS and `importantForAccessibility="no"` works on Android, so you need both. The web-style `aria-hidden` prop does the same on both platforms in one go, which is why the final `HabitCard` at the end of this lesson uses it:

```tsx
<Text style={styles.emoji} aria-hidden>{habit.emoji}</Text>
```

The streak line has the same problem: "🔥 5 day streak" may be read as "fire, 5 day streak". An emoji inside a longer text cannot be hidden on its own, so give the whole `Text` a clean label instead:

```tsx
<Text style={styles.streak} accessibilityLabel={`${streak} day streak`}>
  🔥 {streak} day streak
</Text>
```

## Touch targets: make things easy to hit

A **touch target** is the area of the screen that reacts to a tap. Small targets are hard to hit for everyone, and very hard for people with shaky hands. The platform guidelines say:

- iOS: at least **44 by 44 points**.
- Android: at least **48 by 48 dp** (density-independent pixels).

A point and a dp are the same idea: a unit that looks the same size on every screen. React Native style numbers are already in these units.

You have two tools. Make the button itself big enough with `minWidth` and `minHeight`:

```tsx
const styles = StyleSheet.create({
  button: {
    minWidth: 72,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

Or, if the design must look small, extend the tap area beyond the visible box with `hitSlop`:

```tsx
<Pressable onPress={onDelete} hitSlop={12} accessibilityRole="button" accessibilityLabel="Delete habit">
  <Text>✕</Text>
</Pressable>
```

`hitSlop={12}` adds 12 units of invisible tap area on every side. You first met it in [Buttons and Pressable](/courses/react-native/buttons-and-pressable).

## Big fonts: respect the user's text size

Both Android and iOS let the user make all text bigger in the phone settings. React Native follows this by default: every `Text` grows with the system setting. This is good. Do not turn it off everywhere.

Instead, design for it:

- Do not give fixed `height` values to boxes that hold text. Use `minHeight` and padding, so the box grows with the text.
- Let long text wrap onto more lines instead of cutting it off.
- If a layout breaks at very large sizes, change the layout. `useWindowDimensions()` gives you `fontScale`, which is `1` at normal size and larger when the user picks bigger text:

```tsx
// src/components/StreakRow.tsx
import { Text, View, useWindowDimensions } from 'react-native';

export function StreakRow() {
  const { fontScale } = useWindowDimensions();

  return (
    <View style={{ flexDirection: fontScale > 1.5 ? 'column' : 'row' }}>
      <Text maxFontSizeMultiplier={2}>Streak</Text>
      <Text allowFontScaling={false}>🔥</Text>
    </View>
  );
}
```

- `maxFontSizeMultiplier={2}` lets the text grow, but at most to twice its size.
- `allowFontScaling={false}` stops scaling for that one `Text`. Use it only for decoration, like this emoji, never for real content.

## Color and contrast

- Text must stand out from its background. The common rule (from WCAG, the web accessibility guidelines) is a **contrast ratio** of at least 4.5 to 1 for normal text. Free online contrast checkers will tell you the ratio for two colors.
- Never show meaning with color alone. HabitHop's done button changes color *and* changes its text from "Do it" to "Done". A color-blind user still sees the difference, and the screen reader hears "checked".
- Check your screens in dark mode too (see [Dark Mode and Themes](/courses/react-native/dark-mode-and-themes)).

## Reacting to screen reader and motion settings

The `AccessibilityInfo` API tells you about the user's settings. For example, you can check whether a screen reader is on, and listen for changes:

```tsx
// src/hooks/use-screen-reader.ts
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useScreenReader() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setEnabled);
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => sub.remove();
  }, []);

  return enabled;
}
```

You might use this to turn a swipe-to-delete gesture into a visible delete button, because swipes are hard with a screen reader on.

Some changes happen without the focus moving, like "Habit added". Tell the screen reader to say it:

```tsx
AccessibilityInfo.announceForAccessibility('Habit added');
```

Some users turn on **Reduce Motion** because big animations make them feel sick. `AccessibilityInfo.isReduceMotionEnabled()` tells you, and Reanimated has a `useReducedMotion()` hook for the same thing. When it is on, use a simple fade instead of a big bounce (see [Smooth Animations with Reanimated](/courses/react-native/reanimated-basics)).

## Testing with a real screen reader

Props are only half the job. Turn a screen reader on and use your app with your eyes closed for five minutes. You will find problems fast.

**Android (TalkBack):** open Settings, then Accessibility, then TalkBack, and switch it on. The exact menu names change a little between phone brands. Swipe right and left to move, double tap to press. To turn it off again, go back to the same setting (double tap the switch). Many phones also let you hold both volume keys for a few seconds as a shortcut, once you set it up.

**iOS (VoiceOver):** open Settings, then Accessibility, then VoiceOver. Same gestures: swipe to move, double tap to press. Set up the **Accessibility Shortcut** (triple click the side button) before you start, so you can turn it off easily.

On a Mac you can also use the **Accessibility Inspector** (it comes with Xcode) to inspect elements in the iOS Simulator. On Android, Google's free **Accessibility Scanner** app checks your screens for small touch targets and low contrast.

Things to check in HabitHop:

- Every button says what it does. No "button, button, button".
- The done button says "checked" or "not checked".
- The emoji is not read twice.
- You can add a habit and reach every tab using only swipes and double taps.
- Everything still fits with the largest font size.

## Common mistakes

**Icon buttons with no label.** Symptom: TalkBack says only "button" or "unlabeled". Fix: add `accessibilityLabel` (or `aria-label`).

**Wrapping a pressable inside an `accessible` View.** Symptom: the screen reader reads the whole card but the button inside can never be focused or pressed on its own. Fix: only group plain text, keep each pressable as its own element.

**Fixed heights around text.** Symptom: with large fonts, text is cut off or overflows the card. Fix: use `minHeight` and padding instead of `height`.

**Putting the state in the label.** Writing `accessibilityLabel="Drink water, done"` works until the state changes and the label does not. Fix: keep the name in the label and the state in `accessibilityState` (or `aria-checked`).

## Quick recap

- Screen readers (TalkBack on Android, VoiceOver on iOS) only know what your props tell them.
- Give every control a **label** (`accessibilityLabel` or `aria-label`), a **role** (`accessibilityRole` or `role`) and its **state** (`accessibilityState` or `aria-checked`, `aria-disabled` and friends).
- Mark screen titles as headers, group related text with `accessible`, and hide decoration.
- Touch targets should be at least 44 by 44 (iOS) or 48 by 48 (Android). Use `minHeight` or `hitSlop`.
- Let text scale. Avoid fixed heights, use `maxFontSizeMultiplier` with care, and read `fontScale` to adapt layouts.
- Use good contrast and never rely on color alone.
- Test with a real screen reader on a real phone.

In the next lesson, [Testing with Jest and React Native Testing Library](/courses/react-native/testing), you will see a nice bonus: tests that find elements by role and label also prove your accessibility props are there.

<code id="code-content" class="language-tsx">
// src/components/HabitCard.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getStreak, todayKey } from '@/lib/dates';
import type { Habit } from '@/types/habit';
type HabitCardProps = {
  habit: Habit;
  onToggle: (id: string) =&gt; void;
  onPress?: () =&gt; void; // opens the habit details
};
export function HabitCard({ habit, onToggle, onPress }: HabitCardProps) {
  const doneToday = habit.doneDates.includes(todayKey());
  const streak = getStreak(habit.doneDates);
  return (
    &lt;View style={[styles.card, { borderLeftColor: habit.color }]}&gt;
      {/* Decoration only: aria-hidden hides it from TalkBack and VoiceOver */}
      &lt;Text style={styles.emoji} aria-hidden&gt;{habit.emoji}&lt;/Text&gt;
      &lt;Pressable
        style={styles.info}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityHint={onPress ? 'Opens the habit details' : undefined}
      &gt;
        &lt;Text style={styles.name}&gt;{habit.name}&lt;/Text&gt;
        {/* A clear label, so the screen reader does not say "fire" */}
        &lt;Text style={styles.streak} accessibilityLabel={`${streak} day streak`}&gt;
          🔥 {streak} day streak
        &lt;/Text&gt;
      &lt;/Pressable&gt;
      &lt;Pressable
        onPress={() =&gt; onToggle(habit.id)}
        hitSlop={8} // extra invisible tap area around the button
        // Role, name and state: what a screen reader reads out
        accessibilityRole="checkbox"
        accessibilityLabel={`Mark ${habit.name} as done today`}
        accessibilityState={{ checked: doneToday }}
        style={[styles.button, doneToday &amp;&amp; { backgroundColor: habit.color, borderColor: habit.color }]}
      &gt;
        {/* The text changes too, so color is not the only signal */}
        &lt;Text style={[styles.buttonText, doneToday &amp;&amp; styles.buttonTextDone]}&gt;
          {doneToday ? 'Done' : 'Do it'}
        &lt;/Text&gt;
      &lt;/Pressable&gt;
    &lt;/View&gt;
  );
}
const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderLeftWidth: 6, backgroundColor: '#F4F2FF' },
  emoji: { fontSize: 28 },
  info: { flex: 1 },
  name: { fontSize: 17, fontWeight: '600', color: '#1F1F1F' },
  streak: { fontSize: 14, color: '#595959', marginTop: 2 }, // dark enough for good contrast
  // minHeight 44 (not height): a big touch target that still grows with large fonts
  button: { minWidth: 72, minHeight: 44, borderRadius: 22, borderWidth: 2, borderColor: '#C9C2F0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  buttonText: { fontWeight: '600', color: '#1F1F1F' },
  buttonTextDone: { color: '#FFFFFF' },
});
</code></pre>
