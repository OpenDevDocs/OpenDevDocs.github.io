---
publishDate: 2026-10-25T10:10
title: Buffers and Binary Data
slug: buffers-and-binary-data
metadescription: Understand bytes and encodings in Node.js. Create Buffers, convert to hex and base64, slice safely, read and write numbers, and handle UTF-8 correctly.
updateDate: 2026-10-25T10:10
author: ['bishal-biswas']
level: 2
tags: ['buffer', 'binary', 'encoding']
course: nodejs
---

## Computers only store numbers

Everything on your computer, text, photos, music, is stored as **bytes**. A byte is a small number from 0 to 255.

Think of a row of post office boxes, each holding one number. A photo is a very long row of boxes. A text file is a row of boxes too, where each number stands for a letter. The rule that says which number means which letter is called an **encoding**.

A **Buffer** is Node's way of holding a row of raw bytes in memory. You use Buffers when you work with files, network data, images, hashes and anything else that is not plain text.

## Why not just use strings?

JavaScript strings are made for text. They are great for `'Hello, Asha'`, but they cannot safely hold an image or a zip file. Some byte patterns are not valid text at all.

A Buffer holds **any** bytes, exactly as they are. Node uses Buffers under the hood whenever it reads a file or receives data from the network without an encoding.

## Creating a Buffer

`Buffer` is available everywhere, but importing it from `node:buffer` makes your code clearer:

```javascript
// create.mjs
import { Buffer } from 'node:buffer';

const buf = Buffer.from('Hi Asha');
console.log(buf);
```

```text
<Buffer 48 69 20 41 73 68 61>
```

Each pair is one byte written in **hexadecimal** (base 16). `48` is the byte for `H`, `69` is `i`, `20` is a space, and so on.

There are three common ways to make a Buffer:

```javascript
Buffer.from('Hi');          // from a string (UTF-8 by default)
Buffer.from([72, 105]);     // from an array of byte values
Buffer.alloc(4);            // 4 bytes, all set to zero
```

```text
<Buffer 48 69>
<Buffer 48 69>
<Buffer 00 00 00 00>
```

> **Note:** You may also see `Buffer.allocUnsafe(size)`. It is faster because it skips filling the memory with zeros, so it can contain **old leftover data**. Only use it if you will overwrite every byte straight away. When in doubt, use `Buffer.alloc`.

## Reading bytes

A Buffer behaves a lot like an array of numbers:

```javascript
const buf = Buffer.from('Hi Asha');

console.log(buf.length); // prints: 7  (number of bytes)
console.log(buf[0]);     // prints: 72 (the byte for 'H')

for (const byte of Buffer.from('Hi')) {
  console.log(byte);     // prints: 72, then 105
}
```

In fact, a Buffer **is** a `Uint8Array` (a standard JavaScript typed array of bytes) with extra Node methods added:

```javascript
console.log(buf instanceof Uint8Array); // prints: true
console.log(Buffer.isBuffer(buf));      // prints: true
```

Each slot can only hold 0 to 255. Larger or negative values wrap around:

```javascript
const b = Buffer.alloc(2);
b[0] = 300; // 300 does not fit, so it becomes 300 - 256 = 44 (hex 2c)
b[1] = -1;  // becomes 255 (hex ff)
console.log(b); // prints: <Buffer 2c ff>
```

## Encodings: turning bytes into text

`buf.toString(encoding)` turns bytes into a string. `Buffer.from(string, encoding)` goes the other way.

```javascript
// encodings.mjs
import { Buffer } from 'node:buffer';

const buf = Buffer.from('Hi Asha');

console.log(buf.toString());         // Hi Asha
console.log(buf.toString('hex'));    // 48692041736861
console.log(buf.toString('base64')); // SGkgQXNoYQ==

console.log(Buffer.from('SGkgQXNoYQ==', 'base64').toString()); // Hi Asha
console.log(Buffer.from('48692041736861', 'hex').toString());  // Hi Asha
```

The encodings you will use most:

| Encoding | What it is | Used for |
| --- | --- | --- |
| `'utf8'` | The standard for text. The default. | Almost all text |
| `'hex'` | Each byte as two characters `0-9a-f` | Hashes, debugging |
| `'base64'` | Bytes as letters, digits, `+` and `/` | Sending binary data inside text, like JSON or email |
| `'base64url'` | Like base64 but with `-` and `_` and no `=` padding | URLs, tokens |
| `'latin1'` | One byte per character, old Western text | Old file formats |

