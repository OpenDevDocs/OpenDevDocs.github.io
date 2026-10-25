---
publishDate: 2026-05-28T10:22
title: Internationalisation
slug: internationalisation
metadescription: Translate a React app properly, handling plurals, dates, numbers and right to left layouts rather than just swapping strings.
updateDate: 2026-09-05T10:22
author: ['bishal-biswas']
level: 4
tags: ['i18n', 'accessibility', 'architecture']
course: react
---

## More than swapping strings

Translation is the easy part. The hard parts are:

- **Plurals.** English has two forms, Arabic has six, Japanese has one.
- **Word order.** "Asha's 3 books" reorders completely in other languages.
- **Dates and numbers.** `03/04/2026` is two different days depending on where you are.
- **Text length.** German is often 30% longer, which breaks fixed width buttons.
- **Direction.** Arabic and Hebrew run right to left, and that flips your entire layout.
- **Currency.** Formatting, symbol position and decimals all differ.

A translation function alone handles the first bullet and none of the rest.

## Use the platform

Browsers have excellent built in formatting.

```javascript
const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR'
});
console.log(formatter.format(1234567.89));
const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'long',
  timeStyle: 'short'
});
console.log(dateFormatter.format(new Date()));
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
console.log(relative.format(-3, 'day'));
const list = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });
console.log(list.format(['apples', 'pears', 'plums']));
```

`Intl` is built into every browser and Node. It handles Indian digit grouping, right to left marks and locale specific ordering, none of which you want to reimplement.

For plurals:

```javascript
const plural = new Intl.PluralRules('en');
console.log(plural.select(1));
console.log(plural.select(5));
```

Note that formatters are relatively expensive to create, so build them once rather than per render.

## A library

For the translation layer itself, use one. `react-i18next` and `react-intl` are the usual choices, and Next.js has its own conventions.

```bash
npm install i18next react-i18next
```

```javascript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        greeting: 'Hello, {{name}}',
        itemCount_one: '{{count}} item',
        itemCount_other: '{{count}} items',
        cart: { empty: 'Your cart is empty', checkout: 'Checkout' }
      }
    },
    hi: {
      translation: {
        greeting: 'नमस्ते, {{name}}',
        itemCount_one: '{{count}} वस्तु',
        itemCount_other: '{{count}} वस्तुएं',
        cart: { empty: 'आपकी टोकरी खाली है', checkout: 'भुगतान करें' }
      }
    }
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});
```

```javascript
import { useTranslation } from 'react-i18next';
function Cart({ items, userName }) {
  const { t, i18n } = useTranslation();
  if (items.length === 0) return <p>{t('cart.empty')}</p>;
  return (
    <div>
      <h1>{t('greeting', { name: userName })}</h1>
      <p>{t('itemCount', { count: items.length })}</p>
      <button>{t('cart.checkout')}</button>
    </div>
  );
}
```

`escapeValue: false` is correct here, because React already escapes everything it renders. Leaving it on double escapes.

## Keys, not English

```javascript
t('Hello, welcome back!');
t('greeting.welcomeBack');
```

Using English as the key seems convenient until you change the wording. Then every translation file breaks, or worse, silently keeps the old text.

Structure keys by feature:

```javascript
t('checkout.payment.cardNumber');
t('errors.network.timeout');
```

## Interpolation, not concatenation

```javascript
<p>{t('you have')} {count} {t('items in your cart')}</p>
<p>{t('cart.itemCount', { count })}</p>
```

The first assumes English word order and cannot be translated correctly into most languages. The second gives the translator one complete sentence to work with, which is what they need.

For markup inside a translation:

```javascript
import { Trans } from 'react-i18next';
<Trans i18nKey="terms">
  I accept the <a href="/terms">terms and conditions</a>
</Trans>
```

## Loading translations lazily

```javascript
i18n.use(initReactI18next).init({
  backend: {
    loadPath: '/locales/{{lng}}/{{ns}}.json'
  },
  ns: ['common'],
  defaultNS: 'common'
});
```

Bundling every language ships text nobody reads. Load the active one, and split by namespace so a page loads only its own strings.

## Right to left

```javascript
function App() {
  const { i18n } = useTranslation();
  const isRtl = ['ar', 'he', 'fa', 'ur'].includes(i18n.language);
  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [isRtl, i18n.language]);
  return <Router />;
}
```

Then use **logical CSS properties**, which flip automatically:

```css
.card {
  margin-left: 1rem;
  padding-right: 2rem;
  text-align: left;
}
.card {
  margin-inline-start: 1rem;
  padding-inline-end: 2rem;
  text-align: start;
}
```

In Tailwind, `ms-4` and `pe-8` are the logical versions of `ml-4` and `pr-8`. Using logical properties from the start costs nothing and saves a rewrite later.

Setting `lang` on `<html>` also matters for screen readers, which switch pronunciation based on it.

## Locale in the URL

```javascript
const router = createBrowserRouter([
  {
    path: '/:locale?',
    element: <LocaleLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'products', element: <Products /> }
    ]
  }
]);
```

`/hi/products` is shareable, bookmarkable and indexable. A language held only in state is none of those.

Add `hreflang` links so search engines understand the relationship:

```javascript
<link rel="alternate" hrefLang="hi" href="https://example.com/hi/products" />
```

## Test with a long language

Switch to German or Finnish and look for clipped buttons and broken layouts. Many i18n bugs are layout bugs that only appear once the text grows.

Some teams use a pseudo locale that lengthens every string and wraps it in brackets, which surfaces both untranslated strings and overflow at once.

## Quick recap

- Translation is the easy part, formatting and layout are the hard parts.
- Use `Intl` for numbers, dates, currency, lists and plural rules.
- Use a library for the translation layer, and build formatters once.
- Use structured keys, never English text as the key.
- Interpolate whole sentences instead of concatenating fragments.
- Load languages lazily and split by namespace.
- Set `dir` and `lang`, and use logical CSS properties.
- Put the locale in the URL, and test with a long language.

<code id="code-content" class="language-javascript">
import { useTranslation, Trans } from 'react-i18next';
import { useEffect, useMemo } from 'react';
// USE THE PLATFORM for formatting. Intl handles Indian digit grouping,
// right to left marks and locale ordering, none of which you want to
// reimplement. Build formatters ONCE, they are expensive to create.
function useFormatters(locale) {
  return useMemo(() =&gt; ({
    currency: new Intl.NumberFormat(locale, {
      style: 'currency', currency: 'INR'
    }),
    date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }),
    relative: new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
    list: new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' })
  }), [locale]);
}
export default function Cart({ items, userName, updatedAt }) {
  const { t, i18n } = useTranslation();
  const fmt = useFormatters(i18n.language);
  // Right to left flips your ENTIRE layout. Set dir and lang, then use
  // logical CSS properties (margin-inline-start, not margin-left) so it
  // flips automatically. lang also changes screen reader pronunciation.
  const isRtl = ['ar', 'he', 'fa', 'ur'].includes(i18n.language);
  useEffect(() =&gt; {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [isRtl, i18n.language]);
  if (items.length === 0) return &lt;p&gt;{t('cart.empty')}&lt;/p&gt;;
  const total = items.reduce((sum, i) =&gt; sum + i.price, 0);
  return (
    &lt;div&gt;
      {/* Interpolate a WHOLE sentence. Concatenating fragments assumes
          English word order and cannot be translated correctly. */}
      &lt;h1&gt;{t('cart.greeting', { name: userName })}&lt;/h1&gt;
      {/* The library picks the right plural form. English has two,
          Arabic has six, Japanese has one. */}
      &lt;p&gt;{t('cart.itemCount', { count: items.length })}&lt;/p&gt;
      &lt;p&gt;{fmt.currency.format(total)}&lt;/p&gt;
      &lt;p&gt;{fmt.date.format(updatedAt)}&lt;/p&gt;
      &lt;p&gt;{fmt.relative.format(-3, 'day')}&lt;/p&gt;
      &lt;p&gt;{fmt.list.format(items.map((i) =&gt; i.name))}&lt;/p&gt;
      {/* Markup inside a translated string */}
      &lt;Trans i18nKey="cart.terms"&gt;
        I accept the &lt;a href="/terms"&gt;terms and conditions&lt;/a&gt;
      &lt;/Trans&gt;
    &lt;/div&gt;
  );
}
// KEYS, NOT ENGLISH. Using the English text as the key means changing
// the wording silently breaks or strands every translation.
//   t('Hello, welcome back!')         wrong
//   t('cart.greeting')                right
// LOAD LAZILY. Bundling every language ships text nobody reads.
//   backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' }
// PUT THE LOCALE IN THE URL, so /hi/products is shareable, bookmarkable
// and indexable. A language held only in state is none of those.
// TEST WITH GERMAN OR FINNISH. Many i18n bugs are layout bugs that only
// appear once the text is 30% longer.
</code></pre>
