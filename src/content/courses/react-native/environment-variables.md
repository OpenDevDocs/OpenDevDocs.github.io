---
publishDate: 2026-10-25T05:00
title: Environment Variables and App Settings
slug: environment-variables
metadescription: 'Use EXPO_PUBLIC_ environment variables and .env files in Expo, learn why they are never secret, and set values per build with eas.json and EAS.'
updateDate: 2026-10-25T05:00
author: ['bishal-biswas']
level: 2
tags: ['react-native', 'expo', 'environment-variables', 'eas']
course: react-native
---

## Why environment variables?

HabitHop's "quote of the day" card talks to an API. While you build the app, you might want it to use a test server. In the real app, it should use the real server. You do not want to edit the code and remember to change it back every time you build.

An **environment variable** is a named value that lives *outside* your code, like `API_URL=https://dummyjson.com`. Your code reads the name, and you set the value differently for each situation: on your laptop, in a test build, in the store build. If you did the [Next.js course](/courses/nextjs/environment-variables) or [Node.js course](/courses/nodejs/environment-variables-and-env-file), the idea is the same. But there is one huge difference in a mobile app, and it is the most important thing in this lesson:

> **Everything you put in an app's environment variables ends up inside the app, where anyone can read it.**

Keep that in mind. Let's see how it works.

## EXPO_PUBLIC_ variables

Expo reads environment variables whose names start with `EXPO_PUBLIC_` and makes them available in your app code through `process.env`:

```ts
// Anywhere in your app code
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
console.log(apiUrl); // 'https://dummyjson.com'
```

The `EXPO_PUBLIC_` prefix is a safety switch. Only variables with this prefix are put into your app. Other variables on your computer (like `PATH`, or a password you set in your terminal) stay out, so you cannot leak them by accident.

### How it works: inlining

When Expo bundles your JavaScript, it finds every `process.env.EXPO_PUBLIC_SOMETHING` in your code and **replaces it with the actual value**, as plain text. This is called **inlining**. So this line in your code:

```ts
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
```

becomes this inside the finished app:

```ts
const apiUrl = 'https://dummyjson.com';
```

There is no real `process.env` object on the phone. That has two consequences:

1. The value is fixed when the bundle is made. Changing it later on your computer does nothing to an app that is already built.
2. You must write the full name, exactly like `process.env.EXPO_PUBLIC_API_URL`. These forms do **not** work, because the bundler cannot see which name you mean:

```ts
// None of these get replaced:
const { EXPO_PUBLIC_API_URL } = process.env;
const name = 'EXPO_PUBLIC_API_URL';
const url = process.env[name];
```

## .env files

Typing variables in the terminal every time is no fun. Instead, put them in a file called `.env` in the root of your project (next to `package.json`):

```bash
# .env
EXPO_PUBLIC_API_URL=https://dummyjson.com
EXPO_PUBLIC_APP_ENV=development
```

Each line is `NAME=value`, with no spaces around the `=` and no quotes needed. Lines starting with `#` are comments. (dummyjson.com is a free test API, so it is fine to use here.)

Expo CLI loads this file automatically when you run `npx expo start`. You do not need any extra library. If you change `.env` while the dev server is running and do not see the new value, stop the server and start it again with a clean cache:

```bash
npx expo start --clear
```

Expo can load several `.env` files. From highest to lowest priority:

```text
.env.development.local   (only in development mode, only on your computer)
.env.local               (only on your computer)
.env.development         (development mode)
.env                     (always)
```

"Development mode" is what `npx expo start` uses. A production bundle (for example from `npx expo start --no-dev` or a store build) reads `.env.production` and `.env.production.local` instead. The template's `.gitignore` already ignores `.env*.local` files, so those are good for values that are personal to your machine.

Should you commit `.env` to git? If it only holds public settings like the API address, committing it is fine and helps your teammates. If it holds anything private, keep it out of git. But wait: if a value is private, it should not be in an `EXPO_PUBLIC_` variable at all. Read on.

## Never put secrets in the app

Here is the big warning again, with the reason. An Android APK or iOS app file is just a zip file. Anyone can download your app, unzip it, and search the JavaScript bundle for text. Since `EXPO_PUBLIC_` values are inlined as plain text, they can be found in minutes.

So these are **fine** in `EXPO_PUBLIC_` variables:

- API base URLs, like `https://api.habithop.example`.
- Feature flags, like `EXPO_PUBLIC_SHOW_QUOTES=true`.
- Keys that are *designed* to be public, like some analytics or map keys that are locked to your app ID.

These are **never** okay in your app, no matter how you hide them:

- Secret API keys for paid services (AI APIs, payment providers, email services).
- Database passwords or admin tokens.
- Anything that would cost you money or leak user data if a stranger had it.

So how does an app use a secret API? Through **your own server**. The app calls your server (for example a small API route or serverless function). The server holds the secret key, calls the paid service, and sends back only the result. The secret never touches the phone.

```text
Phone app  --->  your server (holds the secret key)  --->  paid API
```

This setup also lets you add rate limits, so one user cannot run up a huge bill.

What about tokens a *user* gets after logging in? Those belong to that user, not to your app, and they are created at runtime, not at build time. Store them with SecureStore, as you did in [Keeping Secrets Safe with SecureStore](/courses/react-native/secure-store).

## Reading variables safely with TypeScript

`process.env.EXPO_PUBLIC_API_URL` has the type `string | undefined`, because the variable might be missing. It is a good idea to read all your variables in **one file**, check them once, and export clean values:

