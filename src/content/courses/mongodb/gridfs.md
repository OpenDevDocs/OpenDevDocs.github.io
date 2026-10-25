---
title: GridFS for Large Files
slug: gridfs
metadescription: Learn how GridFS stores files bigger than 16 MB in MongoDB, how to upload and download them with mongofiles and Node.js, and when to use object storage.
publishDate: 2026-10-25T08:00
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 2
tags: ['mongodb', 'gridfs', 'files', 'nodejs']
course: mongodb
---
## What you will learn

By the end of this lesson you will know:

- Why you can't just put a big file inside a normal document
- How **GridFS** splits a file into **chunks** and stores it in two collections
- How to upload, list, download and delete files with the **mongofiles** tool
- How to do the same from a Node.js app with `GridFSBucket`
- When GridFS is a good idea and when a cloud storage service is better

## The 16 MB limit

Every MongoDB document has a maximum size of **16 MB**. That's plenty for normal data: a product, a customer, an order with 200 items.

But what about a 40 MB product video, a 200 MB PDF catalogue, or a large backup file? They don't fit in one document.

**GridFS** is MongoDB's built-in way to store files of any size. It's not a separate server or product. It's a simple **convention** that every MongoDB driver understands: split the file into small pieces and store each piece as its own document.

> **Think of it like this:** You can't post a sofa in one envelope. So you take it apart, put each piece in a numbered box, and include a packing list. At the other end, someone uses the list to put the sofa back together. GridFS does exactly this with files.

## How GridFS stores a file

GridFS uses two collections. By default they are called `fs.files` and `fs.chunks`. The `fs` part is the **bucket name**, which you can change.

```text
shop                     (database)
├── fs.files             (one document per file: the "packing list")
└── fs.chunks            (many documents per file: the "numbered boxes")
```

### fs.files: the packing list

Each uploaded file gets one document in `fs.files` that describes it:

```javascript
{
  _id: ObjectId("6718d4a1b2c3d4e5f6a7b8c9"),
  length: 734003,              // file size in bytes
  chunkSize: 261120,           // size of each piece (255 KB by default)
  uploadDate: ISODate("2026-10-25T08:30:00Z"),
  filename: "headphones.jpg",
  metadata: { productName: "Headphones", uploadedBy: "Asha" } // your own extra info
}
```

### fs.chunks: the pieces

The file's bytes are split into chunks of **255 KB** each (the last one can be smaller). Each chunk is a small document:

```javascript
{
  _id: ObjectId("..."),
  files_id: ObjectId("6718d4a1b2c3d4e5f6a7b8c9"), // which file this piece belongs to
  n: 0,                                            // piece number: 0, 1, 2, ...
  data: BinData(0, "...")                           // the raw bytes
}
```

Our 734,003-byte image needs three chunks: `n: 0`, `n: 1` and `n: 2`. To read the file back, a driver finds all chunks with that `files_id`, sorts them by `n`, and joins them.

> **Note:** GridFS works with any file size, even small ones. But it is only *needed* for files bigger than 16 MB. A 50 KB avatar fits fine in a normal document as binary data.

## Trying GridFS with mongofiles

The quickest way to play with GridFS is **mongofiles**, a command-line tool that is part of the **MongoDB Database Tools** (the same package as `mongodump` and `mongoimport`, covered in the next lesson). If `mongofiles --version` prints a version, you're ready.

### Upload a file

Find any file on your computer, for example an image, and upload it into the `shop` database:

```bash
mongofiles --uri="mongodb://localhost:27017" --db=shop put headphones.jpg
```

```text
2026-10-25T08:30:00.000+0530    connected to: mongodb://localhost:27017
2026-10-25T08:30:00.000+0530    adding gridFile: headphones.jpg
2026-10-25T08:30:00.000+0530    added gridFile: headphones.jpg
```

On Windows PowerShell the command is the same:

```powershell
mongofiles --uri="mongodb://localhost:27017" --db=shop put .\headphones.jpg
```

### List and search files

