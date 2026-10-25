---
title: Comparison and Logical Query Operators
slug: query-operators
metadescription: Learn MongoDB's comparison operators ($gt, $lt, $in, $ne and friends) and logical operators ($and, $or, $not, $nor) with simple, runnable mongosh examples.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'queries', 'operators', 'crud']
course: mongodb
---
## What you will learn

By the end of this lesson you will know how to:

- Find documents where a number is bigger, smaller, or inside a range
- Match a field against a list of values with `$in` and `$nin`
- Combine conditions with `$and`, `$or` and `$nor`
- Flip a condition with `$not`
- Avoid the classic `$ne` and duplicate-key traps

In the last lesson you used `find()` with simple filters like `{ category: "kitchen" }`. That only finds exact matches. Operators let you ask richer questions, such as "products cheaper than 300" or "items that are electronics **or** out of stock".

## Get the sample data ready

Open mongosh and load the `shop` data we use across the course. If you already have it, you can skip this. Running it again resets the `products` collection to a clean state.

```javascript
use shop

db.products.deleteMany({})
db.products.insertMany([
  { name: "Notebook", category: "stationery", price: 49, stock: 120, tags: ["paper", "school"] },
  { name: "Gel Pen", category: "stationery", price: 15, stock: 500, tags: ["pen", "school"] },
  { name: "Headphones", category: "electronics", price: 1999, stock: 35, tags: ["audio", "wireless"], rating: 4.5 },
  { name: "USB Cable", category: "electronics", price: 299, stock: 0, tags: ["cable"] },
  { name: "Coffee Mug", category: "kitchen", price: 249, stock: 60, tags: ["ceramic", "gift"], rating: 4.8 }
])
```

## What is a query operator?

A **query operator** is a special key that starts with a dollar sign (`$`). Instead of saying "the price *is* 49", it lets you say "the price is *greater than* 49".

You always put the operator inside a small object next to the field name:

```javascript
// Shape of every comparison:  { field: { $operator: value } }
db.products.find({ price: { $gt: 100 } })
```

Read it out loud: "find products where price is greater than 100".

> **Think of it like this:** A plain filter is like asking a shopkeeper for "the 49 rupee notebook". An operator is like saying "show me everything under 300". Same shop, smarter question.

## Comparison operators

These compare a field with a value. Here is the full set:

| Operator | Meaning | Example |
| --- | --- | --- |
| `$eq` | equal to | `{ price: { $eq: 49 } }` |
| `$ne` | not equal to | `{ category: { $ne: "kitchen" } }` |
| `$gt` | greater than | `{ price: { $gt: 100 } }` |
| `$gte` | greater than or equal to | `{ stock: { $gte: 60 } }` |
| `$lt` | less than | `{ price: { $lt: 50 } }` |
| `$lte` | less than or equal to | `{ rating: { $lte: 4.5 } }` |
| `$in` | equal to any value in a list | `{ category: { $in: ["kitchen", "stationery"] } }` |
| `$nin` | not equal to any value in a list | `{ category: { $nin: ["electronics"] } }` |

The letters are easy to remember: **g**reater **t**han, **l**ess **t**han, and an extra **e** for "or **e**qual".

### Greater than and less than

Let's find products that cost more than 200:

```javascript
db.products.find({ price: { $gt: 200 } })
// → Headphones (1999), USB Cable (299), Coffee Mug (249)
```

Now products with 60 or fewer items in stock:

```javascript
db.products.find({ stock: { $lte: 60 } })
// → Headphones (35), USB Cable (0), Coffee Mug (60)
```

Notice that the Coffee Mug is included because `$lte` means "less than **or equal to**". If you used `$lt: 60`, the mug would not appear.

### `$eq` is usually optional

These two queries do exactly the same thing:

```javascript
db.products.find({ category: "kitchen" })
db.products.find({ category: { $eq: "kitchen" } })
```

The short form is what most people write. `$eq` is handy when you build queries in code and want every condition to look the same.

### Ranges: two operators on one field

To find products priced between 100 and 500, put both operators inside the **same** object:

```javascript
db.products.find({ price: { $gte: 100, $lte: 500 } })
// → USB Cable (299), Coffee Mug (249)
```

MongoDB reads this as "price is at least 100 **and** at most 500". You don't need `$and` for this.

### `$in`: match any value from a list

Instead of asking the same question many times, give MongoDB a list:

```javascript
db.products.find({ category: { $in: ["kitchen", "stationery"] } })
// → Notebook, Gel Pen, Coffee Mug
```

