---
publishDate: 2026-10-24T14:00
title: Working with Files
slug: file-system
metadescription: 'Read, write, copy and delete files with the new expo-file-system File, Directory and Paths API, then export HabitHop habits as a CSV and share it.'
updateDate: 2026-10-24T14:00
author: ['bishal-biswas']
level: 3
tags: ['react-native', 'expo', 'files', 'device-features']
course: react-native
---

## Why work with files?

So far HabitHop keeps its data with AsyncStorage or SQLite. Those are great for app data, but sometimes you need real **files**:

- an **export** the user can open in Excel or Google Sheets
- a **backup** they can keep, or move to a new phone
- a downloaded file, like a PDF or an image
- a photo you want to keep, as you saw in [Picking Photos from the Gallery](/courses/react-native/image-picker)

In this lesson you will learn the file system API in SDK 58, and then build an **"Export as CSV"** button for HabitHop. It writes all habits into a `.csv` file and opens the share sheet, so the user can email it to themselves or save it to their files.

```bash
npx expo install expo-file-system expo-sharing
```

Both work in Expo Go.

## The new API: File, Directory and Paths

expo-file-system has an object-based API. Instead of passing path strings to many functions, you create objects:

- `File`: one file
- `Directory`: one folder
- `Paths`: the standard folders your app is allowed to use

```ts
import { Directory, File, Paths } from 'expo-file-system';
```

If you read older tutorials, you will see a different style: `FileSystem.documentDirectory`, `FileSystem.writeAsStringAsync(...)` and so on. That is the **legacy API**. In SDK 58, importing those functions from `'expo-file-system'` still type-checks (they are marked deprecated) but they **throw at runtime** with a message like this:

```text
Method writeAsStringAsync imported from "expo-file-system" is deprecated.
You can migrate to the new filesystem API using "File" and "Directory" classes or import the legacy API from "expo-file-system/legacy".
```

If you must run old code, import from `'expo-file-system/legacy'`. For new code, use `File` and `Directory`. That is what this lesson does.

## Where can your app put files?

Phone apps live in a **sandbox**: each app has its own private folders and cannot see other apps' files. `Paths` gives you the important ones:

| Folder | What it is for |
| --- | --- |
| `Paths.document` | Files the user cares about. The system does not delete them. Backed up on iOS. |
| `Paths.cache` | Temporary files. The system may delete them when space is low. |
| `Paths.bundle` | Files shipped inside your app. Read only. |

Each one is a `Directory` object with a `uri`:

```ts
console.log(Paths.document.uri);
```

```text
iOS  LOG  file:///var/mobile/Containers/Data/Application/6F1C.../Documents/
```

A **URI** is an address for a resource. Local files start with `file://`. You pass these URIs to other libraries, like `Image` or `Sharing.shareAsync`.

Rule of thumb: if losing the file would upset the user, put it in `Paths.document`. If you can make it again, put it in `Paths.cache`.

## Making a File object

```ts
const file = new File(Paths.document, 'notes.txt');
```

This does **not** create a file on disk. It only makes an object that points at that path. You can join several parts: `new File(Paths.document, 'backups', 'today.json')`. The first part can be a `Directory`, a `File` or a URI string.

Now you can ask about it:

```ts
console.log(file.exists);    // false the first time
console.log(file.name);      // 'notes.txt'
console.log(file.extension); // '.txt'
console.log(file.uri);       // 'file:///.../Documents/notes.txt'
```

## Writing and reading text

```ts
const file = new File(Paths.document, 'notes.txt');

await file.write('Hello from HabitHop');        // creates or replaces the file
await file.write('\nSecond line', { append: true });

const text = await file.text();
console.log(text);
```

```text
Android  LOG  Hello from HabitHop
Second line
```

In SDK 58, `write()` and `text()` return Promises, so you `await` them. There are also **sync** (synchronous, "wait right here") versions, `writeSync()` and `textSync()`. They are fine for tiny files. For anything bigger, use the async versions so the app does not freeze while the phone reads the disk.

