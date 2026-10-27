---
publishDate: 2026-10-24T18:30
title: Swipes and Drags with Gesture Handler
slug: gestures
metadescription: 'Use React Native Gesture Handler 3 hooks like usePanGesture with Reanimated to build drag and swipe-to-complete gestures that run smoothly on the UI thread.'
updateDate: 2026-10-24T18:30
author: ['bishal-biswas']
level: 3
tags: ['react-native', 'gestures', 'reanimated', 'animations']
course: react-native
---

## Gestures make apps feel physical

Tapping buttons is fine, but the best mobile apps also let you **swipe** and **drag**. Swipe an email to archive it. Drag a photo around. Pull a sheet down to close it. These are **gestures**: patterns of finger movement that the app recognizes.

In this lesson you will add **swipe-to-complete** to HabitHop. Drag a habit card to the right, a colored "✓ Done" strip appears behind it, and if you drag far enough, the habit is marked done with a little haptic buzz. Then the card springs back into place.

To build it you will use **React Native Gesture Handler**, together with Reanimated from [Smooth Animations with Reanimated](/courses/react-native/reanimated-basics).

## Why Gesture Handler?

React Native has a built-in touch system (`Pressable`, `onTouchMove` and the old PanResponder). It runs in JavaScript. For a drag, every finger movement has to travel to JavaScript, get handled, and travel back to move the view. When JavaScript is busy, the card lags behind your finger.

Gesture Handler recognizes gestures **natively**, using the real iOS and Android gesture systems. Combined with Reanimated, your gesture code runs on the UI thread, so the card sticks to your finger at full frame rate.

The default Expo template already includes Gesture Handler (version 3 in this course), and it works in Expo Go. In a blank project:

```bash
npx expo install react-native-gesture-handler
```

## Gesture Handler 3: the hook API

Gesture Handler 3 introduced a new **hook-based API**. You create a gesture with a hook like `usePanGesture`, and attach it to a view with `<GestureDetector>`:

```tsx
const pan = usePanGesture({ onUpdate: (e) => { /* ... */ } });

<GestureDetector gesture={pan}>
  <Animated.View />
</GestureDetector>
```

Many tutorials and Stack Overflow answers use the older **builder API**: `Gesture.Pan().onUpdate(...)`. It still works in Gesture Handler 3, but every builder is marked deprecated with a note saying it "will be removed in a future version" and to use the hooks instead. This lesson uses the hooks.

The hooks available are `usePanGesture` (drag), `useTapGesture`, `useLongPressGesture`, `usePinchGesture` (two-finger zoom), `useRotationGesture`, `useFlingGesture` (quick swipe), `useHoverGesture`, plus a few advanced ones.

## Step 1: the root view

Gesture Handler needs a `GestureHandlerRootView` near the top of your app. Without it, the library throws this error in development:

```text
GestureDetector must be used as a descendant of GestureHandlerRootView. Otherwise the gestures will not be recognized.
```

Wrap your root layout once. Give it `flex: 1`, or your whole app may collapse to zero height:

```tsx
// src/app/_layout.tsx
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { HabitsProvider } from '@/context/HabitsContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HabitsProvider>
        <Stack />
      </HabitsProvider>
    </GestureHandlerRootView>
  );
}
```

If your root layout already has other providers (an auth provider, for example), put `GestureHandlerRootView` around all of them. It should be the outermost view. You set up this file in [Stack Navigation and Headers](/courses/react-native/stack-navigation).

## Step 2: your first drag

Here is a ball you can drag anywhere. When you let go, it springs back:

```tsx
// src/components/DragBall.tsx
import { StyleSheet } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export function DragBall() {
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const pan = usePanGesture({
    onUpdate: (e) => {
      x.value = e.translationX;
      y.value = e.translationY;
    },
    onDeactivate: () => {
      x.value = withSpring(0);
      y.value = withSpring(0);
    },
  });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.ball, style]} />
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  ball: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#7C5CFC' },
});
```

How it works:

- A **pan gesture** is any drag. `onUpdate` runs for every finger movement while the drag is active.
- `e.translationX` and `e.translationY` are how far the finger moved since the drag started, in points. You copy them into shared values.
- `onDeactivate` runs when the drag ends (the finger lifts). Here the ball springs home.
- The view inside `GestureDetector` is an `Animated.View` from Reanimated, so the animated style can move it.

The callbacks you write inside `usePanGesture({ ... })` are automatically turned into **worklets** by the Babel plugin, so they run on the UI thread. That is why you write `x.value = ...` there, just like inside `useAnimatedStyle`.

### The gesture lifecycle

A gesture goes through stages, and each has a callback:

