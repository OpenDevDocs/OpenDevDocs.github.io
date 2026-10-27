---
publishDate: 2026-10-23T20:00
title: Loading States, Errors and Pull to Refresh
slug: loading-and-refreshing
metadescription: 'Show spinners, friendly errors with a retry button and pull to refresh in React Native using FlatList refreshing, onRefresh and RefreshControl.'
updateDate: 2026-10-23T20:00
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'flatlist', 'refreshcontrol', 'api']
course: react-native
---

## Networks are slow and sometimes broken

On your laptop with fast Wi-Fi, an API call feels instant. On a phone in a train it can take five seconds, or fail. A good app always answers three questions for the user:

- **Is something happening?** (a loading state)
- **Did it go wrong, and what can I do?** (an error state with a way out)
- **How do I get fresh data?** (refresh)

In [Fetching Data from an API](/courses/react-native/fetching-data) you built a quote card that loads once. Now you will build a full **Quote ideas** screen for HabitHop: a list of 20 quotes from the free dummyjson test API, with a spinner while it loads, a "Try again" button when it fails, and **pull to refresh**, the gesture where you drag a list down and let go to reload it.

You will reuse `fetchQuotes` from `src/lib/quotes.ts`, which you wrote in the last lesson.

## The states of a request

Every request moves through a few states. It helps to name them before writing code:

```text
loading      first load, nothing to show yet      -> big spinner
success      we have data                         -> the list
error        it failed and we have no data        -> message + "Try again"
refreshing   we have data, and are reloading it   -> small spinner on top of the list
```

Notice that **refreshing is not the same as loading**. When refreshing, you already have quotes on screen. You should keep showing them while the new ones arrive, not wipe the screen and show a big spinner. Users hate it when a list blinks away.

There is also a mix: a refresh that **fails**. In that case, keep the old quotes and show a small banner on top saying it failed. Old data is better than no data.

## A custom hook for the quotes

Putting this logic in a **custom hook** (a function starting with `use` that calls other hooks, see [useReducer and Custom Hooks](/courses/react-native/usereducer-and-custom-hooks)) keeps the screen short and readable.

Start with the state:

```ts
// src/hooks/use-quotes.ts
import { useEffect, useState } from 'react';
import { fetchQuotes, type Quote } from '@/lib/quotes';

export function useQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
```

The odd one is `attempt`. It is a simple counter. Every time you want to fetch again, you add one to it. Because the effect lists `attempt` as a dependency, a new number means "run the effect again". This trick keeps all fetching in one effect, with one cleanup, instead of spreading `fetch` calls around.

Now the effect:

```ts
// src/hooks/use-quotes.ts (continued)
  useEffect(() => {
    const controller = new AbortController();
    fetchQuotes(20, controller.signal)
      .then((data) => {
        setQuotes(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError('Could not load quotes. Check your connection.');
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsLoading(false);
        setIsRefreshing(false);
      });
    return () => controller.abort();
  }, [attempt]);
```

Step by step:

1. A new `AbortController` is made for this attempt. If the user refreshes twice quickly, the cleanup of the first run aborts the first request, so an old answer can never overwrite a newer one.
2. On success, store the quotes and clear any old error.
3. On failure, store a short, human message. Notice we **do not** clear `quotes` here. If there was data before, it stays.
4. `finally` runs after success **or** failure, so it is the right place to turn the spinners off. We skip it when the request was aborted, because a newer attempt is now in charge of the spinners.

Last, two small functions the screen can call, and the return value:

```ts
// src/hooks/use-quotes.ts (end)
  function refresh() {
    setIsRefreshing(true);
    setAttempt((n) => n + 1);
  }

  function retry() {
    setIsLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  }

  return { quotes, isLoading, isRefreshing, error, refresh, retry };
}
```

`refresh` is for pull to refresh: the list stays and a small spinner shows. `retry` is for the error screen: it goes back to the big loading state.

## The loading state

Now the screen. First, the very first load, when there is nothing to show:

```tsx
// src/app/quotes.tsx (loading part)
if (isLoading) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#7C5CFC" />
      <Text style={styles.muted}>Loading quotes...</Text>
    </View>
  );
}
```

A short text next to the spinner helps people who use a screen reader, and tells everyone what is loading. For lists, some apps show grey "skeleton" boxes in the shape of the rows instead of a spinner. That is a nice upgrade, but a spinner is perfectly fine to start with.

