---
publishDate: 2026-10-23T18:30
title: Fetching Data from an API
slug: fetching-data
metadescription: 'Learn how to call a web API from a React Native app with fetch, type the JSON with TypeScript and cancel requests with AbortController.'
updateDate: 2026-10-23T18:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'fetch', 'api', 'typescript']
course: react-native
---

## Talking to the internet

So far everything in HabitHop lives inside the app. Real apps also talk to servers: they load posts, prices, weather or, in our case, a short motivational quote for the top of the Today screen.

In this lesson you will build a **"quote of the day" card** for HabitHop. You will learn how to:

- call a web **API** (a server that answers requests with data, usually JSON) with `fetch`,
- describe the answer with a TypeScript type,
- show the data in a component with `useEffect`,
- cancel a request with `AbortController` when the screen goes away.

The good news: if you have used `fetch` in the browser, you already know most of this. React Native ships the same `fetch` function, so the code looks almost the same. If `fetch` or promises are new to you, read [The Fetch API](/courses/javascript/fetch-api-and-ajax) and [async and await](/courses/javascript/async-await) first.

## The demo API: dummyjson quotes

We will use **dummyjson.com**, a free test API made for tutorials. You do not need an account or a key. Two addresses matter:

```text
https://dummyjson.com/quotes/random      one random quote
https://dummyjson.com/quotes?limit=20    a page of 20 quotes
```

Open the first one in your browser. You will see something like this (the text changes every time):

```json
{
  "id": 42,
  "quote": "Small steps every day add up to big changes.",
  "author": "Unknown"
}
```

The second address wraps the quotes in an object with some paging numbers:

```json
{
  "quotes": [
    { "id": 1, "quote": "First quote text", "author": "Someone" },
    { "id": 2, "quote": "Second quote text", "author": "Someone else" }
  ],
  "total": 1454,
  "skip": 0,
  "limit": 20
}
```

Because it is a free test API, it can be slow or down now and then. That is actually useful: it gives you a reason to handle errors properly, which you will do in the next lesson.

## Describe the data with TypeScript

`fetch` has no idea what the server will send back. `response.json()` returns `Promise<any>`, and `any` switches TypeScript's checks off. So the first step is to write a **type** that says what one quote looks like. Put all the quote code in one small file, so screens never deal with URLs directly.

```ts
// src/lib/quotes.ts
export type Quote = {
  id: number;
  quote: string;
  author: string;
};

export type QuotesPage = {
  quotes: Quote[];
  total: number;
  skip: number;
  limit: number;
};
```

These types are a promise **you** make to TypeScript. They do not check the real data at run time. If the server changed `author` to `name`, your app would still compile and then show `undefined`. For a demo API that is fine. For important data you can check the shape with a validation library such as Zod, which the [form validation lesson](/courses/react/form-validation-with-zod) in the React course covers.

## Write the fetch functions

Now add two functions to the same file. Each one calls the API, checks the answer and returns typed data.

```ts
// src/lib/quotes.ts (continued)
const BASE_URL = 'https://dummyjson.com';

export async function fetchRandomQuote(signal?: AbortSignal): Promise<Quote> {
  const response = await fetch(`${BASE_URL}/quotes/random`, { signal });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as Quote;
}

export async function fetchQuotes(limit = 20, signal?: AbortSignal): Promise<Quote[]> {
  const response = await fetch(`${BASE_URL}/quotes?limit=${limit}`, { signal });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  const page = (await response.json()) as QuotesPage;
  return page.quotes;
}
```

Three things are worth a closer look.

1. **`response.ok` check.** `fetch` only throws when the request could not happen at all (no internet, bad address). A `404 Not Found` or `500 Server Error` is still a "successful" fetch. `response.ok` is `true` only for status codes 200 to 299, so you throw your own error for the rest.
2. **`as Quote`.** This is a **type assertion**: you tell TypeScript "trust me, this is a `Quote`". It is the place where the promise from the previous section is made.
3. **`signal`.** This optional parameter lets the caller cancel the request. You will use it in a moment.

## Show the quote in a component

