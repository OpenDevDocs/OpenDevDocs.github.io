---
publishDate: 2026-08-24T13:50
title: Anti Forgery Tokens and CSRF
slug: anti-forgery-tokens-and-csrf
metadescription: Understand how a cross site request forgery attack tricks a logged in user's browser into submitting a form, how the anti forgery token defeats it, how the form tag helper and ValidateAntiForgeryToken work together, and how to send the token with AJAX requests.
updateDate: 2026-09-14T13:50
author: ['bishal-biswas']
level: 2
tags: ['csrf', 'security', 'forms']
course: dotnet-mvc
---

## The attack

You are logged in to your bank in one tab. In another tab you open a page someone sent you. That page contains this, hidden:

```html
<form action="https://yourbank.com/Transfer" method="post" id="f">
    <input type="hidden" name="to" value="attacker" />
    <input type="hidden" name="amount" value="1000" />
</form>
<script>document.getElementById("f").submit();</script>
```

The form posts to your bank. Your browser attaches your bank's cookies, because that is what browsers do for every request to a site. The bank sees a valid session and a valid form and moves the money.

This is **cross site request forgery**, or CSRF. The attacker never sees your cookie. They just make your browser use it.

## The defence

The fix is to require something in the form that the attacking site cannot know: a random **anti forgery token**.

The server puts the token in two places: a hidden field in the form, and a cookie. When the form is posted, the server checks that the hidden field and the cookie match and were issued together. An attacker's page can make the browser send the cookie, but it cannot read the cookie to copy the value into a form field, because browsers block cross site cookie reads. The check fails and the request is rejected.

## What MVC does for you

The form tag helper adds the hidden field automatically:

```cshtml
<form asp-action="Transfer" method="post">
    <input asp-for="Amount" />
    <button type="submit">Send</button>
</form>
```

```html
<form action="/Bank/Transfer" method="post">
    <input name="__RequestVerificationToken" type="hidden" value="CfDJ8N..." />
    <input type="text" id="Amount" name="Amount" />
    <button type="submit">Send</button>
</form>
```

The action checks it with an attribute:

```csharp
[HttpPost]
[ValidateAntiForgeryToken]
public IActionResult Transfer(TransferViewModel vm)
```

If the token is missing or wrong, the request fails with a 400 before the action runs. That is the whole feature. Every POST form gets the field, every POST action gets the attribute.

The tag helper only adds the token for `method="post"`. GET forms do not need it, because GET requests should never change anything.

## Never forgetting the attribute

Forgetting `[ValidateAntiForgeryToken]` on one action leaves that action open. A global filter removes the risk:

```csharp
builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
});
```

`AutoValidateAntiforgeryToken` checks every request that is not GET, HEAD, OPTIONS or TRACE. You can then drop the per action attribute. For the rare action that must accept posts without a token, such as a webhook from a payment provider, add `[IgnoreAntiforgeryToken]`.

## Forms written by hand

If you write a `<form>` without the tag helper, or use a plain HTML form with an `action` attribute, add the token yourself:

```cshtml
<form action="/Bank/Transfer" method="post">
    @Html.AntiForgeryToken()
    ...
</form>
```

Note that the tag helper only activates when the form has at least one `asp-` attribute or no `action` attribute. A form with a hard coded `action` and no `asp-` attributes does not get the token automatically.

## AJAX requests

A `fetch` call does not submit a form, so there is no hidden field. You must send the token yourself. First, make it available on the page:

```cshtml
@inject Microsoft.AspNetCore.Antiforgery.IAntiforgery Antiforgery
@{
    var token = Antiforgery.GetAndStoreTokens(Context).RequestToken;
}
<meta name="csrf-token" content="@token" />
```

Then send it as a header:

```javascript
const token = document.querySelector('meta[name="csrf-token"]').content;

await fetch("/Cart/Add", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "RequestVerificationToken": token
    },
    body: JSON.stringify({ productId: 5, quantity: 1 })
});
```

The header name `RequestVerificationToken` is the default the validator looks for. The cookie is still sent automatically, so the pair matches.

A shortcut is to put a form with `@Html.AntiForgeryToken()` somewhere on the page and read the hidden input's value with JavaScript.

## What the token protects and what it does not

Anti forgery protects against another site making your users' browsers post to you. It does not protect against:

- **XSS**. If an attacker can run script on your page, they can read the token. Encode all output.
- **Requests from your own site's JavaScript** that an attacker controls. Same as above.
- **GET requests that change state**. The token is never checked on GET. Do not change data in GET actions.

It also does nothing for APIs called with a bearer token in a header instead of cookies, because those have no cookie for an attacker to ride on. Anti forgery matters when authentication is cookie based, which is the case for MVC apps.

## SameSite cookies

Modern browsers add a second layer. A cookie with `SameSite=Lax` (the default in most browsers now) is not sent on cross site POST requests. That alone blocks the classic attack. Keep the anti forgery token anyway: not all browsers behave the same, some flows need `SameSite=None`, and defence in depth is cheap here.

## Common errors

**"The antiforgery token could not be decrypted."** The data protection keys changed, usually because the app restarted with keys stored in a temporary place. Configure a persistent key store for production, as the publishing topic explains.

**400 on every POST after deploying to several servers.** Same cause. All instances must share data protection keys.

**Token missing in a partial loaded by AJAX.** Partials rendered later get a fresh token that may not match the page's cookie. Use the meta tag approach and send the header instead.

## Quick recap

- CSRF tricks a logged in browser into posting a form to your site from another site.
- The anti forgery token is a random value in a hidden field and a matching cookie, which an attacking site cannot read.
- The form tag helper adds the field, and `[ValidateAntiForgeryToken]` checks it.
- Add `AutoValidateAntiforgeryTokenAttribute` globally so no POST action is ever missed.
- Send the token as a `RequestVerificationToken` header from `fetch` calls.
- The token does not protect against XSS or state changing GET requests, so fix those separately.

<code id="code-content" class="language-csharp">
// Program.cs
builder.Services.AddControllersWithViews(options =&gt;
{
    // Every non GET request must carry a valid token. No per action attribute needed.
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
});

builder.Services.AddAntiforgery(options =&gt;
{
    options.HeaderName = "RequestVerificationToken";   // for fetch calls
    options.Cookie.SameSite = SameSiteMode.Strict;
});

// Controllers/CartController.cs
public class CartController : Controller
{
    private readonly ICartService _cart;
    public CartController(ICartService cart) =&gt; _cart = cart;

    // Normal form post: the form tag helper added the token automatically.
    [HttpPost]
    public IActionResult Remove(int productId)
    {
        _cart.Remove(productId);
        return RedirectToAction("Index");
    }

    // AJAX post: the token arrives in the RequestVerificationToken header.
    [HttpPost]
    public IActionResult Add([FromBody] AddToCartRequest request)
    {
        _cart.Add(request.ProductId, request.Quantity);
        return Json(new { count = _cart.ItemCount });
    }

    // A webhook from a payment provider cannot know our token.
    [HttpPost]
    [IgnoreAntiforgeryToken]
    public IActionResult PaymentWebhook([FromBody] PaymentEvent evt)
    {
        // verify the provider's own signature here instead
        return Ok();
    }
}

public record AddToCartRequest(int ProductId, int Quantity);

// Views/Shared/_Layout.cshtml (expose a token for JavaScript)
//
//   @inject Microsoft.AspNetCore.Antiforgery.IAntiforgery Antiforgery
//   @{ var csrf = Antiforgery.GetAndStoreTokens(Context).RequestToken; }
//   &lt;meta name="csrf-token" content="@csrf" /&gt;

// Views/Cart/Index.cshtml (a normal form gets the hidden field for free)
//
//   &lt;form asp-action="Remove" method="post"&gt;
//       &lt;input type="hidden" name="productId" value="@line.ProductId" /&gt;
//       &lt;button type="submit" class="btn btn-sm btn-outline-danger"&gt;Remove&lt;/button&gt;
//   &lt;/form&gt;

// wwwroot/js/cart.js (send the token as a header)
//
//   const token = document.querySelector('meta[name="csrf-token"]').content;
//
//   async function addToCart(productId, quantity) {
//       const response = await fetch("/Cart/Add", {
//           method: "POST",
//           headers: {
//               "Content-Type": "application/json",
//               "RequestVerificationToken": token
//           },
//           body: JSON.stringify({ productId, quantity })
//       });
//       if (!response.ok) throw new Error("Add to cart failed: " + response.status);
//       const data = await response.json();
//       document.getElementById("cart-count").textContent = data.count;
//   }
</code></pre>
