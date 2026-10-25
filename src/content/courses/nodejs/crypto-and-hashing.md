---
publishDate: 2026-10-25T10:55
title: The crypto Module and Hashing
slug: crypto-and-hashing
metadescription: Use Node's crypto module to hash data and files, sign messages with HMAC, make secure random ids, store passwords with scrypt and encrypt with AES-GCM.
updateDate: 2026-10-25T10:55
author: ['bishal-biswas']
level: 2
tags: ['crypto', 'security', 'hashing', 'passwords']
course: nodejs
---

## What is the crypto module for?

Security code is like a lock on your front door: you do not build your own, you buy a well-tested one. The `node:crypto` module is Node's box of well-tested locks. It wraps **OpenSSL**, the same library that secures most of the internet.

In this lesson you will use it for five everyday jobs:

1. **Hashing**: making a fingerprint of some data.
2. **HMAC**: proving a message came from someone who knows a secret.
3. **Random values**: ids and tokens nobody can guess.
4. **Password storage** with scrypt.
5. **Encryption**: hiding data so only the key holder can read it.

```javascript
import { createHash, createHmac, randomUUID, randomBytes, scrypt } from 'node:crypto';
```

## Hashing: a fingerprint for data

A **hash function** turns any amount of data into a short, fixed-size string called a **hash** or **digest**. Think of it as a fingerprint:

- The same input always gives the same hash.
- A tiny change in the input gives a completely different hash.
- You cannot turn the hash back into the input.

```javascript
import { createHash } from 'node:crypto';

const hash = createHash('sha256').update('Hello, Asha').digest('hex');
console.log(hash);

console.log(createHash('sha256').update('Hello, asha').digest('hex'));
```

```text
820ae51e135c1553ceeb2a9b59ab3b82723bf3490d798082dda451275ff1bed5
d62070c0e6124c0eba4f2c3981385c45cf0e9748f11268d6b29feb39c3709ae9
```

Changing one capital letter changed every character. The three steps are:

- `createHash('sha256')` picks the **algorithm**. SHA-256 is the safe default.
- `.update(data)` feeds in data. You can call it several times; the result is the same as one big update.
- `.digest('hex')` finishes and returns the hash as text. `'base64'` gives a shorter string.

For a quick one-off hash, `crypto.hash()` does all three in one call:

```javascript
import { hash } from 'node:crypto';
console.log(hash('sha256', 'Hello, Asha')); // same 820ae5... as above
```

`crypto.hash()` was added in Node 21.7 and the docs mark it stable from Node 24.13.1.

### Hashing a file

Hashes are great for checking a download is not corrupted, or for spotting duplicate files. A hash object is also a writable stream, so you can pipe a file into it without loading the whole file into memory:

```javascript
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

async function hashFile(path) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

console.log(await hashFile('notes.txt'));
```

The result matches what `sha256sum notes.txt` prints on Linux.

> **Note:** You will still meet MD5 and SHA-1 (`createHash('md5')`). They are fine as quick checksums, but they are **broken for security**: people can craft two inputs with the same hash. Use SHA-256 or stronger.

## HMAC: a hash with a secret

A plain hash proves data did not change by accident. It does not prove *who* sent it, since anyone can compute a SHA-256.

An **HMAC** mixes a secret key into the hash. Only someone who knows the key can produce the right value. Payment providers use this to sign **webhooks**, the HTTP requests they send to your server: they sign the body with a secret you share, and you check the signature.

```javascript
import { createHmac, timingSafeEqual } from 'node:crypto';

function isValidSignature(body, signature, secret) {
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

const secret = 'my-webhook-secret';
const signature = '257e73765c585279643cf1026c7cf222c57644046152fb6919a1ad8f8a286311';

console.log(isValidSignature('{"orderId":42}', signature, secret)); // true
console.log(isValidSignature('{"orderId":43}', signature, secret)); // false
```

### Why `timingSafeEqual` and not `===`?

