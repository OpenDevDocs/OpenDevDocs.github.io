---
publishDate: 2026-10-25T12:15
title: Monitoring, Logging and Alerting
slug: monitoring-logging-and-alerting
metadescription: Learn how to see what production is doing, metrics, logs and traces, the golden signals, Prometheus and Grafana, structured logging, OpenTelemetry, SLIs, SLOs and error budgets, and alerts that are worth waking up for.
updateDate: 2026-10-25T12:15
author: ['bishal-biswas']
level: 2
tags: ['devops', 'monitoring', 'observability', 'prometheus', 'alerting']
course: devops
---

## You cannot fix what you cannot see

Your pipeline tests every change, and your deployment strategy limits the damage of a bad one. But production still surprises you: a slow database query that only appears with real data, a third-party API having a bad day, a disk slowly filling up, a memory leak that takes three days to crash the app.

Without visibility, you find out about these from **angry users**. With good monitoring, you find out **first**, often before users notice, and you can see exactly what went wrong.

This is the **Monitor** stage of the [DevOps loop](/courses/devops/software-delivery-lifecycle), and the **feedback** in the [Three Ways](/courses/devops/devops-principles). It is what makes fast, frequent releases safe.

## Monitoring and observability

You will hear two words:

- **Monitoring** watches for **known** problems: "alert me if the error rate goes above 5%" or "if the disk is 90% full".
- **Observability** is how well you can understand **unknown** problems from the outside: "why are checkouts slow, but only for users in one region, and only since Tuesday?"

Monitoring answers questions you thought of in advance. Observability lets you ask new ones during an incident. Both are built from the same three kinds of data.

## The three pillars

| Pillar | What it is | Answers | Example |
|---|---|---|---|
| **Metrics** | Numbers measured over time | "How much? How fast? Is it getting worse?" | 120 requests per second, 1.5% errors, p95 latency 180 ms |
| **Logs** | Records of individual events | "What exactly happened to this request?" | `level=error msg="database timeout" request_id=f8c0...` |
| **Traces** | The path of one request through every service | "Where did the time go?" | Checkout took 2.1 s: 1.9 s of it waiting on the payment service |

Metrics tell you **that** something is wrong. Logs and traces tell you **why**.

## Metrics

A **metric** is a named number, measured again and again, so it becomes a **time series**. Metrics usually have **labels** that let you slice them:

```text
http_requests_total{route="/orders", status="500"}  28
```

There are three basic types:

| Type | Behaviour | Examples |
|---|---|---|
| **Counter** | Only goes up (resets when the app restarts) | Requests served, errors, bytes sent |
| **Gauge** | Goes up and down | Memory in use, queue length, temperature |
| **Histogram** | Counts values into ranges (**buckets**) | Request durations, response sizes |

Histograms are how you measure **latency** properly. Averages hide pain: if 95 requests take 50 ms and 5 take 4 seconds, the average looks fine at about 250 ms, but one user in twenty is having a terrible time. **Percentiles** show it: **p95** is the time that 95% of requests beat. Track p95 or p99, not the average.

### What to measure

You could measure thousands of things. Start with the ones that tell you whether **users** are happy. Google's SRE book calls them the **four golden signals**:

| Signal | Question |
|---|---|
| **Latency** | How long do requests take? (Track failed requests separately: a fast error is still an error.) |
| **Traffic** | How much demand is there? Requests per second. |
| **Errors** | What share of requests fail? |
| **Saturation** | How "full" is the system? CPU, memory, disk, connection pools, queue lengths. |

Two shorter checklists are popular too: **RED** (Rate, Errors, Duration) for every **service**, and **USE** (Utilisation, Saturation, Errors) for every **resource**, such as a disk or CPU.

### Prometheus and Grafana

The most widely used open-source metrics stack is:

- **Prometheus**, which regularly **scrapes** (pulls) metrics from a `/metrics` web page that each app exposes, stores them as time series, and evaluates alert rules. **Exporters** provide metrics for things you did not write, such as `node_exporter` for Linux servers and exporters for PostgreSQL, nginx and more.
- **Grafana**, which turns those metrics into **dashboards**.

You query Prometheus with **PromQL**. Two queries you will use constantly:

```text
# Error rate over the last 5 minutes, as a fraction
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))

# 95th percentile latency over the last 5 minutes
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))
```

`rate(...[5m])` turns an ever-growing counter into "per second, averaged over the last 5 minutes", which is what you actually care about. Every cloud has its own equivalent service too: CloudWatch, Azure Monitor, Google Cloud Monitoring.

> **Note:** Keep label values to a small, fixed set, such as route names and status codes. Never use user IDs, email addresses or full URLs as labels: each unique value creates a new time series, and millions of them (high **cardinality**) will overwhelm your monitoring system. Put that kind of detail in logs instead.

