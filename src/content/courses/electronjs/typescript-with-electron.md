---
publishDate: 2026-10-25T12:36
title: TypeScript in Electron
slug: typescript-with-electron
metadescription: Start an Electron Forge project with TypeScript, type your IPC handlers, and give window.api full autocomplete in the renderer with a small .d.ts file.
updateDate: 2026-10-25T12:36
author: ['bishal-biswas']
level: 2
tags: ['typescript', 'types', 'vite']
course: electronjs
---

## What TypeScript adds

**TypeScript** is JavaScript plus **types**: little labels that say what kind of value something is, such as `string`, `number` or "an object with an `id` and a `text`". A tool called the **type checker** reads those labels and warns you about mistakes before you run the code.

Electron apps have a special reason to like this. Your code is split across three places (main, preload and renderer) that talk through IPC. It is very easy to rename a function in the preload and forget the renderer, or to send a number where main expects a string. Those mistakes only show up at run time in plain JavaScript. With TypeScript, your editor underlines them as you type.

Think of types as labels on moving boxes. Without labels, you open every box to find the plates. With labels, you (and your helpers) know what is inside before opening anything, and someone putting books in the "plates" box gets told off straight away.

> **Note:** Types disappear when your code is built. They help you while writing code, but they do **not** check data at run time. You still need to validate IPC input in the main process. You will see why below.

## Step 1: create a TypeScript project

Electron Forge's Vite template has a TypeScript option:

```bash
npx create-electron-app@latest ts-notes --template vite --typescript
cd ts-notes
npm start
```

You get the same "Hello World!" window as the JavaScript version. The files are a little different:

```text
ts-notes/
├── forge.config.mts          <- Forge config, written in TypeScript
├── vite.main.config.mts
├── vite.preload.config.mts
├── vite.renderer.config.mts
├── tsconfig.json             <- TypeScript settings
├── index.html                <- loads /src/renderer.ts
└── src/
    ├── main.ts
    ├── preload.ts
    ├── renderer.ts
    ├── declarations.d.ts     <- extra type declarations
    └── index.css
```

`.ts` files hold TypeScript. `.mts` is TypeScript using `import`/`export` modules, the same idea as `.mjs` for JavaScript. A `.d.ts` file (**declaration file**) contains only types, no running code.

### The two checks: building and type checking

Here is something that surprises many beginners. When you run `npm start`, Vite **removes** the types and runs your code. It does not stop to check them, which keeps it fast. To actually check your types, the template gives you a separate script:

```bash
npm run typecheck
```

That runs `tsc --noEmit`: the TypeScript compiler, checking everything without writing any files. Your editor (VS Code, for example) runs the same checks continuously and shows red underlines.

### Turn on strict mode

The template's `tsconfig.json` enables `noImplicitAny`, which forbids silent "anything goes" values. For new projects, turn on the full set of checks:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "preserve",
    "moduleResolution": "bundler",
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "noImplicitAny": true,
    "strict": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "*.ts", "*.mts"]
}
```

`strict` adds checks such as "this value might be `null`", which catch real bugs.

## Where the Electron types come from

You did not install any type packages for Electron, yet hovering over `BrowserWindow` in your editor shows its documentation. That is because the `electron` package ships its own declaration file, `electron.d.ts`, describing every API. TypeScript finds it automatically.

The Forge-specific names, `MAIN_WINDOW_VITE_DEV_SERVER_URL` and `MAIN_WINDOW_VITE_NAME`, are declared in `src/declarations.d.ts`:

```typescript
// src/declarations.d.ts
/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
declare module '*.css';
```

The first line pulls in the Vite plugin's declarations for those magic constants. The second says "importing a `.css` file is allowed", so `import './index.css'` does not cause an error.

## Step 2: share types between processes

Let's build a tiny notes API: list notes and add a note. First, describe a note once, in a file all three processes can import:

```typescript
// src/shared/types.ts
export interface Note {
  id: number;
  text: string;
  createdAt: number;
}
```

An `interface` describes the shape of an object. Anything typed as `Note` must have exactly these properties with these types.

## Step 3: type the main process

```typescript
// src/main.ts (the IPC part)
import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import type { Note } from './shared/types';

