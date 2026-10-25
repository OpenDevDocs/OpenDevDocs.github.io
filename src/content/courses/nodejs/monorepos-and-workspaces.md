---
publishDate: 2026-10-25T13:05
title: Monorepos and Workspaces
slug: monorepos-and-workspaces
metadescription: Keep several related Node packages in one repository with npm workspaces, share code between them, and see when pnpm or Turborepo helps.
updateDate: 2026-10-25T13:05
author: ['bishal-biswas']
level: 4
tags: ['npm', 'workspaces', 'monorepo']
course: nodejs
---

## What is a monorepo?

Picture a family that keeps everyone's documents in one filing cabinet, with one drawer per person. Everything is in one place, but each drawer is still separate.

A **monorepo** is the same idea for code: one Git repository that holds several packages. For example, a notes app might have:

- an API server,
- a command-line tool,
- a small shared library that both of them use to format notes.

The opposite is a **polyrepo**: one repository per package. That works too, but every change to the shared library means publishing a new version, then updating the other two repositories. In a monorepo, you change the library and the API in one commit.

## What are workspaces?

A **workspace** is one package inside the monorepo. Each workspace has its own `package.json`, its own name and its own scripts.

**npm workspaces** is the built-in npm feature that makes this work. It does three useful things:

1. Runs one `npm install` for the whole repository.
2. Links workspaces to each other, so `import '@notes/format'` finds your local folder instead of downloading from npm.
3. Lets you run a script in one workspace or in all of them from the root.

You do not need to install anything extra. It is part of npm.

## Setting up the folders

Here is the layout:

```text
notes-monorepo/
  package.json          <- the root, lists the workspaces
  package-lock.json     <- one lockfile for everything
  packages/
    format/
      package.json      <- @notes/format
      index.js
      index.test.js
  apps/
    api/
      package.json      <- @notes/api
      server.js
```

### The root package.json

```json
{
  "name": "notes-monorepo",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "npm test --workspaces --if-present"
  }
}
```

- **`workspaces`** lists the folders that contain workspaces. `packages/*` means "every folder directly inside `packages`".
- **`"private": true`** stops anyone from publishing the root by accident. The root is just a container.

### A shared library

```json
{
  "name": "@notes/format",
  "version": "1.0.0",
  "type": "module",
  "exports": "./index.js",
  "scripts": {
    "test": "node --test"
  }
}
```

```javascript
// packages/format/index.js
export function formatNote(note) {
  return `${note.title} (by ${note.author})`;
}
```

### An app that uses it

```json
{
  "name": "@notes/api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@notes/format": "^1.0.0"
  },
  "scripts": {
    "start": "node server.js"
  }
}
```

```javascript
// apps/api/server.js
import { formatNote } from '@notes/format';

console.log(formatNote({ title: 'Shopping', author: 'Ravi' }));
```

The API lists `@notes/format` as a normal dependency. Because a workspace with that name and a matching version exists, npm links the local folder instead of looking on the registry.

## Installing

Run one install from the root:

```bash
npm install
```

npm creates a single `node_modules` folder at the root. Inside it, `@notes/format` and `@notes/api` are **symlinks** (shortcuts) that point to your real folders:

```bash
npm ls --workspaces
```

```text
notes-monorepo@
+-- @notes/api@1.0.0 -> .\apps\api
| `-- @notes/format@1.0.0 deduped -> .\packages\format
`-- @notes/format@1.0.0 -> .\packages\format
```

Edit `packages/format/index.js` and the API sees the change straight away. No publishing, no reinstalling.

> **Note:** Third-party packages are usually **hoisted**, meaning installed once in the root `node_modules` and shared by every workspace. That saves disk space and keeps versions consistent.

## Running scripts

### In one workspace: `-w`

The `-w` flag (short for `--workspace`) picks one workspace by name or by folder:

```bash
npm start -w @notes/api
npm test -w packages/format
```

```text
> @notes/api@1.0.0 start
> node server.js

Shopping (by Ravi)
```

### In every workspace: `--workspaces`

```bash
npm test --workspaces --if-present
```

- **`--workspaces`** (or `-ws`) runs the script in each workspace.
- **`--if-present`** skips workspaces that do not have that script, instead of failing.

That is exactly what the root `test` script does, so `npm test` at the root tests everything.

### Adding a dependency to one workspace

```bash
npm install zod -w @notes/api
npm install --save-dev typescript -w @notes/format
```

The dependency is written into that workspace's `package.json`, not the root one.

### Creating a new workspace

```bash
npm init -w packages/cli
```

This makes the folder, writes a starter `package.json`, and adds it to the workspace setup.

## Publishing from a monorepo

Workspaces that are libraries (like `@notes/format`) can be published to npm on their own. Apps usually stay `"private": true`.

```bash
npm publish -w @notes/format --access public
```

