---
publishDate: 2026-10-25T09:04
title: Your First Server and app.listen
slug: your-first-express-server
metadescription: Build your first Express 5 server line by line, learn what localhost and ports mean, test it with a browser and curl, and handle app.listen errors like EADDRINUSE.
updateDate: 2026-10-25T09:04
author: ['bishal-biswas']
level: 1
tags: ['express', 'nodejs', 'http-server', 'beginners']
course: expressjs
---

## What you will learn

- What every line of a minimal Express 5 server does
- What **localhost**, **ports** and "listening" really mean
- How to test your server with a browser and with `curl`
- How `app.listen` reports errors in Express 5, such as a port that is already in use
- How to split your code into `app.js` and `server.js`

In the last lesson you ran a small server as a smoke test. Now you will build it again, slowly, and understand each piece. This is the foundation for everything else in the course.

## The complete server

Here is the whole program. Put it in `server.js` in your `my-express-app` folder (the project from the previous lesson, with `"type": "module"` in `package.json`):

```js
// server.js
import express from 'express';

const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.send('Hello from Express!');
});

app.listen(PORT, (error) => {
  if (error) throw error;
  console.log(`Server running on http://localhost:${PORT}`);
});
```

Only ten lines of real code. Let's walk through them.

## Line by line

### 1. Import Express

```js
import express from 'express';
```

This loads the Express package from `node_modules` and gives it the name `express`. What you get is a **function**. Calling that function creates a new app.

### 2. Create the app

```js
const app = express();
```

`app` is your **application object**. Think of it as the manager of your restaurant. You tell it which "orders" (requests) to accept and what to do with each one. Almost everything you do in Express starts with `app.something(...)`.

### 3. Pick a port

```js
const PORT = 3000;
```

A **port** is a numbered "door" on your computer through which network messages arrive. Your server will stand behind door number 3000 and wait. Any number from 1024 to 65535 is fine for development; 3000 is just a popular habit.

> **Note:** Ports below 1024 (like 80 for HTTP) are reserved, and many systems require admin rights to use them. That is why development servers use numbers such as 3000, 5000 or 8080.

### 4. Define a route

```js
app.get('/', (req, res) => {
  res.send('Hello from Express!');
});
```

This is a **route**: a rule that says "when a request arrives with **this method** and **this path**, run **this function**".

| Piece | Meaning |
| --- | --- |
| `app.get` | Only react to HTTP `GET` requests |
| `'/'` | Only for the path `/`, the home page |
| `(req, res) => { ... }` | The **route handler**: the function that runs for matching requests |
| `req` | The **request object**: everything about the incoming request |
| `res` | The **response object**: your tools for answering |
| `res.send(...)` | Send the answer back and finish the response |

Express calls your handler **once for every matching request**. If ten people visit the home page, the function runs ten times. You will explore `req` and `res` in depth in [The Request Object](/courses/expressjs/the-request-object) and [The Response Object](/courses/expressjs/the-response-object).

### 5. Start listening

```js
app.listen(PORT, (error) => {
  if (error) throw error;
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**Listening** means "open the door and wait for requests". `app.listen` asks the operating system for port 3000 and keeps your program running, waiting. That is why the terminal does not return to the prompt: your server is busy listening.

The second argument is a **callback**: a function that Node.js calls later, once the attempt to start is finished.

- If starting **worked**, `error` is `undefined` and you print a friendly message.
- If starting **failed**, Express 5 passes the problem in as `error`. `throw error` stops the program and shows the reason.

> **Note:** This error argument is new in Express 5. In Express 4, a startup error was not passed to the callback, which made it easy to miss. Always check it.

## Run it and visit it

Start the server:

```bash
node server.js
```

```text
Server running on http://localhost:3000
```

Now open your browser and go to `http://localhost:3000`. You should see **Hello from Express!**

### What just happened?

```text
 Browser                              Your computer, port 3000
    |                                          |
    |  GET / HTTP/1.1  Host: localhost:3000   |
    | ---------------------------------------> |  Express finds app.get('/')
    |                                          |  runs your handler
    |  HTTP/1.1 200 OK                         |
    |  Hello from Express!                     |
    | <--------------------------------------- |
```

**localhost** is a name that always means "this same computer". The browser and the server are two programs on one machine, talking through port 3000. Nothing goes out to the internet, which is why only you can see this page.

## Test it with curl

Browsers are great, but `curl` shows you the whole response, including the headers. Open a **second terminal window** (the first one is busy running the server) and run:

```bash
curl -i http://localhost:3000
```

```text
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: text/html; charset=utf-8
Content-Length: 19
ETag: W/"13-tsbq4e7agwVV6r9iE+Lb/lLwlzw"
Date: Sun, 25 Oct 2026 11:03:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

Hello from Express!
```

Look at how much Express did for you with one `res.send` call:

- Set the status code to **200 OK**.
- Set `Content-Type` to HTML, because you sent a string.
- Counted the bytes for `Content-Length`.
- Added an `ETag`, a fingerprint browsers use for caching.

> **Warning:** On Windows PowerShell, `curl` is a different built-in command. Use `curl.exe -i http://localhost:3000` instead. Command Prompt, Git Bash, macOS and Linux can use `curl` as shown.

### Try a path that doesn't exist

```bash
curl -i http://localhost:3000/hello
```

```text
HTTP/1.1 404 Not Found
Content-Type: text/html; charset=utf-8
...

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Cannot GET /hello</pre>
</body>
</html>
```

You never wrote a route for `/hello`, so Express answers with **404 Not Found** automatically. Later you will replace this plain page with your own in [Not Found and Fallback Handling](/courses/expressjs/not-found-handling).

## Stopping and restarting

Your server keeps running until you stop it. Click the terminal that runs it and press **`Ctrl + C`**. You get your prompt back, and `http://localhost:3000` stops working.

Node.js does **not** reload your code by itself. If you change `server.js`, you must stop the server and start it again to see the change. (Two lessons from now, you will automate that.)

> **Common mistake:** Editing your code, refreshing the browser, and wondering why nothing changed. The old version is still running. Stop it with `Ctrl + C` and run `node server.js` again.

## Add a second route

Let's return some **JSON**, the data format APIs use. Add this route above `app.listen`:

```js
// server.js (add above app.listen)
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});
```

Restart the server and test it:

```bash
curl -i http://localhost:3000/api/status
```

```text
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
...

{"status":"ok","time":"2026-10-25T11:05:00.000Z"}
```

`res.json()` turns your JavaScript object into JSON text and sets `Content-Type: application/json` for you.

## When the port is already in use

Start your server in one terminal. Then, in a second terminal, start it **again**. The second one fails:

```text
Error: listen EADDRINUSE: address already in use :::3000
```

**EADDRINUSE** means "address in use": another program is already standing behind door 3000, and only one program can use a port at a time. Usually that "other program" is an old copy of your own server that you forgot to stop.

Thanks to the Express 5 error argument, you can show a clearer message:

```js
// server.js (friendlier startup errors)
app.listen(PORT, (error) => {
  if (error) {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is busy. Is the server already running in another terminal?`);
    } else {
      console.error('Could not start the server:', error.message);
    }
    process.exit(1); // stop the program with a "failure" exit code
  }
  console.log(`Server running on http://localhost:${PORT}`);
});
```

To fix it, find the other terminal and press `Ctrl + C`, or pick a different port.

## Let the port be configurable

Hosting platforms often tell your app which port to use through an **environment variable** called `PORT`. An environment variable is a setting passed to your program from outside the code. Read it with `process.env.PORT` and fall back to 3000:

```js
const PORT = process.env.PORT ?? 3000;
```

The `??` operator means "use the left value, unless it is missing, then use the right one". Now you can choose a port when starting:

```bash
PORT=4000 node server.js
```

```powershell
$env:PORT = 4000; node server.js
```

The first command works on macOS, Linux and Git Bash. The second is for Windows PowerShell. You will learn a tidier way with `.env` files in [Environment Variables and Configuration](/courses/expressjs/environment-variables-and-config).

## Split the app from the server

Right now one file both **builds** the app and **starts** it. Professional projects split these into two files:

```js
// app.js: builds the app, does not start it
import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.send('Hello from Express!');
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

