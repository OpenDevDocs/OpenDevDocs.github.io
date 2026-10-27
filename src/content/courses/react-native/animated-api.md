---
publishDate: 2026-10-24T15:30
title: First Animations with the Animated API
slug: animated-api
metadescription: 'Learn the built-in React Native Animated API: animated values, timing, spring, interpolate, sequences, loops and the native driver, using HabitHop cards.'
updateDate: 2026-10-24T15:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'animations', 'animated']
course: react-native
---

## Why animate?

Animations are not just decoration. A card that fades in shows the user that something new arrived. A button that "pops" when tapped confirms the tap worked. Smooth motion makes an app feel fast and alive, and abrupt jumps make it feel broken.

React Native has a built-in animation system called **Animated**. It ships with React Native, so there is nothing to install. In this lesson you will use it to make HabitHop's `HabitCard`:

- fade and slide in when it appears
- make the done circle "pop" when you tap it

You will also learn the main building blocks: animated values, `timing`, `spring`, `interpolate`, sequences and loops, and the **native driver** that keeps animations smooth.

In the next lesson, [Smooth Animations with Reanimated](/courses/react-native/reanimated-basics), you will meet Reanimated, a more powerful library. Learning Animated first is still worth it: the ideas are the same, it is used in lots of existing code, and for simple effects it is all you need.

## The big idea: animated values

Normally you change the screen by changing state. If you animated by calling `setState` 60 times a second, React would re-render your component 60 times a second. That is slow.

Animated works differently. You create an **animated value**: a special number that lives outside React state. You connect it to a style, and then you tell Animated "move this value from 0 to 1 over 400 milliseconds". Animated updates the view directly, frame by frame, without re-rendering your component.

Here is the classic way you will see in many tutorials:

```tsx
// src/components/FadeInBox.tsx
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export function FadeInBox() {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <Animated.View style={{ opacity, width: 100, height: 100, backgroundColor: '#7C5CFC' }} />
  );
}
```

Step by step:

1. `new Animated.Value(0)` makes an animated value that starts at `0`.
2. `useRef(...).current` keeps the **same** value object across renders. Without `useRef`, every render would create a fresh value starting at 0 again. You learned about `useRef` in React; it is a box that survives re-renders.
3. `<Animated.View>` is a `View` that understands animated values in its `style`. Plain `View` does not.
4. `Animated.timing(...)` describes an animation. Nothing moves until you call `.start()`.

What you will see: a purple square that fades in over half a second.

### The shorter hook: useAnimatedValue

React Native also has a hook that does the `useRef` part for you:

```tsx
import { useAnimatedValue } from 'react-native';

const opacity = useAnimatedValue(0);
```

It returns the same kind of `Animated.Value` and keeps it stable across renders. It is shorter, and it does not read `ref.current` during render, which the React Compiler (on by default in new Expo projects) prefers. The rest of this lesson uses `useAnimatedValue`. When you see `useRef(new Animated.Value(0)).current` in other code, it means the same thing.

### Animated components

These components are ready to animate:

- `Animated.View`
- `Animated.Text`
- `Animated.Image`
- `Animated.ScrollView`
- `Animated.FlatList`
- `Animated.SectionList`

To animate any other component, wrap it once with `Animated.createAnimatedComponent(MyComponent)`.

## timing: move at a set speed

`Animated.timing` moves a value to `toValue` over `duration` milliseconds. You can also choose an **easing** function, which controls the speed along the way. Real objects do not move at a constant speed; they speed up and slow down. Easing copies that:

```tsx
import { Animated, Easing } from 'react-native';

Animated.timing(opacity, {
  toValue: 1,
  duration: 400,
  easing: Easing.out(Easing.quad), // fast at first, gentle at the end
  useNativeDriver: true,
}).start();
```

`Easing.out(...)` is good for things that enter the screen. `Easing.in(...)` is good for things leaving. `Easing.inOut(...)` is good for things that move from one place to another. The default is `Easing.inOut(Easing.ease)`.

## spring: move like a real object

