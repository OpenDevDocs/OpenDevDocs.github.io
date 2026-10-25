---
publishDate: 2026-10-25T09:29
title: File Uploads with Multer
slug: file-uploads-with-multer
metadescription: Learn how to accept file uploads in Express 5 with Multer, choose disk or memory storage, limit file size and type, and handle upload errors safely.
updateDate: 2026-10-25T09:29
author: ['bishal-biswas']
level: 2
tags: ['express', 'multer', 'file-upload', 'middleware']
course: expressjs
---

## What you will learn

- Why file uploads need a different body parser than JSON
- How to accept one file, many files, or a mix of files and text fields with **Multer**
- How to control where files are saved and what they are named
- How to limit file size and allow only certain file types
- How to handle upload errors and serve uploaded files back to users

## Why uploads are different

So far, your clients have sent data as JSON, and `express.json()` read it for you. Files are different. A photo is binary data, not text, and a form often sends a file *and* some text fields together.

Browsers solve this with a special body format called **multipart/form-data**. "Multipart" means the body is split into several parts, one per form field. Each part has its own small header saying its name and, for files, its file name and type.

**Think of it like a parcel with several boxes inside.** One box holds a note ("display name: Asha"), another holds a photo. Someone has to open the parcel, unpack each box and put things in the right place. `express.json()` cannot open this kind of parcel. **Multer** can.

```text
POST /profile  (Content-Type: multipart/form-data; boundary=----abc)

------abc
Content-Disposition: form-data; name="displayName"

Asha
------abc
Content-Disposition: form-data; name="avatar"; filename="me.png"
Content-Type: image/png

<binary bytes of the image>
------abc--
```

The **boundary** is a random string the browser picks to mark where one part ends and the next begins. You never write this by hand, but it helps to know what Multer is reading.

## Installing Multer

**Multer** is a middleware that reads `multipart/form-data` bodies. It puts text fields on `req.body` and file information on `req.file` (one file) or `req.files` (many files).

```bash
npm install multer
```

This installs Multer 2, which this lesson uses.

## Your first upload

Here is the smallest useful example. It accepts one file from a form field named `avatar`.

```js
// app.js
import express from 'express';
import multer from 'multer';

const app = express();

// Save uploaded files into the "uploads" folder (Multer creates it if needed)
const upload = multer({ dest: 'uploads/' });

app.post('/profile', upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please attach a file in the "avatar" field' });
  }

  res.status(201).json({
    message: 'Upload complete',
    displayName: req.body.displayName,
    file: req.file,
  });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

Notice that Multer is not added with `app.use()`. You attach it only to the route that expects a file. `upload.single('avatar')` means "expect exactly one file, in the field called `avatar`".

Test it with `curl`. The `-F` flag sends `multipart/form-data`, and `@` means "read this file from disk":

```bash
curl -F "displayName=Asha" -F "avatar=@./me.png" http://localhost:3000/profile
```

The response looks something like this:

```json
{
  "message": "Upload complete",
  "displayName": "Asha",
  "file": {
    "fieldname": "avatar",
    "originalname": "me.png",
    "encoding": "7bit",
    "mimetype": "image/png",
    "destination": "uploads/",
    "filename": "3f9c1e0b7a5d4c2e9b8a7f6e5d4c3b2a",
    "path": "uploads/3f9c1e0b7a5d4c2e9b8a7f6e5d4c3b2a",
    "size": 48213
  }
}
```

If you prefer a browser, this HTML form sends the same request. The `enctype` attribute is what switches the form to multipart:

```html
<form action="/profile" method="post" enctype="multipart/form-data">
  <input type="text" name="displayName" placeholder="Display name" />
  <input type="file" name="avatar" accept="image/*" />
  <button type="submit">Upload</button>