export default app;
```

```js
// server.js: starts the app
import app from './app.js';

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, (error) => {
  if (error) throw error;
  console.log(`Server running on http://localhost:${PORT}`);
});
```

Why bother? Later, automated tests can import `app` from `app.js` and send fake requests to it **without** opening a real port. You will see this in [Testing with Supertest and the Node Test Runner](/courses/expressjs/testing-with-supertest). For now, just enjoy the tidier layout.

> **Note:** In `import app from './app.js'` the `./` means "in this same folder", and the `.js` ending is required. You will learn why in the next lesson.

Run it exactly as before: `node server.js` (or `npm start`).

## Common beginner questions

**Can my friends visit `http://localhost:3000`?**
No. On their computer, `localhost` means *their* computer. To share your app you need to deploy it to a server, which is covered at the end of the course.

**Why does the terminal "hang" after starting?**
It isn't stuck. The server is listening and waiting for requests. That's its job.

**Does the order of `app.get` and `app.listen` matter?**
Define your routes first and call `app.listen` last. It's the clearest order, and it means everything is set up before the first request can arrive.

## Key takeaways

- `express()` creates an **app**; `app.get(path, handler)` adds a **route**; `app.listen(port, callback)` starts the server.
- A **route handler** receives `req` (the request) and `res` (the response) and runs once per matching request.
- **localhost** is your own computer; a **port** is the numbered door your server listens behind.
- In Express 5, startup errors like **EADDRINUSE** arrive as the first argument of the `app.listen` callback. Always check it.
- Stop the server with `Ctrl + C` and restart it after every code change (for now).
- Keep `app.js` (build the app) separate from `server.js` (listen on a port).

## Practice

1. Add a route `GET /about` that sends `About this app`. Test it in the browser and with `curl -i`.
2. Add a route `GET /api/hello` that returns `{ "message": "Hello" }` with `res.json`. Check the `Content-Type` header with `curl -i`.
3. Start the server twice to trigger **EADDRINUSE**, and make the friendly error message from this lesson appear.
4. Run the server on port 4000 using the `PORT` environment variable, and confirm `http://localhost:3000` no longer answers.

## What's next

You have been writing `import` and `export` already. Let's look at the two module systems Node.js supports and why this course uses ES modules. Continue with [ES Modules vs CommonJS in Express Apps](/courses/expressjs/esm-vs-commonjs).
