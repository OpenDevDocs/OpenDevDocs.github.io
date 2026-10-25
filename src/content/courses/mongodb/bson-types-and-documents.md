---
title: BSON Types and Document Structure
slug: bson-types-and-documents
metadescription: Learn what BSON is, the data types MongoDB stores (strings, numbers, dates, arrays, ObjectId and more) and the rules every document must follow.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'bson', 'data-types', 'documents']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- What **BSON** is and why MongoDB uses it instead of plain JSON
- The data types you'll use every day: strings, numbers, booleans, dates, arrays, embedded documents, null and ObjectId
- The difference between the number types (`Int32`, `Double`, `Long`, `Decimal128`)
- How to check a field's type with `$type`
- The rules every document must follow (size limit, `_id`, field names)

## From JSON to BSON

You already know JSON. It's the text format used all over the web:

```json
{ "name": "Notebook", "price": 49, "inStock": true }
```

JSON is great, but it has two problems for a database:

1. **It has very few types.** Just strings, numbers, true/false, null, arrays and objects. There's **no date type** and no way to say "this number is an integer" or "this is a precise decimal".
2. **It's text.** Text is slow for a computer to scan and parse, because it has to read every character to find where a value ends.

So MongoDB stores documents as **BSON**, short for **Binary JSON**. BSON keeps the same shape as JSON, but:

- it's stored as compact **binary** data, which is fast to read and write
- it adds extra **types**, like dates, several kinds of numbers, ObjectId and binary data

> **Think of it like this:** JSON is a handwritten recipe card: easy for people to read. BSON is the same recipe typed into a well-organised database form, with labelled boxes for "date", "whole number" and "exact amount". Easier for the computer, and nothing gets misread.

You never write raw BSON yourself. You type JavaScript-like documents in mongosh or your app, and the driver converts them to BSON behind the scenes.

## The everyday types

Here is one document that uses most of the common types. Each field is a different type:

```javascript
use shop

db.typesDemo.insertOne({
  name: "Headphones",                          // String
  price: 1999,                                 // Int32 (a whole number)
  rating: 4.5,                                 // Double (a decimal number)
  wireless: true,                              // Boolean
  tags: ["audio", "wireless"],                 // Array
  dimensions: { widthCm: 18, heightCm: 20 },   // Embedded document (Object)
  discount: null,                              // Null
  addedAt: new Date("2026-10-25T08:00:00Z"),   // Date
  supplierId: ObjectId("6718a2f1c3b4e5d6f7a8b9c0") // ObjectId
})
```

Let's go through them one by one.

### String

Text, always inside quotes. BSON strings are **UTF-8**, so any language works: `"Asha"`, `"राहुल"`, `"東京"`, `"café"`.

```javascript
{ name: "Gel Pen", city: "Kolkata" }
```

### Boolean

Just `true` or `false`, **without quotes**.

```javascript
{ isMember: true, wireless: false }
```

> **Warning:** `"true"` (with quotes) is a *string*, not a boolean. A query for `{ isMember: true }` will **not** find a document where `isMember` is `"true"`.

### Numbers (there are four kinds!)

BSON has four number types. In daily work you'll mostly meet the first two.

| Type | What it holds | How to write it in mongosh | Good for |
| --- | --- | --- | --- |
| **Int32** ("int") | Whole numbers up to about ±2.1 billion | `49` or `Int32(49)` | Counts, quantities, stock |
| **Double** ("double") | Numbers with decimals (approximate) | `4.5` or `Double(4)` | Ratings, measurements |
| **Long** ("long") | Very large whole numbers | `Long("9007199254740993")` | Big counters, IDs from other systems |
| **Decimal128** ("decimal") | Exact decimal numbers | `Decimal128("19.99")` | Money, when every cent must be exact |

How does mongosh pick a type when you just type a number?

- If it's a whole number that fits in 32 bits, mongosh stores it as **Int32**. So `price: 49` is an Int32.
- Otherwise (for example `4.5`, or a whole number bigger than about 2.1 billion), it stores a **Double**.

Why does `Decimal128` exist? Because doubles can't store some decimals exactly. Try this in mongosh:

```javascript
0.1 + 0.2
// → 0.30000000000000004
```

That tiny error is normal for doubles in every programming language. For prices with paise or cents, it can add up. `Decimal128` avoids it:

```javascript
db.typesDemo.insertOne({ item: "Gift Card", amount: Decimal128("19.99") })
```

