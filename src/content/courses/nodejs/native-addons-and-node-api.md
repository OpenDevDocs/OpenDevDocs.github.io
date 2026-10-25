---
publishDate: 2026-10-25T12:10
title: Native Addons and Node-API
slug: native-addons-and-node-api
metadescription: What native addons are, when you need one, how Node-API, node-addon-api, node-gyp and prebuilt binaries fit together, and when WebAssembly is better.
updateDate: 2026-10-25T12:10
author: ['bishal-biswas']
level: 3
tags: ['addons', 'node-api', 'webassembly', 'c++']
course: nodejs
---

## What is a native addon?

Most of your Node code is JavaScript. A **native addon** is different: it is a library written in a compiled language such as C, C++ or Rust, built into machine code, and loaded into Node like any other module.

Think of a kitchen that cooks everything by hand. Now and then it needs a pasta machine. The machine is not part of the kitchen, but it plugs into a socket on the wall and the cooks can use it. The addon is the machine, and **Node-API** is the socket.

An addon is a file ending in `.node`. Under the hood it is a compiled shared library, the same kind of file as a `.dll` on Windows or a `.so` on Linux, that Node knows how to load.

```javascript
// CommonJS can load a .node file directly
const addon = require('./build/Release/addon.node');
console.log(addon.add(2, 3)); // 5
```

## When you need one (and when you do not)

Addons are powerful, but they are the last tool to reach for, not the first.

Good reasons to use or write an addon:

- **Wrapping an existing C or C++ library.** Image processing, video codecs, database drivers and hardware SDKs are often written in C. Rewriting them in JavaScript would take years.
- **Operating system features** that Node has no API for, such as a special device or a platform-only system call.
- **A proven CPU hot spot** that you have measured, and that JavaScript, worker threads and WebAssembly could not speed up enough.

Reasons to think twice:

- **Most slow apps are waiting on I/O** (databases, network, disk), not on CPU. An addon will not make a slow database query faster.
- **Node already ships a lot of native code.** `node:crypto`, `node:zlib` and `node:sqlite` are all C or C++ inside. Check the built-ins first.
- **Every user needs a working binary.** That means compilers on their machine or prebuilt files for every platform you support.
- **A bug can crash the whole process.** A bad pointer in C++ is not an exception you can `try`/`catch`. The process simply dies.

> **Tip:** For CPU-heavy JavaScript, try [worker threads](/courses/nodejs/worker-threads) first. For portable fast code, try WebAssembly (covered below). Reach for a native addon when you need to talk to native code that already exists.

## You probably use addons already

Popular packages such as `sharp` (images) and `better-sqlite3` (SQLite) are native addons. You can spot them by looking for `.node` files:

```bash
find node_modules -name "*.node"
```

Node tells you which versions of its two addon interfaces it supports:

```javascript
console.log(process.versions.napi);    // Node-API version
console.log(process.versions.modules); // ABI version for old-style addons
```

```text
10
137
```

That is the output on Node 24.12. Your numbers depend on your Node version.

## Node-API: the stable socket

An **ABI** (Application Binary Interface) is the agreement about how compiled code talks to other compiled code: memory layout, function names, calling rules.

In the early days, addons used V8's C++ classes directly. V8 changes with almost every Node major version, so the ABI changed too. An addon compiled for one Node version refused to load in the next. You have probably seen this famous error:

```text
Error: The module '.../addon.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 137. Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`).
```

**Node-API** (formerly called N-API) fixes this. It is a C API maintained by the Node project that hides V8 completely and promises to stay **ABI-stable**. An addon built against Node-API version 8 keeps working on every later Node release that supports version 8 or higher, without recompiling.

That is why `process.versions.napi` matters. Each new Node-API version only adds functions, it never removes them.

## node-addon-api: the friendly C++ wrapper

Node-API itself is plain C, which is wordy. The **node-addon-api** package is a set of C++ header files that wrap it in nicer classes. Your code stays ABI-stable because the wrapper still calls Node-API underneath.

Here is a tiny addon that adds two numbers. You do not need to understand every line of C++. Notice the shape: read arguments, check them, return a value.

```cpp
// src/addon.cc
#include <napi.h>