## The error state with a retry button

If the first load fails, there is nothing to show, so the whole screen becomes the error:

```tsx
// src/app/quotes.tsx (error part)
if (error && quotes.length === 0) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorText}>{error}</Text>
      <Pressable style={styles.button} onPress={retry}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}
```

Good error messages are short, say what happened in plain words and offer a next step. "Could not load quotes. Check your connection." plus a button is much kinder than "TypeError: Network request failed". Log the technical error for yourself (see [Debugging React Native Apps](/courses/react-native/debugging)) but show the friendly one.

To test this, turn on airplane mode on your phone (or turn off Wi-Fi on the emulator), then open the screen. You will see the red message and the button. Turn the network back on and tap **Try again**.

## Pull to refresh with FlatList

[FlatList](/courses/react-native/flatlist) has pull to refresh built in. You only need two props:

- `refreshing`: a boolean. When `true`, the list shows the refresh spinner at the top.
- `onRefresh`: a function that runs when the user pulls down and lets go. Passing it is what turns the gesture on.

```tsx
// src/app/quotes.tsx (list part)
return (
  <FlatList
    data={quotes}
    keyExtractor={(item) => String(item.id)}
    refreshing={isRefreshing}
    onRefresh={refresh}
    ListHeaderComponent={error ? <Text style={styles.banner}>{error}</Text> : undefined}
    ListEmptyComponent={<Text style={styles.muted}>No quotes yet. Pull down to refresh.</Text>}
    renderItem={({ item }) => (
      <View style={styles.row}>
        <Text style={styles.quote}>"{item.quote}"</Text>
        <Text style={styles.author}>{item.author}</Text>
      </View>
    )}
  />
);
```

Two more helpful props are here:

- `ListHeaderComponent` shows something above the first row. We use it for the "refresh failed" banner, so the old quotes stay visible below it.
- `ListEmptyComponent` shows when `data` is an empty array. An empty list with no explanation looks broken, so always tell the user why it is empty and what to do.

**Important:** `refreshing` is fully controlled by you. FlatList never sets it back to `false` by itself. If you forget to turn it off, the spinner spins forever. That is why the hook turns it off in `finally`.

**What you will see:** on iOS a grey spinner appears above the list as you pull, then the list bounces back when loading ends. On Android a round spinner drops down from the top in a little circle. The look is different because each platform uses its own native refresh control.

## Pull to refresh on a ScrollView

A `ScrollView` does not have `refreshing` and `onRefresh` props. Instead you pass a **`RefreshControl`** element to its `refreshControl` prop. (FlatList actually creates one of these for you behind the scenes.)

```tsx
// a ScrollView version of the same idea
import { RefreshControl, ScrollView, Text } from 'react-native';
import { useQuotes } from '@/hooks/use-quotes';

export default function QuotesScroll() {
  const { quotes, isRefreshing, refresh } = useQuotes();
  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refresh}
          tintColor="#7C5CFC" // iOS spinner color
          colors={['#7C5CFC']} // Android spinner color(s)
        />
      }
    >
      {quotes.map((q) => (
        <Text key={q.id}>{q.quote}</Text>
      ))}
    </ScrollView>
  );
}
```

`RefreshControl` is also how you **style** the spinner. `tintColor` only works on iOS and `colors` (an array) only works on Android, so set both to your brand purple. You can pass the same `refreshControl` prop to a FlatList when you want these colors there too. Use a ScrollView for short screens like a settings page or a single card, and a FlatList for real lists (see [Scrolling Content with ScrollView](/courses/react-native/scrollview) for why).

## Putting it together in HabitHop

Save the full screen (shown in the code panel) as `src/app/quotes.tsx`. Because it sits directly in `src/app`, Expo Router turns it into the `/quotes` route and the root Stack shows it with a back button. Add a link from the Settings tab:

```tsx
// src/app/(tabs)/settings.tsx (part)
import { Link } from 'expo-router';

<Link href="/quotes" style={{ color: '#7C5CFC', padding: 16 }}>
  Browse quote ideas
</Link>
```

And give the screen a nice header title in the root layout:

```tsx
// src/app/_layout.tsx (part)
<Stack.Screen name="quotes" options={{ title: 'Quote ideas' }} />
```

If you want a refresher on links and Stack options, see [Links and Navigating in Code](/courses/react-native/links-and-navigating) and [Stack Navigation and Headers](/courses/react-native/stack-navigation).

