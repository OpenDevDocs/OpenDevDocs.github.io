---
course: javascript
slug: ssr-hydration-and-islands
experienceLevel: senior
difficulty: hard
tags:
  - ssr
  - performance
  - frameworks
question: What is hydration in server-side rendering, what does it cost, and how do islands and related techniques reduce that cost?
answer: |
  With **server-side rendering (SSR)** the server sends ready-made HTML, so content appears quickly and is crawlable. The HTML isn't interactive yet. **Hydration** is the client-side step where the framework downloads the component code, **re-executes** the components to rebuild its internal tree, attaches event listeners to the existing DOM, and restores state.

  The cost is easy to underestimate:

  - **Double work**: everything rendered on the server is rendered again in the browser, including static parts that will never change.
  - **Uncanny valley**: the page looks ready but ignores clicks until hydration finishes, which hurts INP and frustrates users.
  - **Payload**: the JavaScript for every component, plus serialised data embedded in the page so the client can reproduce the server's output.
  - **Mismatches**: if client output differs from the server HTML (dates, `Math.random`, `window` checks, locale formatting), frameworks warn, patch or re-render from scratch.

  Techniques that reduce it:

  - **Islands architecture** (Astro, Fresh, Eleventy with partial hydration): the page is static HTML by default, and only marked interactive components ship JavaScript and hydrate independently, often lazily (`client:visible`, `client:idle`). It's ideal for content-heavy sites.
  - **Server Components** (React Server Components in Next.js and others): components that run only on the server send serialised UI, not code. Only `'use client'` components hydrate.
  - **Progressive and selective hydration**: hydrate in chunks, prioritising what the user interacts with. React 18 does this with `Suspense` boundaries.
  - **Resumability** (Qwik): serialise enough state and listener information into the HTML that the client resumes without replaying components, downloading handler code on first interaction.

  How to choose: measure total JavaScript and INP on mid-range devices. Mostly static content favours islands. Application-like pages with lots of shared state may be better served by a full SPA framework with server components and careful code splitting.
codeExample: |
  // In the browser: a minimal islands runtime
  // Server HTML contains static markup plus islands like:
  // <div data-island="Counter" data-props='{"start":5}'><button>Count: 5</button></div>

  const islands = {
    Counter: () => import('/islands/counter.js'),   // code loaded only when needed
    Search: () => import('/islands/search.js'),
  };

  async function hydrate(el) {
    const { default: mount } = await islands[el.dataset.island]();
    const props = JSON.parse(el.dataset.props ?? '{}');
    mount(el, props);                                // attach listeners to existing DOM
    el.dataset.hydrated = 'true';
  }

  // Hydrate each island only when it scrolls into view (like Astro's client:visible)
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      hydrate(entry.target);
    }
  }, { rootMargin: '200px' });

  document.querySelectorAll('[data-island]').forEach((el) => observer.observe(el));

  // /islands/counter.js
  // export default function mount(el, { start }) {
  //   let count = start;
  //   const button = el.querySelector('button');
  //   button.addEventListener('click', () => { button.textContent = `Count: ${++count}`; });
  // }
popularity: 7.6
isPublished: true
---
