---
publishDate: 2026-10-24T17:00
title: Smooth Animations with Reanimated
slug: reanimated-basics
metadescription: 'Build smooth UI-thread animations with Reanimated 4: shared values, useAnimatedStyle, withTiming, withSpring, worklets and the new CSS-style transitions.'
updateDate: 2026-10-24T17:00
author: ['bishal-biswas']
level: 3
tags: ['react-native', 'animations', 'reanimated']
course: react-native
---

## Why another animation library?

In [First Animations with the Animated API](/courses/react-native/animated-api) you made HabitHop's cards fade in and pop. Animated is fine for simple effects, but it has limits. The native driver cannot animate layout styles like `width` or colors, and anything that reacts to a finger (a drag, a swipe) has to go back and forth between JavaScript and the UI thread, which can stutter.

**Reanimated** solves this. It is the animation library most React Native apps use today, made by Software Mansion. Its big trick: your animation code runs **on the UI thread**, the same thread that draws the screen. So animations stay smooth even when JavaScript is busy, and you can animate almost any style.

Good news: the default Expo template already includes Reanimated 4 and its partner library react-native-worklets. Both are in Expo Go too. If you started from a blank project, install them with:

```bash
npx expo install react-native-reanimated react-native-worklets
```

You do not need to edit `babel.config.js`. Expo's Babel preset adds the Reanimated (worklets) Babel plugin by itself when the package is installed.

Reanimated 4 only works with React Native's New Architecture, which is the only architecture in this course's React Native version, so there is nothing to switch on.

In this lesson you will learn:

- shared values and animated styles
- `withTiming`, `withSpring` and friends
- what a **worklet** is
- Reanimated 4's **CSS-style transitions and animations**, the easiest way to animate in Reanimated 4

## Shared values

A **shared value** is Reanimated's version of `Animated.Value`. It holds a value that both JavaScript and the UI thread can read and write, which is why it is called "shared".

```tsx
import { useSharedValue } from 'react-native-reanimated';

const offset = useSharedValue(0);
```

You read and write it through `.value`, or with the `get()` and `set()` methods:

```tsx
offset.value = 100;      // write
console.log(offset.value); // read

offset.set(100);         // the same, as a method
offset.get();
```

Changing a shared value does **not** re-render your component. That is the point: animations happen without React doing any work.

Which style should you use? Inside Reanimated callbacks, `.value` is normal and short. In regular component code, like a button's `onPress`, Reanimated's authors recommend `get()` and `set()` when the **React Compiler** is on (it is on by default in new Expo projects, as you saw in [Understanding the Project Files](/courses/react-native/project-structure)). The compiler assumes values returned from hooks are not changed directly, and `set()` keeps that promise clear. This lesson follows that rule.

## Animated styles

To connect a shared value to the screen, use `useAnimatedStyle`. It takes a function that returns a style object:

```tsx
// src/components/MovingBox.tsx
import { Button, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export function MovingBox() {
  const offset = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  function move() {
    offset.set(withSpring(offset.get() === 0 ? 150 : 0));
  }

  return (
    <View>
      <Animated.View
        style={[{ width: 80, height: 80, backgroundColor: '#7C5CFC', borderRadius: 12 }, animatedStyle]}
      />
      <Button title="Move" onPress={move} />
    </View>
  );
}
```

`Animated` here is the **default export** of react-native-reanimated, not the `Animated` from react-native. It has `Animated.View`, `Animated.Text`, `Animated.Image`, `Animated.ScrollView` and `Animated.FlatList`, and `Animated.createAnimatedComponent()` for anything else. Do not mix up the two imports in one file.

What you will see: tap "Move" and the purple box springs 150 points to the right. Tap again and it springs back.

## Worklets: code that runs on the UI thread

The function you pass to `useAnimatedStyle` is special. Reanimated's Babel plugin turns it into a **worklet**: a small JavaScript function that is copied to the UI thread and runs there, every frame if needed.

Worklets have one rule that matters for beginners: **they cannot directly call your normal JavaScript functions or use React state setters.** They live on a different thread. If a worklet needs to call back into normal JavaScript (for example to update state when an animation ends), use `scheduleOnRN` from react-native-worklets:

```tsx
import { withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

opacity.set(
  withTiming(0, { duration: 300 }, (finished) => {
    // this callback is a worklet, it runs on the UI thread
    if (finished) scheduleOnRN(setVisible, false);
  }),
);
```

