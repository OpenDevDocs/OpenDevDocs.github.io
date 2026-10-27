---
publishDate: 2026-10-24T20:00
title: Entering, Exiting and Layout Animations
slug: layout-animations
metadescription: 'Animate views as they appear, disappear and move with Reanimated layout animations: entering, exiting, LinearTransition and animated FlatList rows.'
updateDate: 2026-10-24T20:00
author: ['bishal-biswas']
level: 3
tags: ['react-native', 'animations', 'reanimated']
course: react-native
---

## The problem: things that pop

Add a habit in HabitHop right now and it just **appears** in the list. Delete one and it **vanishes**, and every card below it jumps up instantly. Nothing is broken, but it feels harsh. Your eye cannot follow what happened.

**Layout animations** fix this. They animate a view when it:

- **enters**: it is added to the screen (mounted)
- **exits**: it is removed from the screen (unmounted)
- **moves**: its position or size changes because something else changed (its **layout**)

The best part: with Reanimated, each of these is a single prop. No shared values, no `useAnimatedStyle`, no effects. You already have Reanimated from [Smooth Animations with Reanimated](/courses/react-native/reanimated-basics), and layout animations work in Expo Go.

## Entering and exiting

Any Reanimated component (`Animated.View`, `Animated.Text` and so on, from `react-native-reanimated`) accepts `entering` and `exiting` props:

```tsx
// src/components/ToggleBox.tsx
import { useState } from 'react';
import { Button, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export function ToggleBox() {
  const [show, setShow] = useState(true);

  return (
    <View>
      <Button title={show ? 'Hide' : 'Show'} onPress={() => setShow((s) => !s)} />
      {show && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={{ width: 100, height: 100, backgroundColor: '#22C55E' }}
        />
      )}
    </View>
  );
}
```

What you will see: tap "Hide" and the green box fades out instead of disappearing. Tap "Show" and it fades back in.

This is interesting, because normally when React removes a component, it is gone immediately. With `exiting`, Reanimated keeps a copy of the view on screen just long enough to play the animation, then removes it. You keep writing normal conditional rendering (`{show && ...}`) and the animation is added on top.

## The ready-made animations

Reanimated ships a big set of **presets**. Each comes in an "In" version for `entering` and an "Out" version for `exiting`:

| Family | Entering examples | Exiting examples |
| --- | --- | --- |
| Fade | `FadeIn`, `FadeInDown`, `FadeInUp`, `FadeInLeft` | `FadeOut`, `FadeOutLeft` |
| Slide | `SlideInRight`, `SlideInDown` | `SlideOutLeft`, `SlideOutUp` |
| Zoom | `ZoomIn`, `ZoomInDown` | `ZoomOut` |
| Bounce | `BounceIn`, `BounceInUp` | `BounceOut` |
| Flip, Stretch, Rotate, LightSpeed, Pinwheel, Roll | `FlipInXUp`, `StretchInX`, and more | matching "Out" versions |

`FadeInDown` fades in while sliding down into place. `FadeOutLeft` fades out while sliding to the left. These two cover most everyday needs.

## Customizing with modifiers

Every preset is a **builder**: you can chain methods to change it.

```tsx
<Animated.View entering={FadeIn.duration(600).delay(200)} />

<Animated.View
  entering={SlideInRight.springify().damping(15)}
  exiting={SlideOutLeft.easing(Easing.in(Easing.quad))}
/>
```

The most useful modifiers:

- `.duration(ms)`: how long it takes (the presets default to about 300 ms).
- `.delay(ms)`: wait before starting. Great for a **staggered** list where each row starts a bit later: `FadeInDown.delay(index * 50)`.
- `.springify()`: use spring physics instead of a fixed duration. Follow it with `.damping()`, `.stiffness()` or `.mass()` to tune it.
- `.easing(...)`: choose the easing curve (import `Easing` from react-native-reanimated).
- `.withCallback((finished) => ...)`: run code when it ends. The callback is a worklet, so use `scheduleOnRN` to call your own JavaScript, as you learned in the Reanimated lesson.
- `.reduceMotion(...)`: by default, layout animations follow the phone's Reduce Motion setting. You can override it, but you rarely should.

