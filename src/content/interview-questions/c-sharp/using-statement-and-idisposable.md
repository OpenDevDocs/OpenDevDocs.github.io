---
course: c-sharp
slug: using-statement-and-idisposable
experienceLevel: fresher
difficulty: easy
tags:
  - memory
question: "What is the `using` statement, and how does it relate to `IDisposable`?"
answer: |
  Some objects hold resources the garbage collector doesn't manage, such as file handles, database connections, or network sockets. These types implement `IDisposable`, whose `Dispose()` method releases the resource immediately.

  The `using` statement guarantees that `Dispose()` is called when the block ends, **even if an exception is thrown**. The compiler turns it into a `try`/`finally` block, so you can't forget the cleanup on an error path.

  Since C# 8 there's a shorter **using declaration**: `using var file = File.OpenRead(path);` disposes the object automatically at the end of the enclosing scope, without extra braces. For types that clean up asynchronously, `await using` calls `DisposeAsync()` instead.

  Don't confuse this with the `using` **directive** at the top of a file, which imports a namespace. It's the same keyword for an unrelated feature.
codeExample: |
  // using statement: Dispose runs when the block ends, even on exceptions
  using (var writer = new StreamWriter("log.txt"))
  {
      writer.WriteLine("Started");
  }   // writer.Dispose() flushes and closes the file here

  // using declaration (C# 8): disposed at the end of the enclosing scope
  using var reader = new StreamReader("log.txt");
  Console.WriteLine(reader.ReadLine());   // Output: Started

  // Roughly what the compiler generates for a using statement:
  var stream = new MemoryStream();
  try
  {
      stream.WriteByte(1);
  }
  finally
  {
      stream?.Dispose();
  }
popularity: 8.7
isPublished: true
---
