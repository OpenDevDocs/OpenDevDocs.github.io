---
publishDate: 2026-10-25T20:50
title: 'Saving Data to JSON Files'
slug: saving-data-to-json-files
metadescription: 'Save and load CoinJar expenses as a JSON file in the AppData folder with System.Text.Json, safe writes, and a JsonExpenseStore that replaces the in-memory store.'
updateDate: 2026-10-25T20:50
author: ['bishal-biswas']
level: 2
tags: ['wpf', 'json', 'files', 'mvvm']
course: wpf
---

## Why save to a JSON file

Right now CoinJar forgets everything when you close it. Every expense lives in an `ObservableCollection` in memory, and memory is wiped when the app exits. You need to **persist** the data: write it somewhere that survives a restart.

For a small personal app, a single JSON file is a great first step:

- **JSON** (JavaScript Object Notation) is a plain text format for data. You can open the file in Notepad and read it.
- .NET has a fast JSON library built in, `System.Text.Json`, so there is nothing to install.
- There is no database server to set up.

Here is what CoinJar's file will look like:

```json
[
  {
    "Id": 1,
    "Title": "Coffee",
    "Amount": 3.50,
    "Category": "Food",
    "Date": "2026-10-25T00:00:00+01:00"
  },
  {
    "Id": 2,
    "Title": "Bus ticket",
    "Amount": 2.20,
    "Category": "Transport",
    "Date": "2026-10-25T00:00:00+01:00"
  }
]
```

The `+01:00` at the end of each date is the time zone offset of the PC that saved it, because `DateTime.Today` is a local time. Yours will show your own offset.

When the data grows, or you need searching and reports, a real database is better. That is the next lesson, [SQLite with Entity Framework Core](/courses/wpf/sqlite-with-ef-core). The nice part: CoinJar already hides its storage behind `IExpenseStore`, so each switch only changes one class.

## Serializing and deserializing

**Serializing** means turning objects into text. **Deserializing** means turning the text back into objects. `JsonSerializer` does both:

```csharp
using System.Text.Json;

var expenses = new List<Expense>
{
    new() { Id = 1, Title = "Coffee", Amount = 3.50m, Category = "Food" }
};

string json = JsonSerializer.Serialize(expenses);
List<Expense>? loaded = JsonSerializer.Deserialize<List<Expense>>(json);
```

By default `JsonSerializer` writes every public property with a getter, using the property names as they are. When reading, it needs a parameterless constructor and public setters, which the `Expense` class from the MVVM lessons has. The toolkit's `ObservableObject` base class adds no public properties, so it does not get in the way.

`Deserialize` returns a nullable value, because the JSON text could be the word `null`. Always handle that case, for example with `?? []`.

### Options

`JsonSerializerOptions` controls the format. Create it once and reuse it, because building options is slow the first time:

```csharp
private static readonly JsonSerializerOptions Options = new()
{
    WriteIndented = true   // nice line breaks, easy to read in Notepad
};
```

Other useful options:

```csharp
new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,   // "title" instead of "Title"
    PropertyNameCaseInsensitive = true                   // accept any casing when reading
};
```

You can also control single properties with [attributes](/courses/c-sharp/attributes):

```csharp
[JsonIgnore]                       // do not save this one
public bool IsSelected { get; set; }

[JsonPropertyName("price")]        // use a different name in the file
public decimal Amount { get; set; }
```

## Where to put the file

Do not save next to the `.exe`. When an app is installed under `C:\Program Files`, normal users are not allowed to write there. Windows gives every user a folder for app data instead:

```csharp
string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
string folder = Path.Combine(appData, "CoinJar");
Directory.CreateDirectory(folder);   // does nothing if it already exists

string filePath = Path.Combine(folder, "expenses.json");
// C:\Users\<you>\AppData\Roaming\CoinJar\expenses.json
```

- `ApplicationData` is the **Roaming** folder. In company networks it can follow the user to other PCs.
- `LocalApplicationData` is the **Local** folder, for data that belongs to this PC only, like caches.

Expenses are user data, so Roaming is a good fit. Always use `Path.Combine` rather than gluing strings with `\`, as you saw in [file handling](/courses/c-sharp/file-handling).

## Writing to a stream

`Serialize` builds one big string. For files it is better to write straight into a `FileStream`, which skips the string:

```csharp
// Save
using (FileStream output = File.Create(filePath))
{
    JsonSerializer.Serialize(output, expenses, Options);
}

