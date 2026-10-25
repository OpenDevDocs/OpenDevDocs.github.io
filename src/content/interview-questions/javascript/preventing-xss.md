---
course: javascript
slug: preventing-xss
experienceLevel: mid
difficulty: medium
tags:
  - security
  - xss
  - dom
question: What is XSS and how do you prevent it in front-end JavaScript?
answer: |
  Cross-site scripting (XSS) is when an attacker gets their own script to run inside your page, usually by injecting untrusted data into HTML; the main defence is to never insert untrusted data as HTML, so use `textContent` instead of `innerHTML`, and sanitise when you genuinely need to render user-supplied HTML.

  Once a script runs in your origin it can read the DOM, call your APIs with the user's session, read non-`HttpOnly` cookies and `localStorage` tokens, and change what the user sees.

  The three kinds:

  - **Stored**: malicious input is saved (a comment, a profile name) and rendered to other users.
  - **Reflected**: input from the URL or a form is echoed back in the response.
  - **DOM-based**: client-side code moves data from a source such as `location.hash` or `postMessage` into a dangerous sink like `innerHTML`.

  Defences, in order of importance:

  1. **Use safe sinks.** `textContent`, `setAttribute` for non-URL attributes, and `createElement` treat data as text. Avoid `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function` and string arguments to `setTimeout`.
  2. **Let your framework escape.** React, Vue, Angular and Svelte escape interpolated values by default. Their escape hatches (`dangerouslySetInnerHTML`, `v-html`, `{@html}`) are where bugs happen.
  3. **Sanitise required HTML** with a maintained library such as DOMPurify. Hand-written regex filters are routinely bypassed. The native `Element.setHTML()` Sanitizer API is starting to ship as a built-in option.
  4. **Validate URLs** before putting them in `href` or `src`: allow only `http:` and `https:`, because `javascript:` URLs execute code.
  5. **Content Security Policy** (`script-src 'self'` with nonces, no `'unsafe-inline'`) limits damage if an injection slips through. **Trusted Types** can make dangerous sinks reject plain strings entirely.
  6. Keep session cookies `HttpOnly` so injected scripts cannot read them.

  Escaping must match the context: HTML text, attribute, URL, CSS and JavaScript string contexts all have different rules, which is another reason to prefer safe DOM APIs over building HTML strings.
codeExample: |
  // In the browser:
  const comment = '<img src=x onerror="alert(document.cookie)">';
  const box = document.querySelector('#comment');

  // VULNERABLE: the onerror handler runs
  // box.innerHTML = comment;

  // SAFE: rendered as plain text
  box.textContent = comment;
  console.log(box.innerHTML); // Output: &lt;img src=x onerror="alert(document.cookie)"&gt;

  // SAFE: build elements instead of HTML strings
  function renderUser(user) {
    const link = document.createElement('a');
    link.textContent = user.name;
    const url = new URL(user.website, location.origin);
    link.href = ['http:', 'https:'].includes(url.protocol) ? url.href : '#'; // blocks javascript: URLs
    return link;
  }
  document.body.append(renderUser({ name: 'Eve', website: 'javascript:alert(1)' }));

  // When rich HTML is required, sanitise it first (DOMPurify loaded separately)
  // box.innerHTML = DOMPurify.sanitize(userHtml);

  // Server header that limits the damage if an injection slips through:
  // Content-Security-Policy: script-src 'self' 'nonce-r4nd0m'; object-src 'none'; base-uri 'none'
popularity: 8.5
isPublished: true
---
