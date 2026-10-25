---
publishDate: 2026-05-11T09:32
title: Form Actions and useFormStatus
slug: form-actions-and-useformstatus
metadescription: Pass a function straight to a form, and let nested components read the submission state without prop drilling.
updateDate: 2026-09-05T09:32
author: ['bishal-biswas']
level: 2
tags: ['forms', 'actions', 'react-19']
course: react
---

## Form actions

In React 19, `<form>` accepts a function in its `action` prop.

```javascript
function NewsletterForm() {
  async function subscribe(formData) {
    const email = formData.get('email');
    await subscribeToNewsletter(email);
  }
  return (
    <form action={subscribe}>
      <input name="email" type="email" required />
      <button type="submit">Subscribe</button>
    </form>
  );
}
```

React does four things for you:

1. Calls `preventDefault()` so the page does not reload.
2. Builds a `FormData` from the fields and passes it in.
3. Wraps the call in a transition.
4. Resets uncontrolled fields after a successful submit.

No `onSubmit`, no event object, no manual `FormData`.

## Reading the fields

```javascript
async function submit(formData) {
  const email = formData.get('email');
  const tags = formData.getAll('tags');
  const agreed = formData.get('agreed') === 'on';
  const all = Object.fromEntries(formData);
}
```

Every field needs a `name`. A field without one is invisible to `FormData`, which is the most common reason a value comes back `null`.

Checkboxes are worth noting: an unchecked box sends nothing at all, so `formData.get('agreed')` is `null` rather than `false`.

## Buttons can have their own action

```javascript
function PostActions({ postId }) {
  async function publish() {
    await setStatus(postId, 'published');
  }
  async function archive() {
    await setStatus(postId, 'archived');
  }
  return (
    <form>
      <button formAction={publish}>Publish</button>
      <button formAction={archive}>Archive</button>
    </form>
  );
}
```

`formAction` on a button overrides the form's action. Two buttons, two different outcomes, one form.

## useFormStatus

Here is the part that makes form actions genuinely better than the old approach.

```javascript
import { useFormStatus } from 'react-dom';
function SubmitButton({ children }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Working...' : children}
    </button>
  );
}
function ContactForm() {
  return (
    <form action={submitAction}>
      <input name="email" />
      <SubmitButton>Send</SubmitButton>
    </form>
  );
}
```

`SubmitButton` knows the form is submitting **without receiving a single prop**. No `isPending` threaded down, no context to set up.

Write it once and reuse it in every form in the application.

## The one rule

`useFormStatus` reads the status of the form **above** it in the tree. It must be in a child component, not in the component rendering the form.

```javascript
function Broken() {
  const { pending } = useFormStatus();
  return (
    <form action={submit}>
      <button disabled={pending}>Send</button>
    </form>
  );
}
```

That returns `pending: false` forever, because there is no form above this component. Extract the button into its own component.

Note also that it is imported from **`react-dom`**, not `react`. That trips people up.

## What it returns

```javascript
const { pending, data, method, action } = useFormStatus();
```

- **`pending`**: whether a submission is in flight.
- **`data`**: the `FormData` being submitted.
- **`method`**: `'get'` or `'post'`.
- **`action`**: the function being run.

`data` lets you show what is being submitted:

```javascript
function SubmitStatus() {
  const { pending, data } = useFormStatus();
  if (!pending) return null;
  return <p>Sending to {data?.get('email')}...</p>;
}
```

## Disabling the whole form

```javascript
function FormFields() {
  const { pending } = useFormStatus();
  return (
    <fieldset disabled={pending}>
      <input name="email" />
      <textarea name="message" />
    </fieldset>
  );
}
```

A `<fieldset disabled>` disables every control inside it. One attribute instead of a `disabled` prop on each field.

## Combining with useActionState

The two work together, and this is the pattern to reach for.

```javascript
function ContactForm() {
  const [state, formAction] = useActionState(submitAction, null);
  return (
    <form action={formAction}>
      <FormFields />
      {state?.error && <p className="error">{state.error}</p>}
      <SubmitButton>Send</SubmitButton>
    </form>
  );
}
```

