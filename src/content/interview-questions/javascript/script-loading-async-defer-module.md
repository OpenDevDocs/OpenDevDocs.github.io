---
course: javascript
slug: script-loading-async-defer-module
experienceLevel: senior
difficulty: medium
tags:
  - browser
  - performance
  - modules
question: "How do `async`, `defer` and `type=\"module\"` change how scripts load and execute?"
answer: |
  A plain `<script src>` in the `<head>` is **parser-blocking**. The HTML parser stops, the script downloads (the preload scanner may have started it earlier), executes, and only then does parsing continue. The attributes change two things: when the download happens and when execution happens.

  - **`defer`**: downloads in parallel with parsing and executes **after the document is parsed**, just before `DOMContentLoaded`, in **document order**. This is the right default for application code that touches the DOM.
  - **`async`**: downloads in parallel and executes **as soon as it arrives**, interrupting parsing, in **no guaranteed order**. Good for independent scripts such as analytics, bad for anything with dependencies.
  - **`type="module"`**: deferred by default, so it runs in order after parsing. It also fetches its whole import graph, runs in strict mode, has its own top-level scope, executes once even if included twice, and is fetched in CORS mode. Adding `async` to a module script makes it run as soon as its graph is ready.
  - **Dynamically inserted** scripts (`document.createElement('script')`) behave like `async` unless you set `script.async = false`.
  - `defer` and `async` are ignored on inline classic scripts.

  Trade-offs to weigh in a real codebase:

  - Deep module graphs mean a waterfall of requests. Bundling, or `<link rel="modulepreload">` for critical modules, flattens it.
  - `async` third-party tags can still execute in the middle of your critical rendering and add long tasks. Load them later or after user interaction if they're not essential.
  - Use `nomodule` only if you still serve a legacy bundle. Most teams have dropped it.

  To diagnose, look at the network waterfall and the Performance panel. Check for long "Evaluate Script" tasks and for scripts that block first render.
codeExample: |
  // In the browser: what each <script> in <head> means
  // <script src="/legacy.js"></script>           blocks parsing while it downloads and runs
  // <script src="/app.js" defer></script>         runs after parsing, in order
  // <script src="/vendor.js" defer></script>      runs after app.js
  // <script src="/analytics.js" async></script>   runs whenever it arrives, any order
  // <script type="module" src="/main.js"></script> deferred by default, strict mode
  // <link rel="modulepreload" href="/chunk-a.js">  fetch a module early

  // Dynamically inserted scripts are async by default
  function loadScript(src, { ordered = false } = {}) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = !ordered;              // false keeps insertion order
      script.onload = () => resolve(src);
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.append(script);
    });
  }

  // Load a non-critical widget only when the user asks for it
  document.querySelector('#chat-button')?.addEventListener('click', async () => {
    await loadScript('/chat-widget.js');
    console.log('chat widget ready');
  }, { once: true });
popularity: 7.5
isPublished: true
---
