---
course: javascript
slug: csrf-and-samesite-cookies
experienceLevel: mid
difficulty: hard
tags:
  - security
  - csrf
  - cookies
question: "What is CSRF, and how do `SameSite` cookies and CSRF tokens protect against it?"
answer: |
  Cross-site request forgery (CSRF) is an attack where a malicious site makes the victim's browser send a state-changing request to your site, and the browser automatically attaches the victim's cookies, so the request looks authenticated; `SameSite` cookies stop the browser from sending those cookies on cross-site requests, and CSRF tokens prove the request came from your own pages.

  Why it works: cookies are attached based on the **destination**, not on which site started the request. A hidden auto-submitting `<form action="https://bank.com/transfer" method="POST">` on `evil.com` used to carry the bank's session cookie. The attacker cannot read the response, but the side effect (the transfer) already happened.

  `SameSite` cookie attribute:

  - `Strict`: never sent on cross-site requests, not even when following a link to your site, so users arriving from another site look logged out.
  - `Lax`: sent on top-level `GET` navigations, but not on cross-site `POST`s, iframes, images or `fetch`. This is the default in Chromium-based browsers when no attribute is set, and a good choice for session cookies.
  - `None`: always sent; requires `Secure`. Needed for genuine cross-site use such as embedded widgets.

  Note that "site" means registrable domain: `app.example.com` and `api.example.com` are the **same site**, so a vulnerable subdomain can still forge requests.

  Defence in depth:

  1. Session cookies with `HttpOnly; Secure; SameSite=Lax` (or `Strict`).
  2. A **CSRF token**: a random value tied to the session, sent in a header or hidden form field and checked on every state-changing request. The synchronizer token and double-submit cookie patterns are the common variants.
  3. Never change state with `GET`.
  4. Check `Origin` (or `Sec-Fetch-Site`) headers on the server.
  5. Requiring a custom header such as `X-CSRF-Token` also forces a CORS preflight for cross-origin JavaScript.

  APIs that authenticate with an `Authorization: Bearer` header instead of cookies are not exposed to classic CSRF, because the browser does not add that header automatically. CORS does not prevent CSRF; it only controls reading responses.
codeExample: |
  import { createServer } from 'node:http';
  import { randomBytes } from 'node:crypto';

  const sessions = new Map(); // sessionId -> csrf token
  const server = createServer((req, res) => {
    const sid = /sid=(\w+)/.exec(req.headers.cookie ?? '')?.[1];
    if (req.url === '/login') {
      const id = randomBytes(8).toString('hex');
      sessions.set(id, randomBytes(16).toString('hex'));
      res.setHeader('Set-Cookie', `sid=${id}; HttpOnly; Secure; SameSite=Lax; Path=/`);
      return res.end(JSON.stringify({ csrfToken: sessions.get(id) }));
    }
    const valid = sid && sessions.has(sid) && req.headers['x-csrf-token'] === sessions.get(sid);
    res.writeHead(valid ? 200 : 403).end(valid ? 'transfer done' : 'CSRF check failed');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${server.address().port}`;

  const login = await fetch(`${base}/login`);
  const setCookie = login.headers.getSetCookie()[0];
  const { csrfToken } = await login.json();
  console.log(setCookie.split('; ').slice(1).join('; ')); // Output: HttpOnly; Secure; SameSite=Lax; Path=/

  const cookie = setCookie.split(';')[0];
  // A forged request carries the cookie (if SameSite allowed it) but cannot know the token
  const forged = await fetch(`${base}/transfer`, { method: 'POST', headers: { cookie } });
  console.log(forged.status, await forged.text()); // Output: 403 CSRF check failed

  const legit = await fetch(`${base}/transfer`, { method: 'POST', headers: { cookie, 'x-csrf-token': csrfToken } });
  console.log(legit.status, await legit.text());   // Output: 200 transfer done
  server.close();
popularity: 7.6
isPublished: true
---
