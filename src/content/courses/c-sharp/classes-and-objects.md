---
publishDate: 2026-04-07T11:12
title: Classes and Objects
slug: classes-and-objects
metadescription: Learn what a class is, how to create objects from it, the difference between reference and value types, and how to organise data and behaviour together.
updateDate: 2026-09-05T11:12
author: ['bishal-biswas']
level: 2
tags: ['oop', 'classes']
course: c-sharp
---

## Why classes?

So far you have kept data in separate variables. A bank account needs an owner, a balance and a number, and a program with ten accounts would need thirty variables. A **class** bundles related data and the methods that work on it into one unit.

## Defining a class

```csharp
class BankAccount
{
    public string Owner;
    public decimal Balance;

    public void Deposit(decimal amount)
    {
        Balance += amount;
    }

    public void Withdraw(decimal amount)
    {
        if (amount > Balance)
        {
            Console.WriteLine("Insufficient funds");
            return;
        }
        Balance -= amount;
    }
}
```

`Owner` and `Balance` are **fields**, the data every account carries. `Deposit` and `Withdraw` are **methods**, the things an account can do. Notice they are not `static`. They work on a specific account.

## Creating objects

A class is a blueprint. An **object** (also called an **instance**) is a real thing built from it, using `new`:

```csharp
BankAccount ashaAccount = new BankAccount();
ashaAccount.Owner = "Asha";
ashaAccount.Balance = 500;

ashaAccount.Deposit(200);
ashaAccount.Withdraw(1000);   // Insufficient funds
Console.WriteLine(ashaAccount.Balance);   // 700
```

Modern C# lets you shorten the creation:

```csharp
var raviAccount = new BankAccount();
BankAccount meeraAccount = new();       // target typed new
```

## Each object has its own data

```csharp
var a = new BankAccount { Owner = "Asha", Balance = 100 };
var b = new BankAccount { Owner = "Ravi", Balance = 100 };

a.Deposit(50);

Console.WriteLine(a.Balance);   // 150
Console.WriteLine(b.Balance);   // 100
```

The braces after `new BankAccount` are an **object initialiser**, a compact way to set fields right after creation.

## The this keyword

Inside a method, `this` refers to the current object. You rarely need to write it, but it resolves the clash when a parameter has the same name as a field:

```csharp
class Person
{
    public string Name;

    public void Rename(string Name)
    {
        this.Name = Name;   // field = parameter
    }
}
```

## Classes are reference types

A variable of class type holds a **reference** to the object, not the object itself. Copying the variable copies the reference, so both names point at the same object:

```csharp
var first = new BankAccount { Owner = "Asha", Balance = 100 };
var second = first;

second.Balance = 999;
Console.WriteLine(first.Balance);   // 999, same object
```

Compare that to an `int`, where copying the variable copies the value. This is the single most important thing to understand about classes.

## null

A class variable that has not been given an object holds `null`. Calling a method on it crashes with a `NullReferenceException`:

```csharp
BankAccount? account = null;
// account.Deposit(10);   // NullReferenceException at run time

if (account is not null)
{
    account.Deposit(10);
}
```

With nullable reference types enabled, the compiler warns you when a variable might be null and you use it without checking.

## Structs: the value type cousin

A `struct` looks like a class but is a **value type**. Copying it copies the whole thing:

```csharp
struct Point
{
    public int X;
    public int Y;
}

var p1 = new Point { X = 1, Y = 2 };
var p2 = p1;
p2.X = 50;
Console.WriteLine(p1.X);   // 1, separate copy
```

Use structs for small, simple values such as coordinates, colours and money amounts. Use classes for everything with identity or behaviour. `int`, `double`, `bool` and `DateTime` are all structs.

## Organising files

The convention is one class per file, with the file named after the class: `BankAccount.cs`. Put related classes in the same namespace:

```csharp
namespace Banking;

public class BankAccount
{
    // ...
}
```

The file scoped namespace with a semicolon, shown above, avoids an extra level of indentation.

## Quick recap

- A class bundles fields (data) and methods (behaviour) into one type.
- `new` creates an object, and each object has its own copy of the fields.
- Object initialisers `{ Owner = "Asha" }` set fields at creation.
- Class variables hold references, so copying a variable does not copy the object.
- A variable without an object is `null`, and using it throws.
- Structs are the value type alternative for small, simple data.

<code id="code-content" class="language-csharp">
// Classes and objects
class BankAccount
{
    // Fields: the data each account carries
    public string Owner = "";
    public decimal Balance;
    // Methods: what an account can do
    public void Deposit(decimal amount) =&gt; Balance += amount;
    public bool Withdraw(decimal amount)
    {
        if (amount &gt; Balance) return false;   // not enough money
        Balance -= amount;
        return true;
    }
}
// A struct is a value type: copies are independent
struct Point
{
    public int X;
    public int Y;
}
// Create objects with new and an object initialiser
var asha = new BankAccount { Owner = "Asha", Balance = 500 };
var ravi = new BankAccount { Owner = "Ravi", Balance = 100 };
asha.Deposit(200);
Console.WriteLine(asha.Withdraw(1000));      // False
Console.WriteLine($"{asha.Owner}: {asha.Balance}");   // Asha: 700
Console.WriteLine($"{ravi.Owner}: {ravi.Balance}");   // Ravi: 100
// Classes are reference types: two names, one object
var alias = asha;
alias.Balance = 0;
Console.WriteLine(asha.Balance);             // 0
// Structs are copied
var p1 = new Point { X = 1, Y = 2 };
var p2 = p1;
p2.X = 50;
Console.WriteLine(p1.X);                     // 1
// null means "no object yet"
BankAccount? missing = null;
Console.WriteLine(missing is null);          // True
</code></pre>
