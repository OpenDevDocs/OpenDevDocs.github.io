---
title: Working with Arrays
slug: working-with-arrays
metadescription: Learn how to query and update MongoDB arrays with $all, $size, $elemMatch, $push, $addToSet, $pull, $pop and the positional $ operator.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'arrays', 'queries', 'update']
course: mongodb
---
## What you will learn

By the end of this lesson you will know how to:

- Find documents whose array **contains** a value, or **all** of several values
- Match by array length with `$size` and by position with `"tags.0"`
- Use `$elemMatch` so several conditions apply to the **same** element
- Add items with `$push` and `$addToSet`, and remove them with `$pull` and `$pop`
- Change one element in place with the positional `$` operator

An **array** is a list of values inside one field. Our products already have one: `tags`. Arrays are one of the things that make MongoDB feel natural. In a SQL database, a product's tags would usually live in a separate table. In MongoDB they sit right inside the product.

## Get the sample data ready

Reset the `shop` products in mongosh:

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

> **Think of it like this:** A document is a lunch box. A normal field holds one item, like an apple. An array field is a small bag inside the box holding several items, like a handful of grapes. You can ask "is there a red grape in the bag?" or "add two more grapes" without unpacking the whole lunch box.

## Querying arrays

### Does the array contain a value?

This is the most common array question, and it's the simplest. Just write the value as if the field held one item:

```javascript
db.products.find({ tags: "school" }, { name: 1, _id: 0 })
// → [ { name: "Notebook" }, { name: "Gel Pen" } ]
```

MongoDB looks **inside** the array and matches if **any** element equals `"school"`. You don't need a special operator.

Comparison operators work the same way. They match if **any** element passes:

```javascript
db.products.find({ tags: { $in: ["gift", "cable"] } }, { name: 1, _id: 0 })
// → [ { name: "USB Cable" }, { name: "Coffee Mug" } ]
```

### Does it contain all of these? `$all`

To find products tagged with **both** "school" and "paper", in any order, use `$all`:

```javascript
db.products.find({ tags: { $all: ["school", "paper"] } }, { name: 1, _id: 0 })
// → [ { name: "Notebook" } ]
```

### Exact array match (and why it's usually wrong)

If you put an array in the filter, MongoDB looks for an array that is **exactly** the same, with the same items in the same order:

```javascript
db.products.find({ tags: ["paper", "school"] })   // → Notebook
db.products.find({ tags: ["school", "paper"] })   // → nothing! Order differs.
```

This catches beginners all the time. Most of the time you want `$all` instead.

### Match by length: `$size`

`$size` matches arrays with an exact number of elements:

```javascript
db.products.find({ tags: { $size: 1 } }, { name: 1, _id: 0 })
// → [ { name: "USB Cable" } ]
```

`$size` only accepts an exact number. It can't do "more than 1". A neat trick for "at least 2 elements" is to check that position 1 (the second item) exists:

```javascript
db.products.find({ "tags.1": { $exists: true } }, { name: 1, _id: 0 })
// → Notebook, Gel Pen, Headphones, Coffee Mug
```

### Match by position: `"tags.0"`

Array positions start at **0**. Use the field name, a dot, and the position, all inside quotes:

```javascript
// Products whose FIRST tag is "pen"
db.products.find({ "tags.0": "pen" }, { name: 1, _id: 0 })
// → [ { name: "Gel Pen" } ]
```

### Several conditions on one element: `$elemMatch`

Let's give two products a list of daily sales numbers:

```javascript
db.products.updateOne({ name: "Notebook" }, { $set: { dailySales: [5, 25, 40] } })
db.products.updateOne({ name: "Gel Pen" }, { $set: { dailySales: [12, 15, 18] } })
```

Now we want products that had a day with sales **between 10 and 20**. Try the obvious query:

```javascript
db.products.find({ dailySales: { $gt: 10, $lt: 20 } }, { name: 1, _id: 0 })
// → Notebook, Gel Pen   (surprise!)
```

Why is the Notebook here? None of its days were between 10 and 20. The reason: without `$elemMatch`, each condition can be satisfied by a **different** element. 25 is greater than 10, and 5 is less than 20, so the Notebook passes.

`$elemMatch` says "one single element must pass **all** the conditions":

```javascript
db.products.find({ dailySales: { $elemMatch: { $gt: 10, $lt: 20 } } }, { name: 1, _id: 0 })
// → [ { name: "Gel Pen" } ]
```

