---
title: "Conversion Operators: convert, toObject and toArray"
slug: conversion-operators
metadescription: Learn to fix messy data types in MongoDB with $convert, $toInt, $toDate and $toObjectId, and parse JSON strings with $toObject and $toArray, added in 8.3.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'aggregation', 'convert', 'data-types']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [BSON Types and Document Structure](/courses/mongodb/bson-types-and-documents) and [Core Stages: match, project, group and sort](/courses/mongodb/core-aggregation-stages).

## What you will learn

By the end of this lesson you will know:

- Why the **type** of a value matters (`"49"` is not `49`)
- How to use the shortcut operators **`$toInt`**, **`$toDouble`**, **`$toDate`**, **`$toObjectId`**, **`$toString`** and friends
- How **`$convert`** handles bad data safely with **`onError`** and **`onNull`**
- How to parse JSON text into real documents and arrays with **`$toObject`** and **`$toArray`** (added in MongoDB 8.3)
- How `$arrayToObject` and `$objectToArray` differ from those
- How to do each job on older versions

## "49" is not 49

Data often arrives with the wrong types. A CSV import turns every number into text. A web form sends `"true"` instead of `true`. A webhook stores a whole JSON object as one long string.

MongoDB treats these values differently:

```javascript
"49"  // a string: you can't add it, and it sorts like text ("100" comes before "49")
49    // a number: you can do maths with it
```

Let's create a small collection of messy imported products to clean up:

```javascript
use shop

db.productImports.drop()
db.productImports.insertMany([
  { _id: 1, sku: "NB-01",  price: "49",   stock: "120", addedOn: "2026-10-01",
    details: '{"color": "blue", "pages": 200}', sizes: '["A4", "A5"]' },
  { _id: 2, sku: "PEN-02", price: "15.5", stock: "500", addedOn: "2026-10-02",
    details: '{"color": "black"}', sizes: '[]' },
  { _id: 3, sku: "MUG-03", price: "N/A",  stock: "",    addedOn: "not sure",
    details: "oops, not JSON", sizes: '"M"' },
  { _id: 4, sku: "CBL-04" }
])
```

Every field except `_id` is a string, and some are broken or missing. That's realistic!

> **Think of it like this:** Our conveyor belt has a "translator" station. Packages arrive labelled in the wrong language: a number written out as text, a date written as words. The translator rewrites each label in the right language so the workers further down can understand it. If a label is unreadable, a good translator puts a "could not read" sticker on it instead of stopping the whole factory.

## The shortcut operators

For the common cases, MongoDB has one-word operators. Each takes a single value:

```javascript
db.productImports.aggregate([
  { $match: { _id: 1 } },
  { $project: {
      price: { $toDouble: "$price" },
      stock: { $toInt: "$stock" },
      addedOn: { $toDate: "$addedOn" }
  } }
])
// → [ { _id: 1, price: 49, stock: 120, addedOn: ISODate("2026-10-01T00:00:00.000Z") } ]
```

| Operator | Converts to | Example |
| --- | --- | --- |
| `$toInt` | 32-bit integer | `"120"` → `120` |
| `$toLong` | 64-bit integer | `"120"` → `Long("120")` |
| `$toDouble` | Decimal number | `"15.5"` → `15.5` |
| `$toDecimal` | High-precision decimal (good for money) | `"15.5"` → `Decimal128("15.5")` |
| `$toBool` | `true` / `false` | `1` → `true` |
| `$toDate` | Date | `"2026-10-01"` → `ISODate("2026-10-01T00:00:00.000Z")` |
| `$toString` | String | `49` → `"49"` |
| `$toObjectId` | ObjectId | `"66a000000000000000000001"` → `ObjectId("66a000000000000000000001")` |
| `$toUUID` | UUID (MongoDB 8.0+) | `"0e3b9063-8abd-4eb3-9f9f-f4c59fd30a60"` → `UUID("0e3b9063-...")` |
| `$toObject` | Document (MongoDB 8.3+) | `'{"a": 1}'` → `{ a: 1 }` |
| `$toArray` | Array (MongoDB 8.3+) | `'[1, 2]'` → `[1, 2]` |

A few surprises to know:

- `$toInt: "15.5"` is an **error**: a string must be a whole number to become an int. Use `$toDouble` for text with a decimal point.
- `$toInt: 15.5` (a *number*, not text) works and **cuts off** the decimals: `15`.
- `$toBool: "false"` is `true`! Any non-empty string becomes `true`. Compare strings yourself instead: `{ $eq: ["$flag", "true"] }`.

### $toObjectId fixes broken joins

