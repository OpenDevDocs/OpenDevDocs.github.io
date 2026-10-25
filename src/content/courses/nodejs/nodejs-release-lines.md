---
publishDate: 2026-10-25T08:25
title: "Release Lines: Current, LTS and Maintenance"
slug: nodejs-release-lines
metadescription: Understand Node.js version numbers and release phases, from Current to Active LTS, Maintenance and end of life, and pick the right version.
updateDate: 2026-10-25T08:25
author: ['bishal-biswas']
level: 1
tags: ['releases', 'lts', 'versions']
course: nodejs
---

## Why Node has several versions at once

At any moment there are several **release lines** of Node.js being looked after. A release line is a major version, such as Node 22, Node 24 or Node 26, together with all its smaller updates.

Think of car models. A brand sells this year's new model, but the garage still services the models from the last few years. Eventually an old model stops getting parts. Node works the same way: new lines arrive, older lines keep getting fixes for a while, then support ends.

Knowing where each line is in its life tells you which one to install and when to upgrade.

## Reading a version number

Run `node --version` and you get something like this:

```text
v24.12.0
```

Node uses **semantic versioning**, a three-part number: **MAJOR.MINOR.PATCH**.

- **24** is the **major** version. A new major can include **breaking changes**: changes that might stop old code from working.
- **12** is the **minor** version. New features that do not break anything.
- **0** is the **patch** version. Bug fixes and security fixes only.

So moving from 24.11 to 24.12 is safe and routine. Moving from 22 to 24 is a bigger step that you should test. You will learn semantic versioning properly in [Semantic Versioning and Lockfiles](/courses/nodejs/semver-and-lockfiles).

## The four phases of a release line

Every major version goes through the same life stages.

### 1. Current

A brand-new major version starts as **Current**. This is where new features arrive first.

It is great for trying new things, but libraries and tools may still be catching up, so it is not the best choice for an important production app.

### 2. Active LTS

After about six months, an LTS-bound line is promoted to **Active LTS**. LTS means **Long Term Support**.

Active LTS lines get bug fixes, security fixes and carefully chosen improvements. This is the version most companies run, and the one you should install by default.

### 3. Maintenance LTS

After about a year of Active LTS, the line moves to **Maintenance**. It now gets only important bug fixes and security patches. Still safe to run, but time to plan your upgrade.

### 4. End of life

Finally the line reaches **end of life** (EOL). No more fixes of any kind, **including security fixes**. Running an end-of-life version in production is a real risk.

## Odd and even versions

Under the schedule Node has used for years, a new major version comes out twice a year:

- **April:** an **even-numbered** version (20, 22, 24, 26). These become LTS in October.
- **October:** an **odd-numbered** version (21, 23, 25). These **never** become LTS. They are supported for only a few months, as a preview of what is coming.

That is why you see people recommend even-numbered versions.

## LTS codenames

Each LTS line gets a codename, taken from the periodic table of elements in alphabetical order:

| Version | Codename |
| --- | --- |
| Node 20 | Iron |
| Node 22 | Jod |
| Node 24 | Krypton |

Node can tell you its own codename. On a non-LTS release this prints `undefined`:

```bash
node -p "process.release.lts"
```

```text
Krypton
```

## Where things stand in October 2026

| Line | Status |
| --- | --- |
| Node 26 | Current, released 5 May 2026. Becomes LTS in late October 2026 |
| Node 25 | End of life (odd-numbered, never LTS) |
| Node 24 | Active LTS (Krypton). Moves to Maintenance once Node 26 becomes LTS. Supported until April 2028 |
| Node 22 | Maintenance LTS (Jod). End of life in April 2027 |
| Node 20 | End of life since April 2026 |

This course targets **Node 24**, and points out where Node 26 differs.

## What changes between lines: an example

New major versions bring new features and occasionally remove old ones. For example, Node 26 ships a newer V8 engine (14.6) and switches on the **Temporal** API by default. Temporal is a modern replacement for the old `Date` object. In Node 24 it is not available without extra steps.

You can check whether a feature exists before using it:

```javascript
// temporal-check.mjs
if (typeof Temporal !== 'undefined') {
  console.log('Today is', Temporal.Now.plainDateISO().toString());
} else {
  console.log(`Temporal is not available in Node ${process.versions.node}`);
}
```