> **Tip:** Rule of thumb: if you have **one** condition on an array, you don't need `$elemMatch`. If you have **two or more** conditions that must be true for the same item, use it. You'll use it a lot with arrays of objects in the next lesson.

## Updating arrays

Now let's change arrays. These operators all go in the update part of `updateOne()` or `updateMany()`, just like `$set`.

| Operator | What it does |
| --- | --- |
| `$push` | Add an item to the end (duplicates allowed) |
| `$addToSet` | Add an item only if it's not already there |
| `$pull` | Remove every item that matches a value or condition |
| `$pop` | Remove the first (`-1`) or last (`1`) item |
| `$each` | Used with `$push` or `$addToSet` to add several items at once |

### `$push`: add to the end

```javascript
db.products.updateOne({ name: "Notebook" }, { $push: { tags: "bestseller" } })

db.products.findOne({ name: "Notebook" }, { tags: 1, _id: 0 })
// → { tags: [ "paper", "school", "bestseller" ] }
```

If the field doesn't exist yet, `$push` creates an array with that one item.

> **Warning:** `$push` with an array adds the array as **one** item. `{ $push: { tags: ["a", "b"] } }` gives you `[..., ["a", "b"]]`, a list inside a list. To add several separate items, use `$each`.

### Add several items with `$each`

```javascript
db.products.updateOne(
  { name: "Coffee Mug" },
  { $push: { tags: { $each: ["kitchen", "bestseller"] } } }
)
// tags: [ "ceramic", "gift", "kitchen", "bestseller" ]
```

### Keep only the latest few: `$slice`

`$push` with `$each` can also trim the array. This is perfect for a "recently viewed" list that should never grow past, say, 3 items. A negative `$slice` keeps the **last** N items:

```javascript
db.products.updateOne(
  { name: "Headphones" },
  { $push: { viewedBy: { $each: ["Asha", "Rahul", "Priya", "Ken"], $slice: -3 } } }
)

db.products.findOne({ name: "Headphones" }, { viewedBy: 1, _id: 0 })
// → { viewedBy: [ "Rahul", "Priya", "Ken" ] }
```

Asha dropped off the front because only the 3 newest are kept. You can also add `$sort: 1` (or `-1`) next to `$each` to keep the array sorted.

### `$addToSet`: add only if missing

`$addToSet` treats the array like a **set**: a list with no duplicates.

```javascript
// "school" is already there, so nothing changes
db.products.updateOne({ name: "Gel Pen" }, { $addToSet: { tags: "school" } })
// → matchedCount: 1, modifiedCount: 0

// "blue" is new, so it's added
db.products.updateOne({ name: "Gel Pen" }, { $addToSet: { tags: "blue" } })
// → matchedCount: 1, modifiedCount: 1
```

It works with `$each` too:

```javascript
db.products.updateOne(
  { name: "Gel Pen" },
  { $addToSet: { tags: { $each: ["blue", "office"] } } }
)
// Only "office" is added, because "blue" is already there
```

> **Tip:** For tags, likes, followers, or anything where duplicates make no sense, prefer `$addToSet` over `$push`.

### `$pull`: remove matching items

`$pull` removes **every** element equal to a value:

```javascript
db.products.updateOne({ name: "Notebook" }, { $pull: { tags: "bestseller" } })
// tags: [ "paper", "school" ]
```

It can also remove elements that match a **condition**:

```javascript
// Remove slow days (fewer than 10 sales) from the Notebook
db.products.updateOne({ name: "Notebook" }, { $pull: { dailySales: { $lt: 10 } } })
// dailySales: [5, 25, 40] → [25, 40]
```

And with `updateMany()`, from many documents at once:

```javascript
// Remove the "school" tag from every product
db.products.updateMany({}, { $pull: { tags: "school" } })
// → matchedCount: 5, modifiedCount: 2
```

Only the two products that had the tag were modified.

### `$pop`: remove the first or last item

`$pop` takes `1` to remove the **last** item and `-1` to remove the **first**:

```javascript
db.products.updateOne({ name: "Coffee Mug" }, { $pop: { tags: 1 } })    // remove last
db.products.updateOne({ name: "Coffee Mug" }, { $pop: { tags: -1 } })   // remove first
```

## Changing one element in place

What if you want to change an item **inside** the array, not add or remove one?

### The positional `$` operator

The positional `$` means "the element that matched my filter". Let's rename the Gel Pen's tag `"pen"` to `"gel-pen"`:

```javascript
db.products.updateOne(
  { name: "Gel Pen", tags: "pen" },           // the filter must mention the array
  { $set: { "tags.$": "gel-pen" } }
)
```