```bash
mongofiles --db=shop list
# headphones.jpg  734003

mongofiles --db=shop search head
# headphones.jpg  734003
```

### Download a file

`get` saves the file back to disk. Use `--local` to choose the output name:

```bash
mongofiles --db=shop get headphones.jpg --local=headphones-copy.jpg
```

### Delete a file

```bash
mongofiles --db=shop delete headphones.jpg
```

This removes both the `fs.files` document and all of its chunks.

### Look inside with mongosh

After uploading, open mongosh and peek at what GridFS created:

```javascript
use shop

db.fs.files.find({}, { filename: 1, length: 1, chunkSize: 1 })
// → { _id: ObjectId('...'), filename: 'headphones.jpg', length: 734003, chunkSize: 261120 }

db.fs.chunks.countDocuments()
// → 3
```

> **Warning:** Don't edit `fs.files` or `fs.chunks` by hand (except the `metadata` field). If a chunk goes missing or `length` is wrong, the file becomes unreadable.

## GridFS in a Node.js app

In a real app, files usually arrive from a user upload form. The Node.js driver gives you a class called **`GridFSBucket`** that handles all the chunking for you, using **streams** so even huge files never need to fit in memory.

### Create a bucket

Let's use a bucket named `productImages`. Its collections will be `productImages.files` and `productImages.chunks`:

```javascript
import { MongoClient, GridFSBucket } from "mongodb";

const client = new MongoClient("mongodb://localhost:27017");
const db = client.db("shop");

const bucket = new GridFSBucket(db, { bucketName: "productImages" });
```

### Upload a file

`openUploadStream()` gives you a stream to write the file into. We read a file from disk and **pipe** it in. The `pipeline` helper waits until the upload is finished and reports errors properly:

```javascript
import fs from "node:fs";
import { pipeline } from "node:stream/promises";

const uploadStream = bucket.openUploadStream("headphones.jpg", {
  metadata: { productName: "Headphones", uploadedBy: "Asha" }
});

await pipeline(fs.createReadStream("./headphones.jpg"), uploadStream);

console.log("Saved with id:", uploadStream.id);
// → Saved with id: new ObjectId('6718d4a1b2c3d4e5f6a7b8c9')
```

Save that id somewhere useful, for example on the product document:

```javascript
await db.collection("products").updateOne(
  { name: "Headphones" },
  { $set: { imageFileId: uploadStream.id } }
);
```

### Find files

`bucket.find()` searches the `files` collection with a normal filter:

```javascript
const files = await bucket.find({ "metadata.productName": "Headphones" }).toArray();

for (const file of files) {
  console.log(file.filename, file.length, file.uploadDate);
}
// → headphones.jpg 734003 2026-10-25T03:00:00.000Z
```

### Download a file

Open a download stream by id (or by name) and pipe it wherever you want: a file on disk, or the HTTP response in a web server.

```javascript
// By id
await pipeline(
  bucket.openDownloadStream(uploadStream.id),
  fs.createWriteStream("./downloaded.jpg")
);

// By name (gets the newest file with that name)
await pipeline(
  bucket.openDownloadStreamByName("headphones.jpg"),
  fs.createWriteStream("./downloaded-by-name.jpg")
);
```

Here's how it looks in an Express route that sends a product image to the browser:

```javascript
import { ObjectId } from "mongodb";

app.get("/images/:id", async (req, res) => {
  try {
    const id = new ObjectId(req.params.id);
    res.set("Content-Type", "image/jpeg");
    await pipeline(bucket.openDownloadStream(id), res);
  } catch (err) {
    res.status(404).send("Image not found");
  }
});
```

### Rename and delete

```javascript
await bucket.rename(uploadStream.id, "headphones-black.jpg");

await bucket.delete(uploadStream.id); // removes the files entry and all its chunks
```

## Streaming part of a file

Because the file is stored in numbered chunks, GridFS can read **just part** of it without loading the rest. That's great for video players that jump to the middle:

```javascript
// Read only bytes 1,000,000 to 1,999,999
const partial = bucket.openDownloadStream(videoId, { start: 1_000_000, end: 2_000_000 });
```

