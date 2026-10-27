---
publishDate: 2026-10-23T08:00
title: Links and Navigating in Code
slug: links-and-navigating
metadescription: 'Move between screens with the Expo Router Link component and the router object: push, navigate, replace, back, dismissTo and href objects with params.'
updateDate: 2026-10-23T08:00
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'expo-router', 'navigation']
course: react-native
---

## Two ways to move between screens

There are two ways to go to another screen in Expo Router:

1. **`Link`**: a component. You put it in your JSX, the user taps it, and the app navigates. Use it when the tap itself is the whole job.
2. **The router**: a set of functions like `router.push('/stats')` that you call from your own code. Use it when navigation happens *after* something else: saving a form, deleting a habit, finishing a sign-in.

Both use the same addresses (routes) you learned in [How Expo Router Works](/courses/react-native/expo-router-basics), and both are type-checked when typed routes are on. In this lesson you will use them to make HabitHop's habit rows tappable.

## The Link component

The simplest link looks like a web link:

```tsx
import { Link } from 'expo-router';

<Link href="/stats">See your stats</Link>
```

`href` is the route to open. On a phone, `Link` renders as a `Text` component that responds to taps, so you style it with normal [text styles](/courses/react-native/stylesheet-basics):

```tsx
<Link href="/stats" style={{ color: '#7C5CFC', fontSize: 17, fontWeight: '600' }}>
  See your stats
</Link>
```

On the web, the same `Link` becomes a real `<a href="/stats">` tag, so it works with right click, "open in new tab" and search engines.

### Links that look like buttons: asChild

Text links are fine, but most app buttons are a `Pressable` with a background. To make a `Pressable` act as a link, wrap it and add `asChild`:

```tsx
import { Link } from 'expo-router';
import { Pressable, Text } from 'react-native';

<Link href="/stats" asChild>
  <Pressable style={{ padding: 14, borderRadius: 12, backgroundColor: '#7C5CFC' }}>
    <Text style={{ color: 'white', textAlign: 'center' }}>Open stats</Text>
  </Pressable>
</Link>
```

**`asChild`** means "do not draw your own text, give your `onPress` and link behavior to my child instead". The child must be a single component that accepts `onPress`, like `Pressable`. You used this already for the header button in [Stack Navigation and Headers](/courses/react-native/stack-navigation).

## How the stack reacts: push, navigate and replace

When you are inside a stack, there is more than one way to "go to" a screen. `Link` has three switches for this:

```tsx
<Link href="/stats">Stats</Link>          {/* navigate (the default) */}
<Link href="/stats" push>Stats</Link>     {/* always push a new copy */}
<Link href="/settings" replace>Settings</Link> {/* swap the current screen */}
```

What each one does to the pile of screens:

- **navigate** (default): pushes the screen on top, unless you are *already on that same route*. Then it just updates that screen instead of stacking a duplicate.
- **push**: always adds a new card, even if it is the same route. Useful for things like "related habit" links where you want `/habit/h1` on top of `/habit/h2` on top of `/habit/h1`.
- **replace**: removes the current screen and puts the new one in its place. The back button skips the old screen. Great after a sign-in: you do not want "Back" to return to the sign-in form.

There is also `dismissTo`:

```tsx
<Link href="/" dismissTo>Back to Today</Link>
```

**dismissTo** pops screens off the stack until it reaches `/`. If `/` is not in the stack at all, it replaces the current screen with it. It is the "go all the way back home" button.

## Navigating from code with useRouter

Inside a component, get the router with the `useRouter` hook:

```tsx
import { useRouter } from 'expo-router';

export default function SomeScreen() {
  const router = useRouter();
  // ...
  router.push('/stats');
}
```

The router has the same actions as `Link`, plus a few more:

| Call | What it does |
| --- | --- |
| `router.navigate('/stats')` | Same as a normal `Link`. |
| `router.push('/stats')` | Always pushes a new screen. |
| `router.replace('/settings')` | Swaps the current screen. |
| `router.back()` | Goes back one screen, like the back button. |
| `router.canGoBack()` | `true` if there is a screen to go back to. |
| `router.dismissTo('/')` | Pops back to that route. |
| `router.dismiss()` | Closes the current screen in a stack (often a modal). |
| `router.setParams({ ... })` | Changes the current screen's params. |

A common pattern after an action, for example after deleting a habit:

```tsx
function handleDelete() {
  deleteHabit(id);
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}
```

Why check `canGoBack()`? If the user opened this screen straight from a link (see [Deep Linking](/courses/react-native/deep-linking)), there may be no screen underneath. Calling `back()` then has nothing to go back to, and Expo Router prints a warning in development. Replacing with `/` always lands somewhere sensible.

### The router outside components

`useRouter` is a hook, so it only works inside components. For plain functions (say, a helper in `src/lib/`), import the `router` object directly. It has exactly the same methods:

```ts
import { router } from 'expo-router';

export function goHome() {
  router.dismissTo('/');
}
```

## Passing data with href objects

So far `href` has been a string. It can also be an **object** with a `pathname` and `params`. This is how you open "the details page for habit h1":

```tsx
<Link href={{ pathname: '/habit/[id]', params: { id: 'h1' } }}>
  Drink water
</Link>
```

