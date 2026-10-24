---
publishDate: 2026-05-25T10:13
title: Accessibility in React
slug: accessibility-a11y-in-react
metadescription: Build interfaces everyone can use, with semantic markup, keyboard support, focus management and correct ARIA.
updateDate: 2026-09-05T10:13
author: ['bishal-biswas']
level: 3
tags: ['accessibility', 'ux', 'quality']
course: react
---

## Why it matters

Roughly one person in six has a disability. Some use screen readers, some cannot use a mouse, some need large text, and many are simply on a phone in bright sunlight with one hand free.

Accessibility is also legally required in many places, and it overlaps almost entirely with good engineering. Semantic markup is better for SEO, keyboard support helps power users, and clear focus states help everyone.

## Use the right element

Most accessibility problems come from using a `<div>` for something that already exists.

```javascript
<div className="button" onClick={handleClick}>Save</div>
<button onClick={handleClick}>Save</button>
```

The real `<button>` gives you, for free:

- Keyboard focus in the tab order.
- Enter and Space activation.
- Announced as "button" by screen readers.
- A `disabled` state.
- The browser's focus styling.

Recreating that on a `<div>` takes a `tabIndex`, a `role`, a keydown handler for two keys, and an `aria-disabled`. And you will forget one.

```javascript
<div onClick={goToPage}>Read more</div>
<a href="/article">Read more</a>
<div className="heading-large">Section</div>
<h2>Section</h2>
```

**A link navigates. A button acts.** If it changes the URL, use `<a>`. If it does something on the page, use `<button>`.

## Landmarks and headings

```javascript
function Page() {
  return (
    <>
      <header>
        <nav aria-label="Main">...</nav>
      </header>
      <main>
        <h1>Page title</h1>
        <section aria-labelledby="products-heading">
          <h2 id="products-heading">Products</h2>
        </section>
      </main>
      <footer>...</footer>
    </>
  );
}
```

Screen reader users navigate by landmarks and headings, the way a sighted user scans a page. Get these right and the page becomes navigable.

Two rules: **one `<h1>` per page**, and **do not skip levels**. Going from `<h2>` to `<h4>` because it looked better is a common mistake. Size it with CSS instead.

## Labels

```javascript
<input type="email" placeholder="Email" />
<label htmlFor="email">Email</label>
<input id="email" type="email" />
```

A placeholder is not a label. It disappears when typing starts, it usually fails contrast requirements, and some screen readers ignore it.

Use `useId` so the ids are unique per instance:

```javascript
function Field({ label, ...rest }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} {...rest} />
    </div>
  );
}
```

For an icon only button:

```javascript
<button onClick={close}>
  <XIcon />
</button>
<button onClick={close} aria-label="Close dialog">
  <XIcon aria-hidden="true" />
</button>
```

The first announces as an unnamed button. The second is clear, and `aria-hidden` stops the icon adding noise.

## Keyboard support

Test by putting your mouse down. Tab through the whole page.

- Can you reach everything interactive?
- Can you see where you are?
- Does the order match the visual layout?
- Can you escape from menus and modals?

```javascript
<button className="outline-none">Save</button>
<button className="focus-visible:outline-2 focus-visible:outline-blue-600">
  Save
</button>
```

**Never remove the focus indicator.** If it looks wrong, restyle it. `focus-visible` shows it for keyboard users and hides it for mouse clicks, which is what most designers actually want.

A skip link helps keyboard users past long navigation:

```javascript
<a href="#main" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
<main id="main">...</main>
```

## Focus management

Single page apps break focus, because navigation does not reload the page.

```javascript
function RouteAnnouncer() {
  const { pathname } = useLocation();
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [pathname]);
  return <h1 ref={headingRef} tabIndex={-1}>Page title</h1>;
}
```

Without this, a screen reader user clicks a link and hears nothing, because focus stayed on the old link.

`tabIndex={-1}` makes an element focusable programmatically without adding it to the tab order.

For modals, focus moves in on open and returns to the trigger on close, as covered in the portals topic.

## Announcing changes

```javascript
function SaveStatus({ status }) {
  return (
    <div role="status" aria-live="polite">
      {status === 'saving' && 'Saving...'}
      {status === 'saved' && 'Changes saved'}
    </div>
  );
}
```

A live region announces its content when it changes. Without one, a visual "Saved" message is invisible to a screen reader user.

- **`aria-live="polite"`** waits for a pause. Use this almost always.
- **`aria-live="assertive"`** interrupts. Reserve it for errors that block the user.

The container must exist **before** the content changes, so render it empty rather than conditionally.

## ARIA rules

The first rule of ARIA is **do not use ARIA** when a real element would do.

```javascript
<div role="button" tabIndex={0} onKeyDown={handleKey} onClick={handleClick}>
<button onClick={handleClick}>
```

When you do need it, keep it accurate:

```javascript
<button aria-expanded={isOpen} aria-controls="menu">Menu</button>
<ul id="menu" hidden={!isOpen}>...</ul>
<input aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />
{error && <p id={errorId}>{error}</p>}
```

Wrong ARIA is worse than none. `aria-expanded="false"` on a menu that is open actively misleads.

