---
publishDate: 2026-08-26T14:30
title: AJAX Requests with Fetch
slug: ajax-requests-with-fetch
metadescription: Update parts of a page without a full reload by calling MVC actions from JavaScript with fetch, return JSON or partial view HTML, send form data and JSON bodies, include the anti forgery token, and handle errors cleanly.
updateDate: 2026-09-14T14:30
author: ['bishal-biswas']
level: 2
tags: ['ajax', 'fetch', 'javascript']
course: dotnet-mvc
---

## Updating a page without reloading it

Clicking "Add to cart" should update the cart count in the header, not reload the whole page. Typing in a search box should filter results as you type. Choosing a country should fill the city dropdown.

These are **AJAX** interactions: JavaScript sends a request in the background, the server answers with a small piece of data or HTML, and the script updates part of the page. In modern browsers the tool for this is `fetch`. On the MVC side, nothing new is needed. An action is an action, whether the browser or a script called it.

## Returning JSON from an action

```csharp
public class CartController : Controller
{
    [HttpPost]
    public IActionResult Add(int productId, int quantity)
    {
        var cart = _cart.Get();
        cart.Add(productId, quantity);
        _cart.Save(cart);

        return Json(new { count = cart.ItemCount, total = cart.Total });
    }
}
```

`Json()` serialises the object and sets the content type to `application/json`. Anonymous objects work well for small responses. Property names come out in camelCase by default, so `ItemCount` becomes `count` here because the anonymous object already used lowercase.

## Calling it with fetch

```javascript
async function addToCart(productId) {
    const formData = new FormData();
    formData.append("productId", productId);
    formData.append("quantity", 1);
    formData.append("__RequestVerificationToken", getToken());

    const response = await fetch("/Cart/Add", {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        throw new Error("Request failed: " + response.status);
    }

    const data = await response.json();
    document.getElementById("cart-count").textContent = data.count;
}
```

Sending `FormData` looks like a normal form post to the server. Model binding fills `productId` and `quantity` just as it would from a `<form>`. The anti forgery token goes in as a field with the standard name.

`fetch` does not throw for a 400 or 500 response. It only throws when the request could not be sent at all. Always check `response.ok`.

## Sending JSON instead

For richer data, send a JSON body and bind with `[FromBody]`:

```javascript
const response = await fetch("/Cart/Update", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "RequestVerificationToken": getToken()
    },
    body: JSON.stringify({ lines: [{ productId: 5, quantity: 2 }, { productId: 9, quantity: 1 }] })
});
```

```csharp
public record CartUpdate(List<CartLineDto> Lines);
public record CartLineDto(int ProductId, int Quantity);

[HttpPost]
public IActionResult Update([FromBody] CartUpdate update)
{
    // ...
    return Json(new { ok = true });
}
```

With JSON, the token cannot be a form field, so it goes in the header. The anti forgery topic explains the setup.

## Returning HTML from a partial view

Sometimes it is simpler to let the server render the HTML and let the script drop it in. Return a partial view:

```csharp
public async Task<IActionResult> Results(string? term)
{
    var products = await _db.Products
        .Where(p => term == null || p.Name.Contains(term))
        .Take(20)
        .ToListAsync();

    return PartialView("_ProductList", products);
}
```

```javascript
const input = document.getElementById("search");
const results = document.getElementById("results");

input.addEventListener("input", async () => {
    const response = await fetch("/Products/Results?term=" + encodeURIComponent(input.value));
    results.innerHTML = await response.text();
});
```

The `_ProductList` partial is the same one the full page uses. The server owns the HTML, and the JavaScript is two lines. This approach is underrated and keeps rendering logic in one place.

Add a small delay (debounce) so you do not send a request for every keystroke.

## Cascading dropdowns

The dropdowns topic promised this one. The action returns JSON, the script rebuilds the second select:

```csharp
public async Task<IActionResult> Cities(int countryId)
{
    var cities = await _db.Cities
        .Where(c => c.CountryId == countryId)
        .OrderBy(c => c.Name)
        .Select(c => new { c.Id, c.Name })
        .ToListAsync();

    return Json(cities);
}
```

```javascript
country.addEventListener("change", async () => {
    const response = await fetch("/Locations/Cities?countryId=" + country.value);
    const cities = await response.json();

    city.innerHTML = '<option value="">Choose a city</option>';
    for (const c of cities) {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = c.name;
        city.appendChild(option);
    }
});
```

## Status codes and errors

Let the action speak HTTP. Return `NotFound()`, `BadRequest()` or `StatusCode(500)` when things go wrong, with a JSON body if the script needs detail:

```csharp
if (product is null)
{
    return NotFound(new { error = "Product not found" });
}

if (!ModelState.IsValid)
{
    return BadRequest(ModelState);
}
```

`BadRequest(ModelState)` sends the validation errors as JSON keyed by property name, which a script can show next to fields.

