---
publishDate: 2026-10-23T05:00
title: How Expo Router Works
slug: expo-router-basics
metadescription: 'Learn how Expo Router turns files in src/app into screens, what _layout.tsx does, and how typed routes catch broken links in HabitHop.'
updateDate: 2026-10-23T05:00
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'expo-router', 'navigation']
course: react-native
---

## Apps are made of screens

So far HabitHop has been one screen. Real apps have many: a list of habits, a details page for one habit, a stats page, a settings page, a form to add a habit. Moving between them is called **navigation**, and the library that decides which screen is shown is called a **router**.

Expo projects come with **Expo Router** already installed and set up. Its big idea is simple:

> Every file inside `src/app/` is a screen. The file's path is the screen's address.

If you have used [Next.js file-based routing](/courses/nextjs/file-based-routing), this will feel very familiar. If not, do not worry, it takes about five minutes to get.

In this section of the course you will turn HabitHop into a real multi-screen app: a stack of screens with headers, links between them, a details page for each habit, a tab bar, a modal form, a sign-in screen and deep links.

## Routes are files

A **route** is one address in your app, like `/` or `/stats`. In Expo Router you make a route by making a file. Here is how files map to routes:

| File | Route (URL) |
| --- | --- |
| `src/app/index.tsx` | `/` |
| `src/app/stats.tsx` | `/stats` |
| `src/app/settings/index.tsx` | `/settings` |
| `src/app/settings/about.tsx` | `/settings/about` |
| `src/app/habit/[id].tsx` | `/habit/h1`, `/habit/h2`, ... |

Some rules that come from this table:

- `index.tsx` is the "default" file of a folder. `src/app/index.tsx` is the first screen people see.
- Folders add a part to the path.
- Square brackets like `[id]` make a **dynamic route**: one file that handles many addresses. You will build that in [Dynamic Routes and Route Params](/courses/react-native/dynamic-routes).
- Each screen file must have a **default export**: the component to show (`export default function ...`).

Yes, phone apps have URLs too. On a phone you never see an address bar, but Expo Router still gives every screen a path. That is what makes links, the back button and [Deep Linking](/courses/react-native/deep-linking) work, and it is why the same code can run on the web.

## Only screens go in src/app

Everything inside `src/app/` becomes a route. So your other code goes next to it, not inside it:

```text
habit-hop/
  src/
    app/              <- screens and layouts only
      _layout.tsx
      index.tsx
      stats.tsx
    components/       <- HabitCard.tsx, EmptyState.tsx
    context/          <- HabitsContext.tsx
    hooks/            <- useHabit.ts, useTodayProgress.ts
    lib/              <- dates.ts
    types/            <- habit.ts
    constants/        <- colors.ts, theme.ts
  app.json
  package.json
```

If you put `HabitCard.tsx` inside `src/app/`, Expo Router thinks it is a screen at `/HabitCard`. You also get a warning because a component file usually has no default export.

## Starting from a clean slate

A new project from `npx create-expo-app@latest` has an example app inside `src/app/`, with real native tabs (you will learn about those in [Tab Navigation](/courses/react-native/tab-navigation)). If you have not done it yet, clear it out with the reset script:

```bash
npm run reset-project
```

It asks one question:

```text
Do you want to move existing files to /example instead of deleting them? (Y/n):
```

Press Enter (yes) to keep the example code in an `example/` folder for reference, or type `n` to delete it. After that you get:

```text
📁 New /src/app directory created.
📄 src/app/index.tsx created.
📄 src/app/_layout.tsx created.

✅ Project reset complete. Next steps:
1. Run `npx expo start` to start a development server.
2. Edit src/app/index.tsx to edit the main screen.
3. Put all your application code in /src, only screens and layout files should be in /src/app.
```

Step 3 is exactly the rule from the previous section.

## Layouts: the frame around your screens

The file `src/app/_layout.tsx` is special. The underscore means "this is not a screen". It is a **layout**: a component that wraps the screens in its folder and decides *how* they are shown.

After the reset, it looks like this:

```tsx
// src/app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack />;
}
```

`<Stack />` is a **navigator**. A navigator is the piece that actually shows screens and moves between them. A **stack** navigator works like a stack of cards: opening a screen puts a new card on top, and going back takes the top card off. It also draws a **header** (the bar at the top with the title and back arrow). Expo Router has a few navigators:

- `Stack` from `expo-router`: screens slide in on top of each other. See [Stack Navigation and Headers](/courses/react-native/stack-navigation).
- `Tabs` and `NativeTabs`: a tab bar at the bottom. See [Tab Navigation](/courses/react-native/tab-navigation).
- `Slot` from `expo-router`: shows the current child screen with no extra UI at all. Handy for custom layouts.

The root layout is also the best place for things that wrap the **whole app**, like the `HabitsProvider` from [useReducer and Custom Hooks](/courses/react-native/usereducer-and-custom-hooks). Every screen sits inside the root layout, so every screen can now call `useHabits()`:

```tsx
// src/app/_layout.tsx
import { Stack } from 'expo-router';
import { HabitsProvider } from '@/context/HabitsContext';

export default function RootLayout() {
  return (
    <HabitsProvider>
      <Stack />
    </HabitsProvider>
  );
}
```

You do not register screens anywhere. The `Stack` automatically finds every route file in the same folder.

## Your first two routes

Make the Today screen the home screen. It is the list you built in earlier lessons, now living at `src/app/index.tsx` (the full file is in the code panel). Then add a second, very small screen:

```tsx
// src/app/stats.tsx
import { Text, View } from 'react-native';
import { useHabits } from '@/context/HabitsContext';

export default function StatsScreen() {
  const { habits } = useHabits();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20 }}>You are tracking {habits.length} habits.</Text>
    </View>
  );
}
```

To go from Today to Stats, the Today screen uses a `Link`:

```tsx
import { Link } from 'expo-router';

<Link href="/stats" style={{ color: '#7C5CFC', fontSize: 17 }}>
  See your stats
</Link>
```

Start the app with `npx expo start` and open it in Expo Go. What you will see:

- The Today screen with a header that says "index" (the file name, until you set a title in the next lesson).
- Tapping "See your stats" slides the stats screen in from the right on iOS (Android uses its own system animation).
- The header now shows a back arrow. Tap it, or swipe from the left edge on iOS, or press the Android back button, to go back.

You wrote zero navigation setup code. The files did it.

## Typed routes: links that cannot break

New Expo projects have this in `app.json`:

```json
{
  "expo": {
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

With **typed routes**, Expo Router writes a TypeScript file (in `.expo/types/`) listing every route in your app. It updates while the dev server runs. Then TypeScript checks every `href` you write. If you mistype a route:

```tsx
<Link href="/stat">Stats</Link>
```

you get a red underline in your editor and an error like this from `npx tsc`:

```text
error TS2322: Type '"/stat"' is not assignable to type '"/stats" | ...'
```

That catches broken links before your users find them. If the editor does not know about a route you just created, make sure `npx expo start` is running, since that is what regenerates the list.

## Two special routes you get for free

- **Not found screen.** If the app is asked to open a route that does not exist, Expo Router shows a built-in "Unmatched Route" screen. You can make your own by creating `src/app/+not-found.tsx`.
- **Sitemap.** In development, the route `/_sitemap` lists every route in your app. It is a handy way to check that your files became the routes you expected.

## Common mistakes

**A screen file without a default export.** If you write `export function StatsScreen()` (named export) instead of `export default function StatsScreen()`, the screen does not show and the terminal prints:

```text
Route "./stats.tsx" is missing the required default export. Ensure a React component is exported as default.
```

Every file in `src/app/` needs `export default`.

**Components inside src/app.** Putting `HabitCard.tsx` in `src/app/` creates an unwanted `/HabitCard` route. Move it to `src/components/`.

**Using the provider in a screen instead of the layout.** If you wrap only `index.tsx` in `HabitsProvider`, the stats screen is outside it and crashes with `useHabits must be used inside <HabitsProvider>`. Put app-wide providers in `src/app/_layout.tsx`.

**Thinking a folder name is a route by itself.** A folder like `src/app/settings/` with no `index.tsx` inside has no screen at `/settings`. Add `index.tsx` to give the folder its own screen.

## Quick recap

- Expo Router makes every file in `src/app/` a screen, and the file path is its route: `stats.tsx` is `/stats`, `index.tsx` is `/`.
- Keep components, hooks and logic outside `src/app/`.
- `_layout.tsx` wraps the screens in its folder. The root layout picks a navigator (`Stack` here) and is the place for app-wide providers.
- `npm run reset-project` gives you a clean `src/app/` with a plain `<Stack />`.
- `Link` moves between routes. With typed routes on, a wrong `href` is a TypeScript error.
- `+not-found.tsx` customizes the missing-route screen, and `/_sitemap` lists your routes in development.

<code id="code-content" class="language-tsx">
// src/app/index.tsx
import { Link } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { HabitCard } from '@/components/HabitCard';
import { useHabits } from '@/context/HabitsContext';
// This file lives at src/app/index.tsx, so its URL is "/"
export default function TodayScreen() {
  const { habits, toggleToday } = useHabits();
  return (
    &lt;View style={{ flex: 1, padding: 16, gap: 12 }}&gt;
      &lt;Text style={{ fontSize: 24, fontWeight: '700' }}&gt;Today&lt;/Text&gt;
      &lt;FlatList
        data={habits}
        keyExtractor={(item) =&gt; item.id}
        contentContainerStyle={{ gap: 12 }}
        ListEmptyComponent={&lt;EmptyState message="No habits yet." /&gt;}
        renderItem={({ item }) =&gt; (
          &lt;HabitCard
            habit={item}
            onToggle={toggleToday}
          /&gt;
        )}
      /&gt;
      {/* src/app/stats.tsx becomes the "/stats" route */}
      &lt;Link href="/stats" style={{ color: '#7C5CFC', fontSize: 17 }}&gt;
        See your stats
      &lt;/Link&gt;
    &lt;/View&gt;
  );
}
</code></pre>
