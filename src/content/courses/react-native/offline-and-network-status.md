---
publishDate: 2026-10-24T03:30
title: Offline Support and Network Status
slug: offline-and-network-status
metadescription: 'Detect when the phone is offline with expo-network, show an offline banner, pause API calls and design a local-first app that keeps working.'
updateDate: 2026-10-24T03:30
author: ['bishal-biswas']
level: 3
tags: ['react-native', 'expo-network', 'offline', 'tanstack-query']
course: react-native
---

## Phones go offline all the time

A laptop is usually on Wi-Fi. A phone is not. It goes into lifts, tunnels, planes and basements. It switches between Wi-Fi and mobile data. It connects to café Wi-Fi that needs a login page before anything works. A good mobile app expects this and stays useful.

In this lesson you will:

- learn the idea of a **local-first** app, and why HabitHop already is one,
- read the network status with **expo-network**,
- build an `OfflineBanner` that tells users they are offline,
- make the quote card wait politely instead of failing,
- check the connection before an action that needs the internet.

## Local-first: the best offline feature

The most important offline decision is about **where your data lives**. HabitHop keeps habits on the phone, in [SQLite](/courses/react-native/sqlite-database) or [AsyncStorage](/courses/react-native/async-storage). Adding, ticking and deleting habits never touches the network. So the main features of the app work perfectly in airplane mode, with no extra code.

This approach is called **local-first**: the phone holds the real data and the app reads and writes it locally. The network is only used for extras (like the quote of the day) or for syncing to a server later.

Compare that with an app that saves every tick straight to a server. Offline, the tick button would spin and then fail. To fix it, you would need an **outbox**: a local list of changes that are waiting to be sent, which the app retries when the connection comes back, while handling conflicts if the same data was changed on another device. That is real work. If your app can be local-first, it saves you a lot of trouble.

So, offline support for HabitHop means three small things: tell the user they are offline, do not show scary errors for the online extras, and avoid starting online-only actions that cannot work.

## Install expo-network

```bash
npx expo install expo-network
```

If you followed [Caching Server Data with TanStack Query](/courses/react-native/tanstack-query), you already have it. It works in Expo Go. On Android it adds the `ACCESS_NETWORK_STATE` and `ACCESS_WIFI_STATE` permissions for you. These are "normal" permissions that Android grants automatically, so the user never sees a prompt.

## What the network state tells you

expo-network describes the connection with a **NetworkState** object:

```ts
// the shape of NetworkState (from expo-network)
type NetworkState = {
  type?: NetworkStateType; // WIFI, CELLULAR, NONE, UNKNOWN, ETHERNET, VPN...
  isConnected?: boolean; // connected to some network
  isInternetReachable?: boolean; // that network can actually reach the internet
};
```

The difference between the two booleans matters:

- **`isConnected`** means the phone is connected to **a** network. Café Wi-Fi with a login page counts as connected.
- **`isInternetReachable`** means that network can really reach the internet. On Android, the system checks this itself (the network must be "validated"). On iOS, it is always the same value as `isConnected`, so iOS cannot tell you about the café login page case.

Notice that all three fields are **optional** (the `?`). Before the first check finishes, they are `undefined`. Your code must treat `undefined` as "we do not know yet", not as "offline".

There are three ways to read the state:

```text
useNetworkState()               a hook: re-renders your component when the state changes
getNetworkStateAsync()          a one-time check, returns a promise
addNetworkStateListener(fn)     calls fn on every change, outside React
```

## Build an offline banner

The hook is the easiest. `useNetworkState()` starts as an empty object, checks the network, and then listens for changes. Every time the connection changes, your component re-renders with the new state.

```tsx
// src/components/OfflineBanner.tsx (core)
import { useNetworkState } from 'expo-network';

export function OfflineBanner() {
  const network = useNetworkState();
  const isOffline = network.isConnected === false || network.isInternetReachable === false;
  if (!isOffline) return null;
  // ...render the banner
}
```

We compare with `=== false` on purpose. `!network.isConnected` would also be `true` for `undefined`, which would flash the "offline" banner for a moment on every app start, before the first check is done.

The full component (in the code panel) shows a dark bar with two lines of text. It uses `accessibilityRole="alert"`, so screen readers announce it when it appears (more in [Accessibility](/courses/react-native/accessibility)). Notice the message: it does not just say "No internet", it tells the user **what still works**. That reassures people that their ticks are not lost.

Put it at the top of the Today screen:

```tsx
// src/app/(tabs)/index.tsx (part)
import { OfflineBanner } from '@/components/OfflineBanner';
import { QuoteCard } from '@/components/QuoteCard';

return (
  <View style={{ flex: 1 }}>
    <OfflineBanner />
    <QuoteCard />
    {/* habit list */}
  </View>
);
```

If you want it on every screen, you can render it once in a layout instead, for example in `src/app/(tabs)/_layout.tsx` above the tabs, using a safe area inset so it does not hide under the notch (see [Safe Areas](/courses/react-native/safe-areas)).

## Testing offline mode

You cannot test this on your laptop's Wi-Fi alone. Here is how to switch the network off on each device:

- **Real phone:** turn on airplane mode. With Expo Go or a development build, the app talks to your computer's dev server over Wi-Fi, so cutting the network also cuts the dev server. The app keeps running with the code it already loaded, which is fine for testing. Turn airplane mode off again before you save code changes.
- **Android emulator:** pull down the quick settings inside the emulator and turn on airplane mode, or turn off Wi-Fi and mobile data.
- **iOS simulator:** the simulator uses your Mac's network, so you have to turn off the Mac's Wi-Fi (and unplug Ethernet). The iOS simulator needs a Mac.

