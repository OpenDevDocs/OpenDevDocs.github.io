---
publishDate: 2026-10-25T09:30
title: Publishing to the Apple App Store
slug: publishing-to-the-app-store
metadescription: 'Ship HabitHop to iPhones without a Mac: join the Apple Developer Program, set up App Store Connect, test with TestFlight and submit with eas submit.'
updateDate: 2026-10-25T09:30
author: ['bishal-biswas']
level: 3
tags: ['react-native', 'app-store', 'ios', 'eas']
course: react-native
---

## Getting HabitHop onto iPhones

The App Store is the only normal way to install apps on an iPhone, so to reach iPhone users you need to go through Apple. The good news: thanks to EAS, **you do not need a Mac** for any step in this lesson. EAS Build makes the iOS app on Macs in the cloud, and EAS Submit uploads it to Apple for you.

Here is the journey:

1. Join the **Apple Developer Program**.
2. Make a production iOS build with EAS.
3. Upload it with `eas submit`, which also sets things up in **App Store Connect**.
4. Test it on real iPhones with **TestFlight**.
5. Fill in the store page and send the app for **App Review**.

If you just finished [Publishing to Google Play](/courses/react-native/publishing-to-google-play), many ideas are the same, but Apple has its own names for everything. Apple also changes its website screens from time to time, so button names may move a little.

## Step 1: the Apple Developer Program

To publish on the App Store (and even to run your own builds on a real iPhone outside Expo Go), you need a paid membership in the **Apple Developer Program**.

- It costs **99 US dollars per year**. If you stop paying, your apps are removed from the store.
- You sign up with an **Apple Account** (the same kind you use on an iPhone). Turn on two-factor authentication first; Apple requires it.
- You can join as an **individual** (your own name is shown as the seller in the store) or as an **organization** (the company name is shown; this needs a D-U-N-S number, a free company ID).
- Apple checks your details. This is often quick for individuals but can take a few days, so start early.

You will use two Apple websites:

- **Apple Developer** (developer.apple.com): certificates, identifiers and your membership.
- **App Store Connect** (appstoreconnect.apple.com): your apps, TestFlight, store pages, reviews and sales.

## Step 2: get the config ready

Check three things in your app config (see [App Config, Icons and the Splash Screen](/courses/react-native/app-config-icons-and-splash)):

```json
{
  "expo": {
    "name": "HabitHop",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.riya.habithop",
      "config": {
        "usesNonExemptEncryption": false
      }
    }
  }
}
```

- `ios.bundleIdentifier` is the permanent ID for your app on Apple's side.
- `version` is the version users see, like `1.0.0`. The build number is handled by EAS (`autoIncrement` from [Building Your App with EAS Build](/courses/react-native/eas-build)).
- `ios.config.usesNonExemptEncryption: false` answers Apple's **export compliance** question ahead of time. Every app that uses encryption has to say so because of export laws. HabitHop only uses normal HTTPS, which counts as "exempt", so the answer is `false`. Without this line, App Store Connect asks you the question for every single build before you can test it.

## Step 3: build and submit

Make the production build:

```bash
eas build --platform ios --profile production
```

The first iOS build asks you to log in with your Apple Account. EAS then talks to Apple for you: it registers the bundle identifier and creates the **distribution certificate** and **provisioning profile**. These are the files Apple uses to prove an app really comes from you. On a Mac with Xcode you would manage them by hand; EAS stores them safely and reuses them for later builds.

When the build is done, send it to Apple:

```bash
eas submit --platform ios --latest
```

The first time, `eas submit` asks a few questions. If your app does not exist in App Store Connect yet, it can create the app record for you, using the name and bundle identifier from your config. It also offers to create an **App Store Connect API key**: a key that lets EAS upload builds without asking for your password every time. Let EAS create and store it.

Roughly what you will see at the end:

```text
✔ Submitted your app to Apple App Store Connect!

Your binary has been successfully uploaded to App Store Connect!
- It is now being processed by Apple - you will receive an email when the processing finishes.
- It usually takes about 5 to 10 minutes depending on how busy Apple servers are.
```

To skip the questions next time, save the answers in the `submit` part of `eas.json`:

```json
{
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "1234567890"
      }
    }
  }
}
```

`ascAppId` is your app's numeric ID in App Store Connect. Find it under your app, then **App Information**, labelled "Apple ID". (The number above is just a placeholder.) It is not a secret.

From now on, you can build and submit in one command:

```bash
eas build --platform ios --profile production --auto-submit
```

## Step 4: TestFlight

**TestFlight** is Apple's beta testing service. Testers install the free TestFlight app on their iPhone, and then they can install your test builds through it. This is also the easiest way for *you* to try the real build on your own iPhone without a Mac.

After Apple finishes processing your upload, the build appears in App Store Connect under the **TestFlight** tab. There are two kinds of testers:

| Testers | Who | Limit | Review |
| --- | --- | --- | --- |
| Internal | People on your App Store Connect team | Up to 100 | No review, available right away |
| External | Anyone with an email invite or a public link | Up to 10,000 | Needs a quick Beta App Review first |

For a solo developer, start with **internal testing**: add yourself (and anyone you added to your team) to an internal group, and the build is ready in minutes. For friends like Sam and Mia who are not on your team, create an **external** group. The first external build of each version goes through a short review, often within a day.

TestFlight builds expire after 90 days, so testers need newer builds over time. Ask testers to send feedback right in TestFlight: they can take a screenshot and write a note, and it shows up in App Store Connect.

## Step 5: the store page and App Review

In App Store Connect, open your app and the version you want to release (for example 1.0.0). You need to fill in:

- **Screenshots**: Apple asks for screenshots in specific iPhone sizes (and iPad sizes if your app supports iPad). App Store Connect lists the sizes it needs. You can take them from TestFlight on a real iPhone. Show the Today screen with a few habits, the stats screen and the new habit form.
- **Description** and **promotional text**: what the app does, in plain words.
- **Keywords**: up to 100 characters, separated by commas, like `habit,tracker,streak,routine,goals`. These help people find your app in search.
- **Support URL**: a web page where users can get help. A simple page with an email address is fine.
- **Privacy policy URL**: required for every app.
- **App Privacy**: a questionnaire about what data you collect. Apple shows the answers on your store page as "privacy labels". For HabitHop: habits stay on the phone, so you collect very little. Be honest.
- **Age rating**: another questionnaire.
- **Build**: pick the build you tested in TestFlight.
- **App Review Information**: contact details and notes for the reviewer. If your app has a login (like the simple one from [Protected Routes and a Simple Login Flow](/courses/react-native/protected-routes)), tell the reviewer how to sign in.

Then click **Add for Review** and submit. A real person at Apple tests your app against the **App Review Guidelines**. Many reviews finish within a day or two. You will get an email with the result.

When it is approved, you can release it right away, on a date, or manually with a button. Like Google Play, Apple also lets you do a **phased release** for updates, which spreads an update over seven days.

### Common reasons for rejection

- The app crashes or has obvious bugs. Test the exact build in TestFlight first.
- Placeholder content, broken links, or "coming soon" screens.
- Missing or wrong privacy information.
- The app does too little. A habit tracker with streaks, stats and reminders is fine; a single button that shows a quote may be judged too simple.
- Asking for permissions (camera, location, notifications) without a clear reason. Your permission messages from [Asking for Permissions the Right Way](/courses/react-native/permissions) should explain why you need them.

A rejection is not the end. Apple tells you which guideline was broken. Fix it, upload a new build, and reply in App Store Connect.

## Updates later

For each new version:

1. Bump `version` in your app config (for example to `1.1.0`).
2. Run `eas build --platform ios --profile production --auto-submit`.
3. Test in TestFlight.
4. Create the new version in App Store Connect, pick the build, write "What's New" notes, and submit for review.

For small JavaScript-only fixes, [EAS Update](/courses/react-native/eas-update) can send the fix straight to users without a new review, as long as it follows Apple's rules (fixes and small changes, not a whole new app).

## Common mistakes

**"Missing Compliance" on every build in TestFlight.** You did not set `ios.config.usesNonExemptEncryption`. Fix: add it to your app config, or answer the question in App Store Connect for that build.

**Upload rejected because the build number was already used.** Apple needs a higher build number for every upload, even for the same version. Fix: `"autoIncrement": true` with `"appVersionSource": "remote"` in `eas.json`.

**The bundle identifier is taken.** Another developer already uses `com.habithop.app`. Bundle IDs are unique across all of Apple. Fix: use your own reversed domain or name, like `com.riya.habithop`.

**Waiting for a Mac.** You do not need one. EAS Build makes the IPA in the cloud, EAS Submit uploads it, and TestFlight lets you test it on a real iPhone. A Mac is only needed for the iOS Simulator or building locally.

## Quick recap

- The Apple Developer Program costs **99 US dollars per year**. You manage apps in **App Store Connect**.
- **No Mac needed**: EAS Build creates the certificates, profiles and IPA in the cloud.
- `eas submit --platform ios --latest` uploads your build, and can create the app record and an API key the first time. Save `ascAppId` in `eas.json`.
- Set `ios.config.usesNonExemptEncryption: false` to skip the export compliance question.
- Use **TestFlight** to test: internal testers right away, external testers after a short beta review.
- Fill in screenshots, description, keywords, privacy details and age rating, then submit for **App Review**.

<code id="code-content" class="language-json">
{
  "cli": {
    "version": "&gt;= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      },
      "ios": {
        "ascAppId": "1234567890"
      }
    }
  }
}
</code></pre>
