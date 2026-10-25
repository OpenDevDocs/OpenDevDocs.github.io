---
course: c-sharp
slug: reflection-basics
experienceLevel: mid
difficulty: medium
tags:
  - reflection
question: "What is reflection in C#, and what are its common uses and costs?"
answer: |
  **Reflection** lets code inspect and use types at runtime through their metadata. Starting from a `Type` object, obtained with `typeof(Order)` or `obj.GetType()`, you can list properties and methods, read attributes, create instances with `Activator.CreateInstance`, get or set property values, and invoke methods by name with `MethodInfo.Invoke`, all without knowing the types at compile time.

  Common uses:

  - Serializers that discover which properties to read and write.
  - Dependency injection containers that find constructors and their parameters.
  - ORMs that map classes to tables, and test frameworks that find `[Fact]` or `[Test]` methods.
  - Plugin systems that discover implementations in loaded assemblies.

  The costs:

  - **Performance:** reflective calls are much slower than direct calls. Cache `PropertyInfo` and `MethodInfo` objects, or convert them to delegates.
  - **No compile-time safety:** renaming a member breaks string-based lookups, and you only find out at runtime.
  - **Encapsulation:** reflection can reach private members.
  - **Trimming and Native AOT:** members used only through reflection may be trimmed away unless annotated.

  For hot paths and AOT, source generators do the same discovery at compile time.
codeExample: |
  using System.Reflection;
  var order = new Order { Id = 7, Customer = "Ada" };
  Type type = order.GetType();                        // or typeof(Order)

  foreach (PropertyInfo prop in type.GetProperties())
      Console.WriteLine($"{prop.Name} = {prop.GetValue(order)}");
  // Output: Id = 7
  //         Customer = Ada

  // Create an instance and set a property without compile-time knowledge
  object created = Activator.CreateInstance(type)!;
  type.GetProperty("Customer")!.SetValue(created, "Grace");
  // Invoke a method by name
  MethodInfo describe = type.GetMethod(nameof(Order.Describe))!;
  Console.WriteLine(describe.Invoke(created, null));  // Output: Order 0 for Grace
  // Faster for repeated calls: turn the MethodInfo into a delegate once
  var fast = describe.CreateDelegate<Func<Order, string>>();
  Console.WriteLine(fast(order));                     // Output: Order 7 for Ada

  public class Order
  {
      public int Id { get; set; }
      public string Customer { get; set; } = "";
      public string Describe() => $"Order {Id} for {Customer}";
  }
popularity: 8.0
isPublished: true
---
