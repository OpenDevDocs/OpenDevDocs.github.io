---
title: "Beginner Project: A Library Database"
slug: beginner-project-library-database
metadescription: Put every Beginner MongoDB skill together by building a small library database with books, members and loans, from inserts and queries to updates and deletes.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'project', 'crud', 'practice']
course: mongodb
---
## What you will learn

This lesson is a guided mini project. You won't learn many new commands. Instead, you'll **use** everything from the Beginner section together, the way you would in a real app. You'll:

- Design three collections: `books`, `members` and `loans`
- Insert data with embedded documents, arrays, dates and references
- Answer real questions with filters, operators, projections, sorting and counting
- Borrow and return books with safe updates
- Use arrays, dot notation, an upsert, and careful deletes
- Finish with a tiny Node.js report script

Open mongosh, and type (or paste) each step as you go. Take your time. If something goes wrong, the setup steps can be run again to start fresh.

## The plan

A small neighbourhood library wants to stop using paper registers. It needs to track three things:

```text
library            (database)
├── books          one document per title, with copy counts and shelf location
├── members        one document per person, with an embedded address
└── loans          one document per borrowing: which book, which member, which dates
```

Here's why it's shaped this way:

- A book's **shelf** and **copy counts** belong only to that book, so they're **embedded** inside it.
- A member's **address** belongs only to that member, so it's embedded too.
- A **loan** connects a book and a member. Books and members exist on their own, and one member can borrow many books over the years, so a loan stores their `_id` values (a **reference**) instead of copying them.

> **Think of it like this:** The books collection is the shelf catalogue. The members collection is the box of library cards. The loans collection is the stamp register at the front desk: each line says "this card took this book on this date".

## Step 1: Create the books

Switch to a new database. Remember, it doesn't exist until you insert something:

```javascript
use library

db.books.deleteMany({})
db.books.insertMany([
  { title: "The Alchemist", author: "Paulo Coelho", year: 1988, genres: ["fiction", "adventure"],
    copies: { total: 3, available: 2 }, shelf: { floor: 1, section: "F" } },
  { title: "Gitanjali", author: "Rabindranath Tagore", year: 1910, genres: ["poetry"],
    copies: { total: 2, available: 2 }, shelf: { floor: 1, section: "P" } },
  { title: "Malgudi Days", author: "R. K. Narayan", year: 1943, genres: ["fiction", "short-stories"],
    copies: { total: 2, available: 2 }, shelf: { floor: 1, section: "F" } },
  { title: "The Hobbit", author: "J. R. R. Tolkien", year: 1937, genres: ["fantasy", "adventure"],
    copies: { total: 4, available: 4 }, shelf: { floor: 2, section: "Y" } },
  { title: "Sapiens", author: "Yuval Noah Harari", year: 2011, genres: ["history", "non-fiction"],
    copies: { total: 2, available: 2 }, shelf: { floor: 2, section: "H" } },
  { title: "Clean Code", author: "Robert C. Martin", year: 2008, genres: ["programming", "non-fiction"],
    copies: { total: 1, available: 0 }, shelf: { floor: 2, section: "T" } }
])
// → { acknowledged: true, insertedIds: { "0": ObjectId("..."), "1": ObjectId("..."), ... } }
```

Notice what's inside each book:

| Field | Type | Lesson it came from |
| --- | --- | --- |
| `title`, `author` | strings | [BSON Types and Document Structure](/courses/mongodb/bson-types-and-documents) |
| `year` | number | BSON Types |
| `genres` | array of strings | [Working with Arrays](/courses/mongodb/working-with-arrays) |
| `copies`, `shelf` | embedded documents | [Embedded Documents and Dot Notation](/courses/mongodb/embedded-documents) |

Two books already have a copy out (`available` is lower than `total`). We'll create those loans in Step 3.

## Step 2: Create the members

Each member has an embedded `address`, a list of favourite genres, and an empty wishlist:

```javascript
db.members.deleteMany({})
db.members.insertMany([
  { name: "Asha Roy", email: "asha@example.com", address: { city: "Kolkata", pincode: "700016" },
    joinedAt: ISODate("2025-01-12"), favouriteGenres: ["fiction", "poetry"], wishlist: [] },
  { name: "Rahul Mehta", email: "rahul@example.com", address: { city: "Mumbai", pincode: "400050" },
    joinedAt: ISODate("2025-08-03"), favouriteGenres: ["programming", "history"], wishlist: [] },
  { name: "Maria Garcia", email: "maria@example.com", address: { city: "Madrid", pincode: "28013" },
    joinedAt: ISODate("2026-02-20"), favouriteGenres: ["fantasy"], wishlist: [] }
])
```

