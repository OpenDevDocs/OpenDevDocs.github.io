---
publishDate: 2026-10-24T02:00
title: A Real Database on the Phone with SQLite
slug: sqlite-database
metadescription: 'Store HabitHop habits and daily check-ins in a real SQLite database with expo-sqlite: SQLiteProvider, migrations, queries and safe parameters.'
updateDate: 2026-10-24T02:00
author: ['bishal-biswas']
level: 3
tags: ['react-native', 'expo-sqlite', 'database', 'sql']
course: react-native
---

## When AsyncStorage is not enough

In [Saving Data on the Phone with AsyncStorage](/courses/react-native/async-storage) you saved all habits as one big JSON string. That is simple, and for a few habits it is fine. But think about HabitHop after a year: 10 habits, each ticked about 300 times. Every tick rewrites the **whole** list. Every question like "how many days did Mia drink water in March?" means loading and scanning **everything**.

A **database** solves this. It stores data in **tables** (like spreadsheets: rows and columns), it can change one row without touching the others, and it answers questions with a query language called **SQL**.

**SQLite** is a small database engine that runs inside your app, as a single file on the phone. No server, no internet. It is built into both iOS and Android, and it is probably the most used database in the world. The **expo-sqlite** library lets you use it from JavaScript.

In this lesson you will build `src/lib/db.ts`: a `habits` table, a `habit_checks` table for the days a habit was done, a migration that creates them, and functions to read and write. Then you will plug it into `HabitsProvider`.

You will see some SQL. If SQL is new, the [Node.js SQLite lesson](/courses/nodejs/node-sqlite) introduces the same commands. The ones here are short and explained.

## Install it

```bash
npx expo install expo-sqlite
```

expo-sqlite is included in Expo Go, so no development build is needed. The install also adds `"expo-sqlite"` to `plugins` in `app.json`. This lesson targets iOS and Android. expo-sqlite also has web support, but it needs extra setup, so we skip it here.

## Design the tables

Our `Habit` type has a `doneDates: string[]` array. Databases do not store arrays well. Instead, we split the data into two tables:

```text
habits                                   habit_checks
+----+--------------+-------+-----+      +----------+------------+
| id | name         | emoji | ... |      | habit_id | date       |
+----+--------------+-------+-----+      +----------+------------+
| h1 | Drink water  | 💧    |     |      | h1       | 2026-10-22 |
| h2 | Read 10 pages| 📚    |     |      | h1       | 2026-10-23 |
+----+--------------+-------+-----+      | h2       | 2026-10-23 |
                                         +----------+------------+
```

Each row in `habit_checks` means "habit X was done on day Y". Ticking a habit adds one small row. Unticking deletes one row. Nothing else changes. This is called a **one-to-many** relationship: one habit has many checks.

## Open the database with SQLiteProvider

expo-sqlite gives you a **SQLiteProvider** component. It opens (or creates) a database file and shares it with every component inside it, a bit like the context providers you already know. Put it in the root layout, **outside** `HabitsProvider`, because the habits provider will need the database:

```tsx
// src/app/_layout.tsx
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { HabitsProvider } from '@/context/HabitsContext';
import { migrateDbIfNeeded } from '@/lib/db';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="habithop.db" onInit={migrateDbIfNeeded}>
      <HabitsProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </HabitsProvider>
    </SQLiteProvider>
  );
}
```

- `databaseName` is the file name. The first time, SQLite creates an empty file with that name in your app's private folder.
- `onInit` is an async function that gets the open database and runs **before** any children render. It is the perfect place to create tables.

Inside any child component, `useSQLiteContext()` returns the open database. If you prefer to open a database outside React, there is also `openDatabaseAsync('habithop.db')`, which returns the same kind of object.

## Create tables with a migration

A **migration** is a step that changes the database structure, like "create the habits table". Apps need migrations because the database lives on the user's phone. When you ship version 2 of your app with a new column, you cannot delete everyone's data. You must change their existing database, step by step.

