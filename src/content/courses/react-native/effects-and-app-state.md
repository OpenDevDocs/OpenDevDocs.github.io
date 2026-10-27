---
publishDate: 2026-10-23T00:30
title: Effects and the App Lifecycle
slug: effects-and-app-state
metadescription: 'Use useEffect with cleanup in React Native, react when the app goes to the background with AppState, and keep the HabitHop day fresh after midnight.'
updateDate: 2026-10-23T00:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'useeffect', 'appstate', 'hooks']
course: react-native
---

## A bug that only shows up overnight

Here is a real HabitHop bug. Sam opens the app at 11 p.m., ticks "Read 10 pages" and leaves the app in the background. Next morning he opens it again. The app still thinks it is yesterday: "Read 10 pages" shows as done, and anything he ticks is saved under the wrong date.

Why? On a phone, apps are not closed when you leave them. They are **paused in the background** and come back exactly as they were, sometimes days later. Your component calculated "today" once and never looked again.

To fix it you need two tools:

- **Effects** (`useEffect`): code that runs **after** React draws the screen, to connect your component to things outside React, like timers, listeners and the network.
- **AppState**: React Native's way of telling you when your app goes to the background and comes back.

At the end you will write a `useToday()` hook that keeps HabitHop's idea of "today" correct, always.

If you know effects from React on the web, most of this will feel familiar. The React course has the full story in [useEffect and External Systems](/courses/react/useeffect-and-external-systems) and [useEffect Dependencies and Cleanup](/courses/react/useeffect-dependencies-and-cleanup).

## What an effect is

Your component function should be **pure**: given the same props and state, it returns the same JSX and does nothing else. But apps need to do things: start a timer, listen for events, fetch data. Those are called **side effects**, and they go in `useEffect`:

```tsx
// src/components/Clock.tsx
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

export function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return <Text>{now.toLocaleTimeString()}</Text>;
}
```

`useEffect` takes two things:

1. A **setup function**. React runs it after the component appears on screen. Here it starts a timer that updates `now` every second.
2. A **dependency array**. It tells React when to run the setup again. `[]` (empty) means "only once, when the component first appears".

The setup function can **return** a function. That is the **cleanup function**. React runs it when the component goes away (and before running the setup again). Here it stops the timer.

On screen you see the time ticking, like `9:41:07 AM`.

### Why cleanup matters so much on mobile

Forget the cleanup and the timer keeps running after the component is gone. On a phone, screens come and go all the time as you navigate. Every visit to the screen starts another timer that never stops. They pile up, waste battery, and try to update components that no longer exist.

Rule of thumb: **if your setup starts something, the cleanup stops it.** `setInterval` gets `clearInterval`, `setTimeout` gets `clearTimeout`, `addEventListener` gets `remove()`.

## The dependency array

The array decides when the effect runs again:

```tsx
// src/components/DoneLogger.tsx (part)
useEffect(() => {
  console.log(`Done count changed to ${doneCount}`);
}, [doneCount]);
```

- `[]`: run once after the first render. Cleanup when the component goes away.
- `[doneCount]`: run after the first render, and again whenever `doneCount` changes. Before each new run, the previous cleanup runs.
- No array at all: run after **every** render. Rarely what you want.

Put every value from your component that the effect uses into the array. Expo's lint setup (`npm run lint`) warns you when you forget one.

## You might not need an effect

Effects are for talking to the **outside world**. A common beginner mistake is using them for plain calculations:

```tsx
// src/app/index.tsx (part, do NOT do this)
const [doneCount, setDoneCount] = useState(0);
useEffect(() => {
  setDoneCount(habits.filter((h) => isDoneToday(h.doneDates)).length);
}, [habits]);
```

This renders twice for every change (once with the old count, then again with the new one) and adds code for nothing. Just calculate it during render, as a **derived value**, like you did in [State and Props in a Mobile App](/courses/react-native/state-and-props):

```tsx
// src/app/index.tsx (part)
const doneCount = habits.filter((h) => isDoneToday(h.doneDates)).length;
```

