---
title: Compass and the VS Code Extension
slug: compass-and-vscode-extension
metadescription: Use MongoDB Compass to browse, filter and edit data visually, and the MongoDB for VS Code extension to run queries in playgrounds next to your code.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['mongodb', 'compass', 'vscode', 'tools']
course: mongodb
---
## What you will learn

By the end of this lesson you will be able to:

- Install **MongoDB Compass** and connect it to a local server or Atlas
- Browse, filter, add, edit and delete documents with the mouse
- See the shape of your data in the **Schema** tab
- Install the **MongoDB for VS Code** extension and run queries in a **playground**
- Choose the right tool for each job: mongosh, Compass or VS Code

> **Before you start:** you need a running MongoDB server (local or Atlas) with the `shop` data from [mongosh: The MongoDB Shell](/courses/mongodb/mongosh-basics).

## Why use graphical tools?

mongosh is powerful, but sometimes you just want to **look** at your data. Scrolling through text output gets tiring when documents are big.

MongoDB makes two free tools for this:

- **MongoDB Compass:** a desktop app for exploring and managing data visually.
- **MongoDB for VS Code:** an extension that brings MongoDB into the VS Code editor, right next to your app code.

> **Think of it like this:** mongosh is like using a terminal to manage files. Compass is like using your computer's file explorer: same files, but you can see and click them.

The data is the same in every tool. If you insert a document in Compass, mongosh sees it immediately, and the other way round.

> **Note:** Both tools get updates often, and buttons sometimes move. If something below looks a little different on your screen, look for the same words nearby.

## Part 1: MongoDB Compass

### Installing Compass

- **Windows:** if you ticked **Install MongoDB Compass** in the MongoDB server installer, you already have it. Otherwise, download it from `mongodb.com/try/download/compass`.
- **macOS:** download it from the same page, or use Homebrew:

  ```bash
  brew install --cask mongodb-compass
  ```

- **Linux:** download the `.deb` (Ubuntu/Debian) or `.rpm` (Red Hat/Fedora) package from the download page and install it with your package manager.

Compass is free and runs on Windows, macOS and Linux.

### Connecting Compass

1. Open Compass.
2. Click **Add New Connection** (in the connections sidebar).
3. In the **URI** box, paste a connection string:
   - Local server: `mongodb://localhost:27017`
   - Atlas: on your cluster click **Connect**, choose **Compass**, and copy the string it shows. Replace `<db_password>` with your database user's password.
4. Optionally give the connection a **name** (like "Local" or "My Atlas") and a **color**.
5. Click **Save & Connect**.

> **Tip:** Give your local and Atlas connections different colors. It helps you avoid deleting data in the wrong place.

After connecting, the sidebar lists your databases. Click `shop`, then `products`.

### A tour of a collection

When you open a collection, Compass shows tabs along the top. The most useful ones:

| Tab | What you do there |
| --- | --- |
| **Documents** | See, filter, add, edit and delete documents |
| **Aggregations** | Build aggregation pipelines stage by stage (later in the course) |
| **Schema** | See which fields exist, their types and common values |
| **Indexes** | See and create indexes (later in the course) |
| **Validation** | Add rules about what documents must look like (later in the course) |

### The Documents tab

Your five products appear as cards. You can switch between three views using small buttons near the top:

- **List view:** each document as an expandable card (the default)
- **JSON view:** raw JSON text, great for copying
- **Table view:** rows and columns, like a spreadsheet

### Filtering documents

At the top of the Documents tab there is a **filter bar**. You type the same filter you would pass to `find()` in mongosh.

Show only stationery:

```javascript
{ category: "stationery" }
```

Click **Find** (or press Enter). Only the Notebook and Gel Pen remain.

Show products cheaper than 300:

```javascript
{ price: { $lt: 300 } }
```

Click **Options** next to the filter bar to reveal more boxes:

| Box | What it does | Example |
| --- | --- | --- |
| **Project** | Choose which fields to show | `{ name: 1, price: 1, _id: 0 }` |
| **Sort** | Order the results | `{ price: -1 }` (highest price first) |
| **Limit** | Show at most this many | `2` |

Put all three together and you see the two most expensive products, with only their names and prices. Exactly the same as this mongosh command:

```javascript
db.products.find({}, { name: 1, price: 1, _id: 0 }).sort({ price: -1 }).limit(2)
// → [ { name: "Headphones", price: 1999 }, { name: "USB Cable", price: 299 } ]
```

> **Tip:** Compass keeps a history of your recent queries. Look for the clock icon near the filter bar to rerun an earlier one.

### Adding documents

1. Click **Add Data** (a green button), then **Insert Document**.
2. A box opens with a starter document. Replace it with:

   ```javascript
   { name: "Sticky Notes", category: "stationery", price: 35, stock: 200, tags: ["paper"] }
   ```

3. Click **Insert**.

Compass adds an `_id` automatically, just like mongosh. The same **Add Data** button also offers **Import JSON or CSV file** for loading many documents from a file.

### Editing and deleting

Hover over a document card to see small icons:

- **Pencil (Edit):** change values, add fields or remove fields. Click **Update** to save.
- **Copy:** copy the document as JSON.
- **Clone:** open a copy of the document as a new insert.
- **Trash (Delete):** mark the document for deletion, then confirm.

> **Warning:** There is no undo button for deletes. Double-check you are connected to the right database (that's where connection colors help).

### The Schema tab

Open the **Schema** tab and click **Analyze** (the exact label may vary). Compass reads a sample of documents and shows, for every field:

- its **type** (string, number, array...)
- how often it appears (for example, `rating` appears in only 2 of 5 products)
- the most common values, or a chart of number ranges

This is a quick way to understand a collection someone else built, or to spot messy data like a `price` stored as text in some documents.

### The built-in shell

Compass includes mongosh inside it. Look for a **MongoDB Shell** button (it may show a `>_` icon) (often at the bottom or in the connection's menu) and click it. A shell panel opens, already connected. Everything from the mongosh lesson works there.

### Natural-language queries (optional)

Newer versions of Compass can turn a plain English question into a query, for example *"products in electronics that are out of stock"*. This feature uses AI, may need to be switched on in Compass settings, and may ask you to sign in with your Atlas account. It's handy, but always read the query it generates before running it.

## Part 2: MongoDB for VS Code

If you write code in **Visual Studio Code**, this extension lets you browse your database and run queries without leaving the editor.

### Installing the extension

1. Open VS Code.
2. Open the **Extensions** view (the four-squares icon on the left, or press `Ctrl+Shift+X`, `Cmd+Shift+X` on macOS).
3. Search for **MongoDB for VS Code**. Make sure the publisher is **MongoDB**.
4. Click **Install**.

A green **leaf icon** appears in the left activity bar. That's the MongoDB panel.

### Connecting

1. Click the leaf icon.
2. Click **Add Connection** (or the **+** button in the Connections list).
3. Paste your connection string, for example `mongodb://localhost:27017`, and press Enter.

Your server appears under **Connections**. Expand it to see databases, collections and documents. Clicking a document opens it as JSON in an editor tab.

### Playgrounds: your query scratchpad

A **playground** is a JavaScript file where you write MongoDB commands and run them against your connected database. Playground files end in `.mongodb.js`.

> **Think of it like this:** A playground is a notebook page next to your code. You can try ideas, keep the ones that work, and save the page in your project for later.

To create one, open the **Playgrounds** section of the MongoDB panel and click **Create New Playground** (or use the **...** menu there). VS Code opens a file with example code. Replace it with:

```javascript
// shop-queries.mongodb.js
use("shop");

// Products that are cheaper than 300 and in stock
db.products.find({ price: { $lt: 300 }, stock: { $gt: 0 } });
```

Notice two small differences from typing in mongosh:

- Switch databases with `use("shop")`, written as a function call with quotes.
- It's a normal JavaScript file, so semicolons at the end of lines are common (but optional).

### Running a playground

- Click the **Play** button (a triangle) at the top right of the editor to run the whole file.
- Or select a few lines: a **Run Selected Lines from Playground** link appears above them. Click it to run just that part.

The result opens in a **Playground Result** panel on the right, shown as JSON. It looks roughly like this (shortened):

```json
[
  {
    "_id": { "$oid": "6718c3a1f2b4e5d6a7b8c9d0" },
    "name": "Notebook",
    "category": "stationery",
    "price": 49,
    "stock": 120,
    "tags": ["paper", "school"]
  },
  {
    "_id": { "$oid": "6718c3a1f2b4e5d6a7b8c9d1" },
    "name": "Gel Pen",
    "category": "stationery",
    "price": 15,
    "stock": 500,
    "tags": ["pen", "school"]
  }
]
```

You'll also see the Coffee Mug (and any other cheap products you added). The USB Cable is missing because its `stock` is `0`. The `{ "$oid": ... }` form is simply how an ObjectId is written in plain JSON. You'll learn more in the next lesson.

Only the result of the **last** command is shown in the result panel. To see values from earlier lines, use `console.log()` or `print()`; that output appears in VS Code's **Output** panel.

```javascript
use("shop");

const total = db.products.countDocuments();
console.log("Number of products:", total);

db.products.find({ category: "kitchen" });
```

> **Tip:** Save useful playgrounds inside your project (for example a `db/` folder). They become living documentation of how your app talks to the database.

### AI helpers (optional)

The extension can also work with **GitHub Copilot**. In Copilot Chat you can ask the `@MongoDB` participant questions in plain English, and it can suggest queries that use your real collection and field names. The extension also supports the **MongoDB MCP Server**, which lets AI agents talk to your database. These are optional extras; everything in this course works without them.

> **Warning:** Only connect AI tools to practice data or databases you're allowed to share. Never point them at sensitive production data without your team's permission.

## Which tool should I use?

| Task | Best tool |
| --- | --- |
| Quickly try a command | **mongosh** |
| Follow along with this course | **mongosh** (the examples are written for it) |
| Look around a database you don't know | **Compass** (Schema tab) |
| Fix one wrong value in one document | **Compass** (edit with the pencil) |
| Import a CSV or JSON file with a few clicks | **Compass** |
| Build an aggregation pipeline step by step | **Compass** (Aggregations tab) |
| Write and save queries while coding an app | **VS Code playgrounds** |
| Automate tasks with scripts | **mongosh** with a `.js` file |

You don't need to pick just one. Most developers use all three at different times.

## Common mistakes

- **Forgetting to replace `<db_password>`** in the Atlas connection string inside Compass or VS Code.
- **Editing the wrong database.** You connect to both local and Atlas, then change data in the wrong one. Use connection names and colors.
- **Typing invalid filters in Compass.** The filter bar needs a document in curly braces, like `{ category: "kitchen" }`, not just `category = kitchen`.
- **Writing `use shop` in a playground.** Playgrounds are JavaScript files, so write `use("shop")`.
- **Expecting every line's result in the playground panel.** Only the last command's result shows there. Use `console.log()` for the rest.

## Practice

1. Connect Compass to your server and open `shop.products`. Use the filter bar to show only products that have a `rating` field. (Hint: `{ rating: { $exists: true } }`.)
2. In Compass, use **Options** to show only `name` and `stock`, sorted by `stock` from lowest to highest.
3. In VS Code, create a playground that switches to `shop` and finds all products tagged `"school"`.

<details>
<summary>Show a possible answer</summary>

```javascript
// 1. Compass filter bar:
{ rating: { $exists: true } }
// → Headphones and Coffee Mug

// 2. Compass Options:
// Project: { name: 1, stock: 1, _id: 0 }
// Sort:    { stock: 1 }
// → USB Cable (0), Headphones (35), Coffee Mug (60), Notebook (120), Gel Pen (500)
//   plus any products you added yourself, in the right place

// 3. school.mongodb.js
use("shop");
db.products.find({ tags: "school" });
// → Notebook and Gel Pen
```

</details>

## Key takeaways

- **Compass** is a free desktop app for exploring data visually: filter, edit, import and analyze schemas with the mouse.
- The Compass filter bar uses the **same filter documents** as `find()` in mongosh.
- The **Schema** tab shows which fields and types a collection really contains.
- **MongoDB for VS Code** lets you browse data and run queries in **playgrounds** (`.mongodb.js` files) next to your code.
- In playgrounds, switch databases with `use("shop")`, and only the last result shows in the result panel.

**Next lesson:** [BSON Types and Document Structure](/courses/mongodb/bson-types-and-documents)
