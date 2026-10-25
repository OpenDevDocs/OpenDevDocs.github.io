---
publishDate: 2026-05-31T10:29
title: Custom Renderers with react-reconciler
slug: custom-renderers
metadescription: React is not tied to the DOM. See how renderers work by building one, and understand what react-dom actually does.
updateDate: 2026-09-05T10:29
author: ['bishal-biswas']
level: 4
tags: ['internals', 'architecture', 'renderers']
course: react
---

## Two packages, one idea

```javascript
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
```

- **`react`** knows about components, hooks, state and the element tree. It knows nothing about the DOM.
- **`react-dom`** knows how to turn that tree into DOM nodes.

That split is deliberate. Swap the second package and the same React code drives something else entirely.

## Renderers that exist

- **react-dom** for the browser.
- **React Native** for iOS and Android views.
- **react-three-fiber** for 3D scenes with Three.js.
- **Ink** for command line interfaces.
- **react-pdf** for PDF documents.
- **Remotion** for videos.

All of them use the same `react` package, the same hooks and the same reconciler. Only the host layer differs.

```javascript
function Scene() {
  const [hovered, setHovered] = useState(false);
  return (
    <mesh
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
    </mesh>
  );
}
```

That is react-three-fiber. `useState`, props and events all behave exactly as you know, and there is no DOM involved.

## The host config

A renderer is built by giving `react-reconciler` a **host config**: an object of functions describing how to create, update and arrange nodes in your target.

```javascript
import ReactReconciler from 'react-reconciler';
const hostConfig = {
  supportsMutation: true,
  createInstance(type, props) {
    return { type, props, children: [] };
  },
  createTextInstance(text) {
    return { type: 'TEXT', text };
  },
  appendInitialChild(parent, child) {
    parent.children.push(child);
  },
  appendChild(parent, child) {
    parent.children.push(child);
  },
  appendChildToContainer(container, child) {
    container.children.push(child);
  },
  removeChild(parent, child) {
    parent.children = parent.children.filter((c) => c !== child);
  },
  insertBefore(parent, child, before) {
    const index = parent.children.indexOf(before);
    parent.children.splice(index, 0, child);
  },
  prepareUpdate() {
    return true;
  },
  commitUpdate(instance, updatePayload, type, oldProps, newProps) {
    instance.props = newProps;
  },
  commitTextUpdate(instance, oldText, newText) {
    instance.text = newText;
  },
  finalizeInitialChildren() {
    return false;
  },
  shouldSetTextContent() {
    return false;
  },
  getRootHostContext() {
    return {};
  },
  getChildHostContext() {
    return {};
  },
  getPublicInstance(instance) {
    return instance;
  },
  prepareForCommit() {
    return null;
  },
  resetAfterCommit(container) {
    console.log(JSON.stringify(container, null, 2));
  },
  clearContainer(container) {
    container.children = [];
  }
};
const reconciler = ReactReconciler(hostConfig);
export function render(element, container) {
  const root = reconciler.createContainer(container, 0, null, false, null, '', () => {}, null);
  reconciler.updateContainer(element, root, null, null);
}
```

There is more to a complete config, but that is the shape. Every function answers one question: how do I make a node, attach it, update it, remove it.

## Using it

```javascript
function App() {
  const [count, setCount] = useState(0);
  return (
    <box>
      <text>Count is {count}</text>
    </box>
  );
}
render(<App />, { children: [] });
```

Hooks work. State works. Context works. Suspense works. The reconciler provides all of it, and your config only says what a `<box>` is in your world.

## What the reconciler handles

Everything you know as React:

- Diffing the element tree between renders.
- Keys and list reconciliation.
- Hooks and their ordering.
- Context propagation.
- Suspense and error boundaries.
- Lanes, priorities and time slicing.

Your host config never sees any of it. It receives instructions like "create this node" and "move this child".

## Mutation and persistence

```javascript
supportsMutation: true;
supportsPersistence: true;
```

**Mutation mode** modifies existing nodes in place. The DOM works this way, so `react-dom` uses it.

**Persistence mode** creates a new node tree on each update, which suits immutable targets. React Native's newer architecture uses this.

Most custom renderers use mutation mode.

