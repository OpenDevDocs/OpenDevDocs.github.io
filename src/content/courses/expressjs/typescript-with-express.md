---
publishDate: 2026-10-25T09:55
title: TypeScript with Express 5
slug: typescript-with-express
metadescription: Learn how to set up an Express 5 project with TypeScript, tsx and @types/express, type requests and responses, validate bodies with Zod, and add custom properties to req.
updateDate: 2026-10-25T09:55
author: ['bishal-biswas']
level: 3
tags: ['express', 'typescript', 'types', 'tooling']
course: expressjs
---

## What you will learn

- What **TypeScript** adds to an Express project and why many teams use it
- How to set up a project with `typescript`, `tsx`, `@types/express` and a `tsconfig.json`
- How to type route handlers with `Request` and `Response`, including the four generics
- How to combine Zod validation with TypeScript types so you write each shape once
- How to type middleware and error handlers, and add your own properties such as `req.user`

## Why TypeScript?

JavaScript lets you write `res.json(user.nmae)` and only finds the typo when a user hits that route. **TypeScript** is JavaScript plus **types**: labels that say what shape each value has. A program called the **compiler** checks those labels before your code runs and points out mistakes in your editor.

**Think of a spell checker.** It does not change what you mean, but it underlines mistakes while you type, long before anyone reads your letter. TypeScript underlines `user.nmae` and suggests `user.name`.

| | JavaScript | TypeScript |
| --- | --- | --- |
| Finds typos in property names | When the code runs | While you type |
| Editor autocomplete for `req.`, `res.` and your data | Partial | Full |
| Refactoring (renaming a field everywhere) | Search and hope | Safe, the compiler finds every use |
| Extra setup | None | A compiler, a config file, type packages |

Types disappear when TypeScript is turned into JavaScript. They cost nothing at runtime, and they do **not** check data coming from users. You still need validation, as you will see below.

## Setting up the project

```bash
mkdir notes-ts && cd notes-ts
npm init -y
npm install express zod
npm install --save-dev typescript tsx @types/express @types/node
```

| Package | Why |
| --- | --- |
| `typescript` | The compiler (`tsc`) |
| `tsx` | Runs `.ts` files directly in development, with watch mode |
| `@types/express` | Type descriptions for Express. Version 5 matches Express 5 |
| `@types/node` | Type descriptions for Node.js built-ins such as `process` |

> **Note:** Express itself is written in JavaScript. The `@types/express` package is a separate, community-maintained description of its API. Make sure its major version matches Express: Express 5 needs `@types/express` 5.

### package.json

```json
{
  "name": "notes-ts",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit"
  }
}
```

### tsconfig.json

