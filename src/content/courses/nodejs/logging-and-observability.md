---
publishDate: 2026-10-25T12:35
title: Logging and Structured Observability
slug: logging-and-observability
metadescription: Move beyond console.log with log levels, structured JSON logs, child loggers, request IDs, redaction and pino, so you can see what your app does in production.
updateDate: 2026-10-25T12:35
author: ['bishal-biswas']
level: 3
tags: ['logging', 'observability', 'pino', 'json']
course: nodejs
---

## Why logs matter

A ship's captain keeps a logbook: the time, the position, the weather, anything unusual. When something goes wrong at sea, the logbook is how everyone works out what happened.

Your server needs the same. In production you cannot attach a debugger or watch the terminal. **Logs** are the written record your app leaves behind, and they are often the only way to answer "what happened at 3:12 a.m.?"

**Observability** is how well you can understand a running system from the outside. It usually rests on three kinds of data:

- **Logs**: individual events ("order 42 failed: card declined").
- **Metrics**: numbers over time ("120 requests per second, 2% errors").
- **Traces**: the path of one request through your services, step by step.

This lesson is about logs. Traces come next, in [the OpenTelemetry Tracing lesson](/courses/nodejs/opentelemetry-tracing).

## Where logs should go

You met the console in [the Console and Debugging Basics lesson](/courses/nodejs/console-and-debugging-basics). Remember which stream each method uses:

- `console.log()` and `console.info()` write to **stdout** (standard output).
- `console.error()` and `console.warn()` write to **stderr** (standard error).

In modern deployments, your app should simply write logs to stdout and stderr. Docker, Kubernetes, systemd and cloud platforms collect those streams and ship them to a log store. Your app should not manage log files, rotate them or upload them itself.

## Why console.log is not enough

```javascript
console.log('User ' + user.name + ' placed order ' + order.id + ' for ' + total);
```

```text
User Asha placed order 42 for 19.99
```

That reads fine for a human, once. Now imagine ten million lines from twenty servers:

- There is **no timestamp**, so you cannot tell when it happened.
- There is **no level**, so errors look the same as chatter.
- It is **free text**, so finding every order over 100 means writing fragile text searches.
- Logging an object with `console.log` prints it across several lines, which log collectors split into separate, broken entries.

## Structured logging

**Structured logging** means each log entry is data, not a sentence. The usual format is one JSON object per line, sometimes called **NDJSON** (newline-delimited JSON):

```json
{"level":"info","time":"2026-10-25T08:30:00.000Z","msg":"Order placed","orderId":42,"user":"asha","total":19.99}
```

Now your log tool can answer questions such as "show every `error` with `orderId` 42" or "average `total` per hour", without any text parsing.

## Log levels

A **log level** says how important an entry is. Most Node loggers use this ladder:

| Level | Use it for |
| --- | --- |
| `trace` | Extremely detailed steps, almost never on |
| `debug` | Details useful while developing or investigating |
| `info` | Normal, important events: server started, order placed |
| `warn` | Something odd that did not break anything: a retry, a slow query |
| `error` | An operation failed: a request returned 500 |
| `fatal` | The app cannot continue and is about to exit |

You set a **minimum level**, and anything below it is skipped. Production usually runs at `info`. When investigating, you switch to `debug` with an environment variable, without touching code:

```bash
LOG_LEVEL=debug node server.js
```

## A tiny structured logger, no installs

Building a small logger yourself is the best way to see how real ones work.

```javascript
// logger.mjs
const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };

export function createLogger({ level = 'info', base = {} } = {}) {
  const min = LEVELS[level];

  function write(levelName, fields, msg) {
    if (LEVELS[levelName] < min) return; // below the minimum level: skip
    const entry = { level: levelName, time: new Date().toISOString(), ...base, ...fields, msg };
    const stream = LEVELS[levelName] >= LEVELS.warn ? process.stderr : process.stdout;
    stream.write(JSON.stringify(entry) + '\n'); // one JSON object per line
  }

  const logger = {};
  for (const name of Object.keys(LEVELS)) {
    logger[name] = (fields, msg) => write(name, fields, msg);
  }
  // a child logger adds fields to every entry it writes
  logger.child = (extra) => createLogger({ level, base: { ...base, ...extra } });
  return logger;
}
```