```javascript
console.log(Buffer.from('hi?>').toString('base64'));    // prints: aGk/Pg==
console.log(Buffer.from('hi?>').toString('base64url')); // prints: aGk_Pg
```

## Characters are not bytes

In UTF-8, plain English letters take **1** byte each. Accented letters take **2**. Many symbols and emoji take **3 or 4**.

```javascript
const word = 'café 😊';

console.log(word.length);              // prints: 7  (JavaScript string length)
console.log(Buffer.byteLength(word));  // prints: 10 (bytes in UTF-8)
console.log(Buffer.from(word));
```

```text
<Buffer 63 61 66 c3 a9 20 f0 9f 98 8a>
```

`é` became two bytes (`c3 a9`) and the emoji became four (`f0 9f 98 8a`).

> **Tip:** When a web server sends a `Content-Length` header, it must be the number of **bytes**, not characters. Use `Buffer.byteLength(text)`, not `text.length`.

## Slicing with subarray

`buf.subarray(start, end)` gives you part of a Buffer. It does **not copy**. The new Buffer looks at the same memory, so changing one changes the other:

```javascript
// subarray.mjs
import { Buffer } from 'node:buffer';

const buf = Buffer.from('Hi Asha');
const name = buf.subarray(3, 7);
console.log(name.toString()); // prints: Asha

name[0] = 0x61;               // the byte for lowercase 'a'
console.log(buf.toString());  // prints: Hi asha
```

This is fast, but surprising. If you need an independent copy, wrap it in `Buffer.from()`:

```javascript
const copy = Buffer.from(buf.subarray(3, 7)); // a real copy
```

> **Note:** Older code uses `buf.slice()`. It does the same thing as `subarray()` and is deprecated in the docs, because `slice()` on a normal `Uint8Array` makes a copy. Use `subarray()` to avoid confusion.

## Joining, comparing and searching

```javascript
// helpers.mjs
import { Buffer } from 'node:buffer';

const full = Buffer.concat([Buffer.from('Hello, '), Buffer.from('Ravi')]);
console.log(full.toString()); // prints: Hello, Ravi

console.log(Buffer.from('abc').equals(Buffer.from('abc'))); // prints: true
console.log(Buffer.from('Hi Asha').indexOf('Asha'));        // prints: 3
console.log(Buffer.from('Hi Asha').includes('Ravi'));       // prints: false
```

`Buffer.concat` is what you use to collect chunks of data into one Buffer, which you will do often with streams.

## Reading and writing numbers

Binary file formats and network protocols store numbers in a fixed number of bytes. Buffers have methods to read and write them:

```javascript
// numbers.mjs
import { Buffer } from 'node:buffer';

const header = Buffer.alloc(8);
header.writeUInt16BE(500, 0);    // 2 bytes at position 0
header.writeUInt32LE(123456, 2); // 4 bytes at position 2
header.writeInt8(-5, 6);         // 1 signed byte at position 6
header.writeUInt8(255, 7);       // 1 byte at position 7

console.log(header);
console.log(header.readUInt16BE(0), header.readUInt32LE(2), header.readInt8(6), header.readUInt8(7));
```

```text
<Buffer 01 f4 40 e2 01 00 fb ff>
500 123456 -5 255
```

The names tell you everything:

- `UInt` means unsigned (0 and up). `Int` means it can be negative.
- `8`, `16`, `32` is the size in bits (1, 2 or 4 bytes).
- `BE` (**big-endian**) stores the biggest part first. `LE` (**little-endian**) stores the smallest part first. The file format you are reading tells you which one to use.

## Buffers and files

When you read a file **without** an encoding, you get a Buffer:

```javascript
import { readFile } from 'node:fs/promises';

const bytes = await readFile('photo.png'); // a Buffer
const text = await readFile('notes.txt', 'utf8'); // a string
```

Use a Buffer for images, PDFs, zip files and anything else that is not text. You can check the first few bytes to see what kind of file it is. PNG files always start with the bytes `89 50 4e 47`.

## TextEncoder and TextDecoder

Browsers do not have `Buffer`. They use `TextEncoder` and `TextDecoder` with plain `Uint8Array`s. Node has these as globals too, which is handy for code that must run in both places:

```javascript
const bytes = new TextEncoder().encode('Hi');
console.log(bytes); // prints: Uint8Array(2) [ 72, 105 ]

console.log(new TextDecoder().decode(bytes)); // prints: Hi
```

