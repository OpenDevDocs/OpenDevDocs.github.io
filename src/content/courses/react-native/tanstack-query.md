---
publishDate: 2026-10-23T21:30
title: Caching Server Data with TanStack Query
slug: tanstack-query
metadescription: 'Use TanStack Query in React Native to cache API data, retry failed requests, refetch when the app returns to the foreground and pull to refresh.'
updateDate: 2026-10-23T21:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'tanstack-query', 'api', 'caching']
course: react-native
---

## Why a data library?

In the last two lessons you fetched quotes by hand. It worked, but look at what you had to write: state for the data, state for loading, state for refreshing, state for errors, an `AbortController`, a counter to fetch again, and spinners turned off in `finally`. And that is for **one** screen. If two screens need the same quotes, they each fetch them separately.

**TanStack Query** (it used to be called React Query) is a library that does all of that for you. You tell it two things: a name for the data, and a function that fetches it. It gives back the data plus flags like `isPending` and `isError`, and it adds features that are hard to build by hand:

- **Caching**: data is kept in memory under its name. A second screen asking for the same data gets it instantly.
- **Deduping**: if three components ask for the same data at once, only one request is sent.
- **Retries**: failed requests are tried again a few times, with growing pauses in between.
- **Background refetching**: when data is old, it quietly reloads it while still showing the old version.

The difference between **server state** (data that lives on a server, like quotes) and **client state** (data that only lives in your app, like which tab is open) is the key idea here. TanStack Query is for server state. Your habits, which live only on the phone, stay in [Context](/courses/react-native/context-for-shared-state) and on-device storage.

If you already know TanStack Query from the web, the React course has a [deeper TanStack Query lesson](/courses/react/tanstack-query-react-query). This lesson focuses on what is different on a phone.

## Install and set up the client

Install the package:

```bash
npx expo install @tanstack/react-query
```

It is plain JavaScript (no native code), so it works in Expo Go.

Next, create one **QueryClient**. This is the object that holds the cache. Then wrap your whole app in a **QueryClientProvider**, so every screen can reach it. The root layout is the right place:

```tsx
// src/app/_layout.tsx (first version)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 60 * 1000 } },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="quotes" options={{ title: 'Quote ideas' }} />
      </Stack>
    </QueryClientProvider>
  );
}
```

Create the client **outside** the component. If you created it inside, every re-render of the layout would make a brand new, empty cache.

The `defaultOptions` apply to every query:

- `retry: 2` means "try two more times before giving up" (the default is 3).
- `staleTime: 60 * 1000` means data counts as **fresh** for one minute. While data is fresh, TanStack Query will not refetch it, even if another screen asks. The default is `0`, which means "stale right away".

## Your first query

Now rewrite the quote card from [Fetching Data from an API](/courses/react-native/fetching-data) with `useQuery`:

```tsx
// src/components/QuoteCard.tsx (core)
import { useQuery } from '@tanstack/react-query';
import { fetchRandomQuote } from '@/lib/quotes';

export function QuoteCard() {
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['quote', 'random'],
    queryFn: ({ signal }) => fetchRandomQuote(signal),
    staleTime: 1000 * 60 * 60, // one quote per hour is plenty
  });
  // ...render
}
```

The two required options:

- **`queryKey`**: the name of this data in the cache, written as an array. Any component using the same key shares the same data. Put everything the request depends on into the key, like `['quotes', { limit: 20 }]` or `['habit', id]`. When the key changes, TanStack Query fetches again.
- **`queryFn`**: a function that returns a promise of the data. It gets an object with a `signal`. Pass it to `fetch`, and TanStack Query will cancel the request for you when nobody needs it any more. No more manual `AbortController`.

The `queryFn` must **throw** when something goes wrong. Our `fetchRandomQuote` already throws when `response.ok` is false, so errors are handled correctly.

### The flags you get back

```text
isPending    no data yet (first load)
isError      the last attempt failed (after all retries)
isSuccess    we have data
isFetching   a request is running right now (first load OR background refetch)
data         the data, or undefined while pending
error        the Error that was thrown
refetch()    fetch again now
```

