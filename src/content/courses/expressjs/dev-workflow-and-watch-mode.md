---
publishDate: 2026-10-25T09:06
title: 'The Dev Loop: node --watch and Nodemon'
slug: dev-workflow-and-watch-mode
metadescription: Stop restarting your server by hand. Learn node --watch and Nodemon, set up npm dev scripts, and build a comfortable edit, save and test loop for Express apps.
updateDate: 2026-10-25T09:06
author: ['bishal-biswas']
level: 1
tags: ['express', 'nodejs', 'nodemon', 'developer-tools']
course: expressjs
---

## What you will learn

- What a **dev loop** is and why a fast one makes learning easier
- How to restart your server automatically with Node's built-in `node --watch`
- How to use **Nodemon**, the popular alternative, and when you might want it
- How to set up `npm run dev` and `npm start` scripts
- A comfortable way to test your routes while you code

## The problem: restarting by hand

Right now, every time you change `server.js` you must:

1. Click the terminal running the server.
2. Press `Ctrl + C` to stop it.
3. Type `node server.js` again.
4. Go back to the browser or `curl` and test.

Forget step 2 or 3 and you'll be testing **old** code, wondering why your change "didn't work". Every developer has lost time to this.

The cycle of *edit, save, test, repeat* is called the **dev loop** (short for development loop). The faster and smoother it is, the more you can experiment. A **file watcher** makes it smooth: a tool that notices when you save a file and restarts your server for you.

```text
   edit code  --->  save file  --->  watcher restarts server
       ^                                      |
       |                                      v
   read result  <---  test with browser / curl
```

## Option 1: node --watch (built in)

Node.js has a watcher built in. Just add the `--watch` flag:

```bash
node --watch server.js
```

```text
Server running on http://localhost:3000
```

Now change the message in one of your routes and **save** the file. The terminal clears and shows:

```text
Server running on http://localhost:3000
```

The server restarted by itself, using your new code. Refresh the browser and you will see the change.

`--watch` was added in Node.js 18.11 as an experimental feature, and it is stable in Node.js 22 (and 20.13+). If you followed the setup lesson, you are already on a version that supports it.

### What does it watch?

`node --watch` watches the file you start **and every file it imports**. If `server.js` imports `app.js`, and `app.js` imports `routes/users.js`, saving any of those files triggers a restart. You don't have to list them.

### Keep the old output on screen

By default the terminal is cleared on every restart. If you would rather see the history (handy when you are reading error messages), add `--watch-preserve-output`:

```bash
node --watch-preserve-output --watch server.js
```

```text
Server running on http://localhost:3000
Restarting 'server.js'
Server running on http://localhost:3000
```

### Put it in an npm script

You don't want to type flags every time. Open `package.json` and make your scripts look like this:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  }
}
```

Now there are two ways to run the app:

| Command | Use it when | Restarts on save? |
| --- | --- | --- |
| `npm run dev` | You are writing code | Yes |
| `npm start` | Running "for real", such as on a server | No |

Watching files uses extra resources and restarts can interrupt users, so production servers always use the plain `start` script.

> **Tip:** `npm run dev` is the command you will type most in this course. Start it once at the beginning of a coding session and leave it running.

## Option 2: Nodemon

Before Node.js had `--watch`, everyone used a package called **Nodemon** (from "Node monitor"). You'll see it in countless tutorials and real projects, so it's worth knowing. It also offers a few extra controls.

Install it as a **dev dependency**, because it is only needed while developing:

```bash
npm install -D nodemon
```

Then point your `dev` script at it:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "devDependencies": {
    "nodemon": "^3.1.10"
  }
}
```

Run it the same way:

```bash
npm run dev
```

```text
[nodemon] 3.1.10
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,mjs,cjs,json
[nodemon] starting `node server.js`
Server running on http://localhost:3000
```

Your exact version number may differ. Two Nodemon extras worth knowing:

- Type **`rs`** and press Enter in the terminal to force a restart at any time.
- Nodemon watches **folders**, not just imported files. A change to any `.js` or `.json` file in your project triggers a restart.

### Configuring Nodemon

For more control, create `nodemon.json` next to `package.json`:

```json
{
  "watch": ["src", "server.js"],
  "ext": "js,json",
  "ignore": ["src/**/*.test.js"],
  "delay": 500
}
```

| Setting | Meaning |
| --- | --- |
| `watch` | Only watch these folders and files |
| `ext` | Which file extensions count as a change |
| `ignore` | Files to skip, such as tests |
| `delay` | Wait this many milliseconds after a save before restarting |

