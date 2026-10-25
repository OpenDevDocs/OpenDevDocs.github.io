---
publishDate: 2026-10-25T12:50
title: "Security: Supply Chain, Audits and Hardening"
slug: security-and-supply-chain
metadescription: Protect a Node app from risky dependencies and common attacks with npm audit, lockfiles and install script controls, and block injection and prototype pollution.
updateDate: 2026-10-25T12:50
author: ['bishal-biswas']
level: 3
tags: ['security', 'npm', 'supply-chain', 'hardening']
course: nodejs
---

## Two halves of Node security

Think of your app as a house. Security has two halves:

- **What you let in through the door.** Every parcel delivered to the house could contain something nasty. In Node, the parcels are npm packages. This is **supply chain security**.
- **How strong the walls and locks are.** Even with safe parcels, a burglar can try the windows. In Node, that means your own code handling user input safely. This is **hardening**.

You need both. A perfectly written app is still unsafe if a dependency steals your environment variables, and safe dependencies do not help if your code passes user input straight into a shell.

## Your app is mostly other people's code

A typical project lists a dozen dependencies in `package.json`. Each of those has its own dependencies, called **transitive dependencies**, and so on. Count what is really installed:

```bash
npm ls --all
```

It is common to see hundreds of packages. Each one runs with the same power as your own code: it can read files, read `process.env` and make network requests.

Common supply chain attacks:

- **Typosquatting**: a malicious package with a name close to a popular one, such as `expresss` or `lodahs`, waiting for a typo.
- **Account takeover**: an attacker steals a maintainer's npm login and publishes a poisoned new version of a real, popular package. Everyone who installs the latest version gets it.
- **Malicious install scripts**: a package runs code during `npm install`, before you have even used it.
- **Dependency confusion**: a public package uses the same name as your company's private one, and a misconfigured install picks the public one.

## Lockfiles and npm ci

As you learned in [the Semantic Versioning and Lockfiles lesson](/courses/nodejs/semver-and-lockfiles), `package-lock.json` records the exact version of every package. That matters for security: without it, a fresh install could silently pick up a poisoned new release.

- **Commit your lockfile.**
- In CI and production, install with `npm ci`, which installs exactly what the lockfile says and fails if `package.json` and the lockfile disagree.

```bash
npm ci
```

## npm audit: known vulnerabilities

npm keeps a database of **advisories**: published reports of security holes in specific package versions. `npm audit` checks your installed tree against it.

```bash
npm audit
```

Here is real output for a project using an old version of lodash (shortened):

```text
# npm audit report

lodash  <=4.17.23
Severity: high
Command Injection in lodash - https://github.com/advisories/GHSA-35jh-r3h4-6jhm
Regular Expression Denial of Service (ReDoS) in lodash - https://github.com/advisories/GHSA-29mw-wpgm-hmr9
...
fix available via `npm audit fix`
node_modules/lodash

1 high severity vulnerability
```

Each entry shows the package, the affected versions, the severity and a link to the advisory. Read the advisory: a vulnerability in a function you never call may not affect you, but you cannot know until you look.

Fixing:

```bash
npm audit fix          # upgrade within the allowed semver ranges
npm audit fix --force  # also allows major upgrades, which can break your app
```

Treat `--force` like any major upgrade: run your tests afterwards.

Useful options for CI:

```bash
# fail the build only for high or critical problems in production dependencies
npm audit --omit=dev --audit-level=high
```

### Checking signatures

The npm registry signs packages, and packages built in public CI can carry **provenance attestations**: a signed record of which source repository and build produced them. Verify what you installed:

```bash
npm audit signatures
```

```text
18 packages have verified registry signatures

3 packages have verified attestations
```

## Install scripts

Packages can declare `preinstall`, `install` and `postinstall` scripts that run during `npm install`. Native addons need them to compile, but they are also the favourite trick of malicious packages.

Ways to limit them:

```bash
# skip scripts for one install
npm install --ignore-scripts

# or turn them off for every install on this machine
npm config set ignore-scripts true
```

