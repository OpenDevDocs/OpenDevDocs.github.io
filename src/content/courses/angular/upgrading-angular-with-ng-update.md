---
publishDate: 2026-06-30T14:00
title: Upgrading Angular with ng update
slug: upgrading-angular-with-ng-update
metadescription: Keep an Angular application current with ng update, handle a multi version jump, and recover when an upgrade goes wrong.
updateDate: 2026-09-07T14:00
author: ['bishal-biswas']
level: 4
tags: ['upgrading', 'migration', 'tooling']
course: angular
---

## Why upgrading is manageable

Angular ships a major version every six months, which sounds alarming and mostly is not. Each release includes **migration schematics** that rewrite your code for renamed APIs, so an upgrade is usually a command and a review.

Each major version is supported for 18 months: six months of active support and twelve of long term support with security fixes only.

Falling more than two versions behind is where it gets painful, because you then upgrade through several at once.

## The command

```bash
ng update
```

With no arguments it prints what can be updated and what is available.

```bash
ng update @angular/core @angular/cli
```

Always update `@angular/core` and `@angular/cli` **together**. They are versioned in lockstep, and a mismatch produces confusing build errors.

```bash
ng update @angular/core@22 @angular/cli@22
ng update @angular/material@22
```

Update Angular first, then Material and other Angular libraries, since they depend on the core version.

## Before you start

```bash
git status                # a clean working tree
npm test                  # a passing suite
ng build                  # a working build
git checkout -b upgrade-angular-22
```

A clean tree matters because the migrations modify many files, and you want the diff to contain only their changes.

A passing test suite before you start is what lets you attribute a failure afterwards.

## One version at a time

```bash
# from 19 to 22
ng update @angular/core@20 @angular/cli@20
npm test && ng build
git commit -am "Upgrade to Angular 20"

ng update @angular/core@21 @angular/cli@21
npm test && ng build
git commit -am "Upgrade to Angular 21"

ng update @angular/core@22 @angular/cli@22
npm test && ng build
git commit -am "Upgrade to Angular 22"
```

Do **not** jump several versions in one command. Each version's migrations expect the previous version's code, so skipping means migrations do not run and you fix by hand what a schematic would have done.

Committing between versions means a failure is attributable to one step, and you can go back one rather than starting over.

## Reading the diff

```bash
git diff --stat
git diff src/app/some-file.ts
```

The migrations are good, and reviewing is still worth the time. Look for:

**Formatting changes** that make the diff noisy. Running your formatter afterwards and committing separately keeps the real changes visible.

**Anything that looks wrong.** Migrations occasionally handle an unusual pattern badly.

**Commented out code.** Some migrations leave a comment where they could not safely change something.

## When it fails

**Peer dependency conflicts.**

```bash
npm ls @angular/core
```

A third party library pinned to an older Angular blocks the update. Options, best first: update the library, find a maintained alternative, or use `--force` and test very carefully.

```bash
ng update @angular/core@22 @angular/cli@22 --force
```

`--force` ignores peer dependency warnings. It sometimes works and sometimes produces a broken build with unclear errors, so treat it as a last resort rather than a habit.

**A migration throws.** Run the migrations individually to find which one:

```bash
ng update @angular/core@22 --migrate-only --from=21
```

**The build fails afterwards.** Read the error properly. Angular's build errors are usually specific, and the release notes list breaking changes.

## Recovering

```bash
git reset --hard HEAD
git clean -fd
npm ci
```

Because you committed between versions, this returns you to a working state. That is the whole reason for committing between steps.

## Modernisation migrations

Separate from version upgrades, these rewrite old patterns into current ones. They are optional and can be run at any time.

```bash
ng generate @angular/core:standalone
ng generate @angular/core:control-flow
ng generate @angular/core:signal-input-migration
ng generate @angular/core:output-migration
ng generate @angular/core:signal-queries-migration
ng generate @angular/core:inject
ng generate @angular/core:self-closing-tag
```

Run one at a time, build, test, commit. A combined diff of several is unreviewable.

Order that works well:

1. `control-flow`, which is low risk and removes `CommonModule` imports.
2. `inject`, which is mechanical.
3. `signal-input-migration` and `output-migration`, converting inputs and outputs together.
4. `signal-queries-migration`.
5. `standalone`, if still on NgModules, in its own three stages.