In [Joining Collections with lookup](/courses/mongodb/lookup-and-joins), you saw that a `$lookup` finds nothing when one side stores an id as a string. `$toObjectId` repairs it on the fly:

```javascript
db.reviews.insertOne({ productId: "66b000000000000000000005", stars: 5 })   // id saved as text by mistake

db.reviews.aggregate([
  { $lookup: {
      from: "products",
      let: { pid: { $toObjectId: "$productId" } },          // convert first
      pipeline: [ { $match: { $expr: { $eq: ["$_id", "$$pid"] } } }, { $project: { _id: 0, name: 1 } } ],
      as: "product"
  } }
])
// → [ { _id: ObjectId("..."), productId: "66b000000000000000000005", stars: 5, product: [ { name: "Coffee Mug" } ] } ]
```

(This assumes the `products` collection from [Aggregation Pipeline Fundamentals](/courses/mongodb/aggregation-pipeline-fundamentals).)

## When conversion fails

Try the shortcuts on all four imports:

```javascript
db.productImports.aggregate([
  { $project: { price: { $toDouble: "$price" } } }
])
// MongoServerError: ... Failed to parse number 'N/A' in $convert with no onError value ...
```

One bad value (`"N/A"`) stops the **whole** pipeline. The shortcut operators have no safety net. That's what `$convert` is for.

## $convert: the careful translator

`$convert` does the same conversions, but lets you say what to do when things go wrong:

```javascript
{ $convert: {
    input: <expression>,      // the value to convert
    to: <type>,               // "double", "int", "date", "object"...
    onError: <expression>,    // optional: used if the value can't be converted
    onNull: <expression>      // optional: used if the value is null or missing
} }
```

Clean all four imports safely:

```javascript
db.productImports.aggregate([
  { $project: {
      sku: 1,
      price:   { $convert: { input: "$price",   to: "double", onError: null, onNull: null } },
      stock:   { $convert: { input: "$stock",   to: "int",    onError: 0,    onNull: 0 } },
      addedOn: { $convert: { input: "$addedOn", to: "date",   onError: null } }
  } }
])
// → [
//   { _id: 1, sku: "NB-01",  price: 49,   stock: 120, addedOn: ISODate("2026-10-01T00:00:00.000Z") },
//   { _id: 2, sku: "PEN-02", price: 15.5, stock: 500, addedOn: ISODate("2026-10-02T00:00:00.000Z") },
//   { _id: 3, sku: "MUG-03", price: null, stock: 0,   addedOn: null },
//   { _id: 4, sku: "CBL-04", price: null, stock: 0,   addedOn: null }
// ]
```

Row by row:

| `_id` | What happened |
| --- | --- |
| 1, 2 | Everything converted normally. |
| 3 | `"N/A"`, `""` and `"not sure"` can't be converted, so `onError` values were used. |
| 4 | The fields are **missing**, so `onNull` values were used. (`addedOn` has no `onNull`, and `$convert` returns `null` by default.) |

> **Tip:** Every `$toXxx` operator is just a short way to write `$convert` without `onError` and `onNull`. For example, `{ $toInt: "$stock" }` is the same as `{ $convert: { input: "$stock", to: "int" } }`. Use the shortcut for clean data, and `$convert` for data you don't trust.

### Number bases (MongoDB 8.3+)

Since MongoDB 8.3, `$convert` has an optional `base` field for converting between strings and numbers in base `2`, `8`, `10` or `16`:

```javascript
db.aggregate([
  { $documents: [ { hex: "FF", bits: "1010", n: 10 } ] },
  { $project: {
      _id: 0,
      fromHex:  { $convert: { input: "$hex",  to: "int",    base: 16 } },
      fromBits: { $convert: { input: "$bits", to: "int",    base: 2 } },
      toBits:   { $convert: { input: "$n",    to: "string", base: 2 } }
  } }
])
// → [ { fromHex: 255, fromBits: 10, toBits: "1010" } ]
```

Prefixes like `"0x"` are **not** allowed in the input string. On versions before 8.3 there's no `base` option; do this kind of conversion in your application code.

## Parsing JSON strings: $toObject and $toArray (MongoDB 8.3+)

Look at the `details` and `sizes` fields. They *contain* JSON, but MongoDB sees them as plain text. You can't query `details.color` because there is no `color` field, just one long string.

MongoDB 8.3 added two operators that **parse** JSON text:

- **`$toObject`** turns a string holding a JSON *object* into a real embedded document.
- **`$toArray`** turns a string holding a JSON *array* into a real array.