## Images and motion

```javascript
<img src={photo} alt="A red bicycle leaning against a blue wall" />
<img src={decorativeSwirl} alt="" />
<img src={photo} alt="photo" />
```

Describe what matters. An empty `alt` is correct for decoration, and tells the screen reader to skip it. `alt="photo"` is noise.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Testing

```bash
npm install --save-dev @axe-core/react eslint-plugin-jsx-a11y
```

```javascript
import { axe } from 'vitest-axe';
test('has no accessibility violations', async () => {
  const { container } = render(<SignupForm />);
  expect(await axe(container)).toHaveNoViolations();
});
```

Automated tools catch perhaps a third of issues: missing labels, poor contrast, invalid ARIA. They cannot tell you whether your focus order makes sense or your alt text is meaningful.

**The manual checks that catch the rest:**

1. Tab through the page with no mouse.
2. Zoom to 200% and check nothing is cut off.
3. Turn on a screen reader and use one flow. VoiceOver on Mac, NVDA on Windows.
4. Check colour contrast with browser DevTools.

Half an hour with a screen reader teaches you more than any checklist.

## Quick recap

- Use the real element before reaching for a `div` and ARIA.
- Landmarks and a correct heading order make a page navigable.
- Labels are required, and placeholders are not labels.
- Never remove focus indicators, restyle them with `focus-visible`.
- Move focus on route change, and back to the trigger after a modal.
- Live regions announce dynamic changes, and must exist beforehand.
- Wrong ARIA is worse than none.
- Automated tests catch a third, so tab through it and try a screen reader.

<code id="code-content" class="language-javascript">
import { useId, useRef, useEffect } from 'react';
// USE THE REAL ELEMENT. A button gives you tab order, Enter and Space
// activation, the correct announcement and a disabled state, for free.
//   &lt;div className="button" onClick={save}&gt;Save&lt;/div&gt;     wrong
//   &lt;button onClick={save}&gt;Save&lt;/button&gt;                  right
// A link navigates, a button acts.
function Field({ label, error, ...rest }) {
  const id = useId();                     // unique per instance
  const errorId = id + '-error';
  return (
    &lt;div&gt;
      {/* A placeholder is NOT a label. It vanishes when typing starts. */}
      &lt;label htmlFor={id}&gt;{label}&lt;/label&gt;
      &lt;input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      /&gt;
      {error &amp;&amp; &lt;p id={errorId} className="error"&gt;{error}&lt;/p&gt;}
    &lt;/div&gt;
  );
}
// An icon only button needs an accessible name, and the icon itself
// should be hidden so it does not add noise
function CloseButton({ onClose }) {
  return (
    &lt;button onClick={onClose} aria-label="Close dialog"
            className="focus-visible:outline-2 focus-visible:outline-blue-600"&gt;
      &lt;XIcon aria-hidden="true" /&gt;
    &lt;/button&gt;
  );
}
// NEVER remove the focus ring. focus-visible shows it for keyboard
// users and hides it for mouse clicks, which is what designers mean.
//   &lt;button className="outline-none"&gt;   makes this unusable by keyboard
// A live region announces changes. It must exist BEFORE the content
// changes, so render it empty rather than conditionally.
function SaveStatus({ status }) {
  return (
    &lt;div role="status" aria-live="polite"&gt;
      {status === 'saving' &amp;&amp; 'Saving...'}
      {status === 'saved' &amp;&amp; 'Changes saved'}
    &lt;/div&gt;
  );
}
// Single page navigation breaks focus. Without this, a screen reader
// user clicks a link and hears nothing at all.
function Page({ pathname, title }) {
  const headingRef = useRef(null);
  useEffect(() =&gt; {
    headingRef.current?.focus();
  }, [pathname]);
  return (
    &lt;&gt;
      &lt;a href="#main" className="sr-only focus:not-sr-only"&gt;
        Skip to main content
      &lt;/a&gt;
      &lt;header&gt;&lt;nav aria-label="Main"&gt;...&lt;/nav&gt;&lt;/header&gt;
      &lt;main id="main"&gt;
        {/* tabIndex -1 is focusable in code but not in the tab order.
            One h1 per page, and never skip heading levels. */}
        &lt;h1 ref={headingRef} tabIndex={-1}&gt;{title}&lt;/h1&gt;
        &lt;section aria-labelledby="products-heading"&gt;
          &lt;h2 id="products-heading"&gt;Products&lt;/h2&gt;
        &lt;/section&gt;
      &lt;/main&gt;
    &lt;/&gt;
  );
}
// Describe what matters. An empty alt is CORRECT for decoration.
//   &lt;img src={photo} alt="A red bicycle against a blue wall" /&gt;
//   &lt;img src={swirl} alt="" /&gt;          decorative, skipped
//   &lt;img src={photo} alt="photo" /&gt;     noise
// THE MANUAL CHECKS automated tools cannot do:
// 1. Tab through the page with no mouse.
// 2. Zoom to 200% and check nothing is cut off.
// 3. Turn on VoiceOver or NVDA and complete one flow.
// 4. Check contrast in DevTools.
</code></pre>
