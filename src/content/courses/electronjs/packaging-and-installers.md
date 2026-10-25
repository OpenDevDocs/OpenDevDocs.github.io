---
publishDate: 2026-10-25T12:49
title: Packaging and Making Installers with Forge
slug: packaging-and-installers
metadescription: Turn your Electron app into a real program and installers for Windows, macOS and Linux with Electron Forge's package and make commands.
updateDate: 2026-10-25T12:49
author: ['bishal-biswas']
level: 2
tags: ['electron-forge', 'packaging', 'installers']
course: electronjs
---

## From "npm start" to a real app

Until now, you have run your app with `npm start`. That only works on a computer with Node.js, your project folder and its `node_modules`. Your users have none of that. They expect to download one file, double-click it, and see your app in their Start menu, Applications folder or app launcher.

Getting there takes two steps, and Electron Forge has a command for each:

1. **Package** (`npm run package`): copy Electron itself, plus your app's code, into one folder with an executable you can double-click. Nothing is installed yet.
2. **Make** (`npm run make`): wrap that folder into a **distributable**, the file you actually give to users: a Windows installer, a macOS disk image, a Linux `.deb` package, or a simple zip.

Think of moving your belongings to a new home. Packaging is putting everything into labelled boxes. Making is loading the boxes onto a delivery van that fits the destination: a van for Windows, another for macOS, another for Linux.

This lesson uses the Forge Vite template from [Starting a Project with Electron Forge](/courses/electronjs/starting-with-electron-forge). If you started with a plain project, the final project lesson shows how to add Forge to it.

## What Forge set up for you

Open your `package.json`. The template already has the scripts you need:

```json
{
  "name": "demo-vite",
  "productName": "demo-vite",
  "version": "1.0.0",
  "main": ".vite/build/main.cjs",
  "scripts": {
    "start": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "release": "electron-forge release"
  }
}
```

And `forge.config.mjs` holds the settings for each step:

```javascript
// forge.config.mjs (the parts that matter for this lesson)
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';

const config = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  // plugins: VitePlugin and FusesPlugin
};

export default config;
```

- **`packagerConfig`** controls the package step. `asar: true` means your code is stored in a single archive file (more on that below).
- **`rebuildConfig`** controls rebuilding native modules, covered in [Native Node Modules](/courses/electronjs/native-node-modules).
- **`makers`** is the list of distributables to create. Each **maker** builds one kind of file.

## Step 1: package the app

Run the package command:

```bash
npm run package
```

```text
> demo-vite@1.0.0 package
> electron-forge package

✔ Checking your system
✔ Loading configuration
❯ Running packaging hooks
❯ [plugin-vite] Building production Vite bundles
✔ Built target src/main.js
✔ Built target src/preload.js
✔ Built target main_window
✔ Running packaging hooks
❯ Packaging for x64 on win32
✔ Copying files
✔ Preparing native dependencies
✔ Finalizing package
✔ Packaging application
```

(The real output has a few more lines. This is the shape of it.) Forge did four things:

1. **Built your code** with Vite into the `.vite` folder, just like a production website build.
2. **Copied Electron**, the prebuilt program, for your current operating system and CPU.
3. **Rebuilt native modules** for Electron, if you have any.
4. **Put your code inside** the copied Electron and renamed the executable after your app.

The result lands in a new folder called `out`:

```text
out/
└── demo-vite-win32-x64/
    ├── demo-vite.exe          <- your app, double-click it
    ├── resources/
    │   └── app.asar           <- your code
    ├── locales/
    ├── ffmpeg.dll
    ├── icudtl.dat
    ├── LICENSE
    └── ...more Electron files
```

The folder name is `<name>-<platform>-<arch>`. On other systems you get:

- **macOS:** `out/demo-vite-darwin-arm64/demo-vite.app` (or `-x64` on Intel Macs). The `.app` is a special folder that macOS shows as a single app.
- **Linux:** `out/demo-vite-linux-x64/demo-vite`, an executable file.

Double-click the executable. Your app opens without a terminal, without `npm`, and without your source code. That is a packaged app.

> **Note:** Electron apps are big because every app carries a whole browser engine. In our test on Windows, the packaged folder was about 350 MB and the finished installer about 150 MB. That is normal, and installers are compressed.

### What is inside app.asar?

**ASAR** (Atom Shell Archive) is Electron's archive format. It is like a zip file without compression: one file that holds many files. Electron can read files from inside it as if they were normal folders. It loads a little faster than thousands of loose files, and it makes casual snooping slightly harder.

You can list its contents with the `@electron/asar` tool:

```bash
npx @electron/asar list out/demo-vite-win32-x64/resources/app.asar
```