**What you will see:** within a second or two of going offline, the dark "You are offline" bar appears at the top of the Today screen. Tick a habit: it still works. Turn the network back on and the bar disappears by itself.

## Let online features wait

The quote card from the data lessons needs the internet. What should happen offline?

If you set up `onlineManager` with expo-network in the TanStack Query lesson, TanStack Query already knows when the phone is offline. By default, a query that wants to fetch while offline does not fail. It **pauses**, and continues automatically when the connection is back. You can see this in the `fetchStatus` value:

```text
fetchStatus: 'fetching'   a request is running
fetchStatus: 'paused'     it wanted to fetch, but we are offline
fetchStatus: 'idle'       nothing is happening
```

So the card can show a calm message instead of a red error:

```tsx
// src/components/QuoteCard.tsx (offline-aware part)
const { data, isPending, isError, fetchStatus } = useQuery({
  queryKey: ['quote', 'random'],
  queryFn: ({ signal }) => fetchRandomQuote(signal),
  staleTime: 1000 * 60 * 60,
});

if (isPending && fetchStatus === 'paused') {
  return <Text>Quote of the day will load when you are back online.</Text>;
}
if (isPending) return <ActivityIndicator />;
if (isError) return <Text>Could not load a quote.</Text>;
return <Text>"{data.quote}"</Text>;
```

If the quote was already loaded before going offline, `data` is still in the cache, so the card simply keeps showing it. Users often do not even notice they are offline, which is the best outcome.

Remember the TanStack Query cache lives in memory. If the app is fully closed and reopened offline, the quote is gone. For a small extra like a quote that is fine. If you need cached server data to survive restarts, you can save the last result yourself with AsyncStorage and show it while offline.

## Check before online-only actions

Some actions only make sense online: signing in, sharing progress to a server, downloading something. Instead of letting them fail after a long timeout, check first with a one-time read:

```ts
// a one-time check before an action that needs the internet
import * as Network from 'expo-network';
import { Alert } from 'react-native';

export async function shareProgress() {
  const state = await Network.getNetworkStateAsync();
  if (!state.isInternetReachable) {
    Alert.alert('No internet', 'Connect to the internet to share your progress.');
    return;
  }
  // ...send the request
}
```

The network can still drop a second later, so keep your normal error handling from [Loading States, Errors and Pull to Refresh](/courses/react-native/loading-and-refreshing) as well. The check just gives a faster, friendlier answer in the common case.

You can also use `state.type` to be careful with mobile data. For example, a future "download all my photos" feature could ask first when `state.type === Network.NetworkStateType.CELLULAR`, because mobile data can cost money.

## Listening outside React

Sometimes you need network changes outside a component, like in the TanStack Query setup. That is what `addNetworkStateListener` is for. It returns a subscription, and you must call `remove()` on it when you are done, or the listener keeps running:

```ts
// listening outside a component
import * as Network from 'expo-network';

const subscription = Network.addNetworkStateListener((state) => {
  console.log('Network changed:', state.type, state.isInternetReachable);
});

// later, when you no longer need it:
subscription.remove();
```

## Common mistakes

**The offline banner flashes on every start.** You wrote `if (!network.isConnected)`. On the first render the value is `undefined`, so the banner shows for a moment. Compare with `=== false`.

**Trusting `isConnected` alone.** The phone is "connected" to hotel Wi-Fi that shows a login page, and every request fails. On Android, check `isInternetReachable` too. On iOS, keep good error handling, because the system cannot tell you about this case.

**Treating offline as an error.** Showing "Network request failed" in red for every online extra makes the whole app feel broken. Pause, explain calmly, and retry automatically when the connection returns.

**Forgetting the dev server goes offline too.** On a real device, airplane mode also disconnects you from Metro. If you change code while offline, the app cannot reload. That is a development quirk, not a bug in your app.

## Quick recap

- The best offline support is **local-first** data. HabitHop's habits live on the phone, so the core features work offline with no extra code.
- `expo-network` gives you `useNetworkState()`, `getNetworkStateAsync()` and `addNetworkStateListener()`. It works in Expo Go.
- `isConnected` means "on a network"; `isInternetReachable` means "can reach the internet" (on iOS they are always equal). Values start as `undefined`, so compare with `=== false`.
- Show a calm offline banner that says what still works.
- With `onlineManager` set up, TanStack Query pauses queries offline (`fetchStatus === 'paused'`) and resumes them later.
- Check the network before online-only actions, but keep normal error handling too.

You have finished the Data and Storage section. Next, the Device Features section starts with [Asking for Permissions the Right Way](/courses/react-native/permissions).

<code id="code-content" class="language-tsx">
// src/components/OfflineBanner.tsx
import { useNetworkState } from 'expo-network';
import { StyleSheet, Text, View } from 'react-native';
// Shows a small bar when the phone has no working internet connection
export function OfflineBanner() {
  const network = useNetworkState();
  // Values can be undefined while the first check is running: treat that as "online"
  const isOffline = network.isConnected === false || network.isInternetReachable === false;
  if (!isOffline) return null;
  return (
    &lt;View style={styles.banner} accessibilityRole="alert"&gt;
      &lt;Text style={styles.title}&gt;You are offline&lt;/Text&gt;
      &lt;Text style={styles.text}&gt;Your habits still work and are saved on this phone.&lt;/Text&gt;
    &lt;/View&gt;
  );
}
const styles = StyleSheet.create({
  banner: { backgroundColor: '#1F1A33', paddingVertical: 8, paddingHorizontal: 16 },
  title: { color: 'white', fontWeight: '700' },
  text: { color: '#D1D5DB', fontSize: 13 },
});
</code></pre>
