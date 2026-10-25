---
publishDate: 2026-10-25T09:00
title: Command-line Arguments with util.parseArgs
slug: parsing-command-line-arguments
metadescription: Turn commands like node greet.mjs --name Asha -l into tidy values with the built-in util.parseArgs, with flags, short options, defaults and helpful errors.
updateDate: 2026-10-25T09:00
author: ['bishal-biswas']
level: 1
tags: ['cli', 'arguments', 'util']
course: nodejs
---

## What are command-line arguments?

**Command-line arguments** are the extra words you type after the script name. They let one script do different jobs without editing the code.

Think of ordering coffee. "Coffee" is the script. "Large, oat milk, extra hot" are the arguments. Same drink, customised each time.

```bash
node greet.mjs --name Asha --loud
```

Here `--name Asha` and `--loud` are arguments. This lesson shows how to read them cleanly.

## Some words you will need

- An **option** (or **flag**) starts with dashes, like `--name` or `--loud`.
- A **long option** uses two dashes and a word: `--name`.
- A **short option** uses one dash and one letter: `-n`.
- A **boolean option** is on or off and takes no value: `--loud`.
- A **string option** needs a value: `--name Asha`.
- A **positional argument** is a plain word with no dashes, like `notes.txt`. Its meaning comes from its position.

## The hard way: process.argv

In the Globals lesson you met `process.argv`. Your own arguments start at index 2:

```javascript
// raw.mjs
console.log(process.argv.slice(2));
```

```bash
node raw.mjs --name Asha --loud
```

```text
[ '--name', 'Asha', '--loud' ]
```

You get a flat list of strings. Working out that `Asha` belongs to `--name`, that `-n` means the same as `--name`, and that `--name=Asha` is also valid, takes a lot of fiddly code. Node has a built-in helper for exactly this.

## Meet util.parseArgs

`parseArgs` lives in the built-in `node:util` module. You describe the options you accept, and it does the parsing.

```javascript
// greet.mjs
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    loud: { type: 'boolean' },
  },
});

console.log(values);
```

```bash
node greet.mjs --name Asha --loud
```

```text
[Object: null prototype] { name: 'Asha', loud: true }
```

`values` is an object with one key per option. The `[Object: null prototype]` label just means it is a plain object with no inherited properties. You use it like any other object: `values.name`, `values.loud`.

By default, `parseArgs` reads `process.argv` for you and skips the first two items.

### Both value styles work

```bash
node greet.mjs --name Asha
node greet.mjs --name=Asha
```

Both give `{ name: 'Asha' }`.

## Short options

Add `short` to give an option a one-letter alias:

```javascript
const { values } = parseArgs({
  options: {
    name: { type: 'string', short: 'n' },
    loud: { type: 'boolean', short: 'l' },
  },
});
```

Now all of these mean the same thing:

```bash
node greet.mjs --name Maya --loud
node greet.mjs -n Maya -l
node greet.mjs -ln Maya
```

The last one groups short booleans together, a common shell habit. Each gives `{ loud: true, name: 'Maya' }`.

## Default values

An option you leave out is simply missing from `values`, so reading it gives `undefined`. Use `default` to fill the gap:

```javascript
const { values } = parseArgs({
  options: {
    name: { type: 'string', short: 'n', default: 'friend' },
    loud: { type: 'boolean', short: 'l', default: false },
  },
});

console.log(`Hello, ${values.name}!`);
```

```bash
node greet.mjs
```

```text
Hello, friend!
```

## Numbers arrive as strings

There are only two types: `'string'` and `'boolean'`. If you want a number, convert it yourself:

```javascript
const { values } = parseArgs({
  options: {
    times: { type: 'string', short: 't', default: '1' },
  },
});

const times = Number(values.times);
if (!Number.isInteger(times) || times < 1) {
  console.error('--times must be a whole number above 0');
  process.exitCode = 1;
}
```

Note that the default is the string `'1'`, not the number `1`. A string option needs a string default. And if you forget to convert, `values.times + 1` gives `'31'`, not `4`.

## Repeating an option

Set `multiple: true` to accept the same option more than once. The value becomes an array:

```javascript
const { values } = parseArgs({
  options: {
    tag: { type: 'string', multiple: true },
  },
});

console.log(values.tag);
```

```bash
node note.mjs --tag work --tag urgent
```

```text
[ 'work', 'urgent' ]
```

## Positional arguments

By default `parseArgs` rejects plain words. Turn them on with `allowPositionals: true`, then read them from `positionals`:

```javascript
// note.mjs
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  options: {
    tag: { type: 'string', multiple: true },
  },
  allowPositionals: true,
});

console.log(positionals);
console.log(values.tag);
```