> **Note:** In this course, prices are whole numbers (like `49` or `1999`), so plain numbers are fine. In a real shop that needs exact decimal prices, use `Decimal128`, or store prices in the smallest unit (for example `4999` paise instead of `49.99` rupees).

Good news: all number types compare by their **value**. A query for `{ price: 49 }` matches `49` whether it's stored as Int32, Long or Double.

### Date

Dates are stored as the number of **milliseconds since 1 January 1970, in UTC** (world standard time). mongosh shows them wrapped in `ISODate(...)`.

Create dates with `new Date()` or `ISODate()`:

```javascript
new Date()                          // right now
// → ISODate("2026-10-25T08:00:00.000Z")

new Date("2026-01-15")              // a specific day
ISODate("2026-01-15T10:30:00Z")     // a specific moment
```

> **Warning:** `Date()` **without** `new` returns a plain **string**, not a date! Always write `new Date()`. Dates stored as strings can't be compared or sorted correctly as dates.

```javascript
typeof Date()        // → string   (wrong for storing)
typeof new Date()    // → object   (a real Date)
```

The `Z` at the end means UTC. MongoDB always stores dates in UTC. Your app converts them to local time (like India Standard Time) when showing them to users.

### Array

An ordered list of values inside square brackets. Values can be any type, even documents.

```javascript
{ tags: ["paper", "school"] }
{ scores: [72, 88, 95] }
{ items: [ { name: "Notebook", qty: 2 }, { name: "Gel Pen", qty: 5 } ] }
```

Arrays are one of MongoDB's superpowers. A query for `{ tags: "school" }` finds every document whose `tags` array *contains* `"school"`. You'll learn much more in [Working with Arrays](/courses/mongodb/working-with-arrays).

### Embedded document (Object)

A document inside a document, in curly braces. Use it to group related fields.

```javascript
{
  name: "Asha Roy",
  address: { street: "12 Park Street", city: "Kolkata", pin: "700016" }
}
```

You reach inside with **dot notation**, such as `"address.city"`. See [Embedded Documents and Dot Notation](/courses/mongodb/embedded-documents).

> **Tip:** Store postal codes and phone numbers as **strings**, not numbers. They're labels, not amounts, and some start with `0`, which a number would drop.

### Null

`null` means "this field exists, but has no value".

```javascript
{ name: "USB Cable", rating: null }
```

This is different from a **missing** field, where the field isn't there at all:

```javascript
{ name: "Notebook" }    // no rating field at all
```

You'll see in [Querying with find and Filters](/courses/mongodb/querying-with-find) that a query for `{ rating: null }` matches **both** cases.

### ObjectId

A 12-byte unique ID, shown as 24 hexadecimal characters:

```javascript
ObjectId("6718a2f1c3b4e5d6f7a8b9c0")
```

MongoDB uses it as the default `_id` value. It gets a whole lesson of its own next: [ObjectId and the _id Field](/courses/mongodb/objectid-and-id-field).

### Less common types

You won't need these often, but it's good to recognise them:

| Type | What it is |
| --- | --- |
| **Binary data** ("binData") | Raw bytes, such as a small image thumbnail, or a UUID created with `UUID()` |
| **Regular expression** ("regex") | A text pattern, like `/^note/i` |
| **Timestamp** | An internal type MongoDB uses for replication. For your own dates, always use **Date**. |
| **MinKey / MaxKey** | Special values that sort lower / higher than everything else |

## Checking a field's type with $type

Since one collection can hold different types in the same field, it's useful to ask "which documents store this field as a string?". The `$type` query operator does that.

Let's create a few documents with the same field stored as different types:

```javascript
db.typesDemo.insertMany([
  { item: "A", value: 1 },                     // Int32
  { item: "B", value: 1.5 },                   // Double
  { item: "C", value: Long("1") },             // Long
  { item: "D", value: Decimal128("1.50") },    // Decimal128
  { item: "E", value: "1" }                    // String!
])
```

Now find only the strings:

```javascript
db.typesDemo.find({ value: { $type: "string" } })
// → [ { _id: ObjectId("..."), item: "E", value: "1" } ]
```

Find **any** kind of number with the special alias `"number"`:

```javascript
db.typesDemo.find({ value: { $type: "number" } }, { item: 1, _id: 0 })
// → [ { item: "A" }, { item: "B" }, { item: "C" }, { item: "D" } ]
```

Useful type names for `$type`:

| Alias | Type |
| --- | --- |
| `"string"` | String |
| `"int"`, `"long"`, `"double"`, `"decimal"` | The four number types |
| `"number"` | Any of the four number types |
| `"bool"` | Boolean |
| `"date"` | Date |
| `"array"` | Array |
| `"object"` | Embedded document |
| `"null"` | Null |
| `"objectId"` | ObjectId |

