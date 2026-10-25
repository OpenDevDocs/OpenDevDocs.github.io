---
course: c-sharp
slug: equality-operator-vs-equals-method
experienceLevel: fresher
difficulty: medium
tags:
  - types
  - oop
question: "What is the difference between `==` and `Equals()` in C#?"
answer: |
  `==` is an **operator** chosen at compile time from the variables' static types, while `Equals()` is a **virtual method** chosen at runtime from the actual object.

  For classes, both default to **reference equality**: two variables are equal only if they point to the same object. Types can change that. `string` overloads `==` and overrides `Equals()` to compare text, records generate both to compare values, and your own classes can do the same.

  For structs, the default `ValueType.Equals()` compares fields, possibly using reflection, which is slow. The `==` operator doesn't exist for structs unless you overload it.

  Two traps: `x.Equals(y)` throws `NullReferenceException` when `x` is `null` (the static `object.Equals(x, y)` is null-safe), and two strings typed as `object` are compared by reference with `==`. Use `object.ReferenceEquals()` when you explicitly need identity. If you override `Equals()`, override `GetHashCode()` too.
codeExample: |
  string a = "hello";
  string b = new string("hello".ToCharArray()); // same text, new object

  Console.WriteLine(a == b);             // Output: True (string overloads ==)
  Console.WriteLine(a.Equals(b));        // Output: True
  Console.WriteLine(object.ReferenceEquals(a, b)); // Output: False

  object oa = a, ob = b;
  Console.WriteLine(oa == ob);           // Output: False (object ==: reference)
  Console.WriteLine(oa.Equals(ob));      // Output: True (virtual string.Equals)

  var p1 = new Person("Ada");
  var p2 = new Person("Ada");
  Console.WriteLine(p1 == p2);           // Output: False (class: reference)
  Console.WriteLine(new PersonRecord("Ada") == new PersonRecord("Ada"));
  // Output: True (records compare values)

  Person? nobody = null;
  // nobody.Equals(p1);                  // throws NullReferenceException
  Console.WriteLine(object.Equals(nobody, p1)); // Output: False (null-safe)

  class Person(string name) { public string Name => name; }
  record PersonRecord(string Name);
popularity: 8.9
isPublished: true
---