On the client, check status and read the body:

```javascript
if (response.status === 400) {
    const errors = await response.json();
    showErrors(errors);
    return;
}
```

## Detecting AJAX on the server

Sometimes one action should return a full page for a normal request and a partial for an AJAX one. There is no official flag, but a header is the convention:

```javascript
headers: { "X-Requested-With": "XMLHttpRequest" }
```

```csharp
var isAjax = Request.Headers["X-Requested-With"] == "XMLHttpRequest";
return isAjax ? PartialView("_List", items) : View(items);
```

## Where the script lives

Put page scripts in `wwwroot/js` and include them in the `Scripts` section of the view. Generate any URLs the script needs on the server so routes can change without breaking JavaScript:

```cshtml
@section Scripts {
    <script>
        const urls = { addToCart: "@Url.Action("Add", "Cart")" };
    </script>
    <script src="~/js/cart.js" asp-append-version="true"></script>
}
```

## Quick recap

- `fetch` sends background requests, and MVC actions answer them like any other request.
- Return `Json()` for data or `PartialView()` for server rendered HTML.
- Send `FormData` for form style posts or a JSON body with `[FromBody]` for structured data.
- Always include the anti forgery token, as a field or a header, and always check `response.ok`.
- Use proper status codes and `BadRequest(ModelState)` so scripts can show errors.
- Generate URLs on the server with `Url.Action` and pass them to scripts.

<code id="code-content" class="language-csharp">
// Controllers/CartController.cs
public class CartController : Controller
{
    private readonly ICartService _cart;
    private readonly AppDbContext _db;

    public CartController(ICartService cart, AppDbContext db)
    {
        _cart = cart;
        _db = db;
    }

    // Form style post from FormData
    [HttpPost]
    public async Task&lt;IActionResult&gt; Add(int productId, int quantity = 1)
    {
        var product = await _db.Products.FindAsync(productId);
        if (product is null) return NotFound(new { error = "Product not found" });
        if (quantity &lt; 1 || quantity &gt; 99) return BadRequest(new { error = "Quantity must be 1 to 99" });

        var cart = _cart.Get();
        cart.Add(productId, quantity);
        _cart.Save(cart);

        return Json(new { count = cart.ItemCount, total = cart.Total });
    }

    // JSON body
    public record CartLineDto(int ProductId, int Quantity);
    public record CartUpdate(List&lt;CartLineDto&gt; Lines);

    [HttpPost]
    public IActionResult Update([FromBody] CartUpdate update)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var cart = _cart.Get();
        foreach (var line in update.Lines) cart.SetQuantity(line.ProductId, line.Quantity);
        _cart.Save(cart);

        return Json(new { count = cart.ItemCount, total = cart.Total });
    }

    // Server rendered HTML for a search box
    [HttpGet]
    public async Task&lt;IActionResult&gt; Results(string? term)
    {
        var products = await _db.Products
            .Where(p =&gt; term == null || p.Name.Contains(term))
            .OrderBy(p =&gt; p.Name)
            .Take(20)
            .ToListAsync();
        return PartialView("_ProductList", products);
    }
}

// Views/Products/Index.cshtml
//
//   &lt;input id="search" class="form-control" placeholder="Search products" /&gt;
//   &lt;div id="results"&gt;&lt;partial name="_ProductList" model="Model" /&gt;&lt;/div&gt;
//   @section Scripts {
//       &lt;script&gt;
//           const urls = {
//               results: "@Url.Action("Results", "Cart")",
//               add: "@Url.Action("Add", "Cart")"
//           };
//       &lt;/script&gt;
//       &lt;script src="~/js/products.js" asp-append-version="true"&gt;&lt;/script&gt;
//   }

// wwwroot/js/products.js
//
//   const token = document.querySelector('meta[name="csrf-token"]').content;
//   const search = document.getElementById("search");
//   const results = document.getElementById("results");
//   let timer;
//
//   search.addEventListener("input", () =&gt; {
//       clearTimeout(timer);
//       timer = setTimeout(async () =&gt; {
//           const response = await fetch(urls.results + "?term=" + encodeURIComponent(search.value));
//           if (response.ok) results.innerHTML = await response.text();
//       }, 300);
//   });
//
//   results.addEventListener("click", async (e) =&gt; {
//       const button = e.target.closest("[data-add]");
//       if (!button) return;
//
//       const form = new FormData();
//       form.append("productId", button.dataset.add);
//       form.append("quantity", 1);
//       form.append("__RequestVerificationToken", token);
//
//       const response = await fetch(urls.add, { method: "POST", body: form });
//       if (!response.ok) {
//           const err = await response.json().catch(() =&gt; ({ error: "Something went wrong" }));
//           alert(err.error);
//           return;
//       }
//       const data = await response.json();
//       document.getElementById("cart-count").textContent = data.count;
//   });
</code></pre>
