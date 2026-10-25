---
publishDate: 2026-10-25T12:34
title: Keeping Secrets Safe with safeStorage
slug: safestorage-secrets
metadescription: Encrypt API keys and tokens with Electron's async safeStorage API, store them in userData, and learn how Windows, macOS and Linux protect the key.
updateDate: 2026-10-25T12:34
author: ['bishal-biswas']
level: 2
tags: ['safestorage', 'encryption', 'security']
course: electronjs
---

## Why secrets need special care

Some data is more sensitive than a window size or a theme. Think of an API key, a login token from a web service, or a password for a server your app connects to. These are called **secrets**: anyone who reads them can act as your user.

If you put a token in a normal settings file like you did in [Saving User Settings](/courses/electronjs/saving-user-settings), it sits on disk as plain text. Any backup tool, sync service or curious person with access to the folder can read it.

Electron's `safeStorage` module solves this by **encrypting** the secret: scrambling it with a key so it looks like random bytes. Only your app, running as the same user on the same computer, can unscramble (**decrypt**) it.

Here is the everyday picture. Your app writes the secret on a note, puts it in a locked box, and leaves the box in the `userData` folder. The key to the box is not in the folder. It is kept by the operating system's own key safe:

| Platform | Where the key is protected |
| --- | --- |
| macOS | The **Keychain**, the system password store |
| Windows | **DPAPI** (Data Protection API), tied to the user's Windows login |
| Linux | A **secret service** such as GNOME Keyring (libsecret) or KWallet, if one is running |

## The async safeStorage API

`safeStorage` runs in the **main process only**. In the latest Electron you use three asynchronous methods, all of which return Promises:

```javascript
// main.js (the three methods you need)
const { safeStorage } = require('electron');

await safeStorage.isAsyncEncryptionAvailable(); // true or false
await safeStorage.encryptStringAsync('my-secret'); // a Buffer of encrypted bytes
await safeStorage.decryptStringAsync(buffer); // { result, shouldReEncrypt }
```

