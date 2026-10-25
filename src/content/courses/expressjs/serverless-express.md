---
publishDate: 2026-10-25T10:05
title: Serverless Express and Edge Runtimes
slug: serverless-express
metadescription: Learn how serverless works, run an Express 5 app on AWS Lambda and Vercel, understand cold starts and limits, and see why edge runtimes need a different framework.
updateDate: 2026-10-25T10:05
author: ['bishal-biswas']
level: 4
tags: ['express', 'serverless', 'aws-lambda', 'deployment']
course: expressjs
---

## What you will learn

- What **serverless** means, and how it differs from running a normal server
- How to run an existing Express 5 app on **AWS Lambda** with `@codegenie/serverless-express`
- How to deploy the same app as a **Vercel** function
- The serverless gotchas: **cold starts**, timeouts, database connections and lost background work
- What **edge runtimes** are, why Express doesn't run on them as-is, and where Hono fits

## What does "serverless" mean?

There are still servers, of course. **Serverless** means *you* don't manage them. You upload your code, and the cloud provider runs it only when a request arrives. You pay per request (and per millisecond of running time) instead of paying for a server that sits idle at 3 a.m.

Think of transport:

| Option | Analogy | In hosting terms |
| --- | --- | --- |
| Your own server or container | Owning a car | Always on, always paid for, you maintain it |
| Serverless functions | Taking a taxi | Appears when you need it, you pay per trip, no maintenance |
| Edge functions | A bike-share dock on every corner | Tiny, starts instantly, very close to you, but carries less |

The most common serverless product is **Functions as a Service (FaaS)**: AWS Lambda, Google Cloud Run functions, Azure Functions, Vercel Functions and Netlify Functions.

### How a request flows

```text
 Client
   |
   v
 API Gateway / platform router     turns the HTTP request into an "event"
   |
   v
 +--------------------------------------------+
 | Function instance                          |
 |   handler(event)                           |
 |     |                                      |
 |     v                                      |
 |   adapter: event  ->  Node req/res         |
 |     |                                      |
 |     v                                      |
 |   your Express app (routes, middleware)    |
 |     |                                      |
 |     v                                      |
 |   adapter: res  ->  response object        |
 +--------------------------------------------+
   |
   v
 Client gets an ordinary HTTP response
```

Platforms like AWS Lambda don't give your code a real HTTP request. They hand your function an **event**: a JSON object describing the request. An **adapter** library converts that event into the `req` and `res` objects Express expects, then converts Express's response back. Your routes don't know the difference.

## The good and the not-so-good

| Benefits | Trade-offs |
| --- | --- |
| No servers to patch or scale | **Cold starts** add delay to some requests |
| Scales automatically from zero to many instances | Time limits per request |
| Pay only for what you use; cheap for low or spiky traffic | Expensive for constant high traffic compared to a server |
| Each instance is isolated | No long-lived connections (WebSockets, long SSE streams) |
| | In-memory state is not shared and can vanish at any time |

### Cold starts

When no instance is running, the platform must start one: download your code, start Node.js, import your modules and run your setup code. That first request is a **cold start**. Later requests that reuse the same instance are **warm** and much faster.

```text
 Request 1  [ start Node | import app | connect DB | handle ]   <- cold
 Request 2                                         [ handle ]   <- warm, reuses everything
 Request 3                                         [ handle ]   <- warm
 ... no traffic for a while, the instance is shut down ...
 Request 4  [ start Node | import app | connect DB | handle ]   <- cold again
```

To keep cold starts short: install fewer and smaller dependencies, avoid heavy work at import time, and connect to the database once per instance (not once per request). AWS also sells **provisioned concurrency**, which keeps instances warm for a fee.

## Prepare the app

The good news: if you've followed this course, your app is already almost ready. The key pattern is the one from [Testing with Supertest](/courses/expressjs/testing-with-supertest): **`app.js` builds the app, and only `server.js` calls `app.listen()`.** On serverless there is no `listen`; the platform calls your function instead.

```js
// app.js
import express from 'express';
import helmet from 'helmet';

export const app = express();

app.use(helmet());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from a function' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});
```

```js
// server.js (for local development and normal servers)
import { app } from './app.js';

const port = Number(process.env.PORT) || 3000;
app.listen(port, (error) => {
  if (error) throw error;
  console.log(`Listening on http://localhost:${port}`);
});
```

You keep developing locally with `node --watch server.js` exactly as before.

## Express on AWS Lambda

**AWS Lambda** is Amazon's FaaS product. In front of it, **API Gateway** (or a **Lambda function URL**) receives HTTP requests and turns them into events. The adapter we'll use is `@codegenie/serverless-express`.

```bash
npm install @codegenie/serverless-express
```

### The handler

```js
// lambda.js
import serverlessExpress from '@codegenie/serverless-express';
import { app } from './app.js';

