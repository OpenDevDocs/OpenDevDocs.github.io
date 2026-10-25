---
publishDate: 2026-03-31T09:52
title: Frameworks Overview (React, Vue, Angular)
slug: frameworks-overview-react-vue-angular
metadescription: Compare the major JavaScript frameworks, see the same component in each, and work out which one to learn next.
updateDate: 2026-09-05T09:52
author: ['bishal-biswas']
level: 3
tags: ['frameworks', 'react', 'vue', 'angular']
course: javascript
---

## Why frameworks exist

Building a small page with plain JavaScript is fine. Building an application is a different problem.

```javascript
let count = 0;
function increment() {
  count++;
  document.querySelector('#count').textContent = count;
  document.querySelector('#badge').textContent = count;
  document.querySelector('#total').textContent = `Total: ${count}`;
}
```

Every piece of state has to be manually copied into every place it appears. Miss one and the interface disagrees with itself. With twenty pieces of state across fifty components, this becomes unmanageable.

Frameworks solve one core problem: **keep the interface in sync with the data automatically.** You change the data, the framework updates the screen.

They also bring routing, component structure, and conventions that let a team work on the same codebase without fighting.

## The same counter, four ways

### React

```javascript
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
```

React uses **JSX**, which looks like HTML inside JavaScript. It is not a template language, it compiles to function calls. React is a library rather than a full framework, so you choose your own router and data layer.

### Vue

```javascript
// <script setup>
// import { ref } from 'vue';
// const count = ref(0);
// </script>
// <template>
//   <p>Count: {{ count }}</p>
//   <button @click="count++">Increment</button>
// </template>
```

Vue keeps template, logic and styles in one file with clear sections. Many people find it the gentlest to learn, because the template is real HTML.

### Angular

```typescript
@Component({
  selector: 'app-counter',
  template: `
    <p>Count: {{ count() }}</p>
    <button (click)="increment()">Increment</button>
  `
})
export class CounterComponent {
  count = signal(0);
  increment() {
    this.count.update(n => n + 1);
  }
}
```

Angular is a complete framework. Routing, forms, HTTP and testing all come in the box, and TypeScript is expected rather than optional. Modern Angular uses **signals** for reactivity.

### Svelte

```javascript
// <script>
//   let count = $state(0);
// </script>
// <p>Count: {count}</p>
// <button on:click={() => count++}>Increment</button>
```

Svelte is a compiler. It turns your components into plain JavaScript at build time, so there is no framework runtime shipped to the browser.

## How they compare

| | React | Vue | Angular | Svelte |
| --- | --- | --- | --- | --- |
| Type | Library | Framework | Full framework | Compiler |
| Templates | JSX | HTML templates | HTML templates | HTML templates |
| Learning curve | Medium | Gentle | Steep | Gentle |
| Job market | Largest | Strong | Strong in enterprise | Growing |
| Bundle size | Medium | Small | Large | Smallest |
| Opinionated | No | Somewhat | Very | Somewhat |

## Ideas they all share

Learn these once and every framework feels familiar.

**Components.** The interface is a tree of reusable pieces, each owning its own markup, logic and styling.

**Declarative rendering.** You describe what the interface should look like for a given state. The framework works out the DOM changes.

**One way data flow.** Data flows down from parent to child through props. Children communicate back by calling functions the parent passed in.

**Reactivity.** Change the state, and everything depending on it updates. React re-renders the component, Vue and Angular track dependencies with signals, and Svelte compiles the updates directly into the code.

**Lifecycle.** Components mount, update, and unmount. Setup and cleanup hang off those moments.

## Meta frameworks

Each has a layer on top that adds server rendering, routing and data loading:

- **Next.js** for React
- **Nuxt** for Vue
- **Angular SSR** for Angular
- **SvelteKit** for Svelte
- **Astro**, which works with all of them

For a real product you usually start with the meta framework rather than the bare library.

## Which should you learn?

**React** if you want the most job openings and the largest ecosystem. It is the industry default.

**Vue** if you want the smoothest introduction, or you like keeping templates as HTML.

**Angular** if you are heading for enterprise work, or you want everything decided for you.

**Svelte** if you value the smallest bundles and the least ceremony.

Honestly, pick one and build several real things. The concepts transfer, and the second framework takes a fraction of the time the first did.

## Do not skip the fundamentals

The single most useful piece of advice here: everything in this course still applies.

Framework confusion is very often JavaScript confusion in disguise:

- "Why is my `this` undefined?" is the `this` topic.
- "Why does my state not update?" is the immutability topic.
- "Why does my `map` not render?" is the array methods topic.
- "Why is my async data undefined at first?" is the promises topic.
- "Why does my listener keep firing?" is the memory topic.

Someone who knows JavaScript well learns React in a couple of weeks. Someone who learned React first often struggles for months, because they cannot tell which part is the framework and which part is the language.

## Quick recap

- Frameworks keep the interface in sync with the data automatically.
- React is a library with JSX, Vue and Angular use HTML templates, Svelte compiles away.
- Components, declarative rendering, one way data flow and reactivity are shared by all.
- Meta frameworks add routing and server rendering on top.
- React has the biggest job market, Vue the gentlest start, Angular the most structure.
- Framework problems are usually JavaScript problems, so the fundamentals keep paying off.

<code id="code-content" class="language-javascript">
// The problem frameworks solve: keeping the UI in sync by hand
let count = 0;
function incrementManually() {
  count++;
  // every place the value appears has to be updated separately
  document.querySelector('#count').textContent = count;
  document.querySelector('#badge').textContent = count;
  document.querySelector('#total').textContent = 'Total: ' + count;
}
// ---------- React: JSX, state through a hook ----------
// function Counter() {
//   const [count, setCount] = useState(0);
//   return (
//     &lt;div&gt;
//       &lt;p&gt;Count: {count}&lt;/p&gt;
//       &lt;button onClick={() =&gt; setCount(count + 1)}&gt;Increment&lt;/button&gt;
//     &lt;/div&gt;
//   );
// }
// ---------- Vue: single file component, real HTML template ----------
// &lt;script setup&gt;
//   import { ref } from 'vue';
//   const count = ref(0);
// &lt;/script&gt;
// &lt;template&gt;
//   &lt;p&gt;Count: {{ count }}&lt;/p&gt;
//   &lt;button @click="count++"&gt;Increment&lt;/button&gt;
// &lt;/template&gt;
// ---------- Angular: decorators, TypeScript, signals ----------
// @Component({
//   selector: 'app-counter',
//   template: `
//     &lt;p&gt;Count: {{ count() }}&lt;/p&gt;
//     &lt;button (click)="increment()"&gt;Increment&lt;/button&gt;
//   `
// })
// export class CounterComponent {
//   count = signal(0);
//   increment() { this.count.update(n =&gt; n + 1); }
// }
// ---------- Svelte: compiled away, no runtime shipped ----------
// &lt;script&gt;
//   let count = $state(0);
// &lt;/script&gt;
// &lt;p&gt;Count: {count}&lt;/p&gt;
// &lt;button on:click={() =&gt; count++}&gt;Increment&lt;/button&gt;
// The shared idea in all four: change the state, and the framework
// works out what to update. You never touch the DOM by hand.
// And every one of them still runs on the JavaScript you have just learned.
</code></pre>