```bash
node note.mjs add "Buy milk" --tag home
```

```text
[ 'add', 'Buy milk' ]
[ 'home' ]
```

This is how tools like `git commit` work: the first positional is a command, the rest are its inputs. You will use this pattern in the to-do app project.

## Helpful errors for free

`parseArgs` is **strict** by default. It throws an error when the user types something you did not describe:

```bash
node greet.mjs --colour red
```

```text
TypeError [ERR_PARSE_ARGS_UNKNOWN_OPTION]: Unknown option '--colour'. ...
```

```bash
node greet.mjs --name
```

```text
TypeError [ERR_PARSE_ARGS_INVALID_OPTION_VALUE]: Option '-n, --name <value>' argument missing
```

A crash with a stack trace looks scary to users. Catch the error and print a friendly message instead:

```javascript
import { parseArgs } from 'node:util';

let parsed;
try {
  parsed = parseArgs({
    options: { name: { type: 'string', short: 'n' } },
  });
} catch (error) {
  console.error(`Error: ${error.message}`);
  console.error('Usage: node greet.mjs --name <name>');
  process.exitCode = 1;
}
```

## Adding a --help option

Most command-line tools print instructions when you pass `--help` or `-h`. It is just another boolean:

```javascript
const { values } = parseArgs({
  options: {
    help: { type: 'boolean', short: 'h' },
    name: { type: 'string', short: 'n', default: 'friend' },
  },
});

if (values.help) {
  console.log('Usage: node greet.mjs [--name <name>]');
} else {
  console.log(`Hello, ${values.name}!`);
}
```

## Common mistakes

### Forgetting allowPositionals

```javascript
const { values } = parseArgs({ options: { name: { type: 'string' } } });
```

```bash
node greet.mjs hello
```

```text
TypeError [ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL]: Unexpected argument 'hello'. This command does not take positional arguments
```

If your tool takes plain words, add `allowPositionals: true`.

### Giving a boolean option a value

```bash
node greet.mjs --loud=yes
```

```text
TypeError [ERR_PARSE_ARGS_INVALID_OPTION_VALUE]: Option '-l, --loud' does not take an argument
```

Boolean options are switched on by being present. Just type `--loud`.

> **Note:** Passing `--` tells `parseArgs` "everything after this is positional". So in `node note.mjs add -- --weird-title`, the text `--weird-title` becomes a positional, not an option.

## Quick recap

- Arguments after the script name customise what it does. `process.argv.slice(2)` gives the raw list.
- `parseArgs` from `node:util` turns that list into `values` and `positionals`.
- Each option has a `type` of `'string'` or `'boolean'`, and can have `short`, `default` and `multiple`.
- Numbers arrive as strings. Convert them with `Number()`.
- Set `allowPositionals: true` to accept plain words.
- Unknown or broken options throw, so wrap `parseArgs` in `try/catch` and set `process.exitCode = 1`.

<code id="code-content" class="language-javascript">
// greet.mjs
// Try: node greet.mjs -n Asha -t 3 --loud
//      node greet.mjs --help
//      node greet.mjs Ravi Maya --punctuation "?"
import { parseArgs } from 'node:util';
const usage = `Usage: node greet.mjs [names...] [options]
  -n, --name &lt;name&gt;      who to greet (default: friend)
  -t, --times &lt;number&gt;   how many times (default: 1)
  -l, --loud             shout the greeting
  -p, --punctuation &lt;s&gt;  end of the line (default: !)
  -h, --help             show this help`;
let parsed;
try {
  parsed = parseArgs({
    options: {
      name: { type: 'string', short: 'n', default: 'friend' },
      times: { type: 'string', short: 't', default: '1' }, // strings only, convert below
      loud: { type: 'boolean', short: 'l', default: false },
      punctuation: { type: 'string', short: 'p', default: '!' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true, // accept plain words as extra names
  });
} catch (error) {
  // Friendly message instead of a stack trace
  console.error(`Error: ${error.message}\n\n${usage}`);
  process.exitCode = 1;
}
if (parsed) {
  const { values, positionals } = parsed;
  const times = Number(values.times);
  if (values.help) {
    console.log(usage);
  } else if (!Number.isInteger(times) || times &lt; 1) {
    console.error('Error: --times must be a whole number above 0');
    process.exitCode = 1;
  } else {
    // Positional names win; otherwise use --name
    const names = positionals.length &gt; 0 ? positionals : [values.name];
    for (const name of names) {
      let line = `Hello, ${name}${values.punctuation}`;
      if (values.loud) line = line.toUpperCase();
      for (let i = 0; i &lt; times; i++) console.log(line);
    }
  }
}
</code></pre>
