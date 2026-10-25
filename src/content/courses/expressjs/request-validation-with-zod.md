---
publishDate: 2026-10-25T09:31
title: Request Validation with Zod
slug: request-validation-with-zod
metadescription: Learn to validate request bodies, route params and query strings in Express 5 with Zod 4 schemas, reusable middleware and clear error responses.
updateDate: 2026-10-25T09:31
author: ['bishal-biswas']
level: 2
tags: ['express', 'zod', 'validation', 'api']
course: expressjs
---

## What you will learn

- Why you must never trust data sent by a client
- How to describe the shape of valid data with a **Zod schema**
- The difference between `parse()` and `safeParse()`
- How to build a reusable validation middleware for body, params and query
- How to return clear, consistent validation errors

## Why validate at all?

Every request is written by someone else: a browser, a mobile app, a script or an attacker. Your route might expect `{ "title": "Buy milk" }` but receive `{ "title": 42 }`, `{}`, or a 5 MB string.

If you pass bad data along, it causes confusing bugs deep in your code, broken records in your database, or security holes. **Validation** means checking that incoming data has the right shape *before* you use it.

**Think of it like airport check-in.** Before your bag goes on the plane, staff check its size and weight at the counter. It is much cheaper to reject a bag at the counter than to find out mid-flight. Validation is the check-in counter of your API.

## Validating by hand gets messy

Here is what manual checks look like for a simple "create user" body:

```js
// routes/users.js (manual validation, do not copy)
app.post('/users', (req, res) => {
  const { name, email, age } = req.body ?? {};

  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'email is invalid' });
  }
  if (age !== undefined && (!Number.isInteger(age) || age < 13)) {
    return res.status(400).json({ error: 'age must be a whole number, 13 or more' });
  }
  // ...and this is only three fields
});
```

It is long, easy to get wrong, and only reports the first problem. A validation library fixes all three issues.

## Meet Zod

**Zod** is a library for describing what valid data looks like. You write a **schema**, which is a blueprint of the expected data. Zod then checks real data against that blueprint and tells you exactly what is wrong.

```bash
npm install zod
```

This lesson uses Zod 4.

Your first schema:

```js
// schemas/user.js
import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.email('Please enter a valid email address'),
  age: z.number().int().min(13, 'You must be at least 13').optional(),
});
```

Read it out loud and it almost sounds like English: "an object with a `name` that is a trimmed, non-empty string, an `email` that is a valid email, and an optional `age` that is a whole number of at least 13".

## parse vs safeParse

Zod gives you two ways to check data.

| Method | On valid data | On invalid data |
| --- | --- | --- |
| `schema.parse(data)` | Returns the clean data | **Throws** a `ZodError` |
| `schema.safeParse(data)` | Returns `{ success: true, data }` | Returns `{ success: false, error }` |

In route handlers, `safeParse` is usually easier because you decide what to do with the error.

```js
// try-zod.js
import { createUserSchema } from './schemas/user.js';

const result = createUserSchema.safeParse({ name: '  ', email: 'nope', age: 10 });

if (!result.success) {
  console.log(result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  })));
}
```

```text
[
  { path: 'name', message: 'Name is required' },
  { path: 'email', message: 'Please enter a valid email address' },
  { path: 'age', message: 'You must be at least 13' }
]
```

Each **issue** describes one problem. `issue.path` is an array showing where the problem is (for nested data it might be `['address', 'city']`), and `issue.message` is the human-readable text. Notice that Zod reports **all** problems at once, not just the first.

## Zod building blocks

| Schema | Accepts |
| --- | --- |
| `z.string()` | Any string. Chain `.min()`, `.max()`, `.trim()`, `.toLowerCase()` |
| `z.number()` | Any number. Chain `.int()`, `.min()`, `.max()`, `.positive()` |
| `z.boolean()` | `true` or `false` |
| `z.email()`, `z.url()`, `z.uuid()` | Strings in that format |
| `z.enum(['low', 'high'])` | Only one of the listed strings |
| `z.array(z.string())` | An array of strings. Chain `.min()`, `.max()` for length |
| `z.object({ ... })` | An object with the listed keys |
| `.optional()` | The value may be missing (`undefined`) |
| `.default(value)` | Use `value` when the field is missing |
| `z.coerce.number()` | Converts the input to a number first, then checks it |

