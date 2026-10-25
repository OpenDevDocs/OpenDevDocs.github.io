---
publishDate: 2026-10-25T09:26
title: 'Template Engines: EJS, Pug and Handlebars'
slug: template-engines
metadescription: Learn how Express 5 renders HTML pages with template engines, pass data with res.render, reuse layouts and partials, and compare EJS, Pug and Handlebars side by side.
updateDate: 2026-10-25T09:26
author: ['bishal-biswas']
level: 2
tags: ['express', 'templates', 'ejs', 'server-side-rendering']
course: expressjs
---

## What you will learn

- What a **template engine** is and why you would render HTML on the server
- How to set up **EJS** and render pages with `res.render()`
- How to share headers and footers with **partials**, and global data with `res.locals`
- How **Pug** and **Handlebars** compare to EJS
- Why escaping output protects you from XSS attacks

## Why not just send HTML strings?

In earlier lessons you sent HTML like this:

```js
res.send(`<h1>Hello, ${name}</h1><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`);
```

It works for one line. For a full page with a header, navigation, a footer and a list of products, it becomes unreadable. Worse, if `name` contains HTML typed by a user, it gets injected straight into your page.

A **template engine** solves both problems. A **template** is an HTML file with placeholders. The engine fills in the placeholders with your data and produces the final HTML. This is called **server-side rendering (SSR)**: the server builds the full page before sending it.

**Think of it like a form letter.** The letter is written once: "Dear `____`, your order `____` has shipped." For each customer, you fill in the blanks. The template is the letter; your data fills the blanks.

```text
template (views/home.ejs)  +  data { title, items }
                 \                /
                  v              v
               template engine (EJS)
                        |
                        v
               finished HTML  -->  browser
```

## How Express uses template engines

Express has a built-in rendering system. You only need to tell it two things:

1. **Which engine** to use, with `app.set('view engine', ...)`.
2. **Where your templates live**, with `app.set('views', ...)`. Templates are often called **views**.

Then you call **`res.render(viewName, data)`** in a route. Express finds the file, asks the engine to fill it in, and sends the HTML with status 200.

> **Note:** If you skip `app.set('views', ...)`, Express looks in a `views` folder inside the directory where you **started** Node (the current working directory). Setting it explicitly avoids confusing "Failed to lookup view" errors when you start the app from another folder.

## EJS: HTML with a little JavaScript

**EJS** (Embedded JavaScript) is the easiest engine to start with, because templates are just HTML plus special tags. If you know HTML and JavaScript, you already know most of EJS.

```bash
npm install ejs
```

Project layout:

```text
my-site/
  package.json
  app.js
  views/
    home.ejs
    partials/
      header.ejs
      footer.ejs
```

The app:

```js
// app.js
import path from 'node:path';
import express from 'express';

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(import.meta.dirname, 'views')); // Node 20.11+

app.get('/', (req, res) => {
  res.render('home', {
    title: 'My Shop',
    user: { name: 'Asha' },
    products: ['Keyboard', 'Mouse', 'Monitor'],
  });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

You write `res.render('home', ...)` without the `.ejs` extension. Express adds it because you set the view engine.

The template:

```html
<!-- views/home.ejs -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title><%= title %></title>
  </head>
  <body>
    <h1>Welcome to <%= title %></h1>

    <% if (user) { %>
      <p>Hello, <%= user.name %>!</p>
    <% } else { %>
      <p>Please log in.</p>
    <% } %>

    <ul>
      <% products.forEach((product) => { %>
        <li><%= product %></li>
      <% }) %>
    </ul>
  </body>
