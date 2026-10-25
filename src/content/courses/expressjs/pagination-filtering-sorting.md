---
publishDate: 2026-10-25T09:36
title: Pagination, Filtering and Sorting
slug: pagination-filtering-sorting
metadescription: Learn to add page-based and cursor-based pagination, safe filters, search and multi-field sorting to Express 5 list endpoints, with Zod, Mongoose and Sequelize examples.
updateDate: 2026-10-25T09:36
author: ['bishal-biswas']
level: 2
tags: ['express', 'pagination', 'rest', 'api-design']
course: expressjs
---

## What you will learn

- Why list endpoints must never return "everything"
- How to design query parameters for pages, filters, search and sorting
- How to validate those parameters safely with Zod
- How to implement them in memory, with Mongoose and with Sequelize
- When to use **cursor pagination** instead of page numbers

## Why lists need limits

Your `GET /books` route works fine with 10 books. With 2 million, it would load every row, build a giant JSON string, and send megabytes to a phone that only shows 20 items on screen. The server slows down, the database works hard, and the user waits.

**Pagination** means returning a list in small chunks, called **pages**. **Filtering** means returning only items that match some condition. **Sorting** means choosing the order.

**Think of it like search results.** A search engine does not show you every matching web page at once. It shows ten, sorted by relevance, with "Next" at the bottom, and lets you narrow results with filters. Your API should behave the same way.

## The query-string contract

All three features live in the **query string**, because they refine a list rather than identify a resource. Here is the design this lesson builds:

```text
GET /books?page=2&limit=20&author=Ursula%20K.%20Le%20Guin&minYear=1960&q=earth&sort=-year,title
```

| Parameter | Meaning | Default |
| --- | --- | --- |
| `page` | Which page, starting at 1 | `1` |
| `limit` | Items per page, capped at 100 | `20` |
| `author` | Exact author match | none |
| `minYear`, `maxYear` | Year range | none |
| `q` | Case-insensitive search in the title | none |
| `tags` | Comma-separated tags, all must match | none |
| `sort` | Comma-separated fields; `-` in front means descending | `-createdAt` |

And the response shape:

```json
{
  "data": [{ "id": 21, "title": "The Lathe of Heaven", "year": 1971 }],
  "meta": {
    "page": 2,
    "limit": 20,
    "total": 134,
    "totalPages": 7,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

The `meta` block lets a frontend draw "Page 2 of 7" and enable or disable the Next and Previous buttons.

> **Note:** Express 5 uses the "simple" query parser by default. `?year[gte]=1960` is **not** turned into a nested object; you get a key literally named `year[gte]`. That is why this design uses flat names like `minYear`. Repeated keys (`?tag=a&tag=b`) do become an array.

## Step 1: Validate the query with Zod

Query values always arrive as strings, and any of them can be missing, repeated or nonsense. Validate them first, using the `validate` middleware from [Request Validation with Zod](/courses/expressjs/request-validation-with-zod).

```js
// src/schemas/list-books-query.js
import { z } from 'zod';

const SORT_FIELDS = ['title', 'author', 'year', 'createdAt'];