const notes: Note[] = [];

function listNotes(): Note[] {
  return notes;
}

function addNote(_event: IpcMainInvokeEvent, text: unknown): Note {
  // Types vanish at run time, so check the real value
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('Note text must be a non-empty string.');
  }
  const note: Note = { id: notes.length + 1, text: text.trim(), createdAt: Date.now() };
  notes.push(note);
  return note;
}

app.whenReady().then(() => {
  ipcMain.handle('notes:list', listNotes);
  ipcMain.handle('notes:add', addNote);
  // createWindow() and the usual lifecycle code from the template...
});
```

Two details to notice:

- `IpcMainInvokeEvent` is the type of the `event` argument that `ipcMain.handle` passes. The leading `_` in `_event` is a convention for "I receive this but do not use it".
- The `text` parameter is typed `unknown`, not `string`. That is deliberate. Electron's own types say IPC arguments can be anything (`any[]`), and that is the truth: a buggy or compromised renderer could send a number, an object or nothing. `unknown` forces you to check the value before using it. After the `typeof text !== 'string'` check, TypeScript knows `text` is a string.

This is called **narrowing**: the type checker follows your `if` checks and narrows `unknown` down to the type you proved.

## Step 4: type the preload and export its shape

In the preload, build the API as a normal object, give each function a return type, and then export the type of the whole object:

```typescript
// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { Note } from './shared/types';

const api = {
  listNotes: (): Promise<Note[]> => ipcRenderer.invoke('notes:list'),
  addNote: (text: string): Promise<Note> => ipcRenderer.invoke('notes:add', text),
  onNoteAdded: (callback: (note: Note) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, note: Note) => callback(note);
    ipcRenderer.on('notes:added', listener);
    return () => ipcRenderer.removeListener('notes:added', listener);
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
```

- `Promise<Note[]>` means "a Promise that resolves to an array of notes". `ipcRenderer.invoke` itself returns `Promise<any>`, so this annotation is you promising what main sends back.
- `typeof api` asks TypeScript for the type of the `api` object, so you never write the same list of functions twice.
- `Electron.IpcRendererEvent` uses the global `Electron` namespace that the Electron types provide.
- `export type` exports only a type. It is erased at build time, so the renderer never imports any preload code.

## Step 5: tell the renderer about window.api

The renderer is a web page. As far as TypeScript knows, `window` is a normal browser window, and it has never heard of `api`:

```typescript
// src/renderer.ts
window.api.listNotes();
```

```text
src/renderer.ts:1:8 - error TS2339: Property 'api' does not exist on type 'Window & typeof globalThis'.
```

You fix this by **adding a property to the `Window` interface**. Create a declaration file:

```typescript
// src/window.d.ts
import type { Api } from './preload';

declare global {
  interface Window {
    api: Api;
  }
}
```

- `declare global` means "add this to the global types, not just this file".
- TypeScript merges your `interface Window` with the built-in one, so `window` now has an `api` property of type `Api`.
- Because it is a `.d.ts` file inside `src/`, which `tsconfig.json` includes, every renderer file sees it automatically.

Now write the renderer:

```typescript
// src/renderer.ts
import './index.css';
import type { Note } from './shared/types';

const list = document.querySelector<HTMLUListElement>('#notes')!;
const form = document.querySelector<HTMLFormElement>('#add-form')!;
const input = document.querySelector<HTMLInputElement>('#note-text')!;

function show(notes: Note[]): void {
  list.replaceChildren(
    ...notes.map((note) => {
      const li = document.createElement('li');
      li.textContent = note.text;
      return li;
    }),
  );
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await window.api.addNote(input.value);
  input.value = '';
  show(await window.api.listNotes());
});

window.api.listNotes().then(show);
```

```html
<!-- index.html (body) -->
<body>
  <form id="add-form">
    <input id="note-text" placeholder="New note" />
    <button>Add</button>
  </form>
  <ul id="notes"></ul>
  <script type="module" src="/src/renderer.ts"></script>
