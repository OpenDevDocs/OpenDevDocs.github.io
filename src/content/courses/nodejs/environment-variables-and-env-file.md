---
publishDate: 2026-10-25T09:05
title: Environment Variables and --env-file
slug: environment-variables-and-env-file
metadescription: Keep settings and secrets out of your code with process.env, load them from a .env file using node --env-file or process.loadEnvFile, and avoid common traps.
updateDate: 2026-10-25T09:05
author: ['bishal-biswas']
level: 1
tags: ['configuration', 'env', 'process']
course: nodejs
---

## What is an environment variable?

An **environment variable** is a named setting that lives outside your code and is handed to your program when it starts.

Think of a hotel key card. The door lock (your code) is the same in every room. The card (the environment) decides which room it opens. Change the card, not the lock.

You use environment variables for things that change between computers:

- the **port** a server listens on
- a **database address** that differs on your laptop and on the live server
- **secrets** such as API keys, which must never be written into your code

## Reading them: process.env

Node puts every environment variable into `process.env`, a plain object:

```javascript
// show-env.mjs
console.log(process.env.HOME);    // e.g. /home/asha (on Windows: USERPROFILE)
console.log(process.env.PATH);    // the folders your shell searches for programs
console.log(process.env.MISSING); // prints: undefined
```

A variable that is not set reads as `undefined`, just like a missing object property.

## Setting them from the terminal

On macOS and Linux, write the variable before the command. It only applies to that one run:

```bash
PORT=4000 node server.mjs
```

```javascript
// server.mjs
console.log(`Listening on port ${process.env.PORT}`); // prints: Listening on port 4000
```

In Windows PowerShell, set it first. It lasts until you close that terminal:

```powershell
$env:PORT = "4000"
node server.mjs
```

> **Note:** Environment variable names are usually written in `UPPER_SNAKE_CASE`, like `DATABASE_URL`.

## Every value is a string

This catches everyone at least once. Environment variables are always strings, even when they look like numbers or booleans.

```bash
PORT=3000 DEBUG=false node app.mjs
```

```javascript
// app.mjs
console.log(typeof process.env.PORT); // prints: string
if (process.env.DEBUG) {
  console.log('Debug is on'); // this runs! 'false' is a non-empty string
}
```

Convert values yourself:

```javascript
const port = Number(process.env.PORT ?? 3000);
const debug = process.env.DEBUG === 'true';
```

The `??` operator gives a default when the variable is `undefined`.

## .env files

Typing every setting on the command line gets tiring. Instead, you put them in a text file called **`.env`** (a "dotenv" file) in your project folder:

```text
# .env
PORT=3000
APP_NAME="Notes App"
GREETING='Hello there'
DEBUG=true
```

The rules are simple:

- One `NAME=value` per line.
- Lines starting with `#` are comments.
- Quotes around a value are optional. Use them when the value has spaces. They are removed when the file is read.

For years everyone used the `dotenv` npm package to load this file. Modern Node can do it by itself.

## Loading it with node --env-file

Pass `--env-file` **before** your script name:

```bash
node --env-file=.env app.mjs
```

```javascript
// app.mjs
console.log(process.env.PORT);     // prints: 3000
console.log(process.env.APP_NAME); // prints: Notes App
```

No import, no package. The variables are ready before your first line runs.

You can also put it in an npm script so nobody has to remember the flag:

```json
{
  "scripts": {
    "start": "node --env-file=.env app.mjs"
  }
}
```

### Several files

Pass the flag more than once. Later files win when a name appears twice:

```bash
node --env-file=.env --env-file=.env.local app.mjs
```

If `.env` says `PORT=3000` and `.env.local` says `PORT=4000`, you get `4000`. This lets each developer override shared settings without editing the shared file.

### Optional files

If the file does not exist, `--env-file` stops with an error:

```text
node: nope.env: not found
```

Use `--env-file-if-exists` for a file that might not be there, such as a personal `.env.local`:

```bash
node --env-file=.env --env-file-if-exists=.env.local app.mjs
```

### The terminal wins

A variable already set in your shell takes priority over the `.env` file:

```bash
PORT=5000 node --env-file=.env app.mjs
```

This prints `5000`, even though `.env` says `3000`. That is handy for a quick one-off change.

## Loading it from code: process.loadEnvFile

Sometimes you want to load the file from inside your script. `process.loadEnvFile()` does that:

```javascript
// app.mjs
process.loadEnvFile(); // reads ./.env from the current working directory

console.log(process.env.PORT); // prints: 3000
```

