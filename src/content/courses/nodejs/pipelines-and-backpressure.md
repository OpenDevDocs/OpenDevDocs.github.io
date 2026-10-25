---
publishDate: 2026-10-25T10:20
title: Pipelines and Backpressure
slug: pipelines-and-backpressure
metadescription: Connect streams safely with pipeline from node:stream/promises, use async generators as stages, cancel with a signal, and understand backpressure.
updateDate: 2026-10-25T10:20
author: ['bishal-biswas']
level: 2
tags: ['streams', 'pipeline', 'backpressure']
course: nodejs
---

## Connecting the hoses

In [the Streams lesson](/courses/nodejs/streams-fundamentals) you met the four kinds of stream. Real programs connect them in a chain: read a file, change it, compress it, save it. That chain is called a **pipeline**.

Think of a factory line. Boxes come off a lorry, go through a labelling machine, then a wrapping machine, then onto a shelf. If the wrapping machine is slow, the labelling machine must slow down too, or boxes pile up on the floor.

That "slow down, I am full" message is called **backpressure**. This lesson shows you how to build pipelines that handle errors and backpressure for you.

## The old way: .pipe()

Every Readable stream has a `.pipe(destination)` method. It sends everything from the source into the destination and returns the destination, so you can chain:

```javascript
// pipe.mjs
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';

createReadStream('orders.txt')
  .pipe(createGzip())
  .pipe(createWriteStream('orders.txt.gz'));
```

This works, and it even handles backpressure. But it has a serious problem with **errors**:

- An error in one stream is **not passed along** the chain. You need an `'error'` listener on **every** stream.
- If one stream fails, the others are **not closed**. Files and memory can be left open (a **leak**).
- There is no simple way to know when the whole chain has finished or failed.

So `.pipe()` is fine for quick experiments, but not for real apps.

## The modern way: pipeline from node:stream/promises

`pipeline()` from `node:stream/promises` connects any number of streams and returns a **promise**:

- It fulfils when the last stream has finished.
- It rejects if **any** stream fails, and then it **destroys every stream** in the chain, so nothing leaks.
- It handles backpressure between every pair of streams.

```javascript
// gzip.mjs
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

await pipeline(
  createReadStream('orders.txt'),
  createGzip(),
  createWriteStream('orders.txt.gz'),
);
console.log('Compressed!');
```

```text
Compressed!
```

On our 158,893-byte `orders.txt`, the gzipped file came out at 13,200 bytes. Because the data streams through, this works the same for a 10 GB file.

Errors land in one place, a normal `try`/`catch`:

```javascript
try {
  await pipeline(
    createReadStream('missing.txt'),
    createGzip(),
    createWriteStream('missing.txt.gz'),
  );
} catch (err) {
  console.log('Pipeline failed:', err.code); // prints: Pipeline failed: ENOENT
}
```

> **Note:** There is also an older callback version: `import { pipeline } from 'node:stream'`, called as `pipeline(a, b, c, (err) => {...})`. You will see it in older code. Prefer the promise version.

## Async generators as pipeline stages

You do not have to write a `Transform` class to change data in a pipeline. You can pass an **async generator function** as a middle stage. It receives the previous stream as `source`, loops over it, and `yield`s whatever should go next:

```javascript
// shout.mjs
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

await pipeline(
  createReadStream('orders.txt', 'utf8'),
  async function* (source) {
    for await (const chunk of source) {
      yield chunk.toUpperCase();
    }
  },
  createWriteStream('orders-upper.txt'),
);
```

The first line of `orders-upper.txt` is now:

```text
ORDER 1: 2 X COFFEE FOR ASHA
```

This is usually much shorter and clearer than a custom `Transform`.

### Working line by line

Chunks are cut by size, so a word or line can be split across two chunks. When your logic needs whole lines, use `readline` inside the generator:

```javascript
// filter-lines.mjs
import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';

await pipeline(
  createReadStream('orders.txt'),
  async function* (source) {
    const lines = createInterface({ input: source, crlfDelay: Infinity });
    for await (const line of lines) {
      if (line.includes('Order 1')) yield line + '\n'; // keep matching lines only
    }
  },
  createWriteStream('order-1s.txt'),
);
```

### The last stage can return a result

If the **last** stage is an async function (not a stream), `pipeline` resolves with whatever it returns:

```javascript
// count-bytes.mjs
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const total = await pipeline(
  createReadStream('orders.txt'),
  async function (source) {
    let bytes = 0;
    for await (const chunk of source) bytes += chunk.length;
    return bytes;
  },
);
console.log('bytes', total); // prints: bytes 158893
```

## Cancelling a pipeline

`pipeline` accepts an options object as its last argument. Pass a `signal` to stop it, as you learned in [the Promise Combinators lesson](/courses/nodejs/promise-combinators-and-abortsignal):

```javascript
// cancel.mjs (source and destination are any streams)
const controller = new AbortController();
setTimeout(() => controller.abort(), 100); // stop after 100 ms

try {
  await pipeline(source, destination, { signal: controller.signal });
} catch (err) {
  console.log(err.name); // prints: AbortError
}
```

When the signal fires, every stream in the pipeline is destroyed and the promise rejects with an `AbortError`. This is perfect for "stop the download if the user leaves the page".

## What is backpressure?

Imagine reading from a fast SSD and uploading over a slow network. The reader can produce data much faster than the network can send it. If nobody slows the reader down, unsent data piles up in memory until the program runs out.

**Backpressure** is the mechanism that lets a slow consumer tell a fast producer "wait".

### highWaterMark: the size of the waiting area

Every stream has an internal buffer, a waiting area for chunks. Its target size is the **highWaterMark**:

- For file read streams, it is 64 KB by default.
- For object mode streams, it is 16 objects.
- For other byte streams, it depends on the platform. `stream.getDefaultHighWaterMark(false)` tells you the value on your machine.

It is not a hard limit. It is the level at which the stream starts saying "please stop".

### write() returns false when the buffer is full

When you call `writable.write(chunk)`, it returns:

- `true`: "fine, keep going".
- `false`: "my buffer has reached the highWaterMark, please stop until I emit `'drain'`".

The data is still accepted when it returns `false`. It is a request, not a refusal. Here is a slow writer with a tiny buffer of 3 objects:

```javascript
// backpressure.mjs
import { Writable } from 'node:stream';

const slow = new Writable({
  objectMode: true,
  highWaterMark: 3, // room for 3 objects
  write(item, encoding, callback) {
    setTimeout(callback, 100); // takes 100 ms per item
  },
});

for (let i = 1; i <= 5; i++) {
  const ok = slow.write(`order ${i}`);
  console.log(`write order ${i}: ${ok}  (waiting in buffer: ${slow.writableLength})`);
}

slow.on('drain', () => console.log('drain: buffer empty, safe to write again'));
```

```text
write order 1: true  (waiting in buffer: 1)
write order 2: true  (waiting in buffer: 2)
write order 3: false  (waiting in buffer: 3)
write order 4: false  (waiting in buffer: 4)
write order 5: false  (waiting in buffer: 5)
drain: buffer empty, safe to write again
```

From order 3 on, `write()` says "stop", but this code ignores it and keeps writing. The buffer grows past the limit.

### Respecting backpressure by hand

The correct pattern is: if `write()` returns `false`, wait for `'drain'` before writing more. `events.once` makes this easy:

```javascript
// respect.mjs
import { Writable } from 'node:stream';
import { once } from 'node:events';

const slow = new Writable({
  objectMode: true,
  highWaterMark: 3,
  write(item, encoding, callback) {
    console.log('  saved', item);
    setTimeout(callback, 50);
  },
});

for (let i = 1; i <= 6; i++) {
  if (!slow.write(`order ${i}`)) {
    console.log(`buffer full after order ${i}, waiting for drain...`);
    await once(slow, 'drain'); // pause this loop until there is room
  }
}

slow.end();
await once(slow, 'finish');
console.log('all saved');
```

```text
  saved order 1
buffer full after order 3, waiting for drain...
  saved order 2
  saved order 3
  saved order 4
buffer full after order 6, waiting for drain...
  saved order 5
  saved order 6
all saved
```

The loop never runs ahead of the writer by more than three orders.

### How much does it matter?

In a test with a fast Readable producing 1 KB chunks and a slow Writable taking 1 ms per chunk, ignoring the return value of `write()` left **20 MB** waiting in memory after half a second. With `pipeline(fast, slow)`, only about **15 KB** was waiting, because the reader was paused. With a real multi-gigabyte file, the first version runs out of memory.

