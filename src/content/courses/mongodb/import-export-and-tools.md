---
title: Import, Export and Data Migration Tools
slug: import-export-and-tools
metadescription: Learn the MongoDB Database Tools - mongoimport, mongoexport, mongodump, mongorestore and bsondump - with copy-paste examples for macOS, Linux and Windows.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'database-tools', 'mongoimport', 'mongodump']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- What the **MongoDB Database Tools** are and how to install them
- How to load CSV and JSON files with **mongoimport**, and save data out with **mongoexport**
- How to copy whole databases with **mongodump** and **mongorestore**
- How to read a `.bson` file with **bsondump**
- Which tool to pick for each job, including moving data between servers

## Meet the Database Tools

So far you've worked inside mongosh. But many jobs happen **outside** the shell:

- "Load this spreadsheet of products into the database."
- "Send me last month's orders as a CSV."
- "Copy the production database to my laptop."

For these jobs MongoDB ships a set of small command-line programs called the **MongoDB Database Tools**. You run them in your normal terminal (bash, zsh, PowerShell), **not** inside mongosh.

| Tool | What it does | File format |
| --- | --- | --- |
| `mongoimport` | Loads JSON, CSV or TSV files into a collection | Human-readable |
| `mongoexport` | Saves a collection as JSON or CSV | Human-readable |
| `mongodump` | Saves databases as BSON (an exact copy) | Binary |
| `mongorestore` | Loads a `mongodump` backup back in | Binary |
| `bsondump` | Turns a `.bson` file into readable JSON | Binary → JSON |
| `mongofiles` | Works with GridFS files (previous lesson) | Any file |
| `mongostat` / `mongotop` | Live server stats | Terminal output |

> **Think of it like this:** `mongoimport`/`mongoexport` are like "Save as CSV" in a spreadsheet: easy to read and share, but some details get lost. `mongodump`/`mongorestore` are like copying the actual spreadsheet file: nothing is lost, but you need the right program to open it.

## Installing the tools

The tools are a **separate download** from the server. Some installers include them, some don't.

Check if you already have them:

```bash
mongoimport --version
# mongoimport version: 100.x.x
```

If you see "command not found" (or "not recognized" on Windows), install them:

```bash
# macOS (Homebrew)
brew tap mongodb/brew
brew install mongodb-database-tools

# Ubuntu / Debian: install the package from MongoDB's apt repository
sudo apt-get install -y mongodb-database-tools
```

On Windows, download the **MongoDB Database Tools** MSI or zip from the MongoDB Download Center, then add its `bin` folder to your `PATH`:

```powershell
# Example: add the tools folder to PATH for the current user
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\MongoDB\Tools\100\bin", "User")
```

Close and reopen your terminal afterwards.

> **Note:** The Database Tools have their own version numbers (100.x), separate from the server's 8.x. One recent version of the tools works with all current server versions.

### Connecting to your server

Every tool accepts `--uri` with the same connection string you use for mongosh:

```bash
# Local server
--uri="mongodb://localhost:27017"

# Atlas cluster (replace user, password and cluster address)
--uri="mongodb+srv://asha:MyPassw0rd@cluster0.abcde.mongodb.net"
```

> **Warning:** Typing a password into a command can save it in your shell history. For anything serious, leave the password out of the URI and the tool will prompt for it, or use the `--config` option with a protected file.

## mongoimport: loading files

### Importing a CSV file

Here is a small `new-products.csv` file. The first line holds the field names:

```text
name,category,price,stock
Desk Lamp,electronics,799,15
Water Bottle,kitchen,349,25
Sketchbook,stationery,129,60
```

Import it into `shop.products`:

```bash
mongoimport --uri="mongodb://localhost:27017" --db=shop --collection=products \
  --type=csv --headerline --file=new-products.csv
```

```powershell
mongoimport --uri="mongodb://localhost:27017" --db=shop --collection=products `
  --type=csv --headerline --file=new-products.csv
```

```text
2026-10-25T09:00:00.000+0530    connected to: mongodb://localhost:27017
2026-10-25T09:00:00.000+0530    3 document(s) imported successfully. 0 document(s) failed to import.
```

> **Tip:** In bash a long command continues on the next line with a backslash (`\`). In PowerShell, use a backtick (`` ` ``). Or just write it all on one line.

Check it in mongosh:

```javascript
db.products.findOne({ name: "Desk Lamp" })
// → { _id: ObjectId('...'), name: 'Desk Lamp', category: 'electronics', price: 799, stock: 15 }
```

`mongoimport` guessed that `799` is a number. If you want to be sure of the types, name them in the header and add `--columnsHaveTypes`:

```text
name.string(),category.string(),price.int32(),stock.int32()
Desk Lamp,electronics,799,15
```