Napi::Value Add(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    Napi::TypeError::New(env, "Expected two numbers").ThrowAsJavaScriptException();
    return env.Null();
  }

  double a = info[0].As<Napi::Number>().DoubleValue();
  double b = info[1].As<Napi::Number>().DoubleValue();
  return Napi::Number::New(env, a + b);
}

// Runs once when Node loads the addon: fill in the exports object
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("add", Napi::Function::New(env, Add));
  return exports;
}

NODE_API_MODULE(addon, Init)
```

- `Napi::CallbackInfo` holds the JavaScript arguments.
- `ThrowAsJavaScriptException()` turns a C++ problem into a normal JavaScript error your code can catch.
- `NODE_API_MODULE` registers the `Init` function as the module's entry point.

## node-gyp: building the addon

**node-gyp** is the build tool that compiles addons. It reads a file called `binding.gyp`, which lists your source files and settings.

```json
{
  "targets": [
    {
      "target_name": "addon",
      "sources": ["src/addon.cc"],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').targets\"):node_addon_api"
      ]
    }
  ]
}
```

The `dependencies` line asks node-addon-api where its headers live and turns off C++ exceptions, which is its default mode.

The `package.json` needs the wrapper as a dependency:

```json
{
  "name": "fast-math",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "node-addon-api": "^8.0.0"
  }
}
```

node-gyp needs Python and a C++ compiler on the machine:

- **Windows:** Visual Studio Build Tools with the "Desktop development with C++" workload.
- **macOS:** the Xcode Command Line Tools (`xcode-select --install`).
- **Linux:** `make` and a C++ compiler such as `g++` (on Debian and Ubuntu, the `build-essential` package).

Then build:

```bash
npx node-gyp configure
npx node-gyp build
```

The result lands in `build/Release/addon.node`. When a package has a `binding.gyp` and no install script of its own, `npm install` runs `node-gyp rebuild` for you automatically.

> **Note:** Newer npm releases block dependency install scripts by default until you approve them (for example with `npm install-scripts approve <pkg>`). If an addon dependency did not build, check npm's install summary for skipped scripts.

### Loading it from an ES module

ES modules cannot `import` a `.node` file by default, so use `createRequire`:

```javascript
// index.mjs
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const addon = require('./build/Release/addon.node');

console.log(addon.add(2, 3)); // 5
```

Node 24 also has an **experimental** `--experimental-addon-modules` flag that allows importing addons directly. Stick with `createRequire` for now.

## Prebuilt binaries: no compiler needed

Asking every user to install Visual Studio or Xcode is a lot. Most popular addons ship **prebuilt binaries**: `.node` files compiled in CI for each operating system and CPU.

Two common patterns:

1. **Binaries inside the package.** Tools such as `prebuildify` build a `prebuilds/` folder (for example `prebuilds/linux-x64/` and `prebuilds/win32-x64/`), and `node-gyp-build` picks the right file at runtime, falling back to compiling only if nothing matches.
2. **One small package per platform.** The main package lists them as `optionalDependencies`, and each one declares which system it is for. npm only installs the matching one.

```json
{
  "name": "@fast-math/linux-x64",
  "version": "1.0.0",
  "os": ["linux"],
  "cpu": ["x64"],
  "main": "fast-math.node"
}
```

Because of Node-API, one binary per platform covers many Node versions. Without it, you would need one binary per platform **per Node major version**.

> **Tip:** Alpine Linux uses a different C library (musl) from most other Linux distributions (glibc). A binary built for one will not load on the other. Good addons publish a separate `linux-x64-musl` build.

## Other languages

You are not limited to C++. **napi-rs** and **Neon** let you write addons in Rust, which removes whole classes of memory bugs. Both still talk to Node through Node-API.

## WebAssembly: the portable alternative

**WebAssembly** (Wasm) is a compact binary format that runs inside V8, the same engine that runs your JavaScript. You compile C, C++, Rust or AssemblyScript to a single `.wasm` file, and that one file runs everywhere: Windows, macOS, Linux, ARM, x64, even browsers.

Compared with a native addon:

| | Native addon | WebAssembly |
| --- | --- | --- |
| Builds per platform | One per OS and CPU | One file for all |
| Compiler on install | Sometimes | Never |
| Can crash the process | Yes | No, it runs in a sandbox |
| Direct OS access | Yes | No (only what you pass in) |
| Speed | Full native speed | Close to native for number crunching |

Here is a complete Wasm module, written out byte by byte, that exports an `add` function. Real projects get these bytes from a compiler, but the loading code is identical.

```javascript
// wasm-add.mjs
const bytes = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // magic number + version
  0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f, // type: (i32, i32) -> i32
  0x03, 0x02, 0x01, 0x00, // one function of that type
  0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00, // export it as "add"
  0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b, // body: a + b
]);