// Load
using (FileStream input = File.OpenRead(filePath))
{
    List<Expense>? loaded = JsonSerializer.Deserialize<List<Expense>>(input, Options);
}
```

`using` makes sure the file is closed, even if an error happens.

### What about async?

From [Async, Await and a Responsive UI](/courses/wpf/async-await-and-a-responsive-ui) you know that slow work should not block the UI thread. Every method above has an async twin:

```csharp
await using FileStream output = File.Create(filePath);
await JsonSerializer.SerializeAsync(output, expenses, Options);
```

CoinJar's `IExpenseStore` from [Dependency Injection with the Generic Host](/courses/wpf/dependency-injection-with-the-generic-host) has plain methods (`GetAll`, `Add`, `Remove`), and the view models already call them. A file of a few hundred expenses is a few kilobytes and reads or writes in a millisecond or two, so the store in this lesson keeps those simple synchronous methods. If your files grow large or live on a slow network drive, add async methods such as `Task SaveAsync()` to the interface and await them from async commands.

## Saving safely

What if the app crashes, or the laptop battery dies, halfway through writing? `File.Create` empties the file first, so you could be left with half a file and lose everything.

The fix is a classic: write to a **temporary file**, then swap it in.

```csharp
string tempPath = filePath + ".tmp";

using (FileStream stream = File.Create(tempPath))
{
    JsonSerializer.Serialize(stream, expenses, Options);
}

// Only now replace the real file. A move on the same drive is quick.
File.Move(tempPath, filePath, overwrite: true);
```

If anything fails while writing, the old `expenses.json` is still there, untouched. Notice the braces around the `using` block: the stream must be closed before the file can be moved.

## Handling missing and broken files

Two situations are normal and should not crash the app:

1. **First run.** The file does not exist yet. Start with an empty list.
2. **Broken file.** Someone edited it by hand and made a typo. `Deserialize` throws a `JsonException`.

```csharp
if (!File.Exists(filePath))
{
    return [];
}

try
{
    using FileStream stream = File.OpenRead(filePath);
    return JsonSerializer.Deserialize<List<Expense>>(stream, Options) ?? [];
}
catch (JsonException)
{
    // Keep a copy for the user, then start fresh
    File.Copy(filePath, filePath + ".broken", overwrite: true);
    return [];
}
```

Keeping a copy means the user's data is never silently thrown away. You will learn to log errors like this in [Error Handling and Logging](/courses/wpf/error-handling-and-logging).

## A JSON store that replaces the in-memory one

Here is the payoff of the [interface](/courses/c-sharp/interfaces) you wrote in the DI lesson. CoinJar's view models talk to `IExpenseStore`:

```csharp
public interface IExpenseStore
{
    IReadOnlyList<Expense> GetAll();
    void Add(Expense expense);
    void Remove(Expense expense);
}
```

`InMemoryExpenseStore` kept a list that vanished on exit. The new `JsonExpenseStore` implements the **same interface**:

- In its constructor it loads the file into a list.
- `GetAll` returns that list.
- `Add` and `Remove` change the list, then save the file.

```csharp
public void Add(Expense expense)
{
    _items.Add(expense);
    Watch(expense);
    Save();
}
```

### Saving edits too

What about edits? The edit dialog from [Dialogs and Message Boxes](/courses/wpf/dialogs-and-message-boxes) changes the properties of an existing `Expense` and never calls the store. But `Expense` is an `ObservableObject`, so it raises `PropertyChanged` on every change. The store simply listens:

```csharp
private void Watch(Expense expense) => expense.PropertyChanged += OnExpenseChanged;

private void OnExpenseChanged(object? sender, PropertyChangedEventArgs e) => Save();
```

Now adding, deleting and editing all reach the disk. The full class is in the code panel.

### Swap it in the host

Change one line in `App.xaml.cs`:

```csharp
// before
builder.Services.AddSingleton<IExpenseStore, InMemoryExpenseStore>();

// after
builder.Services.AddSingleton<IExpenseStore, JsonExpenseStore>();
```

`ExpenseListViewModel` does not change at all. It still calls `_store.GetAll()` in its constructor and `_store.Add(expense)` in its `Add` command, but now the data survives a restart. One instance for the whole app is right, because there is one file.

## Tip: faster JSON with source generation

`System.Text.Json` normally uses reflection to discover your properties at runtime. A **source generator** can write that code at build time instead, which starts faster and works with trimming. You declare which types you need:

```csharp
using System.Text.Json.Serialization;

