---
course: c-sharp
slug: uncatchable-exceptions-and-fatal-errors
experienceLevel: senior
difficulty: medium
tags:
  - exceptions
  - clr
question: "Which exceptions cannot be caught in .NET, and how should an application handle fatal failures?"
answer: |
  Some failures end the process no matter how many `catch` blocks you write:

  - **`StackOverflowException`**, usually from runaway recursion. The runtime terminates the process immediately, and no `catch` or `finally` block runs.
  - **Corrupted-state exceptions**, such as an `AccessViolationException` from bad interop: .NET Core and later don't deliver them to managed `catch` blocks, and the old `[HandleProcessCorruptedStateExceptions]` attribute is ignored.
  - **`Environment.FailFast`** intentionally terminates the process immediately, without running `finally` blocks.
  - **`OutOfMemoryException`** can be caught, but the process may be in a fragile state, so recovery beyond cleanup and logging is risky.

  Also note that `Thread.Abort` isn't supported in .NET Core and later; calling it throws `PlatformNotSupportedException`.

  Handling strategy:

  - **Prevent what you can:** guard recursion depth and validate inputs.
  - **Log at the last chance:** `AppDomain.CurrentDomain.UnhandledException` and `TaskScheduler.UnobservedTaskException` let you record the error, but they can't keep the process alive.
  - **Crash fast, then recover outside the process:** let a supervisor, such as Kubernetes, systemd, or the Windows service manager, restart it.
  - **Capture evidence:** enable automatic crash dumps with `DOTNET_DbgEnableMiniDump`.
codeExample: |
  AppDomain.CurrentDomain.UnhandledException += (_, e) =>
  {
      // Last-chance logging only: the process still terminates afterward
      Console.Error.WriteLine($"FATAL: {e.ExceptionObject}");
  };

  try { Recurse(0); }                        // StackOverflowException: no catch runs
  catch (Exception) { Console.WriteLine("Never printed"); }

  static int Recurse(int depth) => Recurse(depth + 1) + 1;

  // Guard recursion depth instead of hoping to catch the overflow
  static int SafeDepth(Node? node, int depth = 0)
  {
      if (depth > 10_000) throw new InvalidOperationException("Tree too deep");
      return node is null ? depth : SafeDepth(node.Next, depth + 1);
  }
  record Node(Node? Next);

  // Environment.FailFast("Invariant broken");  // terminates now, no finally blocks
popularity: 6.5
isPublished: true
---
