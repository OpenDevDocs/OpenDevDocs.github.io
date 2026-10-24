---
publishDate: 2026-04-15T11:26
title: File Handling
slug: file-handling
metadescription: Read and write text files with File and StreamReader, work with paths and directories safely, use the using statement to release handles, and save data as JSON.
updateDate: 2026-09-05T11:26
author: ['bishal-biswas']
level: 2
tags: ['files', 'io']
course: c-sharp
---

## The System.IO namespace

Everything to do with files lives in `System.IO`. With implicit usings enabled it is already imported. The main players:

- `File`: static helpers for reading, writing, copying and deleting files.
- `Directory`: the same for folders.
- `Path`: builds and takes apart file paths safely.
- `StreamReader` and `StreamWriter`: read and write line by line.

## Writing a text file

The simplest way is `File.WriteAllText`, which creates the file or overwrites it:

```csharp
File.WriteAllText("notes.txt", "First line\nSecond line");
```

To add to the end instead of replacing:

```csharp
File.AppendAllText("notes.txt", "\nThird line");
```

For a list of lines:

```csharp
string[] lines = { "apple", "banana", "cherry" };
File.WriteAllLines("fruits.txt", lines);
```

## Reading a text file

```csharp
string content = File.ReadAllText("notes.txt");
Console.WriteLine(content);

string[] lines = File.ReadAllLines("fruits.txt");
Console.WriteLine(lines.Length);   // 3

foreach (string line in File.ReadLines("fruits.txt"))
{
    Console.WriteLine(line);
}
```

`ReadAllLines` loads the whole file into memory. `ReadLines` streams one line at a time, which is better for big files.

## Checking before you read

Reading a missing file throws `FileNotFoundException`. Check first, or catch it:

```csharp
if (File.Exists("config.txt"))
{
    string config = File.ReadAllText("config.txt");
}
else
{
    Console.WriteLine("No config found, using defaults");
}
```

## Paths

Never glue paths together with `+` and a slash. Windows uses backslashes and everything else uses forward slashes. `Path.Combine` does the right thing everywhere:

```csharp
string folder = "data";
string file = Path.Combine(folder, "users", "list.txt");
Console.WriteLine(file);   // data\users\list.txt on Windows, data/users/list.txt elsewhere

Console.WriteLine(Path.GetFileName(file));               // list.txt
Console.WriteLine(Path.GetExtension(file));              // .txt
Console.WriteLine(Path.GetFileNameWithoutExtension(file)); // list
Console.WriteLine(Path.GetDirectoryName(file));          // data\users
```

Useful locations:

```csharp
string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
string temp = Path.GetTempPath();
string current = Directory.GetCurrentDirectory();
```

## Directories

```csharp
Directory.CreateDirectory("output/logs");   // creates every missing level, no error if it exists

foreach (string path in Directory.GetFiles("output", "*.txt"))
{
    Console.WriteLine(path);
}

foreach (string dir in Directory.GetDirectories("output"))
{
    Console.WriteLine(dir);
}

bool exists = Directory.Exists("output");
```

`Directory.EnumerateFiles` is the streaming version for large folders, and passing `SearchOption.AllDirectories` searches subfolders too.

## Streams and the using statement

`File.ReadAllText` is convenient, but for large files or when you want control, use a `StreamReader`. A stream holds an operating system **handle**, and you must release it when you are done. The `using` statement does that automatically, even if an exception occurs:

```csharp
using (StreamReader reader = new StreamReader("big.log"))
{
    string? line;
    while ((line = reader.ReadLine()) != null)
    {
        if (line.Contains("ERROR")) Console.WriteLine(line);
    }
}   // reader.Dispose() is called here
```

The modern form without braces disposes at the end of the enclosing block:

```csharp
using StreamWriter writer = new StreamWriter("report.txt");
writer.WriteLine("Report generated " + DateTime.Now);
writer.WriteLine("Status: OK");
```

Forgetting to dispose leaves the file locked until the garbage collector gets round to it, which can be a long time. Always use `using` with streams.

