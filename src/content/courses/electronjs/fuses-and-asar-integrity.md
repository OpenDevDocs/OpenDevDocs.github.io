---
publishDate: 2026-10-25T12:53
title: Electron Fuses and ASAR Integrity
slug: fuses-and-asar-integrity
metadescription: Learn what Electron fuses are, what every fuse in the Forge template does, and how ASAR integrity stops attackers from changing your packaged app.
updateDate: 2026-10-25T12:53
author: ['bishal-biswas']
level: 4
tags: ['fuses', 'asar', 'security']
course: electronjs
---

## A security problem you might not expect

Imagine your app is installed and signed, as in [Code Signing and Notarization](/courses/electronjs/code-signing-and-notarization). Users trust it. Their operating system trusts it. Maybe they even granted it access to the camera, the microphone or their Documents folder.

Now some malware lands on the same computer. It cannot change your signed executable without breaking the signature. But what if it could **start your app in a special mode** and make it run the attacker's code instead of yours? The operating system would see your trusted, signed app doing the work, with all the permissions the user gave it.

That is not a made-up risk. The Electron executable has several features meant for developers: run as plain Node.js, accept a debugger, read extra options from environment variables, load the app from a loose folder. They are handy while developing. In a shipped app, each one is a door an attacker can walk through.

**Fuses** close those doors.

## What a fuse is

A **fuse** is an on/off switch stored inside the Electron executable file itself. It is flipped **at package time**, when you run `npm run package` or `npm run make`, and then it is fixed. Your JavaScript cannot change it, environment variables cannot change it, and command-line flags cannot change it. Code signing then seals the executable so nobody else can flip it either.

Think of the fuse box in a house. Before the builders hand over the keys, they decide which circuits are connected. Once the walls are closed, nobody living there rewires the fuse box by flicking a light switch.

Fuses are different from settings like `webPreferences`, which your code chooses while running. If your app's code itself were tricked, it could choose bad settings. A fuse cannot be talked out of its position.

## The fuses in the Forge template

Open `forge.config.mjs` from the Forge Vite template. Near the bottom you find this:

```javascript
// forge.config.mjs
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

// inside plugins: [...]
new FusesPlugin({
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
}),
```

- **`FusesPlugin`** flips the fuses in the copied Electron executable during packaging, before signing.
- **`FuseVersion.V1`** is the version of the fuse layout. There is only one so far.
- **`FuseV1Options`** names each fuse. Each line sets one to `true` (on) or `false` (off).

Let us go through them one at a time.

### RunAsNode: off

When the environment variable `ELECTRON_RUN_AS_NODE=1` is set, Electron normally skips everything Electron-specific and behaves like plain Node.js. That means anyone can run **any** JavaScript file using your app's executable:

```bash
ELECTRON_RUN_AS_NODE=1 "/Applications/Todo Buddy.app/Contents/MacOS/Todo Buddy" evil.js
```

With the fuse **off**, Electron ignores that variable. The template turns it off, and you should leave it off.

The cost: an old pattern of starting background Node scripts with `child_process.fork()` and `ELECTRON_RUN_AS_NODE` stops working in packaged apps. Use `utilityProcess` instead, as in [Background Work with utilityProcess](/courses/electronjs/utility-process).

### EnableCookieEncryption: on

Electron stores cookies in a small database inside the user data folder. With this fuse **on**, that database is encrypted with a key kept by the operating system: the Keychain on macOS, DPAPI on Windows, and the system secret store on Linux. This is the same protection `safeStorage` uses in [Keeping Secrets Safe with safeStorage](/courses/electronjs/safestorage-secrets).

So if someone copies the user data folder to another computer, they cannot read login cookies from it.

> **Warning:** Treat this fuse as one-way. Once a version of your app has shipped with cookie encryption on, turning it off in a later version leaves the existing encrypted cookies unreadable, and users are logged out of everything.

### EnableNodeOptionsEnvironmentVariable: off

Node.js reads extra options from the `NODE_OPTIONS` environment variable. One of those options, `--require`, loads a script before anything else. An attacker could set `NODE_OPTIONS="--require /tmp/evil.js"` and then start your app, and their code would run inside it.

With the fuse **off**, `NODE_OPTIONS` is ignored. Leave it off.

### EnableNodeCliInspectArguments: off

Flags like `--inspect` and `--inspect-brk` open a debugging port into the main process. With a debugger attached, someone can read and change anything your app is doing. You used these flags in [Debugging with DevTools and VS Code](/courses/electronjs/debugging-electron-apps).

With the fuse **off**, the packaged app ignores those flags. This does not affect development, because `npm start` uses the plain Electron from `node_modules`, where every fuse has its default value.

