---
publishDate: 2026-10-25T13:25
title: Serverless and Edge Runtimes
slug: serverless-and-edge-runtimes
metadescription: See how serverless and edge runtimes run Node code, from AWS Lambda handlers to Vercel, Netlify and Cloudflare Workers, plus cold starts and limits.
updateDate: 2026-10-25T13:25
author: ['bishal-biswas']
level: 4
tags: ['serverless', 'edge', 'cloud']
course: nodejs
---

## What is serverless?

In the last lesson you ran your own server: you kept it running, restarted it, scaled it. That is like owning a car. You pay for it even when it sits in the garage, and you take it for repairs.

**Serverless** is more like calling a taxi. You say where you want to go, a car appears, you pay for the trip, and it disappears. There are still servers, of course, but you never see or manage them.

With serverless, you write a **function**: a small piece of code that handles one request or event. The platform:

- starts a copy of it when a request arrives,
- runs as many copies as needed when traffic grows,
- shuts them down when traffic stops,
- bills you for the time your code actually runs.

## Serverless versus edge

There are two flavours you will hear about.

**Serverless functions** (AWS Lambda, Vercel Functions, Netlify Functions) run your code in a real Node.js runtime, usually in one region you pick. Almost every Node API works.

**Edge functions** (Cloudflare Workers, and edge options on other platforms) run in many locations around the world, close to each user. They start very fast because they use lightweight **V8 isolates**: separate sandboxes inside one shared process, instead of a whole Node process each. The price is that they are *not* full Node. They offer web-standard APIs plus a subset of Node's.

| | Serverless function | Edge function |
| --- | --- | --- |
| Runtime | Real Node.js | V8 isolate with web APIs |
| Location | One region (or a few) | Many cities worldwide |
| Start-up | Tens to hundreds of milliseconds | A few milliseconds |
| Node APIs | Nearly all | A subset |
| Good for | APIs, jobs, anything Node can do | Fast, light work close to users |

## The handler: your function's front door

Every platform calls one function you export, called the **handler**. Its shape differs per platform, but the idea is the same: an input comes in, you return a result.

### AWS Lambda

**AWS Lambda** is the original serverless platform. Your handler receives an **event** (a plain object describing what happened) and a **context** (information about the run):

```javascript
// index.mjs
export const handler = async (event, context) => {
  const name = event.queryStringParameters?.name ?? 'stranger';

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: `Hello, ${name}` }),
  };
};
```

- The event's shape depends on what triggered it. An HTTP request (through a Function URL or API Gateway) looks different from a file upload to S3 or a message from a queue.
- For HTTP, you return an object with `statusCode`, `headers` and a `body` **string**.
- Use an `async` handler and return the result. That is the modern style.

Lambda also triggers on things that are not web requests: a file landing in storage, a message on a queue, a timer. That is a big part of its appeal.

### Vercel and Netlify Functions

**Vercel** and **Netlify** are hosting platforms popular for websites. Both now let you write functions with the web-standard **`Request`** and **`Response`** objects, the same ones `fetch` uses (see [the fetch lesson](/courses/nodejs/fetch-undici-and-websocket)).

On Vercel, a file in the `api` folder exports a function per HTTP method:

```javascript
// api/hello.js (Vercel)
export function GET(request) {
  const name = new URL(request.url).searchParams.get('name') ?? 'stranger';
  return Response.json({ message: `Hello, ${name}` });
}
```

On Netlify, a file in `netlify/functions` exports a default function:

```javascript
// netlify/functions/hello.mjs (Netlify)
export default async (request, context) => {
  const name = new URL(request.url).searchParams.get('name') ?? 'stranger';
  return Response.json({ message: `Hello, ${name}` });
};

export const config = { path: '/hello' };
```

Notice how similar they are. Writing your logic against `Request` and `Response` makes it easy to move between platforms.

### Cloudflare Workers

**Cloudflare Workers** is the best-known edge platform. A Worker exports an object with a `fetch` method:

```javascript
// src/index.js (Cloudflare Worker)
export default {
  async fetch(request, env, ctx) {
    const name = new URL(request.url).searchParams.get('name') ?? 'stranger';
    return Response.json({ message: `Hello, ${name}` });
  },
};
```

- `env` holds your settings and secrets, and connections to Cloudflare services such as storage.
- `ctx.waitUntil(promise)` lets work (like sending a log) finish after the response has gone out.

Workers are configured in a `wrangler.json` (or `wrangler.toml`) file and run with the `wrangler` tool:

```json
{
  "name": "hello-worker",
  "main": "src/index.js",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat"]
}
```

```bash
npx wrangler dev      # run it locally
npx wrangler deploy   # put it live
```

The **`compatibility_date`** pins the runtime's behaviour to a date, so a platform update never changes your Worker unexpectedly.

### The nodejs_compat flag

By default, Workers only offer web APIs. The **`nodejs_compat`** flag turns on support for many Node built-in modules, so code and npm packages written for Node have a better chance of working:

```javascript
// Works in a Worker with nodejs_compat
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

const hash = createHash('sha256').update('hello').digest('hex');
const encoded = Buffer.from('Asha').toString('base64');
```

Support is broad but not complete. Some modules are only partly implemented, and some functions exist but throw when called. Always test with `wrangler dev`.

## What is missing at the edge

Edge runtimes trade power for speed and safety. Even with `nodejs_compat`, expect these limits:

- **No real disk.** At most you get a small virtual file system, and nothing you write survives beyond the current copy. Keep data in the platform's storage services instead.
- **No child processes.** `child_process` cannot start other programs.
- **No native addons.** Packages with compiled C++ code (see [the Native Addons lesson](/courses/nodejs/native-addons-and-node-api)) will not load.
- **No server of your own.** There is no port to listen on in the usual way. The platform owns the network and calls your handler for each request.
- **Tight CPU limits.** Each request gets a small budget of CPU time. Heavy work like image processing does not belong here.
- **Bundle size limits.** Your code and its dependencies must fit in a size limit.

