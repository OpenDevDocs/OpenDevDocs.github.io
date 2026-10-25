---
course: javascript
slug: localstorage-sessionstorage-cookies
experienceLevel: fresher
difficulty: medium
tags:
  - browser
  - storage
question: "What is the difference between `localStorage`, `sessionStorage` and cookies?"
answer: |
  All three store small pieces of data in the browser, but `localStorage` persists until it is cleared, `sessionStorage` lasts only for one browser tab's session, and cookies are sent to the server with every matching HTTP request.

  **`localStorage`**

  - Persists across tabs and browser restarts until removed by code or the user.
  - Shared by all tabs on the same **origin** (scheme, host and port).
  - Typically around 5 MB per origin.

  **`sessionStorage`**

  - Scoped to a single tab; cleared when the tab is closed. Opening the same page in another tab gives a separate store.
  - Same API and similar size limit as `localStorage`.

  **Cookies**

  - Small (about 4 KB each), and automatically sent in the `Cookie` header with requests to the matching domain and path.
  - Have an expiry (`Expires`/`Max-Age`); without one they are session cookies.
  - Can be set by the server with `Set-Cookie`, and protected with `HttpOnly` (not readable by JavaScript), `Secure` (HTTPS only) and `SameSite` (limits cross-site sending, helping against CSRF).

  The Web Storage API is simple and **synchronous**: `setItem`, `getItem`, `removeItem`, `clear`. It stores **strings only**, so use `JSON.stringify` and `JSON.parse` for objects. `getItem` returns `null` for missing keys.

  Pitfalls and good practice:

  - Never store secrets such as auth tokens in `localStorage`; any XSS bug can read them. An `HttpOnly`, `Secure` cookie is safer for session identifiers.
  - Storage can throw (quota exceeded, or blocked in some privacy modes), so wrap writes in `try...catch`.
  - Use `localStorage` for preferences like theme, `sessionStorage` for per-tab state like a form draft, and cookies for data the server needs.
codeExample: |
  // In the browser:
  const settings = { theme: "dark", fontSize: 16 };
  localStorage.setItem("settings", JSON.stringify(settings)); // strings only

  const saved = JSON.parse(localStorage.getItem("settings") ?? "{}");
  console.log(saved.theme); // Output: dark

  localStorage.setItem("visits", 3);
  console.log(typeof localStorage.getItem("visits")); // Output: string
  console.log(localStorage.getItem("missing")); // Output: null

  sessionStorage.setItem("draft", "Hello..."); // gone when this tab closes

  // Readable cookie (no HttpOnly), expires in 7 days
  document.cookie = `lang=en; max-age=${7 * 24 * 60 * 60}; path=/; SameSite=Lax`;
  console.log(document.cookie.includes("lang=en")); // Output: true

  localStorage.removeItem("visits");
popularity: 8.6
isPublished: true
---