### Which one should I use?

| | `node --watch` | Nodemon |
| --- | --- | --- |
| Install needed | No, built in | Yes, `npm install -D nodemon` |
| Watches | The entry file and everything it imports | Whole folders, configurable |
| Manual restart | Stop and start again | Type `rs` |
| Config file | No | `nodemon.json` |

For this course, **`node --watch` is all you need**. Reach for Nodemon if you need to restart when non-imported files change (for example, template files), or if a project you join already uses it.

## Adding environment variables to the loop

Many apps read settings such as the port or a database address from a `.env` file. Node.js 20.6 and newer can load that file for you with `--env-file`, and it works together with `--watch`:

```json
{
  "scripts": {
    "dev": "node --env-file=.env --watch server.js"
  }
}
```

If `.env` does not exist, Node.js will exit with an error, so only add the flag once you have the file. You'll set up `.env` files properly in [Environment Variables and Configuration](/courses/expressjs/environment-variables-and-config).

## A comfortable testing setup

Automatic restarts are half of the loop. The other half is **testing** quickly. Here is a setup many developers use.

### Two terminals side by side

- **Terminal 1** runs `npm run dev` and shows server logs and errors.
- **Terminal 2** is free for `curl` commands.

In VS Code, click the **split** icon in the terminal panel to get both in one window.

```bash
# terminal 2
curl http://localhost:3000/
curl -i http://localhost:3000/api/status
```

> **Note:** On Windows PowerShell use `curl.exe` instead of `curl`.

### The browser for GET requests

For simple `GET` routes, the browser is the quickest tester: just refresh. Firefox and Chrome also display JSON responses in a readable way.

### API clients for everything else

Browsers can only send `GET` from the address bar. For `POST`, `PUT` or `DELETE` you can use `curl` (you'll learn how in the next lesson), or a graphical **API client**: an app where you fill in the method, URL, headers and body, then click Send. Popular free ones include **Postman**, **Insomnia**, **Bruno**, and the **Thunder Client** and **REST Client** extensions for VS Code.

With the REST Client extension you can even save requests in a `.http` file in your project and click "Send Request" above each one:

```http
### Home page
GET http://localhost:3000/

### Status endpoint
GET http://localhost:3000/api/status
```

Use whichever feels comfortable. This course shows `curl` commands, because they work everywhere and are easy to copy.

## Debugging inside the loop

When something goes wrong, your first tool is `console.log`. Anything you log inside a route handler appears in **Terminal 1**, not in the browser:

```js
// app.js
app.get('/api/status', (req, res) => {
  console.log('Status was requested at', new Date().toISOString());
  res.json({ status: 'ok' });
});
```

When you want to pause code and inspect variables step by step, Node.js has a real debugger. In VS Code, open the command palette and choose **JavaScript Debug Terminal**, then run `npm run dev` inside it. Breakpoints you set by clicking next to a line number will now pause your server when a request reaches that line.

## Common mistakes

> **Common mistake:** Running `npm run dev` in two terminals at once. The second one fails with `EADDRINUSE` because the first is already using the port. Keep exactly one server running.

> **Common mistake:** The watcher restarts, but the server crashes immediately because of a typo. Read **Terminal 1**: the error message and line number are there. Fix the typo, save, and the watcher starts the server again automatically.

> **Common mistake:** Using `npm run dev` (or Nodemon) on a production server. Use `npm start` there. Watch mode is a development tool only.

## Key takeaways

- The **dev loop** is edit, save, test, repeat. A **file watcher** removes the manual restart step.
- `node --watch server.js` is built into Node.js and restarts when the entry file or anything it imports changes.
- **Nodemon** is a popular package with extras: folder watching, `rs` to restart, and a `nodemon.json` config.
- Use `npm run dev` while coding and `npm start` in production.
- Keep the server in one terminal and run `curl` in another; logs from your handlers appear in the server terminal.

## Practice

1. Add a `"dev": "node --watch server.js"` script and start it. Change a route's message three times and confirm each change without restarting by hand.
2. Add a `console.log` inside a route handler. Hit the route with `curl` and find the log in the server terminal.
3. Install Nodemon as a dev dependency, switch the `dev` script to use it, and try the `rs` command.
4. Introduce a deliberate typo (delete a closing bracket), save, read the error, then fix it and watch the server come back.

## What's next

With a fast dev loop in place, you are ready to add many more routes. Continue with [Routing with app.get, app.post and Friends](/courses/expressjs/routing-basics).