> **Tip:** A good rule: put work that needs full Node (databases with native drivers, files, heavy computation) in a regular serverless function or server, and put light, latency-sensitive work (redirects, auth checks, personalised headers) at the edge.

## Cold starts

When no copy of your function is running and a request arrives, the platform must:

1. find a machine,
2. start a runtime,
3. load your code and run its top-level setup,
4. finally call your handler.

That delay is a **cold start**. Later requests that reuse the same running copy are **warm** and skip steps 1 to 3.

You can see this in code. Anything at the top of the module runs once per cold start:

```javascript
// Runs once per cold start
const startedAt = Date.now();
let calls = 0;

export const handler = async () => {
  calls++; // survives between warm calls on the same copy
  return { statusCode: 200, body: `call ${calls}, warm for ${Date.now() - startedAt} ms` };
};
```

### Making cold starts shorter

- **Keep your bundle small.** Less code to load means a faster start. Avoid huge dependencies for small jobs.
- **Do setup outside the handler.** Create database clients and read config at the top level, so warm calls reuse them.
- **Import heavy modules lazily.** Use `await import('...')` inside the code path that needs it.
- **Pay to stay warm.** Lambda's **provisioned concurrency** keeps copies running for you, at a cost.

Edge isolates start so quickly that cold starts are rarely a problem there.

## Gotchas specific to serverless

**Do not rely on memory between calls.** The `calls` counter above survives warm calls, but the platform can throw the copy away at any time, and parallel requests go to *different* copies. Use it for caching, never for important state.

**Database connections can run out.** A traditional server holds a small pool of database connections. Serverless can start hundreds of copies, each opening its own connections, until the database refuses more. Use a connection pooler or a database with an HTTP-based driver designed for serverless.

**Finish work before you return.** On Lambda, once your handler returns, the copy can be frozen. A promise you did not `await` may never complete.

```javascript
// Wrong: the log may never be sent
export const handler = async (event) => {
  sendAnalytics(event); // not awaited
  return { statusCode: 200, body: 'ok' };
};
```

```javascript
// Right: wait for it (or use ctx.waitUntil on Workers)
export const handler = async (event) => {
  await sendAnalytics(event);
  return { statusCode: 200, body: 'ok' };
};
```

**Time limits.** Functions have a maximum run time. Long jobs belong in a queue and a worker, or in a container.

## When to choose what

- **A small API or webhook with uneven traffic:** serverless functions are cheap and simple.
- **Global, latency-sensitive, light logic:** edge functions.
- **Steady high traffic, WebSockets, long-running work, or heavy CPU:** a container or server, as in the Docker and Deploying lessons.

Many real systems mix all three.

## Quick recap

- Serverless means you write functions and the platform runs, scales and bills them per use.
- Serverless functions run real Node in a region; edge functions run in V8 isolates close to users with a subset of Node.
- A Lambda handler takes `(event, context)` and returns `{ statusCode, headers, body }`.
- Vercel, Netlify and Cloudflare Workers use web-standard `Request` and `Response`.
- Cloudflare's `nodejs_compat` flag enables many Node modules, but not files, child processes, native addons or listening servers.
- A cold start is the delay to start a new copy; keep bundles small and do setup at the top level.

<code id="code-content" class="language-javascript">
// portable-function.mjs: one piece of logic, written with web-standard
// Request/Response, wrapped for Cloudflare Workers, Vercel/Netlify and AWS Lambda.
// --- Module scope: runs once per cold start, then is reused while warm ---
const coldStartAt = Date.now();
let invocations = 0;
const notes = [
  { id: 1, title: 'Buy milk', author: 'Asha' },
  { id: 2, title: 'Book train', author: 'Ravi' },
  { id: 3, title: 'Water plants', author: 'Asha' },
];
// --- The app: only web APIs (Request, Response, URL), so it runs anywhere ---
async function app(request) {
  invocations++;
  const url = new URL(request.url);
  if (url.pathname !== '/notes') return new Response('Not found', { status: 404 });
  const author = url.searchParams.get('author');
  const result = author ? notes.filter((n) =&gt; n.author === author) : notes;
  return Response.json({ notes: result, warm: invocations &gt; 1, invocations });
}
// --- Cloudflare Workers style: export an object with a fetch method ---
export default { fetch: (request, env, ctx) =&gt; app(request) };
// --- Vercel style: export a function per HTTP method that takes a Request ---
export const GET = app;
// --- AWS Lambda style (Function URL / HTTP API event, payload v2) ---
export const handler = async (event) =&gt; {
  const query = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const request = new Request(`https://${event.headers.host}${event.rawPath}${query}`, {
    method: event.requestContext.http.method,
  });
  const response = await app(request);
  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers),
    body: await response.text(),
  };
};
// --- Local demo: call each entry point the way its platform would ---
const fromWorker = await (await app(new Request('https://example.com/notes?author=Asha'))).json();
console.log('Worker-style :', fromWorker.notes.map((n) =&gt; n.title), 'warm:', fromWorker.warm);
const lambdaEvent = {
  rawPath: '/notes', rawQueryString: 'author=Ravi',
  headers: { host: 'abc123.lambda-url.eu-west-1.on.aws' },
  requestContext: { http: { method: 'GET' } },
};
const fromLambda = await handler(lambdaEvent);
console.log('Lambda-style :', fromLambda.statusCode, fromLambda.body);
console.log(`Same instance served ${invocations} calls, ${Date.now() - coldStartAt} ms after its cold start`);
</code></pre>
