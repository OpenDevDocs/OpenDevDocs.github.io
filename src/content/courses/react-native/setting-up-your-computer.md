---
publishDate: 2026-10-21T11:00
title: Setting Up Your Computer for React Native
slug: setting-up-your-computer
metadescription: 'Install Node.js, Git, VS Code and Expo Go, and optionally the Android emulator or iOS simulator, so your computer is ready to build React Native apps.'
updateDate: 2026-10-21T11:00
author: ['bishal-biswas']
level: 1
tags: ['react-native', 'setup', 'expo']
course: react-native
---

## What you need

Good news first: with Expo you need much less than people think. You do **not** need Android Studio or Xcode to start. The minimum is:

1. **Node.js** on your computer (to run the tools).
2. A **code editor** (VS Code is a great free choice).
3. **Git** (to save versions of your code, and some tools expect it).
4. A **phone** with the free **Expo Go** app, *or* an emulator/simulator on your computer.

This lesson walks through each one, checks that it works, and explains the optional extras. It works on Windows, macOS and Linux.

## Step 1: Install Node.js

**Node.js** lets you run JavaScript on your computer, outside a browser. Expo's tools (the dev server, Metro, the project creator) are all Node.js programs.

Expo SDK 58 needs **Node.js 22.13 or newer**, or **24.3 or newer**. The simplest choice is the current **LTS** ("Long Term Support") version from the official website, nodejs.org. LTS means it is stable and gets fixes for a long time.

After installing, open a terminal and check the versions:

```bash
node --version
npm --version
```

You should see something like this (your numbers may be a little higher):

```text
v24.11.0
11.6.2
```

A **terminal** is the text window where you type commands. On Windows use **PowerShell** or **Windows Terminal**. On macOS use **Terminal**. VS Code also has one built in: open the **View** menu and choose **Terminal**.

`npm` (Node Package Manager) comes with Node.js. It installs libraries into your project. You will also use `npx`, which runs a tool without installing it globally first. If you want more detail on these tools, see [npm, npx and node --run](/courses/nodejs/npm-npx-and-node-run).

If you work on several projects that need different Node versions, a **version manager** like `nvm` or `fnm` lets you switch between them. That is optional; the [Installing Node.js and Version Managers](/courses/nodejs/installing-nodejs-and-version-managers) lesson explains how.

## Step 2: Install a code editor

Any editor works, but **Visual Studio Code** (VS Code) is the most common for React Native. It is free, and it understands TypeScript out of the box, so it shows errors as you type and helps you autocomplete props.

Two extensions worth adding from the Extensions panel:

- **Expo Tools**: autocomplete and checks for `app.json`.
- **ESLint**: shows code problems as you type (the Expo project has a `lint` script ready for it).

## Step 3: Install Git

**Git** tracks versions of your code, so you can undo mistakes and share your project on GitHub. The project creator also sets up a Git repository for you if Git is installed.

Check if you already have it:

```bash
git --version
```

```text
git version 2.51.0
```

If the command is not found, install Git from git-scm.com (Windows and Linux) or run `xcode-select --install` on macOS, which installs Git with Apple's command line tools.

## Step 4: Get a phone ready with Expo Go

The quickest way to see your app is on a **real phone**. **Expo Go** is a free app from the App Store (iPhone) and Google Play (Android). It can open your project straight from your computer: you scan a QR code and your app appears.

1. Install **Expo Go** on your phone from the store.
2. Make sure the phone and the computer are on the **same Wi-Fi network**.
3. That's it for now. You will scan your first QR code in [Creating Your First App with Expo](/courses/react-native/create-your-first-app).

Expo Go supports one Expo SDK version at a time, and the store version always follows the latest SDK. So keep it updated, and it will match a fresh SDK 58 project.

Expo Go is perfect for learning. Later you will meet its limits and a more powerful option, the **development build**, in [Expo Go vs Development Builds](/courses/react-native/expo-go-vs-development-builds).

## Optional: an Android emulator

An **emulator** is a pretend phone that runs in a window on your computer. The Android emulator works on **Windows, macOS and Linux**. It is useful if you do not have an Android phone, or you want to test different screen sizes.

To get it:

1. Install **Android Studio** from developer.android.com.
2. Open it, go to **More Actions** then **Virtual Device Manager**, and create a device (a recent Pixel phone is a good choice).
3. Press the play button to start it.

The Expo tools find the Android SDK by an **environment variable** called `ANDROID_HOME`, a setting that tells programs where something is installed. Android Studio's setup usually puts the SDK here:

```text
Windows: C:\Users\<you>\AppData\Local\Android\Sdk
macOS:   /Users/<you>/Library/Android/sdk
Linux:   /home/<you>/Android/Sdk
```