MongoDB found `"pen"` while matching the filter, remembered its position, and `"tags.$"` points to that position. Only the **first** matching element is changed.

> **Note:** For `$` to work, the filter must include a condition on that array (here `tags: "pen"`). Without it, MongoDB doesn't know which element you mean and returns an error.

### All elements: `$[]`

`$[]` means "every element of the array". Let's add 1 to each day of the Gel Pen's sales:

```javascript
db.products.updateOne({ name: "Gel Pen" }, { $inc: { "dailySales.$[]": 1 } })
// dailySales: [12, 15, 18] → [13, 16, 19]
```

### Some elements: `$[name]` with `arrayFilters`

To change only the elements that match a condition, give the elements a name in square brackets and describe them in `arrayFilters`:

```javascript
// Cap any day above 30 sales at 30
db.products.updateOne(
  { name: "Notebook" },
  { $set: { "dailySales.$[day]": 30 } },
  { arrayFilters: [{ day: { $gt: 30 } }] }
)
// dailySales: [25, 40] → [25, 30]
```

The name (`day` here) must start with a lowercase letter. This is a more advanced tool, so don't worry if it feels new. You'll see it again with arrays of objects.

## Returning part of an array

Remember from [Projections and Field Selection](/courses/mongodb/projections) that you can return just a slice of an array:

```javascript
// Only the first tag of each product
db.products.find({}, { name: 1, tags: { $slice: 1 }, _id: 0 })
```

## How big should an array be?

Arrays are great for **small, bounded** lists: tags, a few phone numbers, the last 10 views. They are a bad fit for lists that grow forever, like every comment on a viral post or every login a user has ever made.

Why? A single MongoDB document can be at most **16 MB**. An array that keeps growing will eventually hit that limit, and long before that, every read of the document gets slower. For lists that can grow without end, store each item as its own document in another collection. You'll learn how to make that choice in [Embedding vs Referencing](/courses/mongodb/schema-design-embedding-vs-referencing).

## Common mistakes

- **Using an exact array match by accident.** `{ tags: ["school", "paper"] }` requires the same order and the same items. Use `$all` for "contains all of these".
- **Multiple conditions without `$elemMatch`.** `{ dailySales: { $gt: 10, $lt: 20 } }` can be satisfied by two different elements. Use `$elemMatch` when one element must pass both.
- **Pushing an array instead of using `$each`.** `$push: { tags: ["a", "b"] }` nests an array. Write `$push: { tags: { $each: ["a", "b"] } }`.
- **Using `$push` when duplicates matter.** Use `$addToSet` for unique lists.
- **Positional `$` without the array in the filter.** Add a condition on the array field so MongoDB knows which element to change.

## Practice

Reset the data first with the setup block.

1. Find products tagged both "audio" and "wireless".
2. Add the tags "sale" and "new" to the USB Cable in one update.
3. Add "gift" to the Notebook's tags only if it isn't already there. Run it twice and compare `modifiedCount`.
4. Remove the "gift" tag from every product that has it.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. $all
db.products.find({ tags: { $all: ["audio", "wireless"] } })
// → Headphones

// 2. $push with $each
db.products.updateOne(
  { name: "USB Cable" },
  { $push: { tags: { $each: ["sale", "new"] } } }
)
// tags: [ "cable", "sale", "new" ]

// 3. $addToSet: first run modifies 1, second run modifies 0
db.products.updateOne({ name: "Notebook" }, { $addToSet: { tags: "gift" } })
db.products.updateOne({ name: "Notebook" }, { $addToSet: { tags: "gift" } })

// 4. $pull with updateMany
db.products.updateMany({ tags: "gift" }, { $pull: { tags: "gift" } })
// → modifies the Coffee Mug (and the Notebook, if you did exercise 3)
```

</details>

## Key takeaways

- `{ tags: "school" }` matches if **any** element equals the value. `$all` needs every listed value, in any order.
- `$size` matches an exact length; `"tags.0"` matches a position (counting from 0).
- Use `$elemMatch` when several conditions must hold for the **same** element.
- `$push` adds (use `$each` for many, `$slice` to trim), `$addToSet` adds without duplicates, `$pull` and `$pop` remove.
- `"tags.$"` changes the matched element, `$[]` changes all elements, and `$[name]` with `arrayFilters` changes selected ones.

**Next lesson:** [Embedded Documents and Dot Notation](/courses/mongodb/embedded-documents)
