---
title: Array Index Access with IDX and arrayIndexAs
slug: array-index-access
metadescription: Learn the MongoDB 8.3 arrayIndexAs option and $$IDX variable for $map, $filter and $reduce, plus the $range trick that does the same on older versions.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'aggregation', 'arrays', 'mongodb-8']
course: mongodb
---
> **Before you start:** this lesson assumes you've read [unwind and Array Aggregation](/courses/mongodb/unwind-and-array-aggregation), where you met `$map` and `$filter`. It uses the `shop` data from [Aggregation Pipeline Fundamentals](/courses/mongodb/aggregation-pipeline-fundamentals).

> **Version check:** `arrayIndexAs` and `$$IDX` were **added in MongoDB 8.3**, so you need 8.3 or later. Run `db.version()` in mongosh to see your server version. If it's lower (for example 8.0), read the lesson anyway, then use the section *The older way* near the end, which works everywhere.

## What you will learn

By the end of this lesson you will know:

- Why you sometimes need the **position** (index) of an array element, not just its value
- How to name the position with **`arrayIndexAs`** in `$map`, `$filter` and `$reduce`
- How to use the shortcut variable **`$$IDX`**
- The new **`as`** and **`valueAs`** names for `$reduce`
- How to do the same thing on MongoDB versions before 8.3

## Values are easy, positions were not

In the last lesson, `$map` and `$filter` let us visit every element of an array. Inside them, `$$item` gave us the **value** of the current element. But often you also need its **position**:

- Printing line numbers on a receipt: "1) Notebook, 2) Gel Pen"
- Treating the first item differently ("main item" vs "add-ons")
- Picking every second element

Before MongoDB 8.3, `$map` and `$filter` had no built-in way to say "which element number am I on?". You had to use a workaround (shown later). MongoDB 8.3 fixes that.

> **Think of it like this:** A worker on our conveyor belt opens an order box and takes the items out one by one. Until now, the worker could see *what* each item was, but forgot to count. With 8.3, the worker counts out loud as they go: "zero, one, two...". That count is the **index**.

Remember: **indexes start at 0**. The first element is index 0, the second is index 1, and so on. Add 1 when you want "human" numbers.

## arrayIndexAs in $map

`arrayIndexAs` gives the index a name, just like `as` gives the element a name. Then you use it with two dollar signs.

Let's number the lines of order 1:

```javascript
db.orders.aggregate([
  { $match: { _id: 1 } },
  { $project: {
      lines: {
        $map: {
          input: "$items",
          as: "item",                 // the current element → $$item
          arrayIndexAs: "i",          // the current position → $$i   (new in 8.3)
          in: {
            line: { $add: ["$$i", 1] },
            name: "$$item.name",
            qty: "$$item.qty"
          }
        }
      }
  } }
])
// → [
//   { _id: 1, lines: [
//       { line: 1, name: "Notebook", qty: 2 },
//       { line: 2, name: "Gel Pen",  qty: 4 }
//   ] }
// ]
```

Step by step, inside `$map`:

| Turn | `$$item.name` | `$$i` | `line` |
| --- | --- | --- | --- |
| 1st | "Notebook" | 0 | 1 |
| 2nd | "Gel Pen" | 1 | 2 |

Here's another use: mark the first item as the "main" one.

```javascript
db.orders.aggregate([
  { $project: {
      items: {
        $map: {
          input: "$items",
          as: "item",
          arrayIndexAs: "i",
          in: { name: "$$item.name", isMain: { $eq: ["$$i", 0] } }
        }
      }
  } }
])
// Order 1 → [ { name: "Notebook", isMain: true }, { name: "Gel Pen", isMain: false } ]
// Order 2 → [ { name: "Headphones", isMain: true } ]
```

## The $$IDX shortcut

If you don't want to pick a name, leave out `arrayIndexAs` and use the built-in system variable **`$$IDX`**. It means "the index of the current element". It also arrived in 8.3, and works in `$map`, `$filter` and `$reduce`.

This gives exactly the same result as the first example:

```javascript
db.orders.aggregate([
  { $match: { _id: 1 } },
  { $project: {
      lines: {
        $map: {
          input: "$items",
          as: "item",
          in: { line: { $add: ["$$IDX", 1] }, name: "$$item.name", qty: "$$item.qty" }
        }
      }
  } }
])
```

> **Tip:** `$$IDX` is great for short, simple expressions. When you **nest** one `$map` inside another, give each level its own name with `arrayIndexAs` (like `"row"` and `"col"`). The documentation doesn't spell out which array `$$IDX` refers to when they're nested, and named variables make your intent obvious anyway.

## arrayIndexAs in $filter

`$filter` keeps elements whose `cond` is true. Now `cond` can look at the position too.

Show only the "add-on" items, meaning everything after the first item:

```javascript
db.orders.aggregate([
  { $project: {
      addOns: {
        $filter: {
          input: "$items",
          as: "item",
          arrayIndexAs: "i",
          cond: { $gt: ["$$i", 0] }          // skip index 0
        }
      }
  } },
  { $project: { addOnNames: "$addOns.name" } }
])
// → [
//   { _id: 1, addOnNames: ["Gel Pen"] },
//   { _id: 2, addOnNames: [] },
//   { _id: 3, addOnNames: [] },
//   { _id: 4, addOnNames: ["Gel Pen"] },
//   { _id: 5, addOnNames: ["Coffee Mug"] },
//   { _id: 6, addOnNames: [] }
// ]
```

You can mix position and value in the same condition. Add-on items with a quantity of 2 or more:

```javascript
cond: { $and: [ { $gt: ["$$i", 0] }, { $gte: ["$$item.qty", 2] } ] }
// Order 1 → Gel Pen (qty 4), order 4 → Gel Pen (qty 2), order 5 → nothing (Coffee Mug qty 1)
```

And a classic: keep every **second** element (index 0, 2, 4...), using `$mod` (the remainder after dividing):

```javascript
cond: { $eq: [ { $mod: ["$$IDX", 2] }, 0 ] }
```

## arrayIndexAs in $reduce (plus as and valueAs)

`$reduce` walks through an array and **combines** everything into one value, like a running total or one long string. Before 8.3, `$reduce` always used two fixed variable names:

- `$$this` – the current element
- `$$value` – the result built so far

MongoDB 8.3 lets you **rename** both, with `as` and `valueAs`, and adds `arrayIndexAs` for the position. All three are new in 8.3.

Let's build a receipt line like `"1) Notebook x2, 2) Gel Pen x4"`:

```javascript
db.orders.aggregate([
  { $project: {
      receipt: {
        $reduce: {
          input: "$items",
          initialValue: "",
          as: "item",               // instead of $$this    (8.3)
          valueAs: "text",          // instead of $$value   (8.3)
          arrayIndexAs: "i",        // the position         (8.3)
          in: {
            $concat: [
              "$$text",
              { $cond: [ { $eq: ["$$i", 0] }, "", ", " ] },   // comma before every item except the first
              { $toString: { $add: ["$$i", 1] } },
              ") ",
              "$$item.name",
              " x",
              { $toString: "$$item.qty" }
            ]
          }
        }
      }
  } }
])
// → [
//   { _id: 1, receipt: "1) Notebook x2, 2) Gel Pen x4" },
//   { _id: 2, receipt: "1) Headphones x1" },
//   { _id: 3, receipt: "1) Coffee Mug x2" },
//   { _id: 4, receipt: "1) USB Cable x1, 2) Gel Pen x2" },
//   { _id: 5, receipt: "1) Headphones x1, 2) Coffee Mug x1" },
//   { _id: 6, receipt: "1) Notebook x5" }
// ]
```

Let's watch `$reduce` work through order 1:

| Turn | `$$i` | `$$item.name` | `$$text` before | `$$text` after |
| --- | --- | --- | --- | --- |
| 1st | 0 | Notebook | `""` | `"1) Notebook x2"` |
| 2nd | 1 | Gel Pen | `"1) Notebook x2"` | `"1) Notebook x2, 2) Gel Pen x4"` |

> **Note:** If the input array is missing or `null`, `$map`, `$filter` and `$reduce` all return `null`. If it's something that isn't an array (like a number), the pipeline fails with an error.

## Saving the line numbers permanently

These expressions also work in an **update with a pipeline**. This adds a `lineNo` field to every item of every order:

```javascript
db.orders.updateMany({}, [
  { $set: {
      items: {
        $map: {
          input: "$items",
          as: "item",
          in: { $mergeObjects: ["$$item", { lineNo: { $add: ["$$IDX", 1] } }] }
        }
      }
  } }
])
// → { acknowledged: true, matchedCount: 6, modifiedCount: 6, ... }
// Order 1 items now: [ { ..., name: "Notebook", qty: 2, price: 49, lineNo: 1 }, { ..., name: "Gel Pen", ..., lineNo: 2 } ]
```

> **Warning:** This really changes your data. That's fine for the practice `shop` database (rerun the setup script to undo it), but test updates like this on a copy first in real projects.

## Nested arrays: name every level

When arrays live inside arrays, name each index so you always know which one you mean. Here's a tiny grid using `$documents` (no collection needed):

```javascript
db.aggregate([
  { $documents: [ { grid: [ ["a", "b"], ["c", "d"] ] } ] },
  { $project: {
      cells: {
        $map: {
          input: "$grid", as: "row", arrayIndexAs: "r",
          in: {
            $map: {
              input: "$$row", as: "cell", arrayIndexAs: "c",
              in: { $concat: ["$$cell", " at ", { $toString: "$$r" }, ",", { $toString: "$$c" }] }
            }
          }
        }
      }
  } }
])
// → [ { cells: [ ["a at 0,0", "b at 0,1"], ["c at 1,0", "d at 1,1"] ] } ]
```