## Your own animation with Keyframe

If no preset fits, describe your own with `Keyframe`. You list the style at different points of the animation, from `0` (start) to `100` (end), like CSS keyframes:

```tsx
// src/components/StreakBadge.tsx
import { Text } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

const pop = new Keyframe({
  0: { transform: [{ scale: 0.5 }], opacity: 0 },
  60: { transform: [{ scale: 1.15 }], opacity: 1 },
  100: { transform: [{ scale: 1 }] },
}).duration(500);

export function StreakBadge({ days }: { days: number }) {
  return (
    <Animated.View entering={pop}>
      <Text>🔥 {days}</Text>
    </Animated.View>
  );
}
```

The badge grows from half size, overshoots a little at 60%, and settles. Define the `Keyframe` outside the component so it is created once, not on every render.

## Layout transitions: animating movement

Entering and exiting handle the view that appears or disappears. But what about its **neighbors**? When a card is deleted, the cards below it move up to fill the gap. To animate that move, use the `layout` prop with a **layout transition**:

```tsx
import Animated, { LinearTransition } from 'react-native-reanimated';

<Animated.View layout={LinearTransition} />
```

Now, whenever this view's position or size changes for any reason (a sibling removed, text grew, flex changed), it glides to its new spot instead of jumping.

`LinearTransition` is the one you will use most. It also accepts modifiers, like `LinearTransition.springify()` or `LinearTransition.duration(200)`. There are a few others for special effects, such as `FadingTransition`, `SequencedTransition`, `JumpingTransition` and `CurvedTransition`.

## Lists: Animated.FlatList

Lists need a little extra help. In a `FlatList`, each row is wrapped in an internal "cell" view, and it is that cell that moves when rows change. Reanimated's `Animated.FlatList` has a prop for exactly this:

```tsx
<Animated.FlatList
  data={habits}
  itemLayoutAnimation={LinearTransition}
  renderItem={({ item }) => (
    <Animated.View entering={FadeInDown} exiting={FadeOutLeft}>
      {/* row content */}
    </Animated.View>
  )}
/>
```

- `itemLayoutAnimation` animates the rows moving. It only works with a single-column list (`numColumns` of 1).
- `entering` and `exiting` go on an `Animated.View` inside each row, as usual.
- `skipEnteringExitingAnimations` skips the entering animations for the rows that are already there when the list first appears, and the exiting ones when the whole list unmounts. Without it, every row of a 20-habit list fades in when the screen opens, which gets tiring fast.

There is also a `LayoutAnimationConfig` component that does the same for any part of the tree: `<LayoutAnimationConfig skipEntering>` around some views skips their entering animations on first mount.

You first built the Today list in [Long Lists with FlatList](/courses/react-native/flatlist). `Animated.FlatList` takes all the same props, so the change is small.

## Putting it together in HabitHop

The code panel shows the updated `src/app/(tabs)/index.tsx`. Here is what changed:

1. The list is now an `Animated.FlatList` with `itemLayoutAnimation={LinearTransition.springify()}` and `skipEnteringExitingAnimations`.
2. Each row is an `Animated.View` with `entering={FadeInDown.springify()}` and `exiting={FadeOutLeft.duration(250)}`. Inside it is the usual `HabitCard` and a small 🗑 button.
3. The 🗑 button asks for confirmation with `Alert.alert` (from [Modals and Alerts](/courses/react-native/modal-and-alert)), then calls `deleteHabit`.
4. The empty state fades in with `entering={FadeIn.duration(400)}` instead of popping.

You do not need to touch `HabitCard` itself. It keeps its swipe gesture from [Swipes and Drags with Gesture Handler](/courses/react-native/gestures). Layout animations sit on the wrapper around it.

What you will see:

- Open the Today tab: the list is simply there, no animation (thanks to `skipEnteringExitingAnimations`).
- Add a habit from the New Habit modal and go back: the new card drops in softly from above.
- Delete "Read 10 pages": it slides out to the left while fading, and the cards below spring smoothly up to close the gap.
- Delete the last habit: the "No habits yet" message fades in.