> **Tip:** `$type` is a great detective tool for messy data. For example, `db.products.find({ price: { $type: "string" } })` finds products where someone saved the price as text by mistake.

## The rules every document follows

MongoDB is flexible, but a few rules always apply.

### 1. Every document has an `_id`

Every document in a normal collection must have a unique `_id` field. If you don't give one, MongoDB creates an ObjectId for you. The `_id` is always stored as the **first** field.

### 2. Maximum size: 16 MB

One document can be at most **16 mebibytes** (about 16.7 million bytes). That's a lot of text, roughly a few thousand pages of a book. If you hit this limit, it usually means a design problem, like an array that keeps growing forever. For big files (videos, large PDFs), MongoDB offers [GridFS for Large Files](/courses/mongodb/gridfs).

### 3. Nesting depth: at most 100 levels

Documents inside documents inside documents... can go up to **100 levels** deep. Real documents rarely go past 3 or 4. (On Atlas free clusters, the limit is 50 levels.)

### 4. Field name rules

- Field names are **strings** and are **case-sensitive**: `Name` and `name` are two different fields.
- Each field name must be **unique** within its document.
- `_id` is reserved for the document's ID.
- Field names may technically contain dots (`.`) and dollar signs (`$`), but **avoid them**. Dots clash with dot notation and `$` clashes with operators.

### 5. Field order is kept

MongoDB keeps your fields in the order you wrote them (with `_id` moved to the front). You normally don't need to care about field order, except when you compare whole embedded documents, which you'll see in a later lesson.

## A note on Extended JSON

Since plain JSON has no Date or ObjectId type, MongoDB tools use **Extended JSON** when they need to write BSON as text, for example when exporting to a `.json` file. Special types become small objects with a `$` key:

```json
{
  "_id": { "$oid": "6718a2f1c3b4e5d6f7a8b9c0" },
  "name": "Notebook",
  "addedAt": { "$date": "2026-10-25T08:00:00Z" },
  "amount": { "$numberDecimal": "19.99" }
}
```

You'll see this format in Compass's JSON view, in the VS Code extension, and in export files. Just remember: `{ "$oid": ... }` means ObjectId and `{ "$date": ... }` means Date.

## Common mistakes

- **Storing numbers or booleans as strings.** `"49"` and `49` are different. So are `"true"` and `true`. Queries, sorting and maths only work correctly with the right type.
- **Writing `Date()` instead of `new Date()`.** Without `new` you store a string, not a date.
- **Using doubles for money that needs exact decimals.** Use `Decimal128`, or store whole amounts in the smallest unit (paise/cents).
- **Storing phone numbers or PIN codes as numbers.** Leading zeros disappear and you can't do maths on them anyway. Use strings.
- **Letting arrays grow without limit.** A document can't exceed 16 MB. Put unbounded lists (like every log entry ever) in their own collection.

## Practice

1. Write a document for a customer named Priya from Kochi who joined on 5 April 2026, is a member, has a phone number `"09876543210"` and an address with a street and a city.
2. Which type should each field use: a product's stock count, a product rating like 4.8, an exact bank balance, the date of an order?
3. Write a query that finds every product whose `price` was saved as text by mistake.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1.
db.customers.insertOne({
  name: "Priya Nair",
  city: "Kochi",
  joinedAt: new Date("2026-04-05"),
  isMember: true,
  phone: "09876543210",            // a string keeps the leading 0
  address: { street: "4 Marine Drive", city: "Kochi" }
})

// 2.
// stock count    → Int32 (whole number), e.g. 120
// rating 4.8     → Double
// bank balance   → Decimal128("10450.75")
// order date     → Date, e.g. new Date()

// 3.
db.products.find({ price: { $type: "string" } })
```

</details>

## Key takeaways

- MongoDB stores documents as **BSON**, a fast binary version of JSON with **more types**.
- Everyday types: **String**, **Boolean**, numbers (**Int32**, **Double**, **Long**, **Decimal128**), **Date**, **Array**, **embedded document**, **Null** and **ObjectId**.
- Use `new Date()` for dates (never `Date()`), and `Decimal128` when decimals must be exact.
- `$type` finds documents by a field's type. The `"number"` alias matches any number type.
- Every document has a unique `_id`, can be up to **16 MB**, and has case-sensitive field names.

**Next lesson:** [ObjectId and the _id Field](/courses/mongodb/objectid-and-id-field)