`$in` also works nicely with arrays. Our products have a `tags` array, and `$in` matches if **any** tag is in your list:

```javascript
db.products.find({ tags: { $in: ["gift", "wireless"] } })
// → Headphones (has "wireless"), Coffee Mug (has "gift")
```

### `$nin`: none of these values

`$nin` means "not in". It is the opposite of `$in`:

```javascript
db.products.find({ category: { $nin: ["electronics", "kitchen"] } })
// → Notebook, Gel Pen
```

### `$ne`: not equal

```javascript
db.products.find({ category: { $ne: "electronics" } })
// → Notebook, Gel Pen, Coffee Mug
```

> **Warning:** `$ne` and `$nin` also match documents where the field **does not exist at all**. For example, `{ rating: { $ne: 4.5 } }` returns the Coffee Mug (rating 4.8) *and* the Notebook, Gel Pen and USB Cable, which have no `rating` field. If you only want documents that have the field, add `$exists: true` (see below).

```javascript
db.products.find({ rating: { $ne: 4.5 } })
// → Notebook, Gel Pen, USB Cable, Coffee Mug   (3 of these have no rating!)

db.products.find({ rating: { $ne: 4.5, $exists: true } })
// → Coffee Mug
```

### Comparing text and dates

Comparison operators are not just for numbers. They work on strings (in alphabetical order, where uppercase letters come before lowercase ones) and on dates:

```javascript
// Names that come before "H" in the alphabet
db.products.find({ name: { $lt: "H" } })
// → Gel Pen, Coffee Mug

// Customers who joined in 2026 or later (if you have a customers collection)
db.customers.find({ joinedAt: { $gte: ISODate("2026-01-01") } })
```

> **Note:** MongoDB only compares values of the same kind in a filter like this. `{ price: { $gt: 100 } }` will not match a document where `price` is the string `"150"`. Keep your types consistent: numbers as numbers, dates as dates.

## Logical operators

Logical operators combine several conditions into one question.

| Operator | Meaning |
| --- | --- |
| `$and` | every condition must be true |
| `$or` | at least one condition must be true |
| `$nor` | none of the conditions can be true |
| `$not` | flips a single condition on one field |

`$and`, `$or` and `$nor` take an **array** of conditions. `$not` wraps one operator.

### The hidden `$and`

When you list several fields in one filter, MongoDB already joins them with AND:

```javascript
// Electronics that are in stock
db.products.find({ category: "electronics", stock: { $gt: 0 } })
// → Headphones
```

This is called an **implicit AND**. Writing it with `$and` gives the same result:

```javascript
db.products.find({
  $and: [
    { category: "electronics" },
    { stock: { $gt: 0 } }
  ]
})
// → Headphones
```

Most of the time the short form is clearer. You need the explicit `$and` in two cases: when the same field appears twice (see "Common mistakes"), or when you combine two `$or` groups.

### `$or`: at least one must match

Let's find products that are either in the kitchen category or cost less than 20:

```javascript
db.products.find({
  $or: [
    { category: "kitchen" },
    { price: { $lt: 20 } }
  ]
})
// → Gel Pen (price 15), Coffee Mug (kitchen)
```

> **Tip:** If all your `$or` conditions test the **same field** for equality, `$in` is shorter and usually faster. `{ $or: [{ category: "kitchen" }, { category: "stationery" }] }` is the same as `{ category: { $in: ["kitchen", "stationery"] } }`.

### Mixing AND with OR

You can put an `$or` next to normal fields. The normal fields still act as AND:

```javascript
// Electronics that are out of stock OR cost more than 1000
db.products.find({
  category: "electronics",
  $or: [
    { stock: 0 },
    { price: { $gt: 1000 } }
  ]
})
// → Headphones (price 1999), USB Cable (stock 0)
```

Read it as: category is electronics **AND** (stock is 0 **OR** price is over 1000).

### Two `$or` groups need an explicit `$and`

A JavaScript object can only have one key called `$or`. So when you need two OR groups, wrap them in `$and`:

```javascript
// (kitchen OR stationery) AND (rated 4.5+ OR price under 20)
db.products.find({
  $and: [
    { $or: [{ category: "kitchen" }, { category: "stationery" }] },
    { $or: [{ rating: { $gte: 4.5 } }, { price: { $lt: 20 } }] }
  ]
})
// → Gel Pen, Coffee Mug
```

### `$nor`: none of these

