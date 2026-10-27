---
publishDate: 2026-10-22T14:00
title: 'Safe Areas: Notches, Status Bars and Home Bars'
slug: safe-areas
metadescription: 'Keep your React Native content away from notches, status bars and home bars with SafeAreaView and useSafeAreaInsets from react-native-safe-area-context.'
updateDate: 2026-10-22T14:00
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'styling', 'safe-area', 'layout']
course: react-native
---

## Why your title hides behind the clock

Make a new screen, put a big "Today" title at the top, and run it on a modern iPhone. The title sits right under the clock and the camera cutout. Part of it may be hidden. On Android the same thing happens with the status bar at the top and the navigation bar at the bottom.

Phones are not simple rectangles anymore. They have:

- a **status bar** at the top (clock, battery, signal)
- a **notch** or **Dynamic Island** (the camera cutout on iPhones)
- rounded corners
- a **home indicator** (the thin bar at the bottom of an iPhone) or Android's **navigation bar** (gesture bar or back/home buttons)

The part of the screen that none of these cover is called the **safe area**. Your important content (text, buttons) should stay inside it. Backgrounds and colors can go edge to edge, which looks modern and nice.

In this lesson you will learn the two tools that do this, `SafeAreaView` and `useSafeAreaInsets`, both from the **react-native-safe-area-context** library. It is already installed in every new Expo project.

## Android draws edge to edge

On iOS, apps have always drawn behind the status bar. Android used to give apps a separate strip below the status bar, but no more. Android apps built with this version of Expo are **edge to edge**: your app draws behind the status bar at the top and the navigation bar at the bottom, just like on iOS.

That is good news, because both platforms now behave the same way, and one set of tools handles both. But it also means you can never assume "Android will push my content down for me". It will not.

## Use the right SafeAreaView

React Native itself has an old component called `SafeAreaView`. **Do not use it.** It only works on iOS, it ignores Android completely, and it is deprecated. If you import it from `react-native`, you get this warning in the terminal:

```text
WARN  SafeAreaView has been deprecated and will be removed in a future release. Please use 'react-native-safe-area-context' instead. See https://github.com/AppAndFlow/react-native-safe-area-context
```

Always import it from the library instead:

```tsx
// src/app/index.tsx
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Text style={{ fontSize: 32, fontWeight: '700' }}>Today</Text>
    </SafeAreaView>
  );
}
```

`SafeAreaView` is a normal `View` that adds padding on each side equal to what the phone covers there. On an iPhone with a Dynamic Island that is around 59 points on top and 34 at the bottom. On a phone without a notch it might be just the status bar height. You never hard-code these numbers. The library measures them on the real device.

Now the title sits just below the clock on every phone. Do not forget `style={{ flex: 1 }}`, or the view will only be as tall as its content.

### Where does the provider come from?

The library works with a **provider**: a component near the top of the app that measures the safe area and shares it with everything inside. Normally you would wrap your app in `<SafeAreaProvider>`. With Expo Router you do not need to: the router already wraps your whole app in one. Just import and use.

## Choosing edges

By default `SafeAreaView` pads all four sides. Often you want only some of them. The `edges` prop lets you choose:

```tsx
// src/app/index.tsx (part)
<SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
  {/* content */}
</SafeAreaView>
```

The left and right edges matter when the phone is turned sideways: the notch is then on the left or right side.

When would you skip an edge?

- **The screen has a header.** Expo Router's Stack header (you will meet it in [Stack Navigation and Headers](/courses/react-native/stack-navigation)) already sits below the status bar. Add another top padding and you get a big empty gap. On such screens use `edges={['bottom', 'left', 'right']}`, or no `SafeAreaView` at all.
- **The screen has a tab bar.** The tab bar already keeps itself above the home indicator, so you do not need bottom padding on tab screens.
- **You want a colored footer** that runs behind the home bar. More on that below.

You can also pass an object to say how each edge should combine with your own padding:

```tsx
// src/components/Footer.tsx (part)
<SafeAreaView edges={{ bottom: 'maximum' }} style={{ paddingBottom: 16 }}>
  {/* footer content */}
</SafeAreaView>
```

- `'additive'` (the default): safe area **plus** your padding. On an iPhone that is 34 + 16 = 50.
- `'maximum'`: the **bigger** of the two. On an iPhone that is 34, on a phone without a home bar it is 16. Great for footers, where you want some space, but not double space.
- `'off'`: no safe area on that edge.

There is also a `mode` prop. `mode="padding"` is the default. `mode="margin"` adds margin instead, which is handy when the view has a background you do not want to stretch.

## useSafeAreaInsets: the numbers yourself

Sometimes you want the raw numbers. The hook **`useSafeAreaInsets`** returns them. **Insets** are the distances, in points, that the phone covers on each side:

```tsx
// src/components/InsetInfo.tsx
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function InsetInfo() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <Text>top: {insets.top}, bottom: {insets.bottom}</Text>
    </View>
  );
}
```

On an iPhone 16 you might see:

```text
top: 59, bottom: 34
```

Use the hook when padding the whole view is not what you want. Common cases:

- a floating "Add habit" button that must sit above the home bar: `bottom: insets.bottom + 16`
- a footer whose **background** fills the area behind the home bar while its **content** stays above it
- an absolutely positioned close button in the top corner of a full-screen photo