`Animated.spring` has no fixed duration. It behaves like a spring: it moves toward the target, may overshoot a bit, and settles. Springs feel natural for things the user touches.

```tsx
Animated.spring(scale, {
  toValue: 1,
  friction: 3, // lower = more bounce
  useNativeDriver: true,
}).start();
```

`friction` controls the bounciness and `tension` the speed. Alternatively you can use `stiffness`, `damping` and `mass`, which are the physics names. Pick one style, not both.

## The native driver

Every animation config needs `useNativeDriver`. TypeScript requires it, and if you leave it out in plain JavaScript you get this warning:

```text
Animated: `useNativeDriver` was not specified. This is a required option and must be explicitly set to `true` or `false`
```

What does it mean? Your JavaScript runs on one thread, and the screen is drawn on another (the UI thread). You met these threads in [How React Native Works Under the Hood](/courses/react-native/how-react-native-works).

- `useNativeDriver: true`: Animated sends the whole animation to the native side **before** it starts. The UI thread then runs every frame by itself. Even if your JavaScript is busy (loading data, rendering a long list), the animation stays smooth.
- `useNativeDriver: false`: each frame is calculated in JavaScript. If JavaScript is busy, the animation stutters.

So use `true` whenever you can. The catch: the native driver only supports **non-layout** properties, mainly `opacity` and `transform` (`translateX`, `translateY`, `scale`, `rotate`). If you try to animate `width`, `height`, `backgroundColor` or margins with it, you get an error like:

```text
Style property 'width' is not supported by native animated module
```

For those, set `useNativeDriver: false`. Often you can get the same look with transforms: `scaleX` instead of `width`, `translateY` instead of `marginTop`.

## interpolate: one value, many styles

One animated value can drive several styles. `interpolate` maps an input range to an output range:

```tsx
const translateY = opacity.interpolate({
  inputRange: [0, 1],
  outputRange: [12, 0],
});
```

When `opacity` is `0`, `translateY` is `12` (12 points lower). When `opacity` is `1`, `translateY` is `0`. In between, it moves smoothly. One animation now fades **and** slides the card.

Outputs can also be strings, like colors or percentages:

```tsx
// src/components/DayProgress.tsx
import { useEffect } from 'react';
import { Animated, View, useAnimatedValue } from 'react-native';

export function DayProgress({ done, total }: { done: number; total: number }) {
  const progress = useAnimatedValue(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: total === 0 ? 0 : done / total,
      duration: 300,
      useNativeDriver: false, // width and color need the JS driver
    }).start();
  }, [done, total, progress]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#F97316', '#22C55E'], // orange to green
  });

  return (
    <View style={{ height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
      <Animated.View style={{ height: 8, width, backgroundColor }} />
    </View>
  );
}
```

This is a progress bar for the Today screen. As the user finishes habits, it grows and turns from orange to green.

## Combining animations

Animated has helpers to combine animations:

- `Animated.sequence([a, b])`: run `a`, then `b`.
- `Animated.parallel([a, b])`: run them at the same time.
- `Animated.stagger(100, [a, b, c])`: start each one 100 ms after the previous.
- `Animated.delay(200)`: wait, for use inside a sequence.
- `Animated.loop(animation)`: repeat forever (or `{ iterations: 3 }`).

A gently pulsing flame for long streaks:

```tsx
// src/components/StreakFlame.tsx
import { useEffect } from 'react';
import { Animated, Easing, useAnimatedValue } from 'react-native';

export function StreakFlame() {
  const pulse = useAnimatedValue(1);

  useEffect(() => {
    const ease = Easing.inOut(Easing.ease);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 600, easing: ease, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop(); // stop when the component goes away
  }, [pulse]);

  return <Animated.Text style={{ fontSize: 32, transform: [{ scale: pulse }] }}>🔥</Animated.Text>;
}
```

Always stop loops in the effect cleanup. A loop on a screen the user left keeps using battery.

`.start()` also accepts a callback that runs when the animation ends: `.start(({ finished }) => { ... })`. `finished` is `false` if the animation was stopped or interrupted early.

