---
publishDate: 2026-10-27T09:04
title: 'Async Python with asyncio'
slug: async-basics
metadescription: 'A gentle introduction to async Python: async def, await, asyncio.run, running tasks at the same time with gather and TaskGroup, timeouts and common traps.'
updateDate: 2026-10-27T09:04
author: ['bishal-biswas']
level: 3
tags: ['python', 'async', 'asyncio']
course: python
---

## The problem: waiting around

Imagine making breakfast. You put the kettle on, then stand and stare at it for 2 minutes. Only when it boils do you put bread in the toaster and stare at that. Then you start the eggs. That is silly. A real cook starts the kettle, puts the toast in **while** the water heats, and cracks the eggs while both are going.

Many programs behave like the silly cook. When they download a file, read from a database or call a [web API](/courses/python/calling-web-apis), they spend most of their time **waiting** for an answer. While waiting, they do nothing.

Here is the silly cook in Python. `time.sleep()` stands in for waiting:

```python
import time


def make_tea(name, seconds):
    print(f"Start {name}")
    time.sleep(seconds)
    print(f"Done {name}")


start = time.perf_counter()
make_tea("tea", 2)
make_tea("toast", 1)
make_tea("eggs", 1.5)
print(f"Total: {time.perf_counter() - start:.1f}s")
```

Output:

```text
Start tea
Done tea
Start toast
Done toast
Start eggs
Done eggs
Total: 4.5s
```

**Asynchronous** (or **async**) programming lets one program juggle many waiting jobs at once, like the smart cook. Python's built-in `asyncio` module makes this possible.

> **Note:** Async does **not** make calculations faster. It helps when your program spends time **waiting** for something outside it (network, disk, timers). For heavy number crunching, async gives no speed up.

## Three new words

| Word | Meaning |
| --- | --- |
| `async def` | Defines a **coroutine function**: a function that can pause in the middle |
| `await` | "Pause me here until this finishes, and let other jobs run meanwhile" |
| **event loop** | The manager that switches between paused jobs. `asyncio.run()` starts it |

A **coroutine** is like a [generator](/courses/python/iterators-and-generators): it can stop part way and continue later. The event loop is like the cook's brain, deciding which job to check on next.

## Your first coroutine

```python
import asyncio


async def say_hello():
    print("Hello...")
    await asyncio.sleep(1)
    print("...world!")


asyncio.run(say_hello())
```

Output:

```text
Hello...
...world!
```

Three things to notice:

- `async def` instead of `def`.
- `await asyncio.sleep(1)` instead of `time.sleep(1)`. The async version pauses only this coroutine, not the whole program.
- `asyncio.run()` starts the event loop and runs the coroutine until it finishes. You usually call it **once**, at the bottom of your program.

## Running jobs at the same time with gather()

With only one job there is nothing to juggle. The power comes when you start several. `asyncio.gather()` runs many coroutines **concurrently** (taking turns while each one waits) and collects their results in a list, in the same order you passed them.

```python
import asyncio
import time


async def cook(name, seconds):
    print(f"Start {name}")
    await asyncio.sleep(seconds)
    print(f"Done {name}")
    return f"{name} ready"


async def main():
    start = time.perf_counter()
    results = await asyncio.gather(
        cook("tea", 2),
        cook("toast", 1),
        cook("eggs", 1.5),
    )
    print(results)
    print(f"Total: {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

Output:

```text
Start tea
Start toast
Start eggs
Done toast
Done eggs
Done tea
['tea ready', 'toast ready', 'eggs ready']
Total: 2.0s
```

All three started right away. They finished in order of speed, but the results list keeps the original order. The total time is the time of the **slowest** job (2 seconds), not the sum (4.5 seconds).

It is common to put the main logic in an `async def main()` and run it with `asyncio.run(main())`, just like the `main()` pattern from [Organizing Code into Packages and __main__](/courses/python/creating-packages).

## Calling a coroutine needs await

Calling an async function does **not** run it. It only creates a coroutine object, like a recipe card that nobody has cooked yet. You must `await` it:

```python
import asyncio


async def cook(name, seconds):
    await asyncio.sleep(seconds)
    return name


async def main():
    print(cook("tea", 1))
    result = await cook("tea", 1)
    print(result)


asyncio.run(main())
```

Output:

```text
<coroutine object cook at 0x000002431F97CEE0>
tea
```

Python also prints a warning for the first call: `RuntimeWarning: coroutine 'cook' was never awaited`. If you ever see that, look for a missing `await`.

## Tasks: start now, wait later

`asyncio.create_task()` schedules a coroutine to start running in the background right away. You get a **task** object back, and you can `await` it later when you need the result.

```python
import asyncio


async def countdown(name, n):
    while n > 0:
        print(f"{name}: {n}")
        await asyncio.sleep(0.5)
        n -= 1


async def main():
    task = asyncio.create_task(countdown("rocket", 3))
    print("Task created, doing other work")
    await asyncio.sleep(0.2)
    print("Other work finished, waiting for the task")
    await task
    print("All done")


asyncio.run(main())
```

Output:

```text
Task created, doing other work
rocket: 3
Other work finished, waiting for the task
rocket: 2
rocket: 1
All done
```

The countdown started as soon as `main()` reached its first `await`, and ran alongside the "other work".

## TaskGroup and limiting how many run at once

Python 3.11 added `asyncio.TaskGroup`, a tidy way to start a group of tasks. The `async with` block waits until all of them finish. If one fails, the others are cancelled, so nothing is left running by accident.

Sometimes you should not run everything at once. A website might block you if you send 100 requests in the same second. An `asyncio.Semaphore(2)` is like a room with two chairs: only two jobs may be inside at a time, the rest wait at the door.

```python
import asyncio