```javascript
db.productImports.aggregate([
  { $match: { _id: { $in: [1, 2] } } },
  { $project: {
      sku: 1,
      details: { $toObject: "$details" },
      sizes: { $toArray: "$sizes" }
  } }
])
// → [
//   { _id: 1, sku: "NB-01",  details: { color: "blue", pages: 200 }, sizes: ["A4", "A5"] },
//   { _id: 2, sku: "PEN-02", details: { color: "black" },            sizes: [] }
// ]
```

Before: `details: '{"color": "blue", "pages": 200}'` (a string).
After: `details: { color: "blue", pages: 200 }` (a document). Now `"$details.pages"` works.

Some rules from the docs:

- The string must be **valid JSON**: no comments, no trailing commas.
- `$toObject` needs a JSON **object** at the top (`{...}`); `$toArray` needs a JSON **array** (`[...]`). `$toObject: "[]"` is an error.
- Whole numbers become `int` (or `long` if they're too big for an int); numbers with a decimal point become `double`.
- **Extended JSON wrappers** like `{"$oid": "..."}` or `{"$date": "..."}` are *not* turned into ObjectIds or dates. They stay as plain nested documents. (The next lesson shows `$deserializeEJSON`, which does that.)
- `null` or a missing field gives `null`.

### Handling bad JSON

Document 3 has `"oops, not JSON"` and `'"M"'` (a JSON string, not an array). Like the other shortcuts, `$toObject` and `$toArray` stop the pipeline with an error. Use `$convert` with `to: "object"` or `to: "array"` (also new in 8.3) and an `onError`:

```javascript
db.productImports.aggregate([
  { $project: {
      details: { $convert: { input: "$details", to: "object", onError: {}, onNull: {} } },
      sizes:   { $convert: { input: "$sizes",   to: "array",  onError: [], onNull: [] } }
  } }
])
// → [
//   { _id: 1, details: { color: "blue", pages: 200 }, sizes: ["A4", "A5"] },
//   { _id: 2, details: { color: "black" },            sizes: [] },
//   { _id: 3, details: {},                            sizes: [] },
//   { _id: 4, details: {},                            sizes: [] }
// ]
```

### The other direction: $toString on objects and arrays (8.3+)

Starting in 8.3, `$toString` can also turn a document or array **into** a JSON string:

```javascript
db.aggregate([
  { $documents: [ { details: { color: "blue", pages: 200 }, sizes: ["A4", "A5"] } ] },
  { $project: { _id: 0, detailsText: { $toString: "$details" }, sizesText: { $toString: "$sizes" } } }
])
// → [ { detailsText: '{"color":"blue","pages":200}', sizesText: '["A4","A5"]' } ]
```

### Arrays from binary vectors

`$toArray` can also read a **binary vector** (BinData subtype 9, used for AI embeddings) and return a normal array of numbers. You'll see vectors in [Vector Search for AI Workloads](/courses/mongodb/vector-search). In 8.3, `$convert` can also go the other way, turning an array of numbers into `binData`.

### Before MongoDB 8.3

On 8.0 and earlier, the server can't parse JSON strings. Parse them in your application before (or after) talking to MongoDB:

```javascript
// Node.js: fix the stored strings once, in your app
const cursor = db.collection("productImports").find({ details: { $type: "string" } });
for await (const doc of cursor) {
  let details = {};
  try { details = JSON.parse(doc.details); } catch { /* leave it empty */ }
  await db.collection("productImports").updateOne({ _id: doc._id }, { $set: { details } });
}
```

Better still, parse JSON **when you import it**, so it never gets stored as a string. `mongoimport` with a `.json` file does this for you (see [Import, Export and Data Migration Tools](/courses/mongodb/import-export-and-tools)).

## Not the same thing: $arrayToObject and $objectToArray

These two older operators (available since 3.4.4) sound similar but do a different job. They don't parse text. They **reshape** real documents and arrays using `{ k, v }` pairs (k = key, v = value).

**`$arrayToObject`** builds a document from a list of key/value pairs. Turn order 1's items into a quick "name → quantity" lookup:

```javascript
db.orders.aggregate([
  { $match: { _id: 1 } },
  { $project: {
      qtyByName: {
        $arrayToObject: {
          $map: { input: "$items", as: "i", in: { k: "$$i.name", v: "$$i.qty" } }
        }
      }
  } }
])
// → [ { _id: 1, qtyByName: { Notebook: 2, "Gel Pen": 4 } } ]
```

**`$objectToArray`** does the opposite: it turns a document's fields into a list. That's useful when you don't know the field names in advance:

```javascript
db.products.aggregate([
  { $match: { name: "Coffee Mug" } },
  { $project: { _id: 0, pairs: { $objectToArray: { price: "$price", stock: "$stock" } } } }
])
// → [ { pairs: [ { k: "price", v: 249 }, { k: "stock", v: 60 } ] } ]
```

| Operator | Input | Output |
| --- | --- | --- |
| `$toObject` (8.3+) | A **string** of JSON text | A document |
| `$toArray` (8.3+) | A **string** of JSON text (or a binary vector) | An array |
| `$arrayToObject` | An **array** of `{ k, v }` pairs | A document |
| `$objectToArray` | A **document** | An array of `{ k, v }` pairs |

## Fixing the data for good

So far we only converted values *in the results*. The stored data is still messy. To fix it permanently, use the same expressions in an **update with a pipeline**:

```javascript
db.productImports.updateMany({}, [
  { $set: {
      price: { $convert: { input: "$price", to: "double", onError: null, onNull: null } },
      stock: { $convert: { input: "$stock", to: "int",    onError: 0,    onNull: 0 } }
  } }
])
// → { acknowledged: true, matchedCount: 4, modifiedCount: 4, ... }
```

Check the result with `$type`:

```javascript
db.productImports.aggregate([ { $project: { priceType: { $type: "$price" }, stockType: { $type: "$stock" } } } ])
// → _id 1 and 2: priceType "double", stockType "int"; _id 3 and 4: priceType "null", stockType "int"
```

> **Tip:** Once the data is clean, add [schema validation](/courses/mongodb/schema-validation) so new documents can't arrive with the wrong types again.

## Common mistakes

- **Using a shortcut on untrusted data.** One bad value stops the whole pipeline. Use `$convert` with `onError`.
- **`$toInt` on decimal text.** `"15.5"` can't become an int. Use `$toDouble` (or `$toDecimal` for money).
- **Trusting `$toBool` with strings.** `"false"` and `"no"` both become `true`. Compare the text instead.
- **Confusing `$toObject` with `$arrayToObject`.** `$toObject` parses a JSON **string**; `$arrayToObject` builds a document from `{ k, v }` pairs.
- **Expecting `$toObject` to restore dates and ObjectIds.** `{"$date": ...}` stays a plain document. Use `$deserializeEJSON` (next lesson) for Extended JSON.

## Practice

Use the `productImports` collection (re-run the setup if you changed it).

1. Return each `sku` with `price` as a `decimal`, using `0` when the price is missing or broken.
2. On MongoDB 8.3+, return the `color` from `details` for every document, using `"unknown"` when it can't be read.
3. Turn order 5's `items` into a document like `{ Headphones: 1999, "Coffee Mug": 249 }` (name → price).

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Decimal prices
db.productImports.aggregate([
  { $project: { sku: 1, price: { $convert: { input: "$price", to: "decimal", onError: 0, onNull: 0 } } } }
])
// → NB-01 Decimal128("49"), PEN-02 Decimal128("15.5"), MUG-03 0, CBL-04 0

// 2. Colour from the JSON string (8.3+)
db.productImports.aggregate([
  { $set: { details: { $convert: { input: "$details", to: "object", onError: {}, onNull: {} } } } },
  { $project: { sku: 1, color: { $ifNull: ["$details.color", "unknown"] } } }
])
// → NB-01 "blue", PEN-02 "black", MUG-03 "unknown", CBL-04 "unknown"

// 3. Name → price
db.orders.aggregate([
  { $match: { _id: 5 } },
  { $project: {
      priceByName: { $arrayToObject: { $map: { input: "$items", as: "i", in: { k: "$$i.name", v: "$$i.price" } } } }
  } }
])
// → [ { _id: 5, priceByName: { Headphones: 1999, "Coffee Mug": 249 } } ]
```

</details>

## Key takeaways

- The **type** of a value matters: `"49"` and `49` behave differently in maths, sorting and joins.
- Shortcuts like `$toInt`, `$toDouble`, `$toDate`, `$toObjectId` and `$toUUID` (8.0+) are quick but **stop the pipeline** on bad data.
- **`$convert`** does the same conversions with **`onError`** and **`onNull`** safety nets; since 8.3 it also has a **`base`** option.
- **`$toObject`** and **`$toArray`** (added in 8.3) parse JSON text into real documents and arrays; on older versions, parse JSON in your app.
- `$arrayToObject` and `$objectToArray` reshape existing data with `{ k, v }` pairs; they don't parse text.
- Use an update with a pipeline to fix stored types permanently.

**Next lesson:** [Expression Operators: hash, createObjectId and EJSON](/courses/mongodb/expression-operators)
