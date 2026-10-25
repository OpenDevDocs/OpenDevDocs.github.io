---
publishDate: 2026-10-25T13:00
title: Building CLIs and Publishing to npm
slug: building-and-publishing-cli-tools
metadescription: Turn a Node script into a real command with the bin field and a shebang, test it with npm link, check the package, and publish it safely to npm.
updateDate: 2026-10-25T13:00
author: ['bishal-biswas']
level: 4
tags: ['cli', 'npm', 'publishing']
course: nodejs
---

## From script to command

So far you have run your programs like this: `node app.js`. That works, but it is not how real tools feel. Nobody types `node /some/folder/eslint.js`. They type `eslint`.

A **CLI** (command-line interface) is a program you run by typing its name in a terminal. Think of the difference between a recipe on a sheet of paper and a kitchen appliance. The recipe works, but you have to follow it yourself. The appliance has one button.

In this lesson you will turn a script into a command called `greet`, try it on your own machine, check exactly what would be uploaded, and learn how to publish it to npm safely. You will not actually publish anything here, but you will know every step.

## The project

Here is the folder you will build:

```text
greet-cli/
  bin/
    greet.js      <- the command itself
  src/
    greet.js      <- the real logic, easy to test
  package.json
  README.md
```

Keeping the logic in `src/` and the command-line handling in `bin/` is a good habit. You can test `src/greet.js` with the built-in test runner without touching `process.argv`.

```javascript
// src/greet.js
export function greet(name, { shout = false } = {}) {
  const message = `Hello, ${name}!`;
  return shout ? message.toUpperCase() : message;
}
```

## Step 1: the shebang line

The first line of the command file is special:

```javascript
#!/usr/bin/env node
// bin/greet.js
import { parseArgs } from 'node:util';
import { greet } from '../src/greet.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    shout: { type: 'boolean', short: 's', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help || positionals.length === 0) {
  console.log('Usage: greet <name> [--shout]');
  process.exit(values.help ? 0 : 1);
}

console.log(greet(positionals[0], { shout: values.shout }));
```

The line `#!/usr/bin/env node` is called a **shebang**. On macOS and Linux it tells the operating system: "run this file with whatever `node` is on the PATH". Without it, the shell would try to run your JavaScript as a shell script and fail with confusing errors.

On Windows the shebang is ignored, but npm reads it and creates a small `greet.cmd` wrapper for you. So always include it.

You met `parseArgs` in [the Command-line Arguments lesson](/courses/nodejs/parsing-command-line-arguments). It turns `--shout` and `-s` into `values.shout`, and leftover words into `positionals`.

Try it directly first:

```bash
node bin/greet.js Asha
node bin/greet.js Ravi --shout
```

```text
Hello, Asha!
HELLO, RAVI!
```

## Step 2: the bin field

Now tell npm that this package provides a command. That is the job of the **`bin`** field in `package.json`:

```json
{
  "name": "@asha/greet-cli",
  "version": "1.0.0",
  "description": "Say hello from the terminal",
  "type": "module",
  "bin": {
    "greet": "./bin/greet.js"
  },
  "files": ["bin", "src"],
  "engines": {
    "node": ">=22"
  },
  "license": "MIT"
}
```

- The **key** (`greet`) is the command name people will type.
- The **value** is the file to run.

When someone installs your package globally, npm puts a `greet` link on their PATH that points to `bin/greet.js`. On macOS and Linux it also marks the file as executable for them.

> **Note:** `"engines"` does not stop installs by default, but it tells users (and tools) which Node versions you support. Your package uses `parseArgs` and ES modules, so be honest about the minimum.

## Step 3: try it with npm link

You do not want to publish just to see if the command works. **`npm link`** makes a global link from your machine straight to your project folder:

```bash
cd greet-cli
npm link
greet Maya
```

```text
Hello, Maya!
```

Because it is a link, not a copy, any edit you make to `bin/greet.js` is live immediately. No reinstalling.

When you are done, remove the global link:

```bash
npm uninstall -g @asha/greet-cli
```

> **Tip:** If `greet` says "command not found" after linking, open a new terminal. Some shells cache the list of commands.

## Step 4: decide what gets shipped

When you publish, npm uploads a **tarball** (a single compressed `.tgz` file) of your package. You want it small and free of secrets.

The **`files`** field is an allow-list: only the listed files and folders go in. A few files are always included anyway: `package.json`, `README`, `LICENSE` and the files named in `main` and `bin`.

Check the result without creating anything:

```bash
npm pack --dry-run
```

```text
npm notice package: @asha/greet-cli@1.0.0
npm notice Tarball Contents
npm notice 8B README.md
npm notice 525B bin/greet.js
npm notice 266B package.json
npm notice 159B src/greet.js
npm notice Tarball Details
npm notice total files: 4
```

Your local `notes.txt`, tests and `.env` are not in the list. That is exactly what you want.

> **Tip:** Run `npm pack --dry-run` before every first release. It takes one second and has saved many people from publishing a `.env` file full of passwords.

## Step 5: a good CLI is polite

A few habits make your tool feel professional:

- **Results go to stdout, problems go to stderr.** Use `console.log` for output and `console.error` for errors. Then people can pipe your output into other tools without error messages mixed in.
- **Exit codes matter.** `0` means success. Anything else means failure. Scripts and CI pipelines check this number.
- **Always support `--help`.** It is the first thing people try.
- **Catch bad input.** `parseArgs` throws on unknown flags. Catch it and print one friendly line instead of a stack trace.