## Should you write one?

Almost certainly not. The list of existing renderers covers nearly every real target, and each one represents years of edge case handling.

Write one if you are targeting something genuinely new: a hardware display, a game engine, a document format nobody has covered.

**The value in understanding this is different.** It clarifies what React actually is: a system for describing a tree declaratively and efficiently reconciling changes to it. The DOM is one target, not the definition.

That reframing is useful. It explains why `react` and `react-dom` are separate packages, why React Native shares your React knowledge completely, and why "React is a UI library" is slightly imprecise. React is a reconciler. `react-dom` is the UI library.

## A simpler path

If you want the idea without the depth, `react-test-renderer` and `react-reconciler` based tools already exist for inspecting trees:

```javascript
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
console.log(renderToString(<App />));
```

`react-dom/server` is itself a different renderer, targeting a string rather than DOM nodes. You have been using more than one renderer all along.

## Quick recap

- `react` handles components and state, `react-dom` handles the DOM.
- Renderers exist for native, 3D, terminals, PDFs and video.
- A renderer is `react-reconciler` plus a host config of node operations.
- The reconciler provides hooks, context, Suspense and scheduling for free.
- Mutation mode edits nodes, persistence mode rebuilds them.
- You will rarely write one, but knowing this clarifies what React is.
- `react-dom/server` is another renderer you already use.

<code id="code-content" class="language-javascript">
import ReactReconciler from 'react-reconciler';
import { useState } from 'react';
// A renderer is react-reconciler plus a HOST CONFIG: functions that
// answer "how do I make a node, attach it, update it, remove it" in
// your target. The reconciler supplies hooks, context, Suspense,
// keys and scheduling. Your config never sees any of that.
const hostConfig = {
  supportsMutation: true,              // edit nodes in place, like the DOM
  createInstance(type, props) {
    return { type, props, children: [] };
  },
  createTextInstance(text) {
    return { type: 'TEXT', text };
  },
  appendInitialChild(parent, child) { parent.children.push(child); },
  appendChild(parent, child) { parent.children.push(child); },
  appendChildToContainer(container, child) { container.children.push(child); },
  removeChild(parent, child) {
    parent.children = parent.children.filter((c) =&gt; c !== child);
  },
  insertBefore(parent, child, before) {
    parent.children.splice(parent.children.indexOf(before), 0, child);
  },
  prepareUpdate() { return true; },
  commitUpdate(instance, payload, type, oldProps, newProps) {
    instance.props = newProps;
  },
  commitTextUpdate(instance, oldText, newText) { instance.text = newText; },
  finalizeInitialChildren() { return false; },
  shouldSetTextContent() { return false; },
  getRootHostContext() { return {}; },
  getChildHostContext() { return {}; },
  getPublicInstance(instance) { return instance; },
  prepareForCommit() { return null; },
  resetAfterCommit(container) {
    console.log(JSON.stringify(container, null, 2));
  },
  clearContainer(container) { container.children = []; }
};
const reconciler = ReactReconciler(hostConfig);
export function render(element, container) {
  const root = reconciler.createContainer(
    container, 0, null, false, null, '', () =&gt; {}, null
  );
  reconciler.updateContainer(element, root, null, null);
}
// Now hooks, state, context and Suspense all work, with no DOM anywhere
function App() {
  const [count, setCount] = useState(0);
  return (
    &lt;box padding={4}&gt;
      &lt;text&gt;Count is {count}&lt;/text&gt;
    &lt;/box&gt;
  );
}
render(&lt;App /&gt;, { children: [] });
// RENDERERS THAT ALREADY EXIST: react-dom, React Native,
// react-three-fiber (3D), Ink (terminals), react-pdf, Remotion (video).
// All use the same `react` package and the same hooks.
// YOU WILL RARELY WRITE ONE. The value is in the reframing: React is a
// reconciler for describing a tree declaratively and applying minimal
// changes to it. The DOM is one target, not the definition. That is why
// react and react-dom are separate packages, and why React Native
// reuses your React knowledge completely.
// And you already use more than one renderer:
//   import { renderToString } from 'react-dom/server';
//   renderToString(&lt;App /&gt;);        targets a string, not DOM nodes
</code></pre>
