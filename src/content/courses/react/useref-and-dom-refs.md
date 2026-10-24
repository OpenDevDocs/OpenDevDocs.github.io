---
publishDate: 2026-05-08T09:21
title: useRef and DOM Refs
slug: useref-and-dom-refs
metadescription: Reach real DOM nodes and store values that survive renders without causing one, using the useRef hook.
updateDate: 2026-09-05T09:21
author: ['bishal-biswas']
level: 2
tags: ['hooks', 'refs', 'dom']
course: react
---

## Two jobs, one hook

`useRef` does two quite different things:

1. Holds a reference to a **DOM element**.
2. Stores a **mutable value** that survives renders without triggering one.

Both come from the same idea: a box whose contents React does not watch.

## Reaching a DOM element

```javascript
import { useRef } from 'react';
function SearchBox() {
  const inputRef = useRef(null);
  function handleClick() {
    inputRef.current.focus();
  }
  return (
    <div>
      <input ref={inputRef} />
      <button onClick={handleClick}>Focus the input</button>
    </div>
  );
}
```

Three steps: create the ref, attach it with the `ref` attribute, then read `ref.current`.

Before the first render `current` is `null`, because the element does not exist yet. React sets it after the DOM is created and back to `null` on unmount.

## Always guard `current`

```javascript
function Broken() {
  const ref = useRef(null);
  console.log(ref.current.value);
  return <input ref={ref} />;
}
function Fixed() {
  const ref = useRef(null);
  useEffect(() => {
    console.log(ref.current?.value);
  }, []);
  return <input ref={ref} />;
}
```

Reading `current` during the first render gives `null`, and `null.value` throws. Read refs in effects and event handlers, never during render.

## What refs are legitimately for

Only a handful of things, all of which the DOM does and React does not.

```javascript
inputRef.current.focus();
inputRef.current.blur();
inputRef.current.select();
videoRef.current.play();
videoRef.current.pause();
divRef.current.scrollIntoView({ behavior: 'smooth' });
divRef.current.getBoundingClientRect();
dialogRef.current.showModal();
```

Autofocus on mount is the classic:

```javascript
function LoginForm() {
  const emailRef = useRef(null);
  useEffect(() => {
    emailRef.current?.focus();
  }, []);
  return <input ref={emailRef} type="email" />;
}
```

## Do not use refs to change the DOM

```javascript
function Bad() {
  const ref = useRef(null);
  function handleClick() {
    ref.current.textContent = 'Changed';
    ref.current.style.color = 'red';
  }
  return <p ref={ref}>Original</p>;
}
function Good() {
  const [text, setText] = useState('Original');
  const [isRed, setIsRed] = useState(false);
  return (
    <p style={{ color: isRed ? 'red' : 'black' }} onClick={() => { setText('Changed'); setIsRed(true); }}>
      {text}
    </p>
  );
}
```

React owns the DOM it renders. Change it behind React's back and your edits vanish on the next render, or React gets confused about what is on screen.

Read from a ref, do not write through one. Content and appearance belong to state.

## Refs as instance variables

The second job. A ref holds any value, and changing it does **not** cause a re-render.

```javascript
function Timer() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef(null);
  function start() {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      setSeconds((previous) => previous + 1);
    }, 1000);
  }
  function stop() {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
  useEffect(() => stop, []);
  return (
    <div>
      <p>{seconds}s</p>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
    </div>
  );
}
```

The interval id must survive re-renders, but showing it on screen would be meaningless. That is exactly a ref.

## State or ref?

| | State | Ref |
| --- | --- | --- |
| Triggers a re-render | Yes | No |
| Survives re-renders | Yes | Yes |
| Read during render | Yes | Avoid |
| Update timing | Next render | Immediately |

**Use state** for anything the user sees.

**Use a ref** for things they do not: timer ids, previous values, a "has this run before" flag, or a DOM node.

```javascript
const [count, setCount] = useState(0);
const renderCount = useRef(0);
renderCount.current++;
```

Counting renders with state would be an infinite loop. With a ref it is harmless.

## Tracking the previous value

