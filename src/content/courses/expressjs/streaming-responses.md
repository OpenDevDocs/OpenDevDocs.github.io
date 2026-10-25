---
publishDate: 2026-10-25T09:47
title: Streaming Responses and Backpressure
slug: streaming-responses
metadescription: Learn how Node.js streams let Express 5 send large files and exports with little memory, what backpressure is, and how to stream safely with pipeline and async generators.
updateDate: 2026-10-25T09:47
author: ['bishal-biswas']
level: 3
tags: ['express', 'streams', 'performance', 'nodejs']
course: expressjs
---

## What you will learn

- Why building a huge response in memory is a problem
- What **streams** are, and the four kinds you will meet in Node.js
- What **backpressure** is and how to respect it when writing to `res`
- How to stream generated data safely with `pipeline()` and **async generators**
- How to build a real CSV export, handle clients that disconnect, and deal with errors mid-stream

Most responses you have sent so far were small: a JSON object, a list of 20 notes. This lesson is about the big ones: a full data export, a large log file, a report with a million rows.

## The problem: everything in memory at once

Imagine a user clicks "Export all my notes as CSV" and they have 500,000 notes. A first attempt looks like this:

```js
// routes/exports.js  (works, but does not scale)
exportsRouter.get('/notes.csv', requireAuth, async (req, res) => {
  const notes = await Note.find({ owner: req.user.id }); // all 500,000 documents in memory
  const csv = notes.map((n) => `${n._id},${n.title}`).join('\n'); // plus one giant string
  res.attachment('notes.csv').send(csv);
});
```

Three things go wrong:

1. **Memory spikes.** All documents and the full CSV string sit in memory at once. A few users exporting at the same time can push your server out of memory.
2. **The user waits for nothing.** No byte is sent until the very last row is ready, so the browser shows a spinner for a long time.
3. **Wasted work.** If the user gives up and closes the tab, your server keeps building the whole file anyway.

Think of moving water from a lake to a village. You could fill one enormous tanker, drive it over, and empty it. Or you could lay a pipe and let the water flow continuously. The pipe needs far less "container", water starts arriving immediately, and you can close the tap at any time. **Streams are the pipe.**

## What is a stream?

A **stream** is a way of handling data **piece by piece** instead of all at once. Each piece is called a **chunk**, typically a few kilobytes.

Node.js has four kinds:

| Kind | What it does | Examples you already know |
| --- | --- | --- |
| **Readable** | A source you read chunks from | `req` (the incoming body), `fs.createReadStream()` |
| **Writable** | A destination you write chunks to | `res` (the response), `fs.createWriteStream()` |
| **Transform** | Reads chunks, changes them, outputs new chunks | `zlib.createGzip()` (compression) |
| **Duplex** | Both readable and writable | A network socket |

The big surprise for most learners: **`res` has always been a writable stream.** `res.send()` and `res.json()` are helpers that write one big chunk and end. You can also write many small chunks yourself:

```js
// app.js
app.get('/countdown', async (req, res) => {
  res.type('text/plain');
  for (const n of [3, 2, 1]) {
    res.write(`${n}...\n`);                                   // send a chunk now
    await new Promise((resolve) => setTimeout(resolve, 1000)); // wait a second
  }
  res.end('Lift off!\n');                                     // final chunk, then close
});
```

Use `curl -N` (no buffering) to watch the chunks arrive one by one:

```bash
curl -N http://localhost:3000/countdown
```

```text
3...
2...
1...
Lift off!
```

Because you did not set a `Content-Length` in advance, Node sends the response with **chunked transfer encoding**, an HTTP feature that lets a server send a body in pieces without knowing its total size up front.

## Streaming a file

Files are the classic stream example:

```js
// app.js (illustration)
import fs from 'node:fs';

app.get('/big-log', (req, res) => {
  res.type('text/plain');
  fs.createReadStream('logs/app.log').pipe(res); // read a chunk, write a chunk, repeat
});
```

Whether the file is 1 KB or 10 GB, only a small buffer is in memory at any time.