`scheduleOnRN(fn, ...args)` means "run `fn(...args)` back on the React Native (JavaScript) thread". You may see `runOnJS(fn)(args)` in older code. It still exists in Reanimated 4, but it is deprecated in favor of `scheduleOnRN`.

Callbacks given to Reanimated hooks (`useAnimatedStyle`, `useDerivedValue` and others) and animation callbacks are made into worklets automatically. You rarely need to write the `'worklet'` directive yourself.

## Animation functions

You do not set a shared value to a number when you want motion. You set it to an **animation**:

```tsx
offset.set(100);                              // jump instantly
offset.set(withTiming(100));                  // move over 300 ms (default)
offset.set(withTiming(100, { duration: 600, easing: Easing.out(Easing.quad) }));
offset.set(withSpring(100));                  // spring physics
offset.set(withSpring(100, { damping: 8, stiffness: 300 })); // bouncier
```

`Easing` is imported from react-native-reanimated and has the same functions you met in the Animated lesson. For springs, Reanimated 4 also exports ready-made configs like `SnappySpringConfig` and `WigglySpringConfig` if you do not want to tune numbers yourself.

Animation functions can be combined, like Lego:

| Function | What it does |
| --- | --- |
| `withSequence(a, b, c)` | run animations one after another |
| `withDelay(200, a)` | wait 200 ms, then run `a` |
| `withRepeat(a, times, reverse)` | repeat `a`. `-1` means forever, `true` plays it backwards every other time |
| `cancelAnimation(sv)` | stop whatever animation is running on a shared value |

For example, a "pop":

```tsx
scale.set(
  withSequence(
    withTiming(1.3, { duration: 100 }),
    withSpring(1, { damping: 8, stiffness: 300 }),
  ),
);
```

## interpolate and interpolateColor

As with Animated, one value can drive many styles. In Reanimated you call `interpolate` inside the animated style:

```tsx
import Animated, { interpolate, interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

const style = useAnimatedStyle(() => ({
  opacity: interpolate(progress.value, [0, 1], [0.4, 1]),
  backgroundColor: interpolateColor(progress.value, [0, 1], ['#F97316', '#22C55E']),
}));
```

Unlike Animated's native driver, there is no list of "allowed" properties. Colors, widths, heights and margins all work on the UI thread.

`useDerivedValue` makes a new shared value computed from others, for example `const percent = useDerivedValue(() => Math.round(progress.value * 100));`.

## The easy way: CSS transitions in Reanimated 4

Shared values give you full control. But often you just want "when this style changes, animate the change". Reanimated 4 added **CSS transitions** for exactly that, using the same names as CSS on the web.

Here is the Today screen progress bar from the Animated lesson, rewritten with a transition:

```tsx
// src/components/DayProgress.tsx
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

export function DayProgress({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : (done / total) * 100;
  return (
    <View style={{ height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: 8,
          width: `${percent}%`,
          backgroundColor: percent === 100 ? '#22C55E' : '#F97316',
          transitionProperty: ['width', 'backgroundColor'],
          transitionDuration: 300,
          transitionTimingFunction: 'ease-out',
        }}
      />
    </View>
  );
}
```

There are no hooks at all. You render the new `width` and color from normal props, and because the style has `transitionProperty`, Reanimated animates from the old value to the new one. `transitionDuration` is in milliseconds (a string like `'300ms'` also works). Compare that with the 15 lines the Animated version needed.

There are also **CSS animations** with keyframes, for things that move on their own. The pulsing streak flame becomes:

```tsx
// src/components/StreakFlame.tsx
import Animated from 'react-native-reanimated';

export function StreakFlame() {
  return (
    <Animated.Text
      style={{
        fontSize: 32,
        animationName: {
          from: { transform: [{ scale: 1 }] },
          to: { transform: [{ scale: 1.15 }] },
        },
        animationDuration: '600ms',
        animationIterationCount: 'infinite',
        animationDirection: 'alternate',
        animationTimingFunction: 'ease-in-out',
      }}
    >
      🔥
    </Animated.Text>
  );
}
```

The animation starts when the component mounts and stops when it unmounts. No effect, no cleanup.

When to use which:

- **CSS transitions and animations**: state-driven changes and simple looping effects. Start here.
- **Shared values and `useAnimatedStyle`**: animations driven by gestures, scroll position, or anything that changes every frame, and complex sequences. You need these in [Swipes and Drags with Gesture Handler](/courses/react-native/gestures).

## Putting it together in HabitHop