```javascript
function useCurrentAndPrevious(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
function Price({ amount }) {
  const previous = useCurrentAndPrevious(amount);
  return (
    <p>
      {amount} {previous !== undefined && amount > previous && '(up)'}
    </p>
  );
}
```

The effect runs after render, so during render `ref.current` still holds the previous value.

## A callback ref

Pass a function instead of a ref object and React calls it with the element.

```javascript
function MeasuredBox() {
  const [height, setHeight] = useState(0);
  const measureRef = useCallback((node) => {
    if (node) setHeight(node.getBoundingClientRect().height);
  }, []);
  return <div ref={measureRef}>Height: {height}px</div>;
}
```

This runs as soon as the node attaches, which is useful when the element appears conditionally and an effect would not fire at the right moment.

Since React 19 a callback ref can return a cleanup function:

```javascript
<div ref={(node) => {
  const observer = new ResizeObserver(handleResize);
  observer.observe(node);
  return () => observer.disconnect();
}} />
```

## A list of refs

```javascript
function ItemList({ items }) {
  const refs = useRef(new Map());
  function scrollTo(id) {
    refs.current.get(id)?.scrollIntoView({ behavior: 'smooth' });
  }
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} ref={(node) => {
          if (node) refs.current.set(item.id, node);
          else refs.current.delete(item.id);
        }}>
          {item.name}
        </li>
      ))}
    </ul>
  );
}
```

One ref holding a Map, keyed by id. Cleaning up on unmount prevents holding detached DOM nodes.

## Quick recap

- `useRef` holds a DOM node or a value that survives renders.
- Changing `ref.current` never re-renders.
- `current` is `null` before the first render, so guard it.
- Read refs in effects and handlers, never during render.
- Use refs to focus, scroll, measure and play media.
- Never change content or styles through a ref, use state.
- Callback refs run the moment the node attaches, and can return cleanup in React 19.

<code id="code-content" class="language-javascript">
import { useRef, useState, useEffect, useCallback } from 'react';
export default function MediaPlayer({ items }) {
  const [seconds, setSeconds] = useState(0);
  const videoRef = useRef(null);       // a DOM node
  const intervalRef = useRef(null);    // a value that survives renders
  const renderCount = useRef(0);       // changing this never re-renders
  renderCount.current++;
  // Focus on mount. current is null before the first render, so this
  // belongs in an effect, never during render.
  const searchRef = useRef(null);
  useEffect(() =&gt; {
    searchRef.current?.focus();
  }, []);
  // A timer id must survive renders, but showing it would be meaningless.
  // That is exactly what a ref is for.
  function start() {
    if (intervalRef.current) return;   // already running
    intervalRef.current = setInterval(() =&gt; {
      setSeconds((previous) =&gt; previous + 1);
    }, 1000);
  }
  function stop() {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
  useEffect(() =&gt; stop, []);           // clean up on unmount
  // Refs are for things the DOM does and React does not
  function playVideo() {
    videoRef.current?.play();
  }
  function scrollToTop() {
    videoRef.current?.scrollIntoView({ behavior: 'smooth' });
  }
  // A callback ref runs the moment the node attaches, and since React 19
  // it can return a cleanup function
  const measureRef = useCallback((node) =&gt; {
    if (!node) return;
    const observer = new ResizeObserver(() =&gt; console.log('resized'));
    observer.observe(node);
    return () =&gt; observer.disconnect();
  }, []);
  return (
    &lt;div&gt;
      &lt;input ref={searchRef} placeholder="Focused on mount" /&gt;
      &lt;video ref={videoRef} src="/clip.mp4" /&gt;
      &lt;div ref={measureRef}&gt;Watched for resizes&lt;/div&gt;
      &lt;p&gt;{seconds}s, rendered {renderCount.current} times&lt;/p&gt;
      &lt;button onClick={start}&gt;Start&lt;/button&gt;
      &lt;button onClick={stop}&gt;Stop&lt;/button&gt;
      &lt;button onClick={playVideo}&gt;Play&lt;/button&gt;
    &lt;/div&gt;
  );
}
// NEVER change what React renders through a ref. Your edit disappears on
// the next render and React loses track of the DOM.
//   ref.current.textContent = 'Changed';     wrong
//   setText('Changed');                      right
</code></pre>