> **Tip:** For real files on disk, use `res.sendFile()` or `res.download()` from [Sending JSON, Files and Redirects](/courses/expressjs/sending-json-files-and-redirects). They stream for you, and also handle `404`s, caching headers and **Range requests** (resuming downloads and seeking in videos). Write your own streams for data you **generate**, like exports and reports.

## Backpressure: when the consumer is slower

Here is the most important idea in this lesson.

Your server can usually produce data much faster than the client can download it. A database cursor might give you thousands of rows per second, while a user on a weak mobile connection receives a small fraction of that.

Picture a factory conveyor belt. Items come off the machine (your code) and a worker packs them into boxes (the network). If the machine runs faster than the worker can pack, items pile up at the end of the belt. Eventually they fall on the floor. **Backpressure** is the worker shouting "Stop, I'm full!" so the machine pauses until the pile clears.

In Node.js, every writable stream has a small internal buffer. Its size limit is called the **high-water mark**.

```text
your code ──write()──> [ res buffer: ███████░░░ ] ──network──> slow client
                              ^
                        high-water mark
write() returns true  -> buffer has room, keep going
write() returns false -> buffer is full: STOP and wait for the 'drain' event
'drain' fires         -> buffer emptied out, carry on writing
```

The rules are simple:

1. `res.write(chunk)` returns `true` while there is room in the buffer.
2. When it returns `false`, stop writing.
3. When the stream emits **`'drain'`**, it is safe to write again.

### What happens if you ignore backpressure

`write()` returning `false` is only advice. Node will still accept your chunks; it just keeps them in memory. So this code "works":

```js
// app.js  (ignores backpressure: do not copy)
app.get('/numbers-bad', (req, res) => {
  res.type('text/plain');
  for (let i = 1; i <= 5_000_000; i++) {
    res.write(`${i}\n`); // return value ignored
  }
  res.end();
});
```

Download it with a deliberately slow client and watch your server's memory:

```bash
curl -s --limit-rate 50k http://localhost:3000/numbers-bad > /dev/null
```

```js
// add to server.js while testing
setInterval(() => {
  console.log('RSS MB:', Math.round(process.memoryUsage().rss / 1024 / 1024));
}, 1000);
```

Memory jumps right away, because all five million lines are queued in memory waiting for a slow download. Several such clients at once can crash the process. (**RSS**, resident set size, is the total memory your process is using.)

### Respecting backpressure by hand

To do it properly, check the return value and wait for `'drain'`. Also stop if the client disconnects, otherwise you would wait for a `'drain'` that never comes.

```js
// app.js  (respects backpressure)
const waitForDrainOrClose = (res) =>
  new Promise((resolve) => {
    const done = () => {
      res.off('drain', done);
      res.off('close', done);
      resolve();
    };
    res.on('drain', done);
    res.on('close', done);
  });

app.get('/numbers', async (req, res) => {
  let clientGone = false;
  res.on('close', () => { clientGone = true; });

  res.type('text/plain');
  for (let i = 1; i <= 5_000_000; i++) {
    if (clientGone) return;                 // stop working for nobody
    if (!res.write(`${i}\n`)) {
      await waitForDrainOrClose(res);       // pause until the buffer empties
    }
  }
  res.end();
});
```

Run the same slow `curl` and memory stays flat. It works, but that is a lot of careful code for every route. Node gives you a better tool.

## The better way: `pipeline()` and async generators

Two features together make streaming almost effortless.

**`pipeline()`** from `node:stream/promises` connects streams together, handles backpressure between every pair automatically, and cleans up **all** of them if any one fails or the client disconnects. It returns a promise, so it fits perfectly with `async` handlers.

An **async generator** is a function declared with `async function*` that can `await` things and `yield` values one at a time. `Readable.from()` turns it into a readable stream. Your generator only runs when the stream asks for more data, so backpressure pauses your code automatically.

```js
// app.js
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

async function* numbers(max) {
  for (let i = 1; i <= max; i++) {
    yield `${i}\n`; // pauses here whenever the response buffer is full
  }
}

app.get('/numbers', async (req, res) => {
  res.type('text/plain');
  await pipeline(Readable.from(numbers(5_000_000)), res);
});
```

