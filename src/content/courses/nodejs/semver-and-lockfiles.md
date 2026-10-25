---
publishDate: 2026-10-25T08:50
title: Semantic Versioning and Lockfiles
slug: semver-and-lockfiles
metadescription: Read version numbers like 1.11.13, understand what ^ and ~ allow, and learn why package-lock.json and npm ci keep installs identical everywhere.
updateDate: 2026-10-25T08:50
author: ['bishal-biswas']
level: 1
tags: ['npm', 'semver', 'lockfiles']
course: nodejs
---

## Why version numbers matter

Every package you install keeps changing. Authors fix bugs, add features and sometimes change how things work.

Think of a recipe book that gets a new edition every few months. A typo fix is harmless. A rewritten recipe might ruin your dinner. You want the harmless fixes, but you want to know before anything big changes.

**Semantic versioning** (often shortened to **semver**) is the agreement that makes this possible. A **lockfile** is the note that records exactly which edition you cooked from.

## Reading a version number

A semver version has three numbers separated by dots:

```text
1.11.13
│  │  └── PATCH: bug fixes only
│  └───── MINOR: new features, nothing broken
└──────── MAJOR: breaking changes
```

- Bump the **patch** when you fix a bug without changing how anything is used.
- Bump the **minor** when you add something new but old code still works.
- Bump the **major** when existing code might stop working.

So going from `1.11.13` to `1.11.14` should be safe. Going from `1.11.13` to `2.0.0` means "read the release notes first".

> **Note:** Semver is a promise made by people, not a rule enforced by a computer. Most authors keep it, but now and then a "minor" release breaks something. That is exactly why lockfiles exist.

### Pre-release versions

Sometimes you will see extra text after the numbers, like `2.0.0-alpha.4` or `5.0.0-beta.1`. These are **pre-releases**: test versions published before the real release. npm never installs them unless you ask for them by name.

## Ranges in package.json

When you install a package, npm writes it into `package.json` with a **range**: a rule describing which versions are acceptable.

```bash
npm install dayjs@1.11.13
```

```json
{
  "dependencies": {
    "dayjs": "^1.11.13"
  }
}
```

You asked for `1.11.13`, but npm saved `^1.11.13`. That little symbol matters a lot.

### The caret: `^`

The **caret** allows minor and patch updates, but never a new major version. This is npm's default.

```text
^1.11.13  allows 1.11.13, 1.11.23, 1.12.0, 1.99.0
          blocks 2.0.0
```

### The tilde: `~`

The **tilde** is stricter. It allows patch updates only.

```text
~1.11.13  allows 1.11.13, 1.11.20
          blocks 1.12.0, 2.0.0
```

### Exact versions

No symbol means "this version and nothing else".

```text
1.11.13   allows only 1.11.13
```

To save exact versions instead of carets, add `--save-exact` (or `-E`):

```bash
npm install dayjs@1.11.13 --save-exact
```

### Other ranges you might see

```text
>=18.0.0          any version 18.0.0 or higher
>=1.2.0 <1.5.0    from 1.2.0 up to, but not including, 1.5.0
1.x               any 1.something version
*                 any version at all (avoid this)
latest            whatever is newest right now (avoid this too)
```

## The 0.x surprise

Packages below version 1 are treated as unstable, so the caret becomes more careful. It keeps the **left-most non-zero number** fixed.

```text
^1.2.3   allows up to, but not including, 2.0.0
^0.2.3   allows up to, but not including, 0.3.0
^0.0.3   allows only 0.0.3
```

In other words, for a `0.x` package, a minor bump is treated like a major one.

## The problem ranges create

Ranges are flexible, and flexibility has a cost. Imagine this:

1. Asha installs the project on Monday and gets `dayjs 1.11.13`.
2. On Wednesday, `dayjs 1.11.14` is published.
3. Ravi installs the same project on Thursday and gets `1.11.14`.

Both installs match `^1.11.13`, but they are not identical. If `1.11.14` has a bug, Ravi sees it and Asha does not. "It works on my machine" is born.

## The lockfile: package-lock.json

A **lockfile** fixes this. The first time you install, npm writes `package-lock.json`, which records the **exact** version of every package it installed, including the packages your packages depend on.

Here is a real one, shortened slightly:

```json
{
  "name": "notes-app",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "notes-app",
      "version": "1.0.0",
      "dependencies": {
        "dayjs": "^1.11.13"
      }
    },
    "node_modules/dayjs": {
      "version": "1.11.13",
      "resolved": "https://registry.npmjs.org/dayjs/-/dayjs-1.11.13.tgz",
      "integrity": "sha512-oaMBel6gjolK862u...",
      "license": "MIT"
    }
  }
}
```

- `version` is the exact version installed.
- `resolved` is where it was downloaded from.
- `integrity` is a **hash**, a fingerprint of the file. If the download is changed or corrupted, the fingerprint will not match and npm refuses to install it.

