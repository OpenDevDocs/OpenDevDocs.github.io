---
publishDate: 2026-10-25T09:41
title: Role-Based Authorization
slug: role-based-authorization
metadescription: Learn how to control what each user can do in an Express 5 API with roles, permissions and ownership checks, and how to avoid IDOR and mass-assignment bugs.
updateDate: 2026-10-25T09:41
author: ['bishal-biswas']
level: 3
tags: ['express', 'authorization', 'rbac', 'security']
course: expressjs
---

## What you will learn

- When to return **401 Unauthorized** and when to return **403 Forbidden**
- How to build a reusable `requireRole()` middleware
- How to move from roles to finer-grained **permissions**
- How to stop users from reading or changing other people's data (**IDOR**)
- How to stop users from making themselves admins (**mass assignment**)

You can now log users in with [JWTs](/courses/expressjs/jwt-authentication) or [Passport sessions](/courses/expressjs/passport-authentication). Either way, your handlers receive a `req.user`. But knowing *who* someone is does not tell you *what they may do*. That is the job of **authorization**.

## Authentication is the door, authorization is the rooms

Think of an office building. Your badge gets you through the front door (authentication). Inside, your badge opens your floor but not the server room or the CEO's office (authorization).

Every protected request goes through both checks in order:

```text
request
   |
   v
[ requireAuth ]  Are you logged in?             no -> 401 Unauthorized
   |
   v
[ requireRole ]  Is your role allowed here?     no -> 403 Forbidden
   |
   v
[ handler     ]  Do you own this record?        no -> 404 Not Found
   |
   v
 response
```

## 401 vs 403

The names of these status codes are confusing, so learn their real meaning:

| Status | Real meaning | Example |
| --- | --- | --- |
| `401 Unauthorized` | "I don't know who you are." Not logged in, or token invalid/expired. | No `Authorization` header |
| `403 Forbidden` | "I know who you are, and the answer is no." | A normal user calls an admin route |

A `401` invites the client to log in (again). A `403` means logging in again will not help.

## Step 1: give users a role

A **role** is a label for a group of users who share the same powers. Most apps start with two or three:

| Role | Can do |
| --- | --- |
| `user` | Manage their own notes |
| `editor` | Read everyone's notes, edit any note |
| `admin` | Everything, including managing users |

Store the role on the user record and give it a safe default:

```js
// models/User.js
import { Schema, model } from 'mongoose';

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'editor', 'admin'], default: 'user' },
});

export const User = model('User', userSchema);
```

The `enum` means the database refuses any other value, and `default: 'user'` means new accounts get the least power. This idea is called the **principle of least privilege**: give everyone the minimum access they need, nothing more.

## Step 2: a `requireRole` middleware

You want to write `requireRole('admin')` in a route. That means `requireRole` is a function that *returns* a middleware. This pattern is called a **middleware factory**, and you saw it in [Writing Custom Middleware](/courses/expressjs/writing-custom-middleware).

```js
// middleware/requireRole.js
export const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Please log in' });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to do this' });
  }
  next();
};
```

Use it after your authentication middleware:

```js
// routes/admin.js
import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { User } from '../models/User.js';

export const adminRouter = Router();

// Every route in this router needs a logged-in admin
adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get('/users', async (req, res) => {
  const users = await User.find().select('email role'); // never return passwordHash
  res.json(users);
});

adminRouter.patch('/users/:id/role', async (req, res) => {
  const { role } = req.body ?? {};
  if (!['user', 'editor', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true },
  ).select('email role');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});
```

```js
// app.js (excerpt)
app.use('/admin', adminRouter);
```

> **Tip:** Putting `requireAuth` and `requireRole` on the router with `adminRouter.use(...)` means you cannot forget them on a new route. Secure by default beats remembering every time.

Try it with a normal user's token:

```bash
curl -i http://localhost:3000/admin/users -H "Authorization: Bearer USER_TOKEN"
# HTTP/1.1 403 Forbidden
# {"error":"You do not have permission to do this"}
```

## Step 3: from roles to permissions

Roles work well until your `if` checks start looking like `requireRole('admin', 'editor', 'support', 'moderator')`. Every new role means hunting through routes to update lists.

A cleaner approach is to give each role a list of **permissions**, small named actions like `notes:read-any`. Routes check permissions, not roles. When you add a role, you edit one table.

```js
// auth/permissions.js
const rolePermissions = new Map([
  ['user', new Set(['notes:read-own', 'notes:write-own'])],
  ['editor', new Set(['notes:read-own', 'notes:write-own', 'notes:read-any', 'notes:write-any'])],
  ['admin', new Set([
    'notes:read-own', 'notes:write-own', 'notes:read-any', 'notes:write-any', 'users:manage',
  ])],
]);

export const can = (user, permission) =>
  rolePermissions.get(user?.role)?.has(permission) ?? false;

export const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in' });
  if (!can(req.user, permission)) {
    return res.status(403).json({ error: 'You do not have permission to do this' });
  }
  next();
};
```

> **Note:** We use a `Map` instead of a plain object. With a plain object, a strange role name such as `"constructor"` would find a built-in property instead of `undefined`. A `Map` only contains what you put in it.

Now the admin router reads `adminRouter.use(requireAuth, requirePermission('users:manage'))`. This style is often called **RBAC** (Role-Based Access Control): users get roles, roles get permissions.

## Step 4: ownership checks and IDOR

Roles answer "may this kind of user do this kind of thing?" But there is a second, sneakier question: "may this user touch **this particular record**?"

### The attack

Ada is logged in. She opens one of her notes, and the app calls:

```http
GET /notes/6720f1a2c4e8b9a1d3f00017 HTTP/1.1
Authorization: Bearer ADA_TOKEN
```

Out of curiosity, she changes the last digits of the ID to `...0018` and sends the request again. If your handler looks like this, she now reads Bob's private note:

```js
// routes/notes.js  (VULNERABLE)
notesRouter.get('/:id', async (req, res) => {
  const note = await Note.findById(req.params.id); // any note, anyone's!
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json(note);
});
```

Ada passed authentication: she has a valid token. The bug is that nobody checked whether the note is *hers*. This is called **IDOR** (Insecure Direct Object Reference). It is one of the most common real-world API vulnerabilities.

### The defence: put the owner in the query

The safest fix is to make the database do the check. Ask for "the note with this ID **that belongs to this user**":

```js
// routes/notes.js  (safe)
import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { can } from '../auth/permissions.js';
import { Note } from '../models/Note.js';

export const notesRouter = Router();
notesRouter.use(requireAuth);

// Build a filter that limits a query to records this user may see
const ownedBy = (req, extra = {}) =>
  can(req.user, 'notes:read-any') ? extra : { ...extra, owner: req.user.id };

notesRouter.get('/', async (req, res) => {
  res.json(await Note.find(ownedBy(req)));
});

notesRouter.get('/:id', async (req, res) => {
  const note = await Note.findOne(ownedBy(req, { _id: req.params.id }));
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json(note);
});

notesRouter.delete('/:id', async (req, res) => {
  const filter = can(req.user, 'notes:write-any')
    ? { _id: req.params.id }
    : { _id: req.params.id, owner: req.user.id };
  const note = await Note.findOneAndDelete(filter);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.status(204).end();
});

notesRouter.post('/', async (req, res) => {
  // The owner comes from the token/session, never from the request body
  const note = await Note.create({ title: req.body.title, body: req.body.body, owner: req.user.id });
  res.status(201).json(note);
});
```

Notice two things:

1. **Someone else's note returns `404`, not `403`.** A `403` would confirm "this note exists, you just can't see it". A `404` leaks nothing.
2. **The owner is always taken from `req.user`**, which your auth middleware set from a verified token or session. Never from `req.body` or `req.query`.