Everything from [the Building CLIs and Publishing lesson](/courses/nodejs/building-and-publishing-cli-tools) still applies: check with `npm pack --dry-run -w @notes/format` first.

## When npm workspaces is not enough

npm workspaces is great for small and medium monorepos. Two popular tools help when the repository grows.

### pnpm

**pnpm** is another package manager. It is fast, saves disk space by storing each package version only once on your machine, and is strict: a workspace can only import packages it actually lists. Workspaces are declared in a separate file:

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

Local dependencies use the `workspace:` protocol, which says "always use the local copy":

```json
{
  "dependencies": {
    "@notes/format": "workspace:*"
  }
}
```

`pnpm -r run build` runs a script in every workspace, and it sorts them so a package is built after the packages it depends on.

### Turborepo

**Turborepo** is a task runner that sits on top of npm, pnpm or Yarn workspaces. It adds two things:

- **Dependency-aware ordering**: build `@notes/format` before `@notes/api`, and run independent tasks in parallel.
- **Caching**: if nothing in a package changed, it replays the previous output instead of running the task again.

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {}
  }
}
```

That is a `turbo.json` file. `"^build"` means "first build everything I depend on". You run it with `npx turbo run build`.

> **Tip:** Start with plain npm workspaces. Reach for Turborepo when your builds get slow, and for pnpm when you want stricter dependencies or faster installs.

## Common mistakes

**Running `npm install` inside a workspace folder.** That can create a second lockfile and a second `node_modules`. Always install from the root, using `-w` to target a workspace.

```bash
# Wrong
cd apps/api
npm install zod
```

```bash
# Right
npm install zod -w @notes/api
```

**Version ranges that do not match.** If the API asks for `"@notes/format": "^2.0.0"` but the local package is `1.0.0`, npm tries to download version 2 from the registry. Keep the ranges in step with the local versions.

**Forgetting `"private": true` on the root.** Without it, a stray `npm publish` at the root could upload your whole repository.

**Expecting npm to sort builds.** npm runs workspace scripts in the order it finds the workspaces, not in dependency order. If one package must build before another, use a tool like Turborepo or pnpm, or list the workspaces in the right order.

## Quick recap

- A monorepo keeps several related packages in one repository.
- Each package is a workspace with its own `package.json`.
- The root `package.json` lists workspace folders in `"workspaces"` and should be `"private": true`.
- One `npm install` at the root links local packages together with symlinks.
- `-w <name>` targets one workspace; `--workspaces --if-present` targets all of them.
- pnpm adds strict, fast installs and the `workspace:` protocol; Turborepo adds dependency-aware ordering and caching.

<code id="code-content" class="language-javascript">
// workspaces.mjs: build a tiny monorepo in a temp folder, then map it
// the way npm, pnpm and Turborepo do: find workspaces, then a build order.
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = await mkdtemp(path.join(tmpdir(), 'mono-'));
const write = async (file, data) =&gt; {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), JSON.stringify(data, null, 2));
};
// 1. The root package.json lists where workspaces live
await write('package.json', { name: 'notes-monorepo', private: true, workspaces: ['packages/*', 'apps/*'] });
// 2. Three workspaces that depend on each other
await write('packages/format/package.json', { name: '@notes/format', version: '1.0.0' });
await write('packages/db/package.json', { name: '@notes/db', version: '1.0.0', dependencies: { '@notes/format': '^1.0.0' } });
await write('apps/api/package.json', { name: '@notes/api', private: true, dependencies: { '@notes/db': '^1.0.0', '@notes/format': '^1.0.0' } });
// 3. Expand simple "folder/*" patterns into real workspace folders
const rootPkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const workspaces = new Map();
for (const pattern of rootPkg.workspaces) {
  const base = pattern.replace('/*', '');
  for (const dir of await readdir(path.join(root, base))) {
    const pkg = JSON.parse(await readFile(path.join(root, base, dir, 'package.json'), 'utf8'));
    workspaces.set(pkg.name, { dir: `${base}/${dir}`, deps: Object.keys(pkg.dependencies ?? {}) });
  }
}
console.log('Workspaces found:');
for (const [name, info] of workspaces) {
  const local = info.deps.filter((d) =&gt; workspaces.has(d));
  console.log(` ${name.padEnd(14)} ${info.dir.padEnd(16)} uses: ${local.join(', ') || '(nothing local)'}`);
}
// 4. Build order: a package must be built after everything it depends on
const order = [];
const visit = (name) =&gt; {
  if (order.includes(name)) return;
  for (const dep of workspaces.get(name).deps) if (workspaces.has(dep)) visit(dep);
  order.push(name);
};
for (const name of workspaces.keys()) visit(name);
console.log('\nBuild order:', order.join(' -&gt; '));
console.log('pnpm -r and turbo work this order out for you; npm runs workspaces in listed order.');
await rm(root, { recursive: true, force: true }); // tidy up the temp folder
</code></pre>