```bash
mongoimport --db=shop --collection=products --type=csv \
  --headerline --columnsHaveTypes --file=new-products-typed.csv
```

### Importing a JSON file

By default, `mongoimport` expects **one JSON document per line**:

```json
{"name": "Asha Roy", "email": "asha@example.com", "city": "Kolkata", "isMember": true, "joinedAt": {"$date": "2026-01-15T00:00:00Z"}}
{"name": "Ken Sato", "email": "ken@example.com", "city": "Osaka", "isMember": false, "joinedAt": {"$date": "2026-03-02T00:00:00Z"}}
```

Notice `{"$date": "..."}`. Plain JSON has no date type, so MongoDB uses **Extended JSON** to say "this is a real date". Without it, `joinedAt` would be stored as a string.

```bash
mongoimport --db=shop --collection=customers --file=customers.json
```

If your file is one big **JSON array** (`[ {...}, {...} ]`), add `--jsonArray`:

```bash
mongoimport --db=shop --collection=customers --jsonArray --file=customers-array.json
```

### Useful mongoimport options

| Option | What it does |
| --- | --- |
| `--drop` | Empties (drops) the collection before importing. |
| `--mode=upsert` | Replaces documents that match, inserts the rest. |
| `--mode=merge` | Updates fields on documents that match, inserts the rest. |
| `--upsertFields=email` | Which field(s) decide "matching" (default `_id`). |
| `--ignoreBlanks` | Skips empty CSV cells instead of saving empty strings. |
| `--numInsertionWorkers=4` | Uses more parallel workers for big files. |

For example, to refresh prices from a supplier file without creating duplicates:

```bash
mongoimport --db=shop --collection=products --type=csv --headerline \
  --mode=merge --upsertFields=name --file=price-update.csv
```

## mongoexport: saving data out

### Export to JSON

```bash
mongoexport --db=shop --collection=products --out=products.json
```

The file has one document per line, in Extended JSON (so `ObjectId` and dates keep their type):

```json
{"_id":{"$oid":"6718a2f1c3b4e5d6f7a8b9c0"},"name":"Notebook","category":"stationery","price":49,"stock":120,"tags":["paper","school"]}
```

Add `--jsonArray` to get one big array instead, and `--pretty` for indented output.

### Export to CSV

CSV has columns, so you must list the fields you want:

```bash
mongoexport --db=shop --collection=products --type=csv \
  --fields=name,category,price,stock --out=products.csv
```

```text
name,category,price,stock
Notebook,stationery,49,120
Gel Pen,stationery,15,500
Headphones,electronics,1999,35
...
```

### Export only some documents

`--query` takes a filter written in **strict JSON** (quoted field names and operators). Here are the shipped orders only, sorted by date:

```bash
mongoexport --db=shop --collection=orders \
  --query='{ "status": "shipped" }' --sort='{ "createdAt": 1 }' \
  --out=shipped-orders.json
```

Quoting JSON inside a command is awkward in PowerShell. The easy fix is to put the filter in a file and use `--queryFile`:

```powershell
'{ "status": "shipped" }' | Out-File -Encoding ascii query.json
mongoexport --db=shop --collection=orders --queryFile=query.json --out=shipped-orders.json
```

> **Warning:** Don't use `mongoexport` + `mongoimport` as a backup. JSON and CSV can lose type details (CSV has no idea what an `ObjectId` or a nested array is). For backups, use `mongodump`.

## mongodump: an exact copy

`mongodump` saves data in MongoDB's own **BSON** format, so every type is kept exactly. It also saves each collection's **indexes** and options.

Dump the whole `shop` database:

```bash
mongodump --uri="mongodb://localhost:27017" --db=shop --out=./backup
```

```text
2026-10-25T09:30:00.000+0530    writing shop.products to backup/shop/products.bson
2026-10-25T09:30:00.000+0530    done dumping shop.products (8 documents)
2026-10-25T09:30:00.000+0530    writing shop.orders to backup/shop/orders.bson
...
```

The result is a folder like this:

```text
backup
└── shop
    ├── products.bson            (the documents)
    ├── products.metadata.json   (indexes and collection options)
    ├── orders.bson
    ├── orders.metadata.json
    ├── customers.bson
    └── customers.metadata.json
```

More ways to use it:

```bash
# Everything on the server (all databases)
mongodump --out=./full-backup

# One collection
mongodump --db=shop --collection=orders --out=./backup

# One compressed file instead of a folder
mongodump --db=shop --gzip --archive=shop-2026-10-25.gz
```

```powershell
# The same compressed archive on Windows
mongodump --db=shop --gzip --archive=shop-2026-10-25.gz
```