On Node 24:

```text
Temporal is not available in Node 24.12.0
```

On Node 26 it prints today's date instead. [The Temporal API lesson](/courses/nodejs/temporal-api) covers it fully.

Node 26 also removed a few old APIs, such as the old `res.writeHeader()` alias on HTTP responses (use `res.writeHead()` instead). Removals like this are why you test before jumping to a new major.

## A new schedule from Node 27

Starting with **Node 27 in April 2027**, Node moves to **one major release per year**, every April. Every release then becomes LTS in October.

The odd and even split goes away. You will no longer need to remember which numbers are "LTS numbers": every major line will become LTS.

## Which version should you use?

- **Learning or building an app:** the newest **Active LTS**. Today that is Node 24.
- **Trying new features:** the **Current** line, Node 26, on your own machine.
- **Writing a library others will install:** test against every line that is still supported.
- **Running in production:** always an LTS line, never an end-of-life one.

> **Tip:** The official list of versions and their dates lives on nodejs.org under "Previous Releases" and in the `nodejs/Release` repository on GitHub. Check it when you plan upgrades.

## Common mistakes

### Using Current in production

A Current line can still change quickly, and some packages may not support it yet. Use it to experiment, then wait until it becomes LTS for serious work.

### Staying on an end-of-life version

```text
v20.19.0
```

If `node --version` shows a line that has reached end of life, like Node 20, upgrade. New security problems will never be fixed for it. [Upgrading Across LTS Lines](/courses/nodejs/upgrading-across-lts-lines) shows how to move safely.

### Thinking LTS means "old"

LTS lines still get regular updates. Node 24 has received many minor releases with new features since it came out. LTS means **stable and supported**, not outdated.

### Mixing up Node and npm versions

`npm --version` prints a completely different number (such as `11.19.1`). npm is a separate tool with its own versions. When someone asks for your Node version, give them `node --version`.

## Quick recap

- A **release line** is a major version and all its updates.
- Version numbers are **MAJOR.MINOR.PATCH**; only major versions may break things.
- Lines move through **Current**, **Active LTS**, **Maintenance** and **end of life**.
- Until now, even versions became LTS and odd versions did not. From Node 27 (April 2027) there is one release a year, and every release becomes LTS.
- In October 2026: Node 26 is Current and becoming LTS, Node 24 is Active LTS, Node 22 is in Maintenance and Node 20 is end of life.
- Use Active LTS by default. Never run end-of-life versions in production.

<code id="code-content" class="language-javascript">
// release-check.mjs: where does my Node version sit in its life?
const [major, minor, patch] = process.versions.node.split('.').map(Number);
console.log(`Node ${major}.${minor}.${patch}`);
console.log(`  major ${major}: may contain breaking changes compared with ${major - 1}`);
console.log(`  minor ${minor}: new features, nothing broken`);
console.log(`  patch ${patch}: bug and security fixes`);
// --- LTS codename (undefined on Current or odd-numbered releases)
const codename = process.release.lts;
console.log(codename ? `LTS codename: ${codename}` : 'Not an LTS release (yet)');
// --- Status of the release lines as of October 2026
const lines = {
  26: 'Current, becomes LTS in late October 2026',
  25: 'End of life (odd-numbered, never LTS)',
  24: 'Active LTS (Krypton), supported until April 2028',
  22: 'Maintenance LTS (Jod), end of life in April 2027',
  20: 'End of life since April 2026: please upgrade',
};
console.log('\nRelease lines, October 2026:');
for (const [line, status] of Object.entries(lines).reverse()) {
  const marker = Number(line) === major ? '  &lt;-- you' : '';
  console.log(`  Node ${line}: ${status}${marker}`);
}
if (!(major in lines)) {
  console.log(`  Node ${major} is not in this list: check nodejs.org for its status.`);
}
// --- Feature detection beats version guessing
if (typeof Temporal !== 'undefined') {
  console.log('\nTemporal is on. Today is', Temporal.Now.plainDateISO().toString());
} else {
  console.log('\nTemporal is not available here (it is on by default in Node 26).');
}
// --- Odd lines (before Node 27) never became LTS
if (major &lt; 27 &amp;&amp; major % 2 === 1) {
  console.log('Odd-numbered line: short support, use an even LTS line for real work.');
}
</code></pre>