`useActionState` handles the result and errors at the top. `useFormStatus` handles pending state wherever it is needed. Neither requires prop drilling.

## Progressive enhancement

If your action is a Server Function, the form works before JavaScript has loaded. The browser submits it normally, the server handles it, and the page updates. Once React hydrates, submissions become client side and stay on the page.

This is only possible because you passed a function to `action` rather than intercepting `onSubmit`. A form with `onSubmit` is inert until JavaScript runs.

## When not to use form actions

Controlled inputs with live validation still work better with regular state and `onChange`. Form actions shine when:

- The form is mostly uncontrolled.
- You want the values on submit rather than per keystroke.
- You care about working without JavaScript.

For a search box that filters as you type, keep using `useState`.

## Quick recap

- `<form action={fn}>` handles preventDefault, FormData, transitions and reset.
- Every field needs a `name`, and an unchecked checkbox sends nothing.
- `formAction` on a button overrides the form's action.
- `useFormStatus` reads pending state from the form above it.
- It comes from `react-dom`, and must be used in a child of the form.
- `<fieldset disabled>` disables every control at once.
- Pair it with `useActionState` for errors and results.
- Server Function actions work before JavaScript loads.

<code id="code-content" class="language-javascript">
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';   // note: react-dom, not react
// A reusable submit button that knows the form is busy WITHOUT any props.
// It must be a CHILD of the form, never the component rendering it.
function SubmitButton({ children }) {
  const { pending, data } = useFormStatus();
  return (
    &lt;button type="submit" disabled={pending}&gt;
      {pending ? 'Sending to ' + (data?.get('email') ?? '') + '...' : children}
    &lt;/button&gt;
  );
}
// A fieldset disables every control inside it with one attribute
function FormFields({ defaults }) {
  const { pending } = useFormStatus();
  return (
    &lt;fieldset disabled={pending}&gt;
      &lt;label htmlFor="email"&gt;Email&lt;/label&gt;
      &lt;input id="email" name="email" type="email" defaultValue={defaults?.email ?? ''} required /&gt;
      &lt;label htmlFor="message"&gt;Message&lt;/label&gt;
      &lt;textarea id="message" name="message" /&gt;
      &lt;label&gt;
        &lt;input name="agreed" type="checkbox" /&gt;
        Subscribe to updates
      &lt;/label&gt;
    &lt;/fieldset&gt;
  );
}
async function submitAction(previousState, formData) {
  const email = formData.get('email');
  // An UNCHECKED checkbox sends nothing at all, so this is null, not false
  const agreed = formData.get('agreed') === 'on';
  if (!email?.includes('@')) {
    return { error: 'A valid email is required', values: { email } };
  }
  await sendMessage({ email, agreed, message: formData.get('message') });
  return { success: true };
}
export default function ContactForm() {
  const [state, formAction] = useActionState(submitAction, null);
  return (
    // React calls preventDefault, builds the FormData, wraps it in a
    // transition, and resets uncontrolled fields on success
    &lt;form action={formAction}&gt;
      &lt;FormFields defaults={state?.values} /&gt;
      {state?.error &amp;&amp; &lt;p className="error"&gt;{state.error}&lt;/p&gt;}
      {state?.success &amp;&amp; &lt;p&gt;Thanks, message sent.&lt;/p&gt;}
      &lt;SubmitButton&gt;Send&lt;/SubmitButton&gt;
    &lt;/form&gt;
  );
}
// A button can override the form's action, so one form can do two things
function PostActions({ postId }) {
  return (
    &lt;form&gt;
      &lt;button formAction={async () =&gt; await setStatus(postId, 'published')}&gt;
        Publish
      &lt;/button&gt;
      &lt;button formAction={async () =&gt; await setStatus(postId, 'archived')}&gt;
        Archive
      &lt;/button&gt;
    &lt;/form&gt;
  );
}
</code></pre>