The code panel shows `src/components/HabitCard.tsx` rewritten with Reanimated. It keeps the same props (`habit`, `onToggle` and the optional `onPress`) and uses both styles:

- A shared value `scale` and `useAnimatedStyle` make the done circle pop with `withSequence(withTiming(...), withSpring(...))` when tapped.
- A CSS transition on `backgroundColor` fades the circle's fill in and out when `doneToday` changes. With the Animated API you could not animate a color with the native driver. Here it runs on the UI thread with three lines of style.

Notice that both live in the same `style` array on one `Animated.View`. You can mix animated styles, CSS transition properties and normal styles freely.

What you will see: tap the circle and it bounces, while its fill smoothly fades to the habit's color. Tap again and the color fades back out.

## Respecting "Reduce Motion"

Some people get dizzy from motion and turn on **Reduce Motion** in their phone's accessibility settings. Reanimated respects it: by default, animations built with `withTiming` and `withSpring` follow the system setting (`ReduceMotion.System`) and jump straight to the end when it is on. You can check it yourself with the `useReducedMotion()` hook, for example to skip a purely decorative loop. More on this in [Accessibility: Apps Everyone Can Use](/courses/react-native/accessibility).

## Common mistakes

**Importing `Animated` from the wrong place.** `import { Animated } from 'react-native'` gives you the old API. `useAnimatedStyle` styles only work on components from `import Animated from 'react-native-reanimated'`.

**Reading `.value` during render.** Writing `<Text>{progress.value}</Text>` shows a stale number, because changing a shared value does not re-render. With strict logging on, Reanimated also warns with a message that starts "Reading from `value` during component render". Show changing numbers through state, or animate styles instead.

**Calling a JS function from a worklet.** Calling `setState` or your own function directly inside an animation callback crashes or does nothing. Wrap the call: `scheduleOnRN(setVisible, false)`.

**Using a CSS transition on a plain `View`.** `transitionProperty` only works on Reanimated's `Animated.View` (and the other Reanimated components). On a normal `View` the style just jumps to the new value. TypeScript does not catch this, so check your import.

## Quick recap

- Reanimated 4 runs animations on the UI thread. It is in the default template and in Expo Go, and Expo's Babel preset sets up its plugin.
- `useSharedValue` holds an animatable value. Use `get()`/`set()` in component code and `.value` inside worklets.
- `useAnimatedStyle(() => ({ ... }))` connects shared values to an `Animated.View` from react-native-reanimated.
- Animate with `withTiming`, `withSpring`, and combine with `withSequence`, `withDelay` and `withRepeat`.
- Worklets run on the UI thread. Call back into JavaScript with `scheduleOnRN` from react-native-worklets.
- Reanimated 4's CSS transitions (`transitionProperty`, `transitionDuration`) and keyframe animations (`animationName`) are the simplest way to animate state changes.

<code id="code-content" class="language-tsx">
// src/components/HabitCard.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
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
  // A shared value lives on the UI thread
  const scale = useSharedValue(1);
  // This style is recalculated on the UI thread whenever scale changes
  const popStyle = useAnimatedStyle(() =&gt; ({
    transform: [{ scale: scale.value }],
  }));
  function handleToggle() {
    // Grow fast, then spring back with a little bounce
    scale.set(
      withSequence(
        withTiming(1.3, { duration: 100 }),
        withSpring(1, { damping: 8, stiffness: 300 }),
      ),
    );
    onToggle(habit.id);
  }
  return (
    &lt;View style={[styles.card, { borderLeftColor: habit.color }]}&gt;
      &lt;Text style={styles.emoji}&gt;{habit.emoji}&lt;/Text&gt;
      &lt;Pressable style={styles.info} onPress={onPress}&gt;
        &lt;Text style={styles.name}&gt;{habit.name}&lt;/Text&gt;
        &lt;Text style={styles.streak}&gt;🔥 {streak} day streak&lt;/Text&gt;
      &lt;/Pressable&gt;
      &lt;Pressable
        onPress={handleToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: doneToday }}
        accessibilityLabel={`Mark ${habit.name} as done today`}
      &gt;
        &lt;Animated.View
          style={[
            styles.done,
            popStyle,
            {
              // CSS transition: fade the fill color when doneToday changes
              backgroundColor: doneToday ? habit.color : 'transparent',
              transitionProperty: 'backgroundColor',
              transitionDuration: 250,
            },
          ]}
        &gt;
          &lt;Text style={styles.check}&gt;{doneToday ? '✓' : ''}&lt;/Text&gt;
        &lt;/Animated.View&gt;
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