SQLite has a free number slot for this, called `user_version`, which starts at `0`. We read it, run the steps that are missing, and save the new number. Start with the first part of `src/lib/db.ts`:

```ts
// src/lib/db.ts (migration)
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Habit } from '@/types/habit';

const DATABASE_VERSION = 1;

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion >= DATABASE_VERSION) return;

  if (currentVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        emoji TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS habit_checks (
        habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        PRIMARY KEY (habit_id, date)
      );
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
```

Let's read it slowly:

- **`PRAGMA`** commands are SQLite settings. `foreign_keys = ON` turns on the link checks between tables. SQLite forgets this setting each time the database is opened, so we set it every time, before the version check.
- **`journal_mode = WAL`** switches on "write-ahead logging", a faster and safer way of writing. You only need to set it once, because SQLite remembers it in the file.
- **`PRIMARY KEY`** means "this column is unique and identifies the row". In `habit_checks`, the pair `(habit_id, date)` is the key, so the same habit cannot be ticked twice on the same day.
- **`REFERENCES habits(id) ON DELETE CASCADE`** links each check to a habit. When a habit is deleted, SQLite deletes its checks automatically.
- **`execAsync`** runs one or more SQL statements and returns nothing. Use it for setup, not for user data.

Later, when you add a column, you write `if (currentVersion === 1) { ... ALTER TABLE ... }` and bump `DATABASE_VERSION` to `2`. Old users run the new step once, new users run both.

## Reading rows

expo-sqlite has three ways to read:

```text
getFirstAsync<T>(sql, ...params)   the first row, or null
getAllAsync<T>(sql, ...params)     every row as an array
getEachAsync<T>(sql, ...params)    rows one by one (for huge results)
```

The `<T>` is the TypeScript type of one row. Like with API data, it is a promise you make: SQLite returns whatever the query selects.

To build `Habit` objects, we join the two tables and glue each habit's dates into one string with `GROUP_CONCAT`:

```ts
// src/lib/db.ts (reading)
type HabitRow = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  created_at: string;
  done_dates: string | null; // '2026-10-23,2026-10-24' or null
};

export async function getHabits(db: SQLiteDatabase): Promise<Habit[]> {
  const rows = await db.getAllAsync<HabitRow>(`
    SELECT h.id, h.name, h.emoji, h.color, h.created_at,
           GROUP_CONCAT(c.date) AS done_dates
    FROM habits h
    LEFT JOIN habit_checks c ON c.habit_id = h.id
    GROUP BY h.id
    ORDER BY h.created_at
  `);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    color: r.color,
    createdAt: r.created_at,
    doneDates: r.done_dates ? r.done_dates.split(',') : [],
  }));
}
```

`LEFT JOIN` keeps habits that have no checks yet (their `done_dates` is `null`). The column names in SQL use `snake_case`, which is the usual database style, so we map them to the `camelCase` names of our `Habit` type. The rest of the app never sees the difference.

## Writing rows safely

For inserts, updates and deletes, use `runAsync`. It returns `{ lastInsertRowId, changes }`, where `changes` is the number of rows affected.

```ts
// src/lib/db.ts (writing)
export async function insertHabit(db: SQLiteDatabase, habit: Habit) {
  await db.runAsync(
    'INSERT INTO habits (id, name, emoji, color, created_at) VALUES (?, ?, ?, ?, ?)',
    habit.id, habit.name, habit.emoji, habit.color, habit.createdAt,
  );
}

export async function toggleCheck(db: SQLiteDatabase, habitId: string, date: string) {
  const removed = await db.runAsync('DELETE FROM habit_checks WHERE habit_id = ? AND date = ?', habitId, date);
  if (removed.changes === 0) {
    await db.runAsync('INSERT INTO habit_checks (habit_id, date) VALUES (?, ?)', habitId, date);
  }
}

export async function removeHabit(db: SQLiteDatabase, habitId: string) {
  await db.runAsync('DELETE FROM habits WHERE id = ?', habitId);
}
```

