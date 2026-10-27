---
publishDate: 2026-10-23T15:30
title: Protected Routes and a Simple Login Flow
slug: protected-routes
metadescription: 'Add a sign-in screen to HabitHop and guard the app with Stack.Protected in Expo Router, so signed-out users only see sign-in and signed-in users never do.'
updateDate: 2026-10-23T15:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'expo-router', 'navigation', 'auth']
course: react-native
---

## The goal

Many apps have screens only signed-in users should see. HabitHop will get a simple sign-in flow:

- When nobody is signed in, the app shows **only** the sign-in screen.
- After signing in, the user lands on the Today tab, and the sign-in screen is gone. Pressing back does not return to it.
- Signing out from Settings sends the user back to sign-in, and none of the habit screens can be reached.

These are called **protected routes**: routes that are only available when a condition is true. Expo Router has a built-in tool for exactly this, `Stack.Protected`, so you do not have to write redirect logic by hand.

To keep the focus on navigation, "signing in" here just means typing your name. There is no password and no server. At the end you will see what changes for a real login.

## Step 1: an auth context

You need one place that knows "is someone signed in?". You already know the pattern from [Sharing State with Context](/courses/react-native/context-for-shared-state): a context, a provider and a hook.

```tsx
// src/context/AuthContext.tsx
import { createContext, use, useState, type ReactNode } from 'react';

type AuthContextValue = {
  userName: string | null;
  isSignedIn: boolean;
  signIn: (name: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userName, setUserName] = useState<string | null>(null);

  const value: AuthContextValue = {
    userName,
    isSignedIn: userName !== null,
    signIn: (name) => setUserName(name),
    signOut: () => setUserName(null),
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
```

`userName` is `null` when signed out. `isSignedIn` is worked out from it, so the two can never disagree.

## Step 2: the sign-in screen in an (auth) group

Put the sign-in screen in a route group called `(auth)`. As you learned in [Nested Layouts and Route Groups](/courses/react-native/layouts-and-route-groups), the group name does not appear in the URL, so the route is simply `/sign-in`. The group just keeps auth screens together (later you might add `sign-up.tsx` or `forgot-password.tsx` next to it).

```text
src/app/
  _layout.tsx
  (auth)/
    sign-in.tsx        -> /sign-in
  (tabs)/
    _layout.tsx
    index.tsx
    stats.tsx
    settings.tsx
  habit/
    [id].tsx
  new-habit.tsx
```

```tsx
// src/app/(auth)/sign-in.tsx
import { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [name, setName] = useState('');

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 28, fontWeight: '700' }}>Welcome to HabitHop</Text>
      <TextInput
        placeholder="Your name"
        value={name}
        onChangeText={setName}
        style={{ borderWidth: 1, borderRadius: 8, padding: 12 }}
      />
      <Button title="Sign in" disabled={name.trim() === ''} onPress={() => signIn(name.trim())} />
    </View>
  );
}
```

Notice what is **missing**: no `router.replace('/')` after signing in. The screen only changes the auth state. The layout decides where to go, as you will see next.

## Step 3: guard the routes with Stack.Protected

Here is the whole idea. In the root layout, wrap screens in `Stack.Protected` with a `guard`:

```tsx
// src/app/_layout.tsx
function RootStack() {
  const { isSignedIn } = useAuth();
  return (
    <Stack screenOptions={{ headerTintColor: '#7C5CFC' }}>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="habit/[id]" options={{ title: 'Habit' }} />
        <Stack.Screen name="new-habit" options={{ presentation: 'modal', title: 'New habit' }} />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)/sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
```

How it works:

- **`guard={true}`**: the screens inside are available, as normal.
- **`guard={false}`**: the screens inside **do not exist** for now. You cannot link to them, push them or deep link to them. If the user is currently on one of them, Expo Router removes it and moves the user to a screen that is allowed.

So, with `isSignedIn` false, the only screen left in the stack is `(auth)/sign-in`, and that is what the app shows. When `signIn('Riya')` runs, `isSignedIn` becomes true: the first group unlocks, the sign-in group locks, and Expo Router moves Riya to the first available screen, the tabs. Since the sign-in screen no longer exists, there is no way "back" to it.

Sign out does the reverse. Everything inside the first `Stack.Protected` disappears, including any open habit details or the new habit modal, and the user sees sign-in.

The same component exists for tabs (`Tabs.Protected`), if you ever need to hide a single tab, for example an "Admin" tab.

## Step 4: put the providers around it

`RootStack` calls `useAuth()`, so it must be *inside* `AuthProvider`. That is why the root layout is split into two components: the default export sets up the providers, and `RootStack` reads from them.

```tsx
// src/app/_layout.tsx
export default function RootLayout() {
  return (
    <AuthProvider>
      <HabitsProvider>
        <RootStack />
      </HabitsProvider>
    </AuthProvider>
  );
}
```

