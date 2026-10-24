---
publishDate: 2026-05-17T09:49
title: Server Functions and use server
slug: server-functions
metadescription: Call server code directly from a component with use server, replacing hand written API routes for mutations.
updateDate: 2026-09-05T09:49
author: ['bishal-biswas']
level: 3
tags: ['rsc', 'server', 'actions']
course: react
---

## What they are

A Server Function is a function that runs on the server but is **called from the client** as if it were local.

```javascript
'use server';
export async function createTodo(formData) {
  const text = formData.get('text');
  await db.todos.create({ data: { text } });
}
```

```javascript
'use client';
import { createTodo } from './actions.js';
export function TodoForm() {
  return (
    <form action={createTodo}>
      <input name="text" />
      <button>Add</button>
    </form>
  );
}
```

No API route, no `fetch`, no JSON. React creates the network call for you.

## What replaces what

Without Server Functions you write both ends:

```javascript
export async function POST(request) {
  const { text } = await request.json();
  const todo = await db.todos.create({ data: { text } });
  return Response.json(todo);
}
```

```javascript
async function createTodo(text) {
  const response = await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!response.ok) throw new Error('Failed');
  return response.json();
}
```

A route, a URL, a method, headers, serialising, error checking. A Server Function collapses all of it into one function.

## The directive

Two places to put it.

**At the top of a file**, making every export a Server Function:

```javascript
'use server';
export async function createTodo(formData) {}
export async function deleteTodo(id) {}
```

**Inside a function** in a Server Component:

```javascript
export default async function Page() {
  async function createTodo(formData) {
    'use server';
    await db.todos.create({ data: { text: formData.get('text') } });
  }
  return <form action={createTodo}><input name="text" /></form>;
}
```

The inline form is convenient for one off actions and can close over server side values.

> Do not confuse `'use server'` with `'use client'`. They are not opposites. `'use client'` marks where the browser bundle starts. `'use server'` marks functions the client may call on the server.

## They are public endpoints

This is the most important thing to understand.

A Server Function becomes a real HTTP endpoint. Anyone can call it with any arguments, from anywhere. The form on your page is only one possible caller.

**Validate and authorise inside every one.**

```javascript
'use server';
import { z } from 'zod';
const schema = z.object({
  text: z.string().min(1).max(500)
});
export async function createTodo(formData) {
  const session = await getSession();
  if (!session) {
    return { error: 'You must be signed in' };
  }
  const parsed = schema.safeParse({ text: formData.get('text') });
  if (!parsed.success) {
    return { error: 'Invalid input' };
  }
  await db.todos.create({
    data: { text: parsed.data.text, userId: session.userId }
  });
  return { success: true };
}
```

Note `userId` comes from the session, never from the form. Trusting a client supplied user id lets anyone write data as anyone else.

Never assume a check in the component protected anything:

```javascript
{user.isAdmin && <DeleteButton />}
```

Hiding the button hides it from honest users. The function must check.

## Revalidating

After a mutation the page should reflect it.

```javascript
'use server';
import { revalidatePath } from 'next/cache';
export async function createTodo(formData) {
  await db.todos.create({ data: { text: formData.get('text') } });
  revalidatePath('/todos');
}
```

`revalidatePath` tells the framework to refetch that route's data. Without it the user submits and sees nothing change.

Or redirect:

```javascript
import { redirect } from 'next/navigation';
export async function createProduct(formData) {
  const product = await db.products.create({ data: {} });
  redirect(`/products/${product.id}`);
}
```

## With useActionState

For validation errors next to the field:

```javascript
'use client';
import { useActionState } from 'react';
import { createTodo } from './actions.js';
export function TodoForm() {
  const [state, formAction, isPending] = useActionState(createTodo, null);
  return (
    <form action={formAction}>
      <input name="text" />
      {state?.error && <p className="error">{state.error}</p>}
      <button disabled={isPending}>Add</button>
    </form>
  );
}
```

The action signature gains the previous state as its first argument:

```javascript
'use server';
export async function createTodo(previousState, formData) {}
```

## Calling one outside a form

