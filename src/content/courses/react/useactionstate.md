---
publishDate: 2026-05-11T09:31
title: useActionState
slug: useactionstate
metadescription: Handle form submission, validation errors and pending state with one hook, replacing most manual form boilerplate.
updateDate: 2026-09-05T09:31
author: ['bishal-biswas']
level: 2
tags: ['actions', 'forms', 'react-19']
course: react
---

## What it does

`useActionState` runs an action and gives you back its result, plus a pending flag. It is the React 19 answer to form state.

```javascript
import { useActionState } from 'react';
function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitAction, null);
  async function submitAction(previousState, formData) {
    const email = formData.get('email');
    if (!email.includes('@')) {
      return { error: 'That does not look like an email' };
    }
    await sendMessage(email);
    return { success: true };
  }
  return (
    <form action={formAction}>
      <input name="email" type="email" />
      <button disabled={isPending}>{isPending ? 'Sending...' : 'Send'}</button>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.success && <p>Message sent.</p>}
    </form>
  );
}
```

Three return values:

- **`state`**: whatever your action returned last time.
- **`formAction`**: pass this to `<form action={...}>`.
- **`isPending`**: true while the action runs.

And the action itself receives two arguments: the **previous state** and the **form data**.

## The previous state argument

That first parameter catches people out. Your action is called with the previous result, not just the form data.

```javascript
async function submitAction(previousState, formData) {
}
```

It is genuinely useful for things like counting attempts:

```javascript
async function loginAction(previousState, formData) {
  const attempts = (previousState?.attempts ?? 0) + 1;
  const result = await login(formData.get('email'), formData.get('password'));
  if (!result.ok) {
    return {
      attempts,
      error: attempts >= 3 ? 'Too many attempts. Try again later.' : 'Wrong password'
    };
  }
  return { success: true };
}
```

If you do not need it, name it `_previousState` or just ignore it.

## Returning errors instead of throwing

This is the important distinction from plain Actions.

**Throwing** sends the error to an error boundary, which replaces the whole component. That is right for unexpected failures.

**Returning** an error keeps the form on screen with a message next to the field. That is right for validation.

```javascript
async function signupAction(previousState, formData) {
  const email = formData.get('email');
  const password = formData.get('password');
  const errors = {};
  if (!email?.includes('@')) errors.email = 'A valid email is required';
  if (!password || password.length < 8) errors.password = 'At least 8 characters';
  if (Object.keys(errors).length > 0) {
    return { errors, values: { email } };
  }
  try {
    await createAccount(email, password);
  } catch (error) {
    return { errors: { form: error.message }, values: { email } };
  }
  return { success: true };
}
```

Note that the returned state includes `values`. On a failed submit, React resets uncontrolled inputs, so returning the entered values lets you refill them:

```javascript
<input name="email" defaultValue={state?.values?.email ?? ''} />
```

Without that, users retype everything after a validation error, which is infuriating.

## The full picture

```javascript
function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, null);
  return (
    <form action={formAction}>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" defaultValue={state?.values?.email ?? ''} />
        {state?.errors?.email && <p className="error">{state.errors.email}</p>}
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" />
        {state?.errors?.password && <p className="error">{state.errors.password}</p>}
      </div>
      {state?.errors?.form && <p className="error">{state.errors.form}</p>}
      <button disabled={isPending}>
        {isPending ? 'Creating account...' : 'Sign up'}
      </button>
      {state?.success && <p>Account created.</p>}
    </form>
  );
}
```

Compare that with the `useState` version from the forms topic: no `isSubmitting` state, no `errors` state, no `preventDefault`, no try/catch/finally in the component.

## Not just forms

`useActionState` works with any action, not only form submissions.

```javascript
function LikeButton({ postId, initialLikes }) {
  const [likes, likeAction, isPending] = useActionState(
    async (currentLikes) => {
      await likePost(postId);
      return currentLikes + 1;
    },
    initialLikes
  );
  return (
    <form action={likeAction}>
      <button disabled={isPending}>Likes: {likes}</button>
    </form>
  );
}
```

Here the state is just a number and there is no form data at all.

## Uncontrolled inputs are the point

Notice these forms use `name` and `defaultValue`, not `value` and `onChange`. There is no `useState` per field.

