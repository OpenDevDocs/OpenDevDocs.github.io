---
publishDate: 2026-10-25T12:40
title: OpenTelemetry Tracing in Node
slug: opentelemetry-tracing
metadescription: Follow a request through your Node services with OpenTelemetry. Learn traces, spans and context, set up the SDK and auto-instrumentation, and add your own spans.
updateDate: 2026-10-25T12:40
author: ['bishal-biswas']
level: 3
tags: ['opentelemetry', 'tracing', 'observability']
course: nodejs
---

## What is tracing?

When you send a parcel, the courier scans it at every stop: picked up, arrived at the hub, out for delivery, delivered. If it is late, the tracking page shows exactly which leg was slow.

**Distributed tracing** does the same for a request. A user clicks "Place order". The request hits your API, which checks the cache, queries the database, calls a payment service and sends an email. A trace records each of those steps, how long each took and which one failed.

Logs, from [the previous lesson](/courses/nodejs/logging-and-observability), tell you *what* happened. Traces tell you *where the time went*.

## The vocabulary

- A **trace** is the whole journey of one request. It has a **trace ID** shared by every step.
- A **span** is one step in that journey: "GET /orders", "SELECT orders", "POST to payments". Each span has a name, a start time, a duration, a **span ID** and a status (OK or error).
- Spans form a tree. The first span is the **root span**. A span started inside another is its **child**, and it records its **parent span ID**.
- **Attributes** are key-value details on a span, such as `http.response.status_code: 200` or `app.order_id: 42`.
- **Context propagation** is how the trace ID travels. Inside one process it follows your async code. Between services it travels in an HTTP header called `traceparent` (the **W3C Trace Context** standard).

```text
trace 4bf92f35...
└─ GET /orders           (server, 120 ms)
   ├─ redis GET          (client,   2 ms)
   ├─ pg SELECT orders   (client,  85 ms)   <- the slow part
   └─ loadNotes          (internal, 20 ms)
```

## What is OpenTelemetry?

**OpenTelemetry** (often shortened to **OTel**) is an open, vendor-neutral standard for traces, metrics and logs, with official libraries for most languages. You instrument your code once, then send the data to whichever tool you like: Jaeger, Zipkin, Grafana Tempo, or a commercial service. Most of them accept OpenTelemetry's own wire format, called **OTLP**.

The Node pieces you will meet:

| Package | Job |
| --- | --- |
| `@opentelemetry/api` | The small API your code calls to create spans. Libraries depend on this too. |
| `@opentelemetry/sdk-node` | The engine: collects spans, batches them and sends them to an exporter. |
| `@opentelemetry/auto-instrumentations-node` | Patches popular modules (http, fetch, Express, pg, Redis and many more) so they create spans for you. |
| `@opentelemetry/sdk-trace` | Tracing building blocks such as `ConsoleSpanExporter`. |

> **Note:** OpenTelemetry JS moves quickly. `@opentelemetry/sdk-node` is still marked experimental, and with the 3.x releases in October 2026 the tracing classes moved to `@opentelemetry/sdk-trace`. Older tutorials import them from `@opentelemetry/sdk-trace-base` or `@opentelemetry/sdk-trace-node`, which are now deprecated. Pin your versions and check the package READMEs when you upgrade.

## Option 1: zero-code setup

The fastest start needs no code changes at all. Install the auto-instrumentation package:

```bash
npm install @opentelemetry/api @opentelemetry/auto-instrumentations-node
```

Configure it with environment variables and load its `register` file before your app:

```bash
export OTEL_SERVICE_NAME="orders-api"
export OTEL_TRACES_EXPORTER="otlp"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
node --require @opentelemetry/auto-instrumentations-node/register app.js
```

- `OTEL_SERVICE_NAME` is the name your service shows up under. Always set it.
- `OTEL_EXPORTER_OTLP_ENDPOINT` is where traces are sent. Port 4318 is the standard OTLP over HTTP port.

### Somewhere to look at traces

You need a backend to receive and display traces. For local development, Jaeger runs as a single container with a web UI:

```bash
docker run --rm -p 16686:16686 -p 4318:4318 jaegertracing/jaeger
```

Open `http://localhost:16686`, pick your service, and you will see each request as a timeline of spans.

## Option 2: set up the SDK in code

For more control, create a small setup file that starts the SDK before anything else loads:

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/sdk-trace @opentelemetry/auto-instrumentations-node
```

```javascript
// instrumentation.mjs
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  serviceName: 'orders-api',
  // print spans to the terminal; leave this out to use OTLP (the default)
  traceExporter: new ConsoleSpanExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// flush any buffered spans before the process exits
process.on('SIGTERM', async () => {
  await sdk.shutdown();
  process.exit(0);
});
```

`ConsoleSpanExporter` prints each finished span as an object with its `traceId`, `parentSpanContext`, `name`, `kind`, `duration`, `attributes` and `status`. It is perfect for learning. Spans are batched, so they appear a few seconds after the work finishes. In production, remove `traceExporter` and the SDK sends OTLP to the endpoint in `OTEL_EXPORTER_OTLP_ENDPOINT`.

### Loading it first

The SDK can only patch a module if it starts **before** that module is loaded. Use Node's preload flags rather than importing the file from your app.

For a CommonJS app, a CommonJS setup file loaded with `--require` is enough:

```bash
node --require ./instrumentation.cjs app.js
```

For an **ES module** app, the `import` statements need an extra loader hook so OpenTelemetry can patch them. The hook ships in `@opentelemetry/instrumentation` (installed with the auto-instrumentations) and is still **experimental**:

```bash
node --experimental-loader=@opentelemetry/instrumentation/hook.mjs --import ./instrumentation.mjs app.mjs
```

Node prints an `ExperimentalWarning` about `--experimental-loader`. Without the hook, some spans still appear (for example the built-in `fetch` client, which is traced through Node's diagnostics channels), but server spans for `import`ed modules are missing and your trace falls apart into disconnected pieces. Check the OpenTelemetry JS ESM support guide when you upgrade, as this area is changing.

## Adding your own spans

Auto-instrumentation covers the edges of your app: incoming requests, outgoing HTTP, database calls. Your own business logic is invisible until you add spans for it.

```javascript
// orders.mjs
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('orders-api');