The **`?` placeholders** are very important. SQLite fills them with the values you pass after the SQL, in order, and it treats them strictly as data. Never build SQL by joining strings:

```diff
- await db.execAsync(`INSERT INTO habits (name) VALUES ('${name}')`);
+ await db.runAsync('INSERT INTO habits (name) VALUES (?)', name);
```

With the first line, a habit named `Mia's run` breaks the SQL (the `'` ends the string early), and a carefully crafted name could even run extra SQL. This attack is called **SQL injection**. Placeholders make it impossible.

`toggleCheck` is a neat trick: try to delete today's check. If nothing was deleted (`changes === 0`), the habit was not done yet, so insert it.

## Putting it together in HabitHop

Now swap the storage inside `HabitsProvider`. The functions keep the same names, so screens like Today and [habit details](/courses/react-native/dynamic-routes) do not change at all. The difference: each action writes to the database first, then reloads the list.

```tsx
// src/context/HabitsContext.tsx (SQLite version, main part)
import { useSQLiteContext } from 'expo-sqlite';
import { getHabits, insertHabit, removeHabit, toggleCheck } from '@/lib/db';

export function HabitsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [habits, dispatch] = useReducer(habitsReducer, []);
  const [isLoaded, setIsLoaded] = useState(false);

  async function refresh() {
    dispatch({ type: 'loaded', habits: await getHabits(db) });
    setIsLoaded(true);
  }

  useEffect(() => {
    getHabits(db).then((rows) => {
      dispatch({ type: 'loaded', habits: rows });
      setIsLoaded(true);
    });
  }, [db]);

  async function addHabit(input: NewHabit) {
    const habit: Habit = { ...input, id: Date.now().toString(), createdAt: new Date().toISOString(), doneDates: [] };
    await insertHabit(db, habit);
    await refresh();
  }

  async function toggleToday(id: string) {
    await toggleCheck(db, id, todayKey());
    await refresh();
  }

  async function deleteHabit(id: string) {
    await removeHabit(db, id);
    await refresh();
  }

  // ...same Provider and useHabits() as before
}
```

The reducer stays, but now the database is the boss: after each write, the `'loaded'` action from the AsyncStorage lesson replaces the list with fresh rows. The actions are now `async`, so change their types in `HabitsContextValue` to return `Promise<void>`. The second "save" effect from the AsyncStorage version is gone: the database **is** the saved copy.

Reloading the whole list after each change is simple and, for a few hundred rows, takes a few milliseconds. If your lists get much bigger, you can dispatch the matching action (`'added'`, `'toggled_today'` and so on) instead of reloading, and only write the one row to the database.

### Moving old data over

Users who had the AsyncStorage version still have their habits there. You can copy them into SQLite once with a **transaction**, a group of statements that either all succeed or all fail together:

```ts
// copy old AsyncStorage habits into SQLite in one go
await db.withTransactionAsync(async () => {
  for (const habit of oldHabits) {
    await insertHabit(db, habit);
    for (const date of habit.doneDates) {
      await db.runAsync('INSERT OR IGNORE INTO habit_checks (habit_id, date) VALUES (?, ?)', habit.id, date);
    }
  }
});
```

Run it inside your migration (with `const oldHabits = (await loadHabits()) ?? [];`, since `loadHabits` returns `null` when nothing was saved), then call `clearHabits()`. Transactions are also much faster when inserting many rows, because SQLite writes to disk once at the end instead of after every row.

**What you will see:** the app looks exactly the same as before, which is the point. Add habits, tick them, restart the app, and everything is still there. Behind the scenes, ticking a habit now writes one tiny row instead of the whole list.

## Common mistakes

**`no such table: habits`.** Your query ran before the tables were created. Make sure you pass the migration to `onInit` on `SQLiteProvider`, and that you read through `useSQLiteContext()` inside the provider. If you changed the migration after the first run, remember that `user_version` is already `1` on your device, so the new code is skipped. Bump the version, or delete the app from the simulator to start fresh while developing.