`write()` creates the file if it is missing, but not the folder it is in. If you write into a folder that does not exist yet, create the folder first.

Other useful file methods:

- `file.size`: size in bytes
- `file.modificationTime`: when it was last changed, in milliseconds
- `await file.copy(otherFile)` and `await file.move(otherFile)`: copy or move it
- `file.rename('new-name.txt')`: rename it in the same folder
- `file.delete()`: delete it (throws if it does not exist, so check `exists` first)
- `await file.json()`: read and parse JSON in one step

For binary files like images, `bytes()` returns a `Uint8Array` and `base64()` returns a base64 string.

## Folders with Directory

A `Directory` works the same way:

```ts
const backups = new Directory(Paths.document, 'backups');
backups.create({ idempotent: true });
```

`create()` makes the folder. By default it throws if the folder already exists. `idempotent: true` means "it is fine if it already exists", so you can call it every time without checking. Use `intermediates: true` to also create missing parent folders, like `mkdir -p` on a computer.

To see what is inside, use `list()`. It returns a mix of `File` and `Directory` objects:

```ts
for (const item of new Directory(Paths.document).list()) {
  console.log(item instanceof Directory ? 'folder' : 'file', item.name);
}
```

```text
iOS  LOG  folder backups
iOS  LOG  file notes.txt
```

`directory.delete()` deletes the folder **and everything inside it**, so be careful with it.

## A backup feature with JSON

Here is a small backup module for HabitHop. It saves the habits as a JSON file, lists saved backups and reads one back:

```ts
// src/lib/backup.ts
import { Directory, File, Paths } from 'expo-file-system';
import type { Habit } from '@/types/habit';

const backups = new Directory(Paths.document, 'backups');

export async function saveBackup(habits: Habit[]) {
  backups.create({ idempotent: true });
  const file = new File(backups, `backup-${Date.now()}.json`);
  await file.write(JSON.stringify(habits, null, 2));
  return file;
}

export function listBackups(): File[] {
  if (!backups.exists) return [];
  return backups.list().filter((item): item is File => item instanceof File);
}

export async function readBackup(file: File): Promise<Habit[]> {
  return JSON.parse(await file.text()) as Habit[];
}
```

The `filter((item): item is File => ...)` part is a **type guard**: it tells TypeScript that the filtered array only contains `File` objects. You met the idea in [Just Enough TypeScript for React Native](/courses/react-native/typescript-basics).

## Downloading a file

`File.downloadFileAsync` downloads from the internet straight into a file. Here it saves 20 quotes from DummyJSON, a free test API used earlier in the course:

```ts
const file = await File.downloadFileAsync(
  'https://dummyjson.com/quotes?limit=20',
  new File(Paths.cache, 'quotes.json'),
  { idempotent: true }, // overwrite if it already exists
);
const data = await file.json();
console.log(data.quotes.length); // 20
```

Without `idempotent: true`, the download fails if the file already exists. If the server answers with an error status like 404, the Promise rejects and no file is created. For normal API data, `fetch` from [Fetching Data from an API](/courses/react-native/fetching-data) is simpler. Downloads shine for big files like PDFs, images and audio.

## Putting it together: export habits as CSV

**CSV** (comma-separated values) is a plain text table. Each line is a row, and commas separate the cells. Every spreadsheet app can open it. The code panel shows the full `src/lib/exportHabits.ts`. It has three parts.

**1. A safe cell.** If a habit name contains a comma or a quote, it would break the table. The CSV rule is: wrap each cell in double quotes, and double any quote inside it.

```ts
function cell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}
```

**2. Habits to CSV text.** One header row, then one row per habit:

```ts
export function habitsToCsv(habits: Habit[]): string {
  const header = ['Name', 'Emoji', 'Created', 'Days done', 'Last done'];
  const rows = habits.map((h) => {
    const last = [...h.doneDates].sort().at(-1) ?? '';
    return [h.name, h.emoji, h.createdAt.slice(0, 10), h.doneDates.length, last];
  });
  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\n');
}
```

Because `doneDates` are `'YYYY-MM-DD'` strings, a normal sort puts them in date order, so the last item is the most recent day.

