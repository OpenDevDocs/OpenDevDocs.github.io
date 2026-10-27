---
publishDate: 2026-10-22T15:30
title: Writing Platform-Specific Code
slug: platform-specific-code
metadescription: 'Run different code on iOS, Android and web in React Native with Platform.OS, Platform.select and platform file extensions like .ios.tsx and .web.tsx.'
updateDate: 2026-10-22T15:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'platform', 'ios', 'android', 'web']
course: react-native
---

## One codebase, three platforms

The big promise of React Native is that you write your app once and it runs on iOS, Android and the web. Most of the time that is true. But now and then you want something different on one platform:

- iPhone users expect rounded buttons and a "swipe down to close" hint. Android users expect a ripple effect and the back button.
- A font that exists on iOS does not exist on Android.
- Shadows are made in a different way on each platform.
- A feature only works in the browser, or only on phones.

React Native gives you three tools for this, from small to big:

1. `Platform.OS`: a value that tells you where the code is running. Good for a single `if`.
2. `Platform.select`: picks one value from a list, per platform. Good for styles and small values.
3. **Platform-specific files** like `Button.ios.tsx`: a whole different file per platform. Good when the differences are large.

You will use all three on a HabitHop "done" button.

## Platform.OS

Import `Platform` from `react-native` and read `Platform.OS`:

```tsx
// src/app/index.tsx (part)
import { Platform, Text } from 'react-native';

export default function Index() {
  const greeting = Platform.OS === 'web' ? 'Welcome, web friend!' : 'Welcome back!';
  return <Text>{greeting}</Text>;
}
```

`Platform.OS` is a string. For an Expo app it is one of:

- `'ios'` on iPhone and iPad
- `'android'` on Android phones and tablets
- `'web'` in the browser

It never changes while the app runs, so you can safely use it anywhere: in components, in plain functions, even at the top of a file.

### Platform.Version

`Platform.Version` tells you the version of the operating system. Careful, it has a different type on each platform:

- On iOS it is a **string**, like `'18.2'`.
- On Android it is a **number**: the **API level**, like `35` for Android 15. Android uses API levels to name its versions.

TypeScript knows this. If you check `Platform.OS` first, it knows which type `Platform.Version` has:

```tsx
// src/components/VersionNote.tsx
import { Platform, Text } from 'react-native';

export function VersionNote() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    return <Text>Android 13 or newer</Text>;
  }
  if (Platform.OS === 'ios' && Platform.isPad) {
    return <Text>Hello, iPad user!</Text>;
  }
  return null;
}
```

This trick, where TypeScript learns more about a value from an `if`, is called **narrowing**. `Platform.isPad` only exists on iOS, so you can only read it after checking for `'ios'`. You rarely need version checks, but they are useful when a feature only exists on newer phones.

## Platform.select

When you need a different **value** per platform, `Platform.select` is shorter than an `if`. You give it an object with one key per platform, and it returns the value for the current one:

```tsx
// src/constants/hints.ts
import { Platform } from 'react-native';

export const closeHint = Platform.select({
  ios: 'Swipe down to close',
  android: 'Press back to close',
  default: 'Press Esc to close',
});
```

The keys you can use:

- `ios`, `android`, `web`: one platform each.
- `native`: both iOS and Android (anything that is not web).
- `default`: everything that has no key of its own.

The lookup goes from most specific to least: on Android it uses `android` if you gave one, then `native`, then `default`.

Always think about the platforms you did **not** list. Without a `default`, a platform with no key gets `undefined`. TypeScript will not warn you about this (the result type is just `string` here), so it is on you. That is why the template writes `Platform.select({ ios: 50, android: 80 }) ?? 0` in `src/constants/theme.ts`: on web there is no key, so the `?? 0` gives a safe fallback.

### Platform.select in styles

`Platform.select` really shines in styles. Shadows are the classic example. iOS uses four `shadow` properties, Android uses `elevation` (a number for how high the view "floats"), and on the web you use `boxShadow`:

```tsx
// src/app/index.tsx (part)
const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
      default: { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
    }),
  },
});
```

The `...` (spread) copies the chosen object into the style. On iOS the card gets the shadow props, on Android it gets `elevation`. (React Native also supports `boxShadow` on iOS and Android now, so in new code you can use that one everywhere. You will still see this pattern in lots of existing code.)

