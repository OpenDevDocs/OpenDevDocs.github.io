---
course: c-sharp
slug: assemblyloadcontext-plugins
experienceLevel: senior
difficulty: hard
tags:
  - clr
  - reflection
question: "How does `AssemblyLoadContext` support plugin loading and unloading in .NET?"
answer: |
  In .NET Core and later there's a single AppDomain per process, so **`AssemblyLoadContext` (ALC)** is the isolation mechanism for loading code. Every assembly belongs to an ALC: your app runs in `AssemblyLoadContext.Default`, and you can create additional contexts for plugins.

  A custom ALC gives you:

  - **Isolation of dependencies:** a plugin can load its own version of a library without conflicting with the host's copy.
  - **Control over resolution:** override `Load(AssemblyName)` to decide where each dependency comes from. `AssemblyDependencyResolver` reads the plugin's `.deps.json` to find its private dependencies and native libraries.
  - **Unloading:** create the context with `isCollectible: true`, then call `Unload()`.

  The key design rule is to load **shared contract assemblies** only in the default context. If a plugin loads its own copy of the contract, its `IPlugin` is a different type from the host's, and casts fail.

  Unloading is **cooperative**. `Unload()` only starts the process, and the memory is freed once **nothing references** any type from the context: no live objects, delegates, event subscriptions, static caches, or running threads. To verify, keep a `WeakReference` to the context and check it after forcing a GC.
codeExample: |
  using System.Reflection;
  using System.Runtime.Loader;
  var weakContext = LoadAndRunPlugin("plugins/Greeter/Greeter.dll");
  for (int i = 0; weakContext.IsAlive && i < 10; i++)
      GC.Collect();   // unloading completes only when nothing references the context
  Console.WriteLine(weakContext.IsAlive ? "Leaked" : "Unloaded");

  static WeakReference LoadAndRunPlugin(string path)
  {
      var context = new PluginLoadContext(Path.GetFullPath(path));
      Assembly assembly = context.LoadFromAssemblyPath(Path.GetFullPath(path));
      // IPlugin lives in a shared contract assembly loaded by the default context:
      // var plugin = (IPlugin)Activator.CreateInstance(assembly.GetType("Greeter")!)!;
      context.Unload();                          // starts unloading
      return new WeakReference(context);
  }

  class PluginLoadContext(string pluginPath) : AssemblyLoadContext(isCollectible: true)
  {
      private readonly AssemblyDependencyResolver _resolver = new(pluginPath);
      protected override Assembly? Load(AssemblyName name) =>
          _resolver.ResolveAssemblyToPath(name) is { } path
              ? LoadFromAssemblyPath(path)
              : null;   // null: fall back to the default context (shared contracts)
  }
popularity: 6.8
isPublished: true
---