## Checking for deprecations

```bash
ng build 2>&1 | grep -i deprecat
npx ng lint
```

Deprecation warnings during a build are next version's breaking changes. Fixing them as they appear is much cheaper than fixing a batch of them under time pressure.

## Keeping current

```json
{
  "scripts": {
    "check-updates": "ng update && npm outdated"
  }
}
```

A tool like Renovate or Dependabot opening upgrade pull requests automatically keeps the gap small. The work is roughly linear in how far behind you are, and it compounds: two versions behind is more than twice the work of one.

**Set a calendar reminder for the May and November releases.** Upgrading within a month or two of each release keeps it a routine task rather than a project.

## When you are badly behind

An application on Angular 12 upgrading to 22 is ten major versions.

**Upgrade one version at a time**, testing between each. There is no shortcut.

**Expect real work at some points.** The Ivy transition, the removal of the view engine and the typed forms change all needed manual attention.

**Consider the timing.** Ten upgrades is a project, not an afternoon. Plan it rather than starting on a Friday.

**Have tests first.** Upgrading without a test suite means manually verifying an application ten times. If the suite is thin, writing tests for the critical paths first is time well spent.

## Quick recap

- `ng update` rewrites your code for renamed APIs, which is what makes upgrades manageable.
- Update `@angular/core` and `@angular/cli` together, then other Angular libraries.
- Upgrade one major version at a time, committing between each.
- Start from a clean tree with passing tests so failures are attributable.
- `--force` past peer dependency conflicts is a last resort, not a habit.
- Run modernisation schematics separately, one at a time.
- Upgrade within a month or two of each release, and the work stays small.

<code id="code-content" class="language-bash">
# Angular ships every six months, and each release includes MIGRATION
# SCHEMATICS that rewrite your code for renamed APIs. That is what makes
# upgrading a command and a review rather than a project.
# BEFORE YOU START. A clean tree means the diff contains only the
# migrations' changes. Passing tests mean a failure is attributable.
git status                       # clean
npm test &amp;&amp; ng build             # both passing
git checkout -b upgrade-angular-22
# See what is available
ng update
# ONE MAJOR VERSION AT A TIME, committing between each. Each version's
# migrations expect the PREVIOUS version's code, so skipping means the
# migrations do not run and you fix by hand what a schematic would have done.
ng update @angular/core@20 @angular/cli@20
npm test &amp;&amp; ng build
git commit -am "Upgrade to Angular 20"
ng update @angular/core@21 @angular/cli@21
npm test &amp;&amp; ng build
git commit -am "Upgrade to Angular 21"
# core and cli are versioned in LOCKSTEP. Updating one alone produces
# confusing build errors. Update Angular first, then Material and other
# Angular libraries, which depend on the core version.
ng update @angular/core@22 @angular/cli@22
ng update @angular/material@22
# WHEN IT FAILS
npm ls @angular/core             # find the library blocking the update
ng update @angular/core@22 --migrate-only --from=21   # isolate a failing migration
# --force ignores peer dependency warnings. Sometimes it works, sometimes
# it produces a broken build with unclear errors. Last resort, not a habit.
ng update @angular/core@22 @angular/cli@22 --force
# RECOVERING. This works precisely because you committed between versions.
git reset --hard HEAD &amp;&amp; git clean -fd &amp;&amp; npm ci
# MODERNISATION migrations are separate from version upgrades and optional.
# Run ONE at a time, build, test, commit. A combined diff is unreviewable.
ng generate @angular/core:control-flow             # 1. low risk, drops CommonModule
ng generate @angular/core:inject                   # 2. mechanical
ng generate @angular/core:signal-input-migration   # 3. inputs and outputs
ng generate @angular/core:output-migration         #    together
ng generate @angular/core:signal-queries-migration # 4.
ng generate @angular/core:standalone               # 5. its own three stages
# Deprecation warnings today are next version's breaking changes.
# Fixing them as they appear is far cheaper than a batch under pressure.
ng build 2&gt;&amp;1 | grep -i deprecat
# KEEP THE GAP SMALL. The work is worse than linear in how far behind you
# are: two versions behind is more than twice the work of one. Upgrade
# within a month or two of the May and November releases and it stays routine.
</code></pre>