## The older way (works on any version)

On MongoDB 8.0 and earlier, the server rejects `arrayIndexAs` and `$$IDX`. The classic workaround is to loop over the **numbers** `0, 1, 2...` instead of the elements, using `$range`, and fetch each element with `$arrayElemAt`:

```javascript
// Same "line numbers" result as the first example, on any modern version
db.orders.aggregate([
  { $match: { _id: 1 } },
  { $project: {
      lines: {
        $map: {
          input: { $range: [0, { $size: "$items" }] },   // [0, 1]
          as: "i",
          in: {
            line: { $add: ["$$i", 1] },
            name: { $arrayElemAt: ["$items.name", "$$i"] },
            qty:  { $arrayElemAt: ["$items.qty", "$$i"] }
          }
        }
      }
  } }
])
```

`$range: [0, 2]` produces `[0, 1]`, so `$$i` is the index and `$arrayElemAt` reads the element at that position. The same trick works for `$filter` and `$reduce`. It's correct, but harder to read, and `$size` fails if `items` is missing (wrap it in `$ifNull: ["$items", []]` to be safe).

Other options on older versions:

| Need | Pre-8.3 approach |
| --- | --- |
| Positions **across** documents | `$unwind` with `includeArrayIndex` |
| First, last, or Nth element | `$first`, `$last`, `$arrayElemAt` |
| First N elements | `$slice: ["$items", N]`, or `$filter` with `limit` |
| Index inside `$map`/`$filter`/`$reduce` | `$range` + `$arrayElemAt` (above) |
| `$reduce` variable names | Always `$$this` and `$$value` |

> **Note:** MongoDB 8.3 is a *minor* release. It's available on MongoDB Atlas, and starting with 8.2, minor releases are also offered for on-premises use in specific cases. If you upgraded an existing deployment and new syntax is still rejected, check its feature compatibility version with `db.adminCommand({ getParameter: 1, featureCompatibilityVersion: 1 })`.

## Common mistakes

- **Forgetting that indexes start at 0.** The first element is `0`. Use `{ $add: ["$$i", 1] }` for human line numbers.
- **Writing one `$` instead of two.** `"$i"` means a *field* called `i`. The index variable is `"$$i"` (or `"$$IDX"`).
- **Using `arrayIndexAs` on an older server.** It needs 8.3+. On 8.0, use the `$range` + `$arrayElemAt` pattern.
- **Relying on `$$IDX` in nested expressions.** Name each level with `arrayIndexAs` so it's clear which index you mean.
- **Using `$$this`/`$$value` after renaming them.** Once you set `as: "item"` and `valueAs: "text"` in `$reduce`, use `$$item` and `$$text`.

## Practice

1. For each order, return `itemNames` where each name is prefixed with its position, like `"1. Notebook"`. Use `$map` with `arrayIndexAs`.
2. Using `$filter` and `$$IDX`, return only the **first two** items of each order. (Bonus: what older operator does the same?)
3. Rewrite exercise 1 so it works on MongoDB 8.0.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Numbered names (8.3+)
db.orders.aggregate([
  { $project: {
      itemNames: {
        $map: {
          input: "$items", as: "item", arrayIndexAs: "i",
          in: { $concat: [ { $toString: { $add: ["$$i", 1] } }, ". ", "$$item.name" ] }
        }
      }
  } }
])
// Order 1 → ["1. Notebook", "2. Gel Pen"]

// 2. First two items (8.3+)
db.orders.aggregate([
  { $project: { firstTwo: { $filter: { input: "$items", cond: { $lt: ["$$IDX", 2] } } } } }
])
// Bonus: { $slice: ["$items", 2] } does the same on any version

// 3. Numbered names on 8.0
db.orders.aggregate([
  { $project: {
      itemNames: {
        $map: {
          input: { $range: [0, { $size: "$items" }] }, as: "i",
          in: { $concat: [ { $toString: { $add: ["$$i", 1] } }, ". ", { $arrayElemAt: ["$items.name", "$$i"] } ] }
        }
      }
  } }
])
```

</details>

## Key takeaways

- MongoDB **8.3** added **`arrayIndexAs`** to `$map`, `$filter` and `$reduce`, so you can name the current element's position.
- If you skip `arrayIndexAs`, the system variable **`$$IDX`** gives you the index. Indexes start at **0**.
- `$reduce` also gained **`as`** and **`valueAs`** in 8.3, replacing the fixed `$$this` and `$$value` names.
- In nested expressions, name every level's index with `arrayIndexAs`.
- On older versions, loop over `{ $range: [0, { $size: ... }] }` and use `$arrayElemAt`.

**Next lesson:** [Conversion Operators: convert, toObject and toArray](/courses/mongodb/conversion-operators)
