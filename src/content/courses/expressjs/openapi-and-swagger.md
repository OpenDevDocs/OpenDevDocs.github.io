---
publishDate: 2026-10-25T09:54
title: OpenAPI and Swagger Documentation
slug: openapi-and-swagger
metadescription: Learn what an OpenAPI specification is and how to document an Express 5 API with swagger-jsdoc and swagger-ui-express, including schemas, parameters, auth and keeping docs in sync.
updateDate: 2026-10-25T09:54
author: ['bishal-biswas']
level: 3
tags: ['express', 'openapi', 'swagger', 'documentation']
course: expressjs
---

## What you will learn

- What **OpenAPI** is and why a machine-readable API description is so useful
- How an OpenAPI document is organised: info, paths, parameters, responses and schemas
- How to write docs next to your routes with `swagger-jsdoc`
- How to serve an interactive docs page with `swagger-ui-express`
- How to document authentication and keep the docs from drifting out of date

## Why document your API?

You know how your Notes API works because you wrote it. The frontend developer, the mobile developer, and you in six months do not. Without docs, they read your code or guess, and guessing leads to bugs.

**Think of a restaurant menu.** It lists every dish, what is in it, and the price. You do not need to visit the kitchen to order. API documentation is the menu for your API: every endpoint, what to send, and what comes back.

Hand-written docs in a wiki tend to go stale. A better approach is to describe your API in a standard, **machine-readable** format. Then tools can turn that description into a web page, check requests, generate client code and more.

## OpenAPI and Swagger: the names

These two names get mixed up a lot:

| Name | What it is |
| --- | --- |
| **OpenAPI Specification** | The standard format for describing HTTP APIs, written in YAML or JSON. Version 3 is current. |
| **OpenAPI document** (or "spec") | Your API's description, written in that format |
| **Swagger** | The original name of the format (before version 3), and now the name of a family of tools for it |
| **Swagger UI** | A tool that turns an OpenAPI document into an interactive web page where you can try requests |

So: you **write an OpenAPI document**, and you **show it with Swagger UI**.

## What an OpenAPI document looks like

Here is a small, complete document for one endpoint. Read it top to bottom.

```yaml
openapi: 3.0.3
info:
  title: Notes API
  version: 1.0.0
  description: A simple API for creating and reading notes.
servers:
  - url: http://localhost:3000
paths:
  /notes/{id}:
    get:
      summary: Get one note
      tags: [Notes]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: The note
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Note'
        '404':
          description: Note not found
components:
  schemas:
    Note:
      type: object
      required: [id, title]
      properties:
        id:
          type: string
          example: 6f1c2a
        title:
          type: string
          example: Buy milk
        createdAt:
          type: string
          format: date-time
```

The main parts:

| Section | Purpose |
| --- | --- |
| `openapi` | Which version of the specification this document uses |
| `info` | Title, version and description of **your** API |
| `servers` | Base URLs where the API runs |
| `paths` | Every endpoint, grouped by URL and then by HTTP method |
| `parameters` | Inputs from the path, query string or headers |
| `requestBody` | What to send in the body (for `POST`, `PUT`, `PATCH`) |
| `responses` | Each possible status code, with a description and body shape |
| `components.schemas` | Reusable data shapes, referenced with `$ref` |

> **Common mistake:** OpenAPI writes path parameters with braces, `/notes/{id}`, while Express writes them with a colon, `/notes/:id`. They mean the same thing, but you must use the OpenAPI style inside the document.

> **Note:** OpenAPI 3.1 also exists and lines up more closely with JSON Schema. This lesson uses 3.0.3 because it is the most widely supported by tools; Swagger UI handles both.

## Writing docs next to your routes with swagger-jsdoc

You could keep the whole document in one big `openapi.yaml` file. That works, but it lives far from the code it describes, so people forget to update it.

`swagger-jsdoc` lets you write each endpoint's description in a comment **right above the route**. It reads those comments and builds the full document for you.

```bash
npm install swagger-jsdoc swagger-ui-express
```

### The base definition

Shared information (title, servers, reusable schemas) goes in one file:

```js
// docs/openapi.js
import swaggerJsdoc from 'swagger-jsdoc';

export const openapiSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Notes API',
      version: '1.0.0',
      description: 'A simple API for creating and reading notes.',
    },
    servers: [{ url: 'http://localhost:3000' }],
    components: {
      schemas: {
        Note: {
          type: 'object',
          required: ['id', 'title'],
          properties: {
            id: { type: 'string', example: '6f1c2a' },
            title: { type: 'string', example: 'Buy milk' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: { error: { type: 'string', example: 'Note not found' } },
        },
      },
    },
  },
  // Files to scan for @openapi comments (relative to where you run node)
  apis: ['./routes/*.js'],
});
```

### Documenting routes with comments

Each comment starts with `@openapi`, followed by YAML for one path. Indentation matters, just like in any YAML file.

```js
// routes/notes.js
import { Router } from 'express';
import { notesRepo } from '../notes-repo.js';

export const notesRouter = Router();

/**
 * @openapi
 * /notes:
 *   get:
 *     summary: List all notes
 *     tags: [Notes]
 *     parameters:
 *       - name: limit
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       '200':
 *         description: An array of notes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Note'
 */
notesRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  res.json((await notesRepo.list()).slice(0, limit));
});

/**
 * @openapi
 * /notes:
 *   post:
 *     summary: Create a note
 *     tags: [Notes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Buy milk
 *     responses:
 *       '201':
 *         description: The created note
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Note'
 *       '400':
 *         description: The title is missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
notesRouter.post('/', async (req, res) => {
  const title = req.body?.title;
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title is required' });
  }
  res.status(201).json(await notesRepo.create({ title: title.trim() }));
});
```