On macOS or Linux, add these lines to your shell profile (for example `~/.zshrc`), then open a new terminal:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator:$PATH:$ANDROID_HOME/platform-tools
```

On Linux, use `$HOME/Android/Sdk` instead. On Windows, add `ANDROID_HOME` in **System Properties**, **Environment Variables**, and add the `platform-tools` folder to your `Path`.

Check that it worked by running `adb`, the Android Debug Bridge tool that talks to emulators and phones:

```bash
adb --version
```

```text
Android Debug Bridge version 1.0.41
```

Later, with the emulator open and your project running, you press `a` in the terminal and the app opens in the emulator. Expo Go is installed in the emulator for you the first time.

## Optional: the iOS simulator (Mac only)

The **iOS simulator** is Apple's pretend iPhone. It only runs on a **Mac**, because it comes with **Xcode**, Apple's developer app, which is macOS only.

To set it up on a Mac:

1. Install **Xcode** from the Mac App Store (it is large, so give it time).
2. Open Xcode once and accept the license. In **Settings**, open **Components** and install an iOS simulator runtime if it asks.
3. Install the command line tools:

```bash
xcode-select --install
```

Then, with your project running, press `i` in the terminal and the app opens in the simulator.

**No Mac? No problem.** You can test on a real iPhone with Expo Go for most of the course. When you need a full iOS app later, **EAS Build** builds it in the cloud for you (see [Building Your App with EAS Build](/courses/react-native/eas-build)). You only need an Apple developer account to put it on a real device or in the store.

## Which option should you pick?

```text
Have an Android phone?  -> Expo Go on the phone (easiest)
Have an iPhone?         -> Expo Go on the phone (easiest)
No phone handy?         -> Android emulator (any computer)
                           or iOS simulator (Mac only)
Testing layouts fast?   -> press w to open the web version in a browser
```

Many developers use two at once: a real phone for "how does it feel", and an emulator or simulator to see a second platform or screen size.

## A quick health check

Run these four commands. If all four print a version, you are ready:

```bash
node --version
npm --version
npx --version
git --version
```

You can also make sure `npx` can reach the Expo project creator. This only prints its help text, it does not create anything:

```bash
npx create-expo-app@latest --help
```

The first time, `npx` asks to download the package. Type `y` and press Enter.

## Common mistakes

**An old Node.js version.** If your Node is too old, installs or the dev server fail with messages about an unsupported engine, like:

```text
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'expo@58.0.20',
npm warn EBADENGINE   required: { node: '^22.13.0 || ^24.3.0 || ^26.0.0 || >=27.0.0' },
npm warn EBADENGINE   current: { node: 'v20.11.1', npm: '10.2.4' }
npm warn EBADENGINE }
```

Install a current LTS version and open a **new** terminal so it picks up the new version.

**Phone and computer on different networks.** If Expo Go spins and then shows "Could not connect to the server", the phone cannot reach your computer. Put both on the same Wi-Fi. Office or school networks often block devices from talking to each other; in that case, start the dev server with `npx expo start --tunnel`, which routes the connection through the internet instead.

**Running `adb` or the emulator before setting `ANDROID_HOME`.** The symptom is "adb: command not found" or Expo saying it cannot find the Android SDK. Set the variable, then restart the terminal (and VS Code, since it keeps the old environment).

**Using the wrong Expo Go.** If your project and Expo Go do not match, you see a message that the project is incompatible with this version of Expo Go. Update Expo Go from the store, since new projects are always created on the latest SDK.

## Quick recap

- The minimum setup is **Node.js** (22.13+ or 24.3+), a **code editor**, **Git** and **Expo Go** on a phone.
- Check your tools with `node --version`, `npm --version` and `git --version`.
- Keep your phone and computer on the same Wi-Fi, or use `--tunnel`.
- The **Android emulator** works on any computer through Android Studio. Set `ANDROID_HOME`.
- The **iOS simulator** needs a **Mac** with Xcode. Without a Mac, use a real iPhone with Expo Go, and EAS Build for full builds later.
- Next up: [Creating Your First App with Expo](/courses/react-native/create-your-first-app).

<code id="code-content" class="language-bash">
# commands.sh
# 1. Check the tools you need (Node 22.13+ or 24.3+)
node --version
npm --version
npx --version
git --version
# 2. Make sure npx can reach the Expo project creator
npx create-expo-app@latest --help
# 3. Optional: Android emulator tools (after installing Android Studio)
# macOS example, put these in ~/.zshrc then open a new terminal
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator:$PATH:$ANDROID_HOME/platform-tools
adb --version
# 4. Optional: iOS simulator tools (Mac only, after installing Xcode)
xcode-select --install
# 5. If your phone cannot connect over Wi-Fi, use a tunnel
npx expo start --tunnel
</code></pre>
