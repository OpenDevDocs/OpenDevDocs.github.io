---
publishDate: 2026-10-25T09:32
title: Logging with Morgan and Pino
slug: logging-with-morgan-and-pino
metadescription: Learn to log HTTP requests with Morgan and write fast structured JSON logs with Pino and pino-http in Express 5, including request IDs, levels and redaction.
updateDate: 2026-10-25T09:32
author: ['bishal-biswas']
level: 2
tags: ['express', 'logging', 'morgan', 'pino']
course: expressjs
---

## What you will learn

- Why `console.log` is not enough once your app is running for real
- How to log every request with **Morgan** in one line
- What **structured logging** is and why tools love JSON logs
- How to use **Pino** and **pino-http** with log levels, request IDs and redaction
- What you should never write into a log

## Why logging matters

When your API runs on your laptop, you can watch the terminal. In production, it runs on a server you cannot see, handling requests from people you will never meet. When a user says "it broke at 3 pm", logs are often the only way to find out what happened.

A **log** is a time-stamped record of something that happened in your program: "request received", "user created", "database timed out".

**Think of it like a ship's logbook.** The crew writes down the time, position and anything unusual. If something goes wrong, the captain reads the logbook to reconstruct the story. Your app needs the same thing.

## Two kinds of logs

| Kind | Answers | Example |
| --- | --- | --- |
| **Request logs** (also called access logs) | "What requests came in and how did we answer?" | `GET /notes 200 4 ms` |
| **Application logs** | "What happened inside my code?" | `Payment provider timed out after 3 retries` |

Morgan is great at the first kind. Pino handles both.

## Why not just console.log?

`console.log` works, but it has problems in a real app:

- **No levels.** You cannot easily say "show only errors in production, everything on my laptop".
- **No structure.** `console.log('User', id, 'failed')` is easy for humans to read but hard for log tools to search.
- **No context.** When 100 requests run at once, their messages mix together and you cannot tell which line belongs to which request.

## Request logging with Morgan

**Morgan** is a small middleware that writes one line per request. It is perfect for development and small apps.

```bash
npm install morgan
```

```js
// app.js
import express from 'express';
import morgan from 'morgan';

const app = express();

app.use(morgan('dev')); // register early so it sees every request

app.get('/notes/:id', (req, res) => {
  res.json({ id: req.params.id, title: 'Buy milk' });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

Make a request with `curl http://localhost:3000/notes/42` and the terminal shows:

```text
GET /notes/42 200 3.512 ms - 31
```

That is: method, path, status code, response time, and response size in bytes. In a real terminal the status code is coloured: green for success, yellow for client errors, red for server errors.

### Built-in formats

| Format | Looks like | Use it for |
| --- | --- | --- |
| `dev` | `GET /notes/42 200 3.512 ms - 31` | Local development |
| `tiny` | `GET /notes/42 200 31 - 3.512 ms` | Minimal output |
| `short` | Adds the client IP address | Small apps |
| `common` | The classic Apache web server format | Compatibility with old tools |
| `combined` | `common` plus referrer and user agent | Production text logs |

A `combined` line looks like this:

```text
::1 - - [25/Oct/2026:09:32:10 +0000] "GET /notes/42 HTTP/1.1" 200 31 "-" "curl/8.5.0"
```

### Custom tokens and skipping requests

A **token** is a placeholder in a Morgan format, such as `:method` or `:status`. You can define your own:

```js
// app.js
import { randomUUID } from 'node:crypto';

// Give every request an id, so you can find all lines about it later
app.use((req, res, next) => {
  req.id = randomUUID();
  next();
});

morgan.token('id', (req) => req.id);

app.use(morgan(':id :method :url :status :response-time ms', {
  skip: (req) => req.url === '/health', // health checks are noise
}));
```

### Writing Morgan logs to a file

```js
// app.js
import fs from 'node:fs';

const accessLog = fs.createWriteStream('access.log', { flags: 'a' }); // 'a' = append

app.use(morgan('combined', { stream: accessLog }));
```

> **Tip:** Many hosting platforms (Docker, Render, Railway, Kubernetes and others) collect whatever your app prints to standard output. There, you usually log to the terminal and let the platform store the logs, instead of managing files yourself.

## Structured logging with Pino

Morgan writes a line of text. That is fine for humans, but hard for a computer to search. "Show me every request slower than 500 ms for user 42" is a painful text search.

**Structured logging** means writing each log entry as data, usually one JSON object per line. Log tools (Grafana Loki, Datadog, Elasticsearch, CloudWatch and many more) can then filter by any field.

**Pino** is a very fast structured logger for Node.js. It writes JSON by default.

```bash
npm install pino pino-http
npm install --save-dev pino-pretty
```

### A shared logger

Create one logger and import it everywhere:

```js
// logger.js
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});
```

```js
// server.js
import { logger } from './logger.js';

logger.info('Server starting');
logger.info({ port: 3000 }, 'Server listening'); // object first, message second
logger.warn({ retries: 3 }, 'Payment provider is slow');
```

Each call prints one JSON line:

```text
{"level":30,"time":1761384730123,"pid":4120,"hostname":"my-laptop","port":3000,"msg":"Server listening"}
```

Notice the argument order: **the data object comes first, the message second**. The fields in your object (`port`) are merged into the JSON, so they become searchable.

### Log levels

A **log level** says how important a message is. You set a minimum level, and anything below it is skipped.

| Level | Number | Use it for |
| --- | --- | --- |
| `trace` | 10 | Extremely detailed step-by-step output |
| `debug` | 20 | Details useful while developing |
| `info` | 30 | Normal events: server started, user signed up |
| `warn` | 40 | Something odd that you handled |
| `error` | 50 | Something failed |
| `fatal` | 60 | The app cannot continue |

