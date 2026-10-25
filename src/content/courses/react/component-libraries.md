---
publishDate: 2026-05-24T10:09
title: Headless and Component Libraries
slug: component-libraries
metadescription: Compare styled libraries, headless primitives and copy in components, and know why accessible components are harder than they look.
updateDate: 2026-09-05T10:09
author: ['bishal-biswas']
level: 3
tags: ['libraries', 'ui', 'accessibility']
course: react
---

## Why not build your own?

A dropdown looks like an afternoon's work. Here is what a correct one actually needs:

- Open and close on click, Enter and Space.
- Arrow keys to move between options, Home and End to jump.
- Escape to close and return focus to the trigger.
- Type ahead, so pressing `b` jumps to the first option starting with b.
- Close on outside click, but not on a click inside.
- Focus trapped while open, and returned afterwards.
- `role="listbox"`, `aria-expanded`, `aria-activedescendant` and matching ids.
- Repositioning when it would overflow the viewport.
- Touch and screen reader support.

That is a week of work, and most hand rolled versions get maybe half of it. Which means a portion of your users cannot use your dropdown at all.

This is the strongest argument for a library.

## Three kinds

### Styled component libraries

They give you finished, styled components.

**Material UI**, **Mantine**, **Chakra UI**, **Ant Design**.

```javascript
import { Button, TextField, Dialog } from '@mui/material';
function Form() {
  return (
    <Dialog open>
      <TextField label="Email" />
      <Button variant="contained">Save</Button>
    </Dialog>
  );
}
```

**Good for** internal tools, dashboards and prototypes, where shipping fast matters more than looking unique.

**The catch** is that fighting the built in styling to match a specific design is painful, and you inherit a large bundle.

### Headless libraries

Behaviour and accessibility, no styling at all.

**Radix UI**, **Headless UI**, **React Aria**, **Ark UI**.

```javascript
import * as Dialog from '@radix-ui/react-dialog';
function Modal({ children }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="rounded bg-blue-600 px-4 py-2 text-white">
        Open
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6">
          <Dialog.Title className="text-lg font-bold">Title</Dialog.Title>
          {children}
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

You get the portal, the focus trap, escape handling, scroll locking and correct ARIA. You supply every class name.

**Good for** a custom design system, or any product with a real design.

This is the option most teams should choose. You keep full visual control and stop reimplementing keyboard handling.

### Copy in components

**shadcn/ui** popularised a third approach: you copy the component source into your project.

```bash
npx shadcn@latest add button dialog
```

That writes files into `components/ui/`. They are yours now, built on Radix and styled with Tailwind.

**Good because** there is no dependency to fight, and you can edit anything.

**The catch** is that you own maintenance. There is no `npm update` for a bug fix, so you re run the CLI or patch by hand.

## Choosing

- **A dashboard or internal tool, on a deadline?** A styled library.
- **A product with a designer?** Headless, or copy in.
- **A design system for several apps?** Headless, wrapped in your own components.
- **Learning?** Build a few yourself first, so you understand what the libraries are doing.

## Wrap the library

Whatever you pick, do not scatter its API across your codebase.

```javascript
import { Button } from '@mui/material';
<Button variant="contained" color="primary" size="large">Save</Button>
```

```javascript
import { Button as MuiButton } from '@mui/material';
export function Button({ variant = 'primary', ...rest }) {
  return <MuiButton variant={variant === 'primary' ? 'contained' : 'outlined'} {...rest} />;
}
```

```javascript
import { Button } from '@/components/ui/Button.jsx';
<Button variant="primary">Save</Button>
```

Now swapping the library later means rewriting one file rather than four hundred call sites. It also gives you one place to enforce your own defaults.

## Bundle cost

Some libraries are heavy. Check before committing.

```javascript
import { Button } from '@mui/material';
import Button from '@mui/material/Button';
```

The first can pull in far more than you use, depending on the version and your bundler. Check your build output rather than assuming tree shaking saved you.

Headless libraries are usually much lighter, since they ship behaviour rather than styles and themes.

## Do not throw away accessibility

The point of these libraries is correct behaviour. It is easy to undo.

```javascript
<Dialog.Content>
  <div>Title</div>
