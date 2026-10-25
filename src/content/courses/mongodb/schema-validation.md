---
title: Schema Validation with JSON Schema
slug: schema-validation
metadescription: Learn how to add rules to a MongoDB collection with $jsonSchema so bad documents are rejected, and how validation levels and actions work.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'schema-validation', 'json-schema', 'data-quality']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- Why you might want rules on a "flexible" MongoDB collection
- How to write a `$jsonSchema` validator for the `products` collection
- How to read MongoDB's "Document failed validation" error
- How to add or change rules on an existing collection with `collMod`
- What **validation levels** and **validation actions** do

> **Before you start:** this lesson assumes you're comfortable with [Inserting Documents](/courses/mongodb/inserting-documents) and [Updating Documents](/courses/mongodb/updating-documents).

## Why add rules to a flexible database?

MongoDB lets you store any shape of document. That is handy while you are building, but in a real app it can lead to problems:

- A typo saves `prcie: 49` instead of `price: 49`, and the product suddenly has no price.
- A bug stores the price as the text `"49"` instead of the number `49`, and sorting by price breaks.
- Someone forgets the `name` field entirely.

**Schema validation** lets you tell MongoDB, "every document in this collection must follow these rules". MongoDB checks every insert and update, and rejects the ones that break the rules.

> **Think of it like this:** A validator is like a security guard at the door of a building. The building (collection) still has rooms of different shapes, but the guard checks that everyone coming in has a ticket and is wearing a badge. People already inside are not checked again unless they move.

Your app may already validate data. Database validation is a **safety net** that catches mistakes from every app, script and teammate that writes to the collection.

## Your first validator

Validation rules are written in **JSON Schema**, a popular standard for describing the shape of JSON data. MongoDB uses it through the `$jsonSchema` operator.

Let's create a fresh `products` collection with rules:

```javascript
use shop

db.createCollection("products", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "category", "price", "stock"],
      properties: {
        name: {
          bsonType: "string",
          description: "name is required and must be a string"
        },
        category: {
          enum: ["stationery", "electronics", "kitchen"],
          description: "category must be one of the known categories"
        },
        price: {
          bsonType: "number",
          minimum: 0,
          description: "price must be a number, 0 or more"
        },
        stock: {
          bsonType: "int",
          minimum: 0,
          description: "stock must be a whole number, 0 or more"
        },
        tags: {
          bsonType: "array",
          items: { bsonType: "string" },
          description: "tags must be an array of strings"
        },
        rating: {
          bsonType: "number",
          minimum: 0,
          maximum: 5
        }
      }
    }
  }
})
// → { ok: 1 }
```

> **Note:** If `products` already exists from earlier lessons, `createCollection` fails with "Collection already exists". Use `collMod` (shown later in this lesson) to add rules to an existing collection, or practise on a new name like `products2`.

Let's read the rules line by line:

| Keyword | Meaning |
| --- | --- |
| `bsonType: "object"` | The document itself must be an object (it always is). |
| `required` | These fields must be present. |
| `properties` | Rules for individual fields. |
| `bsonType` | The field's BSON type: `"string"`, `"int"`, `"double"`, `"bool"`, `"date"`, `"objectId"`, `"array"`, `"object"` and so on. |
| `"number"` | A handy alias that accepts any numeric type (int, long, double, decimal). |
| `enum` | The value must be one from this list. |
| `minimum` / `maximum` | Number limits. |
| `items` | Rules for each element of an array. |
| `description` | A human message shown in error details. |

Fields not listed in `properties` (like a new `color` field) are still allowed. That keeps the collection flexible.

## Seeing validation in action

A good document goes in as usual:

```javascript
db.products.insertOne({
  name: "Notebook", category: "stationery", price: 49, stock: 120, tags: ["paper", "school"]
})
// → { acknowledged: true, insertedId: ObjectId("...") }
```

Now let's break a rule by using a negative price:

```javascript
db.products.insertOne({ name: "Broken Pen", category: "stationery", price: -5, stock: 10 })
```

MongoDB refuses and explains exactly why:

```text
MongoServerError: Document failed validation
Additional information: {
  failingDocumentId: ObjectId('...'),
  details: {
    operatorName: '$jsonSchema',
    schemaRulesNotSatisfied: [
      {
        operatorName: 'properties',
        propertiesNotSatisfied: [
          {
            propertyName: 'price',
            description: 'price must be a number, 0 or more',
            details: [
              { operatorName: 'minimum', specifiedAs: { minimum: 0 },
                reason: 'comparison failed', consideredValue: -5 }
            ]
          }
        ]
      }
    ]
  }
}
```

Read it from the inside out: the `price` property failed the `minimum` rule because `-5` is below `0`. Your `description` text appears too, which is why it is worth writing good descriptions.

A missing required field looks like this:

```javascript
db.products.insertOne({ name: "Mystery Box", category: "kitchen", stock: 5 })
// → MongoServerError: Document failed validation
//   ... { operatorName: 'required', specifiedAs: { required: [ 'name', 'category', 'price', 'stock' ] },
//         missingProperties: [ 'price' ] }
```

Updates are checked too:

```javascript
db.products.updateOne({ name: "Notebook" }, { $set: { category: "toys" } })
// → MongoServerError: Document failed validation  (toys is not in the enum)
```

> **Tip:** In mongosh, a whole number like `120` is sent as a 32-bit integer (`int`), and a number with decimals like `49.5` is sent as a `double`. If you are unsure which type your app sends, use `bsonType: "number"` to accept any numeric type.

## More useful rules

Here are a few other JSON Schema keywords you will use often:

```javascript
{
  email:    { bsonType: "string", pattern: "^.+@.+$" },        // must look like an email
  name:     { bsonType: "string", minLength: 2, maxLength: 80 },
  tags:     { bsonType: "array", minItems: 1, maxItems: 10, uniqueItems: true },
  joinedAt: { bsonType: "date" },
  status:   { enum: ["pending", "shipped", "delivered"] },
  address:  {
    bsonType: "object",
    required: ["city"],
    properties: { city: { bsonType: "string" } }
  },
  nickname: { bsonType: ["string", "null"] }                    // either a string or null
}
```

### Locking the shape completely

If you want to forbid *any* field that is not listed, add `additionalProperties: false`. Remember to list `_id`, because every document has it:

```javascript
$jsonSchema: {
  bsonType: "object",
  additionalProperties: false,
  required: ["name"],
  properties: {
    _id:  { bsonType: "objectId" },
    name: { bsonType: "string" }
  }
}
```

> **Warning:** `additionalProperties: false` removes MongoDB's flexibility. Use it only for collections whose shape really must never change, such as an audit log.

## Adding rules to an existing collection

Most of the time the collection already exists. Use the `collMod` command to add or replace its validator:

```javascript
db.runCommand({
  collMod: "customers",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email"],
      properties: {
        name:     { bsonType: "string" },
        email:    { bsonType: "string", pattern: "^.+@.+$" },
        isMember: { bsonType: "bool" }
      }
    }
  }
})
// → { ok: 1 }
```

> **Note:** `collMod` **replaces** the whole validator. To change one rule, send the complete new schema, not just the changed part.

To see the current rules:

```javascript
db.getCollectionInfos({ name: "customers" })[0].options.validator
```

### Finding documents that already break the rules

Validation only runs on writes. Documents that were inserted before the rules existed are **not** checked or removed. You can find them with `$jsonSchema` inside `$nor`:

```javascript
const schema = db.getCollectionInfos({ name: "customers" })[0].options.validator.$jsonSchema

db.customers.find({ $nor: [ { $jsonSchema: schema } ] })
// → every customer that does NOT match the schema
```

Fix those documents before you make the rules strict.

## Validation levels

The **validation level** decides *which* writes are checked.

| Level | What it checks |
| --- | --- |
| `"strict"` (default) | Every insert and every update. |
| `"moderate"` | Inserts, and updates to documents that were **already valid**. Updates to old invalid documents are allowed through. |
| `"off"` | Nothing. The rules are stored but not enforced. |