## Common mistakes

### Cutting a character in half

When data arrives in pieces, a multi-byte character can be split between two chunks. Converting each chunk on its own gives broken characters:

```javascript
// Wrong
const bytes = Buffer.from('😊'); // 4 bytes
console.log(bytes.subarray(0, 2).toString(), bytes.subarray(2).toString());
// prints: � ��
```

Collect the chunks and join them first with `Buffer.concat`, or use a `StringDecoder`, which holds back incomplete characters until the rest arrives:

```javascript
// Right
import { StringDecoder } from 'node:string_decoder';

const decoder = new StringDecoder('utf8');
console.log(decoder.write(bytes.subarray(0, 2))); // prints an empty line: waiting for more
console.log(decoder.write(bytes.subarray(2)));    // prints: 😊
```

Streams do this for you when you set an encoding, as you will see in [the Streams lesson](/courses/nodejs/streams-fundamentals).

### Using length for byte counts

```javascript
// Wrong: 7, but the text is 10 bytes
const size = 'café 😊'.length;
```

```javascript
// Right: 10
const size = Buffer.byteLength('café 😊');
```

### Expecting subarray to copy

Remember that `subarray` shares memory. If you keep a small piece of a huge Buffer, the whole huge Buffer stays in memory too. Copy with `Buffer.from(piece)` when you keep it for a long time.

### Printing a Buffer as JSON

```javascript
console.log(JSON.stringify(Buffer.from('Hi')));
// prints: {"type":"Buffer","data":[72,105]}
```

That is rarely what you want. Convert to a string first, for example `buf.toString('base64')`.

## Quick recap

- A **byte** is a number from 0 to 255. A **Buffer** is a fixed-size row of bytes.
- Create with `Buffer.from(...)` or `Buffer.alloc(size)`. Avoid `allocUnsafe` unless you fill it at once.
- `toString(encoding)` and `Buffer.from(string, encoding)` convert between bytes and text: `utf8`, `hex`, `base64`, `base64url`.
- Characters can take 1 to 4 bytes. Use `Buffer.byteLength` for sizes.
- `subarray` shares memory. Copy with `Buffer.from(...)` when needed.
- `Buffer.concat` joins chunks. `readUInt16BE` and friends read numbers from binary data.
- Reading a file without an encoding gives you a Buffer.

<code id="code-content" class="language-javascript">
// buffers.mjs: bytes, encodings and binary data
import { Buffer } from 'node:buffer';
import { writeFile, readFile } from 'node:fs/promises';
// Text to bytes and back again
const greeting = Buffer.from('Hi Asha');
console.log(greeting);                     // &lt;Buffer 48 69 20 41 73 68 61&gt;
console.log(greeting.toString('hex'));     // 48692041736861
console.log(greeting.toString('base64'));  // SGkgQXNoYQ==
console.log(Buffer.from('SGkgQXNoYQ==', 'base64').toString()); // Hi Asha
// Characters are not bytes: some take 2, 3 or 4 bytes in UTF-8
const word = 'café 😊';
console.log(word.length, 'characters,', Buffer.byteLength(word), 'bytes');
// subarray shares memory: changing it changes the original
const name = greeting.subarray(3);
name[0] = 0x61; // the byte for 'a'
console.log(greeting.toString()); // Hi asha
// Joining buffers
const full = Buffer.concat([Buffer.from('Hello, '), Buffer.from('Ravi')]);
console.log(full.toString());
// ---
// Writing and reading numbers in a binary "header"
const header = Buffer.alloc(6);  // 6 zero-filled bytes
header.writeUInt16BE(2026, 0);   // a year in 2 bytes, big-endian
header.writeUInt32LE(123456, 2); // an order id in 4 bytes, little-endian
console.log(header, header.readUInt16BE(0), header.readUInt32LE(2));
// Spot a file type from its first bytes (its "magic number")
const signatures = {
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  pdf: Buffer.from('%PDF'),
  zip: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
};
function detectType(bytes) {
  for (const [type, magic] of Object.entries(signatures)) {
    if (bytes.subarray(0, magic.length).equals(magic)) return type;
  }
  return 'unknown';
}
// Save some bytes to a file, then read them back without an encoding
await writeFile('fake.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const fileBytes = await readFile('fake.png'); // no 'utf8', so we get a Buffer
console.log('fake.png looks like:', detectType(fileBytes));
console.log('notes text looks like:', detectType(Buffer.from('Buy milk')));
</code></pre>
