---
publishDate: 2026-10-25T14:01
title: Upgrading Next.js Safely
slug: upgrading-nextjs
metadescription: Upgrade Next.js safely with next upgrade and codemods, read release notes, and handle the big 15 to 16 changes like async params, proxy.js and Turbopack.
updateDate: 2026-10-25T14:01
author: ['bishal-biswas']
level: 3
tags: ['nextjs', 'upgrading', 'codemods', 'maintenance']
course: nextjs
---

## Why upgrading needs a plan

Next.js releases often: small **patch** releases with fixes (16.4.2 to 16.4.3), **minor** releases with new features (16.3 to 16.4), and about once a year a **major** release (15 to 16) that may break existing code. Staying current matters: you get security fixes, speed-ups and new features, and the longer you wait, the bigger the jump.

Upgrading is like moving house. A short move across the street (a patch) is easy. Moving to another country (a major version) needs a checklist: what to pack, what does not work there, and which papers to update. In this lesson you will learn that checklist:

1. Read version numbers and release notes.
2. Prepare a safe upgrade on a branch.
3. Run the upgrade command and codemods.
4. Understand the big changes from Next.js 15 to 16, so you can read older projects and fix them.
5. Check that everything still works.

## Step 1: know where you are

Your installed versions live in `package.json`. Book Nook's looks like this:

```json
{
  "dependencies": {
    "next": "16.4.3",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "eslint-config-next": "16.4.3"
  }
}
```

A version has three numbers: **major.minor.patch**. Next.js follows **semantic versioning**: only a major change is allowed to break your code on purpose. To see everything about your setup at once, run:

```bash
npx next info
```

It prints your operating system, Node.js version, and the versions of `next`, `react`, `react-dom` and friends. Paste this output into any bug report.

Before a major upgrade, read what changed:

- The **release blog post** on [nextjs.org](https://nextjs.org/blog) explains new features in plain words.
- The **upgrade guide** for that version, in the Next.js docs under Guides, Upgrading (for example "Version 16"), lists every breaking change with before and after code.
- The **release notes** on the Next.js GitHub releases page list every change in detail. You rarely need all of them, but search them for features you use.

A useful habit: list the Next.js features your app uses (middleware, images, caching, ESLint, custom webpack config...) and check each one in the upgrade guide.

## Step 2: prepare a safe upgrade

Never upgrade directly on the code that is live. Do it on a branch, with tests you trust:

```bash
git checkout -b upgrade-next
npm run lint
npm test
npm run build
```

If everything passes **before** the upgrade, then any failure afterwards was caused by the upgrade. That makes problems much easier to find. Your Vitest and Playwright tests from [Unit Testing with Vitest](/courses/nextjs/testing-with-vitest) and [End-to-End Testing with Playwright](/courses/nextjs/testing-with-playwright) earn their keep here.

Also check Node.js. Next.js 16 needs **Node.js 20.9 or newer**:

```bash
node --version
```

## Step 3: run the upgrade command

Since Next.js 16.1, the `next` package has its own upgrade command. From your project folder:

```bash
npx next upgrade
```

It updates `next`, `react`, `react-dom` and related packages, and offers to run the **codemods** that match the upgrade. A **codemod** is a small program that edits your code for you: it reads your files, finds an old pattern, and rewrites it in the new style. It is like a very careful find and replace that understands JavaScript.

By default it stays on your current release channel. To pick a target, pass a revision:

```bash
npx next upgrade --revision latest
```

If your project is **older than 16.1**, it does not have that command yet. Use the separate codemod package instead. This is also what the version 16 upgrade guide shows:

```bash
npx @next/codemod@canary upgrade latest
```

The `@canary` part runs the newest version of the codemod tool itself, so it knows about the latest changes, even when the version you install is the stable `latest`. You can also say how far to jump:

```bash
npx @next/codemod upgrade patch    # for example 16.0.7 to 16.0.8
npx @next/codemod upgrade minor    # the default for stable versions
npx @next/codemod upgrade major    # for example 15.5.7 to 16.0.7
npx @next/codemod upgrade 16       # a specific version
```

During the upgrade you may be asked which codemods to apply, and whether to run the React 19 codemods. Accept the recommended ones, then **review every change** with `git diff` before you commit. Codemods are very good, but not perfect. When they cannot fix something safely, they leave a comment in your code for you to finish by hand.

> **Good to know:** The docs also describe `npx next@canary upgrade --agent=latest`, which hands the upgrade to an AI coding agent along with the matching migration guides. It is marked experimental. Whoever does the work, the checks in Step 5 still apply.

### Running a single codemod

Every codemod can also run on its own:

```bash
npx @next/codemod <transform> <path>
```

Two flags make this safe to try:

- `--dry` shows what would change, without editing any file.
- `--print` prints the changed output so you can compare.

For example, to preview the middleware rename:

```bash
npx @next/codemod@latest middleware-to-proxy . --dry
```

## Step 4: the big changes from 15 to 16

Even if you started this course on Next.js 16, you will meet older projects, tutorials and Stack Overflow answers. These are the changes that trip people up most.

### Node.js 20.9 and modern browsers

Node.js 18 is no longer supported. The minimum is 20.9.0, TypeScript 5.1 for TypeScript projects, and browsers from roughly 2023 onwards (Chrome, Edge and Firefox 111, Safari 16.4).

### Turbopack is the default bundler

In Next.js 15 you had to opt in with `next dev --turbopack`. Now `next dev` and `next build` use Turbopack by default, so old scripts can be simplified:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

If your project has a custom `webpack` function in `next.config`, `next build` now **fails** on purpose, so the config is not silently ignored. Either move the config to Turbopack options (the old `experimental.turbopack` settings now live at the top-level `turbopack` key, like the Tailwind rule in Book Nook's config), or keep webpack for now with `next build --webpack`.

### Request APIs are async only

Next.js 15 made `params`, `searchParams`, `cookies()`, `headers()` and `draftMode()` return Promises, but still allowed the old synchronous use with a warning. Next.js 16 **removes** the synchronous form. Old code like this breaks:

```jsx
// app/books/[id]/page.js (Next.js 14 style: breaks in 16)
export default function BookPage({ params }) {
  const book = getBookSync(params.id);
  // ...
}
```

The Next.js 16 way, which you have used all course long (see [Dynamic Routes and params](/courses/nextjs/dynamic-routes) and [Reading Cookies and Headers](/courses/nextjs/cookies-and-headers)):

```jsx
// app/books/[id]/page.js
export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  // ...
}
```

The `upgrade` codemod does **not** do this one for you. Run it separately:

```bash
npx @next/codemod@canary next-async-request-api .
```

In a Client Component, where you cannot use `await`, unwrap the Promise with React's `use()` instead. The same change applies to the `params` of `opengraph-image`, `icon` and the `id` of `sitemap` functions.

### middleware.js is now proxy.js

The file that runs before requests was renamed to make its job clearer, as you learned in [Running Code Before Requests with Proxy](/courses/nextjs/proxy):

```bash
# Rename your middleware file
mv middleware.js proxy.js
```

```javascript
// proxy.js
export function proxy(request) {
  // ...same code as before
}
```

The exported function is now called `proxy`, and config flags with "middleware" in their name were renamed too (for example `skipMiddlewareUrlNormalize` became `skipProxyUrlNormalize`). One catch: `proxy.js` always runs on Node.js. If your old middleware relied on the Edge runtime, the docs say to keep it as `middleware` for now rather than renaming it blindly. The `middleware-to-proxy` codemod handles the rename.

### `next lint` is gone

`next lint` was removed, and `next build` no longer runs ESLint. Projects now call ESLint directly, which is why Book Nook's `package.json` says `"lint": "eslint"` and has an `eslint.config.mjs` **flat config** file. To migrate an older project:

```bash
npx @next/codemod@canary next-lint-to-eslint-cli .
```

Remember to add `npm run lint` to your CI, since the build will not catch lint errors any more.

### Caching APIs

- `revalidateTag(tag)` now needs a second argument, a `cacheLife` profile: `revalidateTag('books', 'max')`. For "show my change right now" in a Server Action, use the new `updateTag(tag)` instead (as in [Cache Lifetimes, Tags and Revalidation](/courses/nextjs/cache-life-and-revalidation)).
- `cacheLife` and `cacheTag` are stable, so imports like `unstable_cacheLife as cacheLife` become `import { cacheLife, cacheTag } from 'next/cache'`.
- The old `experimental.dynamicIO` and `experimental.useCache` flags were removed. Their replacement is the top-level `cacheComponents: true`. Turning it on is not just a rename: it changes how pages render, and may surface build errors about data outside `<Suspense>`. Do it as its own step, after the upgrade works.

### Smaller changes worth knowing

- **Parallel routes** need an explicit `default.js` in every slot, or the build fails.
- **`next/image` defaults:** `minimumCacheTTL` went from 60 seconds to 4 hours, `qualities` now only allows `[75]` unless you configure more, `16` was removed from `imageSizes`, local images with query strings need `images.localPatterns`, and `images.domains` is deprecated in favour of `remotePatterns`.
- **Removed:** AMP support, `serverRuntimeConfig` and `publicRuntimeConfig` (use environment variables), and the `eslint` option in `next.config`.
- **`next dev` and `next build` use separate folders** (`.next/dev` and `.next`), so you can run both at once.

## Step 5: check everything

After the upgrade and codemods, run the same checks as before you started:

```bash
npm install
npm run lint
npm test
npm run build
npx playwright test
```

Then click through the app with `npm run dev`, and look at the build's route table. Compare it with the table from before the upgrade (see [Building for Production](/courses/nextjs/building-for-production)): if a page that used to be `○` is now `ƒ`, find out why.

The version 16 guide ends with a checklist that is worth copying into your pull request. In short:

- Node.js, React and TypeScript meet the new minimums.
- Dev and build scripts match the bundler you really use.
- Middleware became proxy without losing behaviour (Edge middleware was not blindly renamed).
- Images still load with the new defaults.
- Cache API calls use the new signatures.
- Nothing still calls `next lint`.
- All async request API changes are done, and any comments the codemod left are resolved.
- The app's own checks pass. A green build alone is not enough.

When all is green, commit, open a pull request, check the preview deployment ([Deploying to Vercel](/courses/nextjs/deploying-to-vercel)), and merge.

## Common mistakes

### Jumping several majors at once

Going straight from 13 to 16 mixes three sets of breaking changes. Upgrade one major version at a time (13 to 14, test, 14 to 15, test, 15 to 16), reading each version's guide.

### Running the old command on a new version (or the reverse)

You ran `npx next upgrade` in a project older than 16.1, and the CLI does not recognise the command. Versions before 16.1 do not have it. Use `npx @next/codemod@canary upgrade latest` there.

### Forgetting the async request API codemod

The build fails on code like `params.id` or `cookies().get('session')`. The `upgrade` codemod did not cover it. Run `npx @next/codemod@canary next-async-request-api .` and fix any spots it marked.

### A plugin adds a webpack config

Your build fails because "a webpack configuration was found", but you never wrote one. Some older plugins add a `webpack` function behind the scenes. Update or remove the plugin, or temporarily build with `--webpack`.

### ESLint peer dependency errors during install

`eslint-config-next@16` needs ESLint 9 or later. If the install fails with peer dependency conflicts, the docs suggest restoring your previous ESLint packages and rerunning the upgrade with `--skip-eslint-upgrade`, then migrating lint separately.

## Quick recap

- Versions are major.minor.patch; read the upgrade guide and release notes before a major jump.
- Upgrade on a branch, with lint, tests and a build that pass before you start.
- Use `npx next upgrade` on 16.1 and newer, or `npx @next/codemod@canary upgrade latest` on older projects, and review every codemod change.
- Next.js 16: Node.js 20.9+, Turbopack by default, async-only `params`/`cookies()`/`headers()`, `middleware.js` renamed to `proxy.js`, `next lint` removed, `revalidateTag` takes a profile and `updateTag` is new.
- Run single codemods with `npx @next/codemod <name> <path>`, trying `--dry` first.
- Finish with lint, tests, a build, a click-through and a preview deployment.

<code id="code-content" class="language-bash">
# A safe Next.js upgrade, step by step
# 1. Start from a clean, passing state on a new branch
git checkout -b upgrade-next
node --version          # Next.js 16 needs 20.9 or newer
npx next info           # current versions, for the record
npm run lint &amp;&amp; npm test &amp;&amp; npm run build
# 2. Upgrade (Next.js 16.1 and newer)
npx next upgrade
# ...or on projects older than 16.1
npx @next/codemod@canary upgrade latest
# 3. Codemods the upgrade command does not run for you
npx @next/codemod@canary next-async-request-api .
npx @next/codemod@canary next-lint-to-eslint-cli .
# Preview any codemod first with --dry
npx @next/codemod@latest middleware-to-proxy . --dry
# 4. Review every change the tools made
git diff
# 5. Check everything again
npm install
npm run lint
npm test
npm run build
npx playwright test
</code></pre>