## Common mistakes

**The refresh spinner never stops.** You set `refreshing` to `true` but only set it back to `false` in the success path. When a request fails, it stays `true` forever. Turn it off in `finally`, or in both `then` and `catch`.

**The whole list blinks away on refresh.** You reused `isLoading` for refreshing, so the screen swaps to the big spinner and back. Keep two separate flags: one for the first load, one for refreshing.

**Pull to refresh does nothing.** You passed `refreshing` but not `onRefresh`. Without `onRefresh` the gesture is off. Also check the list can actually be pulled: if a parent view has a fixed small height or the FlatList sits inside a ScrollView, the gesture may not reach it. You may also see this warning for nested lists:

```text
VirtualizedLists should never be nested inside plain ScrollViews with the same orientation
```

Use one scroller: put extra content in `ListHeaderComponent` instead of wrapping the FlatList.

**Error message wipes good data.** Setting `quotes` to `[]` in `catch` throws away what the user was reading. Keep the old data and show the error as a banner.

## Quick recap

- Think in states: loading, success, error and refreshing. Refreshing keeps the old data on screen.
- Put the fetch logic in a custom hook. A counter like `attempt` in the effect dependencies is a clean way to "fetch again".
- Show a spinner with a short text for the first load, and a friendly message with a **Try again** button for errors.
- FlatList gets pull to refresh with `refreshing` and `onRefresh`. You must set `refreshing` back to `false` yourself.
- A ScrollView needs `refreshControl={<RefreshControl ... />}`. Use `tintColor` for iOS and `colors` for Android.
- `ListEmptyComponent` and `ListHeaderComponent` make empty lists and failed refreshes clear.

Writing all of this by hand for every screen gets repetitive. In [Caching Server Data with TanStack Query](/courses/react-native/tanstack-query) a library takes care of loading, errors, refreshing and caching for you.

<code id="code-content" class="language-tsx">
// src/app/quotes.tsx
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuotes } from '@/hooks/use-quotes';
export default function QuotesScreen() {
  const { quotes, isLoading, isRefreshing, error, refresh, retry } = useQuotes();
  // 1. First load: nothing to show yet
  if (isLoading) {
    return (
      &lt;View style={styles.center}&gt;
        &lt;ActivityIndicator size="large" color="#7C5CFC" /&gt;
        &lt;Text style={styles.muted}&gt;Loading quotes...&lt;/Text&gt;
      &lt;/View&gt;
    );
  }
  // 2. Failed and no old data: full screen error with a way out
  if (error &amp;&amp; quotes.length === 0) {
    return (
      &lt;View style={styles.center}&gt;
        &lt;Text style={styles.errorText}&gt;{error}&lt;/Text&gt;
        &lt;Pressable style={styles.button} onPress={retry}&gt;
          &lt;Text style={styles.buttonText}&gt;Try again&lt;/Text&gt;
        &lt;/Pressable&gt;
      &lt;/View&gt;
    );
  }
  // 3. We have data: list with pull to refresh
  return (
    &lt;FlatList
      data={quotes}
      keyExtractor={(item) =&gt; String(item.id)}
      refreshing={isRefreshing}
      onRefresh={refresh}
      ListHeaderComponent={error ? &lt;Text style={styles.banner}&gt;{error}&lt;/Text&gt; : undefined}
      ListEmptyComponent={&lt;Text style={styles.muted}&gt;No quotes yet. Pull down to refresh.&lt;/Text&gt;}
      renderItem={({ item }) =&gt; (
        &lt;View style={styles.row}&gt;
          &lt;Text style={styles.quote}&gt;"{item.quote}"&lt;/Text&gt;
          &lt;Text style={styles.author}&gt;{item.author}&lt;/Text&gt;
        &lt;/View&gt;
      )}
    /&gt;
  );
}
// ---
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  muted: { color: '#6B7280', textAlign: 'center', padding: 16 },
  errorText: { color: '#B91C1C', textAlign: 'center' },
  button: { backgroundColor: '#7C5CFC', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
  buttonText: { color: 'white', fontWeight: '600' },
  banner: { backgroundColor: '#FEF2F2', color: '#B91C1C', padding: 12 },
  row: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  quote: { fontSize: 16 },
  author: { marginTop: 4, color: '#7C5CFC', fontWeight: '600' },
});
</code></pre>