`SafeAreaView` is simpler and slightly smoother when the phone rotates, because the padding is applied on the native side right away. Use it by default, and use the hook for special layouts.

## The status bar

The status bar text (clock, battery) can be dark or light. If your screen is white, you want dark text. If your header is dark purple, you want light text. The **`expo-status-bar`** package controls this:

```tsx
// src/app/_layout.tsx (part)
import { StatusBar } from 'expo-status-bar';

// inside your component:
<StatusBar style="auto" />
```

- `style="auto"`: dark text in light mode, light text in dark mode. A good default.
- `style="dark"` or `style="light"`: force one.
- `hidden`: hide the bar, for example on a full-screen video.

The status bar has no background color of its own anymore. Whatever your screen draws behind it shows through. So to "color the status bar", you color the top of your screen.

## Putting it together in HabitHop

Here is the HabitHop Today screen with all of these ideas. The full code is in the code panel.

1. `SafeAreaView` with `edges={['top', 'left', 'right']}` keeps the title below the status bar and the notch.
2. The bottom edge is skipped on purpose. Instead, the purple "Add a habit" footer reads `insets.bottom` and uses it as padding:

```tsx
// src/app/index.tsx (part)
<View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
  <Text style={styles.footerText}>+ Add a habit</Text>
</View>
```

The purple color runs all the way to the bottom edge of the glass, behind the home indicator, which looks clean. The text stays above it. `Math.max(insets.bottom, 12)` makes sure phones without a home bar still get some breathing room. (This is the same idea as the `'maximum'` edge mode.)

3. `<StatusBar style="dark" />` keeps the clock readable on the white screen.

On an iPhone you see the title right under the Dynamic Island, the list in the middle, and a purple bar at the bottom whose text sits just above the home indicator. On Android the title sits under the status bar and the purple reaches behind the gesture bar.

### Scroll views on iOS

A `ScrollView` has one more trick on iOS: `contentInsetAdjustmentBehavior="automatic"`. With it, iOS adds the safe area as extra space inside the scroll view, so content starts below the status bar but can scroll behind it. This only works on iOS, so on Android you still need `SafeAreaView` or the insets. It is mostly useful with native headers, which you will meet in the navigation lessons.

## Testing safe areas

You need the right devices to see these problems:

- An iOS simulator with a Dynamic Island (any recent iPhone) shows the top and bottom insets. You need a Mac for the simulator. Without one, use a real iPhone with Expo Go or a development build made with EAS Build.
- An Android emulator with gesture navigation shows a thin bottom inset. With 3-button navigation the bottom inset is bigger.
- Rotate the device to check the left and right insets.
- On web, the insets are usually 0, which is fine.

## Common mistakes

**1. Importing SafeAreaView from react-native.** You see the deprecation warning above, and Android content still goes under the status bar. Fix: `import { SafeAreaView } from 'react-native-safe-area-context';`

**2. A big empty gap under the header.** You wrapped a screen that already has a Stack header in a full `SafeAreaView`, so the top inset is added twice. Fix: use `edges={['bottom', 'left', 'right']}` on screens with a header.

**3. The SafeAreaView does not fill the screen.** The background color only covers the top part. Fix: add `style={{ flex: 1 }}`.

**4. Hard-coding a status bar height.** Something like `paddingTop: 44` looks fine on one phone and wrong on all others. Fix: use `SafeAreaView` or `useSafeAreaInsets().top`.

## Quick recap

- The **safe area** is the part of the screen no notch, status bar or home bar covers. Keep text and buttons in it, let backgrounds go edge to edge.
- Android apps draw edge to edge now, just like iOS, so you handle both the same way.
- Use `SafeAreaView` from `react-native-safe-area-context`, never the deprecated one from `react-native`.
- Expo Router already adds the `SafeAreaProvider` for you.
- `edges` picks which sides get padding. Skip `top` on screens with a header.
- `useSafeAreaInsets()` gives you the numbers for floating buttons and colored footers.
- `expo-status-bar` sets dark or light status bar text. Next up: [Writing Platform-Specific Code](/courses/react-native/platform-specific-code).

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  return (
    // Top, left and right are kept clear. The bottom is handled by hand below.
    &lt;SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}&gt;
      &lt;StatusBar style="dark" /&gt;
      &lt;Text style={styles.title}&gt;Today&lt;/Text&gt;
      &lt;ScrollView contentContainerStyle={styles.list}&gt;
        {['💧 Drink water', '📚 Read 10 pages', '🧘 Stretch'].map((item) =&gt; (
          &lt;View key={item} style={styles.card}&gt;
            &lt;Text style={styles.cardText}&gt;{item}&lt;/Text&gt;
          &lt;/View&gt;
        ))}
      &lt;/ScrollView&gt;
      {/* The footer bar paints its color behind the home bar, but keeps its button above it */}
      &lt;View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}&gt;
        &lt;Text style={styles.footerText}&gt;+ Add a habit&lt;/Text&gt;
      &lt;/View&gt;
    &lt;/SafeAreaView&gt;
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  title: { fontSize: 32, fontWeight: '700', paddingHorizontal: 16 },
  list: { padding: 16, gap: 12 },
  card: { padding: 16, borderRadius: 14, backgroundColor: '#F4F2FF' },
  cardText: { fontSize: 17 },
  footer: { backgroundColor: '#7C5CFC', paddingTop: 12, alignItems: 'center' },
  footerText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
</code></pre>
