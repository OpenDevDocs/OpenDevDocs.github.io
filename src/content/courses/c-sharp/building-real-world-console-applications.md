---
publishDate: 2026-04-30T11:54
title: Building Real-World Console Applications
slug: building-real-world-console-applications
metadescription: Bring the whole course together by building a task manager console app with a clean project structure, System.CommandLine parsing, dependency injection, JSON persistence, logging, configuration, tests and a published single file executable.
updateDate: 2026-09-05T11:54
author: ['bishal-biswas']
level: 4
tags: ['project', 'console', 'architecture']
course: c-sharp
---

## From examples to an application

Every topic so far has been a focused example. A real application is where they meet: a clear structure, dependencies injected rather than created, data that survives restarts, errors that are handled rather than crash, and a way to ship it to someone else's machine.

This topic builds a **task manager** you run from the terminal:

```bash
tasks add "Write the C# course" --due 2026-09-30
tasks list --pending
tasks done 3
```

It is small enough to finish and complete enough to show how the pieces fit.

## Project layout

One solution, three projects:

```
Tasks/
  Tasks.sln
  src/
    Tasks.Core/          class library: models, interfaces, services
    Tasks.Cli/           console app: commands, wiring, output
  tests/
    Tasks.Core.Tests/    xUnit tests for the core
```

```bash
dotnet new sln -n Tasks
dotnet new classlib -n Tasks.Core -o src/Tasks.Core
dotnet new console -n Tasks.Cli -o src/Tasks.Cli
dotnet new xunit -n Tasks.Core.Tests -o tests/Tasks.Core.Tests
dotnet sln add src/Tasks.Core src/Tasks.Cli tests/Tasks.Core.Tests
dotnet add src/Tasks.Cli reference src/Tasks.Core
dotnet add tests/Tasks.Core.Tests reference src/Tasks.Core
```

The core knows nothing about the console. That separation is what makes it testable, and it means the same core could later sit behind a web API without changes.

## The model

Records for data, an enum for state:

```csharp
namespace Tasks.Core;

public enum TaskStatus { Pending, Done }

public record TaskItem(int Id, string Title, DateOnly? Due, TaskStatus Status)
{
    public bool IsOverdue(DateOnly today) => Status == TaskStatus.Pending && Due is { } d && d < today;
}
```

## The repository interface

Persistence behind an interface, so the CLI does not care whether tasks live in JSON, SQLite or memory:

```csharp
public interface ITaskRepository
{
    Task<IReadOnlyList<TaskItem>> LoadAsync(CancellationToken ct = default);
    Task SaveAsync(IReadOnlyList<TaskItem> tasks, CancellationToken ct = default);
}
```

A JSON implementation using everything from the file handling topic:

```csharp
public class JsonTaskRepository : ITaskRepository
{
    private readonly string path;
    private static readonly JsonSerializerOptions Options = new() { WriteIndented = true };

    public JsonTaskRepository(string path) => this.path = path;

    public async Task<IReadOnlyList<TaskItem>> LoadAsync(CancellationToken ct = default)
    {
        if (!File.Exists(path)) return Array.Empty<TaskItem>();
        await using var stream = File.OpenRead(path);
        return await JsonSerializer.DeserializeAsync<List<TaskItem>>(stream, Options, ct) ?? new();
    }

    public async Task SaveAsync(IReadOnlyList<TaskItem> tasks, CancellationToken ct = default)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var stream = File.Create(path);
        await JsonSerializer.SerializeAsync(stream, tasks, Options, ct);
    }
}
```

## The service

Business rules live here and nowhere else:

```csharp
public class TaskService
{
    private readonly ITaskRepository repo;
    private readonly TimeProvider clock;

    public TaskService(ITaskRepository repo, TimeProvider clock) => (this.repo, this.clock) = (repo, clock);

    public async Task<TaskItem> AddAsync(string title, DateOnly? due, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Title is required", nameof(title));

        var tasks = (await repo.LoadAsync(ct)).ToList();
        int nextId = tasks.Count == 0 ? 1 : tasks.Max(t => t.Id) + 1;
        var item = new TaskItem(nextId, title.Trim(), due, TaskStatus.Pending);
        tasks.Add(item);
        await repo.SaveAsync(tasks, ct);
        return item;
    }

    public async Task<IReadOnlyList<TaskItem>> ListAsync(bool pendingOnly, CancellationToken ct = default)
    {
        var tasks = await repo.LoadAsync(ct);
        return tasks
            .Where(t => !pendingOnly || t.Status == TaskStatus.Pending)
            .OrderBy(t => t.Due ?? DateOnly.MaxValue)
            .ThenBy(t => t.Id)
            .ToList();
    }

    public async Task<bool> CompleteAsync(int id, CancellationToken ct = default)
    {
        var tasks = (await repo.LoadAsync(ct)).ToList();
        int index = tasks.FindIndex(t => t.Id == id);
        if (index < 0) return false;

        tasks[index] = tasks[index] with { Status = TaskStatus.Done };
        await repo.SaveAsync(tasks, ct);
        return true;
    }

    public DateOnly Today => DateOnly.FromDateTime(clock.GetLocalNow().DateTime);
}
```

