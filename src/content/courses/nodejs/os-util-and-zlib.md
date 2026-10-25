---
publishDate: 2026-10-25T11:00
title: The os, util and zlib Modules
slug: os-util-and-zlib
metadescription: Meet three handy built-in modules. Read system info with os, format, inspect and promisify with util, and compress data and files with zlib.
updateDate: 2026-10-25T11:00
author: ['bishal-biswas']
level: 2
tags: ['os', 'util', 'zlib', 'compression']
course: nodejs
---

## Three tools from the drawer

Every kitchen has a drawer of small tools you reach for all the time: a bottle opener, a measuring tape, some cling film. Node's standard library has a drawer like that too. This lesson covers three of them:

- **`node:os`** tells you about the computer your program runs on.
- **`node:util`** is a bag of helpers for printing, comparing and converting functions.
- **`node:zlib`** squashes data so it takes less space, and unsquashes it again.

None of them need installing.

## `node:os`: facts about the machine

```javascript
// system.mjs
import os from 'node:os';

console.log('Platform:', os.platform());          // 'win32', 'linux' or 'darwin' (macOS)
console.log('CPU arch:', os.arch());              // 'x64' or 'arm64'
console.log('Home folder:', os.homedir());
console.log('Temp folder:', os.tmpdir());
console.log('CPU cores:', os.availableParallelism());
console.log('Memory (GB):', (os.totalmem() / 1024 ** 3).toFixed(1));
console.log('Free (GB):', (os.freemem() / 1024 ** 3).toFixed(1));
console.log('Up for (hours):', (os.uptime() / 3600).toFixed(1));
```

Example output on a Windows laptop (yours will differ):

```text
Platform: win32
CPU arch: x64
Home folder: C:\Users\asha
Temp folder: C:\Users\asha\AppData\Local\Temp
CPU cores: 12
Memory (GB): 15.7
Free (GB): 3.7
Up for (hours): 145.6
```

What these are good for:

- **`platform()`**: run different code on Windows and Linux, for example when calling system commands.
- **`homedir()`** and **`tmpdir()`**: the right place for a config file or temporary files, on any system.
- **`availableParallelism()`**: how many tasks can truly run at once. You will use it to decide how many workers to start in [the Worker Threads lesson](/courses/nodejs/worker-threads). It is the modern replacement for `os.cpus().length`.
- **`totalmem()`** and **`freemem()`**: bytes of memory, handy for a health check.

### Line endings: `os.EOL`

Windows ends lines with two characters, `\r\n`. Linux and macOS use just `\n`. `os.EOL` gives you the right one for the current system:

```javascript
import os from 'node:os';
import { writeFile } from 'node:fs/promises';

const lines = ['Asha', 'Ravi', 'Maya'];
await writeFile('names.txt', lines.join(os.EOL) + os.EOL);
```

> **Note:** `os.loadavg()` shows how busy the CPU has been over 1, 5 and 15 minutes. It is a Unix idea, so on Windows it always returns `[ 0, 0, 0 ]`.

## `node:util`: small, useful helpers

### `util.format()`: printf-style strings

`console.log` uses this under the hood. `%s` is a string, `%d` a number, `%j` JSON and `%o` an object:

```javascript
import util from 'node:util';

console.log(util.format('%s has %d books', 'Asha', 3)); // Asha has 3 books
console.log(util.format('Data: %j', { a: 1 }));         // Data: {"a":1}
```

### `util.inspect()`: see deep objects

`console.log` stops printing after two levels of nesting and shows `[Object]` instead:

```javascript
const deep = { level1: { level2: { level3: { level4: 'hidden?' } } } };
console.log(deep);
// { level1: { level2: { level3: [Object] } } }

console.log(util.inspect(deep, { depth: null }));
// {
//   level1: { level2: { level3: { level4: 'hidden?' } } }
// }
```

`depth: null` means "no limit". It is very helpful when you are debugging a big API response.

You can also control how your own objects print, for example to hide a secret, with the special `util.inspect.custom` method:

```javascript
class ApiKey {
  constructor(value) {
    this.value = value;
  }
  [util.inspect.custom]() {
    return 'ApiKey(****)';
  }
}

console.log({ key: new ApiKey('sk_live_123') }); // { key: ApiKey(****) }
```