export const listBooksQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  author: z.string().trim().min(1).optional(),
  minYear: z.coerce.number().int().optional(),
  maxYear: z.coerce.number().int().optional(),
  q: z.string().trim().min(1).max(100).optional(),
  tags: z
    .string()
    .transform((value) => value.split(',').map((tag) => tag.trim()).filter(Boolean))
    .optional(),

  // "-year,title" becomes [{ field: 'year', direction: 'desc' }, { field: 'title', direction: 'asc' }]
  sort: z
    .string()
    .default('-createdAt')
    .transform((value) =>
      value.split(',').filter(Boolean).map((part) => ({
        field: part.trim().replace(/^-/, ''),
        direction: part.trim().startsWith('-') ? 'desc' : 'asc',
      })),
    )
    .refine(
      (parts) => parts.length > 0 && parts.every((p) => SORT_FIELDS.includes(p.field)),
      `sort may only use: ${SORT_FIELDS.join(', ')}`,
    ),
});
```

Three rules hide in this schema:

1. **`limit` has a maximum.** Without it, a client could ask for `limit=1000000` and undo all your work.
2. **Sorting uses an allowlist.** An **allowlist** is a list of the only values you accept. Clients cannot sort by a secret field such as `passwordHash`, or by a column with no database index.
3. **Every filter must be a plain string or number.** If someone sends `?author=a&author=b`, `author` arrives as an array and Zod rejects it with a clear `400`.

## Step 2: A version with an in-memory array

Start with plain JavaScript, so you can see the logic without a database in the way. Here is some sample data (add more rows to see several pages):

```js
// src/data/books.js
export const books = [
  { id: 1, title: 'A Wizard of Earthsea', author: 'Ursula K. Le Guin', year: 1968, tags: ['fantasy', 'classic'], createdAt: '2026-10-01T10:00:00.000Z' },
  { id: 2, title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', year: 1969, tags: ['sci-fi'], createdAt: '2026-10-02T10:00:00.000Z' },
  { id: 3, title: 'Dune', author: 'Frank Herbert', year: 1965, tags: ['sci-fi', 'classic'], createdAt: '2026-10-03T10:00:00.000Z' },
  { id: 4, title: 'The Lathe of Heaven', author: 'Ursula K. Le Guin', year: 1971, tags: ['sci-fi'], createdAt: '2026-10-04T10:00:00.000Z' },
  { id: 5, title: 'Kindred', author: 'Octavia E. Butler', year: 1979, tags: ['classic'], createdAt: '2026-10-05T10:00:00.000Z' },
];
```

```js
// src/routes/books.js
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { listBooksQuery } from '../schemas/list-books-query.js';
import { books } from '../data/books.js'; // an array of book objects

const router = Router();

const compareBy = ({ field, direction }) => (a, b) => {
  const result = typeof a[field] === 'string'
    ? a[field].localeCompare(b[field])
    : a[field] - b[field];
  return direction === 'desc' ? -result : result;
};

router.get('/', validate({ query: listBooksQuery }), (req, res) => {
  const { page, limit, author, minYear, maxYear, q, tags, sort } = req.validated.query;

  // 1. Filter
  let items = books.filter((book) =>
    (author === undefined || book.author === author) &&
    (minYear === undefined || book.year >= minYear) &&
    (maxYear === undefined || book.year <= maxYear) &&
    (q === undefined || book.title.toLowerCase().includes(q.toLowerCase())) &&
    (tags === undefined || tags.every((tag) => book.tags.includes(tag))),
  );

  // 2. Sort: try each sort field in turn until two books differ
  items = items.toSorted((a, b) => {
    for (const rule of sort) {
      const result = compareBy(rule)(a, b);
      if (result !== 0) return result;
    }
    return a.id - b.id; // tie-breaker keeps the order stable
  });

  // 3. Paginate
  const total = items.length;
  const offset = (page - 1) * limit;
  const data = items.slice(offset, offset + limit);
  const totalPages = Math.ceil(total / limit);

  res.json({
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
});

export default router;
```

The order always matters: **filter, then sort, then cut out the page**. If you paginate before filtering, pages come back half-empty.

The **offset** is how many items to skip. Page 1 skips 0, page 2 skips `limit`, page 3 skips `2 * limit`, and so on.

> **Note:** `toSorted()` returns a sorted copy and leaves the original array alone. It needs Node.js 20 or newer. On older versions, use `[...items].sort(...)`.

Try it:

```bash
curl "http://localhost:3000/books?limit=2&sort=-year"
curl "http://localhost:3000/books?minYear=1960&maxYear=1979&sort=title"
curl "http://localhost:3000/books?q=earth&page=1&limit=5"
curl "http://localhost:3000/books?sort=passwordHash"
```

The last one returns `400` with the message `sort may only use: title, author, year, createdAt`.

### A stable sort tie-breaker

Notice `return a.id - b.id` at the end of the sort. If two books have the same year, the database (or JavaScript) may return them in a different order on each request. Then a book can appear on page 1 *and* page 2, or on neither. Always add a unique field, such as `id`, as the final sort key.

## Step 3: The same thing with Mongoose

In a real database, let the database do the filtering, sorting and slicing. It can use **indexes** (lookup structures that make searching fast) and only send you the rows you need.

This builds on the `Book` model from [CRUD API with MongoDB and Mongoose](/courses/expressjs/crud-api-with-mongodb). Add a `year: { type: Number }` field to its schema first, since the filters below use it.

```js
// src/routes/books.js (MongoDB version)
import { Router } from 'express';
import { Book } from '../models/book.js';
import { validate } from '../middleware/validate.js';
import { listBooksQuery } from '../schemas/list-books-query.js';

const router = Router();

// Make user text safe to use inside a regular expression
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/', validate({ query: listBooksQuery }), async (req, res) => {
  const { page, limit, author, minYear, maxYear, q, tags, sort } = req.validated.query;

  const filter = {};
  if (author) filter.author = author;
  if (minYear !== undefined || maxYear !== undefined) {
    filter.year = {};
    if (minYear !== undefined) filter.year.$gte = minYear;
    if (maxYear !== undefined) filter.year.$lte = maxYear;
  }
  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };
  if (tags) filter.tags = { $all: tags };

  const sortSpec = {};
  for (const { field, direction } of sort) sortSpec[field] = direction === 'desc' ? -1 : 1;
  sortSpec._id = 1; // tie-breaker

  // Run both queries at the same time
  const [data, total] = await Promise.all([
    Book.find(filter).sort(sortSpec).skip((page - 1) * limit).limit(limit),
    Book.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);
  res.json({
    data,
    meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
  });
});

export default router;
```

> **Warning:** Never write `Book.find(req.query)`. If your app uses the extended query parser, `?author[$ne]=nobody` becomes `{ author: { $ne: 'nobody' } }`, which matches *every* book. This is called **NoSQL injection**. Build the filter yourself from validated values, as above.

`escapeRegex` matters too. Without it, a search for `.*` would match everything, and a carefully crafted pattern can make the regex engine run for a very long time.

## Step 4: The same thing with Sequelize

This uses the `Book` model from [CRUD API with SQL and an ORM](/courses/expressjs/crud-api-with-sql), with an added `year: DataTypes.INTEGER` column. Sequelize has `findAndCountAll`, which returns the page of rows *and* the total count in one call. **`Op`** holds Sequelize's comparison operators, such as "greater than or equal".

```js
// src/routes/books.js (SQL version)
import { Router } from 'express';
import { Op } from 'sequelize';
import { Book } from '../models/book.js';
import { validate } from '../middleware/validate.js';
import { listBooksQuery } from '../schemas/list-books-query.js';

const router = Router();

router.get('/', validate({ query: listBooksQuery }), async (req, res) => {
  const { page, limit, author, minYear, maxYear, q, sort } = req.validated.query;

  const where = {};
  if (author) where.author = author;
  if (minYear !== undefined || maxYear !== undefined) {
    where.year = {};
    if (minYear !== undefined) where.year[Op.gte] = minYear;
    if (maxYear !== undefined) where.year[Op.lte] = maxYear;
  }
  if (q) where.title = { [Op.like]: `%${q}%` };

  const order = sort.map(({ field, direction }) => [field, direction.toUpperCase()]);
  order.push(['id', 'ASC']); // tie-breaker

  const { rows, count } = await Book.findAndCountAll({
    where,
    order,
    limit,
    offset: (page - 1) * limit,
  });

  const totalPages = Math.ceil(count / limit);
  res.json({
    data: rows,
    meta: { page, limit, total: count, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
  });
});

export default router;
```

> **Tip:** In SQLite, `LIKE` ignores case for plain English letters. In PostgreSQL it is case-sensitive, so use `Op.iLike` there. Tags in SQL usually live in a separate table, which needs a join, so they are left out of this example.

## Offset pagination vs cursor pagination

Everything so far is **offset pagination**: "skip N items, take the next 20". It is simple and lets users jump to page 7. But it has two weaknesses.

1. **It gets slower on deep pages.** To skip 100,000 rows, the database still has to walk past them.
2. **Items shift.** If someone adds a book while you read page 1, the last item of page 1 slides onto page 2, and you see it twice.

**Cursor pagination** fixes both. Instead of a page number, the client sends a **cursor**: a marker meaning "continue after this item". Usually it is the id (or sort value) of the last item it received.

**Think of it like a bookmark.** "Page 47" breaks if someone inserts pages earlier in the book. A bookmark stays exactly where you left off.

```js
// src/routes/feed.js (MongoDB, newest first)
import { Router } from 'express';
import { z } from 'zod';
import { Book } from '../models/book.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const feedQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  after: z.string().regex(/^[a-f0-9]{24}$/, 'Invalid cursor').optional(), // an ObjectId
});

