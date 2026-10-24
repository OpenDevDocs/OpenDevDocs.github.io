---
course: c-sharp
slug: switch-statement-vs-switch-expression
experienceLevel: fresher
difficulty: easy
tags:
  - basics
  - modern-csharp
question: "What is the difference between a `switch` statement and a `switch` expression?"
answer: |
  A `switch` **statement** runs blocks of code. Each `case` section contains statements and must end with `break`, `return`, `throw`, or `goto case`. C# doesn't allow implicit fall-through, although several `case` labels can share one section.

  A `switch` **expression** (C# 8) produces a **value**. It's more compact: each arm is `pattern => result`, arms are separated by commas, and the discard `_` catches everything else.

  Other differences:

  - The expression can appear anywhere a value is expected, such as in a `return` or an assignment.
  - The compiler warns when a switch expression doesn't cover every input, and an unmatched value throws `SwitchExpressionException` at runtime.
  - Both support patterns, such as type, relational (`< 0`), and property patterns.

  Prefer the expression when every branch just computes a value. Use the statement when branches perform several actions.
codeExample: |
  int day = 6;

  // switch statement: runs statements, each section ends with break
  switch (day)
  {
      case 6:
      case 7:                              // two labels share one section
          Console.WriteLine("Weekend");    // Output: Weekend
          break;
      default:
          Console.WriteLine("Weekday");
          break;
  }

  // switch expression: produces a value
  string type = day switch
  {
      6 or 7 => "Weekend",
      >= 1 and <= 5 => "Weekday",
      _ => throw new ArgumentOutOfRangeException(nameof(day))
  };
  Console.WriteLine(type);                 // Output: Weekend
popularity: 7.6
isPublished: true
---
