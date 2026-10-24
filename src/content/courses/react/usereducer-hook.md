---
publishDate: 2026-05-08T09:23
title: useReducer
slug: usereducer-hook
metadescription: Manage complex state with a reducer, keeping every update in one predictable, testable place.
updateDate: 2026-09-05T09:23
author: ['bishal-biswas']
level: 2
tags: ['hooks', 'state']
course: react
---

## When useState stops scaling

```javascript
function Form() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);
  async function handleSubmit() {
    setIsSubmitting(true);
    setErrors({});
    setIsSuccess(false);
    try {
      await save({ name, email });
      setIsSuccess(true);
      setName('');
      setEmail('');
    } catch (error) {
      setErrors({ form: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }
}
```

Five pieces of state and one action touching most of them. The update logic is scattered, and it is easy to forget one setter and leave the form in an impossible state, such as submitting and successful at the same time.

`useReducer` gathers all of it into one function.

## The shape

```javascript
import { useReducer } from 'react';
function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
    case 'reset':
      return { count: 0 };
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}
function Counter() {
  const [state, dispatch] = useReducer(reducer, { count: 0 });
  return (
    <div>
      <p>{state.count}</p>
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>-</button>
      <button onClick={() => dispatch({ type: 'reset' })}>Reset</button>
    </div>
  );
}
```

Three pieces:

- **The reducer**, a plain function taking the current state and an action, returning the new state.
- **`dispatch`**, which sends an action.
- **The action**, an object describing what happened.

## The reducer must be pure

Given the same state and action, it must always return the same result, and change nothing else.

```javascript
function badReducer(state, action) {
  state.count++;
  localStorage.setItem('count', state.count);
  return state;
}
function goodReducer(state, action) {
  return { ...state, count: state.count + 1 };
}
```

The bad version mutates state and does a side effect. React compares references, so returning the same object means no re-render. Side effects belong in event handlers or effects.

## Actions describe events, not setters

```javascript
dispatch({ type: 'set_is_submitting', value: true });
dispatch({ type: 'set_errors', value: {} });
dispatch({ type: 'submit_started' });
```

The first two are just `useState` with extra ceremony. The third says what **happened**, and lets the reducer decide every consequence.

That is the real benefit. All the rules live in one place.

## A realistic example

```javascript
const initialState = {
  name: '',
  email: '',
  status: 'idle',
  errors: {}
};
function formReducer(state, action) {
  switch (action.type) {
    case 'field_changed':
      return {
        ...state,
        [action.field]: action.value,
        errors: { ...state.errors, [action.field]: undefined }
      };
    case 'submit_started':
      return { ...state, status: 'submitting', errors: {} };
    case 'submit_succeeded':
      return { ...initialState, status: 'success' };
    case 'submit_failed':
      return { ...state, status: 'idle', errors: action.errors };
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}
function SignupForm() {
  const [state, dispatch] = useReducer(formReducer, initialState);
  async function handleSubmit(event) {
    event.preventDefault();
    dispatch({ type: 'submit_started' });
    try {
      await save({ name: state.name, email: state.email });
      dispatch({ type: 'submit_succeeded' });
    } catch (error) {
      dispatch({ type: 'submit_failed', errors: { form: error.message } });
    }
  }
  return (
    <form onSubmit={handleSubmit}>
      <input
        value={state.name}
        onChange={(e) => dispatch({ type: 'field_changed', field: 'name', value: e.target.value })}
      />
      {state.errors.name && <p>{state.errors.name}</p>}
      <button disabled={state.status === 'submitting'}>
        {state.status === 'submitting' ? 'Saving...' : 'Sign up'}
      </button>
    </form>
  );
}
```

Notice `submit_started` clears the errors automatically. You cannot forget, because the rule lives in the reducer rather than in every call site.

Notice also that `status` is one value rather than three booleans. Impossible combinations like "submitting and successful" simply cannot be represented.

## Lazy initialisation

```javascript
function init(initialCount) {
  return { count: initialCount, history: [] };
}
const [state, dispatch] = useReducer(reducer, 0, init);
```

A third argument is a function that builds the initial state. React calls it once. Useful for expensive setup, and for resetting:

```javascript
case 'reset':
  return init(action.payload);
```

