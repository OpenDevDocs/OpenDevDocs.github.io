---
course: javascript
slug: npm-supply-chain-security
experienceLevel: senior
difficulty: hard
tags:
  - security
  - npm
  - dependencies
question: How do you reduce npm supply-chain risk in a JavaScript project?
answer: |
  A typical application pulls in hundreds or thousands of transitive packages, and any of them can run code on developer machines and CI. Real incidents include hijacked maintainer accounts publishing malicious versions, typosquatted names, protestware, compromised build pipelines, and **install scripts** that steal tokens. Some recent attacks spread on their own by publishing infected versions of the victims' other packages.

  Controls that matter, roughly in order of value:

  - **Commit the lockfile and install with `npm ci`** (or the pnpm and Yarn equivalents). Builds then use exactly the reviewed versions and integrity hashes, never "whatever matches `^1.2.0` today".
  - **Limit install scripts.** `npm ci --ignore-scripts` or `ignore-scripts=true` in `.npmrc` blocks `preinstall` and `postinstall` code. Allow the few packages that need native builds explicitly. pnpm (v10+) and Bun skip dependency install scripts unless a package is allowlisted, and Yarn can be configured the same way.
  - **Slow down adoption of new versions.** Use Renovate or Dependabot with a minimum release age, so malicious versions are usually caught and unpublished before you install them.
  - **Verify provenance.** `npm audit signatures` checks registry signatures and provenance attestations. Prefer packages published from CI with provenance, and publish your own that way with trusted publishing instead of long-lived tokens.
  - **Audit continuously.** `npm audit` and tools such as Socket, Snyk or GitHub Dependabot alerts flag known CVEs and suspicious behaviour (new network or filesystem access, obfuscated code).
  - **Reduce the surface.** Fewer dependencies, no packages for one-liners, and pinned GitHub Actions by commit SHA.
  - **Contain the blast radius.** CI jobs that install dependencies should not hold deploy or publish secrets. Use short-lived OIDC credentials and least-privilege tokens.

  When reviewing a lockfile diff, look for new packages with install scripts, unexpected `resolved` URLs (git or tarball URLs instead of the registry), and large version jumps in deep dependencies.
codeExample: |
  // Flag risky entries in a package-lock.json (v3) diff during review.
  // Inline sample; in CI use JSON.parse(fs.readFileSync('package-lock.json')).
  const lock = {
    lockfileVersion: 3,
    packages: {
      '': { name: 'my-app' },
      'node_modules/left-pad': {
        version: '1.3.0',
        resolved: 'https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz',
      },
      'node_modules/fast-thing': {
        version: '2.0.1', hasInstallScript: true,
        resolved: 'https://registry.npmjs.org/fast-thing/-/fast-thing-2.0.1.tgz',
      },
      'node_modules/utils-lib': {
        version: '0.0.1',
        resolved: 'git+ssh://git@github.com/someone/utils-lib.git#abc123',
      },
    },
  };

  for (const [path, pkg] of Object.entries(lock.packages)) {
    if (!path) continue;                         // root project
    const name = path.replace(/^.*node_modules\//, '');
    if (pkg.hasInstallScript) console.log(`install script: ${name}@${pkg.version}`);
    if (!pkg.resolved?.startsWith('https://registry.npmjs.org/')) {
      console.log(`non-registry source: ${name} -> ${pkg.resolved}`);
    }
  }
  // Output:
  // install script: fast-thing@2.0.1
  // non-registry source: utils-lib -> git+ssh://git@github.com/someone/utils-lib.git#abc123
popularity: 7.6
isPublished: true
---
