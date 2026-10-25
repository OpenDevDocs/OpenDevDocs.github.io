---
title: Sorting, Limiting and Skipping
slug: sort-limit-skip
metadescription: Learn how to order MongoDB query results with sort(), return the top results with limit(), and build simple pages of results with skip().
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'queries', 'sorting', 'pagination']
course: mongodb
---
## What you will learn

By the end of this lesson you will know how to:

- Sort results from smallest to biggest, or biggest to smallest, with `sort()`
- Sort by more than one field
- Return only the first few results with `limit()`
- Skip results with `skip()` to build pages, like "page 2 of 5"
- Avoid the common traps with ties, missing fields and big skips

## Get the sample data ready

We'll use the `shop` database again. Run this in mongosh to start from a clean copy:

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

## Why results need sorting

Here is something that surprises many beginners: **MongoDB does not promise any order** for the results of `find()` unless you ask for one.

Often the documents seem to come back in the order you inserted them. But that is luck, not a rule. After updates, deletes, or on a bigger server, the order can change. If the order matters to your app (and it usually does), always sort.

> **Think of it like this:** Asking a library for "all books by Tagore" gives you a pile of books. Asking for "all books by Tagore, oldest first" gives you a neat row on the shelf. `sort()` is how you ask for the neat row.

## Sorting with `sort()`

You add `sort()` after `find()`. Inside it, you list the field and a direction:

- `1` means **ascending**: smallest first (A to Z, 0 to 9, oldest date first)
- `-1` means **descending**: biggest first (Z to A, 9 to 0, newest date first)

Let's list products from cheapest to most expensive:

```javascript
db.products.find({}, { name: 1, price: 1, _id: 0 }).sort({ price: 1 })
```

The result:

```javascript
[
  { name: "Gel Pen", price: 15 },
  { name: "Notebook", price: 49 },
  { name: "Coffee Mug", price: 249 },
  { name: "USB Cable", price: 299 },
  { name: "Headphones", price: 1999 }
]
```

Flip the direction with `-1` to get the most expensive first:

```javascript
db.products.find({}, { name: 1, price: 1, _id: 0 }).sort({ price: -1 })
// → Headphones (1999), USB Cable (299), Coffee Mug (249), Notebook (49), Gel Pen (15)
```

Sorting works on text too. This lists products in alphabetical order:

```javascript
db.products.find({}, { name: 1, _id: 0 }).sort({ name: 1 })
// → Coffee Mug, Gel Pen, Headphones, Notebook, USB Cable
```

And you can filter and sort at the same time:

```javascript
// Stationery, with the most stock first
db.products.find({ category: "stationery" }, { name: 1, stock: 1, _id: 0 }).sort({ stock: -1 })
// → Gel Pen (500), Notebook (120)
```

## Sorting by more than one field

You can give `sort()` several fields. MongoDB sorts by the **first** field, and only uses the second field to break ties.

Let's group products by category (A to Z), and inside each category show the most expensive first:

```javascript
db.products.find({}, { name: 1, category: 1, price: 1, _id: 0 })
  .sort({ category: 1, price: -1 })
```

The result:

```javascript
[
  { name: "Headphones", category: "electronics", price: 1999 },
  { name: "USB Cable", category: "electronics", price: 299 },
  { name: "Coffee Mug", category: "kitchen", price: 249 },
  { name: "Notebook", category: "stationery", price: 49 },
  { name: "Gel Pen", category: "stationery", price: 15 }
]
```

The order of the keys matters. `{ category: 1, price: -1 }` and `{ price: -1, category: 1 }` give very different lists.

> **Tip:** This is like sorting a spreadsheet by "Category", then by "Price". The first column wins; the second one only matters when the first column has the same value.

## What happens with missing fields?

Only two of our products have a `rating`. What happens when we sort by it?

```javascript
db.products.find({}, { name: 1, rating: 1, _id: 0 }).sort({ rating: -1 })
// → [
//     { name: "Coffee Mug", rating: 4.8 },
//     { name: "Headphones", rating: 4.5 },
//     { name: "Notebook" },
//     { name: "Gel Pen" },
//     { name: "USB Cable" }
//   ]
```

For sorting, MongoDB treats a missing field like `null`, and `null` is considered **smaller** than any number. So:

- With `-1` (descending), documents without the field come **last**.
- With `1` (ascending), they come **first**.

If you don't want them at all, filter them out: `find({ rating: { $exists: true } })`.

## Limiting results with `limit()`

`limit(n)` returns at most `n` documents. Together with `sort()`, it answers "top N" questions.

Here are the three most expensive products:

```javascript
db.products.find({}, { name: 1, price: 1, _id: 0 }).sort({ price: -1 }).limit(3)
// → Headphones (1999), USB Cable (299), Coffee Mug (249)
```

And the single product with the lowest stock:

```javascript
db.products.find({}, { name: 1, stock: 1, _id: 0 }).sort({ stock: 1 }).limit(1)
// → [ { name: "USB Cable", stock: 0 } ]
```

A few details worth knowing:

- If there are fewer documents than the limit, you just get all of them.
- `limit(0)` means "no limit". It returns everything.
- Without `sort()`, `limit(3)` gives you *some* three documents, not necessarily the ones you expect.

> **Note:** mongosh shows results in batches of 20. If a query returns more, you'll see `Type "it" for more`. That is just the shell being polite. It's not the same as `limit()`, which really stops the server from sending more.

## Skipping results with `skip()`

`skip(n)` jumps over the first `n` results. On its own it is rarely useful, but with `limit()` it lets you build **pages**.

Let's show products cheapest first, two per page:

```javascript
// Page 1: skip 0, take 2
db.products.find({}, { name: 1, price: 1, _id: 0 }).sort({ price: 1 }).skip(0).limit(2)
// → Gel Pen (15), Notebook (49)

// Page 2: skip 2, take 2
db.products.find({}, { name: 1, price: 1, _id: 0 }).sort({ price: 1 }).skip(2).limit(2)
// → Coffee Mug (249), USB Cable (299)

// Page 3: skip 4, take 2
db.products.find({}, { name: 1, price: 1, _id: 0 }).sort({ price: 1 }).skip(4).limit(2)
// → Headphones (1999)
```

The pattern is always the same:

```javascript
const pageSize = 2
const page = 2          // pages start at 1
db.products.find().sort({ price: 1 }).skip((page - 1) * pageSize).limit(pageSize)
```

| Page | skip | limit |
| --- | --- | --- |
| 1 | 0 | 2 |
| 2 | 2 | 2 |
| 3 | 4 | 2 |

> **Think of it like this:** `skip` is flipping past the first few pages of a book. `limit` is how many pages you read before you stop.

## The order of sort, skip and limit

You can chain these methods in any order, but MongoDB always runs them in this order:

1. **sort** the matching documents
2. **skip** the first `n`
3. **limit** to the next `n`

So these two lines give exactly the same result:

```javascript
db.products.find().sort({ price: 1 }).skip(2).limit(2)
db.products.find().limit(2).skip(2).sort({ price: 1 })
```

Writing them as sort, skip, limit is still the best habit, because it reads the way MongoDB thinks.

## Ties: make your sort predictable

What if two documents have the same value for the sort field? Then MongoDB may return them in **any** order, and that order can change between runs. For pages, this is a real problem: a product could appear on page 1 and again on page 2.

The fix is simple. Add a field that is always unique, like `_id`, as the last sort key:

```javascript
// Sort by category; if two products share a category, use _id to break the tie
db.products.find().sort({ category: 1, _id: 1 })
```

Now the order is the same every time.

## Bonus: case-insensitive sorting

By default, text is compared character by character, and capital letters come before small letters. So `"Zebra"` would sort before `"apple"`. If you want normal dictionary order, add a **collation**, which is a set of language rules for comparing text:

```javascript
db.products.find().sort({ name: 1 }).collation({ locale: "en", strength: 2 })
```

`strength: 2` tells MongoDB to ignore upper and lower case. You don't need this for our sample data, but it's good to know when you sort user-entered names.

## A word about big skips

`skip()` is simple, but it is not free. To skip 10,000 documents, the server still has to walk past those 10,000 documents first. On page 1 you won't notice. On page 500 of a huge collection, it gets slow.

For large lists, many apps use a different approach called **range-based pagination** (sometimes "keyset" pagination). Instead of skipping, you remember the last value you showed and ask for the ones after it:

```javascript
// First page
db.products.find().sort({ _id: 1 }).limit(2)

// Next page: everything after the last _id we showed
const lastId = ObjectId("...")   // the _id of the last product on the previous page
db.products.find({ _id: { $gt: lastId } }).sort({ _id: 1 }).limit(2)
```

This stays fast no matter how deep you go, especially once you learn about indexes. For small collections and learning, `skip()` is perfectly fine.

## In application code

The same methods exist in the Node.js driver, which you'll set up in the *Connecting MongoDB to Your First App* lesson:

```javascript
// Node.js driver
const topThree = await db.collection("products")
  .find({})
  .sort({ price: -1 })
  .limit(3)
  .toArray();
```

## Common mistakes

- **Expecting an order without `sort()`.** Insertion order is not guaranteed. Always sort when order matters.
- **Using `limit()` without `sort()` for "top N".** You get *a* few documents, not the top ones.
- **Forgetting a tie-breaker.** Sorting on a field with repeated values gives an unstable order, which breaks pagination. Add `_id` as the last key.
- **Off-by-one page math.** For page `p` with size `s`, skip `(p - 1) * s`, not `p * s`.
- **Storing numbers as text.** If prices are saved as strings like `"100"` and `"20"`, they sort as text, so `"100"` comes before `"20"`. Store numbers as numbers.

## Practice

1. List all products by stock, highest first, showing only the name and stock.
2. Show the two cheapest electronics products.
3. Sort products by category (A to Z) and then by name (A to Z).
4. With a page size of 2 and sorting by name, show page 2.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Descending sort on stock
db.products.find({}, { name: 1, stock: 1, _id: 0 }).sort({ stock: -1 })
// → Gel Pen (500), Notebook (120), Coffee Mug (60), Headphones (35), USB Cable (0)

// 2. Filter, sort ascending, limit
db.products.find({ category: "electronics" }).sort({ price: 1 }).limit(2)
// → USB Cable (299), Headphones (1999)

// 3. Two sort keys
db.products.find({}, { name: 1, category: 1, _id: 0 }).sort({ category: 1, name: 1 })
// → Headphones, USB Cable, Coffee Mug, Gel Pen, Notebook

// 4. Page 2 means skip (2 - 1) * 2 = 2
db.products.find({}, { name: 1, _id: 0 }).sort({ name: 1 }).skip(2).limit(2)
// → Headphones, Notebook
```

</details>

## Key takeaways

- Without `sort()`, MongoDB returns results in no guaranteed order.
- `sort({ field: 1 })` is ascending, `sort({ field: -1 })` is descending. With several keys, the first key wins.
- `limit(n)` returns at most `n` documents. With `sort()`, it gives you "top N" lists.
- `skip(n)` jumps over results. `skip((page - 1) * size).limit(size)` builds simple pages.
- MongoDB always applies sort, then skip, then limit. Add `_id` as a tie-breaker for stable pages.

**Next lesson:** [Counting Documents and Distinct Values](/courses/mongodb/counting-and-distinct)
