---
publishDate: 2026-10-25T10:00
title: 'Observability: Metrics and OpenTelemetry Tracing'
slug: observability-and-opentelemetry
metadescription: Learn the three pillars of observability, expose Prometheus metrics from Express 5 with prom-client, and add distributed tracing with OpenTelemetry auto-instrumentation.
updateDate: 2026-10-25T10:00
author: ['bishal-biswas']
level: 4
tags: ['express', 'observability', 'opentelemetry', 'monitoring']
course: expressjs
---

## What you will learn

- What **observability** means and its three pillars: logs, metrics and traces
- How to expose **Prometheus metrics** from Express 5 with `prom-client`
- Which numbers to measure first (the **RED method**) and how to avoid label explosions
- How to add **distributed tracing** with OpenTelemetry, with almost no code changes
- How to add your own spans and connect logs to traces

## Why you need more than logs

Your API is live. One morning a user says "the app feels slow". Where do you start?

- Is it slow for everyone, or just them?
- Is it one route, or all of them?
- Is the time spent in your code, in MongoDB, or in a call to another service?

Logs alone struggle to answer these. You'd be searching thousands of lines by hand. **Observability** is the ability to understand what your system is doing from the outside, using the data it produces. It rests on three kinds of data, often called the **three pillars**.

Think of a car journey:

| Pillar | Car analogy | What it tells you | Example |
| --- | --- | --- | --- |
| **Logs** | The trip diary | What happened, event by event | `"Note 42 created by user 7"` |
| **Metrics** | The dashboard gauges | Numbers over time, cheap to keep | "95% of requests took under 120 ms" |
| **Traces** | GPS replay of one trip | The path of a single request through every step | "This request spent 800 ms waiting for MongoDB" |

You already set up logs in [Logging with Morgan and Pino](/courses/expressjs/logging-with-morgan-and-pino). This lesson adds the other two.

## Part 1: Metrics with prom-client

**Prometheus** is a popular open source monitoring system. Every few seconds it visits a `/metrics` URL on your app and stores the numbers it finds. This visit is called a **scrape**. Tools like **Grafana** then draw graphs and send alerts from that data.

`prom-client` is the Node.js library that produces the `/metrics` page.

```bash
npm install prom-client
```

### The three main metric types

| Type | What it is | Example |
| --- | --- | --- |
| **Counter** | A number that only goes up | Total requests, total notes created |
| **Gauge** | A number that goes up and down | Requests in progress, memory used |
| **Histogram** | Counts values into ranges (**buckets**) so you can work out percentiles | Request duration |

A **percentile** answers "how slow are the slowest requests?". The **p95** latency is the time that 95% of requests finish within. Averages hide the slow ones; percentiles show them.

### Setting up metrics

```js
// src/metrics.js
import client from 'prom-client';

// CPU, memory, event loop lag, garbage collection... for free
client.collectDefaultMetrics();

export const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const notesCreated = new client.Counter({
  name: 'notes_created_total',
  help: 'Number of notes created',
});

export const register = client.register;
```

**Labels** are extra details attached to a metric, like `route="/api/notes/:id"`. They let you slice the data later: "show me only the POST requests".

### A middleware that measures every request

```js
// src/middleware/metrics.js
import { httpDuration } from '../metrics.js';

export const metricsMiddleware = (req, res, next) => {
  const stopTimer = httpDuration.startTimer();

  // 'finish' fires after the response has been sent
  res.on('finish', () => {
    // Use the route PATTERN, never the raw URL (see the warning below)
    const route = req.route ? req.baseUrl + req.route.path : 'unmatched';
    stopTimer({ method: req.method, route, status_code: res.statusCode });
  });

  next();
};
```

`req.route` is set by Express when a route matched. For a route inside a router mounted at `/api/notes`, `req.baseUrl` is `/api/notes` and `req.route.path` is `/:id`.

### Exposing /metrics

```js
// src/app.js
import express from 'express';
import { metricsMiddleware } from './middleware/metrics.js';
import { register, notesCreated } from './metrics.js';

export const app = express();
app.use(metricsMiddleware);
app.use(express.json());

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.post('/api/notes', async (req, res) => {
  // ...save the note...
  notesCreated.inc(); // a business metric
  res.status(201).json({ id: '42' });
});

app.get('/api/notes/:id', async (req, res) => {
  res.json({ id: req.params.id, title: 'Hello' });
});
```

Make a few requests, then look at the metrics:

```bash
curl http://localhost:3000/api/notes/1
curl http://localhost:3000/metrics
```