[JsonSourceGenerationOptions(WriteIndented = true)]
[JsonSerializable(typeof(List<Expense>))]
internal partial class CoinJarJsonContext : JsonSerializerContext
{
}
```

Then pass the generated type info instead of options:

```csharp
JsonSerializer.Serialize(stream, _items, CoinJarJsonContext.Default.ListExpense);
```

This is optional for a small desktop app. Read more about the idea in [source generators](/courses/c-sharp/source-generators).

## Common mistakes

- **Saving next to the exe.** It fails once the app is installed in Program Files. Use AppData.
- **Not creating the folder.** `File.Create` throws if `AppData\CoinJar` does not exist. Call `Directory.CreateDirectory` first.
- **Writing directly over the real file.** A crash mid write corrupts it. Write to a temp file and move it.
- **Crashing on first run.** Check `File.Exists` and start with an empty list.
- **Forgetting edits.** If only `Add` and `Remove` save, changes from the edit dialog are lost. Listen to `PropertyChanged`.
- **Saving UI only state.** Mark things like `IsSelected` with `[JsonIgnore]`.

## Quick recap

- `System.Text.Json` turns objects into JSON text and back with `JsonSerializer.Serialize` and `Deserialize`, and can write straight to a `FileStream`. Async versions exist for big or slow files.
- Reuse one `JsonSerializerOptions`. `WriteIndented`, naming policies and attributes like `[JsonIgnore]` shape the file.
- Store user data under `Environment.SpecialFolder.ApplicationData`, in a folder named after your app.
- Write to a temp file and `File.Move` it over the real one so a crash never corrupts data.
- Treat a missing file as "no data yet" and keep a copy of a broken file instead of deleting it.
- `JsonExpenseStore` implements the same `IExpenseStore` as the in-memory version, so swapping it in is one line in the host.

<code id="code-content" class="language-csharp">
// Services/JsonExpenseStore.cs
using System.ComponentModel;
using System.IO;
using System.Text.Json;
using CoinJar.Models;
namespace CoinJar.Services;
// Replaces InMemoryExpenseStore. Same interface, but the data is kept in
// %AppData%\CoinJar\expenses.json and survives a restart.
public sealed class JsonExpenseStore : IExpenseStore
{
    // Create options once and reuse them.
    private static readonly JsonSerializerOptions Options = new()
    {
        WriteIndented = true
    };
    private readonly string _filePath;
    private readonly List&lt;Expense&gt; _items;
    public JsonExpenseStore()
    {
        string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        string folder = Path.Combine(appData, "CoinJar");
        Directory.CreateDirectory(folder);           // no error if it exists
        _filePath = Path.Combine(folder, "expenses.json");
        _items = Load();
        foreach (Expense expense in _items)
        {
            Watch(expense);
        }
    }
    public IReadOnlyList&lt;Expense&gt; GetAll() =&gt; _items;
    public void Add(Expense expense)
    {
        _items.Add(expense);
        Watch(expense);
        Save();
    }
    public void Remove(Expense expense)
    {
        if (_items.Remove(expense))
        {
            expense.PropertyChanged -= OnExpenseChanged;
            Save();
        }
    }
    // Edits (for example from the edit dialog) raise PropertyChanged.
    private void Watch(Expense expense) =&gt; expense.PropertyChanged += OnExpenseChanged;
    private void OnExpenseChanged(object? sender, PropertyChangedEventArgs e) =&gt; Save();
    private List&lt;Expense&gt; Load()
    {
        // First run: nothing saved yet.
        if (!File.Exists(_filePath))
        {
            return [];
        }
        try
        {
            using FileStream stream = File.OpenRead(_filePath);
            return JsonSerializer.Deserialize&lt;List&lt;Expense&gt;&gt;(stream, Options) ?? [];
        }
        catch (JsonException)
        {
            // The file is broken. Keep a copy so no data is lost, then start empty.
            File.Copy(_filePath, _filePath + ".broken", overwrite: true);
            return [];
        }
    }
    private void Save()
    {
        string tempPath = _filePath + ".tmp";
        // 1. Write everything to a temporary file.
        using (FileStream stream = File.Create(tempPath))
        {
            JsonSerializer.Serialize(stream, _items, Options);
        }
        // 2. Swap it in. If step 1 failed, the old file is untouched.
        File.Move(tempPath, _filePath, overwrite: true);
    }
}
// Services/IExpenseStore.cs  (unchanged from the DI lesson)
using CoinJar.Models;
namespace CoinJar.Services;
public interface IExpenseStore
{
    IReadOnlyList&lt;Expense&gt; GetAll();
    void Add(Expense expense);
    void Remove(Expense expense);
}
// Models/Expense.cs  (unchanged)
using CommunityToolkit.Mvvm.ComponentModel;
namespace CoinJar.Models;
// Public properties with getters and setters, so System.Text.Json can
// write and read them. ObservableObject adds no public properties.
public partial class Expense : ObservableObject
{
    public int Id { get; set; }
    [ObservableProperty]
    public partial string Title { get; set; } = "";
    [ObservableProperty]
    public partial decimal Amount { get; set; }
    [ObservableProperty]
    public partial string Category { get; set; } = "Other";
    [ObservableProperty]
    public partial DateTime Date { get; set; } = DateTime.Today;
}
// In App.xaml.cs, swap one registration:
// builder.Services.AddSingleton&lt;IExpenseStore, JsonExpenseStore&gt;();
</code></pre>