console.log(WebAssembly.validate(bytes)); // true
const { instance } = await WebAssembly.instantiate(bytes);
console.log(instance.exports.add(2, 3));  // 5
```

With a real file, read it first:

```javascript
import { readFile } from 'node:fs/promises';

const bytes = await readFile(new URL('./add.wasm', import.meta.url));
const { instance } = await WebAssembly.instantiate(bytes);
```

WebAssembly cannot open files or sockets by itself. It only sees what JavaScript hands it. That makes it safe, but it means native addons are still the answer when you need direct OS access.

## Common mistakes

**Blocking the event loop.** A native function that runs for two seconds freezes Node for two seconds, exactly like a slow JavaScript loop. For long jobs, node-addon-api offers `Napi::AsyncWorker`, which runs the work on libuv's thread pool and calls back when it is done.

**Forgetting to rebuild after upgrading Node.** Old-style (non Node-API) addons break on a new major version. The fix:

```bash
npm rebuild
```

**Building on your laptop, deploying to Linux.** A `.node` file compiled on Windows will not load on Linux. Run `npm ci` inside the target environment (for example inside your Docker image), or use prebuilt binaries.

**Running with the permission model.** When you start Node with `--permission`, addons are blocked unless you also pass `--allow-addons`. See [the Permission Model lesson](/courses/nodejs/permission-model).

## Quick recap

- A native addon is compiled C, C++ or Rust code in a `.node` file that Node loads like a module.
- Use one to wrap existing native libraries or reach OS features, not as a first fix for slow code.
- Node-API is the ABI-stable C interface: build once, run on later Node versions.
- node-addon-api wraps Node-API in C++ classes; node-gyp compiles it from `binding.gyp`.
- Prebuilt binaries (prebuildify, or per-platform optional dependencies) save users from installing compilers.
- WebAssembly gives one portable, sandboxed file, but no direct OS access.
- Long native work belongs on a background thread, and a native crash kills the whole process.

<code id="code-content" class="language-javascript">
// addons-and-wasm.mjs: inspect addon support, load WebAssembly, fall back safely
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// 1. What can this Node load?
console.log('Node-API version:', process.versions.napi);
console.log('Old-style ABI version:', process.versions.modules);
console.log('Platform:', `${process.platform}-${process.arch}`);
// 2. Try a native addon, fall back to plain JavaScript if it is missing
function loadAdder() {
  try {
    const addon = require('./build/Release/addon.node'); // built with node-gyp
    return { add: addon.add, source: 'native addon' };
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error; // a real load failure
    return { add: (a, b) =&gt; a + b, source: 'JavaScript fallback' };
  }
}
const adder = loadAdder();
console.log(`add(2, 3) = ${adder.add(2, 3)} via ${adder.source}`);
// 3. The portable option: a tiny WebAssembly module exporting add(a, b)
const bytes = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
  0x03, 0x02, 0x01, 0x00,
  0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00,
  0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b,
]);
if (!WebAssembly.validate(bytes)) throw new Error('Invalid Wasm bytes');
const { instance } = await WebAssembly.instantiate(bytes);
const wasmAdd = instance.exports.add;
console.log('Wasm add(40, 2) =', wasmAdd(40, 2));
// Wasm i32 maths wraps around like C integers
console.log('Wasm add(2147483647, 1) =', wasmAdd(2147483647, 1));
// 4. Quick timing comparison (tiny functions, so expect similar numbers)
let total = 0;
let start = performance.now();
for (let i = 0; i &lt; 1_000_000; i++) total = wasmAdd(total, 1);
console.log(`Wasm loop: ${(performance.now() - start).toFixed(1)} ms`);
total = 0;
start = performance.now();
for (let i = 0; i &lt; 1_000_000; i++) total = adder.add(total, 1);
console.log(`JS loop:   ${(performance.now() - start).toFixed(1)} ms`);
</code></pre>
