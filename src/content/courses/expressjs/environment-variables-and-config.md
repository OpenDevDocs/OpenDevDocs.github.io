---
publishDate: 2026-10-25T09:16
title: Environment Variables and Configuration
slug: environment-variables-and-config
metadescription: Learn to configure an Express 5 app with environment variables and .env files, build a safe config module, use NODE_ENV correctly and change Express app settings.
updateDate: 2026-10-25T09:16
author: ['bishal-biswas']
level: 1
tags: ['express', 'configuration', 'environment-variables', 'nodejs']
course: expressjs
---

## What you will learn

- What **environment variables** are and why apps use them for settings and secrets
- How to read them with `process.env` and set them in the terminal
- How to load a `.env` file with Node's built-in `--env-file` flag
- How to build one small **config module** that checks your settings at startup
- What `NODE_ENV` changes in Express, and how to use Express app settings with `app.set()`

## The problem: settings that change

So far, your apps have looked like this:

```js
app.listen(3000);
```

The port `3000` is **hard-coded**: written directly into the code. That is fine on your laptop. But in production, the hosting company may tell you to use port `8080`. Your database address is different on your laptop and on the server. And you will soon have **secrets** like database passwords and API keys.

You do not want to edit code every time you move the app. And you must never commit passwords to Git, where anyone with access to the repository can read them.

**Think of a hotel room.** The room (your code) is the same for every guest. But each guest gets their own key card and settings (the environment). You do not rebuild the room for each guest. You hand over different settings at check-in.

## What is an environment variable?

An **environment variable** is a named value that lives outside your code, in the **environment** of the running program. The operating system, your terminal, a Docker container or a hosting platform can all provide them.

In Node.js, you read them from the object `process.env`:

```js
// show-env.js
console.log(process.env.PORT);
console.log(process.env.HOME ?? process.env.USERPROFILE); // your home folder
```

Two important facts:

1. **Every value is a string**, or `undefined` if it is not set. `PORT=3000` gives you the string `'3000'`, not the number `3000`.
2. Names are usually written in `UPPER_SNAKE_CASE`, like `DATABASE_URL`.

## Setting variables in the terminal

You can set a variable for a single run of your app. The syntax depends on your terminal.

macOS, Linux, or Git Bash on Windows:

```bash
PORT=4000 node app.js
```

Windows PowerShell:

```powershell
$env:PORT = '4000'
node app.js
```

Now use it in your app, with a fallback for when it is not set:

```js
// app.js
import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.get('/', (req, res) => {
  res.send(`Running on port ${port}`);
});

app.listen(port, (error) => {
  if (error) throw error;
  console.log(`Listening on http://localhost:${port}`);
});
```

Run it with and without the variable and watch the port change. The code did not change at all.

> **Tip:** `??` is the **nullish coalescing** operator. `a ?? b` means "use `a`, unless it is `null` or `undefined`, then use `b`". It is perfect for defaults.

## `.env` files: all your variables in one place

Typing every variable in the terminal gets tedious. The common solution is a **`.env` file**: a plain text file in your project folder with one `NAME=value` per line.

```bash
# .env  (never commit this file)
PORT=3000
NODE_ENV=development
DATABASE_URL=postgres://localhost:5432/shop_dev
API_KEY=change-me
```

Lines starting with `#` are comments.

### Loading `.env` with Node's built-in flag

Modern Node.js can read a `.env` file for you with the `--env-file` flag. This needs **Node.js 20.6 or newer**.

```bash
node --env-file=.env app.js
```

Every line in `.env` becomes a `process.env` variable before your code runs. Combine it with watch mode from [The Dev Loop](/courses/expressjs/dev-workflow-and-watch-mode):

```json
{
  "name": "my-shop",
  "type": "module",
  "scripts": {
    "dev": "node --watch --env-file=.env app.js",
    "start": "node app.js"
  },
  "dependencies": {
    "express": "^5.1.0"
  }
}
```

Notice that `start` does **not** load `.env`. In production, the hosting platform sets real environment variables, and no `.env` file exists on the server.

> **Note:** If a variable is already set in the terminal, it wins over the value in `.env`. This lets you override one setting quickly without editing the file.

### The `dotenv` package