`isPending` and `isFetching` sound alike but are different. `isPending` is about **having data**. `isFetching` is about **a request running**. During a background refetch, `isPending` is `false` (you have old data) while `isFetching` is `true`.

### Rendering the states

```tsx
// src/components/QuoteCard.tsx (render part)
if (isPending) return <ActivityIndicator style={styles.card} />;

if (isError) {
  return (
    <Pressable style={styles.card} onPress={() => refetch()}>
      <Text style={styles.error}>Could not load a quote. Tap to try again.</Text>
    </Pressable>
  );
}

return (
  <Pressable style={styles.card} onPress={() => refetch()} disabled={isFetching}>
    <Text style={styles.quote}>"{data.quote}"</Text>
    <View style={styles.footer}>
      <Text style={styles.author}>{data.author}</Text>
      {isFetching && <ActivityIndicator size="small" color="#7C5CFC" />}
    </View>
  </Pressable>
);
```

A nice TypeScript detail: after the `isPending` and `isError` checks return early, TypeScript knows `data` is a `Quote`, not `Quote | undefined`. You can write `data.quote` without a `?`.

**What you will see:** the card loads as before. Tap it and a small spinner appears next to the author while a new quote loads, but the old quote stays on screen until the new one arrives. Leave the Today tab and come back: the quote appears instantly from the cache.

## Teaching TanStack Query about phones

TanStack Query was born on the web. Two of its best features listen to browser events that do not exist in React Native:

- **Refetch on window focus**: on the web, it refetches stale data when you come back to the browser tab. A phone has no tabs, but it does have the app going to the background and coming back.
- **Refetch on reconnect**: on the web, it listens to the browser's `online` event. A phone needs a native module to know about the network.

You connect both with two small helpers, `focusManager` and `onlineManager`.

### App focus with AppState

React Native's **AppState** API tells you if the app is `active` (on screen), `background` or `inactive`. You saw it in [Effects and the App Lifecycle](/courses/react-native/effects-and-app-state). Tell TanStack Query that "active" means "focused":

```tsx
// src/app/_layout.tsx (part)
import { focusManager } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

// inside RootLayout:
useEffect(() => {
  const subscription = AppState.addEventListener('change', onAppStateChange);
  return () => subscription.remove();
}, []);
```

We skip web because on web TanStack Query already listens to the real browser events.

### Online status with expo-network

Install **expo-network**, the Expo module that reads the phone's connection state:

```bash
npx expo install expo-network
```

Then tell `onlineManager` how to listen for changes:

```tsx
// src/app/_layout.tsx (part)
import { onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';

onlineManager.setEventListener((setOnline) => {
  const subscription = Network.addNetworkStateListener((state) => {
    setOnline(!!state.isConnected);
  });
  return () => subscription.remove();
});
```

Now, when the phone is offline, queries **pause** instead of failing, and when it comes back online, they continue and stale queries refetch. You will go deeper into network status in [Offline Support and Network Status](/courses/react-native/offline-and-network-status). The full root layout with both helpers is in the code panel.

## Pull to refresh with a query

You can wire a FlatList's pull to refresh straight to `refetch`. But there is a trap: if you use `isFetching` for the `refreshing` prop, the refresh spinner also appears for **background** refetches the user never asked for, which looks odd. The fix is a tiny hook that tracks only refreshes started by the user:

```ts
// src/hooks/use-refresh-by-user.ts
import { useState } from 'react';

export function useRefreshByUser(refetch: () => Promise<unknown>) {
  const [isRefetchingByUser, setIsRefetchingByUser] = useState(false);

  async function refetchByUser() {
    setIsRefetchingByUser(true);
    try {
      await refetch();
    } finally {
      setIsRefetchingByUser(false);
    }
  }

  return { isRefetchingByUser, refetchByUser };
}
```

And the quotes list from [Loading States, Errors and Pull to Refresh](/courses/react-native/loading-and-refreshing) becomes much shorter:

```tsx
// src/app/quotes.tsx (TanStack Query version, list part)
const { data, refetch } = useQuery({
  queryKey: ['quotes', { limit: 20 }],
  queryFn: ({ signal }) => fetchQuotes(20, signal),
});
const { isRefetchingByUser, refetchByUser } = useRefreshByUser(refetch);

return (
  <FlatList
    data={data ?? []}
    keyExtractor={(item) => String(item.id)}
    refreshing={isRefetchingByUser}
    onRefresh={refetchByUser}
    renderItem={({ item }) => <Text>{item.quote}</Text>}
  />
);
```

