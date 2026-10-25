---
publishDate: 2026-05-23T10:06
title: Forms with React Hook Form
slug: forms-with-react-hook-form
metadescription: Build complex forms with minimal re-renders, built in validation, and far less code than controlled inputs.
updateDate: 2026-09-05T10:06
author: ['bishal-biswas']
level: 3
tags: ['forms', 'validation']
course: react
---

## The problem with controlled forms

```javascript
function SignupForm() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
}
```

Four pieces of state, and **every keystroke re-renders the whole form**. With ten fields and a live validation summary, typing starts to feel heavy.

React Hook Form takes a different approach: keep the values in uncontrolled inputs, subscribe only where needed, and re-render as little as possible.

## The basics

```bash
npm install react-hook-form
```

```javascript
import { useForm } from 'react-hook-form';
function SignupForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm();
  async function onSubmit(data) {
    await createAccount(data);
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name', { required: 'Name is required' })} />
      {errors.name && <p className="error">{errors.name.message}</p>}
      <input
        type="email"
        {...register('email', {
          required: 'Email is required',
          pattern: { value: /\S+@\S+\.\S+/, message: 'That does not look like an email' }
        })}
      />
      {errors.email && <p className="error">{errors.email.message}</p>}
      <button disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Sign up'}
      </button>
    </form>
  );
}
```

No `useState`, no `onChange`, no `preventDefault`. `register` connects an input by name, and `handleSubmit` validates before calling your function with clean data.

## Why it is fast

`register` uses refs, so the value lives in the DOM. Typing does not set state, so nothing re-renders.

The form re-renders only when something you subscribed to changes, such as an error appearing or the submitting flag flipping.

For a form with twenty fields, that is the difference between hundreds of renders and a handful.

## Validation rules

```javascript
{...register('username', {
  required: 'Username is required',
  minLength: { value: 3, message: 'At least 3 characters' },
  maxLength: { value: 20, message: 'At most 20 characters' },
  pattern: { value: /^[a-zA-Z0-9_]+$/, message: 'Letters, numbers and underscores only' },
  validate: (value) => value !== 'admin' || 'That username is reserved'
})}
```

`validate` takes a function returning `true` or an error message. It can be async, which covers checking availability against a server:

```javascript
{...register('username', {
  validate: async (value) => {
    const taken = await checkUsername(value);
    return !taken || 'That username is already taken';
  }
})}
```

Comparing two fields:

```javascript
const { watch } = useForm();
<input
  type="password"
  {...register('confirmPassword', {
    validate: (value) => value === watch('password') || 'Passwords do not match'
  })}
/>
```

## When validation runs

```javascript
const { register } = useForm({ mode: 'onBlur' });
```

- **`onSubmit`** is the default. Nothing is validated until they submit.
- **`onBlur`** validates when a field loses focus.
- **`onChange`** validates on every keystroke.
- **`onTouched`** validates on blur, then on change afterwards.

`onTouched` is usually the best experience. The user is not told they are wrong before they have finished typing, but once a field has errored they get immediate feedback as they fix it.

## Watching values

```javascript
const { watch } = useForm();
const plan = watch('plan');
return (
  <div>
    <select {...register('plan')}>
      <option value="free">Free</option>
      <option value="pro">Pro</option>
    </select>
    {plan === 'pro' && <input {...register('cardNumber')} />}
  </div>
);
```

`watch` subscribes to a field, so the component re-renders when it changes. Use it only for the fields that actually drive the interface, since each one costs renders.

For reading a value without subscribing:

```javascript
const { getValues } = useForm();
function handleSomething() {
  const email = getValues('email');
}
```

## Dynamic fields

```javascript
import { useFieldArray } from 'react-hook-form';
function InvoiceForm() {
  const { register, control, handleSubmit } = useForm({
    defaultValues: { items: [{ name: '', price: 0 }] }
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {fields.map((field, index) => (
        <div key={field.id}>
          <input {...register(`items.${index}.name`)} />
          <input type="number" {...register(`items.${index}.price`)} />
          <button type="button" onClick={() => remove(index)}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => append({ name: '', price: 0 })}>
        Add item
      </button>
    </form>
  );
}
```

Note `key={field.id}`, not the index. `useFieldArray` provides a stable id for exactly the reason covered in the lists topic.

## Custom components

`register` needs a real input. For a third party select or date picker, use `Controller`:

```javascript
import { Controller } from 'react-hook-form';
<Controller
  name="country"
  control={control}
  rules={{ required: 'Please choose a country' }}
  render={({ field, fieldState }) => (
    <>
      <CustomSelect {...field} options={countries} />
      {fieldState.error && <p>{fieldState.error.message}</p>}
    </>
  )}
/>
```

