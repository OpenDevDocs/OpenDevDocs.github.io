---
publishDate: 2026-05-01T09:01
title: NPM, npx and Package Management
slug: node-package-manager-npm
metadescription: Install Node, understand package.json and lockfiles, and learn the handful of npm commands every React project needs.
updateDate: 2026-09-05T09:01
author: ['bishal-biswas']
level: 1
tags: ['prerequisites', 'tooling', 'npm']
course: react
---

## Why you need Node

React itself runs in the browser. Everything around it does not.

JSX has to be compiled, files have to be bundled, and the dev server has to run somewhere. All of that is JavaScript running on your machine, and **Node.js** is what runs it.

## Installing Node

Download the **LTS** version from nodejs.org. LTS means Long Term Support, and it is the one to use unless you have a specific reason not to.

```bash
node --version
npm --version
```

If both print a version, you are ready. npm comes bundled with Node, so there is nothing else to install.

For juggling several Node versions across projects, use a version manager like `nvm` or `fnm`.

## What npm does

npm downloads code other people wrote, records exactly which versions you used, and runs your project's scripts.

```bash
npm install react react-dom
```

That creates two things:

- **`node_modules/`**, the actual downloaded code. Never commit this, it is enormous and rebuildable.
- **`package-lock.json`**, a record of exactly which versions were installed. **Always commit this.**

## package.json

The file describing your project.

```json
{
  "name": "my-react-app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0"
  }
}
```

**dependencies** are needed for the app to run. React goes here.

**devDependencies** are needed only while building. Vite, testing tools and linters go here.

## Version numbers

```json
{
  "react": "^19.2.0"
}
```

Read `MAJOR.MINOR.PATCH`:

- **19** is the major version. Changing it may break things.
- **2** is the minor version. New features, nothing broken.
- **0** is the patch. Bug fixes only.

The `^` means "allow minor and patch updates". So `^19.2.0` accepts `19.3.1` but never `20.0.0`.

## The lockfile matters

Without `package-lock.json`, two people installing on different days can get different versions and see different bugs.

```bash
npm install
npm ci
```

`npm install` respects the ranges in `package.json`. `npm ci` installs exactly what the lockfile says, ignoring ranges. Use `npm ci` in CI pipelines, where you want the same result every single time.

## Scripts

```bash
npm run dev
npm run build
npm run preview
```

`npm run dev` is the one you will type a hundred times a day. It starts the development server, usually at `http://localhost:5173` for Vite.

Scripts can use locally installed tools directly, which is why `"dev": "vite"` works without Vite being installed globally.

## npx

```bash
npx create-vite@latest my-app
```

`npx` runs a package once without permanently installing it. Perfect for project generators, which you use exactly once.

## The commands you actually need

```bash
npm install
npm install react-router-dom
npm install --save-dev vitest
npm uninstall some-package
npm outdated
npm update
npm audit
```

That is genuinely most of it.

## npm, pnpm or yarn?

All three do the same job and read the same `package.json`.

- **npm** ships with Node. The default, and completely fine.
- **pnpm** is faster and uses far less disk space by sharing one copy of each package across projects.
- **yarn** is the older alternative, still widely used.

Pick one per project and commit only its lockfile. Mixing them creates conflicting lockfiles and confusing bugs.

## When something breaks

The traditional first move, and it works more often than it should:

```bash
rm -rf node_modules package-lock.json
npm install
```

If the dev server behaves strangely after switching branches or changing dependencies, this clears the problem most of the time.

## Quick recap

- Node runs your tooling, npm manages your packages.
- `dependencies` ship to users, `devDependencies` only help you build.
- `^19.2.0` allows minor and patch updates but never a major one.
- Commit `package-lock.json`, never commit `node_modules`.
- `npm ci` is the reproducible install for CI.
- `npx` runs a tool once without installing it.
- Deleting `node_modules` and reinstalling fixes a surprising number of problems.

<code id="code-content" class="language-json">
{
  "name": "my-react-app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  },
  "engines": {
    "node": "&gt;=20"
  }
}
</code></pre>
