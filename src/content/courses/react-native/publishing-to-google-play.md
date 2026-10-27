---
publishDate: 2026-10-25T08:00
title: Publishing to Google Play
slug: publishing-to-google-play
metadescription: 'Publish HabitHop on Google Play: create a Play Console account, fill in the store listing, upload to the internal testing track and automate it with eas submit.'
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 3
tags: ['react-native', 'google-play', 'android', 'eas']
course: react-native
---

## The road to the Play Store

You have a production Android build of HabitHop from [Building Your App with EAS Build](/courses/react-native/eas-build). Now you will put it on **Google Play**, the app store on almost every Android phone.

Here is the whole journey, so you know where you are at each step:

1. Create a **Google Play Console** developer account.
2. Create the app in the Play Console.
3. Fill in the store listing and the app content forms.
4. Upload your first build by hand to the **internal testing** track.
5. Set up `eas submit` so future uploads happen from your terminal.
6. Test, then move to closed testing and production.

Google changes its Play Console screens and rules from time to time. The ideas below stay the same, but button names may move. When in doubt, the Play Console help pages are the final word.

## Step 1: a Google Play developer account

Go to the Google Play Console website and sign up with a Google account.

- There is a **one-time registration fee of 25 US dollars**. You pay it once, not every year.
- You choose a **personal** account (for yourself) or an **organization** account (for a company). Organization accounts need extra company details, such as a D-U-N-S number.
- Google **verifies your identity**. You may need to upload an ID document and confirm a phone number. This can take from a few hours to a few days, so start early.

## Step 2: create the app

In the Play Console, click **Create app** and fill in:

- **App name**: "HabitHop". This is the name shown in the store (up to 30 characters). It can be different from the name under the icon.
- **Default language**.
- **App or game**: App.
- **Free or paid**: Free. Careful: once an app is free, you cannot make it paid later.
- A few checkboxes about following Google's policies.

The app has no package name yet. Google takes it from the first build you upload, and it must match `android.package` in your app config (`com.riya.habithop`). After that it can never change, which is why you picked it carefully in [App Config, Icons and the Splash Screen](/courses/react-native/app-config-icons-and-splash).

## Step 3: the store listing and app content

Google needs a lot of information before your app can go public. The Play Console dashboard shows a checklist. The main parts:

### Store listing

- **Short description**: up to 80 characters. For example: "Build good habits one day at a time, with streaks and gentle reminders."
- **Full description**: up to 4,000 characters. Say what the app does and who it is for. Plain, honest text works best.
- **App icon**: 512 by 512 pixels, PNG.
- **Feature graphic**: 1024 by 500 pixels. A banner shown at the top of your store page.
- **Phone screenshots**: at least 2. Take them from a real phone or an emulator running your preview build. Show the Today screen with a few habits, the stats screen, and the new habit form.

### App content

These are forms about what your app does. Answer them truthfully: wrong answers can get your app removed.

- **Privacy policy**: a link to a web page that explains what data your app collects. You need one even if the answer is "almost nothing". For HabitHop: habits are stored only on the phone, and the quote card calls a free test API.
- **Data safety**: a form about what data you collect and share. If you add analytics or crash reporting later, those count.
- **Content rating**: a questionnaire that gives your app an age rating.
- **Target audience**: which age groups the app is for.
- **Ads**: whether your app shows ads.

## Step 4: the first upload, by hand

Google Play has **tracks**: separate channels for releasing builds to different groups of people.

| Track | Who gets it | Review |
| --- | --- | --- |
| Internal testing | Up to 100 testers you invite by email | Fast, usually minutes |
| Closed testing | Testers you invite (email lists or Google Groups) | Reviewed |
| Open testing | Anyone who joins from the store page | Reviewed |
| Production | Everyone on Google Play | Reviewed |

Start with **internal testing**. It is quick and lets you check that the store build really works.

There is one annoying rule: **the very first build of a new app must be uploaded by hand** in the Play Console. Google's upload API, which `eas submit` uses, only works once the app has at least one build. So:

1. Open your production build's page on expo.dev and download the `.aab` file.
2. In the Play Console, go to **Testing**, then **Internal testing**, then **Create new release**.
3. Upload the `.aab` file.
4. Give the release a name (the default, like "2 (1.0.0)", is fine) and short release notes, like "First test version of HabitHop."
5. Save, review and roll out the release.
6. Under the **Testers** tab, add an email list with your testers (Sam, Mia and yourself) and copy the opt-in link.

Each tester opens the opt-in link, accepts, and then installs HabitHop from the Play Store like any other app.

### Play App Signing

During the first upload, Google sets up **Play App Signing**. Google keeps the final key that signs the app for users. The keystore that EAS created for you becomes your **upload key**: it only proves to Google that uploads really come from you. If an upload key is ever lost, Google support can reset it. The real signing key stays safe with Google.

## Step 5: automatic uploads with eas submit

Downloading and uploading AAB files by hand gets old fast. **EAS Submit** uploads builds for you. It needs permission to use the Play Console on your behalf, through a **service account**: a special Google account for programs, not people.

Setting it up, in short:

1. In the **Google Cloud Console**, create a project (or use one), enable the **Google Play Android Developer API**, and create a **service account**.
2. Create a **JSON key** for that service account and download it. Save it in your project as `google-service-account.json`.
3. In the Play Console, go to **Users and permissions**, invite the service account's email address, and give it permission to manage releases for HabitHop.

Expo's documentation has a step-by-step guide with screenshots for this ("Creating a Google Service Account Key"), which is worth following the first time.

**That JSON key is a real secret.** Anyone who has it can upload builds of your app. Never commit it. Add it to `.gitignore`:

```bash
# .gitignore
google-service-account.json
```

You can also upload the key to EAS instead of keeping it in your project, when `eas submit` asks.

Now tell EAS where the key is and which track to use, in `eas.json`:

```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

- `serviceAccountKeyPath` points to the JSON key.
- `track` is where the build goes: `internal`, `alpha` (closed testing), `beta` (open testing) or `production`. Start with `internal`.

Submit your latest Android build:

```bash
eas submit --platform android --latest
```

Roughly what you will see:

```text
✔ Using the latest build: https://expo.dev/accounts/riya/projects/habit-hop/builds/...
Submitting your app to Google Play Store
✔ Submitted your app to Google Play Store!
```

Even better, build and submit in one step. When the build finishes, EAS submits it automatically:

```bash
eas build --platform android --profile production --auto-submit
```

Thanks to `"autoIncrement": true` from the last lesson, every build gets a new `versionCode`, so Google never rejects an upload for reusing a number.

## Step 6: from testing to production

### The closed testing rule for new personal accounts

If you have a **new personal** developer account, Google requires a **closed test** before you may publish to production. At the time of writing, you need at least **12 testers** who opt in and stay in the test for **14 days in a row**. After that you can apply for production access from the dashboard, answering a few questions about your testing.

Organization accounts do not have this rule. Check the Play Console dashboard: it tells you exactly what your account still needs.

To run the closed test, create a release in **Closed testing**, add your testers (friends, family, classmates), and keep shipping fixes there. This is a good time to collect feedback anyway.

### Releasing to everyone

When you have production access:

1. Go to **Production** and create a release. You can **promote** a build that you already tested, instead of uploading again.
2. Write release notes for users ("What's new").
3. Choose a **staged rollout**, like 20%. Only that share of users get the update at first. If crash reports look fine, increase it to 100%.
4. Send it for review.

Google's review often takes from a few hours to a few days. The first review of a new app can take longer. You will get an email when it is approved or if something needs fixing.

Later updates follow the same path: bump `version` in your app config for user-visible releases, build, submit, roll out. For small JavaScript-only fixes, you can skip the store entirely with [EAS Update](/courses/react-native/eas-update).

## Common mistakes

**`eas submit` fails on a brand new app.** You will see an error saying the app or package name was not found. Fix: upload the first AAB by hand in the Play Console, then use `eas submit` for all later builds.

**"The caller does not have permission."** The service account exists but was not invited in the Play Console, or lacks release permissions. Fix: in **Users and permissions**, invite its email and grant release rights for HabitHop.

**Version code already used.** The upload is rejected because `versionCode` was not increased. Fix: use `"autoIncrement": true` with `"appVersionSource": "remote"`, or bump `android.versionCode` yourself.

**Committing the service account key.** If the JSON key ends up on GitHub, delete that key in the Google Cloud Console right away and create a new one. Then add the file name to `.gitignore`.

## Quick recap

- A Google Play developer account costs a **one-time 25 US dollars**, and Google verifies your identity.
- Create the app, then complete the store listing (descriptions, icon, feature graphic, screenshots) and app content forms (privacy policy, data safety, rating).
- Use the **internal testing** track first. The first AAB must be uploaded by hand.
- A **service account** JSON key lets `eas submit` upload for you. Keep it secret and out of git.
- `eas submit --platform android --latest`, or `eas build --auto-submit`, sends builds to the track set in `eas.json`.
- New personal accounts need a closed test (at the time of writing, 12 testers for 14 days) before production.
- Use staged rollouts, and EAS Update for quick JavaScript fixes.

Next, the iPhone side: [Publishing to the Apple App Store](/courses/react-native/publishing-to-the-app-store).

<code id="code-content" class="language-bash">
# commands.sh
# Publishing HabitHop to Google Play, step by step
# 1. Make a production build (an .aab file for Google Play)
eas build --platform android --profile production
# 2. FIRST TIME ONLY: download the .aab from the build page on expo.dev
#    and upload it by hand in Play Console: Testing, Internal testing,
#    Create new release. Google needs one manual upload first.
# 3. Keep the service account key out of git
echo "google-service-account.json" &gt;&gt; .gitignore
# 4. From now on, submit the latest build from the terminal
#    (eas.json: submit.production.android.serviceAccountKeyPath and track)
eas submit --platform android --latest
# 5. Or build and submit in one go
eas build --platform android --profile production --auto-submit
# 6. Then in Play Console: test on the internal track, run a closed test,
#    and promote the release to production with a staged rollout.
</code></pre>