```text
\.vite
\.vite\build
\.vite\build\main.cjs
\.vite\build\preload.cjs
\.vite\renderer
\.vite\renderer\main_window
\.vite\renderer\main_window\assets
\.vite\renderer\main_window\assets\index-B43i0lJt.css
\.vite\renderer\main_window\assets\index-CjPAAIbZ.js
\.vite\renderer\main_window\index.html
\package.json
```

Only the built `.vite` folder and `package.json` are inside. Your `src` folder, `node_modules`, config files and `devDependencies` are all left out, because Vite already bundled everything your app needs into those few files.

> **Warning:** ASAR is not encryption. Anyone can extract it with `npx @electron/asar extract`. Never put passwords, API secrets or private keys in your app's code. [Electron Fuses and ASAR Integrity](/courses/electronjs/fuses-and-asar-integrity) shows how to stop people from **changing** the archive, but they can always **read** it.

## Step 2: make installers

Now run the make command:

```bash
npm run make
```

`make` runs `package` first, then each maker that works on your system. On Windows you will see:

```text
❯ Making distributables
✔ Making a squirrel distributable for win32/x64
✔ Making distributables
› Artifacts available at: C:\Users\you\demo-vite\out\make
```

Look inside `out/make`:

```text
out/make/
└── squirrel.windows/
    └── x64/
        ├── demo-vite-1.0.0 Setup.exe       <- give this to users
        ├── demo_vite-1.0.0-full.nupkg      <- used for auto-updates
        └── RELEASES                        <- used for auto-updates
```

The `Setup.exe` is your installer. Run it, and your app installs into the user's profile, adds a Start menu shortcut and launches. The `.nupkg` and `RELEASES` files are needed later for [Automatic Updates](/courses/electronjs/automatic-updates).

### Which maker runs where

Each maker builds for a specific platform, and most of them can only run **on** that platform:

| Maker | Package | Produces | Platform |
| --- | --- | --- | --- |
| `MakerSquirrel` | `@electron-forge/maker-squirrel` | `Setup.exe` installer | Windows |
| `MakerZIP` | `@electron-forge/maker-zip` | `.zip` of the app | Any, set to macOS in the template |
| `MakerDeb` | `@electron-forge/maker-deb` | `.deb` package | Debian, Ubuntu (needs `dpkg` and `fakeroot`) |
| `MakerRpm` | `@electron-forge/maker-rpm` | `.rpm` package | Fedora, Red Hat (needs `rpm-build`) |
| `MakerDMG` | `@electron-forge/maker-dmg` | `.dmg` disk image | macOS only |
| `MakerMSIX` | `@electron-forge/maker-msix` | `.msix` package | Windows (needed for the Microsoft Store) |
| `MakerWix` | `@electron-forge/maker-wix` | `.msi` installer | Windows (needs the WiX Toolset) |
| `MakerFlatpak` | `@electron-forge/maker-flatpak` | Flatpak bundle | Linux |
| `MakerSnap` | `@electron-forge/maker-snap` | Snap package | Linux |

Forge skips makers that do not match your current platform. That is why only Squirrel ran on Windows above, even though four makers are listed. On a Mac, `npm run make` would build the zip. On Linux, it would build the `.deb` and the `.rpm`, as long as each one's packaging tool is installed.

> **Note:** You may see `@electron-forge/maker-appx` in older guides. It is deprecated. Use `@electron-forge/maker-msix` for Windows Store style packages.

The practical rule: **build each platform's installers on that platform.** You do not need three computers, though. In [Publishing Releases to GitHub and App Stores](/courses/electronjs/publishing-releases), a free GitHub Actions workflow builds on Windows, macOS and Linux machines for you.

### Adding a DMG for macOS

Mac users expect a `.dmg`: a disk image that opens a window where they drag your app into Applications. Install the maker:

```bash
npm install --save-dev @electron-forge/maker-dmg
```

Add it to the list:

```javascript
// forge.config.mjs
import { MakerDMG } from '@electron-forge/maker-dmg';

const config = {
  // ...
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerDMG({}),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
};
```

On a Mac, `npm run make` now also creates `out/make/dmg/arm64/demo-vite-1.0.0-arm64.dmg` (with `x64` instead of `arm64` on Intel Macs).

### Giving makers some details

Most makers accept options. For example, the Linux makers can set the maintainer, homepage and categories that software centres show:

```javascript
// forge.config.mjs
new MakerDeb({
  options: {
    maintainer: 'Asha Rao',
    homepage: 'https://example.com',
    categories: ['Utility'],
  },
}),
```

Icons and names are important enough to get their own lesson: [App Icons, Names and Metadata](/courses/electronjs/app-icons-and-metadata).

## Useful command options

You can change what Forge builds for a single run by adding options after `--`. The `--` tells npm "pass the rest to the script":

```bash
# Build for a different CPU architecture
npm run make -- --arch=arm64

# Run only one maker
npm run make -- --targets=@electron-forge/maker-zip

# Make installers from an existing package, skipping the package step
npm run make -- --from-package
```