Some methods, like `.trim()` and `.default()`, also *change* the data. The `data` you get back from a successful `safeParse` is the cleaned version, so always use `result.data`, not the original input.

## Validating req.body in a route

Here is the user route again, now with Zod:

```js
// app.js
import express from 'express';
import { createUserSchema } from './schemas/user.js';

const app = express();
app.use(express.json());

app.post('/users', (req, res) => {
  const result = createUserSchema.safeParse(req.body ?? {});

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  const user = result.data; // trimmed, checked, safe to use
  res.status(201).json(user);
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

The `?? {}` matters in Express 5. If a client sends no JSON body, `req.body` is `undefined`, and Zod would report one confusing "expected object" error instead of a list of missing fields.

Try it:

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Asha","email":"asha@example"}'
```

```json
{
  "error": "Validation failed",
  "details": [{ "field": "email", "message": "Please enter a valid email address" }]
}
```

> **Note:** Some APIs use `422 Unprocessable Content` instead of `400 Bad Request` for validation errors. Both are common. Pick one and use it everywhere.

## A reusable validate middleware

Copying `safeParse` into every route gets old fast. Turn it into middleware that can check any part of the request.

There is one Express 5 detail to know first. `req.query` is a **read-only getter**, so you cannot replace it with cleaned data. Since ES modules run in strict mode, `req.query = result.data` actually throws a `TypeError`. A tidy solution is to store all validated data on a new property, `req.validated`.

```js
// middleware/validate.js
export const validate = (schemas) => (req, res, next) => {
  const validated = {};
  const details = [];

  // schemas looks like { body: schemaA, params: schemaB, query: schemaC }
  for (const [part, schema] of Object.entries(schemas)) {
    const result = schema.safeParse(req[part] ?? {});

    if (result.success) {
      validated[part] = result.data;
    } else {
      for (const issue of result.error.issues) {
        details.push({ field: [part, ...issue.path].join('.'), message: issue.message });
      }
    }
  }

  if (details.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details });
  }

  req.validated = validated;
  next();
};
```

`validate` is a function that *returns* middleware, just like `express.json()` does. You call it with your schemas, and it gives back an `(req, res, next)` function.

## Validating params and query strings

Route params and query strings always arrive as **strings**. `?page=2` gives you `'2'`, not `2`. This is where `z.coerce` shines: it converts the value first, then validates it.

```js
// schemas/product.js
import { z } from 'zod';

export const productIdParams = z.object({
  id: z.coerce.number().int().positive('Product id must be a positive number'),
});

export const listProductsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(['books', 'games', 'music']).optional(),
});

export const createProductBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  price: z.number().positive('Price must be greater than 0'),
  tags: z.array(z.string().trim().min(1)).max(5).default([]),
});
```

Now plug them into routes:

```js
// routes/products.js
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { productIdParams, listProductsQuery, createProductBody } from '../schemas/product.js';

const router = Router();

router.get('/', validate({ query: listProductsQuery }), (req, res) => {
  const { page, limit, category } = req.validated.query; // numbers, with defaults
  res.json({ page, limit, category });
});

router.get('/:id', validate({ params: productIdParams }), (req, res) => {
  res.json({ id: req.validated.params.id }); // a real number now
});

router.post('/', validate({ body: createProductBody }), (req, res) => {
  res.status(201).json(req.validated.body);
});

export default router;
```

```bash
curl "http://localhost:3000/products?limit=500"
```

```json
{
  "error": "Validation failed",
  "details": [{ "field": "query.limit", "message": "Too big: expected number to be <=100" }]
}
```

That message is Zod's built-in default. You can replace it by passing your own text, such as `.max(100, 'Limit cannot be more than 100')`.

> **Common mistake:** Using `z.number()` for query strings. The value is the string `'2'`, so plain `z.number()` always fails. Use `z.coerce.number()` for params and query values.