```javascript
'use client';
import { useTransition } from 'react';
import { deleteTodo } from './actions.js';
export function DeleteButton({ id }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(async () => await deleteTodo(id))}
      disabled={isPending}
    >
      {isPending ? 'Deleting...' : 'Delete'}
    </button>
  );
}
```

Arguments are serialised, so the same rules apply: strings, numbers, plain objects and `FormData` are fine, functions and class instances are not.

## Progressive enhancement

A form with a Server Function action **works before JavaScript loads**. The browser submits it as a normal HTML form, the server handles it, and the page updates.

Once React hydrates, the same form submits without a page load.

This only works because you passed a function to `action`. A form using `onSubmit` is inert until JavaScript arrives.

## When not to use them

**For reading data.** A Server Component fetches directly and does it better. Server Functions are for mutations.

**For a public API.** Other clients, mobile apps and third parties need real REST or GraphQL endpoints.

**Called in a loop.** Each call is a round trip. Batch instead.

## Quick recap

- A Server Function runs on the server and is called like a local function.
- It replaces writing an API route plus a fetch wrapper.
- `'use server'` goes at the top of a file or inside a function.
- Every one is a public endpoint, so validate and authorise inside it.
- Take the user id from the session, never from the request body.
- Revalidate or redirect after a mutation.
- Pair with `useActionState` for validation errors.
- Forms using them work before JavaScript loads.

<code id="code-content" class="language-javascript">
// ---------- app/actions.js ----------
'use server';                    // every export becomes a Server Function
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
const todoSchema = z.object({ text: z.string().min(1).max(500) });
// TREAT THIS AS A PUBLIC ENDPOINT. Anyone can call it with any arguments,
// from anywhere. The form on your page is only one possible caller.
export async function createTodo(previousState, formData) {
  // 1. Authorise. Never rely on the button being hidden in the UI.
  const session = await getSession();
  if (!session) return { error: 'You must be signed in' };
  // 2. Validate. Never trust the shape of what arrives.
  const parsed = todoSchema.safeParse({ text: formData.get('text') });
  if (!parsed.success) return { error: 'Text must be 1 to 500 characters' };
  // 3. Take the user id from the SESSION, never from the form. Trusting
  //    a client supplied id lets anyone write data as anyone else.
  await db.todos.create({
    data: { text: parsed.data.text, userId: session.userId }
  });
  // 4. Revalidate, or the user submits and sees nothing change
  revalidatePath('/todos');
  return { success: true };
}
export async function deleteTodo(id) {
  const session = await getSession();
  const todo = await db.todos.findUnique({ where: { id } });
  // Check ownership as well as authentication
  if (!session || todo.userId !== session.userId) {
    return { error: 'Not allowed' };
  }
  await db.todos.delete({ where: { id } });
  revalidatePath('/todos');
}
// ---------- TodoForm.jsx : a client component ----------
// 'use client';
// import { useActionState, useTransition } from 'react';
// import { createTodo, deleteTodo } from './actions.js';
// export function TodoForm() {
//   const [state, formAction, isPending] = useActionState(createTodo, null);
//   return (
//     // Works BEFORE JavaScript loads, because action takes a function.
//     // A form using onSubmit would be inert until hydration.
//     &lt;form action={formAction}&gt;
//       &lt;input name="text" /&gt;
//       {state?.error &amp;&amp; &lt;p className="error"&gt;{state.error}&lt;/p&gt;}
//       &lt;button disabled={isPending}&gt;{isPending ? 'Adding...' : 'Add'}&lt;/button&gt;
//     &lt;/form&gt;
//   );
// }
// Calling one outside a form: wrap it in a transition
// export function DeleteButton({ id }) {
//   const [isPending, startTransition] = useTransition();
//   return (
//     &lt;button
//       onClick={() =&gt; startTransition(async () =&gt; await deleteTodo(id))}
//       disabled={isPending}
//     &gt;
//       {isPending ? 'Deleting...' : 'Delete'}
//     &lt;/button&gt;
//   );
// }
// USE THEM FOR MUTATIONS. For reading, a Server Component fetches
// directly and does it better.
</code></pre>