`TimeProvider` is injected so tests can freeze the clock. The `with` expression on the record replaces mutation.

## Testing the core

Because the repository is an interface, tests need no disk:

```csharp
public class InMemoryRepository : ITaskRepository
{
    public List<TaskItem> Items = new();
    public Task<IReadOnlyList<TaskItem>> LoadAsync(CancellationToken ct = default) => Task.FromResult<IReadOnlyList<TaskItem>>(Items.ToList());
    public Task SaveAsync(IReadOnlyList<TaskItem> tasks, CancellationToken ct = default) { Items = tasks.ToList(); return Task.CompletedTask; }
}

public class TaskServiceTests
{
    [Fact]
    public async Task Add_assigns_incrementing_ids()
    {
        var service = new TaskService(new InMemoryRepository(), TimeProvider.System);

        var first = await service.AddAsync("one", null);
        var second = await service.AddAsync("two", null);

        Assert.Equal(1, first.Id);
        Assert.Equal(2, second.Id);
    }

    [Fact]
    public async Task Complete_returns_false_for_unknown_id()
    {
        var service = new TaskService(new InMemoryRepository(), TimeProvider.System);
        Assert.False(await service.CompleteAsync(42));
    }
}
```

```bash
dotnet test
```

## Command line parsing

Hand parsing `args` works for one flag and falls apart at three. `System.CommandLine` gives you subcommands, options, validation and help for free:

```bash
dotnet add src/Tasks.Cli package System.CommandLine --prerelease
```

```csharp
var root = new RootCommand("A tiny task manager");

var addCommand = new Command("add", "Add a task");
var titleArg = new Argument<string>("title");
var dueOption = new Option<DateOnly?>("--due", "Due date, e.g. 2026-09-30");
addCommand.AddArgument(titleArg);
addCommand.AddOption(dueOption);
addCommand.SetHandler(async (title, due) =>
{
    var item = await service.AddAsync(title, due);
    Console.WriteLine($"Added #{item.Id}: {item.Title}");
}, titleArg, dueOption);

var listCommand = new Command("list", "List tasks");
var pendingOption = new Option<bool>("--pending", "Only pending tasks");
listCommand.AddOption(pendingOption);
listCommand.SetHandler(async pending =>
{
    foreach (var t in await service.ListAsync(pending))
    {
        string mark = t.Status == TaskStatus.Done ? "x" : t.IsOverdue(service.Today) ? "!" : " ";
        Console.WriteLine($"[{mark}] #{t.Id,-3} {t.Title,-30} {t.Due?.ToString("yyyy-MM-dd") ?? ""}");
    }
}, pendingOption);

var doneCommand = new Command("done", "Mark a task as done");
var idArg = new Argument<int>("id");
doneCommand.AddArgument(idArg);
doneCommand.SetHandler(async id =>
{
    Console.WriteLine(await service.CompleteAsync(id) ? $"Completed #{id}" : $"No task #{id}");
}, idArg);

root.AddCommand(addCommand);
root.AddCommand(listCommand);
root.AddCommand(doneCommand);

return await root.InvokeAsync(args);
```

`tasks --help` and `tasks add --help` now work without any code of yours.

## Wiring with dependency injection and configuration

The composition root in `Program.cs` chooses concrete types and reads settings:

```csharp
var config = new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: true)
    .AddEnvironmentVariables(prefix: "TASKS_")
    .Build();

string dataPath = config["DataPath"]
    ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "tasks", "tasks.json");

var services = new ServiceCollection();
services.AddLogging(b => b.AddSimpleConsole().SetMinimumLevel(LogLevel.Warning));
services.AddSingleton(TimeProvider.System);
services.AddSingleton<ITaskRepository>(new JsonTaskRepository(dataPath));
services.AddSingleton<TaskService>();

await using var provider = services.BuildServiceProvider();
var service = provider.GetRequiredService<TaskService>();
```

Setting `TASKS_DataPath` in the environment redirects storage without touching code. That is configuration done properly.

## Handling errors at the edge

Exceptions from the core should become messages and exit codes, not stack traces. Wrap the invocation once:

```csharp
try
{
    return await root.InvokeAsync(args);
}
catch (ArgumentException ex)
{
    Console.Error.WriteLine($"error: {ex.Message}");
    return 2;
}
catch (IOException ex)
{
    Console.Error.WriteLine($"error: could not access data file ({ex.Message})");
    return 3;
}
```

Non zero exit codes let shell scripts detect failure. Write errors to `Console.Error` so they do not pollute output that might be piped.

## Cancellation

Long running commands should stop cleanly on Ctrl+C:

```csharp
using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };
```

Pass `cts.Token` into the service calls. The cooperative model from the async topic does the rest.

## Publishing

Ship a single file that runs without .NET installed:

```bash
dotnet publish src/Tasks.Cli -c Release -r win-x64 --self-contained \
    -p:PublishSingleFile=true -p:PublishTrimmed=true -o publish
```

