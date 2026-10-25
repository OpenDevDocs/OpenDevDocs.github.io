---
course: javascript
slug: sandboxing-untrusted-code
experienceLevel: senior
difficulty: hard
tags:
  - security
  - node
  - sandboxing
question: How do you safely run untrusted JavaScript, and why is Node's vm module not a sandbox?
answer: |
  Running user-supplied code (plugins, formulas, templates, automation scripts) needs a real **security boundary**: something that limits what the code can reach and how much CPU and memory it can use.

  **Node's `vm` module is not that boundary.** The documentation says plainly that it is not a security mechanism. Code runs in a separate context (realm), but in the same process and isolate. Any host object you pass in, including the object used as the context itself, can lead back to the host's `Function` constructor and from there to `process` and `require`. The example shows the classic escape. A `timeout` option exists, but it doesn't cover async code, and there's no memory limit. Libraries built on top of `vm`, such as `vm2`, were abandoned after repeated sandbox escapes.

  Options, from weaker to stronger isolation:

  - **Restrict the language instead of sandboxing it.** For formulas or rules, use an expression language or a JSON-based DSL that you interpret yourself. This is often the best answer.
  - **`isolated-vm`**: a separate V8 isolate with its own heap and memory limits, and explicit copying of values in and out. Much stronger than `vm`, but it shares the process, so a V8 bug is a breakout.
  - **WebAssembly-based interpreters** (for example QuickJS compiled to WASM): capability-based, with no host access unless you grant it, and CPU limited through instruction metering or timeouts.
  - **Separate process** with OS-level controls: run as an unprivileged user, use the Node permission model (`--permission` with explicit allowances, which is defence in depth rather than a sandbox), and apply seccomp, cgroups or containers.
  - **Separate VM or microVM** (Firecracker, gVisor) for fully hostile multi-tenant code. This is what serverless platforms use.

  In browsers, use a **sandboxed iframe** (`sandbox="allow-scripts"` without `allow-same-origin`) served from a separate origin, and communicate only with `postMessage`. Combine it with a strict CSP.

  Whatever you choose, apply time and memory limits, deny network and filesystem access by default, and treat everything coming back out of the sandbox as untrusted input.
codeExample: |
  const vm = require('node:vm');

  // Looks sandboxed: no `process` or `require` in the context...
  const context = vm.createContext({ input: 21 });
  console.log(vm.runInContext('typeof process', context));      // Output: undefined
  console.log(vm.runInContext('input * 2', context));           // Output: 42

  // ...but host objects lead back to the host's Function constructor
  const escape = `
    const HostFunction = this.constructor.constructor;   // context prototype chain
    const hostProcess = HostFunction('return process')();
    hostProcess.version.startsWith('v');
  `;
  console.log('escaped to host process:', vm.runInContext(escape, context));
  // Output: escaped to host process: true

  // Even passing a plain host object is enough
  const ctx2 = vm.createContext({ config: {} });
  const leaked = vm.runInContext(
    "config.constructor.constructor('return typeof require')()", ctx2);
  console.log('host function reached:', leaked !== undefined);
  // Output: host function reached: true

  // Timeouts only cover synchronous code
  try { vm.runInContext('while (true) {}', context, { timeout: 50 }); }
  catch (e) { console.log(e.code); }                            // Output: ERR_SCRIPT_EXECUTION_TIMEOUT
popularity: 7.0
isPublished: true
---
