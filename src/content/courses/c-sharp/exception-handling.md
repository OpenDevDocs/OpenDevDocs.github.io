---
publishDate: 2026-04-14T11:25
title: Exception Handling
slug: exception-handling
metadescription: Handle run time errors with try, catch and finally, catch specific exception types, throw and rethrow correctly, create custom exceptions and avoid the common mistakes.
updateDate: 2026-09-05T11:25
author: ['bishal-biswas']
level: 2
tags: ['errors', 'exceptions']
course: c-sharp
---

## What an exception is

Some errors cannot be caught by the compiler. A file might be missing. The user might type letters where a number was expected. A network call might time out. When something like this happens at run time, .NET **throws an exception**: an object that describes what went wrong.

If nothing catches it, the exception travels up through every calling method until it reaches the top and crashes the program with a stack trace.

```csharp
int[] numbers = { 1, 2, 3 };
Console.WriteLine(numbers[5]);   // IndexOutOfRangeException, program stops
```

## try and catch

Wrap risky code in `try`. If an exception is thrown inside, execution jumps to the matching `catch`:

```csharp
try
{
    Console.Write("Enter a number: ");
    int n = int.Parse(Console.ReadLine() ?? "");
    Console.WriteLine($"Double is {n * 2}");
}
catch (FormatException)
{
    Console.WriteLine("That was not a number");
}

Console.WriteLine("Program continues");
```

The lines after the failing one inside `try` are skipped. The program carries on after the `catch` block.

## Catching specific types

Different problems throw different exception types. Order your catches from most specific to most general. The first match wins:

```csharp
try
{
    string? text = Console.ReadLine();
    int n = int.Parse(text!);
    int result = 100 / n;
    Console.WriteLine(result);
}
catch (FormatException)
{
    Console.WriteLine("Not a number");
}
catch (DivideByZeroException)
{
    Console.WriteLine("Cannot divide by zero");
}
catch (Exception ex)
{
    Console.WriteLine($"Something else went wrong: {ex.Message}");
}
```

`Exception` is the base type of every exception, so it catches anything. Put it last, and only if you actually have something useful to do with an unknown error.

## The exception object

Give the catch a variable name to inspect it:

```csharp
catch (Exception ex)
{
    Console.WriteLine(ex.Message);      // human readable description
    Console.WriteLine(ex.GetType());    // the exact type
    Console.WriteLine(ex.StackTrace);   // where it happened
}
```

## finally

Code in `finally` runs whether or not an exception occurred. Use it for cleanup that must happen no matter what:

```csharp
StreamReader? reader = null;
try
{
    reader = new StreamReader("data.txt");
    Console.WriteLine(reader.ReadLine());
}
catch (FileNotFoundException)
{
    Console.WriteLine("File missing");
}
finally
{
    reader?.Dispose();   // always closes the file
}
```

For resources like files, the `using` statement is shorter and does the same job. It is covered in the file handling topic.

## Throwing exceptions

Throw your own when a method receives something it cannot work with:

```csharp
static decimal Withdraw(decimal balance, decimal amount)
{
    if (amount <= 0)
        throw new ArgumentOutOfRangeException(nameof(amount), "Amount must be positive");
    if (amount > balance)
        throw new InvalidOperationException("Insufficient funds");

    return balance - amount;
}
```

Pick a built in type that fits. The common ones:

- `ArgumentException` and `ArgumentNullException`: a bad argument.
- `ArgumentOutOfRangeException`: an argument outside the allowed range.
- `InvalidOperationException`: the object is in the wrong state for this call.
- `NotSupportedException` and `NotImplementedException`: what they say.

Modern .NET has helpers for the most frequent checks:

```csharp
ArgumentNullException.ThrowIfNull(name);
ArgumentOutOfRangeException.ThrowIfNegative(amount);
```

## Rethrowing

Sometimes you want to log an error and let it continue upwards. Use `throw;` on its own. Writing `throw ex;` resets the stack trace and hides where the problem started:

```csharp
try
{
    Process();
}
catch (Exception ex)
{
    Console.WriteLine($"Logged: {ex.Message}");
    throw;        // correct, keeps the original stack trace
    // throw ex;  // wrong, loses it
}
```

To wrap an exception in a more meaningful one, pass the original as the inner exception:

```csharp
catch (IOException ex)
{
    throw new DataLoadException("Could not load settings", ex);
}
```

## Exception filters

A `when` clause catches only when a condition holds:

```csharp
catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
{
    Console.WriteLine("Resource does not exist");
}
```

## Custom exceptions

Create your own when callers need to catch a specific situation. Inherit from `Exception` and provide the standard constructors:

```csharp
class InsufficientFundsException : Exception
{
    public decimal Shortfall { get; }

    public InsufficientFundsException(decimal shortfall)
        : base($"Short by {shortfall:C}")
    {
        Shortfall = shortfall;
    }
}
```

Name it with the `Exception` suffix and add properties for any data the catcher will need.

## Exceptions are for exceptional cases

Throwing and catching is slow compared to an `if`. Do not use exceptions for normal control flow:

```csharp
// Bad: expected situation handled as an exception
try { n = int.Parse(input); } catch { n = 0; }

// Good: use the Try pattern
if (!int.TryParse(input, out n)) n = 0;
```

Rule of thumb: if you expect the failure to happen regularly, return a result or a `bool`. If it means something has genuinely gone wrong, throw.

## Do not swallow exceptions

An empty catch hides bugs:

```csharp
try { Save(); }
catch { }   // the save silently failed and nobody will ever know
```

At minimum, log the message. Usually, let it propagate to something that can handle it.

## Quick recap

- Exceptions are objects thrown at run time when something goes wrong, and uncaught ones crash the program.
- `try` wraps risky code, `catch` handles it, `finally` always runs.
- Catch specific types first and `Exception` last, if at all.
- `throw new ...` signals a problem, `throw;` rethrows without losing the stack trace.
- Custom exceptions inherit from `Exception` and end in the word Exception.
- Use `TryParse` style methods for expected failures and exceptions for real errors.

<code id="code-content" class="language-csharp">
// Exception handling in C#
class InsufficientFundsException : Exception
{
    public decimal Shortfall { get; }
    public InsufficientFundsException(decimal shortfall)
        : base($"Short by {shortfall}") =&gt; Shortfall = shortfall;
}
static decimal Withdraw(decimal balance, decimal amount)
{
    ArgumentOutOfRangeException.ThrowIfNegativeOrZero(amount);   // built in guard
    if (amount &gt; balance)
        throw new InsufficientFundsException(amount - balance);  // custom exception
    return balance - amount;
}
// Specific catches first, general last, finally always runs
string[] inputs = { "50", "abc", "500", "0" };
foreach (string input in inputs)
{
    try
    {
        decimal amount = decimal.Parse(input);                  // may throw FormatException
        decimal left = Withdraw(100, amount);
        Console.WriteLine($"Withdrew {amount}, {left} left");
    }
    catch (FormatException)
    {
        Console.WriteLine($"'{input}' is not a number");
    }
    catch (InsufficientFundsException ex)
    {
        Console.WriteLine($"{ex.Message} (shortfall {ex.Shortfall})");
    }
    catch (ArgumentOutOfRangeException ex) when (ex.ParamName == "amount")
    {
        Console.WriteLine("Amount must be positive");
    }
    finally
    {
        Console.WriteLine("--- attempt finished ---");
    }
}
// Rethrow with throw; to keep the stack trace
try
{
    try { Withdraw(10, 20); }
    catch (Exception ex) { Console.WriteLine($"Logged: {ex.Message}"); throw; }
}
catch (InsufficientFundsException)
{
    Console.WriteLine("Handled at the top");
}
</code></pre>