`$nor` returns documents that fail **every** condition in the list:

```javascript
// Not electronics, and not cheaper than 20
db.products.find({
  $nor: [
    { category: "electronics" },
    { price: { $lt: 20 } }
  ]
})
// → Notebook, Coffee Mug
```

Like `$ne`, `$nor` also matches documents that are missing the fields you list.

### `$not`: flip one condition

`$not` goes **inside** a field and wraps another operator:

```javascript
// Price is NOT greater than 200
db.products.find({ price: { $not: { $gt: 200 } } })
// → Notebook, Gel Pen
```

You might think this is the same as `{ price: { $lte: 200 } }`. It is almost the same, with one difference: `$not` also returns documents that have **no** `price` field. With our data every product has a price, so the results match.

`$not` is also useful with patterns (regular expressions):

```javascript
// Names that do NOT start with "C"
db.products.find({ name: { $not: /^C/ } })
// → Notebook, Gel Pen, Headphones, USB Cable
```

> **Note:** `$not` cannot be used at the top level like `{ $not: { price: 50 } }`. It must sit under a field name. To negate a whole group of conditions, use `$nor`.

## Bonus: `$exists`

`$exists` is not a comparison operator, but you will use it with them all the time. It checks whether a field is present:

```javascript
// Products that have a rating
db.products.find({ rating: { $exists: true } })
// → Headphones, Coffee Mug

// Products that have no rating yet
db.products.find({ rating: { $exists: false } })
// → Notebook, Gel Pen, USB Cable
```

## SQL comparison

If you know SQL, this table maps the ideas across:

```sql
SELECT * FROM products WHERE price > 100 AND price <= 500;
SELECT * FROM products WHERE category IN ('kitchen', 'stationery');
SELECT * FROM products WHERE category = 'kitchen' OR price < 20;
```

```javascript
db.products.find({ price: { $gt: 100, $lte: 500 } })
db.products.find({ category: { $in: ["kitchen", "stationery"] } })
db.products.find({ $or: [{ category: "kitchen" }, { price: { $lt: 20 } }] })
```

## Common mistakes

- **Repeating a field in one object.** `{ price: { $gt: 100 }, price: { $lt: 500 } }` looks fine, but JavaScript keeps only the **last** `price` key, so you get "price less than 500". Put both operators together: `{ price: { $gt: 100, $lt: 500 } }`.
- **Forgetting the array brackets.** `$or`, `$and` and `$nor` need an array: `{ $or: [ {...}, {...} ] }`. Writing `{ $or: { a: 1, b: 2 } }` gives an error.
- **Surprise results from `$ne` and `$nin`.** They include documents missing the field. Add `$exists: true` when that's not what you want.
- **Comparing the wrong type.** `{ price: { $gt: "100" } }` compares against a string and won't match numeric prices. Pass a number.
- **Putting `$not` at the top level.** It must go under a field name. Use `$nor` to negate whole conditions.

## Practice

Use the `shop.products` collection.

1. Find all products with a price of at least 50 and at most 1000.
2. Find products tagged `"school"` or `"cable"`.
3. Find products that are in stock **and** are either stationery or rated 4.5 or higher.
4. Find products that are **not** in the electronics or kitchen categories, using `$nor`.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. A range on one field
db.products.find({ price: { $gte: 50, $lte: 1000 } })
// → USB Cable, Coffee Mug

// 2. $in on an array field matches if any tag is in the list
db.products.find({ tags: { $in: ["school", "cable"] } })
// → Notebook, Gel Pen, USB Cable

// 3. Implicit AND with an $or group
db.products.find({
  stock: { $gt: 0 },
  $or: [{ category: "stationery" }, { rating: { $gte: 4.5 } }]
})
// → Notebook, Gel Pen, Headphones, Coffee Mug

// 4. $nor with two conditions
db.products.find({
  $nor: [{ category: "electronics" }, { category: "kitchen" }]
})
// → Notebook, Gel Pen
```

</details>

## Key takeaways

- Operators start with `$` and go inside an object next to the field: `{ price: { $gt: 100 } }`.
- Comparison operators: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`.
- Several fields in one filter are joined with an implicit AND. Use `$and` when a field or `$or` repeats.
- `$or` needs at least one match, `$nor` needs none, and `$not` flips one condition on a field.
- `$ne`, `$nin`, `$not` and `$nor` also match documents that don't have the field, so pair them with `$exists` when needed.

**Next lesson:** [Projections and Field Selection](/courses/mongodb/projections)
