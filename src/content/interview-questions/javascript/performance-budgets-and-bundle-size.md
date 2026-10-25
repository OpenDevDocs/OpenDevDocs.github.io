---
course: javascript
slug: performance-budgets-and-bundle-size
experienceLevel: senior
difficulty: hard
tags:
  - performance
  - bundlers
  - web-vitals
question: How do you set and enforce a performance budget for JavaScript bundle size?
answer: |
  A **performance budget** is a limit the team agrees on and enforces automatically, so regressions fail a build instead of being found by users. For JavaScript, size matters twice. The bytes must be downloaded, and then they must be **parsed, compiled and executed** on the main thread, which on a mid-range phone costs far more than the transfer. 300 KB of compressed JavaScript is not equivalent to 300 KB of images.

  How to set the budget:

  - Start from user-facing goals (for example LCP under 2.5 s and INP under 200 ms at the 75th percentile on a mid-range Android device over 4G), not from the current bundle.
  - Budget the **critical path**: the JavaScript needed for the initial route, measured **compressed** (Brotli or gzip, as actually served). Track lazy chunks separately.
  - Add budgets for request count and third-party scripts, which often exceed first-party code.

  How to enforce it:

  - Run a size check in CI on every pull request, using tools such as `size-limit` or `bundlesize`, bundler `performance` hints, or a custom script. Post the diff on the pull request so reviewers see "+38 KB" next to the new dependency.
  - Run Lighthouse CI with assertions for lab metrics, and watch field data (RUM or CrUX) for real impact.
  - Make exceptions explicit: raising a budget should be a reviewed change, not a silent edit.

  How to get back under budget when a check fails: open a bundle analyser (`rollup-plugin-visualizer`, `webpack-bundle-analyzer`, `source-map-explorer`), then look for duplicate package versions, whole-library imports (lodash, moment, icon sets), polyfills shipped to modern browsers, and code that should be route-split or loaded on interaction.
codeExample: |
  const zlib = require('node:zlib');

  const budgets = { 'app.js': 50 * 1024, 'vendor.js': 80 * 1024 }; // Brotli bytes
  // Stand-in build output; in CI read the real files from dist/
  const files = {
    'app.js': Array.from({ length: 3000 }, (_, i) =>
      `export function view${i}(p){return h("div",{id:${i}},p.v${i % 50})}`).join('\n'),
    'vendor.js': Array.from({ length: 30000 }, (_, i) =>
      `var _${(i * 7919) % 100003}=${(i * 104729) % 65521};`).join(''),
  };

  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  let failed = false;
  for (const [name, src] of Object.entries(files)) {
    const brotli = zlib.brotliCompressSync(src).length;
    const ok = brotli <= budgets[name];
    failed ||= !ok;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${kb(brotli)} / ${kb(budgets[name])}`);
  }
  process.exitCode = failed ? 1 : 0;
  // Output:
  // PASS app.js: 4.1 KB / 50.0 KB
  // FAIL vendor.js: 96.5 KB / 80.0 KB
popularity: 7.0
isPublished: true
---
