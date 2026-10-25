---
publishDate: 2026-10-25T10:15
title: "Streams: Readable, Writable and Transform"
slug: streams-fundamentals
metadescription: Process data piece by piece with Node.js streams. Readable, Writable, Duplex and Transform streams, chunks, object mode, Readable.from and for await.
updateDate: 2026-10-25T10:15
author: ['bishal-biswas']
level: 2
tags: ['streams', 'buffer', 'files']
course: nodejs
---

## Sip, do not gulp

Imagine you need to move a swimming pool of water to another pool. You could try to lift all the water at once (impossible), or you could connect a **hose** and let it flow a bit at a time.

A **stream** is that hose for data. Instead of loading a whole file into memory, you handle it in small pieces called **chunks**, one after another.

With `readFile`, a 4 GB video needs 4 GB of memory before you can touch the first byte. With a stream, Node reads 64 KB, hands it to you, reads the next 64 KB, and so on. Memory stays small, and you can start working straight away.

## Where you already meet streams

Streams are everywhere in Node:

- Reading and writing files: `fs.createReadStream`, `fs.createWriteStream`.
- HTTP: an incoming request is a readable stream; the response is a writable stream.
- The terminal: `process.stdin` is readable; `process.stdout` and `process.stderr` are writable.
- Compression: `zlib.createGzip()` is a transform stream.

Every stream is also an **EventEmitter**, so everything from [the EventEmitter lesson](/courses/nodejs/eventemitter) applies, including the rule about `'error'` listeners.

## The four kinds of stream

| Kind | What it does | Example |
| --- | --- | --- |
| **Readable** | A source you read from | `fs.createReadStream`, an HTTP request |
| **Writable** | A destination you write to | `fs.createWriteStream`, an HTTP response |
| **Duplex** | Both readable and writable, separately | A network socket |
| **Transform** | A Duplex that changes data as it passes through | `zlib.createGzip()` |

You will mostly **use** streams that Node gives you, and sometimes **build** small Transforms of your own.

## Reading a file with a Readable stream

For the examples, imagine `orders.txt` holds 5,000 lines like `Order 1: 2 x coffee for Asha`, about 155 KB in total.

### With events

A Readable stream emits `'data'` for every chunk and `'end'` when there is no more:

```javascript
// read-events.mjs
import { createReadStream } from 'node:fs';

const stream = createReadStream('orders.txt');
let chunks = 0;

stream.on('data', (chunk) => {
  chunks++;
  console.log(`chunk ${chunks}: ${chunk.length} bytes`);
});
stream.on('end', () => console.log('Done'));
stream.on('error', (err) => console.error('Read failed:', err.code));
```

```text
chunk 1: 65536 bytes
chunk 2: 65536 bytes
chunk 3: 27821 bytes
Done
```

Each chunk is a **Buffer** (see [the Buffers lesson](/courses/nodejs/buffers-and-binary-data)). `createReadStream` reads 64 KB (65,536 bytes) at a time by default.

### With for await (recommended)

Readable streams are **async iterable**, so you can loop over them with `for await`. This is the easiest and safest way to read a stream:

```javascript
// read-loop.mjs
import { createReadStream } from 'node:fs';

const stream = createReadStream('orders.txt', {
  encoding: 'utf8',         // give me strings, not Buffers
  highWaterMark: 16 * 1024, // read 16 KB at a time
});

for await (const chunk of stream) {
  console.log(typeof chunk, chunk.length);
}
```

```text
string 16384
string 16384
...
string 11437
```

- `encoding: 'utf8'` turns chunks into strings and never cuts a character in half.
- `highWaterMark` sets the chunk size. You will learn what else it controls in [the Pipelines lesson](/courses/nodejs/pipelines-and-backpressure).

Errors are thrown inside the loop, so a normal `try`/`catch` works:

```javascript
try {
  for await (const chunk of createReadStream('missing.txt')) {}
} catch (err) {
  console.log('Read failed:', err.code); // prints: Read failed: ENOENT
}
```

### Reading line by line