That is deliberate. `FormData` reads the values on submit, so React does not need to track every keystroke. Fewer renders, less code.

Use controlled inputs only when you genuinely need to react as the user types.

## Resetting

```javascript
<form action={formAction}>
```

React resets the form after a **successful** submission of uncontrolled inputs. If you need to keep the values, return them in the state and set `defaultValue`, as above.

To reset manually:

```javascript
<button type="reset">Clear</button>
```

## With Server Functions

`useActionState` was designed to pair with Server Functions, so the same code works whether the action runs in the browser or on the server.

```javascript
'use server';
export async function updateProfile(previousState, formData) {
  const name = formData.get('name');
  await db.users.update({ name });
  return { success: true };
}
```

```javascript
import { updateProfile } from './actions.js';
function ProfileForm() {
  const [state, formAction, isPending] = useActionState(updateProfile, null);
  return <form action={formAction}>...</form>;
}
```

That works without JavaScript loaded, because the form falls back to a plain HTML submission. Server Functions have their own topic later.

## Quick recap

- `useActionState(action, initialState)` returns state, a form action and a pending flag.
- The action receives the previous state first, then the form data.
- Return errors for validation, throw for unexpected failures.
- Return the submitted values so you can refill the form after an error.
- It replaces the pending, error and submit handler boilerplate entirely.
- It works with any action, not only forms.
- Uncontrolled inputs with `name` are the intended style.

<code id="code-content" class="language-javascript">
import { useActionState } from 'react';
// The action receives the PREVIOUS STATE first, then the FormData.
// Return errors for validation. Throw only for unexpected failures,
// which go to an error boundary and replace the whole component.
async function signupAction(previousState, formData) {
  const email = formData.get('email');
  const password = formData.get('password');
  const errors = {};
  if (!email?.includes('@')) errors.email = 'A valid email is required';
  if (!password || password.length &lt; 8) errors.password = 'At least 8 characters';
  if (Object.keys(errors).length &gt; 0) {
    // Return the values too. React resets uncontrolled inputs on submit,
    // so without this the user retypes everything after one typo.
    return { errors, values: { email } };
  }
  try {
    await createAccount(email, password);
  } catch (error) {
    return { errors: { form: error.message }, values: { email } };
  }
  return { success: true };
}
export default function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, null);
  return (
    &lt;form action={formAction}&gt;
      {/* Uncontrolled inputs with name, not value plus onChange.
          FormData reads them on submit, so no state per field. */}
      &lt;label htmlFor="email"&gt;Email&lt;/label&gt;
      &lt;input id="email" name="email" defaultValue={state?.values?.email ?? ''} /&gt;
      {state?.errors?.email &amp;&amp; &lt;p className="error"&gt;{state.errors.email}&lt;/p&gt;}
      &lt;label htmlFor="password"&gt;Password&lt;/label&gt;
      &lt;input id="password" name="password" type="password" /&gt;
      {state?.errors?.password &amp;&amp; &lt;p className="error"&gt;{state.errors.password}&lt;/p&gt;}
      {state?.errors?.form &amp;&amp; &lt;p className="error"&gt;{state.errors.form}&lt;/p&gt;}
      &lt;button disabled={isPending}&gt;
        {isPending ? 'Creating account...' : 'Sign up'}
      &lt;/button&gt;
      {state?.success &amp;&amp; &lt;p&gt;Account created.&lt;/p&gt;}
    &lt;/form&gt;
  );
}
// The previous state is genuinely useful, for example to count attempts
async function loginAction(previousState, formData) {
  const attempts = (previousState?.attempts ?? 0) + 1;
  const result = await login(formData.get('email'), formData.get('password'));
  if (!result.ok) {
    return {
      attempts,
      error: attempts &gt;= 3 ? 'Too many attempts, try later' : 'Wrong password'
    };
  }
  return { success: true };
}
// It works with any action, not only forms. Here the state is a number
// and there is no form data at all.
function LikeButton({ postId, initialLikes }) {
  const [likes, likeAction, isPending] = useActionState(async (current) =&gt; {
    await likePost(postId);
    return current + 1;
  }, initialLikes);
  return (
    &lt;form action={likeAction}&gt;
      &lt;button disabled={isPending}&gt;Likes: {likes}&lt;/button&gt;
    &lt;/form&gt;
  );
}
</code></pre>
