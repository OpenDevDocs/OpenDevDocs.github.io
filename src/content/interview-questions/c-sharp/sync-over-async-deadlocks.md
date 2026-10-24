---
course: c-sharp
slug: sync-over-async-deadlocks
experienceLevel: mid
difficulty: hard
tags:
  - async
question: "Why can calling `.Result` or `.Wait()` on a task cause a deadlock, and how does `ConfigureAwait(false)` help?"
answer: |
  When you `await` an incomplete task, the method captures the current **`SynchronizationContext`**, if there is one, and later schedules its continuation back onto it. UI frameworks and legacy ASP.NET install a context that allows only one thread to run that code at a time.

  The deadlock recipe:

  1. Code on the UI thread calls `GetDataAsync().Result`, blocking that thread.
  2. Inside `GetDataAsync`, an `await` completes, and its continuation needs the UI thread to resume.
  3. The UI thread is waiting for the task, and the task is waiting for the UI thread.

  The fixes:

  - **Go async all the way:** make the caller `async` and `await` the task.
  - In **library code**, use `ConfigureAwait(false)` on awaits. Continuations then run on the thread pool instead of the captured context, which avoids the deadlock. It must be on every await in the chain, so it's a safeguard, not a cure.

  ASP.NET Core has no `SynchronizationContext`, so this exact deadlock doesn't happen there, but blocking still causes thread pool starvation under load. And `GetAwaiter().GetResult()` isn't a fix: it only changes how exceptions are wrapped.
codeExample: |
  // WinForms/WPF button handler: DEADLOCK
  private void LoadButton_Click(object sender, EventArgs e)
  {
      string data = GetDataAsync().Result;  // blocks the UI thread...
      label.Text = data;
  }

  async Task<string> GetDataAsync()
  {
      await Task.Delay(1000);               // ...the continuation needs the UI thread
      return "done";
  }

  // Fix 1 (best): async all the way
  private async void LoadButtonFixed_Click(object sender, EventArgs e)
  {
      label.Text = await GetDataAsync();    // no blocking, no deadlock
  }

  // Fix 2 (library code): don't capture the context
  async Task<string> GetDataLibraryAsync()
  {
      await Task.Delay(1000).ConfigureAwait(false); // resumes on the thread pool
      return "done";
  }
popularity: 8.6
isPublished: true
---