> **Tip:** `pipeline()`, `.pipe()` and `Readable.from()` all handle backpressure for you. You only need the manual `write()` and `'drain'` pattern when you write to a stream yourself in a loop.

## Common mistakes

### Ignoring the return value of write()

```javascript
// Wrong for big data: memory grows without limit
for (const row of millionsOfRows) out.write(row);
```

Either wait for `'drain'` when `write()` returns `false`, or turn the data into a stream with `Readable.from()` and use `pipeline`:

```javascript
// Right
await pipeline(Readable.from(millionsOfRows), out);
```

### Text changes that cross chunk boundaries

```javascript
// Wrong: 'coffee' may be split as 'cof' + 'fee' across two chunks
await pipeline(source, async function* (chunks) {
  for await (const chunk of chunks) yield chunk.replaceAll('coffee', 'tea');
}, destination);
```

On a large file, a few words are missed for exactly this reason, and nothing warns you. Work line by line with `readline` (as shown earlier) when you search or replace text.

## Quick recap

- A **pipeline** connects streams: source, then transforms, then destination.
- `.pipe()` does not forward errors or clean up. Avoid it in real apps.
- `pipeline()` from `node:stream/promises` returns a promise, destroys every stream on failure, and handles backpressure.
- Async generator functions make easy middle stages. An async function as the last stage can return a result.
- Pass `{ signal }` to cancel a pipeline.
- **Backpressure** lets a slow consumer pause a fast producer. The **highWaterMark** sets the buffer level.
- `write()` returns `false` when the buffer is full. Wait for `'drain'` before writing more.

<code id="code-content" class="language-javascript">
// pipelines.mjs: connect streams safely and respect backpressure
import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createGzip, createGunzip } from 'node:zlib';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { once } from 'node:events';
// 1. A generator as the source: pipeline only asks for more when the file can take it
async function* makeOrders(count) {
  for (let i = 1; i &lt;= count; i++) yield `${i},${['Asha', 'Ravi', 'Maya'][i % 3]},coffee\n`;
}
await pipeline(Readable.from(makeOrders(50_000)), createWriteStream('orders.csv'));
console.log('1. orders.csv size:', (await stat('orders.csv')).size, 'bytes');
// 2. Read, transform with a generator, compress, write: one line, one error handler
await pipeline(
  createReadStream('orders.csv', 'utf8'),
  async function* (source) {
    for await (const chunk of source) yield chunk.toUpperCase(); // safe chunk by chunk
  },
  createGzip(),
  createWriteStream('orders.csv.gz'),
);
console.log('2. orders.csv.gz size:', (await stat('orders.csv.gz')).size, 'bytes');
// 3. The last stage can be an async function that returns a result
const bytes = await pipeline(createReadStream('orders.csv.gz'), createGunzip(), async (source) =&gt; {
  let total = 0;
  for await (const chunk of source) total += chunk.length;
  return total;
});
console.log('3. unzipped back to', bytes, 'bytes');
// 4. Errors anywhere reject the whole pipeline, and every stream is cleaned up
try {
  await pipeline(createReadStream('no-such-file.csv'), createGzip(), createWriteStream('nope.gz'));
} catch (err) {
  console.log('4. pipeline failed:', err.code);
}
// ---
// 5. Backpressure by hand: write() returns false when the buffer is full
const slowDisk = new Writable({
  objectMode: true,
  highWaterMark: 2, // a tiny buffer so we hit the limit quickly
  write(item, encoding, callback) { setTimeout(callback, 20); },
});
for (let i = 1; i &lt;= 5; i++) {
  if (!slowDisk.write(`order ${i}`)) {
    console.log(`5. buffer full at order ${i}, waiting for 'drain'`);
    await once(slowDisk, 'drain');
  }
}
slowDisk.end();
await once(slowDisk, 'finish');
// 6. Cancel a pipeline with a signal
try {
  await pipeline(Readable.from(makeOrders(Infinity)), new Writable({
    write(chunk, encoding, callback) { setTimeout(callback, 1); },
  }), { signal: AbortSignal.timeout(100) });
} catch (err) {
  console.log('6. endless pipeline stopped:', err.name);
}
</code></pre>