The complete file is in the code panel.

## Step 5: sign out from Settings

```tsx
// src/app/(tabs)/settings.tsx
import { Button, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';

export default function SettingsScreen() {
  const { userName, signOut } = useAuth();
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text>Signed in as {userName}</Text>
      <Button title="Sign out" onPress={signOut} />
    </View>
  );
}
```

Again, no navigation code. Changing the state is enough.

## Try it

1. Reload the app. You see "Welcome to HabitHop" with a name field, and no tab bar.
2. Type "Riya" and tap Sign in. The Today tab appears with the habit list.
3. Use the Android back button (or try swiping back on iOS). You do not return to sign-in. On Android, back from Today leaves the app, just like any app's home screen.
4. Open the Settings tab: "Signed in as Riya". Tap Sign out. You are back on the sign-in screen.

## The older way: Redirect

Before `Stack.Protected` existed, apps redirected by hand, and you will still see this in tutorials. A screen or layout checks the state and renders `<Redirect>`:

```tsx
import { Redirect } from 'expo-router';

if (!isSignedIn) {
  return <Redirect href="/sign-in" />;
}
```

`Redirect` is still handy for one-off cases (like an old route that moved). But for auth, `Stack.Protected` is simpler and safer: you cannot forget to add a check to one screen, and deep links to protected screens are blocked automatically.

## From this demo to a real login

This flow keeps the user in React state, so they are signed out every time the app restarts. A real app needs three more things:

1. **A server that checks the password** and returns a **token** (a long secret string that proves who you are). See [Fetching Data from an API](/courses/react-native/fetching-data).
2. **Saving the token safely** on the phone, so the user stays signed in. Use SecureStore, which encrypts it, not AsyncStorage. That is covered in [Keeping Secrets Safe with SecureStore](/courses/react-native/secure-store).
3. **A loading state at startup.** Reading the saved token takes a moment. While it loads you do not yet know if the user is signed in, so keep the splash screen visible (or show a spinner) instead of flashing the sign-in screen for a split second.

One important note: protected routes only control **what the app shows**. They are not security for your data. Anyone can inspect an app's code, so your server must check the token on every request too.

## Common mistakes

**Calling useAuth outside the provider.** If the root layout's default export calls `useAuth()` directly while also rendering `<AuthProvider>`, it is *outside* the provider and throws `useAuth must be used inside <AuthProvider>`. Move the hook into a child component like `RootStack`.

**Navigating after signIn.** Adding `router.replace('/')` right after `signIn()` can run before the state update, when `/` is still locked. Let `Stack.Protected` handle the move.

**A screen in no group at all.** Any `Stack.Screen` (or route file) outside every `Stack.Protected` is always available, signed in or not. That is fine for public pages like "About", but double-check that private screens are inside the guarded group.

**Wrong screen name for a grouped route.** In the root layout the sign-in screen is `(auth)/sign-in`, group included. Writing `sign-in` gives a "No route named" warning, and the guard does not apply to it.

## Quick recap

- Protected routes are routes that only exist while a condition is true.
- Keep auth state in a context (`AuthProvider`, `useAuth`) and wrap the root `Stack` with it.
- `<Stack.Protected guard={isSignedIn}>` makes its screens available only when signed in. A second group with `guard={!isSignedIn}` holds the sign-in screen.
- When the guard changes, Expo Router moves the user automatically. Screens only change state, they do not navigate.
- `Redirect` still exists for one-off redirects.
- A real login adds a server, a token in SecureStore and a loading state. Route guards are not data security.

<code id="code-content" class="language-tsx">
// src/app/_layout.tsx
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { HabitsProvider } from '@/context/HabitsContext';
export const unstable_settings = {
  anchor: '(tabs)',
};
export default function RootLayout() {
  return (
    &lt;AuthProvider&gt;
      &lt;HabitsProvider&gt;
        &lt;RootStack /&gt;
      &lt;/HabitsProvider&gt;
    &lt;/AuthProvider&gt;
  );
}
function RootStack() {
  const { isSignedIn } = useAuth();
  return (
    &lt;Stack screenOptions={{ headerTintColor: '#7C5CFC' }}&gt;
      &lt;Stack.Protected guard={isSignedIn}&gt;
        &lt;Stack.Screen name="(tabs)" options={{ headerShown: false }} /&gt;
        &lt;Stack.Screen name="habit/[id]" options={{ title: 'Habit' }} /&gt;
        &lt;Stack.Screen
          name="new-habit"
          options={{ presentation: 'modal', title: 'New habit' }}
        /&gt;
      &lt;/Stack.Protected&gt;
      &lt;Stack.Protected guard={!isSignedIn}&gt;
        &lt;Stack.Screen name="(auth)/sign-in" options={{ headerShown: false }} /&gt;
      &lt;/Stack.Protected&gt;
    &lt;/Stack&gt;
  );
}
</code></pre>