- `isAsyncEncryptionAvailable()` tells you whether encryption can be used right now. Call it after the app is ready.
- `encryptStringAsync(text)` turns a string into a **Buffer** (Node's type for raw bytes) of encrypted data.
- `decryptStringAsync(buffer)` turns those bytes back into the string. It resolves to an object, not a plain string. `result` is your secret. `shouldReEncrypt` is `true` when the operating system has switched to a newer key, which means you should encrypt the value again and save the new bytes.

> **Note:** You may see older tutorials using `safeStorage.isEncryptionAvailable()`, `encryptString()` and `decryptString()`. Those synchronous methods are deprecated in Electron 45 and removed in Electron 46. Data encrypted by the old methods can still be read with `decryptStringAsync()`, so switching is safe.

## Step 1: a tiny round trip

Before building anything, check that encryption works on your machine. Put this in a plain project's `main.js`:

```javascript
// main.js
const { app, safeStorage } = require('electron');

app.whenReady().then(async () => {
  const available = await safeStorage.isAsyncEncryptionAvailable();
  console.log('Encryption available:', available);

  const encrypted = await safeStorage.encryptStringAsync('sk-test-12345');
  console.log('Encrypted bytes:', encrypted.toString('base64'));

  const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(encrypted);
  console.log('Decrypted:', result, '| re-encrypt?', shouldReEncrypt);

  app.quit();
});
```

```bash
npm start
```

```text
Encryption available: true
Encrypted bytes: djEwyZ8h0c3b...Q==
Decrypted: sk-test-12345 | re-encrypt? false
```

The encrypted text is different every time you run it, and it is useless without the key held by your operating system.

## Step 2: store the encrypted bytes in a file

Encrypted data is raw bytes, and JSON cannot hold raw bytes. The usual trick is **base64**: a way of writing any bytes using only letters, digits, `+`, `/` and `=`. You convert the Buffer to base64 to save it, and back to a Buffer to decrypt it.

Create `secrets.js` next to `main.js`:

```javascript
// secrets.js
const { app, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const secretsFile = () => path.join(app.getPath('userData'), 'secrets.json');

async function readAll() {
  try {
    return JSON.parse(await fs.readFile(secretsFile(), 'utf8'));
  } catch {
    return {}; // no file yet
  }
}

async function writeAll(data) {
  await fs.writeFile(secretsFile(), JSON.stringify(data, null, 2));
}

async function saveSecret(name, value) {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error('Secure storage is not available on this system.');
  }
  const encrypted = await safeStorage.encryptStringAsync(value);
  const data = await readAll();
  data[name] = encrypted.toString('base64');
  await writeAll(data);
}

async function loadSecret(name) {
  const data = await readAll();
  if (!data[name]) return null;

  const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(
    Buffer.from(data[name], 'base64'),
  );
  if (shouldReEncrypt) await saveSecret(name, result); // refresh with the newest key
  return result;
}

async function deleteSecret(name) {
  const data = await readAll();
  delete data[name];
  await writeAll(data);
}

module.exports = { saveSecret, loadSecret, deleteSecret };
```

Open `secrets.json` in your editor after saving a secret and you will see something like this:

```json
{
  "apiToken": "djEwyZ8h0c3bL2k8VYp0m3...Q=="
}
```

That is safe to sit on disk. Copy the file to another computer or another user account and it cannot be decrypted there.

## Step 3: keep the secret in the main process

Here is the most important design rule of this lesson: **the renderer does not need to see the secret**. A page only needs to know "is a token saved?" and to be able to save a new one. The main process can use the token itself, for example to call a web API.

That way, even if something went wrong in your page (a bad npm package, or injected HTML), the secret is not sitting in the page's memory to be stolen.

```javascript
// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const secrets = require('./secrets');

function createWindow() {
  const win = new BrowserWindow({
    width: 520,
    height: 360,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  ipcMain.handle('token:save', async (event, token) => {
    if (typeof token !== 'string' || token.length < 8 || token.length > 500) {
      throw new Error('That does not look like a valid token.');
    }
    await secrets.saveSecret('apiToken', token);
  });

  ipcMain.handle('token:status', async () => {
    return (await secrets.loadSecret('apiToken')) !== null;
  });

  ipcMain.handle('token:clear', () => secrets.deleteSecret('apiToken'));

  ipcMain.handle('api:whoami', async () => {
    const token = await secrets.loadSecret('apiToken');
    if (!token) return 'No token saved.';
    const response = await fetch('https://api.example.com/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok ? (await response.json()).name : `Request failed: ${response.status}`;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

The preload exposes four small functions. None of them returns the token:

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('account', {
  saveToken: (token) => ipcRenderer.invoke('token:save', token),
  hasToken: () => ipcRenderer.invoke('token:status'),
  clearToken: () => ipcRenderer.invoke('token:clear'),
  whoAmI: () => ipcRenderer.invoke('api:whoami'),
});
```

And a small page to drive it:

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'" />
    <title>API Token</title>
  </head>
  <body>
    <p id="status">Checking...</p>
    <input id="token" type="password" placeholder="Paste your API token" />
    <button id="save">Save</button>
    <button id="clear">Forget token</button>
    <script src="renderer.js"></script>
  </body>
</html>
```

```javascript
// renderer.js
const status = document.querySelector('#status');
const input = document.querySelector('#token');

async function showStatus() {
  status.textContent = (await window.account.hasToken())
    ? 'A token is saved (encrypted).'
    : 'No token saved yet.';
}

document.querySelector('#save').addEventListener('click', async () => {
  try {
    await window.account.saveToken(input.value);
    input.value = ''; // do not leave the secret in the page
    showStatus();
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelector('#clear').addEventListener('click', async () => {
  await window.account.clearToken();
  showStatus();
});

showStatus();
```

Using `type="password"` hides the token on screen while it is typed, and clearing the input after saving removes it from the page.

## Linux: it depends on the desktop

On macOS and Windows, `safeStorage` just works. On Linux, Electron needs a secret service to hold the key, and not every Linux desktop has one running.

`safeStorage.getSelectedStorageBackend()` (Linux only) tells you what Electron picked. Call it after the app is ready:

```javascript
// main.js (Linux check)
app.whenReady().then(async () => {
  await safeStorage.isAsyncEncryptionAvailable(); // make sure it is initialised
  if (process.platform === 'linux') {
    const backend = safeStorage.getSelectedStorageBackend();
    console.log('Linux key store:', backend);
    if (backend === 'basic_text') {
      console.warn('No system key store found: secrets are only lightly protected.');
    }
  }
});
```

The possible values are `gnome_libsecret`, `kwallet`, `kwallet5`, `kwallet6`, `basic_text` and `unknown` (before the app is ready). `basic_text` means Electron found no key store and fell back to a fixed, built-in password. Data is still scrambled, but anyone with your app could unscramble it, so treat it as "not really secret".

What you can do on Linux:

- Tell users to install and unlock GNOME Keyring or KWallet. Lightweight window managers often run neither.
- Users can force a choice with a command-line flag, for example `my-app --password-store="gnome-libsecret"`.
- In your UI, warn the user when the backend is `basic_text`, or refuse to store the secret.

## What safeStorage does and does not protect against

It is important to be honest about what encryption at rest gives you:

- **Protects against:** someone copying the `userData` folder, a backup leaking, another user account on the same computer, and casual snooping in config files.
- **Does not protect against:** malware already running as the same user. On Windows in particular, DPAPI lets any program running as that user decrypt the data. On macOS the Keychain ties the key to your app, which is stronger.

So `safeStorage` is the right tool for tokens and keys, but it is not a reason to store more than you need. If a service lets you use short-lived tokens, prefer them.

## Common mistakes

### Calling safeStorage before the app is ready

Encryption needs the operating system's key store, which Electron connects to after `ready`. Call `safeStorage` methods inside `app.whenReady().then(...)` or later.

### Treating decryptStringAsync's result as a string

```javascript
const secret = await safeStorage.decryptStringAsync(buffer);
console.log(secret.length); // undefined: secret is an object
```

Destructure it: `const { result } = await safeStorage.decryptStringAsync(buffer);`.

### Saving the Buffer straight into JSON

`JSON.stringify` turns a Buffer into `{ "type": "Buffer", "data": [...] }`, which is bulky and easy to break. Convert with `buffer.toString('base64')` when saving and `Buffer.from(text, 'base64')` when loading.

### Sending the secret to the renderer "just to display it"

Every place the secret travels is a place it can leak. Keep it in the main process and send the page only what it needs, such as "a token is saved". Remember also that sandboxed preloads in the latest Electron have no `Buffer` at all, which is one more reason to do this work in main.

## Quick recap

- Secrets such as API tokens should never sit in plain-text settings files.
- `safeStorage` encrypts strings with a key held by the operating system: Keychain on macOS, DPAPI on Windows, a secret service on Linux.
- Use the async API: `isAsyncEncryptionAvailable()`, `encryptStringAsync()` (returns a Buffer) and `decryptStringAsync()` (returns `{ result, shouldReEncrypt }`).
- Store the encrypted bytes as base64 in a file in `userData`, and re-encrypt when `shouldReEncrypt` is `true`.
- Keep secrets in the main process. Expose "save", "has" and "clear" functions, not "get".
- On Linux, check `getSelectedStorageBackend()` and warn when it is `basic_text`.

<code id="code-content" class="language-javascript">
// main.js: store an API token encrypted with safeStorage
const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
// --- 1. Encrypted values live as base64 in userData/secrets.json
const secretsFile = () =&gt; path.join(app.getPath('userData'), 'secrets.json');
async function readAll() {
  try {
    return JSON.parse(await fs.readFile(secretsFile(), 'utf8'));
  } catch {
    return {};
  }
}
async function saveSecret(name, value) {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) throw new Error('Secure storage unavailable.');
  const data = await readAll();
  data[name] = (await safeStorage.encryptStringAsync(value)).toString('base64');
  await fs.writeFile(secretsFile(), JSON.stringify(data, null, 2));
}
async function loadSecret(name) {
  const data = await readAll();
  if (!data[name]) return null;
  // --- 2. decryptStringAsync resolves to { result, shouldReEncrypt }
  const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(Buffer.from(data[name], 'base64'));
  if (shouldReEncrypt) await saveSecret(name, result);
  return result;
}
function createWindow() {
  const win = new BrowserWindow({ width: 520, height: 360, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  win.loadFile('index.html');
}
app.whenReady().then(async () =&gt; {
  // --- 3. On Linux, warn if no real key store was found
  if (process.platform === 'linux') {
    await safeStorage.isAsyncEncryptionAvailable();
    if (safeStorage.getSelectedStorageBackend() === 'basic_text') console.warn('Secrets are only lightly protected.');
  }
  // --- 4. The renderer can save or check the token, but never read it back
  ipcMain.handle('token:save', async (event, token) =&gt; {
    if (typeof token !== 'string' || token.length &lt; 8 || token.length &gt; 500) throw new Error('Invalid token.');
    await saveSecret('apiToken', token);
  });
  ipcMain.handle('token:status', async () =&gt; (await loadSecret('apiToken')) !== null);
  ipcMain.handle('api:whoami', async () =&gt; {
    const token = await loadSecret('apiToken');
    if (!token) return 'No token saved.';
    const response = await fetch('https://api.example.com/me', { headers: { Authorization: `Bearer ${token}` } });
    return response.ok ? (await response.json()).name : `Request failed: ${response.status}`;
  });
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
</code></pre>