Compare this with the custom hook from the last lesson: no `attempt` counter, no `AbortController`, no `finally`, and you get caching and retries for free.

## Screens that are not visible

In a native app, screens you navigated away from often stay **mounted** (still alive in memory). A tab you left is still there, and so is a screen under the current one in a stack. Their queries are still active, so they may refetch in the background when the app comes back to the foreground.

Usually that is fine. If a screen is expensive, you can pause its query while it is hidden with the `subscribed` option and Expo Router's `useIsFocused` hook:

```ts
// a query that only listens while its screen is focused
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { fetchQuotes } from '@/lib/quotes';

export function useScreenQuotes() {
  const isFocused = useIsFocused();
  return useQuery({
    queryKey: ['quotes', { limit: 20 }],
    queryFn: ({ signal }) => fetchQuotes(20, signal),
    subscribed: isFocused,
  });
}
```

## What about changing data?

`useQuery` is for **reading**. For **writing** to a server (create, update, delete), TanStack Query has `useMutation`. HabitHop keeps habits on the phone, so we do not need it yet. The pattern is: call the server in `mutationFn`, then in `onSuccess` call `queryClient.invalidateQueries({ queryKey: [...] })` to mark related queries as stale, so they refetch. The [React course lesson](/courses/react/tanstack-query-react-query) has a full example.

## Common mistakes

**`No QueryClient set, use QueryClientProvider to set one`.** You called `useQuery` in a component that is not inside the provider. Make sure `QueryClientProvider` wraps the `Stack` in the **root** `src/app/_layout.tsx`, not a nested layout.

**The same data under different keys.** One screen uses `['quotes']` and another uses `['quote-list']` for the same request. They will not share a cache and you fetch twice. Agree on keys, and keep them in one place if your app grows.

**Forgetting to throw.** If your `queryFn` returns an error object instead of throwing, TanStack Query thinks it succeeded and `data` is garbage. Check `response.ok` and throw.

**Data never refreshes after coming back to the app.** You did not set up `focusManager` with `AppState`, or your `staleTime` is very long. Data is only refetched on focus when it is stale.

## Quick recap

- TanStack Query manages **server state**: caching, deduping, retries and background refetching.
- Create one `QueryClient` outside your components and wrap the root layout in `QueryClientProvider`.
- `useQuery` needs a `queryKey` (the cache name, an array) and a `queryFn` (returns a promise, throws on error, gets a `signal`).
- `isPending` means "no data yet". `isFetching` means "a request is running", including background ones.
- On phones, connect `focusManager` to `AppState` and `onlineManager` to `expo-network`.
- For pull to refresh, track user-started refreshes with a small `useRefreshByUser` hook instead of `isFetching`.

Server data is cached in memory, so it is gone when the app closes. Next, you will save HabitHop's own data on the phone with [AsyncStorage](/courses/react-native/async-storage).

<code id="code-content" class="language-tsx">
// src/app/_layout.tsx
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
// One client for the whole app, created outside the component
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 60 * 1000 } },
});
// Tell TanStack Query when the phone goes online or offline
onlineManager.setEventListener((setOnline) =&gt; {
  const subscription = Network.addNetworkStateListener((state) =&gt; {
    setOnline(!!state.isConnected);
  });
  return () =&gt; subscription.remove();
});
// Treat "app came back to the foreground" like "browser tab got focus"
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}
export default function RootLayout() {
  useEffect(() =&gt; {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () =&gt; subscription.remove();
  }, []);
  return (
    &lt;QueryClientProvider client={queryClient}&gt;
      &lt;Stack&gt;
        &lt;Stack.Screen name="(tabs)" options={{ headerShown: false }} /&gt;
        &lt;Stack.Screen name="quotes" options={{ title: 'Quote ideas' }} /&gt;
      &lt;/Stack&gt;
    &lt;/QueryClientProvider&gt;
  );
}
</code></pre>