</Dialog.Content>
```

Skipping `Dialog.Title` removes the accessible name, so a screen reader announces an unnamed dialog. Radix will usually warn you in development.

```javascript
<button className="outline-none">Save</button>
```

Removing the focus ring because it looks untidy makes the component unusable by keyboard. Style it instead:

```javascript
<button className="focus-visible:outline-2 focus-visible:outline-blue-600">
```

`focus-visible` shows the ring for keyboard users and hides it for mouse clicks, which is usually what the designer actually wanted.

## Test with the keyboard

The fastest accessibility check costs nothing. Put your mouse down and use the page with Tab, Shift+Tab, Enter, Space, arrows and Escape.

If you cannot reach something, or cannot see where you are, neither can a keyboard user. This one habit catches most problems.

## Quick recap

- A correct dropdown needs far more than it appears, which is why libraries exist.
- Styled libraries ship finished components and are hard to restyle.
- Headless libraries give behaviour and accessibility with no styles.
- Copy in components give full ownership and full maintenance.
- Wrap whichever you choose in your own components.
- Check bundle cost against your build output.
- Do not remove focus rings or skip accessible names.
- Test with the keyboard, every time.

<code id="code-content" class="language-javascript">
// HEADLESS: behaviour and accessibility, you supply every class.
// This gives you the portal, focus trap, escape handling, scroll lock
// and correct ARIA, none of which is quick to write correctly.
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
export function Modal({ trigger, title, children }) {
  return (
    &lt;Dialog.Root&gt;
      &lt;Dialog.Trigger className="rounded bg-blue-600 px-4 py-2 text-white"&gt;
        {trigger}
      &lt;/Dialog.Trigger&gt;
      &lt;Dialog.Portal&gt;
        &lt;Dialog.Overlay className="fixed inset-0 bg-black/50" /&gt;
        &lt;Dialog.Content className="fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6"&gt;
          {/* NEVER skip Title. Without it a screen reader announces an
              unnamed dialog and the user has no idea what opened. */}
          &lt;Dialog.Title className="text-lg font-bold"&gt;{title}&lt;/Dialog.Title&gt;
          &lt;Dialog.Description className="sr-only"&gt;
            {title} dialog
          &lt;/Dialog.Description&gt;
          {children}
          &lt;Dialog.Close className="mt-4"&gt;Close&lt;/Dialog.Close&gt;
        &lt;/Dialog.Content&gt;
      &lt;/Dialog.Portal&gt;
    &lt;/Dialog.Root&gt;
  );
}
// WRAP THE LIBRARY. Swapping it later then means rewriting one file
// rather than four hundred call sites, and gives you one place to
// enforce your own defaults.
import { Button as MuiButton } from '@mui/material';
export function Button({ variant = 'primary', className, ...rest }) {
  return (
    &lt;MuiButton
      variant={variant === 'primary' ? 'contained' : 'outlined'}
      className={cn(
        // focus-visible shows the ring for keyboard users and hides it
        // for mouse clicks, which is what the designer actually wanted
        'focus-visible:outline-2 focus-visible:outline-blue-600',
        className
      )}
      {...rest}
    /&gt;
  );
}
// NEVER do this. It makes the component unusable by keyboard:
//   &lt;button className="outline-none"&gt;Save&lt;/button&gt;
// Import narrowly, and check your build output rather than assuming
// tree shaking saved you:
//   import { Button } from '@mui/material';          may pull in a lot
//   import Button from '@mui/material/Button';       explicit
// THE CHEAPEST ACCESSIBILITY TEST: put the mouse down and use the page
// with Tab, Shift+Tab, Enter, Space, arrows and Escape. If you cannot
// reach something or cannot see where you are, neither can your users.
</code></pre>
