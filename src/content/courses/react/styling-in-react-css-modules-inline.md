---
publishDate: 2026-05-06T09:16
title: 'Styling: CSS, CSS Modules and Inline Styles'
slug: styling-in-react-css-modules-inline
metadescription: Compare plain CSS, CSS Modules, inline styles and utility classes, and learn how to build class names conditionally.
updateDate: 2026-09-05T09:16
author: ['bishal-biswas']
level: 1
tags: ['css', 'styling', 'basics']
course: react
---

## Plain CSS

Import a stylesheet and use `className`.

```javascript
import './Button.css';
function Button({ label }) {
  return <button className="btn btn-primary">{label}</button>;
}
```

```css
.btn {
  padding: 8px 16px;
  border-radius: 6px;
}
```

Simple, and everyone knows CSS. The catch is that **every imported stylesheet is global**. Two components both defining `.card` will fight, and the last one imported wins.

That works fine for a small project and becomes a real problem as it grows.

## CSS Modules

Same CSS, but scoped automatically. Name the file `*.module.css`.

```css
.button {
  padding: 8px 16px;
  border-radius: 6px;
}
.primary {
  background: rebeccapurple;
  color: white;
}
```

```javascript
import styles from './Button.module.css';
function Button({ label }) {
  return <button className={`${styles.button} ${styles.primary}`}>{label}</button>;
}
```

The build tool rewrites `.button` into something unique like `Button_button__x3f9a`. Your class names can never collide with another file's, no matter what you call them.

Vite supports this with no configuration. Just use the `.module.css` extension.

```javascript
console.log(styles.button);
```

Note that `styles.button` is `undefined` if you misspell it, and the element quietly gets no class. That silent failure is the main downside.

## Inline styles

```javascript
function Box() {
  return (
    <div style={{ padding: 16, backgroundColor: 'lavender', borderRadius: 8 }}>
      Content
    </div>
  );
}
```

Two braces: the outer pair enters JavaScript, the inner pair is the object.

The rules:

- Property names are **camelCase**, so `background-color` is `backgroundColor`.
- Numbers get `px` added automatically, so `padding: 16` means `16px`.
- Values that are not lengths need units or strings: `width: '50%'`, `lineHeight: 1.5`.

**Inline styles cannot do** hover, focus, media queries, or pseudo elements. There is no `:hover` in an inline style object.

So use them only for genuinely dynamic values:

```javascript
function ProgressBar({ percent }) {
  return (
    <div className="track">
      <div className="fill" style={{ width: `${percent}%` }} />
    </div>
  );
}
```

The layout comes from a class, and only the one changing value is inline. That is the right split.

## Building class names conditionally

This comes up constantly.

```javascript
function Button({ variant, isActive, isDisabled }) {
  return (
    <button className={`btn btn-${variant} ${isActive ? 'active' : ''}`}>
      Click
    </button>
  );
}
```

That works but gets ugly fast, and leaves stray spaces. A small helper is much nicer:

```javascript
function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}
function Button({ variant, isActive, isDisabled }) {
  return (
    <button
      className={cx('btn', `btn-${variant}`, isActive && 'active', isDisabled && 'disabled')}
    >
      Click
    </button>
  );
}
```

`filter(Boolean)` drops every `false` and `undefined`, so only the classes you want survive. The popular `clsx` package is this idea with a few extras, and it is tiny.

## Tailwind CSS

Utility classes written directly in the markup.

```javascript
function Card({ title, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:bg-gray-800">
      <h2 className="mb-2 text-xl font-bold">{title}</h2>
      <div className="text-gray-600 dark:text-gray-300">{children}</div>
    </div>
  );
}
```

**People like it** because there is no naming, no separate file, no dead CSS, and the styles are right there with the markup.

**People dislike it** because the markup gets noisy and it takes time to learn the class names.

It is extremely popular in the React ecosystem, so you will meet it. Combine it with the `cx` helper for conditional classes.

## CSS-in-JS