> **Note:** Pincodes are stored as **strings**, not numbers. They're labels, not amounts. You'll never add two pincodes together, and some codes in the world start with `0`, which a number would drop.

## Step 3: Create the loans

A loan needs the `_id` of a book and of a member. Let's look them up and keep them in variables. We use `var` so you can paste this block again without errors:

```javascript
var alchemist = db.books.findOne({ title: "The Alchemist" })
var cleanCode = db.books.findOne({ title: "Clean Code" })
var hobbit    = db.books.findOne({ title: "The Hobbit" })
var malgudi   = db.books.findOne({ title: "Malgudi Days" })
var sapiens   = db.books.findOne({ title: "Sapiens" })

var asha  = db.members.findOne({ email: "asha@example.com" })
var rahul = db.members.findOne({ email: "rahul@example.com" })
var maria = db.members.findOne({ email: "maria@example.com" })

// "Today" for this project. In a real app you would use new Date().
var today = ISODate("2026-10-25")
```

Now insert three loans. `returnedAt: null` means "not returned yet":

```javascript
db.loans.deleteMany({})
db.loans.insertMany([
  // Asha has The Alchemist, and it's overdue
  { bookId: alchemist._id, memberId: asha._id,
    borrowedAt: ISODate("2026-10-01"), dueAt: ISODate("2026-10-15"), returnedAt: null },
  // Rahul has Clean Code, due next week
  { bookId: cleanCode._id, memberId: rahul._id,
    borrowedAt: ISODate("2026-10-20"), dueAt: ISODate("2026-11-03"), returnedAt: null },
  // Maria borrowed The Hobbit and already returned it
  { bookId: hobbit._id, memberId: maria._id,
    borrowedAt: ISODate("2026-09-01"), dueAt: ISODate("2026-09-15"), returnedAt: ISODate("2026-09-12") }
])
```

Quick check that everything is in place:

```javascript
show collections
// → books
//   loans
//   members

db.books.countDocuments({})     // → 6
db.members.countDocuments({})   // → 3
db.loans.countDocuments({})     // → 3
```

## Step 4: Search the catalogue

Time to answer questions a librarian would really ask.

**Which books were published after 1950?** (comparison operator)

```javascript
db.books.find({ year: { $gt: 1950 } }, { title: 1, year: 1, _id: 0 })
// → The Alchemist (1988), Sapiens (2011), Clean Code (2008)
```

**What fiction or fantasy do we have?** (`$in` on an array field)

```javascript
db.books.find({ genres: { $in: ["fiction", "fantasy"] } }, { title: 1, _id: 0 })
// → The Alchemist, Malgudi Days, The Hobbit
```

**Which books can be borrowed right now?** (dot notation into an embedded document)

```javascript
db.books.find({ "copies.available": { $gt: 0 } }, { title: 1, "copies.available": 1, _id: 0 })
// → every book except Clean Code
```

**Show the catalogue, oldest first.** (projection and sort)

```javascript
db.books.find({}, { title: 1, author: 1, year: 1, _id: 0 }).sort({ year: 1 })
// → Gitanjali (1910), The Hobbit (1937), Malgudi Days (1943),
//   The Alchemist (1988), Clean Code (2008), Sapiens (2011)
```

**What's on the first floor, section F?** (two nested conditions)

```javascript
db.books.find({ "shelf.floor": 1, "shelf.section": "F" }, { title: 1, _id: 0 })
// → The Alchemist, Malgudi Days
```

**Page 2 of the catalogue, 2 books per page, sorted by title.** (skip and limit)

```javascript
db.books.find({}, { title: 1, _id: 0 }).sort({ title: 1 }).skip(2).limit(2)
// → Malgudi Days, Sapiens
```

**How many non-fiction books? Which genres exist?** (counting and distinct)

```javascript
db.books.countDocuments({ genres: "non-fiction" })
// → 2

db.books.distinct("genres")
// → [ "adventure", "fantasy", "fiction", "history", "non-fiction", "poetry", "programming", "short-stories" ]
```

**Which members live in Kolkata?**

```javascript
db.members.find({ "address.city": "Kolkata" }, { name: 1, _id: 0 })
// → [ { name: "Asha Roy" } ]
```