```text
# HELP http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.01",method="GET",route="/api/notes/:id",status_code="200"} 1
http_request_duration_seconds_bucket{le="0.05",method="GET",route="/api/notes/:id",status_code="200"} 1
...
http_request_duration_seconds_sum{method="GET",route="/api/notes/:id",status_code="200"} 0.0021
http_request_duration_seconds_count{method="GET",route="/api/notes/:id",status_code="200"} 1
# HELP notes_created_total Number of notes created
# TYPE notes_created_total counter
notes_created_total 0
```

It's plain text, made for machines, but you can read it too.

> **Warning:** Never use `req.originalUrl` as a label. Every note ID would create a brand-new time series (`/api/notes/1`, `/api/notes/2`, ...). This is called **high cardinality**, and it can fill Prometheus's memory and slow everything down. Labels should have a small, fixed set of possible values.

### Keep /metrics private

Your metrics reveal route names and traffic levels. Don't expose them to the internet. Common options: block `/metrics` at your reverse proxy, or serve it from a second, internal-only port:

```js
// src/server.js
import express from 'express';
import { app } from './app.js';
import { register } from './metrics.js';

app.listen(3000, (error) => {
  if (error) throw error;
});

// A tiny separate app on an internal port, only Prometheus can reach it
const metricsApp = express();
metricsApp.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});
metricsApp.listen(9464, (error) => {
  if (error) throw error;
});
```

### Pointing Prometheus at your app

```yaml
# prometheus.yml
scrape_configs:
  - job_name: notes-api
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:9464']
```

### What to measure first: the RED method

A simple, popular starting point for any API is **RED**:

- **Rate:** how many requests per second.
- **Errors:** how many of them fail (status `5xx`).
- **Duration:** how long they take (p50, p95, p99).

The single histogram above gives you all three. In Prometheus's query language (PromQL), the p95 latency per route looks like this:

```text
histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m])))
```

You don't need to memorise PromQL now. Grafana dashboards for Node.js and `prom-client` are easy to find and import.

## Part 2: Tracing with OpenTelemetry

Metrics tell you *that* `/api/notes/:id` got slow. A **trace** tells you *why*, by recording the journey of one single request.

A trace is made of **spans**. A span is one timed step, such as "handle HTTP request" or "MongoDB find". Spans nest inside each other, like this:

```text
 Trace 4bf92f35...  GET /api/notes/42                      total 212 ms
 |-- span: middleware - jsonParser                           1 ms
 |-- span: request handler - /api/notes/:id                208 ms
 |   |-- span: mongodb.find notes                          185 ms   <- the slow part
 |   '-- span: GET http://users-service/users/7             19 ms
```

When one request crosses several services, they pass a **trace ID** along in an HTTP header called `traceparent`, so all their spans join one trace. This is **distributed tracing**.

```http
GET /users/7 HTTP/1.1
Host: users-service
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

**OpenTelemetry** (often shortened to **OTel**) is the open standard for producing traces, metrics and logs. It is vendor-neutral: you instrument once, then send the data to Jaeger, Grafana Tempo, Honeycomb, Datadog or many others.

### Installing

```bash
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node \
  @opentelemetry/instrumentation @opentelemetry/sdk-trace-node \
  @opentelemetry/exporter-trace-otlp-http @opentelemetry/api
```

> **Note:** Use recent versions of all the OpenTelemetry packages so the Express instrumentation recognises Express 5. Keep them on matching versions; the packages are released together.

### The instrumentation file

**Auto-instrumentation** means OpenTelemetry wraps popular libraries (Node's `http`, Express, MongoDB, PostgreSQL, Redis, Pino and more) to create spans automatically. To do that it must load **before** your app code. So we put it in its own file:

```js
// instrumentation.js
import { register } from 'node:module';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

// Lets OpenTelemetry hook into ES module imports
register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

// Print spans to the terminal locally, send them to a collector when one is configured
const traceExporter = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ? new OTLPTraceExporter()
  : new ConsoleSpanExporter();