```javascript
const Button = styled.button`
  padding: 8px 16px;
  background: ${(props) => (props.primary ? 'purple' : 'white')};
`;
```

Libraries like styled-components put CSS inside JavaScript with full access to props.

Worth knowing that this approach has fallen out of favour. Runtime CSS-in-JS adds a performance cost and does not work well with Server Components. New projects generally choose CSS Modules, Tailwind, or a zero runtime option like vanilla-extract.

## Which should you pick?

- **Learning React?** Plain CSS. One less thing to think about.
- **A real project?** CSS Modules or Tailwind. Both scope reliably.
- **A design system?** CSS Modules with CSS custom properties for theming.
- **Dynamic values?** Inline styles, for those values only.

The honest answer is that all of them work. Consistency within a project matters more than the choice.

## Theming with CSS variables

```css
:root {
  --colour-primary: rebeccapurple;
  --radius: 8px;
}
[data-theme='dark'] {
  --colour-primary: plum;
}
.btn {
  background: var(--colour-primary);
  border-radius: var(--radius);
}
```

```javascript
function App() {
  const [theme, setTheme] = useState('light');
  return (
    <div data-theme={theme}>
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        Toggle theme
      </button>
    </div>
  );
}
```

React changes one attribute, and CSS does the rest. This works with every approach above and is far cheaper than re-rendering styled components.

## Quick recap

- Imported CSS is global, so class names can collide.
- CSS Modules scope automatically, using the `.module.css` extension.
- Inline styles are objects with camelCase keys, and numbers become pixels.
- Inline styles cannot do hover, focus or media queries.
- Use a `cx` helper to build class names conditionally.
- Tailwind is very common in React and pairs well with `cx`.
- Runtime CSS-in-JS is falling out of favour, partly due to Server Components.
- CSS custom properties are the cheapest way to theme.

<code id="code-content" class="language-javascript">
import { useState } from 'react';
import styles from './Button.module.css';   // scoped, never collides
import './global.css';                      // imported CSS is global
// A tiny helper for conditional class names. filter(Boolean) drops
// every false and undefined, so no stray spaces are left behind.
function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}
function Button({ variant = 'primary', isActive, isDisabled, children }) {
  return (
    &lt;button
      className={cx(
        styles.button,
        styles[variant],
        isActive &amp;&amp; styles.active,
        isDisabled &amp;&amp; styles.disabled
      )}
      disabled={isDisabled}
    &gt;
      {children}
    &lt;/button&gt;
  );
}
// Inline styles: outer braces enter JavaScript, inner braces are the object.
// camelCase keys, and plain numbers become pixels.
// Use them ONLY for values that genuinely change, never for layout,
// because they cannot do hover, focus or media queries.
function ProgressBar({ percent }) {
  return (
    &lt;div className="track"&gt;
      &lt;div className="fill" style={{ width: percent + '%' }} /&gt;
    &lt;/div&gt;
  );
}
// Tailwind puts the utilities straight in the markup
function Card({ title, children }) {
  return (
    &lt;div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-800"&gt;
      &lt;h2 className="mb-2 text-xl font-bold"&gt;{title}&lt;/h2&gt;
      &lt;div className="text-gray-600 dark:text-gray-300"&gt;{children}&lt;/div&gt;
    &lt;/div&gt;
  );
}
// Theming: React flips one attribute, CSS custom properties do the work.
// Far cheaper than re-rendering styled components.
export default function App() {
  const [theme, setTheme] = useState('light');
  return (
    &lt;div data-theme={theme}&gt;
      &lt;Card title="Styling"&gt;
        &lt;ProgressBar percent={64} /&gt;
        &lt;Button variant="primary" isActive&gt;
          Save
        &lt;/Button&gt;
      &lt;/Card&gt;
      &lt;button onClick={() =&gt; setTheme(theme === 'light' ? 'dark' : 'light')}&gt;
        Toggle theme
      &lt;/button&gt;
    &lt;/div&gt;
  );
}
</code></pre>