export async function loadNotes(userId) {
  return tracer.startActiveSpan('loadNotes', async (span) => {
    try {
      span.setAttribute('app.user_id', userId);
      const notes = await db.query('SELECT * FROM notes WHERE user_id = $1', [userId]);
      span.setAttribute('app.note_count', notes.length);
      return notes;
    } catch (error) {
      span.recordException(error); // attach the error and stack to the span
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end(); // always end the span, success or failure
    }
  });
}
```

- `trace.getTracer(name)` gets a **tracer**, the object that creates spans. Use your service or module name.
- `startActiveSpan` creates a span and makes it the **active** one, so spans created inside it (including auto-instrumented database spans) become its children.
- `span.end()` records the end time. A span that never ends is never exported.

Your code only depends on `@opentelemetry/api`. If the SDK is not started, the API quietly does nothing, so the same code runs fine in tests.

## Linking logs to traces

A log line becomes far more useful when it carries the trace ID: from a trace you jump to its logs, and from an error log to its trace.

```javascript
import { trace } from '@opentelemetry/api';

function traceFields() {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const { traceId, spanId } = span.spanContext();
  return { traceId, spanId };
}

log.info({ ...traceFields(), orderId: 42 }, 'Order placed');
```

The auto-instrumentations include integrations for pino and winston that add the trace and span IDs to log records for you.

## Sampling: you do not need every trace

A busy service can produce millions of spans per minute. **Sampling** keeps a fraction of traces to control cost. The standard environment variables:

```bash
# keep 10% of new traces, but always follow the decision of an incoming parent
export OTEL_TRACES_SAMPLER="parentbased_traceidratio"
export OTEL_TRACES_SAMPLER_ARG="0.1"
```

"Parent based" matters across services: if the calling service kept a trace, yours keeps its part too, so you never get half a trace.

## Common mistakes

**Starting the SDK too late.** If `http` or `express` is loaded before `sdk.start()`, they are not patched and you get no spans. Always preload with `--require` or `--import`.

**Forgetting `span.end()`.** Put it in `finally`, as above.

**Putting IDs in span names.** A span named `GET /orders/42` creates a new name for every order. Use a stable name (`GET /orders/:id`) and put `42` in an attribute.

**Losing spans on exit.** Spans are sent in batches. Call `sdk.shutdown()` when stopping, as you will do properly in [the Graceful Shutdown lesson](/courses/nodejs/graceful-shutdown).

**Putting secrets in attributes.** Traces are stored and shared like logs. The redaction rules from the logging lesson apply here too.

## Quick recap

- A trace is one request's journey; spans are its steps, linked by parent IDs.
- Context propagates through async code inside a process and through the `traceparent` header between services.
- OpenTelemetry is the vendor-neutral standard; OTLP is its wire format.
- `@opentelemetry/sdk-node` plus `@opentelemetry/auto-instrumentations-node` trace HTTP, databases and more with little code.
- Preload the setup file; ES module apps also need the experimental loader hook.
- Add your own spans with `tracer.startActiveSpan()`, record errors, and always call `span.end()`.
- Sample in production, and shut the SDK down cleanly to flush spans.

<code id="code-content" class="language-javascript">
// tracing-demo.mjs
// npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/sdk-trace @opentelemetry/auto-instrumentations-node
// Run: OTEL_METRICS_EXPORTER=none OTEL_LOGS_EXPORTER=none node tracing-demo.mjs
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { createRequire } from 'node:module';
// 1. Start the SDK before loading the modules it should patch
const sdk = new NodeSDK({
  serviceName: 'notes-api',
  traceExporter: new ConsoleSpanExporter(), // prints finished spans
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();
// Loaded with require AFTER start, so the http module gets patched
const http = createRequire(import.meta.url)('node:http');
const tracer = trace.getTracer('notes-api');
// 2. A manual span around business logic
async function loadNotes(userId) {
  return tracer.startActiveSpan('loadNotes', async (span) =&gt; {
    try {
      span.setAttribute('app.user_id', userId);
      await new Promise((resolve) =&gt; setTimeout(resolve, 20)); // pretend database call
      if (userId === 'nobody') throw new Error('No such user');
      return [{ id: 1, text: 'Buy milk' }];
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end(); // always end the span
    }
  });
}
// 3. An auto-instrumented server: each request gets a SERVER span
const server = http.createServer(async (req, res) =&gt; {
  const userId = new URL(req.url, 'http://x').searchParams.get('user');
  try {
    const notes = await loadNotes(userId); // becomes a child of the request span
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(notes));
  } catch {
    res.writeHead(404).end();
  }
});
server.listen(0, async () =&gt; {
  const base = `http://localhost:${server.address().port}`;
  // fetch creates CLIENT spans and sends the traceparent header for us
  console.log((await fetch(`${base}/notes?user=asha`)).status);
  console.log((await fetch(`${base}/notes?user=nobody`)).status);
  server.close();
  await sdk.shutdown(); // flush the batched spans so they print before exit
});
</code></pre>