No `'drain'` handling, no flags, no leaks. When the client is slow, `pipeline` stops pulling from the generator. When the client disconnects, it destroys the source, which stops the generator.

### A small helper for clean disconnects

When a client disconnects mid-stream, `pipeline()` rejects with an error whose code is `ERR_STREAM_PREMATURE_CLOSE`. That is normal user behaviour, not a bug, so you do not want it in your error logs. Wrap it once:

```js
// utils/streamToResponse.js
import { pipeline } from 'node:stream/promises';

// Pipe one or more streams into res; ignore "client went away" errors
export const streamToResponse = async (res, ...streams) => {
  try {
    await pipeline(...streams, res);
  } catch (err) {
    if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
    throw err; // real errors go to Express's error handler
  }
};
```

## A realistic example: streaming a CSV export

Now let's fix the export from the start of the lesson. Mongoose can return a **cursor**: an object that fetches documents from MongoDB in small batches as you loop over it, instead of loading them all. Cursors work with `for await...of`, which makes them a perfect fit for an async generator.

```js
// routes/exports.js
import { Router } from 'express';
import { Readable } from 'node:stream';
import { requireAuth } from '../middleware/requireAuth.js';
import { streamToResponse } from '../utils/streamToResponse.js';
import { Note } from '../models/Note.js';

export const exportsRouter = Router();

// Make one value safe to put in a CSV cell
const csvCell = (value) => {
  let text = String(value ?? '');
  // Stop spreadsheet apps from treating a cell as a formula
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  // Quote cells containing commas, quotes or line breaks
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

async function* notesAsCsv(cursor) {
  yield 'id,title,createdAt\n';
  for await (const note of cursor) {
    yield [note._id, note.title, note.createdAt.toISOString()].map(csvCell).join(',') + '\n';
  }
}

exportsRouter.get('/notes.csv', requireAuth, async (req, res) => {
  const cursor = Note.find({ owner: req.user.id })
    .select('title createdAt')
    .lean()     // plain objects: faster, less memory
    .cursor();  // fetch in batches as the stream asks for more

  res.attachment('notes.csv'); // Content-Disposition + Content-Type: text/csv
  await streamToResponse(res, Readable.from(notesAsCsv(cursor)));
});
```

Look at what you get for free:

- **Low memory.** Only one batch of documents is in memory at a time, however large the export.
- **Fast first byte.** The header row is sent immediately, and the download starts right away.
- **Backpressure all the way to the database.** A slow client slows the generator, which stops asking the cursor for more documents.
- **Clean cancellation.** If the user cancels the download, `pipeline` stops the generator, which closes the cursor.

> **Note:** The formula check in `csvCell` defends against **CSV injection**. A note titled `=HYPERLINK(...)` could otherwise run as a formula when someone opens the export in a spreadsheet app. Prefixing a single quote makes it plain text. It is the same "data must not become code" rule from [Preventing Injection, XSS and CSRF](/courses/expressjs/preventing-injection-xss-csrf).

## Streaming JSON with NDJSON

What about JSON APIs? A single JSON array is awkward to stream, because a client cannot use it until the closing `]` arrives. A popular alternative is **NDJSON** (newline-delimited JSON): one complete JSON object per line. Clients can process each line as it arrives.

```js
// routes/exports.js (continued)
async function* notesAsNdjson(cursor) {
  for await (const note of cursor) {
    yield JSON.stringify({ id: note._id, title: note.title }) + '\n';
  }
}

exportsRouter.get('/notes.ndjson', requireAuth, async (req, res) => {
  const cursor = Note.find({ owner: req.user.id }).select('title').lean().cursor();
  res.type('application/x-ndjson');
  await streamToResponse(res, Readable.from(notesAsNdjson(cursor)));
});
```

```bash
curl -N http://localhost:3000/exports/notes.ndjson -H "Authorization: Bearer YOUR_TOKEN"
```

```text
{"id":"6720f1a2c4e8b9a1d3f00017","title":"Shopping list"}
{"id":"6720f1a2c4e8b9a1d3f00018","title":"Ideas"}
```

## Adding a transform: compressing on the fly