## Logs

Logs are the detailed story of individual events. A few rules make them far more useful.

### Structured logs

Write logs as **structured** data, usually one JSON object per line, not free-form sentences:

```text
Bad:   ERROR: Order 4512 failed for user asha@example.com after 2034ms (db timeout)
Good:  {"time":"2026-10-25T13:42:36Z","level":"error","msg":"order failed","order_id":4512,"duration_ms":2034,"reason":"db timeout","request_id":"f8c04191"}
```

Structured logs can be **searched and filtered** by field ("all errors on `/orders` slower than 1 second in the last hour"), not just grepped.

### Levels

Use levels consistently: `debug` (detail for developers, usually off in production), `info` (normal events), `warn` (something odd, but handled), `error` (something failed). Make the level configurable, as in [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets).

### Request IDs

Give every request a unique **request ID**, include it in every log line about that request, and pass it on to other services in a header. Then one search shows the whole story of one user's failed checkout across every service it touched.

### Where logs go

- Apps in containers should log to **stdout and stderr**, never to files inside the container ([Docker Essentials](/courses/devops/docker-essentials)).
- A collector ships them to a **central log store**, such as Grafana **Loki**, the **Elastic Stack**, or your cloud's logging service, so you can search all servers at once and logs survive when containers are replaced.
- Set a **retention** period: logs are useful, but storing everything forever is expensive.

> **Note:** Logs are read by many people and kept for a long time. **Never log secrets**, and avoid personal data such as email addresses and full card numbers, or mask them, as the config loader in the previous lesson does.

## Traces

In a system with many services, one user request might pass through a gateway, an orders service, a payments service and a database. When it is slow, which one is to blame?

**Distributed tracing** records each step as a **span**, with start time and duration, all linked by one **trace ID** that is passed along in a header (the W3C standard header is called `traceparent`). A tracing tool then draws the whole request as a timeline:

```text
POST /checkout                       ████████████████████████  2100 ms
  ├─ orders-service                  ███                        180 ms
  │    └─ postgres SELECT            ██                         120 ms
  └─ payments-service                   ████████████████████  1900 ms
       └─ HTTP call to bank API             ███████████████████  1850 ms   <- here
```

**OpenTelemetry** (OTel) is the open, vendor-neutral standard for producing traces, metrics and logs. You add its SDK to your app once, and send the data to whichever backend you like: Jaeger or Grafana Tempo for traces, Prometheus for metrics, or a commercial tool. It has become the default choice for new projects.

## SLIs, SLOs and error budgets

How reliable should a service be? "100%" is the wrong answer: it is impossible, and chasing it would stop you shipping anything. Site Reliability Engineering gives a better way to decide:

- An **SLI** (Service Level **Indicator**) is a measurement of user experience: "the share of checkout requests that succeed in under 500 ms".
- An **SLO** (Service Level **Objective**) is the target for it: "99.9% over 30 days".
- An **SLA** (Service Level **Agreement**) is a **contract** with customers, with penalties if missed. It is usually looser than the SLO, so you get warned before you owe anyone money.

The gap between the SLO and 100% is your **error budget**. With 99.9% over 30 days, you may fail 0.1% of the time: about **43 minutes** a month.

| SLO | Allowed "bad" time per 30 days |
|---|---|
| 99% | about 7 hours 12 minutes |
| 99.9% | about 43 minutes |
| 99.99% | about 4 minutes |

The budget turns arguments into decisions. Plenty of budget left? Ship faster, take more risks. Budget nearly spent? Slow down, focus on reliability. It connects directly to the [DORA metrics](/courses/devops/dora-metrics): speed and stability, managed together.

## Alerting

An **alert** is monitoring that interrupts a person. That makes it expensive, so every alert should earn its place.

Good alerts are:

- **About symptoms users feel**, not internal causes. "Checkout error rate above 5%" is a good page. "CPU at 85%" usually is not: high CPU that hurts nobody is just a busy server.
- **Actionable.** If the person paged cannot do anything about it, it should not wake them.
- **Urgent, or not a page.** Things that need fixing this week, such as "disk will be full in 5 days", become a ticket or a chat message, not a 3 a.m. phone call.
- **Linked to a runbook**: a short page saying what the alert means and the first steps to take.

Too many noisy alerts cause **alert fatigue**: people start ignoring them, and the one real alert is missed. Review alerts regularly and delete or fix any that fire without needing action.

In Prometheus, alert rules are written in YAML:

```yaml
groups:
  - name: recipe-api
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
            / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m                    # must stay true for 5 minutes: ignore brief blips
        labels:
          severity: page
        annotations:
          summary: "recipe-api error rate is above 5%"
          runbook_url: "https://wiki.example.com/runbooks/recipe-api-errors"
```