There is one side effect worth knowing. Playwright connects to Electron through the inspector, so it cannot drive a packaged app with this fuse off. That is why [Testing Electron Apps](/courses/electronjs/testing-electron-apps) runs end-to-end tests against the unpackaged app.

### EnableEmbeddedAsarIntegrityValidation: on

This is the **ASAR integrity** check, and it gets its own section below. In short: Electron refuses to load an `app.asar` that has been changed since packaging.

### OnlyLoadAppFromAsar: on

Normally Electron looks for your app in several places, in order: a folder called `app`, then `app.asar`, then its built-in default app. An attacker could drop a folder called `app` next to your `app.asar`, and Electron would happily load **that** instead, skipping all your checks.

With the fuse **on**, Electron only ever loads `app.asar`. It works together with integrity checking: one fuse makes sure the archive is used, the other makes sure the archive is genuine.

## The fuses the template does not mention

There are three more fuses. The template leaves them at their default values.

### LoadBrowserProcessSpecificV8Snapshot (default: off)

Electron starts faster thanks to a **V8 snapshot**, a prepared memory image of JavaScript. With this fuse on, the main process loads its own separate snapshot file. This only matters for advanced startup tuning, as mentioned in [Performance: Faster Startup and Less Memory](/courses/electronjs/performance-tips). Leave it off.

### GrantFileProtocolExtraPrivileges (default: on)

Pages loaded from `file://` get some extra powers that a normal browser would not give them, like using `fetch()` to read other `file://` URLs. If your app serves its pages through a custom protocol, as in [Custom Protocols with protocol.handle](/courses/electronjs/custom-protocols), you can turn this off for extra safety.

**Do not turn it off with the Forge Vite template as it is.** The template loads its page with `loadFile`, and the Vite build uses module scripts with the `crossorigin` attribute. We tested this: with the fuse off, a `file://` page could not load its own `<script type="module" crossorigin>` file, and the window stayed blank. Switch to a custom protocol first, then turn the fuse off.

### WasmTrapHandlers (default: on)

This lets V8 run WebAssembly faster and more safely using special memory guards. Leave it on unless you have a specific reason.

## See the fuses for yourself

The `@electron/fuses` package has a small command-line tool that reads the fuses inside any Electron executable. Run it on the plain Electron in `node_modules` (on Windows):

```bash
npx @electron/fuses read --app node_modules/electron/dist/electron.exe
```

```text
Analyzing app: electron.exe
Fuse Version: v1
  RunAsNode is Enabled
  EnableCookieEncryption is Disabled
  EnableNodeOptionsEnvironmentVariable is Enabled
  EnableNodeCliInspectArguments is Enabled
  EnableEmbeddedAsarIntegrityValidation is Disabled
  OnlyLoadAppFromAsar is Disabled
  LoadBrowserProcessSpecificV8Snapshot is Disabled
  GrantFileProtocolExtraPrivileges is Enabled
  WasmTrapHandlers is Enabled
```

Those are Electron's defaults: friendly for developers, not locked down. Now package the app and read the fuses of **your** executable:

```bash
npm run package
npx @electron/fuses read --app out/demo-vite-win32-x64/demo-vite.exe
```

```text
Analyzing app: demo-vite.exe
Fuse Version: v1
  RunAsNode is Disabled
  EnableCookieEncryption is Enabled
  EnableNodeOptionsEnvironmentVariable is Disabled
  EnableNodeCliInspectArguments is Disabled
  EnableEmbeddedAsarIntegrityValidation is Enabled
  OnlyLoadAppFromAsar is Enabled
  LoadBrowserProcessSpecificV8Snapshot is Disabled
  GrantFileProtocolExtraPrivileges is Enabled
  WasmTrapHandlers is Enabled
```

Every fuse from the template's config is flipped. On macOS, point `--app` at the `.app` folder, for example `"out/demo-vite-darwin-arm64/demo-vite.app"`.

> **Note:** The tool can also **write** fuses: `npx @electron/fuses write --app <path> RunAsNode=off`. Forge does this for you while packaging, which is the right moment because it happens before signing. Writing fuses into an already signed app breaks its signature.

## ASAR integrity in detail

### The problem

Your code lives in `resources/app.asar`. As you saw in [Packaging and Making Installers with Forge](/courses/electronjs/packaging-and-installers), anyone can unpack it, change a file, and pack it again. On Windows and macOS, code signing protects the **executable**, but historically not the `app.asar` next to it. Someone could replace your login screen's code with a version that sends passwords elsewhere, and your signed app would run it.

### The solution

With integrity checking, packaging does three things:

1. It calculates a **hash** of your `app.asar`. A hash is a short fingerprint of data. Change even one byte and the fingerprint changes completely.
2. It stores that fingerprint **inside the executable** (on macOS, in the app's `Info.plist`; on Windows, as a resource inside the `.exe`).
3. Code signing then seals the executable, including the stored fingerprint.

When the app starts, Electron calculates the fingerprint of the `app.asar` it finds and compares it with the stored one. If they do not match, the app stops immediately instead of running modified code.

### What it needs to work

- **`asar: true`** in `packagerConfig`, because there is no fingerprint without an archive.
- **`EnableEmbeddedAsarIntegrityValidation: true`** and **`OnlyLoadAppFromAsar: true`** in the fuses.
- **Code signing**, so the stored fingerprint cannot simply be replaced along with the archive.
- **macOS or Windows.** Linux does not support ASAR integrity checking.

The Forge template already has the first two. Add signing, and your packaged app is protected.

## Requiring every fuse

New Electron versions sometimes add new fuses. If you list only some, the rest silently keep their defaults. The `strictlyRequireAllFuses` option makes packaging fail unless **every** fuse is listed, so you notice new ones the day you upgrade:

```javascript
// forge.config.mjs
new FusesPlugin({
  version: FuseVersion.V1,
  strictlyRequireAllFuses: true,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: true, // needed by loadFile + Vite modules
  [FuseV1Options.WasmTrapHandlers]: true,
}),
```

## Common mistakes

### Turning fuses back on to fix a bug

If something works in `npm start` but breaks in the packaged app, a fuse may be the reason, for example a script that relied on `ELECTRON_RUN_AS_NODE`. Fix the code (use `utilityProcess`) rather than switching the fuse back on.

### Expecting fuses in development

Fuses are only flipped in packaged builds. `npm start` runs the plain Electron with default fuses, so you can still use `--inspect` while developing. Always test security behaviour in a packaged build.

### Turning off GrantFileProtocolExtraPrivileges too early

With the Vite template's `loadFile` setup, the page's module scripts stop loading and the window stays blank. Move to a custom protocol first.

### Thinking integrity means secrecy

ASAR integrity stops people from **changing** your code. It does not stop them from **reading** it. Keep secrets on a server, never in the app.

## Quick recap

- Fuses are on/off switches stored in the Electron executable, flipped at package time and sealed by code signing.
- `RunAsNode: false` blocks `ELECTRON_RUN_AS_NODE`. Use `utilityProcess` for background Node code.
- `EnableCookieEncryption: true` encrypts cookies with an OS key. Treat it as one-way.
- `EnableNodeOptionsEnvironmentVariable: false` and `EnableNodeCliInspectArguments: false` block code injection through `NODE_OPTIONS` and debugger flags.
- `EnableEmbeddedAsarIntegrityValidation: true` plus `OnlyLoadAppFromAsar: true` make Electron load only a genuine, unmodified `app.asar` (macOS and Windows).
- `GrantFileProtocolExtraPrivileges` must stay on while you load Vite module scripts with `loadFile`.
- Check any executable with `npx @electron/fuses read --app <path>`.
- `strictlyRequireAllFuses: true` makes you decide on every fuse, including new ones.

<code id="code-content" class="language-javascript">
// forge.config.mjs: every fuse set on purpose, with ASAR integrity turned on
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
const config = {
  packagerConfig: {
    asar: true, // integrity checking needs an archive
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({}), new MakerZIP({}, ['darwin']), new MakerRpm({}), new MakerDeb({})],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main.js', config: 'vite.main.config.mjs', target: 'main' },
        { entry: 'src/preload.js', config: 'vite.preload.config.mjs', target: 'preload' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.mjs' }],
    }),
    // --- Flipped at package time, before code signing seals the executable
    new FusesPlugin({
      version: FuseVersion.V1,
      strictlyRequireAllFuses: true, // fail the build if a new fuse appears
      // Block ways to run other code with your app's identity
      [FuseV1Options.RunAsNode]: false, // ignore ELECTRON_RUN_AS_NODE
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false, // ignore NODE_OPTIONS
      [FuseV1Options.EnableNodeCliInspectArguments]: false, // ignore --inspect flags
      // Only run a genuine, unmodified app.asar (macOS and Windows)
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      // Protect data at rest (treat as one-way once shipped)
      [FuseV1Options.EnableCookieEncryption]: true,
      // Defaults, written down so nothing is left to chance
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: true, // loadFile + Vite module scripts need it
      [FuseV1Options.WasmTrapHandlers]: true,
    }),
  ],
};
export default config;
</code></pre>
