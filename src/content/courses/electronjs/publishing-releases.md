---
publishDate: 2026-10-25T12:54
title: Publishing Releases to GitHub and App Stores
slug: publishing-releases
metadescription: Publish your Electron app to GitHub Releases with Forge's GitHub publisher, build every platform with GitHub Actions, and learn how app stores fit in.
updateDate: 2026-10-25T12:54
author: ['bishal-biswas']
level: 3
tags: ['publishing', 'github-actions', 'releases']
course: electronjs
---

## From installers to a download page

You can now make installers, sign them and update them. The last piece is getting them to people. Somewhere has to host the files, show a version number and release notes, and give your auto-updater something to read.

**GitHub Releases** does all of that for free. Every GitHub repository has a Releases page. Each release has a version tag like `v1.2.0`, some notes, and attached files. Users download installers from there, and update.electronjs.org reads it to power [Automatic Updates](/courses/electronjs/automatic-updates).

Electron Forge can upload to it for you. In Forge, that step is called **publishing**, and the code that does it is a **publisher**.

Think of a bakery. `make` bakes the bread. `release` bags it, labels it with today's date and puts it on the shop shelf. GitHub Releases is the shelf.

In this lesson you will:

1. Set up Forge's GitHub publisher.
2. Publish a draft release from your own computer.
3. Build and publish Windows, macOS and Linux versions automatically with GitHub Actions.
4. Get an overview of the Mac App Store and the Microsoft Store.

## Step 1: add the GitHub publisher

Install it:

```bash
npm install --save-dev @electron-forge/publisher-github
```

Add a `publishers` list to `forge.config.mjs`:

```javascript
// forge.config.mjs
import { PublisherGitHub } from '@electron-forge/publisher-github';

const config = {
  // ...packagerConfig, makers, plugins as before
  publishers: [
    new PublisherGitHub({
      repository: { owner: 'asha-rao', name: 'todo-buddy' },
      draft: true,
      prerelease: false,
      generateReleaseNotes: true,
    }),
  ],
};
```

- **`repository`** is where to publish. For `https://github.com/asha-rao/todo-buddy`, the owner is `asha-rao` and the name is `todo-buddy`.
- **`draft: true`** creates the release as a **draft**: visible only to you, not to users or the update server. You check it, then click **Publish release** on GitHub. Drafts are the default, and keeping them is a good habit.
- **`prerelease: true`** would mark it as a beta. Update servers usually skip pre-releases.
- **`generateReleaseNotes: true`** asks GitHub to write release notes from your merged pull requests.

The release is named after the `version` in `package.json` with a `v` in front, so version `1.2.0` becomes the tag `v1.2.0`. Bump the version before every release.

## Step 2: create a token

Forge needs permission to create releases in your repository. You give it a **personal access token**: a long, password-like string that only allows what you choose.

1. On GitHub, open **Settings**, then **Developer settings**, then **Personal access tokens**.
2. Create a **fine-grained token**, limited to your app's repository.
3. Under repository permissions, set **Contents** to **Read and write**. That covers releases.
4. Copy the token. GitHub shows it only once.

The publisher reads the token from the `GITHUB_TOKEN` environment variable, so it never appears in your files. You could also pass `authToken` in the config, but that is how tokens end up committed by mistake. Use the environment variable.

## Step 3: publish from your computer

Set the token for this terminal session and run the release script. On macOS or Linux:

```bash
export GITHUB_TOKEN="github_pat_your_token_here"
npm run release
```

On Windows PowerShell:

```powershell
$env:GITHUB_TOKEN = "github_pat_your_token_here"
npm run release
```

`npm run release` runs `electron-forge release`, which does everything in order: package, make, then publish. You will see the familiar packaging steps, followed by the upload:

```text
✔ Making distributables
❯ Publishing distributables
❯ [publisher-github] Running the publish command
› Uploading distributables to v1.2.0 (2/3, 66%)
✔ Publishing distributables
```

(The exact lines vary a little, but you will see the upload progress counting up.)