The range in `package.json` says what you **would accept**. The lockfile says what you **actually got**.

> **Tip:** Always commit `package-lock.json` to Git. Never commit `node_modules/`. Anyone can rebuild `node_modules/` from the lockfile.

## npm install versus npm ci

Two commands install packages, and they behave differently.

```bash
npm install
```

`npm install` reads `package.json`, uses the lockfile where it can, and **may update the lockfile** if something changed. Use it while developing.

```bash
npm ci
```

`npm ci` ("clean install") deletes `node_modules/` and installs **exactly** what the lockfile says. It never changes the lockfile. If `package.json` and the lockfile disagree, it stops with an error:

```text
npm error `npm ci` can only install packages when your package.json and
package-lock.json or npm-shrinkwrap.json are in sync. Please update your
lock file with `npm install` before continuing.
```

Use `npm ci` on servers and in automated builds, where you want the same result every time. You will see it again in the CI/CD lesson.

## Checking for and applying updates

`npm outdated` lists packages with newer versions available:

```bash
npm outdated
```

```text
Package  Current   Wanted   Latest  Location            Depended by
dayjs    1.11.13  1.11.23  1.11.23  node_modules/dayjs  notes-app
```

- **Current** is what is installed.
- **Wanted** is the newest version your range allows.
- **Latest** is the newest version published.

`npm update` moves each package up to its **Wanted** version and updates the lockfile:

```bash
npm update
```

It will never cross a major version, because your caret range does not allow it. To move to a new major, install it on purpose and read the release notes first. For example, moving Express from version 4 to version 5:

```bash
npm install express@5
```

To see every version a package has published:

```bash
npm view dayjs versions
```

## Common mistakes

### Deleting the lockfile to "fix" things

```bash
rm package-lock.json
npm install
```

This works, but it quietly upgrades every package in your project to the newest version its range allows. Sometimes that is what you want. Do it on purpose, test afterwards, and never as a habit.

### Using `*` or `latest`

```json
{
  "dependencies": {
    "dayjs": "*"
  }
}
```

A fresh install could pull in a new major version and break your app. Use a caret range instead:

```json
{
  "dependencies": {
    "dayjs": "^1.11.13"
  }
}
```

### Mixing package managers

npm writes `package-lock.json`, pnpm writes `pnpm-lock.yaml` and Yarn writes `yarn.lock`. Pick one tool per project and commit only its lockfile.

## Quick recap

- A version is `MAJOR.MINOR.PATCH`: breaking changes, new features, bug fixes.
- `^1.2.3` allows minor and patch updates. `~1.2.3` allows patch updates only. `1.2.3` is exact.
- For `0.x` packages, the caret keeps the left-most non-zero number fixed.
- `package-lock.json` records the exact version and fingerprint of every installed package. Commit it.
- Use `npm install` while developing and `npm ci` for repeatable installs.
- `npm outdated` shows what can be updated, and `npm update` updates within your ranges.

<code id="code-content" class="language-javascript">
// semver-check.mjs
// A tiny, simplified range checker to see how ^ and ~ behave.
// (Real tools use npm's own 'semver' package, which handles every case.)
function parse(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch };
}
// Compare two versions: negative if a is lower, 0 if equal, positive if higher
function compare(a, b) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}
// Work out the first version that is NOT allowed by a range
function upperLimit(range) {
  const base = parse(range.slice(1));
  if (range.startsWith('~')) return { major: base.major, minor: base.minor + 1, patch: 0 };
  // Caret: the left-most non-zero number must stay the same
  if (base.major &gt; 0) return { major: base.major + 1, minor: 0, patch: 0 };
  if (base.minor &gt; 0) return { major: 0, minor: base.minor + 1, patch: 0 };
  return { major: 0, minor: 0, patch: base.patch + 1 };
}
function satisfies(version, range) {
  const v = parse(version);
  if (!range.startsWith('^') &amp;&amp; !range.startsWith('~')) {
    return compare(v, parse(range)) === 0; // exact version
  }
  const lowest = parse(range.slice(1));
  return compare(v, lowest) &gt;= 0 &amp;&amp; compare(v, upperLimit(range)) &lt; 0;
}
// ---
const checks = [
  ['1.11.23', '^1.11.13'], // minor/patch update: allowed
  ['2.0.0', '^1.11.13'],   // new major: blocked
  ['1.11.20', '~1.11.13'], // patch update: allowed
  ['1.12.0', '~1.11.13'],  // minor update: blocked by ~
  ['0.3.0', '^0.2.5'],     // with 0.x, ^ is stricter
  ['0.2.9', '^0.2.5'],
  ['1.11.14', '1.11.13'],  // exact pin: only 1.11.13
];
for (const [version, range] of checks) {
  const ok = satisfies(version, range);
  console.log(`${version.padEnd(8)} in ${range.padEnd(9)} ${ok ? 'yes' : 'no'}`);
}
</code></pre>