> **Warning:** Hard-to-guess IDs (like UUIDs) make IDOR harder to stumble into, but they are **not** a fix. IDs leak through URLs, logs and shared links. Always check ownership on the server.

## Step 5: mass assignment

### The attack

Your sign-up route saves whatever arrives in the body:

```js
// routes/auth.js  (VULNERABLE)
authRouter.post('/signup', async (req, res) => {
  const user = await User.create(req.body); // copies every field!
  res.status(201).json({ id: user.id });
});
```

A curious user opens the browser's dev tools and adds one extra field:

```json
{ "email": "eve@example.com", "passwordHash": "...", "role": "admin" }
```

They are now an admin. Copying all request fields straight into a database record is called **mass assignment**, and it has caused real breaches.

### The defence: pick allowed fields

Validate the body with a schema that lists only the fields a user may set. You learned Zod in [Request Validation with Zod](/courses/expressjs/request-validation-with-zod). By default, `z.object()` **drops unknown keys**, so `role` simply disappears:

```js
// routes/auth.js  (safe)
import { z } from 'zod';
import bcrypt from 'bcrypt';

const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(15).max(64),
});

authRouter.post('/signup', async (req, res) => {
  const result = signupSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }
  const { email, password } = result.data; // only these two fields
  const user = await User.create({
    email,
    passwordHash: await bcrypt.hash(password, 12),
    // role is not set here, so the schema default 'user' applies
  });
  res.status(201).json({ id: user.id, email: user.email });
});
```

The same rule applies to update routes. A "update my profile" route should only accept profile fields, never `role`, `owner` or `isVerified`.

## Where roles in JWTs go stale

If you put `role` in a JWT (as in the JWT lesson), remember the token is a snapshot. If you demote an admin, their existing access token still says `"role": "admin"` until it expires.

Ways to handle this:

- Keep access tokens short (15 minutes), so the window is small.
- For very sensitive actions (deleting users, changing billing), load the user from the database and check the current role.
- With [Passport sessions](/courses/expressjs/passport-authentication), `deserializeUser` loads the user on every request, so changes apply immediately.

## Common mistakes

> **Common mistake:** Hiding the "Delete" button in the frontend and calling that security. Anyone can call your API directly with `curl`. Every rule must be enforced on the server.

- **Checking roles but not ownership.** A valid login is not permission to read every record. Filter by `owner`.
- **Trusting `role`, `owner` or `userId` from the request body.** Take identity from `req.user` only.
- **Forgetting a guard on one new route.** Apply `requireAuth` at the router level so new routes are protected by default.
- **Returning `403` for other users' records.** That confirms the record exists. Prefer `404`.
- **Scattering role lists across routes.** Centralise them in one permissions table.

## Key takeaways

- **401** means "not logged in"; **403** means "logged in, but not allowed".
- Use a middleware factory like `requireRole()` or `requirePermission()` and attach it at the router level.
- **Permissions** grouped into roles (RBAC) scale better than role lists sprinkled through routes.
- Prevent **IDOR** by including the owner in every database query, and return `404` for records the user cannot see.
- Prevent **mass assignment** by validating input and copying only allowed fields.

## Practice

1. Add an `editor` role to your Notes API. Editors can read and edit any note but cannot delete notes or manage users.
2. Create two users, give each a note, and try to `GET`, `PATCH` and `DELETE` the other user's note. Every request should return `404`.
3. Try signing up with `"role": "admin"` in the JSON body. Confirm the new user is still a `user`.
4. Write a `requireSelfOrAdmin` middleware for `/users/:id` that lets users see their own profile and admins see anyone's.

## What's next

Your login code relies on stored password hashes, so it is time to understand them properly in [Password Hashing and Account Security](/courses/expressjs/password-hashing-and-account-security).