```ts
// src/lib/env.ts
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';

if (!apiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is missing. Add it to your .env file.');
}

export const env = {
  apiUrl,
  appEnv,
  isProduction: appEnv === 'production',
};
```

Now the rest of the app imports `env`, and TypeScript knows `env.apiUrl` is a `string`. In `src/lib/quotes.ts` from [Fetching Data from an API](/courses/react-native/fetching-data), swap the hard-coded `BASE_URL` for it. Only the top of the file changes; `fetchRandomQuote` and `fetchQuotes` keep using `BASE_URL` as before:

```diff
 // src/lib/quotes.ts
+import { env } from '@/lib/env';
+
-const BASE_URL = 'https://dummyjson.com';
+const BASE_URL = env.apiUrl;
```

Now a staging build can talk to a test server and the store build to the real one, with no code changes.

If someone forgets to set the variable, the app fails right away with a clear message, instead of quietly calling `undefined/quotes/random`.

## Variables in app.config.ts

Variables **without** the `EXPO_PUBLIC_` prefix are not put into the app, but they *are* available while the config is read. So `app.config.ts` (from [App Config, Icons and the Splash Screen](/courses/react-native/app-config-icons-and-splash)) can use them to change native settings:

```ts
// app.config.ts (part)
const IS_DEV = process.env.APP_VARIANT === 'development';
```

This is how one project can produce "HabitHop (Dev)" and "HabitHop" with different bundle IDs.

## Variables for EAS builds

Here is a catch. When you build with [EAS Build](/courses/react-native/eas-build), your project is uploaded to Expo's servers and built there. EAS uploads your project files but skips files your `.gitignore` ignores. So a `.env.local` file never reaches the build server, and your build has no value. There are two ways to give builds their variables.

### Option 1: the env field in eas.json

Each build profile in `eas.json` can have an `env` object:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "APP_VARIANT": "development",
        "EXPO_PUBLIC_APP_ENV": "development"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://dummyjson.com",
        "EXPO_PUBLIC_APP_ENV": "production"
      }
    }
  }
}
```

This is simple and is saved in git, so it is only for non-secret values. That is fine, because anything starting with `EXPO_PUBLIC_` is public anyway.

### Option 2: EAS environment variables

You can also store variables on Expo's servers, per **environment**. EAS has three environments: `development`, `preview` and `production`. Create a variable with the EAS CLI (you will install it in the next lesson):

```bash
eas env:create --name EXPO_PUBLIC_API_URL --value https://dummyjson.com --environment production --visibility plaintext
```

Each variable has a **visibility**:

- `plaintext`: anyone on your team can read it. Right for `EXPO_PUBLIC_` values.
- `sensitive`: hidden in logs and the website, but still readable through the CLI.
- `secret`: cannot be read back at all outside the build servers. Use it for things only the build needs, like a token to download a private package. **Never** make an `EXPO_PUBLIC_` variable secret: it would end up in the app anyway.

Then tell a build profile which environment to use:

```json
{
  "build": {
    "production": {
      "environment": "production"
    }
  }
}
```

To use the same values on your laptop, pull them into a local file:

```bash
eas env:pull --environment development
```

This writes a `.env.local` file that `npx expo start` will read.

Which option should you use? For a small app like HabitHop, the `env` field in `eas.json` is easiest. EAS environment variables are better for teams and for anything sensitive that the build process needs.

## Common mistakes

**The value is `undefined` in the app.** Check three things: the name starts with `EXPO_PUBLIC_`, you wrote `process.env.EXPO_PUBLIC_NAME` in full (no destructuring), and you restarted the dev server with `npx expo start --clear`.

**It works locally but the EAS build has no value.** Your `.env.local` is gitignored, so EAS did not upload it. Add the variable to the build profile's `env` in `eas.json` or create it with `eas env:create`.

**Putting a secret key in `EXPO_PUBLIC_`.** There is no error message, which is what makes it dangerous. Search your bundle and you will find it. Fix: move the secret to a server, and rotate (replace) the leaked key with the service, because the old one is now public.

**Changing a variable and expecting existing installs to change.** Values are inlined when the bundle is built. You need a new build, or a new update with [EAS Update](/courses/react-native/eas-update).

## Quick recap

- Expo puts only variables starting with `EXPO_PUBLIC_` into your app, and you read them with `process.env.EXPO_PUBLIC_NAME` written out in full.
- The values are **inlined** as plain text when the bundle is built.
- Put them in a `.env` file. `.env.local` and other `.env*.local` files are for your machine only.
- **Never put secrets in the app.** Anyone can read the bundle. Keep secret keys on a server.
- Read and check all variables in one file like `src/lib/env.ts`.
- Variables without the prefix are available in `app.config.ts` but not in the app.
- For EAS builds, set values in the `env` field of `eas.json` or with `eas env:create`, and pick an environment with `"environment"`.

<code id="code-content" class="language-typescript">
// src/lib/env.ts
// Read every environment variable in one place.
// Write process.env.EXPO_PUBLIC_NAME in full: Expo replaces it with the
// real value (inlining) when the bundle is built.
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
// Fail early with a clear message instead of calling "undefined/quotes".
if (!apiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is missing. Add it to your .env file.');
}
// Everything here is PUBLIC: anyone can read it inside the app.
// Never put secret keys in EXPO_PUBLIC_ variables.
export const env = {
  apiUrl,
  appEnv,
  isProduction: appEnv === 'production',
};
// Usage elsewhere:
// import { env } from '@/lib/env';
// const res = await fetch(`${env.apiUrl}/quotes/random`);
</code></pre>
