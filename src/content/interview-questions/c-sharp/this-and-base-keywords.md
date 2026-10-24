---
course: c-sharp
slug: this-and-base-keywords
experienceLevel: fresher
difficulty: easy
tags:
  - oop
question: "What are the `this` and `base` keywords used for in C#?"
answer: |
  `this` refers to the **current instance** of a class or struct, and `base` lets you reach members of the **base class** from a derived class. As expressions, neither is available in `static` members, because there is no instance.

  Common uses of `this`:

  - Disambiguating a field from a same-named parameter: `this.name = name`.
  - Chaining constructors in the same class: `: this(...)`.
  - Passing the current object to another method: `logger.Track(this)`.
  - Declaring an indexer: `public T this[int index]`.
  - Marking an extension method's first parameter: `this string s`.

  Common uses of `base`:

  - Calling a base-class constructor with `: base(...)` so the parent initializes its state first.
  - Calling the parent's implementation from an override with `base.Method()`, to extend behavior instead of replacing it.

  Without `: base(...)`, the compiler inserts a call to the parameterless base constructor, so compilation fails if there isn't one.
codeExample: |
  var dog = new Dog("Rex");
  Console.WriteLine(dog.Describe());   // Output: Rex is an animal, a Mixed dog

  public class Animal
  {
      private readonly string name;
      public Animal(string name) => this.name = name;  // this: field vs parameter
      public virtual string Describe() => $"{name} is an animal";
  }

  public class Dog : Animal
  {
      private readonly string breed;

      public Dog(string name) : this(name, "Mixed") { }  // this: chaining
      public Dog(string name, string breed) : base(name)  // base: parent ctor
      {
          this.breed = breed;
      }

      public override string Describe() =>
          base.Describe() + $", a {breed} dog";            // base: parent logic
  }
popularity: 7.3
isPublished: true
---