**`UNIQUE constraint failed: habit_checks.habit_id, habit_checks.date`.** You inserted the same habit and day twice. That is the primary key doing its job. Use the delete-then-insert toggle above, or `INSERT OR IGNORE`.

**Deleting a habit leaves its checks behind.** Foreign keys are off by default in SQLite. If you forget `PRAGMA foreign_keys = ON` on each open, `ON DELETE CASCADE` silently does nothing.

**Using `execAsync` with user input.** `execAsync` does not support `?` placeholders. Use it only for fixed SQL like migrations, and `runAsync`, `getAllAsync` or `getFirstAsync` for anything with values.

## Quick recap

- SQLite is a real database stored as one file on the phone. Install `expo-sqlite`; it works in Expo Go.
- Wrap your app in `<SQLiteProvider databaseName="habithop.db" onInit={migrateDbIfNeeded}>` and get the database with `useSQLiteContext()`.
- Use `PRAGMA user_version` to run migrations step by step, and turn on `PRAGMA foreign_keys` every time you open the database.
- Split arrays into their own table: `habits` and `habit_checks` with `(habit_id, date)` as the primary key.
- Read with `getAllAsync` / `getFirstAsync`, write with `runAsync`, set up with `execAsync`. Always use `?` placeholders for values.
- Use `withTransactionAsync` to group many writes into one fast, all-or-nothing step.

Your habits now live safely on the device. Next, in [Offline Support and Network Status](/courses/react-native/offline-and-network-status), you will make the parts that need the internet behave well when there is none.

<code id="code-content" class="language-typescript">
// src/lib/db.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Habit } from '@/types/habit';
const DATABASE_VERSION = 1;
// Runs once every time the app opens the database (passed to SQLiteProvider onInit)
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON;'); // needed on every connection
  const row = await db.getFirstAsync&lt;{ user_version: number }&gt;('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion &gt;= DATABASE_VERSION) return;
  if (currentVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        emoji TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS habit_checks (
        habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        PRIMARY KEY (habit_id, date)
      );
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
// --- reading
type HabitRow = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  created_at: string;
  done_dates: string | null; // '2026-10-23,2026-10-24' or null
};
export async function getHabits(db: SQLiteDatabase): Promise&lt;Habit[]&gt; {
  const rows = await db.getAllAsync&lt;HabitRow&gt;(`
    SELECT h.id, h.name, h.emoji, h.color, h.created_at,
           GROUP_CONCAT(c.date) AS done_dates
    FROM habits h
    LEFT JOIN habit_checks c ON c.habit_id = h.id
    GROUP BY h.id
    ORDER BY h.created_at
  `);
  return rows.map((r) =&gt; ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    color: r.color,
    createdAt: r.created_at,
    doneDates: r.done_dates ? r.done_dates.split(',') : [],
  }));
}
// --- writing (always use ? placeholders, never string concatenation)
export async function insertHabit(db: SQLiteDatabase, habit: Habit) {
  await db.runAsync(
    'INSERT INTO habits (id, name, emoji, color, created_at) VALUES (?, ?, ?, ?, ?)',
    habit.id, habit.name, habit.emoji, habit.color, habit.createdAt,
  );
}
export async function toggleCheck(db: SQLiteDatabase, habitId: string, date: string) {
  const removed = await db.runAsync('DELETE FROM habit_checks WHERE habit_id = ? AND date = ?', habitId, date);
  if (removed.changes === 0) {
    await db.runAsync('INSERT INTO habit_checks (habit_id, date) VALUES (?, ?)', habitId, date);
  }
}
export async function removeHabit(db: SQLiteDatabase, habitId: string) {
  await db.runAsync('DELETE FROM habits WHERE id = ?', habitId); // checks go too (ON DELETE CASCADE)
}
</code></pre>
