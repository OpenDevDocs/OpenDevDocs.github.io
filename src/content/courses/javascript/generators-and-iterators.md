---
publishDate: 2026-03-24T09:41
title: Generators and Iterators
slug: generators-and-iterators
metadescription: Write functions that pause and resume, produce values one at a time, and handle infinite sequences without running out of memory.
updateDate: 2026-09-05T09:41
author: ['bishal-biswas']
level: 3
tags: ['iterators', 'generators', 'es6']
course: javascript
---

## The iterator protocol

An **iterator** is any object with a `next()` method that returns `{ value, done }`.

```javascript
function makeIterator(array) {
  let index = 0;
  return {
    next() {
      if (index < array.length) {
        return { value: array[index++], done: false };
      }
      return { value: undefined, done: true };
    }
  };
}
const it = makeIterator(['a', 'b']);
console.log(it.next());
console.log(it.next());
console.log(it.next());
```

Anything that follows this protocol can be walked one item at a time.

An **iterable** is an object with a `Symbol.iterator` method that returns an iterator. That is what `for...of` and spread look for.

```javascript
const iterable = {
  from: 1,
  to: 4,
  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;
    return {
      next() {
        return current <= last
          ? { value: current++, done: false }
          : { done: true };
      }
    };
  }
};
console.log([...iterable]);
for (const n of iterable) {
  console.log(n);
}
```

Arrays, strings, Maps, Sets and NodeLists are all iterable already. Plain objects are not, which is why `for...of` does not work on them.

## Generators do this for you

Writing iterators by hand is tedious. A generator produces one automatically.

```javascript
function* countTo(limit) {
  for (let i = 1; i <= limit; i++) {
    yield i;
  }
}
const counter = countTo(3);
console.log(counter.next());
console.log(counter.next());
console.log(counter.next());
console.log(counter.next());
console.log([...countTo(5)]);
```

Two pieces of syntax:

- `function*` declares a generator.
- `yield` hands out a value and **pauses** right there.

Calling a generator does not run the body. It returns a generator object. The body advances only when you call `next()`.

## Pausing is the whole point

```javascript
function* steps() {
  console.log('Step 1');
  yield 'a';
  console.log('Step 2');
  yield 'b';
  console.log('Step 3');
  return 'done';
}
const gen = steps();
console.log('Nothing has run yet');
console.log(gen.next());
console.log(gen.next());
console.log(gen.next());
```

The function's local state survives between calls, which normal functions cannot do.

## Infinite sequences

Because values are produced on demand, a generator can describe something endless without using endless memory.

```javascript
function* naturalNumbers() {
  let n = 1;
  while (true) {
    yield n++;
  }
}
const numbers = naturalNumbers();
console.log(numbers.next().value);
console.log(numbers.next().value);
function* take(iterable, count) {
  let taken = 0;
  for (const value of iterable) {
    if (taken++ >= count) return;
    yield value;
  }
}
console.log([...take(naturalNumbers(), 5)]);
```

> **Never spread an infinite generator.** `[...naturalNumbers()]` will hang the tab.

A Fibonacci sequence is the classic example:

```javascript
function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}
console.log([...take(fibonacci(), 10)]);
```

## Sending values in

`yield` is an expression, so `next(value)` can pass something back into the generator.

```javascript
function* conversation() {
  const name = yield 'What is your name?';
  const age = yield `Hello ${name}, how old are you?`;
  return `${name} is ${age}`;
}
const chat = conversation();
console.log(chat.next().value);
console.log(chat.next('Asha').value);
console.log(chat.next(28).value);
```

The first `next()` cannot send anything, because the generator has not reached a `yield` yet.

## Delegating with `yield*`

```javascript
function* inner() {
  yield 'b';
  yield 'c';
}
function* outer() {
  yield 'a';
  yield* inner();
  yield 'd';
}
console.log([...outer()]);
```

`yield*` hands control to another generator or any iterable.

## Making a class iterable