## Step 5: Check the loans

**Which books are out right now?** A loan is active when it hasn't been returned:

```javascript
db.loans.countDocuments({ returnedAt: null })
// → 2
```

> **Note:** `{ returnedAt: null }` matches documents where the field is `null` **or missing**. That's fine here because every loan has the field. If you want to be strict, use `{ returnedAt: { $type: "null" } }`.

**Which loans are overdue?** Not returned **and** the due date is before today:

```javascript
db.loans.find({ returnedAt: null, dueAt: { $lt: today } })
// → [ { _id: ObjectId("..."), bookId: ObjectId("..."), memberId: ObjectId("..."), borrowedAt: ..., dueAt: ISODate("2026-10-15T00:00:00.000Z"), returnedAt: null } ]
```

That's Asha's copy of The Alchemist. But the result shows only ids. To print something friendly, look up the book and member:

```javascript
db.loans.find({ returnedAt: null, dueAt: { $lt: today } }).forEach(loan => {
  const book = db.books.findOne({ _id: loan.bookId })
  const member = db.members.findOne({ _id: loan.memberId })
  print(`${member.name} has "${book.title}", due ${loan.dueAt.toISOString().slice(0, 10)}`)
})
// → Asha Roy has "The Alchemist", due 2026-10-15
```

> **Tip:** Running extra queries per loan is fine for a few results. For bigger reports MongoDB can join collections in a single query with `$lookup`, which you'll learn in [Joining Collections with lookup](/courses/mongodb/lookup-and-joins).

## Step 6: Borrow a book

Asha wants to borrow Malgudi Days. Borrowing takes two writes:

1. Take one copy off the shelf (only if one is available).
2. Write the loan in the register.

```javascript
// 1. Decrease available copies, but only if there's at least one
var taken = db.books.updateOne(
  { _id: malgudi._id, "copies.available": { $gt: 0 } },
  { $inc: { "copies.available": -1 } }
)
taken.matchedCount
// → 1   (a copy was available)

// 2. Record the loan, due in two weeks
db.loans.insertOne({
  bookId: malgudi._id,
  memberId: asha._id,
  borrowedAt: today,
  dueAt: ISODate("2026-11-08"),
  returnedAt: null
})
// → { acknowledged: true, insertedId: ObjectId("...") }
```

The filter does the safety check for us, a trick from [Update Operators and Upserts](/courses/mongodb/update-operators-and-upserts). Watch what happens when Maria tries to borrow Clean Code, which has no copies left:

```javascript
db.books.updateOne(
  { _id: cleanCode._id, "copies.available": { $gt: 0 } },
  { $inc: { "copies.available": -1 } }
)
// → { acknowledged: true, insertedId: null, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 }
```

`matchedCount: 0` means "no copy available", so we simply don't create a loan. The available count can never go below zero.

> **Note:** What if the server crashed between step 1 and step 2? You'd have one copy missing with no loan. For a small library this is very unlikely, and you could fix it by hand. Real systems wrap both writes in a **transaction** so they succeed or fail together. You'll learn that in [Transactions and ACID Guarantees](/courses/mongodb/transactions).

## Step 7: Return a book

Asha brings back The Alchemist. We mark the loan returned and put the copy back on the shelf:

```javascript
// 1. Close the open loan and get it back to confirm
db.loans.findOneAndUpdate(
  { bookId: alchemist._id, memberId: asha._id, returnedAt: null },
  { $set: { returnedAt: today } },
  { returnDocument: "after" }
)
// → { ..., dueAt: ISODate("2026-10-15T00:00:00.000Z"), returnedAt: ISODate("2026-10-25T00:00:00.000Z") }

// 2. One more copy available
db.books.updateOne({ _id: alchemist._id }, { $inc: { "copies.available": 1 } })
```

Run the overdue query from Step 5 again. It now returns nothing.

```javascript
db.loans.countDocuments({ returnedAt: null, dueAt: { $lt: today } })
// → 0
```

## Step 8: Arrays and embedded documents

**Tag the classics.** Add a "classic" genre to two books, without creating duplicates if you run it twice:

```javascript
db.books.updateMany(
  { title: { $in: ["Gitanjali", "Malgudi Days"] } },
  { $addToSet: { genres: "classic" } }
)
// → matchedCount: 2, modifiedCount: 2   (run again: modifiedCount: 0)
```

