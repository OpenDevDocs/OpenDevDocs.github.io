---
publishDate: 2026-05-30T10:26
title: Monorepos and Design Systems
slug: monorepos-and-design-systems
metadescription: Share components across several React applications using workspaces, and build a design system people actually use.
updateDate: 2026-09-05T10:26
author: ['bishal-biswas']
level: 4
tags: ['architecture', 'monorepo', 'design-system']
course: react
---

## When you need this

One application does not need a monorepo. The moment you have a second one sharing components, you have a decision to make.

**Copy the code.** Fast, then the copies drift and a bug fix has to be applied three times.

**Publish a package.** Clean boundaries, but every change means version, publish, update, test. A one line fix takes an afternoon.

**A monorepo.** One repository, several packages, shared code with no publishing step.

## Workspaces

```javascript
// package.json
// {
//   "name": "my-monorepo",
//   "private": true,
//   "workspaces": ["apps/*", "packages/*"]
// }
```

```bash
my-monorepo/
  apps/
    web/
    admin/
    marketing/
  packages/
    ui/
    utils/
    config/
  package.json
```

```javascript
// apps/web/package.json
// {
//   "dependencies": {
//     "@repo/ui": "*"
//   }
// }
```

```javascript
import { Button, Card } from '@repo/ui';
```

The package manager links `packages/ui` into `node_modules`, so imports resolve locally. Edit a component and every app sees it immediately.

`pnpm` is generally the best choice here, because it links rather than copying and is strict about undeclared dependencies.

## Task orchestration

Running builds in the right order gets fiddly quickly. Turborepo and Nx handle it.

```javascript
// turbo.json
// {
//   "tasks": {
//     "build": {
//       "dependsOn": ["^build"],
//       "outputs": ["dist/**", ".next/**"]
//     },
//     "test": { "dependsOn": ["^build"] },
//     "dev": { "cache": false, "persistent": true }
//   }
// }
```

```bash
npx turbo build
npx turbo build --filter=web
npx turbo test --filter=...[origin/main]
```

Two things this buys you:

- **`^build`** means "build my dependencies first", so ordering is automatic.
- **Caching.** Unchanged packages are not rebuilt, and the cache can be shared across the team and CI. This is the difference between a two minute and a twenty minute pipeline.

That last filter runs tasks only for packages affected by your changes, which keeps CI fast as the repo grows.

## Shared configuration

```javascript
// packages/config/eslint.js
// export default [ /* shared rules */ ];
// apps/web/eslint.config.js
// import base from '@repo/config/eslint';
// export default [...base, { /* app specific */ }];
```

Do the same for TypeScript, Prettier and Tailwind. One place to change a rule beats six.

## Design systems

A component library is not a design system. A design system is tokens, components, documentation and the conventions around them.

### Start with tokens

```css
@theme {
  --color-primary-500: oklch(0.55 0.2 264);
  --color-danger-500: oklch(0.6 0.22 25);
  --spacing-1: 0.25rem;
  --radius-md: 0.5rem;
  --font-size-base: 1rem;
}
```

Tokens are the vocabulary. Components use tokens, never raw values. Change a token and every component follows.

Semantic names beat literal ones: `--color-danger` survives a rebrand, `--color-red` does not.

### Then components

```javascript
import { cva } from 'class-variance-authority';
import { cn } from './utils.js';
const button = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary-500 text-white hover:bg-primary-600',
        danger: 'bg-danger-500 text-white hover:bg-danger-600',
        ghost: 'bg-transparent hover:bg-gray-100'
      },
      size: { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4', lg: 'h-12 px-6' }
    },
    defaultVariants: { variant: 'primary', size: 'md' }
  }
);
export function Button({ variant, size, className, ...rest }) {
  return <button className={cn(button({ variant, size }), className)} {...rest} />;
}
```

Three properties every design system component needs:

- **Constrained variants**, so people cannot invent a fourth button style.
- **An escape hatch**, the `className` prop, so nobody has to fork the component for one edge case.
- **Prop forwarding**, so every native attribute still works.

Without the escape hatch, people copy your component and modify it, and now you have two.

### Document it