## Putting it together in HabitHop

The code panel shows the new `src/components/HabitCard.tsx`. It keeps the same props as before (`habit`, `onToggle` and the optional `onPress`), still works out `doneToday` and `streak` from `habit.doneDates`, and adds two animated values:

- `opacity` starts at `0`. An effect runs a `timing` animation to `1` once, when the card mounts. `translateY` is interpolated from the same value, so the card fades in while sliding up 12 points.
- `scale` starts at `1`. When the done circle is tapped, a `sequence` grows it to `1.3` in 100 ms, then a `spring` brings it back to `1` with a little bounce.

Both use the native driver, because they only touch `opacity` and `transform`.

What you will see: when the Today screen opens, each habit card gently rises into place. Tap the circle and it pops, then wobbles back as it fills with the habit's color.

Note that `doneToday` and the circle's color still come from the habit data, as before. The animation is just the motion on top. That split is a good habit: **state decides what the screen shows, animation decides how it gets there.**

## Common mistakes

**Creating the value without `useRef` or `useAnimatedValue`.** `const opacity = new Animated.Value(0)` inside the component makes a new value on every render, so the animation keeps jumping back to the start. Use `useAnimatedValue(0)`.

**Using a plain `View`.** Passing an animated value to `<View style={{ opacity }}>` does nothing useful, because plain components do not understand animated values. Use `Animated.View`.

**Animating layout styles with the native driver.** `width`, `height`, `top` and colors throw `Style property 'width' is not supported by native animated module`. Use `useNativeDriver: false` for them, or switch to `transform`.

**Forgetting `.start()`.** `Animated.timing(...)` only describes an animation. If nothing moves, check that you called `.start()`.

## Quick recap

- Animated is built into React Native. It moves **animated values** without re-rendering your component.
- Make a value with `useAnimatedValue(0)` (or the older `useRef(new Animated.Value(0)).current`) and use it in an `Animated.View` style.
- `Animated.timing` moves over a set time with an easing. `Animated.spring` moves like a real spring.
- Always set `useNativeDriver`. Use `true` for `opacity` and `transform`, and `false` for layout and colors.
- `interpolate` maps one value to many styles, including colors and percentages.
- Combine with `sequence`, `parallel`, `stagger` and `loop`, and stop loops in effect cleanups.

<code id="code-content" class="language-tsx">
// src/components/HabitCard.tsx
import { useEffect } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useAnimatedValue } from 'react-native';
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
  const opacity = useAnimatedValue(0); // card fades in from 0 to 1
  const scale = useAnimatedValue(1); // done circle "pops"
  // Fade the card in once, when it first appears
  useEffect(() =&gt; {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [opacity]);
  function handlePress() {
    // Grow quickly, then spring back to normal size
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    onToggle(habit.id);
  }
  // Slide up 12 points while fading in
  const translateY = opacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return (
    &lt;Animated.View style={[styles.card, { borderLeftColor: habit.color, opacity, transform: [{ translateY }] }]}&gt;
      &lt;Text style={styles.emoji}&gt;{habit.emoji}&lt;/Text&gt;
      &lt;Pressable style={styles.info} onPress={onPress}&gt;
        &lt;Text style={styles.name}&gt;{habit.name}&lt;/Text&gt;
        &lt;Text style={styles.streak}&gt;🔥 {streak} day streak&lt;/Text&gt;
      &lt;/Pressable&gt;
      &lt;Pressable
        onPress={handlePress}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: doneToday }}
        accessibilityLabel={`Mark ${habit.name} as done today`}
      &gt;
        &lt;Animated.View style={[styles.done, doneToday &amp;&amp; { backgroundColor: habit.color }, { transform: [{ scale }] }]}&gt;
          &lt;Text style={styles.check}&gt;{doneToday ? '✓' : ''}&lt;/Text&gt;
        &lt;/Animated.View&gt;
      &lt;/Pressable&gt;
    &lt;/Animated.View&gt;
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
