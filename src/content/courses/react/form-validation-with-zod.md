---
publishDate: 2026-05-23T10:07
title: Schema Validation with Zod
slug: form-validation-with-zod
metadescription: Define your data shape once and use it for form validation, API parsing and TypeScript types.
updateDate: 2026-09-05T10:07
author: ['bishal-biswas']
level: 3
tags: ['forms', 'validation', 'typescript']
course: react
---

## One definition, three uses

A schema describes what valid data looks like. Once you have written one, it can:

1. Validate a form.
2. Parse an API response or request body.
3. Generate a TypeScript type.

Without a schema you write those three separately and they drift apart.

```bash
npm install zod
```

## A schema

```javascript
import { z } from 'zod';
const signupSchema = z.object({
  username: z
    .string()
    .min(3, 'At least 3 characters')
    .max(20, 'At most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  email: z.string().email('That does not look like an email'),
  age: z.number().int().min(18, 'You must be 18 or older'),
  password: z.string().min(8, 'At least 8 characters'),
  confirmPassword: z.string(),
  newsletter: z.boolean().default(false)
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});
```

The messages live with the rules, so there is one place to change them.

`refine` validates across fields, and `path` puts the error on the right one.

## Parsing

```javascript
const result = signupSchema.safeParse(formData);
if (!result.success) {
  console.log(result.error.issues);
} else {
  console.log(result.data);
}
```

`safeParse` returns a result object. `parse` throws instead, which suits a server where an error boundary or middleware will catch it.

Note that `result.data` is **cleaned**: defaults are applied, and unknown keys are stripped. So you can trust its shape afterwards.

## With React Hook Form

```bash
npm install @hookform/resolvers
```

```javascript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
function SignupForm() {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(signupSchema),
    mode: 'onTouched'
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('username')} />
      {errors.username && <p>{errors.username.message}</p>}
      <input {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}
      <input type="number" {...register('age', { valueAsNumber: true })} />
      {errors.age && <p>{errors.age.message}</p>}
      <button>Sign up</button>
    </form>
  );
}
```

The `register` calls carry no rules at all. The schema is the single source of truth.

Note `valueAsNumber`. Inputs always give strings, and `z.number()` would reject `"25"`. Alternatively use `z.coerce.number()` in the schema.

## The same schema on the server

```javascript
'use server';
import { signupSchema } from './schemas.js';
export async function signup(previousState, formData) {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  await createAccount(parsed.data);
  return { success: true };
}
```

This is the real payoff. Identical rules on both sides, imported from one file. Change the minimum password length once and both change.

Client validation is for fast feedback. **Server validation is the one that counts**, because anyone can bypass the browser. With a shared schema you get both for the price of one.

`flatten()` gives a shape that is easy to render:

```javascript
{
  formErrors: [],
  fieldErrors: { email: ['That does not look like an email'] }
}
```

## Types for free

```typescript
import { z } from 'zod';
export const signupSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  age: z.number().int().min(18)
});
export type SignupData = z.infer<typeof signupSchema>;
```

`z.infer` derives the TypeScript type from the schema. There is no separate interface to keep in step, so the type can never disagree with the validation.

## Validating API responses

Do not trust data just because it came from your own API.

```javascript
const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  tags: z.array(z.string()).default([])
});
async function getProduct(id) {
  const response = await fetch(`/api/products/${id}`);
  if (!response.ok) throw new Error('Request failed');
  const json = await response.json();
  return productSchema.parse(json);
}
```

If the API changes shape, you get a clear error at the boundary naming the field, instead of `Cannot read properties of undefined` three components deep.

## Useful pieces

```javascript
z.string().optional();
z.string().nullable();
z.string().default('none');
z.enum(['draft', 'published', 'archived']);
z.array(z.string()).min(1, 'Choose at least one');
z.object({ address: z.object({ city: z.string() }) });
z.union([z.string(), z.number()]);
z.coerce.number();
z.string().transform((s) => s.trim().toLowerCase());
```

Composing schemas:

```javascript
const baseUser = z.object({ name: z.string(), email: z.string().email() });
const createUser = baseUser.extend({ password: z.string().min(8) });
const updateUser = baseUser.partial();
const publicUser = baseUser.omit({ email: true });
```

`partial()` makes every field optional, which is exactly what a PATCH endpoint wants.

## The alternatives

**Yup** is older and similar, and very common in existing React projects.

**Valibot** has the same idea with a much smaller bundle, built around tree shaking.

**ArkType** and **TypeBox** are alternatives with different trade offs.

Zod is the most widely used and has the best ecosystem support. Any of them beats hand written validation.

## Quick recap

- One schema serves form validation, API parsing and TypeScript types.
- `safeParse` returns a result, `parse` throws.
- Parsed data is cleaned, with defaults applied and unknown keys removed.
- `zodResolver` connects a schema to React Hook Form.
- Number inputs need `valueAsNumber` or `z.coerce.number()`.
- Share the same schema with the server, which is the validation that counts.
- `z.infer` derives the type, so it can never drift.
- Validate API responses so errors surface at the boundary.

<code id="code-content" class="language-typescript">
import { z } from 'zod';
// ONE schema, used for the form, the server and the types.
export const signupSchema = z
  .object({
    username: z
      .string()
      .min(3, 'At least 3 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
    email: z.string().email('That does not look like an email'),
    // Inputs always give strings, so coerce, or use valueAsNumber
    age: z.coerce.number().int().min(18, 'You must be 18 or older'),
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
    newsletter: z.boolean().default(false)
  })
  // refine validates ACROSS fields, and path puts the error on the right one
  .refine((data) =&gt; data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });
// The type is DERIVED, so it can never disagree with the validation
export type SignupData = z.infer&lt;typeof signupSchema&gt;;
// ---------- The form: no rules on register at all ----------
// import { useForm } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';
// const { register, handleSubmit, formState: { errors } } = useForm({
//   resolver: zodResolver(signupSchema),
//   mode: 'onTouched'
// });
// &lt;input {...register('username')} /&gt;
// {errors.username &amp;&amp; &lt;p&gt;{errors.username.message}&lt;/p&gt;}
// ---------- The server: the SAME schema, imported ----------
// 'use server';
// export async function signup(previousState, formData) {
//   const parsed = signupSchema.safeParse(Object.fromEntries(formData));
//   if (!parsed.success) {
//     return { errors: parsed.error.flatten().fieldErrors };
//   }
//   await createAccount(parsed.data);   cleaned, defaults applied
//   return { success: true };
// }
// Client validation is for fast feedback. SERVER validation is the one
// that counts, because anyone can bypass the browser.
// ---------- Validate API responses too ----------
const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  tags: z.array(z.string()).default([])
});
export async function getProduct(id: string) {
  const response = await fetch('/api/products/' + id);
  if (!response.ok) throw new Error('Request failed');
  // A clear error at the boundary naming the field, instead of
  // "Cannot read properties of undefined" three components deep
  return productSchema.parse(await response.json());
}
// ---------- Compose rather than repeat ----------
const baseUser = z.object({ name: z.string(), email: z.string().email() });
const createUser = baseUser.extend({ password: z.string().min(8) });
const updateUser = baseUser.partial();        // every field optional, for PATCH
const publicUser = baseUser.omit({ email: true });
</code></pre>