`===` stops at the first character that differs, so a wrong guess that starts correctly takes a tiny bit longer to reject. An attacker can measure that and guess a signature one character at a time. `timingSafeEqual()` always takes the same time. It throws if the two Buffers have different lengths, which is why the length check comes first.

## Secure random values

`Math.random()` is fine for games, but it is predictable. For anything security related, use the crypto versions:

```javascript
import { randomUUID, randomBytes, randomInt } from 'node:crypto';

console.log(randomUUID());                         // ab99c0d4-7660-40cd-a036-cd33de47a574
console.log(randomBytes(16).toString('hex'));      // cc3dd6a20eec45ffc82ce61f0619603c
console.log(randomBytes(32).toString('base64url')); // JxjQuwyZ9vci2Clt3Qvs9PPX0BmImHhofLdVuQ7bUjw
console.log(randomInt(1, 7));                      // a dice roll: 1 to 6
```

Your output will differ every time, of course.

- `randomUUID()` makes a **UUID**, a standard 36-character id. Great for database ids and file names.
- `randomBytes(n)` gives `n` random bytes. Turn them into text with `'hex'` or `'base64url'` for session tokens, password reset links and API keys. 32 bytes is a good size for a token.
- `randomInt(min, max)` gives a whole number from `min` up to, but not including, `max`.

> **Tip:** `crypto.randomUUID()` and `crypto.getRandomValues()` also exist on the global `crypto` object, the browser-compatible **Web Crypto API**. The same code then works in browsers too.

## Storing passwords with scrypt

Never store passwords as plain text. But a plain SHA-256 is not enough either. SHA-256 is designed to be *fast*, and fast is bad here: an attacker who steals your database can try billions of guesses per second.

Password hashing needs a function that is deliberately **slow** and memory hungry, plus a **salt**: a random value stored next to each hash so that two users with the same password get different hashes. Node has one built in: **scrypt**.

```javascript
// passwords.mjs
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt); // turn the callback API into a promise
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt}:${key.toString('hex')}`; // store this one string
}

export async function verifyPassword(password, stored) {
  const [salt, keyHex] = stored.split(':');
  const storedKey = Buffer.from(keyHex, 'hex');
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return timingSafeEqual(key, storedKey);
}

const stored = await hashPassword('correct horse battery staple');
console.log(stored);
console.log(await verifyPassword('correct horse battery staple', stored)); // true
console.log(await verifyPassword('password123', stored));                  // false
```

```text
5ddaa6352d71f0f1ec546b398790e328:2569e33559674808c5ea95c30a7ac5e9176ce8d...
true
false
```

How it works:

- When a user signs up, make a new salt, run scrypt and save `salt:hash` in the database.
- When they log in, split the saved string, run scrypt again with the **same salt** and compare.
- You never decrypt anything. You only check that the same password gives the same result.

Use the async `scrypt`, not `scryptSync`, in servers. It is slow on purpose, and the async version runs on Node's thread pool so it does not block other requests.

> **Note:** Node 24.7 also added `crypto.argon2()`, another modern password hashing function. It is still new, so this lesson sticks with scrypt, which has been part of Node for years. Packages such as `bcrypt` are also popular.

## Encryption with AES-GCM

Hashing is one way. **Encryption** is two way: with the right **key** you can get the original back. Use it for data you need to read later, like a stored API token.

**AES-256-GCM** is a solid modern choice. It encrypts the data and also adds an **auth tag** that detects any tampering.

```javascript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const key = randomBytes(32); // 256-bit key: in a real app, load it from an environment variable

function encrypt(text) {
  const iv = randomBytes(12); // a fresh random value for every message
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // proves the data was not changed
  return [iv, tag, encrypted].map((b) => b.toString('base64')).join('.');
}