### `util.promisify()`: callbacks to promises

Many older Node APIs take a callback as their last argument. `promisify` turns such a function into one that returns a promise, so you can `await` it:

```javascript
import { promisify } from 'node:util';
import { scrypt } from 'node:crypto';

const scryptAsync = promisify(scrypt);
const key = await scryptAsync('my password', 'some salt', 32);
console.log(key.length); // 32
```

You saw this exact pattern in [the crypto lesson](/courses/nodejs/crypto-and-hashing). Most core modules now have promise versions (`fs/promises`, `timers/promises`), so you mainly need `promisify` for the few that do not, and for old npm packages.

### `util.isDeepStrictEqual()`: compare by content

`===` compares objects by identity, not content:

```javascript
console.log({ a: [1, 2] } === { a: [1, 2] });                    // false
console.log(util.isDeepStrictEqual({ a: [1, 2] }, { a: [1, 2] })); // true
```

### `util.styleText()`: colours in the terminal

```javascript
console.log(util.styleText('green', 'Saved!'));
console.log(util.styleText(['bold', 'red'], 'Failed'));
```

It adds colour codes when the terminal supports them, and leaves them out when your output goes to a file or another program, so log files stay clean.

### A few more worth knowing

- `util.types.isDate(x)`, `util.types.isPromise(x)` and friends: reliable type checks.
- `util.deprecate(fn, message)`: wraps a function so the first call prints a `DeprecationWarning`. Useful when you maintain a library.
- `util.parseArgs()`: parses command line flags, covered in [the command line arguments lesson](/courses/nodejs/parsing-command-line-arguments).

## `node:zlib`: compression

**Compression** finds repeated patterns in data and writes them more cleverly, like writing "Node.js is great. ×100" instead of the sentence a hundred times. The original comes back exactly when you decompress. Smaller data means faster downloads and less disk space.

`zlib` supports three families:

- **gzip** (and its close cousin **deflate**): the classic, understood everywhere.
- **Brotli**: newer, usually smaller output, supported by all modern browsers.
- **Zstandard** (`zstdCompress`): very fast, added in Node 23.8 and 22.15. It is still marked experimental in the Node 24 docs.

### Compressing a Buffer

```javascript
import zlib from 'node:zlib';

const text = 'Node.js is great. '.repeat(100);
const input = Buffer.from(text);

const gzipped = zlib.gzipSync(input);
const brotli = zlib.brotliCompressSync(input);

console.log('Original:', input.length, 'bytes');
console.log('Gzip:', gzipped.length, 'bytes');
console.log('Brotli:', brotli.length, 'bytes');

console.log(zlib.gunzipSync(gzipped).toString() === text); // true
```

```text
Original: 1800 bytes
Gzip: 53 bytes
Brotli: 36 bytes
true
```

This text repeats itself, so it shrinks enormously. Real data like JSON or HTML usually shrinks to between a fifth and a half. Images, videos and zip files are already compressed and barely shrink at all.

The `Sync` versions block the event loop while they work. They are fine for small data and scripts. In a server, use the async versions with `promisify`:

```javascript
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const packed = await gzipAsync('Hello, Maya');
console.log((await gunzipAsync(packed)).toString()); // Hello, Maya
```

### Compressing a file with streams

For files of any size, connect streams with `pipeline` (from [the Pipelines lesson](/courses/nodejs/pipelines-and-backpressure)). Only a small chunk is in memory at a time:

```javascript
// gzip-file.mjs
import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createGzip, createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

await pipeline(createReadStream('big.txt'), createGzip(), createWriteStream('big.txt.gz'));
console.log((await stat('big.txt')).size, '->', (await stat('big.txt.gz')).size);

// And back again
await pipeline(createReadStream('big.txt.gz'), createGunzip(), createWriteStream('big-copy.txt'));
```

```text
288894 -> 107382
```

The `.gz` file is a normal gzip file. Tools like `gunzip` or 7-Zip can open it.

### Compressing HTTP responses

