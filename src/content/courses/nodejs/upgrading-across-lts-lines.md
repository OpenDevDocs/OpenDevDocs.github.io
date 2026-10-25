---
publishDate: 2026-10-25T13:45
title: Upgrading Across LTS Lines
slug: upgrading-across-lts-lines
metadescription: Upgrade Node.js safely from one LTS line to the next with a step-by-step checklist, deprecation flags, dependency updates and CI on both lines.
updateDate: 2026-10-25T13:45
author: ['bishal-biswas']
level: 4
tags: ['lts', 'upgrading', 'maintenance']
course: nodejs
---

## Why upgrades matter

Every Node version eventually stops getting fixes. After that date, newly found security holes stay open forever. Running an **end-of-life** (EOL) Node in production is like driving a car whose manufacturer has stopped making brake parts. It may run fine today, but you are on your own.

Upgrading is also how you get new features and speed: newer V8 versions, built-in tools like the test runner and `node:sqlite`, and APIs like Temporal.

The good news: if you upgrade on a schedule, one LTS line at a time, each upgrade is small and boring. Boring is exactly what you want. This last lesson gives you a checklist that keeps it that way.

## Where things stand in October 2026

You met release lines in [the Release Lines lesson](/courses/nodejs/nodejs-release-lines). A quick refresher on the words:

- **Current**: the newest release. New features land here first.
- **Active LTS**: **long-term support**. Recommended for production. Gets bug fixes and security fixes.
- **Maintenance LTS**: older LTS. Gets only critical bug fixes and security fixes.
- **End-of-life**: no fixes at all.

As of October 2026:

| Line | Status |
| --- | --- |
| Node 26 | Released 5 May 2026 as Current; promoted to LTS in late October 2026 |
| Node 24 | Active LTS, supported until April 2028 |
| Node 22 | Maintenance LTS, until April 2027 |
| Node 20 | End-of-life since April 2026 |

When Node 26 becomes Active LTS, Node 24 moves into Maintenance LTS, where it keeps getting security fixes until April 2028.

So if you are on Node 20, upgrade now. If you are on Node 22, plan your move this winter. If you are on Node 24, start testing Node 26.

## The schedule is changing

Until now, Node released two major versions a year. Even-numbered versions (20, 22, 24, 26) became LTS. Odd-numbered versions (21, 23, 25) were short-lived and never LTS.

Starting with **Node 27 in April 2027**, that changes:

- There will be **one major release per year**, in April.
- **Every release becomes LTS** in October of the same year.
- The odd/even split goes away.

For you, this makes planning simpler: one new LTS line each year, and every version number is a candidate for production once it reaches LTS.

## Why waiting makes it harder

Each major version brings a few **breaking changes**: removed APIs, changed defaults, stricter behaviour. One step at a time, there are only a handful to deal with. Skip three lines and you face all of them at once, plus your dependencies may have dropped support for your old version in the meantime.

The habit that works: **move to each new LTS line within a few months of it becoming LTS.**

## The upgrade checklist

### Step 1: read the changelog

Every major release comes with release notes on the Node.js blog and a changelog in the Node repository. Look for the **semver-major** section: those are the breaking changes.

For example, two changes in Node 26 that can affect real code:

**The old `writeHeader()` alias on HTTP responses was removed.** It had been deprecated for years. Use `writeHead()`:

```javascript
// Breaks on Node 26: writeHeader is gone
res.writeHeader(200, { 'content-type': 'text/plain' });
```

```javascript
// Works on every line
res.writeHead(200, { 'content-type': 'text/plain' });
```

**`module.register()` is now runtime-deprecated.** It still works, but prints a deprecation warning. The newer **`module.registerHooks()`** is preferred. You saw both in [the Module Customisation Hooks lesson](/courses/nodejs/module-customisation-hooks).

Node 26 also turns on the **Temporal** API by default (see [the Temporal lesson](/courses/nodejs/temporal-api)) and ships a newer V8 (14.6, up from 13.6 in Node 24).

> **Tip:** Search your code for every API mentioned in the semver-major list. A quick search for `writeHeader` takes seconds and saves a failed deploy.

### Step 2: find deprecations before they become removals