> **Tip:** The single `--archive` file is much easier to copy around, upload or email to a teammate than a folder full of files.

## mongorestore: loading a dump back

Restore the folder you just made:

```bash
mongorestore --uri="mongodb://localhost:27017" ./backup
```

Restore the compressed archive:

```bash
mongorestore --gzip --archive=shop-2026-10-25.gz
```

Useful options:

| Option | What it does |
| --- | --- |
| `--drop` | Drops each collection before restoring it, so you get a clean copy. |
| `--nsInclude="shop.orders"` | Restores only matching namespaces (wildcards like `shop.*` work). |
| `--nsFrom="shop.*" --nsTo="shopTest.*"` | Restores into a different database name. |
| `--dryRun` | Shows what would happen without writing anything. |
| `--noIndexRestore` | Skips creating indexes. |

A very common job is "copy the shop database as `shopTest` so I can experiment safely":

```bash
mongodump --db=shop --archive=shop.archive
mongorestore --archive=shop.archive --nsFrom="shop.*" --nsTo="shopTest.*"
```

> **Warning:** Without `--drop`, `mongorestore` only **adds** documents. If a document with the same `_id` already exists, that document is skipped with a duplicate key error, and the old version stays.

## bsondump: peeking inside a .bson file

A `.bson` file is binary, so you can't open it in a text editor. `bsondump` converts it to readable JSON:

```bash
bsondump ./backup/shop/products.bson --outFile=products-readable.json
```

Without `--outFile` it prints to the screen. This is handy to check what's inside a backup **without restoring it**.

## Moving data between servers

You can combine these tools to move data, for example from your laptop to Atlas:

```bash
mongodump --uri="mongodb://localhost:27017" --db=shop --archive=shop.archive
mongorestore --uri="mongodb+srv://asha@cluster0.abcde.mongodb.net" --archive=shop.archive
```

For small and medium databases, this is the simplest migration there is. For bigger or busier systems, where you can't stop writes during the copy, MongoDB has dedicated options:

- **Atlas live migration**: a guided process in the Atlas UI that copies a running database into Atlas and keeps it in sync until you switch over.
- **mongosync** (Cluster-to-Cluster Sync): a separate tool that keeps two clusters continuously in sync.

These are beyond a beginner's needs, but it's good to know they exist.

## Which tool should I use?

| Job | Tool |
| --- | --- |
| Load a CSV/JSON file from another system | `mongoimport` |
| Give someone a spreadsheet of data | `mongoexport --type=csv` |
| Make a backup | `mongodump` |
| Restore a backup or copy a database | `mongorestore` |
| See what's inside a `.bson` file | `bsondump` |
| Move a large, live database | Atlas live migration or `mongosync` |

## Common mistakes

- **Running the tools inside mongosh.** They are terminal programs. Type `exit` to leave mongosh first, then run them.
- **Dates imported as strings.** Plain JSON has no dates. Use Extended JSON (`{"$date": "..."}`) in JSON files, or `--columnsHaveTypes` with `date(...)` types for CSV.
- **CSV export with no fields.** `mongoexport --type=csv` needs `--fields` (or `--fieldFile`). It refuses to guess.
- **Importing twice.** Running the same `mongoimport` twice creates duplicates (new `_id`s each time). Use `--drop` or `--mode=upsert` with `--upsertFields`.
- **Restoring onto existing data without `--drop`.** Old documents with the same `_id` are kept and the backup versions are skipped.

## Practice

1. Export all `electronics` products to a CSV file with only `name` and `price`.
2. Make a compressed archive backup of the `shop` database.
3. Restore that archive into a new database called `shopCopy`, then check in mongosh that `shopCopy.products` exists.

<details>
<summary>Show a possible answer</summary>

```bash
# 1
mongoexport --db=shop --collection=products --type=csv \
  --fields=name,price --query='{ "category": "electronics" }' --out=electronics.csv

# 2
mongodump --db=shop --gzip --archive=shop.gz

# 3
mongorestore --gzip --archive=shop.gz --nsFrom="shop.*" --nsTo="shopCopy.*"
```

```javascript
// Check in mongosh
use shopCopy
db.products.countDocuments()
```

</details>

## Key takeaways

- The **MongoDB Database Tools** are terminal programs, installed separately from the server, that all accept `--uri`.
- `mongoimport` and `mongoexport` move data in and out as **JSON or CSV**; great for sharing, not for backups.
- `mongodump` and `mongorestore` copy data as **BSON**, keeping every type and the indexes.
- `--archive` and `--gzip` turn a dump into one compressed file; `--nsFrom`/`--nsTo` restore into a new name.
- `bsondump` lets you read a `.bson` file without restoring it.

**Next lesson:** [Transactions and ACID Guarantees](/courses/mongodb/transactions)
