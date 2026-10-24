---
publishDate: 2026-05-10T09:29
title: Actions and Async Transitions
slug: actions-and-async-transitions
metadescription: React 19 Actions handle pending state, errors and optimistic updates for async work, replacing a pile of manual boilerplate.
updateDate: 2026-09-05T09:29
author: ['bishal-biswas']
level: 2
tags: ['actions', 'async', 'react-19']
course: react
---

## The boilerplate Actions remove

Every async submission ends up looking like this.

```javascript
function UpdateName() {
  const [name, setName] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);
  async function handleSubmit(event) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    try {
      await updateName(name);
      redirect('/profile');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsPending(false);
    }
  }
  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button disabled={isPending}>Save</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

Three pieces of state, a try/catch/finally, and a manual disabled flag. Every form in the codebase repeats it, and everyone forgets a piece somewhere.

## What an Action is

In React 19, a function passed to a transition is called an **Action**. React handles the pending state, error handling and ordering for you.

```javascript
import { useTransition } from 'react';
function UpdateName() {
  const [name, setName] = useState('');
  const [isPending, startTransition] = useTransition();
  function handleSubmit(event) {
    event.preventDefault();
    startTransition(async () => {
      await updateName(name);
      redirect('/profile');
    });
  }
  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button disabled={isPending}>Save</button>
    </form>
  );
}
```

The key change from React 18 is that `startTransition` now accepts an **async** function. React keeps `isPending` true for the whole duration, including the awaits.

## What React does for you

When you pass an async function to `startTransition`:

- **`isPending` is true** from the moment it starts until it finishes.
- **State updates inside are batched** and applied as one transition.
- **Errors propagate** to the nearest error boundary.
- **Updates stay ordered**, so a slow first request cannot overwrite a fast second one.

That last point is a real race condition fix you would otherwise write by hand.

## Transitions keep the UI responsive

A transition tells React that an update is not urgent.

```javascript
function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();
  function handleChange(event) {
    setQuery(event.target.value);
    startTransition(() => {
      setResults(computeExpensiveResults(event.target.value));
    });
  }
  return (
    <div>
      <input value={query} onChange={handleChange} />
      {isPending && <Spinner />}
      <ResultList results={results} />
    </div>
  );
}
```

`setQuery` is urgent, so typing stays instant. `setResults` is a transition, so React can interrupt it when the next keystroke arrives. Without this, typing feels laggy while the list recalculates.

## Actions in forms

React 19 lets a `<form>` take a function directly.

```javascript
function ContactForm() {
  async function submitAction(formData) {
    const email = formData.get('email');
    await sendMessage(email);
  }
  return (
    <form action={submitAction}>
      <input name="email" type="email" />
      <button type="submit">Send</button>
    </form>
  );
}
```

React calls your function with the `FormData`, and automatically:

- Prevents the default submission, so no `event.preventDefault()`.
- Wraps the call in a transition.
- Resets the form on success for uncontrolled inputs.

The form action topic goes deeper on this shortly.

## Where the error goes

```javascript
function DeleteButton({ id }) {
  const [isPending, startTransition] = useTransition();
  function handleClick() {
    startTransition(async () => {
      await deleteItem(id);
    });
  }
  return <button onClick={handleClick} disabled={isPending}>Delete</button>;
}
```

If `deleteItem` rejects, the error reaches the nearest error boundary and shows your fallback UI.

That is fine for unexpected failures. For expected ones, such as validation, you want the error next to the field instead. `useActionState` handles that, and it is the next topic.

## The rules

**Call `startTransition` synchronously.**

```javascript
async function handleClick() {
  const data = await fetchData();
  startTransition(() => setData(data));
}
function handleClick() {
  startTransition(async () => {
    const data = await fetchData();
    setData(data);
  });
}
```

Awaiting before calling it means React never sees the loading period.

**Do not put controlled input updates in a transition.**

```javascript
startTransition(() => setQuery(event.target.value));
```

Transitions can be interrupted, so typing would feel unresponsive. Keep input state urgent and put the expensive consequence in the transition.

**Transitions do not work for everything.** They cover state updates. They cannot make a slow network request faster, only keep the interface responsive while it happens.

## Async transitions versus a plain async handler

```javascript
async function handleSubmit() {
  setIsPending(true);
  await save();
  setIsPending(false);
}
function handleSubmit() {
  startTransition(async () => {
    await save();
  });
}
```

Both work. The transition version gives you ordering guarantees, automatic error routing, and one less piece of state. On a form it also composes with `useFormStatus`, so nested components can read the pending state without you passing it down.

## Quick recap

- An Action is an async function passed to a transition.
- React 19 lets `startTransition` take an async function.
- You get `isPending`, batching, error routing and ordering for free.
- Transitions mark updates as non urgent so the interface stays responsive.
- `<form action={fn}>` wraps submission in an Action automatically.
- Call `startTransition` synchronously, before any await.
- Never put controlled input state inside a transition.

<code id="code-content" class="language-javascript">
import { useState, useTransition } from 'react';
// BEFORE: three pieces of state and a try/catch/finally in every form
function TheOldWay() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);
  async function handleSubmit(event) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    try {
      await save();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsPending(false);
    }
  }
  return null;
}
// AFTER: React 19 lets startTransition take an async function, and keeps
// isPending true across every await
function UpdateName() {
  const [name, setName] = useState('');
  const [isPending, startTransition] = useTransition();
  function handleSubmit(event) {
    event.preventDefault();
    // Call startTransition SYNCHRONOUSLY. Awaiting first means React
    // never sees the loading period at all.
    startTransition(async () =&gt; {
      await updateName(name);
      redirect('/profile');
    });
  }
  return (
    &lt;form onSubmit={handleSubmit}&gt;
      &lt;input value={name} onChange={(e) =&gt; setName(e.target.value)} /&gt;
      &lt;button disabled={isPending}&gt;{isPending ? 'Saving...' : 'Save'}&lt;/button&gt;
    &lt;/form&gt;
  );
}
// Transitions mark an update as NOT urgent, so typing stays instant
// while the expensive list recalculates in the background
function SearchPage({ allItems }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(allItems);
  const [isPending, startTransition] = useTransition();
  function handleChange(event) {
    const next = event.target.value;
    setQuery(next);                   // urgent: the input must feel instant
    startTransition(() =&gt; {           // not urgent: interruptible
      setResults(allItems.filter((i) =&gt; i.name.includes(next)));
    });
  }
  return (
    &lt;div&gt;
      &lt;input value={query} onChange={handleChange} /&gt;
      {isPending &amp;&amp; &lt;span&gt;Updating...&lt;/span&gt;}
      &lt;ul&gt;{results.map((i) =&gt; &lt;li key={i.id}&gt;{i.name}&lt;/li&gt;)}&lt;/ul&gt;
    &lt;/div&gt;
  );
}
// A form action: React calls your function with the FormData, prevents
// the default submission, and wraps it in a transition for you
export default function ContactForm() {
  async function submitAction(formData) {
    await sendMessage(formData.get('email'), formData.get('message'));
  }
  return (
    &lt;form action={submitAction}&gt;
      &lt;input name="email" type="email" /&gt;
      &lt;textarea name="message" /&gt;
      &lt;button type="submit"&gt;Send&lt;/button&gt;
    &lt;/form&gt;
  );
}
// NEVER put controlled input state in a transition. Transitions can be
// interrupted, so the field would feel laggy:
//   startTransition(() =&gt; setQuery(event.target.value));   wrong
</code></pre>
