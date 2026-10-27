---
publishDate: 2026-10-24T00:30
title: Keeping Secrets Safe with SecureStore
slug: secure-store
metadescription: 'Store login tokens and other small secrets safely on iOS and Android with expo-secure-store, and learn its limits, key rules and web support.'
updateDate: 2026-10-24T00:30
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'expo-secure-store', 'security', 'storage']
course: react-native
---

## Some data needs a safe

In [Saving Data on the Phone with AsyncStorage](/courses/react-native/async-storage) you saved HabitHop's habits to the phone. That storage is a plain file. It is not encrypted, so it is fine for "Drink water 💧" but not for anything private.

Many apps keep a **session token** after login. A **token** is a long random string the server gives you after you sign in. The app sends it with every request to prove "this is Riya, she already logged in". Whoever holds the token can act as Riya, so it must be stored like a password.

Phones have a built-in safe for exactly this:

- On **iOS** it is the **Keychain**, the same place iPhone stores Wi-Fi passwords.
- On **Android** values are encrypted with a key kept in the **Android Keystore**, a secure area that apps cannot read the key from.

The **expo-secure-store** library gives you one simple API for both. In this lesson you will store a fake session for the login flow from [Protected Routes and a Simple Login Flow](/courses/react-native/protected-routes), so the user stays signed in after restarting the app.

All tokens in this lesson are **fake** demo values like `demo-session-token-not-real`. Never paste real keys or tokens into tutorial code or commit them to Git.

## Install it

```bash
npx expo install expo-secure-store
```

expo-secure-store is included in Expo Go, so you can try it right away. The install command also adds `"expo-secure-store"` to the `plugins` list in `app.json`. That **config plugin** (a small script that changes the native project when you build) matters later for Face ID and Android backups.

## The API in three calls

The API looks a lot like AsyncStorage: string keys, string values, promises.

```ts
// a quick tour (not a file in HabitHop)
import * as SecureStore from 'expo-secure-store';

await SecureStore.setItemAsync('habithop.token', 'demo-session-token-not-real');
const token = await SecureStore.getItemAsync('habithop.token'); // string or null
await SecureStore.deleteItemAsync('habithop.token');
```

There are also synchronous versions, `SecureStore.getItem` and `SecureStore.setItem`. They block the JavaScript thread while the phone talks to the Keychain, so prefer the `Async` versions in normal code.

### Key names are strict

Unlike AsyncStorage, keys can only contain letters, numbers, `.`, `-` and `_`. A key with a space or a colon throws right away:

```text
Error: Invalid key provided to SecureStore. Keys must not be empty and contain only alphanumeric characters, ".", "-", and "_".
```

So `'habithop.session'` is fine, but `'habithop:session'` or `'my token'` is not.

### Small values only

The Keychain and Keystore are made for small secrets: tokens, passwords, short keys. Older versions of Expo warned when a value was bigger than 2048 bytes, and very large values can fail to save on some devices. Keep each value to a few short strings. Do **not** put your habit list, images or API responses in SecureStore. That data goes in AsyncStorage, [SQLite](/courses/react-native/sqlite-database) or [files](/courses/react-native/file-system).

### Not on the web

SecureStore only works on **iOS and Android**. On the web there is no Keychain, so the functions are not available. You can check with `await SecureStore.isAvailableAsync()`, which is `true` only on iOS and Android, or simply check `Platform.OS` as we do below.

## Build the session helpers

Like the habit storage, keep all session code in one small file. The session is a tiny object, so we store it as JSON, just as you did with habits.

First, the type and the key:

```ts
// src/lib/session.ts (start)
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type Session = {
  userName: string;
  token: string;
  expiresAt: string; // ISO date-time
};

const SESSION_KEY = 'habithop.session';
const canUseSecureStore = Platform.OS === 'ios' || Platform.OS === 'android';
```

Saving:

```ts
// src/lib/session.ts (save)
export async function saveSession(session: Session): Promise<void> {
  if (!canUseSecureStore) return;
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}
```

The `keychainAccessible` option is **iOS only**. It decides when the value can be read. The default, `WHEN_UNLOCKED`, means "only while the phone is unlocked". `AFTER_FIRST_UNLOCK` means "any time after the user has unlocked the phone once since it was turned on", which is useful if your app ever needs the token while running in the background (for example, for a background sync). Android ignores this option.

Loading, with an expiry check:

```ts
// src/lib/session.ts (load)
export async function loadSession(): Promise<Session | null> {
  if (!canUseSecureStore) return null;
  try {
    const json = await SecureStore.getItemAsync(SESSION_KEY);
    if (!json) return null;
    const session = JSON.parse(json) as Session;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      await clearSession();
      return null;
    }
    return session;
  } catch (error) {
    console.warn('Could not read the session', error);
    return null;
  }
}
```

Real tokens usually **expire** (stop working) after some time. Checking `expiresAt` on startup means the app sends the user to the sign-in screen instead of making requests that will fail. If reading fails for any reason (for example, Android lost the encryption key after the user changed their lock screen), we return `null` and the user simply signs in again.

Deleting, for sign out:

```ts
// src/lib/session.ts (clear)
export async function clearSession(): Promise<void> {
  if (!canUseSecureStore) return;
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
```

And a pretend login. A real app would `fetch` its server with the user's email and password and get the token back. We just make one up, clearly marked as fake:

```ts
// src/lib/session.ts (demo)
export function createDemoSession(userName: string): Session {
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return {
    userName,
    token: `demo-session-token-not-real-${Date.now()}`,
    expiresAt: new Date(Date.now() + sevenDays).toISOString(),
  };
}
```