Pass a path to load a different file: `process.loadEnvFile('.env.local')`. If the file is missing, it throws an `ENOENT` error, so wrap it in `try/catch` when the file is optional.

### Parsing without loading: util.parseEnv

`util.parseEnv` reads dotenv text and returns an object, without touching `process.env`:

```javascript
import { parseEnv } from 'node:util';

const settings = parseEnv('NAME=Asha\nCITY="New Delhi"\n# a comment');
console.log(settings.NAME); // prints: Asha
console.log(settings.CITY); // prints: New Delhi
```

## Keeping secrets safe

Your `.env` file often holds passwords and API keys. **Never commit it to Git.** Add it to `.gitignore`:

```text
# .gitignore
.env
.env.local
```

Then commit a **`.env.example`** file with the same names but fake values, so teammates know what to fill in:

```text
# .env.example
PORT=3000
DATABASE_URL=postgres://user:password@localhost:5432/notes
API_KEY=your-key-here
```

> **Tip:** On a real server or hosting platform you usually set environment variables in its dashboard instead of uploading a `.env` file.

### NODE_ENV

Many tools check a variable called `NODE_ENV`. By convention it is `development` on your laptop and `production` on the live server. Node itself does not set it. You or your hosting platform do.

```javascript
const isProduction = process.env.NODE_ENV === 'production';
```

## Common mistakes

### Putting the flag after the script name

```bash
node app.mjs --env-file=.env
```

Anything after the script name is an argument for **your** script, not for Node. Nothing gets loaded. Put Node's flags first:

```bash
node --env-file=.env app.mjs
```

### Assigning undefined

```javascript
process.env.TOKEN = undefined;
console.log(process.env.TOKEN, typeof process.env.TOKEN); // prints: undefined string
```

Values are turned into strings, so this stores the text `'undefined'`. To remove a variable, use `delete process.env.TOKEN`.

### Forgetting a default

```javascript
const port = Number(process.env.PORT); // NaN if PORT is missing
```

Give a fallback, or stop with a clear error if the setting is required:

```javascript
const port = Number(process.env.PORT ?? 3000);

if (!process.env.API_KEY) {
  console.error('API_KEY is missing. Copy .env.example to .env and fill it in.');
  process.exitCode = 1;
}
```

## Quick recap

- Environment variables are settings handed to your program from outside, read with `process.env`.
- Every value is a string. Convert numbers and booleans yourself, and give defaults with `??`.
- Put local settings in a `.env` file and load it with `node --env-file=.env app.mjs` (flag before the script).
- Use `--env-file-if-exists` for optional files. Shell variables beat file values.
- `process.loadEnvFile()` loads a file from code, and `util.parseEnv()` parses text without loading it.
- Never commit `.env`. Commit a `.env.example` instead.

<code id="code-content" class="language-javascript">
// config.mjs
// Run: node config.mjs   or   PORT=8080 DEBUG=true node config.mjs
import { existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
// --- Load .env if there is one (shell variables still win)
if (existsSync('.env')) {
  process.loadEnvFile('.env');
  console.log('Loaded .env');
} else {
  console.log('No .env file found, using defaults');
}
// --- Every value is a string, so convert carefully
function readNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (Number.isNaN(value)) throw new Error(`${name} must be a number, got "${raw}"`);
  return value;
}
function readBoolean(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
}
// --- Build one tidy config object for the whole app
let config;
try {
  config = {
    port: readNumber('PORT', 3000),
    appName: process.env.APP_NAME ?? 'Notes App',
    debug: readBoolean('DEBUG', false),
    isProduction: process.env.NODE_ENV === 'production',
  };
  console.log(config);
} catch (error) {
  console.error('Config error:', error.message);
  process.exitCode = 1;
}
// --- Gotcha: 'false' is a non-empty string, so it is truthy
console.log("Boolean('false') is", Boolean('false'));
// --- parseEnv reads dotenv text without touching process.env
const sample = parseEnv('NAME=Asha\nCITY="New Delhi"\n# comments are ignored');
console.log('Parsed sample:', sample);
// --- Assigning undefined stores the string 'undefined'
process.env.TOKEN = undefined;
console.log('TOKEN is', typeof process.env.TOKEN, JSON.stringify(process.env.TOKEN));
delete process.env.TOKEN; // the right way to remove a variable
console.log('After delete:', process.env.TOKEN);
</code></pre>