`moderate` is great when you add rules to an old collection with some messy data. New and already-good documents stay clean, and old messy ones can still be edited while you fix them.

```javascript
db.runCommand({ collMod: "customers", validationLevel: "moderate" })
```

## Validation actions

The **validation action** decides *what happens* when a write breaks the rules.

| Action | What happens |
| --- | --- |
| `"error"` (default) | The write is rejected with "Document failed validation". |
| `"warn"` | The write is **allowed**, but a warning is written to the MongoDB server log. |
| `"errorAndLog"` | The write is rejected **and** the failure is written to the server log. New in MongoDB 8.1. |

`warn` is a gentle way to roll out new rules: watch the log for a week, fix the code that sends bad data, then switch to `error`.

```javascript
db.runCommand({ collMod: "customers", validationAction: "warn" })
```

> **Warning:** If you use `errorAndLog`, older MongoDB versions don't understand it. Change it back to `error` or `warn` before downgrading below 8.1.

## Using query operators as rules

Besides `$jsonSchema`, a validator can use normal query operators. This is handy for rules that compare two fields, using `$expr`:

```javascript
db.runCommand({
  collMod: "orders",
  validator: {
    $and: [
      { status: { $in: ["pending", "shipped", "delivered"] } },
      { total: { $gte: 0 } }
    ]
  }
})
```

You can even combine both styles inside one `$and`. Most teams stick to `$jsonSchema` because it is easier to read and gives better error details.

## Skipping validation (rarely)

Users with the right privilege can pass `bypassDocumentValidation: true` to skip the rules for one operation, for example during a data import:

```javascript
db.products.insertOne(
  { name: "Legacy Item", price: "unknown" },
  { bypassDocumentValidation: true }
)
```

Use this only for one-off maintenance jobs, never in normal app code.

## Common mistakes

- **Expecting old documents to be checked.** Validation only runs on future writes. Use the `$nor` + `$jsonSchema` query to find old bad documents.
- **Using `"int"` when the app sends doubles.** A price like `49.5` fails `bsonType: "int"`. Use `"number"` or `"double"` for prices.
- **Forgetting `_id` with `additionalProperties: false`.** Every insert then fails, because `_id` is not in the list.
- **Sending only the changed rule with `collMod`.** It replaces the whole validator, so the other rules disappear.
- **Treating the database as your only validation.** Still validate in your app so users get friendly error messages.

## Practice

1. Create a `reviews` collection where `productId` (an objectId), `stars` (a whole number from 1 to 5) and `text` (a string) are required.
2. Insert one valid review and one with `stars: 7`. What error detail do you expect?
3. Change the `reviews` collection so that bad writes are only logged, not rejected.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1.
db.createCollection("reviews", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["productId", "stars", "text"],
      properties: {
        productId: { bsonType: "objectId" },
        stars: { bsonType: "int", minimum: 1, maximum: 5, description: "stars must be 1 to 5" },
        text: { bsonType: "string", minLength: 1 }
      }
    }
  }
})

// 2.
db.reviews.insertOne({ productId: ObjectId(), stars: 5, text: "Great mug!" })  // OK
db.reviews.insertOne({ productId: ObjectId(), stars: 7, text: "Too good" })
// → Document failed validation ... propertyName: 'stars', operatorName: 'maximum', consideredValue: 7

// 3.
db.runCommand({ collMod: "reviews", validationAction: "warn" })
```

</details>

## Key takeaways

- Schema validation adds rules to a collection, and MongoDB checks them on every insert and update.
- Write rules with `$jsonSchema`: `required`, `properties`, `bsonType`, `enum`, `minimum`, `pattern` and friends.
- Use `createCollection` for new collections and `collMod` for existing ones (it replaces the whole validator).
- **Validation level** (`strict`, `moderate`, `off`) controls which writes are checked.
- **Validation action** (`error`, `warn`, and `errorAndLog` from 8.1) controls what happens on a failure.
- Existing documents are not re-checked; find them with `$nor` and `$jsonSchema`.

**Next lesson:** [Single Field and Compound Indexes](/courses/mongodb/indexes-single-and-compound)