## Copying, moving and deleting

```csharp
File.Copy("a.txt", "b.txt", overwrite: true);
File.Move("b.txt", "archive/b.txt");
File.Delete("a.txt");   // no error if the file does not exist
```

## Handling errors

File operations fail for many reasons: missing file, no permission, disk full, file locked by another program. Catch `IOException` and its subclasses:

```csharp
try
{
    string text = File.ReadAllText("locked.txt");
}
catch (FileNotFoundException)
{
    Console.WriteLine("File not found");
}
catch (UnauthorizedAccessException)
{
    Console.WriteLine("No permission");
}
catch (IOException ex)
{
    Console.WriteLine($"IO problem: {ex.Message}");
}
```

## Saving objects as JSON

Text files are fine for simple data, but real programs save structured objects. `System.Text.Json` turns objects into JSON and back:

```csharp
using System.Text.Json;

record Settings(string Theme, int FontSize);

var settings = new Settings("dark", 14);

string json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
File.WriteAllText("settings.json", json);

var loaded = JsonSerializer.Deserialize<Settings>(File.ReadAllText("settings.json"));
Console.WriteLine(loaded?.Theme);   // dark
```

This is how most apps persist configuration and small data sets.

## Async file access

For apps with a user interface or a web server, blocking on disk is bad. Every method has an async twin:

```csharp
string text = await File.ReadAllTextAsync("notes.txt");
await File.WriteAllTextAsync("copy.txt", text);
```

Async programming is covered in its own topic later.

## Quick recap

- `File.ReadAllText`, `ReadAllLines`, `WriteAllText` and `AppendAllText` cover most simple jobs.
- Check `File.Exists` or catch `FileNotFoundException` before reading.
- Build paths with `Path.Combine`, never with string concatenation.
- `Directory.CreateDirectory` and `GetFiles` manage folders.
- Wrap `StreamReader` and `StreamWriter` in `using` so handles are always released.
- `System.Text.Json` saves and loads objects with a couple of lines.

<code id="code-content" class="language-csharp">
// File handling in C#
using System.Text.Json;
// Build paths safely and create the folder
string folder = Path.Combine(Directory.GetCurrentDirectory(), "output");
Directory.CreateDirectory(folder);
string notes = Path.Combine(folder, "notes.txt");
// Write, append, then read back
File.WriteAllText(notes, "First line");
File.AppendAllText(notes, Environment.NewLine + "Second line");
File.AppendAllText(notes, Environment.NewLine + "ERROR: third line");
foreach (string line in File.ReadLines(notes))
{
    Console.WriteLine(line);
}
// Stream a file with using so the handle is released
using (var reader = new StreamReader(notes))
{
    string? line;
    while ((line = reader.ReadLine()) != null)
    {
        if (line.StartsWith("ERROR")) Console.WriteLine($"Found: {line}");
    }
}
// Write with a StreamWriter (declaration form of using)
string report = Path.Combine(folder, "report.txt");
using (StreamWriter writer = new StreamWriter(report))
{
    writer.WriteLine($"Generated {DateTime.Now:yyyy-MM-dd}");
    writer.WriteLine("Status: OK");
}
// Save and load an object as JSON
record Settings(string Theme, int FontSize);
string settingsPath = Path.Combine(folder, "settings.json");
var settings = new Settings("dark", 14);
File.WriteAllText(settingsPath, JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true }));
var loaded = JsonSerializer.Deserialize&lt;Settings&gt;(File.ReadAllText(settingsPath));
Console.WriteLine($"Theme {loaded?.Theme}, size {loaded?.FontSize}");
// List what we created and handle a missing file
foreach (string path in Directory.GetFiles(folder))
    Console.WriteLine(Path.GetFileName(path));
try
{
    File.ReadAllText(Path.Combine(folder, "missing.txt"));
}
catch (FileNotFoundException)
{
    Console.WriteLine("missing.txt does not exist");
}
</code></pre>