For Riya's habits, the file looks like this:

```text
"Name","Emoji","Created","Days done","Last done"
"Drink water","💧","2026-10-01","21","2026-10-24"
"Read 10 pages","📚","2026-10-05","12","2026-10-23"
```

**3. Write and share.** The file goes into `Paths.cache`, because it is a temporary export that you can always make again. Then expo-sharing opens the share sheet, as you saw in [Haptics, Sharing and the Clipboard](/courses/react-native/haptics-sharing-and-clipboard):

```ts
const file = new File(Paths.cache, 'habithop-export.csv');
await file.write(habitsToCsv(habits));
await Sharing.shareAsync(file.uri, {
  mimeType: 'text/csv',
  UTI: 'public.comma-separated-values-text',
  dialogTitle: 'Export habits',
});
```

`mimeType` is used on Android (and helps iOS pick the file extension). `UTI` is Apple's name for a file type, and it helps iOS offer the right apps, like Numbers.

Call it from a Settings button:

```tsx
// src/app/(tabs)/settings.tsx (part)
import { Button } from 'react-native';
import { useHabits } from '@/context/HabitsContext';
import { exportHabitsCsv } from '@/lib/exportHabits';

export function ExportButton() {
  const { habits } = useHabits();
  return <Button title="Export as CSV" onPress={() => exportHabitsCsv(habits)} />;
}
```

What you will see: tap "Export as CSV" and the share sheet opens with `habithop-export.csv`. On iOS, choose "Save to Files" or Mail. On Android, choose Drive or Gmail. Open the file on a computer and you get a neat table.

## Common mistakes

**Using the old functions from the main import.** `FileSystem.writeAsStringAsync` from `'expo-file-system'` throws at runtime in SDK 58. Use `new File(...).write()`, or import the old function from `'expo-file-system/legacy'`.

**Writing into a folder that does not exist.** Create it first with `new Directory(...).create({ intermediates: true, idempotent: true })`.

**Deleting a file that is not there.** `file.delete()` throws an error if the file is missing. Check `file.exists` first.

**Keeping important files in the cache.** The system may clear `Paths.cache` at any time. Backups and user photos belong in `Paths.document`.

## Quick recap

- Import `File`, `Directory` and `Paths` from `'expo-file-system'`. The old function API lives in `'expo-file-system/legacy'`.
- `Paths.document` is for files to keep. `Paths.cache` is for files you can recreate.
- `new File(...)` only points at a path. `await file.write()` creates or replaces it, `await file.text()` reads it.
- `Directory` has `create({ idempotent: true })`, `list()` and `delete()`.
- `File.downloadFileAsync(url, destination)` saves a download straight to disk.
- To export, build the text, write it to a file and open it with `Sharing.shareAsync(file.uri, { mimeType })`.

<code id="code-content" class="language-typescript">
// src/lib/exportHabits.ts
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Habit } from '@/types/habit';
// Wrap a value in quotes and double any quotes inside it (CSV rule)
function cell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}
// Turn the habits into CSV text: one header row, then one row per habit
export function habitsToCsv(habits: Habit[]): string {
  const header = ['Name', 'Emoji', 'Created', 'Days done', 'Last done'];
  const rows = habits.map((h) =&gt; {
    const last = [...h.doneDates].sort().at(-1) ?? '';
    return [h.name, h.emoji, h.createdAt.slice(0, 10), h.doneDates.length, last];
  });
  return [header, ...rows].map((row) =&gt; row.map(cell).join(',')).join('\n');
}
// Write the CSV into the cache folder and open the share sheet
export async function exportHabitsCsv(habits: Habit[]): Promise&lt;boolean&gt; {
  if (!(await Sharing.isAvailableAsync())) return false;
  const file = new File(Paths.cache, 'habithop-export.csv');
  await file.write(habitsToCsv(habits)); // creates or replaces the file
  console.log(`Wrote ${file.size} bytes to ${file.uri}`);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Export habits',
  });
  return true;
}
</code></pre>