Before Node had `--env-file`, everyone used a package called `dotenv`. You will see it in many tutorials and projects:

```bash
npm install dotenv
```

```js
// app.js (first line)
import 'dotenv/config'; // loads .env into process.env
```

Both approaches work. This course uses the built-in flag, so there is one less dependency.

### Keep `.env` out of Git

Add `.env` to your `.gitignore` file right away, before your first commit:

```text
# .gitignore
node_modules/
.env
```

Then create a **`.env.example`** file that you *do* commit. It lists every variable the app needs, with fake values, so teammates know what to set up:

```bash
# .env.example  (safe to commit: no real secrets)
PORT=3000
NODE_ENV=development
DATABASE_URL=postgres://localhost:5432/shop_dev
API_KEY=change-me
```

> **Warning:** If you ever commit a real secret by accident, deleting the file in a new commit is not enough. It stays in the Git history. Treat the secret as leaked: change the password or create a new key straight away.

## A config module: one place for all settings

Reading `process.env` all over your code causes problems. One file uses `process.env.PORT`, another uses `process.env.port` (a typo, always `undefined`). Numbers are left as strings. Missing values cause strange errors deep inside your app, long after startup.

A better pattern is a single **config module**: a file that reads every variable once, converts it to the right type, checks required values, and exports a clean object.

```js
// config.js
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function toNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;

  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`${name} must be a number, got "${raw}"`);
  }
  return value;
}

export const config = Object.freeze({
  env: process.env.NODE_ENV ?? 'development',
  port: toNumber('PORT', 3000),
  databaseUrl: required('DATABASE_URL'),
  apiKey: required('API_KEY'),
  enableSignup: process.env.ENABLE_SIGNUP === 'true',
});
```

`Object.freeze()` makes the object read-only, so no other file can change a setting by accident.

Now the rest of your app imports `config` instead of touching `process.env`:

```js
// app.js
import express from 'express';
import { config } from './config.js';

const app = express();

app.get('/status', (req, res) => {
  res.json({ env: config.env, signupOpen: config.enableSignup });
});

app.listen(config.port, (error) => {
  if (error) throw error;
  console.log(`[${config.env}] Listening on http://localhost:${config.port}`);
});
```

If `DATABASE_URL` is missing, the app stops immediately with a clear message:

```text
Error: Missing required environment variable: DATABASE_URL
```

Stopping right away is called **failing fast**. It is much better than starting up and crashing an hour later when the first user tries to log in.

> **Common mistake:** Writing `if (process.env.ENABLE_SIGNUP)` to check a true/false flag. The string `'false'` is not empty, so it counts as true. Compare against the exact string: `process.env.ENABLE_SIGNUP === 'true'`.

Later you will learn to check config with a validation library in [Request Validation with Zod](/courses/expressjs/request-validation-with-zod). The same tool works for environment variables.

## `NODE_ENV`: development or production?

`NODE_ENV` is a special variable that almost every Node tool reads. By convention its value is `development`, `production` or `test`.

Express reads it too. You can get the current value with `app.get('env')`. If `NODE_ENV` is not set, Express assumes `'development'`.

```js
console.log(app.get('env')); // 'development' unless NODE_ENV says otherwise
```

When `NODE_ENV=production`, Express changes some behaviour:

| Behaviour | development | production |
| --- | --- | --- |
| Default error page | Shows the full error and **stack trace** | Shows only the status message |
| Template caching | Templates re-read on each request | Templates cached in memory |

A **stack trace** is the list of files and line numbers that led to an error. It is great for you while debugging, but it reveals details about your code to strangers. That is why production hides it.

> **Warning:** Always set `NODE_ENV=production` on your real server. Forgetting it is a common reason for leaking stack traces to the public. Many npm packages also run faster in production mode.

Use `NODE_ENV` in your own code sparingly. Prefer specific settings (like `ENABLE_SIGNUP` or `LOG_LEVEL`) over lots of `if (env === 'production')` checks. Specific settings are easier to test and change one at a time.

## Express app settings: `app.set()` and `app.get()`

Environment variables configure *your* app. Express also has its own built-in **app settings**: switches that change how Express itself behaves. You set them with `app.set(name, value)` and read them with `app.get(name)`.

> **Note:** `app.get('env')` with one argument reads a setting. `app.get('/path', handler)` with a path and a function defines a route. Same method name, two jobs.

You have already met a few. Here are the most useful:

| Setting | Example | What it does |
| --- | --- | --- |
| `env` | `app.get('env')` | The current environment, from `NODE_ENV` |
| `x-powered-by` | `app.disable('x-powered-by')` | Removes the `X-Powered-By: Express` header |
| `json spaces` | `app.set('json spaces', 2)` | Pretty-prints JSON responses |
| `query parser` | `app.set('query parser', 'extended')` | How `req.query` is parsed |
| `trust proxy` | `app.set('trust proxy', 1)` | Trust one reverse proxy for `req.ip` and `req.protocol` |
| `view engine` | `app.set('view engine', 'ejs')` | Which template engine renders HTML |

`app.enable(name)` is a shortcut for `app.set(name, true)`, and `app.disable(name)` for `app.set(name, false)`.

You can combine both kinds of configuration:

```js
// app.js
import express from 'express';
import { config } from './config.js';