## Should I use GridFS?

GridFS is handy, but it is not always the best home for files.

**GridFS is a good fit when:**

- Files are **bigger than 16 MB** and you want them in MongoDB
- You want files to be **backed up and replicated together** with the rest of your data
- You can't (or don't want to) add another service to your system
- You want to store **metadata** with each file and query it like normal data

**Object storage is often better when:**

- You serve lots of images or videos to the public. Services like Amazon S3, Google Cloud Storage, Azure Blob Storage or Cloudflare R2 are cheaper per GB and work with CDNs.
- Files are huge and many, so they would make your database (and its backups) very large

A common pattern is to put the file in object storage and save only its **URL and details** in MongoDB:

```javascript
db.products.updateOne(
  { name: "Headphones" },
  { $set: { image: { url: "https://cdn.example.com/products/headphones.jpg", sizeBytes: 734003 } } }
)
```

| Need | Choose |
| --- | --- |
| Small binary (under a few MB), like a thumbnail | Normal document with a binary field |
| Big files, kept together with your data | GridFS |
| Lots of public media, served fast worldwide | Object storage + URL in MongoDB |

> **Tip:** GridFS files are not "updated in place". To change a file, upload the new version and delete the old one.

## Common mistakes

- **Using GridFS for tiny files.** Storing 20 KB icons as GridFS files adds two collections and extra queries for no gain. A binary field in a normal document is simpler.
- **Reading the whole file into memory.** In Node.js, always use streams (`pipeline`) instead of collecting the whole file into one big `Buffer`. Big files will crash your app otherwise.
- **Deleting only from `fs.files`.** That leaves orphan chunks behind, taking up space. Use `bucket.delete()` or `mongofiles delete`, which clean up both collections.
- **Forgetting the bucket name.** If you uploaded with `bucketName: "productImages"`, you must use the same bucket name to find or download the file. With mongofiles, add `--prefix=productImages`.
- **Assuming file names are unique.** GridFS allows many files with the same `filename`. Use the `_id` to point to a specific one.

## Practice

1. Using mongofiles, upload any PDF to the `shop` database, list the files, and then download it back with a new name.
2. In mongosh, find the uploaded file's size and count how many chunks it has.
3. In Node.js, write code that uploads `catalogue.pdf` into a bucket called `documents` with `metadata: { year: 2026 }`, then lists every file in that bucket from 2026.

<details>
<summary>Show a possible answer</summary>

```bash
# 1
mongofiles --db=shop put catalogue.pdf
mongofiles --db=shop list
mongofiles --db=shop get catalogue.pdf --local=catalogue-copy.pdf
```

```javascript
// 2 (mongosh)
use shop
const file = db.fs.files.findOne({ filename: "catalogue.pdf" })
file.length
db.fs.chunks.countDocuments({ files_id: file._id })

// 3 (Node.js)
import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { MongoClient, GridFSBucket } from "mongodb";

const client = new MongoClient("mongodb://localhost:27017");
const bucket = new GridFSBucket(client.db("shop"), { bucketName: "documents" });

await pipeline(
  fs.createReadStream("./catalogue.pdf"),
  bucket.openUploadStream("catalogue.pdf", { metadata: { year: 2026 } })
);

const files = await bucket.find({ "metadata.year": 2026 }).toArray();
console.log(files.map(f => f.filename));

await client.close();
```

</details>

## Key takeaways

- A single MongoDB document can be at most **16 MB**; **GridFS** lets you store bigger files.
- GridFS splits a file into **255 KB chunks** in `fs.chunks` and keeps one description document in `fs.files`.
- **mongofiles** (`put`, `list`, `search`, `get`, `delete`) is the quickest way to try GridFS from the terminal.
- In Node.js, `GridFSBucket` with `openUploadStream()` and `openDownloadStream()` handles files using streams.
- For lots of public media, object storage plus a URL in MongoDB is often cheaper and faster than GridFS.

**Next lesson:** [Import, Export and Data Migration Tools](/courses/mongodb/import-export-and-tools)
