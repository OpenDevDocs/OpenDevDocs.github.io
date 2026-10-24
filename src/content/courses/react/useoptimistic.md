---
publishDate: 2026-05-12T09:33
title: Optimistic Updates with useOptimistic
slug: useoptimistic
metadescription: Show the result immediately and let the network catch up, with automatic rollback when the request fails.
updateDate: 2026-09-05T09:33
author: ['bishal-biswas']
level: 2
tags: ['actions', 'ux', 'react-19']
course: react
---

## Why optimistic updates

The user clicks "like". The request takes 400ms. What do they see in the meantime?

A spinner feels slow. Nothing at all feels broken. The best option is to show the like **immediately** and quietly correct it if the server disagrees.

That is an optimistic update, and it is why chat apps and social feeds feel instant.

## The hook

```javascript
import { useOptimistic } from 'react';
const [optimisticValue, addOptimistic] = useOptimistic(actualValue, updateFn);
```

- **`actualValue`** is the real state, from props or state.
- **`updateFn`** takes the current value and your optimistic input, returning the value to show.
- **`optimisticValue`** is what you render.
- **`addOptimistic`** applies an optimistic change.

The important part: when the surrounding action finishes, React **discards** the optimistic value and falls back to the real one. Success or failure, you do not roll back by hand.

## A like button

```javascript
function LikeButton({ postId, likes }) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    likes,
    (current, amount) => current + amount
  );
  async function handleLike() {
    addOptimisticLike(1);
    await likePost(postId);
  }
  return (
    <form action={handleLike}>
      <button>Likes: {optimisticLikes}</button>
    </form>
  );
}
```

The count jumps immediately. If `likePost` fails, the number returns to the real value on its own.

## A message list

The classic use.

```javascript
function ChatRoom({ messages, sendMessage }) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (current, newMessage) => [
      ...current,
      { ...newMessage, id: 'temp-' + Date.now(), sending: true }
    ]
  );
  async function formAction(formData) {
    const text = formData.get('message');
    addOptimisticMessage({ text });
    await sendMessage(text);
  }
  return (
    <div>
      <ul>
        {optimisticMessages.map((message) => (
          <li key={message.id} style={{ opacity: message.sending ? 0.5 : 1 }}>
            {message.text}
            {message.sending && <small> sending...</small>}
          </li>
        ))}
      </ul>
      <form action={formAction}>
        <input name="message" />
        <button>Send</button>
      </form>
    </div>
  );
}
```

The message appears the instant you hit send, greyed out with a "sending" note. When the server confirms, the real list replaces it and the styling clears.

Note the `sending: true` flag. Marking optimistic items visually is honest: the user can see it is not confirmed yet.

## It only works inside an action

This is the rule that catches everyone.

```javascript
function Broken({ likes, postId }) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(likes, (c, n) => c + n);
  function handleClick() {
    addOptimisticLike(1);
    likePost(postId);
  }
  return <button onClick={handleClick}>{optimisticLikes}</button>;
}
```

React reverts the optimistic value as soon as the current transition ends. Outside a transition there is nothing to keep it alive, so it flickers back immediately.

The fix is to use a form action, or wrap the work in `startTransition`:

```javascript
function Working({ likes, postId }) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(likes, (c, n) => c + n);
  const [isPending, startTransition] = useTransition();
  function handleClick() {
    startTransition(async () => {
      addOptimisticLike(1);
      await likePost(postId);
    });
  }
  return <button onClick={handleClick}>{optimisticLikes}</button>;
}
```

The optimistic value survives for the whole transition, including the await.

## A todo list

```javascript
function TodoList({ todos, addTodo, toggleTodo }) {
  const [optimisticTodos, updateOptimistic] = useOptimistic(
    todos,
    (current, action) => {
      if (action.type === 'add') {
        return [...current, { ...action.todo, id: 'temp', pending: true }];
      }
      if (action.type === 'toggle') {
        return current.map((t) =>
          t.id === action.id ? { ...t, done: !t.done, pending: true } : t
        );
      }
      return current;
    }
  );
  async function handleAdd(formData) {
    const text = formData.get('text');
    updateOptimistic({ type: 'add', todo: { text, done: false } });
    await addTodo(text);
  }
  return (
    <div>
      <ul>
        {optimisticTodos.map((todo) => (
          <li key={todo.id} className={todo.pending ? 'pending' : ''}>
            {todo.text}
          </li>
        ))}
      </ul>
      <form action={handleAdd}>
        <input name="text" />
        <button>Add</button>
      </form>
    </div>
  );
}
```

