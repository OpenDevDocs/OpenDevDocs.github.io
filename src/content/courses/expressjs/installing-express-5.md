---
publishDate: 2026-10-25T09:03
title: Installing Express 5 and Project Setup
slug: installing-express-5
metadescription: Create a new Node.js project, install Express 5 with npm, confirm the installed version, and set up a clean folder structure, package.json scripts and .gitignore.
updateDate: 2026-10-25T09:03
author: ['bishal-biswas']
level: 1
tags: ['express', 'npm', 'setup', 'beginners']
course: expressjs
---

## What you will learn

- How to create a new project folder and `package.json` for an Express app
- How to install **Express 5** and check that you really got version 5
- How to set up `"type": "module"`, npm scripts and a `.gitignore` file
- A simple folder structure that will grow with you through the course
- How to fix the most common setup errors

In the last lesson you installed Node.js and npm. Now you will turn an empty folder into a ready-to-code Express 5 project. By the end you will have a tiny server running, as a quick check that everything works.

## Step 1: Create the project folder

Every project lives in its own folder. Open a terminal and run:

```bash
mkdir my-express-app
cd my-express-app
```

`mkdir` makes the folder and `cd` moves your terminal into it. From now on, every command in this lesson runs **inside** `my-express-app`.

> **Tip:** Open this folder in your code editor too. In VS Code use **File > Open Folder**, or type `code .` in the terminal (the `.` means "the current folder").

## Step 2: Create package.json

```bash
npm init -y
```

This creates `package.json`, the ID card of your project. The `-y` flag accepts all the default answers so you don't have to type them.

## Step 3: Switch on ES modules

This course writes code with `import` and `export`, the modern JavaScript module syntax called **ES modules** (ESM). Node.js needs to be told to use it. The quickest way is this npm command:

```bash
npm pkg set type=module
```

`npm pkg set` edits `package.json` for you. It adds (or changes) this line:

```json
{
  "type": "module"
}
```

You could also open `package.json` and type the line yourself. Both ways give the same result. The [ES Modules vs CommonJS](/courses/expressjs/esm-vs-commonjs) lesson explains the older `require()` style and why this line matters.

## Step 4: Install Express

Here is the main event:

```bash
npm install express
```

npm downloads Express and everything Express itself depends on into `node_modules`. It also adds Express to `package.json`:

```json
{
  "dependencies": {
    "express": "^5.1.0"
  }
}
```

Your number may be higher than the one shown here. What matters is that it starts with **5**. Express 5 has been the default ("latest") version on npm since 2025, so a plain `npm install express` gives you Express 5.

### Check the installed version

The number in `package.json` is a *range* (`^5.1.0` means "5.1.0 or any newer 5.x"). To see the exact version that is installed, ask npm:

```bash
npm ls express
```

```text
my-express-app@1.0.0 /Users/asha/my-express-app
└── express@5.1.0
```

> **Warning:** If you see `express@4.x.x`, you are not on Express 5. This usually happens when you copy an old `package.json` that pins `"express": "^4.x"`. Fix it with `npm install express@5`. Many older tutorials online use Express 4, and a few of their patterns no longer work in Express 5.

## Step 5: Look at what you have

Your folder now looks like this:

```text
my-express-app/
├── node_modules/        downloaded packages (do not edit, do not commit)
├── package.json         project info, dependencies, scripts
└── package-lock.json    exact installed versions (commit this)
```

Open `node_modules` and you will find many folders, not just `express`. Express is built from smaller packages (for routing, cookies, body parsing and so on), and npm installs all of them. This is normal.

## Step 6: Add a .gitignore file

**Git** is a tool that tracks changes to your code. Even if you don't use Git yet, add this file now so you never accidentally share huge or secret files later. Create a file named `.gitignore` (the name starts with a dot):

```text
# .gitignore
node_modules/
.env
*.log
```

Each line is a pattern Git should ignore:

- `node_modules/` can always be rebuilt with `npm install`.
- `.env` will hold secrets such as passwords. You will create it in [Environment Variables and Configuration](/courses/expressjs/environment-variables-and-config).
- `*.log` ignores any log files.

## Step 7: Add npm scripts

Open `package.json` and replace the `"scripts"` section so it looks like this:

```json
{
  "name": "my-express-app",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^5.1.0"
  }
}
```