function decrypt(payload) {
  const [iv, tag, encrypted] = payload.split('.').map((s) => Buffer.from(s, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

const secret = encrypt('Ravi lives at 12 Park Road');
console.log(secret);          // three base64 parts joined with dots
console.log(decrypt(secret)); // Ravi lives at 12 Park Road
```

The **IV** (initialisation vector) is not secret, so it is stored alongside the result. It must be new for every message. If someone changes even one byte of the encrypted text, `decipher.final()` throws `Unsupported state or unable to authenticate data`.

## Common mistakes

### Hashing passwords with SHA-256

```javascript
const stored = createHash('sha256').update(password).digest('hex'); // too fast, no salt
```

Use `scrypt` with a random salt, as shown above.

### Using `Math.random()` for tokens

```javascript
const token = Math.random().toString(36).slice(2); // guessable
```

Use `randomBytes(32).toString('base64url')` instead.

### Comparing secrets with `===`

```javascript
if (signature === expected) { /* ... */ } // leaks timing information
```

Use `timingSafeEqual()` on two Buffers of the same length.

### Reusing an IV

```javascript
const iv = Buffer.alloc(12); // the same zeros every time: breaks AES-GCM's security
```

Call `randomBytes(12)` for every single message.

## Quick recap

- `node:crypto` wraps OpenSSL. Use it rather than writing your own security code.
- `createHash('sha256').update(data).digest('hex')` makes a fingerprint; pipe files into it.
- MD5 and SHA-1 are fine as checksums but broken for security.
- `createHmac(algorithm, secret)` signs messages; check signatures with `timingSafeEqual()`.
- `randomUUID()` for ids, `randomBytes(32)` for tokens, never `Math.random()`.
- Store passwords with async `scrypt` and a random salt per user, saved as `salt:hash`.
- AES-256-GCM encrypts and detects tampering. Use a fresh IV for every message.

<code id="code-content" class="language-javascript">
// crypto-demo.mjs: hashing, HMAC, random values, passwords and encryption
import { createHash, createHmac, timingSafeEqual, randomUUID, randomBytes, scrypt, createCipheriv, createDecipheriv } from 'node:crypto';
import { promisify } from 'node:util';
// 1. Hash: same input, same fingerprint
const fingerprint = (text) =&gt; createHash('sha256').update(text).digest('hex');
console.log(fingerprint('Hello, Asha'));
console.log(fingerprint('Hello, Asha') === fingerprint('Hello, asha')); // false
// 2. HMAC: sign a message, then verify it in constant time
const secret = 'my-webhook-secret';
const sign = (body) =&gt; createHmac('sha256', secret).update(body).digest('hex');
function verify(body, signature) {
  const a = Buffer.from(sign(body));
  const b = Buffer.from(signature);
  return a.length === b.length &amp;&amp; timingSafeEqual(a, b);
}
const signature = sign('{"orderId":42}');
console.log('Signature ok?', verify('{"orderId":42}', signature)); // true
console.log('Tampered ok?', verify('{"orderId":99}', signature)); // false
// 3. Secure random values
console.log('UUID:', randomUUID());
console.log('Token:', randomBytes(32).toString('base64url'));
// ---
// 4. Passwords: slow scrypt with a random salt, stored as salt:hash
const scryptAsync = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [salt, keyHex] = stored.split(':');
  const key = await scryptAsync(password, salt, 64);
  return timingSafeEqual(key, Buffer.from(keyHex, 'hex'));
}
const stored = await hashPassword('correct horse battery staple');
console.log('Right password:', await verifyPassword('correct horse battery staple', stored)); // true
console.log('Wrong password:', await verifyPassword('password123', stored)); // false
// ---
// 5. Encryption: AES-256-GCM with a fresh IV per message
const key = randomBytes(32);
function encrypt(text) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), data };
}
function decrypt({ iv, tag, data }) {
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
const box = encrypt('Ravi lives at 12 Park Road');
console.log('Encrypted:', box.data.toString('hex'));
console.log('Decrypted:', decrypt(box));
</code></pre>