Fetching is a **side effect**: it reaches outside your component. In React, side effects that should run after the screen appears go in `useEffect`. You met it in [Effects and the App Lifecycle](/courses/react-native/effects-and-app-state).

Here is a first, simple version of the card:

```tsx
// src/components/QuoteCard.tsx (first try)
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { fetchRandomQuote, type Quote } from '@/lib/quotes';

export function QuoteCard() {
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    fetchRandomQuote().then(setQuote);
  }, []);

  if (!quote) return <Text>Loading...</Text>;

  return (
    <View>
      <Text>"{quote.quote}"</Text>
      <Text>{quote.author}</Text>
    </View>
  );
}
```

The empty dependency array `[]` means "run this once, when the card first appears". The state starts as `null`, so the first render shows "Loading...". When the promise finishes, `setQuote` stores the data, React renders again and the quote shows up.

This works, but it has two problems: it ignores errors, and it keeps going even if the user leaves the screen. Let's fix both.

## Cancel requests with AbortController

Imagine Riya opens a screen with a slow request and then taps back right away. The request is still running. When it finishes, the code calls `setQuote` on a component that is gone. At best that is wasted work. At worst, with screens that load different data by id, an old slow answer can arrive **after** a newer one and overwrite it.

An **`AbortController`** is a small built-in object that can cancel a `fetch`. It has two parts:

- `controller.signal`: you pass this to `fetch`,
- `controller.abort()`: you call this to cancel. The `fetch` promise then rejects with an error whose `name` is `'AbortError'`.

The `useEffect` **cleanup function** (the function you return from the effect) is the perfect place to call `abort()`, because React runs it when the component unmounts:

```tsx
// src/components/QuoteCard.tsx (effect only)
useEffect(() => {
  const controller = new AbortController();

  fetchRandomQuote(controller.signal)
    .then((data) => setQuote(data))
    .catch((err: unknown) => {
      if (err instanceof Error && err.name === 'AbortError') return; // we cancelled it, not a real error
      setError('Could not load a quote.');
    });

  return () => controller.abort();
}, []);
```

Notice how the `catch` ignores `AbortError`. Cancelling on purpose is not something to show the user. Every other error (no internet, server error, bad JSON) sets an `error` state.

If your app runs inside React's Strict Mode, React runs effects twice in development (mount, clean up, mount again) to help you find missing cleanups. With the abort in place, the first request is cancelled and only the second one updates the screen, so you will not see any flicker. The [React course lesson on effect cleanup](/courses/react/useeffect-dependencies-and-cleanup) explains this in more depth.

## Putting it together in HabitHop

Here is the finished card with an error message, a spinner and some styling. It uses `ActivityIndicator` from the [Switch and ActivityIndicator lesson](/courses/react-native/switch-and-activity-indicator).

```tsx
// src/components/QuoteCard.tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { fetchRandomQuote, type Quote } from '@/lib/quotes';

export function QuoteCard() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchRandomQuote(controller.signal)
      .then((data) => setQuote(data))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError('Could not load a quote.');
      });
    return () => controller.abort();
  }, []);

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!quote) return <ActivityIndicator style={styles.card} />;

  return (
    <View style={styles.card}>
      <Text style={styles.quote}>"{quote.quote}"</Text>
      <Text style={styles.author}>{quote.author}</Text>
    </View>
  );
}
```

Now drop it at the top of the Today tab:

```tsx
// src/app/(tabs)/index.tsx (top part)
import { QuoteCard } from '@/components/QuoteCard';

export default function TodayScreen() {
  return (
    <View style={{ flex: 1 }}>
      <QuoteCard />
      {/* your habit list from earlier lessons */}
    </View>
  );
}
```

**What you will see:** for a moment a small spinner in a light purple card, then a quote in italics with the author's name underneath in purple. Reload the app (press `r` in the terminal) and you get a different quote.

## Mobile differences you should know

`fetch` is the same function as in the browser, but the phone is not a browser. A few things behave differently:

- **No CORS.** CORS is a browser safety rule. A native app on iOS or Android does not apply it, so APIs that "block CORS" in the browser often work fine in your app. (The web version of your Expo app still runs in a browser, so CORS applies there.)
- **Use HTTPS.** iOS blocks plain `http://` addresses by default (a rule called App Transport Security), and Android blocks plain HTTP traffic by default too. Always use `https://` for real servers.
- **`localhost` is the phone, not your computer.** If you run your own API on your laptop, `http://localhost:3000` on a phone or emulator points at the device itself. Use your computer's local network IP address (for example `http://192.168.1.20:3000`), or `http://10.0.2.2:3000` from the Android emulator. During development, Android allows plain HTTP for this case.

## Common mistakes

**Forgetting `response.ok`.** You call an address with a typo, the server answers `404`, and your code tries to read `quote.quote` from an error page. The symptom is an empty card or `undefined`. Always check `response.ok` and throw.

**Making the effect function `async`.** This looks natural but React complains:

```text
useEffect must not return anything besides a function, which is used for clean-up.
It looks like you wrote useEffect(async () => ...) or returned a Promise.
```

An `async` function always returns a promise, and React expects a cleanup function. Keep the effect itself normal and call an async function (or use `.then`) inside it.

**Showing "Aborted" to the user.** If you do not check for `AbortError`, quickly leaving the screen sets your error state (or logs a scary message). Ignore that one error name in `catch`.

**`Network request failed` on Android with a local server.** This is the error you get when the phone cannot reach the address. Check that you are not using `localhost`, that your phone and computer are on the same Wi-Fi, and that your server listens on all network interfaces, not only `127.0.0.1`.

## Quick recap

- React Native has the same `fetch` as the browser. Keep API calls in a small file like `src/lib/quotes.ts`.
- `response.json()` is untyped. Write a type such as `Quote` and assert it, knowing this does not check the data at run time.
- `fetch` does not throw on `404` or `500`. Check `response.ok` yourself.
- Fetch inside `useEffect`, store the result in state, and render a loading state first.
- Use an `AbortController` and call `abort()` in the effect cleanup. Ignore `AbortError` in your `catch`.
- On a phone there is no CORS, plain HTTP is blocked by default, and `localhost` means the device itself.

Next, you will make loading and errors feel good with retries and pull to refresh in [Loading States, Errors and Pull to Refresh](/courses/react-native/loading-and-refreshing).

<code id="code-content" class="language-tsx">
// src/components/QuoteCard.tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { fetchRandomQuote, type Quote } from '@/lib/quotes';
// A "quote of the day" card for the top of the Today screen
export function QuoteCard() {
  const [quote, setQuote] = useState&lt;Quote | null&gt;(null);
  const [error, setError] = useState&lt;string | null&gt;(null);
  useEffect(() =&gt; {
    // One controller per request, so we can cancel it
    const controller = new AbortController();
    fetchRandomQuote(controller.signal)
      .then((data) =&gt; setQuote(data))
      .catch((err: unknown) =&gt; {
        // We cancelled it ourselves: not a real error
        if (err instanceof Error &amp;&amp; err.name === 'AbortError') return;
        setError('Could not load a quote.');
      });
    // Cleanup: runs when the card leaves the screen
    return () =&gt; controller.abort();
  }, []);
  if (error) return &lt;Text style={styles.error}&gt;{error}&lt;/Text&gt;;
  if (!quote) return &lt;ActivityIndicator style={styles.card} /&gt;;
  return (
    &lt;View style={styles.card}&gt;
      &lt;Text style={styles.quote}&gt;"{quote.quote}"&lt;/Text&gt;
      &lt;Text style={styles.author}&gt;{quote.author}&lt;/Text&gt;
    &lt;/View&gt;
  );
}
// ---
const styles = StyleSheet.create({
  card: { margin: 16, padding: 16, borderRadius: 16, backgroundColor: '#F3F0FF' },
  quote: { fontSize: 16, fontStyle: 'italic', color: '#1F1A33' },
  author: { marginTop: 8, fontWeight: '600', color: '#7C5CFC' },
  error: { margin: 16, color: '#B91C1C' },
});
</code></pre>
