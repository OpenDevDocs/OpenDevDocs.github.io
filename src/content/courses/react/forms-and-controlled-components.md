---
publishDate: 2026-05-06T09:15
title: Forms and Controlled Components
slug: forms-and-controlled-components
metadescription: Build forms in React with controlled inputs, handle every field type, validate input and know when uncontrolled forms are simpler.
updateDate: 2026-09-05T09:15
author: ['bishal-biswas']
level: 1
tags: ['forms', 'state', 'basics']
course: react
---

## Controlled inputs

A **controlled** input takes its value from state, and reports changes back to state.

```javascript
import { useState } from 'react';
function NameField() {
  const [name, setName] = useState('');
  return (
    <input
      value={name}
      onChange={(event) => setName(event.target.value)}
    />
  );
}
```

Two halves make the loop:

- `value={name}` tells the input what to show.
- `onChange` updates the state, which re-renders and updates the input.

State is the single source of truth. The input just displays it.

## The read only trap

```javascript
<input value={name} />
```

Give an input a `value` with no `onChange` and typing does nothing, with a console warning. React is holding the value fixed and you never gave it a way to change.

If you genuinely want a fixed value, say so:

```javascript
<input value={name} readOnly />
```

And never use `undefined` as a value:

```javascript
const [name, setName] = useState();
<input value={name} onChange={...} />
```

Starting as `undefined` makes the input **uncontrolled**, then controlled once you type, and React warns about the switch. Always start with `''`.

## Every input type

### Text, email, password, number

```javascript
<input type="text" value={text} onChange={(e) => setText(e.target.value)} />
<input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
```

Note that `type="number"` still gives you a **string** in `event.target.value`. Convert it if you need maths:

```javascript
<input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} />
```

### Textarea

```javascript
<textarea value={message} onChange={(e) => setMessage(e.target.value)} />
```

In HTML the text goes between the tags. In React it is a `value` prop like any other input.

### Select

```javascript
<select value={city} onChange={(e) => setCity(e.target.value)}>
  <option value="">Choose...</option>
  <option value="pune">Pune</option>
  <option value="delhi">Delhi</option>
</select>
```

The `value` goes on the `<select>`, not `selected` on an option.

### Checkbox

```javascript
<input
  type="checkbox"
  checked={agreed}
  onChange={(e) => setAgreed(e.target.checked)}
/>
```

Two differences: use `checked` rather than `value`, and read `event.target.checked` rather than `.value`.

### Radio group

```javascript
<label>
  <input
    type="radio"
    name="plan"
    value="free"
    checked={plan === 'free'}
    onChange={(e) => setPlan(e.target.value)}
  />
  Free
</label>
```

Every radio in the group shares a `name`, and `checked` compares against your state.

## One handler for a whole form

Adding a `useState` per field gets tedious. Use one object.

```javascript
function SignupForm() {
  const [form, setForm] = useState({ name: '', email: '', agreed: false });
  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value
    }));
  }
  return (
    <form>
      <input name="name" value={form.name} onChange={handleChange} />
      <input name="email" value={form.email} onChange={handleChange} />
      <input name="agreed" type="checkbox" checked={form.agreed} onChange={handleChange} />
    </form>
  );
}
```

`[name]: value` is a computed key, using the input's `name` attribute to decide which field to update. One handler covers the whole form.

Note the updater function and the spread. You must copy the previous object, not mutate it.

## Submitting

```javascript
function handleSubmit(event) {
  event.preventDefault();
  console.log(form);
}
<form onSubmit={handleSubmit}>
```

Always `preventDefault`, or the page reloads.

## Validation

```javascript
function SignupForm() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  function validate(values) {
    const found = {};
    if (!values.email.trim()) {
      found.email = 'Email is required';
    } else if (!values.email.includes('@')) {
      found.email = 'That does not look like an email';
    }
    if (values.password.length < 8) {
      found.password = 'Password must be at least 8 characters';
    }
    return found;
  }
  function handleSubmit(event) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      console.log('Valid, submitting', form);
    }
  }
  return (
    <form onSubmit={handleSubmit} noValidate>
      <input name="email" value={form.email} onChange={handleChange} />
      {errors.email && <p className="error">{errors.email}</p>}
      <button type="submit">Sign up</button>
    </form>
  );
}
```

Validate on submit first. Validating on every keystroke shows an error before the user has finished typing the first character, which feels hostile. A common compromise is to validate on blur, then on every change once a field has already errored.