| Callback | When it runs |
| --- | --- |
| `onBegin` | the finger touches down, before the gesture is sure |
| `onActivate` | the gesture is recognized (for a pan: the finger moved far enough) |
| `onUpdate` | every movement while active |
| `onDeactivate` | the active gesture ends. `e.canceled` tells you if it was interrupted |
| `onFinalize` | always at the very end, even if the gesture never activated |

If you have used Gesture Handler 2, these replace `onStart`, `onEnd` and `onChange`.

Pan events also have `velocityX` and `velocityY` (points per second), which help you detect a fast flick, and `x`/`y` for the finger position inside the view.

## Step 3: calling your own JavaScript

Gesture callbacks run on the UI thread, so they cannot call normal JavaScript functions directly, like `onToggle` from your context or `Haptics.notificationAsync`. As in the Reanimated lesson, wrap the call with `scheduleOnRN` from react-native-worklets:

```tsx
import { scheduleOnRN } from 'react-native-worklets';

function complete() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  onToggle(habit.id);
}

const pan = usePanGesture({
  onDeactivate: (e) => {
    if (e.translationX > 100) scheduleOnRN(complete);
  },
});
```

`complete` is a plain function in your component. `scheduleOnRN(complete)` asks the JavaScript thread to run it as soon as it can.

For simple gestures that do not animate anything, there is another option: pass `runOnJS: true` in the gesture config, and all its callbacks run on the JavaScript thread like normal functions.

## Step 4: playing nicely with scrolling

HabitHop's cards live in a vertical `FlatList`. If the pan gesture started on any finger movement, you could never scroll the list: every scroll would grab the card instead. Two options fix this:

```tsx
const pan = usePanGesture({
  activeOffsetX: [-15, 15], // only start after 15 points sideways
  failOffsetY: [-10, 10],   // give up if the finger moves 10 points up or down first
  // ...
});
```

- `activeOffsetX: [-15, 15]` means the pan only activates after the finger moves more than 15 points left or right.
- `failOffsetY: [-10, 10]` means if the finger moves 10 points vertically before that, this gesture **fails**, and the list's scroll takes over.

Now a mostly vertical movement scrolls the list, and a mostly horizontal one drags the card. This is the most common gesture bug in real apps, so remember these two options.

## Putting it together: swipe to complete

The code panel shows the full `src/components/HabitCard.tsx`. It keeps the usual props (`habit`, `onToggle`, optional `onPress`) and the tap-to-complete circle, so the swipe is an extra shortcut, not the only way. The main pieces:

1. **Two layers.** A `wrapper` view holds a colored "✓ Done" strip in the back (`position: 'absolute'` filling the wrapper) and the white card in front. Dragging the card reveals the strip.
2. **The pan gesture.** `onUpdate` sets `translateX` to `Math.max(0, e.translationX)`, so the card only moves right. `onDeactivate` checks if the drag passed `SWIPE_DONE` (100 points). If so, it calls `complete` with `scheduleOnRN`. Either way, the card springs back to `0`.
3. **Two animated styles.** `cardStyle` moves the card. `hintStyle` fades the strip in with `interpolate(translateX.value, [0, SWIPE_DONE], [0, 1], 'clamp')`. The `'clamp'` option stops the value going above `1` when you drag past 100.
4. **Undo.** If the habit is already done, the strip says "↩ Undo", because `onToggle` toggles.

Use it in the Today list as before:

```tsx
// src/app/(tabs)/index.tsx (part)
<FlatList
  data={habits}
  keyExtractor={(h) => h.id}
  renderItem={({ item }) => <HabitCard habit={item} onToggle={toggleToday} />}
  ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
/>
```

What you will see on a phone: put your finger on "Drink water" and drag right. The card follows your finger exactly, and a purple strip with "✓ Done" fades in behind it. Let go after about 100 points: you feel a buzz, the circle fills, the streak goes up, and the card bounces back. Let go before that, and it just slides back with nothing changed. Scrolling the list up and down still works normally.

Gesture Handler also works on the web, using pointer events, so you can drag with a mouse in the browser. The haptic simply does nothing there.

## More gestures in one minute

A **double tap** with `useTapGesture`:

```tsx
const doubleTap = useTapGesture({
  numberOfTaps: 2,
  runOnJS: true,
  onActivate: () => onToggle(habit.id),
});
```

To have several gestures on one view, combine them with a composition hook and pass the result to `GestureDetector`:

- `useSimultaneousGestures(a, b)`: both can be active together (pinch and rotate a photo).
- `useExclusiveGestures(a, b)`: only one wins, in order of priority. Use `useExclusiveGestures(doubleTap, singleTap)` so a double tap is not also seen as a single tap.
- `useCompetingGestures(a, b)`: whichever activates first wins.

## Common mistakes

**No root view.** The error `GestureDetector must be used as a descendant of GestureHandlerRootView` means you forgot the wrapper, or put it inside a screen instead of the root layout.

