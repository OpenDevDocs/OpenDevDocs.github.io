---
course: c-sharp
slug: class-vs-object
experienceLevel: fresher
difficulty: easy
tags:
  - oop
question: "What is the difference between a class and an object?"
answer: |
  A **class** is a blueprint: a type definition that describes the data (fields and properties) and behavior (methods) its instances will have. Declaring a class doesn't allocate memory for any data.

  An **object** is a concrete instance of a class, created at runtime with `new`. Each object lives on the managed heap and has its own copy of the instance fields, so two `Car` objects can have different colors while sharing the same methods.

  Key points:

  - One class can produce any number of objects.
  - A variable of a class type holds a **reference** to an object, not the object itself, so two variables can refer to the same object.
  - An object stays alive while something references it. Once nothing does, the garbage collector can reclaim it.

  In short, the class is the definition, and objects are what you create from it and work with.
codeExample: |
  var car1 = new Car("Red");       // object 1
  var car2 = new Car("Blue");      // object 2, same class
  var car3 = car1;                 // a second reference to object 1

  car3.Paint("Green");

  Console.WriteLine(car1.Color);   // Output: Green (car1 and car3 share an object)
  Console.WriteLine(car2.Color);   // Output: Blue  (separate object, own state)
  Console.WriteLine(object.ReferenceEquals(car1, car3)); // Output: True

  // The class: a blueprint for creating Car objects
  public class Car
  {
      public string Color { get; private set; }

      public Car(string color) => Color = color;

      public void Paint(string newColor) => Color = newColor;
  }
popularity: 8.0
isPublished: true
---
