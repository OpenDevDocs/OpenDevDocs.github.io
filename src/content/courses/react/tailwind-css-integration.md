---
publishDate: 2026-05-24T10:08
title: Tailwind CSS Integration
slug: tailwind-css-integration
metadescription: Set up Tailwind in a React project and learn the patterns that keep utility classes readable rather than chaotic.
updateDate: 2026-09-05T10:08
author: ['bishal-biswas']
level: 3
tags: ['css', 'styling', 'tailwind']
course: react
---

## The idea

Instead of writing CSS in a separate file, you compose small utility classes in the markup.

```javascript
<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
  <h2 className="mb-2 text-xl font-bold text-gray-900">Title</h2>
  <p className="text-gray-600">Body text</p>
</div>
```

**Why people like it:** no naming, no separate file, no dead CSS, and you can see exactly what an element looks like without leaving it.

**Why people dislike it:** the markup gets long, and there is a vocabulary to learn.

Whichever camp you land in, it is extremely common in React, so it is worth knowing.

## Setting up

```bash
npm install tailwindcss @tailwindcss/vite
```

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()]
});
```

```css
@import 'tailwindcss';
```

Tailwind 4 configures itself in CSS rather than a JavaScript config file, which is a change from version 3. If a tutorial shows you `tailwind.config.js` with a `content` array, it is for the older version.

## Theming in CSS

```css
@import 'tailwindcss';
@theme {
  --color-brand: oklch(0.55 0.2 280);
  --color-brand-light: oklch(0.75 0.15 280);
  --font-display: 'Inter', sans-serif;
  --spacing-huge: 8rem;
}
```

Those become utilities automatically: `bg-brand`, `text-brand-light`, `font-display`, `p-huge`.

Because they are CSS custom properties, they are also available to any plain CSS you write, and they can be changed at runtime for theming.

## Conditional classes

This is where React and Tailwind meet, and it needs a helper.

```javascript
<button className={`px-4 py-2 rounded ${isActive ? 'bg-blue-500' : 'bg-gray-200'}`}>
```

Template literals get unreadable fast and leave stray spaces. Use `clsx`:

```bash
npm install clsx tailwind-merge
```

```javascript
import clsx from 'clsx';
function Button({ variant, size, isDisabled, className }) {
  return (
    <button
      className={clsx(
        'rounded font-medium transition-colors',
        variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
        variant === 'ghost' && 'bg-transparent text-blue-600 hover:bg-blue-50',
        size === 'sm' && 'px-3 py-1 text-sm',
        size === 'lg' && 'px-6 py-3 text-lg',
        isDisabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      Click
    </button>
  );
}
```

`clsx` drops every falsy value, so only the classes you want survive.

## The merge problem

```javascript
<Button className="bg-red-500" />
```

If `Button` already applies `bg-blue-600`, you now have both. Which wins depends on their order in the generated stylesheet, not on which you passed. That is unpredictable.

`tailwind-merge` fixes it by removing conflicting utilities, keeping the last one:

```javascript
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

```javascript
function Button({ className, ...rest }) {
  return (
    <button className={cn('rounded bg-blue-600 px-4 py-2 text-white', className)} {...rest} />
  );
}
```

Now `className="bg-red-500"` genuinely overrides. This `cn` helper is close to universal in Tailwind React projects, and it is what shadcn/ui uses.

## Variants with CVA

Once a component has several variants, a chain of `&&` gets messy.

```bash
npm install class-variance-authority
```

```javascript
import { cva } from 'class-variance-authority';
const button = cva('rounded font-medium transition-colors', {
  variants: {
    variant: {
      primary: 'bg-blue-600 text-white hover:bg-blue-700',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
      ghost: 'bg-transparent text-blue-600 hover:bg-blue-50'
    },
    size: {
      sm: 'px-3 py-1 text-sm',
      md: 'px-4 py-2',
      lg: 'px-6 py-3 text-lg'
    }
  },
  defaultVariants: { variant: 'primary', size: 'md' }
});
function Button({ variant, size, className, ...rest }) {
  return <button className={cn(button({ variant, size }), className)} {...rest} />;
}
```

The variants are declared in one readable object, and with TypeScript the prop types come from it automatically.

## Keeping markup readable

The honest criticism of Tailwind is long class strings. Three things help.

**Extract components, not classes.** If you are repeating the same twelve utilities, that is a component.

```javascript
function Card({ children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {children}
    </div>
  );
}
```

**Use the Prettier plugin**, which sorts classes into a consistent order:

```bash
npm install --save-dev prettier-plugin-tailwindcss
```

Consistent order makes long strings scannable, and removes a category of pointless review comments.

**Use `@apply` sparingly.** It exists, and overusing it recreates the CSS file you were trying to avoid. Reach for a component first.

## Dark mode

```javascript
<div className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
```

By default this follows the system setting. For a manual toggle:

```css
@import 'tailwindcss';
@custom-variant dark (&:where(.dark, .dark *));
```

```javascript
function ThemeToggle() {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>Toggle</button>;
}
```

## Quick recap

- Tailwind composes utility classes in the markup.
- Version 4 configures itself in CSS, not a JavaScript config file.
- `@theme` custom properties become utilities automatically.
- Use `clsx` for conditional classes.
- Use `tailwind-merge` so a passed `className` genuinely overrides.
- The combined `cn` helper is the standard pattern.
- CVA organises multi variant components.
- Extract components rather than classes, and sort with the Prettier plugin.

<code id="code-content" class="language-javascript">
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { cva } from 'class-variance-authority';
// THE STANDARD HELPER. clsx drops falsy values, twMerge removes
// conflicting utilities so a passed className actually wins.
// Without twMerge, "bg-blue-600 bg-red-500" resolves by stylesheet
// order, which is unpredictable.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
// CVA keeps multi variant components readable, instead of a long chain
// of &amp;&amp; expressions
const button = cva(
  'rounded font-medium transition-colors focus-visible:outline-2',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
        ghost: 'bg-transparent text-blue-600 hover:bg-blue-50'
      },
      size: {
        sm: 'px-3 py-1 text-sm',
        md: 'px-4 py-2',
        lg: 'px-6 py-3 text-lg'
      }
    },
    defaultVariants: { variant: 'primary', size: 'md' }
  }
);
export function Button({ variant, size, className, ...rest }) {
  // className last, so callers can override anything
  return (
    &lt;button className={cn(button({ variant, size }), className)} {...rest} /&gt;
  );
}
// EXTRACT COMPONENTS, NOT CLASSES. If the same twelve utilities keep
// appearing together, that is a component, not an @apply rule.
export function Card({ className, children }) {
  return (
    &lt;div
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-6 shadow-sm',
        'dark:border-gray-800 dark:bg-gray-900',
        className
      )}
    &gt;
      {children}
    &lt;/div&gt;
  );
}
// Usage: the passed class genuinely overrides the default background
// &lt;Button variant="ghost" size="lg" className="bg-red-500" /&gt;
// ---------- Tailwind 4 configures itself in CSS ----------
// @import 'tailwindcss';
// @theme {
//   --color-brand: oklch(0.55 0.2 280);   becomes bg-brand, text-brand
//   --font-display: 'Inter', sans-serif;  becomes font-display
// }
// @custom-variant dark (&amp;:where(.dark, .dark *));   for a manual toggle
// If a tutorial shows tailwind.config.js with a content array, it is
// for version 3.
// ALSO INSTALL prettier-plugin-tailwindcss. Consistent class order makes
// long strings scannable and removes a whole category of review comments.
</code></pre>