This file tells the compiler how strict to be and where files live.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true
  },
  "include": ["src"]
}
```

| Option | Meaning |
| --- | --- |
| `module` / `moduleResolution: "NodeNext"` | Follow Node.js's real ES module rules |
| `strict: true` | Turn on all the useful checks. Always use this for new projects |
| `esModuleInterop` | Lets you write `import express from 'express'` for packages written in CommonJS |
| `skipLibCheck` | Do not type-check every file inside `node_modules` (faster) |
| `outDir` / `rootDir` | Compile `src/*.ts` into `dist/*.js` |

## Your first typed server

```ts
// src/app.ts
import express from 'express';
import { notesRouter } from './routes/notes.js';
import { errorHandler } from './middleware/error-handler.js';

export const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/notes', notesRouter);
app.use(errorHandler);
```

```ts
// src/server.ts
import { app } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, (error) => {
  if (error) throw error;
  console.log(`Server running on http://localhost:${PORT}`);
});
```

> **Common mistake:** Notice the imports end in `.js`, even though the files are `.ts`. With `"module": "NodeNext"`, you write the path of the file that will exist **after** compiling. Writing `./app` or `./app.ts` gives an error.

Run it in development:

```bash
npm run dev
```

`tsx` runs your TypeScript straight away and restarts on changes. It does **not** type-check, to stay fast. Your editor shows type errors as you work, and `npm run typecheck` checks the whole project (run it before committing and in CI).

For production, compile and run the plain JavaScript:

```bash
npm run build
npm start
```

> **Note:** Recent Node.js versions can also run some TypeScript files directly by stripping out the types. `tsx` is still the simplest choice for now because it supports more TypeScript features and has a built-in watch mode.

## How Express types work

Hover over `req` in your editor inside `app.get('/health', (req, res) => ...)`. TypeScript already knows it is a `Request` and `res` is a `Response`, because Express's types describe what `app.get` passes to your function. You get autocomplete for `req.params`, `res.status()` and everything else for free.

When you write a handler in a separate place, or want to be more specific, you import the types:

```ts
// src/routes/example.ts
import type { Request, Response, NextFunction } from 'express';

export const hello = (req: Request, res: Response) => {
  res.json({ message: `Hello from ${req.path}` });
};
```

`import type` imports only the type, which disappears after compiling.

### The four generics of Request

`Request` and `Response` accept **generics**: extra type information in angle brackets, like filling in blanks on a form. `Request` has four, in this order:

```text
Request< Params, ResBody, ReqBody, Query >
           |        |        |       |
           |        |        |       +-- req.query
           |        |        +---------- req.body
           |        +------------------- what res.json() sends
           +---------------------------- req.params
```

`Response` has one important generic: the body type you send.

```ts
// src/routes/notes.ts
import { Router, type Request, type Response } from 'express';

type Note = { id: string; title: string; createdAt: string };
type ErrorBody = { error: string };

const notes = new Map<string, Note>();

export const notesRouter = Router();

notesRouter.get('/:id', (req: Request<{ id: string }>, res: Response<Note | ErrorBody>) => {
  const note = notes.get(req.params.id); // req.params.id is a string
  if (!note) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }
  res.json(note); // res.json({ wrong: true }) would be a type error here
});
```

Try changing `res.json(note)` to `res.json({ titel: 'x' })`. Your editor underlines it immediately.

> **Tip:** Sending a response does not stop your function. After an early `res.status(404).json(...)`, add `return;` (as above) so the code below it does not try to send a second response. The Express 5 types also accept the shorter `return res.status(404).json(...)`, but the separate `return;` makes it clearer that the handler's return value is not used. Some older versions of `@types/express` rejected the short form with a confusing "No overload matches this call" error, which is why you will see both styles in tutorials.

## Typing request bodies with Zod

Here is the most important idea in this lesson: **types do not check incoming data.** If you write `Request<{}, any, { title: string }>`, TypeScript *believes* `req.body.title` is a string, but a client can still send `{ "title": 42 }` or no body at all. Types are a promise to the compiler, not a guard at the door.

The fix is the validation you learned in [Request Validation with Zod](/courses/expressjs/request-validation-with-zod). Zod checks the data at runtime **and** produces a TypeScript type, so you describe each shape once.

```ts
// src/schemas/note.ts
import { z } from 'zod';

export const createNoteSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  tags: z.array(z.string()).default([]),
});

// A TypeScript type generated from the schema: { title: string; tags: string[] }
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const listNotesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

```ts
// src/routes/notes.ts (continued)
import { randomUUID } from 'node:crypto';
import { createNoteSchema, listNotesQuerySchema, type CreateNoteInput } from '../schemas/note.js';

notesRouter.post('/', async (req, res: Response<Note | { errors: string[] }>) => {
  const result = createNoteSchema.safeParse(req.body); // req.body is untrusted
  if (!result.success) {
    res.status(400).json({ errors: result.error.issues.map((issue) => issue.message) });
    return;
  }

  const input: CreateNoteInput = result.data; // fully typed from here on
  const note: Note = { id: randomUUID(), title: input.title, createdAt: new Date().toISOString() };
  notes.set(note.id, note);
  res.status(201).json(note);
});

notesRouter.get('/', (req, res: Response<Note[] | { errors: string[] }>) => {
  const result = listNotesQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ errors: result.error.issues.map((issue) => issue.message) });
    return;
  }

  const { page, limit } = result.data; // numbers, not strings
  const all = [...notes.values()];
  res.json(all.slice((page - 1) * limit, page * limit));
});
```

Inside the `if (!result.success)` check, TypeScript knows `result.data` does not exist. After it, TypeScript knows `result.data` matches the schema. This is called **narrowing**: the compiler follows your `if` checks.

> **Note:** In Express 5, `req.query` is read-only, so do not try to replace it with the parsed version. Keep the validated values in a variable, as above.

## Typing middleware and error handlers

Express exports ready-made types for common function shapes:

| Type | Use it for |
| --- | --- |
| `RequestHandler` | Normal middleware and route handlers `(req, res, next)` |
| `ErrorRequestHandler` | Error-handling middleware `(err, req, res, next)` |

```ts
// src/middleware/request-timer.ts
import type { RequestHandler } from 'express';

export const requestTimer: RequestHandler = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
};
```

```ts
// src/middleware/error-handler.ts
import type { ErrorRequestHandler } from 'express';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const status = err instanceof HttpError ? err.status : 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
};
```

Because the variable is typed as `ErrorRequestHandler`, TypeScript fills in the types of all four parameters for you.

## Adding your own properties to req

Your authentication middleware from [JWT Authentication](/courses/expressjs/jwt-authentication) sets `req.user`. TypeScript does not know about that property, so `req.user` is an error everywhere.

You fix this with **declaration merging**: you add a property to Express's own `Request` type. Create a type declaration file:

```ts
// src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: 'user' | 'admin';
      };
    }
  }
}

export {}; // makes this file a module, which "declare global" needs
```

Because `tsconfig.json` includes the whole `src` folder, this file is picked up automatically. Now `req.user` works everywhere:

```ts
// src/middleware/require-auth.ts
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

type TokenPayload = { sub: string; role: 'user' | 'admin' };

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = req.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'change-me') as TokenPayload;
    req.user = { id: payload.sub, role: payload.role }; // no type error now
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

This example also needs the JWT library and its types: `npm install jsonwebtoken` and `npm install --save-dev @types/jsonwebtoken`.

> **Warning:** `as TokenPayload` is a **type assertion**: you are telling TypeScript "trust me". It does not check anything. That is acceptable here because `jwt.verify` already checked the signature, but avoid `as` on data from users. Validate with Zod instead.

## Async handlers

Express 5 forwards errors from `async` handlers to your error handler, and the Express 5 types accept handlers that return a Promise. So async routes need no wrapper:

```ts
// src/routes/users.ts
import { Router } from 'express';
import { HttpError } from '../middleware/error-handler.js';
import { findUser } from '../services/users.js';

export const usersRouter = Router();

usersRouter.get('/:id', async (req, res) => {
  const user = await findUser(req.params.id); // if this throws, the error handler runs
  if (!user) throw new HttpError(404, 'User not found');
  res.json(user);
});
```

## Common mistakes

- **Mismatched type versions.** `@types/express` 4 with Express 5 gives wrong types. Keep both on version 5.
- **Missing `.js` in relative imports** with `NodeNext`. Write `'./app.js'`.
- **Trusting `req.body` types without validation.** Types are erased at runtime; use Zod.
- **Using `any` everywhere** to silence errors. Each `any` switches off checking for that value. Prefer `unknown` and narrow it.
- **Only running `tsx`.** It does not type-check. Run `tsc --noEmit` in your test script or CI.

## Key takeaways

- TypeScript catches mistakes before your code runs and gives full autocomplete; types cost nothing at runtime.
- Set up with `typescript`, `tsx` (dev), `@types/express` 5 and `@types/node`, plus a `NodeNext` + `strict` `tsconfig.json`.
- `Request<Params, ResBody, ReqBody, Query>` and `Response<Body>` describe your routes; `RequestHandler` and `ErrorRequestHandler` type middleware.
- Types do not validate input. Use Zod's `safeParse` and `z.infer` to get both runtime checks and types from one schema.
- Add custom properties like `req.user` with a `declare global { namespace Express { interface Request ... } }` file.

## Practice

1. Convert one route file from your Notes API to TypeScript and fix every error `tsc --noEmit` reports.
2. Write a Zod schema for updating a note (all fields optional) and use `z.infer` to type the update function.
3. Add `requestId: string` to `Request` with declaration merging, set it in a middleware with `randomUUID()`, and include it in error responses.
4. Make `res.json()` in one route typed with `Response<...>`, then try sending a wrong shape and read the compiler's message.

## What's next

You have now seen Express 5 from every angle. Next comes a single page that lists every change from Express 4, for when you meet older code. Continue with [Express 5 Breaking Changes Reference](/courses/expressjs/express-5-breaking-changes).
