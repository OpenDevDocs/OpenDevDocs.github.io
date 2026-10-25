---
publishDate: 2026-10-25T10:25
title: Web Streams and Interop
slug: web-streams
metadescription: Use the standard ReadableStream, WritableStream and TransformStream in Node.js, and convert between web and Node streams with toWeb and fromWeb.
updateDate: 2026-10-25T10:25
author: ['bishal-biswas']
level: 2
tags: ['streams', 'web-streams', 'fetch']
course: nodejs
---

## Two kinds of plug

When you travel abroad, your phone charger might not fit the wall socket. The electricity is the same; only the plug is different. You carry a small **adapter**.

Node has the same situation with streams. There are:

- **Node streams**: the `Readable`, `Writable` and `Transform` classes from `node:stream` that you used in the last two lessons. They have existed since the early days of Node.
- **Web streams**: `ReadableStream`, `WritableStream` and `TransformStream`. These are a **web standard**, the same classes that browsers, Deno, Bun and edge platforms use.

Both carry data in chunks. They just have different "plugs". This lesson shows you web streams and the adapters that convert between the two.

## Why web streams matter in Node

You meet web streams more and more:

- `fetch()` gives you the response body as a web `ReadableStream`.
- Code written for browsers or edge runtimes uses web streams.
- Handy built-in classes like `CompressionStream` and `TextDecoderStream` are web streams.

Web streams are **stable** in Node and available as **globals**. You can also import them from `node:stream/web`.

## Reading a ReadableStream

### Creating one

You create a `ReadableStream` by passing an object with a `start` method. It receives a **controller**, which you use to add chunks (`enqueue`) and to finish (`close`):

```javascript
// names.mjs
const names = new ReadableStream({
  start(controller) {
    controller.enqueue('Asha');
    controller.enqueue('Ravi');
    controller.enqueue('Maya');
    controller.close(); // no more chunks
  },
});
```

For quick tests, `ReadableStream.from()` makes one from an array or any iterable:

```javascript
const names = ReadableStream.from(['Asha', 'Ravi', 'Maya']);
```

### Reading with a reader

The standard way to read is to get a **reader** and call `read()` until it says `done`:

```javascript
const reader = names.getReader();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  console.log('read:', value);
}
```

```text
read: Asha
read: Ravi
read: Maya
```

While a reader is active, the stream is **locked**: nobody else can read from it. `reader.releaseLock()` unlocks it.

### Reading with for await

In Node, a `ReadableStream` is also **async iterable**, so the simpler `for await` loop works:

```javascript
for await (const name of ReadableStream.from(['Asha', 'Ravi'])) {
  console.log('loop:', name);
}
```

```text
loop: Asha
loop: Ravi
```

If you `break` out of the loop early, the stream is cancelled for you.

### Producing data on demand with pull

`start` runs once. If you want to produce data only when the reader asks for it, use `pull`. It is called each time the stream wants another chunk:

```javascript
// counter.mjs
let i = 0;
const counter = new ReadableStream({
  pull(controller) {
    i++;
    if (i > 3) controller.close();
    else controller.enqueue(`tick ${i}`);
  },
});

for await (const tick of counter) console.log(tick);
```

```text
tick 1
tick 2
tick 3
```

This is how web streams handle **backpressure**: if nobody reads, `pull` is not called, so no data piles up.

## Writing to a WritableStream

A `WritableStream` takes an object with a `write(chunk)` method and optional `close()`:

```javascript
// logger.mjs
const logger = new WritableStream({
  write(chunk) {
    console.log('writing:', chunk);
  },
  close() {
    console.log('closed');
  },
});

const writer = logger.getWriter();
await writer.write('hello');
await writer.write('world');
await writer.close();
```

```text
writing: hello
writing: world
closed
```

`writer.write()` returns a promise. To respect backpressure when writing in a loop, wait for `writer.ready` before each write:

```javascript
for (const line of lines) {
  await writer.ready; // resolves when the stream has room
  writer.write(line);
}
```