`--arch` is useful on macOS, where you might build for both Apple Silicon (`arm64`) and Intel (`x64`) Macs from the same machine. If your app has native modules, each architecture needs its own matching build of them, which Forge handles when it rebuilds.

## Why the Windows app quits during install

Look at the top of the template's `src/main.js`:

```javascript
// src/main.js
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}
```

The Squirrel installer starts your app several times with special arguments while it installs, updates and uninstalls, so your app can create or remove shortcuts. `electron-squirrel-startup` handles those runs, creates the shortcuts, and returns `true` so your code quits straight away instead of opening a window. Keep these lines. Without them, users see your window pop up and close during installation.

## Adding extra files

Sometimes your app needs files that are not code: a sample database, a help PDF, a command-line tool. Vite does not know about them. Use `extraResource` to copy them next to `app.asar`:

```javascript
// forge.config.mjs
packagerConfig: {
  asar: true,
  extraResource: ['./assets/sample-data.json'],
},
```

In the packaged app, find them through `process.resourcesPath`:

```javascript
// src/main.js
import path from 'node:path';
import { app } from 'electron';

const sampleFile = app.isPackaged
  ? path.join(process.resourcesPath, 'sample-data.json')
  : path.join(app.getAppPath(), 'assets', 'sample-data.json');
```

`app.isPackaged` is `true` only in the packaged app, so the same code works during development too.

## Testing your installer

Always install and run your installer on a clean machine (or a virtual machine) before sharing it. Things to check:

1. Does it install without errors, and does the shortcut appear?
2. Does the app start, and do all windows load? A blank window usually means a wrong file path that only shows up after packaging.
3. Do saved settings land in the user data folder from [App Paths: Where to Store User Data](/courses/electronjs/app-paths-and-user-data)?
4. Does it uninstall cleanly?

> **Note:** Your installers are not **signed** yet. Windows SmartScreen will warn "Windows protected your PC", and macOS will refuse to open the app with a message that it "cannot be verified". That is expected for now. [Code Signing and Notarization](/courses/electronjs/code-signing-and-notarization) fixes it.

## Common mistakes

### Committing the `out` folder

`out` is build output and can be hundreds of megabytes. The template's `.gitignore` already lists it. Keep it that way, and upload installers to a release page instead.

### Expecting to build every platform from one computer

A `.dmg` can only be built on macOS, and native modules must be compiled on each platform. Use one machine per platform, or a CI service with Windows, macOS and Linux runners.

### Files that work in development but not after packaging

If a file is read with a path like `./data/file.json`, it depends on the current folder, which is different when the app is installed. Build paths from `__dirname`, `app.getAppPath()` or `process.resourcesPath`, and use `extraResource` for files Vite does not bundle.

### Removing the Squirrel startup check

Without `electron-squirrel-startup`, your app opens and closes repeatedly during installation on Windows and no shortcuts are created.

## Quick recap

- `npm run package` builds your code and combines it with Electron into `out/<name>-<platform>-<arch>/`.
- `npm run make` packages, then runs the makers to create distributables in `out/make/`.
- On Windows, Squirrel creates `<name>-<version> Setup.exe` plus `.nupkg` and `RELEASES` files for updates.
- Your code lives in `resources/app.asar`, an archive that is readable but not encrypted.
- Makers only run on matching platforms. Add `MakerDMG` for macOS disk images and use `maker-msix`, not the deprecated `maker-appx`.
- Pass options with `npm run make -- --arch=arm64` or `--targets=...`.
- Keep the `electron-squirrel-startup` check, use `extraResource` for extra files, and test installers on a clean machine.

<code id="code-content" class="language-javascript">
// forge.config.mjs: packaging and installers for Windows, macOS and Linux
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
const config = {
  // --- npm run package: Electron + your code in out/name-platform-arch/
  packagerConfig: {
    asar: true, // code goes into resources/app.asar
    extraResource: ['./assets/sample-data.json'], // copied next to app.asar
  },
  rebuildConfig: {},
  // --- npm run make: installers in out/make/ (only matching platforms run)
  makers: [
    new MakerSquirrel({}), // Windows: Setup.exe + .nupkg + RELEASES
    new MakerZIP({}, ['darwin']), // macOS: zip (also used for auto-updates)
    new MakerDMG({}), // macOS: drag-to-Applications disk image
    new MakerDeb({
      options: {
        maintainer: 'Asha Rao',
        homepage: 'https://example.com',
        categories: ['Utility'],
      },
    }), // Debian and Ubuntu
    new MakerRpm({}), // Fedora and Red Hat
  ],
  // --- Plugins from the template stay as they are
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main.js', config: 'vite.main.config.mjs', target: 'main' },
        { entry: 'src/preload.js', config: 'vite.preload.config.mjs', target: 'preload' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.mjs' }],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
export default config;
</code></pre>