Newer npm releases go further: dependency install scripts are **blocked by default**, and npm lists the packages whose scripts it skipped. You review them and approve the ones you trust, which records them in an `allowScripts` field in `package.json`:

```bash
npm install-scripts ls              # which packages want to run scripts?
npm install-scripts approve sharp   # allow this one
```

Run `npm -v` to see your version. If `npm install-scripts --help` works, you have this feature.

## Slow down on brand-new versions

Poisoned releases are usually spotted and removed within hours or days. Recent npm versions have a `min-release-age` setting that only installs versions older than a number of days:

```bash
npm config set min-release-age 3
```

Combine it with an automated update tool such as **Dependabot** or **Renovate**, which opens pull requests for updates so they go through review and CI instead of arriving silently.

## Choosing packages wisely

The safest dependency is the one you do not install. Modern Node has built-ins that replace many classic packages:

| Instead of | Use the built-in |
| --- | --- |
| `node-fetch`, `axios` (simple cases) | global `fetch` |
| `uuid` | `crypto.randomUUID()` |
| `dotenv` | `node --env-file=.env` |
| `jest`, `mocha` (simple cases) | `node:test` |
| `yargs`, `minimist` (simple cases) | `util.parseArgs` |
| `chalk` (simple cases) | `util.styleText` |

When you do need a package, check that it is actively maintained, has a linked source repository, and does not drag in a huge tree of its own dependencies. To see why something is installed:

```bash
npm explain lodash
```

If you publish packages yourself, turn on two-factor authentication for your npm account and publish from CI with provenance (`npm publish --provenance`) so your users can verify where your code came from.

## Hardening your own code

### Keep Node itself updated

Node ships security releases regularly. Stay on a supported LTS line (Node 24 today; Node 20 reached end of life in April 2026) and apply patch updates promptly.

### Keep secrets out of code

Put secrets in environment variables (see [the Environment Variables lesson](/courses/nodejs/environment-variables-and-env-file)), add `.env` to `.gitignore`, and never log them.

### Command injection

`exec()` runs a string through a shell, so user input can add extra commands:

```javascript
import { exec } from 'node:child_process';

// DANGER: filename = 'notes.txt; rm -rf ~' runs a second command
exec(`cat ${filename}`);
```

Use `execFile()` or `spawn()` with an **array** of arguments. No shell is involved, so the input stays one harmless argument:

```javascript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const userInput = 'notes.txt; echo HACKED';

const { stdout } = await run(process.execPath, ['-e', 'console.log(process.argv[1])', userInput]);
console.log(stdout.trim()); // notes.txt; echo HACKED  (just text, never executed)
```

### Path traversal

If users choose file names, `../../` can climb out of the folder you meant to serve. Resolve the full path and check it stays inside:

```javascript
import path from 'node:path';

const PUBLIC_DIR = path.resolve('public');

function safePath(userPath) {
  const full = path.resolve(PUBLIC_DIR, userPath);
  if (full !== PUBLIC_DIR && !full.startsWith(PUBLIC_DIR + path.sep)) {
    throw new Error('Path escapes the public folder');
  }
  return full;
}

safePath('notes/today.txt');   // fine
safePath('../../secrets.env'); // throws
```

### Prototype pollution

Every plain object inherits from `Object.prototype`. A naive "deep merge" of user JSON can write to it through the special `__proto__` key, adding properties to **every object in your app**:

```javascript
function naiveMerge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] ??= {};
      naiveMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

const evil = JSON.parse('{"__proto__": {"isAdmin": true}}');
naiveMerge({}, evil);
console.log({}.isAdmin); // true  (every object is now an "admin")
```

Fixes: skip the dangerous keys (`__proto__`, `constructor`, `prototype`), validate input against a schema, and use `Object.create(null)` or a `Map` for dictionaries built from user keys.

### Comparing secrets

A normal `===` stops at the first different character, so its timing can leak how much of a token was right. Use `crypto.timingSafeEqual`, which needs equal-length buffers, so hash both sides first:

```javascript
import { createHash, timingSafeEqual } from 'node:crypto';

function tokensMatch(a, b) {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

console.log(tokensMatch('s3cret-token', 's3cret-token')); // true
console.log(tokensMatch('s3cret-token', 'guess'));        // false
```

### More habits worth having

- **Validate all input**: types, lengths and allowed values. Limit request body sizes.
- **Avoid `eval()` and `new Function()`** with any outside data. `node:vm` is **not** a security sandbox either.
- **Beware catastrophic regular expressions** such as `/^(a+)+$/`, which can take seconds on a crafted string (a **ReDoS** attack). Keep patterns simple and inputs short.
- **Do not leak details**: send clients a generic error message, and keep stack traces in your logs.
- **Use security headers and rate limits**: in Express, the `helmet` and `express-rate-limit` packages are common choices.
- **Run with least privilege**: never run your server as root, and consider [the Permission Model](/courses/nodejs/permission-model) (`--permission` with `--allow-fs-read` and friends) to limit what the process, and every dependency in it, can touch.

## Quick recap

- Supply chain security is about the packages you install; hardening is about your own code.
- Commit your lockfile and install with `npm ci` in CI and production.
- `npm audit` finds known vulnerabilities; `npm audit signatures` checks signatures and provenance.
- Limit install scripts with `--ignore-scripts` or newer npm's script approvals; consider `min-release-age`.
- Prefer built-ins over small dependencies, and review updates through Dependabot or Renovate.
- Use `execFile`/`spawn` with argument arrays, check resolved paths, block `__proto__`, and compare secrets with `timingSafeEqual`.
- Keep Node updated, keep secrets out of code, and run with the least privilege possible.

<code id="code-content" class="language-javascript">
// security-demo.mjs: safe versions of four common danger zones
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, timingSafeEqual } from 'node:crypto';
// 1. Path traversal: resolve, then make sure we are still inside the folder
const PUBLIC_DIR = path.resolve('public');
function safePath(userPath) {
  const full = path.resolve(PUBLIC_DIR, userPath);
  if (full !== PUBLIC_DIR &amp;&amp; !full.startsWith(PUBLIC_DIR + path.sep)) {
    throw new Error(`Blocked path: ${userPath}`);
  }
  return full;
}
for (const p of ['notes/today.txt', '../../secrets.env']) {
  try { console.log('OK:', path.relative(process.cwd(), safePath(p))); }
  catch (error) { console.log(error.message); }
}
// 2. Prototype pollution: never copy __proto__, constructor or prototype
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function safeMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (BLOCKED_KEYS.has(key)) continue;
    const value = source[key];
    if (typeof value === 'object' &amp;&amp; value !== null) {
      target[key] = safeMerge(target[key] ?? {}, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}
const evil = JSON.parse('{"theme": "dark", "__proto__": {"isAdmin": true}}');
console.log('merged:', safeMerge({}, evil), '| polluted?', ({}).isAdmin === true);
// 3. Command injection: arguments in an array, no shell involved
const run = promisify(execFile);
const userInput = 'notes.txt; echo HACKED';
const { stdout } = await run(process.execPath, ['-e', 'console.log(process.argv[1])', userInput]);
console.log('treated as plain text:', stdout.trim());
// 4. Constant-time comparison of secrets
function tokensMatch(a, b) {
  const hashA = createHash('sha256').update(String(a)).digest();
  const hashB = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(hashA, hashB); // same length thanks to hashing
}
const API_TOKEN = process.env.API_TOKEN ?? 'demo-token-123';
console.log('right token:', tokensMatch('demo-token-123', API_TOKEN));
console.log('wrong token:', tokensMatch('guess', API_TOKEN));
// 5. Input validation: check type and size before using a value
function parseQuantity(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n &lt; 1 || n &gt; 100) throw new RangeError(`Invalid quantity: ${raw}`);
  return n;
}
for (const raw of ['3', '-1', '1e9']) {
  try { console.log('quantity', parseQuantity(raw)); } catch (error) { console.log(error.message); }
}
</code></pre>
