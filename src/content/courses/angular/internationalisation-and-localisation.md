---
publishDate: 2026-06-26T13:00
title: Internationalisation and Localisation
slug: internationalisation-and-localisation
metadescription: Translate an Angular application with the built in i18n tooling, and handle plurals, dates and right to left layouts.
updateDate: 2026-09-07T13:00
author: ['bishal-biswas']
level: 3
tags: ['i18n', 'localisation', 'translation']
course: angular
---

## Two approaches

**Angular's built in i18n** extracts marked text at build time and produces one build per language. Translations are baked in, so there is no runtime cost and no flash of untranslated text.

**A runtime library** such as Transloco or ngx-translate loads translations as JSON and swaps them without rebuilding.

```text
Built in i18n            Runtime library
one build per locale     one build, many languages
zero runtime cost        loads JSON at runtime
cannot switch live       switches instantly
best for SEO             needs care for SEO
```

Choose the built in tooling when locales are known and you can deploy several builds. Choose a runtime library when users switch language in the application, or when translations come from a service.

## Marking text

```html
<h1 i18n>Welcome to our shop</h1>

<p i18n="@@homeIntro">Browse thousands of products.</p>

<p i18n="Site footer|Copyright notice@@footerCopyright">
  All rights reserved.
</p>

<img [src]="logo" i18n-alt alt="Company logo">
<button i18n-title title="Add to basket">Add</button>
```

The `i18n` attribute marks an element's text. `i18n-alt` and `i18n-title` mark attributes.

The value has three optional parts:

```text
meaning|description@@id
```

**The id** after `@@` is the important one. Without it, Angular generates one from the content, so **changing the text invalidates the translation**. An explicit id keeps translations attached when wording changes.

Always use explicit ids. It is the difference between fixing a typo and losing every translation of that string.

## Extracting

```bash
ng extract-i18n --output-path src/locale
```

That produces `messages.xlf`:

```xml
<trans-unit id="homeIntro" datatype="html">
  <source>Browse thousands of products.</source>
  <context-group purpose="location">
    <context context-type="sourcefile">src/app/home/home.html</context>
  </context-group>
</trans-unit>
```

Copy it per language and add `<target>` elements:

```xml
<trans-unit id="homeIntro" datatype="html">
  <source>Browse thousands of products.</source>
  <target>Parcourez des milliers de produits.</target>
</trans-unit>
```

Other formats are available with `--format=xlf2`, `xmb` or `json`.

## Configuring locales

```json
{
  "projects": {
    "my-app": {
      "i18n": {
        "sourceLocale": "en-GB",
        "locales": {
          "fr": { "translation": "src/locale/messages.fr.xlf" },
          "de": { "translation": "src/locale/messages.de.xlf" },
          "ar": {
            "translation": "src/locale/messages.ar.xlf",
            "baseHref": "/ar/"
          }
        }
      },
      "architect": {
        "build": {
          "options": { "localize": true }
        }
      }
    }
  }
}
```

```bash
ng build
```

That produces `dist/my-app/browser/en-GB/`, `fr/`, `de/` and `ar/`. Serve each under its own path or domain.

Build one during development:

```bash
ng serve --configuration=fr
```

## Plurals and selects

```html
<p i18n="@@itemCount">
  {count, plural,
    =0 {No items}
    =1 {One item}
    other {{{count}} items}
  }
</p>
```

```html
<p i18n="@@userGreeting">
  {gender, select,
    male {He replied}
    female {She replied}
    other {They replied}
  }
</p>
```

This is ICU message syntax, and it exists because plural rules differ enormously between languages. English has two forms, Arabic has six, and Japanese has one. A translator can supply the right categories without you changing any code.

Never build a plural by concatenating:

```html
<!-- wrong: untranslatable -->
<p>{{ count }} item{{ count === 1 ? '' : 's' }}</p>
```

## Text in code

```typescript
import { $localize } from '@angular/localize/init';

export class UserService {
  getError(): string {
    return $localize`:@@loadFailed:Could not load the user`;
  }

  greet(name: string): string {
    return $localize`:@@greeting:Hello, ${name}:name:!`;
  }
}
```

The `:name:` placeholder names the interpolation so translators can reorder it. Languages put things in different orders, and an unnamed placeholder cannot move.

## Dates, numbers and currency

The pipes follow `LOCALE_ID` automatically once you localise the build.

```html
<p>{{ price | currency }}</p>
<p>{{ date | date:'medium' }}</p>
<p>{{ ratio | percent }}</p>
```

For a runtime library, set the locale explicitly:

```typescript
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

registerLocaleData(localeFr);

providers: [{ provide: LOCALE_ID, useValue: 'fr' }]
```

Without registering the data, a non default locale throws at runtime.

## Right to left

Arabic, Hebrew, Persian and Urdu run right to left, and it affects layout everywhere.

```html
<html lang="ar" dir="rtl">
```

Write CSS with logical properties, and the layout mirrors automatically:

```css
/* does not mirror */
margin-left: 1rem;
padding-right: 2rem;
text-align: left;
border-left: 2px solid;

/* mirrors correctly */
margin-inline-start: 1rem;
padding-inline-end: 2rem;
text-align: start;
border-inline-start: 2px solid;
```

