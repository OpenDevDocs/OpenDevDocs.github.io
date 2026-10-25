---
publishDate: 2026-10-25T09:00
title: What is Express 5? Role in the Node Ecosystem
slug: what-is-express
metadescription: Learn what Express is, why developers use it to build web servers and APIs with Node.js, and what is new in Express 5, explained in simple words for complete beginners.
updateDate: 2026-10-25T09:00
author: ['bishal-biswas']
level: 1
tags: ['express', 'nodejs', 'backend', 'introduction']
course: expressjs
---

## What you will learn

- What a **web server** is and why websites and apps need one
- What **Express** is and how it fits on top of Node.js
- Why Express is so popular, even after more than ten years
- What changed in **Express 5**, the version this course uses

No experience with servers is needed. If you can write a simple JavaScript function, you are ready.

## First, what is a web server?

Every time you open a website or an app loads your messages, your device sends a **request** over the internet. Somewhere, a computer receives that request, works out the answer, and sends back a **response**. That computer is running a program called a **web server**.

**Think of it like a restaurant:**

| Restaurant | Web |
| --- | --- |
| You, the customer | The browser or mobile app (the **client**) |
| Your order: "One pizza, please" | The **request**: "Give me `/menu`" |
| The kitchen | The **server** program |
| The plate of food | The **response**: HTML, JSON, an image... |

The server's job is to listen for orders, prepare the right dish, and send it back. Express is a tool that makes writing that "kitchen" much easier.

## Node.js: JavaScript outside the browser

JavaScript was born inside web browsers. **Node.js** lets you run JavaScript on a normal computer or server instead. It also comes with a built-in `http` module that can create a web server.

Here is a tiny server written with **only** Node.js, no Express:

```js
// server.js (plain Node.js, no Express)
import http from 'node:http';

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Home page');
  } else if (req.method === 'GET' && req.url === '/about') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('About page');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

It works, but look at all those `if` checks. Imagine 50 pages, reading form data, handling errors and checking logins. The code would quickly become a giant, messy `if/else` chain.

## So what is Express?

**Express is a small framework that sits on top of Node.js and handles the boring parts of building a web server for you.**

A **framework** is a set of ready-made tools and rules that give your code a structure. Express gives you:

1. **Routing**: a clean way to say "when someone visits *this* URL, run *this* function".
2. **Middleware**: small reusable functions that run on every request, for things like logging or reading JSON.
3. **Helpers** for requests and responses, such as `res.json()` and `res.status()`.
4. **Error handling**: one central place to deal with things that go wrong.

Here is the same server as above, written with Express:

```js
// app.js (the same server, with Express)
import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.send('Home page');
});

app.get('/about', (req, res) => {
  res.send('About page');
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

Shorter, easier to read, and each page has its own little function. You did not have to set headers by hand either. Express also sends a `404 Not Found` page automatically when no route matches.

> **Note:** Express does not replace Node.js. It *uses* Node's `http` module under the hood. Think of Node.js as the car engine and Express as the steering wheel and dashboard that make driving comfortable.

## Where Express fits in the Node ecosystem

You will often see Express in a bigger picture like this:

```text
 Browser / Mobile app        (client: sends requests)
          |
          v
 +---------------------+
 |   Express app       |     routes, middleware, error handling
 +---------------------+
 |   Node.js runtime   |     runs JavaScript, provides http, fs, ...
 +---------------------+
          |
          v
 Database (MongoDB, PostgreSQL, ...)
```

- **Node.js** runs your JavaScript code.
- **npm** (Node Package Manager) downloads Express and other libraries.
- **Express** turns incoming requests into calls to your functions.
- **Databases** store the data your app needs, like users and posts.

Express is also the "E" in famous stacks such as **MERN** (MongoDB, Express, React, Node) and **MEAN** (MongoDB, Express, Angular, Node).

## Why is Express so popular?

- **Minimal and unopinionated.** Express gives you the basics and lets you choose everything else, such as which database or template engine to use.
- **Easy to learn.** A working server takes about five lines of code.
- **A huge ecosystem.** Thousands of middleware packages exist for logins, file uploads, security and more.
- **Battle-tested.** Express has been around since 2010 and powers APIs at companies big and small.
- **Transferable skills.** Many newer frameworks borrow Express ideas, so what you learn here carries over.

## What can you build with Express?

| You want to build... | Express helps by... |
| --- | --- |
| A **REST API** for a React or mobile app | Returning JSON with `res.json()` |
| A classic website with pages | Rendering HTML templates such as EJS |
| A backend for a chat app | Working alongside WebSockets |
| A small internal tool or webhook receiver | Spinning up a server in minutes |

## What is new in Express 5?

Express 4 was the main version for about ten years. **Express 5** became the default version on npm in 2025, so `npm install express` now installs Express 5. The good news: most code looks exactly the same. The main improvements are:

1. **Async errors are caught for you.** If an `async` route throws an error or a promise rejects, Express 5 sends it to your error handler automatically. In Express 4 your server could crash or hang.
2. **Stricter, safer route paths.** Route patterns follow clearer rules, which removes a class of security bugs. You will learn the new syntax in the routing lessons.
3. **Old, confusing methods were removed**, such as `res.send(404)`. Each task now has one clear way to do it.
4. **A modern Node.js baseline.** Express 5 needs **Node.js 18 or newer**.

Here is the async improvement in action:

```js
// Express 5: a rejected promise goes straight to the error handler
app.get('/users/:id', async (req, res) => {
  const user = await findUserInDatabase(req.params.id); // imagine this fails
  res.json(user);
});
```

In Express 4 you had to wrap this in `try/catch` and call `next(err)` yourself. In Express 5, if `findUserInDatabase` throws, Express catches it for you.

> **Tip:** If you find an old tutorial online, check which version it uses. Most Express 4 code still works in Express 5, but a few patterns (like `app.get('*', ...)`) need small changes. This course always uses Express 5.

## Common beginner questions

**Do I need to know Node.js first?**
Only the basics: running a file with `node`, installing packages with `npm`, and `import` statements. The next two lessons cover exactly that.

**Is Express a frontend or backend tool?**
Backend. Express runs on the server, not in the browser.

**Is Express still worth learning?**
Yes. It is one of the most downloaded packages on npm, and the concepts (requests, responses, routes, middleware) apply to almost every backend framework.

## Key takeaways

- A **web server** receives requests and sends back responses.
- **Node.js** runs JavaScript on the server. **Express** is a framework on top of Node that makes servers easy to write.
- Express gives you **routing, middleware, request/response helpers and error handling**.
- **Express 5** is the current version: async errors are handled automatically, route paths are stricter, and it needs Node.js 18+.

## Practice

1. In your own words, explain the difference between Node.js and Express to a friend.
2. Look at the plain Node.js server above. Which lines did Express remove for you?
3. List three apps you use every day and guess what kind of requests they send to their servers.

## What's next

Before writing Express code, let's understand what actually travels between a client and a server. Continue with [How the Web Works: HTTP Requests and Responses](/courses/expressjs/how-the-web-works-http).