A companion tool, **Alertmanager**, groups related alerts, silences them during planned maintenance, and routes them: pages to the on-call person's phone through a tool such as PagerDuty, and lower-priority alerts to a chat channel.

### Check from the outside too

Also run **synthetic checks**: a service outside your own infrastructure that requests your site's key pages every minute, from several countries, like a robot user. It catches problems your internal monitoring cannot see, such as DNS failures, expired certificates ([HTTP, HTTPS and TLS](/courses/devops/http-https-and-tls)) or a whole region being unreachable.

## Logs, metrics and alerts in one script

The code panel for this lesson is a small Node.js app, using only built-in modules, that shows all of this working together. It:

- serves an `/orders` API and writes a **structured JSON log line** for every request, with a request ID;
- records a **counter** of requests by status and a **latency histogram**;
- exposes them at `/metrics` in the **Prometheus text format**;
- sends 200 requests on a normal day, then 200 more after a **bad release**, and evaluates two **alert rules** after each window: error rate below 5%, and p95 latency of at most 0.25 seconds.

```bash
node observe.mjs
```

```text
--- Phase 1: a normal day (200 requests). First log lines:
{"time":"2026-10-25T13:42:34.404Z","level":"info","msg":"request","route":"/orders","status":200,"duration_ms":23,"request_id":"72bea747"}
{"time":"2026-10-25T13:42:34.405Z","level":"info","msg":"request","route":"/orders","status":200,"duration_ms":23,"request_id":"d30fa30f"}
Alerts:
  error rate     0.5%  (rule: below 5%)        OK
  p95 latency    <= 0.1s  (rule: at most 0.25s)  OK

--- Phase 2: a bad release goes out (200 requests). First error log line:
{"time":"2026-10-25T13:42:36.172Z","level":"error","msg":"request","route":"/orders","status":500,"duration_ms":24,"request_id":"f8c04191"}
Alerts:
  error rate     13.5%  (rule: below 5%)        FIRING
  p95 latency    <= 1s  (rule: at most 0.25s)  FIRING

--- What Prometheus would scrape from /metrics:
# TYPE http_requests_total counter
http_requests_total{route="/orders",status="200"} 372
http_requests_total{route="/orders",status="500"} 28
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.05"} 205
http_request_duration_seconds_bucket{le="0.1"} 381
http_request_duration_seconds_bucket{le="0.25"} 381
http_request_duration_seconds_bucket{le="0.5"} 384
http_request_duration_seconds_bucket{le="1"} 400
http_request_duration_seconds_bucket{le="+Inf"} 400
http_request_duration_seconds_sum 29.311
http_request_duration_seconds_count 400
```

The traffic is random, so your numbers will differ a little. Notice how the alert rules look only at **what changed during each window**, just as PromQL's `rate()` does, and how the histogram buckets are **cumulative**: each bucket counts every request at least that fast. In a real system you would use the official Prometheus client library for your language instead of writing the format by hand.

## Common misunderstandings

### "More dashboards means better monitoring"

Twenty dashboards nobody looks at help nobody. Start with one per service showing the golden signals, and alerts for the few things that truly need a human.

### "We will add monitoring after launch"

Launch is exactly when you need it most. Instrument metrics, structured logs and a health check from the first version; it costs little when the code is new.

### "Logging everything is safest"

Logging everything is expensive, slow to search and a privacy risk. Log meaningful events with useful fields, at the right level.

## Quick recap