## Serving the docs with Swagger UI

Now plug the generated document into your app. Two routes are useful:

- `/openapi.json`: the raw document, for tools and code generators.
- `/docs`: the interactive page for humans.

```js
// app.js
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapiSpec } from './docs/openapi.js';
import { notesRouter } from './routes/notes.js';

export const app = express();
app.use(express.json());

app.get('/openapi.json', (req, res) => {
  res.json(openapiSpec);
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.use('/notes', notesRouter);
```

Start your server and open `http://localhost:3000/docs`. You will see every endpoint grouped under the **Notes** tag. Click one, press **Try it out**, fill in the fields and press **Execute**. Swagger UI sends a real request to your API and shows the response, plus the matching `curl` command.

> **Tip:** If `/docs` is blank, check the browser console. A strict Content Security Policy (for example from Helmet, which you added in [Security Headers with Helmet](/courses/expressjs/security-headers-with-helmet)) can block the page's scripts or styles. Adjust the policy for the docs route, or serve the docs only in development.

## Documenting authentication

If some routes need a JWT, describe the scheme once and then mark which routes use it.

```js
// docs/openapi.js (inside definition.components)
securitySchemes: {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  },
},
```

```js
// routes/notes.js
/**
 * @openapi
 * /notes/{id}:
 *   delete:
 *     summary: Delete a note
 *     tags: [Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '204':
 *         description: Deleted
 *       '401':
 *         description: Missing or invalid token
 *       '404':
 *         description: Note not found
 */
notesRouter.delete('/:id', requireAuth, async (req, res) => {
  // ...
});
```

Swagger UI now shows an **Authorize** button. Paste a token there once and it is sent with every "Try it out" request.

## Should the docs be public?

It depends on who uses your API.

| API type | Suggestion |
| --- | --- |
| Public API for other companies | Publish the docs; they are part of your product |
| Internal API for your own frontend | Serve docs in development and staging, or behind a login |
| Admin or sensitive endpoints | Leave them out of public docs entirely |

A simple switch:

```js
// app.js
if (process.env.NODE_ENV !== 'production') {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
}
```

> **Note:** Hiding docs is not security. Anyone can still call your endpoints if they guess the URLs. Authentication and authorisation protect your API; docs just describe it.

## Keeping docs in sync with the code

The biggest risk with any documentation is that it slowly stops matching reality. A few habits help:

1. **Write the comment in the same commit as the route.** Code reviews should check both.
2. **Add a test** that the spec contains the paths you expect, so removing docs by accident fails the build:

```js
// test/openapi.test.js
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { openapiSpec } from '../docs/openapi.js';

it('documents the notes endpoints', () => {
  assert.ok(openapiSpec.paths['/notes']?.get);
  assert.ok(openapiSpec.paths['/notes']?.post);
});
```

3. **Lint the spec.** Tools such as Redocly CLI and Spectral check an OpenAPI document for mistakes and missing descriptions.
4. **Generate schemas from your validation code.** You already describe request bodies with Zod in [Request Validation with Zod](/courses/expressjs/request-validation-with-zod). Zod 4 can convert a schema to JSON Schema with `z.toJSONSchema(schema)`, and community libraries build whole OpenAPI documents from Zod schemas. Then one schema drives both validation and docs.

## What else can you do with an OpenAPI document?

Once you have a correct spec, it unlocks a lot:

- **Client code generation:** tools such as OpenAPI Generator create typed client libraries for TypeScript, Python, Swift and more.
- **Mock servers:** frontend developers can work against a fake API that follows your spec before the real one is finished.
- **API testing tools:** apps like Postman and Insomnia can import the spec as a ready-made collection.
- **Contract checks:** tests can verify that real responses match the documented schemas.

## Common mistakes

- **Using `:id` in OpenAPI paths.** Write `{id}` in the document.
- **Bad YAML indentation inside comments.** One space out of place and `swagger-jsdoc` silently skips or misreads the block. Check `/openapi.json` to see what was generated.
- **Wrong `apis` glob.** The paths are relative to where you run `node`, not to the `openapi.js` file. If no routes appear, this is the usual cause.
- **Quoting status codes inconsistently.** Write response codes as strings: `'200'`, `'404'`.
- **Documenting only the happy path.** Include `400`, `401`, `404` and other error responses so clients know what to handle.

## Key takeaways

- **OpenAPI** is a standard, machine-readable way to describe an HTTP API; **Swagger UI** turns it into an interactive page.
- A document has `info`, `paths` (with parameters, request bodies and responses) and reusable `components.schemas`.
- `swagger-jsdoc` builds the document from `@openapi` comments next to your routes; `swagger-ui-express` serves it at `/docs`.
- Describe auth once with `securitySchemes`, then add `security` to protected routes.
- Keep docs honest with reviews, tests, linting, and by generating schemas from your validation code where possible.

## Practice

1. Document `GET /notes/{id}` in your Notes API, including the `404` response, and check it appears on `/docs`.
2. Add the `bearerAuth` scheme and mark one protected route. Use the **Authorize** button to call it with a token.
3. Open `/openapi.json` and import it into Postman or Insomnia. What did the tool create for you?
4. Deliberately break the YAML indentation in one comment. What happens to `/docs`? How did you find the problem?

## What's next

OpenAPI describes the shape of your data for other people. TypeScript describes it for your editor and compiler. Continue with [TypeScript with Express 5](/courses/expressjs/typescript-with-express).
