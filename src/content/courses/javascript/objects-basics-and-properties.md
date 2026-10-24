---
publishDate: 2026-03-06T09:09
title: Objects - Basics and Properties
slug: objects-basics-and-properties
metadescription: Group related information together with objects. Learn properties, methods, nesting, and the safe way to read values that might be missing.
updateDate: 2026-09-05T09:09
author: ['bishal-biswas']
level: 1
tags: ['basics', 'objects']
course: javascript
---

## What is an object?

An array is a list. An object is a **labelled** collection, where every value has a name.

```javascript
const person = {
  name: 'Nisha',
  age: 29,
  city: 'Chennai'
};
console.log(person);
```

Each `name: value` pair is a **property**. The name is the key, and it is always text.

Use an array when order matters and the items are the same kind of thing. Use an object when each piece of information means something different.

## Reading properties

### Dot notation

```javascript
const person = { name: 'Nisha', age: 29 };
console.log(person.name);
console.log(person.age);
```

This is the normal way. Clean and readable.

### Bracket notation

```javascript
console.log(person['name']);
```

Brackets look clumsier, but they can do two things dots cannot.

**One:** keys that are not valid variable names.

```javascript
const settings = { 'font-size': 16, 'max width': 800 };
console.log(settings['font-size']);
```

**Two:** keys stored in a variable.

```javascript
const person = { name: 'Nisha', age: 29 };
const key = 'age';
console.log(person[key]);
console.log(person.key);
```

`person.key` looks for a property literally called `key`, which does not exist, so it gives `undefined`.

## Adding, changing and deleting

```javascript
const person = { name: 'Nisha' };
person.age = 29;
person['city'] = 'Chennai';
console.log(person);
person.age = 30;
console.log(person.age);
delete person.city;
console.log(person);
```

Just like arrays, this all works with `const`, because you are changing the contents rather than replacing the object.

## Missing properties

```javascript
const person = { name: 'Nisha' };
console.log(person.email);
```

You get `undefined`, not an error. But going one level deeper does throw:

```javascript
const user = {};
console.log(user.address.city);
```

That gives `TypeError: Cannot read properties of undefined`.

### Optional chaining

The `?.` operator stops safely instead of throwing.

```javascript
const user = {};
console.log(user.address?.city);
```

Now you get `undefined`. Combine it with `??` for a default:

```javascript
const user = {};
console.log(user.address?.city ?? 'Unknown');
```

## Checking if a property exists

```javascript
const person = { name: 'Nisha', age: 0 };
console.log('age' in person);
console.log(person.age !== undefined);
console.log(Object.hasOwn(person, 'name'));
```

Do not test with `if (person.age)`, because `0`, `''` and `false` are all falsy and would look missing when they are not.

## Methods

A property whose value is a function is called a **method**.

```javascript
const calculator = {
  add: function (a, b) {
    return a + b;
  },
  subtract(a, b) {
    return a - b;
  }
};
console.log(calculator.add(5, 3));
console.log(calculator.subtract(5, 3));
```

The second form is the ES6 shorthand and is what most code uses today.

### `this` inside a method

```javascript
const person = {
  name: 'Nisha',
  greet() {
    return 'Hi, I am ' + this.name;
  }
};
console.log(person.greet());
```

`this` refers to the object the method was called on. There is a whole topic on `this` later, because it has some sharp edges.

## Nested objects

Objects can hold other objects and arrays.

```javascript
const student = {
  name: 'Karan',
  address: {
    city: 'Jaipur',
    pin: '302001'
  },
  subjects: ['Maths', 'Physics']
};
console.log(student.address.city);
console.log(student.subjects[0]);
console.log(student.subjects.length);
```

## Looping over an object

```javascript
const scores = { maths: 92, physics: 85, chemistry: 78 };
for (const subject in scores) {
  console.log(subject, scores[subject]);
}
console.log(Object.keys(scores));
console.log(Object.values(scores));
console.log(Object.entries(scores));
```

`Object.entries` is especially handy because it gives you pairs you can destructure:

```javascript
for (const [subject, mark] of Object.entries(scores)) {
  console.log(subject + ': ' + mark);
}
```

## Copying objects

```javascript
const original = { a: 1 };
const wrong = original;
wrong.a = 99;
console.log(original.a);
```

That prints `99`, because both names point at the same object. To make a real copy:

```javascript
const original = { a: 1, b: 2 };
const copy = { ...original };
copy.a = 99;
console.log(original.a, copy.a);
```

Note this is a **shallow** copy. Nested objects inside are still shared. For a full copy use `structuredClone`:

```javascript
const deep = structuredClone(original);
```

## Quick recap

- Objects store named values, arrays store ordered values.
- Use dots normally, brackets for odd keys or keys held in a variable.
- Missing properties give `undefined`, and `?.` prevents errors when digging deeper.
- Functions stored as properties are methods, and `this` points at the object.
- `Object.keys`, `values` and `entries` turn an object into arrays you can loop.
- `{ ...obj }` makes a shallow copy, `structuredClone` makes a deep one.

<code id="code-content" class="language-javascript">
// Creating an object
const student = {
  name: 'Karan',
  age: 21,
  address: { city: 'Jaipur', pin: '302001' },
  subjects: ['Maths', 'Physics'],
  greet() {
    return 'Hi, I am ' + this.name;
  }
};
// Reading with dots and brackets
console.log(student.name);
console.log(student['age']);
const key = 'age';
console.log(student[key]);        // 21, brackets read the variable
// Nested values
console.log(student.address.city);
console.log(student.subjects[0]);
console.log(student.greet());
// Adding, updating, deleting
student.email = 'karan@example.com';
student.age = 22;
delete student.email;
console.log(Object.keys(student));
// Safely reading something that might be missing
const user = {};
console.log(user.address?.city ?? 'Unknown');
// Checking a property exists, even when the value is 0
const scores = { maths: 0 };
console.log('maths' in scores);              // true
console.log(Object.hasOwn(scores, 'maths')); // true
// Looping
const marks = { maths: 92, physics: 85 };
for (const [subject, mark] of Object.entries(marks)) {
  console.log(subject + ':', mark);
}
// Copying: assignment shares, spread copies
const copy = { ...marks };
copy.maths = 100;
console.log(marks.maths, copy.maths); // 92 100
</code></pre>