Also, code that should run because the user **did something** (pressed save, toggled a habit) belongs in the event handler, not in an effect. The React course has a whole lesson on this: [You Might Not Need an Effect](/courses/react/you-might-not-need-an-effect).

Good uses for effects in a React Native app:

- timers (`setTimeout`, `setInterval`)
- listeners: `AppState`, `Keyboard` (as in [Handling the Keyboard](/courses/react-native/keyboard-handling)), network status, sensors
- fetching data when a screen opens (you will do this properly in [Fetching Data from an API](/courses/react-native/fetching-data))
- syncing with storage

## A quick look at fetching

Here is a "quote of the day" card that fetches from `https://dummyjson.com/quotes/random`, a free test API that returns `{ id, quote, author }`:

```tsx
// src/components/QuoteCard.tsx
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

export function QuoteCard() {
  const [quote, setQuote] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch('https://dummyjson.com/quotes/random')
      .then((res) => res.json())
      .then((data: { quote: string; author: string }) => {
        if (!ignore) setQuote(`${data.quote} (${data.author})`);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return <Text>{quote ?? 'Loading a quote...'}</Text>;
}
```

The `ignore` flag is a cleanup trick for requests: you cannot "stop" a fetch that already left, but you can ignore its answer if the component went away in the meantime. Loading states and errors come later in [Loading States, Errors and Pull to Refresh](/courses/react-native/loading-and-refreshing).

## The app lifecycle and AppState

A web page is open or closed. A mobile app has more states. React Native's **`AppState`** module tells you which one you are in:

- `'active'`: the app is on screen and the user is using it.
- `'background'`: the user went to the home screen or another app. Your app is paused and may be killed by the system to save memory.
- `'inactive'`: **iOS only**. A short moment in between, for example while the app switcher is open, during a phone call, or when the user pulls down the notification center.

You can read the current state any time with `AppState.currentState`, and listen for changes:

```tsx
// src/components/AppStateLogger.tsx
import { useEffect, useRef, useState } from 'react';
import { AppState, Text, type AppStateStatus } from 'react-native';

export function AppStateLogger() {
  const appState = useRef(AppState.currentState);
  const [status, setStatus] = useState<AppStateStatus | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      console.log(`App went from ${appState.current} to ${nextState}`);
      appState.current = nextState;
      setStatus(nextState);
    });
    return () => subscription.remove();
  }, []);

  return <Text>App state: {status ?? 'unknown'}</Text>;
}
```

`addEventListener` returns a **subscription** object. Calling its `remove()` in the cleanup stops listening. The `useRef` keeps the previous state without causing a re-render, so you can tell where the app came **from**.

Put this on a screen, press the home button, then open the app again. In the terminal you see:

```text
LOG  App went from active to background
LOG  App went from background to active
```

On iOS you will often see `inactive` in between (`active` to `inactive` to `background`).

### What to do on each change

Typical things apps do when they come back to `'active'`:

- refresh data that may be old (new messages, today's quote)
- check if the day changed (our HabitHop bug!)
- re-check permissions the user may have changed in Settings (see [Asking for Permissions the Right Way](/courses/react-native/permissions))

And when going to `'background'`:

- save unsaved work, because the system may close the app without warning
- pause videos, timers and animations

## Fixing HabitHop: the useToday hook

Now the fix. We want a value, `today`, that is always the current `'YYYY-MM-DD'` key, even if the app sat in the background overnight, or stayed open on the screen past midnight. Two effects do it, wrapped in a **custom hook**: a function starting with `use` that calls other hooks, so any component can reuse the logic. (More on those in [useReducer and Custom Hooks](/courses/react-native/usereducer-and-custom-hooks).)

The full hook is in the code panel. Here are its two parts.

**Effect 1: refresh when the app comes back.**

```ts
// src/hooks/use-today.ts (part)
useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      setToday(todayKey()); // React skips the re-render if the value is the same
    }
  });
  return () => subscription.remove();
}, []);
```

When the app becomes active, we recalculate the key. If it is still the same day, `setToday` gets the same string and React does nothing. If the date changed, every component using the hook re-renders with the new day.

**Effect 2: flip at midnight while the app stays open.**

```ts
// src/hooks/use-today.ts (part)
useEffect(() => {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const msUntilMidnight = midnight.getTime() - now.getTime();
  const timer = setTimeout(() => setToday(todayKey()), msUntilMidnight + 1000);
  return () => clearTimeout(timer);
}, [today]);
```

- `new Date(year, month, date + 1)` is midnight at the start of tomorrow. JavaScript handles the end of the month for you (October 32 becomes November 1).
- We wait until then, plus one second to be safe, and update `today`.
- The dependency is `[today]`. When the day changes, the cleanup clears the old timer and the setup schedules the next midnight. A neat little loop.

One honest note: phones pause JavaScript timers when the app is in the background. That is exactly why we need **both** effects. The timer covers "app open at midnight", and AppState covers "app was in the background".

### Using the hook

Any screen or component can now ask for today:

```tsx
// src/components/TodayHeader.tsx
import { Text, View } from 'react-native';

import { useToday } from '@/hooks/use-today';
import type { Habit } from '@/types/habit';

export function TodayHeader({ habits }: { habits: Habit[] }) {
  const today = useToday();
  const doneCount = habits.filter((h) => h.doneDates.includes(today)).length;

  return (
    <View>
      <Text>{today}</Text>
      <Text>
        {doneCount} of {habits.length} done
      </Text>
    </View>
  );
}
```

Because `today` is state inside the hook, the header re-renders the moment the day changes, and the count resets to "0 of 3 done" on a new morning. Sam's bug is fixed.

To test it without waiting for midnight, change the date in your phone's settings while the app is in the background, then open it again. The date line updates.

## Common mistakes

**1. Forgetting the cleanup.** Listeners and timers pile up each time you visit a screen. You may see a log line printed two, three, four times for one event. Fix: return a cleanup that calls `remove()`, `clearInterval` or `clearTimeout`.

**2. An infinite loop.** An effect sets state that is in its own dependency array, with no condition:

```tsx
// do NOT do this
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

The app freezes and React shows `Maximum update depth exceeded`. Fix: only set state from an effect when something outside React changed, or calculate the value during render instead.

**3. Using an effect for derived values.** A `useEffect` that copies `habits` into another piece of state. Fix: calculate it during render.

**4. Expecting `'inactive'` on Android.** Code that waits for `'inactive'` never runs on Android. Fix: check for `'background'` and `'active'`, which both platforms send.

## Quick recap

- `useEffect(setup, deps)` runs code after render to sync with the outside world. The returned cleanup undoes it.
- `[]` runs once; `[a, b]` runs again when `a` or `b` changes. Put every used value in the array.
- Do not use effects for derived values or for reacting to button presses.
- `AppState` reports `'active'`, `'background'` and (iOS only) `'inactive'`. Listen with `AppState.addEventListener('change', ...)` and `remove()` in cleanup.
- Apps resume from the background, sometimes days later. Refresh time-based data when the app becomes active.
- HabitHop's `useToday()` combines an AppState listener and a midnight timer to always know the right day.

<code id="code-content" class="language-typescript">
// src/hooks/use-today.ts
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { todayKey } from '@/lib/dates';
// Returns today's key ('YYYY-MM-DD') and keeps it fresh:
// it updates when the app comes back to the front, and at midnight.
export function useToday(): string {
  const [today, setToday] = useState(todayKey());
  // Effect 1: listen for the app coming back from the background
  useEffect(() =&gt; {
    const subscription = AppState.addEventListener('change', (nextState) =&gt; {
      if (nextState === 'active') {
        setToday(todayKey()); // React skips the re-render if the value is the same
      }
    });
    // Cleanup: stop listening when the component goes away
    return () =&gt; subscription.remove();
  }, []);
  // Effect 2: if the app stays open, flip the day at midnight
  useEffect(() =&gt; {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = midnight.getTime() - now.getTime();
    const timer = setTimeout(() =&gt; setToday(todayKey()), msUntilMidnight + 1000);
    // Cleanup: cancel the timer if the screen closes first
    return () =&gt; clearTimeout(timer);
  }, [today]); // run again each time the day changes
  return today;
}
</code></pre>