> Client side validation is for user experience only. The server must validate again, because anyone can bypass the browser.

## Disabling while submitting

```javascript
const [isSubmitting, setIsSubmitting] = useState(false);
async function handleSubmit(event) {
  event.preventDefault();
  setIsSubmitting(true);
  try {
    await sendToServer(form);
  } finally {
    setIsSubmitting(false);
  }
}
<button type="submit" disabled={isSubmitting}>
  {isSubmitting ? 'Sending...' : 'Send'}
</button>
```

Without this, an impatient user double clicks and you create two records. React 19 has `useFormStatus` and Actions that handle this pattern for you, covered later in the course.

## Uncontrolled forms

Not every form needs state.

```javascript
function ContactForm() {
  function handleSubmit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    console.log(data);
  }
  return (
    <form onSubmit={handleSubmit}>
      <input name="email" defaultValue="" />
      <input name="message" />
      <button type="submit">Send</button>
    </form>
  );
}
```

The DOM keeps the values and you read them on submit. Note `defaultValue` rather than `value`, which sets the starting value without taking control.

**Use uncontrolled when** you only need the values on submit, and there is no live validation or dependent field.

**Use controlled when** you need to react as the user types: live search, character counters, enabling a button, or one field depending on another.

## Quick recap

- A controlled input pairs `value` with `onChange`, and state is the truth.
- `value` without `onChange` makes the field read only, so always pair them.
- Start text state as `''`, never `undefined`.
- Checkboxes use `checked` and `event.target.checked`.
- One handler plus computed keys handles a whole form object.
- Always `preventDefault` on submit.
- Validate on submit, and always again on the server.
- Disable the button while submitting to prevent duplicates.
- Uncontrolled forms with `FormData` are simpler when you only need values at the end.

<code id="code-content" class="language-javascript">
import { useState } from 'react';
export default function SignupForm() {
  const [form, setForm] = useState({ name: '', email: '', plan: 'free', agreed: false });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // One handler for every field, using the input's name as a computed key
  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((previous) =&gt; ({
      ...previous,                                  // copy, never mutate
      [name]: type === 'checkbox' ? checked : value
    }));
  }
  function validate(values) {
    const found = {};
    if (!values.name.trim()) found.name = 'Name is required';
    if (!values.email.includes('@')) found.email = 'That does not look like an email';
    if (!values.agreed) found.agreed = 'Please accept the terms';
    return found;
  }
  async function handleSubmit(event) {
    event.preventDefault();                         // or the page reloads
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length &gt; 0) return;
    setIsSubmitting(true);                          // stop double submits
    try {
      console.log('Submitting', form);
    } finally {
      setIsSubmitting(false);
    }
  }
  return (
    &lt;form onSubmit={handleSubmit} noValidate&gt;
      {/* Text: value + onChange, and start the state as '' not undefined */}
      &lt;input name="name" value={form.name} onChange={handleChange} /&gt;
      {errors.name &amp;&amp; &lt;p className="error"&gt;{errors.name}&lt;/p&gt;}
      &lt;input name="email" type="email" value={form.email} onChange={handleChange} /&gt;
      {errors.email &amp;&amp; &lt;p className="error"&gt;{errors.email}&lt;/p&gt;}
      {/* Select: value goes on the select, not selected on an option */}
      &lt;select name="plan" value={form.plan} onChange={handleChange}&gt;
        &lt;option value="free"&gt;Free&lt;/option&gt;
        &lt;option value="pro"&gt;Pro&lt;/option&gt;
      &lt;/select&gt;
      {/* Checkbox: checked, not value, and read event.target.checked */}
      &lt;label&gt;
        &lt;input
          name="agreed"
          type="checkbox"
          checked={form.agreed}
          onChange={handleChange}
        /&gt;
        I accept the terms
      &lt;/label&gt;
      {errors.agreed &amp;&amp; &lt;p className="error"&gt;{errors.agreed}&lt;/p&gt;}
      &lt;button type="submit" disabled={isSubmitting}&gt;
        {isSubmitting ? 'Sending...' : 'Sign up'}
      &lt;/button&gt;
    &lt;/form&gt;
  );
}
// When you only need the values at the end, skip state entirely:
// function handleSubmit(event) {
//   event.preventDefault();
//   const data = Object.fromEntries(new FormData(event.target));
// }
</code></pre>