## A note on React Native's LayoutAnimation

React Native itself has an older API called `LayoutAnimation`. You call `LayoutAnimation.configureNext(...)` just before a state change, and the next layout change animates. It needs no library, but it animates everything on the screen at once and gives you little control. On Android it has a history of glitches. For new code, Reanimated's per-component `entering`, `exiting` and `layout` props are clearer and more reliable.

## Common mistakes

**Using a plain `View`.** `entering` on a React Native `View` does nothing. Use `Animated.View` from react-native-reanimated.

**Putting `exiting` on the wrong element.** The exiting animation only plays on the view that is actually removed. If you put `exiting` on a child, but the parent is what disappears, nothing animates. Put it on the outermost view that gets unmounted.

**Every row animates on first load.** That is `entering` doing its job on mount. Add `skipEnteringExitingAnimations` to `Animated.FlatList`, or wrap the area in `<LayoutAnimationConfig skipEntering>`.

**Rows jump instead of gliding in a FlatList.** `layout` on the row's inner view does not move the FlatList cell. Use `itemLayoutAnimation` on `Animated.FlatList` instead.

## Quick recap

- Layout animations animate views as they enter, exit, or move, with one prop each.
- `entering={FadeIn}` and `exiting={FadeOut}` work on any Reanimated component, even with plain conditional rendering.
- Presets come in families (Fade, Slide, Zoom, Bounce and more). Customize with `.duration()`, `.delay()`, `.springify()` and `.easing()`.
- `Keyframe` lets you design your own entering or exiting animation.
- `layout={LinearTransition}` animates position and size changes.
- In lists, use `Animated.FlatList` with `itemLayoutAnimation`, and `skipEnteringExitingAnimations` to avoid animating the first render.

<code id="code-content" class="language-tsx">
// src/app/(tabs)/index.tsx
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { HabitCard } from '@/components/HabitCard';
import { useHabits } from '@/context/HabitsContext';
import type { Habit } from '@/types/habit';
export default function TodayScreen() {
  const { habits, toggleToday, deleteHabit } = useHabits();
  function confirmDelete(habit: Habit) {
    Alert.alert(`Delete "${habit.name}"?`, 'Its streak will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () =&gt; deleteHabit(habit.id) },
    ]);
  }
  if (habits.length === 0) {
    // The empty message fades in instead of popping
    return (
      &lt;Animated.View entering={FadeIn.duration(400)} style={styles.empty}&gt;
        &lt;Text style={styles.emptyText}&gt;No habits yet. Tap + to add one 🐇&lt;/Text&gt;
      &lt;/Animated.View&gt;
    );
  }
  return (
    &lt;Animated.FlatList
      data={habits}
      keyExtractor={(h) =&gt; h.id}
      contentContainerStyle={styles.list}
      // Rows that stay on screen glide to their new place
      itemLayoutAnimation={LinearTransition.springify()}
      // No entering animation for rows already there when the screen opens
      skipEnteringExitingAnimations
      renderItem={({ item }) =&gt; (
        &lt;Animated.View entering={FadeInDown.springify()} exiting={FadeOutLeft.duration(250)} style={styles.row}&gt;
          &lt;View style={styles.card}&gt;
            &lt;HabitCard
              habit={item}
              onToggle={toggleToday}
              onPress={() =&gt; router.push({ pathname: '/habit/[id]', params: { id: item.id } })}
            /&gt;
          &lt;/View&gt;
          &lt;Pressable onPress={() =&gt; confirmDelete(item)} accessibilityLabel={`Delete ${item.name}`} hitSlop={8}&gt;
            &lt;Text style={styles.trash}&gt;🗑&lt;/Text&gt;
          &lt;/Pressable&gt;
        &lt;/Animated.View&gt;
      )}
    /&gt;
  );
}
const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { flex: 1 },
  trash: { fontSize: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#6B7280', textAlign: 'center' },
});
</code></pre>