</html>
```

EJS has three tags you will use constantly:

| Tag | What it does | Example |
| --- | --- | --- |
| `<%= value %>` | Prints the value, **escaped** (safe) | `<%= user.name %>` |
| `<%- value %>` | Prints the value **unescaped** (raw HTML) | `<%- include('partials/header') %>` |
| `<% code %>` | Runs JavaScript, prints nothing | `<% if (user) { %>` |

Open `http://localhost:3000` and you will see a real page with the list filled in.

### Escaping: why `<%=` is your friend

**Escaping** means converting special characters such as `<` and `>` into harmless codes like `&lt;` and `&gt;`. The browser then shows them as text instead of running them as HTML.

Imagine a user sets their name to `<script>stealCookies()</script>`. With `<%= user.name %>`, the page shows that text literally. With `<%- user.name %>`, the browser **runs the script**. This attack is called **cross-site scripting (XSS)**.

> **Warning:** Use `<%=` for anything that came from users or a database. Only use `<%-` for HTML you fully control, such as including your own partials. You will learn more in [Preventing Injection, XSS and CSRF](/courses/expressjs/preventing-injection-xss-csrf).

### Partials: reuse headers and footers

A **partial** is a small template that you include inside other templates. Write the header once and include it on every page:

```html
<!-- views/partials/header.ejs -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title><%= title %></title>
  </head>
  <body>
    <nav><a href="/">Home</a> | <a href="/about">About</a></nav>
```

```html
<!-- views/partials/footer.ejs -->
    <footer>&copy; My Shop</footer>
  </body>
</html>
```

```html
<!-- views/about.ejs -->
<%- include('partials/header', { title: 'About us' }) %>
<h1>About us</h1>
<p>We sell keyboards and other useful things.</p>
<%- include('partials/footer') %>
```

The include path is relative to the current template file. Notice the `<%-` tag: the partial produces HTML, and you want it inserted as HTML, not escaped.

## Data for every page: res.locals and app.locals

Some data is needed on every page: the logged-in user, the site name, the current year. Passing it to every `res.render()` call gets repetitive.

Express merges two extra objects into every template automatically:

- **`app.locals`**: data shared by the **whole app**, set once at startup.
- **`res.locals`**: data for **this request only**, usually set by middleware.

```js
// app.js
app.locals.siteName = 'My Shop'; // available in every template

app.use((req, res, next) => {
  res.locals.currentPath = req.path; // available in templates for this request
  res.locals.year = new Date().getFullYear();
  next();
});
```

```html
<!-- views/partials/footer.ejs -->
    <footer>&copy; <%= year %> <%= siteName %></footer>
  </body>
</html>
```

Data passed directly to `res.render()` wins if the same name exists in more than one place.

## Rendering error and 404 pages

Templates make your 404 and error pages look like the rest of the site:

```js
// app.js (after all routes)
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page not found' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err);
  res.status(500).render('error', { title: 'Something went wrong' });
});
```

If a template has a mistake (for example, it uses a variable you did not pass), `res.render()` fails. When you do not pass a callback to `res.render()`, Express forwards that failure to `next(err)` for you, so it reaches your error handler like any other error.

> **Tip:** A broken template inside your **error** page would fail again. Keep `error.ejs` very simple, with no includes or variables that might be missing.

## Pug: indentation instead of tags

**Pug** takes a completely different approach. There are no closing tags. Indentation (spaces) decides what goes inside what.

```bash
npm install pug
```

```js
// app.js
app.set('view engine', 'pug');
```

```text
//- views/home.pug
doctype html
html(lang='en')
  head
    meta(charset='utf-8')
    title= title
  body
    h1 Welcome to #{title}
    if user
      p Hello, #{user.name}!
    else
      p Please log in.
    ul
      each product in products
        li= product
```

The route does not change at all: `res.render('home', { ... })` works the same way. That is the nice thing about Express's view system; you can swap engines without touching your routes.

In Pug, `=` and `#{}` escape their output. The unescaped versions are `!=` and `!{}`. Layouts are built with `extends` and `block`, and partials with `include`.

## Handlebars: logic-less templates

**Handlebars** keeps templates close to plain HTML but allows only very simple logic: `if`, `each`, and helpers. This pushes real logic into your JavaScript, which many teams like. Express integration comes from the `express-handlebars` package.

```bash
npm install express-handlebars
```

```js
// app.js
import path from 'node:path';
import express from 'express';
import { engine } from 'express-handlebars';

const app = express();

app.engine('hbs', engine({ extname: '.hbs' })); // register the engine
app.set('view engine', 'hbs');
app.set('views', path.join(import.meta.dirname, 'views'));

app.get('/', (req, res) => {
  res.render('home', { title: 'My Shop', products: ['Keyboard', 'Mouse'] });
});
```

`express-handlebars` uses a **layout** by default: a wrapper page in `views/layouts/main.hbs`. Each view is inserted where the layout says `{{{body}}}`:

```html
<!-- views/layouts/main.hbs -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>{{title}}</title>
  </head>
  <body>
    {{{body}}}
  </body>
</html>
```

```html
<!-- views/home.hbs -->
<h1>Welcome to {{title}}</h1>
<ul>
  {{#each products}}
    <li>{{this}}</li>
  {{/each}}
</ul>
```

Double braces `{{value}}` escape output. Triple braces `{{{value}}}` print raw HTML, which is why the layout uses them for `body`.

## Which one should you pick?

| | EJS | Pug | Handlebars |
| --- | --- | --- | --- |
| Looks like | HTML + `<% %>` tags | Indented shorthand | HTML + `{{ }}` |
| Logic in templates | Full JavaScript | JavaScript-like | Very limited (by design) |
| Learning curve | Easiest if you know HTML | New syntax to learn | Easy |
| Layouts | Partials via `include` | `extends` / `block` | Built-in layouts |
| Escaped / raw output | `<%= %>` / `<%- %>` | `=` / `!=` | `{{ }}` / `{{{ }}}` |

All three are mature and work well with Express 5. If you are unsure, start with **EJS**: there is almost nothing new to learn.

> **Note:** Many modern projects use Express only as a JSON API, and build pages with a frontend framework like React instead. Templates are still a great fit for admin panels, emails, simple websites and apps that need fast first page loads without much JavaScript.

## Common mistakes

> **Common mistake:** Writing `res.render('views/home')` or `res.render('home.ejs')`. The `views` folder and the extension are added for you. Just write `res.render('home')`.

> **Common mistake:** Forgetting to install the engine. `app.set('view engine', 'ejs')` alone is not enough; without `npm install ejs`, rendering fails with "Cannot find module 'ejs'".

> **Common mistake:** Using the raw output tags (`<%-`, `!=`, `{{{ }}}`) for user data. It opens your site to XSS.

## Key takeaways

- A **template engine** fills HTML templates with data, so the server sends finished pages.
- Configure with `app.set('view engine', ...)` and `app.set('views', ...)`, then call **`res.render(view, data)`**.
- Share data with **`app.locals`** (whole app) and **`res.locals`** (one request).
- Reuse markup with partials or layouts. EJS uses `include`, Pug `extends`, Handlebars has built-in layouts.
- Always use the **escaped** output syntax for user data to prevent XSS.

## Practice

1. Build the EJS shop page with a header and footer partial. Add an `/about` page that reuses them.
2. Add middleware that sets `res.locals.currentPath`, and use it to highlight the active link in your navigation.
3. Create a styled `404.ejs` and render it from your 404 handler with status 404.
4. Rebuild the home page in Pug or Handlebars without changing your route code. Which syntax do you prefer?

## What's next

Pages often need to remember small things about a visitor, like their preferred theme. That is what cookies are for. Continue with [Cookies with cookie-parser](/courses/expressjs/cookies-and-cookie-parser).
