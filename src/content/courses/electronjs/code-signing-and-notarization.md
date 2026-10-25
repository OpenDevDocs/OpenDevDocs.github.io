---
publishDate: 2026-10-25T12:51
title: Code Signing and Notarization
slug: code-signing-and-notarization
metadescription: Understand code signing for Windows and macOS, set up windowsSign, osxSign and osxNotarize in Electron Forge, and keep your signing secrets safe.
updateDate: 2026-10-25T12:51
author: ['bishal-biswas']
level: 3
tags: ['code-signing', 'notarization', 'security']
course: electronjs
---

## Why your users see scary warnings

Send someone the installer you made in [Packaging and Making Installers with Forge](/courses/electronjs/packaging-and-installers) and ask them to run it.

- On **Windows**, a blue box appears: "Windows protected your PC". The publisher is listed as "Unknown publisher", and the Run button is hidden behind "More info".
- On **macOS**, the app refuses to open with a message that Apple cannot check it for malicious software. On some setups, macOS even claims the app "is damaged".

Your app is fine. The operating system just has no idea **who** made it, or whether someone changed it after you built it. Most people will stop right there and delete your app.

**Code signing** fixes this. Signing attaches a digital signature to your app's files. The signature says two things:

1. **Who** published the app, proven by a certificate that a trusted company checked.
2. **That nothing changed** since it was signed. Changing even one byte breaks the signature.

Think of the tamper-proof seal on a medicine bottle. The brand name tells you who made it, and an unbroken seal tells you nobody opened it on the way. Pharmacies only stock sealed bottles. Operating systems increasingly treat apps the same way.

This lesson explains the ideas and the Electron Forge settings. Getting certificates involves paperwork, identity checks and yearly fees, so read it all before buying anything.

## The words you need

- **Certificate:** a digital ID card for publishers. A **certificate authority** (CA), a company the operating system trusts, checks who you are and issues it.
- **Private key:** the secret half of your certificate. Whoever has it can sign as you, so it must be guarded carefully.
- **Signing:** using the private key to create a signature for each file.
- **Timestamping:** adding a trusted time to the signature, so it stays valid even after your certificate expires.
- **Notarization (macOS only):** uploading your signed app to Apple, which scans it automatically and issues a "ticket" saying it looks safe.

## Windows: signing your app

### Getting a certificate

Windows trusts code signed with a certificate from a recognized CA. You have two main routes:

- **A cloud signing service**, such as **Azure Trusted Signing** from Microsoft. You never hold the private key yourself. It stays in Microsoft's secure hardware and you sign through an API. This is often the cheapest and easiest option for individuals and small companies, if you are eligible in your country.
- **A certificate from a CA**, for example as an OV (organization validated) or EV (extended validation) certificate. Rules for code signing now require the private key to live on secure hardware: a USB token or a cloud key vault. You no longer receive a simple file you can copy to your build machine.

> **Note:** Signing does not make SmartScreen trust you instantly. Windows builds a **reputation** for your signature over time, as more people download and run your app without problems. A signed app with a new certificate may still see a warning for a while.

### Telling Forge to sign

Windows signing is done by `@electron/windows-sign`, which uses Microsoft's **SignTool** program. In Forge you configure it in two places:

- **`packagerConfig.windowsSign`** signs your app's own files (your `.exe` and its DLLs) during packaging.
- **`windowsSign` on `MakerSquirrel`** signs the `Setup.exe` installer.

Use the same settings for both. If you have a certificate in a `.pfx` file (common for older certificates or for testing), the settings look like this:

```javascript
// forge.config.mjs
const windowsSign = {
  certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
  certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
  timestampServer: 'http://timestamp.digicert.com',
  description: 'Todo Buddy',
  website: 'https://example.com',
};

const config = {
  packagerConfig: {
    asar: true,
    windowsSign,
  },
  makers: [
    new MakerSquirrel({ windowsSign }),
    // ...other makers
  ],
};
```

- **`certificateFile`** and **`certificatePassword`** come from **environment variables**, never from the file itself. More on that below.
- **`timestampServer`** is a public server run by a CA that adds the trusted time. DigiCert's is the default.
- **`description`** and **`website`** appear in the signature details users can inspect.

### Signing with a cloud service

With Azure Trusted Signing or a hardware token, there is no `.pfx` file. Instead, SignTool needs extra arguments that tell it to use the cloud service. `signWithParams` passes them through:

```javascript
// forge.config.mjs
const windowsSign = {
  signWithParams: [
    '/dlib', 'C:\\signing\\Azure.CodeSigning.Dlib.dll',
    '/dmdf', 'C:\\signing\\metadata.json',
  ],
  timestampServer: 'http://timestamp.acs.microsoft.com',
};
```

- **`/dlib`** points SignTool at a small library, downloaded from Microsoft, that talks to the signing service.
- **`/dmdf`** points to a JSON file with your signing account's details: the service address, your account name and your certificate profile name.