- Monitoring watches for **known** problems; observability helps you understand **new** ones.
- The three pillars: **metrics** (numbers over time), **logs** (individual events) and **traces** (one request's path).
- Watch the **golden signals**: latency (use percentiles), traffic, errors and saturation.
- **Prometheus** scrapes `/metrics`; **Grafana** draws dashboards; **OpenTelemetry** is the open standard for instrumenting apps.
- Write **structured logs** with request IDs to stdout, and never log secrets.
- Set **SLOs** and spend the **error budget** wisely.
- Alert on **user-facing symptoms**, make every page actionable, and link a runbook.

Next, you will learn what to do when the alert fires in [Incident Response and Blameless Postmortems](/courses/devops/incident-response-and-postmortems).

<code id="code-content" class="language-javascript">
// observe.mjs: the three pillars in one small app: logs, metrics and alerts.
// It serves an /orders API, writes a JSON log line per request, exposes Prometheus
// metrics at /metrics, then sends traffic and checks two alert rules after each phase.
// Run it with: node observe.mjs
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
// ---------- Metrics: counters and a latency histogram, kept in memory ----------
const BUCKETS = [0.05, 0.1, 0.25, 0.5, 1];               // seconds
const requests = new Map();                              // "route|status" -&gt; count
const latency = { buckets: BUCKETS.map(() =&gt; 0), count: 0, sum: 0 };
function record(route, status, seconds) {
  const key = `${route}|${status}`;
  requests.set(key, (requests.get(key) ?? 0) + 1);
  BUCKETS.forEach((le, i) =&gt; { if (seconds &lt;= le) latency.buckets[i]++; });
  latency.count++;
  latency.sum += seconds;
}
function metricsText() {                                 // Prometheus text format
  const lines = ['# TYPE http_requests_total counter'];
  for (const [key, n] of requests) {
    const [route, status] = key.split('|');
    lines.push(`http_requests_total{route="${route}",status="${status}"} ${n}`);
  }
  lines.push('# TYPE http_request_duration_seconds histogram');
  BUCKETS.forEach((le, i) =&gt; lines.push(`http_request_duration_seconds_bucket{le="${le}"} ${latency.buckets[i]}`));
  lines.push(`http_request_duration_seconds_bucket{le="+Inf"} ${latency.count}`);
  lines.push(`http_request_duration_seconds_sum ${latency.sum.toFixed(3)}`);
  lines.push(`http_request_duration_seconds_count ${latency.count}`);
  return lines.join('\n') + '\n';
}
// ---------- Logs: one JSON object per line, to stdout ----------
let printLogs = 0;                                       // only print a few, to keep output short
let printErrors = 0;
const log = (level, fields) =&gt; {
  const show = printLogs-- &gt; 0 || (level === 'error' &amp;&amp; printErrors-- &gt; 0);
  if (show) console.log(JSON.stringify({ time: new Date().toISOString(), level, ...fields }));
};
// ---------- The app: "behaviour" changes when a bad release goes out ----------
let behaviour = { errorRate: 0.01, slowRate: 0.02 };
const server = http.createServer(async (req, res) =&gt; {
  if (req.url === '/metrics') return res.end(metricsText());
  const start = performance.now();
  const requestId = randomUUID().slice(0, 8);
  await sleep(Math.random() &lt; behaviour.slowRate ? 400 + Math.random() * 400 : 10 + Math.random() * 60);
  const status = Math.random() &lt; behaviour.errorRate ? 500 : 200;
  res.statusCode = status;
  res.end(status === 200 ? '{"orders":[]}' : '{"error":"database timeout"}');
  const seconds = (performance.now() - start) / 1000;
  record('/orders', status, seconds);
  log(status &gt;= 500 ? 'error' : 'info', { msg: 'request', route: '/orders', status, duration_ms: Math.round(seconds * 1000), request_id: requestId });
});
await new Promise((resolve) =&gt; server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
// ---------- Alerting: compare what changed in this window against the rules ----------
let previous = { total: 0, errors: 0, buckets: BUCKETS.map(() =&gt; 0) };
function evaluateAlerts() {
  const total = latency.count - previous.total;
  const errors = [...requests].filter(([k]) =&gt; k.endsWith('|500')).reduce((s, [, n]) =&gt; s + n, 0);
  const windowErrors = errors - previous.errors;
  const windowBuckets = latency.buckets.map((n, i) =&gt; n - previous.buckets[i]);
  previous = { total: latency.count, errors, buckets: [...latency.buckets] };
  const errorRate = (100 * windowErrors) / total;
  const p95 = BUCKETS.find((_, i) =&gt; windowBuckets[i] &gt;= 0.95 * total) ?? Infinity;
  console.log(`  error rate     ${errorRate.toFixed(1)}%  (rule: below 5%)        ${errorRate &lt; 5 ? 'OK' : 'FIRING'}`);
  console.log(`  p95 latency    &lt;= ${p95}s  (rule: at most 0.25s)  ${p95 &lt;= 0.25 ? 'OK' : 'FIRING'}`);
}
async function traffic(count) {
  for (let i = 0; i &lt; count; i += 20) {                  // 20 requests at a time
    await Promise.all(Array.from({ length: 20 }, () =&gt; fetch(`${base}/orders`).then((r) =&gt; r.text())));
  }
}
console.log('--- Phase 1: a normal day (200 requests). First log lines:');
printLogs = 2;
await traffic(200);
console.log('Alerts:');
evaluateAlerts();
console.log('\n--- Phase 2: a bad release goes out (200 requests). First error log line:');
printErrors = 1;
behaviour = { errorRate: 0.12, slowRate: 0.1 };
await traffic(200);
console.log('Alerts:');
evaluateAlerts();
console.log('\n--- What Prometheus would scrape from /metrics:');
console.log(await (await fetch(`${base}/metrics`)).text());
server.close();
</code></pre>