Fonts are another good fit, because each platform has different built-in fonts:

```tsx
// src/app/index.tsx (part)
title: {
  fontSize: 28,
  fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'system-ui' }),
},
```

The template does the same with its `Fonts` object in `src/constants/theme.ts`. Have a look: it uses `ios`, `web` and `default` keys. For your own fonts, see [Custom Fonts and Icons](/courses/react-native/fonts-and-icons).

## Platform-specific files

When a component is very different on each platform, a pile of `if`s gets messy. Instead, you can write **separate files**. Metro, the tool that bundles your JavaScript (you met it in [The Dev Server, Fast Refresh and the Dev Menu](/courses/react-native/dev-server-and-fast-refresh)), picks the right file by its extension:

```text
src/components/
  DoneButton.tsx        <- used on Android and web
  DoneButton.ios.tsx    <- used on iOS
```

Everywhere else in your app you import it **without** the extension part:

```tsx
// src/app/index.tsx (part)
import { DoneButton } from '@/components/DoneButton';
```

When Metro builds for iOS it looks for `DoneButton.ios.tsx` first and finds it. When it builds for Android it looks for `DoneButton.android.tsx`, then `DoneButton.native.tsx`, then falls back to `DoneButton.tsx`.

The extensions you can use:

| File | Used on |
| --- | --- |
| `Name.ios.tsx` | iOS |
| `Name.android.tsx` | Android |
| `Name.native.tsx` | iOS and Android (if there is no `.ios` or `.android` file) |
| `Name.web.tsx` | Web |
| `Name.tsx` | Everything else, the fallback |

### The template already does this

Open the default project and you will find several `.web` files:

```text
src/components/animated-icon.tsx
src/components/animated-icon.web.tsx
src/components/app-tabs.tsx
src/components/app-tabs.web.tsx
src/hooks/use-color-scheme.ts
src/hooks/use-color-scheme.web.ts
```

For example, `use-color-scheme.ts` is a one-liner that re-exports React Native's hook. The `.web.ts` version adds extra code that the web needs, because web pages can be rendered on a server first, where there is no "light or dark" yet. Phones never load that extra code.

### Always keep a fallback file

**TypeScript does not know about platform extensions.** When you write `import { DoneButton } from '@/components/DoneButton'`, TypeScript looks for `DoneButton.tsx` exactly. If you only have `DoneButton.ios.tsx` and `DoneButton.android.tsx`, Metro is happy but TypeScript shows:

```text
Cannot find module '@/components/DoneButton' or its corresponding type declarations.
```

So always keep a plain `DoneButton.tsx` (it is also your web version), and make sure every file exports **the same names with the same props**. TypeScript only checks the plain file against the rest of the app, so if `DoneButton.ios.tsx` takes different props, you will only find out when the app breaks on an iPhone.

The same rule applies to route files in `src/app`: if you make `about.web.tsx`, you also need a plain `about.tsx`, so the router has a route for every platform.

## Putting it together in HabitHop

Here is the HabitHop "done" button in two files. The Android and web version uses a square-ish button with a **ripple** (the circle effect that spreads from your finger on Android):

```tsx
// src/components/DoneButton.tsx
// Used on Android and web (any platform without its own file)
import { Pressable, StyleSheet, Text } from 'react-native';

type DoneButtonProps = { done: boolean; onPress: () => void };

export function DoneButton({ done, onPress }: DoneButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(0,0,0,0.15)', borderless: false }}
      style={[styles.button, done && styles.done]}>
      <Text style={[styles.text, done && styles.doneText]}>{done ? 'DONE' : 'MARK DONE'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 4, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  done: { backgroundColor: '#22C55E' },
  text: { fontWeight: '700', letterSpacing: 0.5 },
  doneText: { color: '#fff' },
});
```

The iOS version is a rounded pill that fades when pressed, with iOS system colors:

```tsx
// src/components/DoneButton.ios.tsx
// iOS gets a rounded, softer button that fades when pressed
import { Pressable, StyleSheet, Text } from 'react-native';

type DoneButtonProps = { done: boolean; onPress: () => void };

export function DoneButton({ done, onPress }: DoneButtonProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, done && styles.done, pressed && { opacity: 0.6 }]}>
      <Text style={[styles.text, done && styles.doneText]}>{done ? 'Done' : 'Mark done'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#F2F2F7' },
  done: { backgroundColor: '#34C759' },
  text: { fontWeight: '600', color: '#007AFF' },
  doneText: { color: '#fff' },
});
```

Both files export `DoneButton` with the same props. The Today screen in the code panel imports it once and does not care which one it gets. It also uses `Platform.OS`, `Platform.Version` and `Platform.select` for the font and the card shadow.

Run it on both platforms. On iOS you see a blue "Mark done" pill that turns green. On Android you see a grey "MARK DONE" button with a ripple. If you open the web version (press `w` in the terminal), you get the Android and web file. If you want to learn more about pressing and ripples, see [Buttons and Pressable](/courses/react-native/buttons-and-pressable).

## How much should differ?

Be careful not to overdo it. Every platform branch is code you have to test twice. A good rule:

- Use the **same** layout, colors and logic everywhere.
- Use `Platform.select` for small native details: shadows, fonts, hints.
- Use separate files only when a component is truly different, or uses a library that only exists on one platform.

## Common mistakes

**1. Only platform files, no fallback.** TypeScript says `Cannot find module ... or its corresponding type declarations`, and the web build fails. Fix: add a plain `Name.tsx`.

**2. Different props in each file.** Your app works on Android but crashes or looks wrong on iOS. Fix: give each platform file the same props type. You can put the type in a shared file, such as `DoneButton.types.ts`, and import it in all versions.

**3. Comparing Platform.Version as a number on iOS.** `Platform.Version >= 17` mixes a string (iOS) with a number. TypeScript says `Operator '>=' cannot be applied to types 'string | number' and 'number'.` Fix: check `Platform.OS` first, or use `parseInt(Platform.Version, 10)` on iOS.

**4. Forgetting web.** `Platform.select({ ios: 10, android: 20 })` is `undefined` on web, and your style quietly breaks. TypeScript does not catch it. Fix: add a `default` key, or use `?? fallback`.

## Quick recap

- `Platform.OS` is `'ios'`, `'android'` or `'web'`. Use it for simple `if` checks.
- `Platform.Version` is a string on iOS and an API level number on Android.
- `Platform.select({ ios, android, web, native, default })` returns one value per platform. Always add `default` (or `??`) so web is covered, since TypeScript will not remind you.
- Files like `Name.ios.tsx`, `Name.android.tsx`, `Name.native.tsx` and `Name.web.tsx` are picked by Metro automatically. Import them without the extension.
- Always keep a plain `Name.tsx` fallback with the same exports and props, because TypeScript only sees that one.
- Next, make your app look good at night with [Dark Mode and Themes](/courses/react-native/dark-mode-and-themes).

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DoneButton } from '@/components/DoneButton';
export default function TodayScreen() {
  const [done, setDone] = useState(false);
  // Platform.OS is 'ios', 'android' or 'web'
  const greeting = Platform.OS === 'web' ? 'Welcome, web friend!' : 'Welcome back!';
  // Platform.Version is a string on iOS ('18.2') and a number on Android (API level, like 35)
  const versionText = `${Platform.OS} ${Platform.Version}`;
  return (
    &lt;SafeAreaView style={styles.screen}&gt;
      &lt;Text style={styles.title}&gt;{greeting}&lt;/Text&gt;
      &lt;Text style={styles.small}&gt;Running on {versionText}&lt;/Text&gt;
      &lt;View style={styles.card}&gt;
        &lt;Text style={styles.name}&gt;💧 Drink water&lt;/Text&gt;
        {/* Metro picks DoneButton.ios.tsx on iPhone and DoneButton.tsx elsewhere */}
        &lt;DoneButton done={done} onPress={() =&gt; setDone(!done)} /&gt;
      &lt;/View&gt;
    &lt;/SafeAreaView&gt;
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 8 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    // A different font for each platform
    fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'system-ui' }),
  },
  small: { color: '#666' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    // Shadows: iOS uses shadow props, Android uses elevation, web uses boxShadow
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
      default: { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
    }),
  },
  name: { fontSize: 17, fontWeight: '600' },
});
</code></pre>
