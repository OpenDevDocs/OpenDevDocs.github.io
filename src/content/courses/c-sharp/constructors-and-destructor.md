---
publishDate: 2026-04-08T11:13
title: Constructors and Destructor
slug: constructors-and-destructor
metadescription: Initialise objects correctly with constructors, chain them with this, use primary constructors and static constructors, and understand what finalizers really do.
updateDate: 2026-09-05T11:13
author: ['bishal-biswas']
level: 2
tags: ['oop', 'constructors']
course: c-sharp
---

## The problem with empty objects

Creating an object and then filling in its fields one by one is error prone. Forget one and you have a half built object:

```csharp
var account = new BankAccount();
account.Owner = "Asha";
// forgot Balance, forgot AccountNumber
```

A **constructor** is a special method that runs when the object is created, so the object is complete from its very first moment.

## Defining a constructor

A constructor has the same name as the class and no return type:

```csharp
class BankAccount
{
    public string Owner;
    public decimal Balance;

    public BankAccount(string owner, decimal openingBalance)
    {
        Owner = owner;
        Balance = openingBalance;
    }
}

var account = new BankAccount("Asha", 500);
Console.WriteLine(account.Owner);   // Asha
```

Now it is impossible to create an account without an owner and a balance. The compiler enforces it.

## The default constructor

If you write no constructor, C# gives you an empty one for free, which is why `new BankAccount()` worked before. As soon as you add your own constructor, the free one disappears. Add it back explicitly if you still need it:

```csharp
class BankAccount
{
    public string Owner = "Unknown";
    public decimal Balance;

    public BankAccount() { }

    public BankAccount(string owner, decimal balance)
    {
        Owner = owner;
        Balance = balance;
    }
}
```

## Validation in constructors

A constructor is the right place to reject bad data. Throwing here means a bad object never exists:

```csharp
public BankAccount(string owner, decimal openingBalance)
{
    if (string.IsNullOrWhiteSpace(owner))
        throw new ArgumentException("Owner is required", nameof(owner));
    if (openingBalance < 0)
        throw new ArgumentOutOfRangeException(nameof(openingBalance));

    Owner = owner;
    Balance = openingBalance;
}
```

## Constructor chaining with this

When one constructor is a special case of another, call the fuller one with `: this(...)` instead of repeating the code:

```csharp
class BankAccount
{
    public string Owner;
    public decimal Balance;

    public BankAccount(string owner) : this(owner, 0)
    {
    }

    public BankAccount(string owner, decimal balance)
    {
        Owner = owner;
        Balance = balance;
    }
}
```

The chained constructor runs first, then the body of the one you called.

## Primary constructors

Since C# 12, you can declare constructor parameters right on the class. They are available throughout the class body:

```csharp
class BankAccount(string owner, decimal openingBalance)
{
    public string Owner { get; } = owner;
    public decimal Balance { get; private set; } = openingBalance;

    public void Deposit(decimal amount) => Balance += amount;
}

var account = new BankAccount("Asha", 500);
```

This removes a lot of boilerplate for simple classes. Records, covered later, have used this style since C# 9.

## Field initialisers run first

Fields with an initial value are set before the constructor body runs:

```csharp
class Logger
{
    private List<string> entries = new();   // runs first
    public Logger()
    {
        entries.Add("Logger started");       // safe, list already exists
    }
}
```

## Static constructors

A static constructor runs once, before the class is first used. It sets up static data and takes no parameters:

```csharp
class Config
{
    public static readonly string AppName;

    static Config()
    {
        AppName = "OpenDevDocs";
        Console.WriteLine("Config loaded");
    }
}
```

You never call it yourself. .NET calls it automatically.

## Destructors and finalizers

C# has a destructor syntax, written with a tilde:

```csharp
class TempFile
{
    ~TempFile()
    {
        Console.WriteLine("Finalizer ran");
    }
}
```

This is called a **finalizer**, and it is very different from a destructor in C++. You do not control when it runs. The garbage collector calls it at some point after the object becomes unreachable, possibly much later, possibly never if the program exits first.

Because of that, finalizers are almost never the right tool. For cleaning up files, connections and other resources, C# uses the `IDisposable` interface and `using` blocks, which run at a predictable moment. That topic is covered later in the course. For now, remember: you will rarely write a finalizer.

## Quick recap

- A constructor runs when `new` is called and makes sure the object starts complete.
- Writing your own constructor removes the free empty one.
- Validate arguments in the constructor so a bad object can never exist.
- Chain constructors with `: this(...)` to avoid repeating code.
- Primary constructors put the parameters on the class declaration.
- A static constructor runs once for the class, and finalizers are rarely needed.

<code id="code-content" class="language-csharp">
// Constructors in C#
class BankAccount
{
    public string Owner { get; }
    public decimal Balance { get; private set; }
    public static int Created { get; private set; }
    // Static constructor runs once before first use
    static BankAccount()
    {
        Console.WriteLine("BankAccount type initialised");
    }
    // Chained constructor: single argument delegates to the full one
    public BankAccount(string owner) : this(owner, 0) { }
    // Main constructor validates and sets everything
    public BankAccount(string owner, decimal openingBalance)
    {
        if (string.IsNullOrWhiteSpace(owner))
            throw new ArgumentException("Owner is required", nameof(owner));
        if (openingBalance &lt; 0)
            throw new ArgumentOutOfRangeException(nameof(openingBalance));
        Owner = owner;
        Balance = openingBalance;
        Created++;
    }
    public void Deposit(decimal amount) =&gt; Balance += amount;
}
// Primary constructor (C# 12): parameters declared on the class
class Customer(string name, int age)
{
    public string Name { get; } = name;
    public bool IsAdult =&gt; age &gt;= 18;
}
var a = new BankAccount("Asha", 500);
var b = new BankAccount("Ravi");
Console.WriteLine($"{a.Owner} {a.Balance}");   // Asha 500
Console.WriteLine($"{b.Owner} {b.Balance}");   // Ravi 0
Console.WriteLine(BankAccount.Created);        // 2
var c = new Customer("Meera", 20);
Console.WriteLine($"{c.Name} adult: {c.IsAdult}");   // Meera adult: True
try
{
    var bad = new BankAccount("", 10);
}
catch (ArgumentException ex)
{
    Console.WriteLine(ex.Message);             // Owner is required
}
</code></pre>