With `level: 'info'`, `logger.debug(...)` prints nothing. Set `LOG_LEVEL=debug` on your laptop when you need more detail, without touching the code.

### Pretty output in development

JSON is hard to read in a terminal. `pino-pretty` turns it into coloured, readable lines. Pipe your app's output into it during development:

```bash
node --watch server.js | npx pino-pretty
```

```text
[09:32:10.123] INFO (4120): Server listening
    port: 3000
```

In production, skip `pino-pretty` and keep the raw JSON for your log tools.

## Request logging with pino-http

**pino-http** is the Pino version of Morgan. It logs every request as JSON *and* gives each request its own logger, `req.log`.

```js
// app.js
import express from 'express';
import pinoHttp from 'pino-http';
import { logger } from './logger.js';

const app = express();

app.use(pinoHttp({ logger }));

app.get('/notes/:id', (req, res) => {
  req.log.info({ noteId: req.params.id }, 'Loading note');
  res.json({ id: req.params.id, title: 'Buy milk' });
});

export default app;
```

When the response finishes, pino-http writes a line like this (shortened):

```text
{"level":30,"time":1761384731456,"req":{"id":1,"method":"GET","url":"/notes/42",...},"res":{"statusCode":200,...},"responseTime":4,"msg":"request completed"}
```

The big win is `req.log`. Every line you write through it automatically includes the request's `id`. When many requests run at the same time, you can filter by that id and see the full story of one request.

### Better request IDs

By default, pino-http numbers requests `1`, `2`, `3`... That restarts at 1 every time the server restarts. A random **UUID** (a long, unique id) is better. If a proxy or another service already sent an `X-Request-Id` header, reuse it so logs from several services connect together.

```js
// app.js
import { randomUUID } from 'node:crypto';

app.use(pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = req.get('X-Request-Id') ?? randomUUID();
    res.set('X-Request-Id', id); // send it back so clients can report it
    return id;
  },
  // Pick the level from the status code
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Do not log health checks
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
}));
```

When a user reports a problem, they can give you the `X-Request-Id` from the response, and you can find every log line for that request.

## Keeping secrets out of logs

Logs are often stored for months and read by many people and tools. They are a common source of data leaks.

Never log:

- Passwords, even failed ones
- Tokens, API keys, session ids and the `Authorization` or `Cookie` headers
- Full credit card numbers or government ID numbers
- More personal data than you really need

Pino can remove sensitive fields automatically with **redaction**. You list the paths to hide:

```js
// logger.js
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password', // any "password" one level deep
    ],
    censor: '[REDACTED]',
  },
});
```

```js
logger.info({ user: { email: 'asha@example.com', password: 'change-me' } }, 'Signup attempt');
```

```text
{"level":30,...,"user":{"email":"asha@example.com","password":"[REDACTED]"},"msg":"Signup attempt"}
```

> **Warning:** Redaction is a safety net, not a plan. Avoid logging whole request bodies or user objects in the first place.

## Logging errors

Your error-handling middleware is the perfect place to log unexpected errors, because every error passes through it.

```js
// middleware/error-handler.js
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const status = err.status ?? 500;

  if (status >= 500) {
    // The "err" key is special: Pino prints the message and stack trace nicely
    req.log.error({ err }, 'Unhandled error');
  }

  res.status(status).json({
    error: status < 500 ? err.message : 'Something went wrong',
    requestId: req.id, // helps users report the problem
  });
};
```

Log `5xx` errors (your bugs) at `error` level. `4xx` errors are usually the client's mistake, such as a missing field. They are already visible in the request log, so you do not need a second, louder line for each one.

## Morgan or Pino?

| | Morgan | Pino + pino-http |
| --- | --- | --- |
| Output | One text line per request | JSON objects |
| Application logs | No, request logs only | Yes, with levels |
| Per-request logger | No | Yes, `req.log` |
| Setup effort | One line | A few lines |
| Best for | Learning, small apps, local dev | Production APIs |

Use only one request logger at a time. Running both Morgan and pino-http prints every request twice.

## Common mistakes

- **Putting the message before the object** in Pino: `logger.info('Saved', { id })` does not merge `id` into the JSON the way you expect. Write `logger.info({ id }, 'Saved')`.
- **Registering the logger after the routes.** Middleware runs in order, so the logger must come first to see every request.
- **Using `pino-pretty` in production.** It is slow and turns your JSON back into text that log tools cannot parse.
- **Logging secrets.** Check what you log, and add redaction paths.
- **Logging too much at `info`.** If every loop iteration logs, the important lines get buried. Use `debug` for detail.

## Key takeaways

- Logs are your app's logbook. You need them to understand what happened in production.
- **Morgan** adds one-line request logs in seconds: `app.use(morgan('dev'))`.
- **Structured logging** writes JSON, so tools can search by any field. **Pino** is a fast structured logger.
- **pino-http** logs every request and gives you `req.log`, which tags each line with a request id.
- Use log levels, keep secrets out with redaction, and log unexpected errors in your error handler.

## Practice

1. Add `morgan('dev')` to an existing app, make a few requests, and identify each part of the log line.
2. Replace Morgan with pino-http. Use `req.log.info()` in one route and check that the line includes the request id.
3. Implement `genReqId` so the `X-Request-Id` header is reused or created, and confirm it appears in the response with `curl -i`.
4. Log an object that contains a `password` field and set up redaction so it prints `[REDACTED]`.

## What's next

You can now validate input and see what your API is doing. Time to design an API that is pleasant to use: continue with [Designing RESTful Routes](/courses/expressjs/designing-restful-routes).