export const handler = serverlessExpress({ app });
```

That's the whole adapter. `handler` is the function Lambda calls for every request. Lambda's Node.js runtimes support ES modules, so your `"type": "module"` setup works.

### Connecting to a database

Code at the top level of a module runs once per cold start and is then reused by warm requests. That's the perfect place to connect:

```js
// lambda.js (with a database)
import serverlessExpress from '@codegenie/serverless-express';
import mongoose from 'mongoose';
import { app } from './app.js';

// Runs once per instance (cold start), reused by warm invocations
await mongoose.connect(process.env.MONGO_URL, { maxPoolSize: 5 });

export const handler = serverlessExpress({ app });
```

Top-level `await` works in ES modules, and Lambda waits for it to finish before sending the first request.

> **Warning:** Every function instance opens its own connection pool. If traffic spikes to 200 instances, that's up to 200 pools hitting your database. Keep `maxPoolSize` small, and for PostgreSQL or MySQL put a **connection pooler** in between (such as Amazon RDS Proxy or PgBouncer). Databases built for serverless use, such as MongoDB Atlas or serverless Postgres services, also help.

### Deploying with AWS SAM

There are several ways to deploy Lambda functions: the AWS console, **AWS SAM**, the **Serverless Framework**, AWS CDK, or Terraform. Here's a minimal SAM template:

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  NotesApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: lambda.handler
      Runtime: nodejs22.x
      CodeUri: .
      MemorySize: 512
      Timeout: 10
      Environment:
        Variables:
          NODE_ENV: production
      Events:
        Api:
          Type: HttpApi   # every path and method goes to this one function
```

```bash
sam build
sam deploy --guided
```

`Handler: lambda.handler` means "the `handler` export from `lambda.js`". The guided deploy asks a few questions and prints your API's URL at the end. Store secrets such as `MONGO_URL` in AWS Systems Manager Parameter Store or Secrets Manager rather than in the template.

> **Tip:** `sam local start-api` runs your function locally in Docker, using the same event format as the real thing. It's useful for checking the adapter, while `node server.js` stays your fast everyday dev loop.

## Express on Vercel

**Vercel** runs Node.js functions from files in an `api/` folder. A Vercel Node.js function is called with Node-style `req` and `res` objects, and an Express app *is* a function that accepts `(req, res)`. So you can export the app directly:

```js
// api/index.js
import { app } from '../app.js';

export default app;
```

Then send every path to that one function:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }]
}
```

Save that as `vercel.json` in the project root, and deploy with the Vercel CLI or by connecting your Git repository.

> **Note:** Vercel's support for Express keeps evolving, and newer project setups can detect an Express app with even less configuration. Check Vercel's current documentation for the recommended layout before you deploy.

## Serverless gotchas for Express developers

Some habits from long-running servers break in a serverless world.

### Work after the response may never run

On Lambda, once your function returns a response, the instance can be **frozen** until the next request. "Fire and forget" code after `res.json()` may never finish:

```js
// Risky on serverless
app.post('/api/signup', async (req, res) => {
  const user = await createUser(req.body);
  res.status(201).json(user);
  sendWelcomeEmail(user.email); // may be frozen mid-way and never complete
});
```

```js
// Safer: finish the work first, or hand it to a queue
app.post('/api/signup', async (req, res) => {
  const user = await createUser(req.body);
  await queue.send({ type: 'welcome-email', email: user.email }); // e.g. Amazon SQS
  res.status(201).json(user);
});
```

### In-memory state is not shared

Each instance has its own memory, and instances come and go. These need an external store such as Redis or a database:

- `express-session`'s default memory store
- `express-rate-limit`'s default memory store
- In-memory caches you rely on for correctness

### Limits to know about

| Limit | What it means for you |
| --- | --- |
| **Execution timeout** | Requests must finish within the function's timeout, and API Gateway adds its own limit of around 30 seconds |
| **Payload size** | Requests and responses have size limits (a few MB on Lambda); upload big files straight to object storage such as S3 instead |
| **No persistent disk** | Only a temporary `/tmp` folder that disappears with the instance; Multer's disk storage won't keep files |
| **No WebSockets via the function** | Use a managed WebSocket service, or keep a small regular server for real-time features |
| **No `SIGTERM` graceful shutdown** | The platform manages instance lifetimes; don't rely on shutdown hooks |

## Edge runtimes: a different world

**Edge runtimes** run your code in data centres all over the world, close to each user, with near-instant start times. Examples include **Cloudflare Workers**, **Vercel Edge Functions**, **Deno Deploy** and **Fastly Compute**.

They're fast because they *aren't* full Node.js. They run on lightweight JavaScript engines built around **Web standard APIs**: the same `Request`, `Response` and `fetch` you know from the browser.

```js
// A Cloudflare Worker: a fetch handler, no Node http server at all
export default {
  async fetch(request) {
    return new Response('Hello from the edge');
  },
};
```

Express is built on Node's `http` module: its `req` and `res` extend Node's `IncomingMessage` and `ServerResponse`, and it uses Node streams throughout. Edge runtimes don't offer that, so **Express doesn't run on true edge runtimes as-is**. Some platforms are adding Node.js compatibility layers, but if you go this route, check the platform's docs carefully and test everything.

### Hono: an edge-native alternative

If you need the edge, choose a framework built for it. **Hono** is a popular one, and it will feel familiar after this course:

```js
// src/index.js (Hono on Cloudflare Workers)
import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.text('Hello from the edge'));