</form>
```

> **Common mistake:** Forgetting `enctype="multipart/form-data"` on the form. Without it, the browser sends only the file *name* as text, and `req.file` is `undefined`.

## What is inside req.file

| Property | Meaning |
| --- | --- |
| `fieldname` | The form field name, such as `avatar` |
| `originalname` | The file name on the user's computer. **Never trust it** for saving files. |
| `mimetype` | The type the client *claims*, such as `image/png` |
| `size` | Size in bytes |
| `destination`, `filename`, `path` | Where the file was saved (disk storage only) |
| `buffer` | The whole file in memory (memory storage only) |

By default Multer gives saved files a random name with no extension. That is a safe choice: a user cannot pick a name like `../../server.js` and overwrite your code.

## Choosing where files go

The `dest` option is quick, but you usually want more control. Multer has two **storage engines**, which are plug-ins that decide what happens to each file.

| Storage | Where the file goes | Good for |
| --- | --- | --- |
| `multer.diskStorage()` | A folder on your server's disk | Small apps, files you serve yourself |
| `multer.memoryStorage()` | A `Buffer` in RAM (`req.file.buffer`) | Small files you process or send to cloud storage |

### Disk storage with safe file names

This version keeps a random name but adds the correct extension, so browsers know how to display the file.

```js
// upload.js
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import multer from 'multer';

export const UPLOAD_DIR = 'uploads';

// With diskStorage you must create the folder yourself
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Map allowed types to the extension we will save
const EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = EXTENSIONS[file.mimetype] ?? '';
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const uploadImage = multer({ storage });
```

The `cb` (callback) argument follows the old Node.js style: the first value is an error (or `null`), the second is the result.

### Memory storage

Memory storage keeps the file in RAM. Nothing touches your disk, which is handy when you only want to resize an image or pass it on to a cloud service such as Amazon S3.

```js
// upload-memory.js
import multer from 'multer';

export const uploadToMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 }, // 1 MB, keep memory uploads small
});
```

> **Warning:** Every file in memory storage sits in your server's RAM until the request ends. Without a size limit, a few large uploads at once can crash your server. Always set `limits.fileSize` with memory storage.

## Many files and mixed fields

`single()` is one of four methods. Pick the one that matches your form.

| Method | Accepts | Result |
| --- | --- | --- |
| `upload.single('avatar')` | One file in `avatar` | `req.file` |
| `upload.array('photos', 5)` | Up to 5 files in `photos` | `req.files` (an array) |
| `upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'gallery', maxCount: 8 }])` | Several named file fields | `req.files.cover`, `req.files.gallery` |
| `upload.none()` | Text fields only, no files | `req.body` |

Here is an album route that takes up to five photos:

```js
// routes/albums.js
import { Router } from 'express';
import { uploadImage } from '../upload.js';

const router = Router();

router.post('/', uploadImage.array('photos', 5), (req, res) => {
  const files = req.files ?? [];
  res.status(201).json({
    title: req.body.title,
    photos: files.map((file) => `/uploads/${file.filename}`),
  });
});

export default router;
```

Send several files by repeating the field name:

```bash
curl -F "title=Holiday" -F "photos=@./beach.jpg" -F "photos=@./hills.jpg" http://localhost:3000/albums
```

> **Note:** If a client sends a file in a field you did not list, Multer rejects the request with a `LIMIT_UNEXPECTED_FILE` error. This protects you from surprise uploads.

## Limiting size and type

Never accept "any file of any size". Multer gives you two tools.

1. **`limits`** stops the upload when it gets too big. `fileSize` is in bytes. You can also cap `files` (how many files) and `fields` (how many text fields).
2. **`fileFilter`** is a function that runs for each file *before* it is saved. Call `cb(null, true)` to accept, `cb(null, false)` to silently skip, or `cb(error)` to reject the whole request.

Add a filter to `upload.js` and replace the old `uploadImage` export with this one:

```js
// upload.js (add the filter, replace the uploadImage export)
const fileFilter = (req, file, cb) => {
  if (EXTENSIONS[file.mimetype]) {
    cb(null, true);
  } else {
    const error = new Error('Only PNG, JPEG and WebP images are allowed');
    error.status = 400;
    cb(error);
  }
};

