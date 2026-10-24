---
course: c-sharp
slug: sealed-classes-and-methods
experienceLevel: fresher
difficulty: easy
tags:
  - oop
question: "What is a `sealed` class, and why would you use one?"
answer: |
  A `sealed` class **can't be inherited**. Trying to derive from it is a compile error. `string` is a well-known example: nobody can create a subclass of `System.String`.

  You can also seal an individual method with `sealed override`. The class still allows subclasses, but they can't override that method any further.

  Reasons to seal:

  - **Design intent:** the class wasn't built for extension, and sealing documents that clearly.
  - **Safety:** subclasses can't change behavior other code relies on, such as validation or security checks.
  - **Performance:** the JIT knows no subclass can override anything, so it can sometimes turn virtual calls into direct calls.

  Many teams seal classes by default and unseal them only when inheritance is genuinely needed. Note that a class can't be both `abstract` and `sealed`, since an abstract class exists only to be inherited.
codeExample: |
  var admin = new AdminUser();
  Console.WriteLine(admin.Role());   // Output: Admin
  Console.WriteLine(admin.Greet());  // Output: Hello from Admin

  public class User
  {
      public virtual string Role() => "User";
      public virtual string Greet() => $"Hello from {Role()}";
  }

  public class AdminUser : User
  {
      public sealed override string Role() => "Admin"; // no further overriding
  }

  public sealed class SuperAdmin : AdminUser     // sealed: end of the chain
  {
      // public override string Role() => "Super"; // compile error: Role is sealed
      public override string Greet() => "Hi";      // allowed: Greet isn't sealed
  }

  // public class Hacker : SuperAdmin { }  // compile error: can't derive from sealed
  // public class MyString : string { }    // compile error: string is sealed
popularity: 7.5
isPublished: true
---
