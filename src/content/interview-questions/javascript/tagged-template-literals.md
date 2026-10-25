---
course: javascript
slug: tagged-template-literals
experienceLevel: mid
difficulty: hard
tags:
  - template-literals
  - strings
  - functions
question: What are tagged template literals and what are they used for?
answer: |
  A tagged template is a template literal written directly after a function name, with no parentheses in between; instead of building a string, JavaScript calls `tag(strings, ...values)` with the literal text pieces and the evaluated expressions separately, and the tag can return anything.

  How the arguments look:

  - `strings` is a frozen array of the static text parts. It always has exactly one more element than `values`, so the parts and values interleave as `strings[0], values[0], strings[1], ...`.
  - `strings.raw` holds the same parts with escape sequences left unprocessed: `\n` stays as a backslash and an `n`.
  - The `strings` array is the **same object** every time a given template call site runs, which lets tags cache work per call site.
  - Since ES2018, invalid escapes such as `\u` followed by non-hex text are allowed in tagged templates; the cooked string becomes `undefined` while `raw` keeps the text.

  Real-world uses:

  1. **Escaping and safety**: SQL clients (`sql` tags in libraries such as postgres.js or Slonik) turn values into query parameters instead of concatenating them, preventing SQL injection. HTML tags can escape values to prevent XSS.
  2. **DSLs and templates**: styled-components and Emotion (`styled.div`), GraphQL's `gql`, lit's `html`.
  3. **`String.raw`**: built-in tag for strings with backslashes, such as Windows paths or regex sources.
  4. **Internationalisation**: tags that look up translations or format values.

  Pitfalls:

  - The tag receives **values**, not strings. If you just join them, you lose the safety benefit; escaping must happen inside the tag.
  - A template without a tag is evaluated immediately into a string, so passing an already-built string to a SQL function gives no protection.
  - Writing `sql(...)` with parentheses around a template literal passes one finished string, not the separate parts; the tag must be followed directly by the template.
codeExample: |
  function html(strings, ...values) {
    const escape = (v) => String(v)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    return strings.reduce((out, str, i) => out + str + (i < values.length ? escape(values[i]) : ''), '');
  }

  const userInput = '<img src=x onerror="alert(1)">';
  console.log(html`<p>Hello ${userInput}</p>`);
  // Output: <p>Hello &lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>

  // A SQL tag builds a parameterised query instead of concatenating strings
  function sql(strings, ...values) {
    return { text: strings.reduce((q, s, i) => `${q}$${i}${s}`), values };
  }
  console.log(sql`SELECT * FROM users WHERE name = ${"Bob'; DROP TABLE users;--"} AND age > ${30}`);
  // Output: {
  //   text: 'SELECT * FROM users WHERE name = $1 AND age > $2',
  //   values: [ "Bob'; DROP TABLE users;--", 30 ]
  // }

  function inspect(strings, ...values) {
    return [strings.length, values.length, strings.raw[0]];
  }
  console.log(inspect`a\n${1}b${2}`);                // Output: [ 3, 2, 'a\\n' ]
  console.log(String.raw`C:\new\table`);             // Output: C:\new\table

  const callSite = () => ((s) => s)`same`;
  console.log(callSite() === callSite());            // Output: true (strings array is cached)
popularity: 6.9
isPublished: true
---
