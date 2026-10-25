---
course: javascript
slug: content-security-policy
experienceLevel: senior
difficulty: hard
tags:
  - security
  - xss
  - browser
question: What is a Content Security Policy, and how do you deploy a strict one for a JavaScript application?
answer: |
  A **Content Security Policy (CSP)** is an HTTP response header that tells the browser which sources of script, style, images, frames and connections a page may use. Its main job is **defence in depth against XSS**: even if an attacker injects markup, the browser refuses to run script the policy doesn't allow.

  Allowlist-based policies (`script-src 'self' cdn.example.com`) have proven weak in practice, because any allowed host serving JSONP or an old library can be abused. The recommended approach is a **strict CSP**:

  - `script-src 'nonce-{random}' 'strict-dynamic'`. Generate a fresh, unguessable nonce **per response** and put it on every legitimate `<script>`. `'strict-dynamic'` lets those trusted scripts load further scripts, so bundler chunks and tag managers keep working.
  - `object-src 'none'` and `base-uri 'none'` (or `'self'`) to close plugin and `<base>` tag tricks.
  - Avoid `'unsafe-inline'` and `'unsafe-eval'`. Inline event handlers (`onclick="..."`) and `eval` or `new Function` stop working, which is the point.
  - For static sites that can't generate nonces, use hashes (`'sha256-...'`) of inline scripts.
  - Add `require-trusted-types-for 'script'` where supported to lock down DOM XSS sinks such as `innerHTML`.

  Rolling it out safely in a real codebase:

  1. Ship it as `Content-Security-Policy-Report-Only` with a reporting endpoint (`report-to`, or the older `report-uri`) and collect violations for a while.
  2. Remove inline handlers and `eval` usage, and fix third-party tags.
  3. Switch to enforcing, and keep reporting on to catch regressions.

  CSP doesn't replace output encoding or sanitisation. It limits the damage when those fail. Also set `frame-ancestors` to control who can embed your pages in a frame.
codeExample: |
  const http = require('node:http');
  const crypto = require('node:crypto');

  const server = http.createServer((req, res) => {
    const nonce = crypto.randomBytes(16).toString('base64'); // new nonce per response
    res.setHeader('Content-Security-Policy', [
      `script-src 'nonce-${nonce}' 'strict-dynamic'`,
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'self'",
    ].join('; '));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<script nonce="${nonce}" src="/app.js"></script>
      <img src=x onerror="alert(1)">`); // injected handler is blocked
  });

  server.listen(0, async () => {
    const { port } = server.address();
    const response = await fetch(`http://localhost:${port}/`);
    const csp = response.headers.get('content-security-policy');
    console.log(csp.replace(/nonce-[^']+/, 'nonce-<random>'));
    server.close();
  });
  // Output: script-src 'nonce-<random>' 'strict-dynamic'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'
popularity: 7.8
isPublished: true
---