router.get('/', validate({ query: feedQuery }), async (req, res) => {
  const { limit, after } = req.validated.query;

  const filter = after ? { _id: { $lt: after } } : {};
  // Ask for one extra item to find out whether there is another page
  const items = await Book.find(filter).sort({ _id: -1 }).limit(limit + 1);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;

  res.json({
    data,
    meta: { nextCursor: hasMore ? data.at(-1).id : null },
  });
});

export default router;
```

The client calls `GET /feed`, then `GET /feed?after=<nextCursor>`, and stops when `nextCursor` is `null`. MongoDB ObjectIds roughly increase over time, so sorting by `_id` gives "newest first" for free.

| | Offset (`page`) | Cursor (`after`) |
| --- | --- | --- |
| Jump to page 7 | Yes | No, only next/previous |
| Total count and "Page 2 of 7" | Easy | Extra query, often skipped |
| Speed on deep pages | Slows down | Stays fast |
| New items while scrolling | Duplicates or gaps | Stable |
| Good for | Admin tables, search results | Infinite scroll, feeds, large exports |

> **Tip:** Many APIs encode the cursor (for example with base64) so clients treat it as an opaque string and do not depend on what is inside. That leaves you free to change the cursor format later.

## Performance tips

- **Add indexes** for fields you filter or sort by often, such as `author`, `year` and `createdAt`. Without one, the database scans every row.
- **Count only when needed.** `countDocuments` and `COUNT(*)` can be slow on huge tables. Cursor pagination often skips the total.
- **Keep `limit` capped**, and choose a sensible default.
- **Select only needed fields** for list views, for example `Book.find(filter).select('title author year')`.

## Common mistakes

- **Paginating before filtering**, so pages contain fewer items than they should.
- **No maximum `limit`**, letting one request ask for the whole table.
- **No tie-breaker in the sort**, so items appear twice or vanish between pages.
- **Passing raw query values to the database**, opening the door to NoSQL injection and sorting by any field.
- **Forgetting that query values are strings.** `'2' + 1` is `'21'`. Coerce and validate with Zod.

## Key takeaways

- List endpoints should always paginate, with a default and a maximum `limit`.
- Put pagination, filters, search and sort in the **query string** and validate every value with Zod.
- Process in the right order: **filter, sort, then paginate**, and let the database do the work.
- Use an **allowlist** for sort fields and add a unique **tie-breaker** for stable pages.
- Use **offset pagination** for numbered pages and **cursor pagination** for feeds, infinite scroll and very large data.

## Practice

1. Add a `maxPages` filter to the books list (books with at most that many pages) and test it with `curl`.
2. Return `links: { next, prev }` in `meta`, built with `URLSearchParams`, so clients can follow URLs instead of computing page numbers.
3. Request `?page=999`. What does your API return? Decide whether an empty `data` array or a `404` is better, and justify it.
4. Convert the cursor example to Sequelize, using `id` as the cursor and `Op.lt`.

## What's next

As your API grows, you will eventually need to change it without breaking existing apps. Learn how in [API Versioning](/courses/expressjs/api-versioning).