async def fetch(page, limit):
    async with limit:
        print(f"Fetching page {page}")
        await asyncio.sleep(0.5)
        return page * 10


async def main():
    limit = asyncio.Semaphore(2)
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch(p, limit)) for p in range(1, 5)]
    print([t.result() for t in tasks])


asyncio.run(main())
```

Output:

```text
Fetching page 1
Fetching page 2
Fetching page 3
Fetching page 4
[10, 20, 30, 40]
```

Pages 1 and 2 print first; pages 3 and 4 print half a second later, once chairs are free. `async with` is the async version of the [with statement](/courses/python/with-and-context-managers).

## Timeouts

Never wait forever for something that might hang. `asyncio.timeout()` (Python 3.11 and newer) cancels the work if it takes too long and raises `TimeoutError`:

```python
import asyncio


async def slow_download():
    await asyncio.sleep(5)
    return "data"


async def main():
    try:
        async with asyncio.timeout(1):
            await slow_download()
    except TimeoutError:
        print("Gave up after 1 second")


asyncio.run(main())
```

Output:

```text
Gave up after 1 second
```

## Handling errors in gather()

By default, if one job in `gather()` raises an error, `await gather(...)` raises it too. Pass `return_exceptions=True` to get errors back as values in the result list instead:

```python
import asyncio


async def might_fail(n):
    await asyncio.sleep(0.1)
    if n == 2:
        raise ValueError(f"job {n} failed")
    return n


async def main():
    results = await asyncio.gather(might_fail(1), might_fail(2), might_fail(3), return_exceptions=True)
    print(results)


asyncio.run(main())
```

Output:

```text
[1, ValueError('job 2 failed'), 3]
```

You can then check each item with `isinstance(item, Exception)`. Error handling basics are in [Handling Errors with try and except](/courses/python/exceptions).

## Async in real programs

`asyncio.sleep()` is only a stand in. In real code you await things like network calls. The `requests` library is **not** async, so async programs use async libraries such as `httpx` or `aiohttp` (both on [PyPI](https://pypi.org/)). Web frameworks like FastAPI are built on async too.

| Good fit for async | Not a good fit |
| --- | --- |
| Calling many web APIs | Heavy math or image processing |
| Chat servers and bots | Simple scripts that do one thing |
| Web servers handling many users | Code that uses only blocking libraries |

## Common mistakes

**1. Using `time.sleep()` (or any blocking call) inside async code.** It freezes the whole event loop, so nothing else can run:

```python
import asyncio
import time


async def bad():
    time.sleep(1)


async def good():
    await asyncio.sleep(1)


async def main():
    start = time.perf_counter()
    await asyncio.gather(bad(), bad(), bad())
    print(f"time.sleep: {time.perf_counter() - start:.1f}s")
    start = time.perf_counter()
    await asyncio.gather(good(), good(), good())
    print(f"asyncio.sleep: {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

```text
time.sleep: 3.0s
asyncio.sleep: 1.0s
```

Fix: use `await asyncio.sleep()` and async libraries.

**2. Forgetting `await` or `asyncio.run()`.** Calling `main()` on its own does nothing except print:

```text
RuntimeWarning: coroutine 'main' was never awaited
```

Fix: `asyncio.run(main())`.

**3. Using `await` in a normal function or script.** Outside an `async def`, `await` is not allowed:

```text
SyntaxError: 'await' outside function
```

Fix: move the code into an `async def` and run it with `asyncio.run()`.

## Quick recap

- Async helps programs that spend time **waiting**, by juggling many jobs at once.
- `async def` makes a coroutine; `await` pauses it and lets others run.
- `asyncio.run(main())` starts the event loop.
- `asyncio.gather()` and `TaskGroup` run several coroutines concurrently.
- `asyncio.timeout()` stops slow work; `Semaphore` limits how many run at once.
- Never use blocking calls like `time.sleep()` inside async code.

Learn more in the [asyncio docs](https://docs.python.org/3/library/asyncio.html). Next, you will bring everything together in [Capstone: Command-Line Task Manager](/courses/python/capstone-task-manager-cli).

<code id="code-content" class="language-python">
# main.py: pretend to download several files at the same time with asyncio
import asyncio
import time
#
FILES = {"cats.jpg": 1.5, "notes.txt": 0.5, "song.mp3": 2.0, "huge.iso": 9.0}
#
#
async def download(name, seconds, limit):
    """A fake download: asyncio.sleep stands in for waiting on the network."""
    async with limit:  # only a few downloads at once
        print(f"start  {name}")
        await asyncio.sleep(seconds)  # await = "pause me, let others run"
        print(f"finish {name}")
        return f"{name} ({seconds}s)"
#
#
async def safe_download(name, seconds, limit, max_wait=3):
    try:
        async with asyncio.timeout(max_wait):  # Python 3.11+
            return await download(name, seconds, limit)
    except TimeoutError:
        print(f"gave up on {name} after {max_wait}s")
        return None
#
#
async def main():
    start = time.perf_counter()
    limit = asyncio.Semaphore(3)
    results = await asyncio.gather(
        *(safe_download(name, secs, limit) for name, secs in FILES.items())
    )
    print("Downloaded:", [r for r in results if r])
    # One by one would take 13 seconds; together it is about 3
    print(f"Total time: {time.perf_counter() - start:.1f}s")
#
#
if __name__ == "__main__":
    asyncio.run(main())  # starts the event loop and runs main()
</code></pre>