```javascript
try {
  parsed = parseArgs({ options, allowPositionals: true });
} catch (err) {
  console.error(`greet: ${err.message}`);
  process.exit(2); // 2 is a common code for "you used it wrong"
}
```

## Step 6: publishing (the manual way)

To publish by hand you would:

```bash
npm login            # opens the browser to sign in
npm whoami           # check who you are signed in as
npm version patch    # 1.0.0 -> 1.0.1, also makes a git tag
npm publish --access public
```

- **Scoped names** like `@asha/greet-cli` are private by default, so the first publish needs `--access public`.
- `npm version` bumps the number in `package.json` following semver (from [the Semantic Versioning lesson](/courses/nodejs/semver-and-lockfiles)).
- Once a version is published, that exact number can never be reused, even if you unpublish it.

You can also run `npm publish --dry-run` to see what would happen without uploading.

## Step 7: provenance and trusted publishing

Publishing from your laptop works, but it has a weakness: anyone who steals your npm token can publish a "new version" of your package with malware in it. You read about these attacks in [the Security lesson](/courses/nodejs/security-and-supply-chain).

Two features fix this.

### Provenance

**Provenance** is a signed statement attached to your package that says "this exact tarball was built from this exact commit, in this repository, by this CI workflow". The npm website shows it as a badge, and users can check it.

You ask for it with a flag, but it only works from a supported CI system (such as GitHub Actions), not from your laptop:

```bash
npm publish --provenance --access public
```

### Trusted publishing

**Trusted publishing** goes one step further: there is no long-lived npm token at all. On the npm website, in your package's settings, you add GitHub Actions as a **trusted publisher** and name your repository and workflow file. From then on, npm accepts a short-lived identity token that GitHub creates for that one workflow run.

With trusted publishing, npm generates provenance for you automatically. The workflow looks like this:

```yaml
# .github/workflows/publish.yml
name: Publish to npm

on:
  release:
    types: [published]

permissions:
  contents: read
  id-token: write # lets the job ask GitHub for an identity token

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm publish --access public
```

Now publishing means: create a GitHub release, and the workflow tests and publishes it. Nobody's laptop holds a token that can be stolen. You will learn the rest of GitHub Actions in [the CI/CD lesson](/courses/nodejs/ci-cd-for-node-projects).

> **Note:** Trusted publishing needs a recent npm (version 11.5.1 or newer). The npm that ships with Node 24 is new enough. You set up the trusted publisher on npmjs.com after the package exists there.

## Common mistakes

**Forgetting the shebang.** The command fails on macOS and Linux with strange shell errors like `import: command not found`.

```javascript
// Wrong: first line is a comment
// bin/greet.js
import { greet } from '../src/greet.js';
```

```javascript
// Right: shebang must be the very first line, before anything else
#!/usr/bin/env node
// bin/greet.js
import { greet } from '../src/greet.js';
```

**Leaving `src` out of `files`.** It works with `npm link` (which uses your real folder) but breaks for everyone who installs it. `npm pack --dry-run` catches this.

**Windows line endings.** If the shebang line ends with `\r\n`, Linux sees `node\r` and reports "No such file or directory". Make sure your editor saves `bin/` files with LF line endings.

**Using `"main"` instead of `"bin"`.** `main` is what `import` loads. `bin` is what the terminal runs. A CLI needs `bin`.

## Quick recap

- A CLI is a script with a shebang (`#!/usr/bin/env node`) and a `bin` entry in `package.json`.
- The `bin` key is the command name; the value is the file it runs.
- `npm link` installs a live link to your folder so you can test the command locally.
- `files` is an allow-list of what ships; check it with `npm pack --dry-run`.
- Print results to stdout, errors to stderr, and use exit codes.
- Publish from CI with provenance, and prefer trusted publishing so no npm token lives on a laptop.

<code id="code-content" class="language-javascript">
#!/usr/bin/env node
// greet.mjs: a tiny but complete CLI in one file.
// Try: node greet.mjs Ravi --shout --times 2
import { parseArgs } from 'node:util';
const HELP = `Usage: greet &lt;name&gt; [options]
  -s, --shout       print in capitals
  -t, --times &lt;n&gt;   repeat the greeting n times
  -h, --help        show this help`;
let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      shout: { type: 'boolean', short: 's', default: false },
      times: { type: 'string', short: 't', default: '1' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
} catch (err) {
  // Unknown flags land here: one friendly line, exit code 2
  console.error(`greet: ${err.message}`);
  process.exit(2);
}
const { values, positionals } = parsed;
if (values.help) {
  console.log(HELP);
  process.exit(0);
}
// No name given? Use a demo name so the playground still prints something
const name = positionals[0] ?? 'Asha';
const times = Number(values.times);
if (!Number.isInteger(times) || times &lt; 1) {
  console.error('greet: --times must be a whole number above 0');
  process.exit(1);
}
let message = `Hello, ${name}!`;
if (values.shout) message = message.toUpperCase();
// Results go to stdout; errors above went to stderr
for (let i = 0; i &lt; times; i++) {
  console.log(message);
}
</code></pre>