const app = express();

app.disable('x-powered-by');

if (config.env === 'development') {
  app.set('json spaces', 2); // readable JSON while developing
}

if (config.env === 'production') {
  app.set('trust proxy', 1); // our host puts one proxy in front of us
}
```

The `trust proxy` setting is explained fully in [Reverse Proxies and Trusting Proxy Headers](/courses/expressjs/reverse-proxies-and-trust-proxy), and `view engine` in [Template Engines](/courses/expressjs/template-engines).

You can also store your own values with `app.set('appName', 'My Shop')`, but a config module is usually clearer.

## Where environment variables come from in production

On your laptop, `.env` provides them. In production, other tools do:

| Where your app runs | How you set variables |
| --- | --- |
| A Linux server with a process manager | The service file or the process manager's config |
| Docker | `-e NAME=value`, an `--env-file`, or the `environment:` section in Compose |
| Platforms like Render, Railway or Heroku | A settings page in the dashboard |
| GitHub Actions (CI) | Repository **secrets** |

Your code does not care which one is used. It always reads `process.env`. That is the beauty of the approach. You will set these up in [Dockerising an Express API](/courses/expressjs/dockerising-an-express-api) and [CI/CD Pipelines for Node APIs](/courses/expressjs/ci-cd-for-node-apis).

## Common mistakes

**Forgetting that values are strings.** `process.env.PORT + 1` gives `'30001'`, not `3001`. Convert with `Number()`.

**Committing `.env`.** Add it to `.gitignore` before your first commit. Commit `.env.example` instead.

**Reading `process.env` everywhere.** Read it once, in `config.js`, and import the result.

**Running without `--env-file`.** If your variables are all `undefined`, check that your `npm run dev` script includes `--env-file=.env` and that the file is in the folder you run Node from.

**Forgetting `NODE_ENV=production` on the server.** Error pages will show stack traces to visitors.

## Key takeaways

- Environment variables keep settings and secrets out of your code. Read them with `process.env`. Every value is a string.
- Use a `.env` file in development and load it with `node --env-file=.env` (Node.js 20.6+) or the `dotenv` package.
- Never commit `.env`. Commit a `.env.example` with fake values.
- Put all settings in one `config.js` module that converts types and fails fast on missing values.
- Set `NODE_ENV=production` in production. Express then hides stack traces and caches templates.
- `app.set()`, `app.enable()` and `app.disable()` control Express's own settings.

## Practice

1. Create a `.env` file with `PORT=4000` and a `GREETING` variable. Add an npm `dev` script that uses `--env-file`, and make `GET /` return the greeting.
2. Build the `config.js` module from this lesson. Remove `API_KEY` from `.env` and confirm the app refuses to start with a clear message.
3. Add an `ENABLE_SIGNUP` flag. Set it to `false` and prove your code treats it as off.
4. Throw an error in a route on purpose. Compare the error page with `NODE_ENV=development` and `NODE_ENV=production`.

## What's next

You have been using `app.use()` for parsers, static files and settings. Now it is time to understand what it really does in [How the Middleware Stack Works](/courses/expressjs/how-middleware-works).