Because `streamToResponse` accepts several streams, you can add a **transform** stream in the middle. Here, Node's built-in `zlib` compresses the export as it flows:

```js
// routes/exports.js (continued)
import zlib from 'node:zlib';

exportsRouter.get('/notes.csv.gz', requireAuth, async (req, res) => {
  const cursor = Note.find({ owner: req.user.id }).select('title createdAt').lean().cursor();
  res.attachment('notes.csv.gz');
  await streamToResponse(res, Readable.from(notesAsCsv(cursor)), zlib.createGzip());
});
```

```text
generator ──> Readable ──> gzip transform ──> res ──> client
           (backpressure flows backwards through every step)
```

You will learn when and how to compress normal responses automatically in [Compression and Response Optimisation](/courses/expressjs/compression-and-response-optimisation).

## Errors in the middle of a stream

Streaming changes one rule you learned in [Error-Handling Middleware](/courses/expressjs/error-handling-middleware). Once the first chunk is sent, the **status code and headers are already on their way**. If the database fails at row 300,000, you cannot switch to a `500` response anymore.

What happens then:

1. `pipeline()` rejects, and `streamToResponse` re-throws the error.
2. Express 5 forwards the rejected promise to your error handler automatically.
3. Your error handler sees `res.headersSent` is `true` and calls `next(err)`.
4. Express's built-in handler closes the connection, so the client sees an incomplete download instead of a "successful" truncated file.

```js
// middleware/errorHandler.js
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err); // too late for a JSON error: let Express abort the response
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
};
```

> **Tip:** Do as much checking as you can **before** the first byte: validate parameters, check permissions, and make sure the data source opens. Then stream. Errors before streaming still get a proper status code.

## Streams go both ways

`req` is a readable stream too. Body parsers like `express.json()` read the whole body into memory, which is fine for small payloads with limits (see [Input Sanitisation and Payload Limits](/courses/expressjs/input-sanitisation-and-payload-limits)). For large uploads, Multer streams files to disk, and you can also stream a raw request body yourself with `pipeline(req, fs.createWriteStream(path))`, as long as you enforce a size limit.

## Common mistakes

> **Common mistake:** Ignoring the return value of `res.write()` in a loop. It looks fine in local tests with a fast connection, then eats all your memory with real, slower clients.

- **Using `.pipe()` without error handling.** If the source fails, `.pipe()` does not close the destination, and resources leak. Prefer `pipeline()`.
- **Collecting the stream into an array "just to sort it".** That brings the memory problem back. Sort in the database query instead.
- **Forgetting about disconnects.** Hand-written loops must stop when the client leaves. `pipeline()` does this for you.
- **Trying to send a JSON error after streaming started.** Check `res.headersSent` and let Express abort the connection.
- **Streaming files by hand** when `res.sendFile()` would give you Range support and caching headers for free.

## Key takeaways

- A **stream** processes data in chunks, keeping memory low and sending the first byte quickly. `res` is a writable stream; `req` is a readable one.
- **Backpressure** means pausing the producer when the consumer is full: `write()` returns `false`, then you wait for `'drain'`.
- `pipeline()` from `node:stream/promises` handles backpressure, errors and cleanup for you. Combine it with `Readable.from()` and an **async generator**.
- Database cursors plus generators give you exports of any size with steady memory.
- After the first chunk, you cannot change the status code. Validate first, then stream, and let Express abort on mid-stream errors.

## Practice

1. Build `/numbers-bad` and `/numbers`, download each with `curl --limit-rate 50k`, and compare the RSS memory logged by your server.
2. Add the `notes.csv` export to your Notes API. Seed 100,000 notes with a script and download the export while watching memory.
3. Start the CSV download with `curl`, press Ctrl+C halfway, and add a `console.log` inside the generator's loop to confirm it stops.
4. Add a `?since=2026-01-01` query parameter to the export. Validate it with Zod **before** streaming so an invalid date gets a clean `400`.

## What's next

Streams let you send data bit by bit, and the next step is keeping a connection open to push live updates, in [WebSockets and Server-Sent Events](/courses/expressjs/websockets-and-sse).