```javascript
// app.mjs
import { createLogger } from './logger.mjs';

const log = createLogger({ level: process.env.LOG_LEVEL ?? 'info', base: { service: 'orders' } });

log.info({ orderId: 42, total: 19.99 }, 'Order placed');
log.debug({ cacheHit: true }, 'Cache lookup'); // skipped at info level

const reqLog = log.child({ requestId: 'r-7f3a' });
reqLog.warn({ ms: 1250 }, 'Slow database query');
```

```text
{"level":"info","time":"2026-10-25T08:30:00.000Z","service":"orders","orderId":42,"total":19.99,"msg":"Order placed"}
{"level":"warn","time":"2026-10-25T08:30:00.004Z","service":"orders","requestId":"r-7f3a","ms":1250,"msg":"Slow database query"}
```

Notice the pattern: **fields first, message second**. The message stays short and constant ("Order placed"), and the changing details live in fields you can search.

### Child loggers

A **child logger** is a copy of a logger with extra fields baked in. Create one per request or per job, and every line it writes carries the same `requestId` without you repeating it.

### Logging errors properly

`JSON.stringify(new Error('Boom'))` gives `{}`, because an error's `message` and `stack` are not normal enumerable properties. Turn errors into plain objects first:

```javascript
function serializeError(error) {
  return { type: error.name, message: error.message, stack: error.stack, code: error.code };
}

log.error({ err: serializeError(new Error('Card declined')) }, 'Payment failed');
```

### Never log secrets

Passwords, tokens, API keys, full card numbers and most personal data must never reach your logs. Logs are copied to many places and kept for a long time. **Redaction** replaces sensitive values before writing:

```javascript
const SECRET_KEYS = new Set(['password', 'token', 'authorization', 'cardNumber']);

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SECRET_KEYS.has(k) ? '[Redacted]' : redact(v)]),
    );
  }
  return value;
}

console.log(JSON.stringify(redact({ user: 'asha', password: 'hunter2' })));
// {"user":"asha","password":"[Redacted]"}
```

## Request IDs with AsyncLocalStorage

When a server handles many requests at once, their log lines interleave. A **request ID** (also called a correlation ID) on every line lets you pull out the story of one request.

Passing a child logger through every function is tedious. [The AsyncLocalStorage lesson](/courses/nodejs/asynclocalstorage) showed how to keep per-request data available across `await`s. Combine the two:

```javascript
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const requestContext = new AsyncLocalStorage();

// a helper that always returns the right logger for the current request
function getLog() {
  return requestContext.getStore()?.log ?? log;
}

function handle(req, res) {
  const requestId = req.headers['x-request-id'] ?? randomUUID();
  requestContext.run({ log: log.child({ requestId }) }, async () => {
    getLog().info({ method: req.method, url: req.url }, 'Request started');
    // ...any function called from here can use getLog()
  });
}
```

Reusing an incoming `x-request-id` header means the same ID can follow a request across several services.

## pino: the common choice

Writing your own logger is great for learning. In real projects most Node teams use **pino**, a fast structured logger with the same ideas you just built.

```bash
npm install pino
```

```javascript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: ['user.password'], // paths to hide
});

logger.info({ orderId: 42 }, 'Order placed');

const child = logger.child({ requestId: 'r-1' });
child.warn({ user: { name: 'Asha', password: 'x' } }, 'Slow request');
child.error(new Error('Boom'));
```

```text
{"level":30,"time":1792926503311,"pid":7376,"hostname":"build-box","orderId":42,"msg":"Order placed"}
{"level":40,"time":1792926503312,"pid":7376,"hostname":"build-box","requestId":"r-1","user":{"name":"Asha","password":"[Redacted]"},"msg":"Slow request"}
{"level":50,"time":1792926503312,"pid":7376,"hostname":"build-box","requestId":"r-1","err":{"type":"Error","message":"Boom","stack":"Error: Boom\n    at ..."},"msg":"Boom"}
```

pino writes levels as numbers (30 is `info`, 40 `warn`, 50 `error`) and time as epoch milliseconds, which is compact and fast to process. It serialises errors for you.

JSON is hard to read in a terminal, so during development pipe it through **pino-pretty**:

```bash
node app.js | npx pino-pretty
```

For HTTP servers, **pino-http** logs every request and response with timing and a request ID. **winston** is another popular logger with a different, more configurable style.

## Quick debug output with util.debuglog

For debug messages that are off unless someone asks, Node has `util.debuglog`. It prints only when the `NODE_DEBUG` environment variable includes your section name:

```javascript
import { debuglog } from 'node:util';

const debug = debuglog('orders');
debug('loaded %d orders', 3);
```

```bash
NODE_DEBUG=orders node app.mjs
```

