---
publishDate: 2026-06-23T12:00
title: Bundle Analysis and Build Budgets
slug: bundle-analysis-and-budgets
metadescription: Measure what is in your bundle, set budgets that fail the build when it grows, and find the imports costing you most.
updateDate: 2026-09-07T12:00
author: ['bishal-biswas']
level: 3
tags: ['performance', 'bundle', 'build']
course: angular
---

## Seeing what you shipped

```bash
ng build
```

```text
Initial chunk files   | Names         |  Raw size | Estimated transfer size
main-K3XR2A.js        | main          | 245.30 kB |                68.42 kB
styles-B7QW1P.css     | styles        |  12.44 kB |                 3.21 kB
polyfills-N8ZK4L.js   | polyfills     |  34.58 kB |                11.33 kB

                      | Initial total | 292.32 kB |                82.96 kB

Lazy chunk files      | Names         |  Raw size | Estimated transfer size
chunk-QW8ER2.js       | admin-routes  |  89.12 kB |                24.55 kB
```

**Initial total** is what a first time visitor downloads before anything renders. That is the number to watch.

The transfer size is after compression, and it is what actually crosses the network. Raw size still matters, because the browser has to parse and execute all of it.

Rough guidance for the initial transfer size: under 150 KB is good, 150 to 300 KB is workable, and over 500 KB will be slow on a mid range phone.

## Budgets

Budgets fail the build when the bundle grows past a limit, which is the only reliable way to stop gradual creep.

```json
"budgets": [
  {
    "type": "initial",
    "maximumWarning": "500kB",
    "maximumError": "1MB"
  },
  {
    "type": "anyComponentStyle",
    "maximumWarning": "4kB",
    "maximumError": "8kB"
  },
  {
    "type": "bundle",
    "name": "main",
    "maximumWarning": "300kB"
  }
]
```

The types:

```text
initial              everything loaded on first render
allScript            all JavaScript
all                  everything
anyComponentStyle    each component's styles
anyScript            each script file
bundle               one named bundle
```

Set the error threshold slightly above where you are now. A budget that already fails is one someone will delete.

## Finding what is large

```bash
ng build --stats-json
npx webpack-bundle-analyzer dist/my-app/stats.json
```

That opens a treemap where the area of each box is its size. Large unexpected boxes are your targets.

`source-map-explorer` works on the built files directly:

```bash
ng build --source-map
npx source-map-explorer dist/my-app/browser/main-*.js
```

## What is usually large

**Moment.js.** Around 70 KB with locales. Replace with `date-fns`, `dayjs`, or the built in `Intl.DateTimeFormat` and Angular's `DatePipe`.

**Lodash imported wholly.**

```typescript
import _ from 'lodash';              // the whole library
import { debounce } from 'lodash';   // still often the whole library

import debounce from 'lodash-es/debounce';   // just this function
```

Most of Lodash has a modern JavaScript equivalent. `Array.prototype.at`, spread, `Object.groupBy` and optional chaining cover a lot of it.

**Whole icon sets.** Importing an entire icon library for six icons. Use individual imports or inline the SVGs.

**Angular Material imported as a module.** Import the specific components rather than a barrel that re-exports everything.

**Locale data.** `registerLocaleData` for many locales adds up. Register only what you support.

**RxJS imported wrongly.**

```typescript
import { map } from 'rxjs/operators';   // fine
import * as rxjs from 'rxjs';           // pulls in everything
```

## The barrel file problem

```typescript
// shared/index.ts
export * from './button';
export * from './heavy-chart';
export * from './date-utils';
```

```typescript
import { Button } from '@shared';       // may pull in heavy-chart too
```

Tree shaking usually handles this, and usually is not always. Anything with side effects at module level survives.

If a chunk is unexpectedly large, check barrel imports first and import from the specific file.

## Checking for duplicates

Two versions of the same library both shipping is a common and invisible waste.

```bash
npm ls rxjs
npm dedupe
```

The analyser treemap shows duplicates clearly, as two boxes with the same name.

## Reducing the initial bundle