A **deprecation** is Node's warning: "this still works, but it will be removed one day". Node has flags that help you find them in your own app.

Run your app or tests with **`--pending-deprecation`**:

```bash
node --pending-deprecation server.js
```

This turns on warnings for deprecations Node has planned but does not yet show by default. For example, it warns about `process.binding()` and about the old `Buffer()` constructor even when it is called from inside `node_modules`.

Add **`--trace-deprecation`** to see exactly which line of code triggered each warning:

```text
(node:11936) [DEP0005] DeprecationWarning: Buffer() is deprecated due to security and usability issues. Please use the Buffer.alloc(), Buffer.allocUnsafe(), or Buffer.from() methods instead.
    at showFlaggedDeprecation (node:buffer:195:11)
    at Buffer (node:buffer:278:3)
    at file:///home/asha/notes-api/server.mjs:3:11
```

Each warning has a code like `DEP0005`. Search for that code in the Node docs' "Deprecated APIs" page to find the replacement.

In your tests, go one step further with **`--throw-deprecation`**. It turns every deprecation warning into a thrown error, so a test that uses a deprecated API fails instead of quietly passing:

```json
{
  "scripts": {
    "test": "node --test",
    "test:strict": "node --throw-deprecation --pending-deprecation --test"
  }
}
```

You can also set flags with the `NODE_OPTIONS` environment variable, which is handy in CI:

```bash
NODE_OPTIONS="--throw-deprecation" npm test
```

### Step 3: update your dependencies

Your packages need to support the new Node line too. `npm update` only moves within the version ranges in your `package.json`. **npm-check-updates** also finds new major versions and can rewrite the ranges for you:

```bash
npx npm-check-updates                 # list available updates
npx npm-check-updates --target minor  # only minor and patch updates
npx npm-check-updates -i              # pick updates one by one
npx npm-check-updates -u              # write the new versions into package.json
npm install                           # then install them
```

Good practice:

- Update in small batches and run the tests after each batch.
- Read the changelogs of packages that jump a major version.
- Look at each package's `engines` field. Libraries often drop old Node lines in a major release.

**Native addons** (packages with compiled C++ code) are a special case. An addon built for one Node line may refuse to load on another, with an error mentioning `NODE_MODULE_VERSION`. A fresh `npm ci` or `npm rebuild` on the new version usually fixes it. Addons built on Node-API (see [the Native Addons lesson](/courses/nodejs/native-addons-and-node-api)) keep working across versions without a rebuild.

### Step 4: run your tests on both lines in CI

Add the new line to your CI matrix, as in [the CI/CD lesson](/courses/nodejs/ci-cd-for-node-projects):

```yaml
strategy:
  fail-fast: false
  matrix:
    node-version: [24, 26]
```

Now every pull request is tested on both your current line and your target line. Fix anything that fails on 26 while keeping 24 green. When the new line is fully green for a while, you are ready to switch.

### Step 5: update every place the version is written

The Node version tends to be written in more places than you remember:

- `.nvmrc` or `.node-version`
- `"engines"` in `package.json`
- Docker base images, for example `FROM node:24-slim` to `FROM node:26-slim`
- CI workflows (`node-version` and the matrix)
- Serverless function runtime settings
- Your hosting platform's Node setting
- Team documentation and onboarding guides

A quick search for your old version number across the repository finds most of them. For a move from Node 22:

```bash
git grep -n -E "node[:@-]?22|node-version"
```

### Step 6: roll out gradually

Do not switch everything at once:

1. **Development and CI first.** Your team uses the new line daily for a week or two.
2. **Staging next.** Run your load tests from [the Load Testing lesson](/courses/nodejs/load-testing-and-capacity-planning) and compare latency and memory with the old line.
3. **A slice of production.** Run one instance on the new line (a **canary**) and watch errors, latency and memory.
4. **Everything else**, once the canary looks healthy.

Keep a **rollback plan**: the previous Docker image tag, or the previous runtime setting, ready to redeploy in minutes.

### Step 7: clean up

After everyone is on the new line:

- Remove the old line from the CI matrix.
- Raise the minimum in `"engines"`.
- Delete workarounds you kept only for the old version.
- Start using the new features you waited for.