## TransformStream, pipeThrough and pipeTo

A `TransformStream` changes chunks as they pass through. Its `transform(chunk, controller)` method calls `controller.enqueue()` with the result:

```javascript
// upper.mjs
const upper = new TransformStream({
  transform(chunk, controller) {
    controller.enqueue(chunk.toUpperCase());
  },
});

const shouting = ReadableStream.from(['asha', 'ravi']).pipeThrough(upper);
for await (const name of shouting) console.log(name);
```

```text
ASHA
RAVI
```

Web streams connect with two methods:

- `readable.pipeThrough(transform)`: sends data through a transform and **returns the transformed readable**, so you can chain.
- `readable.pipeTo(writable)`: sends everything into a writable and **returns a promise** that settles when it is done.

Both handle backpressure and pass errors along the chain.

## Built-in web transform streams

Node ships several ready-made transforms as globals:

| Class | What it does |
| --- | --- |
| `TextEncoderStream` | Strings in, UTF-8 bytes (`Uint8Array`) out |
| `TextDecoderStream` | Bytes in, strings out (never cuts a character in half) |
| `CompressionStream('gzip')` | Compresses bytes (`'deflate'` and `'deflate-raw'` also work) |
| `DecompressionStream('gzip')` | Decompresses bytes |

## fetch bodies are web streams

The body of a `fetch` response is a `ReadableStream` of `Uint8Array` chunks. You can stream a large download instead of loading it all at once:

```javascript
// download.mjs
const res = await fetch('https://example.com');

let bytes = 0;
for await (const chunk of res.body) {
  bytes += chunk.length;
}
console.log(bytes, 'bytes');
```

You will learn more about `fetch` in [the fetch lesson](/courses/nodejs/fetch-undici-and-websocket).

The `Response` class also works the other way: wrap any stream of **bytes** in `new Response(stream)` to collect it in one go:

```javascript
const stream = ReadableStream.from(['Hi ', 'Asha']).pipeThrough(new TextEncoderStream());
console.log(await new Response(stream).text()); // prints: Hi Asha
```

## Converting between Node and web streams

Now the adapters. The `node:stream` classes have static methods to convert in both directions:

| From | To | Method |
| --- | --- | --- |
| Node `Readable` | Web `ReadableStream` | `Readable.toWeb(nodeReadable)` |
| Web `ReadableStream` | Node `Readable` | `Readable.fromWeb(webReadable)` |
| Node `Writable` | Web `WritableStream` | `Writable.toWeb(nodeWritable)` |
| Web `WritableStream` | Node `Writable` | `Writable.fromWeb(webWritable)` |

`Duplex.toWeb()` and `Duplex.fromWeb()` exist too, for streams that are both.

### Node to web

```javascript
// node-to-web.mjs
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

const webStream = Readable.toWeb(createReadStream('orders.txt'));
console.log(webStream instanceof ReadableStream); // prints: true

const text = await new Response(webStream).text();
console.log('chars:', text.length); // prints: chars: 158893
```

Now you can use the file with any code that expects a web stream, such as `CompressionStream`:

```javascript
// web-gzip.mjs
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable, Writable } from 'node:stream';

await Readable.toWeb(createReadStream('orders.txt'))
  .pipeThrough(new CompressionStream('gzip'))
  .pipeTo(Writable.toWeb(createWriteStream('orders.txt.gz')));
```

### Web to Node

```javascript
// web-to-node.mjs
import { Readable } from 'node:stream';

const web = ReadableStream.from(['Hello ', 'from ', 'the web\n']);
const nodeStream = Readable.fromWeb(web);

for await (const chunk of nodeStream) {
  process.stdout.write(chunk.toString()); // prints: Hello from the web
}
```

This is useful when a library hands you a web stream (for example a `fetch` body) and you want to use Node tools with it.

### pipeline accepts web streams directly

`pipeline()` from `node:stream/promises` understands both kinds, so often you do not need to convert at all:

```javascript
await pipeline(
  Readable.toWeb(createReadStream('orders.txt')).pipeThrough(new CompressionStream('gzip')),
  createWriteStream('orders-web.txt.gz'),
);
```

A web `ReadableStream` as the source, a Node `Writable` as the destination, one promise for the whole job.

## Common mistakes

### Reading a locked stream

```javascript
// Wrong
const reader = stream.getReader();
const reader2 = stream.getReader(); // TypeError: Invalid state: ReadableStream is locked
```

Only one reader at a time. Call `reader.releaseLock()` first, or use `stream.tee()` to split a stream into two independent copies.

### Giving Response a stream of strings

```javascript
// Wrong
const lines = ReadableStream.from(['Hi ', 'Asha']);
await new Response(lines).text(); // TypeError: Received non-Uint8Array chunk
```

`Response` expects **bytes**. Add `.pipeThrough(new TextEncoderStream())` first, or collect the strings yourself with `for await`.

## Quick recap

- **Web streams** (`ReadableStream`, `WritableStream`, `TransformStream`) are the standard streams used by browsers and `fetch`. They are globals in Node.
- Create readables with `start` or `pull`, or with `ReadableStream.from()`.
- Read with `getReader()` and `read()`, or with `for await`.
- Chain with `pipeThrough()`; finish with `pipeTo()`. Both handle backpressure.
- `TextEncoderStream`, `TextDecoderStream`, `CompressionStream` and `DecompressionStream` are built in.
- Convert with `Readable.toWeb` / `Readable.fromWeb` and `Writable.toWeb` / `Writable.fromWeb`.
- `pipeline()` from `node:stream/promises` accepts web and Node streams together.

<code id="code-content" class="language-javascript">
// web-streams.mjs: web streams, and moving between web and Node streams
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
// 1. A web ReadableStream that produces orders on demand (pull)
let id = 0;
const orders = new ReadableStream({
  pull(controller) {
    id++;
    if (id &gt; 1000) return controller.close(); // no more data
    controller.enqueue({ id, customer: ['Asha', 'Ravi', 'Maya'][id % 3], qty: (id % 4) + 1 });
  },
});
// 2. A TransformStream that turns each order object into a CSV line
const toCsv = new TransformStream({
  transform(order, controller) {
    controller.enqueue(`${order.id},${order.customer},${order.qty}\n`);
  },
});
// 3. Chain web streams with pipeThrough, finish with pipeTo
const gzipped = orders
  .pipeThrough(toCsv)
  .pipeThrough(new TextEncoderStream())        // strings -&gt; bytes
  .pipeThrough(new CompressionStream('gzip')); // bytes -&gt; gzip bytes
await gzipped.pipeTo(Writable.toWeb(createWriteStream('orders.csv.gz')));
console.log('1. Wrote orders.csv.gz with web streams');
// ---
// 4. Node -&gt; Web: read the file with fs, then decode with web streams
const lines = Readable.toWeb(createReadStream('orders.csv.gz'))
  .pipeThrough(new DecompressionStream('gzip'))
  .pipeThrough(new TextDecoderStream()); // bytes -&gt; strings
let text = '';
for await (const chunk of lines) text += chunk; // web streams are async iterable
console.log('2. First line:', text.split('\n')[0]);
console.log('3. Line count:', text.trim().split('\n').length);
// 5. Reading by hand with a reader
const reader = ReadableStream.from(['Asha', 'Ravi']).getReader();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  console.log('4. reader got:', value);
}
// 6. Web -&gt; Node: use a web stream in a Node pipeline
const webSource = ReadableStream.from(['Hello ', 'from ', 'a web stream\n']);
await pipeline(Readable.fromWeb(webSource), createWriteStream('hello.txt'));
for await (const chunk of createReadStream('hello.txt', 'utf8')) {
  console.log('5. hello.txt says:', chunk.trim());
}
// 7. pipeline also accepts web streams directly
await pipeline(ReadableStream.from(['done\n']), new TextEncoderStream(), process.stdout);
</code></pre>
