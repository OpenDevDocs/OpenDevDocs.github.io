---
publishDate: 2026-05-08T09:22
title: ref as a Prop and ref Cleanup Functions
slug: ref-as-a-prop
metadescription: React 19 lets function components take ref as an ordinary prop, so forwardRef is no longer needed. Plus ref cleanup functions.
updateDate: 2026-09-05T09:22
author: ['bishal-biswas']
level: 2
tags: ['refs', 'react-19']
course: react
---

## The old problem

Before React 19, `ref` was not a normal prop. Passing one to your own component did not work.

```javascript
function TextInput({ label }) {
  return <input />;
}
function Form() {
  const inputRef = useRef(null);
  return <TextInput ref={inputRef} />;
}
```

`TextInput` never received it, and React warned that function components cannot be given refs.

The fix was `forwardRef`, which was awkward:

```javascript
import { forwardRef } from 'react';
const TextInput = forwardRef(function TextInput({ label }, ref) {
  return (
    <label>
      {label}
      <input ref={ref} />
    </label>
  );
});
```

The ref arrived as a **second parameter** rather than in props, and the whole component had to be wrapped.

## React 19: just a prop

```javascript
function TextInput({ label, ref }) {
  return (
    <label>
      {label}
      <input ref={ref} />
    </label>
  );
}
function Form() {
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return <TextInput label="Email" ref={inputRef} />;
}
```

Destructure `ref` alongside everything else. No wrapper, no second parameter.

`forwardRef` still works so existing code keeps running, but it is deprecated and will be removed. New components should take `ref` as a prop.

## Why forward a ref at all?

Because a parent sometimes needs the real DOM node inside your component.

```javascript
function LoginForm() {
  const emailRef = useRef(null);
  function handleSubmit(event) {
    event.preventDefault();
    if (!isValidEmail(emailRef.current.value)) {
      emailRef.current.focus();
      return;
    }
  }
  return (
    <form onSubmit={handleSubmit}>
      <TextInput label="Email" ref={emailRef} />
      <button type="submit">Log in</button>
    </form>
  );
}
```

The form needs to focus the failing field. Without a forwarded ref it has no way to reach the `<input>` your component rendered.

## Refs and `...rest`

```javascript
function Input({ label, ref, ...rest }) {
  return (
    <label>
      {label}
      <input ref={ref} {...rest} />
    </label>
  );
}
```

Note that `ref` must be pulled out explicitly. It is a prop now, so it would otherwise land in `rest` and get spread onto the input as an attribute, which is not what you want.

## Exposing something other than the DOM node

Sometimes you want to give the parent a small API rather than the raw element. `useImperativeHandle` does that.

```javascript
import { useImperativeHandle, useRef } from 'react';
function VideoPlayer({ src, ref }) {
  const videoRef = useRef(null);
  useImperativeHandle(ref, () => ({
    play: () => videoRef.current.play(),
    pause: () => videoRef.current.pause(),
    restart: () => {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  }), []);
  return <video ref={videoRef} src={src} />;
}
function Page() {
  const playerRef = useRef(null);
  return (
    <div>
      <VideoPlayer src="/clip.mp4" ref={playerRef} />
      <button onClick={() => playerRef.current.restart()}>Restart</button>
    </div>
  );
}
```

The parent gets exactly three methods and cannot reach into the DOM. That keeps the boundary clean.

> Use this sparingly. Imperative APIs work against React's declarative model. Prefer props and state, and reach for `useImperativeHandle` only for genuinely imperative actions like play, focus and scroll.

## Ref cleanup functions

React 19 added another improvement. A callback ref may return a cleanup function.

```javascript
function Measured() {
  return (
    <div ref={(node) => {
      const observer = new ResizeObserver(() => console.log('resized'));
      observer.observe(node);
      return () => observer.disconnect();
    }}>
      Watched
    </div>
  );
}
```

Before this, React called your callback with `null` on unmount and you had to handle both cases:

```javascript
<div ref={(node) => {
  if (node) {
    observerRef.current = new ResizeObserver(handler);
    observerRef.current.observe(node);
  } else {
    observerRef.current?.disconnect();
  }
}} />
```

The cleanup version is much clearer, and it keeps the setup and teardown next to each other.

Note that if you return a cleanup function, React no longer calls the callback with `null`. Do not mix the two styles.

## A practical combination

```javascript
function AutoResizeTextarea({ value, onChange, ref }) {
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current, []);
  useEffect(() => {
    const node = innerRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={innerRef}
      value={value}
      onChange={onChange}
      rows={1}
    />
  );
}
```

The component manages its own height and still hands the raw node to the parent, so the parent can focus it.

## Quick recap

- In React 19 `ref` is an ordinary prop on function components.
- `forwardRef` is deprecated, though it still works.
- Destructure `ref` explicitly so it does not end up in `...rest`.
- Forward refs so parents can focus, scroll or measure a child's element.
- `useImperativeHandle` exposes a small API instead of the raw node.
- Callback refs can return a cleanup function in React 19.
- Do not mix cleanup returns with the old `null` check style.

<code id="code-content" class="language-javascript">
import { useRef, useEffect, useImperativeHandle } from 'react';
// REACT 19: ref is just a prop. No forwardRef wrapper, no second argument.
// Pull it out explicitly so it does not land in ...rest and get spread
// onto the element as an attribute.
function TextInput({ label, ref, ...rest }) {
  return (
    &lt;label&gt;
      {label}
      &lt;input ref={ref} {...rest} /&gt;
    &lt;/label&gt;
  );
}
// The old way, still working but deprecated:
// const TextInput = forwardRef(function TextInput({ label }, ref) { ... });
// Forwarding matters when the parent needs the real node, for example to
// focus the field that failed validation.
function LoginForm() {
  const emailRef = useRef(null);
  function handleSubmit(event) {
    event.preventDefault();
    if (!emailRef.current.value.includes('@')) {
      emailRef.current.focus();
      return;
    }
    console.log('submitting');
  }
  return (
    &lt;form onSubmit={handleSubmit}&gt;
      &lt;TextInput label="Email" type="email" ref={emailRef} /&gt;
      &lt;button type="submit"&gt;Log in&lt;/button&gt;
    &lt;/form&gt;
  );
}
// useImperativeHandle exposes a small API instead of the raw DOM node,
// so the parent cannot reach in and do anything it likes.
function VideoPlayer({ src, ref }) {
  const videoRef = useRef(null);
  useImperativeHandle(ref, () =&gt; ({
    play: () =&gt; videoRef.current.play(),
    pause: () =&gt; videoRef.current.pause(),
    restart: () =&gt; {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  }), []);
  return &lt;video ref={videoRef} src={src} /&gt;;
}
// REACT 19: a callback ref can return a cleanup function, so setup and
// teardown sit next to each other. React then stops calling it with null.
function Measured() {
  return (
    &lt;div
      ref={(node) =&gt; {
        const observer = new ResizeObserver(() =&gt; console.log('resized'));
        observer.observe(node);
        return () =&gt; observer.disconnect();
      }}
    &gt;
      Watched for size changes
    &lt;/div&gt;
  );
}
export default function Page() {
  const playerRef = useRef(null);
  return (
    &lt;div&gt;
      &lt;LoginForm /&gt;
      &lt;VideoPlayer src="/clip.mp4" ref={playerRef} /&gt;
      &lt;button onClick={() =&gt; playerRef.current.restart()}&gt;Restart&lt;/button&gt;
      &lt;Measured /&gt;
    &lt;/div&gt;
  );
}
</code></pre>