```javascript
class Playlist {
  #songs = [];
  add(song) {
    this.#songs.push(song);
    return this;
  }
  *[Symbol.iterator]() {
    for (const song of this.#songs) {
      yield song;
    }
  }
  *reversed() {
    for (let i = this.#songs.length - 1; i >= 0; i--) {
      yield this.#songs[i];
    }
  }
}
const playlist = new Playlist().add('One').add('Two').add('Three');
console.log([...playlist]);
console.log([...playlist.reversed()]);
for (const song of playlist) {
  console.log(song);
}
```

A generator method with `*` is by far the easiest way to make your own class work with `for...of` and spread.

## Async generators

For streams of data that arrive over time.

```javascript
async function* fetchPages(url) {
  let page = 1;
  while (true) {
    const response = await fetch(`${url}?page=${page}`);
    const data = await response.json();
    if (data.length === 0) return;
    yield* data;
    page++;
  }
}
```

Consume it with `for await`:

```javascript
for await (const item of fetchPages('/api/items')) {
  console.log(item);
}
```

Each page is fetched only when the previous one has been used up.

## Where you will actually use them

- **Lazy sequences** where you only need the first few values.
- **Paginated APIs**, as above.
- **Unique id generators.**
- **Custom iteration** over your own data structures.

```javascript
function* idGenerator(prefix = 'id') {
  let n = 1;
  while (true) {
    yield `${prefix}-${n++}`;
  }
}
const ids = idGenerator('user');
console.log(ids.next().value, ids.next().value);
```

They are not everyday tools, but when you need pausable state they are far cleaner than the alternatives.

## Quick recap

- An iterator has `next()` returning `{ value, done }`.
- An iterable has `Symbol.iterator`, which is what `for...of` and spread need.
- `function*` and `yield` create iterators without the boilerplate.
- Calling a generator runs nothing until `next()`.
- Values are produced on demand, so infinite sequences are fine if you take only some.
- `next(value)` sends data back in, and `yield*` delegates to another iterable.
- `async function*` plus `for await` handles data arriving over time.

<code id="code-content" class="language-javascript">
// A generator pauses at every yield and remembers where it was
function* countTo(limit) {
  for (let i = 1; i &lt;= limit; i++) yield i;
}
const counter = countTo(3);
console.log(counter.next());   // { value: 1, done: false }
console.log(counter.next());   // { value: 2, done: false }
console.log([...countTo(5)]);  // [1,2,3,4,5]
// Infinite sequences are fine, because values are made on demand
function* naturalNumbers() {
  let n = 1;
  while (true) yield n++;
}
function* take(iterable, count) {
  let taken = 0;
  for (const value of iterable) {
    if (taken++ &gt;= count) return;
    yield value;
  }
}
console.log([...take(naturalNumbers(), 5)]);   // [1,2,3,4,5]
// Never do [...naturalNumbers()] , it would never finish
function* fibonacci() {
  let a = 0, b = 1;
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}
console.log([...take(fibonacci(), 10)]);
// next(value) sends data back into the generator
function* conversation() {
  const name = yield 'What is your name?';
  const age = yield 'Hello ' + name + ', how old are you?';
  return name + ' is ' + age;
}
const chat = conversation();
console.log(chat.next().value);      // the first question
console.log(chat.next('Asha').value);
console.log(chat.next(28).value);    // Asha is 28
// yield* delegates to another iterable
function* inner() { yield 'b'; yield 'c'; }
function* outer() { yield 'a'; yield* inner(); yield 'd'; }
console.log([...outer()]);           // ['a','b','c','d']
// A generator method makes your own class work with for...of and spread
class Playlist {
  #songs = [];
  add(song) { this.#songs.push(song); return this; }
  *[Symbol.iterator]() { yield* this.#songs; }
  *reversed() {
    for (let i = this.#songs.length - 1; i &gt;= 0; i--) yield this.#songs[i];
  }
}
const playlist = new Playlist().add('One').add('Two').add('Three');
console.log([...playlist]);
console.log([...playlist.reversed()]);
// A handy everyday use: unique ids
function* idGenerator(prefix = 'id') {
  let n = 1;
  while (true) yield prefix + '-' + n++;
}
const ids = idGenerator('user');
console.log(ids.next().value, ids.next().value);  // user-1 user-2
</code></pre>