Swap `win-x64` for `linux-x64` or `osx-arm64`. For the fastest startup, add `-p:PublishAot=true`, which compiles ahead of time to native code. AOT is why the course kept pointing towards source generators over reflection: `System.Text.Json` needs a `JsonSerializerContext` to be trim safe, and `System.CommandLine` is AOT compatible.

Rename the output to `tasks`, put it on your `PATH`, and you have a real tool.

## What you built

Looking back at the pieces:

- Records, enums and `with` for the model.
- Interfaces and dependency injection to keep the core independent and testable.
- Async file I/O and JSON serialisation for persistence.
- LINQ for querying and ordering.
- Exceptions handled at the boundary with exit codes.
- Configuration from files and environment.
- A parsed command line with generated help.
- Unit tests that run in milliseconds with no disk.
- A published, trimmed executable.

Every one of those was a topic in this course. That is the point of the project: the language features are not the goal. Building things people can use is.

## Where to go next

- **ASP.NET Core** to put the same core behind an HTTP API.
- **Entity Framework Core** to swap the JSON repository for a database with one new class.
- **Spectre.Console** for tables, colours and progress bars in the terminal.
- **GitHub Actions** to run `dotnet test` and `dotnet publish` on every push.

## Quick recap

- Split a real application into a core library, a thin front end and a test project.
- Model with records, hide persistence behind an interface, put rules in a service.
- Use `System.CommandLine` for parsing, the DI container for wiring, and configuration for paths and settings.
- Turn exceptions into messages and exit codes at the edge, and support Ctrl+C.
- Test the core with in memory fakes, no disk or console required.
- Publish a self contained single file, optionally AOT, and ship it.

<code id="code-content" class="language-csharp">
// Tasks.Cli/Program.cs - the composition root of a real console app
// dotnet add package System.CommandLine --prerelease
// dotnet add package Microsoft.Extensions.DependencyInjection
// dotnet add package Microsoft.Extensions.Configuration.Json
// dotnet add package Microsoft.Extensions.Configuration.EnvironmentVariables
using System.CommandLine;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Tasks.Core;
// 1. Configuration: file first, environment variables override
var config = new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: true)
    .AddEnvironmentVariables(prefix: "TASKS_")
    .Build();
string dataPath = config["DataPath"]
    ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "tasks", "tasks.json");
// 2. Dependency injection: concrete types chosen in exactly one place
var services = new ServiceCollection();
services.AddSingleton(TimeProvider.System);
services.AddSingleton&lt;ITaskRepository&gt;(new JsonTaskRepository(dataPath));
services.AddSingleton&lt;TaskService&gt;();
await using var provider = services.BuildServiceProvider();
var service = provider.GetRequiredService&lt;TaskService&gt;();
// 3. Cancellation: Ctrl+C stops work cleanly
using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =&gt; { e.Cancel = true; cts.Cancel(); };
// 4. Commands: System.CommandLine gives parsing, validation and --help
var root = new RootCommand("A tiny task manager");
var add = new Command("add", "Add a task");
var titleArg = new Argument&lt;string&gt;("title");
var dueOpt = new Option&lt;DateOnly?&gt;("--due", "Due date, e.g. 2026-09-30");
add.AddArgument(titleArg);
add.AddOption(dueOpt);
add.SetHandler(async (title, due) =&gt;
{
    var item = await service.AddAsync(title, due, cts.Token);
    Console.WriteLine($"Added #{item.Id}: {item.Title}");
}, titleArg, dueOpt);
var list = new Command("list", "List tasks");
var pendingOpt = new Option&lt;bool&gt;("--pending", "Only pending tasks");
list.AddOption(pendingOpt);
list.SetHandler(async pending =&gt;
{
    foreach (var t in await service.ListAsync(pending, cts.Token))
    {
        string mark = t.Status == TaskStatus.Done ? "x" : t.IsOverdue(service.Today) ? "!" : " ";
        Console.WriteLine($"[{mark}] #{t.Id,-3} {t.Title,-30} {t.Due?.ToString("yyyy-MM-dd") ?? ""}");
    }
}, pendingOpt);
var done = new Command("done", "Mark a task as done");
var idArg = new Argument&lt;int&gt;("id");
done.AddArgument(idArg);
done.SetHandler(async id =&gt;
    Console.WriteLine(await service.CompleteAsync(id, cts.Token) ? $"Completed #{id}" : $"No task #{id}"), idArg);
root.AddCommand(add);
root.AddCommand(list);
root.AddCommand(done);
// 5. Errors become messages and exit codes at the edge, never stack traces
try
{
    return await root.InvokeAsync(args);
}
catch (ArgumentException ex)
{
    Console.Error.WriteLine($"error: {ex.Message}");
    return 2;
}
catch (IOException ex)
{
    Console.Error.WriteLine($"error: could not access data file ({ex.Message})");
    return 3;
}
// Publish a single self contained executable:
// dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -p:PublishTrimmed=true
</code></pre>