```text
ORDERS 5980: loaded 3 orders
```

Without `NODE_DEBUG`, it prints nothing. Node uses the same mechanism internally: try `NODE_DEBUG=http`.

## Beyond logs

Logs tell you *what happened*. To see *how much* and *how fast*, add **metrics**: request counts, error rates, response time percentiles and memory, usually scraped by a tool such as Prometheus. To see *where time went inside one request*, add **traces**, covered in the next lesson. A good rule: if you find yourself counting log lines to make a graph, that number should be a metric.

## Common mistakes

**Building messages with string concatenation.** `'Order ' + id + ' failed'` buries the ID in text. Use `log.error({ orderId: id }, 'Order failed')`.

**Logging secrets.** Never log full request headers or bodies without redaction. `authorization` and `cookie` headers carry credentials.

**Logging too much.** A log line inside a tight loop can slow your app and flood your log bill. Log events, not every iteration.

**Using different field names everywhere.** Pick `orderId` or `order_id` and stick to it, or searches miss half your data.

**Leaving debug level on in production.** It is noisy and can expose more detail than you intend. Turn it on briefly, then off.

## Quick recap

- Write logs to stdout and stderr; let the platform collect them.
- Structured logs are one JSON object per line, with fields first and a short constant message.
- Levels (`debug`, `info`, `warn`, `error`) plus a minimum level control the noise.
- Child loggers and AsyncLocalStorage put a request ID on every line.
- Serialise errors explicitly and redact secrets before writing.
- pino is the common production logger; pipe through pino-pretty during development.
- Logs, metrics and traces together give you observability.

<code id="code-content" class="language-javascript">
// logging-demo.mjs: structured JSON logs, levels, child loggers, request IDs, redaction
import http from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
const LEVELS = { debug: 20, info: 30, warn: 40, error: 50 };
const SECRET_KEYS = new Set(['password', 'token', 'authorization']);
const redact = (value) =&gt; Array.isArray(value) ? value.map(redact)
  : value &amp;&amp; typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([k, v]) =&gt; [k, SECRET_KEYS.has(k) ? '[Redacted]' : redact(v)]))
    : value;
function createLogger(level = 'info', base = {}) {
  const write = (name, fields, msg) =&gt; {
    if (LEVELS[name] &lt; LEVELS[level]) return;
    if (fields instanceof Error) fields = { err: { type: fields.name, message: fields.message } };
    const entry = { level: name, time: new Date().toISOString(), ...base, ...redact(fields), msg };
    (LEVELS[name] &gt;= LEVELS.warn ? process.stderr : process.stdout).write(JSON.stringify(entry) + '\n');
  };
  const logger = { child: (extra) =&gt; createLogger(level, { ...base, ...extra }) };
  for (const name of Object.keys(LEVELS)) logger[name] = (fields = {}, msg = '') =&gt; write(name, fields, msg);
  return logger;
}
const log = createLogger(process.env.LOG_LEVEL ?? 'info', { service: 'orders-api' });
const context = new AsyncLocalStorage();
const getLog = () =&gt; context.getStore() ?? log; // the current request's logger
async function placeOrder(body) {
  getLog().debug({ body }, 'Validating order'); // hidden unless LOG_LEVEL=debug
  if (!body.item) throw new Error('Missing item');
  return { id: 42, item: body.item };
}
const server = http.createServer((req, res) =&gt; {
  const requestId = req.headers['x-request-id'] ?? randomUUID();
  context.run(log.child({ requestId }), async () =&gt; {
    const started = performance.now();
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const order = await placeOrder(JSON.parse(body));
      getLog().info({ orderId: order.id, user: JSON.parse(body).user }, 'Order placed');
      res.writeHead(201).end(JSON.stringify(order));
    } catch (error) {
      getLog().error(error, 'Order failed');
      res.writeHead(400).end();
    }
    getLog().info({ status: res.statusCode, ms: Math.round(performance.now() - started) }, 'Request finished');
  });
});
server.listen(0, async () =&gt; {
  const url = `http://localhost:${server.address().port}/orders`;
  log.info({ port: server.address().port }, 'Server started');
  const user = { name: 'Asha', password: 'hunter2' }; // the password must not be logged
  await fetch(url, { method: 'POST', headers: { 'x-request-id': 'req-1' }, body: JSON.stringify({ item: 'book', user }) });
  await fetch(url, { method: 'POST', body: JSON.stringify({ user }) }); // fails: no item
  server.close(() =&gt; log.info({}, 'Server stopped'));
});
</code></pre>