## Putting it together in HabitHop

In the protected routes lesson, the sign-in screen set a `session` in state. Now it also saves it:

```tsx
// src/app/(auth)/sign-in.tsx (part)
import { router } from 'expo-router';
import { createDemoSession, saveSession } from '@/lib/session';

async function handleSignIn() {
  const session = createDemoSession(name); // name comes from a TextInput
  await saveSession(session);
  router.replace('/');
}
```

When the app starts, your auth provider calls `loadSession()` once, the same way `HabitsProvider` calls `loadHabits()`. If it returns a session, the user goes straight to the Today tab. If it returns `null`, they see the sign-in screen. Signing out calls `clearSession()` and sends them back:

```tsx
// src/app/(tabs)/settings.tsx (part)
import { router } from 'expo-router';
import { clearSession } from '@/lib/session';

async function signOut() {
  await clearSession();
  router.replace('/sign-in');
}
```

**What you will see:** sign in as Sam, close the app fully and reopen it. You land directly on the Today tab instead of the sign-in screen. Tap **Sign out** in Settings, reopen the app, and the sign-in screen is back.

## Extra safety with Face ID or fingerprint

For very sensitive values you can ask the phone to check the user's face or fingerprint before reading:

```ts
// asking for biometrics when reading or writing a value
await SecureStore.setItemAsync('habithop.pin', 'demo-pin-not-real', {
  requireAuthentication: true,
  authenticationPrompt: 'Unlock HabitHop',
});
```

Every later `getItemAsync` for that key shows the Face ID or fingerprint prompt. Two warnings:

- On iOS, Face ID needs a permission message (`NSFaceIDUsageDescription`). The expo-secure-store config plugin adds a default one, and you can set your own with the plugin's `faceIDPermission` option. Expo Go cannot use your app's own message, so test Face ID in a [development build](/courses/react-native/expo-go-vs-development-builds).
- If the user removes or changes their fingerprints or face, values saved with `requireAuthentication` can become unreadable. Always be ready to fall back to signing in again.

HabitHop does not need this, but it is good to know it exists.

## What happens on uninstall and backup

- On **Android**, uninstalling the app deletes its SecureStore data.
- On **iOS**, Keychain items can **survive** an uninstall and reinstall. If a user deletes the app and installs it again, an old session may still be there. If that matters for your app, you can store a "has launched before" flag in AsyncStorage (which *is* deleted on uninstall) and clear the Keychain on the first launch after an install.
- On Android, the expo-secure-store config plugin sets up automatic backups so that encrypted values (which cannot be restored on a new phone, because the key never leaves the old one) do not break your app after a restore.

## Common mistakes

**Putting big data in SecureStore.** Saving the whole habit list or a cached API response "to be safe" makes reads slow and can fail on some devices. Only secrets go in SecureStore.

**Invalid key characters.** `'user:token'` or `'session token'` throws the `Invalid key provided to SecureStore` error shown above. Use letters, numbers, dots, dashes and underscores.

**Crashing on the web.** Calling SecureStore in the web version of your app fails because there is no native module there. Guard with `Platform.OS` or `isAvailableAsync()`.

**Thinking SecureStore makes your app secure.** It protects data **at rest** on the phone. Anything inside your JavaScript bundle (like an API key in your code) can still be extracted from the app download. Real secret keys belong on a server, never in the app. See [Environment Variables and App Settings](/courses/react-native/environment-variables) for what is safe to ship.

## Quick recap

- Use **expo-secure-store** for small secrets like session tokens. It uses the iOS Keychain and Android Keystore encryption, and works in Expo Go.
- The API is `setItemAsync`, `getItemAsync` and `deleteItemAsync`, with string keys and values. Store small objects as JSON.
- Keys may only contain letters, numbers, `.`, `-` and `_`. Keep values small, never big data.
- It only works on iOS and Android, not on the web.
- `keychainAccessible` (iOS) controls when values can be read, and `requireAuthentication` adds Face ID or fingerprint checks (test those in a development build).
- Always handle a missing or unreadable session by asking the user to sign in again.

<code id="code-content" class="language-typescript">
// src/lib/session.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
export type Session = {
  userName: string;
  token: string;
  expiresAt: string; // ISO date-time
};
// Keys may only use letters, numbers, ".", "-" and "_"
const SESSION_KEY = 'habithop.session';
// SecureStore does not exist on web, so we skip saving there
const canUseSecureStore = Platform.OS === 'ios' || Platform.OS === 'android';
export async function saveSession(session: Session): Promise&lt;void&gt; {
  if (!canUseSecureStore) return;
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}
export async function loadSession(): Promise&lt;Session | null&gt; {
  if (!canUseSecureStore) return null;
  try {
    const json = await SecureStore.getItemAsync(SESSION_KEY);
    if (!json) return null;
    const session = JSON.parse(json) as Session;
    // An expired session is as good as no session
    if (new Date(session.expiresAt).getTime() &lt; Date.now()) {
      await clearSession();
      return null;
    }
    return session;
  } catch (error) {
    console.warn('Could not read the session', error);
    return null;
  }
}
export async function clearSession(): Promise&lt;void&gt; {
  if (!canUseSecureStore) return;
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
// A pretend login: a real app would get this token from its server
export function createDemoSession(userName: string): Session {
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return {
    userName,
    token: `demo-session-token-not-real-${Date.now()}`,
    expiresAt: new Date(Date.now() + sevenDays).toISOString(),
  };
}
</code></pre>