Logical properties are well supported and remove the need for a separate stylesheet. Adopting them early costs nothing.

Icons indicating direction need flipping:

```css
[dir="rtl"] .chevron-forward {
  transform: scaleX(-1);
}
```

## Serving the right build

**Separate paths**, which is simplest:

```text
example.com/en/
example.com/fr/
```

**Separate subdomains:**

```text
en.example.com
fr.example.com
```

For SEO, add alternate links so search engines know the versions are related:

```html
<link rel="alternate" hreflang="en" href="https://example.com/en/">
<link rel="alternate" hreflang="fr" href="https://example.com/fr/">
<link rel="alternate" hreflang="x-default" href="https://example.com/en/">
```

Detect a preference from the `Accept-Language` header and redirect, but always let the user override it. Guessing wrong and offering no way out is a common frustration.

## Practical advice

**Mark text as you write it.** Retrofitting `i18n` across an existing application is tedious and always misses some.

**Use explicit ids everywhere.** Without them, every copy edit destroys translations.

**Never concatenate sentences.** Word order differs, and fragments are untranslatable.

```typescript
// wrong
const message = 'You have ' + count + ' new ' + (count === 1 ? 'message' : 'messages');

// right
$localize`:@@newMessages:{count, plural, =1 {One new message} other {{{count}} new messages}}`;
```

**Leave room in the layout.** German and Finnish text is often 30 percent longer than English. A button sized exactly to its English label will break.

**Give translators context.** The description part of the `i18n` value is the only thing telling them whether "Post" is a verb or a noun.

## Quick recap

- Built in i18n builds one bundle per locale with no runtime cost.
- A runtime library allows live switching, at the cost of loading translations.
- Always give messages an explicit `@@id`, or edits destroy translations.
- Use ICU plural and select syntax rather than concatenating.
- Name placeholders in `$localize` so translators can reorder them.
- Use CSS logical properties and right to left layout mirrors for free.
- Leave room for longer text and give translators context.

<code id="code-content" class="language-typescript">
import { Component, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
@Component({
  selector: 'app-shop',
  template: `
    &lt;!-- meaning|description@@id. The ID is the important part: without it
         Angular derives one from the CONTENT, so fixing a typo destroys
         every translation of that string. --&gt;
    &lt;h1 i18n="@@shopTitle"&gt;Welcome to our shop&lt;/h1&gt;
    &lt;p i18n="Home page|Introductory text@@homeIntro"&gt;Browse thousands of products.&lt;/p&gt;
    &lt;!-- attributes are marked separately --&gt;
    &lt;img [src]="logo" i18n-alt alt="Company logo"&gt;
    &lt;button i18n-title title="Add to basket"&gt;Add&lt;/button&gt;
    &lt;!-- ICU plurals. English has two forms, Arabic six, Japanese one.
         A translator supplies the right categories with no code change. --&gt;
    &lt;p i18n="@@itemCount"&gt;
      {count, plural,
        =0 {No items}
        =1 {One item}
        other {{{count}} items}
      }
    &lt;/p&gt;
    &lt;!-- NEVER build a plural by concatenation. It is untranslatable.
         WRONG: {{ count }} item{{ count === 1 ? '' : 's' }} --&gt;
    &lt;!-- these follow LOCALE_ID automatically once the build is localised --&gt;
    &lt;p&gt;{{ price | currency }} {{ date | date:'medium' }}&lt;/p&gt;
  `,
  styles: `
    /* LOGICAL properties mirror automatically for right to left languages.
       Physical ones do not, and need a whole separate stylesheet. */
    .card {
      margin-inline-start: 1rem;    /* not margin-left */
      padding-inline-end: 2rem;     /* not padding-right */
      text-align: start;            /* not left */
      border-inline-start: 2px solid;
    }
    [dir="rtl"] .chevron-forward { transform: scaleX(-1); }
  `,
})
export class Shop {}
// Text in code. Name the placeholder so translators can REORDER it,
// because languages put things in different orders.
//   $localize`:@@greeting:Hello, ${name}:name:!`
// Workflow:
//   ng extract-i18n --output-path src/locale     produces messages.xlf
//   copy per language, add &lt;target&gt; elements
//   angular.json: i18n.locales = { fr: { translation: '...messages.fr.xlf' } }
//   "localize": true in the build options
//   ng build          -&gt; dist/.../en-GB/  fr/  de/
//   ng serve --configuration=fr    during development
// A runtime library instead needs the locale data registered explicitly,
// or a non default locale throws:
registerLocaleData(localeFr);
export const providers = [{ provide: LOCALE_ID, useValue: 'fr' }];
// SEO: tell search engines the versions are related
//   &lt;link rel="alternate" hreflang="fr" href="https://example.com/fr/"&gt;
//   &lt;link rel="alternate" hreflang="x-default" href="https://example.com/en/"&gt;
// Practical: mark text AS YOU WRITE IT, always use explicit ids, never
// concatenate sentences, and leave room. German is often 30% longer.
</code></pre>
