---
course: c-sharp
slug: exception-handling-best-practices
experienceLevel: mid
difficulty: medium
tags:
  - exceptions
question: "What are the best practices for exception handling in C#?"
answer: |
  Key practices:

  - **Catch specific exceptions** you can actually handle, such as `FileNotFoundException`, rather than a blanket `catch (Exception)` in business code.
  - **Don't swallow exceptions.** An empty `catch` hides bugs. Either handle the error, add context and rethrow, or let it propagate.
  - **Rethrow with `throw;`**, never `throw ex;`, to keep the original stack trace. When wrapping, pass the original as the `InnerException`.
  - **Use exception filters**, as in `catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.NotFound)`, to catch only the matching cases without unwinding the stack for the others.
  - **Don't use exceptions for control flow.** For expected failures, use the Try-pattern (`int.TryParse`, `TryGetValue`) or return a result.
  - **Validate early** with guard clauses such as `ArgumentNullException.ThrowIfNull(order)` and `ArgumentOutOfRangeException.ThrowIfNegative(qty)`.
  - **Clean up** with `using` or `finally`, not by catching.
  - **Log once, at the boundary.** Let exceptions bubble up to a global handler, such as ASP.NET Core's exception-handling middleware, that logs them and returns a proper error response.
codeExample: |
  public async Task<Order?> GetOrderAsync(int id, CancellationToken ct)
  {
      ArgumentOutOfRangeException.ThrowIfNegativeOrZero(id);    // guard clause

      try
      {
          return await _http.GetFromJsonAsync<Order>($"orders/{id}", ct);
      }
      catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
      {
          return null;                        // expected case: handled, not rethrown
      }
      catch (HttpRequestException ex)
      {
          // add context and keep the original as the InnerException
          throw new OrderServiceException($"Failed to load order {id}", ex);
      }
      // No catch (Exception): unexpected errors reach the global handler
  }

  // Program.cs: one place that logs and turns exceptions into responses
  // app.UseExceptionHandler();

  // Don't: catch (Exception) { }              -> swallows every bug
  // Don't: catch (Exception ex) { throw ex; } -> loses the stack trace
popularity: 8.4
isPublished: true
---
