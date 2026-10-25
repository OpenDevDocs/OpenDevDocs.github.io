---
course: javascript
slug: streams-and-backpressure
experienceLevel: senior
difficulty: hard
tags:
  - node
  - streams
  - performance
question: What is backpressure in streams, and how do you handle it correctly in Node.js?
answer: |
  **Backpressure** is the signal a slow consumer sends to a fast producer: "stop, my buffer is full". Without it, data piles up in memory. A classic outage is a service that reads a large file or a fast upstream response and writes it to a slow client, growing the heap until the process is OOM-killed.

  In Node streams the mechanism is the **highWaterMark** (bytes, or objects in object mode). `writable.write(chunk)` buffers the chunk and returns `false` once the buffered amount reaches the highWaterMark. A well-behaved producer stops writing and waits for the `'drain'` event. On the readable side, when `push()` returns `false`, the stream stops calling `_read()` until the consumer catches up. The highWaterMark is a threshold, not a hard limit; ignoring `write()`'s return value lets the buffer grow without bound.

  How to get it right:

  - Use `pipeline()` from `node:stream/promises` instead of manual `.pipe()`. It wires up backpressure, propagates errors, and **destroys all streams** on failure, which `.pipe()` does not.
  - Async generators work as pipeline stages. `for await` over a readable pulls data one chunk at a time, so backpressure is automatic.
  - If you must write manually, check the return value of `write()` and `await once(stream, 'drain')`.
  - Tune `highWaterMark` for throughput versus memory, not to "fix" a missing drain check.

  Web Streams (`ReadableStream`, `WritableStream`, `TransformStream`) use the same idea: a queuing strategy and `desiredSize`, with `pipeTo` and `pipeThrough` handling it for you. To diagnose, watch `writableLength` and `readableLength`, heap growth under a slow client, and event loop delay.
codeExample: |
  const { Writable, Readable } = require('node:stream');
  const { pipeline } = require('node:stream/promises');

  let maxBuffered = 0;
  const slowSink = () => new Writable({
    objectMode: true,
    highWaterMark: 3,
    write(chunk, _enc, done) {
      maxBuffered = Math.max(maxBuffered, this.writableLength);
      setTimeout(done, 5);                       // slow consumer
    },
  });

  const sink = slowSink();
  console.log(sink.write(1), sink.write(2), sink.write(3));
  // Output: true true false   <- third write hits the highWaterMark
  sink.once('drain', async () => {
    console.log('drain');                        // Output: drain

    function* numbers() { for (let i = 0; i < 1000; i++) yield i; }
    await pipeline(Readable.from(numbers()), slowSink());
    console.log('pipeline done, max buffered:', maxBuffered <= 3);
    // Output: pipeline done, max buffered: true
  });
popularity: 8.1
isPublished: true
---
