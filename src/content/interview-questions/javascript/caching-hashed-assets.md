---
course: javascript
slug: caching-hashed-assets
experienceLevel: senior
difficulty: medium
tags:
  - caching
  - http
  - performance
question: How should you cache JavaScript and CSS assets so users get fast loads but never stale code?
answer: |
  The standard strategy splits files into two classes with opposite caching rules.

  **Fingerprinted assets** (JavaScript chunks, CSS, fonts, images produced by the build) get a **content hash in the filename**, such as `app.3f9c1a2b.js`. The name changes whenever the content changes, so a given URL's content never changes and can be cached forever:

  - `Cache-Control: public, max-age=31536000, immutable`
  - `immutable` tells browsers not to revalidate even when the user reloads the page.

  **Entry points** (the HTML document, and service worker scripts) must stay fresh, because they're what points to the current hashed files:

  - `Cache-Control: no-cache`, which means "store it, but revalidate every time" using `ETag` or `Last-Modified`. A 304 response is cheap.
  - Don't confuse it with `no-store`, which forbids caching entirely.

  Why query-string busting (`app.js?v=123`) is weaker: some proxies and CDNs ignore or mishandle query strings, and a version bump invalidates files that didn't change. Content hashes invalidate only what actually changed.

  Pitfalls in real deployments:

  - **Unstable hashes**: if a chunk's hash changes when an unrelated module changes (because of a runtime manifest or module IDs), every deploy busts the whole cache. Bundlers support deterministic IDs and a separate runtime chunk.
  - **Deploy ordering**: upload the new hashed assets **before** switching the HTML, and keep old assets for a while. Users with an old tab open will still request old chunks, and a missing chunk causes "ChunkLoadError" crashes. Handle lazy-import failures by reloading the page.
  - **CDN behaviour**: make sure the CDN respects origin headers, or set equivalent edge rules, and purge HTML (not assets) on deploy.
  - **Service workers** add another cache layer with their own update lifecycle. Version them deliberately.
codeExample: |
  const crypto = require('node:crypto');

  // Build step: name each asset after a hash of its content
  function fingerprint(name, content) {
    const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
    return name.replace(/(\.\w+)$/, `.${hash}$1`);
  }

  const v1 = fingerprint('app.js', 'console.log("v1")');
  const v2 = fingerprint('app.js', 'console.log("v2")');
  const cssUnchanged = fingerprint('site.css', 'body{margin:0}');
  console.log(v1 !== v2, cssUnchanged === fingerprint('site.css', 'body{margin:0}'));
  // Output: true true   (only changed files get new URLs)

  // Serve step: choose headers by file type
  function cacheHeaders(path) {
    if (/\.[0-9a-f]{8}\.(js|css|woff2|png|svg)$/.test(path)) {
      return 'public, max-age=31536000, immutable';  // URL content never changes
    }
    return 'no-cache';                               // HTML: always revalidate
  }

  console.log(cacheHeaders(`/assets/${v1}`));        // Output: public, max-age=31536000, immutable
  console.log(cacheHeaders('/index.html'));          // Output: no-cache
popularity: 7.2
isPublished: true
---
