---
publishDate: 2026-03-30T09:51
title: Package Managers (npm, yarn)
slug: package-managers-npm-yarn
metadescription: Install and manage dependencies with npm, pnpm and yarn. Understand package.json, lockfiles, semantic versioning and scripts.
updateDate: 2026-09-05T09:51
author: ['bishal-biswas']
level: 3
tags: ['tooling', 'npm']
course: javascript
---

## What a package manager does

It downloads code other people wrote, keeps track of exactly which versions you are using, and makes sure everyone on your team gets the same thing.

npm comes bundled with Node.js, so if you have Node you already have npm.

## Starting a project

```bash
npm init
npm init -y
```

That creates `package.json`, the file describing your project.

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest"
  },
  "dependencies": {
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "vite": "^5.4.0"
  }
}
```

`"type": "module"` tells Node to treat `.js` files as ES modules, so `import` works instead of `require`.

## Installing

```bash
npm install axios
npm install --save-dev vitest
npm install --global typescript
npm install
```

The difference matters:

- **dependencies** are needed for the app to run.
- **devDependencies** are only needed while developing, such as test runners and bundlers.

Getting this wrong bloats production installs, or breaks them when a runtime dependency was filed as a dev one.

## Semantic versioning

```json
{
  "axios": "1.7.2"
}
```

Read `MAJOR.MINOR.PATCH`:

- **PATCH** (1.7.2 to 1.7.3) is a bug fix, safe.
- **MINOR** (1.7.2 to 1.8.0) adds features without breaking anything, safe.
- **MAJOR** (1.7.2 to 2.0.0) contains breaking changes, so read the notes.

The symbol in front changes what is allowed:

```json
{
  "caret": "^1.7.2",
  "tilde": "~1.7.2",
  "exact": "1.7.2",
  "range": ">=1.7.2 <2.0.0"
}
```

- `^` allows minor and patch updates. This is the default.
- `~` allows patch updates only.
- No symbol means exactly that version.

## The lockfile

`package-lock.json` records the **exact** version of every package, including the dependencies of your dependencies.

```bash
git add package-lock.json
```

**Always commit the lockfile.** Without it, two people installing on different days can get different versions, and you get the classic "it works on my machine".

```bash
npm ci
```

`npm ci` installs strictly from the lockfile, ignoring the ranges in `package.json`. It is faster and reproducible, which is why it is what you want in CI pipelines.

## Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest",
    "lint": "eslint src",
    "format": "prettier --write src"
  }
}
```

```bash
npm run dev
npm test
npm run lint
```

`test`, `start` and a few others can drop the `run`. Everything else needs it.

Scripts can chain:

```json
{
  "scripts": {
    "build": "npm run clean && vite build",
    "clean": "rm -rf dist",
    "prebuild": "npm run lint"
  }
}
```

Anything named `preX` runs automatically before `X`, and `postX` runs after.

Scripts can use locally installed binaries directly, without a global install. That is why `"dev": "vite"` works.

## npx

```bash
npx create-vite@latest my-app
npx eslint src
```

`npx` runs a package without installing it permanently. Perfect for one off tools like project generators.

## Updating

```bash
npm outdated
npm update
npm install axios@latest
npm install axios@1.7.2
```

`npm update` respects your version ranges, so it will not jump a major version. For that you must ask explicitly, and read the changelog first.

## Auditing

```bash
npm audit
npm audit fix
npm audit fix --force
```

Be careful with `--force`. It can install breaking major versions to resolve an advisory. Read what it plans to do.

Not every advisory matters equally. A vulnerability in a dev only tool that never touches user input is not the same as one in your server framework.

## Removing

```bash
npm uninstall axios
npm prune
```

Fewer dependencies is genuinely better. Every package is code you ship, code you must trust, and a potential security advisory. Before installing something, ask whether ten lines of your own would do.

## npm, yarn or pnpm?

All three read `package.json` and do the same job.

**npm** ships with Node and needs no setup. The default choice.

**yarn** was created when npm was slow and lacked a lockfile. Modern yarn has Plug'n'Play, which skips `node_modules` entirely.

**pnpm** stores one copy of each package version on your machine and links to it. Much less disk space, faster installs, and it is stricter about undeclared dependencies, which catches real bugs.

```bash
npm install
yarn install
pnpm install
npm run dev
yarn dev
pnpm dev
```

> **Pick one per project and commit only its lockfile.** Mixing them produces conflicting lockfiles and confusing bugs. Note them in your README so nobody guesses.

## Monorepo workspaces

```json
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": ["packages/*"]
}
```

Workspaces let several packages share one install and reference each other locally. All three managers support them.

## Publishing your own

```bash
npm login
npm publish
npm version patch
npm publish
```

Before publishing, check what will actually be included:

```bash
npm pack --dry-run
```

Use the `files` field in `package.json`, or a `.npmignore`, so you do not ship tests and source maps to everyone.

## Quick recap

- `package.json` describes your project, dependencies and scripts.
- Runtime code goes in `dependencies`, tooling in `devDependencies`.
- `^` allows minor updates, `~` allows patches only.
- Commit the lockfile, and use `npm ci` in CI for reproducible installs.
- `npm run` executes scripts, and `pre` and `post` hooks run automatically.
- `npx` runs a tool without installing it.
- Pick one package manager per project and stick to it.

<code id="code-content" class="language-json">
{
  "name": "my-app",
  "version": "1.0.0",
  "type": "module",
  "description": "type: module makes .js files ES modules, so import works",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest",
    "lint": "eslint src",
    "prebuild": "npm run lint",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vitest": "^2.0.0",
    "eslint": "^9.0.0"
  },
  "engines": {
    "node": ">=20"
  },
  "files": ["dist"]
}
</code></pre>