**Manage a wishlist.** Maria adds two books to her wishlist, then removes one:

```javascript
db.members.updateOne(
  { _id: maria._id },
  { $addToSet: { wishlist: { $each: ["Sapiens", "Gitanjali"] } } }
)

db.members.updateOne({ _id: maria._id }, { $pull: { wishlist: "Gitanjali" } })

db.members.findOne({ _id: maria._id }, { wishlist: 1, _id: 0 })
// → { wishlist: [ "Sapiens" ] }
```

**Update an address.** Rahul moves from Mumbai to Pune. Use dot notation so nothing else in the address is lost:

```javascript
db.members.updateOne(
  { _id: rahul._id },
  { $set: { "address.city": "Pune", "address.pincode": "411001" } }
)
```

**Add reviews.** Reviews are a small array of embedded documents. We keep only the latest 5 per book with `$slice`:

```javascript
db.books.updateOne(
  { _id: hobbit._id },
  { $push: { reviews: { $each: [{ by: "Maria Garcia", stars: 5, text: "A perfect adventure." }], $slice: -5 } } }
)

db.books.updateOne(
  { _id: alchemist._id },
  { $push: { reviews: { $each: [{ by: "Asha Roy", stars: 3, text: "Nice, but slow in places." }], $slice: -5 } } }
)
```

**Find books with at least one 5-star review:**

```javascript
db.books.find({ "reviews.stars": 5 }, { title: 1, _id: 0 })
// → [ { title: "The Hobbit" } ]
```

**Move a book to another shelf.** Only the section changes; the floor stays:

```javascript
db.books.updateOne({ _id: sapiens._id }, { $set: { "shelf.section": "N" } })
```

## Step 9: Sign up or update a member (upsert)

The library's sign-up form sends a name, email and address. If the email is new, we create a member. If it already exists, we update the details. One upsert handles both:

```javascript
db.members.updateOne(
  { email: "ken@example.com" },
  {
    $set: { name: "Ken Sato", address: { city: "Tokyo", pincode: "100-0001" } },
    $setOnInsert: { joinedAt: today, favouriteGenres: [], wishlist: [] }
  },
  { upsert: true }
)
// First run → upsertedCount: 1 (Ken is created)
// Second run → matchedCount: 1 (Ken is updated, joinedAt stays the same)
```

Here `$set` on the whole `address` is what we want, because the form always sends the complete address.

> **Tip:** To make sure two people can never sign up with the same email, add a unique index on `email`. You'll learn how in [Single Field and Compound Indexes](/courses/mongodb/indexes-single-and-compound).

## Step 10: Clean up carefully

**Remove a member.** Ken changes his mind. Before deleting, check he has no loans, and preview the filter:

```javascript
var ken = db.members.findOne({ email: "ken@example.com" })

db.loans.countDocuments({ memberId: ken._id })
// → 0   (safe to delete)

db.members.deleteOne({ _id: ken._id })
// → { acknowledged: true, deletedCount: 1 }
```

**Clear old loan records.** The library only keeps finished loans for a short time. Delete returned loans from before October:

```javascript
// Preview first
db.loans.find({ returnedAt: { $lt: ISODate("2026-10-01") } })
// → Maria's Hobbit loan (returned 2026-09-12)

db.loans.deleteMany({ returnedAt: { $lt: ISODate("2026-10-01") } })
// → { acknowledged: true, deletedCount: 1 }
```

Open loans have `returnedAt: null`, and `null` is never "less than" a date in this query, so they're safe.

**Withdraw a damaged book (soft delete).** Books with a history shouldn't vanish, so mark them instead:

```javascript
db.books.updateOne({ _id: cleanCode._id }, { $set: { withdrawnAt: today } })

// The public catalogue hides withdrawn books
db.books.find({ withdrawnAt: { $exists: false } }, { title: 1, _id: 0 }).sort({ title: 1 })
// → Gitanjali, Malgudi Days, Sapiens, The Alchemist, The Hobbit
```

## Bonus: an overdue report in Node.js

Using the project from [Connecting MongoDB to Your First App](/courses/mongodb/connecting-from-an-app), create `overdue.js`. It prints every overdue loan with the book title and member name:

```javascript
// overdue.js  (run with: node --env-file=.env overdue.js)
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);

try {
  const db = client.db("library");
  const today = new Date();

  const overdue = await db.collection("loans")
    .find({ returnedAt: null, dueAt: { $lt: today } })
    .sort({ dueAt: 1 })
    .toArray();

  if (overdue.length === 0) {
    console.log("No overdue books. Nice!");
  }

  for (const loan of overdue) {
    const book = await db.collection("books").findOne({ _id: loan.bookId }, { projection: { title: 1 } });
    const member = await db.collection("members").findOne({ _id: loan.memberId }, { projection: { name: 1, email: 1 } });
    const daysLate = Math.floor((today - loan.dueAt) / (1000 * 60 * 60 * 24));
    console.log(`${member.name} (${member.email}): "${book.title}" is ${daysLate} day(s) late`);
  }
} finally {
  await client.close();
}
```

Because this script uses the real current date, what it prints depends on the day you run it. Rahul's Clean Code loan, due on 3 November 2026, will show up once that date has passed.

## Common mistakes

- **Copying whole members into loans.** If Rahul changes his email, every copy would be out of date. Store `memberId` and look the member up.
- **Decreasing copies without a guard.** `$inc: { "copies.available": -1 }` alone can go negative. Put `"copies.available": { $gt: 0 }` in the filter and check `matchedCount`.
- **Replacing a whole embedded document by accident.** `$set: { address: { city: "Pune" } }` loses the pincode. Use `"address.city"` unless you really mean to replace it all.
- **Forgetting that `null` also matches missing fields.** `{ returnedAt: null }` matches loans with no `returnedAt` at all. Always create the field, as we did.
- **Deleting without previewing.** Run the filter with `find()` or `countDocuments()` before `deleteMany()`.

## Practice

These build on the data after Step 10. If your data got messy, run Steps 1 to 3 again.

1. List the titles of books with more than 2 copies in total, sorted A to Z.
2. Find members who like "fiction" **and** live in Kolkata. Show only their names.
3. Maria borrows The Hobbit today, due on 8 November 2026. Write both steps safely.
4. Rahul gives Sapiens 4 stars ("Big ideas, easy read."). Add the review, then find all books that have a review with 4 or more stars.
5. Which genres do books published before 1950 have? Use one command.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Comparison on a nested field, projection, sort
db.books.find({ "copies.total": { $gt: 2 } }, { title: 1, _id: 0 }).sort({ title: 1 })
// → The Alchemist, The Hobbit

// 2. Array match plus dot notation (implicit AND)
db.members.find({ favouriteGenres: "fiction", "address.city": "Kolkata" }, { name: 1, _id: 0 })
// → [ { name: "Asha Roy" } ]

// 3. Guarded $inc, then insert the loan only if a copy was taken
var r = db.books.updateOne(
  { _id: hobbit._id, "copies.available": { $gt: 0 } },
  { $inc: { "copies.available": -1 } }
)
if (r.matchedCount === 1) {
  db.loans.insertOne({
    bookId: hobbit._id, memberId: maria._id,
    borrowedAt: today, dueAt: ISODate("2026-11-08"), returnedAt: null
  })
}

// 4. $push a review, then query inside the array of embedded documents
db.books.updateOne(
  { _id: sapiens._id },
  { $push: { reviews: { $each: [{ by: "Rahul Mehta", stars: 4, text: "Big ideas, easy read." }], $slice: -5 } } }
)
db.books.find({ "reviews.stars": { $gte: 4 } }, { title: 1, _id: 0 })
// → The Hobbit, Sapiens

// 5. distinct with a filter
db.books.distinct("genres", { year: { $lt: 1950 } })
// → [ "adventure", "classic", "fantasy", "fiction", "poetry", "short-stories" ]
```

</details>

## Key takeaways

- Embed data that belongs to one parent (a book's shelf, a member's address); reference data that stands on its own (loans store `bookId` and `memberId`).
- Filters, operators, projections, `sort`, `skip`, `limit`, `countDocuments` and `distinct` answer most everyday questions.
- Guarded updates (a condition in the filter plus `$inc`) keep counts like available copies correct.
- Array operators (`$addToSet`, `$push` with `$slice`, `$pull`) and dot notation keep nested data tidy.
- Upserts handle "create or update" in one step, and careful deletes (preview first, or soft delete) protect your data.

You've finished the Beginner section. Next, you'll learn how to decide **what** to embed and what to reference, one of the most important skills in MongoDB.

**Next lesson:** [Embedding vs Referencing](/courses/mongodb/schema-design-embedding-vs-referencing)