**Lazy load routes.** The single biggest lever. Only the shell and the landing page should be in the initial bundle.

**Defer heavy components** with `@defer`, especially charts, editors and maps.

**Remove Zone.js** by going zoneless, saving around 30 KB.

**Check your polyfills.** Modern browser targets need very few.

```json
"browserslist": ["last 2 Chrome versions", "last 2 Firefox versions", "last 2 Safari versions"]
```

A narrower target produces less transpiled output and fewer polyfills. Widening it to very old browsers costs everyone.

**Use `provideHttpClient(withFetch())`.** Slightly smaller than the XHR path.

**Import individual directives** rather than `CommonModule`, and use `@if` and `@for` so you need neither.

## Measuring the effect

Record the numbers before changing anything.

```bash
ng build > before.txt
# make the change
ng build > after.txt
```

Then check whether it mattered to users. A 20 KB saving is not worth a week of work if Largest Contentful Paint does not move.

The metrics that matter are Largest Contentful Paint, Interaction to Next Paint and Cumulative Layout Shift, not the bundle number on its own.

## In continuous integration

```yaml
- run: npm ci
- run: npx ng build
```

The build fails automatically when a budget is exceeded, so a large dependency added in a pull request is caught before merging rather than three months later.

That is the main value of budgets. They are a ratchet, not a report.

## Quick recap

- `ng build` prints initial and lazy chunk sizes, and initial total is the number to watch.
- Budgets fail the build on growth, which is the only thing that stops gradual creep.
- Set thresholds slightly above current size, or people delete them.
- Use `--stats-json` with an analyser to see a treemap of what is large.
- Moment, whole Lodash, entire icon sets and barrel imports are the usual culprits.
- Lazy loading routes is the biggest single reduction available.
- Judge the change by Core Web Vitals, not by the bundle number alone.

<code id="code-content" class="language-bash">
# What did we ship? Initial total is what a first visitor downloads.
ng build
#   Initial chunk files | Names     | Raw size  | Estimated transfer size
#   main-K3XR2A.js      | main      | 245.30 kB |                68.42 kB
#   polyfills-N8ZK4L.js | polyfills |  34.58 kB |                11.33 kB
#                       | Initial   | 292.32 kB |                82.96 kB
# Rough guidance for initial TRANSFER size:
#   under 150 kB  good      150-300 kB  workable      over 500 kB  slow on mobile
# See a treemap of what is actually large
ng build --stats-json
npx webpack-bundle-analyzer dist/my-app/stats.json
# Or work from the built files directly
ng build --source-map
npx source-map-explorer dist/my-app/browser/main-*.js
# Two copies of one library is a common invisible waste
npm ls rxjs
npm dedupe
# BUDGETS in angular.json fail the build on growth. This is a ratchet,
# not a report: it catches a heavy dependency in a pull request rather
# than three months later. Set the error slightly ABOVE current size,
# or someone will delete it.
#   "budgets": [
#     { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
#     { "type": "anyComponentStyle", "maximumWarning": "4kB" },
#     { "type": "bundle", "name": "main", "maximumWarning": "300kB" }
#   ]
# The usual culprits:
#   moment.js               ~70 kB with locales -&gt; date-fns, dayjs, or Intl
#   import _ from 'lodash'  the whole library   -&gt; lodash-es/debounce
#   a whole icon set for six icons              -&gt; individual imports or inline SVG
#   import * as rxjs from 'rxjs'                -&gt; import { map } from 'rxjs'
#   barrel files (shared/index.ts)              -&gt; import from the specific file
#   registerLocaleData for locales you do not support
# Biggest reductions, in order:
#   1. lazy load routes            only the shell should be in the initial bundle
#   2. @defer heavy components     charts, editors, maps
#   3. go zoneless                 removes ~30 kB of zone.js
#   4. narrow your browserslist    less transpilation, fewer polyfills
# Measure before and after, then check it MATTERED:
ng build &gt; before.txt
ng build &gt; after.txt
# Judge by Largest Contentful Paint and Interaction to Next Paint,
# not by the bundle number on its own.
</code></pre>