- `npm start` runs the server normally. Hosting providers often use this exact command.
- `npm run dev` runs it in **watch mode**: Node.js restarts the server whenever you save a file. This needs Node.js 18.11 or newer, and you will learn all about it in [The Dev Loop: node --watch and Nodemon](/courses/expressjs/dev-workflow-and-watch-mode).

> **Note:** Your `package.json` may have extra fields such as `"description"`, `"keywords"` or `"author"`. Leave them; they don't affect anything here.

## Step 8: A quick smoke test

A **smoke test** is a tiny check that something basically works, before you build on it. Create `server.js` next to `package.json`:

```js
// server.js
import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.send('Express 5 is installed and working!');
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

Start it:

```bash
npm start
```

```text
> my-express-app@1.0.0 start
> node server.js

Server running on http://localhost:3000
```

Now open `http://localhost:3000` in your browser. You should see the message. You can also test from a **second** terminal window (the first one is busy running the server):

```bash
curl http://localhost:3000
```

```text
Express 5 is installed and working!
```

Press `Ctrl + C` in the server's terminal to stop it. Don't worry about understanding every line yet; the next lesson explains this file piece by piece.

> **Note:** On Windows PowerShell, type `curl.exe` instead of `curl`. Plain `curl` there runs a different built-in command.

## A folder structure that will grow with you

Right now one file is enough. As the course goes on, you will split code into folders. Here is where you are heading, so the names won't surprise you later:

```text
my-express-app/
├── src/
│   ├── app.js           creates and configures the Express app
│   ├── routes/          one file per group of URLs (users, posts...)
│   ├── middleware/      reusable request helpers
│   └── controllers/     the logic for each route
├── public/              images, CSS and other static files
├── server.js            starts the server (calls app.listen)
├── .env                 secrets and settings (never committed)
├── .gitignore
└── package.json
```

You do **not** need to create all of this now. Create folders when a lesson asks for them. Keeping `app.js` (the app) separate from `server.js` (the part that listens on a port) is a habit you will start in the next lesson; it makes testing much easier later.

## Adding Express to an existing project

Already have a Node.js project? You only need two steps inside its folder:

```bash
npm install express
npm ls express
```

If the project was on Express 4, `npm install express@5` upgrades it. Upgrading old code is covered in detail in [Migrating from Express 4 to Express 5](/courses/expressjs/migrating-from-express-4-to-5).

## Common mistakes

> **Common mistake:** `SyntaxError: Cannot use import statement outside a module`. Node.js is treating your file as the older CommonJS style. Make sure `package.json` contains `"type": "module"` and that you are running the file from the project folder.

> **Common mistake:** `Error: Cannot find module 'express'`. Express is not installed in **this** folder. Check you are in the right folder with `pwd`, then run `npm install express`.

> **Common mistake:** `npm error enoent Could not read package.json`. You ran `npm start` (or another npm script) outside your project folder. `cd` into the folder that contains `package.json` and try again.

> **Common mistake:** Naming your own file `express.js`. It can confuse you and your tools about which "express" you mean. Use `server.js` or `app.js`.

## Common beginner questions

**Do I need to install Express globally?**
No. Express is a library your code imports, so it must be installed in each project with plain `npm install express`.

**Can I delete node_modules?**
Yes, any time. Run `npm install` to get it back exactly as before, thanks to `package-lock.json`.

**What about the `express-generator` tool I see in tutorials?**
It creates a starter project for you, but it is old and its output does not match how this course writes code. Building the project by hand, as you just did, teaches you what every file is for.

## Key takeaways

- A new project is three commands: `mkdir`, `npm init -y`, and `npm install express`.
- `npm pkg set type=module` lets you use `import` and `export` in your files.
- `npm ls express` shows the exact installed version. It should start with **5**.
- Add a `.gitignore` with `node_modules/` and `.env` from day one.
- `"start"` and `"dev"` npm scripts give you short, standard commands for running the server.

## Practice

1. Create a second project called `practice-app` from scratch, without looking at this lesson. Check the Express version with `npm ls express`.
2. Change the message in `server.js`, stop the server with `Ctrl + C`, start it again, and confirm the new message appears with `curl`.
3. Try `npm run dev`, change the message again and save. Watch the terminal: what happens?
4. Delete `node_modules`, run `npm start`, and read the error. Then fix it with `npm install`.

## What's next

You have a working project. Now let's understand exactly what each line of that server does. Continue with [Your First Server and app.listen](/courses/expressjs/your-first-express-server).