**The list will not scroll.** Your pan gesture activates on vertical moves too. Add `activeOffsetX` and `failOffsetY`.

**Calling JS functions inside callbacks.** Calling `onToggle(...)` directly inside `onDeactivate` fails because that code runs on the UI thread. Use `scheduleOnRN(fn)`, or `runOnJS: true` for gestures that do not animate.

**A plain `View` inside the detector.** The gesture fires, but nothing moves, because only Reanimated's `Animated.View` applies animated styles. Use `Animated.View` from react-native-reanimated.

## Quick recap

- Gesture Handler recognizes gestures natively. With Reanimated, gesture code runs on the UI thread and stays smooth.
- Wrap the root layout in `<GestureHandlerRootView style={{ flex: 1 }}>`.
- Gesture Handler 3 uses hooks: `usePanGesture`, `useTapGesture` and more, attached with `<GestureDetector gesture={...}>`. The old `Gesture.Pan()` builder is deprecated.
- Callbacks: `onBegin`, `onActivate`, `onUpdate`, `onDeactivate`, `onFinalize`. Pan events give `translationX`, `translationY` and velocities.
- Call JavaScript from a gesture with `scheduleOnRN(fn)`.
- Use `activeOffsetX` and `failOffsetY` so horizontal swipes and vertical scrolling can live together.

<code id="code-content" class="language-tsx">
// src/components/HabitCard.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import type { Habit } from '@/types/habit';
import { getStreak, isDoneToday } from '@/lib/dates';
const SWIPE_DONE = 100; // drag at least this far to the right
type HabitCardProps = {
  habit: Habit;
  onToggle: (id: string) =&gt; void;
  onPress?: () =&gt; void; // opens the details screen
};
export function HabitCard({ habit, onToggle, onPress }: HabitCardProps) {
  const doneToday = isDoneToday(habit.doneDates);
  const streak = getStreak(habit.doneDates);
  const translateX = useSharedValue(0);
  // Normal JS function, called from the UI thread with scheduleOnRN
  function complete() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onToggle(habit.id);
  }
  const pan = usePanGesture({
    activeOffsetX: [-15, 15], // start only after a clear sideways move
    failOffsetY: [-10, 10], // let vertical moves scroll the list
    onUpdate: (e) =&gt; {
      translateX.value = Math.max(0, e.translationX); // right only
    },
    onDeactivate: (e) =&gt; {
      if (e.translationX &gt; SWIPE_DONE) scheduleOnRN(complete);
      translateX.value = withSpring(0); // always slide back
    },
  });
  const cardStyle = useAnimatedStyle(() =&gt; ({
    transform: [{ translateX: translateX.value }],
  }));
  const hintStyle = useAnimatedStyle(() =&gt; ({
    opacity: interpolate(translateX.value, [0, SWIPE_DONE], [0, 1], 'clamp'),
  }));
  return (
    &lt;View style={styles.wrapper}&gt;
      &lt;Animated.View style={[styles.hint, { backgroundColor: habit.color }, hintStyle]}&gt;
        &lt;Text style={styles.hintText}&gt;{doneToday ? '↩ Undo' : '✓ Done'}&lt;/Text&gt;
      &lt;/Animated.View&gt;
      &lt;GestureDetector gesture={pan}&gt;
        &lt;Animated.View style={[styles.card, { borderLeftColor: habit.color }, cardStyle]}&gt;
          &lt;Text style={styles.emoji}&gt;{habit.emoji}&lt;/Text&gt;
          &lt;Pressable style={styles.info} onPress={onPress}&gt;
            &lt;Text style={styles.name}&gt;{habit.name}&lt;/Text&gt;
            &lt;Text style={styles.streak}&gt;🔥 {streak} day streak&lt;/Text&gt;
          &lt;/Pressable&gt;
          &lt;Pressable
            onPress={() =&gt; onToggle(habit.id)}
            style={[styles.done, doneToday &amp;&amp; { backgroundColor: habit.color }]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: doneToday }}
            accessibilityLabel={`Mark ${habit.name} as done today`}
          &gt;
            &lt;Text style={styles.check}&gt;{doneToday ? '✓' : ''}&lt;/Text&gt;
          &lt;/Pressable&gt;
        &lt;/Animated.View&gt;
      &lt;/GestureDetector&gt;
    &lt;/View&gt;
  );
}
const styles = StyleSheet.create({
  wrapper: { borderRadius: 12, overflow: 'hidden' },
  hint: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', paddingLeft: 20 },
  hintText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#fff', borderLeftWidth: 4 },
  emoji: { fontSize: 28 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  streak: { color: '#6B7280', marginTop: 2 },
  done: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  check: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
</code></pre>