Open your repository's Releases page. There is a draft called `v1.2.0` with the installer files from `out/make` attached. On Windows, that is the `Setup.exe`, the `.nupkg` and `RELEASES` file, which are exactly what the updater needs.

Read through it, edit the notes if you like, and click **Publish release**.

> **Note:** The command used to be `electron-forge publish`. In Forge 8 it is `electron-forge release`, and `publish` still works as an old alias. Use `npm run release`.

Useful options:

```bash
# Upload what the last "make" produced, without building again
npm run release -- --from-make

# Only use one publisher, if you have several
npm run release -- --target=@electron-forge/publisher-github
```

## Step 4: build every platform with GitHub Actions

Running `npm run release` on your laptop only gives you installers for your own operating system. You need Windows, macOS and Linux builds, and as you learned in [Packaging and Making Installers with Forge](/courses/electronjs/packaging-and-installers), each is best built on its own platform.

**GitHub Actions** is GitHub's free automation service. It can start a fresh Windows, macOS and Linux machine, run `npm run release` on each, and upload all the results into the **same draft release**. The publisher looks for an existing release with the same tag and adds its files to it, so three machines fill one release.

Create this file in your repository:

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    strategy:
      fail-fast: false
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - name: Install Linux packaging tools
        if: runner.os == 'Linux'
        run: sudo apt-get update && sudo apt-get install -y rpm

      - run: npm ci

      - name: Build and publish
        run: npm run release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # macOS signing and notarization (see the code signing lesson)
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

Line by line:

- **`on: push: tags: 'v*'`** runs the workflow whenever you push a tag that starts with `v`.
- **`permissions: contents: write`** lets the built-in token create releases.
- **`matrix: os: [...]`** runs the same job three times, once per operating system. `fail-fast: false` means one failing platform does not cancel the others.
- **`actions/setup-node`** installs Node.js 24. Electron Forge 8 needs Node 22.17 or newer.
- **`sudo apt-get install -y rpm`** installs the tool `MakerRpm` needs on Ubuntu.
- **`npm ci`** installs exact versions from `package-lock.json`. It is like `npm install` but stricter and made for CI.
- **`secrets.GITHUB_TOKEN`** is a token GitHub creates automatically for every workflow run. You do not need your personal token here.
- **`secrets.APPLE_ID`** and friends are secrets you add yourself under the repository's **Settings**, **Secrets and variables**, **Actions**. Your signing setup from [Code Signing and Notarization](/courses/electronjs/code-signing-and-notarization) reads them. Signing on a CI Mac also means importing your certificate into a temporary Keychain first, which takes a few more steps. Start without signing, then add it.

To release, bump the version, commit, tag and push:

```bash
npm version 1.2.0
git push --follow-tags
```

`npm version` updates `package.json`, commits the change and creates the matching `v1.2.0` tag. Pushing the tag starts the workflow. In a few minutes the draft release has installers for all three platforms. Check it, then publish.

### Intel and Apple Silicon Macs

`macos-latest` runners use Apple Silicon (`arm64`). To also ship for Intel Macs, add a matrix entry that passes `--arch=x64` to the release command:

```yaml
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: windows-latest
            args: ''
          - os: ubuntu-latest
            args: ''
          - os: macos-latest
            args: '--arch=arm64'
          - os: macos-latest
            args: '--arch=x64'
    # ...and in the publish step:
    #   run: npm run release -- ${{ matrix.args }}
```

## App stores: an overview

GitHub Releases plus auto-updates is enough for most apps. App stores add discovery, trust and easy installs, at the cost of reviews, fees and extra rules. Here is what is involved, so you can decide whether it is worth it.

### Mac App Store

- You need a paid Apple Developer Program membership, plus special **Apple Distribution** certificates and a **provisioning profile** (a file from Apple that ties your app to your account).
- You build a special Mac App Store version with the `mas` platform: `npm run make -- --platform=mas`.
- Mac App Store apps must run in the **App Sandbox**, which limits file access and some system features. You describe what you need with **entitlements** in your signing configuration.
- You upload the build with Apple's Transporter app, then Apple reviews it before it appears in the store.
- Updates come through the store, so your own auto-updater must be off. In code, `process.mas` is `true` in a Mac App Store build.