export const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB per file
    files: 5,
  },
});
```

> **Warning:** `file.mimetype` comes from the client, so a user can lie about it. A file filter stops honest mistakes, not attackers. For important apps, check the real file contents after upload, for example with the `file-type` package, which reads the first bytes of the file (its "magic number").

## Handling upload errors

When something goes wrong, Multer calls `next(err)`, so the error lands in your error-handling middleware. Multer's own problems are instances of `multer.MulterError`, and each has a `code`.

| `err.code` | When it happens |
| --- | --- |
| `LIMIT_FILE_SIZE` | A file is bigger than `limits.fileSize` |
| `LIMIT_FILE_COUNT` | Too many files |
| `LIMIT_UNEXPECTED_FILE` | A file arrived in a field you did not expect |
| `LIMIT_FIELD_COUNT` | Too many text fields |

Add a branch for them in your error handler:

```js
// middleware/error-handler.js
import multer from 'multer';

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: err.message, code: err.code });
  }

  const status = err.status ?? 500;
  res.status(status).json({
    error: status < 500 ? err.message : 'Something went wrong',
  });
};
```

`413` means **Payload Too Large**, the standard status for "your upload is too big". Try it by sending a file over the limit:

```bash
curl -F "avatar=@./huge-photo.jpg" http://localhost:3000/profile
```

```json
{ "error": "File too large", "code": "LIMIT_FILE_SIZE" }
```

## Serving uploaded files

Files on disk are not public until you serve them. You already know the tool for that: `express.static`.

```js
// app.js
import express from 'express';
import { uploadImage, UPLOAD_DIR } from './upload.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

app.use('/uploads', express.static(UPLOAD_DIR));

app.post('/profile', uploadImage.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please attach an image in the "avatar" field' });
  }
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

app.use(errorHandler);

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

Now `http://localhost:3000/uploads/<filename>.png` shows the image.

> **Tip:** In production, many teams send uploads straight to object storage (Amazon S3, Cloudflare R2, Google Cloud Storage) instead of the server's disk. Server disks can be wiped on redeploy, and several servers do not share one disk.

## Cleaning up after failures

Multer saves the file *before* your route handler runs. If your handler then fails, say the database is down, the file stays on disk with nothing pointing to it. Delete it yourself:

```js
// routes/profile.js
import fs from 'node:fs/promises';
import { Router } from 'express';
import { uploadImage } from '../upload.js';

const router = Router();

router.post('/', uploadImage.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please attach an image in the "avatar" field' });
  }

  try {
    await saveAvatarInDatabase(req.file.filename); // your own function
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  } catch (err) {
    await fs.unlink(req.file.path).catch(() => {}); // ignore "file already gone"
    throw err; // Express 5 forwards this to the error handler
  }
});
```

## Common mistakes

> **Common mistake:** Using `app.use(upload.any())` for the whole app. This lets anyone upload files to *any* route. Attach Multer only to routes that need it, with the exact field names.

- **Field name mismatch.** `upload.single('avatar')` but the form field is called `photo`. You get a `LIMIT_UNEXPECTED_FILE` error.
- **Expecting `req.body` on non-multipart requests.** Multer only runs for `multipart/form-data`. For other requests it does nothing, and in Express 5 `req.body` stays `undefined` unless another parser ran.
- **Saving with `originalname`.** Two users upload `photo.jpg` and one overwrites the other, or a crafted name escapes your folder. Generate your own names.
- **No limits.** Always set `fileSize`, and keep memory storage small.
- **Putting uploads inside a folder that is served with `express.static` *and* allowing HTML or SVG files.** A user could upload a page with scripts that runs on your domain. Allow only the types you need.

## Key takeaways

- File uploads use **multipart/form-data**, which `express.json()` cannot read. **Multer** can.
- Use `single`, `array`, `fields` or `none` on the specific route, never globally.
- Text fields land on `req.body`, files on `req.file` or `req.files`.
- Choose **disk storage** for files you keep, **memory storage** for small files you process or forward.
- Always set `limits` and a `fileFilter`, generate your own file names, and handle `MulterError` in your error handler.

## Practice

1. Build a `POST /avatar` route that accepts one PNG or JPEG up to 500 KB and returns its public URL. Test it with `curl -F`.
2. Send a 1 MB file and confirm you get a `413` with `LIMIT_FILE_SIZE`.
3. Create a `POST /products` route with `upload.fields()` that accepts one `cover` image and up to four `gallery` images, plus a `name` text field.
4. Switch the avatar route to memory storage and log `req.file.buffer.length`. Does it match `req.file.size`?

## What's next

Uploads often come from a frontend running on a different address than your API, and browsers block that by default. Learn how to allow it safely in [CORS Configuration](/courses/expressjs/cors-configuration).