`/habit/[id]` is a dynamic route. Expo Router fills `[id]` with `params.id` and opens `/habit/h1`. You will create that screen in the next lesson, [Dynamic Routes and Route Params](/courses/react-native/dynamic-routes).

Why not just write `` href={`/habit/${habit.id}`} ``? That works too. But the object form is better with typed routes: TypeScript knows `/habit/[id]` needs an `id`, and complains if you forget it.

Extra params that are not part of the path become **query params** (the `?key=value` part of a URL):

```tsx
router.push({ pathname: '/habit/[id]', params: { id: 'h1', from: 'stats' } });
// opens /habit/h1?from=stats
```

## Putting it together in HabitHop

Make each `HabitCard` on the Today screen open its details page. The card from [State and Props in a Mobile App](/courses/react-native/state-and-props) takes the `habit` and an `onToggle` function for the round "done" button, and works out the streak by itself. Give it one more optional prop, `onPress`, for a tap on the whole row:

```tsx
// src/components/HabitCard.tsx (props only)
type Props = {
  habit: Habit;
  onToggle: (id: string) => void;
  onPress?: () => void; // new: tap on the whole row
};
```

Inside the card, wrap the row in a `Pressable` with `onPress={onPress}`. Then, on the Today screen, the router is a natural fit because the tap needs the item's id:

```tsx
// src/app/index.tsx
<HabitCard
  habit={item}
  onToggle={toggleToday}
  onPress={() =>
    router.push({ pathname: '/habit/[id]', params: { id: item.id } })
  }
/>
```

The complete screen is in the code panel. It also has a text link and a button-style link to `/stats`, so you can compare all three ways side by side.

What you will see: tapping a habit row tries to open `/habit/h1`. Since that file does not exist yet, Expo Router shows its "Unmatched Route" screen. That is expected, the next lesson builds it. Tapping the round button on the right still ticks the habit without navigating, because the inner `Pressable` handles that touch first.

## Where am I? usePathname and useSegments

Sometimes a component needs to know the current route, for example to highlight a menu item:

```tsx
import { usePathname, useSegments } from 'expo-router';

const pathname = usePathname(); // '/habit/h1'
const segments = useSegments(); // ['habit', '[id]']
```

`usePathname()` gives the real URL path. `useSegments()` gives the route's parts as an array, using the file names. You will use `useSegments` style thinking again in [Protected Routes and a Simple Login Flow](/courses/react-native/protected-routes).

## Common mistakes

**A typo in the route.** With typed routes on, `router.push('/stat')` is a TypeScript error:

```text
error TS2345: Argument of type '"/stat"' is not assignable to parameter of type 'RelativePathString | ExternalPathString | "/stats" | ...'.
```

Fix the path, or create the missing file if you meant a new screen.

**Using asChild with more than one child.** `asChild` needs exactly one child element. `<Link asChild><Text>A</Text><Text>B</Text></Link>` fails. Wrap the content in one `Pressable`.

**Calling useRouter outside a component.** Hooks only work inside components and other hooks. In a plain function, `import { router } from 'expo-router'` instead.

**Navigating while rendering.** Writing `router.replace('/')` directly in a component's body (not in an event handler or effect) runs on every render and can cause errors or loops. Navigate from `onPress`, or render `<Redirect href="/" />`, which you will meet in the protected routes lesson.

## Quick recap

- `Link` is for taps. `href` can be a string like `"/stats"` or an object like `{ pathname: '/habit/[id]', params: { id: 'h1' } }`.
- `asChild` lets a `Pressable` (or any single pressable child) act as the link.
- Default navigation pushes, unless you are already on that route. `push` always adds a screen, `replace` swaps the current one, `dismissTo` pops back to a route.
- In components, `const router = useRouter()`. Outside components, `import { router } from 'expo-router'`.
- `router.back()` goes back. Check `router.canGoBack()` first when a screen might be opened from a link.
- Extra params become query params, like `/habit/h1?from=stats`.

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { Link, useRouter } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { HabitCard } from '@/components/HabitCard';
import { useHabits } from '@/context/HabitsContext';
export default function TodayScreen() {
  const { habits, toggleToday } = useHabits();
  const router = useRouter();
  return (
    &lt;View style={{ flex: 1, padding: 16, gap: 12 }}&gt;
      &lt;FlatList
        data={habits}
        keyExtractor={(item) =&gt; item.id}
        contentContainerStyle={{ gap: 12 }}
        renderItem={({ item }) =&gt; (
          &lt;HabitCard
            habit={item}
            onToggle={toggleToday}
            // Navigate in code when the row is tapped
            onPress={() =&gt;
              router.push({ pathname: '/habit/[id]', params: { id: item.id } })
            }
          /&gt;
        )}
      /&gt;
      {/* A plain text link */}
      &lt;Link href="/stats" style={{ color: '#7C5CFC' }}&gt;
        See your stats
      &lt;/Link&gt;
      {/* A link that wraps your own button */}
      &lt;Link href="/stats" asChild&gt;
        &lt;Pressable style={{ padding: 14, borderRadius: 12, backgroundColor: '#7C5CFC' }}&gt;
          &lt;Text style={{ color: 'white', textAlign: 'center' }}&gt;Open stats&lt;/Text&gt;
        &lt;/Pressable&gt;
      &lt;/Link&gt;
    &lt;/View&gt;
  );
}
</code></pre>
