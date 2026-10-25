---
publishDate: 2026-05-22T10:02
title: View Transitions
slug: view-transitions
metadescription: Animate between two states of your interface with the browser's View Transitions API and React's ViewTransition component.
updateDate: 2026-09-05T10:02
author: ['bishal-biswas']
level: 3
tags: ['animation', 'ux', 'react-19']
course: react
---

## The problem with animating React

Animating an element that appears is easy. Animating one that **moves between two different components** is not.

A thumbnail in a list that expands into a full image on a detail page is two separate elements in two separate trees. Traditional approaches involve measuring positions, cloning nodes and animating a copy on top. It is fiddly and fragile.

## The browser API

Browsers added `document.startViewTransition`, which does the hard part.

```javascript
document.startViewTransition(() => {
  updateTheDom();
});
```

The browser screenshots the page before, runs your update, screenshots after, and cross fades between them. Elements you name are morphed from one position to the other.

```css
::view-transition-old(root) {
  animation: fade-out 0.2s;
}
::view-transition-new(root) {
  animation: fade-in 0.2s;
}
```

## React's ViewTransition

React 19 wraps this so it works with state updates rather than direct DOM changes.

```javascript
import { ViewTransition, startTransition } from 'react';
function Gallery() {
  const [selected, setSelected] = useState(null);
  function select(id) {
    startTransition(() => setSelected(id));
  }
  return (
    <ViewTransition>
      {selected ? (
        <DetailView id={selected} onBack={() => select(null)} />
      ) : (
        <GridView onSelect={select} />
      )}
    </ViewTransition>
  );
}
```

The update must be inside a **transition**. That is how React knows this is an update worth animating.

## Naming shared elements

The real magic is morphing one element into another.

```javascript
function GridView({ onSelect }) {
  return (
    <div className="grid">
      {photos.map((photo) => (
        <ViewTransition key={photo.id} name={`photo-${photo.id}`}>
          <img src={photo.thumb} onClick={() => onSelect(photo.id)} />
        </ViewTransition>
      ))}
    </div>
  );
}
function DetailView({ id }) {
  const photo = photos.find((p) => p.id === id);
  return (
    <ViewTransition name={`photo-${photo.id}`}>
      <img src={photo.full} className="detail" />
    </ViewTransition>
  );
}
```

The same `name` on both sides tells the browser these are the same thing. It animates position, size and shape between them.

**Every name must be unique on the page at any moment.** Two elements sharing a name breaks the transition.

## Styling the animation

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.3s;
}
::view-transition-group(photo-1) {
  animation-duration: 0.4s;
  animation-timing-function: cubic-bezier(0.2, 0, 0.2, 1);
}
```

React also adds classes you can target:

```css
[data-view-transition] {
  view-transition-name: var(--vt-name);
}
```

Check the React documentation for the current class names, since this area is still settling.

## Animating a list

```javascript
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo) => (
        <ViewTransition key={todo.id}>
          <li>{todo.text}</li>
        </ViewTransition>
      ))}
    </ul>
  );
}
function App() {
  const [todos, setTodos] = useState([]);
  function remove(id) {
    startTransition(() => {
      setTodos((current) => current.filter((t) => t.id !== id));
    });
  }
}
```

Removing an item animates the remaining ones into their new positions, instead of snapping. That is the sort of polish that used to need a dedicated animation library.

## Respecting reduced motion

Some people find motion uncomfortable or disorienting, and some find it genuinely nauseating.

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

**This is not optional.** It is an accessibility requirement, and it is one CSS block.

You can also check it in JavaScript:

```javascript
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function update(id) {
  if (prefersReduced) {
    setSelected(id);
  } else {
    startTransition(() => setSelected(id));
  }
}
```

## Browser support

View Transitions are supported in Chromium browsers and are arriving elsewhere. Where unsupported, the update simply happens instantly with no animation.

That makes this a **progressive enhancement**. Nothing breaks, some users just do not see the transition. Never make functionality depend on the animation.

## Do not overdo it

A transition should help the user understand what changed. Its job is to connect two states, not to entertain.

- **Keep it short.** 200 to 300ms. Anything longer feels sluggish once you have seen it fifty times.
- **Animate the meaningful thing.** The image that expanded, not every element on the page.
- **Never block interaction.** The user should be able to click through an animation.

An interface that animates constantly is exhausting to use.

## Availability

`ViewTransition` is still experimental in React at the time of writing, so check what your version exports and expect the API to shift. The underlying browser API is stable, and you can use it directly.

## Quick recap

- View Transitions animate between two states of the page.
- The browser screenshots before and after and morphs between them.
- React's `ViewTransition` works with state updates inside a transition.
- A matching `name` on both sides morphs one element into the other.
- Names must be unique at any given moment.
- Style with the `::view-transition-*` pseudo elements.
- Always disable animation for `prefers-reduced-motion`.
- Unsupported browsers just update instantly, so it degrades safely.

<code id="code-content" class="language-javascript">
import { ViewTransition, startTransition, useState } from 'react';
const photos = [
  { id: 1, thumb: '/1-small.jpg', full: '/1.jpg' },
  { id: 2, thumb: '/2-small.jpg', full: '/2.jpg' }
];
export default function Gallery() {
  const [selected, setSelected] = useState(null);
  // Respect the user's setting. This is an accessibility requirement,
  // not a nice to have. Some people find motion genuinely nauseating.
  const prefersReduced =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function select(id) {
    if (prefersReduced) {
      setSelected(id);              // no animation at all
    } else {
      // The update MUST be inside a transition. That is how React knows
      // it is worth animating.
      startTransition(() =&gt; setSelected(id));
    }
  }
  if (selected) {
    const photo = photos.find((p) =&gt; p.id === selected);
    return (
      // The SAME name on both sides is what morphs the thumbnail into
      // the full image. Names must be unique at any given moment.
      &lt;ViewTransition name={'photo-' + photo.id}&gt;
        &lt;img src={photo.full} className="detail"
             onClick={() =&gt; select(null)} /&gt;
      &lt;/ViewTransition&gt;
    );
  }
  return (
    &lt;div className="grid"&gt;
      {photos.map((photo) =&gt; (
        &lt;ViewTransition key={photo.id} name={'photo-' + photo.id}&gt;
          &lt;img src={photo.thumb} onClick={() =&gt; select(photo.id)} /&gt;
        &lt;/ViewTransition&gt;
      ))}
    &lt;/div&gt;
  );
}
// Animating a list: removing one item slides the rest into place
// instead of snapping
function TodoList({ todos, setTodos }) {
  function remove(id) {
    startTransition(() =&gt;
      setTodos((current) =&gt; current.filter((t) =&gt; t.id !== id))
    );
  }
  return (
    &lt;ul&gt;
      {todos.map((todo) =&gt; (
        &lt;ViewTransition key={todo.id}&gt;
          &lt;li onClick={() =&gt; remove(todo.id)}&gt;{todo.text}&lt;/li&gt;
        &lt;/ViewTransition&gt;
      ))}
    &lt;/ul&gt;
  );
}
// The CSS side, including the reduced motion block you must not skip:
//   ::view-transition-old(root),
//   ::view-transition-new(root) { animation-duration: 0.25s; }
//   @media (prefers-reduced-motion: reduce) {
//     ::view-transition-group(*),
//     ::view-transition-old(*),
//     ::view-transition-new(*) { animation: none !important; }
//   }
// Unsupported browsers simply update instantly, so this is a
// progressive enhancement. Never make functionality depend on it.
</code></pre>