The service checks who you are through environment variables (for example a client ID, secret and tenant ID for an Azure app registration). The exact file names and steps change from time to time, so follow Microsoft's current Trusted Signing guide for the setup and use this lesson for the Forge side.

For full control, `windowsSign` also accepts `hookModulePath`: a path to your own JavaScript file that is called once for every file that needs signing. Use it when your signing provider has its own command-line tool.

### Checking the result

After `npm run make` on Windows, right-click the `Setup.exe`, choose **Properties** and open the **Digital Signatures** tab. You should see your name and a timestamp. In PowerShell:

```powershell
Get-AuthenticodeSignature ".\out\make\squirrel.windows\x64\Todo Buddy-1.2.0 Setup.exe"
```

A `Status` of `Valid` means the signature is good.

## macOS: signing and notarization

Apple is stricter. On macOS, an app downloaded from the internet must be **signed** with an Apple-issued certificate **and notarized** by Apple, or Gatekeeper (macOS's security guard) blocks it.

### What you need

1. **Membership of the Apple Developer Program.** It costs a yearly fee.
2. **A "Developer ID Application" certificate.** Create it in your Apple Developer account or in Xcode, and install it in your Mac's Keychain.
3. **A Mac with Xcode** (or the Xcode Command Line Tools). Signing and notarizing only run on macOS.

### Signing with osxSign

Signing is done by `@electron/osx-sign`. In most cases, an empty object is enough. It finds your Developer ID certificate in the Keychain and applies the settings Apple requires, such as the **hardened runtime** (a set of extra security restrictions notarization insists on):

```javascript
// forge.config.mjs
packagerConfig: {
  appBundleId: 'com.example.todobuddy',
  osxSign: {},
},
```

If you have several certificates, choose one with `identity`:

```javascript
osxSign: {
  identity: 'Developer ID Application: Asha Rao (AB12CD34EF)',
},
```

Forge signs every binary inside the `.app`, including helper apps and native modules in `app.asar.unpacked`. That is one more reason to use the `AutoUnpackNativesPlugin` from [Native Node Modules](/courses/electronjs/native-node-modules): native modules hidden inside `app.asar` cannot be signed.

### Notarizing with osxNotarize

Notarization sends your signed app to Apple's servers. Apple scans it, usually within a few minutes, and Forge then **staples** the resulting ticket to your app, so Gatekeeper can check it even without an internet connection.

You prove who you are to Apple in one of three ways. Pick one.

**1. Apple ID with an app-specific password.** Create an **app-specific password** on your Apple account page. It is a separate password just for tools like this, so your real Apple ID password is never used.

```javascript
// forge.config.mjs
osxNotarize: {
  appleId: process.env.APPLE_ID,
  appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
  teamId: process.env.APPLE_TEAM_ID,
},
```

**2. App Store Connect API key.** Better for CI servers and teams. Create a key in App Store Connect and download its `.p8` file.

```javascript
osxNotarize: {
  appleApiKey: process.env.APPLE_API_KEY_PATH, // path to the .p8 file
  appleApiKeyId: process.env.APPLE_API_KEY_ID,
  appleApiIssuer: process.env.APPLE_API_ISSUER,
},
```

**3. A Keychain profile.** Store the credentials once on your Mac with `xcrun notarytool store-credentials`, then refer to them by name. Nothing secret appears in your config at all.

```javascript
osxNotarize: {
  keychainProfile: 'todo-buddy-notary',
},
```

`osxNotarize` only works together with `osxSign`. An unsigned app cannot be notarized.

### Checking the result

On the Mac, after `npm run package` or `npm run make`:

```bash
codesign --verify --deep --strict --verbose=2 "out/Todo Buddy-darwin-arm64/Todo Buddy.app"
spctl --assess --type execute --verbose "out/Todo Buddy-darwin-arm64/Todo Buddy.app"
xcrun stapler validate "out/Todo Buddy-darwin-arm64/Todo Buddy.app"
```

- `codesign --verify` checks the signature.
- `spctl --assess` asks Gatekeeper what it thinks. You want to see `accepted` and `source=Notarized Developer ID`.
- `stapler validate` confirms the notarization ticket is attached.

> **Note:** On macOS, automatic updates **only work for signed apps**. Signing is not optional if you want the next lesson, [Automatic Updates](/courses/electronjs/automatic-updates), to work on Macs.

## What about Linux?

Linux desktops do not check signatures on apps you download and run. Linux distributions do sign the **packages in their repositories**, but that is handled by whoever runs the repository. For a `.deb`, `.rpm`, Flatpak or Snap you distribute yourself, there is nothing to set up in Forge.

## Keeping secrets out of your code

Every example above reads secrets from **environment variables** with `process.env`. An environment variable is a named value that lives in your terminal session or CI system, outside your project files.

On macOS and Linux, set one for the current terminal like this:

```bash
export APPLE_ID="asha@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
export APPLE_TEAM_ID="AB12CD34EF"
npm run make
```

On Windows PowerShell:

```powershell
$env:WINDOWS_CERTIFICATE_FILE = "C:\certs\todo-buddy.pfx"
$env:WINDOWS_CERTIFICATE_PASSWORD = "your-password"
npm run make
```

On a CI service like GitHub Actions, you store them as encrypted **secrets** in the repository settings. [Publishing Releases to GitHub and App Stores](/courses/electronjs/publishing-releases) shows how a workflow reads them.

> **Warning:** Never commit certificates, `.p8` keys or passwords to Git, even in a private repository. Anyone who gets your signing key can publish malware with your name on it, and every copy of your app would trust it. Add certificate files to `.gitignore`.

## Making signing optional during development

You do not want every `npm run package` on your laptop to wait for Apple. A common pattern is to sign only when the secrets are present:

```javascript
// forge.config.mjs
const shouldSignMac = Boolean(process.env.APPLE_ID);
const shouldSignWindows = Boolean(process.env.WINDOWS_CERTIFICATE_FILE);
const windowsSign = shouldSignWindows
  ? { certificateFile: process.env.WINDOWS_CERTIFICATE_FILE, certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD }
  : undefined;

const config = {
  packagerConfig: {
    asar: true,
    windowsSign,
    osxSign: shouldSignMac ? {} : undefined,
    osxNotarize: shouldSignMac
      ? { appleId: process.env.APPLE_ID, appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD, teamId: process.env.APPLE_TEAM_ID }
      : undefined,
  },
};
```

Local builds stay fast and unsigned. Your release builds on CI, which have the secrets, come out signed.

## Signing and fuses

The Forge template's `FusesPlugin` changes a few bytes inside the Electron executable while packaging. Changing bytes after signing would break the signature, so fuses must be flipped **before** signing. Forge already runs them in the right order. If you ever sign with your own scripts, keep that order in mind. [Electron Fuses and ASAR Integrity](/courses/electronjs/fuses-and-asar-integrity) explains what the fuses do.

## Common mistakes

### Signing the app but not the installer

On Windows, `packagerConfig.windowsSign` signs the app files, but the `Setup.exe` that users download is made later by the maker. Pass `windowsSign` to `MakerSquirrel` as well, or users still see "Unknown publisher".

### Using your real Apple ID password

Notarization needs an **app-specific password** (or an API key), not the password you use to log in to Apple. Your real password will be rejected.

### Expecting to sign a Mac app on Windows

`osxSign` and `osxNotarize` need macOS and Xcode. Build and sign the Mac version on a Mac, or on a macOS runner in CI.

### Committing secrets

Once a key is pushed to Git, consider it stolen. Revoke the certificate, get a new one, and move secrets into environment variables.

## Quick recap

- Code signing proves who made your app and that nobody changed it. Without it, users see Windows SmartScreen and macOS Gatekeeper warnings.
- Windows: get a certificate from a CA or use a cloud service like Azure Trusted Signing. Configure `windowsSign` in `packagerConfig` **and** on `MakerSquirrel`.
- Use `certificateFile` and `certificatePassword` for `.pfx` files, `signWithParams` for cloud signing, or `hookModulePath` for full control.
- macOS: join the Apple Developer Program, install a Developer ID Application certificate, and set `osxSign: {}`.
- `osxNotarize` uploads the app to Apple. Authenticate with an app-specific password, an App Store Connect API key or a Keychain profile.
- Check signatures with `Get-AuthenticodeSignature` on Windows, and `codesign`, `spctl` and `stapler` on macOS.
- Keep every secret in environment variables or CI secrets, never in Git.
- macOS auto-updates require a signed app.

<code id="code-content" class="language-javascript">
// forge.config.mjs: signing on Windows and macOS, only when secrets are present
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
// --- Windows: a .pfx certificate whose path and password come from the environment
const windowsSign = process.env.WINDOWS_CERTIFICATE_FILE
  ? {
      certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
      certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
      timestampServer: 'http://timestamp.digicert.com',
      description: 'Todo Buddy',
      website: 'https://example.com',
    }
  : undefined;
// --- macOS: sign with the Developer ID certificate in the Keychain, then notarize
const signMac = Boolean(process.env.APPLE_ID);
const config = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.example.todobuddy',
    windowsSign, // signs the app's .exe and DLLs
    osxSign: signMac ? {} : undefined,
    osxNotarize: signMac
      ? {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD, // not your real password
          teamId: process.env.APPLE_TEAM_ID,
        }
      : undefined,
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({ windowsSign }), // signs Setup.exe too
    new MakerZIP({}, ['darwin']),
    new MakerDMG({}),
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main.js', config: 'vite.main.config.mjs', target: 'main' },
        { entry: 'src/preload.js', config: 'vite.preload.config.mjs', target: 'preload' },
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.mjs' }],
    }),
    // FusesPlugin from the template stays here: fuses are flipped before signing
  ],
};
export default config;
</code></pre>