const sdk = new NodeSDK({
  serviceName: 'notes-api',
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

Now start your app with Node's `--import` flag, which runs a module before the main file:

```bash
node --import ./instrumentation.js server.js
```

Put it in `package.json` so nobody forgets:

```json
{
  "scripts": {
    "start": "node --import ./instrumentation.js server.js"
  }
}
```

Call a route and watch the terminal. You'll see span objects printed, something like this (trimmed):

```text
{
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  name: 'GET /api/notes/:id',
  kind: 1,
  attributes: {
    'http.route': '/api/notes/:id',
    'http.response.status_code': 200,
    ...
  }
}
```

The exact attribute names depend on the package versions. The point is that you didn't change a single line of route code.

> **Note:** Support for ES modules in OpenTelemetry's auto-instrumentation is still marked experimental. It works well for common libraries, but check the OpenTelemetry JavaScript docs if a library you use isn't being traced.

### Seeing traces in Jaeger

Printing spans gets old quickly. **Jaeger** is a free tool that stores traces and shows them as timelines. You can run it locally with Docker:

```bash
docker run --rm -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest
```

Port `4318` receives traces using **OTLP** (the OpenTelemetry protocol over HTTP). Port `16686` is the web UI. Tell your app where to send traces:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 node --import ./instrumentation.js server.js
```

Make some requests, open `http://localhost:16686`, choose `notes-api`, and click a trace to see its timeline.

### Adding your own spans

Auto-instrumentation covers HTTP and database calls. For important business steps, add your own span with `@opentelemetry/api`:

```js
// src/services/notes.service.js
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('notes-service');

export const createNotesService = (notesRepo) => ({
  async importNotes(ownerId, notes) {
    return tracer.startActiveSpan('notes.import', async (span) => {
      try {
        span.setAttribute('notes.count', notes.length);
        const saved = [];
        for (const note of notes) {
          saved.push(await notesRepo.create({ ownerId, ...note }));
        }
        return saved;
      } catch (err) {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        throw err;
      } finally {
        span.end(); // always end the span, or it is never exported
      }
    });
  },
});
```

`startActiveSpan` makes this span the "current" one, so the database spans created inside it appear as its children.

> **Tip:** `@opentelemetry/api` does nothing when no SDK is loaded. Your tests run without `--import ./instrumentation.js`, and these calls simply become no-ops. No test changes needed.

> **Warning:** Never put secrets or personal data (passwords, tokens, full emails) into span attributes. Traces are often kept for days and viewed by many people.

### Connecting logs to traces

When the Pino instrumentation is active (it's part of the auto-instrumentations), OpenTelemetry adds the current trace ID to every log line written during a request:

```text
{"level":30,"msg":"Note created","trace_id":"4bf92f3577b34da6a3ce929d0e0e4736","span_id":"00f067aa0ba902b7","trace_flags":"01"}
```

Now you can jump from a suspicious log line straight to the full trace, and from a slow trace to its logs. This is where observability really pays off.

### Sampling and configuration

Recording every single request can be expensive at high traffic. **Sampling** means keeping only a portion of traces. OpenTelemetry reads standard environment variables, so you can configure it without code changes:

```bash
# .env (production)
OTEL_SERVICE_NAME=notes-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1
```

This keeps about 10% of traces, while respecting the decision of an upstream service (the "parentbased" part) so you never get half a trace.

> **Note:** In production, call `sdk.shutdown()` during your graceful shutdown so the last batch of spans is sent before the process exits.

## Common mistakes

> **Common mistake:** Importing the instrumentation file at the top of `server.js` instead of using `--import`. By then, Express and `http` may already be loaded, and they won't be traced.

> **Common mistake:** Using raw URLs or user IDs as metric labels. Use route patterns and small sets of values.

> **Common mistake:** Watching only averages. An average of 80 ms can hide 5% of users waiting 3 seconds. Track p95 and p99.

> **Common mistake:** Forgetting `span.end()` in your own spans. Use `try/finally` every time.

## Key takeaways

- **Observability** uses logs (events), metrics (numbers over time) and traces (one request's journey).
- `prom-client` exposes Prometheus metrics; a single duration histogram labelled by method, route and status gives you the **RED** signals.
- Label metrics with route **patterns**, never raw URLs, and keep `/metrics` private.
- **OpenTelemetry** auto-instrumentation, loaded with `node --import ./instrumentation.js`, traces HTTP, Express and databases without code changes.
- Add custom spans for key business steps, and let trace IDs in logs link everything together.
- Use **sampling** and standard `OTEL_*` environment variables to control cost in production.

## Practice

1. Add the metrics middleware to your Notes API and use `curl` to confirm the `/metrics` output changes as you make requests.
2. Add a gauge called `http_requests_in_progress` that goes up when a request starts and down when it finishes.
3. Run Jaeger with Docker, start your app with tracing, and find the slowest span in a request that reads from MongoDB.
4. Wrap one service method in a custom span and add an attribute that describes the work (for example, how many items were processed).

## What's next

Now that your app is observable, let's package it so it runs the same way everywhere. Continue with [Dockerising an Express API](/courses/expressjs/dockerising-an-express-api).
