---
publishDate: 2026-05-19T09:53
title: Next.js Route Handlers and Middleware
slug: nextjs-route-handlers
metadescription: Build real HTTP endpoints with route handlers, and run code before every request with middleware.
updateDate: 2026-09-05T09:53
author: ['bishal-biswas']
level: 3
tags: ['nextjs', 'api', 'server']
course: react
---

## Route handlers

A `route.js` file becomes an HTTP endpoint.

```javascript
export async function GET() {
  const products = await db.products.findMany();
  return Response.json(products);
}
```

`app/api/products/route.js` serves `/api/products`. Export a function named after each method you support.

```javascript
export async function GET(request) {}
export async function POST(request) {}
export async function PUT(request) {}
export async function PATCH(request) {}
export async function DELETE(request) {}
```

These use the standard web `Request` and `Response` objects, so the knowledge transfers to Deno, Cloudflare Workers and anywhere else.

## Reading the request

```javascript
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const page = Number(searchParams.get('page') ?? 1);
  const products = await db.products.findMany({
    where: category ? { category } : undefined,
    skip: (page - 1) * 20,
    take: 20
  });
  return Response.json(products);
}
```

```javascript
export async function POST(request) {
  const body = await request.json();
  const contentType = request.headers.get('content-type');
  return Response.json({ received: body });
}
```

For form submissions:

```javascript
export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('avatar');
  return Response.json({ name: file.name, size: file.size });
}
```

## Dynamic segments

```javascript
export async function GET(request, { params }) {
  const { id } = await params;
  const product = await db.products.findUnique({ where: { id } });
  if (!product) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  return Response.json(product);
}
```

Like pages, `params` is a promise.

## Status codes and headers

```javascript
export async function POST(request) {
  const body = await request.json();
  if (!body.name) {
    return Response.json({ error: 'Name is required' }, { status: 400 });
  }
  const product = await db.products.create({ data: body });
  return Response.json(product, {
    status: 201,
    headers: { Location: `/api/products/${product.id}` }
  });
}
```

Use the right status. `200` for success, `201` for created, `400` for bad input, `401` for not signed in, `403` for not allowed, `404` for missing, `500` for a server fault.

## Validate everything

Route handlers are public. Anyone can call them with anything.

```javascript
import { z } from 'zod';
const schema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
  category: z.enum(['books', 'toys', 'food'])
});
export async function POST(request) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const product = await db.products.create({
    data: { ...parsed.data, ownerId: session.userId }
  });
  return Response.json(product, { status: 201 });
}
```

Note `ownerId` comes from the session, never the body. And `request.json()` is wrapped, because malformed JSON throws.

## Route handlers or Server Functions?

Both run on the server. They serve different purposes.

**Server Functions** are for your own React components mutating data. Less code, progressive enhancement, automatic revalidation.

**Route handlers** are for anything else: a mobile app, a webhook, a third party integration, a public API, file downloads, or anything needing a specific URL and content type.

If only your React app calls it, a Server Function is usually less work.

## Streaming and files

```javascript
export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of await generateReport()) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    }
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain' }
  });
}
```

```javascript
export async function GET() {
  const csv = await buildCsv();
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="report.csv"'
    }
  });
}
```

## Webhooks

A very common use, and one where verification matters.

```javascript
import crypto from 'node:crypto';
export async function POST(request) {
  const signature = request.headers.get('x-signature');
  const body = await request.text();
  const expected = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  if (signature !== expected) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }
  const event = JSON.parse(body);
  await handleEvent(event);
  return Response.json({ received: true });
}
```

Read the **raw text** first, because the signature is computed over the exact bytes. Parsing to JSON and re-serialising would change them.

## Middleware

Middleware runs before a request reaches a route.

```javascript
import { NextResponse } from 'next/server';
export function middleware(request) {
  const session = request.cookies.get('session');
  if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*']
};
```

Put `middleware.js` at the project root. The `matcher` limits which paths it runs for, which matters because it runs on **every** matched request.

Good uses: redirects, locale detection, A/B tests, adding security headers, and a cheap auth check.

```javascript
export function middleware(request) {
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}
```

**Keep it fast and light.** Middleware often runs on an edge runtime with no Node APIs and no database access. Do a cookie check here and the real verification in the route.

## Quick recap

- `route.js` exports a function per HTTP method.
- It uses standard `Request` and `Response`, so the knowledge transfers.
- `params` is a promise, as it is for pages.
- Validate the body and take identity from the session, never the payload.
- Use Server Functions for your own components, route handlers for everything else.
- Verify webhook signatures against the raw body text.
- Middleware runs before routes and should stay fast.
- Use `matcher` so middleware only runs where it is needed.

<code id="code-content" class="language-javascript">
// ---------- app/api/products/route.js ----------
import { z } from 'zod';
const productSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
  category: z.enum(['books', 'toys', 'food'])
});
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const page = Number(searchParams.get('page') ?? 1);
  const products = await db.products.findMany({
    where: category ? { category } : undefined,
    skip: (page - 1) * 20,
    take: 20
  });
  return Response.json(products);
}
// PUBLIC ENDPOINT: anyone can call this with anything at all
export async function POST(request) {
  // 1. Authorise
  const session = await getSession(request);
  if (!session) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  // 2. Parse defensively, because malformed JSON throws
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  // 3. Validate the shape
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', issues: parsed.error.issues },
      { status: 400 }
    );
  }
  // 4. Identity from the SESSION, never from the body
  const product = await db.products.create({
    data: { ...parsed.data, ownerId: session.userId }
  });
  return Response.json(product, {
    status: 201,
    headers: { Location: '/api/products/' + product.id }
  });
}
// ---------- app/api/products/[id]/route.js ----------
export async function DELETE(request, { params }) {
  const { id } = await params;            // a promise, like pages
  await db.products.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
// ---------- app/api/webhook/route.js ----------
// Verify against the RAW body text. Parsing and re-serialising would
// change the bytes and break the signature.
import crypto from 'node:crypto';
export async function POST(request) {
  const signature = request.headers.get('x-signature');
  const body = await request.text();
  const expected = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  if (signature !== expected) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }
  await handleEvent(JSON.parse(body));
  return Response.json({ received: true });
}
// ---------- middleware.js at the project root ----------
// import { NextResponse } from 'next/server';
// export function middleware(request) {
//   const session = request.cookies.get('session');
//   if (!session) {
//     const url = new URL('/login', request.url);
//     url.searchParams.set('from', request.nextUrl.pathname);
//     return NextResponse.redirect(url);
//   }
//   const response = NextResponse.next();
//   response.headers.set('X-Frame-Options', 'DENY');
//   return response;
// }
// matcher limits where it runs, which matters because it runs on EVERY
// matched request and often has no database access
// export const config = { matcher: ['/dashboard/:path*'] };
</code></pre>