## Reducers are easy to test

```javascript
test('submit_started clears errors', () => {
  const before = { status: 'idle', errors: { form: 'Oops' } };
  const after = formReducer(before, { type: 'submit_started' });
  expect(after.status).toBe('submitting');
  expect(after.errors).toEqual({});
});
```

No component, no rendering, no mocks. It is a plain function taking two arguments. This is a genuine advantage over scattered `useState` calls.

## useState or useReducer?

**useState** when the state is simple and independent: a boolean, a string, a counter.

**useReducer** when:

- Several pieces of state change together.
- The next state depends on the previous one in non trivial ways.
- The same update happens from several places.
- You keep creating impossible combinations of state.

There is no obligation to use it. Most components are fine with `useState`.

## Passing dispatch down

`dispatch` is guaranteed stable, so it never causes a child to re-render unnecessarily and never needs to be a dependency.

```javascript
function Parent() {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <Child dispatch={dispatch} items={state.items} />;
}
```

That makes reducers pair very well with Context, which is the next topic. One provider gives the whole tree both the state and the ability to update it, without threading callbacks through every level.

## Quick recap

- A reducer is a pure function taking state and an action, returning new state.
- `dispatch` sends actions, and the reducer decides every consequence.
- Name actions after what happened, not after which setter to call.
- Never mutate state or do side effects inside a reducer.
- A single `status` string prevents impossible boolean combinations.
- The third argument to `useReducer` builds the initial state lazily.
- Reducers are plain functions, so they are trivial to unit test.
- `dispatch` is stable, which makes it ideal to pass down or put in Context.

<code id="code-content" class="language-javascript">
import { useReducer } from 'react';
const initialState = { name: '', email: '', status: 'idle', errors: {} };
// A reducer is a PURE function: same inputs, same output, nothing else
// touched. Never mutate state, never do side effects here.
function formReducer(state, action) {
  switch (action.type) {
    case 'field_changed':
      return {
        ...state,
        [action.field]: action.value,
        // The rule lives here, so no call site can forget it
        errors: { ...state.errors, [action.field]: undefined }
      };
    case 'submit_started':
      return { ...state, status: 'submitting', errors: {} };
    case 'submit_succeeded':
      return { ...initialState, status: 'success' };
    case 'submit_failed':
      return { ...state, status: 'idle', errors: action.errors };
    default:
      throw new Error('Unknown action: ' + action.type);
  }
}
export default function SignupForm() {
  const [state, dispatch] = useReducer(formReducer, initialState);
  async function handleSubmit(event) {
    event.preventDefault();
    // Actions say what HAPPENED. The reducer decides the consequences.
    dispatch({ type: 'submit_started' });
    try {
      await save({ name: state.name, email: state.email });
      dispatch({ type: 'submit_succeeded' });
    } catch (error) {
      dispatch({ type: 'submit_failed', errors: { form: error.message } });
    }
  }
  return (
    &lt;form onSubmit={handleSubmit}&gt;
      &lt;input
        value={state.name}
        onChange={(e) =&gt;
          dispatch({ type: 'field_changed', field: 'name', value: e.target.value })
        }
      /&gt;
      {state.errors.name &amp;&amp; &lt;p className="error"&gt;{state.errors.name}&lt;/p&gt;}
      &lt;input
        value={state.email}
        onChange={(e) =&gt;
          dispatch({ type: 'field_changed', field: 'email', value: e.target.value })
        }
      /&gt;
      {state.errors.form &amp;&amp; &lt;p className="error"&gt;{state.errors.form}&lt;/p&gt;}
      {/* One status string, so "submitting and successful" cannot happen */}
      &lt;button disabled={state.status === 'submitting'}&gt;
        {state.status === 'submitting' ? 'Saving...' : 'Sign up'}
      &lt;/button&gt;
      {state.status === 'success' &amp;&amp; &lt;p&gt;Thanks for signing up.&lt;/p&gt;}
    &lt;/form&gt;
  );
}
// Reducers test with no component and no mocks at all:
// const after = formReducer({ status: 'idle', errors: { form: 'Oops' } },
//                           { type: 'submit_started' });
// expect(after.errors).toEqual({});
</code></pre>