app.get('/api/notes/:id', (c) => {
  return c.json({ id: c.req.param('id') });
});

export default app;
```

Routes, parameters, middleware and JSON responses: the concepts are the same as Express. Instead of `(req, res)` you get a **context** object, `c`, and you *return* a response instead of calling `res.json()`. Hono also runs on Node.js, Deno, Bun and AWS Lambda.

## Which should you choose?

| Your situation | Good fit |
| --- | --- |
| Steady traffic, WebSockets, long requests, background jobs | Container or VM ([Docker](/courses/expressjs/dockerising-an-express-api) behind a [reverse proxy](/courses/expressjs/reverse-proxies-and-trust-proxy)) |
| Spiky or low traffic, simple REST API, small team | Serverless functions with your existing Express app |
| Tiny, latency-critical logic (redirects, auth checks, A/B tests, geolocation) | Edge functions with an edge-native framework like Hono |
| Not sure yet | Start with a container. It runs everywhere and is easy to move later |

A common real-world mix: an Express API in containers for the main app, plus a few small edge functions in front for redirects and caching.

## Common mistakes

> **Common mistake:** Calling `app.listen()` inside the Lambda handler file. Serverless platforms call your handler; keep `listen` in `server.js` only.

> **Common mistake:** Connecting to the database inside every request handler. Connect once at module level so warm requests reuse the connection.

> **Common mistake:** Keeping sessions or rate limit counters in memory. Each instance has its own memory and it disappears without warning.

> **Common mistake:** Trying to deploy an Express app to an edge runtime unchanged and being surprised it fails. Edge runtimes speak Web `Request`/`Response`, not Node's `http`.

## Key takeaways

- **Serverless** runs your code per request on managed infrastructure; you pay for use, not idle time.
- An **adapter** like `@codegenie/serverless-express` lets an unchanged Express app run on **AWS Lambda**; Vercel can call an exported Express app directly.
- Keep `app.js` separate from `server.js`, connect to databases once per instance, and keep pools small.
- Watch out for **cold starts**, timeouts, payload limits, lost post-response work and non-shared memory.
- **Edge runtimes** use Web standard APIs, so Express doesn't run there as-is; **Hono** is an edge-native alternative with familiar ideas.

## Practice

1. Add `lambda.js` to your Notes API and deploy it with AWS SAM (the AWS free tier covers small experiments). Call `/health` on the URL it prints.
2. Deploy the same app to Vercel using `api/index.js` and `vercel.json`, and compare the cold start time with Lambda.
3. Find one place in your app that does work after sending the response, and rewrite it so it's safe on serverless.
4. Rebuild two of your Notes API routes in Hono and run them locally. List what felt the same and what felt different.

## What's next

**Congratulations, you've finished the Express 5 course!** You started with "what is a web server?" and worked all the way through routing, middleware, databases, authentication, security, performance, testing, architecture and production deployment. That is the full journey of a backend developer, and you should be proud of it.

Here's how to make it stick:

- **Build something real.** Pick an API you would actually use, such as a reading list, a habit tracker or a small shop, build it from scratch, and deploy it with the Docker and CI/CD skills you just learned. Nothing teaches like shipping.
- **Test your knowledge.** Go back through the syllabus and rebuild each lesson's example without looking at the code panel. The ones you get stuck on are worth a second read.
- **Get job-ready.** Write down the questions an interviewer could ask about routing, middleware, authentication and deployment, and try explaining each answer out loud in your own words.
- **Keep exploring.** Read the official Express documentation and changelog, look at popular middleware source code on GitHub, and try a framework like Fastify or Hono to see how other tools solve the same problems.

Thank you for learning with us. Now go build something great.
