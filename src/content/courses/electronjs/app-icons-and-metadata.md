---
publishDate: 2026-10-25T12:50
title: App Icons, Names and Metadata
slug: app-icons-and-metadata
metadescription: Give your packaged Electron app a proper name, icon, version and bundle ID on Windows, macOS and Linux using package.json and Forge's packagerConfig.
updateDate: 2026-10-25T12:50
author: ['bishal-biswas']
level: 2
tags: ['icons', 'metadata', 'electron-forge']
course: electronjs
---

## Why names and icons matter

Package an app straight from the template and look at it. The executable is called `demo-vite`, the icon is the default Electron atom, and the Windows file properties say "Electron". It works, but it does not look like **your** app.

Names, icons and version numbers are your app's **metadata**: information about the app rather than the app itself. The operating system shows this information everywhere: the taskbar, the Dock, the Start menu, the Applications folder, the "Uninstall a program" list, the file properties dialog and the notifications.

Think of a shop. The goods inside are your code. The sign above the door, the name on the receipts and the logo on the bags are the metadata. Customers judge the shop by them before they see a single product.

In this lesson you will set:

- the app's names (there are several, each with a job),
- the version,
- the icon for each operating system,
- macOS and Windows specific details like the bundle ID and company name.

All of it lives in two places: `package.json` and `packagerConfig` in `forge.config.mjs`.

## The different names

An Electron app has several names. They look similar but each one is used somewhere different.

### `name` in package.json

```json
{
  "name": "todo-buddy"
}
```

This is the **npm package name**. It must be lowercase with no spaces. Forge uses it in some file names, for example the `.nupkg` file on Windows. Users rarely see it.

### `productName` in package.json

```json
{
  "name": "todo-buddy",
  "productName": "Todo Buddy"
}
```

This is the **human-friendly name**, and it can contain capitals and spaces. Electron and Forge prefer it over `name` wherever people will see it:

- `app.getName()` returns it.
- The packaged app folder and executable use it (`Todo Buddy.exe`, `Todo Buddy.app`).
- The **user data folder** is named after it.

You can check this yourself:

```javascript
// main.js
const { app } = require('electron');
console.log(app.getName(), app.getVersion());
console.log(app.getPath('userData'));
```

```text
Todo Buddy 1.2.0
C:\Users\asha\AppData\Roaming\Todo Buddy
```

On macOS the folder is `~/Library/Application Support/Todo Buddy`, and on Linux `~/.config/Todo Buddy`.

> **Warning:** Because the user data folder is named after the app, **renaming your app moves that folder**. After an update that changes `productName`, your app looks in a new, empty folder, and users seem to "lose" their settings and data. Pick a name early and keep it. If you must rename, copy the old folder's contents to the new one on first launch.

### `app.setName()`

You can also change the name while the app runs:

```javascript
// main.js
const { app } = require('electron');
app.setName('Todo Buddy');
```

This changes what `app.getName()` returns and, if called **before** you use any paths, the user data folder too. It only changes Electron's internal name. It does not rename the executable or what the operating system shows in its menus. Prefer `productName`, and use `setName` only for special cases, such as giving a development build its own name and data folder:

```javascript
// main.js
if (!app.isPackaged) app.setName('Todo Buddy (Dev)');
```

Now testing on your own machine never touches your real data.

### `executableName` in packagerConfig

```javascript
// forge.config.mjs
packagerConfig: {
  executableName: 'todo-buddy',
},
```

This is the file name of the program itself, without `.exe`. It defaults to `productName`. On **Linux**, set it to something lowercase without spaces, like a command name, because Linux users may start it from a terminal and that is the convention there. On macOS it does not change the name of the `.app` folder.

## The version

The version comes from `version` in `package.json`:

```json
{
  "version": "1.2.0"
}
```

Use **semantic versioning** (semver): `MAJOR.MINOR.PATCH`, like `1.2.0`. Bump the PATCH number for bug fixes, MINOR for new features, and MAJOR for big changes that break things. Installers, Windows file properties and the auto-updater in [Automatic Updates](/courses/electronjs/automatic-updates) all read this number. Updates only work if every release has a higher version than the one before.

`app.getVersion()` returns it at run time, which is handy for an About box or bug reports.

## Icons for each operating system

Each operating system wants its icon in a different format:

| Platform | Format | What it contains |
| --- | --- | --- |
| Windows | `.ico` | Several sizes in one file: 16, 24, 32, 48, 64, 128 and 256 pixels |
| macOS | `.icns` | Several sizes in one file, up to 1024 pixels |
| Linux | `.png` | One square image, 512 by 512 pixels is a good choice |

Start with **one square PNG of 1024 by 1024 pixels** with a transparent background, then convert it.

### Making the files

To make a `.ico` on any system, you can use **ImageMagick**, a free image tool:

```bash
magick icon.png -define icon:auto-resize=256,128,64,48,32,24,16 icon.ico
```

On a Mac, `.icns` files are made from a folder of PNGs at fixed sizes called an **iconset**. The built-in `sips` tool resizes images, and `iconutil` packs them:

```bash
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
cp icon.png icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
```

Many free online converters do the same job if you prefer.

> **Note:** On the newest macOS versions, apps can also use the `.icon` format made with Apple's Icon Composer, which needs a recent Xcode. A plain `.icns` still works everywhere, so start with that.

Put all three in an `assets` folder:

```text
my-app/
├── assets/
│   ├── icon.ico
│   ├── icon.icns
│   └── icon.png
├── src/
├── forge.config.mjs
└── package.json
```

### Telling Forge about the icon

```javascript
// forge.config.mjs
packagerConfig: {
  asar: true,
  icon: './assets/icon', // no extension
},
```

Leave the extension off. When packaging for Windows, Forge adds `.ico`. For macOS, it adds `.icns`. One line covers both.

### Installer icons

The installers have their own icons too.

- **Windows (Squirrel):** `setupIcon` is the icon of `Setup.exe` itself. `iconUrl` is the icon shown in Windows "Apps and features" and must be a **web address** (an `https://` URL to a `.ico` file), not a local path.
- **Linux (`.deb` and `.rpm`):** `options.icon` is the icon your app gets in the desktop's app launcher.
- **macOS (DMG):** `icon` sets the icon used for your app inside the disk image window.

```javascript
// forge.config.mjs
makers: [
  new MakerSquirrel({
    setupIcon: './assets/icon.ico',
    iconUrl: 'https://example.com/todo-buddy/icon.ico',
  }),
  new MakerDeb({ options: { icon: './assets/icon.png' } }),
  new MakerRpm({ options: { icon: './assets/icon.png' } }),
],
```

### The window icon at run time

On **Linux**, the packaged app's icon is not taken from the executable. Set it on the window with the `icon` option you met in [Window Options: Size, Position, Title and Icon](/courses/electronjs/window-options). It also helps on Windows while developing, before the app is packaged:

```javascript
// src/main.js
const mainWindow = new BrowserWindow({
  width: 800,
  height: 600,
  icon: path.join(__dirname, '../../assets/icon.png'), // used on Linux and Windows
  webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
});
```

Remember that Vite builds `src/main.js` into `.vite/build/main.cjs`, so `__dirname` is `.vite/build`. For the PNG to exist in the packaged app, also add it to `extraResource`, as in [Packaging and Making Installers with Forge](/courses/electronjs/packaging-and-installers), and load it from `process.resourcesPath` when `app.isPackaged` is true.

On macOS, the window icon is ignored. The Dock always shows the app's `.icns` icon.

## macOS details

macOS identifies every app by a **bundle ID**: a unique, reversed-domain name like `com.yourcompany.todobuddy`. The system uses it for notifications, permissions, Keychain access and code signing. Set it once and never change it, or macOS will treat the update as a different app.

```javascript
// forge.config.mjs
packagerConfig: {
  appBundleId: 'com.example.todobuddy',
  appCategoryType: 'public.app-category.productivity',
  appCopyright: 'Copyright © 2026 Asha Rao',
},
```

- **`appBundleId`**: the bundle ID. Use a domain you own, reversed.
- **`appCategoryType`**: the category used by Finder and the Mac App Store, such as `public.app-category.productivity` or `public.app-category.developer-tools`.
- **`appCopyright`**: the copyright line shown in Finder's "Get Info" window and in the About panel.

## Windows details

Right-click an `.exe` on Windows, choose **Properties**, then the **Details** tab. Those fields come from `win32metadata`:

```javascript
// forge.config.mjs
packagerConfig: {
  win32metadata: {
    CompanyName: 'Asha Rao',
    FileDescription: 'Todo Buddy',
    ProductName: 'Todo Buddy',
  },
},
```

`FileDescription` is also what Task Manager shows as the process name, so make it friendly.