Browsers send an `Accept-Encoding` header listing the compression they understand. If it includes `gzip`, you can compress the body and say so with `Content-Encoding`:

```javascript
import http from 'node:http';
import { gzipSync } from 'node:zlib';

const notes = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, title: `Note ${i + 1}` }));
const body = JSON.stringify(notes);

const server = http.createServer((req, res) => {
  const acceptsGzip = (req.headers['accept-encoding'] ?? '').includes('gzip');
  if (acceptsGzip) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
    res.end(gzipSync(body));
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
  }
});

server.listen(3000);
```

Browsers and `fetch` decompress it automatically. In production, a reverse proxy or hosting platform often does this job for you.

## Common mistakes

### Decompressing the wrong format

```javascript
zlib.gunzipSync(Buffer.from('not gzip'));
// Error: incorrect header check (code: 'Z_DATA_ERROR')
```

Gzip data always starts with the bytes `1f 8b`. Make sure you use the matching pair: `gzip`/`gunzip`, `brotliCompress`/`brotliDecompress`.

### Turning compressed data into a string

```javascript
const packed = zlib.gzipSync('hello').toString(); // corrupts the bytes
```

Compressed data is binary. Keep it as a Buffer, or use `.toString('base64')` if you must store it as text.

### Hard-coding paths and line endings

```javascript
const file = '/tmp/report.txt'; // does not exist on Windows
```

Use `path.join(os.tmpdir(), 'report.txt')` and `os.EOL` so the same code works everywhere.

## Quick recap

- `os` describes the machine: `platform()`, `homedir()`, `tmpdir()`, `availableParallelism()`, `totalmem()`, `EOL`.
- `util.inspect(obj, { depth: null })` prints every level of a nested object.
- `util.promisify()` turns a callback function into a promise-returning one.
- `util.isDeepStrictEqual()` compares content; `util.styleText()` adds terminal colours.
- `zlib` compresses with gzip, deflate and Brotli (Zstandard is newer and experimental).
- Use `Sync` methods for small jobs, async or streams with `pipeline` for servers and big files.
- Compressed data is binary: keep it in Buffers.

<code id="code-content" class="language-javascript">
// toolbox.mjs: a quick tour of os, util and zlib
import os from 'node:os';
import util from 'node:util';
import zlib from 'node:zlib';
// --- os: facts about this machine
console.log(util.styleText('bold', 'System'));
console.log({
  platform: os.platform(),
  arch: os.arch(),
  cores: os.availableParallelism(),
  memoryGB: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
  tmp: os.tmpdir(),
  eol: JSON.stringify(os.EOL),
});
// --- util: inspect, format, compare, promisify
console.log(util.styleText('bold', 'util'));
const order = { id: 1, customer: { name: 'Asha', address: { city: 'Pune', geo: { lat: 18.5 } } } };
console.log(order); // stops at [Object]
console.log(util.inspect(order, { depth: null, compact: true })); // shows everything
console.log(util.format('%s ordered %d items', 'Asha', 3));
console.log(util.isDeepStrictEqual({ a: [1, 2] }, { a: [1, 2] })); // true
const sleep = util.promisify(setTimeout);
await sleep(100);
console.log('Waited 100 ms with a promisified setTimeout');
// --- zlib: compress and restore
console.log(util.styleText('bold', 'zlib'));
const notes = Array.from({ length: 100 }, (_, i) =&gt; ({ id: i + 1, title: `Note ${i + 1}`, done: false }));
const input = Buffer.from(JSON.stringify(notes));
const gzipped = zlib.gzipSync(input);
const brotli = zlib.brotliCompressSync(input);
console.log('JSON bytes:  ', input.length);
console.log('Gzip bytes:  ', gzipped.length);
console.log('Brotli bytes:', brotli.length);
const restored = JSON.parse(zlib.gunzipSync(gzipped).toString('utf8'));
console.log('Restored correctly:', util.isDeepStrictEqual(restored, notes)); // true
// Async version, for servers
const gzipAsync = util.promisify(zlib.gzip);
const packed = await gzipAsync('Hello, Maya');
console.log('Starts with gzip magic bytes:', packed.subarray(0, 2).toString('hex')); // 1f8b
</code></pre>