### Microsoft Store

- You need a Microsoft Partner Center developer account.
- The classic route is an **MSIX** package, made with `@electron-forge/maker-msix`. (The old `maker-appx` is deprecated.) The package identity and publisher name must match what Partner Center shows for your app.
- The Microsoft Store also accepts regular installers, so your existing Squirrel `Setup.exe` can be listed too, as long as it is signed.
- Store-installed apps are updated by the store. In code, `process.windowsStore` is `true` when running as a Store app package.

### Linux stores

**Snapcraft** (Snap Store) and **Flathub** (Flatpak) are the popular Linux app stores. Forge has `maker-snap` and `maker-flatpak`, and each store has its own submission process. Both handle updates for their users.

### Turning off your updater in store builds

```javascript
// src/main.js
const fromStore = process.mas || process.windowsStore;
if (!fromStore) {
  updateElectronApp(); // only for builds you distribute yourself
}
```

## Common mistakes

### Forgetting to bump the version

The publisher uses the version for the tag. Publishing the same version twice adds files to the old release instead of creating a new one, and the updater sees nothing new. Run `npm version` before every release.

### Leaving the release as a draft

Drafts are invisible to users and to update.electronjs.org. After checking it, click **Publish release**.

### Committing your token

If a token ends up in Git, delete it on GitHub right away and create a new one. Keep tokens in environment variables and CI secrets.

### A missing platform in the release

If one matrix job fails, its files are missing from the release. Open the workflow run on the **Actions** tab, read the failing step's log, fix it, and run the job again before publishing.

## Quick recap

- `@electron-forge/publisher-github` (`PublisherGitHub`) uploads your `out/make` files to GitHub Releases.
- Configure `repository: { owner, name }`. Releases are drafts by default. Keep it that way and publish by hand after checking.
- Give Forge a token through the `GITHUB_TOKEN` environment variable, never in the config file.
- `npm run release` packages, makes and publishes. `--from-make` reuses an earlier build.
- A GitHub Actions workflow with a Windows, macOS and Linux matrix fills one draft release with every platform's installers.
- `npm version` plus `git push --follow-tags` starts a release.
- App stores (Mac App Store, Microsoft Store, Snap Store, Flathub) need extra accounts, packaging and review, and handle updates themselves.

<code id="code-content" class="language-javascript">
// forge.config.mjs: makers plus the GitHub publisher for "npm run release"
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { PublisherGitHub } from '@electron-forge/publisher-github';
import { VitePlugin } from '@electron-forge/plugin-vite';
// --- Sign only when the CI secrets are present
const signMac = Boolean(process.env.APPLE_ID);
const config = {
  packagerConfig: {
    asar: true,
    icon: './assets/icon',
    appBundleId: 'com.example.todobuddy',
    osxSign: signMac ? {} : undefined,
    osxNotarize: signMac
      ? {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
          teamId: process.env.APPLE_TEAM_ID,
        }
      : undefined,
  },
  rebuildConfig: {},
  // --- Each CI machine runs the makers for its own platform
  makers: [
    new MakerSquirrel({}), // Windows: Setup.exe, .nupkg, RELEASES (needed for updates)
    new MakerZIP({}, ['darwin']), // macOS: .zip (needed for updates)
    new MakerDMG({}), // macOS: disk image for people downloading by hand
    new MakerDeb({}),
    new MakerRpm({}),
  ],
  // --- "npm run release" uploads everything in out/make to one draft release
  publishers: [
    new PublisherGitHub({
      repository: { owner: 'asha-rao', name: 'todo-buddy' },
      draft: true, // check it on GitHub, then click "Publish release"
      prerelease: false,
      generateReleaseNotes: true,
      // the token comes from the GITHUB_TOKEN environment variable
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main.js', config: 'vite.main.config.mjs', target: 'main' },
        { entry: 'src/preload.js', config: 'vite.preload.config.mjs', target: 'preload' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.mjs' }],
    }),
    // FusesPlugin from the template stays here
  ],
};
export default config;
</code></pre>