</body>
```

Type `window.api.` in your editor and you get a list of `listNotes`, `addNote` and `onNoteAdded`, with their parameter types. Now try a mistake:

```typescript
window.api.addNote(42);
```

```bash
npm run typecheck
```

```text
src/renderer.ts:24:20 - error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
```

The mistake is caught before the app ever runs. Rename `addNote` in the preload and every place that uses the old name lights up red too.

A few TypeScript details in that renderer:

- `querySelector<HTMLInputElement>('#note-text')` tells TypeScript what kind of element you expect, so `input.value` is allowed.
- The `!` at the end says "I am sure this is not `null`". Use it only when the element is definitely in your HTML.

## Optional: one list of channels

Channel names like `'notes:add'` are plain strings, so a typo in main or preload is not caught. A simple fix is to keep them as constants in the shared folder:

```typescript
// src/shared/channels.ts
export const Channels = {
  listNotes: 'notes:list',
  addNote: 'notes:add',
  noteAdded: 'notes:added',
} as const;
```

```typescript
// usage in main.ts and preload.ts
ipcMain.handle(Channels.addNote, addNote);
ipcRenderer.invoke(Channels.addNote, text);
```

`as const` makes the values exact strings that cannot change. Now both sides use the same constant, and a typo is a compile error.

## TypeScript with React

The two lessons combine naturally. Start with `--template vite --typescript`, then follow [Using React or Vue with Electron](/courses/electronjs/using-react-or-vue), with three differences:

- Name your files `.tsx` instead of `.jsx` (for example `src/renderer.tsx` and `src/App.tsx`), and update the script tag.
- Add `"jsx": "react-jsx"` to `compilerOptions` in `tsconfig.json`.
- Install the React types: `npm install --save-dev @types/react @types/react-dom`.

Your `window.api` types work in components with no extra steps.

## Common mistakes

### Thinking types protect the main process

`ipcMain.handle('notes:add', (_e, text: string) => ...)` looks safe, but nothing checks that a string actually arrives. Type IPC arguments as `unknown` in main and validate them, as you learned in [Designing a Safe IPC API](/courses/electronjs/designing-a-safe-ipc-api).

### Importing preload code into the renderer

```typescript
import { api } from './preload'; // wrong
```

This tries to bundle the preload (and `ipcRenderer`) into the page, which fails in the sandbox. Only ever use `import type` from the preload, and reach the real functions through `window.api`.

### Forgetting to run the type checker

`npm start` happily runs code with type errors, because Vite only strips types. Run `npm run typecheck` before you commit or package, or add it to your build steps.

### Declaring Window in a file that is not included

If `window.d.ts` lives outside the folders listed in `tsconfig.json`'s `include`, TypeScript never reads it and `window.api` stays an error. Keep it in `src/`.

## Quick recap

- Scaffold with `npx create-electron-app@latest my-app --template vite --typescript`.
- Vite strips types without checking them; `npm run typecheck` runs `tsc --noEmit` to check.
- Electron ships its own types. Forge's magic constants come from `src/declarations.d.ts`.
- Put shared types (like `Note`) in a shared folder and import them with `import type`.
- In main, type IPC arguments as `unknown` and narrow them with real checks.
- In the preload, build an `api` object and `export type Api = typeof api`.
- Add `api: Api` to `interface Window` inside `declare global` in a `.d.ts` file for full autocomplete.

<code id="code-content" class="language-javascript">
// src/main.ts: typed IPC handlers in a Forge Vite TypeScript project
import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import type { Note } from './shared/types';
if (started) app.quit();
const notes: Note[] = [];
// --- 1. Arguments from a renderer are unknown until you check them
function addNote(_event: IpcMainInvokeEvent, text: unknown): Note {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('Note text must be a non-empty string.');
  }
  const note: Note = { id: notes.length + 1, text: text.trim(), createdAt: Date.now() };
  notes.push(note);
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('notes:added', note);
  return note;
}
const createWindow = (): void =&gt; {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  });
  // --- 2. MAIN_WINDOW_VITE_* are typed by src/declarations.d.ts
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};
app.whenReady().then(() =&gt; {
  ipcMain.handle('notes:list', (): Note[] =&gt; notes);
  ipcMain.handle('notes:add', addNote);
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
// --- 3. preload.ts: export type Api = typeof api;
// --- 4. window.d.ts: declare global { interface Window { api: Api } }
</code></pre>
