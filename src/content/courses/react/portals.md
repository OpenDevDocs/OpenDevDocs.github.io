---
publishDate: 2026-05-15T09:44
title: Portals
slug: portals
metadescription: Render a component into a different part of the DOM while keeping it in the React tree, for modals, tooltips and toasts.
updateDate: 2026-09-05T09:44
author: ['bishal-biswas']
level: 2
tags: ['portals', 'dom', 'patterns']
course: react
---

## The problem

You have a modal deep inside your component tree.

```javascript
function ProductCard({ product }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="card">
      <h3>{product.name}</h3>
      <button onClick={() => setIsOpen(true)}>Details</button>
      {isOpen && <Modal onClose={() => setIsOpen(false)}>...</Modal>}
    </div>
  );
}
```

The modal renders inside `.card`, and CSS traps it there.

- `overflow: hidden` on any ancestor clips it.
- `position: relative` on an ancestor changes what `position: fixed` means.
- A `z-index` on a sibling can cover it, and raising the modal's `z-index` does not help if the ancestor created a stacking context.

You end up fighting CSS that has nothing to do with the modal.

## Portals

A portal renders a component into a **different DOM node**, while keeping it in the React tree.

```javascript
import { createPortal } from 'react-dom';
function Modal({ children, onClose }) {
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}
```

`createPortal(what, where)`. The markup now lands directly in `<body>`, escaping every ancestor's CSS.

## The React tree does not change

This is the important part.

The modal is still a child of `ProductCard` as far as React is concerned. That means:

- **Props and context work normally.** It reads the same theme, the same auth.
- **State works normally.**
- **Events still bubble through the React tree**, not the DOM tree.

That last point surprises people.

```javascript
function Parent() {
  return (
    <div onClick={() => console.log('Parent clicked')}>
      <Modal>
        <button>Click me</button>
      </Modal>
    </div>
  );
}
```

Clicking the button logs `Parent clicked`, even though the button is physically in `<body>`. React propagates events along its own tree.

That is usually convenient. It occasionally surprises you, for example when a click inside a portal closes a dropdown listening on an ancestor.

## A dedicated mount node

`document.body` works, but a dedicated node is tidier.

```html
<body>
  <div id="root"></div>
  <div id="modal-root"></div>
</body>
```

```javascript
function Modal({ children, onClose }) {
  const root = document.getElementById('modal-root');
  if (!root) return null;
  return createPortal(<div className="overlay">{children}</div>, root);
}
```

Or create the node on demand, which avoids touching the HTML file:

```javascript
function usePortalRoot(id) {
  const [root, setRoot] = useState(null);
  useEffect(() => {
    let node = document.getElementById(id);
    let created = false;
    if (!node) {
      node = document.createElement('div');
      node.id = id;
      document.body.append(node);
      created = true;
    }
    setRoot(node);
    return () => {
      if (created) node.remove();
    };
  }, [id]);
  return root;
}
```

Note that this returns `null` on the first render, which is correct for server rendering: the portal only exists once there is a DOM.

## A complete modal

A real modal needs more than a portal.

```javascript
function Modal({ isOpen, onClose, title, children }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body
  );
}
```

Five things beyond the portal:

- **Escape closes it.**
- **Focus moves in**, and returns to the trigger on close.
- **Background scrolling is locked.**
- **`role="dialog"` and `aria-modal`** so screen readers treat it correctly.
- **`stopPropagation`** so clicking inside does not close it.

Focus trapping, keeping Tab inside the modal, is still missing and is fiddly to do properly. This is why most teams use a library like Radix or React Aria.

## The native dialog element

Modern browsers have `<dialog>`, which handles focus, escape and the top layer for you.

```javascript
function NativeModal({ isOpen, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen) dialog.showModal();
    else dialog.close();
  }, [isOpen]);
  return (
    <dialog ref={ref} onClose={onClose}>
      {children}
    </dialog>
  );
}
```

`showModal()` puts it in the browser's top layer, above everything, with no `z-index` needed. It often removes the need for a portal entirely.

## Other uses

**Tooltips** that must escape `overflow: hidden`.

**Toasts** in a fixed corner container, rendered from anywhere.

```javascript
function Toast({ message }) {
  return createPortal(
    <div className="toast">{message}</div>,
    document.getElementById('toast-root')
  );
}
```

**Widgets in a page you do not control**, for example rendering into an element created by another script.

## Quick recap

- A portal renders into a different DOM node, escaping ancestor CSS.
- The React tree is unchanged, so context and props work normally.
- Events bubble through the React tree, not the DOM tree.
- Use a dedicated mount node, or create one on demand.
- A real modal also needs escape, focus handling, scroll lock and ARIA.
- The native `<dialog>` element handles much of that for you.
- Tooltips and toasts are the other common cases.

<code id="code-content" class="language-javascript">
import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';
// createPortal(what, where). The markup lands in document.body, escaping
// every ancestor's overflow, z-index and stacking context.
// The REACT tree is unchanged, so context still works and events still
// bubble to the React parent, not the DOM parent.
export function Modal({ isOpen, onClose, title, children }) {
  const dialogRef = useRef(null);
  useEffect(() =&gt; {
    if (!isOpen) return;
    function handleKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    // Move focus in, and remember where to send it back
    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();
    document.body.style.overflow = 'hidden';     // lock background scroll
    return () =&gt; {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
      previouslyFocused?.focus();                // return focus on close
    };
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return createPortal(
    &lt;div className="overlay" onClick={onClose}&gt;
      &lt;div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) =&gt; e.stopPropagation()}     // clicking inside stays open
      &gt;
        &lt;h2&gt;{title}&lt;/h2&gt;
        {children}
        &lt;button onClick={onClose}&gt;Close&lt;/button&gt;
      &lt;/div&gt;
    &lt;/div&gt;,
    document.body
  );
}
// Create the mount node on demand, so you do not have to edit index.html.
// It returns null on the first render, which is correct for SSR.
function usePortalRoot(id) {
  const [root, setRoot] = useState(null);
  useEffect(() =&gt; {
    let node = document.getElementById(id);
    let created = false;
    if (!node) {
      node = document.createElement('div');
      node.id = id;
      document.body.append(node);
      created = true;
    }
    setRoot(node);
    return () =&gt; { if (created) node.remove(); };
  }, [id]);
  return root;
}
// The native &lt;dialog&gt; handles focus, escape and the top layer for you,
// and often removes the need for a portal at all
export function NativeModal({ isOpen, onClose, children }) {
  const ref = useRef(null);
  useEffect(() =&gt; {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen) dialog.showModal();   // browser top layer, no z-index
    else dialog.close();
  }, [isOpen]);
  return &lt;dialog ref={ref} onClose={onClose}&gt;{children}&lt;/dialog&gt;;
}
// Still missing from the hand rolled version: focus trapping, so Tab
// cannot escape the modal. That is fiddly, which is why most teams use
// a library like Radix or React Aria.
</code></pre>