The update function is a small reducer, so one `useOptimistic` can handle several kinds of change.

## When not to use it

Optimistic updates assume the request will probably succeed. Skip them when:

- **Failure is likely.** A flaky endpoint means the value flickers constantly, which is worse than a spinner.
- **The consequence is serious.** Never show a payment as complete before the server confirms. Money, bookings and irreversible actions deserve honest waiting.
- **You cannot predict the result.** If the server assigns an id, a price or an ordering you cannot guess, you have nothing sensible to show.

Good candidates are likes, toggles, adding a comment, marking as read, reordering. All cheap, all usually successful, all easy to correct.

## Tell the user when it fails

React reverts the value, but silently. The user sees their like disappear with no explanation.

```javascript
async function handleLike() {
  addOptimisticLike(1);
  try {
    await likePost(postId);
  } catch {
    showToast('Could not save your like. Please try again.');
  }
}
```

The rollback is automatic. The explanation is your job.

## Quick recap

- `useOptimistic` shows an expected result before the server confirms it.
- The update function returns the value to display.
- React discards the optimistic value when the action ends, so rollback is automatic.
- It only works inside an action or transition.
- Mark optimistic items visually so the state is honest.
- The update function can act as a small reducer for several change types.
- Do not use it for payments, or when failure is likely.
- Show a message when the request fails, because the revert is silent.

<code id="code-content" class="language-javascript">
import { useOptimistic, useTransition } from 'react';
// A chat list: the message appears instantly, greyed out, and is
// replaced by the real one when the server confirms.
export default function ChatRoom({ messages, sendMessage }) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,                                    // the real value
    (current, newMessage) =&gt; [                   // what to show meanwhile
      ...current,
      { ...newMessage, id: 'temp-' + Date.now(), sending: true }
    ]
  );
  async function formAction(formData) {
    const text = formData.get('message');
    addOptimisticMessage({ text });              // instant
    try {
      await sendMessage(text);
    } catch {
      // React reverts the optimistic value automatically, but silently.
      // Telling the user is your job.
      showToast('Message failed to send.');
    }
  }
  return (
    &lt;div&gt;
      &lt;ul&gt;
        {optimisticMessages.map((message) =&gt; (
          // Marking unconfirmed items visually is honest
          &lt;li key={message.id} style={{ opacity: message.sending ? 0.5 : 1 }}&gt;
            {message.text}
            {message.sending &amp;&amp; &lt;small&gt; sending...&lt;/small&gt;}
          &lt;/li&gt;
        ))}
      &lt;/ul&gt;
      &lt;form action={formAction}&gt;
        &lt;input name="message" /&gt;
        &lt;button&gt;Send&lt;/button&gt;
      &lt;/form&gt;
    &lt;/div&gt;
  );
}
// The update function can act as a small reducer for several change types
function TodoList({ todos, addTodo }) {
  const [optimisticTodos, updateOptimistic] = useOptimistic(
    todos,
    (current, action) =&gt; {
      if (action.type === 'add') {
        return [...current, { ...action.todo, id: 'temp', pending: true }];
      }
      if (action.type === 'toggle') {
        return current.map((t) =&gt;
          t.id === action.id ? { ...t, done: !t.done, pending: true } : t
        );
      }
      return current;
    }
  );
  async function handleAdd(formData) {
    updateOptimistic({ type: 'add', todo: { text: formData.get('text') } });
    await addTodo(formData.get('text'));
  }
  return (
    &lt;form action={handleAdd}&gt;
      &lt;ul&gt;{optimisticTodos.map((t) =&gt; &lt;li key={t.id}&gt;{t.text}&lt;/li&gt;)}&lt;/ul&gt;
      &lt;input name="text" /&gt;
    &lt;/form&gt;
  );
}
// THE RULE: it only survives inside an action or a transition. Outside
// one, React reverts immediately and the value just flickers.
function LikeButton({ likes, postId }) {
  const [optimisticLikes, addLike] = useOptimistic(likes, (c, n) =&gt; c + n);
  const [isPending, startTransition] = useTransition();
  function handleClick() {
    startTransition(async () =&gt; {      // wrap it, or it flickers back
      addLike(1);
      await likePost(postId);
    });
  }
  return &lt;button onClick={handleClick}&gt;Likes: {optimisticLikes}&lt;/button&gt;;
}
// Never use this for payments, bookings, or anything irreversible.
// Money deserves an honest wait.
</code></pre>