```javascript
export default {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'danger', 'ghost'] }
  }
};
export const Primary = { args: { children: 'Save' } };
export const Danger = { args: { variant: 'danger', children: 'Delete' } };
export const Loading = { args: { disabled: true, children: 'Saving...' } };
```

Storybook is the usual tool. Documentation is what makes the difference between a design system people use and one they work around.

If someone cannot find out whether a button variant exists, they will write their own.

## Versioning

```bash
npx changeset
npx changeset version
npx changeset publish
```

Changesets asks what changed and how significant it is, then handles version bumps and changelogs across packages.

Even internally, communicating breaking changes matters. A silent change to a shared `Button` breaks three applications at once.

## What usually goes wrong

**Building it too early.** A design system needs real usage to be shaped correctly. Extract from working products rather than designing in the abstract.

**No escape hatch.** People fork it, and you now maintain divergent copies.

**No owner.** A shared library nobody maintains rots quickly.

**Too flexible.** If `Button` takes thirty props, it is not a design system, it is a `button` with extra steps.

**No adoption plan.** Building it is a fraction of the work. Migrating the apps is the rest.

## Quick recap

- Workspaces link local packages so imports resolve with no publishing.
- Turborepo or Nx handle build order and caching.
- Share lint, TypeScript and Tailwind configuration from one package.
- Tokens come first, and components use tokens rather than raw values.
- Constrain variants, but always provide a `className` escape hatch.
- Document with Storybook, or people will write their own components.
- Use changesets for versions and changelogs.
- Extract a design system from real products, do not design it upfront.

<code id="code-content" class="language-javascript">
// ---------- Repository layout ----------
// my-monorepo/
//   apps/       web, admin, marketing
//   packages/   ui, utils, config
//   package.json  { "private": true, "workspaces": ["apps/*", "packages/*"] }
// The package manager LINKS packages/ui into node_modules, so this
// resolves locally with no publishing step:
//   import { Button, Card } from '@repo/ui';
// ---------- turbo.json: build order and caching ----------
// {
//   "tasks": {
//     "build": {
//       "dependsOn": ["^build"],       ^ means "my dependencies first"
//       "outputs": ["dist/**"]
//     },
//     "dev": { "cache": false, "persistent": true }
//   }
// }
// Run only what your changes affected, which keeps CI fast:
//   npx turbo test --filter=...[origin/main]
// ---------- packages/ui/Button.jsx ----------
import { cva } from 'class-variance-authority';
import { cn } from './utils.js';
// TOKENS FIRST. Components use tokens, never raw values, so changing
// --color-primary-500 updates everything. Semantic names survive a
// rebrand: --color-danger does, --color-red does not.
const button = cva(
  'inline-flex items-center justify-center rounded-md font-medium ' +
    'transition-colors focus-visible:outline-2 ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      // CONSTRAINED variants, so nobody invents a fourth button style
      variant: {
        primary: 'bg-primary-500 text-white hover:bg-primary-600',
        danger: 'bg-danger-500 text-white hover:bg-danger-600',
        ghost: 'bg-transparent hover:bg-gray-100'
      },
      size: { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4', lg: 'h-12 px-6' }
    },
    defaultVariants: { variant: 'primary', size: 'md' }
  }
);
export function Button({ variant, size, className, ...rest }) {
  return (
    &lt;button
      // The ESCAPE HATCH matters. Without a className prop, people fork
      // the component for one edge case and you now maintain two.
      className={cn(button({ variant, size }), className)}
      {...rest}                        // every native attribute still works
    /&gt;
  );
}
// ---------- Button.stories.jsx: documentation people can find ----------
// export default { title: 'Components/Button', component: Button };
// export const Primary = { args: { children: 'Save' } };
// export const Danger = { args: { variant: 'danger', children: 'Delete' } };
// If someone cannot find out whether a variant exists, they write their own.
// ---------- Versioning across packages ----------
//   npx changeset            describe what changed and how big it is
//   npx changeset version    bump versions and write changelogs
// WHAT GOES WRONG: building it too early, no escape hatch, no owner,
// thirty props on Button, and no plan for migrating the existing apps.
</code></pre>