## Common mistakes

**Jumping several lines at once.** Going straight from Node 18 to 26 means dealing with four lines' worth of breaking changes and deprecations in one go. Go one LTS line at a time, even if you do two steps quickly.

**Ignoring deprecation warnings.** Today's warning is next year's removal. Treat warnings in test output as bugs.

**Upgrading Node and all dependencies in one huge change.** If something breaks, you cannot tell which change caused it. Upgrade Node first with dependencies as they are, then update dependencies in small batches (or the other way round), testing in between.

**Forgetting the Docker image.** CI runs Node 26, your laptop runs Node 26, and production still runs `node:22-slim`. Search for the version everywhere (step 5).

**Running Current in production.** A brand-new major version is for testing. Move production when the line reaches LTS, or shortly after.

## Quick recap

- Node 24 is Active LTS, Node 26 becomes LTS in late October 2026, Node 22 is in Maintenance until April 2027, and Node 20 is end-of-life.
- From Node 27 (April 2027) there is one major release per year, and every release becomes LTS.
- Upgrade one LTS line at a time, soon after it becomes LTS.
- Read the semver-major changes; for Node 26, replace `writeHeader()` with `writeHead()` and move from `module.register()` to `module.registerHooks()`.
- Use `--pending-deprecation`, `--trace-deprecation` and `--throw-deprecation` to find deprecated code early.
- Update dependencies with `npx npm-check-updates` in small batches, test on both lines in CI, then roll out gradually with a rollback plan.

<code id="code-content" class="language-javascript">
// upgrade-check.mjs: an "am I ready to upgrade?" report for the current project.
// Run it on each Node line you support: node upgrade-check.mjs
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import module from 'node:module';
import url from 'node:url';
import { setImmediate as nextTurn } from 'node:timers/promises';
// 1. Where does this Node version sit in the release schedule? (as of October 2026)
const schedule = {
  20: 'End-of-life since April 2026: upgrade now',
  22: 'Maintenance LTS until April 2027: plan your move',
  24: 'Active LTS: a safe production choice',
  26: 'LTS from late October 2026: test it now',
};
const major = Number(process.versions.node.split('.')[0]);
console.log(`Node ${process.version} (V8 ${process.versions.v8}), LTS name: ${process.release.lts ?? 'none'}`);
console.log(`Status: ${schedule[major] ?? 'Not in the table: check nodejs.org/en/about/previous-releases'}`);
// 2. Does package.json say which versions we support?
try {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  console.log(`engines.node in package.json: ${pkg.engines?.node ?? '(not set, consider adding it)'}`);
} catch {
  console.log('No package.json here, skipping the engines check');
}
// 3. Feature checks for APIs that changed between 24 and 26
const checks = {
  'Temporal (on by default in 26)': typeof globalThis.Temporal !== 'undefined',
  'module.registerHooks() (preferred)': typeof module.registerHooks === 'function',
  'module.register() (runtime-deprecated in 26)': typeof module.register === 'function',
  'res.writeHeader() (removed in 26)': typeof http.ServerResponse.prototype.writeHeader === 'function',
  'res.writeHead() (use this)': typeof http.ServerResponse.prototype.writeHead === 'function',
};
for (const [name, ok] of Object.entries(checks)) console.log(`  ${(ok ? 'present' : 'missing').padEnd(8)} ${name}`);
// 4. Collect deprecation warnings instead of letting them scroll past
const deprecations = [];
process.on('warning', (w) =&gt; {
  if (w.name === 'DeprecationWarning') deprecations.push(`${w.code}: ${w.message.slice(0, 70)}...`);
});
url.parse('https://example.com/notes?author=Asha'); // old API, triggers DEP0169
await nextTurn(); // warnings are emitted asynchronously
console.log(`Deprecations seen: ${deprecations.length}`);
for (const d of deprecations) console.log(`  ${d}`);
console.log(`Flags: --pending-deprecation ${process.execArgv.includes('--pending-deprecation') ? 'on' : 'off'}, --throw-deprecation ${process.throwDeprecation ? 'on' : 'off'}`);
console.log('Next: npx npm-check-updates, run tests on both lines, then upgrade one environment at a time.');
</code></pre>
