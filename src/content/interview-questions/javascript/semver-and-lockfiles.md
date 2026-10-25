---
course: javascript
slug: semver-and-lockfiles
experienceLevel: mid
difficulty: medium
tags:
  - npm
  - tooling
  - dependencies
question: How does semantic versioning work in npm, and why do lockfiles matter?
answer: |
  Semantic versioning (semver) gives each release a `MAJOR.MINOR.PATCH` number, where a major bump signals breaking changes, a minor bump adds backwards-compatible features and a patch bump only fixes bugs; `package.json` declares **ranges** of acceptable versions, while the lockfile records the **exact** versions that were actually installed.

  Range syntax in `package.json`:

  - `^1.4.2` (the npm default): any `1.x.x` at or above `1.4.2`, so minor and patch updates are allowed. For `0.x` versions it is stricter: `^0.4.2` means `>=0.4.2 <0.5.0`, because before 1.0 a minor bump may break things.
  - `~1.4.2`: patch updates only, `>=1.4.2 <1.5.0`.
  - `1.4.2`: exactly that version. `*` or `latest`: anything, avoid it.
  - Pre-releases such as `2.0.0-beta.1` are only matched by ranges that explicitly mention a pre-release of the same version.

  Why lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`) matter:

  1. **Reproducible installs.** Without a lockfile, two developers or a CI run a week later can resolve `^1.4.2` to different versions, including transitive dependencies you never listed.
  2. **Exact dependency tree** with resolved URLs and integrity hashes, which detects tampered packages.
  3. **Reviewable upgrades**: dependency changes show up as diffs in pull requests.

  Practical guidance:

  - **Commit the lockfile** for applications and libraries alike.
  - In CI and Docker builds use `npm ci` (or `pnpm install --frozen-lockfile`), which installs exactly what the lockfile says and fails if it does not match `package.json`. `npm install` may update the lockfile.
  - Do not mix package managers in one project; each has its own lockfile format.
  - Semver is a promise, not a guarantee. Minor releases sometimes break things, so update deliberately (`npm outdated`, Renovate or Dependabot) and run tests.
  - Use `npm audit` and `overrides` (npm) or `resolutions` (Yarn) to force a patched transitive version when needed.
  - A published library's lockfile is not used by its consumers; they resolve its ranges themselves.
codeExample: |
  // Uses the `semver` package that npm itself relies on: npm install semver
  const semver = require('semver');

  console.log(semver.satisfies('1.9.0', '^1.4.2'));   // Output: true  (minor update allowed)
  console.log(semver.satisfies('2.0.0', '^1.4.2'));   // Output: false (major = breaking)
  console.log(semver.satisfies('1.5.0', '~1.4.2'));   // Output: false (tilde: patches only)
  console.log(semver.satisfies('0.5.0', '^0.4.2'));   // Output: false (0.x caret is stricter)
  console.log(semver.satisfies('2.0.0-beta.1', '^1.4.2 || >=2.0.0')); // Output: false (pre-release)

  const published = ['1.4.2', '1.4.9', '1.7.0', '2.0.0', '2.1.0'];
  console.log(semver.maxSatisfying(published, '^1.4.2')); // Output: 1.7.0
  console.log(semver.maxSatisfying(published, '~1.4.2')); // Output: 1.4.9

  console.log(semver.validRange('^1.4.2'));            // Output: >=1.4.2 <2.0.0-0
  console.log(semver.inc('1.4.2', 'minor'), semver.inc('1.4.2', 'major')); // Output: 1.5.0 2.0.0

  // What a package-lock.json entry pins down for one dependency:
  const lockEntry = {
    'node_modules/semver': {
      version: '7.6.3',
      resolved: 'https://registry.npmjs.org/semver/-/semver-7.6.3.tgz',
      integrity: 'sha512-...',
    },
  };
  console.log(Object.keys(lockEntry['node_modules/semver'])); // Output: [ 'version', 'resolved', 'integrity' ]
popularity: 7.1
isPublished: true
---