`field` contains `value`, `onChange`, `onBlur`, `name` and `ref`, so spreading it usually connects a well behaved component.

## Server errors

```javascript
const { setError } = useForm();
async function onSubmit(data) {
  try {
    await createAccount(data);
  } catch (error) {
    if (error.field) {
      setError(error.field, { message: error.message });
    } else {
      setError('root', { message: 'Something went wrong' });
    }
  }
}
```

`setError('root', ...)` is for form level errors that do not belong to a field.

## With a schema

Rules on every field get repetitive, and they cannot be shared with the server. A schema library fixes both, which is the next topic.

## Quick recap

- Controlled forms re-render on every keystroke, which does not scale.
- React Hook Form keeps values in the DOM and subscribes narrowly.
- `register` connects an input, `handleSubmit` validates then calls you.
- `validate` accepts a function, including an async one.
- `mode: 'onTouched'` is usually the kindest validation timing.
- `watch` subscribes and costs renders, `getValues` does not.
- `useFieldArray` handles dynamic lists, with stable `field.id` keys.
- `Controller` wraps components that are not plain inputs.

<code id="code-content" class="language-javascript">
import { useForm, useFieldArray, Controller } from 'react-hook-form';
export default function SignupForm() {
  const {
    register,        // connects an input by name, using refs not state
    handleSubmit,    // validates, then calls your function with clean data
    control,         // for Controller and useFieldArray
    watch,           // subscribe to a field, costs a render
    getValues,       // read without subscribing
    setError,
    formState: { errors, isSubmitting }
  } = useForm({
    mode: 'onTouched',              // kindest timing: blur first, then live
    defaultValues: { plan: 'free', items: [{ name: '', price: 0 }] }
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const plan = watch('plan');       // drives the UI, so worth subscribing
  async function onSubmit(data) {
    try {
      await createAccount(data);
    } catch (error) {
      // Map a server error back onto the right field, or the form
      setError(error.field ?? 'root', { message: error.message });
    }
  }
  return (
    // No useState, no onChange, no preventDefault. Typing does not
    // re-render the form at all.
    &lt;form onSubmit={handleSubmit(onSubmit)}&gt;
      &lt;input
        {...register('username', {
          required: 'Username is required',
          minLength: { value: 3, message: 'At least 3 characters' },
          // validate can be async, so it can check the server
          validate: async (value) =&gt;
            (await isAvailable(value)) || 'That username is taken'
        })}
      /&gt;
      {errors.username &amp;&amp; &lt;p className="error"&gt;{errors.username.message}&lt;/p&gt;}
      &lt;input
        type="password"
        {...register('confirmPassword', {
          validate: (value) =&gt;
            value === watch('password') || 'Passwords do not match'
        })}
      /&gt;
      &lt;select {...register('plan')}&gt;
        &lt;option value="free"&gt;Free&lt;/option&gt;
        &lt;option value="pro"&gt;Pro&lt;/option&gt;
      &lt;/select&gt;
      {plan === 'pro' &amp;&amp; &lt;input {...register('cardNumber')} /&gt;}
      {/* Dynamic rows. key is field.id, NEVER the index. */}
      {fields.map((field, index) =&gt; (
        &lt;div key={field.id}&gt;
          &lt;input {...register('items.' + index + '.name')} /&gt;
          &lt;button type="button" onClick={() =&gt; remove(index)}&gt;Remove&lt;/button&gt;
        &lt;/div&gt;
      ))}
      &lt;button type="button" onClick={() =&gt; append({ name: '', price: 0 })}&gt;
        Add item
      &lt;/button&gt;
      {/* Controller wraps anything that is not a plain input */}
      &lt;Controller
        name="country"
        control={control}
        rules={{ required: 'Please choose a country' }}
        render={({ field, fieldState }) =&gt; (
          &lt;&gt;
            &lt;CustomSelect {...field} options={countries} /&gt;
            {fieldState.error &amp;&amp; &lt;p&gt;{fieldState.error.message}&lt;/p&gt;}
          &lt;/&gt;
        )}
      /&gt;
      {errors.root &amp;&amp; &lt;p className="error"&gt;{errors.root.message}&lt;/p&gt;}
      &lt;button disabled={isSubmitting}&gt;
        {isSubmitting ? 'Creating...' : 'Sign up'}
      &lt;/button&gt;
    &lt;/form&gt;
  );
}
</code></pre>