> **Note:** Windows also groups windows and notifications by an **AppUserModelID**. Apps installed with Squirrel get one automatically. If notifications do not show up while developing on Windows, see [Desktop Notifications](/courses/electronjs/desktop-notifications) for `app.setAppUserModelId`.

## The About box

Most apps have an About item that shows the name, version and copyright. Electron has a built-in About panel. You can fill it in once and use the `about` role in your menu from [Application Menus](/courses/electronjs/application-menus):

```javascript
// src/main.js
app.setAboutPanelOptions({
  applicationName: 'Todo Buddy',
  applicationVersion: app.getVersion(),
  copyright: 'Copyright © 2026 Asha Rao',
});
```

## Putting it all together

Here is a complete `package.json` top section:

```json
{
  "name": "todo-buddy",
  "productName": "Todo Buddy",
  "version": "1.2.0",
  "description": "A friendly desktop todo list",
  "author": {
    "name": "Asha Rao",
    "email": "asha@example.com"
  },
  "license": "MIT",
  "main": ".vite/build/main.cjs"
}
```

`description` and `author` are used by several makers, for example as the package description in Linux software centres and in Squirrel's installer details. Fill them in.

Run `npm run package` again. The executable now has your name and icon, and its Properties or Get Info window shows your company, version and copyright.

## Common mistakes

### Adding the extension to `packagerConfig.icon`

`icon: './assets/icon.ico'` works on Windows but breaks the macOS build, which needs `.icns`. Leave the extension off and provide both files.

### Changing `productName` or `appBundleId` after release

Both are used to identify your app and its data. Changing them makes updates look like a brand new app, and users lose their settings. Choose them before your first public release.

### A blurry or tiny icon

If you only include one small size in your `.ico` or `.icns`, the system stretches it and it looks blurry. Generate every size from a large, sharp source image.

### Using a local path for `iconUrl`

Squirrel's `iconUrl` must be an `https://` address that Windows can download. Use `setupIcon` for local files.

## Quick recap

- `name` is the npm name. `productName` is the friendly name used for the executable, `app.getName()` and the user data folder.
- Renaming the app moves its user data folder. Choose the name early.
- `app.setName()` changes Electron's internal name, which is useful for a separate development data folder.
- `executableName` sets the program's file name. Keep it lowercase on Linux.
- The `version` in `package.json` should follow semver and grow with every release.
- Icons: `.ico` for Windows, `.icns` for macOS, `.png` for Linux. Set `packagerConfig.icon` without an extension.
- Installers have their own icons: `setupIcon` and `iconUrl` for Squirrel, `options.icon` for Linux makers.
- `appBundleId`, `appCategoryType` and `appCopyright` describe the macOS app. `win32metadata` fills the Windows file details.

<code id="code-content" class="language-javascript">
// forge.config.mjs: names, icons and metadata for every platform
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
// package.json supplies: name "todo-buddy", productName "Todo Buddy", version "1.2.0",
// description and author, which several makers also read
const config = {
  packagerConfig: {
    asar: true,
    // --- Names
    executableName: 'todo-buddy', // file name of the program, lowercase for Linux
    // --- Icon: no extension, Forge picks .ico on Windows and .icns on macOS
    icon: './assets/icon',
    extraResource: ['./assets/icon.png'], // for the Linux window icon at run time
    // --- macOS
    appBundleId: 'com.example.todobuddy', // never change after release
    appCategoryType: 'public.app-category.productivity',
    appCopyright: 'Copyright © 2026 Asha Rao',
    // --- Windows file properties (right-click, Properties, Details)
    win32metadata: {
      CompanyName: 'Asha Rao',
      FileDescription: 'Todo Buddy',
      ProductName: 'Todo Buddy',
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      setupIcon: './assets/icon.ico', // icon of Setup.exe
      iconUrl: 'https://example.com/todo-buddy/icon.ico', // icon in Apps and features
    }),
    new MakerZIP({}, ['darwin']),
    new MakerDMG({ icon: './assets/icon.icns' }),
    new MakerDeb({ options: { icon: './assets/icon.png', categories: ['Utility'] } }),
    new MakerRpm({ options: { icon: './assets/icon.png' } }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main.js', config: 'vite.main.config.mjs', target: 'main' },
        { entry: 'src/preload.js', config: 'vite.preload.config.mjs', target: 'preload' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.mjs' }],
    }),
    // FusesPlugin from the template goes here too
  ],
};
export default config;
</code></pre>