## Unknown keys: strip or reject?

What if a client sends extra fields, like `{ "name": "Pen", "price": 2, "isAdmin": true }`?

By default, `z.object()` **strips** unknown keys: `result.data` simply will not contain `isAdmin`. That alone protects you from a classic bug called **mass assignment**, where extra fields from the client get saved straight into the database.

If you would rather tell the client they sent something wrong, use `z.strictObject()`, which rejects unknown keys with an error:

```js
// schemas/product.js
export const updateProductBody = z.strictObject({
  name: z.string().trim().min(1).max(100).optional(),
  price: z.number().positive().optional(),
});
```

## Custom rules with refine

Some rules involve more than one field, like "password and confirmation must match". Use `.refine()`, which takes a function that returns `true` when the data is valid.

```js
// schemas/auth.js
import { z } from 'zod';

export const registerSchema = z
  .object({
    email: z.email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'], // which field the error belongs to
  });
```

## Schemas for PATCH requests

A `PATCH` updates only the fields the client sends, so every field should be optional. Zod has `.partial()` to make every field of an object optional:

```js
const updateProductBody = createProductBody.partial();
```

> **Warning:** Watch out for `.default()`. In Zod 4, a default still fills in a missing value even when the field is optional. If your create schema has `tags: ... .default([])`, the partial version would add `tags: []` to every PATCH and wipe the existing tags. For update schemas, write the fields out without defaults, as in the `z.strictObject()` example above.

## Sending errors to your error handler

In bigger apps you may prefer one central place that formats every error. Instead of responding inside `validate`, throw a custom error and let your error-handling middleware (from the [custom error classes lesson](/courses/expressjs/custom-error-classes)) format it.

```js
// errors/validation-error.js
export class ValidationError extends Error {
  constructor(details) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.status = 400;
    this.details = details;
  }
}
```

```js
// middleware/validate.js (add this import at the top, then change the end)
import { ValidationError } from '../errors/validation-error.js';

// ...inside the middleware, replace the res.status(400) block with:
if (details.length > 0) {
  throw new ValidationError(details); // Express catches it and calls next(err)
}
```

```js
// middleware/error-handler.js
import { ValidationError } from '../errors/validation-error.js';

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message, details: err.details });
  }

  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
};
```

Now every validation error in your API has the same shape, which makes life easy for frontend developers.

## Common mistakes

- **Using the original `req.body` after validating.** Use `result.data` (or `req.validated.body`). It has the trimmed, coerced, defaulted values.
- **Trying to assign `req.query`.** It is read-only in Express 5. Store cleaned values elsewhere.
- **Validating only the body.** Params and query strings are user input too.
- **Validating only on the frontend.** Frontend checks improve the user experience, but anyone can skip them with `curl`. The server must always validate.
- **Forgetting `express.json()`.** Without it, `req.body` is `undefined` and every request fails validation.

## Key takeaways

- Treat every piece of request data as untrusted until it is validated.
- A **Zod schema** describes valid data. `safeParse()` returns `{ success, data }` or `{ success, error }`, and `error.issues` lists every problem.
- Use `z.coerce.number()` for params and query strings, which always arrive as strings.
- Wrap validation in a reusable middleware, and store results on `req.validated` because `req.query` is read-only in Express 5.
- `z.object()` strips unknown keys, `z.strictObject()` rejects them. Avoid `.default()` in PATCH schemas.

## Practice

1. Write a schema for a `POST /books` body with `title` (1 to 200 characters), `author` (required), `year` (integer, 1450 to the current year) and optional `isbn`.
2. Add a `GET /books` route with `page`, `limit` (max 50) and `sort` (`'title'` or `'year'`) query params, validated with your middleware.
3. Send `{"title":"","year":"1999"}` and check that you get one clear message per problem.
4. Switch the book schema to `z.strictObject()` and see what happens when you send an extra `price` field.

## What's next

With validation in place, you need a way to see what your API is actually doing in production. Continue with [Logging with Morgan and Pino](/courses/expressjs/logging-with-morgan-and-pino).