Chunks are cut by size, not by line. To process a file one line at a time, wrap the stream with `node:readline`:

```javascript
// lines.mjs
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const lines = createInterface({
  input: createReadStream('orders.txt'),
  crlfDelay: Infinity, // treat \r\n (Windows) as one line break
});

let count = 0;
for await (const line of lines) {
  count++;
  if (count <= 2) console.log(line);
}
console.log('Total lines:', count);
```

```text
Order 1: 2 x coffee for Asha
Order 2: 2 x coffee for Asha
Total lines: 5000
```

This works on files far bigger than your memory.

## Writing with a Writable stream

A Writable stream has two main methods:

- `write(chunk)`: send a piece of data.
- `end(lastChunk?)`: say "that is all". You can pass one last chunk.

When everything has been written, it emits `'finish'`.

```javascript
// write.mjs
import { createWriteStream } from 'node:fs';

const out = createWriteStream('shopping.txt');

out.write('Milk\n');
out.write('Bread\n');
out.end('Eggs\n');

out.on('finish', () => console.log('Saved!'));
out.on('error', (err) => console.error('Write failed:', err.code));
```

```text
Saved!
```

`shopping.txt` now holds the three lines. To wait for `'finish'` with `await`, use `events.once`:

```javascript
import { once } from 'node:events';

out.end();
await once(out, 'finish');
```

> **Note:** `write()` returns `true` or `false`. A `false` means "slow down, my buffer is full". Ignoring it is fine for small amounts of data, but not for large ones. That is called **backpressure**, and it is the main topic of the next lesson.

## Readable.from: a stream from anything

`Readable.from()` turns an array, a string, or a **generator** into a Readable stream. It is perfect for tests and for feeding your own data into stream code.

```javascript
// from.mjs
import { Readable } from 'node:stream';

for await (const name of Readable.from(['Asha', 'Ravi', 'Maya'])) {
  console.log('name:', name);
}
```

```text
name: Asha
name: Ravi
name: Maya
```

A **generator** is a function marked with `*` that hands out values one at a time with `yield`. An `async function*` can `await` between values. Streams made from generators produce data only when asked:

```javascript
// countdown.mjs
import { Readable } from 'node:stream';

async function* countdown() {
  for (let i = 3; i > 0; i--) yield `${i}...`;
  yield 'Lift off!';
}

for await (const line of Readable.from(countdown())) {
  console.log(line);
}
```

```text
3...
2...
1...
Lift off!
```

> **Tip:** `Readable.from('hello')` sends the whole string as **one** chunk. It does not split it into characters.

## Object mode

Normally, streams carry bytes (Buffers) or strings. In **object mode**, each chunk can be any JavaScript value: an object, a number, an array.

Streams made by `Readable.from` are in object mode by default. For streams you build yourself, pass `objectMode: true`.

In object mode, `highWaterMark` counts **objects** (16 by default) instead of bytes.

## Building your own streams

You build a stream by passing an options object with one key method.

### A custom Readable

Pass a `read()` method. Node calls it whenever the stream wants more data. Inside it, call `this.push(value)` to hand data out, and `this.push(null)` to say "the end". In practice, `Readable.from(generator)` is usually simpler, so reach for that first.

### A custom Writable

The `write(chunk, encoding, callback)` method receives each chunk. Call `callback()` when you have finished with it, or `callback(error)` if it failed:

```javascript
// logger.mjs
import { Writable } from 'node:stream';

const logger = new Writable({
  write(chunk, encoding, callback) {
    console.log('Writing:', chunk.toString());
    callback(); // ready for the next chunk
  },
});

logger.on('finish', () => console.log('All written'));
logger.write('first');
logger.write('second');
logger.end('last');
```

```text
Writing: first
Writing: second
Writing: last
All written
```

Calling `callback()` is essential. Until you do, the stream will not give you the next chunk.

### A custom Transform

A Transform takes chunks in, changes them, and pushes them out. Its `transform(chunk, encoding, callback)` method calls `callback(null, output)` to send a result:

```javascript
// upper.mjs
import { Transform } from 'node:stream';

const upper = new Transform({
  transform(chunk, encoding, callback) {
    callback(null, chunk.toString().toUpperCase());
  },
});

upper.on('data', (chunk) => console.log('out:', chunk.toString()));
upper.write('hello ');
upper.write('asha');
upper.end();
```

```text
out: HELLO 
out: ASHA
```

A Transform can also **skip** a chunk (call `callback()` with nothing), push **several** results with `this.push()`, and run a `flush(callback)` method at the very end to push anything left over. The playground at the bottom of this page uses the skip trick.

To connect streams, every Readable has a `.pipe(destination)` method. `source.pipe(upper)` sends everything from `source` into `upper`. Piping has some traps around errors, and [the Pipelines lesson](/courses/nodejs/pipelines-and-backpressure) shows the safer `pipeline()` function.

## Common mistakes

### No 'error' listener

```javascript
// Wrong: if the file is missing, the process crashes
createReadStream('missing.txt').on('data', (chunk) => console.log(chunk));
```

Add an `'error'` listener, or use `for await` inside `try`/`catch`, or use `pipeline()` from the next lesson.

### Forgetting the callback in a custom stream

If your `write` or `transform` method never calls `callback`, the stream silently stops after the first chunk. Every path through the method must call it exactly once.

## Quick recap

- A **stream** handles data in **chunks**, so memory stays small even for huge files.
- Four kinds: **Readable**, **Writable**, **Duplex** and **Transform**.
- Read with `for await...of` (simplest), or with `'data'` and `'end'` events.
- Write with `write()` and finish with `end()`, then wait for `'finish'`.
- `Readable.from()` makes a stream from an array, string or generator.
- **Object mode** lets chunks be any JavaScript value.
- Custom streams: `read()` + `push()`, `write()` + `callback()`, `transform()` + `callback(null, out)`.
- Always handle errors: an `'error'` listener, `try`/`catch` around `for await`, or `pipeline()`.

<code id="code-content" class="language-javascript">
// streams.mjs: write a file bit by bit, then read and transform it
import { createWriteStream, createReadStream } from 'node:fs';
import { once } from 'node:events';
import { Readable, Writable, Transform } from 'node:stream';
// Writable: write a file one line at a time (fine for small data)
const out = createWriteStream('orders.txt');
for (let i = 1; i &lt;= 10_000; i++) {
  out.write(`${i},${['Asha', 'Ravi', 'Maya'][i % 3]},${(i % 5) + 1}\n`);
}
out.end();                    // no more writes
await once(out, 'finish');    // wait until everything is flushed to disk
console.log('1. Wrote orders.txt');
// Readable: read it back in chunks with for await
let chunks = 0;
let bytes = 0;
for await (const chunk of createReadStream('orders.txt')) {
  chunks++;
  bytes += chunk.length; // each chunk is a Buffer
}
console.log(`2. Read ${bytes} bytes in ${chunks} chunk(s)`);
// ---
// Readable.from: turn an array or generator into a stream
async function* sampleOrders() {
  yield { id: 1, customer: 'Asha', qty: 2 };
  yield { id: 2, customer: 'Ravi', qty: 0 };
  yield { id: 3, customer: 'Maya', qty: 5 };
}
// Transform (object mode): skip empty orders, add a total
const addTotal = new Transform({
  objectMode: true,
  transform(order, encoding, callback) {
    if (order.qty === 0) return callback(); // push nothing: order skipped
    callback(null, { ...order, total: order.qty * 2.5 });
  },
});
// Writable (object mode): print each order it receives
const printer = new Writable({
  objectMode: true,
  write(order, encoding, callback) {
    console.log(`3. Order ${order.id} for ${order.customer}: £${order.total.toFixed(2)}`);
    callback(); // ready for the next one
  },
});
// Connect them: source -&gt; transform -&gt; destination
Readable.from(sampleOrders()).pipe(addTotal).pipe(printer);
await once(printer, 'finish');
console.log('4. All orders printed');
</code></pre>
